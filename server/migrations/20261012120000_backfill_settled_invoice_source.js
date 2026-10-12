export async function up(knex) {
    // ⚠️ BACKFILL OPTSIONAL — DINONAKFALKAN DI PRODUKSI.
    // Endpoint Detail Settle (by-source/by-group) SUDAH menampilkan baris yatim
    // ini secara runtime lewat fetchOrphanSettledRows (berbasis proforma_no/id),
    // jadi perbaikan tampilan/balance TIDAK bergantung pada mutasi DB ini.
    // Backfill hanya menulis source_invoice_id agar baris ikut ter-track di
    // export Excel & listing. Karena itu dijaga di belakang flag env agar
    // produksi (yang melarang sentuh data invoice) dijamin zero-write; jalankan
    // manual dengan SETTLE_BACKFILL=1 bila suatu saat diperlukan.
    if (process.env.SETTLE_BACKFILL !== '1') {
        console.log('[migration] backfill_settled_invoice_source DILEWATI (Set SETTLE_BACKFILL=1 untuk menjalankan).');
        return;
    }

    // Baris settle tanpa invoice sumber (mis. baris "Tambah Invoice Asli" yang
    // diinput manual pada proforma non-PP) tersimpan di DB tetapi tidak pernah
    // tampil di Detail Settle, export Excel, maupun listing — semuanya mencari
    // lewat source_invoice_id. Akibatnya status balance di UI hanya menjumlah
    // sebagian baris dan selalu terlihat TIDAK BALANCE.
    //
    // Backfill: ikat baris yatim ke invoice proforma-nya, TAPI hanya bila
    // proforma itu punya tepat 1 invoice aktif (tidak ambigu). Kalau lebih dari
    // satu, pemiliknya tidak bisa ditentukan otomatis → dibiarkan, dan endpoint
    // detail tetap menampilkannya sebagai baris yatim proforma tersebut.
    const has = await knex.schema.hasTable('settled_invoices');
    if (!has) return;
    const hasNoCol = await knex.schema.hasColumn('settled_invoices', 'source_invoice_id');
    if (!hasNoCol) return;

    const orphans = await knex('settled_invoices')
        .whereNull('source_invoice_id')
        .whereNotNull('proforma_id');
    if (!orphans.length) return;

    for (const row of orphans) {
        const p = await knex('proforma_requests').where('id', row.proforma_id).first();
        if (!p) continue;
        let ids = [];
        try {
            const parsed = JSON.parse(p.invoice_ids || '[]');
            if (Array.isArray(parsed)) ids = parsed.map(Number).filter(v => Number.isFinite(v) && v > 0);
        } catch { ids = []; }
        if (!ids.length) continue;
        const invs = await knex('proforma_invoices')
            .whereIn('id', ids)
            .whereNot('status', 'cancelled')
            .orderBy('id', 'asc');
        if (invs.length !== 1) continue;
        await knex('settled_invoices')
            .where('id', row.id)
            .whereNull('source_invoice_id')
            .update({ source_invoice_id: Number(invs[0].id) });
        console.log(`[migration] settled_invoices #${row.id}: source_invoice_id → ${invs[0].id} (${row.no_invoice})`);
    }
}

export async function down() {
    // Backfill bersifat data-repair; tidak ada rollback yang aman (nilai lama = NULL
    // tidak bisa dibedakan lagi dari baris yang memang sudah punya sumber).
}
