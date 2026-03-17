import { handleError } from '../utils/errorHandler.js';
import { knex } from '../db.js';
import { JOB_STATUS } from '../constants/status.js';
import { addAiChatJob } from '../queue.js';
import { generateEmbedding, vectorStore } from '../ai_search.js';
import path from 'path';
import { UPLOADS_DIR } from '../config/upload.js';
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
            const queryVector = await generateEmbedding(q);
            const docs = await knex('documents').select('*').limit(100);
            const results = docs.filter(d => {
                return (d.title || '').toLowerCase().includes(q.toLowerCase()) ||
                    (d.ocrContent || '').toLowerCase().includes(q.toLowerCase());
            });
            return res.json(results);
        }

        const docs = await knex('documents')
            .where('title', 'like', `%${q}%`)
            .orWhere('ocrContent', 'like', `%${q}%`);
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

        const [kwDocs, kwInvoices, kwTaxObjects, kwExternal, kwInventory] = await Promise.all([
            knex('documents').where('title', 'like', `%${query}%`).orWhere('ocrContent', 'like', `%${query}%`).limit(20),
            knex('invoices').where('invoice_no', 'like', `%${query}%`).orWhere('tax_invoice_no', 'like', `%${query}%`).orWhere('vendor', 'like', `%${query}%`).limit(20),
            knex('tax_objects').where('name', 'like', `%${query}%`).orWhere('identity_number', 'like', `%${query}%`).limit(20),
            knex('external_items').where('boxId', 'like', `%${query}%`).orWhere('destination', 'like', `%${query}%`).limit(20),
            knex('inventory').where('box_data', 'like', `%${query}%`).limit(20)
        ]);

        const queryVector = await generateEmbedding(query);
        const semanticMatches = vectorStore.searchNearest(queryVector, 0.4, 15);

        const resultsMap = new Map();
        semanticMatches.forEach(r => resultsMap.set(`${r.matchType}-${r.id}`, r));

        kwDocs.forEach(d => {
            const matchType = d.category || 'document';
            resultsMap.set(`${matchType}-${d.id}`, { id: d.id, name: d.title, date: d.uploadDate, size: d.size, matchType, score: 1.0, data: d });
        });

        kwInvoices.forEach(inv => {
            resultsMap.set(`invoice-${inv.id}`, { id: inv.id, name: `${inv.vendor} (${inv.invoice_no})`, date: inv.payment_date, matchType: 'invoice', score: 1.0, data: inv });
        });

        kwTaxObjects.forEach(t => {
            resultsMap.set(`tax_object-${t.id}`, { id: t.id, name: t.name, date: t.created_at, matchType: 'tax_object', score: 1.0, data: t });
        });

        // enrich results with preview and download/file location when available
        const enriched = [];
        for (const r of Array.from(resultsMap.values()).sort((a,b)=>b.score-a.score).slice(0, 50)) {
            const out = { id: r.id, name: r.name, matchType: r.matchType, score: r.score || 0 };
            // for documents, try to include url and preview
            if (r.matchType === 'document' || r.matchType === 'Doc') {
                try {
                    const doc = r.data || await knex('documents').where('id', r.id).first();
                    if (doc) {
                        out.preview = (doc.ocrContent || '').substring(0, 600);
                        out.downloadUrl = doc.url || (doc.file_url || null);
                        if (out.downloadUrl && out.downloadUrl.startsWith('/uploads/')) {
                            out.filePath = path.join(UPLOADS_DIR, path.basename(out.downloadUrl));
                        } else {
                            out.filePath = null;
                        }
                    }
                } catch (e) { /* ignore */ }
            } else if (r.data && r.data.ocrContent) {
                out.preview = (r.data.ocrContent || '').substring(0, 600);
                if (r.data.url) {
                    out.downloadUrl = r.data.url;
                    out.filePath = path.join(UPLOADS_DIR, path.basename(r.data.url));
                }
            }
            enriched.push(out);
            if (enriched.length >= 15) break;
        }

        res.json({ results: enriched });

    } catch (err) {
        console.error("Hybrid Search Error:", err);
        handleError(res, err, "SEARCH Error");
    }
};
