/**
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
    // ── Corrections table: stores user corrections/feedback ──
    await knex.schema.createTable('ai_learning_corrections', (t) => {
        t.increments('id').primary();
        t.integer('session_id').references('id').inTable('ai_chat_sessions').onDelete('SET NULL');
        t.integer('message_id').references('id').inTable('ai_chat_messages').onDelete('SET NULL');
        t.string('correction_type', 50).notNullable(); // 'correction', 'revision', 'feedback', 'wrong_data'
        t.string('topic', 200).notNullable();
        t.string('category', 50).notNullable().defaultTo('general');
        t.text('original_question').notNullable();
        t.text('wrong_answer').notNullable();           // what the AI said (wrong)
        t.text('correct_answer').notNullable();          // what the user says is correct
        t.text('correction_note').nullable();            // extra context from user
        t.boolean('applied').notNullable().defaultTo(false); // has this been applied to knowledge base?
        t.boolean('verified').notNullable().defaultTo(false); // has this been verified as correct?
        t.integer('learning_log_id').references('id').inTable('ai_learning_logs').onDelete('SET NULL');
        t.integer('training_doc_id').references('id').inTable('ai_training_documents').onDelete('SET NULL');
        t.float('severity').notNullable().defaultTo(0.5); // 0-1, how serious was the error
        t.timestamps(true, true);
    });

    await knex.raw('CREATE INDEX idx_corrections_type ON ai_learning_corrections(correction_type)');
    await knex.raw('CREATE INDEX idx_corrections_topic ON ai_learning_corrections(topic)');
    await knex.raw('CREATE INDEX idx_corrections_applied ON ai_learning_corrections(applied)');

    // ── Data snapshots table: tracks data changes for evolution ──
    await knex.schema.createTable('ai_data_snapshots', (t) => {
        t.increments('id').primary();
        t.string('snapshot_type', 50).notNullable(); // 'training_doc', 'correction', 'knowledge', 'schema'
        t.integer('entity_id').nullable();            // ID of the related entity
        t.text('entity_title').nullable();
        t.text('before_data').nullable();             // JSON snapshot before change
        t.text('after_data').nullable();              // JSON snapshot after change
        t.string('change_reason', 100).notNullable(); // 'auto_evolution', 'manual_correction', 'data_update'
        t.boolean('evolution_processed').notNullable().defaultTo(false);
        t.timestamps(true, true);
    });

    await knex.raw('CREATE INDEX idx_snapshots_type ON ai_data_snapshots(snapshot_type)');
    await knex.raw('CREATE INDEX idx_snapshots_processed ON ai_data_snapshots(evolution_processed)');

    // ── Evolution log table: tracks weekly evolution runs ──
    await knex.schema.createTable('ai_evolution_logs', (t) => {
        t.increments('id').primary();
        t.string('status', 20).notNullable().defaultTo('running'); // 'running', 'completed', 'failed'
        t.text('summary').nullable();                              // JSON summary of what was done
        t.integer('docs_scanned').notNullable().defaultTo(0);
        t.integer('docs_updated').notNullable().defaultTo(0);
        t.integer('corrections_applied').notNullable().defaultTo(0);
        t.integer('knowledge_pruned').notNullable().defaultTo(0);
        t.integer('new_topics_found').notNullable().defaultTo(0);
        t.text('error_message').nullable();
        t.timestamps(true, true);
    });
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
    await knex.schema.dropTableIfExists('ai_evolution_logs');
    await knex.schema.dropTableIfExists('ai_data_snapshots');
    await knex.schema.dropTableIfExists('ai_learning_corrections');
}
