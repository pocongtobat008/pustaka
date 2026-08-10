// Monitoring hasil ekstraksi PDF per bulan.
// Tiap kali template mengekstrak sebuah file, satu baris disimpan dengan metrik
// (jumlah dokumen, total baris, confidence rata-rata, field ditemukan, status layout)
// untuk memantau kualitas lintas bulan & mendeteksi perubahan layout dokumen.
export async function up(knex) {
    if (!(await knex.schema.hasTable('pdf_extractions'))) {
        await knex.schema.createTable('pdf_extractions', (table) => {
            table.increments('id').primary();
            table.integer('template_id').notNullable().index();
            table.string('filename', 255);
            table.string('period', 7).index(); // 'YYYY-MM' — periode dokumen (dari nomor/bulan)
            table.integer('pages').defaultTo(0);
            table.integer('doc_count').defaultTo(0);
            table.integer('total_rows').defaultTo(0);
            table.float('avg_confidence').defaultTo(0);
            table.integer('fields_found').defaultTo(0);
            table.integer('fields_total').defaultTo(0);
            table.boolean('table_found').defaultTo(false);
            table.boolean('layout_changed').defaultTo(false);
            table.text('warning');
            table.string('created_by', 100);
            table.timestamp('created_at').defaultTo(knex.fn.now());
        });
    }
}

export async function down(knex) {
    await knex.schema.dropTableIfExists('pdf_extractions');
}
