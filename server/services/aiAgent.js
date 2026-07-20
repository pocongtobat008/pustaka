import { knex } from '../db.js';
import { findCachedReply, saveToCache } from './agentCache.js';

// ── Self-improvement: log learning asynchronously (fire & forget) ──
function logLearning(sessionId, message, reply, toolCalls) {
    import('./selfImprovement.js').then(({ logInteraction }) => {
        logInteraction({
            sessionId,
            messageId: null,
            question: message,
            answer: reply,
            toolCalls,
        }).catch(() => {});
    }).catch(() => {});
}

// ── Correction detection: detect user corrections and log them ──
function detectAndLogCorrection(sessionId, message, history) {
    import('./selfImprovement.js').then(async ({ detectCorrection, logCorrection }) => {
        const detection = detectCorrection(message);
        if (!detection) return;

        console.log(`[AI Agent] Correction detected (severity: ${detection.severity}) in: "${message.slice(0, 80)}"`);

        // Get the last AI response from history to log as wrong answer
        const lastAiResponse = history?.length > 0
            ? [...history].reverse().find(m => m.role === 'assistant')?.content || ''
            : '';

        // Extract what the user says is correct (after the correction phrase)
        let correctAnswer = message;
        const correctionMarkers = [
            /(?:salah|revisi|koreksi|bukan\s+begitu|yang\s+benar\s+adalah|yang\s+tepat\s+adalah|seharusnya|harusnya|maksudnya\s+bukan)\s*[:,]?\s*/i,
        ];
        for (const marker of correctionMarkers) {
            const match = message.match(marker);
            if (match && match.index !== undefined) {
                correctAnswer = message.slice(match.index + match[0].length).trim();
                break;
            }
        }

        await logCorrection({
            sessionId,
            question: message,
            wrongAnswer: lastAiResponse.slice(0, 2000),
            correctAnswer: correctAnswer.slice(0, 2000),
            correctionNote: null,
            correctionType: detection.severity > 0.7 ? 'correction' : 'revision',
        });
    }).catch(() => {});
}

async function getAiSettings() {
    const row = await knex('ai_settings').orderBy('id', 'asc').first();
    if (!row) return { id: null, base_url: '', api_key: '', model: '', enabled: false };
    return row;
}

/**
 * Mask an API key for safe display (e.g. sk-1234****abcd).
 */
export function maskKey(key) {
    if (!key) return '';
    const s = String(key);
    if (s.length <= 8) return '••••••••';
    return s.slice(0, 4) + '••••••••' + s.slice(-4);
}

