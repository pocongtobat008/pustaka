import { knex } from '../db.js';
import { findCachedReply, saveToCache } from './agentCache.js';
import brain from './brainService.js';

// ── Concurrency limiter: batasi jumlah LLM call bersamaan ──
// Agar AI request tidak menghabiskan semua koneksi DB & CPU
const MAX_CONCURRENT_LLM = 2;
let activeLLMCalls = 0;
const llmWaitQueue = [];
function acquireLLMSemaphore() {
    return new Promise((resolve) => {
        const tryAcquire = () => {
            if (activeLLMCalls < MAX_CONCURRENT_LLM) {
                activeLLMCalls++;
                resolve();
            } else {
                llmWaitQueue.push(tryAcquire);
            }
        };
        tryAcquire();
    });
}
function releaseLLMSemaphore() {
    activeLLMCalls--;
    if (llmWaitQueue.length > 0) {
        const next = llmWaitQueue.shift();
        next();
    }
}

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

export async function getAiSettings() {
    const row = await knex('ai_settings').orderBy('id', 'asc').first();
    if (!row) return { id: null, base_url: '', api_key: '', model: '', enabled: false, fallbackModels: [] };
    let meta = {};
    try { meta = row.meta ? JSON.parse(row.meta) : {}; } catch { meta = {}; }
    return {
        ...row,
        fallbackModels: Array.isArray(meta.fallback_models)
            ? meta.fallback_models.filter(m => typeof m === 'string' && m.trim())
            : [],
    };
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
        headers: { Authorization: `Bearer ${sanitizeApiKey(settings.api_key)}` }
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
function buildTools(userContext = null) {
    // Daftar tool inti yang dikirim ke semua user
    const coreTools = [
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
        // ── NEW: 1MBrain semantic memory ──
        {
            type: 'function',
            function: {
                name: 'recall_brain_memories',
                description: 'Cari memori semantik dari 1MBrain: dokumen training yang sudah disinkronkan, pengetahuan yang dipelajari dari percakapan, dan catatan internal. GUNAKAN jika pertanyaan pengetahuan/regulasi tidak terjawab dari tabel database atau untuk konteks tambahan.',
                parameters: { type: 'object', properties: { query: { type: 'string', description: 'Pertanyaan atau kata kunci' }, limit: { type: 'integer', description: 'Jumlah hasil (default 8)' } }, required: ['query'] }
            }
        },
    ];

    // Tools tambahan hanya untuk admin (tidak dikirim ke user non-admin)
    if (isAdminUser(userContext)) {
        coreTools.push(
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
                    name: 'search_audit_trail',
                    description: 'Cari jejak audit / riwayat aktivitas sistem berdasarkan aksi, user, atau detail (misal: siapa yang mengubah apa, kapan).',
                    parameters: { type: 'object', properties: { query: { type: 'string', description: 'Kata kunci (aksi/user/detail)' }, limit: { type: 'integer', description: 'Jumlah hasil (default 15)' } }, required: ['query'] }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'get_notifications',
                    description: 'Tampilkan notifikasi / pengumuman sistem terbaru.',
                    parameters: { type: 'object', properties: { limit: { type: 'integer', description: 'Jumlah hasil (default 15)' } }, required: [] }
                }
            }
        );
    }

    // Kirim hanya subset tool agar payload ringan & model lebih fokus.
    // Tool lain tetap bisa dieksekusi jika dipanggil, tapi tidak diekspos ke LLM.
    const CORE_NAMES = [
        'search_documents', 'list_documents',
        'search_invoices', 'list_invoices',
        'search_tax_wp', 'search_tax_objects', 'search_inventory_items',
        'get_tax_summary_aggregate', 'get_document_stats', 'get_tax_audits', 'get_approvals',
        'search_boxes', 'search_coa_accounts', 'get_coa_stats',
        'search_training_docs', 'recall_brain_memories',
    ];
    const ADMIN_NAMES = ['get_users', 'search_audit_trail', 'get_notifications'];
    const allowed = isAdminUser(userContext)
        ? [...CORE_NAMES, ...ADMIN_NAMES]
        : CORE_NAMES;
    return coreTools.filter(t => allowed.includes(t.function.name));
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

// ── Module-level references (set per runAgent call) ──
let embedFnRef = null;
let brainContextRef = '';
let agentUserRef = null;

// Tools yang hanya boleh diakses admin (dari chat AI Agent)
const SENSITIVE_TOOLS = ['search_audit_trail', 'get_notifications'];

function isAdminUser(userContext) {
    const role = String(userContext?.role || '').toLowerCase();
    return role === 'admin' || role === 'superadmin';
}

// ── Tool execution ──
function resolveLimit(args, defaultVal = TOOL_RESULT_ROWS) {
    const n = parseInt(args.limit, 10);
    return Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : defaultVal;
}

