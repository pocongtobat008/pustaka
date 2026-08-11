import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { knex } from '../db.js';

const router = express.Router();

// Service Flask PDFtoword (romizone/PDFtoword) — berjalan via pm2 di port 5000
const PDF_TOOLS_BASE = process.env.PDF_TOOLS_BASE || 'http://127.0.0.1:5000';

// Folder riwayat hasil AI PDF Tools
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOL_HISTORY_DIR = path.join(__dirname, '../../uploads/pdf-tool-history');
if (!fs.existsSync(TOOL_HISTORY_DIR)) fs.mkdirSync(TOOL_HISTORY_DIR, { recursive: true });

// Terima upload apa pun di memory (file PDF/Word) lalu teruskan ke Flask
// Limit 50MB — sama dengan MAX_CONTENT_LENGTH Flask (50 MB)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Error handling upload (multer) — balas JSON, bukan HTML 500 bawaan Express
const uploadAny = (req, res, next) => {
    upload.any()(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ error: 'File terlalu besar. Maksimum 50 MB per file.' });
            }
            return res.status(400).json({ error: `Upload gagal: ${err.message}` });
        }
        next();
    });
};

const TOOL_MAP = {
    convert: 'convert',
    compress: 'compress',
    ocr: 'ocr',
    unlock: 'unlock',
    merge: 'merge',
    split: 'split',
};

// Health check — cek service Flask hidup atau tidak
router.get('/pdf-tools/health', async (req, res) => {
    try {
        const r = await fetch(`${PDF_TOOLS_BASE}/`, { signal: AbortSignal.timeout(4000) });
        res.json({ ok: r.ok, status: r.status });
    } catch (e) {
        res.status(503).json({ ok: false, error: 'Service AI PDF Tools tidak aktif.', detail: e.message });
    }
});

// ── Daftar bahasa OCR: SEMUA bahasa tesseract (nama lengkap) + status terinstall ──
const OCR_LANGS = {
    afr: 'Afrikaans', amh: 'Amharik', ara: 'Arab', asm: 'Assam', aze: 'Azeri', 'aze-cyrl': 'Azeri (Kiril)',
    bel: 'Belarusia', ben: 'Bengali', bod: 'Tibet', bos: 'Bosnia', bre: 'Breton', bul: 'Bulgaria',
    cat: 'Katalan', ceb: 'Cebuano', ces: 'Ceko', 'chi-sim': 'Cina Sederhana', 'chi-sim-vert': 'Cina Sederhana (Vertikal)',
    'chi-tra': 'Cina Tradisional', 'chi-tra-vert': 'Cina Tradisional (Vertikal)', chr: 'Cherokee', cos: 'Korsika',
    cym: 'Wales', dan: 'Denmark', deu: 'Jerman', div: 'Dhivehi', dzo: 'Dzongkha', ell: 'Yunani',
    eng: 'Inggris', enm: 'Inggris Kuno', epo: 'Esperanto', est: 'Estonia', eus: 'Basque', fao: 'Faroese',
    fas: 'Persia', fil: 'Filipino', fin: 'Finlandia', fra: 'Prancis', frk: 'Frankish', frm: 'Prancis Abad Pertengahan',
    gle: 'Irlandia', glg: 'Galicia', grc: 'Yunani Kuno', guj: 'Gujarati', hat: 'Kreol Haiti', heb: 'Ibrani',
    hin: 'Hindi', hrv: 'Kroasia', hun: 'Hungaria', hye: 'Armenia', iku: 'Inuktitut', ind: 'Indonesia',
    isl: 'Islandia', ita: 'Italia', 'ita-old': 'Italia Kuno', jav: 'Jawa', jpn: 'Jepang', kan: 'Kannada',
    kat: 'Georgia', 'kat-old': 'Georgia Kuno', kaz: 'Kazakh', khm: 'Khmer', kir: 'Kirgiz', kmr: 'Kurmanji',
    kor: 'Korea', 'kor-vert': 'Korea (Vertikal)', lao: 'Lao', lat: 'Latin', lav: 'Latvia', lit: 'Lituania',
    ltz: 'Luksemburg', mal: 'Malayalam', mar: 'Marathi', mkd: 'Makedonia', mlt: 'Malta', mon: 'Mongolia',
    mri: 'Maori', msa: 'Melayu', mya: 'Myanmar', nep: 'Nepal', nld: 'Belanda', nor: 'Norwegia',
    oci: 'Oksitan', ori: 'Oriya', pan: 'Punjabi', pol: 'Polandia', por: 'Portugis', pus: 'Pashto',
    que: 'Quechua', ron: 'Rumania', rus: 'Rusia', san: 'Sanskerta', sin: 'Sinhala', slk: 'Slovakia',
    slv: 'Slovenia', snd: 'Sindhi', spa: 'Spanyol', 'spa-old': 'Spanyol Kuno', sqi: 'Albania',
    srp: 'Serbia', 'srp-latn': 'Serbia (Latin)', swa: 'Swahili', swe: 'Swedia', syr: 'Syriak',
    tam: 'Tamil', tel: 'Telugu', tgk: 'Tajik', tgl: 'Tagalog', tha: 'Thailand', tir: 'Tigrinya',
    tur: 'Turki', uig: 'Uyghur', ukr: 'Ukraina', urd: 'Urdu', uzb: 'Uzbek', 'uzb-cyrl': 'Uzbek (Kiril)',
    vie: 'Vietnam', yid: 'Yiddish', zlm: 'Melayu (Latin)',
};

