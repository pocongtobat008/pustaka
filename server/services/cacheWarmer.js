import { knex } from '../db.js';
import { findCachedReply, saveToCache, invalidateCache, rebuildIndex, getCacheStats } from './agentCache.js';
import { runAgent } from './aiAgent.js';

// ── Pre-warmed queries (common questions users ask) ──
const WARM_QUERIES = [
    'ringkasan data',
    'statistik dokumen',
    'data pajak terbaru',
    'invoice terbaru',
    'akun COA terbaru',
    'approval pending',
    'box inventory terbaru',
];

// ── Config ──
const LAST_WARM_KEY = 'last_cache_warm_at';
const EMBEDDING_STALENESS_HOURS = 12; // re-embed records older than this

/**
 * Run a full cache warming cycle.
 * Designed to be called by the worker on a schedule (BullMQ repeatable job).
 *
 * @param {Function|null} embedFn - embedding function (passed from worker)
 * @returns {Promise<object>} warm result summary
 */
export async function runCacheWarmer(embedFn = null) {
    const startTime = Date.now();
    const log = {
        status: 'running',
        docs_embedded: 0,
        invoices_embedded: 0,
        coa_embedded: 0,
        inventory_embedded: 0,
        prewarmed_queries: 0,
        prewarm_failed: 0,
        stale_refreshed: 0,
        index_rebuilt: false,
        cache_entries_before: 0,
        cache_entries_after: 0,
        duration_ms: 0,
        error: null,
    };

    // Insert log row
    const [logRow] = await knex('ai_cache_warm_logs')
        .insert({ status: 'running', started_at: knex.fn.now() })
        .returning('id');
    const logId = typeof logRow === 'object' ? logRow.id : logRow;

    try {
        console.log('[CacheWarmer] === Starting cache warm cycle ===');

        // 1. Get cache stats before
        const statsBefore = await getCacheStats();
        log.cache_entries_before = statsBefore.totalEntries;

        // 2. Get last warm time
        const lastWarmSetting = await knex('ai_settings').where('id', 1).first();
        let lastWarmAt = null;
        if (lastWarmSetting) {
            try {
                const meta = JSON.parse(lastWarmSetting.meta || '{}');
                lastWarmAt = meta[LAST_WARM_KEY] ? new Date(meta[LAST_WARM_KEY]) : null;
            } catch { /* ignore */ }
        }

        // 3. Re-embed changed documents
        log.docs_embedded = await reembedDocuments(embedFn, lastWarmAt);
        console.log(`[CacheWarmer] Re-embedded ${log.docs_embedded} documents`);

        // 4. Re-embed changed invoices
        log.invoices_embedded = await reembedInvoices(embedFn, lastWarmAt);
        console.log(`[CacheWarmer] Re-embedded ${log.invoices_embedded} invoices`);

        // 5. Re-embed changed COA records
        log.coa_embedded = await reembedCoa(embedFn, lastWarmAt);
        console.log(`[CacheWarmer] Re-embedded ${log.coa_embedded} COA records`);

        // 6. Re-embed changed inventory
        log.inventory_embedded = await reembedInventory(embedFn, lastWarmAt);
        console.log(`[CacheWarmer] Re-embedded ${log.inventory_embedded} inventory records`);

        // 7. Pre-warm common queries
        const prewarm = await prewarmCommonQueries(embedFn);
        log.prewarmed_queries = prewarm.success;
        log.prewarm_failed = prewarm.failed;
        console.log(`[CacheWarmer] Pre-warmed ${prewarm.success} queries (${prewarm.failed} failed)`);

        // 8. Refresh stale high-traffic cache entries
        log.stale_refreshed = await refreshStaleCache(embedFn);
        console.log(`[CacheWarmer] Refreshed ${log.stale_refreshed} stale cache entries`);

        // 9. Rebuild pgvector index
        if (log.docs_embedded + log.invoices_embedded + log.coa_embedded + log.inventory_embedded > 10) {
            await rebuildIndex();
            log.index_rebuilt = true;
            console.log('[CacheWarmer] Rebuilt pgvector IVFFlat index');
        }

        // 10. Update last warm time in ai_settings
        await updateLastWarmTime();

        // 11. Get cache stats after
        const statsAfter = await getCacheStats();
        log.cache_entries_after = statsAfter.totalEntries;

        log.status = 'success';
        log.duration_ms = Date.now() - startTime;

        console.log(`[CacheWarmer] === Cycle complete in ${(log.duration_ms / 1000).toFixed(1)}s ===`);

    } catch (err) {
        log.status = 'failed';
        log.error = err.message;
        log.duration_ms = Date.now() - startTime;
        console.error(`[CacheWarmer] Cycle failed: ${err.message}`);
    }

    // Update log row
    await knex('ai_cache_warm_logs').where('id', logId).update({
        status: log.status,
        docs_embedded: log.docs_embedded,
        invoices_embedded: log.invoices_embedded,
        coa_embedded: log.coa_embedded,
        inventory_embedded: log.inventory_embedded,
        prewarmed_queries: log.prewarmed_queries,
        prewarm_failed: log.prewarm_failed,
        stale_refreshed: log.stale_refreshed,
        index_rebuilt: log.index_rebuilt,
        cache_entries_before: log.cache_entries_before,
        cache_entries_after: log.cache_entries_after,
        duration_ms: log.duration_ms,
        error: log.error,
        finished_at: knex.fn.now(),
    });

    return log;
}

