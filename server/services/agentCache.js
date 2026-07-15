import { knex } from '../db.js';
import { createHash } from 'crypto';

// Cache TTL: 6 hours default, configurable
const DEFAULT_TTL_HOURS = 6;
// Minimum cosine similarity threshold for semantic cache hit
// pgvector `<=>` returns cosine DISTANCE (0=identical, 2=opposite)
// So threshold for similarity = 1 - SIMILARITY_THRESHOLD
const COSINE_DISTANCE_THRESHOLD = 1 - 0.82; // 0.18
// Max cache entries to keep (auto-prune oldest when exceeded)
const MAX_CACHE_ENTRIES = 5000;
// Number of nearest neighbors to probe in IVFFlat index
const IVFFLAT_PROBES = 10;

/**
 * Normalize a query string for hashing:
 * - lowercase
 * - collapse whitespace
 * - strip punctuation
 */
function normalizeQuery(text) {
    return (text || '')
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Generate a deterministic hash for exact-match caching.
 */
function hashQuery(text) {
    return createHash('sha256').update(normalizeQuery(text)).digest('hex').slice(0, 64);
}

/**
 * Find a cached response for the given query.
 * Strategy:
 *  1. Exact hash match (B-tree index, O(log N))
 *  2. Semantic similarity via pgvector IVFFlat index (O(log N))
 *
 * @param {string} message - User's query text
 * @param {Function|null} embedFn - Optional async function(text) => vector
 * @returns {Promise<{reply: string, toolCalls: any[], fromCache: boolean, cacheAge?: string}|null>}
 */
export async function findCachedReply(message, embedFn = null) {
    const hash = hashQuery(message);
    const now = new Date();

    // 1. Exact hash match — B-tree index, instant
    const exact = await knex('ai_agent_cache')
        .where('query_hash', hash)
        .where('expires_at', '>', now)
        .first();

    if (exact) {
        await knex('ai_agent_cache').where('id', exact.id).update({
            hit_count: (exact.hit_count || 0) + 1,
            last_hit_at: now,
        });
        console.log(`[AgentCache] HIT (exact) #${exact.id} — "${exact.query_text.slice(0, 60)}"`);
        return {
            reply: exact.reply,
            toolCalls: JSON.parse(exact.tool_calls || '[]'),
            fromCache: true,
            cacheAge: formatAge(exact.created_at),
        };
    }

    // 2. Semantic similarity via pgvector — IVFFlat index, O(log N)
    if (embedFn) {
        try {
            const queryVector = await embedFn(message);
            const vecStr = '[' + queryVector.join(',') + ']';

            // Use pgvector <=> (cosine distance) operator with IVFFlat index
            // Probes parameter controls accuracy vs speed trade-off
            await knex.raw(`SET ivfflat.probes = ${IVFFLAT_PROBES}`);

            const similar = await knex.raw(`
                SELECT id, query_text, reply, tool_calls, hit_count, created_at,
                       1 - (embedding <=> ?::vector) AS similarity
                FROM ai_agent_cache
                WHERE expires_at > now()
                  AND embedding IS NOT NULL
                ORDER BY embedding <=> ?::vector
                LIMIT 1
            `, [vecStr, vecStr]);

            const match = similar.rows?.[0];
            if (match && match.similarity >= (1 - COSINE_DISTANCE_THRESHOLD)) {
                await knex('ai_agent_cache').where('id', match.id).update({
                    hit_count: (match.hit_count || 0) + 1,
                    last_hit_at: now,
                });
                console.log(`[AgentCache] HIT (similar ${Number(match.similarity).toFixed(3)}) #${match.id} — "${match.query_text.slice(0, 60)}"`);
                return {
                    reply: match.reply,
                    toolCalls: JSON.parse(match.tool_calls || '[]'),
                    fromCache: true,
                    cacheAge: formatAge(match.created_at),
                };
            }
        } catch (err) {
            console.warn(`[AgentCache] Semantic search skipped: ${err.message}`);
        }
    }

    return null; // cache miss
}

/**
 * Save a response to the cache.
 *
 * @param {string} message - Original query
 * @param {string} reply - Agent's reply
 * @param {any[]} toolCalls - Tool calls executed
 * @param {string} model - Model used
 * @param {Function|null} embedFn - Optional embedding function
 * @param {number} ttlHours - TTL in hours
 */
export async function saveToCache(message, reply, toolCalls = [], model = '', embedFn = null, ttlHours = DEFAULT_TTL_HOURS) {
    if (!reply || reply.startsWith('Maaf,') || reply.startsWith('Agent Error')) {
        // Don't cache error/failure responses
        return;
    }

    const hash = hashQuery(message);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlHours * 3600 * 1000);

    let embeddingSql = 'NULL';
    if (embedFn) {
        try {
            const vec = await embedFn(message);
            const vecStr = '[' + vec.join(',') + ']';
            embeddingSql = `'${vecStr}'::vector`;
        } catch (err) {
            console.warn(`[AgentCache] Embedding for cache skipped: ${err.message}`);
        }
    }

    // Upsert: if same hash exists and not expired, update; else insert
    const existing = await knex('ai_agent_cache')
        .where('query_hash', hash)
        .where('expires_at', '>', now)
        .first();

    if (existing) {
        await knex.raw(`
            UPDATE ai_agent_cache
            SET reply = ?, tool_calls = ?, model = ?,
                embedding = ${embeddingSql},
                expires_at = ?, created_at = ?
            WHERE id = ?
        `, [reply, JSON.stringify(toolCalls), model, expiresAt, now, existing.id]);
        console.log(`[AgentCache] UPDATED #${existing.id}`);
    } else {
        await knex.raw(`
            INSERT INTO ai_agent_cache (query_hash, query_text, reply, tool_calls, model, hit_count, expires_at, embedding)
            VALUES (?, ?, ?, ?, ?, 0, ?, ${embeddingSql})
        `, [hash, message.slice(0, 500), reply, JSON.stringify(toolCalls), model, expiresAt]);
        console.log(`[AgentCache] SAVED — "${message.slice(0, 60)}"`);
    }

    // Auto-prune if too many entries
    await pruneCache();
}

