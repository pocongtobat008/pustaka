/**
 * Add `reasoning` (text) and `thinking_steps` (json) columns to ai_chat_messages.
 * Persists the "Thinking" panel data so it survives session reloads.
 */
export async function up(knex) {
    if (!(await knex.schema.hasColumn('ai_chat_messages', 'reasoning'))) {
        await knex.schema.alterTable('ai_chat_messages', (table) => {
            table.text('reasoning').nullable();
        });
    }
    if (!(await knex.schema.hasColumn('ai_chat_messages', 'thinking_steps'))) {
        await knex.schema.alterTable('ai_chat_messages', (table) => {
            table.json('thinking_steps').nullable();
        });
    }
}

export async function down(knex) {
    const hasReasoning = await knex.schema.hasColumn('ai_chat_messages', 'reasoning');
    if (hasReasoning) {
        await knex.schema.alterTable('ai_chat_messages', (table) => {
            table.dropColumn('reasoning');
        });
    }
    const hasSteps = await knex.schema.hasColumn('ai_chat_messages', 'thinking_steps');
    if (hasSteps) {
        await knex.schema.alterTable('ai_chat_messages', (table) => {
            table.dropColumn('thinking_steps');
        });
    }
}
