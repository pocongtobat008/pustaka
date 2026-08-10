export async function up(knex) {
    const has = await knex.schema.hasColumn('invoice_flow_steps', 'custom_emails');
    if (!has) {
        await knex.schema.alterTable('invoice_flow_steps', (t) => {
            t.text('custom_emails').nullable();
        });
    }
}

export async function down(knex) {
    const has = await knex.schema.hasColumn('invoice_flow_steps', 'custom_emails');
    if (has) {
        await knex.schema.alterTable('invoice_flow_steps', (t) => {
            t.dropColumn('custom_emails');
        });
    }
}