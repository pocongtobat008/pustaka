console.log('[index.js] Top of file');
import 'dotenv/config';

try {
    const dbHost = process.env.DB_HOST;
    if (dbHost) {
        console.log(`[index.js] dotenv loaded. DB_HOST: ${dbHost}`);
    } else {
        console.warn('[index.js] WARNING: dotenv might not have loaded correctly. DB_HOST is undefined.');
    }
} catch (e) { console.error('[index.js] Error checking env vars:', e); }

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { knex, initDb } from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { Server } from 'socket.io'; // Still need IO for real-time?

// Import Routes
import authRoutes from './routes/authRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import workflowRoutes from './routes/workflowRoutes.js';
import taxRoutes from './routes/taxRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import ocrRoutes from './routes/ocrRoutes.js';
import pustakaRoutes from './routes/pustakaRoutes.js';
import systemRoutes from './routes/systemRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import legacyRoutes from './routes/legacyRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import { startBrainAutoSyncScheduler } from './controllers/brainController.js';
import coaRoutes from './routes/coaRoutes.js';
import entertainmentRoutes from './routes/entertainmentRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import anydocRoutes from './routes/anydocRoutes.js';
import pdfTemplateRoutes from './routes/pdfTemplateRoutes.js';
import pdfToolsRoutes from './routes/pdfToolsRoutes.js';
import { getHealthStatus } from './services/healthCheck.js';

import { checkAuth } from './middleware/auth.js';
import { UPLOADS_DIR, upload } from './config/upload.js';
import { logger } from './utils/logger.js';
import { parseJsonArraySafe, parseJsonObjectSafe } from './utils/jsonSafe.js';
import {
    validateRequestBody,
    jobCreateSchema,
    jobUpdateSchema,
    monitoredPicUpsertSchema,
    independentIssueCreateSchema,
    independentIssueUpdateSchema,
    sopFlowCreateSchema,
    sopFlowUpdateSchema
} from './utils/requestValidation.js';
import { uploadDocument } from './controllers/documentController.js';

// Setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pastikan direktori logs ada sebelum server berjalan
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const app = express();

// ── Keamanan: percayai proxy terdekat (Vite dev/preview) yang meneruskan IP asli via X-Forwarded-For ──
app.set('trust proxy', 1);

// ── Keamanan: security headers (helmet) — CSP dinonaktifkan karena aplikasi memakai banyak style inline ──
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ── Keamanan: rate limiting global (anti-DDoS) ──
// Berlaku untuk SEMUA request /api. IP diambil dari X-Forwarded-For yang diisi Vite proxy.
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 menit
    limit: 600,               // maks 600 request per IP per jendela
    standardHeaders: true,    // X-RateLimit-* headers
    legacyHeaders: false,
    skip: (req) => req.path === '/api/health',
    message: { error: 'Terlalu banyak permintaan. Coba lagi nanti.' },
});

// Limiter ketat untuk endpoint login (anti-bruteforce)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,                // maks 10 percobaan login per IP per 15 menit
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Terlalu banyak percobaan login. Tunggu 15 menit.' },
});

// Limiter untuk AI agent (endpoint mahal — batasi pemakaian)
const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Terlalu banyak permintaan AI. Coba lagi nanti.' },
});
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
app.set('io', io);

const channelLabelMap = {
    inventory: 'Inventory',
    documents: 'Dokumen',
    tax: 'Pajak',
    approvals: 'Approval',
    system: 'Sistem',
    users: 'Pengguna',
    jobs: 'Job Queue',
    pustaka: 'Pustaka',
    'sop-flows': 'SOP',
    'tax-monitoring': 'Tax Monitoring',
    'tax-summary': 'Tax Summary',
    notifications: 'Notifikasi',
    coa: 'COA (Book)'
};

const lastAutoNotificationByKey = new Map();
const AUTO_NOTIFICATION_THROTTLE_MS = 5000;
const rawIoEmit = io.emit.bind(io);

const createAutoNotificationFromDataChange = async (payload) => {
    const channel = payload?.channel;
    if (!channel || channel === 'notifications') return;

    const targetType = payload?.targetType || 'general';
    const targetValue = payload?.targetValue || null;
    const throttleKey = `${channel}:${targetType}:${targetValue || 'all'}`;
    const now = Date.now();
    const lastAt = lastAutoNotificationByKey.get(throttleKey) || 0;

    if (now - lastAt < AUTO_NOTIFICATION_THROTTLE_MS) return;
    lastAutoNotificationByKey.set(throttleKey, now);

    const label = channelLabelMap[channel] || channel;
    const title = `Update ${label}`;
    const message = payload?.message || `Ada perubahan data pada modul ${label}.`;
    const type = payload?.type || 'info';

    const [dbRes] = await knex('notifications').insert({
        title,
        message,
        type,
        channel,
        target_type: targetType,
        target_value: targetValue,
        created_by: payload?.actor || 'System',
        meta: JSON.stringify({ source: 'auto:data-changed', channel }),
        created_at: knex.fn.now()
    }).returning('id');

    const id = typeof dbRes === 'object' ? dbRes.id : dbRes;

    rawIoEmit('notification:new', {
        id,
        title,
        message,
        type,
        channel,
        targetType,
        targetValue
    });
    rawIoEmit('data:changed', { channel: 'notifications' });
};

