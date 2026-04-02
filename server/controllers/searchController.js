import { handleError } from '../utils/errorHandler.js';
import { knex } from '../db.js';
import { JOB_STATUS } from '../constants/status.js';
import { addAiChatJob, addAiSemanticSearchJob } from '../queue.js';
import { generateEmbedding, vectorStore } from '../ai_search.js';
import path from 'path';
import { UPLOADS_DIR } from '../config/upload.js';
import { parseJsonSafe } from '../utils/jsonSafe.js';

const isPg = (process.env.DB_CLIENT || '').toLowerCase().startsWith('pg');

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

        // Build a comprehensive hybrid search: keyword across many tables + semantic vector search
        // 1. Run keyword queries across relevant tables (limit to 100 each)
        const [kwDocs, kwInvoices, kwTaxObjects, kwExternal, kwInventory, kwInvItems, kwApprovals, kwAuditNotes] = await Promise.all([
            knex('documents').select('id', 'title', 'ocrContent', 'url', 'uploadDate', 'size', 'folderId').where(function() {
                this.where('title', 'like', `%${query}%`).orWhere('ocrContent', 'like', `%${query}%`);
                if (isPg) this.orWhereRaw("COALESCE(file_data::text,'') ILIKE ?", [`%${query}%`]);
                else this.orWhere('file_data', 'like', `%${query}%`);
            }).limit(100),
            knex('invoices').select('id', 'vendor', 'invoice_no', 'tax_invoice_no', 'ocr_content', 'file_name', 'payment_date').where(function() {
                this.where('vendor', 'like', `%${query}%`).orWhere('invoice_no', 'like', `%${query}%`).orWhere('ocr_content', 'like', `%${query}%`);
            }).limit(100),
            knex('tax_objects').select('id', 'name', 'identity_number').where(function() { this.where('name', 'like', `%${query}%`).orWhere('identity_number', 'like', `%${query}%`); }).limit(100),
            knex('external_items').select('id', 'boxId', 'destination', 'boxData').where(function() {
                this.where('boxId', 'like', `%${query}%`).orWhere('destination', 'like', `%${query}%`);
                if (isPg) this.orWhereRaw(`COALESCE("boxData"::text,'') ILIKE ?`, [`%${query}%`]);
                else this.orWhere('boxData', 'like', `%${query}%`);
            }).limit(100),
            knex('inventory').select('id', 'box_data').where(function() {
                if (isPg) this.whereRaw("COALESCE(box_data::text,'') ILIKE ?", [`%${query}%`]);
                else this.where('box_data', 'like', `%${query}%`);
            }).limit(100),
            knex('inventory_items').select('id', 'invoice_no', 'vendor', 'ocr_content').where(function() { this.where('invoice_no', 'like', `%${query}%`).orWhere('vendor', 'like', `%${query}%`).orWhere('ocr_content', 'like', `%${query}%`); }).limit(100),
            knex('document_approvals').select('id', 'title', 'description', 'ocr_content', 'attachment_url').where(function() { this.where('title', 'like', `%${query}%`).orWhere('description', 'like', `%${query}%`).orWhere('ocr_content', 'like', `%${query}%`); }).limit(100),
            knex('tax_audit_notes').select('id', 'text').where('text', 'like', `%${query}%`).limit(100)
        ]);

        // 2. Semantic vector search (use cached vectors if any)
        let semanticMatches = [];
        try {
            const qVec = await generateEmbedding(query);
            semanticMatches = vectorStore.searchNearest(qVec, 0.35, 100);
        } catch (vecErr) {
            console.warn('Vector search failed:', vecErr.message);
            // continue with keyword-only results
        }

        // 3. Merge and deduplicate results
        const resultsMap = new Map();

        const pushSemantic = (m) => {
            if (!m) return;
            const key = `${m.matchType}-${m.id}`;
            if (!resultsMap.has(key)) resultsMap.set(key, { id: m.id, name: m.name || m.title || '', matchType: m.matchType, score: m.score || 0, data: m.data || {} });
        };
        for (const m of semanticMatches) pushSemantic(m);

        const pushKeyword = (type, row, title, previewField) => {
            const key = `${type}-${row.id}`;
            if (resultsMap.has(key)) {
                const existing = resultsMap.get(key);
                // boost score for keyword exact match
                existing.score = Math.max(existing.score || 0, 0.9);
                if (!existing.data || Object.keys(existing.data).length === 0) existing.data = row;
                resultsMap.set(key, existing);
            } else {
                resultsMap.set(key, { id: row.id, name: title || row.title || '', matchType: type, score: 0.9, data: row, preview: (row[previewField] || row.ocrContent || row.ocr_content || '').substring(0, 600) });
            }
        };

        for (const d of kwDocs) pushKeyword('document', d, d.title, 'ocrContent');
        for (const inv of kwInvoices) pushKeyword('invoice', inv, `${inv.vendor || ''} ${inv.invoice_no || ''}`.trim(), 'ocr_content');
        for (const t of kwTaxObjects) pushKeyword('tax_object', t, t.name, '');
        for (const e of kwExternal) pushKeyword('external_item', e, e.boxId || e.destination, 'boxData');
        for (const i of kwInventory) pushKeyword('inventory', i, `inventory-${i.id}`, 'box_data');
        for (const ii of kwInvItems) pushKeyword('inventory_item', ii, `${ii.vendor || ''} ${ii.invoice_no || ''}`.trim(), 'ocr_content');
        for (const a of kwApprovals) pushKeyword('approval', a, a.title, 'ocr_content');
        for (const n of kwAuditNotes) pushKeyword('tax_note', n, `Note-${n.id}`, 'text');

        // 4. Build enriched list sorted by score
        const enriched = [];
        for (const r of Array.from(resultsMap.values()).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 50)) {
            const out = { id: r.id, title: r.name, name: r.name, matchType: r.matchType, score: r.score || 0, data: r.data || {}, preview: r.preview || '' };
            // try to populate preview if missing
            if (!out.preview && out.data) {
                out.preview = (out.data.ocrContent || out.data.ocr_content || out.data.text || out.data.description || '').substring(0, 600);
            }
            // normalize downloadUrl
            out.downloadUrl = out.data.file_url || out.data.url || out.data.attachment_url || out.data.fileUrl || null;
            enriched.push(out);
            if (enriched.length >= 30) break;
        }

        // 5. If there are few results, also enqueue a full async semantic job to refine later
        if (enriched.length < 10) addAiSemanticSearchJob(query).catch(() => {});

        return res.json({ results: enriched });

    } catch (err) {
        console.error("Hybrid Search Error:", err);
        handleError(res, err, "SEARCH Error");
    }
};
