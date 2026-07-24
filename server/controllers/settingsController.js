import { knex } from '../db.js';
import { handleError } from '../utils/errorHandler.js';
import { callLLM, maskKey, getAiModels, sanitizeApiKey } from '../services/aiAgent.js';
import { invalidateEmbeddingSettings } from '../ai_search.js';

const isAdmin = (req) => String(req.user?.role || '').toLowerCase() === 'admin';

export const getAiSettings = async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Hanya admin yang dapat mengakses pengaturan AI.' });
        const row = await knex('ai_settings').orderBy('id', 'asc').first();
        const data = row || { id: null, base_url: '', api_key: '', model: '', enabled: false };
        const hasKey = !!data.api_key;
        res.json({
            id: data.id,
            base_url: data.base_url || '',
            model: data.model || '',
            enabled: !!data.enabled,
            hasApiKey: hasKey,
            apiKeyMasked: hasKey ? maskKey(data.api_key) : ''
        });
    } catch (e) {
        handleError(res, e, 'Get AI Settings');
    }
};

export const saveAiSettings = async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Hanya admin yang dapat mengubah pengaturan AI.' });
        const { base_url, api_key, model, enabled } = req.body || {};
        const existing = await knex('ai_settings').orderBy('id', 'asc').first();

        const payload = {
            base_url: typeof base_url === 'string' ? base_url.trim() : (existing?.base_url || ''),
            model: typeof model === 'string' ? model.trim() : (existing?.model || ''),
            enabled: enabled === true || enabled === 'true'
        };

        if (api_key && typeof api_key === 'string' && api_key.trim() && !api_key.includes('•')) {
            payload.api_key = api_key.trim();
        }

        if (existing) {
            await knex('ai_settings').where('id', existing.id).update(payload);
        } else {
            await knex('ai_settings').insert(payload);
        }

        const updated = await knex('ai_settings').orderBy('id', 'asc').first();
        invalidateEmbeddingSettings();
        res.json({
            success: true,
            id: updated.id,
            base_url: updated.base_url,
            model: updated.model,
            enabled: !!updated.enabled,
            hasApiKey: !!updated.api_key,
            apiKeyMasked: updated.api_key ? maskKey(updated.api_key) : ''
        });
    } catch (e) {
        handleError(res, e, 'Save AI Settings');
    }
};

export const listAiModels = async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Hanya admin.' });
        let models = [];
        const qBase = req.query.base_url;
        const qKey = req.query.api_key;
        if (qBase && qKey) {
            const url = String(qBase).trim().replace(/\/+$/, '') + '/models';
            const r = await fetch(url, { headers: { Authorization: `Bearer ${sanitizeApiKey(qKey)}` } });
            if (r.ok) {
                const json = await r.json();
                models = (json.data || []).map(m => m.id).filter(Boolean);
            }
        } else {
            models = await getAiModels();
        }
        const row = await knex('ai_settings').orderBy('id', 'asc').first();
        const current = row?.model || (models[0] || '');
        res.json({ models, current });
    } catch (e) {
        handleError(res, e, 'Get AI Models');
    }
};

export const testAiSettings = async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Hanya admin.' });
        const { base_url, api_key, model } = req.body || {};
        if (!base_url) {
            return res.status(400).json({ success: false, error: 'Base URL wajib diisi untuk test.' });
        }

        let resolvedKey = api_key && typeof api_key === 'string' ? sanitizeApiKey(api_key) : '';
        if (!resolvedKey) {
            const row = await knex('ai_settings').orderBy('id', 'asc').first();
            if (row?.api_key) resolvedKey = sanitizeApiKey(row.api_key);
        }
        if (!resolvedKey) {
            return res.status(400).json({ success: false, error: 'API Key wajib diisi untuk test.' });
        }

        const settings = {
            base_url: String(base_url).trim(),
            api_key: resolvedKey,
            model: model ? String(model).trim() : 'gpt-4o-mini'
        };

        const result = { modelsOk: false, chatOk: false, modelsCount: 0 };

        // 1) verify base_url + auth via /models
        try {
            const modelsRes = await fetch(`${settings.base_url}/models`, {
                headers: { Authorization: `Bearer ${sanitizeApiKey(settings.api_key)}` }
            });
            if (modelsRes.ok) {
                const json = await modelsRes.json().catch(() => ({}));
                result.modelsOk = true;
                result.modelsCount = Array.isArray(json.data) ? json.data.length : 0;
            } else {
                result.modelsError = `Models endpoint returned HTTP ${modelsRes.status}`;
            }
        } catch (e) {
            result.modelsError = e.message;
        }

        // 2) verify chat completions
        try {
            const data = await callLLM([{ role: 'user', content: 'Jawab hanya dengan kata: OK' }], [], settings);
            const txt = data?.choices?.[0]?.message?.content || '';
            result.chatOk = true;
            result.sample = txt.slice(0, 120);
        } catch (e) {
            result.chatError = e.message;
        }

        res.json({ success: result.chatOk, ...result });
    } catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
};