io.emit = (event, payload) => {
    if (event === 'data:changed') {
        createAutoNotificationFromDataChange(payload).catch((err) => {
            logger.warn(`[Notifications] Auto-create failed: ${err.message}`);
        });
    }
    return rawIoEmit(event, payload);
};

// Port - dapat di-override via env (produksi: 5005, dev: 5006)
const PORT = Number(process.env.PORT) || 5005;

// Middleware
app.use(cookieParser());
// ── Keamanan: CORS ketat — hanya origin yang diizinkan (via env CORS_ORIGINS, koma) ──
const configuredOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const defaultOrigins = [
    'http://localhost:5173', 'http://127.0.0.1:5173',
    'http://localhost:5174', 'http://127.0.0.1:5174',
    'http://localhost:3000',
    'https://pustaka.izal.my.id', 'http://pustaka.izal.my.id',
];
const allowedOrigins = [...new Set([...defaultOrigins, ...configuredOrigins])];

app.use(cors({
    origin: (origin, callback) => {
        // Request tanpa Origin (curl, mobile, health-check) — izinkan
        if (!origin) return callback(null, true);
        // Izinkan bila ada di daftar, atau IP lokal di network (dev)
        const isAllowed = allowedOrigins.includes(origin) ||
            /^http:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:(5173|5174)$/.test(origin);
        callback(null, isAllowed);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// ── Keamanan: rate limiting per rute ──
app.use('/api', apiLimiter); // semua /api dibatasi (anti-DDoS)
app.use('/api/login', loginLimiter); // login dibatasi ketat (anti-bruteforce)
app.use('/api/ai', aiLimiter); // endpoint AI dibatasi (mencegah penyalahgunaan LLM)

// Gunakan Morgan untuk log HTTP request ke konsol
const skipLogPaths = ['/uploads', '/api/ocr/status', '/api/ocr/queue', '/api/pustaka/guides', '/api/pustaka/categories', '/api/logs'];
app.use(morgan('dev', {
    skip: (req, res) => skipLogPaths.some(path => req.originalUrl.includes(path)),
    stream: { write: message => logger.info(message.trim()) }
}));

app.use(bodyParser.json({ limit: '25mb' }));
app.use(bodyParser.urlencoded({ limit: '25mb', extended: true }));

// ── Public health-check endpoint (no auth — for monitoring/uptime tools) ──
// Registered BEFORE all other /api routers so it is never shadowed.
app.get('/api/health', async (req, res) => {
    try {
        const status = await getHealthStatus();
        const httpCode = status.status === 'ok' ? 200 : status.status === 'degraded' ? 200 : 503;
        res.status(httpCode).json(status);
    } catch (e) {
        res.status(503).json({ status: 'critical', error: e.message, timestamp: new Date().toISOString() });
    }
});

// Database Check
// --- ROUTES ---
// import systemRoutes moved to top

// ...

app.use('/api', authRoutes); // /api/login, /api/users
app.use('/api', systemRoutes); // /api/logs, /api/roles, /api/departments, /api/folders
app.use('/api', notificationRoutes); // /api/notifications
app.use('/api', settingsRoutes); // /api/settings/ai
app.use('/api', aiRoutes); // /api/ai/agent
app.use('/api/anydoc', anydocRoutes); // /api/anydoc/convert

app.get('/api/system/ai-status', checkAuth, async (req, res) => {
    // API should not have its own vectorStore in microservice mode.
    // Fetch from a shared source (like Redis) or just return a static 'Online/Worker-Led' status
    res.json({
        vectorStore: {
            status: 'Isolated Process (Worker-Led)',
            message: 'AI Search is handled by the dedicated background worker.'
        }
    });
});

const isAdminUser = (req) => String(req.user?.role || '').toLowerCase() === 'admin';
const isOwnerOrAdmin = (req, owner) => isAdminUser(req) || (owner && req.user?.username === owner);

// --- APPROVALS ROUTES (Override Legacy) ---
app.get('/api/approvals', checkAuth, async (req, res) => {
    try {
        logger.info(`Fetching approvals for user: ${req.user?.username}`);
        // Ambil data dari tabel document_approvals (sesuai migrasi)
        const approvals = await knex('document_approvals').select('*').orderBy('created_at', 'desc');

        // Ambil steps secara relasional untuk setiap approval
        const results = await Promise.all(approvals.map(async (app) => {
            const steps = await knex('approval_steps')
                .where('approval_id', app.id)
                .orderBy('step_index', 'asc');
            return { ...app, steps };
        }));

        res.json(results);
    } catch (err) {
        console.error("Error fetching approvals:", err);
        res.status(500).json({ error: `Gagal mengambil data approval: ${err.message}` });
    }
});

app.post('/api/approvals', checkAuth, async (req, res) => {
    const trx = await knex.transaction();
    try {
        logger.info(`User ${req.user?.username} is creating a new approval`);
        const { title, description, division, requester_name, requester_username, attachment_url, attachment_name, flow_id, steps, ocr_content } = req.body;

        // 1. Simpan ke tabel induk document_approvals
        const [dbRes] = await trx('document_approvals').insert({
            title, description, division, requester_name, requester_username,
            attachment_url, attachment_name, ocr_content, flow_id,
            status: 'Pending',
            current_step_index: 0,
            created_at: new Date()
        }).returning('id');

        const id = typeof dbRes === 'object' ? dbRes.id : dbRes;

        // 2. Simpan steps ke tabel approval_steps secara relasional
        if (steps && steps.length > 0) {
            const stepsToInsert = steps.map((s, idx) => ({
                approval_id: id,
                approver_name: s.name,
                approver_username: s.username,
                step_index: idx,
                status: 'Pending',
                note: '',
                node_id: s.nodeId || null,
                instruction: s.instruction || ''
            }));
            await trx('approval_steps').insert(stepsToInsert);
        }

        await trx.commit();
        io.emit('data:changed', { channel: 'approvals' });
        res.json({ id, message: 'Pengajuan berhasil dibuat' });
    } catch (err) {
        await trx.rollback();
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/approvals/:id', checkAuth, async (req, res) => {
    const { id } = req.params;
    const trx = await knex.transaction();
    try {
        const { title, description, division, attachment_url, attachment_name, flow_id, steps } = req.body;

        // Update tabel induk
        await trx('document_approvals').where({ id }).update({
            title, description, division, attachment_url, attachment_name, flow_id,
            updated_at: new Date()
        });

        // Refresh steps: Hapus yang lama, masukkan yang baru
        if (steps) {
            await trx('approval_steps').where({ approval_id: id }).delete();
            const stepsToInsert = steps.map((s, idx) => ({
                approval_id: id,
                approver_name: s.name,
                approver_username: s.username,
                step_index: idx,
                status: 'Pending',
                note: '',
                node_id: s.nodeId || null,
                instruction: s.instruction || ''
            }));
            await trx('approval_steps').insert(stepsToInsert);
        }

        await trx.commit();
        io.emit('data:changed', { channel: 'approvals' });
        res.json({ message: 'Pengajuan berhasil diperbarui' });
    } catch (err) {
        await trx.rollback();
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/approvals/:id/action', checkAuth, upload.single('file'), async (req, res) => {
    const { id } = req.params;
    const { action, note, username, attachment_url, attachment_name } = req.body;
    const file = req.file;

    const trx = await knex.transaction();
    try {
        const approval = await trx('document_approvals').where({ id }).first();
        if (!approval) throw new Error("Pengajuan tidak ditemukan");

        const steps = await trx('approval_steps').where({ approval_id: id }).orderBy('step_index', 'asc');
        const currentStep = steps[approval.current_step_index];

        if (!currentStep || currentStep.approver_username !== username) {
            throw new Error("Anda bukan approver untuk tahap ini");
        }

        // Update status step saat ini
        await trx('approval_steps').where({ id: currentStep.id }).update({
            status: action === 'Approve' ? 'Approved' : 'Rejected',
            note: note || '',
            action_date: new Date(),
            attachment_url: attachment_url || (file ? `/uploads/${file.filename}` : currentStep.attachment_url),
            attachment_name: attachment_name || (file ? file.originalname : currentStep.attachment_name)
        });

        // Update status induk dan index step
        if (action === 'Reject') {
            await trx('document_approvals').where({ id }).update({ status: 'Rejected' });
        } else {
            if (approval.current_step_index === steps.length - 1) {
                await trx('document_approvals').where({ id }).update({ status: 'Approved' });
            } else {
                await trx('document_approvals').where({ id }).update({
                    current_step_index: approval.current_step_index + 1
                });
            }
        }

        await trx.commit();
        io.emit('data:changed', { channel: 'approvals' });
        res.json({ message: `Berhasil ${action === 'Approve' ? 'menyetujui' : 'menolak'} pengajuan` });
    } catch (err) {
        await trx.rollback();
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/approvals/:id/reset-step', checkAuth, async (req, res) => {
    const { id } = req.params;
    const { stepIndex } = req.body;
    const trx = await knex.transaction();
    try {
        const approval = await trx('document_approvals').where({ id }).first();
        if (!approval) throw new Error("Pengajuan tidak ditemukan");

        // Reset status step terpilih dan semua step setelahnya menjadi Pending
        await trx('approval_steps')
            .where('approval_id', id)
            .andWhere('step_index', '>=', stepIndex)
            .update({
                status: 'Pending',
                note: '',
                action_date: null,
                attachment_url: null,
                attachment_name: null
            });

        // Kembalikan status induk ke Pending dan arahkan index ke step yang di-reset
        await trx('document_approvals').where({ id }).update({
            status: 'Pending',
            current_step_index: stepIndex,
            updated_at: new Date()
        });

        await trx.commit();
        io.emit('data:changed', { channel: 'approvals' });
        res.json({ message: 'Berhasil menarik kembali keputusan. Alur diulang dari tahap ini.' });
    } catch (err) {
        await trx.rollback();
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/approvals/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;
        await knex('document_approvals').where({ id }).delete();
        io.emit('data:changed', { channel: 'approvals' });
        res.json({ message: 'Pengajuan berhasil dihapus' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ENTERTAINMENT EXPENSES ROUTES ---
const parseJsonField = (val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
        try { return JSON.parse(val); } catch { return val; }
    }
    return val || [];
};

app.get('/api/entertainment-expenses', checkAuth, async (req, res) => {
    try {
        let query = knex('entertainment_expenses');
        const isAdmin = isAdminUser(req);
        const username = req.user?.username;
        const userDept = req.user?.department;

        if (!isAdmin) {
            query = query.where(function() {
                this.where('privacy_type', 'public')
                    .orWhere('requester_username', username)
                    .orWhere(function() {
                        this.where('privacy_type', 'department')
                            .andWhere('allowed_departments', 'like', `%${userDept}%`);
                    })
                    .orWhere(function() {
                        this.where('privacy_type', 'specific_users')
                            .andWhere('allowed_users', 'like', `%${username}%`);
                    });
            });
        }

        const rows = await query.orderBy('created_at', 'desc');
        const results = rows.map(r => ({
            ...r,
            relasi: parseJsonField(r.relasi),
            attachments: parseJsonField(r.attachments),
            allowed_departments: parseJsonField(r.allowed_departments),
            allowed_users: parseJsonField(r.allowed_users),
            nilai: parseFloat(r.nilai || 0)
        }));
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/entertainment-expenses', checkAuth, upload.array('files', 10), async (req, res) => {
    try {
        const files = req.files || [];
        const body = req.body;
        const relasi = parseJsonField(body.relasi);
        const jumlahRelasi = Array.isArray(relasi) ? relasi.length : 0;

        const attachments = files.map(f => ({
            filename: f.filename,
            originalname: f.originalname,
            mimetype: f.mimetype,
            size: f.size,
            url: `/uploads/${f.filename}`,
            preview_url: f.mimetype.startsWith('image/') ? `/uploads/${f.filename}` : null
        }));

        const allowedDepts = parseJsonField(body.allowed_departments);
        const allowedUsers = parseJsonField(body.allowed_users);

        const [dbRes] = await knex('entertainment_expenses').insert({
            tanggal: body.tanggal || new Date().toISOString().split('T')[0],
            tempat: body.tempat,
            alamat: body.alamat,
            jenis: body.jenis,
            custom_jenis: body.jenis === 'Custom' ? body.custom_jenis : null,
            nilai: parseFloat(body.nilai || 0),
            no_gl: body.no_gl,
            relasi: JSON.stringify(relasi),
            jumlah_relasi: jumlahRelasi,
            catatan_kode: body.catatan_kode,
            attachments: JSON.stringify(attachments),
            privacy_type: body.privacy_type || 'public',
            allowed_departments: JSON.stringify(Array.isArray(allowedDepts) ? allowedDepts : []),
            allowed_users: JSON.stringify(Array.isArray(allowedUsers) ? allowedUsers : []),
            owner: req.user?.username,
            requester_name: req.user?.name,
            requester_username: req.user?.username,
            status: 'active',
            created_at: new Date(),
            updated_at: new Date()
        }).returning('id');

        const id = typeof dbRes === 'object' ? dbRes.id : dbRes;
        io.emit('data:changed', { channel: 'entertainment-expenses' });
        res.json({ id, message: 'Pengeluaran berhasil disimpan' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/entertainment-expenses/:id', checkAuth, upload.array('files', 10), async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await knex('entertainment_expenses').where({ id }).first();
        if (!existing) return res.status(404).json({ error: 'Data tidak ditemukan' });

        const isAdmin = isAdminUser(req);
        if (!isAdmin && existing.requester_username !== req.user?.username) {
            return res.status(403).json({ error: 'Anda tidak memiliki akses untuk mengedit data ini' });
        }

        const files = req.files || [];
        const body = req.body;
        const relasi = parseJsonField(body.relasi);
        const jumlahRelasi = Array.isArray(relasi) ? relasi.length : 0;

        let attachments = parseJsonField(existing.attachments || '[]');
        const newFiles = files.map(f => ({
            filename: f.filename,
            originalname: f.originalname,
            mimetype: f.mimetype,
            size: f.size,
            url: `/uploads/${f.filename}`,
            preview_url: f.mimetype.startsWith('image/') ? `/uploads/${f.filename}` : null
        }));
        attachments = [...attachments, ...newFiles];

        const allowedDepts = parseJsonField(body.allowed_departments);
        const allowedUsers = parseJsonField(body.allowed_users);

        await knex('entertainment_expenses').where({ id }).update({
            tanggal: body.tanggal || existing.tanggal,
            tempat: body.tempat || existing.tempat,
            alamat: body.alamat || existing.alamat,
            jenis: body.jenis || existing.jenis,
            custom_jenis: (body.jenis || existing.jenis) === 'Custom' ? (body.custom_jenis || existing.custom_jenis) : null,
            nilai: body.nilai !== undefined ? parseFloat(body.nilai) : existing.nilai,
            no_gl: body.no_gl || existing.no_gl,
            relasi: JSON.stringify(relasi),
            jumlah_relasi: jumlahRelasi,
            catatan_kode: body.catatan_kode || existing.catatan_kode,
            attachments: JSON.stringify(attachments),
            privacy_type: body.privacy_type || existing.privacy_type,
            allowed_departments: JSON.stringify(Array.isArray(allowedDepts) ? allowedDepts : parseJsonField(existing.allowed_departments)),
            allowed_users: JSON.stringify(Array.isArray(allowedUsers) ? allowedUsers : parseJsonField(existing.allowed_users)),
            updated_at: new Date()
        });

        io.emit('data:changed', { channel: 'entertainment-expenses' });
        res.json({ message: 'Data berhasil diperbarui' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/entertainment-expenses/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await knex('entertainment_expenses').where({ id }).first();
        if (!existing) return res.status(404).json({ error: 'Data tidak ditemukan' });
        if (!isAdminUser(req) && existing.requester_username !== req.user?.username) {
            return res.status(403).json({ error: 'Akses ditolak' });
        }
        await knex('entertainment_expenses').where({ id }).delete();
        io.emit('data:changed', { channel: 'entertainment-expenses' });
        res.json({ message: 'Data berhasil dihapus' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/entertainment-expenses/:id/attachments/:index', checkAuth, async (req, res) => {
    try {
        const { id, index } = req.params;
        const existing = await knex('entertainment_expenses').where({ id }).first();
        if (!existing) return res.status(404).json({ error: 'Data tidak ditemukan' });

        const isAdmin = isAdminUser(req);
        if (!isAdmin && existing.requester_username !== req.user?.username) {
            return res.status(403).json({ error: 'Akses ditolak' });
        }

        let attachments = parseJsonField(existing.attachments || '[]');
        const idx = parseInt(index, 10);
        if (isNaN(idx) || idx < 0 || idx >= attachments.length) {
            return res.status(400).json({ error: 'Index lampiran tidak valid' });
        }
        attachments.splice(idx, 1);
        await knex('entertainment_expenses').where({ id }).update({
            attachments: JSON.stringify(attachments),
            updated_at: new Date()
        });
        io.emit('data:changed', { channel: 'entertainment-expenses' });
        res.json({ message: 'Lampiran berhasil dihapus' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- JOB MONITORING ROUTES ---
app.get('/api/jobs', checkAuth, async (req, res) => {
    try {
        const jobs = await knex('job_due_dates').select('*').orderBy('created_at', 'desc');
        const parsed = jobs.map(j => ({
            ...j,
            allowedUsers: parseJsonArraySafe(j.allowed_users),
            allowedDepts: parseJsonArraySafe(j.allowed_depts),
            issues: parseJsonArraySafe(j.issues),
            completedMonths: parseJsonArraySafe(j.completed_months),
            assignedTo: j.assigned_to,
            dueDate: j.due_date,
            targetDept: j.target_dept,
            completedAt: j.completed_at
        }));
        res.json(parsed);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/jobs', checkAuth, async (req, res) => {
    try {
        const data = validateRequestBody(jobCreateSchema, req, res);
        if (!data) return;

        const completedMonths = Array.isArray(data.completedMonths)
            ? data.completedMonths
            : (typeof data.completed_months === 'string'
                ? parseJsonArraySafe(data.completed_months)
                : []);
        const [dbRes] = await knex('job_due_dates').insert({
            title: data.title,
            due_date: data.dueDate,
            assigned_to: data.assignedTo,
            privacy: data.privacy || 'public',
            allowed_users: JSON.stringify(data.allowedUsers || []),
            allowed_depts: JSON.stringify(data.allowedDepts || []),
            type: data.type || 'special',
            target_dept: data.targetDept,
            owner: req.user?.username || data.owner,
            status: data.status || 'pending',
            completed_months: JSON.stringify(completedMonths),
            issues: JSON.stringify(data.issues || []),
            kendala: data.kendala,
            created_at: new Date(),
            updated_at: new Date()
        }).returning('id');
        const id = typeof dbRes === 'object' ? dbRes.id : dbRes;
        io.emit('data:changed', { channel: 'jobs' });
        res.json({ id, message: 'Jadwal berhasil dibuat' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/jobs/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const data = validateRequestBody(jobUpdateSchema, req, res);
        if (!data) return;

        const existing = await knex('job_due_dates').where({ id }).first();
        if (!existing) return res.status(404).json({ error: 'Jadwal tidak ditemukan' });

        // Check if user is owner or admin for ANY update
        if (!isOwnerOrAdmin(req, existing.owner)) {
            return res.status(403).json({ error: 'Hanya owner My Job atau admin yang dapat mengubah jadwal ini' });
        }

        const updateData = { updated_at: new Date() };

        if (data.title !== undefined) updateData.title = data.title;
        if (data.dueDate !== undefined) updateData.due_date = data.dueDate;
        if (data.assignedTo !== undefined) updateData.assigned_to = data.assignedTo;
        if (data.privacy !== undefined) updateData.privacy = data.privacy;
        if (data.allowedUsers !== undefined) updateData.allowed_users = JSON.stringify(data.allowedUsers || []);
        if (data.allowedDepts !== undefined) updateData.allowed_depts = JSON.stringify(data.allowedDepts || []);
        if (data.type !== undefined) updateData.type = data.type;
        if (data.targetDept !== undefined) updateData.target_dept = data.targetDept;
        if (data.status !== undefined) updateData.status = data.status;
        if (data.completedAt !== undefined) updateData.completed_at = data.completedAt;
        if (data.issues !== undefined) updateData.issues = JSON.stringify(data.issues || []);
        if (data.kendala !== undefined) updateData.kendala = data.kendala;

        if (data.completedMonths !== undefined) {
            updateData.completed_months = JSON.stringify(Array.isArray(data.completedMonths) ? data.completedMonths : []);
        } else if (data.completed_months !== undefined) {
            if (typeof data.completed_months === 'string') {
                updateData.completed_months = data.completed_months;
            } else {
                updateData.completed_months = JSON.stringify(Array.isArray(data.completed_months) ? data.completed_months : []);
            }
        }

        await knex('job_due_dates').where({ id }).update(updateData);
        io.emit('data:changed', { channel: 'jobs' });
        res.json({ message: 'Jadwal berhasil diperbarui' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/jobs/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await knex('job_due_dates').where({ id }).first();

        if (!existing) {
            return res.status(404).json({ error: 'Jadwal tidak ditemukan' });
        }

        // Check if user is owner or admin
        if (!isOwnerOrAdmin(req, existing.owner)) {
            return res.status(403).json({ error: 'Hanya owner My Job atau admin yang dapat menghapus jadwal ini' });
        }

        await knex('job_due_dates').where({ id }).delete();
        io.emit('data:changed', { channel: 'jobs' });
        res.json({ message: 'Jadwal berhasil dihapus' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/monitored-pics', checkAuth, async (req, res) => {
    try {
        const pics = await knex('monitored_pics').select('*');
        const parsed = pics.map(p => ({
            ...p,
            allowedUsers: parseJsonArraySafe(p.allowed_users),
            allowedDepts: parseJsonArraySafe(p.allowed_depts)
        }));
        res.json(parsed);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/monitored-pics', checkAuth, async (req, res) => {
    try {
        const data = validateRequestBody(monitoredPicUpsertSchema, req, res);
        if (!data) return;

        const existing = await knex('monitored_pics').where({ username: data.username }).first();
        const picOwner = existing?.username || data.username;
        if (!isAdminUser(req) && req.user?.username !== picOwner) {
            return res.status(403).json({ error: 'Hanya owner PIC atau admin yang dapat mengubah pengaturan privasi' });
        }

        await knex('monitored_pics').insert({
            username: data.username,
            privacy: data.privacy || 'public',
            allowed_users: JSON.stringify(data.allowedUsers || []),
            allowed_depts: JSON.stringify(data.allowedDepts || []),
            created_at: new Date(),
            updated_at: new Date()
        }).onConflict('username').merge();
        io.emit('data:changed', { channel: 'monitored-pics' });
        res.json({ message: 'PIC Monitoring berhasil diperbarui' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/monitored-pics/:username', checkAuth, async (req, res) => {
    try {
        const { username } = req.params;
        if (!isAdminUser(req) && req.user?.username !== username) {
            return res.status(403).json({ error: 'Hanya owner PIC atau admin yang dapat menghapus data ini' });
        }
        await knex('monitored_pics').where({ username }).delete();
        io.emit('data:changed', { channel: 'monitored-pics' });
        res.json({ message: 'PIC Monitoring berhasil dihapus' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/independent-issues', checkAuth, async (req, res) => {
    try {
        const issues = await knex('independent_issues').select('*').orderBy('created_at', 'desc');
        const parsed = issues.map(i => ({
            ...i,
            history: parseJsonArraySafe(i.history),
            assignedTo: parseJsonArraySafe(i.assigned_to),
            resolvedAt: i.resolved_at
        }));
        res.json(parsed);
    } catch (err) {
        console.error("CRITICAL ERROR GET /api/independent-issues:", err.message);
        res.status(500).json({
            error: "Gagal mengambil data issue. Pastikan tabel database sudah ada.",
            details: err.message
        });
    }
});

app.post('/api/independent-issues', checkAuth, async (req, res) => {
    try {
        const data = validateRequestBody(independentIssueCreateSchema, req, res);
        if (!data) return;

        const [dbRes] = await knex('independent_issues').insert({
            note: data.note,
            detail: data.detail,
            status: data.status || 'pending',
            progress: data.progress || 0,
            history: JSON.stringify(data.history || []),
            assigned_to: JSON.stringify(data.assignedTo || []),
            owner: data.owner || req.user?.username || 'system',
            created_at: new Date(),
            updated_at: new Date()
        }).returning('id');
        const id = typeof dbRes === 'object' ? dbRes.id : dbRes;
        io.emit('data:changed', { channel: 'independent-issues' });
        res.json({ id, message: 'Issue berhasil dibuat' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/independent-issues/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const data = validateRequestBody(independentIssueUpdateSchema, req, res);
        if (!data) return;

        await knex('independent_issues').where({ id }).update({
            note: data.note,
            detail: data.detail,
            status: data.status,
            progress: data.progress,
            history: JSON.stringify(data.history || []),
            assigned_to: JSON.stringify(data.assignedTo || []),
            owner: data.owner,
            resolved_at: data.resolvedAt,
            updated_at: new Date()
        });
        io.emit('data:changed', { channel: 'independent-issues' });
        res.json({ message: 'Issue berhasil diperbarui' });
    } catch (err) {
        console.error('[PUT /api/independent-issues/:id] Error:', err);
        res.status(500).json({
            error: 'Failed to update issue',
            message: err.message
        });
    }
});

app.delete('/api/independent-issues/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;
        await knex('independent_issues').where({ id }).delete();
        io.emit('data:changed', { channel: 'independent-issues' });
        res.json({ message: 'Issue berhasil dihapus' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Gunakan legacyRoutes hanya untuk fitur yang belum di-override.
// Pastikan rute /approvals di dalam legacyRoutes.js sudah dinonaktifkan.
app.use('/api', legacyRoutes);

app.post('/api/upload', upload.single('file'), uploadDocument); // Legacy Alias

app.use('/api/documents', documentRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/tax', taxRoutes); // /api/tax/objects
app.use('/api/search', searchRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/pustaka', pustakaRoutes);
app.use('/api/coa', coaRoutes);
app.use('/api/entertainment', entertainmentRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/pdf-templates', pdfTemplateRoutes);
app.use('/api', pdfToolsRoutes); // /api/pdf-tools/* → Flask (AI PDF Tools)

// --- SOP FLOWS (STANDARDIZATION) ROUTES ---
app.get('/api/sop-flows', checkAuth, async (req, res) => {
    try {
        const { username, role, department } = req.user;

        let query = knex('sop_flows');

        // Filtering logic:
        if (role !== 'admin') {
            query = query.where(function () {
                this.where('privacy_type', 'public')
                    .orWhere('owner', username)
                    .orWhere(function () {
                        this.where('privacy_type', 'department')
                            .andWhere('allowed_departments', 'like', `%${department}%`);
                    })
                    .orWhere(function () {
                        this.where('privacy_type', 'specific_users')
                            .andWhere('allowed_users', 'like', `%${username}%`);
                    });
            });
        }

        const flows = await query.orderBy('created_at', 'desc');
        const parsed = flows.map(f => ({
            ...f,
            steps: parseJsonArraySafe(f.steps),
            visual_config: parseJsonObjectSafe(f.visual_config, { nodes: [], edges: [] }),
            allowed_departments: parseJsonArraySafe(f.allowed_departments),
            allowed_users: parseJsonArraySafe(f.allowed_users)
        }));
        res.json(parsed);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/sop-flows', checkAuth, async (req, res) => {
    try {
        const data = validateRequestBody(sopFlowCreateSchema, req, res);
        if (!data) return;

        const { title, description, category, steps, visual_config, privacy_type, allowed_departments, allowed_users } = data;
        const [dbRes] = await knex('sop_flows').insert({
            title,
            description,
            category,
            steps: JSON.stringify(steps || []),
            visual_config: JSON.stringify(visual_config || {}),
            owner: req.user?.username,
            privacy_type: privacy_type || 'public',
            allowed_departments: JSON.stringify(allowed_departments || []),
            allowed_users: JSON.stringify(allowed_users || []),
            created_at: new Date(),
            updated_at: new Date()
        }).returning('id');
        const id = typeof dbRes === 'object' ? dbRes.id : dbRes;
        res.json({ id, message: 'SOP Flow created successfully' });
        io.emit('data:changed', { channel: 'sop-flows' });
    } catch (err) {
        console.error('[POST /api/sop-flows] Error:', err);
        res.status(500).json({
            error: 'Failed to create SOP flow',
            message: err.message
        });
    }
});

app.put('/api/sop-flows/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const data = validateRequestBody(sopFlowUpdateSchema, req, res);
        if (!data) return;

        const { title, description, category, steps, visual_config, privacy_type, allowed_departments, allowed_users } = data;
        const existing = await knex('sop_flows').where({ id }).first();
        if (!existing) return res.status(404).json({ error: "SOP Flow tidak ditemukan" });

        const changingPrivacy = privacy_type !== undefined || allowed_departments !== undefined || allowed_users !== undefined;
        if (changingPrivacy && !isOwnerOrAdmin(req, existing.owner)) {
            return res.status(403).json({ error: 'Hanya owner SOP atau admin yang dapat mengubah pengaturan privasi' });
        }

        const affected = await knex('sop_flows').where({ id }).update({
            title,
            description,
            category,
            steps: JSON.stringify(steps || []),
            visual_config: JSON.stringify(visual_config || {}),
            privacy_type,
            allowed_departments: JSON.stringify(allowed_departments || []),
            allowed_users: JSON.stringify(allowed_users || []),
            updated_at: new Date()
        });
        if (!affected) return res.status(404).json({ error: "SOP Flow tidak ditemukan" });
        res.json({ message: 'SOP Flow updated successfully' });
        io.emit('data:changed', { channel: 'sop-flows' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/sop-flows/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;
        await knex('sop_flows').where({ id }).delete();
        io.emit('data:changed', { channel: 'sop-flows' });
        res.json({ message: 'SOP Flow deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Secure File Access

app.get('/uploads/:filename', (req, res, next) => {
    // Fallback query-token hanya untuk dev bila diizinkan secara eksplisit
    const allowQueryToken = process.env.ALLOW_QUERY_TOKEN === 'true' && process.env.NODE_ENV !== 'production';
    if (allowQueryToken && req.query.token && !req.headers.authorization) {
        req.headers.authorization = `Bearer ${req.query.token}`;
    }
    next();
}, checkAuth, (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(UPLOADS_DIR, filename);
    const resolvedPath = path.resolve(filePath).toLowerCase();
    const resolvedUploadsDir = path.resolve(UPLOADS_DIR).toLowerCase();

    if (!resolvedPath.startsWith(resolvedUploadsDir)) {
        return res.status(403).json({ error: "Access Denied" });
    }

    // Privasi dokumen AnyDoc: file anydoc-*.md hanya boleh diunduh oleh pembuatnya,
    // kecuali admin/superadmin. Nama file membawa owner: anydoc-<owner>-<ts>-<rand>.md
    if (filename.startsWith('anydoc-') && filename.endsWith('.md')) {
        const role = String(req.user?.role || '').toLowerCase();
        const isAdminUser = role === 'admin' || role === 'superadmin';
        const m = filename.match(/^anydoc-([a-zA-Z0-9_-]{1,40})-\d+-[a-z0-9]+\.md$/);
        const owner = m ? m[1] : null;
        const me = req.user?.username || req.user?.name;
        // File lama (tanpa owner di nama) maupun file milik user lain → hanya admin
        if (!isAdminUser && owner !== me) {
            return res.status(403).json({ error: "Access Denied" });
        }
    }

    // Keamanan: cegah sniffing tipe file & netralkan SVG (potensi XSS) dengan unduhan paksa
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (filename.toLowerCase().endsWith('.svg')) {
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filename)}"`);
    }

    res.sendFile(filePath, (err) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // Suppress ENOENT logging or log as warning
                console.warn(`[404] File not found: ${filename}`);
                console.warn(`[404] Resolved Path: ${filePath}`);
                console.warn(`[404] Directory exists? ${fs.existsSync(UPLOADS_DIR)}`);
                if (fs.existsSync(UPLOADS_DIR)) {
                    const files = fs.readdirSync(UPLOADS_DIR);
                    console.warn(`[404] Files in dir (${files.length}):`, files.slice(0, 10)); // Show firs 10
                }
                if (!res.headersSent) res.status(404).json({ error: "File not found" });
            } else if (err.code === 'ECONNABORTED') {
                // Client aborted request - ignore
            } else {
                console.error(`Error sending file ${filename}:`, err);
                if (!res.headersSent) res.status(500).json({ error: "Error sending file" });
            }
        }
    });
});

// Endpoint untuk membaca file log Winston
app.get('/api/system/logs-file/:type', checkAuth, (req, res) => {
    const { type } = req.params;
    let logFileName;
    if (type === 'error') logFileName = 'error.log';
    else if (type === 'server') logFileName = 'server.log';
    else logFileName = 'ocr-failures.log';

    const filePath = path.join(logsDir, logFileName);

    if (!fs.existsSync(filePath)) {
        return res.json({ content: "Belum ada catatan log untuk kategori ini." });
    }

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        res.json({ content });
    } catch (err) {
        res.status(500).json({ error: "Gagal membaca file log" });
    }
});

// Socket.io
io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Relay updates from the background worker to UI clients
    socket.on('worker:update', (data) => {
        io.emit('data:changed', data);
    });

    socket.on('disconnect', () => logger.info(`Client disconnected: ${socket.id}`));
});

// Global Error Handler — di produksi jangan bocorkan detail internal
app.use((err, req, res, next) => {
    const isProd = process.env.NODE_ENV === 'production';
    logger.error(`Unhandled Error: ${err.message}`, { stack: err.stack, path: req.path });

    // Multer: file terlalu besar → 413; error validasi upload → 400
    let status = err.status || 500;
    if (err.name === 'MulterError' && err.code === 'LIMIT_FILE_SIZE') status = 413;
    if (err.name === 'MulterError' && err.code !== 'LIMIT_FILE_SIZE') status = 400;
    if (status === 500) {
        return res.status(500).json({ error: isProd ? 'Internal Server Error' : err.message });
    }
    return res.status(status).json({ error: err.message });
});

// Handle Server Errors (e.g. EADDRINUSE)
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`CRITICAL: Port ${PORT} is already in use by another process.`);
    } else {
        console.error(`SERVER ERROR: ${err.message}`);
    }
    process.exit(1);
});

console.log('[index.js] Imports complete, defining startServer...');



// Start Server
// Ensure DB migration or init logic is handled if needed
const startServer = async () => {
    try {
        console.log(`🚀 Memulai inisialisasi server pada port ${PORT}...`);

        // Gunakan 127.0.0.1 agar lebih stabil di Windows dibanding 0.0.0.0
        server.listen(PORT, '127.0.0.1', () => {
            console.log(`✅ BACKEND LISTENING: http://127.0.0.1:${PORT}`);
            console.log(`📁 Folder Upload: ${UPLOADS_DIR}`);

            // Jalankan inisialisasi database SETELAH port terbuka
            (async () => {
                try {
                    logger.info("📦 Menghubungkan ke Database...");
                    await initDb();
                    logger.info("✅ Database & Migrasi Selesai.");
                } catch (innerErr) {
                    logger.error("❌ Gagal inisialisasi layanan latar belakang (DB/AI):", innerErr.message);
                    console.error("❌ Background Service Error:", innerErr);
                }
            })().catch(err => {
                logger.error("❌ Gagal inisialisasi database/AI:", err.message);
            });

            // Sinkronisasi otomatis training → 1MBrain (interval dikonfigurasi via BRAIN_AUTO_SYNC_HOURS)
            try {
                startBrainAutoSyncScheduler();
            } catch (err) {
                console.warn('❌ Gagal memulai auto-sync training ke 1MBrain:', err.message);
            }
        });

    } catch (err) {
        logger.error("❌ CRITICAL: Server failed to start!");
        logger.error(err.stack);

        if (err.code === 'ECONNREFUSED') {
            logger.error(`Gagal terhubung ke layanan di ${err.address}:${err.port}. Pastikan MySQL/Redis sudah menyala.`);
        }
        // Jangan exit di dev mode agar nodemon/watch bisa mencoba lagi
    }
};

console.log('[index.js] Calling startServer()...');
startServer();
