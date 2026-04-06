export const up = function(knex) {
  return knex.schema.alterTable('master_tax_objects', function(table) {
    // Mengubah tipe kolom menjadi text agar dapat menampung string yang sangat panjang
    table.text('name').alter();
    table.text('note').alter();
  });
};

export const down = function(knex) {
  return knex.schema.alterTable('master_tax_objects', function(table) {
    table.string('name', 255).alter();
    table.string('note', 255).alter();
  });
};