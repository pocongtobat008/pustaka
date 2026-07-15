/**
 * Chat history persistence for AI Agent.
 * - ai_chat_sessions: one row per conversation
 * - ai_chat_messages: individual messages (user + assistant)
 */
export async function up(knex) {
    if (!(await knex.schema.hasTable('ai_chat_sessions'))) {
        await knex.schema.createTable('ai_chat_sessions', (table) => {
            table.increments('id').primary();
            table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
            table.string('title', 255).nullable();
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());
        });
    }

    if (!(await knex.schema.hasTable('ai_chat_messages'))) {
        await knex.schema.createTable('ai_chat_messages', (table) => {
            table.increments('id').primary();
            table.integer('session_id').unsigned().notNullable()
                .references('id').inTable('ai_chat_sessions').onDelete('CASCADE');
            table.string('role', 20).notNullable(); // 'user' | 'assistant'
            table.text('content').notNullable();
            table.json('tool_calls').nullable();
            table.boolean('from_cache').defaultTo(false);
            table.string('cache_age', 50).nullable();
            table.timestamp('created_at').defaultTo(knex.fn.now());

            table.index('session_id');
            table.index('created_at');
        });
    }
}

export async function down(knex) {
    await knex.schema.dropTableIfExists('ai_chat_messages');
    await knex.schema.dropTableIfExists('ai_chat_sessions');
}
