#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();
import knexLib from 'knex';

const knex = knexLib({
  client: process.env.DB_CLIENT || 'pg',
  connection: process.env.DB_CLIENT === 'sqlite3'
    ? { filename: process.env.DB_FILENAME || './pustaka.sqlite' }
    : {
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'admin',
      password: process.env.DB_PASS || 'admin123',
      database: process.env.DB_NAME || 'pustaka',
      port: process.env.DB_PORT || 5432
    }
});

(async function main(){
  try {
    console.log('Listing columns for table documents...');
    const colsRaw = await knex.raw("SELECT column_name FROM information_schema.columns WHERE table_name='documents'");
    const colsArray = (colsRaw.rows || colsRaw).map(r => r.column_name || r.name || Object.values(r)[0]);
    console.log('Columns:', colsArray);

    console.log('Trying sample query for documents (limit 5)');
    const sample = await knex('documents').select('*').limit(5);
    console.log('Sample rows:', sample.length);

    const hasSnake = colsArray.includes('ocr_content');
    const hasCamel = colsArray.includes('ocrContent');

    let rows;
    if (hasSnake && hasCamel) {
      rows = await knex('documents')
        .select('*')
        .whereRaw("(title ILIKE ? OR COALESCE(ocr_content, \"ocrContent\") ILIKE ?)", ['%osaka%', '%osaka%'])
        .limit(50);
    } else if (hasCamel) {
      rows = await knex('documents')
        .select('*')
        .whereRaw("(title ILIKE ? OR \"ocrContent\" ILIKE ?)", ['%osaka%', '%osaka%'])
        .limit(50);
    } else if (hasSnake) {
      rows = await knex('documents')
        .select('*')
        .whereRaw("(title ILIKE ? OR ocr_content ILIKE ?)", ['%osaka%', '%osaka%'])
        .limit(50);
    } else {
      // No OCR column; only search title
      rows = await knex('documents')
        .select('*')
        .whereRaw("title ILIKE ?", ['%osaka%'])
        .limit(50);
    }
    if (!rows || rows.length === 0) {
      console.log('No documents matched "osaka"');
    } else {
      console.log('Found', rows.length, 'rows:');
      console.dir(rows, { depth: null });
    }
  } catch (err) {
    console.error('Query error:', err.message || err);
  } finally {
    await knex.destroy();
  }
})();
