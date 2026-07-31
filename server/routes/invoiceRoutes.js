import express from 'express';
import { knex } from '../db.js';
import { upload } from '../config/upload.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as XLSX from 'xlsx';

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

async function getUserInvoicePerms(user) {
    const defaults = {
        can_create: true,
        can_approve: true,
        can_tax: true,
        can_manage_master: true,
        can_settle: true,
        can_view: true,
    };
    if (!user) return defaults;
    if (isSuper(user)) return defaults;
    try {
        const rules = await knex('invoice_rules').where('is_active', true);
        if (!rules.length) return defaults;
        const merged = { ...defaults };
        for (const r of rules) {
            let match = false;
            if (r.target_type === 'user' && r.target_value === user.username) match = true;
            if (r.target_type === 'role' && r.target_value === user.role) match = true;
            if (r.target_type === 'division' && r.target_value === (user.department || user.division || '')) match = true;
            if (match) {
                merged.can_create = !!r.can_create;
                merged.can_approve = !!r.can_approve;
                merged.can_tax = !!r.can_tax;
                merged.can_manage_master = !!r.can_manage_master;
                merged.can_settle = !!r.can_settle;
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
        if (!perms.can_manage_master) return res.status(403).json({ error: 'Anda tidak memiliki akses kelola rule', details: [] });
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
        if (!perms.can_manage_master) return res.status(403).json({ error: 'Anda tidak memiliki akses kelola rule', details: [] });
        const b = req.body || {};
        if (!b.target_type || !b.target_value) return res.status(400).json({ error: 'Tipe target dan nilai target wajib diisi', details: [] });
        const [{ id }] = await knex('invoice_rules').insert({
            target_type: b.target_type,
            target_value: String(b.target_value).trim(),
            can_create: b.can_create !== false,
            can_approve: !!b.can_approve,
            can_tax: !!b.can_tax,
            can_manage_master: !!b.can_manage_master,
            can_settle: !!b.can_settle,
            is_active: b.is_active !== false,
        }).returning('id');
        const row = await knex('invoice_rules').where('id', id).first();
        res.status(201).json(row);
    } catch (err) {
        res.status(500).json({ error: 'Gagal simpan rule', details: [err.message] });
    }
});

router.put('/rules/:id', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_manage_master) return res.status(403).json({ error: 'Anda tidak memiliki akses kelola rule', details: [] });
        const { id } = req.params;
        const b = req.body || {};
        await knex('invoice_rules').where('id', id).update({
            target_type: b.target_type,
            target_value: String(b.target_value || '').trim(),
            can_create: b.can_create !== false,
            can_approve: !!b.can_approve,
            can_tax: !!b.can_tax,
            can_manage_master: !!b.can_manage_master,
            can_settle: !!b.can_settle,
            is_active: b.is_active !== false,
            updated_at: knex.fn.now(),
        });
        const row = await knex('invoice_rules').where('id', id).first();
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: 'Gagal update rule', details: [err.message] });
    }
});

router.delete('/rules/:id', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_manage_master) return res.status(403).json({ error: 'Anda tidak memiliki akses kelola rule', details: [] });
        const { id } = req.params;
        await knex('invoice_rules').where('id', id).del();
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Gagal hapus rule', details: [err.message] });
    }
});

