import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { toMarkdownBytes, formatFromBytes, formatFromExtension } from '@firecrawl/anydoc';
import { extractDocumentText, extractFieldsFromText } from '../services/pdfDataExtractor.js';
import { checkAuth } from '../middleware/auth.js';
import { knex } from '../db.js';
import { UPLOADS_DIR } from '../config/upload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
router.use(checkAuth);
console.log('[AnyDoc] Routes module loaded');

// ── Privasi: dokumen hanya terlihat oleh pembuatnya, kecuali admin/superadmin ──
const isAdmin = (req) => {
    const role = String(req.user?.role || '').toLowerCase();
    return role === 'admin' || role === 'superadmin';
};
const isOwnerOrAdmin = (req, owner) => isAdmin(req) || (owner && (req.user?.username === owner || req.user?.name === owner));

// Scope kueri: non-admin hanya melihat baris yang ia buat (username atau name)
const scopeByCreator = (q, req) => {
    if (isAdmin(req)) return q;
    return q.where(w => {
        w.where('created_by', req.user?.username).orWhere('created_by', req.user?.name);
    });
};

// Dedicated upload dir for anydoc (kept separate from general uploads)
const ANYDOC_DIR = path.join(__dirname, '../../uploads/anydoc');
if (!fs.existsSync(ANYDOC_DIR)) fs.mkdirSync(ANYDOC_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, ANYDOC_DIR),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^\w.\- ]/g, '_')}`),
});
const ALLOWED_EXTS = [
    '.doc', '.docx', '.docm', '.ppt', '.pps', '.pot', '.pptx', '.pptm', '.ppsx', '.ppsm',
    '.xls', '.xlsx', '.xlsm', '.xlsb', '.odt', '.ods', '.odp', '.rtf', '.epub', '.csv', '.pdf',
    '.md', '.txt',
];

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, ALLOWED_EXTS.includes(ext));
    },
});

const EXT_LABELS = {
    '.doc': 'Word', '.docx': 'Word', '.docm': 'Word',
    '.ppt': 'PowerPoint', '.pps': 'PowerPoint', '.pot': 'PowerPoint',
    '.pptx': 'PowerPoint', '.pptm': 'PowerPoint', '.ppsx': 'PowerPoint', '.ppsm': 'PowerPoint',
    '.xls': 'Excel', '.xlsx': 'Excel', '.xlsm': 'Excel', '.xlsb': 'Excel',
    '.odt': 'OpenDocument', '.ods': 'OpenDocument', '.odp': 'OpenDocument',
    '.rtf': 'RTF', '.epub': 'EPUB', '.csv': 'CSV', '.pdf': 'PDF',
    '.md': 'Markdown', '.txt': 'Text',
};

// POST /api/anydoc/convert — upload a document and convert it to Markdown
router.post('/convert', upload.single('file'), async (req, res) => {
    let uploadedPath = null;
    try {
        if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan.' });
        uploadedPath = req.file.path;

        const ext = path.extname(req.file.originalname).toLowerCase();
        const buffer = fs.readFileSync(req.file.path);
        const detected = formatFromBytes(buffer) || formatFromExtension(ext) || null;
        // CSV has no content signature — use the extension to name it
        const formatHint = detected === null && ext === '.csv' ? 'csv' : (detected || undefined);

        let markdown = '';
        try {
            markdown = await toMarkdownBytes(buffer, formatHint);
        } catch (e) {
            // ConvertErrorCode: unsupported / malformed / encrypted / resourceLimit / missingPart
            const code = e.code || 'malformed';
            const codeMsg = {
                unsupported: 'Format tidak didukung atau file tidak dapat dikonversi.',
                malformed: 'File tidak memiliki konten yang dapat diekstrak.',
                encrypted: 'File terenkripsi / dilindungi kata sandi.',
                resourceLimit: 'File melebihi batas keamanan (kompresi / ukuran).',
                missingPart: 'Bagian penting file tidak ditemukan.',
            };
            return res.status(422).json({
                error: codeMsg[code] || e.message || 'Gagal mengonversi dokumen.',
                code,
                detail: e.message,
            });
        }

        // Keep a copy of the markdown output as a downloadable file (root uploads dir,
        // prefix anydoc- + owner so the existing /uploads/:filename route can enforce
        // privacy: hanya pembuat (atau admin) yang boleh mengunduh).
        const ownerTag = String(req.user?.username || req.user?.name || 'user').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
        const mdName = `anydoc-${ownerTag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.md`;
        fs.writeFileSync(path.join(UPLOADS_DIR, mdName), markdown, 'utf8');

        res.json({
            success: true,
            originalName: req.file.originalname,
            extension: ext,
            format: detected || ext.slice(1),
            formatLabel: EXT_LABELS[ext] || (detected || 'Dokumen'),
            markdown,
            charCount: markdown.length,
            lineCount: markdown.split('\n').length,
            fileSize: req.file.size,
            mdUrl: `/uploads/${mdName}`,
            convertedAt: new Date().toISOString(),
        });
    } catch (e) {
        console.error('[AnyDoc] Convert error:', e);
        res.status(500).json({ error: e.message || 'Gagal mengonversi dokumen.' });
    } finally {
        // Always remove the uploaded source file (success, error, or abort)
        if (uploadedPath) {
            try { fs.unlinkSync(uploadedPath); } catch { /* best-effort */ }
        }
    }
});

// POST /api/anydoc/convert/archive — save a conversion result into the document archive
router.post('/convert/archive', async (req, res) => {
    try {
        const { title, markdown, folderId, originalName, formatLabel } = req.body || {};
        if (!markdown || !String(markdown).trim()) {
            return res.status(400).json({ error: 'Konten Markdown kosong.' });
        }

        const docTitle = title || originalName?.replace(/\.[^.]+$/, '') || 'Dokumen Terkonversi';
        const normalizedFolderId = (!folderId || folderId === 'null' || folderId === '') ? null : folderId;

        // Save the markdown as a file so it can be streamed/downloaded like other documents
        const rand = Math.random().toString(36).slice(2, 6);
        const ownerTag = String(req.user?.username || req.user?.name || 'user').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
        const mdName = `anydoc-${ownerTag}-${Date.now()}-${rand}.md`;
        fs.writeFileSync(path.join(UPLOADS_DIR, mdName), markdown, 'utf8');
        const newDocId = `doc-anydoc-${Date.now()}-${rand}`;

        await knex('documents')
            .insert({
                id: newDocId,
                title: docTitle + (originalName ? '' : ' (AnyDoc)'),
                type: 'text/markdown',
                size: ((Buffer.byteLength(markdown, 'utf8')) / 1024 / 1024).toFixed(2) + ' MB',
                uploadDate: knex.fn.now(),
                folderId: normalizedFolderId,
                owner: req.user?.name || req.user?.username || 'System',
                ocrContent: markdown,
                url: `/uploads/${mdName}`,
                file_data: null,
                version: 1,
                status: 'done',
                department: 'AnyDoc',
            });

        // Note: semantic vector indexing for archived docs is handled by the same
        // pipeline as other documents (OCR/worker), so no extra embedding here.
        res.json({ success: true, id: newDocId, title: docTitle });
    } catch (e) {
        console.error('[AnyDoc] Archive error:', e);
        res.status(500).json({ error: e.message || 'Gagal menyimpan ke arsip.' });
    }
});

// POST /api/anydoc/convert/train — save a conversion result into the AI knowledge base (RAG)
router.post('/convert/train', async (req, res) => {
    try {
        const { title, markdown, originalName, category, tags } = req.body || {};
        if (!markdown || !String(markdown).trim()) {
            return res.status(400).json({ error: 'Konten Markdown kosong.' });
        }

        const docTitle = title || originalName?.replace(/\.[^.]+$/, '') || 'Dokumen Terkonversi';
        const { saveDocument, generateDocEmbedding } = await import('../services/trainingDocs.js');
        const { generateEmbedding } = await import('../ai_search.js');

        const docId = await saveDocument({
            title: docTitle,
            filename: originalName || null,
            fileType: 'anydoc-md',
            content: markdown,
            category: category || 'general',
            tags: tags || null,
            userId: req.user?.id || null,
        });

        // Trigger embedding (async, non-blocking) so the content joins RAG search
        generateDocEmbedding(docId, generateEmbedding).catch(err =>
            console.warn(`[AnyDoc] Embed failed: ${err.message}`)
        );

        res.json({ success: true, id: docId, title: docTitle });
    } catch (e) {
        console.error('[AnyDoc] Train error:', e);
        res.status(500).json({ error: e.message || 'Gagal mengirim ke AI Training.' });
    }
});

// ── Template Mapping PDF (sampel → mapping → ekstrak PDF asli) ────────────────
import {
    extractPdfItems, groupLines, lineText, applyTemplate, detectTemplate, validateFieldsOnBuffer,
} from '../services/pdfMappingService.js';

const TEMPLATE_DIR = path.join(__dirname, '../../uploads/anydoc-templates');
if (!fs.existsSync(TEMPLATE_DIR)) fs.mkdirSync(TEMPLATE_DIR, { recursive: true });

// Arsip Dokumen: PDF asli hasil ekstraksi disimpan permanen di sini agar bisa diunduh
// / diekstrak ulang tanpa upload ulang.
const ARCHIVE_DIR = path.join(__dirname, '../../uploads/anydoc-archive');
if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

// Export Excel: file .xlsx hasil export disimpan permanen di sini agar bisa
// diunduh ulang dari History Export tanpa perlu extract ulang.
const EXPORT_DIR = path.join(__dirname, '../../uploads/anydoc-exports');
if (!fs.existsSync(EXPORT_DIR)) fs.mkdirSync(EXPORT_DIR, { recursive: true });

// ── Retensi otomatis: hapus history export lebih dari 30 hari (file + baris DB) ──
const EXPORT_RETENTION_DAYS = 30;
const cleanupExpiredExports = async () => {
    try {
        const cutoff = new Date(Date.now() - EXPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
        const rows = await knex('pdf_exports').where('created_at', '<', cutoff).select('id', 'file_path');
        for (const r of rows) {
            try { fs.unlinkSync(path.join(EXPORT_DIR, path.basename(r.file_path))); } catch { /* best-effort */ }
        }
        if (rows.length) {
            await knex('pdf_exports').whereIn('id', rows.map(r => r.id)).del();
            console.log(`[AnyDoc] Retensi export: ${rows.length} history > ${EXPORT_RETENTION_DAYS} hari dihapus.`);
        }
    } catch (e) {
        console.error('[AnyDoc] Gagal retensi export:', e.message);
    }
};
// Jalankan sekali saat start + ulangi tiap 6 jam
setTimeout(cleanupExpiredExports, 15 * 1000);
setInterval(cleanupExpiredExports, 6 * 60 * 60 * 1000);

const parseFields = (raw) => {
    // Terima dua bentuk: string JSON (multipart) atau array (JSON body)
    let arr = Array.isArray(raw) ? raw : [];
    if (!arr.length && typeof raw === 'string') {
        try { arr = JSON.parse(raw || '[]'); } catch { arr = []; }
    }
    return (Array.isArray(arr) ? arr : [])
        .map(f => ({
            group: f.group === 'table' ? 'table' : 'header',
            group_key: f.group_key || null,
            field_key: String(f.field_key || '').trim(),
            field_label: String(f.field_label || f.field_key || '').trim(),
            match_type: ['label_same_line', 'label_next_line', 'label_after_anchor', 'regex'].includes(f.match_type) ? f.match_type : 'label_same_line',
            pattern: String(f.pattern ?? ''),
            anchor: String(f.anchor ?? '').trim() || null,
            col_x: Number.isFinite(Number(f.col_x)) ? Number(f.col_x) : null,
            required: !!f.required,
            is_group: !!f.is_group,
            sort_order: Number.isFinite(Number(f.sort_order)) ? Number(f.sort_order) : 0,
        }))
        .filter(f => f.field_key && f.field_label);
};

const MONTHS = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };

// Periode dokumen: cari pola "/BULAN/TAHUN" pada nomor dokumen / invoice / nama file
// (mis. "0270/YDI/NR/MAY/2026" → "2026-05"). Gagal → bulan berjalan.
function extractPeriod(data, filename) {
    const hay = [data.nomor_nota_retur, data.no_invoice, data.nomor_invoice, data.nomor, data.no_document, filename]
        .filter(Boolean).join(' ');
    const m = String(hay).match(/\/([A-Z]{3})\/(\d{4})/);
    if (m && MONTHS[m[1]]) return `${m[2]}-${MONTHS[m[1]]}`;
    return new Date().toISOString().slice(0, 7);
}

// Metrik ekstraksi utk monitoring & deteksi perubahan layout
function computeMonitoring(fields, r) {
    const docs = r.documents || [];
    const allRegions = docs.flatMap(d => (d.regions || []));
    const avgConf = allRegions.length
        ? allRegions.reduce((s, x) => s + (x.confidence || 0), 0) / allRegions.length
        : 0;
    const headerFields = (fields || []).filter(f => f.group !== 'table');
    const fieldsFound = new Set(docs.flatMap(d => Object.keys(d.data || {}).filter(k => d.data[k]))).size;
    const fieldsTotal = headerFields.length;
    const tableFields = (fields || []).filter(f => f.group === 'table');
    const tableFound = !tableFields.length || (docs[0]?.table?.found === true);

    const warnings = [];
    if (allRegions.length && avgConf < 0.7) warnings.push(`confidence ${Math.round(avgConf * 100)}% (rendah)`);
    if (fieldsTotal && fieldsFound / fieldsTotal < 0.6) warnings.push(`${fieldsFound}/${fieldsTotal} field header ditemukan`);
    if (tableFields.length && !tableFound) warnings.push('header tabel tidak terdeteksi');
    if (!docs.length) warnings.push('tidak ada dokumen terdeteksi');

    return {
        doc_count: docs.length,
        total_rows: docs.reduce((s, d) => s + (d.items || []).length, 0),
        avg_confidence: Math.round(avgConf * 100) / 100,
        fields_found: fieldsFound,
        fields_total: fieldsTotal,
        table_found: tableFound,
        layout_changed: warnings.length > 0,
        warning: warnings.join('; ') || null,
    };
}

const normalizeSampleFiles = (raw) => {
    // Terima dua bentuk: string JSON (multipart) atau array (JSON body)
    let arr = Array.isArray(raw) ? raw : [];
    if (!arr.length && typeof raw === 'string') {
        try { arr = JSON.parse(raw || '[]'); } catch { arr = []; }
    }
    return (Array.isArray(arr) ? arr : []).map(s => ({ filename: String(s.filename || ''), path: String(s.path || '') })).filter(s => s.filename);
};

async function getTemplateWithFields(id) {
    const t = await knex('pdf_mapping_templates').where('id', id).first();
    if (!t) return null;
    const fields = await knex('pdf_mapping_fields').where('template_id', id).orderBy('sort_order', 'asc').orderBy('id', 'asc');
    return {
        ...t,
        sample_files: normalizeSampleFiles(t.sample_files),
        fields,
    };
}

// Pakai .any() supaya field form lain (fields, templateId) ikut diterima, tidak ditolak multer
const tplUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024, files: 20 },
});
const tplUploadAny = (req, res, next) => tplUpload.any()(req, res, next);

// POST /api/anydoc/templates/samples — simpan file sampel utk template
router.post('/templates/samples', tplUpload.array('files', 30), async (req, res) => {
    try {
        const files = (req.files || []).map(f => {
            const safe = f.originalname.replace(/[^\w.\- ]/g, '_');
            const name = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${safe}`;
            fs.writeFileSync(path.join(TEMPLATE_DIR, name), f.buffer);
            return { filename: f.originalname, path: name, size: f.size };
        });
        res.json({ success: true, files });
    } catch (e) {
        res.status(500).json({ error: e.message || 'Gagal simpan sampel.' });
    }
});

