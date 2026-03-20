// Helper: Prevent one table's failure from halting the entire migration
async function safeCreateTable(knex, tableName, builder) {
    try {
        if (!(await knex.schema.hasTable(tableName))) {
            await knex.schema.createTable(tableName, builder);
            console.log(`  ✅ Created table: ${tableName}`);
        } else {
            console.log(`  ⏭️  Table already exists: ${tableName}`);
        }
    } catch (err) {
        console.error(`  ❌ Failed to create table '${tableName}': ${err.message}`);
    }
}

// Helper: Add unique index defensively
async function safeAddUnique(knex, tableName, column) {
    try {
        if (knex.client.config.client === 'mysql2') {
            const [indexes] = await knex.raw('SHOW INDEX FROM ?? WHERE Column_name = ? AND Non_unique = 0', [tableName, column]);
            if (indexes && indexes.length > 0) {
                console.log(`  ⏭️  Unique index already exists on ${tableName}.${column}`);
                return;
            }
        } else if (knex.client.config.client === 'pg') {
            const hasIndex = await knex.raw(`
                SELECT 1 FROM pg_indexes 
                WHERE tablename = ? AND indexname = ?
            `, [tableName, `${tableName}_${column}_unique`]);

            if (hasIndex.rows && hasIndex.rows.length > 0) {
                console.log(`  ⏭️  Unique index already exists on ${tableName}.${column}`);
                return;
            }
        }

        await knex.schema.alterTable(tableName, (table) => {
            table.unique(column);
        });
        console.log(`  ✅ Added unique index to ${tableName}.${column}`);
    } catch (err) {
        if (err.message.includes('already exists') || err.message.includes('Duplicate field name') || err.code === '42P07') {
            console.log(`  ⏭️  Unique index already exists on ${tableName}.${column}`);
        } else {
            console.warn(`  ⚠️  Failed to add unique index to ${tableName}.${column}: ${err.message}`);
        }
    }
}