// Cache hasil `tesseract --list-langs` (60 detik) agar tidak spawn subproses tiap request
let _langCache = { ts: 0, installed: [] };
const getInstalledLangs = () => {
    const now = Date.now();
    if (_langCache.ts && now - _langCache.ts < 60000) return _langCache.installed;
    let installed = [];
    try {
        const out = execSync('tesseract --list-langs 2>&1', { timeout: 10000 }).toString();
        installed = out.split('\n')
            .map(l => l.trim())
            .filter(l => /^[a-z_]+$/.test(l)); // hanya kode bahasa (buang baris header jalur)
    } catch { /* tesseract tidak tersedia */ }
    _langCache = { ts: now, installed };
    return installed;
};

router.get('/pdf-tools/languages', async (req, res) => {
    try {
        const installed = getInstalledLangs();
        const installedSet = new Set(installed);

        const all = Object.entries(OCR_LANGS).map(([code, name]) => ({
            code,
            name,
            installed: installedSet.has(code),
        }));
        // Bahasa terinstall yang tidak ada di daftar (mis. osd) — masukkan tapi tetap
        // bisa dipakai; osd memang bukan bahasa teks jadi ditandai apa adanya
        installed.forEach(code => {
            if (!OCR_LANGS[code] && code !== 'osd') all.push({ code, name: code, installed: true });
        });

        res.json({ installed: installed.filter(c => c !== 'osd'), all, total: all.length });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/pdf-tools/history — simpan hasil (file + metadata) ke riwayat
// NOTE: diletakkan SEBELUM POST /pdf-tools/:tool agar 'history' tidak tertangkap sebagai nama tool.
router.post('/pdf-tools/history', uploadAny, async (req, res) => {
    try {
        const file = (req.files || [])[0];
        if (!file) return res.status(400).json({ error: 'File hasil wajib diunggah.' });
        const tool = String(req.body.tool || '').replace(/[^a-z]/g, '');
        if (!TOOL_MAP[tool] || tool === 'ocr') return res.status(400).json({ error: 'Tool tidak valid untuk riwayat.' });

        const title = String(req.body.title || file.originalname || 'Hasil PDF Tools').trim().slice(0, 255);
        const diskName = `tool-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${path.basename(file.originalname || 'hasil')}`;
        const fp = path.join(TOOL_HISTORY_DIR, diskName);
        fs.writeFileSync(fp, file.buffer);

        try {
            const [id] = await knex('pdf_tool_history').insert({
                tool,
                title,
                file_path: diskName,
                file_name: path.basename(file.originalname || title),
                file_size: file.size,
                original_size: Number(req.body.originalSize) || 0,
                created_by: req.user?.username || req.user?.name || 'System',
            }).returning('id');
            const histId = typeof id === 'object' ? id.id : id;
            res.status(201).json({
                id: histId, tool, title,
                file_name: path.basename(file.originalname || title),
                file_size: file.size,
                created_at: new Date().toISOString(),
                downloadUrl: `/api/pdf-tools/history/file?id=${histId}`,
            });
        } catch (e) {
            try { fs.unlinkSync(fp); } catch { /* best-effort */ }
            throw e;
        }
    } catch (e) {
        console.error('[PdfTools] Simpan riwayat gagal:', e.message);
        res.status(500).json({ error: e.message || 'Gagal menyimpan riwayat.' });
    }
});

// Proxy semua tool: /api/pdf-tools/convert, /compress, /ocr, /unlock, /merge, /split
router.post('/pdf-tools/:tool', uploadAny, async (req, res) => {
    const tool = TOOL_MAP[req.params.tool];
    if (!tool) return res.status(400).json({ error: `Tool tidak dikenal: ${req.params.tool}` });

    try {
        // Bangun FormData untuk diteruskan ke Flask
        const fd = new FormData();
        const files = req.files || [];
        if (tool === 'merge') {
            // merge: banyak file dengan field 'files'
            files.forEach(f => fd.append('files', new Blob([f.buffer], { type: f.mimetype || 'application/pdf' }), f.originalname));
        } else {
            const f = files[0];
            if (!f) return res.status(400).json({ error: 'File wajib diunggah.' });
            fd.append('file', new Blob([f.buffer], { type: f.mimetype || 'application/pdf' }), f.originalname);
        }
        // Form fields (quality, language, password, mode, pages)
        Object.entries(req.body || {}).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, String(v)); });

        const upstream = await fetch(`${PDF_TOOLS_BASE}/api/${tool}`, { method: 'POST', body: fd, signal: AbortSignal.timeout(300000) });

        if (!upstream.ok) {
            let msg = `Service gagal (${upstream.status}).`;
            try { const j = await upstream.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
            return res.status(upstream.status === 413 ? 413 : 502).json({ error: msg });
        }

        // OCR → JSON; sisanya → file biner
        if (tool === 'ocr') {
            const j = await upstream.json();
            return res.json(j);
        }

        const buf = Buffer.from(await upstream.arrayBuffer());
        const cd = upstream.headers.get('content-disposition') || '';
        const ctype = upstream.headers.get('content-type') || 'application/octet-stream';
        res.setHeader('Content-Type', ctype);
        if (cd) res.setHeader('Content-Disposition', cd);
        // Header info kompresi (ukuran asli vs hasil)
        ['X-Original-Size', 'X-Compressed-Size'].forEach(h => {
            const v = upstream.headers.get(h);
            if (v) res.setHeader(h, v);
        });
        res.send(buf);
    } catch (e) {
        console.error('[PdfTools] Proxy error:', e.message);
        res.status(502).json({ error: `Gagal menghubungi service AI PDF Tools: ${e.message}` });
    }
});

// ── Riwayat hasil AI PDF Tools: simpan agar bisa diunduh ulang tanpa proses ulang ──

// GET /api/pdf-tools/history — daftar riwayat (desc)
router.get('/pdf-tools/history', async (req, res) => {
    try {
        const rows = await knex('pdf_tool_history').orderBy('created_at', 'desc').limit(100);
        const out = rows.map(r => ({
            ...r,
            downloadUrl: `/api/pdf-tools/history/file?id=${r.id}`,
            fileExists: fs.existsSync(path.join(TOOL_HISTORY_DIR, path.basename(r.file_path))),
        }));
        res.json(out);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/pdf-tools/history/file?id=N — unduh ulang hasil tersimpan
router.get('/pdf-tools/history/file', async (req, res) => {
    try {
        const id = Number(req.query.id);
        if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID wajib diisi.' });
        const row = await knex('pdf_tool_history').where('id', id).first();
        if (!row) return res.status(404).json({ error: 'Riwayat tidak ditemukan.' });
        const safe = path.basename(row.file_path);
        const fp = path.join(TOOL_HISTORY_DIR, safe);
        if (!fs.existsSync(fp)) return res.status(404).json({ error: 'File hilang dari disk.' });
        const ext = path.extname(row.file_name || safe).toLowerCase();
        const mime = ext === '.docx'
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : ext === '.zip' ? 'application/zip' : 'application/pdf';
        res.setHeader('Content-Type', mime);
        res.setHeader('Content-Disposition', `attachment; filename="${String(row.file_name || safe).replace(/[\"\r\n]/g, '_')}"`);
        res.sendFile(fp);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/pdf-tools/history/:id — hapus riwayat (file + baris)
router.delete('/pdf-tools/history/:id', async (req, res) => {
    try {
        const row = await knex('pdf_tool_history').where('id', Number(req.params.id)).first();
        if (!row) return res.status(404).json({ error: 'Riwayat tidak ditemukan.' });
        try { fs.unlinkSync(path.join(TOOL_HISTORY_DIR, path.basename(row.file_path))); } catch { /* best-effort */ }
        await knex('pdf_tool_history').where('id', row.id).del();
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