// POST /api/anydoc/templates/sample-lines — ambil baris teks + posisi dari sampel (untuk UI mapping)
router.post('/templates/sample-lines', tplUpload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'File sampel wajib diupload.' });
        const pages = await extractPdfItems(req.file.buffer);
        const pl = groupLines(pages);
        res.json({
            success: true,
            fileName: req.file.originalname,
            pages: pl.map(pg => ({
                page: pg.page,
                width: Math.round(pg.width),
                height: Math.round(pg.height),
                lines: pg.lines.map(l => ({
                    y: Math.round(l.y),
                    text: lineText(l),
                    items: l.items.map(i => ({ str: i.str, x: Math.round(i.x), w: Math.round(i.w) })),
                })),
            })),
        });
    } catch (e) {
        res.status(500).json({ error: e.message || 'Gagal membaca sampel.' });
    }
});

// POST /api/anydoc/templates/validate — uji mapping ke semua sampel (training iteratif)
router.post('/templates/validate', tplUploadAny, async (req, res) => {
    try {
        const files = req.files || [];
        const fields = parseFields(req.body.fields);
        if (!files.length) return res.status(400).json({ error: 'Upload minimal 1 sampel.' });
        const splitPattern = String(req.body.split_pattern || '').trim() || null;
        const splitKey = String(req.body.split_key || '').trim() || null;
        const results = [];
        for (const f of files) {
            const fieldsRes = await validateFieldsOnBuffer(f.buffer, fields, { splitPattern, splitKey });
            results.push({ filename: f.originalname, fields: fieldsRes });
        }
        res.json({ success: true, results, fields });
    } catch (e) {
        res.status(500).json({ error: e.message || 'Gagal validasi.' });
    }
});