export const up = async (knex) => {
    console.log('[MIGRATION] initial_schema UP: Creating all tables...');

    await safeCreateTable(knex, 'users', (table) => {
        table.increments('id').primary();
        table.string('username');
        table.string('password');
        table.string('name');
        table.string('role', 50);
        table.string('department', 100);
    });
    await safeAddUnique(knex, 'users', 'username');

    await safeCreateTable(knex, 'departments', (table) => {
        table.increments('id').primary();
        table.string('name', 100);
    });
    await safeAddUnique(knex, 'departments', 'name');

    await safeCreateTable(knex, 'roles', (table) => {
        table.string('id', 50).primary();
        table.string('label');
        table.text('access');
    });

    await safeCreateTable(knex, 'inventory', (table) => {
        table.integer('id').primary();
        table.string('status', 50);
        table.dateTime('lastUpdated');
        table.text('box_data', 'longtext');
        table.text('history');
    });

    await safeCreateTable(knex, 'folders', (table) => {
        table.increments('id').primary();
        table.integer('parentId');
        table.string('name');
        table.string('privacy', 50);
        table.text('allowedDepts');
        table.text('allowedUsers');
        table.string('owner', 100);
        table.dateTime('createdAt').defaultTo(knex.fn.now());
    });

    await safeCreateTable(knex, 'documents', (table) => {
        table.string('id').primary();
        table.string('title');
        table.string('type', 50);
        table.string('size', 50);
        table.dateTime('uploadDate');
        table.text('url');
        table.string('folderId');
        table.string('department', 100);
        table.string('owner', 100);
        table.text('ocrContent', 'longtext');
        table.string('auditId');
        table.integer('stepIndex');
        table.text('fileData', 'longtext');
        table.text('versionsHistory', 'longtext');
        table.integer('version').defaultTo(1);
        table.string('status', 50).defaultTo('ready');
        table.text('vector', 'longtext');
    });

    await safeCreateTable(knex, 'logs', (table) => {
        table.increments('id').primary();
        table.dateTime('timestamp').defaultTo(knex.fn.now());
        table.string('user', 100);
        table.string('action', 100);
        table.text('details');
        table.text('oldValue');
        table.text('newValue');
    });

    await safeCreateTable(knex, 'tax_audits', (table) => {
        table.string('id').primary();
        table.string('title');
        table.string('status', 50);
        table.integer('currentStep');
        table.text('steps');
        table.string('letterNumber', 100);
        table.dateTime('startDate');
    });

    await safeCreateTable(knex, 'tax_summaries', (table) => {
        table.string('id').primary();
        table.string('type', 20);
        table.string('month', 50);
        table.integer('year');
        table.integer('pembetulan').defaultTo(0);
        table.text('data', 'longtext');
    });

    await safeCreateTable(knex, 'external_items', (table) => {
        table.increments('id').primary();
        table.string('boxId', 100);
        table.string('destination');
        table.dateTime('sentDate');
        table.string('sender', 100);
        table.text('boxData');
        table.text('history');
    });

    await safeCreateTable(knex, 'boxes', (table) => {
        table.increments('id').primary();
        table.integer('inventory_id');
        table.string('box_id', 100);
        table.dateTime('created_at').defaultTo(knex.fn.now());
        table.index('box_id');
        table.index('inventory_id');
    });

    await safeCreateTable(knex, 'ordners', (table) => {
        table.increments('id').primary();
        table.integer('box_ref_id').unsigned();
        table.string('no_ordner', 100);
        table.string('period', 100);
        table.foreign('box_ref_id').references('id').inTable('boxes').onDelete('CASCADE');
    });

    await safeCreateTable(knex, 'invoices', (table) => {
        table.increments('id').primary();
        table.integer('ordner_ref_id').unsigned();
        table.string('invoice_no');
        table.string('vendor');
        table.string('payment_date', 100);
        table.text('file_url');
        table.string('file_name');
        table.text('ocr_content', 'longtext');
        table.index('invoice_no');
        table.index('vendor');
        table.text('vector', 'longtext');
        table.foreign('ordner_ref_id').references('id').inTable('ordners').onDelete('CASCADE');
    });

    await safeCreateTable(knex, 'inventory_items', (table) => {
        table.increments('id').primary();
        table.integer('inventory_id');
        table.string('box_id', 100);
        table.string('ordner_id', 100);
        table.string('invoice_no');
        table.string('vendor');
        table.dateTime('date');
        table.decimal('amount', 15, 2);
        table.text('file_url');
        table.text('ocr_content', 'longtext');
        table.dateTime('created_at').defaultTo(knex.fn.now());
        table.index(['invoice_no', 'vendor']);
    });

    // --- TAX MODULE ---
    if (await knex.schema.hasTable('tax_objects')) {
        const hasIdentityNumber = await knex.schema.hasColumn('tax_objects', 'identity_number');
        if (!hasIdentityNumber) {
            await knex.schema.dropTable('tax_objects');
        }
    }

    await safeCreateTable(knex, 'tax_objects', (table) => {
        table.increments('id').primary();
        table.string('id_type', 50);
        table.string('identity_number', 100);
        table.string('name');
        table.string('email');
        table.string('tax_type', 50);
        table.string('tax_object_code', 100);
        table.string('tax_object_name');
        table.decimal('dpp', 15, 2);
        table.decimal('rate', 5, 2);
        table.decimal('pph', 15, 2);
        table.decimal('ppn', 15, 2);
        table.decimal('total_payable', 15, 2);
        table.decimal('discount', 15, 2);
        table.decimal('dpp_net', 15, 2);
        table.dateTime('created_at').defaultTo(knex.fn.now());
    });

    await safeCreateTable(knex, 'master_tax_objects', (table) => {
        table.increments('id').primary();
        table.string('tax_type', 50);
        table.string('code', 100);
        table.string('name');
        table.text('note');
        table.decimal('rate', 5, 2);
        table.text('vector', 'longtext');
        table.dateTime('created_at').defaultTo(knex.fn.now());
    });

    await safeCreateTable(knex, 'job_queue', (table) => {
        table.increments('id').primary();
        table.string('name');
        table.text('data', 'longtext');
        table.string('status', 50).defaultTo('waiting');
        table.integer('progress').defaultTo(0);
        table.dateTime('created_at').defaultTo(knex.fn.now());
        table.dateTime('processed_at');
        table.dateTime('finished_at');
        table.text('error');
    });

    await safeCreateTable(knex, 'document_approvals', (table) => {
        table.increments('id').primary();
        table.text('title');
        table.text('description');
        table.text('division');
        table.text('requester_name');
        table.text('requester_username');
        table.text('attachment_url');
        table.text('attachment_name');
        table.string('status', 50).defaultTo('Pending');
        table.integer('current_step_index').defaultTo(0);
        table.dateTime('created_at').defaultTo(knex.fn.now());
        table.text('ocr_content', 'longtext');
    });

    await safeCreateTable(knex, 'approval_steps', (table) => {
        table.increments('id').primary();
        table.integer('approval_id').unsigned();
        table.integer('step_index');
        table.text('approver_username');
        table.text('approver_name');
        table.string('status', 50).defaultTo('Pending');
        table.dateTime('action_date');
        table.text('note');
        table.text('attachment_url');
        table.text('attachment_name');
        table.text('instruction');
        table.text('vector', 'longtext');
        table.foreign('approval_id').references('id').inTable('document_approvals').onDelete('CASCADE');
    });

    await safeCreateTable(knex, 'approval_flows', (table) => {
        table.increments('id').primary();
        table.string('name');
        table.text('description');
        table.text('steps', 'longtext');
    });

    await safeCreateTable(knex, 'pustaka_guides', (table) => {
        table.increments('id').primary();
        table.string('title');
        table.text('description');
        table.string('category', 100);
        table.string('icon', 50);
        table.dateTime('created_at').defaultTo(knex.fn.now());
        table.string('privacy', 50).defaultTo('public');
        table.text('allowed_depts');
        table.text('allowed_users');
        table.string('owner', 100);
    });

    await safeCreateTable(knex, 'pustaka_slides', (table) => {
        table.increments('id').primary();
        table.integer('guide_id').unsigned();
        table.string('title');
        table.text('content');
        table.text('image');
        table.integer('step_order');
        table.foreign('guide_id').references('id').inTable('pustaka_guides').onDelete('CASCADE');
    });

    await safeCreateTable(knex, 'pustaka_categories', (table) => {
        table.increments('id').primary();
        table.string('name', 100);
    });
    await safeAddUnique(knex, 'pustaka_categories', 'name');

    await safeCreateTable(knex, 'comments', (table) => {
        table.increments('id').primary();
        table.string('documentId');
        table.string('user', 100);
        table.text('text');
        table.dateTime('timestamp').defaultTo(knex.fn.now());
        table.text('attachmentUrl');
        table.text('attachmentName');
        table.string('attachmentType', 100);
        table.string('attachmentSize', 50);
    });

    await safeCreateTable(knex, 'tax_audit_notes', (table) => {
        table.increments('id').primary();
        table.string('auditId');
        table.integer('stepIndex');
        table.string('user', 100);
        table.text('text');
        table.dateTime('timestamp').defaultTo(knex.fn.now());
        table.text('attachmentUrl');
        table.text('attachmentName');
        table.string('attachmentType', 100);
        table.string('attachmentSize', 50);
    });

    console.log('[MIGRATION] initial_schema UP: Complete.');
};

export const down = async (knex) => {
    // ⚠️ PRODUCTION SAFETY: Log a clear warning before dropping all tables
    const tables = [
        'tax_audit_notes', 'comments', 'pustaka_slides', 'pustaka_categories', 'pustaka_guides',
        'approval_flows', 'approval_steps', 'document_approvals', 'job_queue', 'master_tax_objects',
        'tax_objects', 'inventory_items', 'invoices', 'ordners', 'boxes', 'external_items',
        'tax_summaries', 'tax_audits', 'logs', 'documents', 'folders', 'inventory', 'roles',
        'departments', 'users'
    ];

    console.warn('⚠️  [MIGRATION DOWN] initial_schema: About to drop ALL tables!');
    console.warn('⚠️  Tables to be dropped:', tables.join(', '));
    console.warn('⚠️  This action is IRREVERSIBLE and will DELETE ALL DATA.');

    for (const table of tables) {
        if (await knex.schema.hasTable(table)) {
            console.warn(`   🗑️  Dropping table: ${table}`);
            await knex.schema.dropTable(table);
        } else {
            console.log(`   ⏭️  Skipping (not found): ${table}`);
        }
    }

    console.warn('⚠️  [MIGRATION DOWN] initial_schema: All tables dropped.');
};
