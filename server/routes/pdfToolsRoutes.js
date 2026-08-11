import express from 'express';
import multer from 'multer';

const router = express.Router();

// Service Flask PDFtoword (romizone/PDFtoword) — berjalan via pm2 di port 5000
const PDF_TOOLS_BASE = process.env.PDF_TOOLS_BASE || 'http://127.0.0.1:5000';

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

export default router;
