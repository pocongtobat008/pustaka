/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function (knex) {
    const hasTable = await knex.schema.hasTable('entertainment_expenses');
    if (!hasTable) return;

    if (!(await knex.schema.hasColumn('entertainment_expenses', 'jabatan'))) {
        await knex.schema.alterTable('entertainment_expenses', (table) => {
            table.jsonb('jabatan').nullable().defaultTo('[]');
        });
        console.log('✅ Added column jabatan to entertainment_expenses');
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function (knex) {
    const hasTable = await knex.schema.hasTable('entertainment_expenses');
    if (!hasTable) return;
    if (await knex.schema.hasColumn('entertainment_expenses', 'jabatan')) {
        await knex.schema.alterTable('entertainment_expenses', (table) => {
            table.dropColumn('jabatan');
        });
    }
};
