import express from 'express';
import { knex } from '../db.js';
import { upload } from '../config/upload.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as XLSX from 'xlsx';
import { sendMail, isMailConfigured, getMailInfo } from '../services/mailer.js';
import { notifyFlowEvent, FLOW_EVENTS, EMAIL_TOKENS, getEmailTemplate, renderTemplate, buildEmailVars, buildDefaultBody, DEFAULT_EMAIL_SUBJECTS, resolveAssignees, resolveRecipients, parseCustomEmails } from '../services/flowService.js';
import { systemLog } from '../utils/logger.js';

const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

// Hitung nomor suffix batal unik: {base}_batal001, _batal002, dst. (no_po / proforma_no tidak boleh sama, kecuali tipe PP)
async function nextBatalNumber(col, base, fallback) {
    const safeBase = String(base || fallback).replace(/[%_\\]/g, (m) => '\\' + m);
    const rows = await knex('proforma_invoices').where(col, 'like', `${safeBase}_batal%`).select(col);
    let maxSeq = 0;
    (rows || []).forEach(r => {
        const m = String(r[col] || '').match(/_batal(\d+)$/);
        if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
    });
    return `${base || fallback}_batal${String(maxSeq + 1).padStart(3, '0')}`;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const getAuthUser = (req) => req.user || req.session?.user || null;

router.use((req, res, next) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.authUser = user;
    next();
});

const getUsername = (req) => req.authUser?.username || req.authUser?.name || 'unknown';

const isSuper = (user) => {
    if (!user) return false;
    const role = String(user.role || '').toLowerCase();
    return role === 'admin' || role === 'superadmin';
};

const INVOICE_PERM_FIELDS = [
    // Tab visibility
    'can_view_dashboard', 'can_view_invoice', 'can_view_proforma', 'can_view_tax',
    'can_view_dealer', 'can_view_barang', 'can_view_rule', 'can_view_flow',
    // Actions
    'can_create', 'can_edit', 'can_delete', 'can_cancel', 'can_proforma',
    'can_approve', 'can_sendback', 'can_reject',
    'can_tax_request', 'can_tax', 'can_tax_sendback', 'can_settle',
    'can_manage_master', 'can_manage_rule', 'can_print',
];

async function getUserInvoicePerms(user) {
    const defaults = {};
    for (const f of INVOICE_PERM_FIELDS) defaults[f] = true;
    if (!user) return defaults;
    if (isSuper(user)) return defaults;
    try {
        const rules = await knex('invoice_rules')
            .where('is_active', true)
            // Deterministic precedence: division → role → user (lebih spesifik menang)
            .orderByRaw(`
                CASE target_type WHEN 'user' THEN 3 WHEN 'role' THEN 2 WHEN 'division' THEN 1 ELSE 0 END ASC,
                id ASC
            `);
        if (!rules.length) return defaults;
        const merged = { ...defaults };
        for (const r of rules) {
            let match = false;
            if (r.target_type === 'user' && r.target_value === user.username) match = true;
            if (r.target_type === 'role' && r.target_value === String(user.role || '').trim()) match = true;
            if (r.target_type === 'division' && r.target_value === String(user.department || user.division || '').trim()) match = true;
            if (match) {
                for (const f of INVOICE_PERM_FIELDS) {
                    if (typeof r[f] === 'boolean') merged[f] = r[f];
                }
            }
        }
        return merged;
    } catch {
        return defaults;
    }
}

function parseJsonArraySafeStr(str, fallback = []) {
    if (!str) return fallback;
    if (Array.isArray(str)) return str;
    try { return JSON.parse(str); } catch { return fallback; }
}

const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

// PP (Partial Payment) group: satu kesatuan DP + semua pelunasan.
async function getPpGroupInfo(knexInstance, rootId, excludeId = null) {
    const root = await knexInstance('proforma_invoices').where('id', rootId).whereNot('status', 'cancelled').first();
    if (!root || root.tipe !== 'PP' || root.pp_type === 'pelunasan') return null;
    const full = round2(root.total_invoice);
    const dpPaid = round2(root.uang_masuk);
    const pelunasanRows = await knexInstance('proforma_invoices')
        .where('pelunasan_of_id', rootId)
        .whereNot('status', 'cancelled')
        .orderBy('id', 'asc');
    const paid = round2(pelunasanRows
        .filter(x => !excludeId || Number(x.id) !== Number(excludeId))
        .reduce((s, x) => s + round2(x.uang_masuk), 0));
    return { root, full, dpPaid, paid, remaining: round2(full - dpPaid - paid) };
}

// Cek konflik No. PO: no_po tidak boleh sama antar invoice, KECUALI sesama anggota
// satu grup PP (DP + pelunasan-nya memakai 1 no_po yang sama).
// - excludeId: id invoice yang sedang di-update (diizinkan bertahan).
// - groupId: id DP yang menjadi root grup PP (diizinkan berbagi no_po + semua pelunasan miliknya).
async function findNoPoConflict(knexInstance, noPo, { excludeId = null, groupId = null } = {}) {
    const po = String(noPo || '').trim();
    if (!po) return null;
    const rows = await knexInstance('proforma_invoices')
        .where('no_po', po)
        .whereNotIn('status', ['cancelled', 'rejected'])
        .select('id', 'tipe', 'pp_type', 'pelunasan_of_id', 'dealer_name');
    const allowed = new Set();
    if (excludeId) allowed.add(Number(excludeId));
    if (groupId) {
        const dpId = Number(groupId);
        allowed.add(dpId);
        const sibs = await knexInstance('proforma_invoices').where('pelunasan_of_id', dpId).select('id');
        sibs.forEach(s => allowed.add(Number(s.id)));
    }
    return rows.find(r => !allowed.has(Number(r.id))) || null;
}

// Semua invoice satu grup PP (root DP + semua pelunasan-nya).
async function expandPpGroupIds(knexInstance, ids) {
    const idSet = new Set(ids.map(Number));
    const groupRows = await knexInstance('proforma_invoices').where('tipe', 'PP').whereNot('status', 'cancelled');
    const changed = () => {
        let grown = false;
        for (const r of groupRows) {
            if (r.pp_type === 'pelunasan' && r.pelunasan_of_id) {
                if (idSet.has(Number(r.id))) {
                    if (!idSet.has(Number(r.pelunasan_of_id))) { idSet.add(Number(r.pelunasan_of_id)); grown = true; }
                } else if (idSet.has(Number(r.pelunasan_of_id))) {
                    if (!idSet.has(Number(r.id))) { idSet.add(Number(r.id)); grown = true; }
                }
            } else if (r.pp_type !== 'pelunasan' && idSet.has(Number(r.id))) {
                const sibs = groupRows.filter(x => x.pp_type === 'pelunasan' && Number(x.pelunasan_of_id) === Number(r.id));
                for (const s of sibs) {
                    if (!idSet.has(Number(s.id))) { idSet.add(Number(s.id)); grown = true; }
                }
            }
        }
        return grown;
    };
    while (changed()) { /* keep expanding until stable */ }
    return [...idSet];
}

async function nextRunningNumber(knexInstance, dateStr) {
    // dateStr format YYYYMMDD
    const prefix = `PI${dateStr}`;
    const rows = await knexInstance('proforma_requests')
        .where('proforma_no', 'like', `${prefix}%`)
        .select('proforma_no');
    let maxSeq = 0;
    for (const r of rows) {
        const seq = parseInt(r.proforma_no.slice(prefix.length), 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
    return `${prefix}${String(maxSeq + 1).padStart(5, '0')}`;
}

// ── Duplikasi invoice hasil reject (untuk riwayat) ──────────────────────────
// Membuat invoice baru (salinan data + items) yang berelasi dengan invoice yang
// ditolak: invoice baru.rejected_from_id -> invoice lama, dan invoice lama
// replacement_id -> invoice baru. Status invoice baru di-reset ke 'submitted'.
async function duplicateInvoiceForReject(knexInstance, oldInv, actor) {
    if (!oldInv || !oldInv.id) return null;

    const copyFields = [
        'dealer_id', 'dealer_name', 'dealer_npwp', 'dealer_alamat',
        'no_po', 'tgl_po', 'tipe', 'pp_type', 'pelunasan_of_id',
        'tgl_transaksi', 'uang_masuk', 'tgl_uang_masuk',
        'subtotal', 'ppn', 'ppn_rate', 'ppn_custom', 'diskon', 'materai', 'total_invoice'
    ];
    const payload = {};
    for (const f of copyFields) payload[f] = oldInv[f] ?? null;
    payload.status = 'submitted';
    payload.rejected_from_id = oldInv.id;
    payload.proforma_no = null;
    payload.faktur_pajak_no = null;
    payload.faktur_pajak_file = null;
    payload.tax_request_attachments = null;
    payload.tax_request_notes = null;
    payload.tax_requested_at = null;
    payload.tax_requested_by = null;
    payload.tax_approved_at = null;
    payload.tax_approved_by = null;
    payload.tax_sendback_at = null;
    payload.tax_sendback_by = null;
    payload.tax_rejected_at = null;
    payload.tax_rejected_by = null;
    payload.tax_reject_notes = null;
    payload.cancelled_at = null;
    payload.cancelled_by = null;
    payload.created_by = actor;
    payload.created_at = new Date();
    payload.updated_at = new Date();

    return knexInstance.transaction(async (trx) => {
        // Nomor revisi: {root}-{NN}; root dari no_invoice lama (strip suffix -NN), fallback ke ID invoice lama
        const rawNo = String(oldInv.no_invoice || '').trim();
        const rootNo = rawNo ? rawNo.replace(/-\d{2}$/, '') : String(oldInv.id);
        const cntRow = await trx('proforma_invoices').where('no_invoice', 'like', `${rootNo}-%`).count('* as c').first();
        const rev = (parseInt(cntRow && cntRow.c, 10) || 0) + 1;
        const insertPayload = { ...payload, no_invoice: `${rootNo}-${String(rev).padStart(2, '0')}` };

        const inserted = await trx('proforma_invoices').insert(insertPayload).returning('id');
        const row = Array.isArray(inserted) ? inserted[0] : inserted;
        const newId = typeof row === 'object' && row !== null ? row.id : row;

        const items = await trx('proforma_invoice_items').where('invoice_id', oldInv.id);
        for (const it of items) {
            await trx('proforma_invoice_items').insert({
                invoice_id: newId,
                model: it.model,
                item_description: it.item_description || '',
                harga: it.harga,
                qty: it.qty,
                ppn_rate: it.ppn_rate || 0.11,
                ppn_override: it.ppn_override != null && it.ppn_override !== '' ? parseFloat(it.ppn_override) : null,
                subtotal: it.subtotal
            });
        }

        await trx('proforma_invoices').where('id', oldInv.id).update({ replacement_id: newId, updated_at: new Date() });
        return newId;
    });
}

// ─── Master Dealer ──────────────────────────────────────────────────────────
router.get('/masters/dealers', async (req, res) => {
    try {
        const rows = await knex('invoice_dealers').orderBy('nama', 'asc');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengambil data dealer', details: [err.message] });
    }
});

router.get('/masters/dealers/template', async (req, res) => {
    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([
            ['NPWP', 'Nama', 'Alamat'],
            ['1234567890123456', 'PT Contoh Dealer', 'Jl. Contoh No. 1'],
        ]);
        ws['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Master Dealer');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="template_master_dealer.xlsx"');
        res.send(buf);
    } catch (err) {
        res.status(500).json({ error: 'Gagal membuat template', details: [err.message] });
    }
});

router.post('/masters/dealers/import', upload.single('file'), async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_manage_master) return res.status(403).json({ error: 'Anda tidak memiliki akses kelola master', details: [] });
        if (!req.file) return res.status(400).json({ error: 'File wajib diupload', details: [] });
        const wb = XLSX.read(fs.readFileSync(req.file.path), { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        if (!ws) return res.status(400).json({ error: 'Sheet kosong / tidak valid', details: [] });
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
            .map(r => r.map(c => String(c ?? '').trim()))
            .filter(r => r.some(c => c !== ''));
        if (rows.length < 2) return res.status(400).json({ error: 'Tidak ada data untuk diimport', details: ['Baris pertama adalah header'] });

        const inserted = [];
        const skipped = [];
        const errors = [];
        for (let i = 1; i < rows.length; i++) {
            const [npwp, nama, alamat] = rows[i];
            const rowNo = i + 1;
            if (!npwp) { errors.push(`Baris ${rowNo}: NPWP kosong`); continue; }
            if (!/^\d{16}$/.test(npwp)) { errors.push(`Baris ${rowNo}: NPWP '${npwp}' harus 16 digit angka`); continue; }
            if (!nama) { errors.push(`Baris ${rowNo}: Nama kosong`); continue; }
            const exists = await knex('invoice_dealers').where('npwp', npwp).first();
            if (exists) { skipped.push({ npwp, nama }); continue; }
            const [{ id }] = await knex('invoice_dealers').insert({ npwp, nama, alamat: alamat || '' }).returning('id');
            inserted.push(id);
        }
        fs.unlink(req.file.path, () => {});
        res.json({
            inserted: inserted.length,
            skipped: skipped.length,
            errors,
            skipped_rows: skipped,
            total: rows.length - 1,
        });
    } catch (err) {
        res.status(500).json({ error: 'Gagal import dealer', details: [err.message] });
    }
});

