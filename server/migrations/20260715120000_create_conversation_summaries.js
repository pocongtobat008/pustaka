/**
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
    const exists = await knex.schema.hasTable('ai_conversation_summaries');
    if (exists) return;

    await knex.schema.createTable('ai_conversation_summaries', (t) => {
        t.increments('id').primary();
        t.integer('session_id').unsigned().references('id').inTable('ai_chat_sessions').onDelete('CASCADE');
        t.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
        t.text('summary').notNullable();
        t.text('key_topics');
        t.integer('message_count').defaultTo(0);
        t.timestamp('created_at').defaultTo(knex.fn.now());
    });

    // Add embedding column if pgvector extension exists
    try {
        await knex.raw('ALTER TABLE ai_conversation_summaries ADD COLUMN embedding vector(1024)');
    } catch {
        // pgvector not available, skip
    }
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
    await knex.schema.dropTableIfExists('ai_conversation_summaries');
}
