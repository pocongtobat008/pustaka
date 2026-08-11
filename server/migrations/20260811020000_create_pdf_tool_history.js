// Riwayat hasil AI PDF Tools (convert/compress/merge/split/unlock).
// Setiap kali user memproses file, hasilnya disimpan di disk + metadata di sini
// sehingga bisa diunduh ulang kapan saja tanpa memproses ulang.
export async function up(knex) {
    if (!(await knex.schema.hasTable('pdf_tool_history'))) {
        await knex.schema.createTable('pdf_tool_history', (table) => {
            table.increments('id').primary();
            table.string('tool', 30).notNullable().index();     // convert | compress | merge | split | unlock
            table.string('title', 255).notNullable();           // nama file hasil
            table.string('file_path', 500).notNullable();       // nama file di folder export
            table.string('file_name', 255);                     // nama file untuk diunduh
            table.bigInteger('file_size').defaultTo(0);
            table.bigInteger('original_size').defaultTo(0);     // ukuran sumber (untuk % kompresi)
            table.string('created_by', 100);
            table.timestamp('created_at').defaultTo(knex.fn.now());
        });
    }
}

export async function down(knex) {
    await knex.schema.dropTableIfExists('pdf_tool_history');
}
