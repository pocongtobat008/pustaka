import { handleError } from '../utils/errorHandler.js';
import { knex } from '../db.js';
import { systemLog } from '../utils/logger.js';
import XLSX from 'xlsx';
import fs from 'fs';
import { addOcrJob } from '../utils/queue.js';
import { parseJsonArraySafe, parseJsonObjectSafe } from '../utils/jsonSafe.js';
import {
    taxObjectUpsertSchema,
    taxAuditUpsertSchema,
    taxAuditStatusSchema,
    taxSummaryUpsertSchema,
    taxWpUpsertSchema,
    taxAuditNoteSchema,
    validateRequestBody
} from '../utils/requestValidation.js';

function normalizeMySqlDateTime(value) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') return value;

    // Keep yyyy-mm-dd input stable and store it as midnight datetime
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return `${value} 00:00:00`;
    }

    // Convert ISO timestamps to MySQL datetime (drop timezone/millis)
    if (value.includes('T')) {
        return value.replace('T', ' ').replace(/\.\d{3}Z$/, '').replace(/Z$/, '').slice(0, 19);
    }

    return value;
}

// --- TAX OBJECTS ---
export const getTaxObjects = async (req, res) => {
    try {
        const objects = await knex('master_tax_objects').select('*');
        res.json(objects);
    } catch (err) {
        handleError(res, err, "TAX Error");
    }
};

export const createTaxObject = async (req, res) => {
    try {
        const data = validateRequestBody(taxObjectUpsertSchema, req, res);
        if (!data) return;

        const { code, name, tax_type, rate, note, is_pph21_bukan_pegawai, use_ppn, markup_mode } = data;
        const [id] = await knex('master_tax_objects').insert({
            code, name, tax_type,
            rate: parseFloat(rate) || 0,
            note: note || null,
            is_pph21_bukan_pegawai: is_pph21_bukan_pegawai ? 1 : 0,
            use_ppn: use_ppn !== undefined ? (use_ppn ? 1 : 0) : 1,
            markup_mode: markup_mode || 'none'
        });
        await systemLog('Admin', "Create Tax Object", `Created: ${name} (${code})`);
        req.app.get('io')?.emit('data:changed', { channel: 'tax' });
        res.json({ id });
    } catch (e) {
        handleError(res, e, "TAX Error");
    }
};

export const updateTaxObject = async (req, res) => {
    try {
        const { id } = req.params;
        const data = validateRequestBody(taxObjectUpsertSchema, req, res);
        if (!data) return;

        const { code, name, tax_type, rate, note, is_pph21_bukan_pegawai, use_ppn, markup_mode } = data;
        await knex('master_tax_objects').where('id', id).update({
            code, name, tax_type,
            rate: parseFloat(rate) || 0,
            note: note || null,
            is_pph21_bukan_pegawai: is_pph21_bukan_pegawai ? 1 : 0,
            use_ppn: use_ppn !== undefined ? (use_ppn ? 1 : 0) : 1,
            markup_mode: markup_mode || 'none'
        });
        await systemLog('Admin', "Update Tax Object", `Updated: ${name} (ID: ${id})`);
        req.app.get('io')?.emit('data:changed', { channel: 'tax' });
        res.json({ success: true });
    } catch (e) {
        handleError(res, e, "TAX Error");
    }
};

export const deleteTaxObject = async (req, res) => {
    try {
        const { id } = req.params;
        const obj = await knex('master_tax_objects').where('id', id).first();
        await knex('master_tax_objects').where('id', id).del();
        await systemLog('Admin', "Delete Tax Object", `Deleted: ${obj?.name || id}`);
        req.app.get('io')?.emit('data:changed', { channel: 'tax' });
        res.json({ success: true });
    } catch (e) {
        handleError(res, e, "TAX Error");
    }
};

// --- TAX AUDITS ---
export const getTaxAudits = async (req, res) => {
    try {
        const audits = await knex('tax_audits').select('*').orderBy('startDate', 'desc');
        // Parse steps JSON if it's a string
        const parsedAudits = audits.map(a => ({
            ...a,
            steps: parseJsonArraySafe(a.steps)
        }));
        res.json(parsedAudits);
    } catch (err) {
        handleError(res, err, "TAX Error");
    }
};

