import Knex from 'knex';
import knexConfig from './knexfile.js';

const knex = Knex(knexConfig.development);

async function diagnose() {
    try {
        console.log('\n=== OCR Stuck Files Diagnosis ===\n');

        // Query for SURAT PENGANTAR 2026.pdf
        const stickyFile = await knex('documents')
            .where('title', 'like', '%SURAT PENGANTAR 2026%')
            .select('id', 'title', 'status', 'url', 'uploadDate', 'ocrContent')
            .first();

        console.log('1. SURAT PENGANTAR 2026.pdf lookup:');
        if (stickyFile) {
            console.log('   Found:', {
                id: stickyFile.id,
                title: stickyFile.title,
                status: stickyFile.status,
                url: stickyFile.url ? stickyFile.url.substring(0, 80) : null,
                uploadDate: stickyFile.uploadDate,
                hasOcrContent: !!stickyFile.ocrContent && stickyFile.ocrContent.length > 0
            });
        } else {
            console.log('   NOT FOUND in documents table');
        }

        // Query all documents with status
        console.log('\n2. All documents (latest 20):');
        const allDocs = await knex('documents')
            .select('id', 'title', 'status', 'uploadDate')
            .orderBy('uploadDate', 'desc')
            .limit(20);

        console.log(`   Total: ${allDocs.length} documents`);
        allDocs.forEach(doc => {
            console.log(`   - ${doc.id} | ${doc.title} | Status: ${doc.status}`);
        });

        // Check for documents stuck in 'PROCESSING' status
        console.log('\n3. Documents stuck in "PROCESSING" status:');
        const stuckDocs = await knex('documents')
            .where('status', 'PROCESSING')
            .select('id', 'title', 'uploadDate', 'url');

        if (stuckDocs.length > 0) {
            console.log(`   Found ${stuckDocs.length} stuck documents:`);
            stuckDocs.forEach(doc => {
                console.log(`   - ${doc.id} | ${doc.title}`);
            });
        } else {
            console.log('   None found.');
        }

        // Check job queue
        console.log('\n3b. Job queue status:');
        const jobCounts = await knex('job_queue')
            .select('status')
            .count('id as count')
            .groupBy('status');
        
        console.log(`   Job counts by status:`);
        jobCounts.forEach(c => {
            console.log(`     ${c.status}: ${c.count}`);
        });

        // Check BOX-2024-001 in inventory
        console.log('\n4. Checking Slot #1 (BOX-2024-001) inventory data:');
        const slot1 = await knex('inventory')
            .where('id', 1)
            .select('id', 'box_id', 'box_data', 'status')
            .first();

        if (slot1) {
            console.log(`   Status: ${slot1.status}`);
            console.log(`   Box ID: ${slot1.box_id}`);
            if (slot1.box_data) {
                const boxData = typeof slot1.box_data === 'string' ? JSON.parse(slot1.box_data) : slot1.box_data;
                console.log(`   Ordners:`, boxData.ordners ? boxData.ordners.length : 0);
                
                // Find invoices and their document IDs
                if (boxData.ordners && boxData.ordners.length > 0) {
                    boxData.ordners.forEach((ordner, oIdx) => {
                        if (ordner.invoices && ordner.invoices.length > 0) {
                            ordner.invoices.forEach((inv, iIdx) => {
                                console.log(`     Ordner ${ordner.noOrdner}, Invoice ${iIdx + 1}:`);
                                console.log(`       ID: ${inv.id}`);
                                console.log(`       No: ${inv.invoiceNo}`);
                                console.log(`       File: ${inv.fileName}`);
                                console.log(`       Status: ${inv.status || 'unknown'}`);
                            });
                        }
                    });
                }
            }
        } else {
            console.log('   Slot #1 not found in inventory table');
        }

        // Check job queue entries for SURAT PENGANTAR
        console.log('\n5. Checking job queue for SURAT PENGANTAR:');
        const jobs = await knex('job_queue')
            .whereRaw(`CAST(data AS TEXT) LIKE '%SURAT PENGANTAR%'`)
            .select('id', 'status', 'data', 'created_at', 'error')
            .limit(10);

        if (jobs.length > 0) {
            console.log(`   Found ${jobs.length} job(s) related to SURAT PENGANTAR:`);
            jobs.forEach(job => {
                const jobData = typeof job.data === 'string' ? JSON.parse(job.data) : job.data;
                console.log(`   Job ID: ${job.id}`);
                console.log(`     Status: ${job.status}`);
                console.log(`     Created: ${job.created_at}`);
                console.log(`     Doc/File: ${jobData.docId || jobData.url || jobData.title || 'unknown'}`);
                if (job.error) {
                    console.log(`     Error: ${job.error.substring(0, 150)}`);
                }
            });
        } else {
            console.log('   No job queue entries found for SURAT PENGANTAR');
        }

        // Check failed jobs
        console.log('\n6. Checking failed jobs:');
        const failedJobs = await knex('job_queue')
            .where('status', 'failed')
            .select('id', 'status', 'data', 'error')
            .limit(5);

        if (failedJobs.length > 0) {
            console.log(`   Found ${failedJobs.length} failed job(s):`);
            failedJobs.forEach(job => {
                const jobData = typeof job.data === 'string' ? JSON.parse(job.data) : job.data;
                console.log(`   Job ID: ${job.id}`);
                console.log(`     Doc/File: ${jobData.docId || jobData.url || jobData.title || 'unknown'}`);
                if (job.error) {
                    console.log(`     Error: ${job.error.substring(0, 200)}`);
                }
            });
        } else {
            console.log('   No failed jobs');
        }

        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}

diagnose();
