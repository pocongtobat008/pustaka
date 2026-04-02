#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();
import knexLib from 'knex';
import { randomUUID } from 'crypto';

const DB_CLIENT = (process.env.DB_CLIENT || 'pg').toLowerCase();
const knex = knexLib({
  client: DB_CLIENT === 'sqlite3' ? 'sqlite3' : (DB_CLIENT === 'mysql2' ? 'mysql2' : 'pg'),
  connection: DB_CLIENT === 'sqlite3'
    ? { filename: process.env.DB_FILENAME || './pustaka.sqlite' }
    : {
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'admin',
      password: process.env.DB_PASS || 'admin123',
      database: process.env.DB_NAME || 'pustaka',
      port: process.env.DB_PORT || (DB_CLIENT === 'pg' ? 5432 : 3306)
    }
});

(async function main(){
  try {
    const ts = Date.now();
    console.log('Inserting test rows for "osaka"...');

    // Documents
    const docId = `dev-osaka-doc-${ts}`;
    const doc = {
      id: docId,
      title: 'Dev Osaka Document',
      type: 'test',
      size: null,
      uploadDate: new Date().toISOString(),
      folderId: null,
      owner: 'dev',
      ocrContent: 'This is a dev test OCR text containing osaka for dashboard tests.',
      url: null,
      file_data: null,
      version: 1,
      status: 'ready'
    };
    try {
      await knex('documents').insert(doc);
      console.log('Inserted document', docId);
    } catch (e) {
      console.warn('Insert document failed (maybe exists):', e.message);
    }

    // Invoices
    const invId = `dev-osaka-inv-${ts}`;
    const inv = {
      id: invId,
      vendor: 'Osaka Vendor Co',
      invoice_no: `INV-OSAKA-${ts}`,
      tax_invoice_no: null,
      ocr_content: 'Invoice OCR text mentioning osaka and sample items',
      file_name: null,
      payment_date: null
    };
    try {
      await knex('invoices').insert(inv);
      console.log('Inserted invoice', invId);
    } catch (e) {
      console.warn('Insert invoice failed (maybe exists):', e.message);
    }

    // Inventory (box_data)
    const inventoryId = `dev-osaka-inventory-${ts}`;
    const boxData = {
      id: inventoryId,
      ordners: [
        {
          noOrdner: 'O-OSAKA-1',
          invoices: [
            { id: `inv-${ts}`, invoiceNo: `INV-OSAKA-${ts}`, vendor: 'Osaka Vendor Co', ocrContent: 'Inventory invoice mentioning osaka' }
          ]
        }
      ]
    };
    try {
      await knex('inventory').insert({ id: inventoryId, box_data: JSON.stringify(boxData) });
      console.log('Inserted inventory', inventoryId);
    } catch (e) {
      console.warn('Insert inventory failed (maybe exists):', e.message);
    }

    // Now initialize embedding generator in worker mode
    console.log('Initializing local embedding generator (emulate worker)...');
    process.env.IS_WORKER = 'true';
    const ai = await import('../ai_search.js');
    const { generateEmbedding, vectorStore } = ai;

    // Build combined texts and upsert vectors
    const docText = `${doc.title}\n\n${doc.ocrContent}`;
    if (docText.length > 10) {
      const v = await generateEmbedding(docText);
      try { await knex('documents').where('id', docId).update({ vector: JSON.stringify(v) }); } catch (e) { /* ignore */ }
      vectorStore.upsertDocument({ id: docId, title: doc.title, ocrContent: doc.ocrContent, matchType: 'document' }, v);
      console.log('Document vector upserted');
    }

    const invText = `${inv.vendor || ''} ${inv.invoice_no || ''} ${inv.ocr_content || ''}`;
    if (invText.length > 5) {
      const v = await generateEmbedding(invText);
      try { await knex('invoices').where('id', invId).update({ vector: JSON.stringify(v) }); } catch (e) { }
      vectorStore.upsertDocument({ id: invId, title: `${inv.vendor} ${inv.invoice_no}`, ocrContent: inv.ocr_content, matchType: 'invoice' }, v);
      console.log('Invoice vector upserted');
    }

    const invBoxText = JSON.stringify(boxData);
    if (invBoxText.length > 5) {
      const v = await generateEmbedding(invBoxText);
      try { await knex('inventory').where('id', inventoryId).update({ vector: JSON.stringify(v) }); } catch (e) { }
      vectorStore.upsertDocument({ id: inventoryId, title: `inventory-${inventoryId}`, ocrContent: invBoxText, matchType: 'inventory' }, v);
      console.log('Inventory vector upserted');
    }

    console.log('Local indexing done. Now starting background worker to reindex in its process.');

    // Start worker process in background via child_process
    const { spawn } = await import('child_process');
    const args = ['server/worker.js', '--mode=ALL'];
    const env = { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' };
    const worker = spawn('node', args, { env, stdio: ['ignore', 'inherit', 'inherit'], detached: true });
    worker.unref();
    console.log('Worker started (detached). PID:', worker.pid);

    console.log('All done.');
  } catch (err) {
    console.error('Script failed:', err.message || err);
  } finally {
    await knex.destroy();
  }
})();
