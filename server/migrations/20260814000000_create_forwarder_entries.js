/** @param { import("knex").Knex } knex */
export const up = async function (knex) {
    if (!(await knex.schema.hasTable('forwarder_entries'))) {
        await knex.schema.createTable('forwarder_entries', (table) => {
            table.increments('id').primary();
            table.string('division').notNullable().defaultTo('');          // divisi input data
            table.string('delivery_month').nullable();                     // DELIVERY MONTH
            table.string('imp_exp').nullable();                            // IMP/EXP Commercial Transfer
            table.string('forwarder_name').nullable();                     // FORWARDER NAME
            table.string('bl_awb').nullable();                             // BL/AWB (EXIM)
            table.string('inv_no_i').nullable();                           // INV No. (I)
            table.string('inv_no_ii').nullable();                          // INV No. (II)
            table.string('yadin_inv_sj').nullable();                       // YADIN INV. / SJ
            table.string('from_to').nullable();                            // From / To
            table.string('notes').nullable();                              // catatan opsional
            table.string('created_by').nullable();
            table.string('created_by_username').nullable();
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());
            table.index(['division'], 'idx_forwarder_division');
        });
        console.log('  ✅ Created table forwarder_entries');
    }
};

/** @param { import("knex").Knex } knex */
export const down = async function (knex) {
    await knex.schema.dropTableIfExists('forwarder_entries');
};
