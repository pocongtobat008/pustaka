#!/usr/bin/env node
import path from 'path';
import fs from 'fs';
import { knex } from '../db.js';
import { addOcrJob } from '../utils/queue.js';
import { UPLOADS_DIR } from '../config/upload.js';
import { DOC_STATUS } from '../constants/status.js';

async function findDocsByFilenameFragment(fragment) {
    const like = `%${fragment}%`;
    const rows = await knex('documents')
        .where('title', 'like', like)
        .orWhere('url', 'like', like)
        .limit(50);
    return rows;
}

function basenameFromUrl(url) {
    if (!url) return null;
    try {
        return path.basename(url);
    } catch (e) {
        return null;
    }
}

async function requeueDoc(doc) {
    const filename = basenameFromUrl(doc.url);
    if (!filename) {
        console.warn(`[skip] Document ${doc.id} has no url filename.`);
        return;
    }
    const absolutePath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(absolutePath)) {
        console.warn(`[skip] File for document ${doc.id} not found on disk: ${absolutePath}`);
        return;
    }

    try {
        await knex('documents').where('id', doc.id).update({ status: DOC_STATUS.PROCESSING, updated_at: knex.fn.now() });
    } catch (e) {
        console.error(`[db] Failed to update status for ${doc.id}:`, e.message);
    }

    const context = JSON.stringify({ type: 'requeue-script', note: 'Manual requeue via script' });
    await addOcrJob(doc.id, absolutePath, context, doc.type || '', doc.title || '', 0);
    console.log(`[ok] Requeued document ${doc.id} -> ${absolutePath}`);
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Usage: node server/scripts/requeueByFilename.js "filename fragment" ["another fragment"]');
        process.exit(2);
    }

    for (const frag of args) {
        console.log(`Searching for documents matching: ${frag}`);
        const docs = await findDocsByFilenameFragment(frag);
        if (!docs || docs.length === 0) {
            console.log(`No documents found matching: ${frag}`);
            continue;
        }
        console.log(`Found ${docs.length} document(s).`);
        for (const d of docs) {
            console.log(`- Candidate: id=${d.id} title=${d.title} url=${d.url} status=${d.status}`);
            await requeueDoc(d);
        }
    }
    process.exit(0);
}

main().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