export const createTaxAudit = async (req, res) => {
    try {
        const validated = validateRequestBody(taxAuditUpsertSchema, req, res);
        if (!validated) return;

        const data = { ...validated };

        // Handle object fields
        if (data.steps && typeof data.steps !== 'string') {
            data.steps = JSON.stringify(data.steps);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'startDate')) {
            data.startDate = normalizeMySqlDateTime(data.startDate);
        }

        await knex('tax_audits').insert(data);
        await systemLog('Admin', "Create Audit", `Started audit for: ${data.title}`);
        req.app.get('io')?.emit('data:changed', { channel: 'tax' });
        res.json({ success: true, id: data.id });
    } catch (e) {
        handleError(res, e, "TAX Error");
    }
};

export const updateAuditStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const data = validateRequestBody(taxAuditStatusSchema, req, res);
        if (!data) return;

        const { status, remarks } = data;
        await knex('tax_audits').where('id', id).update({
            status,
            notes: remarks ? knex.raw('CONCAT(notes, ?)', [`\n[${new Date().toISOString()}] ${remarks}`]) : undefined
        });
        req.app.get('io')?.emit('data:changed', { channel: 'tax' });
        res.json({ success: true });
    } catch (e) {
        handleError(res, e, "TAX Error");
    }
};

export const updateTaxAudit = async (req, res) => {
    try {
        const { id } = req.params;
        const validated = validateRequestBody(taxAuditUpsertSchema, req, res);
        if (!validated) return;

        const data = { ...validated };

        // Never allow primary key updates from payload
        delete data.id;

        // Flatten steps if they are provided as an object/array
        if (data.steps && typeof data.steps !== 'string') {
            data.steps = JSON.stringify(data.steps);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'startDate')) {
            data.startDate = normalizeMySqlDateTime(data.startDate);
        }

        await knex('tax_audits').where('id', id).update(data);
        await systemLog('Admin', "Update Audit", `Updated audit ID: ${id}`);
        req.app.get('io')?.emit('data:changed', { channel: 'tax' });
        res.json({ success: true });
    } catch (e) {
        handleError(res, e, "TAX Error");
    }
};

export const deleteTaxAudit = async (req, res) => {
    try {
        const { id } = req.params;
        await knex('tax_audits').where('id', id).del();
        // Also delete associated notes
        await knex('tax_audit_notes').where('auditId', id).del();
        await systemLog('Admin', "Delete Audit", `Deleted audit ID: ${id}`);
        req.app.get('io')?.emit('data:changed', { channel: 'tax' });
        res.json({ success: true });
    } catch (e) {
        handleError(res, e, "TAX Error");
    }
};

// --- TAX SUMMARIES ---
export const getTaxSummaries = async (req, res) => {
    try {
        const items = await knex('tax_summaries').select('*');
        const parsedItems = items.map(item => ({
            ...item,
            data: parseJsonObjectSafe(item.data, {})
        }));
        res.json(parsedItems);
    } catch (err) {
        handleError(res, err, "TAX Error");
    }
};

