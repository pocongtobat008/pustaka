import knexConfig from '../knexfile.js';
import knexLib from 'knex';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
dotenv.config();

const knex = knexLib(knexConfig.development);

// Wrapper to mimic SQLite API (compat layer) - DEPRECATED: Use knex directly
const db = {
    // Helper methods for Worker (Promise-based)
    getDocumentById: async (id) => {
        return await knex('documents').where('id', id).first();
    },
    updateDocument: async (id, data) => {
        const filteredData = { ...data };
        delete filteredData.id;
        return await knex('documents').where('id', id).update(filteredData);
    }
};

const initDb = async () => {
    // --- ARCHITECTURAL FIX ---
    // The massive "SELF-HEALING FOR APPROVALS" block (lines 23-92) has been fully removed.
    // Table schemas for `document_approvals`, `approval_steps`, and `tax_wp` are now 
    // strictly, safely, and idempotently generated via 20260228140000_remove_db_self_healing.js
    // This resolves duplicate index errors and prevents multi-server MigrationLocked collisions.

    console.log('Checking database migrations...');
    try {
        await knex.migrate.latest();
        console.log('Database migrated successfully.');
    } catch (err) {
        if (err.name === 'MigrationLocked' || err.message.includes('already locked')) {
            console.warn('Database migration is already in progress by another process. Skipping...');
        } else {
            console.error('Migration failed:', err);
            // Biarkan proses berlanjut ke seeding meskipun migrasi ada kendala minor (seperti duplicate index)
        }
    }

    try {
        // Seed initial data if needed (only if user table is empty)
        // We use a separate try-catch so seeding still works if migration was skipped but finished
        const hasUsersTable = await knex.schema.hasTable('users');
        let userCount = 0;
        if (hasUsersTable) {
            const userCountResult = await knex('users').count('id as count').first();
            userCount = userCountResult ? (userCountResult.count || userCountResult['count(*)'] || 0) : 0;
        }

        if (!hasUsersTable || Number(userCount) === 0) {
            console.log('Seeding initial data...');

            const adminPass = process.env.INITIAL_ADMIN_PASSWORD || 'admin123';
            const staffPass = process.env.INITIAL_STAFF_PASSWORD || 'staff123';
            const viewerPass = process.env.INITIAL_VIEWER_PASSWORD || 'viewer123';

            const [adminHash, staffHash, viewerHash] = await Promise.all([
                bcrypt.hash(adminPass, 10),
                bcrypt.hash(staffPass, 10),
                bcrypt.hash(viewerPass, 10)
            ]);

            await knex('users').insert([
                { username: 'admin', password: adminHash, name: 'Administrator', role: 'admin', department: 'IT' },
                { username: 'staff', password: staffHash, name: 'Staff Gudang', role: 'staff', department: 'Warehouse' },
                { username: 'viewer', password: viewerHash, name: 'Tamu', role: 'viewer', department: 'General' }
            ]);

            await knex('departments').insert([
                { name: 'IT' }, { name: 'Finance' }, { name: 'HR' }, { name: 'Warehouse' }, { name: 'General' }
            ]);

            await knex('roles').insert([
                {
                    id: 'admin', label: 'Administrator', access: {
                        dashboard: ['view'],
                        inventory: ['view', 'create', 'edit', 'delete'],
                        documents: ['view', 'create', 'edit', 'delete'],
                        'tax-monitoring': ['view', 'create', 'edit', 'delete'],
                        'tax-summary': ['view', 'create', 'edit', 'delete'],
                        master: ['view', 'create', 'edit', 'delete']
                    }
                },
                {
                    id: 'staff', label: 'Staff Gudang', access: {
                        dashboard: ['view'],
                        inventory: ['view', 'create', 'edit'],
                        documents: ['view', 'create'],
                        'tax-monitoring': ['view'],
                        'tax-summary': ['view']
                    }
                },
                {
                    id: 'viewer', label: 'Tamu / Viewer', access: {
                        dashboard: ['view'],
                        inventory: ['view'],
                        documents: ['view'],
                        'tax-monitoring': ['view'],
                        'tax-summary': ['view']
                    }
                }
            ]);
            console.log('User, Role, and Dept seeding complete.');
        }

        // Seed System Folders if empty
        const folderCountResult = await knex('folders').count('id as count').first();
        const folderCount = folderCountResult ? (folderCountResult.count || folderCountResult['count(*)'] || 0) : 0;
        if (Number(folderCount) === 0) {
            console.log('Seeding initial system folders...');
            await knex('folders').insert([
                { name: 'DataBox', privacy: 'public', owner: 'System' },
                { name: 'TaxAudit', privacy: 'public', owner: 'System' },
                { name: 'ApprovalDoc', privacy: 'public', owner: 'System' },
                { name: 'PUSTAKA', privacy: 'public', owner: 'System' },
                { name: 'SOP', privacy: 'public', owner: 'System' }
            ]);
        }

        // Seed Inventory Slots - Self Healing Logic
        // Memastikan slot 1 sampai 100 selalu tersedia di database
        const targetSlots = 100;
        const existingSlots = await knex('inventory').select('id');
        const existingIds = new Set(existingSlots.map(s => s.id));

        const missingSlots = [];
        const racks = ['A', 'B', 'C', 'D', 'E'];

        for (let i = 1; i <= targetSlots; i++) {
            if (!existingIds.has(i)) {
                const idx = i - 1;
                const rackIdx = Math.floor(idx / 20);
                const rack = racks[rackIdx] || 'Z';
                const remainder = idx % 20;
                const shelf = Math.floor(remainder / 4) + 1;
                const position = (remainder % 4) + 1;

                missingSlots.push({
                    id: i,
                    status: 'EMPTY',
                    rack,
                    shelf,
                    position,
                    history: JSON.stringify([]) // Simpan sebagai string JSON kosong untuk MySQL
                });
            }
        }

        if (missingSlots.length > 0) {
            console.log(`Inisialisasi Database: Menambahkan ${missingSlots.length} slot yang hilang...`);
            await knex('inventory').insert(missingSlots);
            console.log('Sinkronisasi slot inventory berhasil.');
        }

        // --- FIX: Tax Tables are now strictly defined in 20260228140000 Knex migration ---
    } catch (err) {
        console.error('Migration/Seeding failed:', err);
    }
};

// Initialize
// Only run migrations/seeding if this is NOT the worker process
// We detect worker by checking if the process entry point includes 'worker.js'
export default db;
export { knex, initDb };
