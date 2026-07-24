export const up = async (knex) => {
    const exists = await knex.schema.hasTable('entertainment_rules');
    if (!exists) {
        await knex.schema.createTable('entertainment_rules', (table) => {
            table.increments('id').primary();
            table.string('rule_name', 100).notNullable();
            table.enum('target_type', ['user', 'division', 'role']).notNullable();
            table.string('target_value', 100).notNullable();
            table.boolean('view_all').defaultTo(false);
            table.boolean('can_create').defaultTo(true);
            table.boolean('can_edit').defaultTo(true);
            table.boolean('can_delete').defaultTo(true);
            table.boolean('can_settle').defaultTo(true);
            table.boolean('can_export').defaultTo(true);
            table.boolean('is_active').defaultTo(true);
            table.timestamps(true, true);
        });
    }
};

export const down = async (knex) => {
    await knex.schema.dropTableIfExists('entertainment_rules');
};