// GET /api/tax/compare?metrics=pph,ppn&start=YYYY-MM&end=YYYY-MM&limit=12&pembetulan=all
export const compareTaxSummaries = async (req, res) => {
    try {
        const { metrics = 'pph,ppn', start, end, limit = 12, pembetulan = 'all' } = req.query;
        // Validate inputs
        const validMetrics = ['pph', 'ppn'];
        const requested = metrics.split(',').map(m => m.trim().toLowerCase()).filter(Boolean);
        if (requested.some(m => !validMetrics.includes(m))) return res.status(400).json({ error: 'Invalid metrics parameter' });
        if (pembetulan !== 'all' && Number.isNaN(Number(pembetulan))) return res.status(400).json({ error: 'Invalid pembetulan param' });
        if (Number(limit) <= 0 || Number(limit) > 120) return res.status(400).json({ error: 'limit must be between 1 and 120' });
        const metricList = metrics.split(',').map(m => m.trim().toLowerCase()).filter(Boolean);

        // Determine date range
        const now = new Date();
        const defaultEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const endMonth = end || defaultEnd;

        // compute start as either provided or (limit months before end)
        let startMonth = start;
        if (!startMonth) {
            const [ey, em] = endMonth.split('-').map(Number);
            const endDate = new Date(ey, em - 1, 1);
            const sDate = new Date(endDate);
            sDate.setMonth(sDate.getMonth() - (Number(limit) - 1));
            startMonth = `${sDate.getFullYear()}-${String(sDate.getMonth() + 1).padStart(2, '0')}`;
        }

        // helper to format period key and month name mapping
        const monthNames = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
        const monthNameToNum = m => {
            const idx = monthNames.findIndex(x => x.toLowerCase() === String(m).toLowerCase());
            return idx >= 0 ? idx + 1 : null;
        };

        // Fetch relevant summaries between startMonth..endMonth inclusive
        // We'll load PPH and PPN rows and then aggregate in JS
        const rows = await knex('tax_summaries')
            .select('*');

        // Filter rows to period range and pembetulan
        const parsePeriod = (r) => {
            // r.month is expected as month name (e.g., "Januari")
            const mnum = monthNameToNum(r.month) || (Number(r.month) || null);
            if (!mnum) return null;
            return `${r.year}-${String(mnum).padStart(2, '0')}`;
        };

        const startKey = startMonth;
        const endKey = endMonth;

        // Build map period -> aggregated values
        const seriesMap = new Map();

        for (const r of rows) {
            const period = parsePeriod(r);
            if (!period) continue;
            if (period < startKey || period > endKey) continue;
            if (pembetulan !== 'all' && String(r.pembetulan || 0) !== String(pembetulan)) continue;

            const data = parseJsonObjectSafe(r.data, {});

            // compute sums
            const pph_total = Object.values(data.pph || {}).reduce((a, b) => a + (Number(b) || 0), 0);
            const ppn_in = Object.values(data.ppnIn || {}).reduce((a, b) => a + (Number(b) || 0), 0);
            const ppn_out = Object.values(data.ppnOut || {}).reduce((a, b) => a + (Number(b) || 0), 0);
            const ppn_net = ppn_out - ppn_in;

            const prev = seriesMap.get(period) || { period, pph_total: 0, ppn_in: 0, ppn_out: 0, ppn_net: 0, rows: [] };
            prev.pph_total += pph_total;
            prev.ppn_in += ppn_in;
            prev.ppn_out += ppn_out;
            prev.ppn_net += ppn_net;
            prev.rows.push(r.id || null);
            seriesMap.set(period, prev);
        }

        // Ensure continuous series from startKey to endKey
        const startParts = startKey.split('-').map(Number);
        const endParts = endKey.split('-').map(Number);
        let cursor = new Date(startParts[0], startParts[1] - 1, 1);
        const endDate = new Date(endParts[0], endParts[1] - 1, 1);
        const series = [];
        while (cursor <= endDate) {
            const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
            const val = seriesMap.get(key) || { period: key, pph_total: 0, ppn_in: 0, ppn_out: 0, ppn_net: 0, rows: [] };
            series.push(val);
            cursor.setMonth(cursor.getMonth() + 1);
        }

        // Aggregates
        const aggregates = series.reduce((acc, s) => {
            acc.total_pph += s.pph_total;
            acc.total_ppn_in += s.ppn_in;
            acc.total_ppn_out += s.ppn_out;
            acc.total_ppn_net += s.ppn_net;
            return acc;
        }, { total_pph: 0, total_ppn_in: 0, total_ppn_out: 0, total_ppn_net: 0 });

        // last under/overpayment for ppn
        let lastUnder = null;
        let lastOver = null;
        for (let i = series.length - 1; i >= 0; i--) {
            const s = series[i];
            if (!lastUnder && s.ppn_net < 0) lastUnder = { period: s.period, amount: Math.abs(s.ppn_net) };
            if (!lastOver && s.ppn_net > 0) lastOver = { period: s.period, amount: s.ppn_net };
            if (lastUnder && lastOver) break;
        }

        res.json({
            meta: { metrics: metricList, start: startKey, end: endKey },
            series,
            aggregates,
            lastUnderpayment: lastUnder,
            lastOverpayment: lastOver
        });
    } catch (e) {
        console.error('Compare Tax Summaries Error', e);
        handleError(res, e, 'Tax Compare Error');
    }
};

