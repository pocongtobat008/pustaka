export const up = async (knex) => {
    const hasTable = await knex.schema.hasTable('entertainment_expenses');
    if (!hasTable) {
        console.log('⏭️  Table entertainment_expenses does not exist, skipping');
        return;
    }

    if (!(await knex.schema.hasColumn('entertainment_expenses', 'jenis_usaha'))) {
        await knex.schema.alterTable('entertainment_expenses', (table) => {
            table.string('jenis_usaha').nullable();
        });
        console.log('✅ Added column jenis_usaha to entertainment_expenses');
    } else {
        console.log('⏭️  Column jenis_usaha already exists');
    }

    if (!(await knex.schema.hasColumn('entertainment_expenses', 'nama_perusahaan'))) {
        await knex.schema.alterTable('entertainment_expenses', (table) => {
            table.jsonb('nama_perusahaan').nullable().defaultTo('[]');
        });
        console.log('✅ Added column nama_perusahaan to entertainment_expenses');
    } else {
        console.log('⏭️  Column nama_perusahaan already exists');
    }
};

export const down = async (knex) => {
    const hasTable = await knex.schema.hasTable('entertainment_expenses');
    if (hasTable) {
        await knex.schema.alterTable('entertainment_expenses', (table) => {
            table.dropColumn('jenis_usaha');
            table.dropColumn('nama_perusahaan');
        });
        console.log('✅ Dropped columns jenis_usaha and nama_perusahaan from entertainment_expenses');
    }
};
