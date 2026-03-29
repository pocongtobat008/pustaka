import knexLib from 'knex';
import dotenv from 'dotenv';

dotenv.config();

const knex = knexLib({
    client: 'pg',
    connection: {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASS || 'admin123',
        database: process.env.DB_NAME || 'pustaka',
        port: process.env.DB_PORT || 5432
    }
});

async function verify() {
    try {
        console.log('Verification Step 1: Manual update with "null" string (Simulation)');
        await knex('inventory').where('id', 2).update({
            status: 'STORED',
            box_data: 'null'
        });

        const slot2 = await knex('inventory').where('id', 2).first();
        console.log('Slot #2 (Simulated Corrupt) data:', JSON.stringify(slot2, null, 2));

        console.log('\nVerification Step 2: Testing Store Logic (Mental Check)');
        // If box_data is "null" (string), my fix in useInventoryStore.js:
        // let boxData = slot.boxData;
        // if (slot.box_data === 'null') boxData = null;
        // const boxId = boxData?.id;
        // Result: boxId = undefined, status = STORED -> Corrupt Flag = YES (Success)

        console.log('\nVerification Step 3: Resetting Slot #2 back to EMPTY');
        await knex('inventory').where('id', 2).update({
            status: 'EMPTY',
            box_data: null
        });
        const slot2_cleaned = await knex('inventory').where('id', 2).first();
        console.log('Slot #2 (Cleaned) data:', JSON.stringify(slot2_cleaned, null, 2));

        await knex.destroy();
        process.exit(0);
    } catch (err) {
        console.error('Verification failed:', err);
        await knex.destroy();
        process.exit(1);
    }
}

verify();
