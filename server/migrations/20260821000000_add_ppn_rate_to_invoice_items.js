/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    // proforma_invoice_items
    const hasCol1 = await knex.schema.hasColumn('proforma_invoice_items', 'ppn_rate');
    if (!hasCol1) {
        await knex.schema.alterTable('proforma_invoice_items', (t) => {
            t.decimal('ppn_rate', 5, 4).defaultTo(0.11);
        });
    }

    // settled_invoice_items
    const hasCol2 = await knex.schema.hasColumn('settled_invoice_items', 'ppn_rate');
    if (!hasCol2) {
        await knex.schema.alterTable('settled_invoice_items', (t) => {
            t.decimal('ppn_rate', 5, 4).defaultTo(0.11);
        });
    }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    const hasCol1 = await knex.schema.hasColumn('proforma_invoice_items', 'ppn_rate');
    if (hasCol1) {
        await knex.schema.alterTable('proforma_invoice_items', (t) => {
            t.dropColumn('ppn_rate');
        });
    }
    const hasCol2 = await knex.schema.hasColumn('settled_invoice_items', 'ppn_rate');
    if (hasCol2) {
        await knex.schema.alterTable('settled_invoice_items', (t) => {
            t.dropColumn('ppn_rate');
        });
    }
}
