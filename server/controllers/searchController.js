import { handleError } from '../utils/errorHandler.js';
import { knex } from '../db.js';
import { JOB_STATUS } from '../constants/status.js';
import { addAiChatJob, addAiSemanticSearchJob } from '../queue.js';
import { parseJsonSafe } from '../utils/jsonSafe.js';

export const getJobStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const job = await knex('job_queue').where('id', id).first();
        if (!job) return res.status(404).json({ error: "Job not found" });

        const result = parseJsonSafe(job.result, null);
        res.json({
            id: job.id,
            status: job.status,
            progress: job.progress || 0,
            result: result,
            error: job.error
        });
    } catch (err) {
        handleError(res, err, "Job Status Error");
    }
};

export const searchDocuments = async (req, res) => {
    try {
        const { q, type } = req.query;

        if (type === 'semantic') {
            const job = await addAiSemanticSearchJob(q);
            return res.json({ jobId: job.id, status: 'processing', message: 'AI is searching semantically...' });
        }

        // Use the knex query builder (not raw strings) so identifiers are quoted
        // correctly. On PostgreSQL, raw `ocrContent ILIKE` is folded to `ocrcontent`
        // and the column doesn't exist; the builder emits `"ocrContent" ILIKE` (pg)
        // or a `LIKE` with proper quoting on MySQL.
        const docs = await knex('documents')
            .where('title', 'ilike', `%${q}%`)
            .orWhere('ocrContent', 'ilike', `%${q}%`);
        res.json(docs);

    } catch (err) {
        handleError(res, err, "SEARCH Error");
    }
};

export const chatWithAI = async (req, res) => {
    try {
        const { message, history } = req.body;
        const text = message || req.body.query;
        if (!text) return res.status(400).json({ error: "Message or query required" });

        console.log(`[SearchController] Queuing AI Chat job for: ${text.substring(0, 30)}...`);
        const job = await addAiChatJob(text, history, 'user');

        if (!job) throw new Error("Failed to queue AI Chat job");

        res.json({
            jobId: job.id,
            status: JOB_STATUS.WAITING,
            message: "AI is thinking..."
        });
    } catch (err) {
        console.error("AI Queue Error:", err);
        handleError(res, err, "AI Service Error");
    }
};

export const semanticSearch = async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: "Query required" });

        // Delegate to the dedicated worker process. Heavy AI embedding models can
        // ONLY be loaded inside the worker (loading them in the main HTTP process
        // is blocked by design and would crash/segfault). The worker also uses the
        // knex query builder (which quotes identifiers correctly), avoiding the
        // PostgreSQL "column does not exist" errors that a raw query caused here.
        // The client polls /api/search/job/:id for the result.
        const job = await addAiSemanticSearchJob(query);
        if (!job) throw new Error("Failed to queue semantic search job");

        return res.json({
            jobId: job.id,
            status: 'processing',
            message: 'AI is searching semantically...'
        });

    } catch (err) {
        console.error("Semantic Search Error:", err);
        handleError(res, err, "SEARCH Error");
    }
};

