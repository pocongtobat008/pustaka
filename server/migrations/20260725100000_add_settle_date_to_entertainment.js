export const up = async function (knex) {
    const hasTable = await knex.schema.hasTable('entertainment_expenses');
    if (!hasTable) {
        console.log('⏭️  Table entertainment_expenses does not exist, skipping');
        return;
    }

    if (!(await knex.schema.hasColumn('entertainment_expenses', 'settle_date'))) {
        await knex.schema.alterTable('entertainment_expenses', (table) => {
            table.date('settle_date').nullable();
        });
        console.log('✅ Added column settle_date to entertainment_expenses');
    }
};

export const down = async function (knex) {
    const hasTable = await knex.schema.hasTable('entertainment_expenses');
    if (!hasTable) return;

    if (await knex.schema.hasColumn('entertainment_expenses', 'settle_date')) {
        await knex.schema.alterTable('entertainment_expenses', (table) => {
            table.dropColumn('settle_date');
        });
    }
};
