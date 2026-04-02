console.log('[worker.js] Top of file');
import 'dotenv/config';

try {
    const dbHost = process.env.DB_HOST;
    if (dbHost) {
        console.log(`[worker.js] dotenv loaded. DB_HOST: ${dbHost}`);
    } else {
        console.warn('[worker.js] WARNING: dotenv might not have loaded correctly. DB_HOST is undefined.');
    }
} catch (e) { console.error('[worker.js] Error checking env vars:', e); }

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
// sharp renamed to dynamic inside function

import { createWorker } from 'tesseract.js';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { pathToFileURL } from 'url';
import { knex, initDb } from './db.js';
import { JOB_STATUS, DOC_STATUS } from './constants/status.js';
import { generateEmbedding, parseIntent, generateAnswer, vectorStore } from './ai_search.js';
import { Worker } from 'bullmq';
import { connection, USE_BULLMQ } from './utils/queue.js';
import { io as ioClient } from 'socket.io-client';
import { parseJsonObjectSafe } from './utils/jsonSafe.js';
import { cache } from './utils/cache.js';

// Load PDF.js dynamically to ensure polyfills are applied first
const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

// Fix for CommonJS module in ESM
const require = createRequire(import.meta.url);
let pdf = require('pdf-parse');
// Handle ESM/CJS interop where default export might be wrapped
if (typeof pdf !== 'function' && pdf.default) {
    pdf = pdf.default;
}

// Connect to the main Node.js process to trigger UI refreshes
const socket = ioClient(`http://localhost:${process.env.PORT || 5000}`, { reconnection: true });

socket.on('connect', () => {
    console.log('[Worker] Terhubung ke server utama (IPC).');
});

socket.on('connect_error', (err) => {
    console.warn('[Worker] Gagal terhubung ke server utama (ECONNREFUSED). Pastikan server backend di port 5005 sudah jalan.');
});

// PDF.js worker setup
const pdfjsWorkerPath = path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
const standardFontDataUrl = path.resolve('node_modules/pdfjs-dist/standard_fonts/');
const standardFontDataUrlHref = pathToFileURL(standardFontDataUrl).href + '/'; // Ensure trailing slash for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(pdfjsWorkerPath).href;

if (!fs.existsSync(pdfjsWorkerPath)) {
    console.error("PDF.js Worker not found at:", pdfjsWorkerPath);
}

// Import local OCR pipeline
import { ocrPdf } from '../ocr_pipeline.js';

// Utility functions
const isPdfFile = (filePath) => {
    try {
        const buffer = Buffer.alloc(4);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buffer, 0, 4, 0);
        fs.closeSync(fd);
        return buffer.toString() === '%PDF';
    } catch (e) { return false; }
};

const isImageFile = (filePath) => {
    try {
        const buffer = Buffer.alloc(4);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buffer, 0, 4, 0);
        fs.closeSync(fd);
        const hex = buffer.toString('hex').toUpperCase();
        return hex.startsWith('FFD8FF') || hex.startsWith('89504E47') || hex.startsWith('47494638');
    } catch (e) { return false; }
};

async function extractImagesFromPDF(pdfDocument, maxPages = 15) {
    const images = [];
    const pagesToProcess = Math.min(pdfDocument.numPages, maxPages);

    for (let i = 1; i <= pagesToProcess; i++) {
        try {
            const page = await pdfDocument.getPage(i);
            const operatorList = await page.getOperatorList();

            console.log(`[Worker] [Page ${i}] Memeriksa ${operatorList.fnArray.length} operator...`);

            for (let j = 0; j < operatorList.fnArray.length; j++) {
                const fn = operatorList.fnArray[j];

                // Cek PaintImage, PaintInlineImage, atau PaintImageMask
                const isImage = fn === pdfjsLib.OPS.paintImageXObject ||
                    fn === pdfjsLib.OPS.paintInlineImageXObject ||
                    fn === pdfjsLib.OPS.paintImageMaskXObject;

                if (isImage) {
                    const objId = operatorList.argsArray[j][0];
                    try {
                        const img = await page.objs.get(objId);
                        if (img) {
                            const width = img.width || 0;
                            const height = img.height || 0;
                            const data = img.data || img.bitmap; // Fallback ke bitmap jika data tidak ada

                            if (data) {
                                const channels = Math.floor(data.length / (width * height)) || 1;
                                console.log(`[Worker] Found Image: Obj=${objId}, Dim=${width}x${height}, Channels=${channels}`);

                                // Filter gambar yang terlalu kecil (ikon, garis, dll)
                                if (width > 50 && height > 50) {
                                    const { default: sharp } = await import('sharp');
                                    const buffer = await sharp(data, {
                                        raw: {
                                            width: width,
                                            height: height,
                                            channels: channels
                                        }
                                    }).png().toBuffer();
                                    images.push(buffer);
                                    console.log(`[Worker] Image ${objId} extracted successfully via Sharp.`);
                                } else {
                                    console.log(`[Worker] Image ${objId} skipped (too small: ${width}x${height})`);
                                }
                            } else {
                                console.log(`[Worker] Image ${objId} has no raw pixel data.`);
                            }
                        }
                    } catch (imgErr) {
                        console.warn(`[Worker] Gagal mengambil objek gambar ${objId}:`, imgErr.message);
                    }
                }
            }
        } catch (pageErr) {
            console.warn(`[Worker] Gagal memproses gambar di halaman ${i}:`, pageErr.message);
        }
    }
    return images;
}

