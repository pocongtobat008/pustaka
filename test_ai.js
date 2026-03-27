import { initDb } from './server/db.js';

import('./server/ai_search.js').then(async (m) => {
    console.log('AI Module imported successfully!');
    try {
        await initDb();
        console.log('DB init ok!');
        await m.vectorStore.initialize({ lazy: false, batchSize: 250 });
        console.log('Vector store initialized');
    } catch (e) {
        console.error('Vector Error:', e);
    }
}).catch(e => console.error('IMPORT ERROR:', e));
