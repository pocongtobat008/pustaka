export async function up(knex) {
    const has = await knex.schema.hasColumn('entertainment_expenses', 'settle_amount');
    if (!has) {
        await knex.schema.alterTable('entertainment_expenses', (t) => {
            t.decimal('settle_amount', 15, 2).nullable();
        });
    }
}

export async function down(knex) {
    const has = await knex.schema.hasColumn('entertainment_expenses', 'settle_amount');
    if (has) {
        await knex.schema.alterTable('entertainment_expenses', (t) => {
            t.dropColumn('settle_amount');
        });
    }
}
