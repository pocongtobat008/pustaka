/**
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
    const hasCol = await knex.schema.hasColumn('ai_settings', 'meta');
    if (!hasCol) {
        await knex.schema.alterTable('ai_settings', (t) => {
            t.text('meta').nullable();
        });
    }
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
    const hasCol = await knex.schema.hasColumn('ai_settings', 'meta');
    if (hasCol) {
        await knex.schema.alterTable('ai_settings', (t) => {
            t.dropColumn('meta');
        });
    }
}
