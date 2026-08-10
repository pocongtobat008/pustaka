// Menambah konfigurasi segmentasi dokumen untuk ekstraksi PDF bulk:
//   split_pattern — label/pola yang menandai AWAL setiap dokumen dalam satu PDF
//                   (mis. "NOMOR" pada nota retur → setiap nomor = satu dokumen).
//   split_key     — (opsional) field_key yang nilainya dijadikan identitas dokumen
//                   (jika kosong, nilai di baris label dipakai langsung).
// Dengan ini satu PDF berisi BANYAK dokumen (bulk) dan satu dokumen yang
// bersambung ke beberapa halaman (nomor sama) bisa diekstrak terpisah & benar.
export async function up(knex) {
    if (!(await knex.schema.hasColumn('pdf_mapping_templates', 'split_pattern'))) {
        await knex.schema.alterTable('pdf_mapping_templates', (table) => {
            table.text('split_pattern');
            table.string('split_key');
        });
    }
}

export async function down(knex) {
    await knex.schema.alterTable('pdf_mapping_templates', (table) => {
        table.dropColumn('split_pattern');
        table.dropColumn('split_key');
    });
}