// POST /api/anydoc/templates — buat template baru
router.post('/templates', async (req, res) => {
    try {
        const b = req.body || {};
        const name = String(b.name || '').trim();
        if (!name) return res.status(400).json({ error: 'Nama template wajib diisi.' });
        const fields = parseFields(b.fields);
        const sampleFiles = normalizeSampleFiles(b.sample_files);
        const [id] = await knex('pdf_mapping_templates').insert({
            name,
            doc_type: String(b.doc_type || '').trim() || null,
            description: String(b.description || '').trim() || null,
            split_pattern: String(b.split_pattern || '').trim() || null,
            split_key: String(b.split_key || '').trim() || null,
            sample_files: sampleFiles.length ? JSON.stringify(sampleFiles) : null,
            created_by: req.user?.username || req.user?.name || 'System',
        }).returning('id');
        const tplId = typeof id === 'object' ? id.id : id;
        if (fields.length) {
            await knex('pdf_mapping_fields').insert(fields.map((f, i) => ({
                ...f, template_id: tplId, sort_order: f.sort_order || i,
            })));
        }
        res.status(201).json(await getTemplateWithFields(tplId));
    } catch (e) {
        res.status(500).json({ error: e.message || 'Gagal membuat template.' });
    }
});

// GET /api/anydoc/templates — daftar template
router.get('/templates', async (req, res) => {
    try {
        const rows = await knex('pdf_mapping_templates').orderBy('id', 'desc');
        const out = [];
        for (const t of rows) {
            const fields = await knex('pdf_mapping_fields').where('template_id', t.id).orderBy('sort_order', 'asc');
            out.push({ ...t, sample_files: normalizeSampleFiles(t.sample_files), fields });
        }
        res.json(out);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/anydoc/templates/samples/file?name=xxx — ambil file sampel tersimpan (untuk reload mapping/validasi)
// Privasi: file sampel adalah dokumen — hanya pembuat template yang mereferensikannya
// (atau admin) yang boleh mengunduh.
const TEMPLATE_MIME = {
    '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword', '.txt': 'text/plain', '.md': 'text/plain',
};
router.get('/templates/samples/file', async (req, res) => {
    const name = String(req.query.name || '');
    const safe = path.basename(name);
    if (!name || safe !== name || !fs.existsSync(path.join(TEMPLATE_DIR, safe))) {
        return res.status(404).json({ error: 'Sampel tidak ditemukan.' });
    }
    // Cari template yang mereferensikan file sampel ini (created_by = owner sampel)
    const templates = await knex('pdf_mapping_templates').select('id', 'created_by', 'sample_files');
    const referencing = templates.find(t => normalizeSampleFiles(t.sample_files).some(s => s.path === safe));
    if (!referencing) {
        return res.status(403).json({ error: 'Sampel tidak terhubung ke template mana pun.' });
    }
    if (!isOwnerOrAdmin(req, referencing.created_by)) {
        return res.status(403).json({ error: 'Anda tidak berhak mengakses sampel template ini.' });
    }
    res.setHeader('Content-Type', TEMPLATE_MIME[path.extname(safe).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safe}"`);
    res.sendFile(path.join(TEMPLATE_DIR, safe));
});

// GET /api/anydoc/templates/extractions — riwayat ekstraksi (monitoring hasil bulanan)
// Privasi: hanya hasil ekstraksi milik user, kecuali admin melihat semua.
router.get('/templates/extractions', async (req, res) => {
    try {
        const tplId = Number(req.query.templateId);
        const q = scopeByCreator(knex('pdf_extractions'), req).orderBy('created_at', 'desc').limit(100);
        if (Number.isFinite(tplId) && tplId > 0) q.where('template_id', tplId);
        const rows = await q;
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/anydoc/templates/extractions/summary — ringkasan per periode (bulan)
router.get('/templates/extractions/summary', async (req, res) => {
    try {
        const tplId = Number(req.query.templateId);
        const q = scopeByCreator(knex('pdf_extractions'), req)
            .select('period')
            .count('* as file_count')
            .sum('doc_count as doc_count')
            .sum('total_rows as total_rows')
            .avg('avg_confidence as avg_confidence')
            .select(knex.raw('COALESCE(SUM(CASE WHEN layout_changed THEN 1 ELSE 0 END), 0) as layout_issues'))
            .whereNotNull('period')
            .groupBy('period')
            .orderBy('period', 'desc');
        if (Number.isFinite(tplId) && tplId > 0) q.where('template_id', tplId);
        const rows = await q;
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Arsip Dokumen: penyimpanan PDF asli hasil ekstraksi ─────────────────────────
// GET /api/anydoc/templates/archive — daftar file tersimpan (arsip dokumen)
// Privasi: hanya arsip milik user, kecuali admin melihat semua.
router.get('/templates/archive', async (req, res) => {
    try {
        const tplId = Number(req.query.templateId);
        const q = scopeByCreator(knex('pdf_extractions'), req)
            .whereNotNull('file_path')
            .orderBy('created_at', 'desc')
            .limit(200);
        if (Number.isFinite(tplId) && tplId > 0) q.where('template_id', tplId);
        const rows = await q;
        // Tambah ukuran file asli dari disk + URL unduh
        const out = rows.map(r => {
            let size = r.file_size || null;
            try { if (r.file_path) size = fs.statSync(path.join(ARCHIVE_DIR, path.basename(r.file_path))).size; } catch { /* best-effort */ }
            return { ...r, size, downloadUrl: `/api/anydoc/templates/archive/file?id=${r.id}` };
        });
        res.json(out);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/anydoc/templates/archive/file?id=N — unduh PDF asli dari arsip
router.get('/templates/archive/file', async (req, res) => {
    try {
        const id = Number(req.query.id);
        if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID arsip wajib diisi.' });
        const row = await knex('pdf_extractions').where('id', id).whereNotNull('file_path').first();
        if (!row) return res.status(404).json({ error: 'File arsip tidak ditemukan.' });
        if (!isOwnerOrAdmin(req, row.created_by)) return res.status(403).json({ error: 'Anda tidak berhak mengakses dokumen ini.' });
        const safe = path.basename(row.file_path);
        const fp = path.join(ARCHIVE_DIR, safe);
        if (!fs.existsSync(fp)) return res.status(404).json({ error: 'File arsip hilang dari disk.' });
        const ext = path.extname(row.filename || safe).toLowerCase();
        res.setHeader('Content-Type', TEMPLATE_MIME[ext] || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${String(row.filename || safe).replace(/[\"\r\n]/g, '_')}"`);
        res.sendFile(fp);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/anydoc/templates/archive/re-extract — ekstrak ulang file dari arsip (tanpa upload)
// body: { ids: [1,2] } atau { id: 1 } — wajib templateId ATAU auto-deteksi
router.post('/templates/archive/re-extract', async (req, res) => {
    try {
        const b = req.body || {};
        const ids = Array.isArray(b.ids) ? b.ids.map(Number).filter(Number.isFinite) : (Number.isFinite(Number(b.id)) ? [Number(b.id)] : []);
        if (!ids.length) return res.status(400).json({ error: 'Pilih minimal 1 file arsip.' });

        const rows = await knex('pdf_extractions').whereIn('id', ids).whereNotNull('file_path');
        if (!rows.length) return res.status(404).json({ error: 'File arsip tidak ditemukan.' });
        // Privasi: hanya pembuat arsip (atau admin) yang boleh ekstrak ulang
        for (const r of rows) {
            if (!isOwnerOrAdmin(req, r.created_by)) {
                return res.status(403).json({ error: `Anda tidak berhak mengakses "${r.filename}".` });
            }
        }
        // Urutkan sesuai urutan ids yang diminta (knex whereIn tidak menjamin urutan) —
        // supaya hasil sejajar dengan daftar file yang disiapkan frontend.
        const idOrder = new Map(ids.map((id, i) => [id, i]));
        rows.sort((a, b) => (idOrder.get(Number(a.id)) ?? 0) - (idOrder.get(Number(b.id)) ?? 0));

        const { enriched, fieldsByTpl } = await loadTemplatesWithFields();
        const explicitId = b.templateId ? Number(b.templateId) : null;
        const chosen = explicitId ? (enriched.find(t => Number(t.id) === explicitId) || null) : null;

        const results = [];
        for (const row of rows) {
            const fp = path.join(ARCHIVE_DIR, path.basename(row.file_path));
            if (!fs.existsSync(fp)) {
                results.push({ filename: row.filename, success: false, error: 'File arsip hilang dari disk.' });
                continue;
            }
            const buffer = fs.readFileSync(fp);
            results.push(await processOneFile({
                buffer, originalname: row.filename, chosen, enriched, fieldsByTpl,
                user: req.user,
                archive: { file_path: row.file_path, file_size: row.file_size },
            }));
        }
        const firstOk = results.find(r => r.success && r.template);
        res.json({ success: true, results, auto: !explicitId, usedTemplate: chosen ? { id: chosen.id, name: chosen.name } : (firstOk ? firstOk.template : null) });
    } catch (e) {
        console.error('[AnyDoc] Re-extract error:', e);
        res.status(500).json({ error: e.message || 'Gagal ekstrak ulang.' });
    }
});

// DELETE /api/anydoc/templates/archive/:id — hapus file dari arsip (disk + riwayat)
router.delete('/templates/archive/:id', async (req, res) => {
    try {
        const row = await knex('pdf_extractions').where('id', req.params.id).whereNotNull('file_path').first();
        if (!row) return res.status(404).json({ error: 'File arsip tidak ditemukan.' });
        if (!isOwnerOrAdmin(req, row.created_by)) return res.status(403).json({ error: 'Anda tidak berhak menghapus dokumen ini.' });
        try { fs.unlinkSync(path.join(ARCHIVE_DIR, path.basename(row.file_path))); } catch { /* best-effort */ }
        await knex('pdf_extractions').where('id', row.id).del();
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── History Export Excel: simpan file xlsx hasil export agar bisa diunduh ulang ──
// POST /api/anydoc/templates/exports — multipart: file (xlsx) + metadata
router.post('/templates/exports', tplUploadAny, async (req, res) => {
    try {
        const file = (req.files || [])[0];
        if (!file) return res.status(400).json({ error: 'File Excel wajib diupload.' });
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (ext !== '.xlsx' && ext !== '.xls') {
            return res.status(400).json({ error: 'Hanya file Excel (.xlsx/.xls) yang bisa disimpan.' });
        }
        // Cek magic bytes — xlsx (zip) diawali 'PK', xls (CFB) diawali D0 CF 11 E0
        const head = file.buffer.subarray(0, 4);
        const isXlsx = head[0] === 0x50 && head[1] === 0x4b; // 'PK'
        const isXls = head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0;
        if (!isXlsx && !isXls) {
            return res.status(400).json({ error: 'Berkas bukan file Excel asli (magic bytes tidak cocok).' });
        }

        const title = String(req.body.title || 'Export Excel').trim().slice(0, 255);
        const templateIdRaw = Number(req.body.templateId);
        const templateId = Number.isFinite(templateIdRaw) && templateIdRaw > 0 ? templateIdRaw : null;
        const fileCount = Number(req.body.fileCount) || 0;
        const docCount = Number(req.body.docCount) || 0;
        const totalRows = Number(req.body.totalRows) || 0;

        // Nama unik di disk (hindari bentrok), nama unduh = judul asli ber-extensi
        const diskName = `export-${Date.now()}-${Math.random().toString(36).slice(2, 6)}${ext}`;
        const downloadName = `${title.replace(/[^\w\-. ]/g, '_')}${ext}`;
        const fp = path.join(EXPORT_DIR, diskName);

        fs.writeFileSync(fp, file.buffer);
        try {
            const [id] = await knex('pdf_exports').insert({
                template_id: templateId,
                title,
                file_path: diskName,
                file_name: downloadName,
                file_size: file.size,
                doc_count: docCount,
                total_rows: totalRows,
                file_count: fileCount,
                created_by: req.user?.username || req.user?.name || 'System',
            }).returning('id');
            const exportId = typeof id === 'object' ? id.id : id;
            res.status(201).json({
                id: exportId,
                title,
                file_name: downloadName,
                file_size: file.size,
                doc_count: docCount,
                total_rows: totalRows,
                file_count: fileCount,
                template_id: templateId,
                created_at: new Date().toISOString(),
                downloadUrl: `/api/anydoc/templates/exports/file?id=${exportId}`,
            });    } catch (e) {
        // Insert gagal → hapus file yang barusan ditulis agar tidak jadi file yatim
        try { fs.unlinkSync(fp); } catch { /* best-effort */ }
        throw e;
    }
    } catch (e) {
        console.error('[AnyDoc] Simpan export gagal:', e);
        res.status(500).json({ error: e.message || 'Gagal menyimpan export.' });
    }
});

// GET /api/anydoc/templates/exports — daftar history export (filter templateId opsional)
// Privasi: hanya export milik user, kecuali admin melihat semua.
router.get('/templates/exports', async (req, res) => {
    try {
        const tplId = Number(req.query.templateId);
        const q = scopeByCreator(knex('pdf_exports'), req).orderBy('created_at', 'desc').limit(100);
        if (Number.isFinite(tplId) && tplId > 0) q.where('template_id', tplId);
        const rows = await q;
        const out = rows.map(r => ({
            ...r,
            downloadUrl: `/api/anydoc/templates/exports/file?id=${r.id}`,
            fileExists: fs.existsSync(path.join(EXPORT_DIR, path.basename(r.file_path))),
        }));
        res.json(out);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/anydoc/templates/exports/file?id=N — unduh ulang file xlsx tersimpan
router.get('/templates/exports/file', async (req, res) => {
    try {
        const id = Number(req.query.id);
        if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID export wajib diisi.' });
        const row = await knex('pdf_exports').where('id', id).first();
        if (!row) return res.status(404).json({ error: 'Export tidak ditemukan.' });
        if (!isOwnerOrAdmin(req, row.created_by)) return res.status(403).json({ error: 'Anda tidak berhak mengakses dokumen ini.' });
        const safe = path.basename(row.file_path);
        const fp = path.join(EXPORT_DIR, safe);
        if (!fs.existsSync(fp)) return res.status(404).json({ error: 'File export hilang dari disk.' });
        const fileExt = path.extname(row.file_path || '').toLowerCase();
        res.setHeader('Content-Type', fileExt === '.xls'
            ? 'application/vnd.ms-excel'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${String(row.file_name || safe).replace(/[\"\r\n]/g, '_')}"`);
        res.sendFile(fp);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/anydoc/templates/exports/:id — hapus satu history export (file + baris DB)
router.delete('/templates/exports/:id', async (req, res) => {
    try {
        const row = await knex('pdf_exports').where('id', Number(req.params.id)).first();
        if (!row) return res.status(404).json({ error: 'Export tidak ditemukan.' });
        if (!isOwnerOrAdmin(req, row.created_by)) return res.status(403).json({ error: 'Anda tidak berhak menghapus dokumen ini.' });
        try { fs.unlinkSync(path.join(EXPORT_DIR, path.basename(row.file_path))); } catch { /* best-effort */ }
        await knex('pdf_exports').where('id', row.id).del();
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/anydoc/templates/:id
router.get('/templates/:id', async (req, res) => {
    try {
        const t = await getTemplateWithFields(req.params.id);
        if (!t) return res.status(404).json({ error: 'Template tidak ditemukan.' });
        res.json(t);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// PUT /api/anydoc/templates/:id — update template + ganti fields
router.put('/templates/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const t = await knex('pdf_mapping_templates').where('id', id).first();
        if (!t) return res.status(404).json({ error: 'Template tidak ditemukan.' });
        if (!isOwnerOrAdmin(req, t.created_by)) return res.status(403).json({ error: 'Hanya pembuat template (atau admin) yang dapat mengubah template ini.' });
        const b = req.body || {};
        const upd = { updated_at: knex.fn.now() };
        if (b.name !== undefined) upd.name = String(b.name).trim() || t.name;
        if (b.doc_type !== undefined) upd.doc_type = String(b.doc_type).trim() || null;
        if (b.description !== undefined) upd.description = String(b.description).trim() || null;
        if (b.split_pattern !== undefined) upd.split_pattern = String(b.split_pattern).trim() || null;
        if (b.split_key !== undefined) upd.split_key = String(b.split_key).trim() || null;
        if (b.sample_files !== undefined) upd.sample_files = normalizeSampleFiles(b.sample_files).length ? JSON.stringify(normalizeSampleFiles(b.sample_files)) : null;
        await knex('pdf_mapping_templates').where('id', id).update(upd);

        if (b.fields !== undefined) {
            const fields = parseFields(b.fields);
            await knex('pdf_mapping_fields').where('template_id', id).del();
            if (fields.length) {
                await knex('pdf_mapping_fields').insert(fields.map((f, i) => ({
                    ...f, template_id: id, sort_order: f.sort_order || i,
                })));
            }
        }
        res.json(await getTemplateWithFields(id));
    } catch (e) {
        res.status(500).json({ error: e.message || 'Gagal update template.' });
    }
});

// DELETE /api/anydoc/templates/:id
router.delete('/templates/:id', async (req, res) => {
    try {
        const t = await knex('pdf_mapping_templates').where('id', req.params.id).first();
        if (!t) return res.status(404).json({ error: 'Template tidak ditemukan.' });
        if (!isOwnerOrAdmin(req, t.created_by)) return res.status(403).json({ error: 'Hanya pembuat template (atau admin) yang dapat menghapus template ini.' });
        for (const s of normalizeSampleFiles(t.sample_files)) {
            try { fs.unlinkSync(path.join(TEMPLATE_DIR, s.path)); } catch { /* best-effort */ }
        }
        await knex('pdf_mapping_templates').where('id', req.params.id).del();
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Proses 1 file: simpan ke arsip, terapkan template, simpan riwayat monitoring (upsert per file+periode).
// Dipakai oleh /templates/extract (upload) dan /templates/extract-stored (dari arsip).
async function processOneFile({ buffer, originalname, chosen, enriched, fieldsByTpl, user, archive }) {
    try {
        let tpl = chosen;
        if (!tpl) {
            const pages = await extractPdfItems(buffer);
            const pl = groupLines(pages);
            const det = await detectTemplate(pl, enriched);
            tpl = det.template || null;
        }
        if (!tpl) {
            return { filename: originalname, success: false, error: 'Tidak ada template yang cocok. Buat template dari sampel terlebih dahulu.' };
        }
        const fields = fieldsByTpl.get(Number(tpl.id)) || [];
        const r = await applyTemplate(buffer, fields, { splitPattern: tpl.split_pattern, splitKey: tpl.split_key });
        const monitoring = computeMonitoring(fields, r);

        // Simpan PDF asli ke arsip (sekali per file) agar bisa diunduh / diekstrak ulang
        let filePath = archive?.file_path || null;
        let fileSize = archive?.file_size || buffer.length;
        if (!filePath) {
            try {
                const safe = originalname.replace(/[^\w.\- ]/g, '_');
                filePath = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${safe}`;
                fs.writeFileSync(path.join(ARCHIVE_DIR, filePath), buffer);
            } catch (e) {
                console.warn(`[AnyDoc] Simpan arsip gagal: ${e.message}`);
                filePath = null;
            }
        }

        // Simpan riwayat utk monitoring bulanan — upsert per (template, filename, periode)
        // supaya ekstrak ulang tidak menumpuk baris duplikat di panel monitoring.
        try {
            const period = extractPeriod(r.documents?.[0]?.data || {}, originalname);
            const payload = {
                pages: r.pages,
                doc_count: monitoring.doc_count,
                total_rows: monitoring.total_rows,
                avg_confidence: monitoring.avg_confidence,
                fields_found: monitoring.fields_found,
                fields_total: monitoring.fields_total,
                table_found: monitoring.table_found,
                layout_changed: monitoring.layout_changed,
                warning: monitoring.warning,
                file_size: fileSize,
                created_by: user?.username || user?.name || 'System',
            };
            // Jangan pernah menimpa file_path lama dengan null (arsip gagal tulis) —
            // file yang sudah tersimpan tetap dipakai.
            if (filePath) payload.file_path = filePath;
            const existing = await knex('pdf_extractions')
                .where({ template_id: tpl.id, filename: originalname, period })
                .first();
            if (existing) {
                const canTouch = isOwnerOrAdmin({ user: user }, existing.created_by);
                // Hapus file arsip lama bila digantikan oleh konten berbeda (hindari file yatim)
                if (canTouch && filePath && existing.file_path && existing.file_path !== filePath) {
                    try { fs.unlinkSync(path.join(ARCHIVE_DIR, path.basename(existing.file_path))); } catch { /* best-effort */ }
                }
                // JANGAN timpa created_by: baris yang sudah ada tetap milik pembuat aslinya
                // (mis. file dengan nama sama diekstrak ulang oleh user lain).
                delete payload.created_by;
                // Jika bukan pemilik asli, jangan ganti file arsip miliknya
                if (!canTouch) delete payload.file_path;
                await knex('pdf_extractions').where('id', existing.id).update(payload);
            } else {
                await knex('pdf_extractions').insert({ template_id: tpl.id, filename: originalname, period, ...payload });
            }
        } catch (e) {
            console.warn(`[AnyDoc] Simpan riwayat ekstraksi gagal: ${e.message}`);
        }

        return {
            filename: originalname, success: true,
            data: r.data, items: r.items, pages: r.pages,
            regions: r.regions || [], table: r.table || null,
            documents: r.documents || [], split: !!r.split,
            monitoring,
            template: { id: tpl.id, name: tpl.name },
        };
    } catch (e) {
        return { filename: originalname, success: false, error: e.message || 'Gagal mengekstrak.' };
    }
}

// Muat semua template + fields (dipakai extract & extract-stored)
async function loadTemplatesWithFields() {
    const templates = await knex('pdf_mapping_templates').orderBy('id', 'asc');
    const fieldsByTpl = new Map();
    for (const t of templates) {
        const fields = await knex('pdf_mapping_fields').where('template_id', t.id).orderBy('sort_order', 'asc');
        fieldsByTpl.set(t.id, fields);
    }
    return { templates, fieldsByTpl, enriched: templates.map(t => ({ ...t, fields: fieldsByTpl.get(t.id) || [] })) };
}

// POST /api/anydoc/templates/extract — terapkan template ke PDF asli (batch)
// body: files[] + templateId (angka) ATAU auto=true → deteksi otomatis template terbaik
router.post('/templates/extract', tplUploadAny, async (req, res) => {
    try {
        const files = req.files || [];
        if (!files.length) return res.status(400).json({ error: 'Upload minimal 1 PDF.' });

        const { enriched, fieldsByTpl } = await loadTemplatesWithFields();
        const explicitId = req.body.templateId ? Number(req.body.templateId) : null;
        const chosen = explicitId ? (enriched.find(t => Number(t.id) === explicitId) || null) : null;

        const results = [];
        for (const f of files) {
            results.push(await processOneFile({
                buffer: f.buffer, originalname: f.originalname,
                chosen, enriched, fieldsByTpl, user: req.user,
            }));
        }
        const firstOk = results.find(r => r.success && r.template);
        res.json({ success: true, results, auto: !explicitId, usedTemplate: chosen ? { id: chosen.id, name: chosen.name } : (firstOk ? firstOk.template : null) });
    } catch (e) {
        console.error('[AnyDoc] Template extract error:', e);
        res.status(500).json({ error: e.message || 'Gagal mengekstrak.' });
    }
});

// ── Ekstraksi data PDF → Excel (batch, via LLM) ───────────────────────────────
const extractUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024, files: 20 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, ['.pdf', '.docx', '.txt'].includes(ext));
    },
});

// POST /api/anydoc/extract — upload banyak PDF sekaligus, ekstrak field sesuai mapping, kembalikan JSON per file.
// Body (multipart): files[] (pdf/docx/txt), fields (JSON array nama kolom), itemFields (JSON array kolom item).
router.post('/extract', extractUpload.array('files', 20), async (req, res) => {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'Pilih minimal 1 file PDF.' });

    let fields = [], itemFields = [];
    try { fields = JSON.parse(req.body.fields || '[]'); } catch { fields = []; }
    try { itemFields = JSON.parse(req.body.itemFields || '[]'); } catch { itemFields = []; }
    fields = (Array.isArray(fields) ? fields : []).map(f => String(f).trim()).filter(Boolean);
    itemFields = (Array.isArray(itemFields) ? itemFields : []).map(f => String(f).trim()).filter(Boolean);

    const results = [];
    const CONCURRENCY = 3; // batasi beban LLM
    try {
        for (let i = 0; i < files.length; i += CONCURRENCY) {
            const batch = files.slice(i, i + CONCURRENCY);
            const batchResults = await Promise.all(batch.map(async (f) => {
                const ext = path.extname(f.originalname).toLowerCase();
                const fileType = ext === '.pdf' ? 'pdf' : ext === '.docx' ? 'docx' : 'txt';
                try {
                    const text = await extractDocumentText(f.buffer, fileType);
                    if (!text || text.length < 10) {
                        return { filename: f.originalname, success: false, error: 'Tidak ada teks yang bisa diekstrak. Untuk PDF hasil scan, OCR akan dicoba otomatis — pastikan halaman cukup jelas.' };
                    }
                    const { data, items } = await extractFieldsFromText(text, fields, itemFields);
                    return { filename: f.originalname, success: true, data, items, charCount: text.length };
                } catch (e) {
                    return { filename: f.originalname, success: false, error: e.message || 'Gagal mengekstrak file ini.' };
                }
            }));
            results.push(...batchResults);
        }
        res.json({
            success: true,
            fields,
            itemFields,
            results,
            total: results.length,
            ok: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
        });
    } catch (e) {
        console.error('[AnyDoc] Extract error:', e);
        res.status(500).json({ error: e.message || 'Gagal mengekstrak dokumen.' });
    }
});

// GET /api/anydoc/history — recent conversion results (metadata only)
// Privasi: hanya file milik user yang tampil, kecuali admin melihat semua.
router.get('/history', async (req, res) => {
    try {
        const files = fs.readdirSync(UPLOADS_DIR).filter(f => f.startsWith('anydoc-') && f.endsWith('.md'));
        const isAdminUser = isAdmin(req);
        const me = req.user?.username || req.user?.name;
        const items = files
            .map(f => {
                // format: anydoc-<owner>-<ts>-<rand>.md (file lama tanpa owner → hanya admin)
                const m = f.match(/^anydoc-([a-zA-Z0-9_-]{1,40})-(\d+)-([a-z0-9]+)\.md$/);
                const owner = m ? m[1] : null;
                if (!isAdminUser && owner !== me) return null;
                const st = fs.statSync(path.join(UPLOADS_DIR, f));
                return {
                    name: f.replace(/^anydoc-/, '').replace(/\.md$/, ''),
                    filename: f,
                    size: st.size,
                    modifiedAt: st.mtime.toISOString(),
                    url: `/uploads/${f}`,
                    created_by: owner,
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
            .slice(0, 20);
        res.json(items);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
