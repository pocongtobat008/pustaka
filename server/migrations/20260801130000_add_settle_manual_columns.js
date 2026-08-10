export async function up(knex) {
    // Kolom tambahan untuk settle manual: tgl settle & faktur pajak terkait
    const has = await knex.schema.hasTable('settled_invoices');
    if (has) {
        const cols = await knex('settled_invoices').columnInfo();
        if (!cols.tgl_settle) {
            await knex.schema.alterTable('settled_invoices', (t) => {
                t.date('tgl_settle');
                t.string('faktur_pajak_no');
                t.string('faktur_pajak_file');
            });
        }
    }
}

export async function down(knex) {
    const has = await knex.schema.hasTable('settled_invoices');
    if (has) {
        const cols = await knex('settled_invoices').columnInfo();
        if (cols.tgl_settle) {
            await knex.schema.alterTable('settled_invoices', (t) => {
                t.dropColumn('tgl_settle');
                t.dropColumn('faktur_pajak_no');
                t.dropColumn('faktur_pajak_file');
            });
        }
    }
}