// GET /api/tax/overunder?metric=ppn|pph&start=YYYY-MM&end=YYYY-MM&limit=20&type=over|under|both
export const getOverUnderHistory = async (req, res) => {
    try {
        const { metric = 'ppn', start, end, limit = 20, type = 'both', pembetulan = 'all' } = req.query;
        // Validation
        if (!['ppn','pph'].includes(metric)) return res.status(400).json({ error: 'metric must be ppn or pph' });
        if (!['both','over','under'].includes(type)) return res.status(400).json({ error: 'type must be one of both, over, under' });
        if (pembetulan !== 'all' && Number.isNaN(Number(pembetulan))) return res.status(400).json({ error: 'Invalid pembetulan param' });
        if (Number(limit) <= 0 || Number(limit) > 240) return res.status(400).json({ error: 'limit must be between 1 and 240' });

        const monthNames = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
        const monthNameToNum = m => {
            const idx = monthNames.findIndex(x => x.toLowerCase() === String(m).toLowerCase());
            return idx >= 0 ? idx + 1 : null;
        };

        // fetch all summaries (we'll filter in JS)
        const rows = await knex('tax_summaries').select('*');

        const parsePeriod = (r) => {
            const mnum = monthNameToNum(r.month) || (Number(r.month) || null);
            if (!mnum) return null;
            return `${r.year}-${String(mnum).padStart(2, '0')}`;
        };

        // default range: last 24 months
        const now = new Date();
        const defaultEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const endKey = end || defaultEnd;

        let startKey = start;
        if (!startKey) {
            const [ey, em] = endKey.split('-').map(Number);
            const ed = new Date(ey, em - 1, 1);
            ed.setMonth(ed.getMonth() - (Number(limit) - 1));
            startKey = `${ed.getFullYear()}-${String(ed.getMonth() + 1).padStart(2, '0')}`;
        }

        const items = [];
        for (const r of rows) {
            const period = parsePeriod(r);
            if (!period) continue;
            if (period < startKey || period > endKey) continue;
            if (pembetulan !== 'all' && String(r.pembetulan || 0) !== String(pembetulan)) continue;

            const data = parseJsonObjectSafe(r.data, {});

            if (metric === 'ppn') {
                const ppn_in = Object.values(data.ppnIn || {}).reduce((a, b) => a + (Number(b) || 0), 0);
                const ppn_out = Object.values(data.ppnOut || {}).reduce((a, b) => a + (Number(b) || 0), 0);
                const net = ppn_out - ppn_in;
                const kind = net > 0 ? 'over' : (net < 0 ? 'under' : 'neutral');
                if (type === 'both' || (type === 'over' && kind === 'over') || (type === 'under' && kind === 'under')) {
                    items.push({ period, metric: 'ppn', amount: Math.abs(net), net, kind, id: r.id });
                }
            } else {
                // PPH: treat pph_total as positive amounts; define 'over'/'under' may be domain specific — we'll mark only totals
                const pph_total = Object.values(data.pph || {}).reduce((a, b) => a + (Number(b) || 0), 0);
                // For PPH, over/under semantics not standardized here; include as neutral with total
                items.push({ period, metric: 'pph', amount: pph_total, net: pph_total, kind: 'total', id: r.id });
            }
        }

        // sort desc by period
        items.sort((a, b) => (a.period < b.period ? 1 : -1));

        // apply limit
        const limited = items.slice(0, Number(limit));

        res.json({ meta: { metric, start: startKey, end: endKey, limit: Number(limit), type }, items: limited });
    } catch (e) {
        console.error('Over/Under History Error', e);
        handleError(res, e, 'OverUnder Error');
    }
};

export const upsertTaxSummary = async (req, res) => {
    try {
        const payload = validateRequestBody(taxSummaryUpsertSchema, req, res);
        if (!payload) return;

        const { id, type, month, year, pembetulan, data } = payload;

        // Stringify data if it's an object
        const finalData = typeof data === 'string' ? data : JSON.stringify(data || {});

        // Generate a unique ID if not provided (for new records)
        // Format: type_month_year_pembetulan (e.g. PPH_Februari_2026_0)
        const recordId = id || `${type}_${month}_${year}_${pembetulan}`;

        // Check for existing record by ID or by the specific combination
        const existing = await knex('tax_summaries')
            .where('id', recordId)
            .orWhere({ type, month, year, pembetulan })
            .first();

        if (existing) {
            await knex('tax_summaries')
                .where({ id: existing.id })
                .update({
                    data: finalData,
                    pembetulan: pembetulan || 0 // Update pembetulan if needed
                });
        } else {
            await knex('tax_summaries').insert({
                id: recordId,
                type,
                month,
                year,
                pembetulan: pembetulan || 0,
                data: finalData
            });
        }

        await systemLog('System', "Upsert Tax Summary", `Updated summary for ${month} ${year} (${type})`);
        req.app.get('io')?.emit('data:changed', { channel: 'tax' });
        res.json({ success: true, id: recordId });
    } catch (e) {
        console.error("Upsert Tax Summary Error:", e);
        handleError(res, e, "TAX Error");
    }
};

