/**
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
    const exists = await knex.schema.hasTable('ai_cache_warm_logs');
    if (exists) return;

    await knex.schema.createTable('ai_cache_warm_logs', (t) => {
        t.increments('id').primary();
        t.string('status', 20).notNullable().defaultTo('running'); // running, success, failed
        t.integer('docs_embedded').defaultTo(0);
        t.integer('invoices_embedded').defaultTo(0);
        t.integer('coa_embedded').defaultTo(0);
        t.integer('inventory_embedded').defaultTo(0);
        t.integer('prewarmed_queries').defaultTo(0);
        t.integer('prewarm_failed').defaultTo(0);
        t.integer('stale_refreshed').defaultTo(0);
        t.boolean('index_rebuilt').defaultTo(false);
        t.integer('cache_entries_before').defaultTo(0);
        t.integer('cache_entries_after').defaultTo(0);
        t.integer('duration_ms').defaultTo(0);
        t.text('error');
        t.timestamp('started_at').defaultTo(knex.fn.now());
        t.timestamp('finished_at');
    });
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
    await knex.schema.dropTableIfExists('ai_cache_warm_logs');
}