router.get('/', async (req, res) => {
    try {
        const rows = await knex('proforma_invoices')
            .select(
                'proforma_invoices.*',
                knex.raw('(SELECT COUNT(*) FROM proforma_invoice_items it WHERE it.invoice_id = proforma_invoices.id) as item_count')
            )
            .orderBy('proforma_invoices.created_at', 'desc');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengambil invoice', details: [err.message] });
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
            const pelunasan = round2(b.pelunasan);
            if (!(totalInvoice > 0)) return res.status(400).json({ error: 'Total invoice (full amount) wajib diisi untuk PP', details: [] });
            if (!(uangMasuk > 0)) return res.status(400).json({ error: 'Uang masuk (DP) wajib diisi untuk PP', details: [] });
            if (!(uangMasuk < totalInvoice)) return res.status(400).json({ error: 'Uang masuk (DP) harus lebih kecil dari total invoice', details: ['DP adalah sebagian dari total'] });
            if (!(pelunasan > 0)) return res.status(400).json({ error: 'Pelunasan wajib diisi untuk PP', details: [] });
            if (Math.abs(uangMasuk + pelunasan - totalInvoice) > 0.01) {
                return res.status(400).json({ error: 'DP + Pelunasan harus sama dengan total invoice', details: [`DP (${uangMasuk.toLocaleString('id-ID')}) + Pelunasan (${pelunasan.toLocaleString('id-ID')}) harus = total invoice (${totalInvoice.toLocaleString('id-ID')})`] });
            }
        }
        if (tipe === 'PF') {
            // Performa First: tidak wajib uang masuk sekarang
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
                    subtotal: round2(it.harga) * (it.qty || 1),
                });
            }

            await trx.commit();
            const invoice = await knex('proforma_invoices').where('id', id).first();
            const itemRows = await knex('proforma_invoice_items').where('invoice_id', id);
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
            const pelunasan = round2(b.pelunasan);
            if (!(totalInvoice > 0)) return res.status(400).json({ error: 'Total invoice (full amount) wajib diisi untuk PP', details: [] });
            if (!(uangMasuk > 0)) return res.status(400).json({ error: 'Uang masuk (DP) wajib diisi untuk PP', details: [] });
            if (!(uangMasuk < totalInvoice)) return res.status(400).json({ error: 'Uang masuk (DP) harus lebih kecil dari total invoice', details: ['DP adalah sebagian dari total'] });
            if (!(pelunasan > 0)) return res.status(400).json({ error: 'Pelunasan wajib diisi untuk PP', details: [] });
            if (Math.abs(uangMasuk + pelunasan - totalInvoice) > 0.01) {
                return res.status(400).json({ error: 'DP + Pelunasan harus sama dengan total invoice', details: [`DP (${uangMasuk.toLocaleString('id-ID')}) + Pelunasan (${pelunasan.toLocaleString('id-ID')}) harus = total invoice (${totalInvoice.toLocaleString('id-ID')})`] });
            }
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
                    subtotal: round2(it.harga) * (it.qty || 1),
                });
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

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const inv = await knex('proforma_invoices').where('id', id).first();
        if (!inv) return res.status(404).json({ error: 'Invoice tidak ditemukan' });
        if (inv.status !== 'submitted') return res.status(400).json({ error: 'Hanya invoice status submitted yang bisa dihapus', details: [] });
        const used = await knex('proforma_requests')
            .where('status', 'pending')
            .whereRaw(`invoice_ids::text LIKE '%"${id}"%'`)
            .first();
        if (used) return res.status(400).json({ error: 'Invoice sedang menunggu approval proforma', details: [] });
        await knex('proforma_invoice_items').where('invoice_id', id).del();
        await knex('proforma_invoices').where('id', id).del();
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Gagal hapus invoice', details: [err.message] });
    }
});

// ─── Proforma Flow ──────────────────────────────────────────────────────────
router.post('/proforma', upload.array('attachments', 10), async (req, res) => {
    try {
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
            if (inv.status !== 'submitted') return res.status(400).json({ error: `Invoice #${inv.id} bukan status submitted`, details: [] });
            if (alreadyInProforma.has(Number(inv.id))) return res.status(400).json({ error: `Invoice #${inv.id} sudah ada di pengajuan proforma`, details: [] });
        }

        const totalNominal = round2(invoices.reduce((s, i) => s + round2(i.total_invoice), 0));
        const files = (req.files || []).map(f => f.filename);

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
        res.status(201).json(row);
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengajukan proforma', details: [err.message] });
    }
});

router.get('/proforma/list', async (req, res) => {
    try {
        const rows = await knex('proforma_requests').orderBy('id', 'desc');
        const items = [];
        for (const p of rows) {
            const ids = parseJsonArraySafeStr(p.invoice_ids);
            const invs = ids.length ? await knex('proforma_invoices').whereIn('id', ids) : [];
            items.push({ ...p, invoices: invs });
        }
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengambil proforma', details: [err.message] });
    }
});