router.post('/masters/dealers', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_manage_master) return res.status(403).json({ error: 'Anda tidak memiliki akses kelola master', details: [] });
        const { npwp, nama, alamat } = req.body || {};
        if (!npwp || !String(npwp).trim()) return res.status(400).json({ error: 'NPWP wajib diisi', details: ['NPWP 16 digit'] });
        if (!/^\d{16}$/.test(String(npwp).trim())) return res.status(400).json({ error: 'NPWP harus 16 digit angka', details: ['Format NPWP: 16 digit angka tanpa spasi'] });
        if (!nama || !String(nama).trim()) return res.status(400).json({ error: 'Nama Dealer wajib diisi', details: [] });
        const exists = await knex('invoice_dealers').where('npwp', String(npwp).trim()).first();
        if (exists) return res.status(400).json({ error: 'NPWP sudah terdaftar', details: ['Gunakan NPWP lain atau update data yang ada'] });
        const [{ id }] = await knex('invoice_dealers').insert({
            npwp: String(npwp).trim(),
            nama: String(nama).trim(),
            alamat: alamat || '',
        }).returning('id');
        const row = await knex('invoice_dealers').where('id', id).first();
        res.status(201).json(row);
    } catch (err) {
        res.status(500).json({ error: 'Gagal menyimpan dealer', details: [err.message] });
    }
});

router.put('/masters/dealers/:id', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_manage_master) return res.status(403).json({ error: 'Anda tidak memiliki akses kelola master', details: [] });
        const { id } = req.params;
        const { npwp, nama, alamat } = req.body || {};
        if (!/^\d{16}$/.test(String(npwp || '').trim())) return res.status(400).json({ error: 'NPWP harus 16 digit angka', details: [] });
        if (!nama || !String(nama).trim()) return res.status(400).json({ error: 'Nama Dealer wajib diisi', details: [] });
        const dup = await knex('invoice_dealers').where('npwp', String(npwp).trim()).whereNot('id', id).first();
        if (dup) return res.status(400).json({ error: 'NPWP sudah dipakai dealer lain', details: [] });
        await knex('invoice_dealers').where('id', id).update({
            npwp: String(npwp).trim(),
            nama: String(nama).trim(),
            alamat: alamat || '',
            updated_at: knex.fn.now(),
        });
        const row = await knex('invoice_dealers').where('id', id).first();
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: 'Gagal update dealer', details: [err.message] });
    }
});

router.delete('/masters/dealers/:id', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_manage_master) return res.status(403).json({ error: 'Anda tidak memiliki akses kelola master', details: [] });
        const { id } = req.params;
        const used = await knex('proforma_invoices').where('dealer_id', id).first();
        if (used) return res.status(400).json({ error: 'Dealer sudah dipakai di invoice, tidak bisa dihapus', details: [] });
        await knex('invoice_dealers').where('id', id).del();
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Gagal hapus dealer', details: [err.message] });
    }
});

// ─── Master Barang ──────────────────────────────────────────────────────────
router.get('/masters/barang', async (req, res) => {
    try {
        const rows = await knex('invoice_barang').orderBy('model', 'asc');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengambil data barang', details: [err.message] });
    }
});

router.get('/masters/barang/template', async (req, res) => {
    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([
            ['Model', 'Item Description', 'Harga'],
            ['M-001', 'Mesin X', 1000000],
        ]);
        ws['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Master Barang');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="template_master_barang.xlsx"');
        res.send(buf);
    } catch (err) {
        res.status(500).json({ error: 'Gagal membuat template', details: [err.message] });
    }
});

router.post('/masters/barang/import', upload.single('file'), async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_manage_master) return res.status(403).json({ error: 'Anda tidak memiliki akses kelola master', details: [] });
        if (!req.file) return res.status(400).json({ error: 'File wajib diupload', details: [] });
        const wb = XLSX.read(fs.readFileSync(req.file.path), { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        if (!ws) return res.status(400).json({ error: 'Sheet kosong / tidak valid', details: [] });
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
            .map(r => r.map(c => String(c ?? '').trim()))
            .filter(r => r.some(c => c !== ''));
        if (rows.length < 2) return res.status(400).json({ error: 'Tidak ada data untuk diimport', details: ['Baris pertama adalah header'] });

        const inserted = [];
        const skipped = [];
        const errors = [];
        for (let i = 1; i < rows.length; i++) {
            const [model, item_description, harga] = rows[i];
            const rowNo = i + 1;
            if (!model) { errors.push(`Baris ${rowNo}: Model kosong`); continue; }
            const hargaVal = round2(parseFloat(String(harga).replace(/[^\d.-]/g, '')));
            if (!(hargaVal >= 0)) { errors.push(`Baris ${rowNo}: Harga '${harga}' tidak valid`); continue; }
            const exists = await knex('invoice_barang').where('model', model).first();
            if (exists) { skipped.push({ model, harga: hargaVal }); continue; }
            const [{ id }] = await knex('invoice_barang').insert({ model, item_description: item_description || '', harga: hargaVal }).returning('id');
            inserted.push(id);
        }
        fs.unlink(req.file.path, () => {});
        res.json({
            inserted: inserted.length,
            skipped: skipped.length,
            errors,
            skipped_rows: skipped,
            total: rows.length - 1,
        });
    } catch (err) {
        res.status(500).json({ error: 'Gagal import barang', details: [err.message] });
    }
});

router.post('/masters/barang', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_manage_master) return res.status(403).json({ error: 'Anda tidak memiliki akses kelola master', details: [] });
        const { model, item_description, harga } = req.body || {};
        if (!model || !String(model).trim()) return res.status(400).json({ error: 'Model wajib diisi', details: [] });
        const exists = await knex('invoice_barang').where('model', String(model).trim()).first();
        if (exists) return res.status(400).json({ error: 'Model sudah terdaftar', details: ['Gunakan model lain atau update'] });
        const [{ id }] = await knex('invoice_barang').insert({
            model: String(model).trim(),
            item_description: item_description || '',
            harga: round2(harga),
        }).returning('id');
        const row = await knex('invoice_barang').where('id', id).first();
        res.status(201).json(row);
    } catch (err) {
        res.status(500).json({ error: 'Gagal menyimpan barang', details: [err.message] });
    }
});

router.put('/masters/barang/:id', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_manage_master) return res.status(403).json({ error: 'Anda tidak memiliki akses kelola master', details: [] });
        const { id } = req.params;
        const { model, item_description, harga } = req.body || {};
        if (!model || !String(model).trim()) return res.status(400).json({ error: 'Model wajib diisi', details: [] });
        const dup = await knex('invoice_barang').where('model', String(model).trim()).whereNot('id', id).first();
        if (dup) return res.status(400).json({ error: 'Model sudah dipakai barang lain', details: [] });
        await knex('invoice_barang').where('id', id).update({
            model: String(model).trim(),
            item_description: item_description || '',
            harga: round2(harga),
            updated_at: knex.fn.now(),
        });
        const row = await knex('invoice_barang').where('id', id).first();
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: 'Gagal update barang', details: [err.message] });
    }
});

router.delete('/masters/barang/:id', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_manage_master) return res.status(403).json({ error: 'Anda tidak memiliki akses kelola master', details: [] });
        const { id } = req.params;
        const used = await knex('proforma_invoice_items').where('model', (await knex('invoice_barang').where('id', id).first())?.model).first();
        if (used) return res.status(400).json({ error: 'Barang sudah dipakai di invoice, tidak bisa dihapus', details: [] });
        await knex('invoice_barang').where('id', id).del();
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Gagal hapus barang', details: [err.message] });
    }
});

// ─── Invoices ───────────────────────────────────────────────────────────────
// ─── Invoice Rules (Akses per tab/fitur) ────────────────────────────────────
router.get('/rules', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_view_rule) return res.status(403).json({ error: 'Anda tidak memiliki akses melihat rule', details: [] });
        const rows = await knex('invoice_rules').orderBy('id', 'desc');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengambil rule', details: [err.message] });
    }
});

router.get('/rules/permissions', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        res.json(perms);
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengambil permission', details: [err.message] });
    }
});

router.post('/rules', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_manage_master && !perms.can_manage_rule) return res.status(403).json({ error: 'Anda tidak memiliki akses kelola rule', details: [] });
        const b = req.body || {};
        if (!b.target_type || !b.target_value) return res.status(400).json({ error: 'Tipe target dan nilai target wajib diisi', details: [] });
        const data = { target_type: b.target_type, target_value: String(b.target_value).trim(), is_active: b.is_active !== false };
        for (const f of INVOICE_PERM_FIELDS) {
            if (typeof b[f] === 'boolean') data[f] = b[f];
        }
        if (typeof b.can_manage_master !== 'boolean') data.can_manage_master = false;
        const [{ id }] = await knex('invoice_rules').insert(data).returning('id');
        const row = await knex('invoice_rules').where('id', id).first();
        res.status(201).json(row);
    } catch (err) {
        res.status(500).json({ error: 'Gagal simpan rule', details: [err.message] });
    }
});

router.put('/rules/:id', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_manage_master && !perms.can_manage_rule) return res.status(403).json({ error: 'Anda tidak memiliki akses kelola rule', details: [] });
        const { id } = req.params;
        const b = req.body || {};
        const data = { target_type: b.target_type, target_value: String(b.target_value || '').trim(), is_active: b.is_active !== false, updated_at: knex.fn.now() };
        for (const f of INVOICE_PERM_FIELDS) {
            if (typeof b[f] === 'boolean') data[f] = b[f];
        }
        await knex('invoice_rules').where('id', id).update(data);
        const row = await knex('invoice_rules').where('id', id).first();
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: 'Gagal update rule', details: [err.message] });
    }
});

router.delete('/rules/:id', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_manage_master && !perms.can_manage_rule) return res.status(403).json({ error: 'Anda tidak memiliki akses kelola rule', details: [] });
        const { id } = req.params;
        await knex('invoice_rules').where('id', id).del();
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Gagal hapus rule', details: [err.message] });
    }
});

router.get('/', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 100));
        const offset = (page - 1) * limit;

        const countRow = await knex('proforma_invoices').whereNull('deleted_at').count('id as total').first();
        const total = Number(countRow?.total || 0);

        const rows = await knex('proforma_invoices')
            .select(
                'proforma_invoices.*',
                knex.raw('(SELECT COUNT(*) FROM proforma_invoice_items it WHERE it.invoice_id = proforma_invoices.id) as item_count')
            )
            .whereNull('deleted_at')
            .orderBy('proforma_invoices.created_at', 'desc')
            .limit(limit)
            .offset(offset);
        res.json({ data: rows, total, page, limit, totalPages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengambil invoice', details: [err.message] });
    }
});

