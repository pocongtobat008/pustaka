import { handleError } from '../utils/errorHandler.js';
import { addAiAgentJob } from '../queue.js';
import { runAgent } from '../services/aiAgent.js';
import { saveUserMessage, saveAssistantMessage } from '../services/chatHistory.js';

// ── SSE Streaming: jalankan agent langsung (tanpa queue) & stream token/status ke client ──
export const agentChatStream = async (req, res) => {
    const { message, history, sessionId } = req.body || {};
    if (!message || !String(message).trim()) {
        return res.status(400).json({ error: 'Pesan wajib diisi.' });
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();

    const send = (event, payload) => {
        if (res.writableEnded) return;
        res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    const ac = new AbortController();
    // Hanya res 'close' — sinyal kanonikal client disconnect untuk SSE.
    // (req 'close' bisa terpicu saat request body selesai dibaca → berisiko abort prematur.)
    res.on('close', () => {
        const partialText = streamedText.trim();
        if (partialText && !persistedRef.current) {
            persistedRef.current = true;
            persistAssistant({ content: partialText, partial: true }).then(() => {
                console.log(`[AI Stream] partial persisted on close (${partialText.length} chars)`);
            });
        }
        ac.abort(); // client disconnect → batalkan LLM call (supaya tidak boros)
    });

    const userContext = req.user ? {
        id: req.user.id,
        username: req.user.username,
        role: req.user.role,
    } : null;
    const userId = req.user?.id || null;
    const sid = sessionId || null;

    // Track streamed tokens so we can persist partial content if the stream is stopped
    let streamedText = '';
    let streamedReasoning = '';
    const streamedSteps = [];
    const seenSteps = new Set();
    const persistedRef = { current: false };

    // Persist assistant message (full on success, partial on stop/error)
    const persistAssistant = async (payload) => {
        if (!sid || !userId) return;
        try {
            await saveAssistantMessage(sid, userId, payload);
        } catch (err) {
            console.warn(`[AI Stream] Persist assistant message failed: ${err.message}`);
        }
    };

    // Persist user message first → ordering terjamin (question survives mid-stream stop)
    await saveUserMessage(sid, userId, String(message)).catch(err =>
        console.warn(`[AI Stream] Persist user message failed: ${err.message}`)
    );

    try {
        const result = await runAgent(
            String(message),
            Array.isArray(history) ? history : [],
            null, // embedFn — tidak dipakai di worker, biarkan null (jalur STEP 3 dilewati)
            sid,
            userContext,
            {
                signal: ac.signal,
                stream: true,
                onStatus: (text) => {
                    send('status', { text });
                    const key = 'status:' + text;
                    if (!seenSteps.has(key)) {
                        seenSteps.add(key);
                        streamedSteps.push({ type: 'status', label: text });
                    }
                },
                onTool: (name) => {
                    send('tool', { name });
                    const key = 'tool:' + name;
                    if (!seenSteps.has(key)) {
                        seenSteps.add(key);
                        streamedSteps.push({ type: 'tool', label: name });
                    }
                },
                onReasoning: (text) => {
                    streamedReasoning += text;
                    send('reasoning', { text });
                },
                onToken: (text) => {
                    streamedText += text;
                    send('token', { text });
                },
            }
        );
        send('done', {
            reply: result.reply,
            toolCalls: result.toolCalls || [],
            fromCache: !!result.fromCache,
            cacheAge: result.cacheAge || null,
            suggestions: result.suggestions || [],
        });
        // Persist full assistant reply — fire & forget supaya res.end() langsung dieksekusi
        // (jangan menunda penutupan stream karena auto-summarize bisa lambat).
        if (!persistedRef.current) {
            persistedRef.current = true;
            persistAssistant({
                content: result.reply,
                toolCalls: result.toolCalls || [],
                fromCache: !!result.fromCache,
                cacheAge: result.cacheAge || null,
                partial: false,
                reasoning: streamedReasoning || null,
                thinkingSteps: streamedSteps.length ? streamedSteps : null,
            }).catch(() => {});
        }
        res.end();
    } catch (e) {
        if (e.name === 'AbortError' || ac.signal.aborted) {
            // User stopped the stream → persist partial content so it's not lost
            const partialText = streamedText.trim();
            if (partialText && !persistedRef.current) {
                persistedRef.current = true;
                await persistAssistant({ content: partialText, partial: true });
            }
            res.end();
            return;
        }
        // Error → persist what we have (if any) as partial, then send error event
        const partialText = streamedText.trim();
        if (partialText && !persistedRef.current) {
            persistedRef.current = true;
            await persistAssistant({ content: partialText, partial: true });
        }
        send('error', { message: e.message || 'Terjadi kesalahan saat memproses.' });
        res.end();
    }
};

export const agentChat = async (req, res) => {
    try {
        const { message, history, sessionId } = req.body || {};
        if (!message || !String(message).trim()) {
            return res.status(400).json({ error: 'Pesan wajib diisi.' });
        }
        const userContext = req.user ? {
            id: req.user.id,
            username: req.user.username,
            role: req.user.role
        } : null;
        const job = await addAiAgentJob(String(message), Array.isArray(history) ? history : [], sessionId || null, userContext);
        if (!job) return res.status(500).json({ error: 'Gagal mengantri permintaan AI Agent.' });
        res.json({
            jobId: job.id,
            status: 'processing',
            message: 'AI Agent sedang menganalisis database...'
        });
    } catch (e) {
        handleError(res, e, 'AI Agent');
    }
};
