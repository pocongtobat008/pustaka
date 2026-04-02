#!/usr/bin/env node
import dotenv from 'dotenv';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Client as PgClient } from 'pg';

dotenv.config();

const log = (...args) => console.log('[init-db]', ...args);

const tryPostgres = async () => {
    const client = new PgClient({
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USER || 'admin',
        password: process.env.DB_PASS || 'admin123',
        database: process.env.DB_NAME || 'pustaka',
        connectionTimeoutMillis: 2000
    });
    try {
        await client.connect();
        await client.end();
        return true;
    } catch (err) {
        return false;
    }
};

const runKnex = (envOverrides = {}) => {
    const env = { ...process.env, ...envOverrides };
    log('Running migrations with', env.DB_CLIENT || 'default client');
    const res = spawnSync('npx', ['knex', 'migrate:latest'], { stdio: 'inherit', env });
    if (res.error) {
        log('Migration process error:', res.error);
        process.exit(1);
    }
    if (res.status !== 0) {
        log('Migrations exited with code', res.status);
        process.exit(res.status);
    }
};

const ensureSqliteFile = (filename) => {
    const dir = path.dirname(filename);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(filename)) fs.writeFileSync(filename, '');
};

(async function main() {
    // If DB_CLIENT explicitly provided, respect it and run migrations
    if (process.env.DB_CLIENT) {
        log('DB_CLIENT already set to', process.env.DB_CLIENT);
        if (process.env.DB_CLIENT.toLowerCase() === 'sqlite3') {
            const fn = process.env.DB_FILENAME || './pustaka.sqlite';
            ensureSqliteFile(fn);
            runKnex({ DB_CLIENT: 'sqlite3', DB_FILENAME: fn });
            process.exit(0);
        }
        // Assume provided client (pg/mysql/etc) is intended
        runKnex({ DB_CLIENT: process.env.DB_CLIENT });
        process.exit(0);
    }

    log('No DB_CLIENT set — probing for Postgres...');
    const pgAvailable = await tryPostgres();
    if (pgAvailable) {
        log('Postgres detected — using Postgres for migrations');
        runKnex({ DB_CLIENT: 'pg' });
        process.exit(0);
    }

    log('Postgres not reachable — falling back to sqlite3');
    const filename = process.env.DB_FILENAME || './pustaka.sqlite';
    ensureSqliteFile(filename);
    runKnex({ DB_CLIENT: 'sqlite3', DB_FILENAME: filename });
    process.exit(0);
})();