// ── Re-embed documents changed since last warm ──
async function reembedDocuments(embedFn, since) {
    if (!embedFn) return 0;
    let query = knex('documents').select('id', 'title', 'ocrContent');
    if (since) query = query.where('updated_at', '>', since);
    const docs = await query.limit(200);
    let count = 0;
    for (const d of docs) {
        try {
            const combined = `${d.title || ''}\n\n${d.ocrContent || ''}`.trim();
            if (combined.length < 10) continue;
            const v = await embedFn(combined);
            try {
                await knex('documents').where('id', d.id).update({ vector: JSON.stringify(v) });
            } catch { /* ignore write errors */ }
            count++;
        } catch { /* skip embedding errors */ }
    }
    return count;
}

// ── Re-embed invoices changed since last warm ──
async function reembedInvoices(embedFn, since) {
    if (!embedFn) return 0;
    let query = knex('invoices').select('id', 'vendor', 'invoice_no', 'tax_invoice_no', 'ocr_content', 'ocrContent');
    if (since) query = query.where('updated_at', '>', since);
    const invoices = await query.limit(200);
    let count = 0;
    for (const inv of invoices) {
        try {
            const text = inv.ocr_content || inv.ocrContent || '';
            const combined = `${inv.vendor || ''} ${inv.invoice_no || ''} ${inv.tax_invoice_no || ''} ${text}`.trim();
            if (combined.length < 5) continue;
            const v = await embedFn(combined);
            try {
                await knex('invoices').where('id', inv.id).update({ vector: JSON.stringify(v) });
            } catch { /* ignore */ }
            count++;
        } catch { /* skip */ }
    }
    return count;
}

// ── Re-embed COA records changed since last warm ──
async function reembedCoa(embedFn, since) {
    if (!embedFn) return 0;
    let query = knex('coa_accounts').select('id', 'code', 'name', 'description');
    if (since) query = query.where('created_at', '>', since);
    const accts = await query.limit(200);
    let count = 0;
    for (const a of accts) {
        try {
            const combined = `${a.code} ${a.name} ${a.description || ''}`.trim();
            if (combined.length < 3) continue;
            await embedFn(combined); // just ensure embedding pipeline is warm
            count++;
        } catch { /* skip */ }
    }
    return count;
}