async function executeTool(name, args = {}, userContext = agentUserRef) {
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
            // ── NEW: 1MBrain semantic memory ──
            case 'recall_brain_memories': {
                const limit = resolveLimit(args, 8);
                const results = await brain.recall(q, { limit });
                if (!results || !results.length) return { count: 0, rows: '(tidak ada memori relevan)' };
                const rows = results.map(r => ({
                    score: Number(r.score || 0).toFixed(2),
                    type: r.memory?.type || 'semantic',
                    content: String(r.memory?.content || '').slice(0, 300)
                }));
                return { count: rows.length, rows: formatRowsCompact(rows, limit) };
            }
            // ── NEW: Audit trail & notifications ──
            case 'search_audit_trail': {
                if (!isAdminUser(userContext)) {
                    return { error: 'Akses ditolak: tool search_audit_trail hanya untuk admin.' };
                }
                const limit = resolveLimit(args, TOOL_RESULT_ROWS);
                const rows = await knex('logs')
                    .select('id', 'user', 'action', 'details', 'timestamp')
                    .where('action', 'ilike', `%${q}%`)
                    .orWhere('user', 'ilike', `%${q}%`)
                    .orWhere('details', 'ilike', `%${q}%`)
                    .orderBy('timestamp', 'desc')
                    .limit(limit);
                return { count: rows.length, rows: formatRowsCompact(rows, limit) };
            }
            case 'get_notifications': {
                if (!isAdminUser(userContext)) {
                    return { error: 'Akses ditolak: tool get_notifications hanya untuk admin.' };
                }
                const limit = resolveLimit(args, TOOL_RESULT_ROWS);
                const rows = await knex('notifications')
                    .select('id', 'title', 'message', 'type', 'created_at')
                    .orderBy('created_at', 'desc')
                    .limit(limit);
                return { count: rows.length, rows: formatRowsCompact(rows, limit) };
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
- Bila data kosong, sampaikan jujur dan sarankan langkah selanjutnya.

Tools tambahan:
- recall_brain_memories: pengetahuan internal dari 1MBrain (dokumen training tersinkron, pelajaran dari percakapan).
- search_audit_trail: riwayat aktivitas/jejak audit sistem (KHUSUS ADMIN).
- get_notifications: notifikasi/pengumuman terbaru (KHUSUS ADMIN).
- Jika pengguna bukan admin, JANGAN panggil search_audit_trail / get_notifications — jawab bahwa fitur tersebut khusus admin.`;

// ── LLM call (SSE streaming) ──
export function sanitizeApiKey(key) {
  if (!key) return key;
  // Remove non-ASCII characters (smart quotes, ellipsis, etc.) that break HTTP headers
  return key.replace(/[^\x00-\x7F]/g, '').trim();
}

const LLM_TIMEOUT_MS = 75000; // timeout agar model yang menggantung (silent drop) tidak membekukan agent
const MAX_429_RETRIES = 2; // maksimal retry saat kena rate limit (kurangi agar tidak block lama)
const BASE_429_DELAY_MS = 1500; // delay awal 1.5 detik, doubling setiap retry

// Helper: extract retry-after header atau fallback ke delayManual
function getRetryDelayMs(res, attempt) {
  const ra = res.headers?.get('retry-after');
  if (ra) {
    const n = parseInt(ra, 10);
    if (!isNaN(n) && n > 0 && n <= 60) return n * 1000;
  }
  return BASE_429_DELAY_MS * Math.pow(2, attempt); // exponential backoff
}

export async function callLLM(messages, tools, settings, opts = {}) {
  await acquireLLMSemaphore();
  const { stream = false, onToken = null, onReasoning = null, signal = null, maxTokens = null, timeoutMs = null } = opts;
  const url = (settings.base_url || '').replace(/\/+$/, '') + '/chat/completions';
  const apiKey = sanitizeApiKey(settings.api_key);
  const body = {
    model: settings.model || 'gpt-3.5-turbo',
    messages,
    tools,
    temperature: 0.2,
    max_tokens: maxTokens || 2000,
    stream,
  };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs || LLM_TIMEOUT_MS);
  const onExternalAbort = () => ac.abort();
  if (signal) {
    if (signal.aborted) ac.abort();
    else signal.addEventListener('abort', onExternalAbort, { once: true });
  }
  let res;
  let consumedErr = null; // teks error 400 yang sudah dibaca → dipakai ulang di blok error (cegah double-read)
  const doFetch = (payload) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
    signal: ac.signal,
  });
  try {
    // ── Retry loop untuk 429 rate limit ──
    for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
      res = await doFetch(body);
      // Gateway berbasis Gemini (mis. antigravity/gemini-*) menolak field 'stream' yang tidak dikenal
      // → 400 "Invalid JSON payload / Unknown name stream". Retry sekali TANPA field itu;
      // gateway ini tetap merespons via SSE (text/event-stream) sehingga streaming token tidak hilang.
      if (res.status === 400 && 'stream' in body) {
        consumedErr = await res.text().catch(() => '');
        if (/unknown name.{0,20}stream|cannot find field|invalid json payload/i.test(consumedErr)) {
          console.warn(`[AI Agent] Gateway menolak field 'stream' (${String(consumedErr).slice(0, 100)}). Retry tanpa stream...`);
          const { stream: _drop, ...bodyNoStream } = body;
          res = await doFetch(bodyNoStream);
          consumedErr = null; // body baru → biarkan blok error membaca ulang
        }
      }
      // ── 429 rate limit: backoff & retry ──
      if (res.status === 429 && attempt < MAX_429_RETRIES) {
        const delayMs = getRetryDelayMs(res, attempt);
        console.warn(`[AI Agent] 429 rate-limited (attempt ${attempt + 1}/${MAX_429_RETRIES}), retry in ${delayMs}ms...`);
        consumedErr = null;
        await new Promise(r => setTimeout(r, delayMs));
        continue; // retry
      }
      break; // success atau 429 tapi sudah max retries
    }
  } catch (e) {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onExternalAbort);
    if (e.name === 'AbortError') {
      // External abort (user menekan Stop) → jangan samarkan sebagai timeout,
      // supaya controller bisa persist pesan parsial.
      if (signal?.aborted) throw e;
      throw new Error(`LLM API timeout setelah ${Math.round((timeoutMs || LLM_TIMEOUT_MS) / 1000)}s (model tidak merespons)`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
    releaseLLMSemaphore();
  }
    if (!res.ok) {
        const errText = consumedErr !== null ? consumedErr : await res.text().catch(() => '');
        console.warn(`[AI Agent] LLM HTTP ${res.status} | model=${body.model} | tools=${Array.isArray(body.tools) ? body.tools.length : 'n/a'} | messages=${body.messages?.length || 0}`);
        throw new Error(`LLM API ${res.status}: ${errText.slice(0, 200)}`);
    }
    // Handle SSE/streaming response (text/event-stream)
    const contentType = res.headers.get('content-type') || '';
    let data;
    if (contentType.includes('text/event-stream')) {
        // Akumulator konten & tool_calls (dipisah: reasoning_content TIDAK ikut jawaban final)
        let accContent = '';
        let accReasoning = '';
        const accToolCalls = {};  // index → { id, type, function: { name, arguments } }
        let finishReason = null;
        let model = null;
        const processLine = (line) => {
            if (!line.startsWith('data: ') || line === 'data: [DONE]') return;
            try {
                const obj = JSON.parse(line.slice(6));
                if (obj.model) model = obj.model;
                const choice = obj.choices?.[0];
                if (!choice) return;
                if (choice.finish_reason) finishReason = choice.finish_reason;
                // Non-streaming: full message object
                if (choice.message) {
                    if (choice.message.content) accContent = choice.message.content;
                    if (choice.message.reasoning_content) accReasoning = choice.message.reasoning_content;
                    if (choice.message.tool_calls) {
                        for (const tc of choice.message.tool_calls) {
                            accToolCalls[tc.index ?? 0] = tc;
                        }
                    }
                }
                // Streaming: delta object
                if (choice.delta) {
                    if (choice.delta.content) {
                        accContent += choice.delta.content;
                        if (onToken) onToken(choice.delta.content);
                    }
                    if (choice.delta.reasoning_content) {
                        accReasoning += choice.delta.reasoning_content;
                        if (onReasoning) onReasoning(choice.delta.reasoning_content);
                    }
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
        };
        if (stream) {
            // Streaming incremental: baca chunk demi chunk → token real-time
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buf = '';
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                let idx;
                while ((idx = buf.indexOf('\n')) >= 0) {
                    const line = buf.slice(0, idx).replace(/\r$/, '');
                    buf = buf.slice(idx + 1);
                    processLine(line);
                }
            }
            if (buf.trim()) processLine(buf.trim());
        } else {
            // Buffered: gateway mengirim SSE walau diminta non-stream
            for (const line of (await res.text()).split('\n')) processLine(line);
        }
        const toolCallsArr = Object.values(accToolCalls).filter(tc => tc.function?.name);
        data = {
            choices: [{
                message: {
                    role: 'assistant',
                    content: accContent || accReasoning || null,
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

// ── Fall back on model-related failures & unresponsive models; NOT on transient 429/5xx ──
function isModelRelatedError(err) {
    const m = String(err?.message || '').toLowerCase();
    if (/429|rate.?limit|quota|insufficient_quota/i.test(m)) return false;
    if (/5\d\d|internal server error|bad gateway|gateway timeout|service unavailable/i.test(m)) return false;
    return /model_not_found|no active credentials|invalid.*model|model.*not found|unknown model|not exist|not allowed|respons kosong|empty response|bad request.*model|timeout|aborted|fetch failed|econnrefused|enotfound|econnreset|network/i.test(m);
}

// ── Resilient LLM call: try main model first, then fallback models ──
async function callLLMWithFallback(messages, tools, settings, opts = {}) {
    const models = [settings?.model, ...(settings?.fallbackModels || [])]
        .map(m => (typeof m === 'string' ? m.trim() : ''))
        .filter(Boolean)
        .filter((m, i, arr) => arr.indexOf(m) === i);
    if (models.length === 0) return callLLM(messages, tools, settings, opts);

    const tried = [];
    let lastErr = null;
    for (const model of models) {
        tried.push(model);
        try {
            const data = await callLLM(messages, tools, { ...settings, model }, opts);
            if (data?.choices?.length) return data;
            lastErr = new Error('Respons kosong dari model');
            console.warn(`[AI Agent] Model "${model}" balas kosong, coba model berikutnya...`);
        } catch (e) {
            // User membatalkan (Stop) → hentikan segera, jangan coba fallback model lain
            if (e.name === 'AbortError' || opts.signal?.aborted) throw e;
            if (!isModelRelatedError(e)) throw e; // transient issue → surface immediately
            lastErr = e;
            console.warn(`[AI Agent] Model "${model}" gagal (${String(e.message).slice(0, 140)}), coba model berikutnya...`);
        }
    }
    throw new Error(`Semua model gagal (${tried.join(' → ')}). Cek kredensial/channel di gateway LLM. Detail: ${String(lastErr?.message || lastErr).slice(0, 160)}`);
}

// ── Tool-enabled LLM call: model boleh memanggil tools, hasil dieksekusi, loop sampai jawaban final ──
async function callLLMWithTools(messages, settings, track = [], maxRounds = 6, userContext = null, opts = {}) {
    const { onTool, signal } = opts;
    for (let round = 0; round < maxRounds; round++) {
        let data;
        try {
            data = await callLLMWithFallback(messages, buildTools(userContext), settings, { ...opts, signal });
        } catch (e) {
            // User membatalkan (Stop) → hentikan segera, jangan retry
            if (e.name === 'AbortError' || signal?.aborted) throw e;
            // Tool call ditolak gateway (mis. model memanggil tool yang tidak tersedia utk role ini)
            // → retry sekali tanpa tools agar tidak error/gagal ke user.
            const m = String(e?.message || '');
            if (!isModelRelatedError(e) && /(11133|40000|function|tool|unknown.*name)/i.test(m)) {
                console.warn(`[AI Agent] Tool call ditolak gateway (${m.slice(0, 120)}). Retry tanpa tools...`);
                const retryMsgs = [
                    ...messages,
                    { role: 'system', content: 'CATATAN SISTEM: Beberapa tool tidak tersedia untuk sesi ini. JANGAN panggil tool apa pun; jawab berdasarkan data yang sudah ada di percakapan.' },
                ];
                const data2 = await callLLMWithFallback(retryMsgs, [], settings, { ...opts, signal });
                return (data2?.choices?.[0]?.message?.content || '').trim() || '';
            }
            throw e;
        }
        const choice = data?.choices?.[0]?.message;
        const toolCalls = choice?.tool_calls;
        if (toolCalls && toolCalls.length) {
            const results = await executeToolCalls(toolCalls, messages);
            for (const r of results) {
                track.push({ name: r.name, args: r.args });
                console.log(`[AI Agent] Tool → ${r.name}${r.result?.error ? ' (error)' : ''}`);
                if (onTool) onTool(r.name, r.args);
            }
            continue;
        }
        const reply = (choice?.content || '').trim();
        if (reply) return reply;
    }
    return '';
}

// ── Parallel tool execution ──
async function executeToolCalls(toolCalls, messages, userContext = agentUserRef) {
    const promises = toolCalls.map(async (tc) => {
        let args = {};
        try { args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {}; } catch { args = {}; }
        const result = await executeTool(tc.function.name, args, userContext);
        return { id: tc.id, name: tc.function.name, args, result };
    });
    const results = await Promise.all(promises);
    // API OpenAI-compatible WAJIB assistant message berisi tool_calls sebelum tool responses
    const assistantToolMsg = {
        role: 'assistant',
        content: null,
        tool_calls: results.map(r => ({
            id: r.id,
            type: 'function',
            function: { name: r.name, arguments: JSON.stringify(r.args || {}) },
        })),
    };
    messages.push(assistantToolMsg);
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

// ── Keyword extraction helper ──
function extractKeywords(text) {
    const stopWords = new Set([
        'cari', 'data', 'tampilkan', 'lihat', 'yang', 'dan', 'di', 'ke', 'dari',
        'saya', 'kami', 'kita', 'pada', 'untuk', 'dengan', 'tentang', 'apa',
        'tolong', 'mohon', 'bisa', 'akan', 'sudah', 'telah', 'sedang', 'ini',
        'itu', 'saja', 'juga', 'ada', 'oleh', 'atau', 'tidak', 'semua',
        'apakah', 'bagaimana', 'kenapa', 'mengapa', 'siapa', 'kapan', 'dimana',
        'per', 'dan', 'the', 'a', 'an', 'in', 'of', 'to', 'is', 'are',
        'the', 'please', 'show', 'find', 'search', 'list', 'get', 'give', 'tell',
    ]);
    const words = (text || '')
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 2 && !stopWords.has(w));
    return [...new Set(words)];
}

// ── Build OR conditions for keyword search ──
function keywordWhere(builder, column, keywords) {
    if (!keywords.length) return;
    keywords.forEach((kw, i) => {
        if (i === 0) builder.where(column, 'ilike', `%${kw}%`);
        else builder.orWhere(column, 'ilike', `%${kw}%`);
    });
}

// ── Direct Database Search (parallel, all tables, keyword-based) ──
async function searchDatabaseDirect(query) {
    const q = String(query || '').trim().slice(0, 120);
    if (!q) return {};
    const keywords = extractKeywords(q);
    if (!keywords.length) return {};

    const results = {};

    await Promise.all([
        (async () => {
            try {
                const rows = await knex('documents')
                    .select('id', 'title', 'type', 'uploadDate')
                    .where(function () { keywordWhere(this, 'title', keywords); })
                    .orWhere(function () { keywordWhere(this, 'ocrContent', keywords); })
                    .orderBy('uploadDate', 'desc')
                    .limit(5);
                if (rows.length) results.documents = rows;
            } catch (e) {}
        })(),
        (async () => {
            try {
                const rows = await knex('invoices')
                    .select('id', 'vendor', 'invoice_no', 'tax_invoice_no', 'payment_date')
                    .where(function () { keywordWhere(this, 'vendor', keywords); })
                    .orWhere(function () { keywordWhere(this, 'invoice_no', keywords); })
                    .orWhere(function () { keywordWhere(this, 'tax_invoice_no', keywords); })
                    .orderBy('id', 'desc')
                    .limit(5);
                if (rows.length) results.invoices = rows;
            } catch (e) {}
        })(),
        (async () => {
            try {
                const rows = await knex('tax_wp')
                    .select('id', 'name', 'identity_number', 'tax_type', 'tax_object_name', 'dpp', 'pph', 'ppn', 'total_payable')
                    .where(function () { keywordWhere(this, 'name', keywords); })
                    .orWhere(function () { keywordWhere(this, 'identity_number', keywords); })
                    .orWhere(function () { keywordWhere(this, 'tax_object_name', keywords); })
                    .orderBy('id', 'desc')
                    .limit(5);
                if (rows.length) results.tax_wp = rows;
            } catch (e) {}
        })(),
        (async () => {
            try {
                const rows = await knex('master_tax_objects')
                    .select('id', 'tax_type', 'code', 'name', 'rate')
                    .where(function () { keywordWhere(this, 'name', keywords); })
                    .orWhere(function () { keywordWhere(this, 'code', keywords); })
                    .limit(5);
                if (rows.length) results.tax_objects = rows;
            } catch (e) {}
        })(),
        (async () => {
            try {
                const rows = await knex('tax_summaries')
                    .select('id', 'type', 'month', 'year', 'pph23', 'pph42')
                    .where(function () { keywordWhere(this, 'type', keywords); })
                    .orWhere(function () { keywordWhere(this, 'month', keywords); })
                    .orderBy('id', 'desc')
                    .limit(5);
                if (rows.length) results.tax_summaries = rows;
            } catch (e) {}
        })(),
        (async () => {
            try {
                const rows = await knex('tax_audits')
                    .select('id', 'title', 'status', 'auditor')
                    .where(function () { keywordWhere(this, 'title', keywords); })
                    .orWhere(function () { keywordWhere(this, 'auditor', keywords); })
                    .orderBy('id', 'desc')
                    .limit(5);
                if (rows.length) results.tax_audits = rows;
            } catch (e) {}
        })(),
        (async () => {
            try {
                const rows = await knex('inventory')
                    .select('id', 'box_id', 'status', 'rack')
                    .where(function () { keywordWhere(this, 'box_id', keywords); })
                    .orWhere(function () { keywordWhere(this, 'status', keywords); })
                    .orderBy('id', 'desc')
                    .limit(5);
                if (rows.length) results.inventory = rows;
            } catch (e) {}
        })(),
        (async () => {
            try {
                const rows = await knex('inventory_items')
                    .select('id', 'box_id', 'invoice_no', 'vendor', 'date', 'amount')
                    .where(function () { keywordWhere(this, 'box_id', keywords); })
                    .orWhere(function () { keywordWhere(this, 'vendor', keywords); })
                    .orWhere(function () { keywordWhere(this, 'invoice_no', keywords); })
                    .orderBy('id', 'desc')
                    .limit(5);
                if (rows.length) results.inventory_items = rows;
            } catch (e) {}
        })(),
        (async () => {
            try {
                const rows = await knex('coa_accounts')
                    .select('id', 'code', 'name', 'is_active')
                    .where(function () { keywordWhere(this, 'name', keywords); })
                    .orWhere(function () { keywordWhere(this, 'code', keywords); })
                    .orderBy('code')
                    .limit(5);
                if (rows.length) results.coa_accounts = rows;
            } catch (e) {}
        })(),
        (async () => {
            try {
                const rows = await knex('coa_sub_accounts')
                    .select('id', 'code', 'name', 'is_active')
                    .where(function () { keywordWhere(this, 'name', keywords); })
                    .orWhere(function () { keywordWhere(this, 'code', keywords); })
                    .orderBy('code')
                    .limit(5);
                if (rows.length) results.coa_sub_accounts = rows;
            } catch (e) {}
        })(),
        (async () => {
            try {
                const rows = await knex('approvals')
                    .select('id', 'title', 'requester_name', 'status')
                    .where(function () { keywordWhere(this, 'title', keywords); })
                    .orWhere(function () { keywordWhere(this, 'requester_name', keywords); })
                    .orderBy('id', 'desc')
                    .limit(5);
                if (rows.length) results.approvals = rows;
            } catch (e) {}
        })(),
        (async () => {
            try {
                const rows = await knex('external_items')
                    .select('id', 'boxId', 'destination', 'sender')
                    .where(function () { keywordWhere(this, 'boxId', keywords); })
                    .orWhere(function () { keywordWhere(this, 'destination', keywords); })
                    .orderBy('id', 'desc')
                    .limit(5);
                if (rows.length) results.external_items = rows;
            } catch (e) {}
        })(),
        (async () => {
            try {
                const rows = await knex('users')
                    .select('id', 'name', 'username', 'role', 'department')
                    .where(function () { keywordWhere(this, 'name', keywords); })
                    .orWhere(function () { keywordWhere(this, 'username', keywords); })
                    .limit(5);
                if (rows.length) results.users = rows;
            } catch (e) {}
        })(),
        (async () => {
            try {
                const rows = await knex('ai_training_documents')
                    .select('id', 'title', 'category', 'status')
                    .where('status', 'active')
                    .where(function () { keywordWhere(this, 'title', keywords); })
                    .orWhere(function () { keywordWhere(this, 'content', keywords); })
                    .limit(5);
                if (rows.length) results.training_docs = rows;
            } catch (e) {}
        })(),
        (async () => {
            try {
                const rows = await knex('ai_training_chunks')
                    .select('id', 'document_id', 'chunk_index', 'content')
                    .where(function () { keywordWhere(this, 'content', keywords); })
                    .limit(5);
                if (rows.length) results.training_chunks = rows;
            } catch (e) {}
        })(),
    ]);

    return results;
}

// ── Format DB results for LLM context ──
function formatDbResultsForLLM(results) {
    const parts = [];
    for (const [table, rows] of Object.entries(results)) {
        if (!rows || rows.length === 0) continue;
        const label = {
            documents: 'Dokumen',
            invoices: 'Invoice/Faktur',
            tax_wp: 'Wajib Pajak',
            tax_objects: 'Objek Pajak',
            tax_summaries: 'Ringkasan Pajak',
            tax_audits: 'Pemeriksaan Pajak',
            inventory: 'Inventory/Box',
            inventory_items: 'Item Inventory',
            coa_accounts: 'Akun COA',
            coa_sub_accounts: 'Sub Akun COA',
            approvals: 'Approval/Persetujuan',
            external_items: 'Item Eksternal',
            users: 'Pengguna',
            training_docs: 'Dokumen Training',
            training_chunks: 'Potongan Dokumen Training',
        }[table] || table;
        parts.push(`=== ${label} ===`);
        rows.forEach((r, i) => {
            const fields = Object.entries(r)
                .filter(([k]) => k !== 'id')
                .map(([k, v]) => {
                    if (v === null || v === undefined) return `${k}: -`;
                    if (typeof v === 'number') return `${k}: ${v}`;
                    const s = String(v);
                    return `${k}: ${s.length > 100 ? s.slice(0, 97) + '...' : s}`;
                })
                .join(' | ');
            parts.push(`  ${i + 1}. ${fields}`);
        });
    }
    return parts.join('\n');
}

// ── Generate AI report from database data ──
async function generateReportFromData(message, dbResults, settings, lastTurns = [], track = [], userContext = null, opts = {}) {
    const dataStr = formatDbResultsForLLM(dbResults);
    const messages = [
        {
            role: 'system',
            content: `Anda adalah asisten AI Pustaka Sistem untuk laporan pajak, arsip & akuntansi.

Buat laporan yang rapi dan informatif berdasarkan DATA dari database berikut.

ATURAN:
- Gunakan format Markdown: heading ###, tabel, bullet points
- Tampilkan nominal uang dalam format Rupiah (Rp)
- Cantumkan ID sumber data (mis. Dokumen #5, Invoice #12)
- Jika data menyebutkan status, jelaskan artinya
- Jawab dalam Bahasa Indonesia yang baik
- Jangan mengarang informasi yang tidak ada dalam data
- Jika pengguna meminta data yang TIDAK ada dalam DATA di atas (mis. notifikasi, audit trail, pengguna, detail tertentu), WAJIB panggil tool yang tersedia untuk mengambilnya sebelum menjawab
- JANGAN PERNAH menulis kalimat seperti "Saya akan memanggil tool..." sebagai jawaban — langsung panggil tool-nya sekarang`
        },
        ...(lastTurns || []),
        {
            role: 'user',
            content: `Pertanyaan: ${message}\n\n${brainContextRef ? `MEMORI TERKAIT:\n${brainContextRef}\n\n` : ''}DATA DARI DATABASE:\n${dataStr}\n\nBuat laporan berdasarkan data di atas.\n\nPENTING: Jika pengguna meminta data yang TIDAK tersedia dalam DATA di atas (mis. notifikasi, audit trail, detail pengguna, dsb), gunakan tools yang tersedia untuk mengambilnya sebelum menjawab.`
        }
    ];
    const reply = await callLLMWithTools(messages, settings, track, 6, userContext, opts);
    return reply || 'Tidak dapat menghasilkan laporan dari data yang ditemukan.';
}

// ── Generate AI response from knowledge (training docs) ──
async function generateReportWithKnowledge(message, knowledgeContext, settings, lastTurns = [], track = [], userContext = null, opts = {}) {
    const messages = [
        {
            role: 'system',
            content: `Anda adalah asisten AI Pustaka Sistem.

Gunakan PENGETAHUAN dari dokumen training berikut untuk menjawab pertanyaan pengguna.
Jika pengetahuan tidak cukup untuk menjawab, akui saja dengan jujur.

ATURAN:
- Gunakan format Markdown
- Jawab dalam Bahasa Indonesia
- Sebutkan sumber pengetahuan jika relevan`
        },
        ...(lastTurns || []),
        {
            role: 'user',
            content: `Pertanyaan: ${message}\n\n${brainContextRef ? `MEMORI TERKAIT:\n${brainContextRef}\n\n` : ''}PENGETAHUAN:\n${knowledgeContext}\n\nJawab pertanyaan berdasarkan pengetahuan di atas.\n\nPENTING: Jika pengguna meminta data yang TIDAK tersedia dalam PENGETAHUAN di atas, gunakan tools yang tersedia untuk mengambilnya sebelum menjawab.`
        }
    ];
    const reply = await callLLMWithTools(messages, settings, track, 6, userContext, opts);
    return reply || 'Maaf, tidak dapat menjawab berdasarkan pengetahuan yang tersedia.';
}

// ── AI makes a decision/creative response when no data found ──
async function aiGenerateResponse(message, history, settings, userContext = null, opts = {}) {
    const messages = [
        {
            role: 'system',
            content: `Anda adalah asisten AI Pustaka Sistem untuk manajemen arsip, pajak, dan akuntansi.

Tugas Anda adalah membantu pengguna dengan informasi yang Anda miliki.

ATURAN:
- Jika ditanya tentang data spesifik (dokumen, invoice, pajak, dll) dan Anda tidak memiliki data, akui dengan jujur
- Sarankan pengguna untuk mengunggah data atau menghubungi admin
- Gunakan format Markdown
- Jawab dalam Bahasa Indonesia yang ramah dan membantu`
        },
        ...(history || []).slice(-4),
        { role: 'user', content: `${brainContextRef ? `Memori terkait:\n${brainContextRef}\n\n` : ''}${message}\n\nPENTING: Untuk menjawab, langsung panggil tool yang tersedia untuk mengambil data yang diperlukan. JANGAN menulis rencana — panggil tool-nya sekarang.` }
    ];
    // Tailor konteks per role: non-admin tidak boleh disuruh memakai tool khusus admin
    if (!isAdminUser(userContext)) {
        messages.push({
            role: 'system',
            content: 'CATATAN: Tool notifikasi (get_notifications), audit trail (search_audit_trail), dan daftar pengguna (get_users) HANYA untuk admin dan TIDAK tersedia untuk Anda. Jika pengguna menanyakan hal itu, sampaikan bahwa fitur tersebut khusus admin.',
        });
    }
    const executedTools = [];
    const reply = await callLLMWithTools(messages, settings, executedTools, 6, userContext, opts);
    return {
        reply: reply || 'Maaf, saya tidak dapat memproses pertanyaan Anda saat ini. Silakan coba lagi.',
        toolCalls: executedTools,
    };
}

// ── Main agent loop ──
export async function runAgent(message, history = [], embedFn = null, sessionId = null, userContext = null, opts = {}) {
    const { onStatus = null, onToken = null, onTool = null, onReasoning = null, signal = null, stream = false } = opts;
    const agentOpts = { onStatus, onToken, onTool, onReasoning, signal, stream };
    const emitStatus = (text) => { try { onStatus?.(text); } catch {} };
    embedFnRef = embedFn;
    brainContextRef = '';
    agentUserRef = userContext || null;
    const settings = await getAiSettings();
    if (!settings.enabled || !settings.api_key || !settings.base_url) {
        throw new Error('AI Agent belum dikonfigurasi. Atur Base URL & API Key di Master Data (Admin).');
    }

    // ── Check cache ──
    try {
        const cached = await findCachedReply(message, embedFn);
        if (cached) {
            console.log(`[AI Agent] Cache hit — returning cached reply (age: ${cached.cacheAge})`);
            const suggestions = generateSuggestions(cached.toolCalls || [], classifyIntent(message), message);
            return { reply: cached.reply, toolCalls: cached.toolCalls, fromCache: true, cacheAge: cached.cacheAge, suggestions };
        }
    } catch (err) {
        console.warn(`[AI Agent] Cache check failed, proceeding: ${err.message}`);
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

    const toolCallsLog = [];

    // ── STEP 0: Recall relevant memories from 1MBrain ──
    try {
        const memories = await brain.recall(message, { limit: 5 });
        if (memories && memories.length > 0) {
            brainContextRef = memories.map((r, i) =>
                `[Memory ${i + 1}] (${r.memory.type}, score: ${r.score.toFixed(2)})\n${r.memory.content}`
            ).join('\n\n');
            console.log(`[AI Agent] STEP 0: ${memories.length} relevant memories recalled from brain`);
        }
    } catch (err) {
        console.warn(`[AI Agent] Brain recall failed: ${err.message}`);
    }

    // ── STEP 1: Search Database Directly ──
    emitStatus('Mencari data di database...');
    console.log(`[AI Agent] STEP 1: Mencari data di database...`);
    const dbResults = await searchDatabaseDirect(message);
    const dbFound = Object.values(dbResults).some(r => r && r.length > 0);

    // Log found tables
    for (const [table, rows] of Object.entries(dbResults)) {
        if (rows && rows.length > 0) {
            toolCallsLog.push({ name: `search_${table}`, args: { query: message }, result: { count: rows.length } });
            console.log(`[AI Agent]   → ${table}: ${rows.length} hasil`);
        }
    }

    // ── STEP 2: If DB data found, process report with AI ──
    if (dbFound) {
        emitStatus('Data ditemukan. Menyusun laporan...');
        console.log(`[AI Agent] STEP 2: Data ditemukan di database. Mengolah laporan dengan AI...`);
        const agentTrack2 = [];
        const reply = await generateReportFromData(message, dbResults, settings, [], agentTrack2, agentUserRef, agentOpts);
        if (agentTrack2.length) {
            toolCallsLog.push(...agentTrack2);
            console.log(`[AI Agent]   → ${agentTrack2.length} tool dieksekusi: ${agentTrack2.map(t => t.name).join(', ')}`);
        }

        brain.rememberTurn(message, reply, { sessionId, topics: [intent], importance: 0.7 }).catch(() => {});

        const sensitive2 = agentTrack2.some(t => SENSITIVE_TOOLS.includes(t.name));
        if (!sensitive2) {
            saveToCache(message, reply, toolCallsLog, settings.model || 'unknown', embedFn).catch(e =>
                console.warn(`[AI Agent] Cache save failed: ${e.message}`)
            );
        }
        const suggestions = generateSuggestions(toolCallsLog, intent, message);
        logLearning(sessionId, message, reply, toolCallsLog);
        return { reply, toolCalls: toolCallsLog, suggestions };
    }

    // ── STEP 3: Search Knowledge (Training Docs) ──
    emitStatus('Mencari di dokumen training...');
    console.log(`[AI Agent] STEP 3: Data tidak ditemukan. Mencari di knowledge (dokumen training)...`);
    let trainingContext = '';
    if (embedFn) {
        try {
            const { searchTrainingDocs } = await import('./trainingDocs.js');
            const trainingDocs = await searchTrainingDocs(message, embedFn, { limit: 3 });
            console.log(`[AI Agent] Training docs search: ${trainingDocs.length} results`);
            if (trainingDocs.length > 0) {
                trainingContext = trainingDocs.map((r, i) =>
                    `${i + 1}. [${r.title}] (similaritas: ${r.similarity})\n${r.content}`
                ).join('\n\n');
                toolCallsLog.push({ name: 'search_training_docs', args: { query: message }, result: { count: trainingDocs.length } });
                console.log(`[AI Agent]   → ${trainingDocs.length} dokumen training relevan ditemukan`);
            }
        } catch (err) {
            console.warn(`[AI Agent] Training docs retrieval failed: ${err.message}`);
        }
    }

    if (trainingContext) {
        emitStatus('Pengetahuan ditemukan. Menyusun jawaban...');
        console.log(`[AI Agent] STEP 3b: Pengetahuan ditemukan. Menghasilkan jawaban dengan AI...`);
        const agentTrack3 = [];
        const reply = await generateReportWithKnowledge(message, trainingContext, settings, [], agentTrack3, agentUserRef, agentOpts);
        if (agentTrack3.length) {
            toolCallsLog.push(...agentTrack3);
            console.log(`[AI Agent]   → ${agentTrack3.length} tool dieksekusi: ${agentTrack3.map(t => t.name).join(', ')}`);
        }

        brain.rememberTurn(message, reply, { sessionId, topics: [intent, 'knowledge'], importance: 0.6 }).catch(() => {});

        const sensitive3 = agentTrack3.some(t => SENSITIVE_TOOLS.includes(t.name));
        if (!sensitive3) {
            saveToCache(message, reply, toolCallsLog, settings.model || 'unknown', embedFn).catch(e =>
                console.warn(`[AI Agent] Cache save failed: ${e.message}`)
            );
        }
        const suggestions = generateSuggestions(toolCallsLog, intent, message);
        logLearning(sessionId, message, reply, toolCallsLog);
        return { reply, toolCalls: toolCallsLog, suggestions };
    }

    // ── STEP 4: Make Decision Based on AI (dengan tool loop) ──
    emitStatus('Mengambil keputusan berdasarkan AI...');
    console.log(`[AI Agent] STEP 4: Tidak ada data/knowledge. Mengambil keputusan berdasarkan AI...`);
    const { reply, toolCalls: agentToolCalls } = await aiGenerateResponse(message, hist, settings, agentUserRef, agentOpts);
    if (agentToolCalls && agentToolCalls.length) {
        toolCallsLog.push(...agentToolCalls);
        console.log(`[AI Agent]   → ${agentToolCalls.length} tool dieksekusi: ${agentToolCalls.map(t => t.name).join(', ')}`);
    }

    brain.rememberTurn(message, reply, { sessionId, topics: [intent], importance: 0.5 }).catch(() => {});

    // Jangan cache jawaban yang berasal dari tool sensitif (mencegah bocor antar-role)
    const sensitiveUsed = (agentToolCalls || []).some(t => SENSITIVE_TOOLS.includes(t.name));
    if (!sensitiveUsed) {
        saveToCache(message, reply, toolCallsLog, settings.model || 'unknown', embedFn).catch(e =>
            console.warn(`[AI Agent] Cache save failed: ${e.message}`)
        );
    }
    const suggestions = generateSuggestions(toolCallsLog, intent, message);
    logLearning(sessionId, message, reply, toolCallsLog);
    return { reply, toolCalls: toolCallsLog, suggestions };
}
