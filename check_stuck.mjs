const { knex } = await import('./server/db.js');

const docs = await knex('documents').select('id', 'status', 'type').where('status', 'processing');
console.log('=== Documents with status=processing ===');
for (const d of docs) {
    const ocrRow = await knex('documents').select(knex.raw('LENGTH("ocrContent") as ocr_len')).where('id', d.id).first();
    console.log(`  ${d.id} | type=${d.type} | ocrLen=${ocrRow?.ocr_len || 0}`);
}

const jobs = await knex('job_queue').select('id', 'name', 'status', 'data');
const relevantJobs = jobs.filter(j => {
    try {
        const data = JSON.parse(j.data || '{}');
        return docs.some(d => data.docId === d.id);
    } catch { return false; }
});
console.log('\n=== Matching jobs in job_queue ===');
if (relevantJobs.length > 0) {
    relevantJobs.forEach(j => {
        const data = JSON.parse(j.data || '{}');
        console.log(`  Job#${j.id} | name=${j.name} | status=${j.status} | docId=${data.docId}`);
    });
} else {
    console.log('  No matching jobs found!');
    console.log('\n=== All jobs in queue ===');
    jobs.slice(0, 10).forEach(j => console.log(`  Job#${j.id} | status=${j.status} | name=${j.name}`));
}

process.exit(0);
