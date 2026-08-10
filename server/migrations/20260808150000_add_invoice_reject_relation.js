export async function up(knex) {
    const has = await knex.schema.hasTable('proforma_invoices');
    if (has) {
        const cols = await knex('proforma_invoices').columnInfo();
        if (!cols.rejected_from_id) {
            await knex.schema.alterTable('proforma_invoices', (t) => {
                t.integer('rejected_from_id').unsigned().nullable();
            });
        }
        if (!cols.replacement_id) {
            await knex.schema.alterTable('proforma_invoices', (t) => {
                t.integer('replacement_id').unsigned().nullable();
            });
        }
    }
}

export async function down(knex) {
    const has = await knex.schema.hasTable('proforma_invoices');
    if (has) {
        const cols = await knex('proforma_invoices').columnInfo();
        if (cols.rejected_from_id) {
            await knex.schema.alterTable('proforma_invoices', (t) => {
                t.dropColumn('rejected_from_id');
            });
        }
        if (cols.replacement_id) {
            await knex.schema.alterTable('proforma_invoices', (t) => {
                t.dropColumn('replacement_id');
            });
        }
    }
}
