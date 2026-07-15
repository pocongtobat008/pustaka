import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { logger } from './logger.js';
import { knex } from '../db.js';
import { JOB_STATUS } from '../constants/status.js';

// Global flag to indicate if Redis is available
export let USE_BULLMQ = false;

// Initialize Redis Connection (with short timeout to fail fast if unavailable)
export const connection = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null,
    connectTimeout: 2000,
    retryStrategy: function (times) {
        // Do not reconnect automatically if initial connection fails
        return null;
    }
});

connection.on('error', (err) => {
    if (err.code === 'ECONNREFUSED') {
        if (USE_BULLMQ) {
            logger.warn('[Queue] Redis connection lost! Reverting to database polling.');
        } else {
            logger.info('[Queue] Redis unavailable, formatting to MySQL Polling framework.');
        }
        USE_BULLMQ = false;
    } else {
        logger.error(`[Queue] Redis error: ${err.message}`, { err });
    }
});

connection.on('ready', () => {
    logger.info('[Queue] Connected to Redis. BullMQ initialized.');
    USE_BULLMQ = true;
});

// Create BullMQ Queue Instance
export const ocrQueue = new Queue('ocr-processor', { connection });

// Tangani error pada instance Queue agar tidak muncul stack trace di konsol saat Redis mati
ocrQueue.on('error', () => { /* Error koneksi sudah ditangani oleh listener 'connection' */ });

/**
 * Universal addJob function.
 * If Redis is active, it adds a BullMQ job.
 * If not, the function does nothing because legacy Polling will automatically pick it up
 * from the database 'processing' status.
 */
export const addOcrJob = async (docId, filename, contextStr, fileType = '', originalName = '', fileSize = 0) => {
    const jobData = {
        docId,
        filename,
        fileType,
        originalName,
        fileSize,
        context: contextStr
    };

    const isPdf = fileType === 'application/pdf' || (filename && filename.toLowerCase().endsWith('.pdf'));
    // HEAVY: PDF atau Gambar > 2.5MB
    const isHeavy = isPdf || fileSize > 2.5 * 1024 * 1024;
    const lane = isHeavy ? 'HEAVY (MySQL Polling)' : 'FAST (BullMQ)';

    // Lane settings for MySQL-based polling
    const OCR_LANES = parseInt(process.env.OCR_LANES || '3', 10);
    const LANE_CAPACITY = parseInt(process.env.OCR_LANE_CAPACITY || '2', 10);

    async function getLaneCounts() {
        const counts = new Array(OCR_LANES).fill(0);
        try {
            const rows = await knex('job_queue')
                .select('name')
                .count('* as count')
                .whereIn('status', [JOB_STATUS.WAITING, JOB_STATUS.ACTIVE])
                .groupBy('name');
            rows.forEach(r => {
                for (let i = 1; i <= OCR_LANES; i++) {
                    const laneName = `process-ocr-lane-${i}`;
                    if (r.name === laneName) counts[i - 1] = parseInt(r.count, 10) || 0;
                }
            });
        } catch (e) {
            logger.error('getLaneCounts error: ' + e.message);
        }
        return counts;
    }

    // OCR Jobs should ALWAYS go through MySQL Polling for visibility in the OCR Monitor
    // unless explicitly non-OCR (like AI Chat).
    const forcePolling = true;

    if (USE_BULLMQ && !isHeavy && !forcePolling) {
        try {
            await ocrQueue.add(contextStr, jobData);
            logger.info(`[Queue] [${lane}] Job added to BullMQ: ${docId}`, { contextStr });
        } catch (error) {
            logger.error(`[Queue] Failed to add job to BullMQ: ${error.message}`);
        }
    } else {
        try {
            // choose lane for MySQL polling jobs
            const counts = await getLaneCounts();
            // pick first lane below capacity, otherwise the least loaded
            let chosen = 0;
            for (let i = 0; i < counts.length; i++) {
                if (counts[i] < LANE_CAPACITY) { chosen = i; break; }
            }
            if (counts[0] >= LANE_CAPACITY) {
                let min = counts[0]; chosen = 0;
                for (let i = 1; i < counts.length; i++) {
                    if (counts[i] < min) { min = counts[i]; chosen = i; }
                }
            }
            const laneNumber = Math.min(Math.max(chosen + 1, 1), OCR_LANES);
            const laneName = `process-ocr-lane-${laneNumber}`;

            await knex('job_queue').insert({
                name: laneName,
                data: JSON.stringify(jobData),
                status: JOB_STATUS.WAITING,
                created_at: knex.fn.now()
            });
            logger.info(`[Queue] [${lane}] Job registered in MySQL -> ${laneName}: ${docId}`);
        } catch (error) {
            logger.error(`[Queue] Gagal memasukkan job ke MySQL: ${error.message}`);
        }
    }
};

// ── Cache Warmer Job ──
export const addCacheWarmJob = async () => {
    try {
        console.log('[Queue] Adding Cache Warm Job');
        if (USE_BULLMQ) {
            return await ocrQueue.add('cache-warm', {}, { max_attempts: 1 });
        }
        // Fallback: insert into job_queue for MySQL polling
        const [res] = await knex('job_queue').insert({
            name: 'cache-warm',
            data: JSON.stringify({}),
            status: JOB_STATUS.WAITING,
            created_at: knex.fn.now(),
            max_attempts: 1,
            retries: 0
        }).returning('id');
        const id = typeof res === 'object' ? res.id : res;
        return { id, name: 'cache-warm', data: {} };
    } catch (err) {
        console.error("AddCacheWarmJob Error:", err);
        return null;
    }
};

// ── Setup repeatable cache warm job (called on worker start) ──
export const setupCacheWarmSchedule = async () => {
    if (!USE_BULLMQ) {
        console.log('[Queue] Redis unavailable, cache warm schedule skipped (will use DB polling fallback)');
        return;
    }
    try {
        // Remove existing repeatable jobs first
        const existingJobs = await ocrQueue.getJobSchedulers();
        for (const job of existingJobs) {
            if (job.name === 'cache-warm') {
                await ocrQueue.removeJobScheduler(job.id);
                console.log(`[Queue] Removed old cache-warm scheduler: ${job.id}`);
            }
        }

        // Get config from ai_settings
        const settings = await knex('ai_settings').where('id', 1).first();
        let meta = {};
        try { meta = JSON.parse(settings?.meta || '{}'); } catch { meta = {}; }

        const enabled = meta.cache_warm_enabled !== false;
        const intervalHours = meta.cache_warm_interval_hours || 6;

        if (!enabled) {
            console.log('[Queue] Cache warming disabled in settings');
            return;
        }

        // Create repeatable job with cron expression
        const cronExpr = `0 */${intervalHours} * * *`; // e.g., "0 */6 * * *"
        await ocrQueue.add('cache-warm', {}, {
            repeat: { cron: cronExpr },
            max_attempts: 1,
            jobId: 'cache-warm-scheduled',
        });
        console.log(`[Queue] Cache warm schedule active: ${cronExpr} (every ${intervalHours}h)`);
    } catch (err) {
        console.error(`[Queue] Failed to setup cache warm schedule: ${err.message}`);
    }
};
