import { knex } from '../db.js';
import { parseJsonSafe } from '../utils/jsonSafe.js';

const isAdmin = (req) => String(req.user?.role || '').toLowerCase() === 'admin';

const isEligibleNotification = (notification, user) => {
    if (!notification || !user) return false;
    const targetType = notification.target_type || 'general';
    const targetValue = notification.target_value;

    if (targetType === 'general') return true;
    if (targetType === 'user') return String(targetValue || '').toLowerCase() === String(user.username || '').toLowerCase();
    if (targetType === 'role') return String(targetValue || '').toLowerCase() === String(user.role || '').toLowerCase();
    return false;
};

const getEligibleNotifications = async (user, limit = 100) => {
    return knex('notifications')
        .where((qb) => {
            qb.where('target_type', 'general')
                .orWhere((sub) => sub.where('target_type', 'user').andWhere('target_value', user.username))
                .orWhere((sub) => sub.where('target_type', 'role').andWhere('target_value', user.role));
        })
        .andWhere((qb) => {
            qb.whereNull('expires_at').orWhere('expires_at', '>', knex.fn.now());
        })
        .orderBy('created_at', 'desc')
        .limit(limit);
};

export const getNotifications = async (req, res) => {
    try {
        const user = req.user;
        const notifications = await getEligibleNotifications(user, 100);

        if (!notifications.length) {
            return res.json([]);
        }

        const ids = notifications.map((n) => n.id);
        const reads = await knex('notification_reads')
            .where('username', user.username)
            .whereIn('notification_id', ids);

        const readMap = new Map(reads.map((r) => [r.notification_id, r.read_at]));

        const result = notifications.map((n) => ({
            ...n,
            readAt: readMap.get(n.id) || null,
            meta: parseJsonSafe(n.meta, null)
        }));

        res.json(result);
    } catch (err) {
        console.error('[notifications:get] error', err);
        res.status(500).json({ error: 'Gagal mengambil notifikasi' });
    }
};

export const markNotificationRead = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        const notification = await knex('notifications').where({ id }).first();
        if (!notification) {
            return res.status(404).json({ error: 'Notifikasi tidak ditemukan' });
        }

        if (!isEligibleNotification(notification, user)) {
            return res.status(403).json({ error: 'Notifikasi ini bukan untuk Anda' });
        }

        const existing = await knex('notification_reads')
            .where({ notification_id: id, username: user.username })
            .first();

        if (!existing) {
            await knex('notification_reads').insert({
                notification_id: Number(id),
                username: user.username,
                read_at: knex.fn.now()
            });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[notifications:read] error', err);
        res.status(500).json({ error: 'Gagal menandai notifikasi' });
    }
};

export const markAllNotificationsRead = async (req, res) => {
    try {
        const user = req.user;
        const notifications = await getEligibleNotifications(user, 300);

        if (!notifications.length) {
            return res.json({ success: true, marked: 0 });
        }

        const ids = notifications.map((n) => n.id);
        const existingReads = await knex('notification_reads')
            .where('username', user.username)
            .whereIn('notification_id', ids);

        const existingIds = new Set(existingReads.map((r) => r.notification_id));
        const toInsert = ids
            .filter((id) => !existingIds.has(id))
            .map((id) => ({
                notification_id: id,
                username: user.username,
                read_at: knex.fn.now()
            }));

        if (toInsert.length > 0) {
            await knex('notification_reads').insert(toInsert);
        }

        res.json({ success: true, marked: toInsert.length });
    } catch (err) {
        console.error('[notifications:read-all] error', err);
        res.status(500).json({ error: 'Gagal menandai semua notifikasi' });
    }
};

export const createNotification = async (req, res) => {
    try {
        if (!isAdmin(req)) {
            return res.status(403).json({ error: 'Hanya admin yang dapat membuat notifikasi target' });
        }

        const {
            title,
            message,
            type = 'info',
            channel = 'system',
            targetType = 'general',
            targetValue = null,
            meta = null,
            expiresAt = null
        } = req.body || {};

        if (!title || !message) {
            return res.status(400).json({ error: 'title dan message wajib diisi' });
        }

        if (!['general', 'user', 'role'].includes(targetType)) {
            return res.status(400).json({ error: 'targetType harus general, user, atau role' });
        }

        if ((targetType === 'user' || targetType === 'role') && !targetValue) {
            return res.status(400).json({ error: 'targetValue wajib diisi untuk target user/role' });
        }

        const [dbRes] = await knex('notifications').insert({
            title,
            message,
            type,
            channel,
            target_type: targetType,
            target_value: targetValue,
            created_by: req.user?.username || 'System',
            meta: meta ? JSON.stringify(meta) : null,
            expires_at: expiresAt || null,
            created_at: knex.fn.now()
        }).returning('id');

        const id = typeof dbRes === 'object' ? dbRes.id : dbRes;

        const created = await knex('notifications').where({ id }).first();
        req.app.get('io')?.emit('notification:new', {
            id: created.id,
            title: created.title,
            type: created.type,
            channel: created.channel,
            targetType: created.target_type,
            targetValue: created.target_value,
            createdAt: created.created_at
        });
        req.app.get('io')?.emit('data:changed', { channel: 'notifications' });

        res.json({ success: true, id });
    } catch (err) {
        console.error('[notifications:create] error', err);
        res.status(500).json({ error: 'Gagal membuat notifikasi' });
    }
};
