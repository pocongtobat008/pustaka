export async function up(knex) {
    const hasEmail = await knex.schema.hasColumn('users', 'email');
    if (!hasEmail) {
        await knex.schema.alterTable('users', (t) => {
            t.string('email').nullable();
        });
    }
}

export async function down(knex) {
    const hasEmail = await knex.schema.hasColumn('users', 'email');
    if (hasEmail) {
        await knex.schema.alterTable('users', (t) => {
            t.dropColumn('email');
        });
    }
}
