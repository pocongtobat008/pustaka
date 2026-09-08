export async function up(knex) {
    // PP (DP + Pelunasan) adalah 1 kesatuan → No Invoice Asli boleh SAMA antar
    // baris settle satu grup PP. Unique constraint dilepas; validasi kesamaan
    // no antar grup tetap dijaga di level aplikasi (invoiceRoutes.js).
    const has = await knex.schema.hasTable('settled_invoices');
    if (!has) return;
    const client = String(knex.client?.config?.client || '');
    if (client.includes('pg') || client.includes('postgres')) {
        await knex.raw('ALTER TABLE settled_invoices DROP CONSTRAINT IF EXISTS settled_invoices_no_invoice_unique');
    } else {
        try {
            await knex.schema.alterTable('settled_invoices', (t) => {
                t.dropUnique(['no_invoice']);
            });
        } catch (e) {
            console.warn('Skip drop unique settled_invoices.no_invoice:', e.message);
        }
    }
}

export async function down(knex) {
    const has = await knex.schema.hasTable('settled_invoices');
    if (!has) return;
    try {
        await knex.schema.alterTable('settled_invoices', (t) => {
            t.unique(['no_invoice']);
        });
    } catch (e) {
        console.warn('Skip re-add unique settled_invoices.no_invoice:', e.message);
    }
}