// Export semua data invoice ke Excel (detail lengkap: header + semua item)
router.get('/export-excel', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_view_invoice && !perms.can_view_dashboard) {
            return res.status(403).json({ error: 'Anda tidak memiliki akses export data invoice', details: [] });
        }
        const invoices = await knex('proforma_invoices').orderBy('id', 'asc');
        const items = await knex('proforma_invoice_items').orderBy('invoice_id', 'asc').orderBy('id', 'asc');
        // No invoice asli baru dibuat saat settle (tabel settled_invoices), bukan di proforma_invoices.
        const settledRows = await knex('settled_invoices').select('source_invoice_id', 'no_invoice', 'tgl_invoice').orderBy('id', 'asc');
        const settledBySrc = new Map();
        for (const s of settledRows) {
            if (s.source_invoice_id == null) continue;
            if (!settledBySrc.has(Number(s.source_invoice_id))) settledBySrc.set(Number(s.source_invoice_id), []);
            settledBySrc.get(Number(s.source_invoice_id)).push(s);
        }

        const STATUS_LABEL = {
            submitted: 'Submitted', proforma: 'Proforma', sent_back: 'Sent Back',
            tax_requested: 'Tax Requested', sent_back_tax: 'Tax Sent Back',
            tax: 'Faktur Pajak', settled: 'Settled', cancelled: 'Dibatalkan',
        };
        const itemsByInv = new Map();
        for (const it of items) {
            if (!itemsByInv.has(it.invoice_id)) itemsByInv.set(it.invoice_id, []);
            itemsByInv.get(it.invoice_id).push(it);
        }
        const fmt = (v) => (v == null ? '' : v);
        const num = (v) => (v == null ? 0 : Number(v));
        const dt = (v) => (v == null || v === '' ? '' : String(v instanceof Date ? v.toISOString() : v).slice(0, 10));

        const invHeaders = [
            'ID', 'No Invoice Asli', 'Tgl Invoice Asli', 'No Invoice Revisi', 'Reject Dari ID', 'Replacement ID', 'No PO', 'Tgl PO', 'Tipe', 'Tgl Transaksi',
            'No Proforma', 'No Faktur Pajak',
            'Dealer', 'NPWP Dealer', 'Alamat Dealer',
            'Subtotal', 'PPN Rate', 'PPN', 'Diskon', 'Materai', 'Total Invoice',
            'Uang Masuk', 'Tgl Uang Masuk', 'Sisa',
            'Status', 'Tipe PP', 'Pelunasan Dari ID', 'Jumlah Item',
            'Tax Requested At', 'Tax Requested By',
            'Tax Approved At', 'Tax Approved By',
            'Tax Sendback At', 'Tax Sendback By',
            'Dibatalkan At', 'Dibatalkan Oleh',
            'Dibuat Oleh', 'Dibuat At', 'Diupdate At',
        ];
        const invRows = invoices.map(inv => {
            const settledFor = settledBySrc.get(Number(inv.id)) || [];
            const noInvoiceAsli = settledFor.map(s => s.no_invoice).filter(Boolean).join(', ');
            const tglInvoiceAsli = settledFor.map(s => dt(s.tgl_invoice)).filter(Boolean).join(', ');
            return [
                inv.id, noInvoiceAsli, tglInvoiceAsli, fmt(inv.no_invoice), inv.rejected_from_id ?? '', inv.replacement_id ?? '',
                fmt(inv.no_po), dt(inv.tgl_po), fmt(inv.tipe), dt(inv.tgl_transaksi),
                fmt(inv.proforma_no), fmt(inv.faktur_pajak_no),
                fmt(inv.dealer_name), fmt(inv.dealer_npwp), fmt(inv.dealer_alamat),
                num(inv.subtotal), inv.ppn_rate == null ? '' : num(inv.ppn_rate), num(inv.ppn), num(inv.diskon), num(inv.materai), num(inv.total_invoice),
                num(inv.uang_masuk), dt(inv.tgl_uang_masuk), num(num(inv.total_invoice) - num(inv.uang_masuk)),
                STATUS_LABEL[inv.status] || fmt(inv.status), fmt(inv.pp_type), inv.pelunasan_of_id ?? '',
                (itemsByInv.get(inv.id) || []).length,
                dt(inv.tax_requested_at), fmt(inv.tax_requested_by),
                dt(inv.tax_approved_at), fmt(inv.tax_approved_by),
                dt(inv.tax_sendback_at), fmt(inv.tax_sendback_by),
                dt(inv.cancelled_at), fmt(inv.cancelled_by),
                fmt(inv.created_by), dt(inv.created_at), dt(inv.updated_at),
            ];
        });

        const itemHeaders = ['ID Invoice', 'No Invoice Asli', 'No PO', 'Dealer', 'No Proforma', 'Model', 'Deskripsi', 'Harga', 'Qty', 'Subtotal'];
        const invById = new Map(invoices.map(i => [i.id, i]));
        const itemRows = items.map(it => {
            const inv = invById.get(it.invoice_id) || {};
            const settledFor = settledBySrc.get(Number(it.invoice_id)) || [];
            const noInvoiceAsli = settledFor.map(s => s.no_invoice).filter(Boolean).join(', ');
            return [
                it.invoice_id, noInvoiceAsli || fmt(inv.no_invoice), fmt(inv.no_po), fmt(inv.dealer_name), fmt(inv.proforma_no),
                fmt(it.model), fmt(it.item_description), num(it.harga), it.qty ?? 1, num(it.subtotal),
            ];
        });

        const wb = XLSX.utils.book_new();
        const ws1 = XLSX.utils.aoa_to_sheet([invHeaders, ...invRows]);
        ws1['!cols'] = invHeaders.map((_, i) => ({ wch: i === 14 ? 42 : i === 3 ? 16 : i === 12 ? 30 : 18 }));
        XLSX.utils.book_append_sheet(wb, ws1, 'Data Invoice');

        const ws2 = XLSX.utils.aoa_to_sheet([itemHeaders, ...itemRows]);
        ws2['!cols'] = itemHeaders.map((_, i) => ({ wch: i === 6 ? 42 : i === 3 ? 30 : i === 1 ? 18 : 14 }));
        XLSX.utils.book_append_sheet(wb, ws2, 'Item Barang');

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const dateStr = new Date().toISOString().slice(0, 10);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="data_invoice_${dateStr}.xlsx"`);
        res.send(buf);
    } catch (err) {
        res.status(500).json({ error: 'Gagal export Excel', details: [err.message] });
    }
});

// ─── Workflow / Flow Setting (rute approval + notifikasi) ────────────────────
const canManageFlow = async (req) => {
    const perms = await getUserInvoicePerms(req.authUser);
    return isSuper(req.authUser) || perms.can_manage_rule;
};

// Kirim email otomatis ke requester proforma (yang mengajukan) saat proforma
// di-sendback / di-reject. Memakai template email (fallback default).
async function emailProformaRequester(knexInstance, event, p, invoices, notes = '') {
    try {
        const requesterUser = await knexInstance('users').where('username', p?.requested_by).first();
        const to = requesterUser?.email ? String(requesterUser.email).trim() : '';
        if (!to) return;
        const tpl = await getEmailTemplate(knexInstance, event);
        const vars = buildEmailVars(event, { requester: p?.requested_by || '-', proforma: p, invoices, notes });
        const subject = renderTemplate(tpl.subject, vars);
        const html = renderTemplate(tpl.body_html, vars);
        await sendMail({ to, subject, html });
        console.log(`[flow] Email ${event} terkirim ke requester ${to}`);
    } catch (err) {
        console.error('[flow] Gagal kirim email ke requester:', err.message);
    }
}

// Seed default alur (contoh: request invoice -> approval akunting -> marketing -> request faktur -> tax -> approval tax -> marketing)
const FLOW_DEFAULT = [
    { event: 'invoice_created', name: 'Request Invoice', assignee_type: 'all', assignee_value: null, notify_email: true },
    { event: 'proforma_pending', name: 'Approval Akunting', assignee_type: 'role', assignee_value: 'Accounting', notify_email: true },
    { event: 'proforma_approved', name: 'Marketing', assignee_type: 'role', assignee_value: 'Marketing', notify_email: true },
    { event: 'tax_requested', name: 'Request Faktur ke Tax', assignee_type: 'role', assignee_value: 'Tax', notify_email: true },
    { event: 'tax_approved', name: 'Approval Tax', assignee_type: 'role', assignee_value: 'Tax', notify_email: true },
    { event: 'settled', name: 'Marketing (Selesai)', assignee_type: 'role', assignee_value: 'Marketing', notify_email: true },
];

router.get('/flow', async (req, res) => {
    try {
        const rows = await knex('invoice_flow_steps').orderBy('step_no', 'asc');
        const steps = rows.map(r => ({ ...r, custom_emails: parseCustomEmails(r.custom_emails) }));
        res.json({ events: FLOW_EVENTS, steps });
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengambil flow', details: [err.message] });
    }
});

router.post('/flow/seed', async (req, res) => {
    try {
        if (!(await canManageFlow(req))) return res.status(403).json({ error: 'Tidak punya akses kelola flow', details: [] });
        const count = await knex('invoice_flow_steps').count('* as c').first();
        if (count.c > 0) return res.status(400).json({ error: 'Flow sudah ada isinya', details: ['Hapus step dulu atau gunakan edit'] });
        const inserts = FLOW_DEFAULT.map((s, i) => ({ ...s, step_no: i + 1, is_active: true, created_at: new Date(), updated_at: new Date() }));
        await knex('invoice_flow_steps').insert(inserts);
        const rows = await knex('invoice_flow_steps').orderBy('step_no', 'asc');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Gagal seed flow', details: [err.message] });
    }
});

router.post('/flow', async (req, res) => {
    try {
        if (!(await canManageFlow(req))) return res.status(403).json({ error: 'Tidak punya akses kelola flow', details: [] });
        const b = req.body || {};
        const event = String(b.event || '').trim();
        if (!FLOW_EVENTS[event]) return res.status(400).json({ error: 'Event tidak valid', details: [] });
        if (!String(b.name || '').trim()) return res.status(400).json({ error: 'Nama step wajib diisi', details: [] });
        const atype = b.assignee_type || 'all';
        if (atype !== 'all' && !String(b.assignee_value || '').trim()) {
            return res.status(400).json({ error: `Penanggung jawab wajib diisi untuk tipe "${atype}"`, details: [] });
        }
        const customEmails = parseCustomEmails(b.custom_emails);
        const maxNo = await knex('invoice_flow_steps').max('step_no as m').first();
        const [{ id }] = await knex('invoice_flow_steps').insert({
            step_no: (maxNo.m || 0) + 1,
            event,
            name: String(b.name).trim(),
            assignee_type: b.assignee_type || 'all',
            assignee_value: b.assignee_value || null,
            custom_emails: customEmails.length ? JSON.stringify(customEmails) : null,
            notify_email: b.notify_email !== false,
            is_active: b.is_active !== false,
            created_at: new Date(),
            updated_at: new Date(),
        }).returning('id');
        const row = await knex('invoice_flow_steps').where('id', id).first();
        res.status(201).json(row);
    } catch (err) {
        res.status(500).json({ error: 'Gagal menambah step flow', details: [err.message] });
    }
});

router.put('/flow/:id', async (req, res) => {
    try {
        if (!(await canManageFlow(req))) return res.status(403).json({ error: 'Tidak punya akses kelola flow', details: [] });
        const { id } = req.params;
        const step = await knex('invoice_flow_steps').where('id', id).first();
        if (!step) return res.status(404).json({ error: 'Step tidak ditemukan', details: [] });
        const b = req.body || {};
        const upd = { updated_at: new Date() };
        if (b.event !== undefined) {
            if (!FLOW_EVENTS[b.event]) return res.status(400).json({ error: 'Event tidak valid', details: [] });
            upd.event = b.event;
        }
        if (b.name !== undefined) upd.name = String(b.name).trim() || step.name;
        if (b.assignee_type !== undefined) upd.assignee_type = b.assignee_type;
        if (b.assignee_value !== undefined) upd.assignee_value = b.assignee_value || null;
        if (b.custom_emails !== undefined) {
            const parsed = parseCustomEmails(b.custom_emails);
            upd.custom_emails = parsed.length ? JSON.stringify(parsed) : null;
        }
        // Validasi: penanggung jawab wajib diisi untuk tipe selain 'all'
        const effType = upd.assignee_type !== undefined ? upd.assignee_type : step.assignee_type;
        const effVal = upd.assignee_value !== undefined ? upd.assignee_value : step.assignee_value;
        if (effType && effType !== 'all' && !String(effVal || '').trim()) {
            return res.status(400).json({ error: `Penanggung jawab wajib diisi untuk tipe "${effType}"`, details: [] });
        }
        if (b.notify_email !== undefined) upd.notify_email = !!b.notify_email;
        if (b.is_active !== undefined) upd.is_active = !!b.is_active;
        await knex('invoice_flow_steps').where('id', id).update(upd);
        const row = await knex('invoice_flow_steps').where('id', id).first();
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: 'Gagal update step flow', details: [err.message] });
    }
});

router.delete('/flow/:id', async (req, res) => {
    try {
        if (!(await canManageFlow(req))) return res.status(403).json({ error: 'Tidak punya akses kelola flow', details: [] });
        const { id } = req.params;
        await knex('invoice_flow_steps').where('id', id).del();
        const rows = await knex('invoice_flow_steps').orderBy('step_no', 'asc');
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].step_no !== i + 1) await knex('invoice_flow_steps').where('id', rows[i].id).update({ step_no: i + 1, updated_at: new Date() });
        }
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Gagal hapus step flow', details: [err.message] });
    }
});

router.post('/flow/reorder', async (req, res) => {
    try {
        if (!(await canManageFlow(req))) return res.status(403).json({ error: 'Tidak punya akses kelola flow', details: [] });
        const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : [];
        for (let i = 0; i < ids.length; i++) {
            await knex('invoice_flow_steps').where('id', ids[i]).update({ step_no: i + 1, updated_at: new Date() });
        }
        const rows = await knex('invoice_flow_steps').orderBy('step_no', 'asc');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Gagal reorder flow', details: [err.message] });
    }
});

// ─── Status konfigurasi email (untuk badge di UI) ──────────────────────────
router.get('/flow/mail-status', (req, res) => {
    try {
        res.json(getMailInfo());
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengambil status email', details: [err.message] });
    }
});

// ─── Preview penerima notifikasi (TIDAK mengirim email) ─────────────────────
// Query opsional: event, step_id, atau assignee_type+assignee_value (preview form).
router.get('/flow/recipients', async (req, res) => {
    try {
        const event = String(req.query?.event || '').trim();
        const stepId = req.query?.step_id ? Number(req.query.step_id) : null;
        const atype = String(req.query?.assignee_type || '').trim();
        const avalue = String(req.query?.assignee_value || '').trim();
        const cems = (req.query?.custom_emails || '').trim();
        const steps = [];
        if (atype || avalue || cems) {
            // Preview dari konfigurasi form (belum disimpan)
            steps.push({ step_no: 0, name: '(form)', assignee_type: atype || 'all', assignee_value: avalue || null, custom_emails: cems || null, notify_email: true, is_active: true });
        } else if (stepId) {
            const s = await knex('invoice_flow_steps').where({ id: stepId }).first();
            if (s) steps.push(s);
        } else if (event) {
            const rows = await knex('invoice_flow_steps').where({ event, is_active: true }).orderBy('step_no', 'asc');
            steps.push(...rows);
        } else {
            const rows = await knex('invoice_flow_steps').orderBy('step_no', 'asc');
            steps.push(...rows);
        }
        const seen = new Map(); // dedup by email (atau username bila tak punya email)
        const recipients = [];
        for (const s of steps) {
            const users = await resolveRecipients(knex, s);
            for (const u of users) {
                const email = u.email ? String(u.email).trim() : '';
                const key = email || `__noemail__:${u.username}`;
                if (seen.has(key)) continue;
                seen.set(key, true);
                recipients.push({
                    username: u.username,
                    name: u.custom ? (u.name || email) : (u.name || u.username),
                    email: email || (u.custom ? '(email custom)' : '(belum ada email)'),
                    has_email: Boolean(email),
                    custom: !!u.custom,
                    step_no: s.step_no,
                    step_name: s.name,
                    assignee_type: s.assignee_type,
                    assignee_value: s.assignee_value,
                    notify_email: !!s.notify_email,
                    is_active: !!s.is_active,
                });
            }
        }
        res.json({ event, steps: steps.length, recipients });
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengambil penerima', details: [err.message] });
    }
});

// ─── Template email notifikasi (bisa dikustomisasi per event) ────────────────
router.get('/flow/email-templates', async (req, res) => {
    try {
        const rows = await knex('email_templates').select('*');
        const map = {};
        for (const r of rows) map[r.event] = r;
        const items = Object.keys(FLOW_EVENTS).map(ev => {
            const t = map[ev];
            return {
                event: ev,
                label: FLOW_EVENTS[ev],
                subject: t ? t.subject : DEFAULT_EMAIL_SUBJECTS[ev],
                body_html: t ? t.body_html : buildDefaultBody(ev),
                custom: !!t,
                default_subject: DEFAULT_EMAIL_SUBJECTS[ev],
                default_body_html: buildDefaultBody(ev),
                updated_at: t ? t.updated_at : null,
            };
        });
        res.json({ items, tokens: EMAIL_TOKENS });
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengambil template email', details: [err.message] });
    }
});

// Preview hasil render template (TIDAK mengirim email).
router.post('/flow/email-templates/preview', async (req, res) => {
    try {
        const b = req.body || {};
        const event = String(b.event || '');
        if (!FLOW_EVENTS[event]) return res.status(400).json({ error: 'Event tidak valid', details: [] });
        const tpl = await getEmailTemplate(knex, event);
        const vars = buildEmailVars(event, b.ctx || {});
        const subject = b.subject !== undefined ? renderTemplate(String(b.subject), vars) : renderTemplate(tpl.subject, vars);
        const body_html = b.body_html !== undefined ? renderTemplate(String(b.body_html), vars) : renderTemplate(tpl.body_html, vars);
        res.json({ subject, body_html, vars });
    } catch (err) {
        res.status(500).json({ error: 'Gagal preview template', details: [err.message] });
    }
});

router.put('/flow/email-templates/:event', async (req, res) => {
    try {
        if (!(await canManageFlow(req))) return res.status(403).json({ error: 'Tidak punya akses kelola flow', details: [] });
        const event = String(req.params.event || '');
        if (!FLOW_EVENTS[event]) return res.status(400).json({ error: 'Event tidak valid', details: [] });
        const subject = String(req.body?.subject || '').trim();
        const body_html = String(req.body?.body_html || '').trim();
        if (!subject) return res.status(400).json({ error: 'Subjek email wajib diisi', details: [] });
        if (!body_html) return res.status(400).json({ error: 'Isi email wajib diisi', details: [] });
        const upd = {
            subject,
            body_html,
            updated_by: getAuthUser(req)?.username || 'System',
            updated_at: new Date(),
        };
        await knex('email_templates').insert({ event, ...upd }).onConflict('event').merge(upd);
        const row = await knex('email_templates').where({ event }).first();
        res.json({ ...row, custom: true });
    } catch (err) {
        res.status(500).json({ error: 'Gagal simpan template email', details: [err.message] });
    }
});

// Kembalikan template ke versi default (hapus kustomisasi).
router.delete('/flow/email-templates/:event', async (req, res) => {
    try {
        if (!(await canManageFlow(req))) return res.status(403).json({ error: 'Tidak punya akses kelola flow', details: [] });
        const event = String(req.params.event || '');
        if (!FLOW_EVENTS[event]) return res.status(400).json({ error: 'Event tidak valid', details: [] });
        await knex('email_templates').where({ event }).del();
        res.json({ event, custom: false });
    } catch (err) {
        res.status(500).json({ error: 'Gagal reset template email', details: [err.message] });
    }
});

// ─── Sampah: daftar invoice & proforma yang di-soft-delete (khusus admin) ─────
router.get('/trash', async (req, res) => {
    try {
        if (!isSuper(req.authUser)) return res.status(403).json({ error: 'Hanya admin yang dapat melihat Sampah' });
        const [invRows, profRows] = await Promise.all([
            knex('proforma_invoices').whereNotNull('deleted_at').orderBy('deleted_at', 'desc'),
            knex('proforma_requests').whereNotNull('deleted_at').orderBy('deleted_at', 'desc'),
        ]);
        const proformas = [];
        for (const p of profRows) {
            const ids = parseJsonArraySafeStr(p.invoice_ids);
            const invs = ids.length ? await knex('proforma_invoices').whereIn('id', ids) : [];
            proformas.push({ ...p, invoices: invs });
        }
        res.json({ invoices: invRows, proformas });
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengambil Sampah', details: [err.message] });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const invoice = await knex('proforma_invoices').where('id', id).first();
        if (!invoice) return res.status(404).json({ error: 'Invoice tidak ditemukan' });
        const items = await knex('proforma_invoice_items').where('invoice_id', id).orderBy('id', 'asc');
        const proformas = await knex('proforma_requests').orderBy('id', 'desc');
        const proforma = proformas.find(p => parseJsonArraySafeStr(p.invoice_ids).includes(Number(id))) || null;
        res.json({ ...invoice, items, proforma });
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengambil detail invoice', details: [err.message] });
    }
});

router.post('/', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_create) return res.status(403).json({ error: 'Anda tidak memiliki akses buat invoice', details: [] });
        const b = req.body || {};
        const {
            dealer_id, dealer_name, dealer_npwp, dealer_alamat,
            no_po, tgl_po, tipe, tgl_transaksi, uang_masuk, tgl_uang_masuk,
            ppn_rate, diskon, materai, items,
        } = b;

        if (!dealer_id && !dealer_name) return res.status(400).json({ error: 'Pilih dealer terlebih dahulu', details: [] });
        if (!tipe) return res.status(400).json({ error: 'Tipe Invoice wajib diisi', details: ['CBD / PP / PF'] });
        if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Minimal satu barang', details: ['Tambahkan item barang'] });
        for (const it of items) {
            if (!it.model) return res.status(400).json({ error: 'Model barang wajib diisi', details: [] });
            if (!(it.qty > 0)) return res.status(400).json({ error: 'Qty harus lebih dari 0', details: [`Item ${it.model}`] });
            if (!(it.harga > 0)) return res.status(400).json({ error: 'Harga barang wajib diisi', details: [`Item ${it.model}`] });
        }
        if (!no_po) return res.status(400).json({ error: 'No. PO wajib diisi', details: [] });
        if (!tgl_po) return res.status(400).json({ error: 'Tgl. PO wajib diisi', details: [] });
        if (!tgl_transaksi) return res.status(400).json({ error: 'Tgl. Transaksi wajib diisi', details: [] });

        const subtotal = round2(items.reduce((s, it) => s + (round2(it.harga) * (it.qty || 1)), 0));
        const ppnRate = parseFloat(ppn_rate) || 0.11;
        const ppnCustom = b.ppn_custom === true || b.ppn_custom === 'true';
        const ppn = ppnCustom
            ? round2(b.ppn_amount)
            : Math.round(subtotal * ppnRate * 100) / 100;
        const diskonVal = round2(diskon);
        const materaiVal = round2(materai);
        const computedTotal = round2(subtotal + ppn - diskonVal + materaiVal);
        const totalInvoice = (b.total_invoice !== null && b.total_invoice !== undefined && b.total_invoice !== '')
            ? round2(b.total_invoice)
            : computedTotal;
        const uangMasuk = round2(uang_masuk);

        let dealer = null;
        if (dealer_id) dealer = await knex('invoice_dealers').where('id', dealer_id).first();

        if (tipe === 'CBD' && Math.abs(uangMasuk - totalInvoice) > 0.01) {
            return res.status(400).json({ error: 'CBD harus balance', details: [`Uang masuk (${uangMasuk.toLocaleString('id-ID')}) harus sama dengan total invoice (${totalInvoice.toLocaleString('id-ID')})`] });
        }
        if (tipe === 'PP') {
            const ppType = b.pp_type || 'dp';
            if (ppType === 'dp') {
                if (!(totalInvoice > 0)) return res.status(400).json({ error: 'Total invoice (full amount) wajib diisi untuk PP (DP)', details: [] });
                if (!(uangMasuk > 0)) return res.status(400).json({ error: 'Uang masuk (DP) wajib diisi untuk PP (DP)', details: [] });
                if (!(uangMasuk < totalInvoice)) return res.status(400).json({ error: 'Uang masuk (DP) harus lebih kecil dari total invoice', details: ['DP adalah sebagian dari total'] });
            } else if (ppType === 'pelunasan') {
                if (!b.pelunasan_of_id) return res.status(400).json({ error: 'Pilih No. PO DP yang akan dilunasi', details: [] });
                if (!(uangMasuk > 0)) return res.status(400).json({ error: 'Jumlah uang pelunasan wajib diisi', details: [] });
                const group = await getPpGroupInfo(knex, b.pelunasan_of_id, req.params?.id ? Number(req.params.id) : null);
                if (!group) return res.status(400).json({ error: 'Referensi PO DP tidak valid', details: [] });
                // Daftar barang (total_invoice) pelunasan HARUS sama dengan full amount DP.
                if (Math.abs(totalInvoice - group.full) > 0.01) {
                    return res.status(400).json({ error: 'Daftar barang pelunasan harus sama dengan full amount DP', details: [`Total barang pelunasan: ${totalInvoice.toLocaleString('id-ID')} harus sama dengan full amount DP: ${group.full.toLocaleString('id-ID')}. Yang boleh beda hanya amount (uang masuk), bukan daftar barang.`] });
                }
                if (uangMasuk > group.remaining + 0.01) {
                    return res.status(400).json({ error: 'Pelunasan melebihi sisa full amount', details: [`Sisa full amount: ${group.remaining.toLocaleString('id-ID')}. Pelunasan ini: ${uangMasuk.toLocaleString('id-ID')}`] });
                }
            }
        }
        if (tipe === 'PF') {
            // Performa First: tidak wajib uang masuk sekarang
        }

        // No PO tidak boleh sama antar invoice, KECUALI anggota grup PP yang sama (DP + pelunasan = 1 PO).
        // Pelunasan wajib memakai no_po yang sama dengan DP-nya.
        if (tipe === 'PP' && (b.pp_type || 'dp') === 'pelunasan') {
            const dpRef = b.pelunasan_of_id ? await knex('proforma_invoices').where('id', b.pelunasan_of_id).first() : null;
            if (dpRef && String(dpRef.no_po || '').trim() !== String(no_po || '').trim()) {
                return res.status(400).json({ error: 'No. PO pelunasan harus sama dengan No. PO DP', details: [`No. PO DP: ${dpRef.no_po || '-'}`] });
            }
            const dupPo = await findNoPoConflict(knex, no_po, { groupId: b.pelunasan_of_id });
            if (dupPo) return res.status(400).json({ error: 'No. PO sudah pernah diinput', details: [`PO ${no_po} dipakai invoice #${dupPo.id} (${dupPo.dealer_name || '-'}) di luar grup PP ini.`] });
        } else {
            const dupPo = await findNoPoConflict(knex, no_po, {});
            if (dupPo) return res.status(400).json({ error: 'No. PO sudah pernah diinput', details: [`PO ${no_po} dipakai invoice #${dupPo.id} (${dupPo.dealer_name || '-'}). Batalkan invoice lama untuk mengulang PO.`] });
        }

        const trx = await knex.transaction();
        try {
            const [{ id }] = await trx('proforma_invoices').insert({
                dealer_id: dealer_id || null,
                dealer_name: dealer_name || dealer?.nama || '',
                dealer_npwp: dealer_npwp || dealer?.npwp || '',
                dealer_alamat: dealer_alamat || dealer?.alamat || '',
                no_po: no_po || '',
                tgl_po: tgl_po || null,
                tipe,
                pp_type: tipe === 'PP' ? (b.pp_type || 'dp') : null,
                pelunasan_of_id: (tipe === 'PP' && b.pp_type === 'pelunasan') ? (b.pelunasan_of_id || null) : null,
                tgl_transaksi: tgl_transaksi || null,
                uang_masuk: uangMasuk,
                tgl_uang_masuk: tgl_uang_masuk || null,
                subtotal,
                ppn,
                ppn_rate: ppnCustom ? null : ppnRate,
                ppn_custom: ppnCustom,
                diskon: diskonVal,
                materai: materaiVal,
                total_invoice: totalInvoice,
                status: 'submitted',
                created_by: getUsername(req),
                created_at: new Date(),
                updated_at: new Date(),
            }).returning('id');

            for (const it of items) {
                await trx('proforma_invoice_items').insert({
                    invoice_id: id,
                    model: it.model,
                    item_description: it.item_description || '',
                    harga: round2(it.harga),
                    qty: it.qty || 1,
                    ppn_rate: parseFloat(it.ppn_rate) || 0.11,
                    ppn_override: it.ppn_override != null && it.ppn_override !== '' ? parseFloat(it.ppn_override) : null,
                    subtotal: round2(it.harga) * (it.qty || 1),
                });
            }

            await trx.commit();
            const invoice = await knex('proforma_invoices').where('id', id).first();
            const itemRows = await knex('proforma_invoice_items').where('invoice_id', id);
            try { await notifyFlowEvent(knex, 'invoice_created', { requester: getUsername(req), invoice, invoices: [{ ...invoice }] }); } catch {}
            res.status(201).json({ ...invoice, items: itemRows });
        } catch (e) {
            await trx.rollback();
            throw e;
        }
    } catch (err) {
        res.status(500).json({ error: 'Gagal membuat invoice', details: [err.message] });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_edit) return res.status(403).json({ error: 'Anda tidak memiliki akses edit invoice', details: [] });
        const { id } = req.params;
        const inv = await knex('proforma_invoices').where('id', id).first();
        if (!inv) return res.status(404).json({ error: 'Invoice tidak ditemukan' });
        if (inv.status !== 'submitted') return res.status(400).json({ error: 'Hanya invoice status submitted yang bisa diedit', details: [] });

        const b = req.body || {};
        const {
            dealer_id, dealer_name, dealer_npwp, dealer_alamat,
            no_po, tgl_po, tipe, tgl_transaksi, uang_masuk, tgl_uang_masuk,
            ppn_rate, diskon, materai, items,
        } = b;
        if (!dealer_id && !dealer_name) return res.status(400).json({ error: 'Pilih dealer terlebih dahulu', details: [] });
        if (!tipe) return res.status(400).json({ error: 'Tipe Invoice wajib diisi', details: ['CBD / PP / PF'] });
        if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Minimal satu barang', details: ['Tambahkan item barang'] });
        for (const it of items) {
            if (!it.model) return res.status(400).json({ error: 'Model barang wajib diisi', details: [] });
            if (!(it.qty > 0)) return res.status(400).json({ error: 'Qty harus lebih dari 0', details: [`Item ${it.model}`] });
            if (!(it.harga > 0)) return res.status(400).json({ error: 'Harga barang wajib diisi', details: [`Item ${it.model}`] });
        }
        if (!no_po) return res.status(400).json({ error: 'No. PO wajib diisi', details: [] });
        if (!tgl_po) return res.status(400).json({ error: 'Tgl. PO wajib diisi', details: [] });
        if (!tgl_transaksi) return res.status(400).json({ error: 'Tgl. Transaksi wajib diisi', details: [] });

        const subtotal = round2(items.reduce((s, it) => s + (round2(it.harga) * (it.qty || 1)), 0));
        const ppnRate = parseFloat(ppn_rate) || 0.11;
        const ppnCustom = b.ppn_custom === true || b.ppn_custom === 'true';
        const ppn = ppnCustom
            ? round2(b.ppn_amount)
            : Math.round(subtotal * ppnRate * 100) / 100;
        const diskonVal = round2(diskon);
        const materaiVal = round2(materai);
        const computedTotal = round2(subtotal + ppn - diskonVal + materaiVal);
        const totalInvoice = (b.total_invoice !== null && b.total_invoice !== undefined && b.total_invoice !== '')
            ? round2(b.total_invoice)
            : computedTotal;
        const uangMasuk = round2(uang_masuk);

        let dealer = null;
        if (dealer_id) dealer = await knex('invoice_dealers').where('id', dealer_id).first();

        if (tipe === 'CBD' && Math.abs(uangMasuk - totalInvoice) > 0.01) {
            return res.status(400).json({ error: 'CBD harus balance', details: [`Uang masuk (${uangMasuk.toLocaleString('id-ID')}) harus sama dengan total invoice (${totalInvoice.toLocaleString('id-ID')})`] });
        }
        if (tipe === 'PP') {
            const ppType = b.pp_type || 'dp';
            if (ppType === 'dp') {
                if (!(totalInvoice > 0)) return res.status(400).json({ error: 'Total invoice (full amount) wajib diisi untuk PP (DP)', details: [] });
                if (!(uangMasuk > 0)) return res.status(400).json({ error: 'Uang masuk (DP) wajib diisi untuk PP (DP)', details: [] });
                if (!(uangMasuk < totalInvoice)) return res.status(400).json({ error: 'Uang masuk (DP) harus lebih kecil dari total invoice', details: ['DP adalah sebagian dari total'] });
            } else if (ppType === 'pelunasan') {
                if (!b.pelunasan_of_id) return res.status(400).json({ error: 'Pilih No. PO DP yang akan dilunasi', details: [] });
                if (!(uangMasuk > 0)) return res.status(400).json({ error: 'Jumlah uang pelunasan wajib diisi', details: [] });
                const group = await getPpGroupInfo(knex, b.pelunasan_of_id, req.params?.id ? Number(req.params.id) : null);
                if (!group) return res.status(400).json({ error: 'Referensi PO DP tidak valid', details: [] });
                // Daftar barang (total_invoice) pelunasan HARUS sama dengan full amount DP.
                if (Math.abs(totalInvoice - group.full) > 0.01) {
                    return res.status(400).json({ error: 'Daftar barang pelunasan harus sama dengan full amount DP', details: [`Total barang pelunasan: ${totalInvoice.toLocaleString('id-ID')} harus sama dengan full amount DP: ${group.full.toLocaleString('id-ID')}. Yang boleh beda hanya amount (uang masuk), bukan daftar barang.`] });
                }
                if (uangMasuk > group.remaining + 0.01) {
                    return res.status(400).json({ error: 'Pelunasan melebihi sisa full amount', details: [`Sisa full amount: ${group.remaining.toLocaleString('id-ID')}. Pelunasan ini: ${uangMasuk.toLocaleString('id-ID')}`] });
                }
            }
        }

        // No PO tidak boleh sama antar invoice, KECUALI anggota grup PP yang sama (DP + pelunasan = 1 PO).
        // Pelunasan wajib memakai no_po yang sama dengan DP-nya.
        if (tipe === 'PP' && (b.pp_type || 'dp') === 'pelunasan') {
            const dpRef = b.pelunasan_of_id ? await knex('proforma_invoices').where('id', b.pelunasan_of_id).first() : null;
            if (dpRef && String(dpRef.no_po || '').trim() !== String(no_po || '').trim()) {
                return res.status(400).json({ error: 'No. PO pelunasan harus sama dengan No. PO DP', details: [`No. PO DP: ${dpRef.no_po || '-'}`] });
            }
            const dupPo = await findNoPoConflict(knex, no_po, { excludeId: id, groupId: b.pelunasan_of_id });
            if (dupPo) return res.status(400).json({ error: 'No. PO sudah pernah diinput', details: [`PO ${no_po} dipakai invoice #${dupPo.id} (${dupPo.dealer_name || '-'}) di luar grup PP ini.`] });
        } else {
            // Untuk edit DP (tipe PP, bukan pelunasan), pelunasan-nya berbagi no_po yang sama → izinkan grup sendiri.
            const dpGroupId = (tipe === 'PP' && (b.pp_type || 'dp') !== 'pelunasan') ? id : null;
            const dupPo = await findNoPoConflict(knex, no_po, { excludeId: id, groupId: dpGroupId });
            if (dupPo) return res.status(400).json({ error: 'No. PO sudah pernah diinput', details: [`PO ${no_po} dipakai invoice #${dupPo.id} (${dupPo.dealer_name || '-'}). Batalkan invoice lama untuk mengulang PO.`] });
        }

        const trx = await knex.transaction();
        try {
            await trx('proforma_invoices').where('id', id).update({
                dealer_id: dealer_id || null,
                dealer_name: dealer_name || dealer?.nama || '',
                dealer_npwp: dealer_npwp || dealer?.npwp || '',
                dealer_alamat: dealer_alamat || dealer?.alamat || '',
                no_po: no_po || '',
                tgl_po: tgl_po || null,
                tipe,
                pp_type: tipe === 'PP' ? (b.pp_type || 'dp') : null,
                pelunasan_of_id: (tipe === 'PP' && b.pp_type === 'pelunasan') ? (b.pelunasan_of_id || null) : null,
                tgl_transaksi: tgl_transaksi || null,
                uang_masuk: uangMasuk,
                tgl_uang_masuk: tgl_uang_masuk || null,
                subtotal,
                ppn,
                ppn_rate: ppnCustom ? null : ppnRate,
                ppn_custom: ppnCustom,
                diskon: diskonVal,
                materai: materaiVal,
                total_invoice: totalInvoice,
                updated_at: new Date(),
            });
            await trx('proforma_invoice_items').where('invoice_id', id).del();
            for (const it of items) {
                await trx('proforma_invoice_items').insert({
                    invoice_id: id,
                    model: it.model,
                    item_description: it.item_description || '',
                    harga: round2(it.harga),
                    qty: it.qty || 1,
                    ppn_rate: parseFloat(it.ppn_rate) || 0.11,
                    ppn_override: it.ppn_override != null && it.ppn_override !== '' ? parseFloat(it.ppn_override) : null,
                    subtotal: round2(it.harga) * (it.qty || 1),
                });
            }
            // Jika no_po DP diubah, sinkronkan ke semua pelunasan grup agar tetap 1 no_po.
            if (tipe === 'PP' && (b.pp_type || 'dp') !== 'pelunasan' && no_po && inv.no_po !== no_po) {
                await trx('proforma_invoices').where('pelunasan_of_id', id).update({ no_po, updated_at: new Date() });
            }
            await trx.commit();
            const invoice = await knex('proforma_invoices').where('id', id).first();
            const itemRows = await knex('proforma_invoice_items').where('invoice_id', id);
            res.json({ ...invoice, items: itemRows });
        } catch (e) {
            await trx.rollback();
            throw e;
        }
    } catch (err) {
        res.status(500).json({ error: 'Gagal update invoice', details: [err.message] });
    }
});

