
export const up = async (knex) => {
    const hasTable = await knex.schema.hasTable('tax_audit_notes');
    if (hasTable) {
        const hasColumn = await knex.schema.hasColumn('tax_audit_notes', 'ocrContent');
        if (!hasColumn) {
            await knex.schema.alterTable('tax_audit_notes', (table) => {
                table.text('ocrContent', 'longtext');
            });
            console.log('  ✅ Added ocrContent to tax_audit_notes');
        }
    }
};

export const down = async (knex) => {
    const hasColumn = await knex.schema.hasColumn('tax_audit_notes', 'ocrContent');
    if (hasColumn) {
        await knex.schema.alterTable('tax_audit_notes', (table) => {
            table.dropColumn('ocrContent');
        });
        console.log('  🗑️  Dropped ocrContent from tax_audit_notes');
    }
};