export const deleteTaxSummary = async (req, res) => {
    try {
        const { id } = req.params;
        await knex('tax_summaries').where('id', id).del();
        await systemLog('Admin', "Delete Tax Summary", `Deleted record ID: ${id}`);
        req.app.get('io')?.emit('data:changed', { channel: 'tax' });
        res.json({ success: true });
    } catch (e) {
        handleError(res, e, "TAX Error");
    }
};

// --- DATABASE WP (tax_objects table) ---
export const getTaxWp = async (req, res) => {
    try {
        const rows = await knex('tax_objects').select('*').orderBy('created_at', 'desc');
        res.json(rows);
    } catch (err) {
        handleError(res, err, "TAX Error");
    }
};

export const createTaxWp = async (req, res) => {
    try {
        const payload = validateRequestBody(taxWpUpsertSchema, req, res);
        if (!payload) return;

        const [id] = await knex('tax_objects').insert(payload);
        await systemLog('Admin', "Create Tax WP", `Created entry for: ${payload.name || '-'}`);
        req.app.get('io')?.emit('data:changed', { channel: 'tax' });
        res.json({ id });
    } catch (e) {
        handleError(res, e, "TAX Error");
    }
};

export const updateTaxWp = async (req, res) => {
    try {
        const { id } = req.params;
        const payload = validateRequestBody(taxWpUpsertSchema, req, res);
        if (!payload) return;

        await knex('tax_objects').where('id', id).update(payload);
        await systemLog('Admin', "Update Tax WP", `Updated ID: ${id}`);
        req.app.get('io')?.emit('data:changed', { channel: 'tax' });
        res.json({ success: true });
    } catch (e) {
        handleError(res, e, "TAX Error");
    }
};

export const deleteTaxWp = async (req, res) => {
    try {
        await knex('tax_objects').where('id', req.params.id).del();
        req.app.get('io')?.emit('data:changed', { channel: 'tax' });
        res.json({ success: true });
    } catch (e) {
        handleError(res, e, "TAX Error");
    }
};

export const deleteAllTaxWp = async (req, res) => {
    try {
        await knex('tax_objects').del();
        await systemLog('Admin', "Delete All Tax WP", "Cleared all WP data");
        req.app.get('io')?.emit('data:changed', { channel: 'tax' });
        res.json({ success: true });
    } catch (e) {
        handleError(res, e, "TAX Error");
    }
};

// --- TAX AUDIT NOTES ---
export const getAuditNotes = async (req, res) => {
    try {
        const { id, stepIndex } = req.params;
        const notes = await knex('tax_audit_notes')
            .where({ auditId: id, stepIndex: stepIndex })
            .orderBy('timestamp', 'asc');
        res.json(notes);
    } catch (err) {
        handleError(res, err, "TAX Error");
    }
};

export const addAuditNote = async (req, res) => {
    try {
        const { id, stepIndex } = req.params;
        const data = validateRequestBody(taxAuditNoteSchema, req, res);
        if (!data) return;

        const { user, text } = data;

        let attachmentUrl = null;
        let attachmentName = null;
        let attachmentType = null;
        let attachmentSize = null;

        if (req.file) {
            attachmentUrl = `/uploads/${req.file.filename}`;
            attachmentName = req.file.originalname;
            attachmentType = req.file.mimetype;
            attachmentSize = (req.file.size / 1024).toFixed(2) + ' KB';
        }

        const [noteId] = await knex('tax_audit_notes').insert({
            auditId: id,
            stepIndex,
            user,
            text,
            attachmentUrl,
            attachmentName,
            attachmentType,
            attachmentSize
        });

        // Trigger OCR if there's an attachment
        if (req.file) {
            try {
                const context = { type: 'tax_note', noteId };
                await addOcrJob(
                    `note-${noteId}`,
                    req.file.path,
                    JSON.stringify(context),
                    req.file.mimetype,
                    req.file.originalname,
                    req.file.size
                );
            } catch (qErr) {
                console.error("Queue Error for Tax Note OCR:", qErr);
            }
        }

        await systemLog(user || 'System', "Add Audit Note", `Added note to audit ${id} step ${stepIndex}`);
        req.app.get('io')?.emit('data:changed', { channel: 'tax' });
        res.json({ success: true, id: noteId });
    } catch (e) {
        handleError(res, e, "TAX Error");
    }
};

