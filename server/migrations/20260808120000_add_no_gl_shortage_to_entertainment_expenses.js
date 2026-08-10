export async function up(knex) {
    const has = await knex.schema.hasTable('entertainment_expenses');
    if (has) {
        const cols = await knex('entertainment_expenses').columnInfo();
        if (!cols.no_gl_shortage) {
            await knex.schema.alterTable('entertainment_expenses', (t) => {
                t.string('no_gl_shortage');
            });
        }
    }
}

export async function down(knex) {
    const has = await knex.schema.hasTable('entertainment_expenses');
    if (has) {
        const cols = await knex('entertainment_expenses').columnInfo();
        if (cols.no_gl_shortage) {
            await knex.schema.alterTable('entertainment_expenses', (t) => {
                t.dropColumn('no_gl_shortage');
            });
        }
    }
}
