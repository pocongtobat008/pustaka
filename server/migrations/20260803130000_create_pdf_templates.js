export async function up(knex) {
    const exists = await knex.schema.hasTable('pdf_templates');
    if (!exists) {
        await knex.schema.createTable('pdf_templates', (t) => {
            t.increments('id');
            t.string('doc_type', 50).notNullable().defaultTo('proforma');
            t.string('name').notNullable();
            t.text('html').nullable();
            t.text('css').nullable();
            t.boolean('is_active').notNullable().defaultTo(false);
            t.string('updated_by').nullable();
            t.timestamp('created_at').defaultTo(knex.fn.now());
            t.timestamp('updated_at').defaultTo(knex.fn.now());
        });
    }
}

export async function down(knex) {
    const exists = await knex.schema.hasTable('pdf_templates');
    if (exists) {
        await knex.schema.dropTable('pdf_templates');
    }
}
