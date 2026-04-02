import dotenv from 'dotenv';
dotenv.config();

export default {
    development: {
        client: process.env.DB_CLIENT || 'mysql2',
        // Support sqlite3 via DB_CLIENT=sqlite3 and DB_FILENAME env var
        connection: (function() {
            if ((process.env.DB_CLIENT || '').toLowerCase() === 'sqlite3') {
                return {
                    filename: process.env.DB_FILENAME || './pustaka.sqlite'
                };
            }
            return {
                host: process.env.DB_HOST || '127.0.0.1',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASS || '',
                database: process.env.DB_NAME || 'archive_os',
                port: process.env.DB_PORT || (process.env.DB_CLIENT === 'pg' ? 5432 : 3306),
                ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
            };
        })(),
        migrations: {
            directory: './server/migrations',
            tableName: 'knex_migrations'
        },
        seeds: {
            directory: './server/seeds'
        }
    }
};
