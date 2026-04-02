import knexLib from 'knex';
import knexfile from '../../knexfile.js';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const config = knexfile.development;
  // ensure sqlite uses filename from env
  const db = knexLib({
    client: process.env.DB_CLIENT || config.client,
    connection: process.env.DB_CLIENT === 'sqlite3' ? { filename: process.env.DB_FILENAME || './pustaka.sqlite' } : config.connection,
    useNullAsDefault: true
  });

  const exists = await db.schema.hasTable('documents');
  if (!exists) {
    await db.schema.createTable('documents', (table) => {
      table.string('id', 50).primary();
      table.text('title');
      table.text('ocrContent');
      table.text('vector');
      table.datetime('uploadDate').nullable();
      table.boolean('is_deleted').defaultTo(false);
    });
    console.log('Created minimal documents table');
  } else {
    console.log('documents table already exists');
  }

  // Insert a sample document containing 'osaka' if none exists
  const sample = await db('documents').where('ocrContent', 'like', '%osaka%').first();
  if (!sample) {
    const id = String(Date.now());
    await db('documents').insert({ id, title: 'Sample - Osaka', ocrContent: 'This document mentions osaka and should be found by search.' });
    console.log('Inserted sample document with id', id);
  } else {
    console.log('Sample document already present with id', sample.id);
  }

  await db.destroy();
}

main().catch(err => { console.error(err); process.exit(1); });
