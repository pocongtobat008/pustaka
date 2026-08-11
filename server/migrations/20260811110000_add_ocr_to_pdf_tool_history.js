// Perluas riwayat AI PDF Tools agar hasil OCR Teks juga bisa disimpan:
// teks hasil ekstraksi + bahasa yang dipakai/terdeteksi + orientasi halaman.
export async function up(knex) {
    const has = await knex.schema.hasTable('pdf_tool_history');
    if (!has) return;
    const cols = await knex('pdf_tool_history').columnInfo();
    if (!cols.language) await knex.schema.alterTable('pdf_tool_history', (t) => t.string('language', 30));
    if (!cols.language_name) await knex.schema.alterTable('pdf_tool_history', (t) => t.string('language_name', 100));
    if (!cols.text_content) await knex.schema.alterTable('pdf_tool_history', (t) => t.text('text_content'));
    if (!cols.orientation) await knex.schema.alterTable('pdf_tool_history', (t) => t.string('orientation', 20));
}

export async function down(knex) {
    const cols = await knex('pdf_tool_history').columnInfo();
    if (cols.language) await knex.schema.alterTable('pdf_tool_history', (t) => t.dropColumn('language'));
    if (cols.language_name) await knex.schema.alterTable('pdf_tool_history', (t) => t.dropColumn('language_name'));
    if (cols.text_content) await knex.schema.alterTable('pdf_tool_history', (t) => t.dropColumn('text_content'));
    if (cols.orientation) await knex.schema.alterTable('pdf_tool_history', (t) => t.dropColumn('orientation'));
}
