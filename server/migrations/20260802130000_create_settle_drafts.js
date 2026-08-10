export async function up(knex) {
    const has = await knex.schema.hasTable('settle_drafts');
    if (!has) {
        await knex.schema.createTable('settle_drafts', (t) => {
            t.increments('id');
            t.integer('proforma_id').notNullable().unique();
            t.string('proforma_no');
            t.text('data'); // JSON: { rows: [...], notes, tgl_settle }
            t.string('created_by');
            t.timestamp('created_at').defaultTo(knex.fn.now());
            t.timestamp('updated_at').defaultTo(knex.fn.now());
        });
    }
}

export async function down(knex) {
    await knex.schema.dropTableIfExists('settle_drafts');
}
