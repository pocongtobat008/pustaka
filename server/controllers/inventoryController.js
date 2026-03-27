import { handleError } from '../utils/errorHandler.js';
import { knex } from '../db.js';
import { systemLog } from '../utils/logger.js';
import { parseJsonArraySafe } from '../utils/jsonSafe.js';
import {
    createBoxSchema,
    updateInventoryItemSchema,
    createExternalItemSchema,
    moveInventoryItemSchema,
    validateRequestBody
} from '../utils/requestValidation.js';
import { cache } from '../utils/cache.js';

export const getInventory = async (req, res) => {
    try {
        const { search } = req.query;
        const cacheKey = `inventory:list:${search || 'all'}`;

        const cachedData = await cache.get(cacheKey);
        if (cachedData) return res.json(cachedData);

        let query = knex('inventory').select('*');

        if (search) {
            query = query.where(builder => {
                builder.where('status', 'like', `%${search}%`)
                    .orWhere('rack', 'like', `%${search}%`)
                    .orWhere('id', 'like', `%${search}%`)
                    .orWhere('box_data', 'like', `%${search}%`); // Search inside JSON string
            });
        }

        const rows = await query;
        await cache.set(cacheKey, rows, 3600); // 1 hour TTL
        res.json(rows);
    } catch (err) {
        handleError(res, err, "INVENTORY Error");
    }
};

export const getBoxes = async (req, res) => {
    try {
        const boxes = await knex('boxes').select('*');
        res.json(boxes);
    } catch (err) {
        handleError(res, err, "INVENTORY Error");
    }
};

export const createBox = async (req, res) => {
    try {
        const data = validateRequestBody(createBoxSchema, req, res);
        if (!data) return;

        const { box_id, description, location } = data;
        const [dbRes] = await knex('boxes').insert({
            box_id,
            description,
            location
        }).returning('id');
        const id = typeof dbRes === 'object' ? dbRes.id : dbRes;
        await systemLog('Admin', "Create Box", `Created box: ${box_id}`);
        req.app.get('io')?.emit('data:changed', { channel: 'inventory' });
        res.json({ id });
    } catch (e) {
        handleError(res, e, "INVENTORY Error");
    }
};

export const updateInventoryItem = async (req, res) => {
    try {
        const { id } = req.params;
        const data = validateRequestBody(updateInventoryItemSchema, req, res);
        if (!data) return;

        const { status, box_data, history, lastUpdated } = data;

        const updateData = {
            status,
            lastUpdated: lastUpdated || knex.fn.now()
        };

        if (box_data !== undefined) updateData.box_data = typeof box_data === 'string' ? box_data : JSON.stringify(box_data);
        if (history !== undefined) updateData.history = typeof history === 'string' ? history : JSON.stringify(history);

        const rowsAffected = await knex('inventory').where('id', id).update(updateData);

        if (rowsAffected === 0) {
            return res.status(404).json({ error: `Slot #${id} tidak ditemukan di database.` });
        }

        await systemLog('System', "Update Inventory", `Updated item ID: ${id}`);
        // Clear inventory cache
        await cache.delByPattern('inventory:*');
        req.app.get('io')?.emit('data:changed', { channel: 'inventory' });
        res.json({ success: true });
    } catch (e) {
        handleError(res, e, "INVENTORY Error");
    }
};

export const getAnalytics = async (req, res) => {
    try {
        const cacheKey = 'inventory:analytics';
        const cachedAnalytics = await cache.get(cacheKey);
        if (cachedAnalytics) return res.json(cachedAnalytics);

        const [itemsResult] = await knex('inventory').count('id as count');
        const [boxesResult] = await knex('boxes').count('id as count');
        const [externalResult] = await knex('external_items').count('id as count');

        const totalItems = typeof itemsResult.count === 'string' ? parseInt(itemsResult.count) : itemsResult.count;
        const totalBoxes = typeof boxesResult.count === 'string' ? parseInt(boxesResult.count) : boxesResult.count;
        const totalExternal = typeof externalResult.count === 'string' ? parseInt(externalResult.count) : externalResult.count;

        // Mock recent activity for now or fetch from logs
        const recentActivity = await knex('logs').orderBy('timestamp', 'desc').limit(5);

        const analytics = {
            totalItems,
            totalBoxes,
            totalExternal,
            recentActivity
        };

        await cache.set(cacheKey, analytics, 3600); // 1 hour TTL
        res.json(analytics);
    } catch (err) {
        handleError(res, err, "INVENTORY Error");
    }
};

