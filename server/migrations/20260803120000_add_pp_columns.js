export async function up(knex) {
    const hasPpType = await knex.schema.hasColumn('proforma_invoices', 'pp_type');
    if (!hasPpType) {
        await knex.schema.alterTable('proforma_invoices', (t) => {
            t.string('pp_type', 50).nullable();
            t.integer('pelunasan_of_id').unsigned().nullable();
        });
    }
}

export async function down(knex) {
    const hasPpType = await knex.schema.hasColumn('proforma_invoices', 'pp_type');
    if (hasPpType) {
        await knex.schema.alterTable('proforma_invoices', (t) => {
            t.dropColumn('pp_type');
            t.dropColumn('pelunasan_of_id');
        });
    }
}