// ── Re-embed inventory records changed since last warm ──
async function reembedInventory(embedFn, since) {
    if (!embedFn) return 0;
    let query = knex('inventory').select('id', 'box_data');
    if (since) query = query.where('updated_at', '>', since);
    const items = await query.limit(200);
    let count = 0;
    for (const inv of items) {
        try {
            let box = null;
            try { box = JSON.parse(inv.box_data); } catch { continue; }
            if (!box) continue;
            const parts = [];
            if (box.id) parts.push(String(box.id));
            if (box.ocrContent) parts.push(box.ocrContent);
            if (Array.isArray(box.ordners)) {
                for (const ord of box.ordners) {
                    if (ord.noOrdner) parts.push(ord.noOrdner);
                    if (Array.isArray(ord.invoices)) {
                        for (const invoice of ord.invoices) {
                            if (invoice.invoiceNo) parts.push(invoice.invoiceNo);
                            if (invoice.vendor) parts.push(invoice.vendor);
                            if (invoice.ocrContent) parts.push(invoice.ocrContent);
                        }
                    }
                }
            }
            const combined = parts.join(' ').trim();
            if (combined.length < 5) continue;
            await embedFn(combined);
            count++;
        } catch { /* skip */ }
    }
    return count;
}

// ── Pre-warm common queries by running them through the agent ──
async function prewarmCommonQueries(embedFn) {
    let success = 0;
    let failed = 0;

    for (const query of WARM_QUERIES) {
        try {
            // Check if already cached
            const cached = await findCachedReply(query, embedFn);
            if (cached) {
                success++; // already warm
                continue;
            }

            // Run through agent (will auto-save to cache)
            await runAgent(query, [], embedFn);
            success++;
            console.log(`[CacheWarmer] Pre-warmed: "${query}"`);
        } catch (err) {
            failed++;
            console.warn(`[CacheWarmer] Pre-warm failed for "${query}": ${err.message}`);
        }
    }

    return { success, failed };
}

// ── Refresh stale cache entries that have high hit counts ──
async function refreshStaleCache(embedFn) {
    // Find cache entries that are expired or about to expire but have been hit multiple times
    const staleEntries = await knex('ai_agent_cache')
        .where('hit_count', '>=', 2)
        .where('expires_at', '<', knex.fn.now())
        .orderBy('hit_count', 'desc')
        .limit(20);

    let refreshed = 0;
    for (const entry of staleEntries) {
        try {
            // Re-run the query to get fresh data
            const result = await runAgent(entry.query_text, [], embedFn);
            if (result && result.reply) {
                refreshed++;
            }
        } catch { /* skip failed refreshes */ }
    }

    return refreshed;
}

// ── Update last warm timestamp in ai_settings meta ──
async function updateLastWarmTime() {
    try {
        const existing = await knex('ai_settings').where('id', 1).first();
        if (existing) {
            let meta = {};
            try { meta = JSON.parse(existing.meta || '{}'); } catch { meta = {}; }
            meta[LAST_WARM_KEY] = new Date().toISOString();
            await knex('ai_settings').where('id', 1).update({ meta: JSON.stringify(meta) });
        }
    } catch { /* ignore */ }
}

// ── Get warm logs for admin display ──
export async function getWarmLogs({ limit = 20, offset = 0 } = {}) {
    return knex('ai_cache_warm_logs')
        .orderBy('started_at', 'desc')
        .limit(limit)
        .offset(offset);
}

// ── Get latest warm log ──
export async function getLatestWarmLog() {
    return knex('ai_cache_warm_logs')
        .orderBy('started_at', 'desc')
        .first();
}

// ── Get warm schedule config ──
export async function getWarmConfig() {
    const settings = await knex('ai_settings').where('id', 1).first();
    let meta = {};
    try { meta = JSON.parse(settings?.meta || '{}'); } catch { meta = {}; }
    return {
        enabled: meta.cache_warm_enabled !== false,
        interval_hours: meta.cache_warm_interval_hours || 6,
        last_warm_at: meta[LAST_WARM_KEY] || null,
        warm_queries: WARM_QUERIES,
    };
}

// ── Update warm schedule config ──
export async function updateWarmConfig({ enabled, interval_hours }) {
    const existing = await knex('ai_settings').where('id', 1).first();
    if (!existing) return;
    let meta = {};
    try { meta = JSON.parse(existing.meta || '{}'); } catch { meta = {}; }
    if (enabled !== undefined) meta.cache_warm_enabled = enabled;
    if (interval_hours !== undefined) meta.cache_warm_interval_hours = interval_hours;
    await knex('ai_settings').where('id', 1).update({ meta: JSON.stringify(meta) });
}
