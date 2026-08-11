// History Export Excel dari ekstraksi PDF (AnyDoc).
// Setiap kali user meng-export Excel dari hasil ekstraksi, file .xlsx disimpan
// di disk dan metadata-nya dicatat di sini, sehingga bisa diunduh ulang
// kapan saja tanpa perlu extract ulang.
export async function up(knex) {
    if (!(await knex.schema.hasTable('pdf_exports'))) {
        await knex.schema.createTable('pdf_exports', (table) => {
            table.increments('id').primary();
            table.integer('template_id').nullable().index();
            table.string('title', 255);
            table.string('file_path', 500).notNullable();   // nama file .xlsx di folder export
            table.string('file_name', 255);                  // nama file untuk diunduh
            table.bigInteger('file_size').defaultTo(0);
            table.integer('doc_count').defaultTo(0);
            table.integer('total_rows').defaultTo(0);
            table.integer('file_count').defaultTo(0);        // jumlah file sumber yang diekstrak
            table.string('created_by', 100);
            table.timestamp('created_at').defaultTo(knex.fn.now());
        });
    }
}

export async function down(knex) {
    await knex.schema.dropTableIfExists('pdf_exports');
}
