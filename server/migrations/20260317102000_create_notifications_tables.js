export const up = async (knex) => {
    const hasNotifications = await knex.schema.hasTable('notifications');
    if (!hasNotifications) {
        await knex.schema.createTable('notifications', (table) => {
            table.increments('id').primary();
            table.string('title', 255).notNullable();
            table.text('message').notNullable();
            table.string('type', 30).notNullable().defaultTo('info');
            table.string('channel', 80).notNullable().defaultTo('system');
            table.string('target_type', 30).notNullable().defaultTo('general'); // general | user | role
            table.string('target_value', 100).nullable();
            table.string('created_by', 100).notNullable().defaultTo('System');
            table.text('meta').nullable();
            table.dateTime('created_at').notNullable().defaultTo(knex.fn.now());
            table.dateTime('expires_at').nullable();

            table.index(['channel']);
            table.index(['target_type', 'target_value']);
            table.index(['created_at']);
        });
    }

    const hasReads = await knex.schema.hasTable('notification_reads');
    if (!hasReads) {
        await knex.schema.createTable('notification_reads', (table) => {
            table.increments('id').primary();
            table.integer('notification_id').unsigned().notNullable();
            table.string('username', 100).notNullable();
            table.dateTime('read_at').notNullable().defaultTo(knex.fn.now());

            table.unique(['notification_id', 'username']);
            table.index(['username']);
            table.foreign('notification_id').references('id').inTable('notifications').onDelete('CASCADE');
        });
    }
};

export const down = async (knex) => {
    await knex.schema.dropTableIfExists('notification_reads');
    await knex.schema.dropTableIfExists('notifications');
};
