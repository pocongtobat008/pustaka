/**
 * Performance Optimization: Database Indexing
 * Adds strategic indexes to high-frequency query columns for documents, invoices, tax, and logs.
 */
export const up = async function (knex) {
    console.log('[Migration] Starting Database Indexing Optimization...');

    // Helper: Safely add index if not exists
    const safeAddIndex = async (tableName, columns, indexName) => {
        try {
            const hasIndex = await knex.schema.hasTable(tableName).then(async exists => {
                if (!exists) return false;
                // Knex doesn't have a direct "hasIndex", so we use raw queries or try/catch
                return false;
            });

            await knex.schema.alterTable(tableName, table => {
                if (Array.isArray(columns)) {
                    table.index(columns, indexName);
                } else {
                    table.index([columns], indexName);
                }
            });
            console.log(`  ✅ Added index to ${tableName}(${columns})`);
        } catch (e) {
            if (e.message.includes('already exists') || e.code === '42P07' || e.code === 'ER_DUP_KEYNAME') {
                console.log(`  ⏭️  Index already exists on ${tableName}(${columns})`);
            } else {
                console.warn(`  ⚠️  Failed to add index to ${tableName}(${columns}): ${e.message}`);
            }
        }
    };

    // 1. Documents: Optimize folder navigation and audit mapping
    await safeAddIndex('documents', 'folderId', 'idx_docs_folder');
    await safeAddIndex('documents', 'auditId', 'idx_docs_audit');
    await safeAddIndex('documents', 'owner', 'idx_docs_owner');
    await safeAddIndex('documents', 'department', 'idx_docs_dept');

    // 2. Invoices: Optimize search by Tax Invoice No and Ordner mapping
    await safeAddIndex('invoices', 'tax_invoice_no', 'idx_inv_tax_no');
    await safeAddIndex('invoices', 'ordner_ref_id', 'idx_inv_ordner');
    // vendor and invoice_no are already indexed in initial_schema

    // 3. Tax Objects: Optimize search by Identity Number (NPWP)
    await safeAddIndex('tax_objects', 'identity_number', 'idx_tax_obj_id_num');
    await safeAddIndex('tax_objects', 'tax_object_code', 'idx_tax_obj_code');

    // 4. Tax Summaries: Optimize dashboard aggregations
    await safeAddIndex('tax_summaries', ['type', 'year', 'month'], 'idx_tax_sum_composite');

    // 5. Logs & Queue: Optimize tracking and worker performance
    await safeAddIndex('logs', ['timestamp', 'user'], 'idx_logs_time_user');
    await safeAddIndex('job_queue', ['status', 'created_at'], 'idx_jobs_stat_time');

    // 6. Comments & Audit Notes: Optimize conversation retrieval
    await safeAddIndex('comments', 'documentId', 'idx_comm_doc');
    await safeAddIndex('tax_audit_notes', 'auditId', 'idx_audit_note_id');

    console.log('[Migration] Database Indexing Optimization Complete.');
};

export const down = async function (knex) {
    // Dropping indexes safely
    const safeDropIndex = async (tableName, indexName) => {
        try {
            await knex.schema.alterTable(tableName, table => {
                table.dropIndex([], indexName);
            });
        } catch (e) { /* ignore */ }
    };

    await safeDropIndex('documents', 'idx_docs_folder');
    await safeDropIndex('documents', 'idx_docs_audit');
    await safeDropIndex('documents', 'idx_docs_owner');
    await safeDropIndex('documents', 'idx_docs_dept');
    await safeDropIndex('invoices', 'idx_inv_tax_no');
    await safeDropIndex('invoices', 'idx_inv_ordner');
    await safeDropIndex('tax_objects', 'idx_tax_obj_id_num');
    await safeAddIndex('tax_objects', 'tax_object_code', 'idx_tax_obj_code');
    await safeDropIndex('tax_summaries', 'idx_tax_sum_composite');
    await safeDropIndex('logs', 'idx_logs_time_user');
    await safeDropIndex('job_queue', 'idx_jobs_stat_time');
    await safeDropIndex('comments', 'idx_comm_doc');
    await safeDropIndex('tax_audit_notes', 'idx_audit_note_id');
};
