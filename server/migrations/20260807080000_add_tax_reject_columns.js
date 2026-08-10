export async function up(knex) {
    const cols = [
        ['tax_rejected_at', (t) => t.timestamp('tax_rejected_at')],
        ['tax_rejected_by', (t) => t.string('tax_rejected_by')],
        ['tax_reject_notes', (t) => t.text('tax_reject_notes')],
    ];
    for (const [name, col] of cols) {
        const has = await knex.schema.hasColumn('proforma_invoices', name);
        if (!has) await knex.schema.alterTable('proforma_invoices', (t) => col(t));
    }
}

export async function down(knex) {
    const cols = ['tax_rejected_at', 'tax_rejected_by', 'tax_reject_notes'];
    for (const name of cols) {
        const has = await knex.schema.hasColumn('proforma_invoices', name);
        if (has) await knex.schema.alterTable('proforma_invoices', (t) => t.dropColumn(name));
    }
}
