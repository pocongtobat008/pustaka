export const up = async (knex) => {
    const hasCol = await knex.schema.hasColumn('entertainment_rules', 'export_all');
    if (!hasCol) {
        await knex.schema.alterTable('entertainment_rules', (table) => {
            table.boolean('export_all').defaultTo(false);
        });
    }
};

export const down = async (knex) => {
    await knex.schema.alterTable('entertainment_rules', (table) => {
        table.dropColumn('export_all');
    });
};
