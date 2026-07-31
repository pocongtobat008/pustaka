export async function up(knex) {
    const has = await knex.schema.hasColumn('proforma_invoices', 'ppn_rate');
    if (!has) {
        await knex.schema.alterTable('proforma_invoices', (t) => {
            t.decimal('ppn_rate', 6, 3).nullable().defaultTo(0.11);
        });
    }
    const hasCustom = await knex.schema.hasColumn('proforma_invoices', 'ppn_custom');
    if (!hasCustom) {
        await knex.schema.alterTable('proforma_invoices', (t) => {
            t.boolean('ppn_custom').nullable().defaultTo(false);
        });
    }
}

export async function down(knex) {
    await knex.schema.alterTable('proforma_invoices', (t) => {
        t.dropColumn('ppn_custom');
        t.dropColumn('ppn_rate');
    });
}
