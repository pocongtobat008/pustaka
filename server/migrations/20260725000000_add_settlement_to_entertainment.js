export const up = async function (knex) {
    const hasTable = await knex.schema.hasTable('entertainment_expenses');
    if (!hasTable) {
        console.log('⏭️  Table entertainment_expenses does not exist, skipping');
        return;
    }

    if (!(await knex.schema.hasColumn('entertainment_expenses', 'settled_at'))) {
        await knex.schema.alterTable('entertainment_expenses', (table) => {
            table.timestamp('settled_at').nullable();
        });
        console.log('✅ Added column settled_at to entertainment_expenses');
    }

    if (!(await knex.schema.hasColumn('entertainment_expenses', 'settled_by'))) {
        await knex.schema.alterTable('entertainment_expenses', (table) => {
            table.string('settled_by').nullable();
        });
        console.log('✅ Added column settled_by to entertainment_expenses');
    }
};

export const down = async function (knex) {
    const hasTable = await knex.schema.hasTable('entertainment_expenses');
    if (!hasTable) return;

    if (await knex.schema.hasColumn('entertainment_expenses', 'settled_at')) {
        await knex.schema.alterTable('entertainment_expenses', (table) => {
            table.dropColumn('settled_at');
        });
    }
    if (await knex.schema.hasColumn('entertainment_expenses', 'settled_by')) {
        await knex.schema.alterTable('entertainment_expenses', (table) => {
            table.dropColumn('settled_by');
        });
    }
};
