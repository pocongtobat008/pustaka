import { knex } from '../db.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import os from 'os';
import { sanitizeApiKey } from './aiAgent.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '../../server/uploads/training');

// Ensure upload directory exists
fs.mkdir(UPLOAD_DIR, { recursive: true }).catch(() => {});

// ── Constants ──
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const EMBED_BATCH_SIZE = 5;       // max concurrent embedding API calls
const EMBED_RETRY_MAX = 3;        // max retry attempts
const EMBED_RETRY_DELAY_MS = 1000; // base delay (exponential backoff)
const CATEGORIES = ['general', 'tax_regulation', 'accounting_standard', 'procedure', 'guide'];

// ── Text Chunking ──
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

// ── PDF Parser (with OCR fallback for scanned PDFs) ──
export async function parsePdf(buffer) {
    // Step 1: Try text extraction
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = (result.text || '').trim();
    const cleaned = text.replace(/^--\s*\d+\s+of\s+\d+\s*--$/gm, '').trim();

    // If text extraction worked, return it
    if (cleaned.length >= 10) {
        return cleaned;
    }

    // Step 2: Text extraction failed (scanned PDF) — try OCR
    console.log(`[TrainingDocs] PDF text extraction empty, trying OCR...`);
    return await ocrPdf(buffer);
}

