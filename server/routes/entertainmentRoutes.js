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

const getUserEntertainmentPerms = async (user) => {
    const defaultPerms = { view_all: false, can_create: true, can_edit: true, can_delete: true, can_settle: true, can_export: true };
    if (user.role === 'admin' || user.role === 'superadmin') return { ...defaultPerms, view_all: true };
    try {
        const rules = await knex('entertainment_rules').where('is_active', true);
        if (!rules.length) return defaultPerms;
        const merged = { ...defaultPerms };
        for (const r of rules) {
            let match = false;
            if (r.target_type === 'user' && r.target_value === user.username) match = true;
            if (r.target_type === 'division' && r.target_value === (user.department || user.division || '')) match = true;
            if (r.target_type === 'role' && r.target_value === user.role) match = true;
            if (match) {
                if (r.view_all) merged.view_all = true;
                if (!r.can_create) merged.can_create = false;
                if (!r.can_edit) merged.can_edit = false;
                if (!r.can_delete) merged.can_delete = false;
                if (!r.can_settle) merged.can_settle = false;
                if (!r.can_export) merged.can_export = false;
            }
        }
        return merged;
    } catch {
        return defaultPerms;
    }
};

// ─── Entertainment Rules CRUD (admin only) ──────────────────────────────────
router.get('/rules', async (req, res) => {
    try {
        if (req.authUser.role !== 'admin' && req.authUser.role !== 'superadmin') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const rules = await knex('entertainment_rules').orderBy('created_at', 'desc');
        res.json(rules);
    } catch (error) {
        console.error('[Entertainment] GET rules error:', error);
        res.status(500).json({ error: 'Failed to fetch rules' });
    }
});

router.get('/rules/permissions', async (req, res) => {
    try {
        const perms = await getUserEntertainmentPerms(req.authUser);
        res.json(perms);
    } catch (error) {
        console.error('[Entertainment] GET permissions error:', error);
        res.status(500).json({ error: 'Failed to fetch permissions' });
    }
});

router.post('/rules', async (req, res) => {
    try {
        if (req.authUser.role !== 'admin' && req.authUser.role !== 'superadmin') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const { rule_name, target_type, target_value, view_all, can_create, can_edit, can_delete, can_settle, can_export } = req.body;
        if (!rule_name || !target_type || !target_value) {
            return res.status(400).json({ error: 'rule_name, target_type, target_value wajib diisi' });
        }
        const rule = await knex('entertainment_rules').insert({
            rule_name, target_type, target_value,
            view_all: !!view_all, can_create: can_create !== false,
            can_edit: can_edit !== false, can_delete: can_delete !== false,
            can_settle: can_settle !== false, can_export: can_export !== false,
            is_active: true
        }).returning('*');
        res.status(201).json(rule[0] || rule);
    } catch (error) {
        console.error('[Entertainment] POST rules error:', error);
        res.status(500).json({ error: 'Failed to create rule' });
    }
});

router.put('/rules/:id', async (req, res) => {
    try {
        if (req.authUser.role !== 'admin' && req.authUser.role !== 'superadmin') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const { rule_name, target_type, target_value, view_all, can_create, can_edit, can_delete, can_settle, can_export, is_active } = req.body;
        const update = {};
        if (rule_name !== undefined) update.rule_name = rule_name;
        if (target_type !== undefined) update.target_type = target_type;
        if (target_value !== undefined) update.target_value = target_value;
        if (view_all !== undefined) update.view_all = !!view_all;
        if (can_create !== undefined) update.can_create = !!can_create;
        if (can_edit !== undefined) update.can_edit = !!can_edit;
        if (can_delete !== undefined) update.can_delete = !!can_delete;
        if (can_settle !== undefined) update.can_settle = !!can_settle;
        if (can_export !== undefined) update.can_export = !!can_export;
        if (is_active !== undefined) update.is_active = !!is_active;
        update.updated_at = knex.fn.now();
        await knex('entertainment_rules').where('id', req.params.id).update(update);
        const updated = await knex('entertainment_rules').where('id', req.params.id).first();
        res.json(updated);
    } catch (error) {
        console.error('[Entertainment] PUT rules error:', error);
        res.status(500).json({ error: 'Failed to update rule' });
    }
});

router.delete('/rules/:id', async (req, res) => {
    try {
        if (req.authUser.role !== 'admin' && req.authUser.role !== 'superadmin') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        await knex('entertainment_rules').where('id', req.params.id).del();
        res.json({ message: 'Rule deleted' });
    } catch (error) {
        console.error('[Entertainment] DELETE rules error:', error);
        res.status(500).json({ error: 'Failed to delete rule' });
    }
});