// ─── Soft delete Proforma + invoice-nya (dipindah ke Sampah, bisa di-restore) ──
router.delete('/proforma/:id', async (req, res) => {
    try {
        if (!isSuper(req.authUser)) {
            return res.status(403).json({ error: 'Hanya admin yang dapat menghapus proforma' });
        }
        const { id } = req.params;
        const proforma = await knex('proforma_requests').where('id', id).first();
        if (!proforma) return res.status(404).json({ error: 'Proforma tidak ditemukan' });
        if (proforma.deleted_at) return res.status(400).json({ error: 'Proforma sudah ada di Sampah' });

        const who = getUsername(req);
        const now = new Date();
        const invIds = Array.isArray(proforma.invoice_ids) ? proforma.invoice_ids : [];
        await knex('proforma_invoices')
            .whereIn('id', invIds)
            .whereNull('deleted_at')
            .update({ deleted_at: now, deleted_by: who });
        await knex('proforma_requests').where('id', id).update({ deleted_at: now, deleted_by: who });

        await systemLog(who, 'Hapus Proforma (Sampah)', `Proforma #${id} (${proforma.proforma_no || '-'}) + ${invIds.length} invoice dipindah ke Sampah`,
            { status: proforma.status, total: proforma.total_nominal }, null);
        res.json({ ok: true, deletedInvoices: invIds.length });
    } catch (err) {
        res.status(500).json({ error: 'Gagal hapus proforma', details: [err.message] });
    }
});

