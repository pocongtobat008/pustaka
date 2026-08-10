// Migrasi pelengkap: memastikan tabel pdf_mapping_* ada (untuk DB yang sudah
// menjalankan versi awal 20260809000000 yang memakai nama berbeda) + bersihkan
// tabel sisa pdf_template_fields.
export async function up(knex) {
    await knex.schema.dropTableIfExists('pdf_template_fields');

    if (!(await knex.schema.hasTable('pdf_mapping_templates'))) {
        await knex.schema.createTable('pdf_mapping_templates', (table) => {
            table.increments('id');
            table.string('name').notNullable();
            table.string('doc_type');
            table.text('description');
            table.text('sample_files');
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
            table.string('group').defaultTo('header');
            table.string('group_key');
            table.string('field_key').notNullable();
            table.string('field_label').notNullable();
            table.string('match_type').defaultTo('label_same_line');
            table.text('pattern');
            table.float('col_x');
            table.integer('sort_order').defaultTo(0);
            table.boolean('required').defaultTo(false);
        });
    }
}

export async function down(knex) {
    await knex.schema.dropTableIfExists('pdf_mapping_fields');
    await knex.schema.dropTableIfExists('pdf_mapping_templates');
}
