import express from 'express';
import { agentChat, agentChatStream } from '../controllers/aiController.js';
import { getCacheStats, invalidateCache } from '../services/agentCache.js';
import * as chatHistory from '../services/chatHistory.js';
import { getWarmLogs, getLatestWarmLog, getWarmConfig, updateWarmConfig } from '../services/cacheWarmer.js';
import { addCacheWarmJob } from '../queue.js';
import { getProactiveInsights } from '../services/insightsEngine.js';
import { getMemoryStats } from '../services/conversationMemory.js';
import { buildKnowledgeGraph } from '../services/knowledgeGraph.js';
import { checkAuth } from '../middleware/auth.js';
import { knex } from '../db.js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const router = express.Router();

// --- Agent ---
router.post('/ai/agent', checkAuth, agentChat);
router.post('/ai/agent/stream', checkAuth, agentChatStream);

// POST /api/ai/agent/pdf — export an AI Agent answer to a PDF document
router.post('/ai/agent/pdf', checkAuth, async (req, res) => {
    try {
        const { title = 'AI Agent Report', content = '', thinking } = req.body || {};
        if (!content || !String(content).trim()) {
            return res.status(400).json({ error: 'Konten jawaban kosong.' });
        }

        const PAGE_W = 595.28; // A4
        const PAGE_H = 841.89;
        const MARGIN_X = 48;
        const MARGIN_Y = 64;
        const CONTENT_W = PAGE_W - MARGIN_X * 2;

        const safeText = (v) => {
            const s = String(v ?? '').replace(/[\r\n\t]+/g, ' ').trim();
            return s.replace(/[^\x20-\x7E]/g, (ch) => {
                const map = { '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '•': '-', '·': '-', '→': '->', '°': ' deg ' };
                return map[ch] || '';
            });
        };

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);
        let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
        let y = PAGE_H - MARGIN_Y;
        const fontSize = 9.5;
        const lineGap = 13.5;

        const ensureSpace = (needed) => {
            if (y - needed < 46) {
                page = pdfDoc.addPage([PAGE_W, PAGE_H]);
                y = PAGE_H - MARGIN_Y;
            }
        };

        const writeLine = (text, opts = {}) => {
            const words = safeText(text).split(' ');
            let cur = '';
            const flush = () => {
                if (!cur) return;
                ensureSpace(lineGap);
                page.drawText(cur, {
                    x: MARGIN_X,
                    y,
                    size: opts.size || fontSize,
                    font: opts.bold ? fontBold : font,
                    color: opts.color || rgb(0.15, 0.16, 0.2),
                });
                y -= lineGap;
                cur = '';
            };
            for (const w of words) {
                const test = cur ? cur + ' ' + w : w;
                if (font.widthOfTextAtSize(test, opts.size || fontSize) > CONTENT_W) flush();
                cur = cur ? cur + ' ' + w : w;
            }
            flush();
        };

        // ── Header ──
        page.drawRectangle({ x: 0, y: PAGE_H - 50, width: PAGE_W, height: 50, color: rgb(0.16, 0.21, 0.5) });
        page.drawRectangle({ x: 0, y: PAGE_H - 54, width: PAGE_W, height: 4, color: rgb(0.95, 0.72, 0.18) });
        page.drawText('AI AGENT REPORT', {
            x: MARGIN_X, y: PAGE_H - 34, size: 15, font: fontBold, color: rgb(1, 1, 1)
        });
        page.drawText(safeText(title).slice(0, 80), {
            x: MARGIN_X, y: PAGE_H - 48, size: 8.5, font, color: rgb(0.85, 0.88, 1)
        });

        // ── Thinking section (collapsible analog) ──
        if (thinking && String(thinking).trim()) {
            ensureSpace(lineGap * 2);
            writeLine('THINKING', { bold: true, size: 8, color: rgb(0.45, 0.42, 0.55) });
            writeLine(String(thinking), { size: 8, color: rgb(0.45, 0.42, 0.55) });
            y -= 8;
        }

        // ── Answer body ──
        ensureSpace(lineGap * 2);
        writeLine('JAWABAN', { bold: true, size: 8, color: rgb(0.45, 0.42, 0.55) });
        for (const para of String(content).split(/\n{2,}/)) {
            // Preserve simple markdown headings as bold lines
            const trimmed = para.trim();
            if (!trimmed) continue;
            if (/^#{1,3}\s/.test(trimmed)) {
                writeLine(trimmed.replace(/^#{1,3}\s*/, '').replace(/[*_`]/g, ''), { bold: true, size: 11 });
            } else {
                writeLine(trimmed.replace(/[*_`]/g, ''));
            }
            y -= 3;
        }

        // ── Footer ──
        const totalPages = pdfDoc.getPageCount();
        for (let i = 0; i < totalPages; i++) {
            const p = pdfDoc.getPage(i);
            p.drawLine({
                start: { x: MARGIN_X, y: 40 }, end: { x: PAGE_W - MARGIN_X, y: 40 },
                thickness: 0.6, color: rgb(0.75, 0.78, 0.85),
            });
            p.drawText(`Dibuat: ${new Date().toLocaleString('id-ID')}`, {
                x: MARGIN_X, y: 24, size: 8, font, color: rgb(0.4, 0.42, 0.48)
            });
            p.drawText(`Halaman ${i + 1} / ${totalPages}`, {
                x: PAGE_W - MARGIN_X - 90, y: 24, size: 8, font: fontMono, color: rgb(0.4, 0.42, 0.48)
            });
        }

        const pdfBytes = await pdfDoc.save();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=AI_Agent_Report_${Date.now()}.pdf`);
        res.send(Buffer.from(pdfBytes));
    } catch (e) {
        console.error('[AI Agent] PDF export error:', e);
        res.status(500).json({ error: e.message || 'Gagal membuat PDF' });
    }
});

// --- Cache ---
router.get('/ai/cache/stats', checkAuth, async (req, res) => {
    try {
        const stats = await getCacheStats();
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/ai/cache', checkAuth, async (req, res) => {
    try {
        await invalidateCache();
        res.json({ success: true, message: 'Agent cache cleared' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Chat Sessions ---
router.get('/ai/sessions', checkAuth, async (req, res) => {
    try {
        const sessions = await chatHistory.getSessions(req.user.id);
        res.json(sessions);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/ai/sessions', checkAuth, async (req, res) => {
    try {
        const session = await chatHistory.createSession(req.user.id, req.body?.title);
        res.json(session);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/ai/sessions/:id', checkAuth, async (req, res) => {
    try {
        const session = await chatHistory.getSession(Number(req.params.id), req.user.id);
        if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan' });
        res.json(session);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/ai/sessions/:id/messages', checkAuth, async (req, res) => {
    try {
        const messages = await chatHistory.getMessages(Number(req.params.id), req.user.id);
        if (messages === null) return res.status(404).json({ error: 'Sesi tidak ditemukan' });
        res.json(messages);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/ai/sessions/:id', checkAuth, async (req, res) => {
    try {
        const deleted = await chatHistory.deleteSession(Number(req.params.id), req.user.id);
        if (!deleted) return res.status(404).json({ error: 'Sesi tidak ditemukan' });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Cache Warmer (Scheduled Self-Improvement) ---

// GET /api/ai/cache/warm/config — view warm schedule config
router.get('/ai/cache/warm/config', checkAuth, async (req, res) => {
    try {
        const config = await getWarmConfig();
        res.json(config);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// PUT /api/ai/cache/warm/config — update warm schedule config
router.put('/ai/cache/warm/config', checkAuth, async (req, res) => {
    try {
        const { enabled, interval_hours } = req.body || {};
        await updateWarmConfig({ enabled, interval_hours });
        res.json({ success: true, message: 'Config updated. Restart worker to apply schedule changes.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/ai/cache/warm — manual trigger cache warming
router.post('/ai/cache/warm', checkAuth, async (req, res) => {
    try {
        const job = await addCacheWarmJob();
        if (!job) return res.status(500).json({ error: 'Gagal mengantri cache warm job' });
        res.json({ success: true, jobId: job.id, message: 'Cache warm job queued' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/ai/cache/warm/latest — get latest warm log
router.get('/ai/cache/warm/latest', checkAuth, async (req, res) => {
    try {
        const log = await getLatestWarmLog();
        res.json(log || null);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/ai/cache/warm/logs — get warm run history
router.get('/ai/cache/warm/logs', checkAuth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const logs = await getWarmLogs({ limit, offset });
        res.json(logs);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Proactive Insights ---

// GET /api/ai/insights — get proactive insights (anomaly detection)
router.get('/ai/insights', checkAuth, async (req, res) => {
    try {
        const insights = await getProactiveInsights();
        res.json(insights);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Conversation Memory Stats ---

// GET /api/ai/memory/stats — get RAG memory statistics
router.get('/ai/memory/stats', checkAuth, async (req, res) => {
    try {
        const stats = await getMemoryStats();
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Knowledge Graph (brain view) ---
router.get('/ai/graph', checkAuth, async (req, res) => {
    try {
        const includeChunks = req.query.chunks !== 'false';
        const graph = await buildKnowledgeGraph({ includeChunks });
        res.json(graph);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Training Documents ---
import multer from 'multer';
import { saveDocument, parseDocument, generateDocEmbedding, searchTrainingDocs, getDocuments, getDocument, getDocumentChunks, deleteDocument, reprocessDocument } from '../services/trainingDocs.js';
import { generateEmbedding } from '../ai_search.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '../../uploads/training');
await fs.mkdir(UPLOAD_DIR, { recursive: true }).catch(() => {});

const storage = multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `training_${Date.now()}${ext}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: (req, file, cb) => {
        const allowed = ['.pdf', '.docx', '.doc', '.txt'];
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, allowed.includes(ext));
    }
});

// POST /api/ai/training/upload — upload document file
router.post('/ai/training/upload', checkAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

        const { title, category, tags } = req.body;
        const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
        const fileType = ext === 'doc' ? 'docx' : ext;

        // Parse content
        const buffer = await fs.readFile(req.file.path);
        let content = '';
        let parseError = null;
        try {
            content = await parseDocument(buffer, fileType, null);
        } catch (parseErr) {
            parseError = parseErr.message;
            console.warn(`[Training] Parse failed: ${parseErr.message}`);
        }

        // Save to DB
        const docId = await saveDocument({
            title: title || req.file.originalname,
            filename: req.file.originalname,
            fileType,
            filePath: req.file.filename,
            content,
            category: category || 'general',
            tags: tags || null,
            userId: req.user.id,
        });

        // If parse failed or content empty, mark as error immediately
        if (parseError || !content || content.trim().length < 10) {
            await knex('ai_training_documents')
                .where('id', docId)
                .update({ status: 'error', updated_at: knex.fn.now() });
            return res.json({
                id: docId,
                status: 'error',
                message: parseError || 'Tidak dapat mengekstrak teks dari file ini.',
            });
        }

        // Generate embedding (async, non-blocking)
        generateDocEmbedding(docId, generateEmbedding).catch(err =>
            console.warn(`[Training] Embed failed: ${err.message}`)
        );

        // Also ingest into 1MBrain knowledge base (async)
        import('../services/brainService.js').then(brain => {
            brain.default.ingestMarkdown(title || req.file.originalname, content, {
                tags: ['training', category || 'general']
            }).catch(err => console.warn(`[Brain] Ingest failed: ${err.message}`));
        });

        res.json({ id: docId, status: 'processing', message: 'File diunggah, sedang diproses...' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/ai/training/link — add URL link
router.post('/ai/training/link', checkAuth, async (req, res) => {
    try {
        const { title, url, category, tags } = req.body;
        if (!url) return res.status(400).json({ error: 'URL wajib diisi' });

        // Parse content from URL
        let content = '';
        let parseError = null;
        try {
            content = await parseDocument(null, 'link', url);
        } catch (parseErr) {
            parseError = parseErr.message;
            console.warn(`[Training] Link parse failed: ${parseErr.message}`);
        }

        const docId = await saveDocument({
            title: title || url,
            fileType: 'link',
            fileUrl: url,
            content,
            category: category || 'general',
            tags: tags || null,
            userId: req.user.id,
        });

        // If parse failed or content empty, mark as error immediately
        if (parseError || !content || content.trim().length < 10) {
            await knex('ai_training_documents')
                .where('id', docId)
                .update({ status: 'error', updated_at: knex.fn.now() });
            return res.json({
                id: docId,
                status: 'error',
                message: parseError || 'Tidak dapat mengekstrak teks dari URL ini.',
            });
        }

        generateDocEmbedding(docId, generateEmbedding).catch(err =>
            console.warn(`[Training] Embed failed: ${err.message}`)
        );

        // Also ingest into 1MBrain (async)
        import('../services/brainService.js').then(brain => {
            brain.default.ingestMarkdown(title || url, content, {
                tags: ['training', 'link', category || 'general']
            }).catch(err => console.warn(`[Brain] Ingest failed: ${err.message}`));
        });

        res.json({ id: docId, status: 'processing', message: 'Link ditambahkan, sedang diproses...' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/ai/training — list training documents
router.get('/ai/training', checkAuth, async (req, res) => {
    try {
        const { category, status, search } = req.query;
        const docs = await getDocuments({ category, status, search });
        res.json(docs);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/ai/training/:id/chunks — get document chunks
router.get('/ai/training/:id/chunks', checkAuth, async (req, res) => {
    try {
        const chunks = await getDocumentChunks(req.params.id);
        res.json(chunks);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/ai/training/:id — get document detail
router.get('/ai/training/:id', checkAuth, async (req, res) => {
    try {
        const doc = await getDocument(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
        res.json(doc);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/ai/training/:id — delete document
router.delete('/ai/training/:id', checkAuth, async (req, res) => {
    try {
        await deleteDocument(req.params.id);
        res.json({ success: true, message: 'Dokumen berhasil dihapus' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/ai/training/:id/reprocess — re-embed document
router.post('/ai/training/:id/reprocess', checkAuth, async (req, res) => {
    try {
        await reprocessDocument(req.params.id, generateEmbedding);
        res.json({ success: true, message: 'Dokumen sedang diproses ulang' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ════════════════════════════════════════════════════════════════
// ── SELF-IMPROVEMENT ROUTES ──
// ════════════════════════════════════════════════════════════════
import {
    getLearningStats,
    getTopicSummary,
    getLearningLogs,
    analyzeRecentChats,
    generateTrainingDocsFromKnowledge,
    runSelfImprovementCycle,
    trainSingleTopic,
    trainAllPending,
    trainByTopic,
} from '../services/selfImprovement.js';

// GET /api/ai/learning/stats — learning statistics
router.get('/ai/learning/stats', checkAuth, async (req, res) => {
    try {
        const stats = await getLearningStats();
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/ai/learning/topics — topic frequency summary
router.get('/ai/learning/topics', checkAuth, async (req, res) => {
    try {
        const { category, limit } = req.query;
        const topics = await getTopicSummary({ category, limit: parseInt(limit) || 20 });
        res.json(topics);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/ai/learning/logs — all learning logs
router.get('/ai/learning/logs', checkAuth, async (req, res) => {
    try {
        const { category, untrained, limit } = req.query;
        const logs = await getLearningLogs({
            category,
            untrainedOnly: untrained === 'true',
            limit: parseInt(limit) || 50,
        });
        res.json(logs);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/ai/learning/analyze — trigger analysis of recent chats
router.post('/ai/learning/analyze', checkAuth, async (req, res) => {
    try {
        const { hours = 168 } = req.body || {};
        const result = await analyzeRecentChats(hours);
        res.json({ success: true, ...result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/ai/learning/generate — generate training docs from knowledge
router.post('/ai/learning/generate', checkAuth, async (req, res) => {
    try {
        const result = await generateTrainingDocsFromKnowledge(generateEmbedding);
        res.json({ success: true, ...result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/ai/learning/run-cycle — full self-improvement cycle
router.post('/ai/learning/run-cycle', checkAuth, async (req, res) => {
    try {
        const result = await runSelfImprovementCycle(generateEmbedding);
        res.json({ success: true, ...result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/ai/learning/train/:id — manually train a single topic
router.post('/ai/learning/train/:id', checkAuth, async (req, res) => {
    try {
        const result = await trainSingleTopic(req.params.id, generateEmbedding);
        res.json({ success: true, ...result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/ai/learning/train-all — manually train ALL pending topics
router.post('/ai/learning/train-all', checkAuth, async (req, res) => {
    try {
        const result = await trainAllPending(generateEmbedding);
        res.json({ success: true, ...result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/ai/learning/train-by-topic — train by topic name
router.post('/ai/learning/train-by-topic', checkAuth, async (req, res) => {
    try {
        const { topic } = req.body;
        if (!topic) return res.status(400).json({ error: 'topic is required' });
        const result = await trainByTopic(topic, generateEmbedding);
        res.json({ success: true, ...result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ════════════════════════════════════════════════════════════════
// ── CORRECTIONS & EVOLUTION ROUTES ──
// ════════════════════════════════════════════════════════════════
import {
    getCorrections,
    getCorrectionStats,
    logCorrection,
    applyCorrection,
    runEvolutionScan,
    getEvolutionHistory,
    getEvolutionStats,
    getDataSnapshots,
} from '../services/selfImprovement.js';

// GET /api/ai/corrections — list all corrections
router.get('/ai/corrections', checkAuth, async (req, res) => {
    try {
        const { type, unapplied, limit } = req.query;
        const corrections = await getCorrections({
            limit: parseInt(limit) || 50,
            type,
            unappliedOnly: unapplied === 'true',
        });
        res.json(corrections);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/ai/corrections/stats — correction statistics
router.get('/ai/corrections/stats', checkAuth, async (req, res) => {
    try {
        const stats = await getCorrectionStats();
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/ai/corrections — manually submit a correction
router.post('/ai/corrections', checkAuth, async (req, res) => {
    try {
        const { sessionId, question, wrongAnswer, correctAnswer, correctionNote, correctionType, topic, category } = req.body;
        if (!question || !correctAnswer) {
            return res.status(400).json({ error: 'question and correctAnswer are required' });
        }
        const id = await logCorrection({
            sessionId, question, wrongAnswer, correctAnswer,
            correctionNote, correctionType, topic, category,
        });
        res.json({ success: true, id });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/ai/corrections/:id/apply — apply a correction to knowledge base
router.post('/ai/corrections/:id/apply', checkAuth, async (req, res) => {
    try {
        const result = await applyCorrection(parseInt(req.params.id), generateEmbedding);
        res.json({ success: true, ...result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/ai/evolution/scan — run weekly evolution scan
router.post('/ai/evolution/scan', checkAuth, async (req, res) => {
    try {
        const result = await runEvolutionScan(generateEmbedding);
        res.json({ success: true, ...result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/ai/evolution/history — evolution scan history
router.get('/ai/evolution/history', checkAuth, async (req, res) => {
    try {
        const { limit } = req.query;
        const history = await getEvolutionHistory({ limit: parseInt(limit) || 10 });
        res.json(history);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/ai/evolution/stats — combined evolution + correction stats
router.get('/ai/evolution/stats', checkAuth, async (req, res) => {
    try {
        const stats = await getEvolutionStats();
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/ai/evolution/snapshots — data change snapshots
router.get('/ai/evolution/snapshots', checkAuth, async (req, res) => {
    try {
        const { type, limit } = req.query;
        const snapshots = await getDataSnapshots({ type, limit: parseInt(limit) || 20 });
        res.json(snapshots);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ════════════════════════════════════════════════════════════════
// ── 1MBrain Routes ──
// ════════════════════════════════════════════════════════════════
import * as brainCtrl from '../controllers/brainController.js';

router.get('/ai/brain/health', checkAuth, brainCtrl.getBrainHealth);
router.post('/ai/brain/recall', checkAuth, brainCtrl.recallMemories);
router.post('/ai/brain/memory', checkAuth, brainCtrl.storeMemory);
router.post('/ai/brain/ingest', checkAuth, brainCtrl.ingestKnowledge);
router.post('/ai/brain/consolidate', checkAuth, brainCtrl.triggerConsolidation);
router.get('/ai/brain/stats', checkAuth, brainCtrl.getMemoryStats);
router.get('/ai/brain/memories', checkAuth, brainCtrl.listAllMemories);
router.get('/ai/brain/network', checkAuth, brainCtrl.getNetworkGraph);
router.post('/ai/brain/sync-training', checkAuth, brainCtrl.syncTrainingToBrain);

export default router;
