export async function up(knex) {
    const has = await knex.schema.hasTable('email_templates');
    if (!has) {
        await knex.schema.createTable('email_templates', (t) => {
            t.increments('id').primary();
            t.string('event', 60).notNullable().unique();
            t.string('subject', 255).notNullable();
            t.text('body_html').notNullable();
            t.string('updated_by', 100).nullable();
            t.timestamp('updated_at').defaultTo(knex.fn.now());
        });
    }
}

export async function down(knex) {
    await knex.schema.dropTableIfExists('email_templates');
}
