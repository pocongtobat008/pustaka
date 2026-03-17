/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function (knex) {
  const hasTable = await knex.schema.hasTable('job_due_dates');
  if (!hasTable) return;

  const hasCompletedMonths = await knex.schema.hasColumn('job_due_dates', 'completed_months');
  if (!hasCompletedMonths) {
    await knex.schema.alterTable('job_due_dates', (table) => {
      table.text('completed_months').nullable();
    });
  }
};

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function (knex) {
  const hasTable = await knex.schema.hasTable('job_due_dates');
  if (!hasTable) return;

  const hasCompletedMonths = await knex.schema.hasColumn('job_due_dates', 'completed_months');
  if (hasCompletedMonths) {
    await knex.schema.alterTable('job_due_dates', (table) => {
      table.dropColumn('completed_months');
    });
  }
};