/**
 * Invalidate all cache entries (e.g., when data in the database changes).
 * Optionally scope to a specific tool name.
 */
export async function invalidateCache(toolName = null) {
    if (toolName) {
        const deleted = await knex('ai_agent_cache')
            .whereRaw("tool_calls::jsonb @> ?", [JSON.stringify([{ name: toolName }])])
            .del();
        if (deleted > 0) console.log(`[AgentCache] Invalidated ${deleted} entries for tool "${toolName}"`);
    } else {
        const deleted = await knex('ai_agent_cache').del();
        if (deleted > 0) console.log(`[AgentCache] Full invalidation — ${deleted} entries cleared`);
    }
}

/**
 * Delete the oldest entries when cache exceeds MAX_CACHE_ENTRIES.
 */
async function pruneCache() {
    const count = await knex('ai_agent_cache').count('id as c').first();
    if (count && count.c > MAX_CACHE_ENTRIES) {
        const toDelete = count.c - MAX_CACHE_ENTRIES;
        await knex('ai_agent_cache')
            .orderBy('created_at', 'asc')
            .limit(toDelete)
            .del();
        console.log(`[AgentCache] Pruned ${toDelete} old entries`);
    }
}

/**
 * Rebuild the IVFFlat index (call after bulk inserts or when lists need adjustment).
 */
export async function rebuildIndex() {
    const count = await knex('ai_agent_cache').count('id as c').first();
    const lists = Math.max(10, Math.ceil(Math.sqrt(Number(count?.c || 100))));
    try {
        await knex.raw('DROP INDEX IF EXISTS idx_agent_cache_embedding');
        await knex.raw(`
            CREATE INDEX idx_agent_cache_embedding
            ON ai_agent_cache USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = ${lists})
        `);
        console.log(`[AgentCache] Index rebuilt with ${lists} lists`);
    } catch (err) {
        console.warn(`[AgentCache] Index rebuild failed: ${err.message}`);
    }
}

/**
 * Format a timestamp as a human-readable age string.
 */
function formatAge(date) {
    const ms = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return 'baru saja';
    if (minutes < 60) return `${minutes} menit lalu`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} jam lalu`;
    const days = Math.floor(hours / 24);
    return `${days} hari lalu`;
}

/**
 * Get cache statistics.
 */
export async function getCacheStats() {
    const total = await knex('ai_agent_cache').count('id as c').first();
    const hits = await knex('ai_agent_cache').sum('hit_count as s').first();
    const active = await knex('ai_agent_cache').where('expires_at', '>', new Date()).count('id as c').first();
    return {
        totalEntries: total?.c || 0,
        activeEntries: active?.c || 0,
        totalHits: hits?.s || 0,
    };
}