// --- IMPORT FUNCTIONS ---
export const importTaxObjects = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (!rawData || rawData.length === 0) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: "File Excel kosong atau tidak terbaca" });
        }

        const formattedData = rawData.map(item => {
            // Helper to find key case-insensitively
            const getVal = (possibleKeys) => {
                const actualKeys = Object.keys(item);
                for (const pk of possibleKeys) {
                    const match = actualKeys.find(ak => ak.toLowerCase().replace(/_/g, '') === pk.toLowerCase().replace(/_/g, ''));
                    if (match) return item[match];
                }
                return undefined;
            };

            return {
                code: getVal(['tax_object_code', 'code', 'kode']),
                name: getVal(['tax_object_name', 'name', 'nama']),
                tax_type: String(getVal(['tax_type', 'type', 'jenis']) || ''),
                rate: parseFloat(getVal(['rate', 'tarif']) || 0),
                note: getVal(['note', 'description', 'keterangan']),
                is_pph21_bukan_pegawai: getVal(['is_pph21_bukan_pegawai', 'isPph21BukanPegawai']) ? 1 : 0,
                use_ppn: getVal(['use_ppn', 'usePpn']) !== undefined ? (getVal(['use_ppn', 'usePpn']) ? 1 : 0) : 1,
                markup_mode: getVal(['markup_mode', 'markupMode']) || 'none'
            };
        }).filter(row => row.code && row.name);

        if (formattedData.length === 0) {
            console.warn("[Import Master] No valid rows found. Raw Data Sample:", rawData[0]);
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: "Tidak ada data valid yang ditemukan. Pastikan kolom 'code' dan 'name' tersedia." });
        }

        let importCount = 0;
        for (const row of formattedData) {
            try {
                const existing = await knex('master_tax_objects').where('code', row.code).first();
                if (existing) {
                    await knex('master_tax_objects').where('code', row.code).update(row);
                } else {
                    await knex('master_tax_objects').insert(row);
                }
                importCount++;
            } catch (rowErr) {
                console.error(`[Import Master] Row error (${row.code}):`, rowErr.message);
            }
        }

        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        await systemLog('Admin', "Import Tax Objects", `Success: ${importCount}/${formattedData.length} records`);
        req.app.get('io')?.emit('data:changed', { channel: 'tax' });
        res.json({ message: `Berhasil mengimport ${importCount} data master objek pajak` });
    } catch (e) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        console.error("Import Master fatal error:", e);
        handleError(res, e, "TAX Error");
    }
};

export const importTaxWp = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        const formattedData = data.map(item => ({
            id_type: item.id_type || item.idType || 'NPWP',
            identity_number: item.identity_number || item.identityNumber,
            name: item.name,
            email: item.email,
            tax_type: item.tax_type || item.taxType,
            tax_object_code: item.tax_object_code || item.taxObjectCode,
            tax_object_name: item.tax_object_name || item.taxObjectName,
            dpp: item.dpp || 0,
            rate: item.rate || 0,
            pph: item.pph || 0,
            ppn: item.ppn || 0,
            total_payable: item.total_payable || item.totalPayable || 0,
            discount: item.discount || 0,
            dpp_net: item.dpp_net || item.dppNet || 0,
            markup_mode: item.markup_mode || item.markupMode || 'none',
            is_pph21_bukan_pegawai: item.is_pph21_bukan_pegawai !== undefined ? item.is_pph21_bukan_pegawai : (item.isPph21BukanPegawai ? 1 : 0),
            use_ppn: item.use_ppn !== undefined ? item.use_ppn : (item.usePpn !== undefined ? (item.usePpn ? 1 : 0) : 1)
        })).filter(row => row.identity_number); // Filter out rows without identity number

        if (formattedData.length === 0) {
            return res.status(400).json({ error: "Tidak ada data valid yang ditemukan dalam file" });
        }

        // Batch upsert based on identity_number and tax_object_code? 
        // Or just insert? User might want to update existing.
        for (const row of formattedData) {
            try {
                const existing = await knex('tax_objects')
                    .where({ identity_number: row.identity_number, tax_object_code: row.tax_object_code })
                    .first();

                if (existing) {
                    await knex('tax_objects').where('id', existing.id).update(row);
                } else {
                    await knex('tax_objects').insert(row);
                }
            } catch (rowErr) {
                console.error(`Error importing WP row ${row.identity_number}:`, rowErr);
            }
        }

        // Cleanup
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        await systemLog('Admin', "Import Tax WP", `Imported ${formattedData.length} records`);
        req.app.get('io')?.emit('data:changed', { channel: 'tax' });
        res.json({ message: `Berhasil mengimport ${formattedData.length} data wajib pajak` });
    } catch (e) {
        console.error("Import WP error:", e);
        handleError(res, e, "TAX Error");
    }
};
