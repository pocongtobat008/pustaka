/**
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
    await knex.raw('CREATE EXTENSION IF NOT EXISTS vector');

    await knex.schema.createTable('ai_training_documents', (table) => {
        table.increments('id').primary();
        table.string('title', 255).notNullable();
        table.string('filename', 255).nullable();
        table.string('file_type', 50).nullable();
        table.text('file_url').nullable();
        table.text('file_path').nullable();
        table.text('content').nullable();
        table.specificType('embedding', 'vector(1536)').nullable();
        table.string('category', 100).nullable().defaultTo('general');
        table.text('tags').nullable();
        table.string('status', 20).nullable().defaultTo('processing');
        table.integer('chunk_count').defaultTo(0);
        table.integer('uploaded_by').unsigned().nullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });

    // Index for semantic search
    await knex.raw(`
        CREATE INDEX idx_ai_training_docs_embedding
        ON ai_training_documents USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 10)
    `).catch(() => {
        // IVFFlat index requires data; fallback to no index on empty table
    });

    // Index for filtering
    await knex.schema.alterTable('ai_training_documents', (table) => {
        table.index('category');
        table.index('status');
        table.index('file_type');
    });
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
    await knex.schema.dropTableIfExists('ai_training_documents');
}
