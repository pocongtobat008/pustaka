import { handleError } from '../utils/errorHandler.js';
import { knex } from '../db.js';

const isAdmin = (req) => String(req.user?.role || '').toLowerCase() === 'admin';
const isOwnerOrAdmin = (req, owner) => isAdmin(req) || (owner && req.user?.username === owner);

// --- LOGS ---
export const getLogs = async (req, res) => {
    try {
        const logs = await knex('logs').orderBy('timestamp', 'desc').limit(100);
        res.json(logs);
    } catch (err) {
        handleError(res, err, "SYSTEM Error");
    }
};

export const createLog = async (req, res) => {
    try {
        const { user, action, details, oldValue, newValue } = req.body;
        await knex('logs').insert({
            user: user || 'System',
            action,
            details,
            oldValue,
            newValue,
            timestamp: knex.fn.now()
        });
        res.json({ success: true });
    } catch (err) {
        handleError(res, err, "SYSTEM Error");
    }
};

// --- ROLES ---
export const getRoles = async (req, res) => {
    try {
        const roles = await knex('roles').select('*');
        res.json(roles);
    } catch (err) {
        handleError(res, err, "SYSTEM Error");
    }
};

// --- DEPARTMENTS ---
export const getDepartments = async (req, res) => {
    try {
        const depts = await knex('departments').select('*');
        res.json(depts);
    } catch (err) {
        handleError(res, err, "SYSTEM Error");
    }
};

export const createRole = async (req, res) => {
    try {
        const { id, name, label, access } = req.body;
        // Use id, or name if id is missing, as the primary key string
        const roleId = id || name || label?.toLowerCase().replace(/\s+/g, '_');

        await knex('roles').insert({
            id: roleId,
            label: label || name || roleId,
            access: typeof access === 'string' ? access : JSON.stringify(access || {})
        });
        req.app.get('io')?.emit('data:changed', { channel: 'system' });
        res.json({ id: roleId });
    } catch (err) {
        handleError(res, err, "SYSTEM Error");
    }
};

export const updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { label, access } = req.body;
        await knex('roles').where('id', id).update({
            label,
            access: typeof access === 'string' ? access : JSON.stringify(access || {})
        });
        req.app.get('io')?.emit('data:changed', { channel: 'system' });
        res.json({ success: true });
    } catch (err) {
        handleError(res, err, "SYSTEM Error");
    }
};

export const deleteRole = async (req, res) => {
    try {
        const { id } = req.params;
        await knex('roles').where('id', id).del();
        req.app.get('io')?.emit('data:changed', { channel: 'system' });
        res.json({ success: true });
    } catch (err) {
        handleError(res, err, "SYSTEM Error");
    }
};

// --- DEPARTMENTS ---
export const createDepartment = async (req, res) => {
    try {
        const { name } = req.body;
        const [dbRes] = await knex('departments').insert({ name }).returning('id');
        const id = typeof dbRes === 'object' ? dbRes.id : dbRes;
        req.app.get('io')?.emit('data:changed', { channel: 'system' });
        res.json({ id });
    } catch (err) {
        handleError(res, err, "SYSTEM Error");
    }
};

export const updateDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        await knex('departments').where('id', id).update({ name });
        req.app.get('io')?.emit('data:changed', { channel: 'system' });
        res.json({ success: true });
    } catch (err) {
        handleError(res, err, "SYSTEM Error");
    }
};

export const deleteDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        await knex('departments').where('id', id).del();
        req.app.get('io')?.emit('data:changed', { channel: 'system' });
        res.json({ success: true });
    } catch (err) {
        handleError(res, err, "SYSTEM Error");
    }
};

// --- FOLDERS ---
export const getFolders = async (req, res) => {
    try {
        const folders = await knex('folders').select('*');
        res.json(folders);
    } catch (err) {
        handleError(res, err, "SYSTEM Error");
    }
};

export const getFolderById = async (req, res) => {
    try {
        const { id } = req.params;
        const folder = await knex('folders').where('id', id).first();
        if (!folder) return res.status(404).json({ error: "Folder not found" });
        res.json(folder);
    } catch (err) {
        handleError(res, err, "SYSTEM Error");
    }
};