// Core Processing Logic
async function processJob(job) {
    const jobName = job.name || 'process-ocr';

    if (jobName === 'ai-chat') {
        const { message, history, user } = job.data;
        console.log(`[Worker] Processing AI Chat Job ${job.id} for user: ${user}`);
        try {
            const queryVector = await generateEmbedding(message);
            const intent = await parseIntent(message, queryVector);

            // Hybrid Semantic + Keyword search across multiple tables
            const [kwDocs, kwInvoices, kwTaxObjects, kwExternal, kwInventory] = await Promise.all([
                knex('documents').where('title', 'like', `%${message}%`).orWhere('ocrContent', 'like', `%${message}%`).limit(8),
                knex('invoices').where('invoice_no', 'like', `%${message}%`).orWhere('tax_invoice_no', 'like', `%${message}%`).orWhere('vendor', 'like', `%${message}%`).limit(8),
                knex('tax_objects').where('name', 'like', `%${message}%`).orWhere('identity_number', 'like', `%${message}%`).limit(8),
                knex('external_items').where('boxId', 'like', `%${message}%`).orWhere('destination', 'like', `%${message}%`).limit(8),
                knex('inventory').where('box_data', 'like', `%${message}%`).limit(8)
            ]);

            const semanticMatches = vectorStore.searchNearest(queryVector, 0.35, 12);

            // Build a deduplicated context list, preferring high semantic score
            const contexts = [];
            const seen = new Set();

            const pushContext = (label, text) => {
                if (!text) return;
                const key = `${label}:${text.substring(0, 200)}`;
                if (seen.has(key)) return;
                seen.add(key);
                contexts.push(`${label}: ${text}`);
            };

            // Add semantic doc matches first
            for (const m of semanticMatches) {
                const txt = (m.data && m.data.ocrContent) ? `${m.data.title} — ${(m.data.ocrContent || '').substring(0, 300)}` : m.name;
                pushContext(`SemanticMatch(${m.matchType})`, txt);
                if (contexts.length >= 8) break;
            }

            // Add keyword DB results
            for (const d of kwDocs) {
                pushContext('Doc', `${d.title} — ${(d.ocrContent || '').substring(0, 300)}`);
                if (contexts.length >= 12) break;
            }
            for (const inv of kwInvoices) {
                pushContext('Invoice', `${inv.vendor || ''} ${inv.invoice_no || ''} — ${(inv.description || '').substring(0, 200)}`);
                if (contexts.length >= 12) break;
            }
            for (const t of kwTaxObjects) {
                pushContext('TaxObject', `${t.name} — ${(t.identity_number || '')}`);
                if (contexts.length >= 12) break;
            }
            for (const e of kwExternal) {
                pushContext('External', `${e.boxId || ''} — ${(e.destination || '')}`);
                if (contexts.length >= 12) break;
            }
            for (const inv of kwInventory) {
                pushContext('Inventory', `${inv.id || ''} — ${(inv.box_data || '').substring(0, 200)}`);
                if (contexts.length >= 12) break;
            }

            // If no context found, fallback to latest documents snippet
            if (contexts.length === 0) {
                const recent = await knex('documents').orderBy('uploadDate', 'desc').limit(5);
                for (const d of recent) pushContext('Doc', `${d.title} — ${(d.ocrContent || '').substring(0, 300)}`);
            }

            const answer = await generateAnswer(message, contexts);

            const result = { reply: answer, intent: intent.type, context: contexts.slice(0, 8) };

            await knex('job_queue').where('id', job.id).update({
                result: JSON.stringify(result),
                status: JOB_STATUS.COMPLETED,
                finished_at: knex.fn.now()
            });
            return;
        } catch (err) {
            console.error(`[Worker] AI Chat Job ${job.id} Failed:`, err);
            throw err;
        }
    }

    if (jobName === 'ai-embedding') {
        const { text } = job.data;
        console.log(`[Worker] Processing AI Embedding Job ${job.id}`);
        try {
            const vector = await generateEmbedding(text);
            await knex('job_queue').where('id', job.id).update({
                result: JSON.stringify(vector),
                status: JOB_STATUS.COMPLETED,
                finished_at: knex.fn.now()
            });
            return;
        } catch (err) {
            console.error(`[Worker] AI Embedding Job ${job.id} Failed:`, err);
            throw err;
        }
    }

    if (jobName === 'ai-semantic-search') {
        const { query } = job.data;
        console.log(`[Worker] Processing AI Semantic Search for: "${query}"`);
        try {
            // 1. Keyword Matches (for hybrid relevance)
            const [kwDocs, kwInvoices, kwTaxObjects, kwExternal, kwInventory] = await Promise.all([
                knex('documents').where('title', 'like', `%${query}%`).orWhere('ocrContent', 'like', `%${query}%`).limit(20),
                knex('invoices').where('invoice_no', 'like', `%${query}%`).orWhere('tax_invoice_no', 'like', `%${query}%`).orWhere('vendor', 'like', `%${query}%`).limit(20),
                knex('tax_objects').where('name', 'like', `%${query}%`).orWhere('identity_number', 'like', `%${query}%`).limit(20),
                knex('external_items').where('boxId', 'like', `%${query}%`).orWhere('destination', 'like', `%${query}%`).limit(20),
                knex('inventory').where('box_data', 'like', `%${query}%`).limit(20)
            ]);

            // 2. Vector Search (Semantic)
            const queryVector = await generateEmbedding(query);
            const semanticMatches = vectorStore.searchNearest(queryVector, 0.4, 15);

            const resultsMap = new Map();
            semanticMatches.forEach(r => resultsMap.set(`${r.matchType}-${r.id}`, r));

            // 3. Merge Keyword Matches (boosted score)
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

            // 4. Enrich Results
            const enriched = [];
            const UPLOADS_DIR_LOCAL = path.join(process.cwd(), 'uploads');

            for (const r of Array.from(resultsMap.values()).sort((a, b) => b.score - a.score).slice(0, 50)) {
                const out = { id: r.id, name: r.name, matchType: r.matchType, score: r.score || 0 };
                // doc enrichment
                if (r.matchType === 'document' || r.matchType === 'Doc') {
                    const doc = r.data || await knex('documents').where('id', r.id).first();
                    if (doc) {
                        out.preview = (doc.ocrContent || '').substring(0, 600);
                        out.downloadUrl = doc.url || (doc.file_url || null);
                    }
                } else if (r.data && r.data.ocrContent) {
                    out.preview = (r.data.ocrContent || '').substring(0, 600);
                    if (r.data.url) out.downloadUrl = r.data.url;
                }
                enriched.push(out);
                if (enriched.length >= 15) break;
            }

            await knex('job_queue').where('id', job.id).update({
                result: JSON.stringify({ results: enriched }),
                status: JOB_STATUS.COMPLETED,
                finished_at: knex.fn.now()
            });
            console.log(`[Worker] AI Semantic Search Job ${job.id} Completed.`);
            return;
        } catch (err) {
            console.error(`[Worker] AI Semantic Search Job ${job.id} Failed:`, err);
            throw err;
        }
    }

    // Default: OCR Job
    const { docId, fileType, originalName, context, forceOcr, isBullMQ } = job.data;
    const source = isBullMQ ? 'BullMQ' : 'MySQL Polling';

    // Pastikan path file mengarah ke folder 'uploads' jika bukan path absolut
    let rawPath = job.data.filePath || job.data.filename;
    const filePath = path.isAbsolute(rawPath)
        ? rawPath
        : path.join(process.cwd(), 'uploads', rawPath);

    const isInventory = context && context.type === 'inventory';
    console.log(`[Worker] [${source}] Processing OCR Job ${job.id} for ${isInventory ? 'Inventory' : 'Document'}: ${docId}`);
    console.log(`[Worker] [${source}] Target File: ${filePath} (Exists: ${fs.existsSync(filePath)})`);

    try {
        if (!fs.existsSync(filePath)) {
            const errorMsg = `File tidak ditemukan di path: ${filePath}`;
            console.error(`[Worker] ${errorMsg}`);
            throw new Error(errorMsg);
        }

        let extractedText = "";
        let shouldProcess = true;

        if (docId && String(docId).toLowerCase().startsWith('doc')) { // Real docId check
            const existingData = await knex('documents').select('ocrContent').where('id', docId).first();
            if (existingData && existingData.ocrContent && existingData.ocrContent.trim().length > 50) {
                extractedText = existingData.ocrContent;
                shouldProcess = false;
            }
        }

        if (shouldProcess) {
            let effectiveFileType = fileType;
            if (isPdfFile(filePath)) effectiveFileType = 'application/pdf';

            if (effectiveFileType.startsWith('image/')) {
                await job.updateProgress(10);
                const tess = await createWorker('eng+ind', 1, {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            job.updateProgress(10 + Math.round(m.progress * 80));
                        }
                    }
                });
                await tess.setParameters({ tessedit_pageseg_mode: '3' });
                const { data: { text } } = await tess.recognize(filePath);
                extractedText = `[OCR IMAGE]\n${text}`;
                await job.updateProgress(100);
                await tess.terminate();
            } else if (effectiveFileType === 'application/pdf') {
                const dataBuffer = fs.readFileSync(filePath);
                let pdfText = "";
                try {
                    const uint8Array = new Uint8Array(dataBuffer);
                    const loadingTask = pdfjsLib.getDocument({ data: uint8Array, standardFontDataUrl: standardFontDataUrlHref });
                    const pdfDocument = await loadingTask.promise;
                    for (let i = 1; i <= Math.min(pdfDocument.numPages, 50); i++) {
                        const page = await pdfDocument.getPage(i);
                        const tokenizedText = await page.getTextContent();
                        pdfText += tokenizedText.items.map(t => t.str).join(' ') + "\n";
                    }
                } catch (e) {
                    try {
                        const data = await pdf(dataBuffer);
                        pdfText = data.text || "";
                    } catch (pdfErr) {
                        console.error("PDF Parsing Fallback Failed:", pdfErr);
                    }
                }
                extractedText = pdfText.trim();

                // Always run OCR pipeline for all PDFs so scanned & image-only PDFs are handled.
                // After OCR, keep whichever result contains more text.
                const lineCount = extractedText.split(/\r\n|\r|\n/).length;
                console.log(`[Worker] PDF teks digital: ${lineCount} baris (${extractedText.length} karakter). Menjalankan OCR pipeline...`);

                try {
                    // Use improved OCR pipeline for all PDFs (text + scanned)
                    const pipelineRes = await ocrPdf(filePath, null, {
                        onProgress: (p) => {
                            if (p.percent != null) {
                                // Map pipeline 0-100% to worker 20-95% (since digital extraction was already done)
                                const mapped = 20 + Math.round(p.percent * 0.75);
                                job.updateProgress(mapped);
                            }
                        }
                    });
                    if (pipelineRes && pipelineRes.results) {
                        const combined = pipelineRes.results.map(r => r.text || '').join('\n').trim();
                        if (combined.length > 10) {
                            // Prefer OCR result when it gives more content, or digital text is thin
                            if (combined.length > extractedText.length || lineCount < 50) {
                                extractedText = `[OCR-PIPELINE]\n${combined}`;
                                console.log(`[Worker] ✅ OCR Pipeline Selesai. Pakai hasil OCR (${extractedText.length} karakter).`);
                            } else {
                                // Append OCR to digital text so search index has both
                                extractedText = `${extractedText}\n[OCR-PIPELINE]\n${combined}`;
                                console.log(`[Worker] ✅ OCR Pipeline Selesai. Digabung dengan teks digital (${extractedText.length} karakter).`);
                            }
                        } else {
                            console.log('[Worker] OCR Pipeline tidak menghasilkan teks, tetap pakai teks digital.');
                        }
                    }
                } catch (err) {
                    console.error('[Worker] OCR pipeline failed:', err.message);

                    // Last-resort fallback: if pipeline failed and text is thin, use worker's own image extraction + Tesseract
                    if (extractedText.length < 100) {
                        console.log('[Worker] Text thin after pipeline failure. Attempting last-resort Tesseract OCR...');
                        try {
                            const uint8 = new Uint8Array(dataBuffer);
                            const lt = pdfjsLib.getDocument({ data: uint8, standardFontDataUrl: standardFontDataUrlHref });
                            const pdfDoc = await lt.promise;
                            const extractedImages = await extractImagesFromPDF(pdfDoc, 15);
                            if (extractedImages.length > 0) {
                                console.log(`[Worker] Last-resort: Found ${extractedImages.length} images. Running Tesseract...`);
                                const tess = await createWorker('eng+ind');
                                await tess.setParameters({ tessedit_pageseg_mode: '3' });
                                let ocrTexts = [];
                                for (let idx = 0; idx < extractedImages.length; idx++) {
                                    const { data: { text } } = await tess.recognize(extractedImages[idx]);
                                    if (text && text.trim().length > 5) ocrTexts.push(text.trim());
                                    job.updateProgress(20 + Math.round((idx / extractedImages.length) * 75));
                                }
                                await tess.terminate();
                                if (ocrTexts.length > 0) {
                                    extractedText = `[OCR-LASTRESORT]\n${ocrTexts.join('\n')}`;
                                    console.log(`[Worker] ✅ Last-resort OCR produced ${extractedText.length} characters.`);
                                }
                            } else {
                                console.warn('[Worker] Last-resort: No images found in PDF either.');
                            }
                        } catch (lrErr) {
                            console.error('[Worker] Last-resort OCR also failed:', lrErr.message);
                        }
                    }
                }
            } else if (fileType.includes('spreadsheet') || fileType.includes('excel')) {
                await job.updateProgress(20);
                const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' });
                await job.updateProgress(60);
                extractedText = workbook.SheetNames.map(n => XLSX.utils.sheet_to_txt(workbook.Sheets[n])).join("\n\n");
                await job.updateProgress(100);
            } else if (fileType.includes('word') || filePath.endsWith('.docx')) {
                await job.updateProgress(30);
                const res = await mammoth.extractRawText({ path: filePath });
                extractedText = res.value;
                await job.updateProgress(100);
            } else if (fileType.includes('powerpoint') || fileType.includes('presentation') || filePath.endsWith('.pptx')) {
                await job.updateProgress(20);
                try {
                    const data = fs.readFileSync(filePath);
                    const zip = new JSZip();
                    const contents = await zip.loadAsync(data);
                    await job.updateProgress(50);
                    let pptText = "";

                    // PPTX stores text in ppt/slides/slide*.xml
                    const slides = Object.keys(contents.files).filter(f => f.startsWith('ppt/slides/slide') && f.endsWith('.xml'));
                    for (let i = 0; i < slides.length; i++) {
                        const filename = slides[i];
                        const xml = await contents.files[filename].async("string");
                        const matches = xml.match(/<a:t.*?>(.*?)<\/a:t>/g);
                        if (matches) {
                            pptText += matches.map(m => m.replace(/<.*?>/g, '')).join(' ') + "\n";
                        }
                        job.updateProgress(50 + Math.round((i / slides.length) * 45));
                    }
                    extractedText = pptText.trim();
                    await job.updateProgress(100);
                } catch (pptErr) {
                    console.error("PPTX Parsing Failed:", pptErr);
                }
            }
        }

        // Database updates
        if (isInventory || (context && context.type === 'inventory_invoice')) {
            const slotId = context.slotId || context.slot_id;
            const invoiceId = context.invoiceId || context.invoice_id;

            console.log(`[Worker] Updating Inventory: Slot=${slotId}, Invoice=${invoiceId}`);

            if (slotId && invoiceId) {
                const row = await knex('inventory').select('box_data').where('id', slotId).first();
                if (row) {
                    let box = parseJsonObjectSafe(row.box_data, {});
                    let changed = false;
                    box.ordners?.forEach(ord => ord.invoices?.forEach(inv => {
                        if (inv.id == invoiceId) {
                            inv.ocrContent = extractedText;
                            inv.status = DOC_STATUS.DONE;
                            changed = true;
                        }
                    }));
                    if (changed) {
                        await knex('inventory').where('id', slotId).update({ box_data: JSON.stringify(box) });
                        console.log(`[Worker] Inventory updated successfully for Slot ${slotId}`);
                    } else {
                        console.warn(`[Worker] Invoice ${invoiceId} not found in Slot ${slotId}`);
                    }
                }
            }
        }
        if (docId) {
            const docExists = await knex('documents').where('id', docId).first();
            if (docExists) {
                await knex('documents').where('id', docId).update({ ocrContent: extractedText, status: DOC_STATUS.DONE });
                console.log(`[Worker] Updated document ${docId} with OCR results.`);
                // Invalidate documents cache so frontend gets fresh data
                try { await cache.delByPattern('documents:*'); } catch (ce) { /* ignore cache errors */ }
            }
        }

        // --- NEW: Update Tax Audit Notes ---
        if (context && context.type === 'tax_note') {
            const noteId = context.noteId;
            console.log(`[Worker] Updating Tax Audit Note: ${noteId}`);
            if (noteId) {
                await knex('tax_audit_notes').where('id', noteId).update({ ocrContent: extractedText });
                console.log(`[Worker] Tax Note ${noteId} updated with OCR content.`);
            }
        }

        // Embedding: create combined vector of title + OCR content so vector represents both
        if (extractedText.length > 10) {
            if (docId) {
                // ensure OCR content persisted first
                try { await knex('documents').where('id', docId).update({ ocrContent: extractedText }); } catch (e) { /* ignore */ }
                const updatedDoc = await knex('documents').where('id', docId).first();
                if (updatedDoc) {
                    const combined = `${updatedDoc.title || ''}\n\n${updatedDoc.ocrContent || ''}`.trim();
                    if (combined.length > 10) {
                        const vector = await generateEmbedding(combined);
                        const vectorJson = JSON.stringify(vector);
                        try { await knex('documents').where('id', docId).update({ vector: vectorJson }); } catch (e) { }
                        vectorStore.upsertDocument({ id: updatedDoc.id, title: updatedDoc.title, ocrContent: updatedDoc.ocrContent, matchType: 'document' }, vector);
                    }
                }
            } else {
                const vector = await generateEmbedding(extractedText);
                // no docId to attach to, skip DB write but could upsert into cache if desired
            }
        }

        // --- UI REFRESH: Relay end-of-process signal to main server ---
        try {
            console.log(`[Worker] Emitting data:changed relay via IPC socket...`);
            socket.emit('worker:update', { channel: 'documents' });
            socket.emit('worker:update', { channel: 'inventory' });
            socket.emit('worker:update', { channel: 'tax' });
        } catch (se) {
            console.error('[Worker] Socket emit failed:', se);
        }

    } catch (err) {
        console.error(`[Worker] Job ${job.id} Failed:`, err);
        throw err;
    }
}