// ─── Restore Proforma + invoice-nya (khusus admin) ─────────────────────────────
router.post('/proforma/:id/restore', async (req, res) => {
    try {
        if (!isSuper(req.authUser)) return res.status(403).json({ error: 'Hanya admin yang dapat mengembalikan proforma' });
        const { id } = req.params;
        const proforma = await knex('proforma_requests').where('id', id).first();
        if (!proforma) return res.status(404).json({ error: 'Proforma tidak ditemukan' });
        if (!proforma.deleted_at) return res.status(400).json({ error: 'Proforma tidak berada di Sampah' });

        const invIds = Array.isArray(proforma.invoice_ids) ? proforma.invoice_ids : [];
        await knex('proforma_invoices')
            .whereIn('id', invIds)
            .update({ deleted_at: null, deleted_by: null });
        await knex('proforma_requests').where('id', id).update({ deleted_at: null, deleted_by: null });

        await systemLog(getUsername(req), 'Restore Proforma', `Proforma #${id} (${proforma.proforma_no || '-'}) + ${invIds.length} invoice dikembalikan dari Sampah`, null, null);
        res.json({ ok: true, restoredInvoices: invIds.length });
    } catch (err) {
        res.status(500).json({ error: 'Gagal restore proforma', details: [err.message] });
    }
});

// ─── Hapus PERMANEN Proforma + seluruh invoice (khusus admin, dari Sampah) ────
router.delete('/proforma/:id/permanent', async (req, res) => {
    try {
        if (!isSuper(req.authUser)) return res.status(403).json({ error: 'Hanya admin yang dapat menghapus permanen proforma' });
        const { id } = req.params;
        const proforma = await knex('proforma_requests').where('id', id).first();
        if (!proforma) return res.status(404).json({ error: 'Proforma tidak ditemukan' });
        if (!proforma.deleted_at) return res.status(400).json({ error: 'Proforma harus di Sampah dulu sebelum dihapus permanen' });

        const invIds = Array.isArray(proforma.invoice_ids) ? proforma.invoice_ids : [];
        for (const invId of invIds) {
            const inv = await knex('proforma_invoices').where('id', invId).first();
            if (inv?.rejected_from_id) {
                await knex('proforma_invoices').where('id', inv.rejected_from_id).update({ replacement_id: null });
            }
            await knex('proforma_invoice_items').where('invoice_id', invId).del();
            await knex('proforma_invoices').where('id', invId).del();
        }
        await knex('proforma_requests').where('id', id).del();

        await systemLog(getUsername(req), 'Hapus Permanen Proforma', `Proforma #${id} (${proforma.proforma_no || '-'}) + ${invIds.length} invoice dihapus permanen`, null, null);
        res.json({ ok: true, deletedInvoices: invIds.length });
    } catch (err) {
        res.status(500).json({ error: 'Gagal hapus permanen proforma', details: [err.message] });
    }
});

// ─── Soft delete Invoice (dipindah ke Sampah, bisa di-restore) — khusus admin ──
router.delete('/:id', async (req, res) => {
    try {
        if (!isSuper(req.authUser)) {
            return res.status(403).json({ error: 'Hanya admin yang dapat menghapus invoice' });
        }
        const { id } = req.params;
        const inv = await knex('proforma_invoices').where('id', id).first();
        if (!inv) return res.status(404).json({ error: 'Invoice tidak ditemukan' });
        if (inv.deleted_at) return res.status(400).json({ error: 'Invoice sudah ada di Sampah' });

        const who = getUsername(req);
        await knex('proforma_invoices').where('id', id).update({ deleted_at: new Date(), deleted_by: who });
        await systemLog(who, 'Hapus Invoice (Sampah)', `Invoice #${id}${inv.no_invoice ? ' (' + inv.no_invoice + ')' : ''} dipindah ke Sampah`,
            { status: inv.status, no_po: inv.no_po, total: inv.total_invoice }, null);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Gagal hapus invoice', details: [err.message] });
    }
});

