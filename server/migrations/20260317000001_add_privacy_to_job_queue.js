/**
 * Migration: Add owner and privacy fields to job_queue table
 * for role-based access control
 */

export const up = async (knex) => {
    const hasTable = await knex.schema.hasTable('job_queue');
    if (!hasTable) {
        console.log('⏭️  Table job_queue does not exist, skipping migration');
        return;
    }

    const hasOwnerColumn = await knex.schema.hasColumn('job_queue', 'owner');
    const hasPrivacyColumn = await knex.schema.hasColumn('job_queue', 'privacy');

    if (!hasOwnerColumn) {
        await knex.schema.alterTable('job_queue', (table) => {
            table.string('owner', 100).nullable();
        });
        console.log('  ✅ Added owner column to job_queue');
    } else {
        console.log('  ⏭️  owner column already exists in job_queue');
    }

    if (!hasPrivacyColumn) {
        await knex.schema.alterTable('job_queue', (table) => {
            table.string('privacy', 50).defaultTo('private');
            table.text('allowed_departments').nullable();
            table.text('allowed_users').nullable();
        });
        console.log('  ✅ Added privacy, allowed_departments, and allowed_users columns to job_queue');
    } else {
        console.log('  ⏭️  privacy column already exists in job_queue');
    }
};

export const down = async (knex) => {
    const hasTable = await knex.schema.hasTable('job_queue');
    if (hasTable) {
        await knex.schema.alterTable('job_queue', (table) => {
            try { table.dropColumn('owner'); } catch (e) { }
            try { table.dropColumn('privacy'); } catch (e) { }
            try { table.dropColumn('allowed_departments'); } catch (e) { }
            try { table.dropColumn('allowed_users'); } catch (e) { }
        });
    }
};
