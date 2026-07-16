import { knex } from '../db.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '../../server/uploads/training');

// Ensure upload directory exists
fs.mkdir(UPLOAD_DIR, { recursive: true }).catch(() => {});

// ── Text Chunking ──
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

export function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
    if (!text || text.length === 0) return [];
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push(text.slice(start, end));
        start += chunkSize - overlap;
    }
    return chunks;
}

// ── PDF Parser ──
export async function parsePdf(buffer) {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    return data.text || '';
}

// ── DOCX Parser ──
export async function parseDocx(buffer) {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
}

// ── TXT Parser ──
export async function parseTxt(buffer) {
    return buffer.toString('utf-8');
}

// ── Link Parser ──
export async function parseLink(url) {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Pustaka-AI-Training/1.0' },
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        // Strip HTML tags, keep text content
        const text = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s+/g, ' ')
            .trim();
        return text;
    } catch (err) {
        throw new Error(`Gagal mengambil konten dari URL: ${err.message}`);
    }
}

// ── Parse document based on type ──
export async function parseDocument(buffer, fileType, fileUrl) {
    switch (fileType) {
        case 'pdf': return await parsePdf(buffer);
        case 'docx': return await parseDocx(buffer);
        case 'txt': return await parseTxt(buffer);
        case 'link': return await parseLink(fileUrl);
        default: throw new Error(`Tipe file tidak didukung: ${fileType}`);
    }
}

// ── Save document to DB ──
export async function saveDocument({ title, filename, fileType, fileUrl, filePath, content, category, tags, userId }) {
    const [row] = await knex('ai_training_documents')
        .insert({
            title,
            filename: filename || null,
            file_type: fileType,
            file_url: fileUrl || null,
            file_path: filePath || null,
            content: content || null,
            category: category || 'general',
            tags: tags || null,
            status: 'processing',
            chunk_count: 0,
            uploaded_by: userId || null,
            created_at: knex.fn.now(),
            updated_at: knex.fn.now(),
        })
        .returning('id');
    return typeof row === 'object' ? row.id : row;
}

// ── Generate embedding for a document ──
export async function generateDocEmbedding(docId, embedFn) {
    if (!embedFn) return;

    const doc = await knex('ai_training_documents').where('id', docId).first();
    if (!doc || !doc.content) return;

    const chunks = chunkText(doc.content);
    if (chunks.length === 0) return;

    // Embed first chunk (or a summary) as the document representative
    // For full RAG, each chunk should be embedded separately in a future version
    const representative = chunks[0].slice(0, 2000);
    try {
        const vector = await embedFn(representative);
        const vecStr = '[' + vector.join(',') + ']';
        await knex('ai_training_documents')
            .where('id', docId)
            .update({
                embedding: knex.raw('?::vector', [vecStr]),
                chunk_count: chunks.length,
                status: 'active',
                updated_at: knex.fn.now(),
            });
    } catch (err) {
        console.warn(`[TrainingDocs] Embedding failed for doc ${docId}: ${err.message}`);
        await knex('ai_training_documents')
            .where('id', docId)
            .update({ status: 'error', updated_at: knex.fn.now() });
    }
}

// ── Search training documents via semantic similarity ──
export async function searchTrainingDocs(query, embedFn, { limit = 5, category = null } = {}) {
    if (!embedFn) return [];

    try {
        const queryVector = await embedFn(query);
        const vecStr = '[' + queryVector.join(',') + ']';

        let sql = `
            SELECT id, title, filename, file_type, category, tags, content,
                   chunk_count, created_at,
                   1 - (embedding <=> ?::vector) AS similarity
            FROM ai_training_documents
            WHERE embedding IS NOT NULL AND status = 'active'
        `;
        const params = [vecStr];

        if (category) {
            sql += ` AND category = ?`;
            params.push(category);
        }

        sql += ` ORDER BY embedding <=> ?::vector LIMIT ?`;
        params.push(vecStr, limit);

        const results = await knex.raw(sql, params);
        const rows = results.rows || [];

        return rows
            .filter(r => r.similarity >= 0.25)
            .map(r => ({
                id: r.id,
                title: r.title,
                fileType: r.file_type,
                category: r.category,
                tags: r.tags,
                contentPreview: (r.content || '').slice(0, 500),
                similarity: Number(r.similarity).toFixed(3),
                createdAt: r.created_at,
            }));
    } catch (err) {
        console.warn(`[TrainingDocs] Search failed: ${err.message}`);
        return [];
    }
}

// ── Get all documents ──
export async function getDocuments({ category, status, search } = {}) {
    let query = knex('ai_training_documents').select(
        'id', 'title', 'filename', 'file_type', 'file_url',
        'category', 'tags', 'status', 'chunk_count',
        'uploaded_by', 'created_at', 'updated_at'
    );

    if (category) query = query.where('category', category);
    if (status) query = query.where('status', status);
    if (search) {
        query = query.where(function () {
            this.where('title', 'ilike', `%${search}%`)
                .orWhere('tags', 'ilike', `%${search}%`);
        });
    }

    return query.orderBy('created_at', 'desc');
}

// ── Get single document ──
export async function getDocument(id) {
    return knex('ai_training_documents').where('id', id).first();
}

// ── Delete document ──
export async function deleteDocument(id) {
    const doc = await knex('ai_training_documents').where('id', id).first();
    if (doc && doc.file_path) {
        const fullPath = path.join(UPLOAD_DIR, doc.file_path);
        await fs.unlink(fullPath).catch(() => {});
    }
    return knex('ai_training_documents').where('id', id).del();
}

// ── Re-process document ──
export async function reprocessDocument(id, embedFn) {
    await knex('ai_training_documents')
        .where('id', id)
        .update({ status: 'processing', updated_at: knex.fn.now() });

    await generateDocEmbedding(id, embedFn);
}
