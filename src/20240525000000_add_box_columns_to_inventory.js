/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = function(knex) {
  return knex.schema.alterTable('inventory', table => {
    table.string('box_id').nullable().after('status');
    table.text('box_data', 'longtext').nullable().after('box_id');
  });
};

export const down = function(knex) {
  return knex.schema.alterTable('inventory', table => {
    table.dropColumn('box_id');
    table.dropColumn('box_data');
  });
};