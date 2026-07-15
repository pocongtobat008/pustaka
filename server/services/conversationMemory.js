import { knex } from '../db.js';

/**
 * Save a conversation summary for RAG memory.
 * Called after a chat session ends or periodically during long sessions.
 */
export async function saveConversationSummary(sessionId, userId, summary, keyTopics = [], messageCount = 0, embedFn = null) {
    try {
        const [row] = await knex('ai_conversation_summaries')
            .insert({
                session_id: sessionId,
                user_id: userId,
                summary: summary.slice(0, 2000),
                key_topics: Array.isArray(keyTopics) ? keyTopics.join(', ') : keyTopics,
                message_count: messageCount,
                created_at: knex.fn.now(),
            })
            .returning('id');

        const id = typeof row === 'object' ? row.id : row;

        // Generate embedding for semantic search
        if (embedFn) {
            try {
                const embeddingText = `${summary} ${keyTopics.join(' ')}`;
                const vector = await embedFn(embeddingText);
                const vecStr = '[' + vector.join(',') + ']';
                await knex.raw('UPDATE ai_conversation_summaries SET embedding = ?::vector WHERE id = ?', [vecStr, id]);
            } catch (err) {
                console.warn(`[ConversationMemory] Embedding failed: ${err.message}`);
            }
        }

        return id;
    } catch (err) {
        console.error(`[ConversationMemory] Save failed: ${err.message}`);
        return null;
    }
}

/**
 * Search for relevant past conversations using semantic similarity.
 * Returns top N relevant summaries for context injection.
 */
export async function searchRelevantConversations(query, embedFn = null, { limit = 3, userId = null } = {}) {
    if (!embedFn) return [];

    try {
        const queryVector = await embedFn(query);
        const vecStr = '[' + queryVector.join(',') + ']';

        let sql = `
            SELECT id, session_id, summary, key_topics, message_count, created_at,
                   1 - (embedding <=> ?::vector) AS similarity
            FROM ai_conversation_summaries
            WHERE embedding IS NOT NULL
        `;
        const params = [vecStr];

        if (userId) {
            sql += ` AND user_id = ?`;
            params.push(userId);
        }

        sql += ` ORDER BY embedding <=> ?::vector LIMIT ?`;
        params.push(vecStr, limit);

        const results = await knex.raw(sql, params);
        const rows = results.rows || [];

        // Filter by minimum similarity
        return rows
            .filter(r => r.similarity >= 0.3)
            .map(r => ({
                summary: r.summary,
                keyTopics: r.key_topics,
                similarity: Number(r.similarity).toFixed(3),
                createdAt: r.created_at,
            }));
    } catch (err) {
        console.warn(`[ConversationMemory] Search failed: ${err.message}`);
        return [];
    }
}

/**
 * Auto-generate a summary from conversation messages.
 * Simple extractive approach: take first user question + last assistant answer.
 */
export function generateSummaryFromMessages(messages) {
    if (!messages || messages.length < 2) return null;

    const userMsgs = messages.filter(m => m.role === 'user');
    const assistantMsgs = messages.filter(m => m.role === 'assistant');

    if (userMsgs.length === 0 || assistantMsgs.length === 0) return null;

    const firstQuestion = userMsgs[0].content || '';
    const lastAnswer = assistantMsgs[assistantMsgs.length - 1].content || '';

    // Extract key topics from the conversation
    const allText = messages.map(m => m.content || '').join(' ').toLowerCase();
    const topics = [];
    const topicPatterns = [
        [/ppn|vat|pajak pertambahan/i, 'PPN'],
        [/pph|pajak penghasilan/i, 'PPh'],
        [/invoice|faktur/i, 'Invoice'],
        [/dokumen|arsip/i, 'Dokumen'],
        [/coa|akun/i, 'COA'],
        [/inventory|box|rak/i, 'Inventory'],
        [/approval|persetujuan/i, 'Approval'],
        [/wp|wajib pajak/i, 'Wajib Pajak'],
        [/audit|pemeriksaan/i, 'Audit'],
    ];

    for (const [pattern, topic] of topicPatterns) {
        if (pattern.test(allText)) topics.push(topic);
    }

    // Build summary
    const summary = `User bertanya tentang: "${firstQuestion.slice(0, 200)}". Jawaban membahas: ${lastAnswer.slice(0, 300)}`;

    return {
        summary: summary.slice(0, 1000),
        keyTopics: topics,
        messageCount: messages.length,
    };
}

/**
 * Auto-summarize a session after it reaches a certain length.
 * Called by the worker after saving chat messages.
 */
export async function autoSummarizeSession(sessionId, userId, embedFn = null) {
    try {
        // Check if summary already exists for this session
        const existing = await knex('ai_conversation_summaries')
            .where('session_id', sessionId)
            .first();
        if (existing) return; // already summarized

        // Get all messages for this session
        const messages = await knex('ai_chat_messages')
            .where('session_id', sessionId)
            .orderBy('created_at', 'asc')
            .limit(50);

        if (messages.length < 4) return; // too short to summarize

        const generated = generateSummaryFromMessages(messages);
        if (generated) {
            await saveConversationSummary(
                sessionId, userId,
                generated.summary,
                generated.keyTopics,
                generated.messageCount,
                embedFn
            );
            console.log(`[ConversationMemory] Auto-summarized session ${sessionId}: ${generated.keyTopics.join(', ')}`);
        }
    } catch (err) {
        console.warn(`[ConversationMemory] Auto-summarize failed: ${err.message}`);
    }
}

/**
 * Get conversation memory stats.
 */
export async function getMemoryStats() {
    const total = await knex('ai_conversation_summaries').count('id as c').first();
    const withEmbedding = await knex('ai_conversation_summaries')
        .whereNotNull('embedding')
        .count('id as c').first();
    return {
        totalSummaries: Number(total?.c || 0),
        withEmbedding: Number(withEmbedding?.c || 0),
    };
}