async function startPolling() {
    console.log("[Worker] Starting MySQL Polling (parallel pollers)...");
    await knex('job_queue').where('status', JOB_STATUS.ACTIVE).update({ status: JOB_STATUS.WAITING });

    const OCR_POLLERS = parseInt(process.env.OCR_POLLERS || process.env.OCR_LANES || '3', 10);

    const sleep = (ms) => new Promise(res => setTimeout(res, ms));

    const startPoller = (index) => {
        const poll = async () => {
            while (true) {
                try {
                    const row = await knex('job_queue')
                        .where('status', JOB_STATUS.WAITING)
                        .orderBy('created_at', 'asc')
                        .first();

                    if (!row) {
                        await sleep(2000);
                        continue;
                    }

                    // Try to atomically claim the job by updating status only if still WAITING
                    const updated = await knex('job_queue')
                        .where({ id: row.id, status: JOB_STATUS.WAITING })
                        .update({ status: JOB_STATUS.ACTIVE, processed_at: knex.fn.now() });

                    if (!updated) {
                        // someone else claimed it
                        await sleep(50);
                        continue;
                    }

                    console.log(`[Worker:Poller${index}] Claimed Job: ${row.id} (${row.name})`);
                    const job = {
                        id: row.id,
                        name: row.name,
                        data: parseJsonObjectSafe(row.data, {}),
                        updateProgress: async (p) => await knex('job_queue').where('id', row.id).update({ progress: p })
                    };

                    try {
                        await processJob(job);
                        await knex('job_queue').where('id', row.id).update({ status: JOB_STATUS.COMPLETED, finished_at: knex.fn.now(), progress: 100 });
                    } catch (e) {
                        const retries = (row.retries || 0) + 1;
                        if (retries < (row.max_attempts || 3)) {
                            await knex('job_queue').where('id', row.id).update({ status: JOB_STATUS.WAITING, retries, error: e.message });
                        } else {
                            await knex('job_queue').where('id', row.id).update({ status: JOB_STATUS.FAILED, finished_at: knex.fn.now(), error: e.message });

                            // CRITICAL: Reset the status of the associated document or inventory item so it doesn't stay stuck at 'processing'
                            try {
                                const jobData = parseJsonObjectSafe(row.data, {});
                                const context = jobData.context || {};

                                // 1. Check for documents
                                if (jobData.docId) {
                                    await knex('documents').where('id', jobData.docId).where('status', 'processing').update({ status: DOC_STATUS.DONE });
                                    console.log(`[Worker] Document ${jobData.docId} status reset to 'done' after job failure.`);
                                }

                                // 2. Check for inventory invoices
                                if (context.type === 'inventory_invoice' || jobData.isInventory) {
                                    const slotId = context.slotId || context.slot_id;
                                    const invoiceId = context.invoiceId || context.invoice_id;

                                    if (slotId && invoiceId) {
                                        const res = await knex('inventory').select('box_data').where('id', slotId).first();
                                        if (res) {
                                            let box = parseJsonObjectSafe(res.box_data, {});
                                            let changed = false;
                                            box.ordners?.forEach(ord => ord.invoices?.forEach(inv => {
                                                if (inv.id == invoiceId && (inv.status === 'processing' || inv.status === 'waiting' || inv.status === 'stalled')) {
                                                    inv.status = DOC_STATUS.DONE; // Reset to done/failed
                                                    changed = true;
                                                }
                                            }));
                                            if (changed) {
                                                await knex('inventory').where('id', slotId).update({ box_data: JSON.stringify(box) });
                                                console.log(`[Worker] Inventory invoice ${invoiceId} status reset to 'done' after job failure.`);
                                            }
                                        }
                                    }
                                }
                            } catch (resetErr) {
                                console.error('[Worker] Failed to reset status after job failure:', resetErr.message);
                            }
                        }
                    }
                } catch (e) {
                    console.error(`[Worker:Poller${index}] Poll Error:`, e);
                    await sleep(5000);
                }
            }
        };
        poll();
    };

    for (let i = 0; i < OCR_POLLERS; i++) startPoller(i + 1);
}

