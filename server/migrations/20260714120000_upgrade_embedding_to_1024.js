/**
 * Upgrade embedding dimension from 384 to 1024.
 * - Drops existing IVFFlat index
 * - Alters ai_agent_cache.embedding from vector(384) to vector(1024)
 * - Clears all existing cache entries (they have wrong-dimension embeddings)
 * - Rebuilds IVFFlat index for 1024 dimensions
 */
export async function up(knex) {
    // 1. Drop existing IVFFlat index (pgvector won't let you ALTER column type with index)
    await knex.raw('DROP INDEX IF EXISTS idx_agent_cache_embedding');

    // 2. Clear all existing cache entries (384-dim embeddings are incompatible with 1024)
    const count = await knex('ai_agent_cache').count('id as c').first();
    if (count && Number(count.c) > 0) {
        console.log(`[Migration] Clearing ${count.c} cache entries (384-dim → 1024-dim)`);
        await knex('ai_agent_cache').del();
    }

    // 3. Alter column type
    await knex.raw('ALTER TABLE ai_agent_cache ALTER COLUMN embedding TYPE vector(1024)');

    // 4. Rebuild IVFFlat index for 1024 dimensions
    // Need at least 100 rows for IVFFlat to work; use a placeholder for now
    // The actual index will be rebuilt when cache has enough entries
    // For safety, use a plain index first
    try {
        await knex.raw(`
            CREATE INDEX idx_agent_cache_embedding
            ON ai_agent_cache USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 10)
        `);
        console.log('[Migration] IVFFlat index created for vector(1024)');
    } catch (err) {
        // IVFFlat requires ≥100 rows; fall back to no index (will be rebuilt later)
        console.warn(`[Migration] IVFFlat index creation deferred (need ≥100 rows): ${err.message}`);
    }

    // 5. Also clear vectors from documents table (384-dim, incompatible with new model)
    const docCount = await knex('documents').whereNotNull('vector').andWhereNot('vector', '').count('id as c').first();
    if (docCount && Number(docCount.c) > 0) {
        console.log(`[Migration] Clearing ${docCount.c} document vectors (will be re-indexed by worker)`);
        await knex('documents').whereNotNull('vector').update({ vector: null });
    }
}

export async function down(knex) {
    await knex.raw('DROP INDEX IF EXISTS idx_agent_cache_embedding');
    await knex.raw('ALTER TABLE ai_agent_cache ALTER COLUMN embedding TYPE vector(384)');
    try {
        await knex.raw(`
            CREATE INDEX idx_agent_cache_embedding
            ON ai_agent_cache USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 10)
        `);
    } catch { /* ignore */ }
}