// GET /api/entertainment - List all (with pagination & row-level security)
router.get('/', async (req, res) => {
    try {
        const { tanggal, jenis, search, status, page = 1, perPage = 15 } = req.query;
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(perPage) || 15));
        const offset = (pageNum - 1) * limit;

        const user = req.authUser;
        const perms = await getUserEntertainmentPerms(user);
        const canViewAll = perms.view_all || user.role === 'admin' || user.role === 'superadmin';

        let query = knex('entertainment_expenses');
        let countQuery = knex('entertainment_expenses');

        if (!canViewAll) {
            const filterFn = function() {
                this.where('requester_username', user.username)
                    .orWhere('owner', user.username);
            };
            query = query.where(filterFn);
            countQuery = countQuery.where(filterFn);
        }

        if (tanggal) {
            query = query.where('tanggal', tanggal);
            countQuery = countQuery.where('tanggal', tanggal);
        }
        if (jenis) {
            query = query.where('jenis', jenis);
            countQuery = countQuery.where('jenis', jenis);
        }
        if (search) {
            const searchFn = function() {
                this.where('tempat', 'ilike', `%${search}%`)
                    .orWhere('alamat', 'ilike', `%${search}%`)
                    .orWhere('no_gl', 'ilike', `%${search}%`)
                    .orWhere('catatan_kode', 'ilike', `%${search}%`)
                    .orWhereRaw("relasi::text ilike ?", [`%${search}%`])
                    .orWhereRaw("nama_perusahaan::text ilike ?", [`%${search}%`]);
            };
            query = query.where(searchFn);
            countQuery = countQuery.where(searchFn);
        }

        if (status) {
            query = query.where('status', status);
            countQuery = countQuery.where('status', status);
        }

        const [{ count }] = await countQuery.count('* as count');
        const total = parseInt(count) || 0;

        const data = await query.orderBy('created_at', 'desc').limit(limit).offset(offset);

        res.json({
            data,
            total,
            page: pageNum,
            perPage: limit,
            totalPages: Math.ceil(total / limit),
            permissions: perms
        });
    } catch (error) {
        console.error('[Entertainment] GET error:', error);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

// POST /api/entertainment/upload - Upload attachment only (BEFORE /:id)
router.post('/upload', upload.array('files', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        const files = req.files.map(f => ({
            name: f.originalname, filename: f.filename, path: f.path,
            size: f.size, mimetype: f.mimetype, url: `/uploads/${f.filename}`
        }));
        res.json({ files });
    } catch (error) {
        console.error('[Entertainment] Upload error:', error);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// ─── PDF helpers (professional report template) ───────────────────────────
const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN_X = 40;
const MARGIN_TOP = 40;
const MARGIN_BOTTOM = 50;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const safeText = (v, max = 120) => {
    const s = String(v ?? '-').replace(/[\r\n\t]+/g, ' ').trim() || '-';
    // pdf-lib WinAnsi cannot encode many unicode chars
    const cleaned = s.replace(/[^\x20-\x7E]/g, (ch) => {
        const map = { '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '•': '-', '°': ' deg ' };
        return map[ch] || '';
    });
    return cleaned.length > max ? cleaned.slice(0, max - 1) + '…' : cleaned;
};

const formatIdr = (val) => {
    try {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(val) || 0);
    } catch {
        return `Rp ${val || 0}`;
    }
};

const formatDateId = (val) => {
    if (!val) return '-';
    try {
        const d = new Date(val);
        if (Number.isNaN(d.getTime())) return String(val).slice(0, 10);
        return d.toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
        return String(val).slice(0, 10);
    }
};

const isImageAttachment = (att) => {
    const mime = (att.mimetype || att.type || '').toLowerCase();
    const name = (att.name || att.originalname || att.filename || '').toLowerCase();
    if (mime.startsWith('image/')) return true;
    return /\.(png|jpe?g|gif|webp|bmp)$/i.test(name);
};

const resolveAttachmentPath = (att) => {
    if (att.path && fs.existsSync(att.path)) return att.path;
    if (att.filename) {
        const p1 = path.join(process.cwd(), 'uploads', att.filename);
        if (fs.existsSync(p1)) return p1;
        const p2 = path.join(__dirname, '../../uploads', att.filename);
        if (fs.existsSync(p2)) return p2;
    }
    if (att.url) {
        const fname = path.basename(att.url);
        const p3 = path.join(process.cwd(), 'uploads', fname);
        if (fs.existsSync(p3)) return p3;
    }
    return null;
};

// GET /api/entertainment/export/pdf - Export to PDF (BEFORE /:id)
router.get('/export/pdf', async (req, res) => {
    try {
        const { id } = req.query;
        let data;
        if (id) {
            data = await knex('entertainment_expenses').where('id', id).first();
            if (!data) return res.status(404).json({ error: 'Data not found' });
            data = [data];
        } else {
            data = await knex('entertainment_expenses').orderBy('created_at', 'desc');
        }

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const printedAt = new Date().toLocaleString('en-US', {
            day: '2-digit', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        const drawHeader = (page, entryNo, total) => {
            // Top brand bar
            page.drawRectangle({
                x: 0, y: PAGE_H - 56, width: PAGE_W, height: 56,
                color: rgb(0.18, 0.24, 0.55)
            });
            page.drawRectangle({
                x: 0, y: PAGE_H - 60, width: PAGE_W, height: 4,
                color: rgb(0.95, 0.72, 0.18)
            });
            page.drawText('ENTERTAINMENT EXPENSE REPORT', {
                x: MARGIN_X, y: PAGE_H - 36, size: 16, font: fontBold, color: rgb(1, 1, 1)
            });
            page.drawText(`Document ${entryNo} / ${total}`, {
                x: PAGE_W - MARGIN_X - 100, y: PAGE_H - 34, size: 9, font, color: rgb(0.85, 0.88, 1)
            });
        };

        const drawFooter = (page, pageNo, totalPages) => {
            page.drawLine({
                start: { x: MARGIN_X, y: 38 },
                end: { x: PAGE_W - MARGIN_X, y: 38 },
                thickness: 0.6,
                color: rgb(0.75, 0.78, 0.85)
            });
            page.drawText(`Printed: ${safeText(printedAt, 60)}`, {
                x: MARGIN_X, y: 22, size: 8, font, color: rgb(0.4, 0.42, 0.48)
            });
            page.drawText('This document was generated automatically by the system.', {
                x: MARGIN_X, y: 12, size: 7, font, color: rgb(0.55, 0.57, 0.62)
            });
            page.drawText(`Page ${pageNo}`, {
                x: PAGE_W - MARGIN_X - 50, y: 22, size: 8, font, color: rgb(0.4, 0.42, 0.48)
            });
        };

        const sectionTitle = (page, title, y) => {
            page.drawRectangle({
                x: MARGIN_X, y: y - 4, width: CONTENT_W, height: 18,
                color: rgb(0.93, 0.94, 0.98)
            });
            page.drawRectangle({
                x: MARGIN_X, y: y - 4, width: 3, height: 18,
                color: rgb(0.22, 0.35, 0.78)
            });
            page.drawText(title, {
                x: MARGIN_X + 10, y: y, size: 10, font: fontBold, color: rgb(0.15, 0.2, 0.4)
            });
            return y - 26;
        };

        const drawFieldGrid = (page, fields, startY) => {
            let y = startY;
            const colGap = 12;
            const colW = (CONTENT_W - colGap) / 2;
            for (let i = 0; i < fields.length; i += 2) {
                const left = fields[i];
                const right = fields[i + 1];
                const isLeftHighlight = left.highlight;
                // left card
                page.drawRectangle({
                    x: MARGIN_X, y: y - 22, width: colW, height: 30,
                    color: isLeftHighlight ? rgb(0.94, 0.97, 0.94) : rgb(0.98, 0.985, 0.995),
                    borderColor: isLeftHighlight ? rgb(0.6, 0.78, 0.6) : rgb(0.88, 0.9, 0.94),
                    borderWidth: isLeftHighlight ? 0.8 : 0.5
                });
                page.drawText(safeText(left.label, 28).toUpperCase(), {
                    x: MARGIN_X + 8, y: y - 2, size: 7, font: fontBold, color: rgb(0.45, 0.48, 0.55)
                });
                page.drawText(safeText(left.value, 42), {
                    x: MARGIN_X + 8, y: y - 15, size: 9, font: isLeftHighlight ? fontBold : font, color: rgb(0.12, 0.14, 0.2)
                });
                if (right) {
                    const rx = MARGIN_X + colW + colGap;
                    const isRightHighlight = right.highlight;
                    page.drawRectangle({
                        x: rx, y: y - 22, width: colW, height: 30,
                        color: isRightHighlight ? rgb(0.94, 0.97, 0.94) : rgb(0.98, 0.985, 0.995),
                        borderColor: isRightHighlight ? rgb(0.6, 0.78, 0.6) : rgb(0.88, 0.9, 0.94),
                        borderWidth: isRightHighlight ? 0.8 : 0.5
                    });
                    page.drawText(safeText(right.label, 28).toUpperCase(), {
                        x: rx + 8, y: y - 2, size: 7, font: fontBold, color: rgb(0.45, 0.48, 0.55)
                    });
                    page.drawText(safeText(right.value, 42), {
                        x: rx + 8, y: y - 15, size: 9, font: isRightHighlight ? fontBold : font, color: rgb(0.12, 0.14, 0.2)
                    });
                }
                y -= 38;
            }
            return y;
        };

        const drawWrappedText = (page, text, x, y, maxWidth, size = 9, lineH = 12) => {
            const words = safeText(text, 2000).split(/\s+/);
            let line = '';
            let cy = y;
            for (const w of words) {
                const test = line ? `${line} ${w}` : w;
                const tw = font.widthOfTextAtSize(test, size);
                if (tw > maxWidth && line) {
                    page.drawText(line, { x, y: cy, size, font, color: rgb(0.15, 0.17, 0.22) });
                    cy -= lineH;
                    line = w;
                } else {
                    line = test;
                }
            }
            if (line) {
                page.drawText(line, { x, y: cy, size, font, color: rgb(0.15, 0.17, 0.22) });
                cy -= lineH;
            }
            return cy;
        };

        let globalPageNo = 0;
        const totalEntries = data.length || 1;

        for (let i = 0; i < data.length; i++) {
            const entry = data[i];
            let relasiArr = [], jabatanArr = [], npArr = [], attArr = [];
            try { relasiArr = typeof entry.relasi === 'string' ? JSON.parse(entry.relasi) : (entry.relasi || []); } catch { relasiArr = []; }
            try { jabatanArr = typeof entry.jabatan === 'string' ? JSON.parse(entry.jabatan) : (entry.jabatan || []); } catch { jabatanArr = []; }
            try { npArr = typeof entry.nama_perusahaan === 'string' ? JSON.parse(entry.nama_perusahaan) : (entry.nama_perusahaan || []); } catch { npArr = []; }
            try { attArr = typeof entry.attachments === 'string' ? JSON.parse(entry.attachments) : (entry.attachments || []); } catch { attArr = []; }
            if (!Array.isArray(relasiArr)) relasiArr = [];
            if (!Array.isArray(jabatanArr)) jabatanArr = [];
            if (!Array.isArray(npArr)) npArr = [];
            if (!Array.isArray(attArr)) attArr = [];

            let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
            globalPageNo += 1;
            drawHeader(page, i + 1, totalEntries);
            let y = PAGE_H - 84;

            // Meta strip
            page.drawRectangle({
                x: MARGIN_X, y: y - 18, width: CONTENT_W, height: 28,
                color: rgb(0.96, 0.97, 0.99),
                borderColor: rgb(0.85, 0.87, 0.92),
                borderWidth: 0.5
            });
            page.drawText(`Ref No: ENT-${String(entry.id || i + 1).padStart(5, '0')}`, {
                x: MARGIN_X + 10, y: y - 6, size: 9, font: fontBold, color: rgb(0.2, 0.25, 0.45)
            });
            page.drawText(`Status: ${safeText(entry.status || 'active', 20).toUpperCase()}`, {
                x: MARGIN_X + 180, y: y - 6, size: 9, font, color: rgb(0.2, 0.45, 0.3)
            });
            page.drawText(`Requester: ${safeText(entry.requester_name || entry.requester_username, 30)}`, {
                x: MARGIN_X + 320, y: y - 6, size: 9, font, color: rgb(0.25, 0.28, 0.35)
            });
            y -= 40;

            y = sectionTitle(page, 'A. TRANSACTION DETAILS', y);
            y = drawFieldGrid(page, [
                { label: 'Date', value: formatDateId(entry.tanggal) },
                { label: 'Entertainment Type', value: entry.jenis === 'Custom' ? entry.custom_jenis : entry.jenis },
                { label: 'Venue', value: entry.tempat },
                { label: 'GL Number', value: entry.no_gl },
                { label: 'Amount', value: formatIdr(entry.nilai), highlight: true },
                { label: 'Business Type', value: entry.jenis_usaha },
            ], y);

            // Address full width card - calculate dimensions first
            const addrText = safeText(entry.alamat || '-', 500);
            const addrWords = addrText.split(/\s+/);
            let addrLineCount = 1;
            let tmpLine = '';
            for (const w of addrWords) {
                const test = tmpLine ? `${tmpLine} ${w}` : w;
                if (font.widthOfTextAtSize(test, 9) > CONTENT_W - 24 && tmpLine) {
                    addrLineCount++;
                    tmpLine = w;
                } else {
                    tmpLine = test;
                }
            }
            // Card layout: topPadding(8) + label(7font ~10px) + gap(4) + textLines * lineH + bottomPadding(8)
            const addrPadTop = 8;
            const addrLabelH = 10;
            const addrLabelGap = 4;
            const addrTextH = addrLineCount * 12;
            const addrPadBottom = 8;
            const addrCardH = addrPadTop + addrLabelH + addrLabelGap + addrTextH + addrPadBottom;

            // Card TOP starts below field grid with gap, then extends DOWNWARD
            const addrCardTopY = y - 10;
            const addrCardBottomY = addrCardTopY - addrCardH;

            page.drawRectangle({
                x: MARGIN_X, y: addrCardBottomY, width: CONTENT_W, height: addrCardH,
                color: rgb(0.98, 0.985, 0.995),
                borderColor: rgb(0.82, 0.85, 0.9),
                borderWidth: 1
            });

            // Label "ADDRESS" inside card, below top padding
            const addrLabelY = addrCardTopY - addrPadTop - 7;
            page.drawText('ADDRESS', {
                x: MARGIN_X + 8, y: addrLabelY, size: 7, font: fontBold, color: rgb(0.45, 0.48, 0.55)
            });

            // Address text below label
            const addrTextY = addrLabelY - addrLabelGap - 10;
            let addrCy = addrTextY;
            const addrWords2 = addrText.split(/\s+/);
            let addrLine = '';
            for (const w of addrWords2) {
                const test = addrLine ? `${addrLine} ${w}` : w;
                if (font.widthOfTextAtSize(test, 9) > CONTENT_W - 24 && addrLine) {
                    page.drawText(addrLine, { x: MARGIN_X + 8, y: addrCy, size: 9, font, color: rgb(0.15, 0.17, 0.22) });
                    addrCy -= 12;
                    addrLine = w;
                } else {
                    addrLine = test;
                }
            }
            if (addrLine) {
                page.drawText(addrLine, { x: MARGIN_X + 8, y: addrCy, size: 9, font, color: rgb(0.15, 0.17, 0.22) });
            }

            // Move y below the card
            y = addrCardBottomY - 20;

            y = sectionTitle(page, 'B. RELATIONS & COMPANIES', y);
            page.drawText(`Number of Relations: ${entry.jumlah_relasi || relasiArr.length || 0} person(s)`, {
                x: MARGIN_X, y, size: 9, font: fontBold, color: rgb(0.18, 0.28, 0.55)
            });
            y -= 16;

            // Table header
            page.drawRectangle({
                x: MARGIN_X, y: y - 6, width: CONTENT_W, height: 16,
                color: rgb(0.22, 0.35, 0.78)
            });
            page.drawText('No', { x: MARGIN_X + 6, y: y - 1, size: 8, font: fontBold, color: rgb(1, 1, 1) });
            page.drawText('Relation Name', { x: MARGIN_X + 28, y: y - 1, size: 8, font: fontBold, color: rgb(1, 1, 1) });
            page.drawText('Position', { x: MARGIN_X + 175, y: y - 1, size: 8, font: fontBold, color: rgb(1, 1, 1) });
            page.drawText('Company Name', { x: MARGIN_X + 300, y: y - 1, size: 8, font: fontBold, color: rgb(1, 1, 1) });
            y -= 20;

            const rowCount = Math.max(relasiArr.length, jabatanArr.length, npArr.length, 1);
            for (let r = 0; r < rowCount; r++) {
                if (y < MARGIN_BOTTOM + 80) {
                    drawFooter(page, globalPageNo);
                    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
                    globalPageNo += 1;
                    drawHeader(page, i + 1, totalEntries);
                    y = PAGE_H - 84;
                }
                const bg = r % 2 === 0 ? rgb(0.97, 0.975, 0.99) : rgb(1, 1, 1);
                page.drawRectangle({
                    x: MARGIN_X, y: y - 6, width: CONTENT_W, height: 16,
                    color: bg,
                    borderColor: rgb(0.9, 0.91, 0.94),
                    borderWidth: 0.4
                });
                page.drawText(String(r + 1), { x: MARGIN_X + 6, y: y - 1, size: 8, font, color: rgb(0.2, 0.22, 0.28) });
                page.drawText(safeText(relasiArr[r] || '-', 28), { x: MARGIN_X + 28, y: y - 1, size: 8, font, color: rgb(0.15, 0.17, 0.22) });
                page.drawText(safeText(jabatanArr[r] || '-', 22), { x: MARGIN_X + 175, y: y - 1, size: 8, font, color: rgb(0.15, 0.17, 0.22) });
                page.drawText(safeText(npArr[r] || '-', 30), { x: MARGIN_X + 300, y: y - 1, size: 8, font, color: rgb(0.15, 0.17, 0.22) });
                y -= 18;
            }
            y -= 12;

            if (y < MARGIN_BOTTOM + 60) {
                drawFooter(page, globalPageNo);
                page = pdfDoc.addPage([PAGE_W, PAGE_H]);
                globalPageNo += 1;
                drawHeader(page, i + 1, totalEntries);
                y = PAGE_H - 100;
            }

            y = sectionTitle(page, 'C. NOTES / CODE', y);
            page.drawRectangle({
                x: MARGIN_X, y: y - 40, width: CONTENT_W, height: 48,
                color: rgb(1, 1, 1),
                borderColor: rgb(0.88, 0.9, 0.94),
                borderWidth: 0.6
            });
            y = drawWrappedText(page, entry.catatan_kode || '-', MARGIN_X + 8, y - 4, CONTENT_W - 16, 9, 12);
            y -= 20;

            // Attachments section
            if (y < MARGIN_BOTTOM + 100) {
                drawFooter(page, globalPageNo);
                page = pdfDoc.addPage([PAGE_W, PAGE_H]);
                globalPageNo += 1;
                drawHeader(page, i + 1, totalEntries);
                y = PAGE_H - 84;
            }
            y = sectionTitle(page, `D. ATTACHMENTS (${attArr.length})`, y);

            if (attArr.length === 0) {
                page.drawText('No attachments.', {
                    x: MARGIN_X, y, size: 9, font, color: rgb(0.5, 0.52, 0.58)
                });
                y -= 16;
            } else {
                for (let aIdx = 0; aIdx < attArr.length; aIdx++) {
                    const att = attArr[aIdx];
                    const attName = att.name || att.originalname || att.filename || `file_${aIdx + 1}`;
                    const attSize = att.size ? `${(att.size / 1024).toFixed(1)} KB` : '-';
                    const isImg = isImageAttachment(att);

                    if (y < MARGIN_BOTTOM + (isImg ? 180 : 40)) {
                        drawFooter(page, globalPageNo);
                        page = pdfDoc.addPage([PAGE_W, PAGE_H]);
                        globalPageNo += 1;
                        drawHeader(page, i + 1, totalEntries);
                        y = PAGE_H - 84;
                    }

                    page.drawText(`${aIdx + 1}. ${safeText(attName, 70)}  (${attSize})${isImg ? '  [IMAGE]' : ''}`, {
                        x: MARGIN_X, y, size: 8, font: fontBold, color: rgb(0.2, 0.25, 0.4)
                    });
                    y -= 14;

                    if (isImg) {
                        try {
                            const fpath = resolveAttachmentPath(att);
                            if (fpath && fs.existsSync(fpath)) {
                                const bytes = fs.readFileSync(fpath);
                                let embedded = null;
                                const lower = fpath.toLowerCase();
                                const mime = (att.mimetype || '').toLowerCase();
                                if (mime.includes('png') || lower.endsWith('.png')) {
                                    embedded = await pdfDoc.embedPng(bytes);
                                } else if (mime.includes('jpg') || mime.includes('jpeg') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
                                    embedded = await pdfDoc.embedJpg(bytes);
                                } else {
                                    try { embedded = await pdfDoc.embedPng(bytes); }
                                    catch { try { embedded = await pdfDoc.embedJpg(bytes); } catch { embedded = null; } }
                                }

                                if (embedded) {
                                    const maxW = CONTENT_W;
                                    const maxH = 220;
                                    const dims = embedded.scale(1);
                                    let drawW = dims.width;
                                    let drawH = dims.height;
                                    const scale = Math.min(maxW / drawW, maxH / drawH, 1);
                                    drawW *= scale;
                                    drawH *= scale;

                                    if (y - drawH < MARGIN_BOTTOM + 20) {
                                        drawFooter(page, globalPageNo);
                                        page = pdfDoc.addPage([PAGE_W, PAGE_H]);
                                        globalPageNo += 1;
                                        drawHeader(page, i + 1, totalEntries);
                                        y = PAGE_H - 84;
                                        page.drawText(`${aIdx + 1}. ${safeText(attName, 70)} (continued)`, {
                                            x: MARGIN_X, y, size: 8, font: fontBold, color: rgb(0.2, 0.25, 0.4)
                                        });
                                        y -= 14;
                                    }

                                    page.drawRectangle({
                                        x: MARGIN_X - 2, y: y - drawH - 2,
                                        width: drawW + 4, height: drawH + 4,
                                        borderColor: rgb(0.8, 0.82, 0.88),
                                        borderWidth: 0.8,
                                        color: rgb(0.98, 0.98, 0.99)
                                    });
                                    page.drawImage(embedded, {
                                        x: MARGIN_X, y: y - drawH,
                                        width: drawW, height: drawH
                                    });
                                    y -= (drawH + 16);
                                } else {
                                    page.drawText('   (image could not be embedded, unsupported format)', {
                                        x: MARGIN_X, y, size: 8, font, color: rgb(0.6, 0.35, 0.2)
                                    });
                                    y -= 14;
                                }
                            } else {
                                page.drawText('   (image file not found on server)', {
                                    x: MARGIN_X, y, size: 8, font, color: rgb(0.6, 0.35, 0.2)
                                });
                                y -= 14;
                            }
                        } catch (imgErr) {
                            console.warn('[Entertainment] embed image failed:', imgErr.message);
                            page.drawText('   (failed to display image in PDF)', {
                                x: MARGIN_X, y, size: 8, font, color: rgb(0.6, 0.2, 0.2)
                            });
                            y -= 14;
                        }
                    }
                }
            }

            // Signature block
            if (y < MARGIN_BOTTOM + 90) {
                drawFooter(page, globalPageNo);
                page = pdfDoc.addPage([PAGE_W, PAGE_H]);
                globalPageNo += 1;
                drawHeader(page, i + 1, totalEntries);
                y = PAGE_H - 84;
            }
            y -= 10;
            page.drawText('Prepared by,', {
                x: MARGIN_X + 20, y, size: 9, font, color: rgb(0.3, 0.32, 0.38)
            });
            page.drawText('Acknowledged by,', {
                x: PAGE_W - MARGIN_X - 150, y, size: 9, font, color: rgb(0.3, 0.32, 0.38)
            });
            y -= 50;
            page.drawLine({
                start: { x: MARGIN_X + 20, y }, end: { x: MARGIN_X + 160, y },
                thickness: 0.6, color: rgb(0.5, 0.52, 0.58)
            });
            page.drawLine({
                start: { x: PAGE_W - MARGIN_X - 160, y }, end: { x: PAGE_W - MARGIN_X - 20, y },
                thickness: 0.6, color: rgb(0.5, 0.52, 0.58)
            });
            y -= 12;
            page.drawText(safeText(entry.requester_name || entry.requester_username || 'Requester', 28), {
                x: MARGIN_X + 20, y, size: 8, font: fontBold, color: rgb(0.2, 0.22, 0.28)
            });
            page.drawText('Supervisor / Finance', {
                x: PAGE_W - MARGIN_X - 150, y, size: 8, font: fontBold, color: rgb(0.2, 0.22, 0.28)
            });

            drawFooter(page, globalPageNo);
        }

        // Empty state
        if (data.length === 0) {
            const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
            drawHeader(page, 0, 0);
            page.drawText('No entertainment data available for export.', {
                x: MARGIN_X, y: PAGE_H / 2, size: 12, font, color: rgb(0.4, 0.42, 0.48)
            });
            drawFooter(page, 1);
        }

        const pdfBytes = await pdfDoc.save();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Entertainment_Expense_Report_${Date.now()}.pdf`);
        res.send(Buffer.from(pdfBytes));
    } catch (error) {
        console.error('[Entertainment] PDF export error:', error);
        res.status(500).json({ error: error.message || 'Failed to export PDF' });
    }
});

// GET /api/entertainment/export/excel - Export to Excel (BEFORE /:id)
router.get('/export/excel', async (req, res) => {
    try {
        const { id } = req.query;
        let data;
        if (id) {
            data = await knex('entertainment_expenses').where('id', id).first();
            if (!data) return res.status(404).json({ error: 'Data not found' });
            data = [data];
        } else {
            data = await knex('entertainment_expenses').orderBy('created_at', 'desc');
        }

        const rows = data.map(entry => {
            let relasiArr = [], npArr = [], attArr = [];
            try { relasiArr = typeof entry.relasi === 'string' ? JSON.parse(entry.relasi) : (entry.relasi || []); } catch { relasiArr = []; }
            try { npArr = typeof entry.nama_perusahaan === 'string' ? JSON.parse(entry.nama_perusahaan) : (entry.nama_perusahaan || []); } catch { npArr = []; }
            try { attArr = typeof entry.attachments === 'string' ? JSON.parse(entry.attachments) : (entry.attachments || []); } catch { attArr = []; }

            return {
                ID: entry.id, Tanggal: entry.tanggal, Tempat: entry.tempat,
                Alamat: entry.alamat, Jenis: entry.jenis === 'Custom' ? entry.custom_jenis : entry.jenis,
                Nilai: entry.nilai, 'No. GL': entry.no_gl,
                'Nama Relasi': relasiArr.join(', '),
                Jabatan: (typeof entry.jabatan === 'string' ? (() => { try { return JSON.parse(entry.jabatan); } catch { return []; } })() : (entry.jabatan || [])).join(', '),
                'Jumlah Relasi': entry.jumlah_relasi,
                'Nama Perusahaan': npArr.join(', '), 'Jenis Usaha': entry.jenis_usaha,
                'Catatan/Kode': entry.catatan_kode,
                Lampiran: attArr.map(a => a.name).join(', '),
                Pengaju: entry.requester_name || entry.requester_username,
                Status: entry.status, 'Dibuat Pada': entry.created_at
            };
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [
            { wch: 5 }, { wch: 12 }, { wch: 20 }, { wch: 30 }, { wch: 12 },
            { wch: 18 }, { wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 30 },
            { wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 10 }, { wch: 20 }
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Entertainment Expenses');
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=entertainment_expenses_${Date.now()}.xlsx`);
        res.send(buffer);
    } catch (error) {
        console.error('[Entertainment] Excel export error:', error);
        res.status(500).json({ error: 'Failed to export Excel' });
    }
});

// GET /api/entertainment/:id - Single entry
router.get('/:id', async (req, res) => {
    try {
        const data = await knex('entertainment_expenses').where('id', req.params.id).first();
        if (!data) return res.status(404).json({ error: 'Data not found' });
        res.json(data);
    } catch (error) {
        console.error('[Entertainment] GET by id error:', error);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

// POST /api/entertainment/:id/settle - Settle an entry (multipart with file uploads)
router.post('/:id/settle', upload.array('attachments', 10), async (req, res) => {
    try {
        const existing = await knex('entertainment_expenses').where('id', req.params.id).first();
        if (!existing) return res.status(404).json({ error: 'Data not found' });

        if (existing.status === 'settled') {
            return res.status(400).json({ error: 'Already settled' });
        }

        const user = req.authUser;
        const perms = await getUserEntertainmentPerms(user);
        if (!perms.can_settle && user.role !== 'admin' && user.role !== 'superadmin') {
            return res.status(403).json({ error: 'Anda tidak memiliki izin untuk settle' });
        }

        const { tanggal, tempat, alamat, jenis, custom_jenis, nilai, no_gl, relasi, jabatan, nama_perusahaan, jenis_usaha, catatan_kode, existing_attachments, settle_date } = req.body;

        if (!settle_date) {
            return res.status(400).json({ error: 'Tanggal settle wajib diisi' });
        }

        const updatePayload = {};
        let changed = false;

        if (tanggal !== undefined) {
            const existingTanggal = existing.tanggal ? String(existing.tanggal).split('T')[0] : '';
            if (tanggal !== existingTanggal) {
                updatePayload.tanggal = tanggal; changed = true;
            }
        }
        if (tempat !== undefined && tempat !== existing.tempat) {
            updatePayload.tempat = tempat; changed = true;
        }
        if (alamat !== undefined && alamat !== existing.alamat) {
            updatePayload.alamat = alamat; changed = true;
        }
        if (jenis !== undefined && jenis !== existing.jenis) {
            updatePayload.jenis = jenis; changed = true;
        }
        if (custom_jenis !== undefined && custom_jenis !== existing.custom_jenis) {
            updatePayload.custom_jenis = jenis === 'Custom' ? custom_jenis : null; changed = true;
        }
        if (nilai !== undefined && nilai !== '' && parseFloat(nilai) !== parseFloat(existing.nilai || 0)) {
            updatePayload.nilai = parseFloat(nilai); changed = true;
        }
        if (no_gl !== undefined && no_gl !== existing.no_gl) {
            updatePayload.no_gl = no_gl; changed = true;
        }
        if (jenis_usaha !== undefined && jenis_usaha !== existing.jenis_usaha) {
            updatePayload.jenis_usaha = jenis_usaha; changed = true;
        }
        if (catatan_kode !== undefined && catatan_kode !== existing.catatan_kode) {
            updatePayload.catatan_kode = catatan_kode; changed = true;
        }
        if (settle_date !== undefined && settle_date !== existing.settle_date) {
            updatePayload.settle_date = settle_date; changed = true;
        }

        if (relasi !== undefined) {
            let relasiArr;
            try { relasiArr = typeof relasi === 'string' ? JSON.parse(relasi) : (relasi || []); } catch { relasiArr = []; }
            const existingRelasi = (() => { try { return JSON.parse(existing.relasi); } catch { return []; } })();
            if (JSON.stringify(relasiArr) !== JSON.stringify(existingRelasi)) {
                updatePayload.relasi = JSON.stringify(relasiArr);
                updatePayload.jumlah_relasi = relasiArr.length;
                changed = true;
            }
        }
        if (jabatan !== undefined) {
            let jabatanArr;
            try { jabatanArr = typeof jabatan === 'string' ? JSON.parse(jabatan) : (jabatan || []); } catch { jabatanArr = []; }
            const existingJabatan = (() => { try { return JSON.parse(existing.jabatan); } catch { return []; } })();
            if (JSON.stringify(jabatanArr) !== JSON.stringify(existingJabatan)) {
                updatePayload.jabatan = JSON.stringify(jabatanArr);
                changed = true;
            }
        }
        if (nama_perusahaan !== undefined) {
            let npArr;
            try { npArr = typeof nama_perusahaan === 'string' ? JSON.parse(nama_perusahaan) : (nama_perusahaan || []); } catch { npArr = []; }
            const existingNp = (() => { try { return JSON.parse(existing.nama_perusahaan); } catch { return []; } })();
            if (JSON.stringify(npArr) !== JSON.stringify(existingNp)) {
                updatePayload.nama_perusahaan = JSON.stringify(npArr);
                changed = true;
            }
        }

        // Handle attachments merge
        let finalAttachments = [];
        try {
            finalAttachments = existing_attachments
                ? (typeof existing_attachments === 'string' ? JSON.parse(existing_attachments) : existing_attachments)
                : (typeof existing.attachments === 'string' ? JSON.parse(existing.attachments) : existing.attachments || []);
        } catch { finalAttachments = []; }

        if (req.files && req.files.length > 0) {
            const newAtt = req.files.map(f => ({
                name: f.originalname, filename: f.filename, path: f.path,
                size: f.size, mimetype: f.mimetype, url: `/uploads/${f.filename}`
            }));
            finalAttachments = [...finalAttachments, ...newAtt];
            changed = true;
        }

        // Check if existing attachments changed (removed)
        const origAtt = (() => { try { return typeof existing.attachments === 'string' ? JSON.parse(existing.attachments) : (existing.attachments || []); } catch { return []; } })();
        if (JSON.stringify(finalAttachments) !== JSON.stringify(origAtt)) {
            changed = true;
        }

        updatePayload.attachments = JSON.stringify(finalAttachments);
        updatePayload.status = 'settled';
        updatePayload.settled_at = knex.fn.now();
        updatePayload.settled_by = user.username;
        updatePayload.settle_date = settle_date;
        updatePayload.updated_at = knex.fn.now();

        await knex('entertainment_expenses').where('id', req.params.id).update(updatePayload);

        const updated = await knex('entertainment_expenses').where('id', req.params.id).first();
        res.json({ ...updated, changed });
    } catch (error) {
        console.error('[Entertainment] Settle error:', error);
        if (req.files) req.files.forEach(f => fs.unlink(f.path, () => {}));
        const detail = error?.message || error?.sqlMessage || '';
        res.status(500).json({ error: 'Failed to settle entry', detail });
    }
});

// POST /api/entertainment - Create new entry
router.post('/', upload.array('attachments', 10), async (req, res) => {
    try {
        const user = req.authUser;
        const perms = await getUserEntertainmentPerms(user);
        if (!perms.can_create && user.role !== 'admin' && user.role !== 'superadmin') {
            return res.status(403).json({ error: 'Anda tidak memiliki izin untuk membuat entry' });
        }
        const { tanggal, tempat, alamat, jenis, custom_jenis, nilai, no_gl, relasi, jabatan, nama_perusahaan, jenis_usaha, catatan_kode } = req.body;

        const errors = [];
        if (!tanggal) errors.push('Tanggal wajib diisi');
        if (!tempat) errors.push('Tempat wajib diisi');
        if (!alamat) errors.push('Alamat wajib diisi');
        if (!jenis) errors.push('Jenis wajib diisi');
        if (jenis === 'Custom' && !custom_jenis) errors.push('Custom jenis wajib diisi');
        if (!nilai) errors.push('Nilai wajib diisi');
        if (!no_gl) errors.push('No GL wajib diisi');
        if (!catatan_kode) errors.push('Catatan/Kode wajib diisi');

        let relasiArray = [];
        try { relasiArray = typeof relasi === 'string' ? JSON.parse(relasi) : (relasi || []); } catch { relasiArray = []; }
        if (!Array.isArray(relasiArray) || relasiArray.length === 0) errors.push('Minimal 1 Nama Relasi wajib diisi');

        let jabatanArray = [];
        try { jabatanArray = typeof jabatan === 'string' ? JSON.parse(jabatan) : (jabatan || []); } catch { jabatanArray = []; }
        if (!Array.isArray(jabatanArray)) jabatanArray = [];
        // Align jabatan length with relasi
        while (jabatanArray.length < relasiArray.length) jabatanArray.push('');
        jabatanArray = jabatanArray.slice(0, relasiArray.length);

        let namaPerusahaanArray = [];
        try { namaPerusahaanArray = typeof nama_perusahaan === 'string' ? JSON.parse(nama_perusahaan) : (nama_perusahaan || []); } catch { namaPerusahaanArray = []; }
        if (!Array.isArray(namaPerusahaanArray) || namaPerusahaanArray.length === 0) errors.push('Nama Perusahaan wajib diisi');
        if (!jenis_usaha) errors.push('Jenis Usaha wajib diisi');

        let attachments = [];
        if (req.files && req.files.length > 0) {
            attachments = req.files.map(f => ({
                name: f.originalname, filename: f.filename, path: f.path,
                size: f.size, mimetype: f.mimetype, url: `/uploads/${f.filename}`
            }));
        }
        if (attachments.length === 0) errors.push('Minimal 1 lampiran wajib diupload');

        if (errors.length > 0) {
            if (req.files) req.files.forEach(f => fs.unlink(f.path, () => {}));
            return res.status(400).json({ error: 'Validasi gagal', details: errors });
        }

        const isAdmin = user.role === 'admin' || user.role === 'superadmin';
        const insertPayload = {
            tanggal, tempat, alamat, jenis,
            custom_jenis: jenis === 'Custom' ? custom_jenis : null,
            nilai: parseFloat(nilai), no_gl,
            relasi: JSON.stringify(relasiArray),
            jabatan: JSON.stringify(jabatanArray),
            jumlah_relasi: relasiArray.length,
            nama_perusahaan: JSON.stringify(namaPerusahaanArray),
            jenis_usaha, catatan_kode,
            attachments: JSON.stringify(attachments),
            privacy_type: 'public',
            allowed_departments: JSON.stringify(isAdmin ? [] : [user.department || user.division || '']),
            allowed_users: JSON.stringify([]),
            owner: user.username,
            requester_name: user.name || user.username,
            requester_username: user.username,
            status: 'active'
        };

        let insertedId;
        try {
            const inserted = await knex('entertainment_expenses').insert(insertPayload).returning('id');
            const row = Array.isArray(inserted) ? inserted[0] : inserted;
            insertedId = typeof row === 'object' && row !== null ? row.id : row;
        } catch (insertErr) {
            // Fallback for drivers that don't support returning()
            const rawId = await knex('entertainment_expenses').insert(insertPayload);
            insertedId = Array.isArray(rawId) ? rawId[0] : rawId;
            if (typeof insertedId === 'object' && insertedId !== null) insertedId = insertedId.id;
        }

        const created = await knex('entertainment_expenses').where('id', insertedId).first();
        res.status(201).json(created || { id: insertedId, ...insertPayload });
    } catch (error) {
        console.error('[Entertainment] POST error:', error);
        if (req.files) req.files.forEach(f => fs.unlink(f.path, () => {}));
        res.status(500).json({ error: error.message || 'Failed to create entry' });
    }
});

// PUT /api/entertainment/:id - Update entry
router.put('/:id', upload.array('attachments', 10), async (req, res) => {
    try {
        const existing = await knex('entertainment_expenses').where('id', req.params.id).first();
        if (!existing) return res.status(404).json({ error: 'Data not found' });

        const user = req.authUser;
        const perms = await getUserEntertainmentPerms(user);
        if (!perms.can_edit && user.role !== 'admin' && user.role !== 'superadmin' && existing.requester_username !== user.username) {
            return res.status(403).json({ error: 'Anda tidak memiliki izin untuk edit entry' });
        }

        const { tanggal, tempat, alamat, jenis, custom_jenis, nilai, no_gl, relasi, jabatan, nama_perusahaan, jenis_usaha, catatan_kode, existing_attachments } = req.body;

        const errors = [];
        if (!tanggal) errors.push('Tanggal wajib diisi');
        if (!tempat) errors.push('Tempat wajib diisi');
        if (!alamat) errors.push('Alamat wajib diisi');
        if (!jenis) errors.push('Jenis wajib diisi');
        if (jenis === 'Custom' && !custom_jenis) errors.push('Custom jenis wajib diisi');
        if (!nilai) errors.push('Nilai wajib diisi');
        if (!no_gl) errors.push('No GL wajib diisi');
        if (!catatan_kode) errors.push('Catatan/Kode wajib diisi');

        let relasiArray = [];
        try { relasiArray = typeof relasi === 'string' ? JSON.parse(relasi) : (relasi || []); } catch { relasiArray = []; }
        if (!Array.isArray(relasiArray) || relasiArray.length === 0) errors.push('Minimal 1 Nama Relasi wajib diisi');

        let jabatanArray = [];
        try { jabatanArray = typeof jabatan === 'string' ? JSON.parse(jabatan) : (jabatan || []); } catch { jabatanArray = []; }
        if (!Array.isArray(jabatanArray)) jabatanArray = [];
        while (jabatanArray.length < relasiArray.length) jabatanArray.push('');
        jabatanArray = jabatanArray.slice(0, relasiArray.length);

        let namaPerusahaanArray = [];
        try { namaPerusahaanArray = typeof nama_perusahaan === 'string' ? JSON.parse(nama_perusahaan) : (nama_perusahaan || []); } catch { namaPerusahaanArray = []; }
        if (!Array.isArray(namaPerusahaanArray) || namaPerusahaanArray.length === 0) errors.push('Nama Perusahaan wajib diisi');
        if (!jenis_usaha) errors.push('Jenis Usaha wajib diisi');

        let finalAttachments = [];
        try {
            finalAttachments = existing_attachments
                ? (typeof existing_attachments === 'string' ? JSON.parse(existing_attachments) : existing_attachments)
                : (typeof existing.attachments === 'string' ? JSON.parse(existing.attachments) : existing.attachments || []);
        } catch { finalAttachments = []; }

        if (req.files && req.files.length > 0) {
            const newAtt = req.files.map(f => ({
                name: f.originalname, filename: f.filename, path: f.path,
                size: f.size, mimetype: f.mimetype, url: `/uploads/${f.filename}`
            }));
            finalAttachments = [...finalAttachments, ...newAtt];
        }
        if (finalAttachments.length === 0) errors.push('Minimal 1 lampiran wajib');

        if (errors.length > 0) {
            if (req.files) req.files.forEach(f => fs.unlink(f.path, () => {}));
            return res.status(400).json({ error: 'Validasi gagal', details: errors });
        }

        await knex('entertainment_expenses').where('id', req.params.id).update({
            tanggal, tempat, alamat, jenis,
            custom_jenis: jenis === 'Custom' ? custom_jenis : null,
            nilai: parseFloat(nilai), no_gl,
            relasi: JSON.stringify(relasiArray),
            jabatan: JSON.stringify(jabatanArray),
            jumlah_relasi: relasiArray.length,
            nama_perusahaan: JSON.stringify(namaPerusahaanArray),
            jenis_usaha, catatan_kode,
            attachments: JSON.stringify(finalAttachments),
            updated_at: knex.fn.now()
        });

        const updated = await knex('entertainment_expenses').where('id', req.params.id).first();
        res.json(updated);
    } catch (error) {
        console.error('[Entertainment] PUT error:', error);
        if (req.files) req.files.forEach(f => fs.unlink(f.path, () => {}));
        res.status(500).json({ error: 'Failed to update entry' });
    }
});

// DELETE /api/entertainment/:id - Delete entry
router.delete('/:id', async (req, res) => {
    try {
        const existing = await knex('entertainment_expenses').where('id', req.params.id).first();
        if (!existing) return res.status(404).json({ error: 'Data not found' });

        const user = req.authUser;
        const perms = await getUserEntertainmentPerms(user);
        if (!perms.can_delete && user.role !== 'admin' && user.role !== 'superadmin' && existing.requester_username !== user.username) {
            return res.status(403).json({ error: 'Anda tidak memiliki izin untuk hapus entry' });
        }

        let att = [];
        try { att = typeof existing.attachments === 'string' ? JSON.parse(existing.attachments) : (existing.attachments || []); } catch { att = []; }
        att.forEach(a => { if (a.path && fs.existsSync(a.path)) fs.unlink(a.path, () => {}); });

        await knex('entertainment_expenses').where('id', req.params.id).del();
        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        console.error('[Entertainment] DELETE error:', error);
        res.status(500).json({ error: 'Failed to delete entry' });
    }
});

export default router;
