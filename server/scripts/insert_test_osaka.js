#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();
import knexLib from 'knex';
import { v4 as uuidv4 } from 'uuid';

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
    const id = 'test-osaka-' + Date.now();
    const title = 'Test Osaka Document';
    const ocr = 'This is a test OCR content containing the word osaka to validate search.';
    await knex('documents').insert({ id, title, ocrContent: ocr });
    console.log('Inserted test document', id);
  } catch (err) {
    console.error('Insert error:', err.message || err);
  } finally {
    await knex.destroy();
  }
})();