export const createFolder = async (req, res) => {
    try {
        const { name, parentId, privacy, allowedDepts, allowedUsers } = req.body;
        const [dbRes] = await knex('folders').insert({
            name,
            parentId: parentId || null,
            privacy: privacy || 'public',
            allowedDepts: JSON.stringify(allowedDepts || []),
            allowedUsers: JSON.stringify(allowedUsers || []),
            owner: req.user?.username || 'System',
            createdAt: knex.fn.now()
        }).returning('id');
        const id = typeof dbRes === 'object' ? dbRes.id : dbRes;
        req.app.get('io')?.emit('data:changed', { channel: 'system' });
        res.json({ id });
    } catch (err) {
        handleError(res, err, "SYSTEM Error");
    }
};

export const updateFolder = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, parentId, privacy, allowedDepts, allowedUsers } = req.body;
        const existing = await knex('folders').where('id', id).first();
        if (!existing) return res.status(404).json({ error: "Folder not found" });

        const changingPrivacy = privacy !== undefined || allowedDepts !== undefined || allowedUsers !== undefined;
        if (changingPrivacy && !isOwnerOrAdmin(req, existing.owner)) {
            return res.status(403).json({ error: 'Hanya owner folder atau admin yang dapat mengubah pengaturan privasi' });
        }

        await knex('folders').where('id', id).update({
            name,
            parentId: parentId || null,
            privacy,
            allowedDepts: allowedDepts ? JSON.stringify(allowedDepts) : undefined,
            allowedUsers: allowedUsers ? JSON.stringify(allowedUsers) : undefined
        });
        req.app.get('io')?.emit('data:changed', { channel: 'system' });
        res.json({ success: true });
    } catch (err) {
        handleError(res, err, "SYSTEM Error");
    }
};

export const deleteFolder = async (req, res) => {
    try {
        const { id } = req.params;

        // Get existing folder to check ownership
        const existing = await knex('folders').where('id', id).first();
        if (!existing) {
            return res.status(404).json({ error: "Folder not found" });
        }

        // Check if user is owner or admin
        if (!isOwnerOrAdmin(req, existing.owner)) {
            return res.status(403).json({ error: 'Hanya owner folder atau admin yang dapat menghapus folder ini' });
        }

        await knex('folders').where('id', id).del();
        // Optionally handle recursive delete or move children to root
        req.app.get('io')?.emit('data:changed', { channel: 'system' });
        res.json({ success: true });
    } catch (err) {
        handleError(res, err, "SYSTEM Error");
    }
};

export const moveFolder = async (req, res) => {
    try {
        const { id, targetParentId } = req.body;

        // Get existing folder to check ownership
        const existing = await knex('folders').where('id', id).first();
        if (!existing) {
            return res.status(404).json({ error: "Folder not found" });
        }

        // Check if user is owner or admin
        if (!isOwnerOrAdmin(req, existing.owner)) {
            return res.status(403).json({ error: 'Hanya owner folder atau admin yang dapat memindahkan folder ini' });
        }

        await knex('folders').where('id', id).update({
            parentId: targetParentId || null
        });
        req.app.get('io')?.emit('data:changed', { channel: 'system' });
        res.json({ success: true });
    } catch (err) {
        handleError(res, err, "SYSTEM Error");
    }
};

export const copyFolder = async (req, res) => {
    try {
        const { id, targetParentId } = req.body;
        const folder = await knex('folders').where('id', id).first();
        if (!folder) return res.status(404).json({ error: "Source folder not found" });

        // Check if user is owner or admin (of source folder)
        if (!isOwnerOrAdmin(req, folder.owner)) {
            return res.status(403).json({ error: 'Hanya owner folder atau admin yang dapat menyalin folder ini' });
        }

        const [dbRes] = await knex('folders').insert({
            ...folder,
            id: undefined, // Let DB generate new ID
            name: `Copy of ${folder.name}`,
            parentId: targetParentId || null,
            owner: req.user?.username || 'System', // New copy is owned by current user
            createdAt: knex.fn.now()
        }).returning('id');
        const newId = typeof dbRes === 'object' ? dbRes.id : dbRes;
        req.app.get('io')?.emit('data:changed', { channel: 'system' });
        res.json({ success: true, id: newId });
    } catch (err) {
        handleError(res, err, "SYSTEM Error");
    }
};
