import { handleError } from '../utils/errorHandler.js';
import { knex } from '../db.js';
import { systemLog } from '../utils/logger.js';
import { parseJsonArraySafe, parseJsonObjectSafe } from '../utils/jsonSafe.js';
import {
    createBoxSchema,
    updateInventoryItemSchema,
    createExternalItemSchema,
    moveInventoryItemSchema,
    validateRequestBody
} from '../utils/requestValidation.js';
import { cache } from '../utils/cache.js';

const normalizeInventoryRow = (row) => {
    // Parse and normalize box_data to ensure invoices have status property
    const boxData = row.box_data || row.boxData;
    if (boxData && typeof boxData === 'string') {
        try {
            const parsed = JSON.parse(boxData);
            if (parsed.ordners && Array.isArray(parsed.ordners)) {
                parsed.ordners.forEach(ord => {
                    if (ord.invoices && Array.isArray(ord.invoices)) {
                        ord.invoices.forEach(inv => {
                            // Set default status to 'completed' if not present
                            if (!inv.status) {
                                inv.status = 'completed';
                            }
                        });
                    }
                });
            }
            return {
                ...row,
                box_data: parsed,
                boxData: parsed
            };
        } catch (e) {
            return row;
        }
    }
    return row;
};

export const getInventory = async (req, res) => {
    try {
        const { search } = req.query;
        const cacheKey = `inventory:list:${search || 'all'}`;

        let cachedData = await cache.get(cacheKey);
        if (cachedData) {
            // Normalize cached data before returning
            cachedData = Array.isArray(cachedData) ? cachedData.map(normalizeInventoryRow) : cachedData;
            return res.json(cachedData);
        }

        let query = knex('inventory').select('*');

        if (search) {
            query = query.where(builder => {
                builder.where('status', 'like', `%${search}%`)
                    .orWhere('rack', 'like', `%${search}%`)
                    .orWhere('id', 'like', `%${search}%`)
                    .orWhere('box_data', 'like', `%${search}%`); // Search inside JSON string
            });
        }

        let rows = await query;
        // Normalize invoice status for all rows
        rows = rows.map(normalizeInventoryRow);
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

        console.log(`[updateInventoryItem] API received data for slot ${id}:`, JSON.stringify(data).slice(0, 150) + "...");

        const { status, box_id, boxId, box_data, boxData, history, lastUpdated } = data;
        const effectiveBoxId = box_id || boxId;
        const effectiveBoxData = box_data !== undefined ? box_data : boxData;

        const updateData = {
            status,
            box_id: effectiveBoxId,
            history: history !== undefined ? (typeof history === 'string' ? history : JSON.stringify(history || [])) : undefined,
            lastUpdated: lastUpdated || knex.fn.now()
        };


        if (effectiveBoxData !== undefined) {
            if (effectiveBoxData === null || effectiveBoxData === 'null') {
                // Do NOT clear box_data for occupied statuses unless the
                // client explicitly intends to clear it (status EMPTY) or
                // no box_id is provided (full-clear intent).
                if (updateData.status === 'EMPTY' || !effectiveBoxId) {
                    updateData.box_data = null;
                    updateData.boxData = null; // Sync redundant column
                    updateData.box_id = null;
                } else {
                    // Preserve existing box_data in DB: do not include box_data
                    // fields in updateData so the column remains untouched.
                    updateData.box_id = effectiveBoxId; // respect explicit box_id
                }
            } else {
                // Sanitize box data to avoid persisting raw File objects or
                // empty placeholders like `{}` in invoice entries which break
                // downstream OCR processing and JSON serialisation.
                const parsedBoxData = typeof effectiveBoxData === 'string' ? JSON.parse(effectiveBoxData) : effectiveBoxData;

                const sanitizeBox = (box) => {
                    if (!box || typeof box !== 'object') return box;
                    try {
                        if (Array.isArray(box.ordners)) {
                            box.ordners = box.ordners.map(o => {
                                if (!o || typeof o !== 'object') return o;
                                if (Array.isArray(o.invoices)) {
                                    o.invoices = o.invoices.map(inv => {
                                        if (!inv || typeof inv !== 'object') return inv;
                                        // Remove any raw File-like fields
                                        if ('rawFile' in inv) delete inv.rawFile;
                                        if ('raw_file' in inv) delete inv.raw_file;
                                        if ('file' in inv) {
                                            const v = inv.file;
                                            // If file is null or a string (URL), keep it.
                                            // If it's an empty object or has non-serializable props, strip it.
                                            if (v === null) {
                                                // keep explicit null
                                                inv.file = null;
                                            } else if (typeof v === 'string') {
                                                inv.file = v;
                                            } else if (typeof v === 'object') {
                                                // If it's an empty object or appears to be a serialized File placeholder,
                                                // remove the key so downstream expects a document record instead.
                                                const keys = Object.keys(v || {});
                                                if (keys.length === 0) {
                                                    delete inv.file;
                                                } else {
                                                    // If it contains only non-serializable markers, remove it
                                                    const nonSerial = keys.some(k => ['stream', 'buffer', '_readableState', 'path'].includes(k));
                                                    if (nonSerial) delete inv.file; else inv.file = v;
                                                }
                                            } else {
                                                delete inv.file;
                                            }
                                        }
                                        // Ensure filename is a string or removed
                                        if ('fileName' in inv && (inv.fileName === undefined || inv.fileName === null)) delete inv.fileName;
                                        // Remove any UI-only props that should not be persisted
                                        if ('_tmpId' in inv) delete inv._tmpId;
                                        if ('__meta' in inv) delete inv.__meta;
                                        return inv;
                                    });
                                }
                                return o;
                            });
                        }
                    } catch (e) {
                        // If sanitization fails, fall back to original data to avoid blocking updates
                        console.warn('[updateInventoryItem] box_data sanitization failed:', e.message);
                        return box;
                    }
                    return box;
                };

                const sanitized = sanitizeBox(parsedBoxData);
                const stringData = typeof sanitized === 'string' ? sanitized : JSON.stringify(sanitized);
                updateData.box_data = stringData;
                updateData.boxData = stringData; // Sync redundant column

                // If the client did not provide an explicit box_id, try to
                // extract it from the provided boxData payload. Otherwise
                // preserve the explicit box_id sent by the client.
                if (!effectiveBoxId && sanitized && sanitized.id) {
                    updateData.box_id = sanitized.id;
                } else if (effectiveBoxId) {
                    updateData.box_id = effectiveBoxId;
                }
            }
        }


        if (updateData.status && updateData.status !== 'EMPTY' && !updateData.box_id) {
            // Self-healing attempt from effectiveBoxData id
            try {
                const parsedBD = typeof effectiveBoxData === 'string' ? JSON.parse(effectiveBoxData) : (effectiveBoxData || {});
                if (parsedBD.id) {
                    updateData.box_id = parsedBD.id;
                    console.log(`[updateInventoryItem] Self-healed box_id: ${updateData.box_id} from box_data`);
                }
            } catch (e) { /* ignore */ }

            if (!updateData.box_id) {
                console.error(`[updateInventoryItem] HARD REJECT! Occupied status ${updateData.status} requires box_id. Payload:`, JSON.stringify(data).slice(0, 100));
                return res.status(400).json({
                    error: `Masalah Data: Status '${updateData.status}' memerlukan Box ID. Silakan periksa kembali data atau Reset slot.`,
                    details: "Metadata Box ID null untuk status terisi."
                });
            }
        }

        // Safe logging to avoid circular reference crashes from knex.fn objects
        const safeLogData = { ...updateData };
        if (typeof safeLogData.lastUpdated !== 'string') safeLogData.lastUpdated = '[Knex Raw Object]';
        console.log(`[updateInventoryItem] FINAL PAYLOAD for slot ${id}:`, JSON.stringify(safeLogData));

        const rowsAffected = await knex('inventory').where('id', id).update(updateData);

        if (rowsAffected > 0) {
            const updated = await knex('inventory').where('id', id).first();
            // Deeply sanitize the output for terminal
            const terminalOutput = updated ? { ...updated, history: '[Trimmed]' } : 'NULL';
            console.log(`[updateInventoryItem] VERIFIED DB state for slot ${id}:`, JSON.stringify(terminalOutput));
        }

        if (rowsAffected === 0) {
            return res.status(404).json({ error: `Slot #${id} tidak ditemukan di database.` });
        }

        await systemLog('System', "Update Inventory", `Updated item ID: ${id}`);

        await cache.delByPattern('inventory:*');


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
        let rows = await knex('external_items').select('*');
        // Normalize invoice status for external items as well
        rows = rows.map(normalizeInventoryRow);
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
        console.log('[moveInventoryItem] Request body:', req.body);
        const data = validateRequestBody(moveInventoryItemSchema, req, res);
        if (!data) return;

        const { sourceId, targetId, user } = data;
        console.log('[moveInventoryItem] Validated data:', { sourceId, targetId, user });

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
            let sourceBoxData = sourceSlot.box_data;
            if (sourceBoxData === 'null') sourceBoxData = null;

            await trx('inventory').where('id', targetId).update({
                status: sourceSlot.status,
                box_data: sourceBoxData,
                boxData: sourceBoxData, // Sync redundant column
                box_id: sourceSlot.box_id || (parseJsonObjectSafe(sourceBoxData).id) || null, // Self-heal if null
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
                boxData: null, // Sync redundant column
                box_id: null,
                lastUpdated: knex.fn.now(),


                history: JSON.stringify([
                    ...sourceHistory,
                    { action: 'MOVE_OUT', details: `Target: #${targetId}, User: ${user || 'Unknown'}`, timestamp: new Date().toISOString() }
                ])
            });
        });

        await systemLog(user || 'System', "Move Inventory", `Moved box from #${sourceId} to #${targetId}`);

        // Clear all inventory caches (wildcard)
        await cache.delByPattern('inventory:*');
        req.app.get('io')?.emit('data:changed', { channel: 'inventory' });
        res.json({ success: true });

    } catch (err) {
        handleError(res, err, "INVENTORY Error");
    }
};
