/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    const hasEmail = await knex.schema.hasColumn('users', 'email');
    if (!hasEmail) {
        await knex.schema.alterTable('users', table => {
            table.string('email').nullable();
        });
    }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    const hasEmail = await knex.schema.hasColumn('users', 'email');
    if (hasEmail) {
        await knex.schema.alterTable('users', table => {
            table.dropColumn('email');
        });
    }
}
