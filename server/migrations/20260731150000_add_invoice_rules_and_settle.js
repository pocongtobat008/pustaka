export async function up(knex) {
    const hasRules = await knex.schema.hasTable('invoice_rules');
    if (!hasRules) {
        await knex.schema.createTable('invoice_rules', (t) => {
            t.increments('id');
            t.string('target_type', 10).notNullable(); // user / role / division
            t.string('target_value').notNullable();
            t.boolean('can_create').defaultTo(true);
            t.boolean('can_approve').defaultTo(false);
            t.boolean('can_tax').defaultTo(false);
            t.boolean('can_manage_master').defaultTo(false);
            t.boolean('can_settle').defaultTo(false);
            t.boolean('is_active').defaultTo(true);
            t.timestamps(true, true);
        });
    }

    const hasSettleAmount = await knex.schema.hasColumn('proforma_requests', 'settled_amount');
    if (!hasSettleAmount) {
        await knex.schema.alterTable('proforma_requests', (t) => {
            t.decimal('settled_amount', 15, 2).defaultTo(0);
        });
    }
}

export async function down(knex) {
    await knex.schema.dropTableIfExists('invoice_rules');
}