// ─── Restore Invoice dari Sampah (khusus admin) ────────────────────────────────
router.post('/:id/restore', async (req, res) => {
    try {
        if (!isSuper(req.authUser)) return res.status(403).json({ error: 'Hanya admin yang dapat mengembalikan invoice' });
        const { id } = req.params;
        const inv = await knex('proforma_invoices').where('id', id).first();
        if (!inv) return res.status(404).json({ error: 'Invoice tidak ditemukan' });
        if (!inv.deleted_at) return res.status(400).json({ error: 'Invoice tidak berada di Sampah' });

        await knex('proforma_invoices').where('id', id).update({ deleted_at: null, deleted_by: null });
        await systemLog(getUsername(req), 'Restore Invoice', `Invoice #${id}${inv.no_invoice ? ' (' + inv.no_invoice + ')' : ''} dikembalikan dari Sampah`, null, null);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Gagal restore invoice', details: [err.message] });
    }
});

// ─── Hapus PERMANEN Invoice (khusus admin, dari Sampah) ─────────────────────────
router.delete('/:id/permanent', async (req, res) => {
    try {
        if (!isSuper(req.authUser)) return res.status(403).json({ error: 'Hanya admin yang dapat menghapus permanen invoice' });
        const { id } = req.params;
        const inv = await knex('proforma_invoices').where('id', id).first();
        if (!inv) return res.status(404).json({ error: 'Invoice tidak ditemukan' });
        if (!inv.deleted_at) return res.status(400).json({ error: 'Invoice harus di Sampah dulu sebelum dihapus permanen' });

        // Bersihkan referensi invoice ini dari proforma (invoice_ids JSON)
        try {
            const linkedReqs = await knex('proforma_requests')
                .whereRaw('invoice_ids::text LIKE ?', [`%"${id}"%`]);
            for (const r of linkedReqs) {
                const ids = (Array.isArray(r.invoice_ids) ? r.invoice_ids : [])
                    .filter(i => Number(i) !== Number(id));
                if (ids.length === 0) {
                    await knex('proforma_requests').where('id', r.id).del();
                } else {
                    await knex('proforma_requests').where('id', r.id).update({ invoice_ids: JSON.stringify(ids) });
                }
            }
        } catch (cleanupErr) {
            console.error('[invoice] Gagal bersihkan referensi proforma:', cleanupErr.message);
        }
        // Reset relasi pengganti di invoice asal
        if (inv.rejected_from_id) {
            await knex('proforma_invoices').where('id', inv.rejected_from_id).update({ replacement_id: null });
        }
        await knex('proforma_invoice_items').where('invoice_id', id).del();
        await knex('proforma_invoices').where('id', id).del();

        await systemLog(getUsername(req), 'Hapus Permanen Invoice', `Invoice #${id}${inv.no_invoice ? ' (' + inv.no_invoice + ')' : ''} dihapus permanen dari Sampah`, null, null);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Gagal hapus permanen invoice', details: [err.message] });
    }
});

// ─── Cancel Invoice (batalkan, simpan history) ───────────────────────────────
router.post('/:id/cancel', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_cancel) return res.status(403).json({ error: 'Anda tidak memiliki akses batalkan invoice', details: [] });
        const { id } = req.params;
        const inv = await knex('proforma_invoices').where('id', id).first();
        if (!inv) return res.status(404).json({ error: 'Invoice tidak ditemukan' });
        if (inv.status === 'cancelled') return res.status(400).json({ error: 'Invoice sudah dibatalkan', details: [] });
        if (inv.status === 'settled') return res.status(400).json({ error: 'Invoice sudah settle, tidak bisa dibatalkan', details: [] });

        const basePo = String(inv.no_po || '').replace(/_batal\d*$/, '');
        // No PO tidak boleh sama (kecuali tipe PP). Buat suffix unik: _batal001, _batal002, dst.
        const noPoBatal = await nextBatalNumber('no_po', basePo, 'po');
        const baseProf = String(inv.proforma_no || '').replace(/_batal\d*$/, '');
        const proformaBatal = await nextBatalNumber('proforma_no', baseProf, 'noproforma');

        const now = new Date();
        await knex('proforma_invoices').where('id', id).update({
            status: 'cancelled',
            no_po: noPoBatal,
            proforma_no: proformaBatal,
            cancelled_at: now,
            cancelled_by: getUsername(req),
            updated_at: now,
        });
        const row = await knex('proforma_invoices').where('id', id).first();
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: 'Gagal membatalkan invoice', details: [err.message] });
    }
});

// ─── Proforma Flow ──────────────────────────────────────────────────────────
router.post('/proforma', upload.array('attachments', 10), async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_proforma) return res.status(403).json({ error: 'Anda tidak memiliki akses ajukan proforma', details: [] });
        const b = req.body || {};
        let invoiceIds = parseJsonArraySafeStr(b.invoice_ids);
        if (b.invoice_id) invoiceIds = [Number(b.invoice_id)];
        if (!Array.isArray(invoiceIds) || !invoiceIds.length) return res.status(400).json({ error: 'Pilih minimal satu invoice', details: [] });

        const invoices = await knex('proforma_invoices').whereIn('id', invoiceIds);
        if (!invoices.length) return res.status(400).json({ error: 'Invoice tidak ditemukan', details: [] });
        const allReqs = await knex('proforma_requests').select('invoice_ids', 'status');
        const alreadyInProforma = new Set();
        allReqs.forEach(r => {
            if (r.status === 'pending' || r.status === 'approved') {
                parseJsonArraySafeStr(r.invoice_ids).forEach(i => alreadyInProforma.add(Number(i)));
            }
        });
        for (const inv of invoices) {
            if (inv.status === 'rejected') return res.status(400).json({ error: `Invoice #${inv.id} sudah di-reject dan tidak dapat diajukan ulang`, details: [] });
            if (inv.status !== 'submitted' && inv.status !== 'sent_back') return res.status(400).json({ error: `Invoice #${inv.id} bukan status submitted`, details: [] });
            if (alreadyInProforma.has(Number(inv.id))) return res.status(400).json({ error: `Invoice #${inv.id} sudah ada di pengajuan proforma`, details: [] });
        }
        // Total nominal: tiap invoice dihitung sendiri (DP & pelunasan terpisah).
        // PP/pelunasan pakai nilai uang_masuk (bagian yang dibayar), CBD/PF pakai total_invoice.
        const totalNominal = round2(invoices.reduce((s, i) => {
            if (i.tipe === 'PP') return s + round2(i.uang_masuk);
            return s + round2(i.total_invoice);
        }, 0));
        const keepFiles = parseJsonArraySafeStr(b.keep_attachments || '[]');
        const files = [...keepFiles, ...(req.files || []).map(f => f.filename)];
        if (!files.length) return res.status(400).json({ error: 'Lampiran wajib diunggah', details: ['Unggah minimal satu file pendukung'] });

        const [{ id }] = await knex('proforma_requests').insert({
            proforma_no: null,
            invoice_ids: JSON.stringify(invoiceIds),
            total_nominal: totalNominal,
            status: 'pending',
            attachments: JSON.stringify(files),
            requested_by: getUsername(req),
            requested_at: new Date(),
        }).returning('id');
        const row = await knex('proforma_requests').where('id', id).first();
        try { await notifyFlowEvent(knex, 'proforma_pending', { requester: getUsername(req), proforma: row, invoices }); } catch {}
        res.status(201).json(row);
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengajukan proforma', details: [err.message] });
    }
});

router.get('/proforma/list', async (req, res) => {
    try {
        const rows = await knex('proforma_requests').whereNull('deleted_at').orderBy('id', 'desc');
        const items = [];
        for (const p of rows) {
            const ids = parseJsonArraySafeStr(p.invoice_ids);
            const invs = ids.length ? await knex('proforma_invoices').whereIn('id', ids).whereNull('deleted_at') : [];
            items.push({ ...p, invoices: invs });
        }
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengambil proforma', details: [err.message] });
    }
});

router.post('/proforma/:id/attachments', upload.array('attachments', 10), async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_proforma) return res.status(403).json({ error: 'Anda tidak memiliki akses ajukan proforma', details: [] });
        const { id } = req.params;
        const p = await knex('proforma_requests').where('id', id).first();
        if (!p) return res.status(404).json({ error: 'Proforma tidak ditemukan', details: [] });
        if (p.status !== 'pending') return res.status(400).json({ error: 'Lampiran hanya bisa ditambahkan saat proforma masih pending', details: [] });
        const files = (req.files || []).map(f => f.filename);
        if (!files.length) return res.status(400).json({ error: 'Pilih minimal satu file', details: [] });
        let existing = [];
        try { existing = JSON.parse(p.attachments || '[]'); } catch { existing = []; }
        if (!Array.isArray(existing)) existing = [];
        const merged = [...existing, ...files];
        await knex('proforma_requests').where('id', id).update({ attachments: JSON.stringify(merged), updated_at: new Date() });
        const row = await knex('proforma_requests').where('id', id).first();
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: 'Gagal menambah lampiran', details: [err.message] });
    }
});

router.post('/proforma/:id/approve', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_approve) return res.status(403).json({ error: 'Anda tidak memiliki akses approve proforma', details: [] });
        const { id } = req.params;
        const p = await knex('proforma_requests').where('id', id).first();
        if (!p) return res.status(404).json({ error: 'Proforma tidak ditemukan' });
        if (p.status !== 'pending') return res.status(400).json({ error: 'Hanya proforma pending yang bisa di-approve', details: [] });

        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const proformaNo = await nextRunningNumber(knex, `${yyyy}${mm}${dd}`);

        const trx = await knex.transaction();
        try {
            await trx('proforma_requests').where('id', id).update({
                proforma_no: proformaNo,
                status: 'approved',
                approved_by: getUsername(req),
                approved_at: now,
            });
            const ids = parseJsonArraySafeStr(p.invoice_ids);
            await trx('proforma_invoices').whereIn('id', ids).update({ status: 'proforma', proforma_no: proformaNo, updated_at: now });
            await trx.commit();
        } catch (e) {
            await trx.rollback();
            throw e;
        }
        const row = await knex('proforma_requests').where('id', id).first();
        try {
            const ids = parseJsonArraySafeStr(p.invoice_ids);
            const invs = ids.length ? await knex('proforma_invoices').whereIn('id', ids) : [];
            await notifyFlowEvent(knex, 'proforma_approved', { requester: getUsername(req), proforma: row, invoices: invs });
        } catch {}
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: 'Gagal approve proforma', details: [err.message] });
    }
});

router.post('/proforma/:id/reject', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_approve) return res.status(403).json({ error: 'Anda tidak memiliki akses reject proforma', details: [] });
        const { id } = req.params;
        const p = await knex('proforma_requests').where('id', id).first();
        if (!p) return res.status(404).json({ error: 'Proforma tidak ditemukan' });
        if (!['pending', 'approved'].includes(p.status)) return res.status(400).json({ error: 'Hanya proforma pending atau approved yang bisa di-reject', details: [] });
        const notes = req.body?.notes || '';
        const ids = parseJsonArraySafeStr(p.invoice_ids);
        await knex('proforma_requests').where('id', id).update({
            status: 'rejected',
            approved_by: getUsername(req),
            approved_at: new Date(),
            notes,
        });
        const row = await knex('proforma_requests').where('id', id).first();
        if (ids.length) {
            await knex('proforma_invoices').whereIn('id', ids).update({ status: 'rejected', updated_at: new Date() });
            // Buat invoice pengganti untuk tiap invoice yang ditolak (agar riwayat terbaca)
            const rejectedInvs = await knex('proforma_invoices').whereIn('id', ids);
            for (const inv of rejectedInvs) {
                try {
                    await duplicateInvoiceForReject(knex, inv, getUsername(req));
                } catch (dupErr) {
                    console.error('[Invoice] Gagal membuat invoice pengganti dari reject proforma:', dupErr.message);
                }
            }
        }
        try {
            const invs = ids.length ? await knex('proforma_invoices').whereIn('id', ids) : [];
            await notifyFlowEvent(knex, 'proforma_rejected', { requester: getUsername(req), proforma: row, invoices: invs, notes });
            await emailProformaRequester(knex, 'proforma_rejected', row, invs, notes);
        } catch {}
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: 'Gagal reject proforma', details: [err.message] });
    }
});

// ─── Proforma Sendback (kembalikan ke requester untuk diperbaiki) ────────────
router.post('/proforma/:id/sendback', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_approve) return res.status(403).json({ error: 'Anda tidak memiliki akses sendback proforma', details: [] });
        const { id } = req.params;
        const p = await knex('proforma_requests').where('id', id).first();
        if (!p) return res.status(404).json({ error: 'Proforma tidak ditemukan', details: [] });
        if (!['pending', 'approved'].includes(p.status)) return res.status(400).json({ error: 'Hanya proforma pending atau approved yang bisa di-sendback', details: [] });
        const notes = req.body?.notes || '';
        if (!notes.trim()) return res.status(400).json({ error: 'Alasan sendback wajib diisi', details: [] });
        const ids = parseJsonArraySafeStr(p.invoice_ids);
        await knex('proforma_requests').where('id', id).update({
            status: 'sent_back',
            sendback_notes: notes,
            approved_by: getUsername(req),
            approved_at: new Date(),
        });
        const row = await knex('proforma_requests').where('id', id).first();
        if (ids.length) {
            await knex('proforma_invoices').whereIn('id', ids).update({ status: 'sent_back', updated_at: new Date() });
        }
        try {
            const invs = ids.length ? await knex('proforma_invoices').whereIn('id', ids) : [];
            await notifyFlowEvent(knex, 'proforma_sent_back', { requester: getUsername(req), proforma: row, invoices: invs, notes });
            await emailProformaRequester(knex, 'proforma_sent_back', row, invs, notes);
        } catch {}
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: 'Gagal sendback proforma', details: [err.message] });
    }
});

