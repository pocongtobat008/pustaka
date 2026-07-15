/**
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
    const exists = await knex.schema.hasTable('ai_agent_cache');
    if (exists) return;

    await knex.schema.createTable('ai_agent_cache', (t) => {
        t.increments('id').primary();
        t.string('query_hash', 64).notNullable().index();
        t.text('query_text').notNullable();
        t.text('query_vector');
        t.text('reply').notNullable();
        t.text('tool_calls');
        t.string('model', 100);
        t.integer('hit_count').defaultTo(0);
        t.timestamp('last_hit_at');
        t.timestamp('expires_at').notNullable();
        t.timestamp('created_at').defaultTo(knex.fn.now());
    });
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
    await knex.schema.dropTableIfExists('ai_agent_cache');
}
