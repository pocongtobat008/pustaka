/**
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
    // Drop the old IVFFlat index first (it was built for vector(1536))
    await knex.raw('DROP INDEX IF EXISTS idx_ai_training_docs_embedding');

    // Alter column from vector(1536) to vector(1024) to match API embedding model
    await knex.raw('ALTER TABLE ai_training_documents ALTER COLUMN embedding TYPE vector(1024)');

    // Recreate IVFFlat index for the corrected dimension
    // IVFFlat requires data; if table is empty, skip
    const count = await knex('ai_training_documents').count('id as cnt').first();
    if (Number(count?.cnt || 0) > 10) {
        await knex.raw(`
            CREATE INDEX idx_ai_training_docs_embedding
            ON ai_training_documents USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 10)
        `);
    }
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
    await knex.raw('DROP INDEX IF EXISTS idx_ai_training_docs_embedding');
    await knex.raw('ALTER TABLE ai_training_documents ALTER COLUMN embedding TYPE vector(1536)');
    await knex.raw(`
        CREATE INDEX idx_ai_training_docs_embedding
        ON ai_training_documents USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 10)
    `).catch(() => {});
}
