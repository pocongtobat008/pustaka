import { knex } from './db.js';
import { JOB_STATUS } from './constants/status.js';
import { parseJsonObjectSafe } from './utils/jsonSafe.js';

// Simple MySQL-based Queue Replacement for BullMQ
class DbQueue {
    constructor(name) {
        this.name = name;
    }

    async add(name, data, opts = {}) {
        const jobData = {
            name,
            data: JSON.stringify(data),
            status: JOB_STATUS.WAITING,
            created_at: knex.fn.now(),
            max_attempts: opts.max_attempts !== undefined ? opts.max_attempts : 3,
            retries: 0
        };
        try {
            console.log("Attempting to add job to queue with data:", jobData);
            const [id] = await knex('job_queue').insert(jobData);
            return { id, name, data };
        } catch (err) {
            console.error("Queue Add Error:", err.message);
            console.error("Job data that failed:", jobData);
            throw err;
        }
    }

    async getJobCounts() {
        try {
            const rows = await knex('job_queue')
                .select('status')
                .count('* as count')
                .groupBy('status');

            const counts = { active: 0, waiting: 0, completed: 0, failed: 0 };
            rows.forEach(r => {
                if (counts[r.status] !== undefined) counts[r.status] = r.count;
            });
            return counts;
        } catch (err) {
            console.error("Queue Counts Error:", err);
            return { active: 0, waiting: 0, completed: 0, failed: 0 };
        }
    }

    async getJobs(types, start, end, asc) {
        try {
            if (!types || types.length === 0) return [];

            const rows = await knex('job_queue')
                .whereIn('status', types)
                .orderBy('created_at', asc ? 'asc' : 'desc')
                .limit((end - start) + 1)
                .offset(start);

            return rows.map(r => ({
                id: r.id,
                data: parseJsonObjectSafe(r.data, {}),
                progress: r.progress || 0,
                status: r.status,
                finishedOn: r.finished_at ? new Date(r.finished_at).getTime() : null,
                error: r.error
            }));
        } catch (err) {
            console.error("Queue GetJobs Error:", err);
            return [];
        }
    }
}

export const ocrQueue = new DbQueue('OCR_QUEUE');

// Lane configuration: number of logical upload lanes and per-lane capacity
const OCR_LANES = parseInt(process.env.OCR_LANES || '3', 10);
const LANE_CAPACITY = parseInt(process.env.OCR_LANE_CAPACITY || '2', 10);

async function getLaneCounts() {
    // returns array of counts for lane indices 1..OCR_LANES
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
                if (r.name === laneName) counts[i-1] = parseInt(r.count, 10) || 0;
            }
        });
    } catch (e) {
        console.error('getLaneCounts error', e.message);
    }
    return counts;
}

// Helper to add jobs (with deduplication)
export const addOCRJob = async (docId, filePath, fileType, originalName, context = {}) => {
    try {
        // DEDUP CHECK: Skip if a job for this docId AND filePath is already waiting or active
        const existing = await knex('job_queue')
            .whereIn('status', [JOB_STATUS.WAITING, JOB_STATUS.ACTIVE])
            .where('data', 'like', `%"docId":"${docId}"%`)
            .where('data', 'like', `%"filePath":"${filePath.replace(/\\/g, '\\\\')}"%`)
            .first();

        if (existing) {
            console.log(`[Queue] DEDUP: Job for DocID ${docId} with same file path already in queue (Job #${existing.id}). Skipping.`);
            return {
                id: existing.id,
                name: 'process-ocr',
                data: parseJsonObjectSafe(existing.data, {}),
                deduplicated: true
            };
        }

        console.log(`[Queue] Adding Job for DocID: ${docId}, Type: ${context.type || 'document'}, File: ${originalName}`);

        return await ocrQueue.add('process-ocr', {
            docId,
            filePath,
            fileType,
            originalName,
            context
        });
    } catch (err) {
        console.error("AddOCRJob Error:", err);
        // Fallback or re-throw
        return null;
    }
};

export const addAiChatJob = async (message, history, user) => {
    try {
        console.log(`[Queue] Adding AI Chat Job for user: ${user}`);
        return await ocrQueue.add('ai-chat', {
            message,
            history,
            user
        }, { max_attempts: 1 }); // Chat doesn't usually need retries
    } catch (err) {
        console.error("AddAiChatJob Error:", err);
        return null;
    }
};

export const addAiEmbeddingJob = async (text, context = {}) => {
    try {
        console.log(`[Queue] Adding AI Embedding Job. Text snippet: ${text.substring(0, 30)}...`);
        return await ocrQueue.add('ai-embedding', {
            text,
            context
        });
    } catch (err) {
        console.error("AddAiEmbeddingJob Error:", err);
        return null;
    }
};

// Add OCR job with lane routing (3 lanes by default)
export const addOCRJobRouted = async (docId, filePath, fileType, originalName, context = {}) => {
    try {
        // Dedup check: skip if same doc/file already waiting/active
        const existing = await knex('job_queue')
            .whereIn('status', [JOB_STATUS.WAITING, JOB_STATUS.ACTIVE])
            .where('data', 'like', `%"docId":"${docId}"%`)
            .where('data', 'like', `%"filePath":"${filePath.replace(/\\/g, '\\\\')}"%`)
            .first();

        if (existing) {
            console.log(`[Queue] DEDUP: Job for DocID ${docId} with same file path already in queue (Job #${existing.id}). Skipping.`);
            return {
                id: existing.id,
                name: existing.name,
                data: parseJsonObjectSafe(existing.data, {}),
                deduplicated: true
            };
        }

        // Choose lane based on current load
        const counts = await getLaneCounts();
        let chosen = 0;
        // Prefer any lane below capacity
        for (let i = 0; i < counts.length; i++) {
            if (counts[i] < LANE_CAPACITY) { chosen = i; break; }
        }
        // If all lanes full, pick the least loaded
        if (chosen === 0 && counts.length > 0 && counts[0] >= LANE_CAPACITY) {
            let min = counts[0]; chosen = 0;
            for (let i = 1; i < counts.length; i++) {
                if (counts[i] < min) { min = counts[i]; chosen = i; }
            }
        }
        const laneIndex = (chosen === 0 && counts.length > 0 && counts[0] < LANE_CAPACITY) ? chosen : chosen;
        const laneNumber = Math.min(Math.max(laneIndex + 1, 1), OCR_LANES);
        const jobName = `process-ocr-lane-${laneNumber}`;

        console.log(`[Queue] Routing OCR Job to ${jobName}. Lane counts: ${counts.join(',')}`);

        return await ocrQueue.add(jobName, {
            docId,
            filePath,
            fileType,
            originalName,
            context
        });
    } catch (err) {
        console.error('AddOCRJobRouted Error:', err.message);
        return null;
    }
};
