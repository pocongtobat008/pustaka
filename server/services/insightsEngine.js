import { knex } from '../db.js';

// ── Insight Cache (1 hour TTL) ──
let cachedInsights = null;
let cacheTimestamp = 0;
const INSIGHT_CACHE_TTL_MS = 3600 * 1000; // 1 hour

/**
 * Run all anomaly detectors and return proactive insights.
 * Results are cached for 1 hour to avoid repeated DB queries.
 */
export async function getProactiveInsights() {
    const now = Date.now();
    if (cachedInsights && (now - cacheTimestamp) < INSIGHT_CACHE_TTL_MS) {
        return { ...cachedInsights, fromCache: true };
    }

    const insights = [];
    const detectors = [
        detectTaxSpike,
        detectOverdueInvoices,
        detectStuckDocuments,
        detectAuditDeadlines,
        detectEmptyCoa,
        detectHighVolumeFolders,
        detectRecentActivity,
    ];

    for (const detector of detectors) {
        try {
            const result = await detector();
            if (result) insights.push(result);
        } catch (err) {
            console.warn(`[Insights] Detector failed: ${err.message}`);
        }
    }

    const data = { insights, generatedAt: new Date().toISOString(), fromCache: false };
    cachedInsights = data;
    cacheTimestamp = now;
    return data;
}

/**
 * Invalidate insight cache (call when data changes significantly).
 */
export function invalidateInsightsCache() {
    cachedInsights = null;
    cacheTimestamp = 0;
}

// ── Detector: PPH spike (current vs previous month) ──
async function detectTaxSpike() {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    // tax_summaries has: pph23, pph42 (no generic 'ppn' column)
    const current = await knex('tax_summaries')
        .sum('pph23 as pph23').sum('pph42 as pph42')
        .where({ month: currentMonth, year: currentYear })
        .first();
    const prev = await knex('tax_summaries')
        .sum('pph23 as pph23').sum('pph42 as pph42')
        .where({ month: prevMonth, year: prevYear })
        .first();

    const curVal = Number(current?.pph23 || 0) + Number(current?.pph42 || 0);
    const prevVal = Number(prev?.pph23 || 0) + Number(prev?.pph42 || 0);

    if (prevVal > 0 && curVal > 0) {
        const change = ((curVal - prevVal) / prevVal) * 100;
        if (Math.abs(change) > 20) {
            const direction = change > 0 ? 'naik' : 'turun';
            return {
                type: 'tax_spike',
                severity: Math.abs(change) > 50 ? 'high' : 'medium',
                icon: '📊',
                title: `Pajak bulan ini ${direction} ${Math.abs(change).toFixed(0)}%`,
                detail: `Bulan ini: Rp ${formatNum(curVal)} | Bulan lalu: Rp ${formatNum(prevVal)}`,
                action: 'Lihat detail pajak',
            };
        }
    }
    return null;
}

// ── Detector: Old invoices (>30 days, no payment_date update) ──
async function detectOverdueInvoices() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // invoices has: payment_date but no 'status' column
    const overdue = await knex('invoices')
        .where('payment_date', '<', thirtyDaysAgo)
        .count('id as count')
        .first();

    const count = Number(overdue?.count || 0);
    if (count > 0) {
        return {
            type: 'overdue_invoices',
            severity: count > 10 ? 'high' : 'medium',
            icon: '💰',
            title: `${count} invoice tua (>30 hari)`,
            detail: 'Invoice dengan tanggal pembayaran lama',
            action: 'Cari invoice',
        };
    }
    return null;
}

// ── Detector: Stuck documents (processing status) ──
async function detectStuckDocuments() {
    // documents has: status, uploadDate (not created_at)
    const stuck = await knex('documents')
        .where('status', 'processing')
        .count('id as count')
        .first();

    const count = Number(stuck?.count || 0);
    if (count > 0) {
        return {
            type: 'stuck_documents',
            severity: 'high',
            icon: '📄',
            title: `${count} dokumen stuck dalam proses OCR`,
            detail: 'Dokumen yang masih status processing mungkin perlu diperiksa',
            action: 'Periksa job queue',
        };
    }
    return null;
}

// ── Detector: Audit deadlines approaching ──
async function detectAuditDeadlines() {
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    const upcoming = await knex('tax_audits')
        .where('startDate', '<=', sevenDaysLater)
        .where('startDate', '>=', new Date())
        .whereIn('status', ['pending', 'in_progress'])
        .select('title', 'startDate')
        .limit(3);

    if (upcoming.length > 0) {
        const titles = upcoming.map(a => a.title).join(', ');
        return {
            type: 'audit_deadline',
            severity: 'medium',
            icon: '⚠️',
            title: `${upcoming.length} audit pajak mendekati deadline`,
            detail: titles,
            action: 'Lihat audit',
        };
    }
    return null;
}

// ── Detector: COA accounts without sub-accounts ──
async function detectEmptyCoa() {
    // Use subquery to avoid GROUP BY issue
    const result = await knex.raw(`
        SELECT COUNT(*) as count FROM coa_accounts
        WHERE id NOT IN (SELECT DISTINCT account_id FROM coa_sub_accounts WHERE account_id IS NOT NULL)
    `);
    const count = Number(result?.rows?.[0]?.count || result?.[0]?.count || 0);

    if (count > 0) {
        return {
            type: 'empty_coa',
            severity: 'low',
            icon: '📋',
            title: `${count} akun COA tanpa sub-akun`,
            detail: 'Akun induk yang belum memiliki sub-akun mungkin perlu dilengkapi',
            action: 'Lihat COA',
        };
    }
    return null;
}

// ── Detector: High volume folders ──
async function detectHighVolumeFolders() {
    const folders = await knex('documents')
        .select('folderId')
        .count('id as count')
        .groupBy('folderId')
        .havingRaw('count(*) > ?', [50])
        .limit(3);

    if (folders.length > 0) {
        return {
            type: 'high_volume',
            severity: 'low',
            icon: '📁',
            title: `${folders.length} folder memiliki >50 dokumen`,
            detail: 'Pertimbangkan untuk membuat sub-folder',
            action: 'Lihat dokumen',
        };
    }
    return null;
}

// ── Detector: Recent activity summary ──
async function detectRecentActivity() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // documents uses uploadDate, not created_at
    const [docCount, invCount] = await Promise.all([
        knex('documents').where('uploadDate', '>=', today).count('id as c').first(),
        knex('invoices').where('payment_date', '>=', today).count('id as c').first(),
    ]);

    const total = Number(docCount?.c || 0) + Number(invCount?.c || 0);
    if (total > 0) {
        return {
            type: 'recent_activity',
            severity: 'info',
            icon: '🔄',
            title: `${total} aktivitas hari ini`,
            detail: `Dokumen: ${docCount?.c || 0} | Invoice: ${invCount?.c || 0}`,
            action: null,
        };
    }
    return null;
}

// ── Helpers ──
function formatNum(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + ' Miliar';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + ' Juta';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + ' Ribu';
    return n.toLocaleString('id-ID');
}