export const getExternalInventory = async (req, res) => {
    try {
        const rows = await knex('external_items').select('*');
        res.json(rows);
    } catch (err) {
        handleError(res, err, "INVENTORY Error");
    }
};

export const createExternalItem = async (req, res) => {
    try {
        const data = validateRequestBody(createExternalItemSchema, req, res);
        if (!data) return;

        const { boxId, destination, sentDate, sender, boxData, history } = data;
        const [dbRes] = await knex('external_items').insert({
            boxId,
            destination,
            sentDate: sentDate || knex.fn.now(),
            sender,
            boxData: typeof boxData === 'string' ? boxData : JSON.stringify(boxData || {}),
            history: typeof history === 'string' ? history : JSON.stringify(history || [])
        }).returning('id');
        const id = typeof dbRes === 'object' ? dbRes.id : dbRes;
        await systemLog('System', "External Inventory", `Added item: ${boxId} to ${destination}`);
        req.app.get('io')?.emit('data:changed', { channel: 'inventory' });
        res.json({ id });
    } catch (e) {
        handleError(res, e, "INVENTORY Error");
    }
};

export const deleteExternalItem = async (req, res) => {
    try {
        const { id } = req.params;
        await knex('external_items').where('id', id).del();
        await systemLog('System', "External Inventory", `Deleted item ID: ${id}`);
        req.app.get('io')?.emit('data:changed', { channel: 'inventory' });
        res.json({ success: true });
    } catch (e) {
        handleError(res, e, "INVENTORY Error");
    }
};

export const moveInventoryItem = async (req, res) => {
    try {
        const data = validateRequestBody(moveInventoryItemSchema, req, res);
        if (!data) return;

        const { sourceId, targetId, user } = data;

        if (!sourceId || !targetId) {
            return res.status(400).json({ error: "Source ID and Target ID are required." });
        }

        // 1. Fetch both slots
        const sourceSlot = await knex('inventory').where('id', sourceId).first();
        const targetSlot = await knex('inventory').where('id', targetId).first();

        if (!sourceSlot) return res.status(404).json({ error: `Source slot #${sourceId} not found.` });
        if (!targetSlot) return res.status(404).json({ error: `Target slot #${targetId} not found.` });

        if (sourceSlot.status === 'EMPTY') {
            return res.status(400).json({ error: "Source slot is empty." });
        }

        if (targetSlot.status !== 'EMPTY') {
            return res.status(400).json({ error: `Target slot #${targetId} already occupied.` });
        }

        // 2. Transact the move
        await knex.transaction(async (trx) => {
            // Update target
            const targetHistory = parseJsonArraySafe(targetSlot.history);
            const sourceBoxData = sourceSlot.box_data; // Keep raw string or object

            await trx('inventory').where('id', targetId).update({
                status: sourceSlot.status,
                box_data: sourceBoxData,
                lastUpdated: knex.fn.now(),
                history: JSON.stringify([
                    ...targetHistory,
                    { action: 'MOVE_IN', details: `Source: #${sourceId}, User: ${user || 'Unknown'}`, timestamp: new Date().toISOString() }
                ])
            });

            // Update source to empty
            const sourceHistory = parseJsonArraySafe(sourceSlot.history);
            await trx('inventory').where('id', sourceId).update({
                status: 'EMPTY',
                box_data: null,
                lastUpdated: knex.fn.now(),
                history: JSON.stringify([
                    ...sourceHistory,
                    { action: 'MOVE_OUT', details: `Target: #${targetId}, User: ${user || 'Unknown'}`, timestamp: new Date().toISOString() }
                ])
            });
        });

        await systemLog(user || 'System', "Move Inventory", `Moved box from #${sourceId} to #${targetId}`);
        // Clear inventory cache
        await cache.delByPattern('inventory:*');
        req.app.get('io')?.emit('data:changed', { channel: 'inventory' });
        res.json({ success: true });
    } catch (err) {
        handleError(res, err, "INVENTORY Error");
    }
};
