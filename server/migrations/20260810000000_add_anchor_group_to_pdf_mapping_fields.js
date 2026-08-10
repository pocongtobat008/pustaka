// Menambah kolom `anchor` (bagian/section dokumen, mis. "KEPADA PENJUAL") dan
// `is_group` (kolom grup tabel — nilai pada baris di ATAS baris data, mis. no faktur)
// untuk fitur ekstraksi template mapping (pdf_mapping_fields).
export async function up(knex) {
    if (await knex.schema.hasColumn('pdf_mapping_fields', 'anchor')) return;
    await knex.schema.alterTable('pdf_mapping_fields', (table) => {
        table.text('anchor');
        table.boolean('is_group').defaultTo(false);
    });
}

export async function down(knex) {
    await knex.schema.alterTable('pdf_mapping_fields', (table) => {
        table.dropColumn('is_group');
        table.dropColumn('anchor');
    });
}
