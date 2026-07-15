/**
 * Create COA (Chart of Accounts) tables for Book module.
 * Hierarchical: coa_accounts → coa_sub_accounts → coa_departments
 */
export async function up(knex) {
    // COA Induk (e.g., 1xxx = Aktiva, 2xxx = Pasiva)
    if (!(await knex.schema.hasTable('coa_accounts'))) {
        await knex.schema.createTable('coa_accounts', (table) => {
            table.increments('id').primary();
            table.string('code', 50).notNullable().unique();
            table.string('name', 255).notNullable();
            table.text('description').nullable();
            table.boolean('is_active').defaultTo(true);
            table.timestamps(true, true);
        });
    }

    // Sub COA (e.g., 1-1 = Kas, 1-2 = Bank)
    if (!(await knex.schema.hasTable('coa_sub_accounts'))) {
        await knex.schema.createTable('coa_sub_accounts', (table) => {
            table.increments('id').primary();
            table.integer('account_id').unsigned().references('id').inTable('coa_accounts').onDelete('CASCADE');
            table.string('code', 50).notNullable();
            table.string('name', 255).notNullable();
            table.text('description').nullable();
            table.boolean('is_active').defaultTo(true);
            table.timestamps(true, true);
            table.unique(['account_id', 'code']);
        });
    }

    // Departemen / No Dep (e.g., 1-1-01 = Kas Kecil)
    if (!(await knex.schema.hasTable('coa_departments'))) {
        await knex.schema.createTable('coa_departments', (table) => {
            table.increments('id').primary();
            table.integer('sub_account_id').unsigned().references('id').inTable('coa_sub_accounts').onDelete('CASCADE');
            table.string('code', 50).notNullable();
            table.string('name', 255).notNullable();
            table.text('description').nullable();
            table.boolean('is_active').defaultTo(true);
            table.timestamps(true, true);
            table.unique(['sub_account_id', 'code']);
        });
    }
}

export async function down(knex) {
    await knex.schema.dropTableIfExists('coa_departments');
    await knex.schema.dropTableIfExists('coa_sub_accounts');
    await knex.schema.dropTableIfExists('coa_accounts');
}