// ── OCR for scanned PDFs (pdftoppm + tesseract.js) — PARALLEL per page ──
async function ocrPdf(buffer) {
    let tmpDir = null;
    try {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ocr-'));
        const tmpPdf = path.join(tmpDir, 'input.pdf');
        await fs.writeFile(tmpPdf, buffer);

        // Convert PDF pages to PNG images (300 DPI)
        execSync(`pdftoppm -png -r 300 "${tmpPdf}" "${tmpDir}/page"`, { timeout: 60000 });

        const files = (await fs.readdir(tmpDir)).filter(f => f.endsWith('.png')).sort();
        if (files.length === 0) {
            throw new Error('Tidak ada halaman yang bisa diproses dari PDF ini.');
        }

        // #2: OCR all pages in parallel
        const Tesseract = (await import('tesseract.js')).default;
        console.log(`[TrainingDocs] OCR: processing ${files.length} pages in parallel...`);

        const ocrResults = await Promise.all(
            files.map(async (file, i) => {
                const imgPath = path.join(tmpDir, file);
                const result = await Tesseract.recognize(imgPath, 'ind+eng');
                const pageText = result.data.text?.trim();
                console.log(`[TrainingDocs] OCR page ${i + 1}/${files.length}: ${pageText?.length || 0} chars, confidence: ${result.data.confidence}%`);
                return pageText ? `--- Halaman ${i + 1} ---\n${pageText}` : null;
            })
        );

        const ocrText = ocrResults.filter(Boolean).join('\n\n');
        if (ocrText.length < 10) {
            throw new Error('OCR tidak dapat mengekstrak teks dari PDF ini. Pastikan gambar cukup jelas.');
        }

        return ocrText;
    } catch (err) {
        if (err.message.includes('OCR') || err.message.includes('halaman')) {
            throw err;
        }
        throw new Error(`Gagal melakukan OCR: ${err.message}`);
    } finally {
        if (tmpDir) {
            await fs.rm(tmpDir, { recursive: true }).catch(() => {});
        }
    }
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

// ── #7: Auto-categorize document content using LLM ──
async function autoCategorize(content) {
    try {
        // Get AI settings from DB
        const settings = await knex('ai_settings').where('enabled', true).first();
        if (!settings || !settings.base_url || !settings.api_key) return null;

        const prompt = `Kategorikan dokumen berikut ke dalam salah satu kategori ini: ${CATEGORIES.join(', ')}.
Balas HANYA dengan satu kata kategori, tanpa penjelasan tambahan.

Dokumen (500 karakter pertama):
${content.slice(0, 500)}`;

        const url = settings.base_url.replace(/\/+$/, '') + '/chat/completions';
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sanitizeApiKey(settings.api_key)}` },
            body: JSON.stringify({
                model: settings.model || 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0,
                max_tokens: 20,
            }),
            signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) return null;
        const data = await res.json();
        const category = (data?.choices?.[0]?.message?.content || '').trim().toLowerCase();
        return CATEGORIES.includes(category) ? category : null;
    } catch {
        return null;
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

// ── #3: Embed with retry + exponential backoff ──
async function embedWithRetry(embedFn, text) {
    for (let attempt = 1; attempt <= EMBED_RETRY_MAX; attempt++) {
        try {
            return await embedFn(text);
        } catch (err) {
            const isLast = attempt === EMBED_RETRY_MAX;
            if (isLast) throw err;
            const delay = EMBED_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
            console.warn(`[TrainingDocs] Embed attempt ${attempt}/${EMBED_RETRY_MAX} failed: ${err.message}. Retrying in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
}

// ── #1: Generate chunk-level embeddings ──
export async function generateDocEmbedding(docId, embedFn, { autoCat = true } = {}) {
    if (!embedFn) return;

    const doc = await knex('ai_training_documents').where('id', docId).first();
    if (!doc || !doc.content) {
        await knex('ai_training_documents')
            .where('id', docId)
            .update({ status: 'error', updated_at: knex.fn.now() });
        return;
    }

    // #7: Auto-categorize if category is 'general' and content is long enough
    if (autoCat && doc.category === 'general' && doc.content.length > 50) {
        const detected = await autoCategorize(doc.content);
        if (detected) {
            await knex('ai_training_documents')
                .where('id', docId)
                .update({ category: detected });
            console.log(`[TrainingDocs] Auto-categorized doc ${docId} as "${detected}"`);
        }
    }

    // Split into chunks
    const chunks = chunkText(doc.content);
    if (chunks.length === 0) {
        await knex('ai_training_documents')
            .where('id', docId)
            .update({ status: 'error', updated_at: knex.fn.now() });
        return;
    }

    try {
        // Delete old chunks (for reprocess)
        await knex('ai_training_chunks').where('document_id', docId).del();

        // Embed each chunk with retry
        for (let i = 0; i < chunks.length; i++) {
            const vector = await embedWithRetry(embedFn, chunks[i].slice(0, 2000));
            const vecStr = '[' + vector.join(',') + ']';
            await knex('ai_training_chunks').insert({
                document_id: docId,
                chunk_index: i,
                content: chunks[i],
                embedding: knex.raw('?::vector', [vecStr]),
                token_count: Math.ceil(chunks[i].length / 4),
            });
        }

        // Also store the first chunk's embedding in the document for backward compat
        const firstVector = await embedWithRetry(embedFn, chunks[0].slice(0, 2000));
        const firstVecStr = '[' + firstVector.join(',') + ']';
        await knex('ai_training_documents')
            .where('id', docId)
            .update({
                embedding: knex.raw('?::vector', [firstVecStr]),
                chunk_count: chunks.length,
                status: 'active',
                updated_at: knex.fn.now(),
            });

        console.log(`[TrainingDocs] Doc ${docId}: ${chunks.length} chunks embedded successfully`);
    } catch (err) {
        console.warn(`[TrainingDocs] Embedding failed for doc ${docId} after ${EMBED_RETRY_MAX} retries: ${err.message}`);
        await knex('ai_training_documents')
            .where('id', docId)
            .update({ status: 'error', updated_at: knex.fn.now() });
    }
}

// ── #1: Search at chunk level via semantic similarity ──
export async function searchTrainingDocs(query, embedFn, { limit = 5, category = null } = {}) {
    if (!embedFn) return [];

    try {
        const queryVector = await embedFn(query);
        const vecStr = '[' + queryVector.join(',') + ']';

        // Try chunk-level search first
        let sql = `
            SELECT
                c.id AS chunk_id,
                c.document_id,
                c.chunk_index,
                c.content AS chunk_content,
                c.token_count,
                1 - (c.embedding <=> ?::vector) AS similarity,
                d.title,
                d.filename,
                d.file_type,
                d.category,
                d.tags,
                d.created_at
            FROM ai_training_chunks c
            JOIN ai_training_documents d ON d.id = c.document_id
            WHERE c.embedding IS NOT NULL AND d.status = 'active'
        `;
        const params = [vecStr];

        if (category) {
            sql += ` AND d.category = ?`;
            params.push(category);
        }

        sql += ` ORDER BY c.embedding <=> ?::vector LIMIT ?`;
        params.push(vecStr, limit);

        let results = await knex.raw(sql, params);
        let rows = results.rows || [];

        // Fallback to doc-level search if no chunks found
        if (rows.length === 0) {
            console.log('[TrainingDocs] No chunks found, falling back to doc-level search');
            let docSql = `
                SELECT
                    d.id AS document_id,
                    0 AS chunk_index,
                    d.content AS chunk_content,
                    NULL AS token_count,
                    1 - (d.embedding <=> ?::vector) AS similarity,
                    d.title,
                    d.filename,
                    d.file_type,
                    d.category,
                    d.tags,
                    d.created_at
                FROM ai_training_documents d
                WHERE d.embedding IS NOT NULL AND d.status = 'active'
            `;
            const docParams = [vecStr];
            if (category) {
                docSql += ` AND d.category = ?`;
                docParams.push(category);
            }
            docSql += ` ORDER BY d.embedding <=> ?::vector LIMIT ?`;
            docParams.push(vecStr, limit);

            results = await knex.raw(docSql, docParams);
            rows = results.rows || [];
        }

        return rows
            .filter(r => r.similarity >= 0.25)
            .map(r => ({
                documentId: r.document_id,
                chunkIndex: r.chunk_index,
                title: r.title,
                fileType: r.file_type,
                category: r.category,
                tags: r.tags,
                content: r.chunk_content,
                similarity: Number(r.similarity).toFixed(3),
                tokenCount: r.token_count,
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

// ── Get document chunks ──
export async function getDocumentChunks(documentId) {
    return knex('ai_training_chunks')
        .where('document_id', documentId)
        .orderBy('chunk_index', 'asc')
        .select('id', 'chunk_index', 'content', 'token_count', 'created_at');
}

// ── Delete document ──
export async function deleteDocument(id) {
    const doc = await knex('ai_training_documents').where('id', id).first();
    if (doc && doc.file_path) {
        const fullPath = path.join(UPLOAD_DIR, doc.file_path);
        await fs.unlink(fullPath).catch(() => {});
    }
    // Chunks auto-deleted via CASCADE
    return knex('ai_training_documents').where('id', id).del();
}

// ── Re-process document ──
export async function reprocessDocument(id, embedFn) {
    await knex('ai_training_documents')
        .where('id', id)
        .update({ status: 'processing', updated_at: knex.fn.now() });

    await generateDocEmbedding(id, embedFn);
}

// ── Backfill chunks from existing doc-level embeddings (when API is down) ──
export async function backfillFromExistingEmbeddings() {
    const docs = await knex('ai_training_documents')
        .whereNotNull('embedding')
        .where('content', '!=', '')
        .whereNotNull('content')
        .select('id', 'content', 'embedding', 'chunk_count');

    let backfilled = 0;
    for (const doc of docs) {
        const existingChunks = await knex('ai_training_chunks').where('document_id', doc.id).count('* as total').first();
        if (Number(existingChunks.total) > 0) continue; // already has chunks

        if (!doc.content || !doc.embedding) continue;

        const chunks = chunkText(doc.content);
        if (chunks.length === 0) continue;

        // Use the existing doc-level embedding for all chunks (shared vector)
        // This is a temporary measure until the API is back and can re-embed per chunk
        for (let i = 0; i < chunks.length; i++) {
            await knex.raw(`
                INSERT INTO ai_training_chunks (document_id, chunk_index, content, token_count, embedding, created_at)
                VALUES (?, ?, ?, ?, ?::vector, NOW())
            `, [doc.id, i, chunks[i], Math.ceil(chunks[i].length / 4), doc.embedding]);
        }

        await knex('ai_training_documents')
            .where('id', doc.id)
            .update({ chunk_count: chunks.length, status: 'active', updated_at: knex.fn.now() });

        console.log(`[TrainingDocs] Backfilled doc ${doc.id} with ${chunks.length} chunks (using doc-level embedding)`);
        backfilled++;
    }

    return backfilled;
}
