import { knex } from './db.js';

async function wipe() {
    try {
        console.log('🚀 Wiping database...');
        const isPostgres = knex.client.config.client === 'pg' || knex.client.config.client === 'postgresql';

        if (isPostgres) {
            // Postgres approach: Drop public schema and recreate it
            await knex.raw('DROP SCHEMA public CASCADE');
            await knex.raw('CREATE SCHEMA public');
            await knex.raw('GRANT ALL ON SCHEMA public TO public');
        } else {
            // MySQL approach
            await knex.raw('SET FOREIGN_KEY_CHECKS=0');
            const [tables] = await knex.raw('SHOW TABLES');
            for (let row of tables) {
                const tableName = Object.values(row)[0];
                console.log(`🗑️  Dropping ${tableName}`);
                await knex.raw(`DROP TABLE IF EXISTS ??`, [tableName]);
            }
            await knex.raw('SET FOREIGN_KEY_CHECKS=1');
        }

        console.log('⚙️  Running migrations...');
        await knex.migrate.latest();
        console.log('✅ Wipe complete. Database is now empty and ready.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Wipe failed:', err);
        process.exit(1);
    }
}

wipe();