// ─── Tes Email (tombol dummy untuk cek apakah email berjalan) ────────────────
router.post('/test-email', async (req, res) => {
    try {
        const target = String(req.body?.email || req.authUser?.email || process.env.MAIL_TO || '').trim() || 'test@example.com';
        const subject = 'Tes Email Notifikasi Approval';
        const html = '<h3>Email uji coba terkirim</h3><p>Jika Anda menerima email ini, konfigurasi email (SMTP) pada sistem berjalan dengan baik.</p>';
        const r = await sendMail({ to: target, subject, html });
        res.json({ ok: true, configured: isMailConfigured(), simulated: r.simulated, to: target, messageId: r.messageId });
    } catch (err) {
        res.status(500).json({ error: 'Gagal tes email', details: [err.message] });
    }
});

// ─── Kirim Notifikasi Email ke Approver (pengajuan proforma menunggu approve) ──
router.post('/proforma/:id/notify', async (req, res) => {
    try {
        const { id } = req.params;
        const p = await knex('proforma_requests').where('id', id).first();
        if (!p) return res.status(404).json({ error: 'Proforma tidak ditemukan', details: [] });
        const ids = parseJsonArraySafeStr(p.invoice_ids);
        const invoices = ids.length ? await knex('proforma_invoices').whereIn('id', ids) : [];
        const fmtId = new Intl.NumberFormat('id-ID');

        const users = await knex('users').select('id', 'username', 'name', 'role', 'email');
        const approvers = [];
        for (const u of users) {
            const perms = await getUserInvoicePerms(u);
            if (perms.can_approve) approvers.push(u);
        }
        const withEmail = approvers.filter(u => u.email && String(u.email).trim());

        const subject = `[PENTING] Pengajuan Proforma ${p.proforma_no || '#' + p.id} menunggu approval`;
        const rowsHtml = invoices.map(inv =>
            `<li>Invoice #${inv.id} • ${inv.dealer_name || '-'} • PO ${inv.no_po || '-'} • Rp ${fmtId.format(inv.total_invoice)}</li>`
        ).join('') || '<li>Tidak ada invoice</li>';
        const html = `
            <h3>Ada pengajuan proforma yang menunggu approval</h3>
            <p><b>No Proforma:</b> ${p.proforma_no || 'Belum ada (pending)'}</p>
            <p><b>Diajukan oleh:</b> ${p.requested_by || '-'} • <b>Total:</b> Rp ${fmtId.format(p.total_nominal)}</p>
            <p><b>Daftar invoice:</b></p>
            <ul>${rowsHtml}</ul>
            <p>Silakan buka aplikasi untuk melakukan <b>approve</b>.</p>
        `.replace(/\n\s*/g, ' ');

        const sent = [];
        for (const u of withEmail) {
            const r = await sendMail({ to: u.email.trim(), subject, html });
            sent.push({ username: u.username, email: u.email.trim(), simulated: r.simulated, messageId: r.messageId });
            await knex('notifications').insert({
                title: subject,
                message: `Pengajuan proforma ${p.proforma_no || '#' + p.id} menunggu approval (total Rp ${fmtId.format(p.total_nominal)})`,
                type: 'approval',
                channel: 'system',
                target_type: 'user',
                target_value: u.username,
                created_by: getUsername(req),
                created_at: knex.fn.now(),
            }).onConflict().ignore();
        }
        // Notifikasi in-app untuk semua (general) sebagai pengingat tambahan
        await knex('notifications').insert({
            title: subject,
            message: `Pengajuan proforma ${p.proforma_no || '#' + p.id} menunggu approval (total Rp ${fmtId.format(p.total_nominal)})`,
            type: 'approval',
            channel: 'system',
            target_type: 'general',
            target_value: null,
            created_by: getUsername(req),
            created_at: knex.fn.now(),
        }).onConflict().ignore();

        res.json({
            ok: true,
            proforma_id: p.id,
            total_approvers: approvers.length,
            with_email: withEmail.length,
            configured: isMailConfigured(),
            sent,
            simulated: sent.length ? sent.every(s => s.simulated) : null,
        });
    } catch (err) {
        res.status(500).json({ error: 'Gagal kirim notifikasi email', details: [err.message] });
    }
});

// ─── Submit Tax Request (pengajuan ke bagian tax) ─────────────────────────────
router.post('/:id/submit-tax', upload.array('attachments', 10), async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_tax_request) return res.status(403).json({ error: 'Anda tidak memiliki akses ajukan faktur pajak', details: [] });
        const { id } = req.params;
        const inv = await knex('proforma_invoices').where('id', id).first();
        if (!inv) return res.status(404).json({ error: 'Invoice tidak ditemukan' });
        if (!inv.proforma_no) return res.status(400).json({ error: 'Invoice belum memiliki no proforma', details: ['Tunggu approval proforma terlebih dahulu'] });
        if (inv.status === 'tax_requested') return res.status(400).json({ error: 'Invoice sudah diajukan ke tax', details: [] });
        if (inv.status === 'tax' || inv.status === 'settled') return res.status(400).json({ error: 'Invoice sudah selesai', details: [] });
        const files = (req.files || []).map(f => f.filename);
        if (!files.length) return res.status(400).json({ error: 'Lampiran wajib diunggah', details: ['Unggah minimal satu file pendukung'] });
        const notes = req.body?.notes || '';
        await knex('proforma_invoices').where('id', id).update({
            status: 'tax_requested',
            tax_request_attachments: JSON.stringify(files),
            tax_request_notes: notes || null,
            tax_requested_at: knex.fn.now(),
            tax_requested_by: getUsername(req),
            tax_sendback_at: null,
            updated_at: knex.fn.now(),
        });
        const row = await knex('proforma_invoices').where('id', id).first();
        try { await notifyFlowEvent(knex, 'tax_requested', { requester: getUsername(req), invoice: row }); } catch {}
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengajukan tax', details: [err.message] });
    }
});

// ─── Tax Sendback (kembalikan ke requester) ──────────────────────────────────
router.post('/:id/tax/sendback', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_tax_sendback) return res.status(403).json({ error: 'Anda tidak memiliki akses sendback faktur pajak', details: [] });
        const { id } = req.params;
        const inv = await knex('proforma_invoices').where('id', id).first();
        if (!inv) return res.status(404).json({ error: 'Invoice tidak ditemukan', details: [] });
        if (inv.status !== 'tax_requested') return res.status(400).json({ error: 'Hanya invoice tax_requested yang bisa di-sendback', details: [] });
        const notes = req.body?.notes || '';
        if (!notes.trim()) return res.status(400).json({ error: 'Alasan sendback wajib diisi', details: [] });
        await knex('proforma_invoices').where('id', id).update({
            status: 'sent_back_tax',
            tax_request_notes: notes,
            tax_sendback_at: knex.fn.now(),
            tax_sendback_by: getUsername(req),
            updated_at: knex.fn.now(),
        });
        const row = await knex('proforma_invoices').where('id', id).first();
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: 'Gagal sendback tax', details: [err.message] });
    }
});

// ─── Tax Reject (tolak request faktur pajak) ─────────────────────────────────
router.post('/:id/tax/reject', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_tax) return res.status(403).json({ error: 'Anda tidak memiliki akses reject faktur pajak', details: [] });
        const { id } = req.params;
        const inv = await knex('proforma_invoices').where('id', id).first();
        if (!inv) return res.status(404).json({ error: 'Invoice tidak ditemukan', details: [] });
        if (inv.status !== 'tax_requested' && inv.status !== 'proforma') return res.status(400).json({ error: 'Hanya invoice tax_requested yang bisa di-reject', details: [] });
        const notes = req.body?.notes || '';
        if (!notes.trim()) return res.status(400).json({ error: 'Alasan reject wajib diisi', details: [] });
        await knex('proforma_invoices').where('id', id).update({
            status: 'rejected',
            tax_reject_notes: notes,
            tax_rejected_at: knex.fn.now(),
            tax_rejected_by: getUsername(req),
            updated_at: knex.fn.now(),
        });
        const row = await knex('proforma_invoices').where('id', id).first();
        // Buat invoice pengganti (salinan) yang berelasi dengan invoice yang ditolak
        let replacementId = null;
        try {
            replacementId = await duplicateInvoiceForReject(knex, row, getUsername(req));
        } catch (dupErr) {
            console.error('[Invoice] Gagal membuat invoice pengganti dari reject:', dupErr.message);
        }
        try { await notifyFlowEvent(knex, 'tax_rejected', { requester: getUsername(req), invoice: row, notes }); } catch {}
        res.json({ ...row, replacement_id: replacementId || row.replacement_id });
    } catch (err) {
        res.status(500).json({ error: 'Gagal reject tax', details: [err.message] });
    }
});

// ─── Duplikat invoice rejected on-demand (Input Data Baru) ───────────────────
// Dipakai saat user klik "Input Data Baru" pada invoice rejected yang belum
// punya replacement (mis. di-reject sebelum fitur riwayat dipasang).
// Idempotent: jika sudah ada pengganti, kembalikan pengganti yang ada.
router.post('/:id/duplicate-input', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_edit) return res.status(403).json({ error: 'Anda tidak memiliki akses', details: [] });
        const { id } = req.params;
        const inv = await knex('proforma_invoices').where('id', id).first();
        if (!inv) return res.status(404).json({ error: 'Invoice tidak ditemukan', details: [] });
        if (inv.status !== 'rejected') return res.status(400).json({ error: 'Hanya invoice berstatus rejected yang bisa di-input ulang', details: [] });

        // Sudah punya pengganti? Kembalikan yang ada (idempotent)
        if (inv.replacement_id) {
            const existing = await knex('proforma_invoices').where('id', inv.replacement_id).first();
            if (existing) return res.json(existing);
        }

        const newId = await duplicateInvoiceForReject(knex, inv, getUsername(req));
        const row = await knex('proforma_invoices').where('id', newId).first();
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: 'Gagal membuat invoice pengganti', details: [err.message] });
    }
});

// ─── Tax Invoice (Faktur Pajak) Approval ────────────────────────────────────
router.post('/:id/tax', upload.single('faktur_pajak'), async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_tax) return res.status(403).json({ error: 'Anda tidak memiliki akses faktur pajak', details: [] });
        const { id } = req.params;
        const inv = await knex('proforma_invoices').where('id', id).first();
        if (!inv) return res.status(404).json({ error: 'Invoice tidak ditemukan' });
        if (!inv.proforma_no) return res.status(400).json({ error: 'Invoice belum memiliki no proforma', details: ['Ajukan dan tunggu approval proforma terlebih dahulu'] });
        if (inv.status !== 'tax_requested' && inv.status !== 'proforma') return res.status(400).json({ error: 'Invoice belum diajukan ke tax', details: ['Status invoice harus tax_requested'] });
        const file = req.file?.filename || null;
        const fakturNo = String(req.body?.faktur_pajak_no || '').trim();
        if (!fakturNo) return res.status(400).json({ error: 'No faktur pajak wajib diisi', details: [] });
        if (!/^\d{17}$/.test(fakturNo)) return res.status(400).json({ error: 'No faktur pajak harus 17 digit angka', details: ['Contoh: 01000012345678901'] });
        if (!file) return res.status(400).json({ error: 'File faktur pajak wajib dilampirkan', details: [] });
        await knex('proforma_invoices').where('id', id).update({
            status: 'tax',
            faktur_pajak_no: fakturNo,
            faktur_pajak_file: file,
            tax_approved_at: knex.fn.now(),
            tax_approved_by: getUsername(req),
            updated_at: knex.fn.now(),
        });
        const row = await knex('proforma_invoices').where('id', id).first();
        try { await notifyFlowEvent(knex, 'tax_approved', { requester: getUsername(req), invoice: row }); } catch {}
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: 'Gagal simpan faktur pajak', details: [err.message] });
    }
});

// ─── Invoice asli hasil settle dari sebuah proforma ─────────────────────────
router.get('/proforma/:id/settled', async (req, res) => {
    try {
        const { id } = req.params;
        const rows = await knex('settled_invoices').where('proforma_id', Number(id)).orderBy('id', 'asc');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengambil invoice settled', details: [err.message] });
    }
});

// ─── Settle Draft (simpan data partial, belum balance) ──────────────────────
router.get('/proforma/settle/drafts', async (req, res) => {
    try {
        const rows = await knex('settle_drafts').select('proforma_id', 'updated_at');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengambil daftar draft settle', details: [err.message] });
    }
});

router.get('/proforma/:id/settle/draft', async (req, res) => {
    try {
        const { id } = req.params;
        const d = await knex('settle_drafts').where('proforma_id', id).first();
        if (!d) return res.json(null);
        let data = {};
        try { data = JSON.parse(d.data || '{}'); } catch { data = {}; }
        res.json({ proforma_id: d.proforma_id, proforma_no: d.proforma_no, ...data, created_by: d.created_by, updated_at: d.updated_at });
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengambil draft settle', details: [err.message] });
    }
});

router.post('/proforma/:id/settle/draft', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_settle) return res.status(403).json({ error: 'Anda tidak memiliki akses settle', details: [] });
        const { id } = req.params;
        const p = await knex('proforma_requests').where('id', id).first();
        if (!p) return res.status(404).json({ error: 'Proforma tidak ditemukan' });
        if (p.status !== 'approved') return res.status(400).json({ error: 'Draft hanya bisa disimpan saat proforma approved', details: [] });
        const rows = Array.isArray(req.body?.invoices) ? req.body.invoices : [];
        const payload = JSON.stringify({
            rows,
            notes: req.body?.notes || '',
            tgl_settle: req.body?.tgl_settle || '',
        });
        const existing = await knex('settle_drafts').where('proforma_id', id).first();
        if (existing) {
            await knex('settle_drafts').where('proforma_id', id).update({
                data: payload,
                created_by: getUsername(req),
                updated_at: new Date(),
            });
        } else {
            await knex('settle_drafts').insert({
                proforma_id: Number(id),
                proforma_no: p.proforma_no || null,
                data: payload,
                created_by: getUsername(req),
            });
        }
        const row = await knex('settle_drafts').where('proforma_id', id).first();
        let data = {};
        try { data = JSON.parse(row.data || '{}'); } catch { data = {}; }
        res.json({ proforma_id: row.proforma_id, proforma_no: row.proforma_no, ...data, created_by: row.created_by, updated_at: row.updated_at });
    } catch (err) {
        res.status(500).json({ error: 'Gagal menyimpan draft settle', details: [err.message] });
    }
});