async function startWorkerSystem() {
    // Determine mode from environment variable or command line argument
    const args = process.argv.slice(2);
    const modeArg = args.find(arg => arg.startsWith('--mode='))?.split('=')[1];
    const mode = (modeArg || process.env.WORKER_MODE || 'ALL').toUpperCase();

    const tag = `[Worker:${mode}]`;
    console.log(`⚙️ ${tag} Memulai Sistem Antrean...`);

    // --- DB & AI Vector Store Initialization ---
    // In Microservice mode, ONLY the worker handles this heavy operation.
    (async () => {
        try {
            console.log(`${tag} 📦 Menghubungkan ke Database...`);
            await initDb();
            console.log(`${tag} 🧠 Memulai Vector Store (lazy=true)...`);
            await vectorStore.initialize({ lazy: true });
            console.log(`${tag} ✅ Vector Store initialized in background.`);

            // --- Custom: Indexing all relevant fields for semantic search ---
            console.log(`${tag} 🔍 Indexing all documents, invoices, tax_objects, external_items, inventory for semantic search...`);
            // Documents: embed combined title + OCR content so each doc has a single representative vector
            const docs = await knex('documents').select('id', 'title', 'ocrContent');
            for (const d of docs) {
                const combined = `${d.title || ''}\n\n${d.ocrContent || ''}`.trim();
                if (combined.length > 10) {
                    const v = await generateEmbedding(combined);
                    // store combined text as the vector source so title and OCR are both represented
                    vectorStore.upsertDocument({ id: d.id, title: d.title, ocrContent: d.ocrContent, matchType: 'document' }, v);
                    // persist vector in DB for future restarts
                    try { await knex('documents').where('id', d.id).update({ vector: JSON.stringify(v) }); } catch (e) { /* ignore write errors here */ }
                }
            }
            // Invoices: combine vendor, invoice numbers and any textual fields into one embedding
            const invoices = await knex('invoices').select('id', 'vendor', 'invoice_no', 'tax_invoice_no', 'ocr_content');
            for (const inv of invoices) {
                const textField = inv.ocr_content || inv.ocrContent || '';
                const combined = `${inv.vendor || ''} ${inv.invoice_no || ''} ${inv.tax_invoice_no || ''} ${textField}`.trim();
                if (combined.length > 5) {
                    const v = await generateEmbedding(combined);
                    vectorStore.upsertDocument({ id: inv.id, title: `${inv.vendor || ''} ${inv.invoice_no || ''}`.trim(), ocrContent: textField, matchType: 'invoice' }, v);
                    try { await knex('invoices').where('id', inv.id).update({ vector: JSON.stringify(v) }); } catch (e) { }
                }
            }
            // Tax Objects
            const taxObjs = await knex('tax_objects').select('id', 'name', 'identity_number');
            for (const t of taxObjs) {
                if (t.name) {
                    const v = await generateEmbedding(t.name);
                    vectorStore.upsertDocument({ ...t, matchType: 'taxobject-name' }, v);
                }
                if (t.identity_number) {
                    const v = await generateEmbedding(t.identity_number);
                    vectorStore.upsertDocument({ ...t, matchType: 'taxobject-id' }, v);
                }
            }
            // External Items
            const extItems = await knex('external_items').select('id', 'boxId', 'destination');
            for (const e of extItems) {
                if (e.boxId) {
                    const v = await generateEmbedding(e.boxId);
                    vectorStore.upsertDocument({ ...e, matchType: 'external-boxid' }, v);
                }
                if (e.destination) {
                    const v = await generateEmbedding(e.destination);
                    vectorStore.upsertDocument({ ...e, matchType: 'external-destination' }, v);
                }
            }
            // Inventory (box_data): create a combined textual representation per inventory row
            const inventory = await knex('inventory').select('id', 'box_data');
            for (const inv of inventory) {
                let box = null;
                try { box = JSON.parse(inv.box_data); } catch (e) { box = null; }
                if (box) {
                    // Build a combined string from relevant parts
                    const parts = [];
                    if (box.id) parts.push(String(box.id));
                    if (box.ocrContent) parts.push(box.ocrContent);
                    if (Array.isArray(box.ordners)) {
                        for (const ord of box.ordners) {
                            if (ord.noOrdner) parts.push(ord.noOrdner);
                            if (Array.isArray(ord.invoices)) {
                                for (const invoice of ord.invoices) {
                                    if (invoice.invoiceNo) parts.push(invoice.invoiceNo);
                                    if (invoice.vendor) parts.push(invoice.vendor);
                                    if (invoice.ocrContent) parts.push(invoice.ocrContent);
                                }
                            }
                        }
                    }
                    const combined = parts.join(' \n ');
                    if (combined.length > 5) {
                        const v = await generateEmbedding(combined);
                        vectorStore.upsertDocument({ id: inv.id, title: `inventory-${inv.id}`, ocrContent: combined, matchType: 'inventory' }, v);
                        try { await knex('inventory').where('id', inv.id).update({ vector: JSON.stringify(v) }); } catch (e) { }
                    }
                }
            }
            console.log(`${tag} ✅ Semantic index complete.`);
        } catch (e) {
            console.error(`${tag} ❌ Gagal inisialisasi Database/Vector Store:`, e.message);
        }
    })();

    const startBullMQ = mode === 'ALL' || mode === 'BULLMQ';
    const startPollingMode = mode === 'ALL' || mode === 'POLLING';

    if (startBullMQ) {
        if (USE_BULLMQ) {
            console.log(`${tag} 🚀 Menjalankan BullMQ Worker (Redis Active)...`);
            new Worker('ocr-processor', async (job) => {
                await processJob({
                    id: job.id,
                    name: job.name,
                    data: { ...job.data, isBullMQ: true },
                    updateProgress: job.updateProgress.bind(job),
                    tag // Kirim tag ke processJob
                });
            }, { connection });
        } else {
            console.log(`${tag} ⚠️ Redis tidak terdeteksi. BullMQ Worker tidak dijalankan.`);
        }
    }

    if (startPollingMode) {
        console.log(`${tag} 🐌 Menjalankan MySQL Polling (Sharp/PDF Worker)...`);
        startPolling(tag);
    }
}

console.log('[worker.js] Calling startWorkerSystem()...');
process.env.IS_WORKER = 'true';
startWorkerSystem();
