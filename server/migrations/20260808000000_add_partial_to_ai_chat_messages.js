/**
 * Add `partial` column to ai_chat_messages.
 * Marks assistant messages that were interrupted (user pressed Stop / stream cut off),
 * so the UI can show a "parsial" badge and the partial content is preserved.
 */
export async function up(knex) {
    const has = await knex.schema.hasColumn('ai_chat_messages', 'partial');
    if (!has) {
        await knex.schema.alterTable('ai_chat_messages', (table) => {
            table.boolean('partial').defaultTo(false).notNullable();
        });
    }
}

export async function down(knex) {
    const has = await knex.schema.hasColumn('ai_chat_messages', 'partial');
    if (has) {
        await knex.schema.alterTable('ai_chat_messages', (table) => {
            table.dropColumn('partial');
        });
    }
}
