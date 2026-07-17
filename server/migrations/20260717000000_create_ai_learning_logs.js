/**
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
    // Main learning logs — stores every extracted knowledge point
    await knex.schema.createTable('ai_learning_logs', (t) => {
        t.increments('id').primary();
        t.integer('session_id').references('id').inTable('ai_chat_sessions').onDelete('SET NULL');
        t.integer('message_id').references('id').inTable('ai_chat_messages').onDelete('SET NULL');
        t.string('category', 50).notNullable().defaultTo('general'); // tax_regulation, accounting, procedure, guide, general
        t.string('topic', 200).notNullable();                          // e.g. "PPN SPT Masa", "Upload Faktur Pajak"
        t.text('question_summary').notNullable();                       // summarized user question
        t.text('answer_summary').notNullable();                         // summarized AI answer
        t.text('knowledge_extracted').notNullable();                    // actionable knowledge point
        t.string('source_type', 50).notNullable().defaultTo('chat');   // chat, training_doc, manual
        t.boolean('used_in_training').notNullable().defaultTo(false);  // has this been used to generate a training doc?
        t.integer('training_doc_id').references('id').inTable('ai_training_documents').onDelete('SET NULL');
        t.float('confidence').notNullable().defaultTo(0.5);            // 0-1, how confident we are in this knowledge
        t.integer('repeat_count').notNullable().defaultTo(1);          // how many times this topic was asked
        t.timestamps(true, true);
    });

    // Indexes
    await knex.raw('CREATE INDEX idx_learning_logs_category ON ai_learning_logs(category)');
    await knex.raw('CREATE INDEX idx_learning_logs_topic ON ai_learning_logs(topic)');
    await knex.raw('CREATE INDEX idx_learning_logs_used ON ai_learning_logs(used_in_training)');
    await knex.raw('CREATE INDEX idx_learning_logs_session ON ai_learning_logs(session_id)');

    // Summary view — topic frequency analysis
    await knex.raw(`
        CREATE OR REPLACE VIEW ai_learning_topic_summary AS
        SELECT
            topic,
            category,
            COUNT(*) as ask_count,
            AVG(confidence) as avg_confidence,
            MAX(created_at) as last_asked,
            BOOL_OR(used_in_training) as is_trained
        FROM ai_learning_logs
        GROUP BY topic, category
        ORDER BY ask_count DESC
    `);
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
    await knex.raw('DROP VIEW IF EXISTS ai_learning_topic_summary');
    await knex.schema.dropTableIfExists('ai_learning_logs');
}
