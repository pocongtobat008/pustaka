/**
 * AI Agent settings (Base URL + API Key + Model) configured from Master Data.
 * Single-row configuration table.
 */
export async function up(knex) {
    const exists = await knex.schema.hasTable('ai_settings');
    if (!exists) {
        return knex.schema.createTable('ai_settings', (table) => {
            table.increments('id').primary();
            table.string('base_url').nullable();
            table.text('api_key').nullable();
            table.string('model').nullable();
            table.boolean('enabled').defaultTo(false);
            table.timestamps(true, true);
        });
    }
}

export async function down(knex) {
    return knex.schema.dropTableIfExists('ai_settings');
}
