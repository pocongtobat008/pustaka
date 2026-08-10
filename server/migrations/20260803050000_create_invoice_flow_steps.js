export async function up(knex) {
    const has = await knex.schema.hasTable('invoice_flow_steps');
    if (!has) {
        await knex.schema.createTable('invoice_flow_steps', (t) => {
            t.increments('id');
            t.integer('step_no').notNullable();
            t.string('event', 40).notNullable();
            t.string('name').notNullable();
            t.string('assignee_type', 10).defaultTo('all');
            t.string('assignee_value');
            t.boolean('notify_email').defaultTo(true);
            t.boolean('is_active').defaultTo(true);
            t.timestamps(true, true);
        });
    }
}

export async function down(knex) {
    await knex.schema.dropTableIfExists('invoice_flow_steps');
}
