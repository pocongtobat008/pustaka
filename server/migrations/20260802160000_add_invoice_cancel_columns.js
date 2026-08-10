export async function up(knex) {
    const cols = [
        ['cancelled_at', (t) => t.timestamp('cancelled_at')],
        ['cancelled_by', (t) => t.string('cancelled_by')],
    ];
    for (const [name, col] of cols) {
        const has = await knex.schema.hasColumn('proforma_invoices', name);
        if (!has) await knex.schema.alterTable('proforma_invoices', (t) => col(t));
    }
}

export async function down(knex) {
    for (const name of ['cancelled_at', 'cancelled_by']) {
        const has = await knex.schema.hasColumn('proforma_invoices', name);
        if (has) await knex.schema.alterTable('proforma_invoices', (t) => t.dropColumn(name));
    }
}
