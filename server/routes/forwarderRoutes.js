import express from 'express';
import { knex } from '../db.js';

const router = express.Router();

const getAuthUser = (req) => req.user || req.session?.user || null;

router.use((req, res, next) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.authUser = user;
    next();
});

const isAdmin = (user) => user.role === 'admin' || user.role === 'superadmin';

const getUserDivision = (user) => user.department || user.division || '';

const logActivity = async (user, action, targetId, detail) => {
    try {
        await knex('activity_logs').insert({
            user_id: user.id,
            username: user.username,
            action,
            module: 'forwarder',
            target_id: String(targetId),
            detail,
        });
    } catch (e) { /* non-blocking */ }
};

const sanitizeRow = (body) => {
    const fields = ['division', 'delivery_month', 'imp_exp', 'forwarder_name', 'bl_awb',
        'inv_no_i', 'inv_no_ii', 'yadin_inv_sj', 'from_to', 'notes'];
    const out = {};
    for (const f of fields) {
        if (body[f] !== undefined) out[f] = String(body[f] ?? '').trim();
    }
    return out;
};

// GET /api/forwarder?division=xxx&search=xxx&page=&perPage=
router.get('/', async (req, res) => {
    try {
        const { division, search, page = 1, perPage = 500 } = req.query;
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limit = Math.max(1, Math.min(2000, parseInt(perPage) || 500));
        const offset = (pageNum - 1) * limit;

        let query = knex('forwarder_entries');
        let countQuery = knex('forwarder_entries');

        if (division && division !== 'all') {
            query = query.where('division', division);
            countQuery = countQuery.where('division', division);
        }
        if (search) {
            const fn = function () {
                this.where('delivery_month', 'ilike', `%${search}%`)
                    .orWhere('imp_exp', 'ilike', `%${search}%`)
                    .orWhere('forwarder_name', 'ilike', `%${search}%`)
                    .orWhere('bl_awb', 'ilike', `%${search}%`)
                    .orWhere('inv_no_i', 'ilike', `%${search}%`)
                    .orWhere('inv_no_ii', 'ilike', `%${search}%`)
                    .orWhere('yadin_inv_sj', 'ilike', `%${search}%`)
                    .orWhere('from_to', 'ilike', `%${search}%`)
                    .orWhere('division', 'ilike', `%${search}%`);
            };
            query = query.where(fn);
            countQuery = countQuery.where(fn);
        }

        const [total, data] = await Promise.all([
            countQuery.count('* as c').first(),
            query.orderBy('id', 'asc').limit(limit).offset(offset),
        ]);

        res.json({ data, total: Number(total?.c || 0), page: pageNum });
    } catch (error) {
        console.error('[Forwarder] GET error:', error);
        res.status(500).json({ error: 'Failed to fetch forwarder data' });
    }
});

// GET /api/forwarder/divisions — daftar divisi (dari data + users)
router.get('/divisions', async (req, res) => {
    try {
        const rows = await knex('forwarder_entries')
            .select('division')
            .whereNotNull('division')
            .where('division', '!=', '')
            .groupBy('division')
            .orderBy('division', 'asc');
        const userDivs = await knex('users')
            .select(knex.raw('DISTINCT TRIM(COALESCE(department, \'\')) as division'))
            .whereNotNull('department')
            .where('department', '!=', '');
        const set = new Set(rows.map(r => r.division).concat(userDivs.map(r => r.division)));
        res.json({ divisions: [...set].filter(Boolean).sort() });
    } catch (error) {
        console.error('[Forwarder] GET divisions error:', error);
        res.status(500).json({ error: 'Failed to fetch divisions' });
    }
});

// POST /api/forwarder — buat baris baru
router.post('/', async (req, res) => {
    try {
        const user = req.authUser;
        const body = sanitizeRow(req.body);
        // Default divisi = divisi user (admin boleh override)
        const division = body.division || getUserDivision(user) || 'General';

        const [row] = await knex('forwarder_entries').insert({
            ...body,
            division,
            created_by: user.name || user.username,
            created_by_username: user.username,
            created_at: new Date(),
            updated_at: new Date(),
        }).returning('*');

        await logActivity(user, 'CREATE_FORWARDER', row.id, `Buat baris forwarder (${division})`);
        res.status(201).json(row);
    } catch (error) {
        console.error('[Forwarder] POST error:', error);
        res.status(500).json({ error: 'Failed to create forwarder row' });
    }
});

// PUT /api/forwarder/:id — auto-save ala Excel (update kolom yang dikirim)
router.put('/:id', async (req, res) => {
    try {
        const existing = await knex('forwarder_entries').where('id', req.params.id).first();
        if (!existing) return res.status(404).json({ error: 'Data not found' });

        const user = req.authUser;
        const isOwner = existing.created_by_username === user.username;
        if (!isAdmin(user) && !isOwner) {
            return res.status(403).json({ error: 'Anda hanya dapat mengubah baris milik Anda sendiri' });
        }

        const body = sanitizeRow(req.body);
        // Non-admin tidak boleh mengganti divisi baris orang lain
        if (!isAdmin(user) && body.division && body.division !== existing.division && !isOwner) {
            delete body.division;
        }
        if (!isAdmin(user) && body.division && existing.division && body.division !== existing.division) {
            delete body.division; // divisi terkunci setelah dibuat
        }

        body.updated_at = new Date();
        await knex('forwarder_entries').where('id', req.params.id).update(body);

        const updated = await knex('forwarder_entries').where('id', req.params.id).first();
        await logActivity(user, 'UPDATE_FORWARDER', existing.id, `Update baris forwarder id ${existing.id}`);
        res.json(updated);
    } catch (error) {
        console.error('[Forwarder] PUT error:', error);
        res.status(500).json({ error: 'Failed to update forwarder row' });
    }
});

// DELETE /api/forwarder/:id
router.delete('/:id', async (req, res) => {
    try {
        const existing = await knex('forwarder_entries').where('id', req.params.id).first();
        if (!existing) return res.status(404).json({ error: 'Data not found' });

        const user = req.authUser;
        const isOwner = existing.created_by_username === user.username;
        if (!isAdmin(user) && !isOwner) {
            return res.status(403).json({ error: 'Anda hanya dapat menghapus baris milik Anda sendiri' });
        }

        await knex('forwarder_entries').where('id', req.params.id).del();
        await logActivity(user, 'DELETE_FORWARDER', existing.id, `Hapus baris forwarder id ${existing.id} (${existing.forwarder_name || '-'})`);
        res.json({ success: true });
    } catch (error) {
        console.error('[Forwarder] DELETE error:', error);
        res.status(500).json({ error: 'Failed to delete forwarder row' });
    }
});

export default router;
