export const up = async function (knex) {
    const taxObjectsColumns = [
        { name: 'is_pph21_bukan_pegawai', type: 'boolean', default: false },
        { name: 'name', type: 'string' },
        { name: 'id_type', type: 'string' },
        { name: 'identity_number', type: 'string' },
        { name: 'email', type: 'string' },
        { name: 'markup_mode', type: 'string', default: 'none' },
        { name: 'use_ppn', type: 'boolean', default: true },
        { name: 'dpp', type: 'decimal', precision: [15, 2], default: 0 },
        { name: 'discount', type: 'decimal', precision: [15, 2], default: 0 },
        { name: 'dpp_net', type: 'decimal', precision: [15, 2], default: 0 },
        { name: 'pph', type: 'decimal', precision: [15, 2], default: 0 },
        { name: 'ppn', type: 'decimal', precision: [15, 2], default: 0 },
        { name: 'total_payable', type: 'decimal', precision: [15, 2], default: 0 }
    ];

    const taxWpColumns = [
        { name: 'tax_type', type: 'string' },
        { name: 'tax_object_code', type: 'string' },
        { name: 'tax_object_name', type: 'string' },
        { name: 'markup_mode', type: 'string', default: 'none' },
        { name: 'use_ppn', type: 'boolean', default: true },
        { name: 'is_pph21_bukan_pegawai', type: 'boolean', default: false },
        { name: 'dpp', type: 'decimal', precision: [15, 2], default: 0 },
        { name: 'discount', type: 'decimal', precision: [15, 2], default: 0 },
        { name: 'dpp_net', type: 'decimal', precision: [15, 2], default: 0 },
        { name: 'pph', type: 'decimal', precision: [15, 2], default: 0 },
        { name: 'ppn', type: 'decimal', precision: [15, 2], default: 0 },
        { name: 'total_payable', type: 'decimal', precision: [15, 2], default: 0 }
    ];

    // Helper function to safely add columns individually
    const addMissingColumns = async (tableName, columns) => {
        const hasTable = await knex.schema.hasTable(tableName);
        if (!hasTable) return;

        for (const col of columns) {
            const hasCol = await knex.schema.hasColumn(tableName, col.name);
            if (!hasCol) {
                await knex.schema.alterTable(tableName, table => {
                    let colBuilder;
                    if (col.type === 'boolean') colBuilder = table.boolean(col.name);
                    else if (col.type === 'string') colBuilder = table.string(col.name);
                    else if (col.type === 'decimal') colBuilder = table.decimal(col.name, ...col.precision);

                    if (col.default !== undefined) colBuilder.defaultTo(col.default);
                    else colBuilder.nullable();
                });
                console.log(`[Migration] Added missing column ${tableName}.${col.name}`);
            }
        }
    };

    await addMissingColumns('tax_objects', taxObjectsColumns);
    await addMissingColumns('tax_wp', taxWpColumns);

    // Safely add unique identity_number to tax_wp
    const hasTaxWp = await knex.schema.hasTable('tax_wp');
    if (hasTaxWp) {
        try {
            if (knex.client.config.client === 'mysql2') {
                const [indexes] = await knex.raw("SHOW INDEX FROM tax_wp WHERE Column_name = 'identity_number'");
                const isUnique = indexes.some(idx => idx.Non_unique === 0);
                if (isUnique) return;
            } else if (knex.client.config.client === 'pg') {
                const hasIndex = await knex.raw(`SELECT 1 FROM pg_indexes WHERE tablename = ? AND indexname = ?`, ['tax_wp', 'tax_wp_identity_number_unique']);
                if (hasIndex.rows && hasIndex.rows.length > 0) return;
            }

            await knex.schema.alterTable('tax_wp', table => {
                table.unique('identity_number');
            });
            console.log(`[Migration] Added unique constraint to tax_wp.identity_number`);
        } catch (e) {
            if (e.message.includes('already exists') || e.code === '23505' || e.code === '42P07') {
                console.log(`[Migration] Unique constraint already exists on tax_wp.identity_number`);
            } else {
                console.warn(`[Migration] Failed to add unique constraint to tax_wp.identity_number: ${e.message}`);
            }
        }
    }
};

export const down = async function (knex) {
    // This is a self-healing patch migration. Dropping these columns
    // broadly might destroy legacy data. An empty down() is safer.
    return Promise.resolve();
};
