export async function up(knex) {
    const has = await knex.schema.hasColumn('invoice_rules', 'can_view_flow');
    if (!has) {
        await knex.schema.alterTable('invoice_rules', (t) => {
            t.boolean('can_view_flow').nullable().defaultTo(true);
        });
    }
}

export async function down(knex) {
    const has = await knex.schema.hasColumn('invoice_rules', 'can_view_flow');
    if (has) {
        await knex.schema.alterTable('invoice_rules', (t) => {
            t.dropColumn('can_view_flow');
        });
    }
}