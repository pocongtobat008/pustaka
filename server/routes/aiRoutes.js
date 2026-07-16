import express from 'express';
import { agentChat } from '../controllers/aiController.js';
import { getCacheStats, invalidateCache } from '../services/agentCache.js';
import * as chatHistory from '../services/chatHistory.js';
import { getWarmLogs, getLatestWarmLog, getWarmConfig, updateWarmConfig } from '../services/cacheWarmer.js';
import { addCacheWarmJob } from '../queue.js';
import { getProactiveInsights } from '../services/insightsEngine.js';
import { getMemoryStats } from '../services/conversationMemory.js';
import { checkAuth } from '../middleware/auth.js';

const router = express.Router();

// --- Agent ---
router.post('/ai/agent', checkAuth, agentChat);

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

// --- Training Documents ---
import multer from 'multer';
import { saveDocument, parseDocument, generateDocEmbedding, searchTrainingDocs, getDocuments, getDocument, deleteDocument, reprocessDocument } from '../services/trainingDocs.js';
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
        try {
            content = await parseDocument(buffer, fileType, null);
        } catch (parseErr) {
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

        // Generate embedding (async, non-blocking)
        generateDocEmbedding(docId, generateEmbedding).catch(err =>
            console.warn(`[Training] Embed failed: ${err.message}`)
        );

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
        try {
            content = await parseDocument(null, 'link', url);
        } catch (parseErr) {
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

        generateDocEmbedding(docId, generateEmbedding).catch(err =>
            console.warn(`[Training] Embed failed: ${err.message}`)
        );

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

export default router;
