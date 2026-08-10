export async function up(knex) {
    const cols = [
        ['can_view_dashboard', true],
        ['can_view_invoice', true],
        ['can_view_proforma', true],
        ['can_view_tax', true],
        ['can_view_dealer', true],
        ['can_view_barang', true],
        ['can_view_rule', true],
        ['can_edit', true],
        ['can_delete', true],
        ['can_cancel', true],
        ['can_proforma', true],
        ['can_sendback', true],
        ['can_reject', true],
        ['can_tax_request', true],
        ['can_tax_sendback', true],
        ['can_manage_rule', true],
        ['can_print', true],
    ];
    for (const [name, def] of cols) {
        const has = await knex.schema.hasColumn('invoice_rules', name);
        if (!has) await knex.schema.alterTable('invoice_rules', (t) => t.boolean(name).defaultTo(def));
    }
}

export async function down(knex) {
    const cols = [
        'can_view_dashboard', 'can_view_invoice', 'can_view_proforma', 'can_view_tax',
        'can_view_dealer', 'can_view_barang', 'can_view_rule',
        'can_edit', 'can_delete', 'can_cancel', 'can_proforma', 'can_sendback', 'can_reject',
        'can_tax_request', 'can_tax_sendback', 'can_manage_rule', 'can_print',
    ];
    for (const name of cols) {
        const has = await knex.schema.hasColumn('invoice_rules', name);
        if (has) await knex.schema.alterTable('invoice_rules', (t) => t.dropColumn(name));
    }
}