router.post('/proforma/:id/attachments', upload.array('attachments', 10), async (req, res) => {
    try {
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
        if (p.status !== 'pending') return res.status(400).json({ error: 'Hanya proforma pending yang bisa di-reject', details: [] });
        const notes = req.body?.notes || '';
        await knex('proforma_requests').where('id', id).update({
            status: 'rejected',
            approved_by: getUsername(req),
            approved_at: new Date(),
            notes,
        });
        const row = await knex('proforma_requests').where('id', id).first();
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: 'Gagal reject proforma', details: [err.message] });
    }
});

// ─── Submit Tax Request (pengajuan ke bagian tax) ─────────────────────────────
router.post('/:id/submit-tax', async (req, res) => {
    try {
        const { id } = req.params;
        const inv = await knex('proforma_invoices').where('id', id).first();
        if (!inv) return res.status(404).json({ error: 'Invoice tidak ditemukan', details: [] });
        if (!inv.proforma_no) return res.status(400).json({ error: 'Invoice belum memiliki no proforma', details: ['Tunggu approval proforma terlebih dahulu'] });
        if (inv.status === 'tax_requested') return res.status(400).json({ error: 'Invoice sudah diajukan ke tax', details: [] });
        if (inv.status === 'tax' || inv.status === 'settled') return res.status(400).json({ error: 'Invoice sudah selesai', details: [] });
        await knex('proforma_invoices').where('id', id).update({
            status: 'tax_requested',
            updated_at: knex.fn.now(),
        });
        const row = await knex('proforma_invoices').where('id', id).first();
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengajukan tax', details: [err.message] });
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
        const fakturNo = req.body?.faktur_pajak_no || '';
        await knex('proforma_invoices').where('id', id).update({
            status: 'tax',
            faktur_pajak_no: fakturNo,
            faktur_pajak_file: file,
            updated_at: knex.fn.now(),
        });
        const row = await knex('proforma_invoices').where('id', id).first();
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: 'Gagal simpan faktur pajak', details: [err.message] });
    }
});

// ─── Settle Proforma ────────────────────────────────────────────────────────
router.post('/proforma/:id/settle', async (req, res) => {
    try {
        const perms = await getUserInvoicePerms(req.authUser);
        if (!perms.can_settle) return res.status(403).json({ error: 'Anda tidak memiliki akses settle', details: [] });
        const { id } = req.params;
        const p = await knex('proforma_requests').where('id', id).first();
        if (!p) return res.status(404).json({ error: 'Proforma tidak ditemukan' });
        if (p.status !== 'approved') return res.status(400).json({ error: 'Hanya proforma approved yang bisa di-settle', details: [] });
        const settledAmount = round2(req.body?.settled_amount);
        const totalNominal = round2(p.total_nominal);
        if (!(settledAmount > 0)) return res.status(400).json({ error: 'Nominal settle wajib diisi', details: [] });
        if (Math.abs(settledAmount - totalNominal) > 0.01) {
            return res.status(400).json({ error: 'Nominal settle harus balance dengan total proforma', details: [`Total proforma: ${totalNominal.toLocaleString('id-ID')} • Settle: ${settledAmount.toLocaleString('id-ID')}`] });
        }
        const now = new Date();
        const trx = await knex.transaction();
        try {
            await trx('proforma_requests').where('id', id).update({
                status: 'settled',
                settled_amount: settledAmount,
                settled_by: getUsername(req),
                settled_at: now,
                notes: req.body?.notes || p.notes || '',
            });
            const ids = parseJsonArraySafeStr(p.invoice_ids);
            await trx('proforma_invoices').whereIn('id', ids).update({ status: 'settled', updated_at: now });
            await trx.commit();
        } catch (e) {
            await trx.rollback();
            throw e;
        }
        const row = await knex('proforma_requests').where('id', id).first();
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: 'Gagal settle proforma', details: [err.message] });
    }
});

// ─── PDF Proforma ───────────────────────────────────────────────────────────
router.get('/:id/pdf', async (req, res) => {
    try {
        const { id } = req.params;
        const invoice = await knex('proforma_invoices').where('id', id).first();
        if (!invoice) return res.status(404).json({ error: 'Invoice tidak ditemukan' });
        const items = await knex('proforma_invoice_items').where('invoice_id', id).orderBy('id', 'asc');

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
