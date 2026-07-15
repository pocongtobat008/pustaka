/**
 * Add pgvector column for fast similarity search on ai_agent_cache.
 *
 * - Adds `embedding vector(384)` column
 * - Migrates existing data from `query_vector` (JSON text) to `embedding`
 * - Creates IVFFlat index for O(log N) approximate nearest neighbor search
 * - Drops the old `query_vector` text column
 *
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
    const hasTable = await knex.schema.hasTable('ai_agent_cache');
    if (!hasTable) return;

    // 1. Add vector column
    const hasCol = await knex.schema.hasColumn('ai_agent_cache', 'embedding');
    if (!hasCol) {
        await knex.raw('ALTER TABLE ai_agent_cache ADD COLUMN embedding vector(384)');
    }

    // 2. Migrate existing query_vector JSON text -> embedding vector
    const rows = await knex('ai_agent_cache').whereNotNull('query_vector').select('id', 'query_vector');
    for (const row of rows) {
        try {
            const arr = JSON.parse(row.query_vector);
            if (Array.isArray(arr) && arr.length === 384) {
                const vecStr = '[' + arr.join(',') + ']';
                await knex.raw('UPDATE ai_agent_cache SET embedding = ?::vector WHERE id = ?', [vecStr, row.id]);
            }
        } catch { /* skip unparseable */ }
    }

    // 3. Create IVFFlat index (lists = sqrt(row_count), min 100 for small datasets)
    const count = await knex('ai_agent_cache').count('id as c').first();
    const lists = Math.max(10, Math.ceil(Math.sqrt(Number(count?.c || 100))));
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_agent_cache_embedding
        ON ai_agent_cache USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = ${lists})
    `).catch(() => {
        console.warn('[Migration] IVFFlat index creation deferred (need more rows for clustering)');
    });

    // 4. Drop old text column
    const hasOld = await knex.schema.hasColumn('ai_agent_cache', 'query_vector');
    if (hasOld) {
        await knex.schema.alterTable('ai_agent_cache', (t) => {
            t.dropColumn('query_vector');
        });
    }
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
    const hasCol = await knex.schema.hasColumn('ai_agent_cache', 'embedding');
    if (hasCol) {
        await knex.raw('DROP INDEX IF EXISTS idx_agent_cache_embedding');
        await knex.schema.alterTable('ai_agent_cache', (t) => {
            t.text('query_vector');
        });
        // Migrate back
        const rows = await knex('ai_agent_cache').whereNotNull('embedding').select('id', 'embedding');
        for (const row of rows) {
            const vecStr = String(row.embedding).replace(/[\[\]]/g, '');
            await knex('ai_agent_cache').where('id', row.id).update({ query_vector: vecStr });
        }
        await knex.schema.alterTable('ai_agent_cache', (t) => {
            t.dropColumn('embedding');
        });
    }
}
