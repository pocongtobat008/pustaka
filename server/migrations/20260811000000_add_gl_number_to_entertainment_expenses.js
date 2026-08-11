/** @param { import("knex").Knex } knex */
export const up = async function (knex) {
    if (!(await knex.schema.hasColumn('entertainment_expenses', 'gl_number'))) {
        await knex.schema.alterTable('entertainment_expenses', (table) => {
            table.string('gl_number').nullable();
        });
        console.log('  ✅ Added column gl_number to entertainment_expenses');
    }
};

/** @param { import("knex").Knex } knex */
export const down = async function (knex) {
    if (await knex.schema.hasColumn('entertainment_expenses', 'gl_number')) {
        await knex.schema.alterTable('entertainment_expenses', (table) => {
            table.dropColumn('gl_number');
        });
    }
};