export async function up(knex) {
    // ── Real (settled) invoices, dihasilkan saat settle proforma ──
    // 1 proforma bisa berisi >1 invoice, settle menghasilkan 1 invoice asli per invoice proforma
    const hasSettled = await knex.schema.hasTable('settled_invoices');
    if (!hasSettled) {
        await knex.schema.createTable('settled_invoices', (t) => {
            t.increments('id');
            t.string('no_invoice').unique();
            t.integer('proforma_id');
            t.string('proforma_no');
            t.integer('source_invoice_id');
            t.integer('dealer_id');
            t.string('dealer_name');
            t.string('dealer_npwp', 16);
            t.string('dealer_alamat');
            t.string('no_po');
            t.date('tgl_po');
            t.string('tipe', 10).defaultTo('CBD');
            t.date('tgl_transaksi');
            t.decimal('uang_masuk', 15, 2).defaultTo(0);
            t.date('tgl_uang_masuk');
            t.decimal('subtotal', 15, 2).defaultTo(0);
            t.decimal('ppn', 15, 2).defaultTo(0);
            t.decimal('ppn_rate', 8, 4).defaultTo(0);
            t.boolean('ppn_custom').defaultTo(false);
            t.decimal('diskon', 15, 2).defaultTo(0);
            t.decimal('materai', 15, 2).defaultTo(0);
            t.decimal('total_invoice', 15, 2).defaultTo(0);
            t.string('settled_by');
            t.timestamp('settled_at');
            t.timestamp('created_at').defaultTo(knex.fn.now());
        });
    }

    // ── Items untuk invoice asli ──
    const hasItems = await knex.schema.hasTable('settled_invoice_items');
    if (!hasItems) {
        await knex.schema.createTable('settled_invoice_items', (t) => {
            t.increments('id');
            t.integer('settled_invoice_id').notNullable();
            t.string('model');
            t.string('item_description');
            t.decimal('harga', 15, 2).defaultTo(0);
            t.integer('qty').defaultTo(1);
            t.decimal('subtotal', 15, 2).defaultTo(0);
            t.timestamp('created_at').defaultTo(knex.fn.now());
        });
    }
}

export async function down(knex) {
    await knex.schema.dropTableIfExists('settled_invoice_items');
    await knex.schema.dropTableIfExists('settled_invoices');
}