export async function getAiModels() {
    const settings = await getAiSettings();
    if (!settings.base_url || !settings.api_key) return [];
    const url = (settings.base_url || '').replace(/\/+$/, '') + '/models';
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${settings.api_key}` }
    });
    if (!res.ok) throw new Error(`Models request failed (${res.status})`);
    const json = await res.json();
    return (json.data || []).map(m => m.id).filter(Boolean);
}

// ── Optimizations ──
const MAX_ITERATIONS = 4;
const MAX_HISTORY = 5;             // last 5 messages sufficient for context
const TOOL_RESULT_ROWS = 15;       // compact results, ask LLM for more if needed
const TOOL_RESULT_ROWS_LIST = 15;  // default list limit
const OCR_SNIPPET = 500;           // enough for context, saves tokens
const PARALLEL_EXECUTION = true;   // execute multiple tool calls concurrently
const RAG_CONTEXT_LIMIT = 3;       // max relevant past conversations to retrieve

// ── Intent pre-classification ──
const INTENT_PATTERNS = {
    tax_summary: /laporan\s+pajak|rekap\s+pajak|ppn|pph|ringkasan\s+pajak|tax\s+summary|summary\s+pajak/i,
    tax_wp: /data\s+wp|wajib\s+pajak|npwp|nama\s+wp/i,
    tax_audit: /audit|pemeriksaan|pemeriksaan\s+pajak/i,
    invoice: /invoice|faktur|faktur\s+pajak|vendor|bayar|pembayaran/i,
    document: /dokumen|arsip|file|surat|upload/i,
    approval: /persetujuan|approval|pengajuan|disetujui|pending/i,
    user: /user|pengguna|staff|karyawan|departemen/i,
    coa: /coa|chart\s+of\s+accounts|akun\s+perkiraan|kode\s+akun|akun\s+induk|sub\s+coa|sub\s+akun|departemen\s+akun|buku\s+besar|general\s+ledger/i,
    inventory: /inventory|box|arsip\s+fisik|gudang|rak|lokasi\s+arsip/i,
    tax_object: /objek\s+pajak|kode\s+pajak|tarif|rate/i,
    report: /laporan|ringkasan|rekap|summary|statistik|total|hitung/i,
    search: /cari|find|search|lookup|tampilkan/i,
};

function classifyIntent(msg) {
    const lower = msg.toLowerCase();
    for (const [intent, pattern] of Object.entries(INTENT_PATTERNS)) {
        if (pattern.test(lower)) return intent;
    }
    return 'general';
}

// ── Tool definitions (OpenAI function-calling format) ──
function buildTools() {
    return [
        {
            type: 'function',
            function: {
                name: 'search_documents',
                description: 'Cari dokumen arsip berdasarkan kata kunci di judul atau isi OCR.',
                parameters: { type: 'object', properties: { query: { type: 'string', description: 'Kata kunci pencarian' }, limit: { type: 'integer', description: 'Jumlah hasil (default 15)' } }, required: ['query'] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'list_documents',
                description: 'Tampilkan daftar semua dokumen terbaru tanpa filter.',
                parameters: { type: 'object', properties: { limit: { type: 'integer', description: 'Jumlah hasil (default 15)' } }, required: [] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'search_invoices',
                description: 'Cari invoice/faktur berdasarkan vendor, nomor invoice, atau nomor faktur pajak.',
                parameters: { type: 'object', properties: { query: { type: 'string', description: 'Kata kunci pencarian' }, limit: { type: 'integer', description: 'Jumlah hasil (default 15)' } }, required: ['query'] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'list_invoices',
                description: 'Tampilkan daftar semua invoice terbaru.',
                parameters: { type: 'object', properties: { limit: { type: 'integer', description: 'Jumlah hasil (default 15)' } }, required: [] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'search_tax_wp',
                description: 'Cari data Wajib Pajak (WP) dari tabel master WP.',
                parameters: { type: 'object', properties: { query: { type: 'string', description: 'Nama atau NPWP' }, limit: { type: 'integer' } }, required: ['query'] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'list_tax_wp',
                description: 'Tampilkan semua data Wajib Pajak (WP).',
                parameters: { type: 'object', properties: { limit: { type: 'integer' } }, required: [] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'search_tax_objects',
                description: 'Cari objek pajak dari tabel master_tax_objects.',
                parameters: { type: 'object', properties: { query: { type: 'string', description: 'Nama atau kode objek' }, limit: { type: 'integer' } }, required: ['query'] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'search_external_items',
                description: 'Cari item eksternal / box arsip berdasarkan box id atau tujuan.',
                parameters: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'integer' } }, required: ['query'] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'search_inventory',
                description: 'Cari item inventory / box berdasarkan kata kunci.',
                parameters: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'integer' } }, required: ['query'] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_tax_summaries',
                description: 'Ambil data ringkasan pajak (PPN/PPh) dengan detail angka. Field data berisi detail ppnIn/ppnOut/pph.',
                parameters: { type: 'object', properties: { limit: { type: 'integer', description: 'Jumlah hasil (default 15)' }, year: { type: 'integer', description: 'Filter tahun tertentu' } }, required: [] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_tax_audits',
                description: 'Ambil data pemeriksaan/audit pajak termasuk judul, status, auditor, tanggal, dan surat.',
                parameters: { type: 'object', properties: { limit: { type: 'integer' } }, required: [] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_approvals',
                description: 'Ambil daftar pengajuan persetujuan (approvals) terbaru.',
                parameters: { type: 'object', properties: { limit: { type: 'integer' } }, required: [] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_users',
                description: 'Ambil daftar pengguna sistem (id, nama, role, departemen).',
                parameters: { type: 'object', properties: {}, required: [] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_document_detail',
                description: 'Ambil detail dokumen berdasarkan id, termasuk cuplikan OCR.',
                parameters: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_invoice_detail',
                description: 'Ambil detail invoice berdasarkan id.',
                parameters: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] }
            }
        },
        // ── NEW: Aggregated report tools ──
        {
            type: 'function',
            function: {
                name: 'get_tax_summary_aggregate',
                description: 'Ambil total PPN masukan, PPN keluaran, PPh, dan selisih PPN untuk laporan ringkas. Lebih efisien dari get_tax_summaries untuk data ringkas.',
                parameters: { type: 'object', properties: { year: { type: 'integer', description: 'Filter tahun (default: tahun ini)' } }, required: [] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_document_stats',
                description: 'Ambil statistik dokumen: total, per tipe, per bulan. Untuk laporan ringkas.',
                parameters: { type: 'object', properties: {}, required: [] }
            }
        },
        // ── NEW: Extended database coverage ──
        {
            type: 'function',
            function: {
                name: 'search_comments',
                description: 'Cari komentar pada dokumen berdasarkan isi teks atau nama user.',
                parameters: { type: 'object', properties: { query: { type: 'string', description: 'Kata kunci komentar' }, limit: { type: 'integer' } }, required: ['query'] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'search_boxes',
                description: 'Cari box arsip fisik berdasarkan box_id atau inventory_id.',
                parameters: { type: 'object', properties: { query: { type: 'string', description: 'Kata kunci pencarian' }, limit: { type: 'integer' } }, required: ['query'] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'search_approvals',
                description: 'Cari data persetujuan/approval berdasarkan judul, nama pemohon, atau status.',
                parameters: { type: 'object', properties: { query: { type: 'string', description: 'Kata kunci pencarian' }, limit: { type: 'integer' } }, required: ['query'] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'list_departments',
                description: 'Tampilkan daftar semua departemen.',
                parameters: { type: 'object', properties: {}, required: [] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'search_inventory_items',
                description: 'Cari item inventory individual berdasarkan box_id, vendor, nomor invoice, atau isi OCR.',
                parameters: { type: 'object', properties: { query: { type: 'string', description: 'Kata kunci pencarian' }, limit: { type: 'integer' } }, required: ['query'] }
            }
        },
        // ── COA (Chart of Accounts) tools ──
        {
            type: 'function',
            function: {
                name: 'search_coa_accounts',
                description: 'Cari akun COA (Chart of Accounts) berdasarkan kode atau nama akun. Mengembalikan hierarki akun dengan sub-akun dan departemen.',
                parameters: { type: 'object', properties: { query: { type: 'string', description: 'Kode atau nama akun' }, limit: { type: 'integer', description: 'Jumlah hasil (default 15)' } }, required: ['query'] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'list_coa_accounts',
                description: 'Tampilkan semua akun COA beserta sub-akun dan departemennya.',
                parameters: { type: 'object', properties: { limit: { type: 'integer', description: 'Jumlah akun (default 15)' } }, required: [] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_coa_hierarchy',
                description: 'Ambil struktur hierarki COA lengkap: Akun Induk → Sub COA → Departemen. Cocok untuk melihat bagian struktur akun.',
                parameters: { type: 'object', properties: { query: { type: 'string', description: 'Kata kunci untuk filter hierarki (opsional)' }, limit: { type: 'integer' } }, required: [] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_coa_stats',
                description: 'Ambil statistik COA: jumlah akun induk, sub-akun, dan departemen.',
                parameters: { type: 'object', properties: {}, required: [] }
            }
        },
        // ── Training Documents tools ──
        {
            type: 'function',
            function: {
                name: 'search_training_docs',
                description: 'PRIORITAS UTAMA - Cari dokumen training (peraturan pajak, standar akuntansi, prosedur, panduan). WAJIB dipanggil PERTAMA untuk setiap pertanyaan pengetahuan, definisi, atau regulasi.',
                parameters: { type: 'object', properties: { query: { type: 'string', description: 'Kata kunci pencarian' }, category: { type: 'string', description: 'Filter kategori: tax_regulation, accounting_standard, procedure, guide, general' } }, required: ['query'] }
            }
        },
    ];
}

// ── Compact result formatting ──
function formatRowCompact(row) {
    const entries = Object.entries(row);
    return entries.map(([k, v]) => {
        if (v === null || v === undefined) return `${k}: -`;
        if (typeof v === 'number') return `${k}: ${v}`;
        const s = String(v);
        return `${k}: ${s.length > 60 ? s.slice(0, 57) + '...' : s}`;
    }).join(' | ');
}

function formatRowsCompact(rows, maxRows = TOOL_RESULT_ROWS) {
    if (!rows || !rows.length) return '(kosong)';
    const shown = rows.slice(0, maxRows);
    const lines = shown.map((row, i) => `${i + 1}. ${formatRowCompact(row)}`);
    if (rows.length > maxRows) lines.push(`... +${rows.length - maxRows} lainnya`);
    return lines.join('\n');
}

// ── Module-level reference to the embedding function (set per runAgent call) ──
let embedFnRef = null;

// ── Tool execution ──
function resolveLimit(args, defaultVal = TOOL_RESULT_ROWS) {
    const n = parseInt(args.limit, 10);
    return Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : defaultVal;
}

async function executeTool(name, args = {}) {
    const q = String(args.query || '').trim().slice(0, 120);
    try {
        switch (name) {
            case 'search_documents': {
                const limit = resolveLimit(args, TOOL_RESULT_ROWS);
                const rows = await knex('documents')
                    .select('id', 'title', 'type', 'uploadDate', 'size', 'folderId')
                    .where('title', 'ilike', `%${q}%`)
                    .orWhere('ocrContent', 'ilike', `%${q}%`)
                    .orderBy('uploadDate', 'desc')
                    .limit(limit);
                return { count: rows.length, total: rows.length, rows: formatRowsCompact(rows, limit) };
            }
            case 'list_documents': {
                const limit = resolveLimit(args, TOOL_RESULT_ROWS_LIST);
                const rows = await knex('documents')
                    .select('id', 'title', 'type', 'uploadDate', 'size', 'folderId')
                    .orderBy('uploadDate', 'desc')
                    .limit(limit);
                return { count: rows.length, total: rows.length, rows: formatRowsCompact(rows, limit) };
            }
            case 'search_invoices': {
                const limit = resolveLimit(args, TOOL_RESULT_ROWS);
                const rows = await knex('invoices')
                    .select('id', 'vendor', 'invoice_no', 'tax_invoice_no', 'payment_date')
                    .where('vendor', 'ilike', `%${q}%`)
                    .orWhere('invoice_no', 'ilike', `%${q}%`)
                    .orWhere('tax_invoice_no', 'ilike', `%${q}%`)
                    .orderBy('id', 'desc')
                    .limit(limit);
                return { count: rows.length, total: rows.length, rows: formatRowsCompact(rows, limit) };
            }
            case 'list_invoices': {
                const limit = resolveLimit(args, TOOL_RESULT_ROWS_LIST);
                const rows = await knex('invoices')
                    .select('id', 'vendor', 'invoice_no', 'tax_invoice_no', 'payment_date')
                    .orderBy('id', 'desc')
                    .limit(limit);
                return { count: rows.length, total: rows.length, rows: formatRowsCompact(rows, limit) };
            }
            case 'search_tax_wp': {
                const limit = resolveLimit(args, TOOL_RESULT_ROWS);
                const rows = await knex('tax_wp')
                    .select('id', 'name', 'id_type', 'identity_number', 'tax_type', 'tax_object_code', 'tax_object_name', 'dpp', 'pph', 'ppn', 'total_payable')
                    .where('name', 'ilike', `%${q}%`)
                    .orWhere('identity_number', 'ilike', `%${q}%`)
                    .orWhere('tax_object_name', 'ilike', `%${q}%`)
                    .orderBy('id', 'desc')
                    .limit(limit);
                return { count: rows.length, total: rows.length, rows: formatRowsCompact(rows, limit) };
            }
            case 'list_tax_wp': {
                const limit = resolveLimit(args, TOOL_RESULT_ROWS_LIST);
                const rows = await knex('tax_wp')
                    .select('id', 'name', 'id_type', 'identity_number', 'tax_type', 'tax_object_code', 'tax_object_name', 'dpp', 'pph', 'ppn', 'total_payable')
                    .orderBy('id', 'desc')
                    .limit(limit);
                return { count: rows.length, total: rows.length, rows: formatRowsCompact(rows, limit) };
            }
            case 'search_tax_objects': {
                const limit = resolveLimit(args, TOOL_RESULT_ROWS);
                const rows = await knex('master_tax_objects')
                    .select('id', 'tax_type', 'code', 'name', 'rate', 'note')
                    .where('name', 'ilike', `%${q}%`)
                    .orWhere('code', 'ilike', `%${q}%`)
                    .limit(limit);
                return { count: rows.length, total: rows.length, rows: formatRowsCompact(rows, limit) };
            }
            case 'search_external_items': {
                const limit = resolveLimit(args, TOOL_RESULT_ROWS);
                const rows = await knex('external_items')
                    .select('id', 'boxId', 'destination', 'sentDate', 'sender')
                    .where('boxId', 'ilike', `%${q}%`)
                    .orWhere('destination', 'ilike', `%${q}%`)
                    .orWhere('sender', 'ilike', `%${q}%`)
                    .orderBy('id', 'desc')
                    .limit(limit);
                return { count: rows.length, total: rows.length, rows: formatRowsCompact(rows, limit) };
            }
            case 'search_inventory': {
                const limit = resolveLimit(args, TOOL_RESULT_ROWS);
                const rows = await knex('inventory')
                    .select('id', 'box_id', 'status', 'rack', 'shelf', 'position', 'box_data')
                    .where('box_id', 'ilike', `%${q}%`)
                    .orWhere('box_data', 'ilike', `%${q}%`)
                    .orWhere('rack', 'ilike', `%${q}%`)
                    .orWhere('status', 'ilike', `%${q}%`)
                    .orderBy('id', 'desc')
                    .limit(limit);
                return { count: rows.length, total: rows.length, rows: formatRowsCompact(rows, limit) };
            }
            case 'get_tax_summaries': {
                const limit = resolveLimit(args, TOOL_RESULT_ROWS_LIST);
                let query = knex('tax_summaries')
                    .select('id', 'type', 'month', 'year', 'data', 'pph23', 'pph42')
                    .orderBy('id', 'desc');
                if (args.year) query = query.where('year', args.year);
                const rows = await query.limit(limit);
                // Compact tax data
                const compact = rows.map(r => ({
                    id: r.id, type: r.type, period: `${r.month}/${r.year}`,
                    pph23: r.pph23, pph42: r.pph42,
                    data_summary: typeof r.data === 'object' ? JSON.stringify(r.data).slice(0, 200) : String(r.data || '').slice(0, 200)
                }));
                return { count: compact.length, total: compact.length, rows: formatRowsCompact(compact, limit) };
            }
            case 'get_tax_audits': {
                const limit = resolveLimit(args, TOOL_RESULT_ROWS_LIST);
                const rows = await knex('tax_audits')
                    .select('id', 'title', 'status', 'auditor', 'letterNumber', 'startDate')
                    .orderBy('id', 'desc')
                    .limit(limit);
                return { count: rows.length, total: rows.length, rows: formatRowsCompact(rows, limit) };
            }
            case 'get_approvals': {
                const limit = resolveLimit(args, TOOL_RESULT_ROWS_LIST);
                const rows = await knex('document_approvals')
                    .select('id', 'title', 'status', 'current_step_index')
                    .orderBy('id', 'desc')
                    .limit(limit);
                return { count: rows.length, total: rows.length, rows: formatRowsCompact(rows, limit) };
            }
            case 'get_users': {
                const rows = await knex('users')
                    .select('id', 'name', 'username', 'role', 'department');
                return { count: rows.length, rows: formatRowsCompact(rows, rows.length) };
            }
            case 'get_document_detail': {
                const id = Number(args.id);
                if (!id) return { error: 'id wajib diisi' };
                const row = await knex('documents').where('id', id).first();
                if (!row) return { error: 'dokumen tidak ditemukan' };
                return {
                    id: row.id, title: row.title, type: row.type,
                    uploadDate: row.uploadDate, size: row.size,
                    folderId: row.folderId, ocrContent: (row.ocrContent || '').slice(0, OCR_SNIPPET)
                };
            }
            case 'get_invoice_detail': {
                const id = Number(args.id);
                if (!id) return { error: 'id wajib diisi' };
                const row = await knex('invoices').where('id', id).first();
                if (!row) return { error: 'invoice tidak ditemukan' };
                return {
                    id: row.id, vendor: row.vendor, invoice_no: row.invoice_no,
                    tax_invoice_no: row.tax_invoice_no, payment_date: row.payment_date,
                    special_note: row.special_note, ocr_content: (row.ocr_content || '').slice(0, OCR_SNIPPET)
                };
            }
            // ── NEW: Aggregate tools ──
            case 'get_tax_summary_aggregate': {
                const year = args.year || new Date().getFullYear();
                const rows = await knex('tax_summaries')
                    .select('type')
                    .sum('pph23 as totalPph23')
                    .sum('pph42 as totalPph42')
                    .where('year', year)
                    .groupBy('type');
                // Also get tax_wp aggregates
                const wpAgg = await knex('tax_wp')
                    .select('tax_type')
                    .sum('dpp as totalDpp')
                    .sum('pph as totalPph')
                    .sum('ppn as totalPpn')
                    .sum('total_payable as totalPayable')
                    .groupBy('tax_type');
                return {
                    year,
                    summaries: formatRowsCompact(rows.map(r => ({ period: `${year} | ${r.type}`, pph23: r.totalPph23 || 0, pph42: r.totalPph42 || 0 })), 10),
                    wp_by_type: formatRowsCompact(wpAgg.map(r => ({ type: r.tax_type, dpp: r.totalDpp || 0, pph: r.totalPph || 0, ppn: r.totalPpn || 0, payable: r.totalPayable || 0 })), 10)
                };
            }
            case 'get_document_stats': {
                const total = await knex('documents').count('id as count').first();
                const byType = await knex('documents')
                    .select('type')
                    .count('id as count')
                    .groupBy('type')
                    .orderBy('count', 'desc');
                const recent = await knex('documents')
                    .select('uploadDate')
                    .orderBy('uploadDate', 'desc')
                    .limit(1);
                return {
                    total: total?.count || 0,
                    by_type: formatRowsCompact(byType.map(r => ({ type: r.type, count: r.count })), 10),
                    latest_upload: recent[0]?.uploadDate || '-'
                };
            }
            // ── Extended database coverage ──
            case 'search_comments': {
                const limit = resolveLimit(args, TOOL_RESULT_ROWS);
                const rows = await knex('comments')
                    .select('id', 'documentId', 'user', 'text', 'timestamp')
                    .where('text', 'ilike', `%${q}%`)
                    .orWhere('user', 'ilike', `%${q}%`)
                    .orderBy('timestamp', 'desc')
                    .limit(limit);
                return { count: rows.length, total: rows.length, rows: formatRowsCompact(rows, limit) };
            }
            case 'search_boxes': {
                const limit = resolveLimit(args, TOOL_RESULT_ROWS);
                const rows = await knex('boxes')
                    .select('id', 'inventory_id', 'box_id', 'created_at')
                    .where('box_id', 'ilike', `%${q}%`)
                    .orderBy('id', 'desc')
                    .limit(limit);
                return { count: rows.length, total: rows.length, rows: formatRowsCompact(rows, limit) };
            }
            case 'search_approvals': {
                const limit = resolveLimit(args, TOOL_RESULT_ROWS);
                const rows = await knex('approvals')
                    .select('id', 'title', 'requester_name', 'status', 'division', 'created_at')
                    .where('title', 'ilike', `%${q}%`)
                    .orWhere('requester_name', 'ilike', `%${q}%`)
                    .orWhere('status', 'ilike', `%${q}%`)
                    .orderBy('id', 'desc')
                    .limit(limit);
                return { count: rows.length, total: rows.length, rows: formatRowsCompact(rows, limit) };
            }
            case 'list_departments': {
                const rows = await knex('departments').select('id', 'name').orderBy('name');
                return { count: rows.length, rows: formatRowsCompact(rows, rows.length) };
            }
            case 'search_inventory_items': {
                const limit = resolveLimit(args, TOOL_RESULT_ROWS);
                const rows = await knex('inventory_items')
                    .select('id', 'box_id', 'ordner_id', 'invoice_no', 'vendor', 'date', 'amount', 'ocr_content')
                    .where('box_id', 'ilike', `%${q}%`)
                    .orWhere('vendor', 'ilike', `%${q}%`)
                    .orWhere('invoice_no', 'ilike', `%${q}%`)
                    .orWhere('ocr_content', 'ilike', `%${q}%`)
                    .orderBy('id', 'desc')
                    .limit(limit);
                const compact = rows.map(r => ({
                    id: r.id, box_id: r.box_id, invoice_no: r.invoice_no,
                    vendor: r.vendor, date: r.date, amount: r.amount,
                    ocr: (r.ocr_content || '').slice(0, 150)
                }));
                return { count: compact.length, total: compact.length, rows: formatRowsCompact(compact, limit) };
            }
            // ── COA tools ──
            case 'search_coa_accounts': {
                const limit = resolveLimit(args, TOOL_RESULT_ROWS);
                const terms = q.split(/\s+/).filter(Boolean);
                const termMatch = (builder, term) => {
                    const pattern = `%${term}%`;
                    builder.where(function () {
                        this.where('code', 'ilike', pattern).orWhere('name', 'ilike', pattern).orWhere('description', 'ilike', pattern);
                    });
                };
                // Search across all COA levels with OR logic
                const accts = await knex('coa_accounts').where(function () {
                    terms.forEach((t, i) => { if (i === 0) termMatch(this, t); else this.orWhere(function () { termMatch(this, t); }); });
                }).orderBy('code').limit(limit);
                const subRows = await knex('coa_sub_accounts').where(function () {
                    terms.forEach((t, i) => { if (i === 0) termMatch(this, t); else this.orWhere(function () { termMatch(this, t); }); });
                }).orderBy('code').limit(limit);
                const depRows = await knex('coa_departments').where(function () {
                    terms.forEach((t, i) => { if (i === 0) termMatch(this, t); else this.orWhere(function () { termMatch(this, t); }); });
                }).orderBy('code').limit(limit);

                // Build parent relationships
                const subMap = new Map(subRows.map(s => [s.id, { ...s, departments: [] }]));
                depRows.forEach(d => { const sub = subMap.get(d.sub_account_id); if (sub) sub.departments.push(d); });
                const tree = accts.map(a => ({ ...a, sub_accounts: [...subMap.values()].filter(s => s.account_id === a.id) }));

                // If few accounts found, also show accounts that own the matched subs/deps
                const matchedAcctIds = new Set(subRows.map(s => s.account_id));
                depRows.forEach(d => { const sub = subRows.find(s => s.id === d.sub_account_id); if (sub) matchedAcctIds.add(sub.account_id); });
                const missingAcctIds = [...matchedAcctIds].filter(id => !accts.find(a => a.id === id));
                if (missingAcctIds.length > 0) {
                    const missingAccts = await knex('coa_accounts').whereIn('id', missingAcctIds).orderBy('code');
                    for (const ma of missingAccts) {
                        if (!tree.find(a => a.id === ma.id)) {
                            const maSubs = subRows.filter(s => s.account_id === ma.id);
                            tree.push({ ...ma, sub_accounts: maSubs.map(s => ({ ...s, departments: depRows.filter(d => d.sub_account_id === s.id) })) });
                        }
                    }
                }

                return {
                    accounts: tree.length,
                    matched_subs: subRows.length,
                    matched_deps: depRows.length,
                    rows: formatRowsCompact(tree.map(a => ({
                        code: a.code, name: a.name, status: a.is_active ? 'Aktif' : 'Nonaktif',
                        sub_accounts: (a.sub_accounts || []).map(s => `${s.code} - ${s.name}`).join('; ') || '-'
                    })), limit)
                };
            }
            case 'list_coa_accounts': {
                const limit = resolveLimit(args, TOOL_RESULT_ROWS_LIST);
                const accts = await knex('coa_accounts').orderBy('code').limit(limit);
                const allSubs = await knex('coa_sub_accounts').orderBy('code');
                const allDeps = await knex('coa_departments').orderBy('code');
                const subMap = new Map(allSubs.map(s => [s.id, { ...s, departments: [] }]));
                allDeps.forEach(d => { const sub = subMap.get(d.sub_account_id); if (sub) sub.departments.push(d); });
                const tree = accts.map(a => ({
                    code: a.code, name: a.name, status: a.is_active ? 'Aktif' : 'Nonaktif',
                    sub_count: allSubs.filter(s => s.account_id === a.id).length,
                    sub_accounts: allSubs.filter(s => s.account_id === a.id).map(s => `${s.code} - ${s.name} (${(subMap.get(s.id)?.departments || []).length} dep)`).join('; ') || '-'
                }));
                return { count: tree.length, total: tree.length, rows: formatRowsCompact(tree, limit) };
            }
            case 'get_coa_hierarchy': {
                const limit = resolveLimit(args, 50);
                let acctsQuery = knex('coa_accounts').orderBy('code');
                let subsQuery = knex('coa_sub_accounts').orderBy('code');
                let depsQuery = knex('coa_departments').orderBy('code');
                if (q) {
                    const terms = q.split(/\s+/).filter(Boolean);
                    const termMatch = (builder, term) => {
                        const pattern = `%${term}%`;
                        builder.where(function () {
                            this.where('code', 'ilike', pattern).orWhere('name', 'ilike', pattern).orWhere('description', 'ilike', pattern);
                        });
                    };
                    acctsQuery = acctsQuery.where(function () { terms.forEach((t, i) => { if (i === 0) termMatch(this, t); else this.orWhere(function () { termMatch(this, t); }); }); });
                    subsQuery = subsQuery.where(function () { terms.forEach((t, i) => { if (i === 0) termMatch(this, t); else this.orWhere(function () { termMatch(this, t); }); }); });
                    depsQuery = depsQuery.where(function () { terms.forEach((t, i) => { if (i === 0) termMatch(this, t); else this.orWhere(function () { termMatch(this, t); }); }); });
                }
                const accts = await acctsQuery.limit(limit);
                const subs = await subsQuery.limit(limit * 3);
                const deps = await depsQuery.limit(limit * 5);
                // Build full hierarchy
                const subMap = new Map(subs.map(s => [s.id, { ...s, departments: [] }]));
                deps.forEach(d => { const sub = subMap.get(d.sub_account_id); if (sub) sub.departments.push(d); });
                // Also fetch missing parents for subs/deps
                const matchedAcctIds = new Set(subs.map(s => s.account_id));
                const missingAcctIds = [...matchedAcctIds].filter(id => !accts.find(a => a.id === id));
                if (missingAcctIds.length > 0) {
                    const extra = await knex('coa_accounts').whereIn('id', missingAcctIds).orderBy('code');
                    accts.push(...extra);
                }
                const tree = accts.map(a => ({
                    account: `${a.code} - ${a.name}`,
                    sub_accounts: [...subMap.values()].filter(s => s.account_id === a.id).map(s => ({
                        code: s.code, name: s.name,
                        departments: (s.departments || []).map(d => `${d.code} - ${d.name}`)
                    }))
                }));
                return { total_accounts: tree.length, total_subs: subs.length, total_deps: deps.length, tree };
            }
            case 'get_coa_stats': {
                const accts = await knex('coa_accounts').count('id as count').first();
                const subs = await knex('coa_sub_accounts').count('id as count').first();
                const deps = await knex('coa_departments').count('id as count').first();
                return {
                    accounts: Number(accts?.count || 0),
                    sub_accounts: Number(subs?.count || 0),
                    departments: Number(deps?.count || 0),
                    total: Number(accts?.count || 0) + Number(subs?.count || 0) + Number(deps?.count || 0)
                };
            }
            // ── Training Documents ──
            case 'search_training_docs': {
                const { searchTrainingDocs } = await import('./trainingDocs.js');
                const results = await searchTrainingDocs(q, embedFnRef, { limit: 5, category: args.category || null });
                return {
                    count: results.length,
                    docs: results.map(r => ({
                        title: r.title,
                        category: r.category,
                        similarity: r.similarity,
                        chunk: r.chunkIndex,
                        content: r.content
                    }))
                };
            }
            default:
                return { error: `Tool tidak dikenal: ${name}` };
        }
    } catch (e) {
        return { error: e.message };
    }
}

// ── Compressed system prompt (~200 tokens vs ~400 before) ──
const SYSTEM_PROMPT = `Agent AI Pustaka — arsip, pajak & akuntansi.

⚠️ ATURAN PALING PENTING:
SEBELUM menggunakan tool apapun, Anda WAJIB memanggil \`search_training_docs\` dengan query pertanyaan pengguna untuk mencari pengetahuan dari dokumen training. Jika hasil ditemukan, gunakan sebagai dasar utama jawaban. Ini adalah sumber pengetahuan utama.

Database:
- documents (id, title, type, uploadDate, size, folderId, ocrContent)
- invoices (id, vendor, invoice_no, tax_invoice_no, payment_date, ocr_content)
- inventory (id, box_id, status, rack, shelf, position, box_data), inventory_items (id, box_id, invoice_no, vendor, date, amount, ocr_content)
- external_items (id, boxId, destination, sentDate, sender)
- boxes (id, inventory_id, box_id)
- tax_summaries (id, type: PPN/PPH, month, year, data: JSON ppnIn/ppnOut/pph, pph23, pph42)
- tax_wp (id, name, identity_number, tax_type, tax_object_code/name, dpp, pph, ppn, total_payable)
- master_tax_objects (id, tax_type, code, name, rate, note)
- tax_audits (id, title, status, auditor, letterNumber, startDate)
- document_approvals (id, title, status, current_step_index)
- approvals (id, title, requester_name, status, division, steps: JSON, created_at)
- comments (id, documentId, user, text, timestamp)
- users (id, name, username, role, department), departments (id, name)
- coa_accounts (id, code, name, description, is_active) — Akun Induk COA
- coa_sub_accounts (id, account_id FK→coa_accounts, code, name, description, is_active) — Sub COA
- coa_departments (id, sub_account_id FK→coa_sub_accounts, code, name, description, is_active) — Departemen
- ai_training_documents (id, title, file_type, category, tags, content, status) — Dokumen training (peraturan, panduan, prosedur)

Hierarki COA: coa_accounts → coa_sub_accounts → coa_departments
Setiap akun induk bisa punya banyak sub-akun, setiap sub-akun bisa punya banyak departemen.

Cara kerja:
1. **PRIORITAS UTAMA**: Untuk pertanyaan pengetahuan, definisi, peraturan, prosedur, atau panduan — WAJIB gunakan \`search_training_docs\` terlebih dahulu. Tool ini mencari dokumen training yang sudah diunggah ke sistem. Jika ada hasil yang relevan, gunakan sebagai dasar jawaban.
2. Untuk data transaksi/operasional (faktur, invoice, surat, dokumen arsip): gunakan \`search_documents\`, \`search_invoices\`, dll.
3. Untuk laporan pajak: panggil \`get_tax_summaries\` untuk data angka, \`search_tax_wp\` atau \`list_tax_wp\` untuk data WP.
4. Field \`data\` pada tax_summaries berisi JSON detail angka PPN (ppnIn, ppnOut) dan PPh. Baca dan jelaskan angka-angkanya.
5. Untuk melihat semua data tanpa filter: gunakan \`list_documents\`, \`list_invoices\`, \`list_tax_wp\`.
6. Bila pengguna meminta "laporan", "ringkasan", atau "rekap" — gunakan tools list/search lalu buat tabel markdown.
7. Untuk pertanyaan COA/akuntansi: gunakan \`search_coa_accounts\` untuk cari kode/nama akun, \`get_coa_hierarchy\` untuk struktur lengkap, \`get_coa_stats\` untuk statistik.
8. Contoh pertanyaan COA: "akun 11110 itu apa?", "tampilkan sub COA untuk akun kas", "berapa jumlah akun di COA?", "cari departemen untuk akun pendapatan".

Multi-turn Tool Chaining:
9. Jika hasil pencarian mengembalikan ID, gunakan tool detail untuk mendapatkan informasi lengkap. Contoh: search_documents → get_document_detail(id).
10. Jika perlu konteks terkait, panggil beberapa tool secara berurutan. Contoh: search_invoices → get_invoice_detail → search_documents(vendor).
11. Gunakan SEMUA iterasi yang tersedia untuk mengumpulkan data lengkap sebelum memberikan jawaban akhir.
12. Jangan terburu-buru memberikan jawaban jika masih ada data yang bisa diambil.

Format laporan:
- Gunakan heading (###, ####), tabel Markdown, dan bullet points.
- Selalu cantumkan ID sumber (mis. Invoice #12, WP #5).
- Untuk data pajak, tampilkan angka dalam format Rupiah dan jelaskan status (KB/LB).
- Untuk data COA, tampilkan hierarki lengkap: Akun Induk → Sub COA → Departemen.
- Bila data kosong, sampaikan jujur dan sarankan langkah selanjutnya.`;

// ── LLM call (SSE streaming) ──
export async function callLLM(messages, tools, settings) {
    const url = (settings.base_url || '').replace(/\/+$/, '') + '/chat/completions';
    const body = {
        model: settings.model || 'gpt-3.5-turbo',
        messages,
        tools,
        temperature: 0.2,
        max_tokens: 2000,
        stream: false,
    };
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.api_key}` },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`LLM API ${res.status}: ${errText.slice(0, 200)}`);
    }
    // Handle SSE/streaming response (text/event-stream)
    const contentType = res.headers.get('content-type') || '';
    let data;
    if (contentType.includes('text/event-stream')) {
        const raw = await res.text();
        const lines = raw.split('\n');
        // Accumulate content and tool_calls from streaming deltas
        let accContent = '';
        const accToolCalls = {};  // index → { id, type, function: { name, arguments } }
        let finishReason = null;
        let model = null;
        for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                try {
                    const obj = JSON.parse(line.slice(6));
                    if (obj.model) model = obj.model;
                    const choice = obj.choices?.[0];
                    if (!choice) continue;
                    if (choice.finish_reason) finishReason = choice.finish_reason;
                    // Non-streaming: full message object
                    if (choice.message) {
                        accContent = choice.message.content || accContent;
                        if (choice.message.tool_calls) {
                            for (const tc of choice.message.tool_calls) {
                                accToolCalls[tc.index ?? 0] = tc;
                            }
                        }
                    }
                    // Streaming: delta object
                    if (choice.delta) {
                        if (choice.delta.content) accContent += choice.delta.content;
                        if (choice.delta.reasoning_content) accContent += choice.delta.reasoning_content;
                        if (choice.delta.tool_calls) {
                            for (const tc of choice.delta.tool_calls) {
                                const idx = tc.index ?? 0;
                                if (!accToolCalls[idx]) {
                                    accToolCalls[idx] = { id: tc.id, type: 'function', function: { name: '', arguments: '' } };
                                }
                                if (tc.id) accToolCalls[idx].id = tc.id;
                                if (tc.function?.name) accToolCalls[idx].function.name += tc.function.name;
                                if (tc.function?.arguments) accToolCalls[idx].function.arguments += tc.function.arguments;
                            }
                        }
                    }
                } catch {}
            }
        }
        const toolCallsArr = Object.values(accToolCalls).filter(tc => tc.function?.name);
        data = {
            choices: [{
                message: {
                    role: 'assistant',
                    content: accContent || null,
                    tool_calls: toolCallsArr.length > 0 ? toolCallsArr : undefined,
                },
                finish_reason: finishReason,
            }],
            model,
        };
    } else {
        data = await res.json();
    }

    // ── Fallback: empty content after tool calls ──
    const choice = data?.choices?.[0]?.message;
    if (choice && choice.tool_calls && choice.tool_calls.length && (!choice.content || !choice.content.trim())) {
        choice.content = ' ';
    }

    return data;
}

// ── Parallel tool execution ──
async function executeToolCalls(toolCalls, messages) {
    const promises = toolCalls.map(async (tc) => {
        let args = {};
        try { args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {}; } catch { args = {}; }
        const result = await executeTool(tc.function.name, args);
        return { id: tc.id, name: tc.function.name, args, result };
    });
    const results = await Promise.all(promises);
    for (const r of results) {
        messages.push({ role: 'tool', tool_call_id: r.id, content: JSON.stringify(r.result) });
    }
    return results;
}

// ── Proactive suggestions based on tool calls + intent ──
function generateSuggestions(toolCallsLog, intent, message) {
    const suggestions = [];
    const toolNames = toolCallsLog.map(t => t.name);
    const toolArgs = toolCallsLog.map(t => t.args);

    // Tax-related suggestions
    if (toolNames.includes('get_tax_summaries') || toolNames.includes('get_tax_summary_aggregate')) {
        suggestions.push('Bandingkan dengan tahun lalu');
        suggestions.push('Tampilkan detail PPN masukan vs keluaran');
    }
    if (toolNames.includes('search_tax_wp') || toolNames.includes('list_tax_wp')) {
        suggestions.push('Detail objek pajak untuk WP ini');
        suggestions.push('Lihat riwayat pembayaran');
    }
    if (toolNames.includes('get_tax_audits')) {
        suggestions.push('Detail pemeriksaan pajak');
        suggestions.push('Status audit terkini');
    }

    // Invoice suggestions
    if (toolNames.includes('search_invoices') || toolNames.includes('list_invoices')) {
        suggestions.push('Detail invoice ini');
        suggestions.push('Cari invoice lain dari vendor yang sama');
    }

    // Document suggestions
    if (toolNames.includes('search_documents') || toolNames.includes('list_documents')) {
        suggestions.push('Lihat detail dokumen ini');
        suggestions.push('Cari dokumen serupa');
    }
    if (toolNames.includes('get_document_detail')) {
        suggestions.push('Komentar pada dokumen ini');
        suggestions.push('Dokumen terkait lainnya');
    }

    // Inventory suggestions
    if (toolNames.includes('search_inventory') || toolNames.includes('search_inventory_items')) {
        suggestions.push('Lihat isi box ini');
        suggestions.push('Cari box di lokasi lain');
    }
    if (toolNames.includes('search_external_items') || toolNames.includes('search_boxes')) {
        suggestions.push('Detail pengiriman');
        suggestions.push('Riwayat box ini');
    }

    // Approval suggestions
    if (toolNames.includes('search_approvals') || toolNames.includes('get_approvals')) {
        suggestions.push('Detail alur persetujuan');
        suggestions.push('Approval yang masih pending');
    }

    // COA suggestions
    if (toolNames.includes('search_coa_accounts') || toolNames.includes('get_coa_hierarchy')) {
        suggestions.push('Tampilkan hierarki COA lengkap');
        suggestions.push('Cari akun lain');
        suggestions.push('Statistik jumlah akun');
    }
    if (toolNames.includes('list_coa_accounts')) {
        suggestions.push('Cari akun spesifik');
        suggestions.push('Tampilkan statistik COA');
    }
    if (toolNames.includes('get_coa_stats')) {
        suggestions.push('Tampilkan semua akun induk');
        suggestions.push('Cari sub COA');
    }

    // Generic suggestions based on intent
    if (intent === 'report' || intent === 'tax_summary') {
        suggestions.push('Ekspor laporan ini');
        suggestions.push('Buat ringkasan eksekutif');
    }
    if (intent === 'search' && suggestions.length === 0) {
        suggestions.push('Cari dengan kata kunci lain');
        suggestions.push('Tampilkan semua data');
    }

    // Fallback: intent-based suggestions when no tool-specific suggestions
    if (suggestions.length === 0) {
        const lower = (message || '').toLowerCase();
        if (/halo|hai|hi|hello|selamat/i.test(lower)) {
            suggestions.push('Tampilkan ringkasan data');
            suggestions.push('Cari dokumen terbaru');
            suggestions.push('Lihat data pajak');
        } else if (/terima kasih|thanks|makasih/i.test(lower)) {
            suggestions.push('Ada yang lain?');
        } else if (/status|kondisi|bagaimana/i.test(lower)) {
            suggestions.push('Tampilkan statistik');
            suggestions.push('Lihat data terbaru');
        } else {
            // Generic fallback for any query without tool matches
            suggestions.push('Tampilkan ringkasan data');
            suggestions.push('Cari dokumen terkait');
        }
    }

    // Deduplicate and limit
    const unique = [...new Set(suggestions)].slice(0, 3);
    return unique;
}

// ── Main agent loop ──
export async function runAgent(message, history = [], embedFn = null, sessionId = null) {
    embedFnRef = embedFn;
    const settings = await getAiSettings();
    if (!settings.enabled || !settings.api_key || !settings.base_url) {
        throw new Error('AI Agent belum dikonfigurasi. Atur Base URL & API Key di Master Data (Admin).');
    }

    // ── Check cache ──
    try {
        const cached = await findCachedReply(message, embedFn);
        if (cached) {
            console.log(`[AI Agent] Cache hit — returning cached reply (age: ${cached.cacheAge})`);
            const suggestions = generateSuggestions(cached.toolCalls || [], intent, message);
            return { reply: cached.reply, toolCalls: cached.toolCalls, fromCache: true, cacheAge: cached.cacheAge, suggestions };
        }
    } catch (err) {
        console.warn(`[AI Agent] Cache check failed, proceeding with LLM: ${err.message}`);
    }

    // ── Intent pre-classification ──
    const intent = classifyIntent(message);
    console.log(`[AI Agent] Intent: ${intent}`);

    // ── History compression ──
    const hist = Array.isArray(history)
        ? history
            .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
            .map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : (m.text || '') }))
            .filter(m => m.content)
            .slice(-MAX_HISTORY)
        : [];

    // ── Correction detection (fire & forget) ──
    detectAndLogCorrection(sessionId, message, hist);

    // ── RAG: Retrieve relevant past conversations ──
    let ragContext = '';
    if (embedFn) {
        try {
            const { searchRelevantConversations } = await import('./conversationMemory.js');
            const relevant = await searchRelevantConversations(message, embedFn, { limit: RAG_CONTEXT_LIMIT });
            if (relevant.length > 0) {
                ragContext = '\n\nKonteks dari percakapan lama:\n' +
                    relevant.map((r, i) => `${i + 1}. [${r.keyTopics}] ${r.summary}`).join('\n');
            }
        } catch (err) {
            console.warn(`[AI Agent] RAG context retrieval failed: ${err.message}`);
        }
    }

    // ── RAG: Retrieve relevant training documents ──
    let trainingContext = '';
    console.log(`[AI Agent] embedFn type: ${typeof embedFn}`);
    if (embedFn) {
        try {
            const { searchTrainingDocs } = await import('./trainingDocs.js');
            const trainingDocs = await searchTrainingDocs(message, embedFn, { limit: 3 });
            console.log(`[AI Agent] Training docs search returned: ${trainingDocs.length} results`);
            if (trainingDocs.length > 0) {
                trainingContext = '\n\n[DOKUMEN TRAINING - Referensi]\n' +
                    trainingDocs.map((r, i) => `${i + 1}. [${r.title}] (similaritas: ${r.similarity})\n${r.contentPreview}`).join('\n\n');
                console.log(`[AI Agent] Training docs found: ${trainingDocs.length} docs injected into context`);
            } else {
                console.log('[AI Agent] No training docs found for this query');
            }
        } catch (err) {
            console.warn(`[AI Agent] Training docs retrieval failed: ${err.message}`);
        }
    } else {
        console.log('[AI Agent] embedFn not provided — training docs search skipped');
    }

    const messages = [
        { role: 'system', content: SYSTEM_PROMPT + ragContext + trainingContext },
        ...hist,
        { role: 'user', content: message }
    ];

    const tools = buildTools();
    const toolCallsLog = [];

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        const data = await callLLM(messages, tools, settings);
        const choice = data?.choices?.[0]?.message;
        const finishReason = data?.choices?.[0]?.finish_reason;
        if (!choice) throw new Error('Respons LLM kosong atau tidak valid.');

        if (choice.tool_calls && choice.tool_calls.length) {
            messages.push(choice);
            if (PARALLEL_EXECUTION && choice.tool_calls.length > 1) {
                const results = await executeToolCalls(choice.tool_calls, messages);
                toolCallsLog.push(...results.map(r => ({ name: r.name, args: r.args, result: r.result })));
                console.log(`[AI Agent] Iterasi ${i}: ${choice.tool_calls.length} tools dieksekusi paralel`);
            } else {
                for (const tc of choice.tool_calls) {
                    let args = {};
                    try { args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {}; } catch { args = {}; }
                    const result = await executeTool(tc.function.name, args);
                    toolCallsLog.push({ name: tc.function.name, args, result });
                    messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
                }
            }
        } else {
            const content = (choice.content || '').trim();
            if (content) {
                saveToCache(message, content, toolCallsLog, settings.model || 'unknown', embedFn).catch(e =>
                    console.warn(`[AI Agent] Cache save failed: ${e.message}`)
                );
                const suggestions = generateSuggestions(toolCallsLog, intent, message);
                logLearning(sessionId, message, content, toolCallsLog);
                return { reply: content, toolCalls: toolCallsLog, suggestions };
            }
            if (toolCallsLog.length > 0) {
                console.log(`[AI Agent] Iterasi ${i}: content kosong setelah ${toolCallsLog.length} tool calls, meminta rangkuman...`);
                messages.push({ role: 'assistant', content: ' ' });
                messages.push({ role: 'user', content: 'Berdasarkan data yang baru saja Anda dapatkan dari tools, buatlah rangkuman atau jawaban untuk pertanyaan pengguna. Gunakan data yang sudah ada di percakapan ini.' });
                continue;
            }
            console.log(`[AI Agent] Iterasi ${i}: content kosong tanpa tool calls. finish_reason:`, finishReason);
            const fallbackSuggestions = generateSuggestions([], intent, message);
            return { reply: 'Maaf, Agent tidak menghasilkan respons yang dapat dibaca. Silakan coba ajukan pertanyaan dengan cara yang berbeda.', toolCalls: toolCallsLog, suggestions: fallbackSuggestions };
        }
    }

    const maxIterSuggestions = generateSuggestions(toolCallsLog, intent, message);
    logLearning(sessionId, message, 'Batas iterasi tercapai', toolCallsLog);
    return { reply: 'Maaf, batas iterasi pencarian tercapai. Berikut sebagian hasil yang berhasil dikumpulkan.', toolCalls: toolCallsLog, suggestions: maxIterSuggestions };
}
