export async function up(knex) {
    const cols = [
        ['tax_requested_at', (t) => t.timestamp('tax_requested_at')],
        ['tax_requested_by', (t) => t.string('tax_requested_by')],
        ['tax_approved_at', (t) => t.timestamp('tax_approved_at')],
        ['tax_approved_by', (t) => t.string('tax_approved_by')],
        ['tax_sendback_at', (t) => t.timestamp('tax_sendback_at')],
        ['tax_sendback_by', (t) => t.string('tax_sendback_by')],
    ];
    for (const [name, col] of cols) {
        const has = await knex.schema.hasColumn('proforma_invoices', name);
        if (!has) await knex.schema.alterTable('proforma_invoices', (t) => col(t));
    }
}

export async function down(knex) {
    const cols = ['tax_requested_at', 'tax_requested_by', 'tax_approved_at', 'tax_approved_by', 'tax_sendback_at', 'tax_sendback_by'];
    for (const name of cols) {
        const has = await knex.schema.hasColumn('proforma_invoices', name);
        if (has) await knex.schema.alterTable('proforma_invoices', (t) => t.dropColumn(name));
    }
}
