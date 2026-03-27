import { handleError } from '../utils/errorHandler.js';
import { knex } from '../db.js';
import { JOB_STATUS } from '../constants/status.js';
import { parseJsonObjectSafe } from '../utils/jsonSafe.js';

// --- Helper Functions ---
const isAdmin = (req) => String(req.user?.role || '').toLowerCase() === 'admin';
const isOwnerOrAdmin = (req, owner) => isAdmin(req) || (owner && req.user?.username === owner);

export const getOCRStatus = async (req, res) => {
    try {
        const counts = await knex('job_queue')
            .select('status')
            .count('id as count')
            .groupBy('status');

        const countsMap = {
            [JOB_STATUS.WAITING]: 0,
            [JOB_STATUS.ACTIVE]: 0,
            [JOB_STATUS.COMPLETED]: 0,
            [JOB_STATUS.FAILED]: 0
        };
        counts.forEach(c => {
            if (countsMap[c.status] !== undefined) countsMap[c.status] = parseInt(c.count, 10) || 0;
        });

        const activeJobs = await knex('job_queue')
            .whereIn('status', [JOB_STATUS.WAITING, JOB_STATUS.ACTIVE])
            .orderBy('created_at', 'asc')
            .limit(10);

        const activeJobsParsed = activeJobs.map(j => ({
            id: j.id,
            status: j.status,
            progress: j.progress || 0,
            data: parseJsonObjectSafe(j.data, {}),
            created_at: j.created_at
        }));

        res.json({
            counts: countsMap,
            activeJobs: activeJobsParsed
        });
    } catch (err) {
        console.error("[getOCRStatus] Error:", err);
        handleError(res, err, "OCR Error");
    }
};

export const getOCRQueue = async (req, res) => {
    try {
        const jobs = await knex('job_queue')
            .whereIn('status', [JOB_STATUS.WAITING, JOB_STATUS.ACTIVE])
            .orderBy('created_at', 'asc');

        const active = jobs.filter(j => j.status === JOB_STATUS.ACTIVE).map(j => ({
            ...j,
            data: parseJsonObjectSafe(j.data, {})
        }));

        const waiting = jobs.filter(j => j.status === JOB_STATUS.WAITING).map(j => ({
            ...j,
            data: parseJsonObjectSafe(j.data, {})
        }));

        res.json({
            active,
            waiting,
            total: jobs.length
        });
    } catch (err) {
        handleError(res, err, "OCR Error");
    }
};

export const getLaneLoad = async (req, res) => {
    try {
        const OCR_LANES = parseInt(process.env.OCR_LANES || '3', 10);
        const LANE_CAPACITY = parseInt(process.env.OCR_LANE_CAPACITY || '2', 10);

        // build lane names
        const laneNames = [];
        for (let i = 1; i <= OCR_LANES; i++) laneNames.push(`process-ocr-lane-${i}`);

        // query counts grouped by name
        const rows = await knex('job_queue')
            .select('name')
            .count('id as count')
            .whereIn('status', [JOB_STATUS.WAITING, JOB_STATUS.ACTIVE])
            .whereIn('name', laneNames)
            .groupBy('name');

        const counts = {};
        laneNames.forEach(n => counts[n] = 0);
        rows.forEach(r => { counts[r.name] = parseInt(r.count, 10) || 0; });

        // assemble response
        const lanes = laneNames.map((n, idx) => ({
            name: n,
            index: idx + 1,
            count: counts[n] || 0,
            capacity: LANE_CAPACITY,
            loadPct: Math.round(((counts[n] || 0) / Math.max(LANE_CAPACITY, 1)) * 100)
        }));

        res.json({ lanes, totalWaitingActive: Object.values(counts).reduce((a, b) => a + b, 0) });
    } catch (err) {
        console.error('[getLaneLoad] Error:', err);
        handleError(res, err, 'OCR Error');
    }
};

export const retryOCRJob = async (req, res) => {
    try {
        const { id } = req.params;

        // Get the job to check ownership
        const job = await knex('job_queue').where('id', id).first();
        if (!job) {
            return res.status(404).json({ error: "Job not found" });
        }

        // Check if user is owner or admin
        if (!isOwnerOrAdmin(req, job.owner)) {
            return res.status(403).json({ error: 'Hanya owner job atau admin yang dapat mengulang job ini' });
        }

        await knex('job_queue').where('id', id).update({
            status: JOB_STATUS.WAITING,
            progress: 0,
            error: null,
            processed_at: null,
            finished_at: null
        });
        res.json({ success: true });
    } catch (err) {
        handleError(res, err, "OCR Error");
    }
};

export const clearCompletedJobs = async (req, res) => {
    try {
        // Only admin can clear completed jobs (maintenance operation)
        if (!isAdmin(req)) {
            return res.status(403).json({ error: 'Hanya admin yang dapat menghapus jobs yang sudah selesai' });
        }

        await knex('job_queue').where('status', JOB_STATUS.COMPLETED).del();
        res.json({ success: true });
    } catch (err) {
        handleError(res, err, "OCR Error");
    }
};
