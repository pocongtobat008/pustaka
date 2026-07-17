/**
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
    await knex.schema.createTable('ai_training_chunks', (table) => {
        table.increments('id').primary();
        table.integer('document_id').unsigned().notNullable()
            .references('id').inTable('ai_training_documents').onDelete('CASCADE');
        table.integer('chunk_index').notNullable().defaultTo(0);
        table.text('content').notNullable();
        table.specificType('embedding', 'vector(1024)').nullable();
        table.integer('token_count').defaultTo(0);
        table.timestamp('created_at').defaultTo(knex.fn.now());
    });

    // Index for semantic search on chunks
    await knex.raw(`
        CREATE INDEX idx_training_chunks_embedding
        ON ai_training_chunks USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 10)
    `).catch(() => {});

    // Index for document lookup
    await knex.schema.alterTable('ai_training_chunks', (table) => {
        table.index('document_id');
    });

    // Migrate existing data: create chunks from existing documents' content
    const docs = await knex('ai_training_documents')
        .where('status', 'active')
        .whereNotNull('content')
        .where('content', '!=', '')
        .select('id', 'content', 'embedding', 'chunk_count');

    for (const doc of docs) {
        if (!doc.content || doc.content.length < 10) continue;

        // Split content into chunks
        const CHUNK_SIZE = 1000;
        const CHUNK_OVERLAP = 200;
        const chunks = [];
        let start = 0;
        while (start < doc.content.length) {
            const end = Math.min(start + CHUNK_SIZE, doc.content.length);
            chunks.push(doc.content.slice(start, end));
            start += CHUNK_SIZE - CHUNK_OVERLAP;
        }

        // If we only have the document-level embedding, assign it to chunk 0
        const docEmbedding = doc.embedding;

        for (let i = 0; i < chunks.length; i++) {
            await knex('ai_training_chunks').insert({
                document_id: doc.id,
                chunk_index: i,
                content: chunks[i],
                token_count: Math.ceil(chunks[i].length / 4),
                // Only chunk 0 gets the existing document-level embedding
                embedding: (i === 0 && docEmbedding) ? docEmbedding : null,
            });
        }

        // Update chunk_count
        await knex('ai_training_documents')
            .where('id', doc.id)
            .update({ chunk_count: chunks.length });
    }
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
    await knex.schema.dropTableIfExists('ai_training_chunks');
}
