export const up = async (knex) => {
    if (await knex.schema.hasTable('users')) {
        const hasTokenExpiry = await knex.schema.hasColumn('users', 'token_expires_at');
        if (!hasTokenExpiry) {
            await knex.schema.alterTable('users', (table) => {
                table.dateTime('token_expires_at').nullable();
            });
        }
    }
};

export const down = async (knex) => {
    if (await knex.schema.hasTable('users')) {
        const hasTokenExpiry = await knex.schema.hasColumn('users', 'token_expires_at');
        if (hasTokenExpiry) {
            await knex.schema.alterTable('users', (table) => {
                table.dropColumn('token_expires_at');
            });
        }
    }
};
