#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();
import knexLib from 'knex';

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

const isPg = DB_CLIENT.startsWith('pg');
const q = process.argv[2] || 'osaka';

async function run() {
  try {
    console.log(`Searching for '${q}' across tables...`);

    // documents
    const docsQuery = knex('documents').select('id','title','ocrContent','uploadDate').where(function(){
      this.where('title','like',`%${q}%`).orWhere('ocrContent','like',`%${q}%`);
      if (isPg) this.orWhereRaw("COALESCE(file_data::text,'') ILIKE ?", [`%${q}%`]);
    }).limit(20);
    const docs = await docsQuery;
    console.log('\ndocuments:', docs.length);
    docs.forEach(d=>console.dir(d,{depth:1}));

    // invoices
    const invQuery = knex('invoices').select('id','vendor','invoice_no','ocr_content').where(function(){
      this.where('vendor','like',`%${q}%`).orWhere('invoice_no','like',`%${q}%`).orWhere('ocr_content','like',`%${q}%`);
    }).limit(20);
    const inv = await invQuery;
    console.log('\ninvoices:', inv.length);
    inv.forEach(r=>console.dir(r,{depth:1}));

    // inventory
    const invtQuery = knex('inventory').select('id','box_data').where(function(){
      if (isPg) this.whereRaw("COALESCE(box_data::text,'') ILIKE ?", [`%${q}%`]);
      else this.where('box_data','like',`%${q}%`);
    }).limit(20);
    const invt = await invtQuery;
    console.log('\ninventory:', invt.length);
    invt.forEach(r=>console.dir(r,{depth:1}));

    // inventory_items
    const itemsQuery = knex('inventory_items').select('id','invoice_no','vendor','ocr_content').where(function(){
      this.where('invoice_no','like',`%${q}%`).orWhere('vendor','like',`%${q}%`).orWhere('ocr_content','like',`%${q}%`);
    }).limit(20);
    const items = await itemsQuery;
    console.log('\ninventory_items:', items.length);
    items.forEach(r=>console.dir(r,{depth:1}));

    // external_items
    const extQuery = knex('external_items').select('id','boxId','destination','boxData').where(function(){
      this.where('boxId','like',`%${q}%`).orWhere('destination','like',`%${q}%`);
      if (isPg) this.orWhereRaw('COALESCE("boxData"::text,\'\') ILIKE ?', [`%${q}%`]);
      else this.orWhere('boxData','like',`%${q}%`);
    }).limit(20);
    const ext = await extQuery;
    console.log('\nexternal_items:', ext.length);
    ext.forEach(r=>console.dir(r,{depth:1}));

    // document_approvals
    const appQuery = knex('document_approvals').select('id','title','ocr_content').where(function(){
      this.where('title','like',`%${q}%`).orWhere('description','like',`%${q}%`).orWhere('ocr_content','like',`%${q}%`);
    }).limit(20);
    const apps = await appQuery;
    console.log('\ndocument_approvals:', apps.length);
    apps.forEach(r=>console.dir(r,{depth:1}));

    // tax_audit_notes
    const notesQuery = knex('tax_audit_notes').select('id','text').where('text','like',`%${q}%`).limit(20);
    const notes = await notesQuery;
    console.log('\ntax_audit_notes:', notes.length);
    notes.forEach(r=>console.dir(r,{depth:1}));

  } catch (err) {
    console.error('Search error:', err.message || err);
  } finally {
    await knex.destroy();
  }
}

run();
