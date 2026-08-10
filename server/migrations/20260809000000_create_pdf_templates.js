// Template Mapping PDF (sampel → mapping → ekstrak PDF asli).
// Dipisah dari tabel pdf_templates milik PDF Designer (render) agar tidak bentrok.
export async function up(knex) {
    // Bersihkan tabel sisa dari versi migrasi sebelumnya (kalau ada)
    await knex.schema.dropTableIfExists('pdf_template_fields');

    if (!(await knex.schema.hasTable('pdf_mapping_templates'))) {
        await knex.schema.createTable('pdf_mapping_templates', (table) => {
            table.increments('id');
            table.string('name').notNullable();
            table.string('doc_type');
            table.text('description');
            table.text('sample_files'); // JSON: [{filename, path, size}]
            table.string('created_by');
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());
        });
    }

    if (!(await knex.schema.hasTable('pdf_mapping_fields'))) {
        await knex.schema.createTable('pdf_mapping_fields', (table) => {
            table.increments('id');
            table.integer('template_id')
                .references('id').inTable('pdf_mapping_templates')
                .onDelete('CASCADE')
                .index();
            table.string('group').defaultTo('header'); // 'header' | 'table'
            table.string('group_key');                 // nama tabel (mis. 'items'), null utk header
            table.string('field_key').notNullable();   // id field: no_invoice, model, qty...
            table.string('field_label').notNullable(); // tampilan: No. Invoice, Model...
            table.string('match_type').defaultTo('label_same_line'); // label_same_line | label_next_line | regex
            table.text('pattern');                     // label/regex; utk kolom tabel: teks header sel
            table.float('col_x');                      // posisi x kolom tabel (raw pdf), dipelajari dari sampel
            table.integer('sort_order').defaultTo(0);
            table.boolean('required').defaultTo(false);
        });
    }
}

export async function down(knex) {
    await knex.schema.dropTableIfExists('pdf_mapping_fields');
    await knex.schema.dropTableIfExists('pdf_mapping_templates');
}
