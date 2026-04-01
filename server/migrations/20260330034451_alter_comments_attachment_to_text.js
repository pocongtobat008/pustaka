export const up = async (knex) => {
    // Change attachment column from VARCHAR(255) to TEXT
    await knex.schema.alterTable('comments', (table) => {
        table.text('attachment').alter();
    });
};

export const down = async (knex) => {
    // Revert back to VARCHAR(255) if needed
    await knex.schema.alterTable('comments', (table) => {
        table.string('attachment', 255).alter();
    });
};