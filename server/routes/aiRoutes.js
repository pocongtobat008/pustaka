import express from 'express';
import { agentChat } from '../controllers/aiController.js';
import { getCacheStats, invalidateCache } from '../services/agentCache.js';
import * as chatHistory from '../services/chatHistory.js';
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

export default router;
