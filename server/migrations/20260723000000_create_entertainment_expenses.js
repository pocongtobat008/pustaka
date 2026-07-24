/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function (knex) {
    const hasTable = await knex.schema.hasTable('entertainment_expenses');
    if (hasTable) {
        console.log('⏭️  Table entertainment_expenses already exists, ensuring columns...');
        const cols = {
            tanggal: (t) => t.date('tanggal').nullable(),
            tempat: (t) => t.string('tempat').nullable(),
            alamat: (t) => t.text('alamat').nullable(),
            jenis: (t) => t.string('jenis').nullable(),
            custom_jenis: (t) => t.string('custom_jenis').nullable(),
            nilai: (t) => t.decimal('nilai', 15, 2).nullable(),
            no_gl: (t) => t.string('no_gl').nullable(),
            relasi: (t) => t.jsonb('relasi').nullable().defaultTo('[]'),
            jumlah_relasi: (t) => t.integer('jumlah_relasi').nullable().defaultTo(0),
            nama_perusahaan: (t) => t.jsonb('nama_perusahaan').nullable().defaultTo('[]'),
            jenis_usaha: (t) => t.string('jenis_usaha').nullable(),
            catatan_kode: (t) => t.text('catatan_kode').nullable(),
            attachments: (t) => t.jsonb('attachments').nullable().defaultTo('[]'),
            privacy_type: (t) => t.string('privacy_type').nullable().defaultTo('public'),
            allowed_departments: (t) => t.jsonb('allowed_departments').nullable().defaultTo('[]'),
            allowed_users: (t) => t.jsonb('allowed_users').nullable().defaultTo('[]'),
            owner: (t) => t.string('owner').nullable(),
            requester_name: (t) => t.string('requester_name').nullable(),
            requester_username: (t) => t.string('requester_username').nullable(),
            status: (t) => t.string('status').nullable().defaultTo('active'),
            created_at: (t) => t.timestamp('created_at').defaultTo(knex.fn.now()),
            updated_at: (t) => t.timestamp('updated_at').defaultTo(knex.fn.now()),
        };
        for (const [col, builder] of Object.entries(cols)) {
            if (!(await knex.schema.hasColumn('entertainment_expenses', col))) {
                await knex.schema.alterTable('entertainment_expenses', (table) => builder(table));
                console.log(`  ✅ Added missing column ${col}`);
            }
        }
        return;
    }

    await knex.schema.createTable('entertainment_expenses', (table) => {
        table.increments('id').primary();
        table.date('tanggal').notNullable();
        table.string('tempat').notNullable();
        table.text('alamat').notNullable();
        table.string('jenis').notNullable();
        table.string('custom_jenis').nullable();
        table.decimal('nilai', 15, 2).notNullable();
        table.string('no_gl').notNullable();
        table.jsonb('relasi').notNullable().defaultTo('[]');
        table.integer('jumlah_relasi').notNullable().defaultTo(0);
        table.jsonb('nama_perusahaan').nullable().defaultTo('[]');
        table.string('jenis_usaha').nullable();
        table.text('catatan_kode').notNullable();
        table.jsonb('attachments').nullable().defaultTo('[]');
        table.string('privacy_type').notNullable().defaultTo('public');
        table.jsonb('allowed_departments').nullable().defaultTo('[]');
        table.jsonb('allowed_users').nullable().defaultTo('[]');
        table.string('owner').nullable();
        table.string('requester_name').nullable();
        table.string('requester_username').nullable();
        table.string('status').notNullable().defaultTo('active');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });

    console.log('[Migration] Created entertainment_expenses table');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function (knex) {
    const hasTable = await knex.schema.hasTable('entertainment_expenses');
    if (hasTable) {
        await knex.schema.dropTable('entertainment_expenses');
        console.log('[Migration] Dropped entertainment_expenses table');
    }
};
