// Berbagi lintas departemen untuk dokumen AI (AI PDF Tools, AnyDoc, AI Document Intelligence).
// Kolom shared_departments menyimpan array JSON nama departemen yang boleh mengakses
// dokumen milik user lain. Pembuat (atau admin) bisa mengatur siapa yang boleh melihat.
export async function up(knex) {
    const tables = ['pdf_extractions', 'pdf_exports', 'pdf_tool_history'];
    for (const t of tables) {
        const has = await knex.schema.hasColumn(t, 'shared_departments');
        if (!has) {
            await knex.schema.alterTable(t, (table) => {
                table.text('shared_departments').nullable(); // JSON array: ["Tax","Accounting"]
            });
            console.log(`  ✅ Added shared_departments to ${t}`);
        } else {
            console.log(`  ⏭️  shared_departments already exists in ${t}`);
        }
    }
}

export async function down(knex) {
    const tables = ['pdf_extractions', 'pdf_exports', 'pdf_tool_history'];
    for (const t of tables) {
        try {
            await knex.schema.alterTable(t, (table) => table.dropColumn('shared_departments'));
        } catch (e) { /* best-effort */ }
    }
}
