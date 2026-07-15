import { handleError } from '../utils/errorHandler.js';
import { addAiAgentJob } from '../queue.js';

export const agentChat = async (req, res) => {
    try {
        const { message, history, sessionId } = req.body || {};
        if (!message || !String(message).trim()) {
            return res.status(400).json({ error: 'Pesan wajib diisi.' });
        }
        const job = await addAiAgentJob(String(message), Array.isArray(history) ? history : [], sessionId || null);
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
