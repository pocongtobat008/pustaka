// Soft delete untuk invoice & proforma: data tidak dihapus permanen, melainkan
// ditandai deleted_at/deleted_by agar bisa dipulihkan (restore) oleh admin.
export async function up(knex) {
    for (const t of ['proforma_invoices', 'proforma_requests']) {
        const hasAt = await knex.schema.hasColumn(t, 'deleted_at');
        const hasBy = await knex.schema.hasColumn(t, 'deleted_by');
        if (!hasAt || !hasBy) {
            await knex.schema.alterTable(t, (table) => {
                if (!hasAt) table.timestamp('deleted_at').nullable();
                if (!hasBy) table.string('deleted_by').nullable();
            });
            console.log(`  ✅ Added soft-delete columns to ${t}`);
        } else {
            console.log(`  ⏭️  Soft-delete columns already exist in ${t}`);
        }
    }
}

export async function down(knex) {
    for (const t of ['proforma_invoices', 'proforma_requests']) {
        try {
            await knex.schema.alterTable(t, (table) => {
                table.dropColumn('deleted_at');
                table.dropColumn('deleted_by');
            });
        } catch (e) { /* best-effort */ }
    }
}
