import { handleError } from '../utils/errorHandler.js';
import { knex } from '../db.js';
import { parseJsonArraySafe } from '../utils/jsonSafe.js';
import {
    pustakaGuideCreateSchema,
    pustakaGuideUpdateSchema,
    pustakaSlideCreateSchema,
    validateRequestBody
} from '../utils/requestValidation.js';

const isAdmin = (req) => String(req.user?.role || '').toLowerCase() === 'admin';
const isOwnerOrAdmin = (req, owner) => isAdmin(req) || (owner && req.user?.username === owner);

export const getGuides = async (req, res) => {
    try {
        const { category } = req.query;
        let query = knex('pustaka_guides').select('*');
        if (category) {
            query = query.where('category', category);
        }
        const rows = await query;

        // Parse JSON fields
        const parsedRows = rows.map(row => ({
            ...row,
            allowed_depts: parseJsonArraySafe(row.allowed_depts),
            allowed_users: parseJsonArraySafe(row.allowed_users)
        }));

        res.json(parsedRows);
    } catch (err) {
        // Table might not exist if migration was missed, return empty safely for now
        console.error("Library Error:", err.message);
        res.json([]);
    }
};

export const getCategories = async (req, res) => {
    try {
        const categories = await knex('pustaka_categories').select('*');
        res.json(categories);
    } catch (err) {
        res.json([]);
    }
};

export const createGuide = async (req, res) => {
    try {
        const data = validateRequestBody(pustakaGuideCreateSchema, req, res);
        if (!data) return;

        const { title, content, category, description, icon, privacy, allowed_depts, allowed_users } = data;
        const [dbRes] = await knex('pustaka_guides').insert({
            title,
            category,
            description: description || content || '', // Use description, fallback to content if provided (backward compat payload), or empty
            icon,
            privacy,
            allowed_depts: JSON.stringify(allowed_depts || []),
            allowed_users: JSON.stringify(allowed_users || []),
            owner: req.user?.username || 'System'
        }).returning('id');
        const id = typeof dbRes === 'object' ? dbRes.id : dbRes;
        req.app.get('io')?.emit('data:changed', { channel: 'pustaka' });
        res.json({ id });
    } catch (err) {
        handleError(res, err, "PUSTAKA Error");
    }
};

export const updatePustakaGuide = async (req, res) => {
    try {
        const { id } = req.params;
        const data = validateRequestBody(pustakaGuideUpdateSchema, req, res);
        if (!data) return;

        const { title, description, category, icon, privacy, allowed_depts, allowed_users } = data;

        const existing = await knex('pustaka_guides').where('id', id).first();
        if (!existing) return res.status(404).json({ error: 'Guide not found' });

        const changingPrivacy = privacy !== undefined || allowed_depts !== undefined || allowed_users !== undefined;
        if (changingPrivacy && !isOwnerOrAdmin(req, existing.owner)) {
            return res.status(403).json({ error: 'Hanya owner panduan atau admin yang dapat mengubah pengaturan privasi' });
        }

        await knex('pustaka_guides').where('id', id).update({
            title,
            description,
            category,
            icon,
            privacy,
            allowed_depts: JSON.stringify(allowed_depts || []),
            allowed_users: JSON.stringify(allowed_users || [])
        });
        req.app.get('io')?.emit('data:changed', { channel: 'pustaka' });
        res.json({ success: true });
    } catch (err) {
        handleError(res, err, "PUSTAKA Error");
    }
};

export const deletePustakaGuide = async (req, res) => {
    try {
        const { id } = req.params;
        // Delete related slides first to avoid Foreign Key constraints (if ON DELETE CASCADE is missing)
        await knex('pustaka_slides').where('guide_id', id).del();

        // Then delete the guide
        await knex('pustaka_guides').where('id', id).del();
        req.app.get('io')?.emit('data:changed', { channel: 'pustaka' });
        res.json({ success: true });
    } catch (err) {
        console.error("Delete Guide Error:", err);
        handleError(res, err, "PUSTAKA Error");
    }
};

export const getGuideSlides = async (req, res) => {
    try {
        const { id } = req.params;
        const slides = await knex('pustaka_slides')
            .where('guide_id', id)
            .orderBy('step_order', 'asc'); // Fixed column name
        res.json(slides);
    } catch (err) {
        console.error("Library Error (Slides):", err.message);
        res.json([]);
    }
};

export const createPustakaSlide = async (req, res) => {
    try {
        const data = validateRequestBody(pustakaSlideCreateSchema, req, res);
        if (!data) return;

        const { guide_id, title, content, image_url, image, order_index } = data;
        const [dbRes] = await knex('pustaka_slides').insert({
            guide_id,
            title,
            content,
            image: image_url || image, // Support both naming conventions
            step_order: order_index || 0
        }).returning('id');
        const id = typeof dbRes === 'object' ? dbRes.id : dbRes;
        req.app.get('io')?.emit('data:changed', { channel: 'pustaka' });
        res.json({ id });
    } catch (err) {
        handleError(res, err, "PUSTAKA Error");
    }
};

export const deleteSlidesByGuideId = async (req, res) => {
    try {
        const { guideId } = req.params;
        await knex('pustaka_slides').where('guide_id', guideId).del();
        req.app.get('io')?.emit('data:changed', { channel: 'pustaka' });
        res.json({ success: true });
    } catch (err) {
        handleError(res, err, "PUSTAKA Error");
    }
};
