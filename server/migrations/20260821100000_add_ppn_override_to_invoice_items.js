/**
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  const hasProforma = await knex.schema.hasColumn('proforma_invoice_items', 'ppn_override');
  if (!hasProforma) {
    await knex.schema.alterTable('proforma_invoice_items', t => {
      t.decimal('ppn_override', 15, 2).nullable();
    });
  }

  const hasSettled = await knex.schema.hasColumn('settled_invoice_items', 'ppn_override');
  if (!hasSettled) {
    await knex.schema.alterTable('settled_invoice_items', t => {
      t.decimal('ppn_override', 15, 2).nullable();
    });
  }
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  const hasProforma = await knex.schema.hasColumn('proforma_invoice_items', 'ppn_override');
  if (hasProforma) {
    await knex.schema.alterTable('proforma_invoice_items', t => t.dropColumn('ppn_override'));
  }
  const hasSettled = await knex.schema.hasColumn('settled_invoice_items', 'ppn_override');
  if (hasSettled) {
    await knex.schema.alterTable('settled_invoice_items', t => t.dropColumn('ppn_override'));
  }
}
