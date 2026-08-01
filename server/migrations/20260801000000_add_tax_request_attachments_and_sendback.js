export async function up(knex) {
    // ── Tax request attachments on invoice ──
    const hasTaxAttach = await knex.schema.hasColumn('proforma_invoices', 'tax_request_attachments');
    if (!hasTaxAttach) {
        await knex.schema.alterTable('proforma_invoices', (t) => {
            t.text('tax_request_attachments'); // JSON array of files
        });
    }
    const hasTaxNotes = await knex.schema.hasColumn('proforma_invoices', 'tax_request_notes');
    if (!hasTaxNotes) {
        await knex.schema.alterTable('proforma_invoices', (t) => {
            t.text('tax_request_notes');
        });
    }
    // ── Sendback notes on proforma request ──
    const hasSendback = await knex.schema.hasColumn('proforma_requests', 'sendback_notes');
    if (!hasSendback) {
        await knex.schema.alterTable('proforma_requests', (t) => {
            t.text('sendback_notes');
        });
    }
    // Widen status column to accommodate 'sent_back' / 'sent_back_tax'
    try {
        await knex.raw("ALTER TABLE proforma_requests ALTER COLUMN status TYPE VARCHAR(30)");
        await knex.raw("ALTER TABLE proforma_invoices ALTER COLUMN status TYPE VARCHAR(30)");
    } catch (_) { /* ignore if not pg */ }
}

export async function down(knex) {
    const hasTaxAttach = await knex.schema.hasColumn('proforma_invoices', 'tax_request_attachments');
    if (hasTaxAttach) await knex.schema.alterTable('proforma_invoices', (t) => t.dropColumn('tax_request_attachments'));
    const hasTaxNotes = await knex.schema.hasColumn('proforma_invoices', 'tax_request_notes');
    if (hasTaxNotes) await knex.schema.alterTable('proforma_invoices', (t) => t.dropColumn('tax_request_notes'));
    const hasSendback = await knex.schema.hasColumn('proforma_requests', 'sendback_notes');
    if (hasSendback) await knex.schema.alterTable('proforma_requests', (t) => t.dropColumn('sendback_notes'));
}
