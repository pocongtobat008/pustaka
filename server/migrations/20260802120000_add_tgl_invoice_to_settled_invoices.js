export async function up(knex) {
    const has = await knex.schema.hasTable('settled_invoices');
    if (has) {
        const cols = await knex('settled_invoices').columnInfo();
        if (!cols.tgl_invoice) {
            await knex.schema.alterTable('settled_invoices', (t) => {
                t.date('tgl_invoice');
            });
        }
    }
}

export async function down(knex) {
    const has = await knex.schema.hasTable('settled_invoices');
    if (has) {
        const cols = await knex('settled_invoices').columnInfo();
        if (cols.tgl_invoice) {
            await knex.schema.alterTable('settled_invoices', (t) => {
                t.dropColumn('tgl_invoice');
            });
        }
    }
}
