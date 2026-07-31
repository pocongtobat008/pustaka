export async function up(knex) {
    // ── Master Dealer ──
    const hasDealers = await knex.schema.hasTable('invoice_dealers');
    if (!hasDealers) {
        await knex.schema.createTable('invoice_dealers', (t) => {
            t.increments('id');
            t.string('npwp', 16).notNullable().unique();
            t.string('nama').notNullable();
            t.text('alamat');
            t.timestamps(true, true);
        });
    }

    // ── Master Barang ──
    const hasBarang = await knex.schema.hasTable('invoice_barang');
    if (!hasBarang) {
        await knex.schema.createTable('invoice_barang', (t) => {
            t.increments('id');
            t.string('model').notNullable().unique();
            t.string('item_description');
            t.decimal('harga', 15, 2).notNullable().defaultTo(0);
            t.timestamps(true, true);
        });
    }

    // ── Invoices ──
    const hasInvoices = await knex.schema.hasTable('proforma_invoices');
    if (!hasInvoices) {
        await knex.schema.createTable('proforma_invoices', (t) => {
            t.increments('id');
            t.string('no_invoice').unique();
            t.integer('dealer_id');
            t.string('dealer_name');
            t.string('dealer_npwp', 16);
            t.string('dealer_alamat');
            t.string('no_po');
            t.date('tgl_po');
            t.string('tipe', 10).defaultTo('CBD'); // CBD / PP / PF
            t.date('tgl_transaksi');
            t.decimal('uang_masuk', 15, 2).defaultTo(0);
            t.date('tgl_uang_masuk');
            t.decimal('subtotal', 15, 2).defaultTo(0);
            t.decimal('ppn', 15, 2).defaultTo(0);
            t.decimal('diskon', 15, 2).defaultTo(0);
            t.decimal('materai', 15, 2).defaultTo(0);
            t.decimal('total_invoice', 15, 2).defaultTo(0);
            t.string('status', 20).defaultTo('submitted'); // submitted / proforma / tax / settled
            t.string('proforma_no');
            t.string('faktur_pajak_no');
            t.string('faktur_pajak_file');
            t.string('created_by');
            t.timestamp('created_at').defaultTo(knex.fn.now());
            t.timestamp('updated_at').defaultTo(knex.fn.now());
        });
    }

    // ── Invoice Items ──
    const hasItems = await knex.schema.hasTable('proforma_invoice_items');
    if (!hasItems) {
        await knex.schema.createTable('proforma_invoice_items', (t) => {
            t.increments('id');
            t.integer('invoice_id').notNullable();
            t.string('model');
            t.string('item_description');
            t.decimal('harga', 15, 2).defaultTo(0);
            t.integer('qty').defaultTo(1);
            t.decimal('subtotal', 15, 2).defaultTo(0);
            t.timestamp('created_at').defaultTo(knex.fn.now());
        });
    }

    // ── Proforma Requests (approval flow) ──
    const hasProforma = await knex.schema.hasTable('proforma_requests');
    if (!hasProforma) {
        await knex.schema.createTable('proforma_requests', (t) => {
            t.increments('id');
            t.string('proforma_no').unique();
            t.text('invoice_ids'); // JSON array
            t.decimal('total_nominal', 15, 2).defaultTo(0);
            t.string('status', 20).defaultTo('pending'); // pending / approved / rejected
            t.text('attachments'); // JSON array of docs
            t.string('requested_by');
            t.timestamp('requested_at').defaultTo(knex.fn.now());
            t.string('approved_by');
            t.timestamp('approved_at');
            t.string('settled_by');
            t.timestamp('settled_at');
            t.string('notes');
        });
    }
}

export async function down(knex) {
    await knex.schema.dropTableIfExists('proforma_requests');
    await knex.schema.dropTableIfExists('proforma_invoice_items');
    await knex.schema.dropTableIfExists('proforma_invoices');
    await knex.schema.dropTableIfExists('invoice_barang');
    await knex.schema.dropTableIfExists('invoice_dealers');
}