router.delete('/proforma/:id/settle/draft', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_settle) return res.status(403).json({ error: 'Anda tidak memiliki akses settle', details: [] });
        const { id } = req.params;
        await knex('settle_drafts').where('proforma_id', id).del();
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Gagal menghapus draft settle', details: [err.message] });
    }
});

// ─── Settle Proforma ────────────────────────────────────────────────────────
// 1 proforma bisa di-settle menjadi 1 atau lebih invoice asli (settled_invoices).
// Setiap baris: no_invoice, tgl_invoice, no faktur (auto proforma_no), DPP, PPn, materai, diskon, tgl_settle.
// Total semua baris harus balance dengan total_nominal proforma.
router.post('/proforma/:id/settle', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_settle) return res.status(403).json({ error: 'Anda tidak memiliki akses settle', details: [] });
        const { id } = req.params;
        const p = await knex('proforma_requests').where('id', id).first();
        if (!p) return res.status(404).json({ error: 'Proforma tidak ditemukan' });
        if (p.status !== 'approved') return res.status(400).json({ error: 'Hanya proforma approved yang bisa di-settle', details: [] });

        const rows = Array.isArray(req.body?.invoices) ? req.body.invoices : [];
        if (!rows.length) return res.status(400).json({ error: 'Minimal satu invoice asli wajib diisi', details: [] });

        const sourceIds = parseJsonArraySafeStr(p.invoice_ids);
        const sourceInvoices = sourceIds.length ? await knex('proforma_invoices').whereIn('id', sourceIds) : [];
        const srcById = Object.fromEntries(sourceInvoices.map(i => [Number(i.id), i]));
        const now = new Date();

        const settled = [];
        for (const [idx, r] of rows.entries()) {
            const noInvoice = String(r.no_invoice || '').trim();
            if (!noInvoice) return res.status(400).json({ error: `Baris #${idx + 1}: No invoice wajib diisi`, details: [] });
            const dup = settled.some(s => String(s.no_invoice) === noInvoice);
            if (dup) return res.status(400).json({ error: `Baris #${idx + 1}: No invoice ${noInvoice} duplikat`, details: [] });

            const subtotal = round2(r.subtotal ?? r.dpp);
            const ppn = round2(r.ppn);
            const ppnRate = parseFloat(r.ppn_rate) || 0.11;
            const ppnCustom = !!(r.ppn_custom === true || r.ppn_custom === 'true');
            const materai = round2(r.materai);
            const diskon = round2(r.diskon);
            const totalInvoice = round2(subtotal + ppn - diskon + materai);
            if (!(subtotal >= 0)) return res.status(400).json({ error: `Baris #${idx + 1}: DPP wajib diisi`, details: [] });

            const src = srcById[Number(r.source_invoice_id)] || null;
            settled.push({
                no_invoice: noInvoice,
                proforma_id: Number(p.id),
                proforma_no: p.proforma_no,
                source_invoice_id: src ? Number(src.id) : null,
                dealer_id: src?.dealer_id || null,
                dealer_name: src?.dealer_name || null,
                dealer_npwp: src?.dealer_npwp || null,
                dealer_alamat: src?.dealer_alamat || null,
                no_po: src?.no_po || null,
                tgl_po: src?.tgl_po || null,
                tipe: src?.tipe || 'CBD',
                tgl_transaksi: r.tgl_invoice || src?.tgl_transaksi || null,
                tgl_invoice: r.tgl_invoice || null,
                uang_masuk: src?.uang_masuk || 0,
                tgl_uang_masuk: src?.tgl_uang_masuk || null,
                subtotal,
                ppn,
                ppn_rate: ppnCustom ? null : ppnRate,
                ppn_custom: ppnCustom,
                diskon,
                materai,
                total_invoice: totalInvoice,
                faktur_pajak_no: String(r.faktur_pajak_no || r.no_faktur || p.proforma_no || '').trim(),
                tgl_settle: r.tgl_settle || now,
                settled_by: getUsername(req),
                settled_at: now,
            });
        }

        const grandTotal = round2(settled.reduce((s, x) => s + x.total_invoice, 0));
        // Nominal per-invoice: PP pakai uang_masuk, CBD/PF pakai total_invoice.
        const totalNominal = round2(sourceInvoices.reduce((s, i) => {
            if (i.tipe === 'PP') return s + round2(i.uang_masuk);
            return s + round2(i.total_invoice);
        }, 0));
        if (Math.abs(grandTotal - totalNominal) > 0.01) {
            return res.status(400).json({
                error: 'Total invoice asli harus balance dengan total proforma',
                details: [`Total proforma: ${totalNominal.toLocaleString('id-ID')} • Total settle: ${grandTotal.toLocaleString('id-ID')}`]
            });
        }

        const existingNo = await knex('settled_invoices').whereIn('no_invoice', settled.map(s => s.no_invoice)).select('no_invoice');
        if (existingNo.length) {
            return res.status(400).json({ error: 'No invoice sudah digunakan', details: existingNo.map(x => x.no_invoice) });
        }

        const trx = await knex.transaction();
        try {
            for (const s of settled) {
                const [{ id: sid }] = await trx('settled_invoices').insert(s).returning('id');
                if (s.source_invoice_id) {
                    const items = await trx('proforma_invoice_items').where('invoice_id', s.source_invoice_id).orderBy('id', 'asc');
                    for (const it of items) {
                        await trx('settled_invoice_items').insert({
                            settled_invoice_id: sid,
                            model: it.model,
                            item_description: it.item_description,
                            harga: it.harga,
                            qty: it.qty,
                            subtotal: it.subtotal,
                        });
                    }
                }
            }
            await trx('proforma_requests').where('id', id).update({
                status: 'settled',
                settled_amount: grandTotal,
                settled_by: getUsername(req),
                settled_at: now,
                notes: req.body?.notes || p.notes || '',
            });
            await trx('proforma_invoices').whereIn('id', sourceIds).update({ status: 'settled', updated_at: now });
            await trx.commit();
        } catch (e) {
            await trx.rollback();
            throw e;
        }
        await knex('settle_drafts').where('proforma_id', id).del();
        const row = await knex('proforma_requests').where('id', id).first();
        try { await notifyFlowEvent(knex, 'settled', { requester: getUsername(req), proforma: row, invoices: sourceInvoices }); } catch {}
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: 'Gagal settle proforma', details: [err.message] });
    }
});

// ─── PDF Pengajuan Proforma (6 tanda tangan) ────────────────────────────────
router.get('/:id/pdf/request', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_print) return res.status(403).json({ error: 'Anda tidak memiliki akses cetak pengajuan proforma', details: [] });
        const { id } = req.params;
        const invoice = await knex('proforma_invoices').where('id', id).first();
        if (!invoice) return res.status(404).json({ error: 'Invoice tidak ditemukan' });
        const { renderInvoicePdf } = await import('../services/pdfTemplateService.js');
        const buf = await renderInvoicePdf(id, 'proforma_request');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="pengajuan_proforma_${invoice.id}.pdf"`);
        res.send(buf);
    } catch (err) {
        if (err.message === 'TIDAK_ADA_TEMPLATE') {
            return res.status(404).json({ error: 'Belum ada template aktif untuk pengajuan proforma' });
        }
        res.status(500).json({ error: 'Gagal render pengajuan proforma', details: [err.message] });
    }
});

// ─── PDF Proforma ───────────────────────────────────────────────────────────
router.get('/:id/pdf', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_print) return res.status(403).json({ error: 'Anda tidak memiliki akses cetak proforma', details: [] });
        const { id } = req.params;
        const invoice = await knex('proforma_invoices').where('id', id).first();
        if (!invoice) return res.status(404).json({ error: 'Invoice tidak ditemukan' });
        const items = await knex('proforma_invoice_items').where('invoice_id', id).orderBy('id', 'asc');

        // Jika ada template aktif (custom designer), render via HTML + Chromium
        const { getActiveTemplate, buildContext, compileHtml, buildPdfShell, renderHtmlToPdf } = await import('../services/pdfTemplateService.js');
        const tpl = await getActiveTemplate('proforma');
        if (tpl) {
            const buf = await renderHtmlToPdf(buildPdfShell(compileHtml(tpl.html, buildContext(invoice, items)), tpl.css));
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="proforma_${invoice.id}.pdf"`);
            return res.send(buf);
        }
        // Fallback: generator pdf-lib bawaan
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const page = pdfDoc.addPage([595, 842]);
        const { width, height } = page.getSize();
        let y = height - 50;

        const money = (n) => round2(n).toLocaleString('id-ID');

        const line = (text, { bold = false, size = 10, color = rgb(0, 0, 0), x = 50 } = {}) => {
            page.drawText(text, { x, y, size, font: bold ? fontBold : font, color });
            y -= size + 6;
        };

        const labelValue = (label, value, boldVal = false) => {
            page.drawText(label, { x: 50, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
            page.drawText(value, { x: 170, y, size: 9, font: boldVal ? fontBold : font });
            y -= 16;
        };

        // Header
        page.drawText('PROFORMA INVOICE', { x: 50, y, size: 18, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        y -= 24;
        page.drawText(invoice.proforma_no || 'No Proforma: -', { x: 50, y, size: 12, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        y -= 30;

        page.drawLine({ start: { x: 50, y: y + 4 }, end: { x: width - 50, y: y + 4 }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
        y -= 14;

        // Dealer info
        labelValue('Nama Dealer', invoice.dealer_name || '-', true);
        labelValue('NPWP', invoice.dealer_npwp || '-');
        labelValue('Alamat', invoice.dealer_alamat || '-');
        labelValue('No. PO', invoice.no_po || '-');
        labelValue('Tgl. PO', invoice.tgl_po ? new Date(invoice.tgl_po).toLocaleDateString('id-ID') : '-');
        labelValue('Tipe', invoice.tipe || '-');
        labelValue('Tgl. Transaksi', invoice.tgl_transaksi ? new Date(invoice.tgl_transaksi).toLocaleDateString('id-ID') : '-');
        y -= 10;

        // Items table
        const tableTop = y;
        page.drawText('No', { x: 50, y: tableTop, size: 9, font: fontBold });
        page.drawText('Model', { x: 75, y: tableTop, size: 9, font: fontBold });
        page.drawText('Deskripsi', { x: 180, y: tableTop, size: 9, font: fontBold });
        page.drawText('Qty', { x: 340, y: tableTop, size: 9, font: fontBold });
        page.drawText('Harga', { x: 380, y: tableTop, size: 9, font: fontBold });
        page.drawText('Subtotal', { x: 470, y: tableTop, size: 9, font: fontBold });
        y = tableTop - 14;
        page.drawLine({ start: { x: 50, y: y + 4 }, end: { x: width - 50, y: y + 4 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });

        items.forEach((it, idx) => {
            page.drawText(String(idx + 1), { x: 50, y, size: 9, font });
            page.drawText(String(it.model || '-'), { x: 75, y, size: 9, font });
            page.drawText(String(it.item_description || '').substring(0, 40), { x: 180, y, size: 9, font });
            page.drawText(String(it.qty || 1), { x: 340, y, size: 9, font });
            page.drawText(money(it.harga), { x: 380, y, size: 9, font });
            page.drawText(money(it.subtotal), { x: 470, y, size: 9, font });
            y -= 14;
        });
        page.drawLine({ start: { x: 50, y: y + 4 }, end: { x: width - 50, y: y + 4 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
        y -= 12;

        // Totals
        const totalsX = 400;
        page.drawText('Subtotal', { x: totalsX, y, size: 9, font });
        page.drawText(money(invoice.subtotal), { x: totalsX + 80, y, size: 9, font, textAlign: 'right' });
        y -= 14;
        page.drawText(`PPN 11%`, { x: totalsX, y, size: 9, font });
        page.drawText(money(invoice.ppn), { x: totalsX + 80, y, size: 9, font });
        y -= 14;
        if (invoice.diskon > 0) {
            page.drawText('Diskon', { x: totalsX, y, size: 9, font });
            page.drawText(`-${money(invoice.diskon)}`, { x: totalsX + 80, y, size: 9, font });
            y -= 14;
        }
        if (invoice.materai > 0) {
            page.drawText('Materai', { x: totalsX, y, size: 9, font });
            page.drawText(money(invoice.materai), { x: totalsX + 80, y, size: 9, font });
            y -= 14;
        }
        page.drawText('TOTAL INVOICE', { x: totalsX - 40, y, size: 11, font: fontBold });
        page.drawText(money(invoice.total_invoice), { x: totalsX + 80, y, size: 11, font: fontBold });
        y -= 20;

        page.drawText(`Uang Masuk: ${money(invoice.uang_masuk)}`, { x: 50, y, size: 10, font: fontBold });
        y -= 18;
        page.drawText(`Dibuat oleh: ${invoice.created_by || '-'}`, { x: 50, y, size: 9, font: font });

        const pdfBytes = await pdfDoc.save();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="proforma_${invoice.id}.pdf"`);
        res.send(Buffer.from(pdfBytes));
    } catch (err) {
        res.status(500).json({ error: 'Gagal export PDF', details: [err.message] });
    }
});

// ─── Download attachment ────────────────────────────────────────────────────
router.get('/files/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(__dirname, '../../uploads', filename);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File tidak ditemukan' });
        res.sendFile(filePath);
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengambil file', details: [err.message] });
    }
});

export default router;
