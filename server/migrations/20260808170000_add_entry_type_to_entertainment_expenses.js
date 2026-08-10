/** @param { import("knex").Knex } knex */
export const up = async function (knex) {
    if (!(await knex.schema.hasColumn('entertainment_expenses', 'entry_type'))) {
        await knex.schema.alterTable('entertainment_expenses', (table) => {
            table.string('entry_type').notNullable().defaultTo('plan');
        });
        console.log('  ✅ Added column entry_type to entertainment_expenses');
    }
};

/** @param { import("knex").Knex } knex */
export const down = async function (knex) {
    if (await knex.schema.hasColumn('entertainment_expenses', 'entry_type')) {
        await knex.schema.alterTable('entertainment_expenses', (table) => {
            table.dropColumn('entry_type');
        });
    }
};
