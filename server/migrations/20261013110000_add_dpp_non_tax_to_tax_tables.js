export const up = async function (knex) {
    for (const tableName of ['tax_objects', 'tax_wp']) {
        if (!(await knex.schema.hasTable(tableName))) continue;
        if (await knex.schema.hasColumn(tableName, 'dpp_non_tax')) continue;
        await knex.schema.alterTable(tableName, (table) => {
            table.decimal('dpp_non_tax', 15, 2).defaultTo(0);
        });
        console.log(`[Migration] Added missing column ${tableName}.dpp_non_tax`);
    }
};

export const down = async function (knex) {
    return Promise.resolve();
};
