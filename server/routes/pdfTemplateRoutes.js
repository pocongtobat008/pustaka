import express from 'express';
import { knex } from '../db.js';
import {
    getActiveTemplate,
    renderInvoicePdf,
    buildSampleContext,
    buildContext,
    buildPdfShell,
    compileHtml,
    getDefaultTemplate,
} from '../services/pdfTemplateService.js';

const router = express.Router();

const getAuthUser = (req) => req.user || req.session?.user || null;

router.use((req, res, next) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.authUser = user;
    next();
});

const isAdmin = (user) => {
    const role = String(user?.role || '').toLowerCase();
    return role === 'admin' || role === 'superadmin';
};

const username = (req) => req.authUser?.username || req.authUser?.name || 'unknown';

// GET /api/pdf-templates/sample — data contoh untuk preview designer (harus sebelum /:id)
// GET /api/pdf-templates/recent-invoices — daftar invoice untuk preview data asli (harus sebelum /:id)
router.get('/recent-invoices', async (req, res) => {
    try {
        const rows = await knex('proforma_invoices')
            .select('id', 'proforma_no', 'dealer_name', 'created_at')
            .orderBy('created_at', 'desc')
            .limit(30);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengambil daftar invoice', details: [err.message] });
    }
});

// GET /api/pdf-templates/sample — data contoh untuk preview designer (harus sebelum /:id)
router.get('/sample', async (req, res) => {
    try {
        const docType = req.query.doc_type || 'proforma';
        const def = getDefaultTemplate(docType);
        res.json({
            context: buildSampleContext(),
            html: def.html,
            css: def.css,
        });
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengambil data contoh', details: [err.message] });
    }
});

