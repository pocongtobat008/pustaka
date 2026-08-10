// Arsip Dokumen: simpan file PDF asli hasil ekstraksi agar bisa diunduh / diekstrak ulang
// tanpa upload ulang. Kolom file_path menunjuk ke nama file di uploads/anydoc-archive/,
// file_size menyimpan ukuran file asli.
export async function up(knex) {
    if (!(await knex.schema.hasTable('pdf_extractions'))) return;
    const hasPath = await knex.schema.hasColumn('pdf_extractions', 'file_path');
    const hasSize = await knex.schema.hasColumn('pdf_extractions', 'file_size');
    if (!hasPath || !hasSize) {
        await knex.schema.alterTable('pdf_extractions', (table) => {
            if (!hasPath) table.text('file_path');
            if (!hasSize) table.bigInteger('file_size');
        });
    }
}

export async function down(knex) {
    if (!(await knex.schema.hasTable('pdf_extractions'))) return;
    await knex.schema.alterTable('pdf_extractions', (table) => {
        table.dropColumn('file_path');
        table.dropColumn('file_size');
    });
}
