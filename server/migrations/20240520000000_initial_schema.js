/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function (knex) {
  if (!(await knex.schema.hasTable('users'))) {
    await knex.schema.createTable('users', table => {
      table.increments('id').primary();
      table.string('username').unique().notNullable();
      table.string('password').notNullable();
      table.string('name');
      table.string('role').defaultTo('viewer');
      table.string('department');
      table.string('token');
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('departments'))) {
    await knex.schema.createTable('departments', table => {
      table.increments('id').primary();
      table.string('name').unique().notNullable();
    });
  }

  if (!(await knex.schema.hasTable('roles'))) {
    await knex.schema.createTable('roles', table => {
      table.string('id').primary();
      table.string('label');
      table.json('access');
    });
  }

  if (!(await knex.schema.hasTable('folders'))) {
    await knex.schema.createTable('folders', table => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.integer('parentId').unsigned().references('id').inTable('folders').onDelete('CASCADE');
      table.string('privacy').defaultTo('public');
      table.string('owner');
      table.json('allowedDepts').nullable();
      table.json('allowedUsers').nullable();
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('documents'))) {
    await knex.schema.createTable('documents', table => {
      table.string('id').primary();
      table.string('title').notNullable();
      table.string('type');
      table.string('size');
      table.timestamp('uploadDate').defaultTo(knex.fn.now());
      table.integer('folderId').unsigned().references('id').inTable('folders').onDelete('SET NULL');
      table.string('owner');
      table.text('ocrContent', 'longtext');
      table.string('url');
      table.text('file_data', 'longtext');
      table.integer('version').defaultTo(1);
      table.json('versionsHistory');
      table.string('status');
      table.string('auditId');
      table.integer('stepIndex');
      table.string('department');
    });
  }

  if (!(await knex.schema.hasTable('inventory'))) {
    await knex.schema.createTable('inventory', table => {
      table.integer('id').primary();
      table.string('status').defaultTo('EMPTY');
      table.timestamp('lastUpdated').nullable();
      table.json('boxData');
      table.json('history');
      table.string('box_id');
      table.string('rack', 10);
      table.integer('shelf');
      table.integer('position');
    });
  }

  if (!(await knex.schema.hasTable('tax_audits'))) {
    await knex.schema.createTable('tax_audits', table => {
      table.string('id').primary();
      table.string('title').notNullable();
      table.string('status');
      table.integer('currentStep');
      table.string('letterNumber');
      table.string('auditor');
      table.timestamp('startDate').nullable();
      table.json('steps');
    });
  }

  if (!(await knex.schema.hasTable('approvals'))) {
    await knex.schema.createTable('approvals', table => {
      table.increments('id').primary();
      table.string('title').notNullable();
      table.text('description');
      table.string('division');
      table.string('requester_name');
      table.string('requester_username');
      table.string('attachment_url');
      table.string('attachment_name');
      table.text('ocr_content', 'longtext');
      table.string('status').defaultTo('Pending');
      table.integer('current_step_index').defaultTo(0);
      table.integer('flow_id');
      table.json('steps');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await knex.schema.hasTable('approval_flows'))) {
    await knex.schema.createTable('approval_flows', table => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.text('description');
      table.json('steps');
      table.json('visual_config');
    });
  }

  if (!(await knex.schema.hasTable('tax_summaries'))) {
    await knex.schema.createTable('tax_summaries', table => {
      table.string('id').primary();
      table.string('type');
      table.string('month');
      table.integer('year');
      table.integer('pembetulan').defaultTo(0);
      table.json('data').nullable();
      table.decimal('pph23', 20, 2);
      table.decimal('pph42', 20, 2);
    });
  }

  if (!(await knex.schema.hasTable('tax_objects'))) {
    await knex.schema.createTable('tax_objects', table => {
      table.increments('id').primary();
      table.string('code').unique().notNullable();
      table.string('name').notNullable();
      table.string('tax_type');
      table.decimal('rate', 10, 4);
      table.boolean('is_pph21_bukan_pegawai').defaultTo(false);
      table.boolean('use_ppn').defaultTo(true);
      table.string('markup_mode').defaultTo('none');
    });
  }

  if (!(await knex.schema.hasTable('external_items'))) {
    await knex.schema.createTable('external_items', table => {
      table.increments('id').primary();
      table.string('boxId').notNullable();
      table.string('destination');
      table.timestamp('sentDate').nullable();
      table.string('sender');
      table.json('boxData');
      table.json('history');
    });
  }

  if (!(await knex.schema.hasTable('pustaka_guides'))) {
    await knex.schema.createTable('pustaka_guides', table => {
      table.increments('id').primary();
      table.string('title').notNullable();
      table.text('description');
      table.string('category');
      table.string('icon');
      table.string('privacy').defaultTo('public');
      table.json('allowed_depts').nullable();
      table.json('allowed_users').nullable();
      table.string('owner');
    });
  }

  if (!(await knex.schema.hasTable('pustaka_categories'))) {
    await knex.schema.createTable('pustaka_categories', table => {
      table.increments('id').primary();
      table.string('name').unique().notNullable();
    });
  }

  if (!(await knex.schema.hasTable('pustaka_slides'))) {
    await knex.schema.createTable('pustaka_slides', table => {
      table.increments('id').primary();
      table.integer('guide_id').unsigned().references('id').inTable('pustaka_guides').onDelete('CASCADE');
      table.string('title');
      table.text('content');
      table.string('image_url');
      table.integer('step_order');
    });
  }

  if (!(await knex.schema.hasTable('logs'))) {
    await knex.schema.createTable('logs', table => {
      table.increments('id').primary();
      table.string('user');
      table.string('action');
      table.text('details');
      table.timestamp('timestamp').defaultTo(knex.fn.now());
      table.text('oldValue');
      table.text('newValue');
    });
  }

  if (!(await knex.schema.hasTable('sop_flows'))) {
    await knex.schema.createTable('sop_flows', table => {
      table.increments('id').primary();
      table.string('title').notNullable();
      table.text('description');
      table.string('category');
      table.json('steps'); // Format: [{ title, pic, documents: [] }]
      table.json('visual_config');
      table.string('owner');
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('job_queue'))) {
    await knex.schema.createTable('job_queue', table => {
      table.increments('id').primary();
      table.string('name');
      table.json('data');
      table.string('status').defaultTo('waiting');
      table.integer('progress').defaultTo(0);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('processed_at').nullable();
      table.timestamp('finished_at').nullable();
      table.text('error');
    });
  }

  if (!(await knex.schema.hasTable('comments'))) {
    await knex.schema.createTable('comments', table => {
      table.increments('id').primary();
      table.string('documentId');
      table.string('user');
      table.text('text');
      table.timestamp('timestamp').defaultTo(knex.fn.now());
      table.string('attachmentUrl');
      table.string('attachmentName');
      table.string('attachmentType');
      table.string('attachmentSize');
    });
  }

  if (!(await knex.schema.hasTable('tax_audit_notes'))) {
    await knex.schema.createTable('tax_audit_notes', table => {
      table.increments('id').primary();
      table.string('auditId');
      table.integer('stepIndex');
      table.string('user');
      table.text('text');
      table.timestamp('timestamp').defaultTo(knex.fn.now());
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function (knex) {
  if (knex.client.config.client === 'mysql2') {
    await knex.raw('SET FOREIGN_KEY_CHECKS = 0');
  }
  await knex.schema
    .dropTableIfExists('tax_audit_notes')
    .dropTableIfExists('comments')
    .dropTableIfExists('job_queue')
    .dropTableIfExists('sop_flows')
    .dropTableIfExists('logs')
    .dropTableIfExists('pustaka_slides')
    .dropTableIfExists('pustaka_categories')
    .dropTableIfExists('pustaka_guides')
    .dropTableIfExists('external_items')
    .dropTableIfExists('tax_objects')
    .dropTableIfExists('tax_summaries')
    .dropTableIfExists('approval_flows')
    .dropTableIfExists('approvals')
    .dropTableIfExists('tax_audits')
    .dropTableIfExists('inventory')
    .dropTableIfExists('documents')
    .dropTableIfExists('folders')
    .dropTableIfExists('roles')
    .dropTableIfExists('departments')
    .dropTableIfExists('users');
  if (knex.client.config.client === 'mysql2') {
    await knex.raw('SET FOREIGN_KEY_CHECKS = 1');
  }
};