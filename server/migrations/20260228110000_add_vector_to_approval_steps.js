
export const up = async (knex) => {
    // Helper function to safely add columns
    const addColumnIfNotExists = async (tableName, columnName, callback) => {
        const hasTable = await knex.schema.hasTable(tableName);
        if (hasTable) {
            const hasColumn = await knex.schema.hasColumn(tableName, columnName);
            if (!hasColumn) {
                await knex.schema.alterTable(tableName, callback);
                console.log(`  ✅ Column ${columnName} added to ${tableName}`);
            } else {
                console.log(`  ⏭️  Column ${columnName} already exists in ${tableName}`);
            }
        }
    };

    console.log('[MIGRATION] add_vector_to_approval_steps UP');

    await addColumnIfNotExists('approval_steps', 'vector', (table) => {
        table.text('vector', 'longtext');
    });

    await addColumnIfNotExists('approval_steps', 'instruction', (table) => {
        table.text('instruction').nullable();
    });
};

export const down = async (knex) => {
    const hasTable = await knex.schema.hasTable('approval_steps');
    if (hasTable) {
        const hasVector = await knex.schema.hasColumn('approval_steps', 'vector');
        const hasInstruction = await knex.schema.hasColumn('approval_steps', 'instruction');

        await knex.schema.alterTable('approval_steps', (table) => {
            if (hasVector) table.dropColumn('vector');
            if (hasInstruction) table.dropColumn('instruction');
        });
    }
};
