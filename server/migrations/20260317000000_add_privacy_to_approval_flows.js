/**
 * Migration: Add owner and privacy fields to approval_flows table
 * for role-based access control
 */

export const up = async (knex) => {
    const hasTable = await knex.schema.hasTable('approval_flows');
    if (!hasTable) {
        console.log('⏭️  Table approval_flows does not exist, skipping migration');
        return;
    }

    const hasOwnerColumn = await knex.schema.hasColumn('approval_flows', 'owner');
    const hasPrivacyColumn = await knex.schema.hasColumn('approval_flows', 'privacy');

    if (!hasOwnerColumn) {
        await knex.schema.alterTable('approval_flows', (table) => {
            table.string('owner', 100).nullable();
        });
        console.log('  ✅ Added owner column to approval_flows');
    } else {
        console.log('  ⏭️  owner column already exists in approval_flows');
    }

    if (!hasPrivacyColumn) {
        await knex.schema.alterTable('approval_flows', (table) => {
            table.string('privacy', 50).defaultTo('private');
            table.text('allowed_departments').nullable();
            table.text('allowed_users').nullable();
        });
        console.log('  ✅ Added privacy, allowed_departments, and allowed_users columns to approval_flows');
    } else {
        console.log('  ⏭️  privacy column already exists in approval_flows');
    }
};

export const down = async (knex) => {
    const hasTable = await knex.schema.hasTable('approval_flows');
    if (hasTable) {
        await knex.schema.alterTable('approval_flows', (table) => {
            try { table.dropColumn('owner'); } catch (e) { }
            try { table.dropColumn('privacy'); } catch (e) { }
            try { table.dropColumn('allowed_departments'); } catch (e) { }
            try { table.dropColumn('allowed_users'); } catch (e) { }
        });
    }
};
