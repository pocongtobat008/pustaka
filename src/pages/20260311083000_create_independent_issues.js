/**
 * Migration for independent_issues table
 * Supports Fresh Install and Synchronization for existing setups.
 */
export async function up(knex) {
  const exists = await knex.schema.hasTable('independent_issues');
  if (!exists) {
    // Fresh install: Create the entire table with all required columns
    return knex.schema.createTable('independent_issues', function(table) {
      table.increments('id').primary();
      table.text('note').notNullable();
      table.text('detail');
      table.string('status').defaultTo('pending');
      table.integer('progress').defaultTo(0);
      table.text('assigned_to'); // TEXT allows storing JSON lists of recipients
      table.string('owner', 255).defaultTo('system'); // Column for the submitter
      table.text('history');
      table.integer('taskId').unsigned().nullable();
      table.timestamps(true, true);
    });
  } else {
    // Existing install: Synchronize missing columns to fix "Column count doesn't match"
    const hasColumn = await knex.schema.hasColumn('independent_issues', 'owner');
    return knex.schema.alterTable('independent_issues', function(table) {
      if (!hasColumn) {
        table.string('owner', 255).defaultTo('system').after('assigned_to');
      }
      table.text('assigned_to').nullable().alter();
    });
  }
}

export async function down(knex) {
  return knex.schema.dropTableIfExists('independent_issues');
}