// GET /api/pdf-templates/preview/:invoiceId — render PDF data asli (harus sebelum /:id)
router.get('/preview/:invoiceId', async (req, res) => {
    try {
        const docType = req.query.doc_type || 'proforma';
        const buf = await renderInvoicePdf(req.params.invoiceId, docType);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="preview_template.pdf"`);
        res.send(buf);
    } catch (err) {
        if (err.message === 'TIDAK_ADA_TEMPLATE') {
            return res.status(404).json({ error: 'Belum ada template aktif untuk tipe ini' });
        }
        res.status(500).json({ error: 'Gagal render preview', details: [err.message] });
    }
});

// GET /api/pdf-templates — daftar semua template
router.get('/', async (req, res) => {
    try {
        const rows = await knex('pdf_templates').orderBy('doc_type', 'asc').orderBy('id', 'desc');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengambil template', details: [err.message] });
    }
});

// POST /api/pdf-templates — buat template baru
router.post('/', async (req, res) => {
    try {
        if (!isAdmin(req.authUser)) return res.status(403).json({ error: 'Hanya admin yang dapat mengelola template' });
        const { doc_type, name, html, css, is_active } = req.body || {};
        if (!name || !String(name).trim()) return res.status(400).json({ error: 'Nama template wajib diisi' });
        const docType = doc_type || 'proforma';
        let active = !!is_active;
        const trx = await knex.transaction();
        try {
            if (active) {
                await trx('pdf_templates').where('doc_type', docType).update({ is_active: false, updated_at: new Date() });
            } else {
                const existingActive = await trx('pdf_templates').where('doc_type', docType).where('is_active', true).first();
                if (!existingActive) active = true;
            }
            const [{ id }] = await trx('pdf_templates').insert({
                doc_type: docType,
                name: String(name).trim(),
                html: html || '',
                css: css || '',
                is_active: active,
                updated_by: username(req),
                created_at: new Date(),
                updated_at: new Date(),
            }).returning('id');
            await trx.commit();
            const row = await knex('pdf_templates').where('id', id).first();
            res.status(201).json(row);
        } catch (e) {
            await trx.rollback();
            throw e;
        }
    } catch (err) {
        res.status(500).json({ error: 'Gagal membuat template', details: [err.message] });
    }
});

// PUT /api/pdf-templates/:id — update
router.put('/:id', async (req, res) => {
    try {
        if (!isAdmin(req.authUser)) return res.status(403).json({ error: 'Hanya admin yang dapat mengelola template' });
        const { id } = req.params;
        const existing = await knex('pdf_templates').where('id', id).first();
        if (!existing) return res.status(404).json({ error: 'Template tidak ditemukan' });
        const { name, html, css, is_active } = req.body || {};
        let active = is_active !== undefined ? !!is_active : existing.is_active;
        const trx = await knex.transaction();
        try {
            if (active && !existing.is_active) {
                await trx('pdf_templates').where('doc_type', existing.doc_type).update({ is_active: false, updated_at: new Date() });
            }
            await trx('pdf_templates').where('id', id).update({
                name: name !== undefined ? String(name).trim() : existing.name,
                html: html !== undefined ? html : existing.html,
                css: css !== undefined ? css : existing.css,
                is_active: active,
                updated_by: username(req),
                updated_at: new Date(),
            });
            await trx.commit();
        } catch (e) {
            await trx.rollback();
            throw e;
        }
        const row = await knex('pdf_templates').where('id', id).first();
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: 'Gagal update template', details: [err.message] });
    }
});

// POST /api/pdf-templates/:id/activate — aktifkan satu template (nonaktifkan lainnya)
router.post('/:id/activate', async (req, res) => {
    try {
        if (!isAdmin(req.authUser)) return res.status(403).json({ error: 'Hanya admin yang dapat mengelola template' });
        const { id } = req.params;
        const existing = await knex('pdf_templates').where('id', id).first();
        if (!existing) return res.status(404).json({ error: 'Template tidak ditemukan' });
        const trx = await knex.transaction();
        try {
            await trx('pdf_templates').where('doc_type', existing.doc_type).update({ is_active: false, updated_at: new Date() });
            await trx('pdf_templates').where('id', id).update({ is_active: true, updated_by: username(req), updated_at: new Date() });
            await trx.commit();
        } catch (e) {
            await trx.rollback();
            throw e;
        }
        const row = await knex('pdf_templates').where('id', id).first();
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengaktifkan template', details: [err.message] });
    }
});

// DELETE /api/pdf-templates/:id
router.delete('/:id', async (req, res) => {
    try {
        if (!isAdmin(req.authUser)) return res.status(403).json({ error: 'Hanya admin yang dapat mengelola template' });
        const { id } = req.params;
        const existing = await knex('pdf_templates').where('id', id).first();
        if (!existing) return res.status(404).json({ error: 'Template tidak ditemukan' });
        await knex('pdf_templates').where('id', id).del();
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Gagal menghapus template', details: [err.message] });
    }
});

// POST /api/pdf-templates/test — render HTML+CSS yang sedang diedit (untuk preview server-side, opsional)
router.post('/test', async (req, res) => {
    try {
        if (!isAdmin(req.authUser)) return res.status(403).json({ error: 'Hanya admin yang dapat mengelola template' });
        const { html, css, context } = req.body || {};
        const data = context || buildSampleContext();
        const body = compileHtml(html, data);
        const shell = buildPdfShell(body, css);
        const { renderHtmlToPdf } = await import('../services/pdfTemplateService.js');
        const buf = await renderHtmlToPdf(shell);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="test_template.pdf"`);
        res.send(buf);
    } catch (err) {
        res.status(500).json({ error: 'Gagal render test', details: [err.message] });
    }
});

// POST /api/pdf-templates/test/:invoiceId — render HTML+CSS draft dengan data invoice ASLI
router.post('/test/:invoiceId', async (req, res) => {
    try {
        if (!isAdmin(req.authUser)) return res.status(403).json({ error: 'Hanya admin yang dapat mengelola template' });
        const { html, css } = req.body || {};
        const invoice = await knex('proforma_invoices').where('id', req.params.invoiceId).first();
        if (!invoice) return res.status(404).json({ error: 'Invoice tidak ditemukan' });
        const items = await knex('proforma_invoice_items').where('invoice_id', invoice.id).orderBy('id', 'asc');
        const data = buildContext(invoice, items);
        const body = compileHtml(html, data);
        const shell = buildPdfShell(body, css);
        const { renderHtmlToPdf } = await import('../services/pdfTemplateService.js');
        const buf = await renderHtmlToPdf(shell);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="test_template_real.pdf"`);
        res.send(buf);
    } catch (err) {
        res.status(500).json({ error: 'Gagal render test data asli', details: [err.message] });
    }
});

export default router;
