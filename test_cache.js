import { cache } from '../server/utils/cache.js';
import { logger } from '../server/utils/logger.js';
import dotenv from 'dotenv';
dotenv.config();

async function verifyCache() {
    console.log("--- Redis Cache Verification ---");

    // 1. Test Set
    console.log("Setting test key...");
    await cache.set('test_connection', { ok: true, timestamp: Date.now() }, 60);

    // 2. Test Get
    console.log("Getting test key...");
    const val = await cache.get('test_connection');

    if (val && val.ok) {
        console.log("✅ Redis Caching is WORKING!");
        console.log("Retrieved value:", val);
    } else {
        console.warn("⚠️ Redis Caching is NOT returning data. (Is Redis running?)");
        console.log("Got value:", val);
    }

    // 3. Test Delete
    console.log("Deleting test key...");
    await cache.del('test_connection');
    const val2 = await cache.get('test_connection');
    if (!val2) {
        console.log("✅ Redis Deassertion is WORKING!");
    }

    process.exit(0);
}

verifyCache().catch(err => {
    console.error("❌ Verification Failed:", err);
    process.exit(1);
});
