import { knex } from '../db.js';
import { handleError } from '../utils/errorHandler.js';
import { callLLM, maskKey, getAiModels, sanitizeApiKey } from '../services/aiAgent.js';
import { invalidateEmbeddingSettings } from '../ai_search.js';

const isAdmin = (req) => String(req.user?.role || '').toLowerCase() === 'admin';

export const getAiSettings = async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Hanya admin yang dapat mengakses pengaturan AI.' });
        const row = await knex('ai_settings').orderBy('id', 'asc').first();
        const data = row || { id: null, base_url: '', api_key: '', model: '', enabled: false, meta: null };
        const hasKey = !!data.api_key;
        let meta = {};
        try { meta = data.meta ? JSON.parse(data.meta) : {}; } catch { meta = {}; }
        res.json({
            id: data.id,
            base_url: data.base_url || '',
            model: data.model || '',
            enabled: !!data.enabled,
            hasApiKey: hasKey,
            apiKeyMasked: hasKey ? maskKey(data.api_key) : '',
            fallbackModels: Array.isArray(meta.fallback_models) ? meta.fallback_models : []
        });
    } catch (e) {
        handleError(res, e, 'Get AI Settings');
    }
};

export const saveAiSettings = async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Hanya admin yang dapat mengubah pengaturan AI.' });
        const { base_url, api_key, model, enabled, fallback_models } = req.body || {};
        const existing = await knex('ai_settings').orderBy('id', 'asc').first();

        const payload = {
            base_url: typeof base_url === 'string' ? base_url.trim() : (existing?.base_url || ''),
            model: typeof model === 'string' ? model.trim() : (existing?.model || ''),
            enabled: enabled === true || enabled === 'true'
        };

        // Persist fallback model list into meta (merged with existing meta)
        if (Array.isArray(fallback_models)) {
            let existingMeta = {};
            try { existingMeta = existing?.meta ? JSON.parse(existing.meta) : {}; } catch { existingMeta = {}; }
            existingMeta.fallback_models = fallback_models.filter(m => typeof m === 'string' && m.trim()).slice(0, 12);
            payload.meta = JSON.stringify(existingMeta);
        }

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
        let updatedMeta = {};
        try { updatedMeta = updated?.meta ? JSON.parse(updated.meta) : {}; } catch { updatedMeta = {}; }
        res.json({
            success: true,
            id: updated.id,
            base_url: updated.base_url,
            model: updated.model,
            enabled: !!updated.enabled,
            hasApiKey: !!updated.api_key,
            apiKeyMasked: updated.api_key ? maskKey(updated.api_key) : '',
            fallbackModels: Array.isArray(updatedMeta.fallback_models) ? updatedMeta.fallback_models : []
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

// ── In-memory cache for model verification (5 min) ──
const verifyCache = new Map(); // key(base|keySuffix) -> { ts, data }

// Simple tool definition used to check the model actually supports function calling
export const verifyAiModels = async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Hanya admin.' });
        const { base_url, api_key, model, models, limit, apply_fastest } = req.body || {};
        if (!base_url) return res.status(400).json({ success: false, error: 'Base URL wajib diisi.' });

        let resolvedKey = api_key && typeof api_key === 'string' ? sanitizeApiKey(api_key) : '';
        if (!resolvedKey) {
            const row = await knex('ai_settings').orderBy('id', 'asc').first();
            if (row?.api_key) resolvedKey = sanitizeApiKey(row.api_key);
        }
        if (!resolvedKey) return res.status(400).json({ success: false, error: 'API Key wajib diisi.' });

        const base = String(base_url).trim().replace(/\/+$/, '');
        const cacheKey = `${base}|${resolvedKey.slice(-8)}`;
        const cached = verifyCache.get(cacheKey);
        // Mode auto-detect selalu jalankan ulang benchmark (perlu data segar)
        if (cached && !apply_fastest && Date.now() - cached.ts < 5 * 60 * 1000) {
            return res.json({ success: true, fromCache: true, ...cached.data });
        }

        // Fetch model list from gateway (with timeout)
        const modelsAc = new AbortController();
        const modelsTimer = setTimeout(() => modelsAc.abort(), 15000);
        let modelsRes;
        try {
            modelsRes = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${resolvedKey}` }, signal: modelsAc.signal });
        } finally {
            clearTimeout(modelsTimer);
        }
        if (!modelsRes.ok) return res.status(502).json({ success: false, error: `Gateway /models HTTP ${modelsRes.status}` });
        const list = ((await modelsRes.json()).data || []).map(m => m.id).filter(Boolean);
        if (!list.length) return res.status(502).json({ success: false, error: 'Gateway mengembalikan daftar model kosong.' });

        // Pick candidates: explicit list > representative sampling across providers
        let candidates;
        if (Array.isArray(models) && models.length) {
            candidates = models.map(m => String(m)).filter(id => list.includes(id)).slice(0, 30);
        } else {
            const cur = model ? String(model).trim() : '';
            const free = list.filter(id => /^free\//i.test(id));
            const rest = list.filter(id => !/^free\//i.test(id) && id !== cur);
            const n = Math.min(Number(limit) || 18, 30);
            // Sample per provider prefix so the scan covers multiple channels, not just free/*
            const byPrefix = {};
            for (const id of rest) { const p = id.split('/')[0] || 'misc'; (byPrefix[p] = byPrefix[p] || []).push(id); }
            const prefixes = Object.keys(byPrefix).sort((a, b) => a.localeCompare(b));
            const perPrefix = Math.max(1, Math.floor((n - Math.min(free.length, 6)) / Math.max(prefixes.length, 1)));
            const sampledRest = prefixes.flatMap(p => byPrefix[p].slice(0, perPrefix));
            candidates = [...new Set([cur, ...free.slice(0, 6), ...sampledRest].filter(Boolean))].slice(0, n);
        }
        if (!candidates.length) return res.status(400).json({ success: false, error: 'Tidak ada kandidat model untuk diverifikasi.' });

        const toolDef = [{ type: 'function', function: { name: 'verify_tool', description: 'Test tool calling.', parameters: { type: 'object', properties: {} }, required: [] } }];
        const results = [];
        let next = 0;
        const worker = async () => {
            while (next < candidates.length) {
                const id = candidates[next++];
                const ac = new AbortController();
                const timer = setTimeout(() => ac.abort(), 20000);
                const t0 = Date.now();
                let ok = false;
                let toolCalls = false;
                let error = '';
                try {
                    const r = await fetch(`${base}/chat/completions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resolvedKey}` },
                        body: JSON.stringify({
                            model: id,
                            messages: [{ role: 'user', content: 'Panggil tool verify_tool' }],
                            tools: toolDef,
                            max_tokens: 20
                            // TANPA field 'stream' — gateway berbasis Gemini (antigravity) menolak field ini (400).
                        }),
                        signal: ac.signal
                    });
                    const txt = await r.text();
                    if (r.ok) {
                        // Gateway bisa merespons JSON biasa ATAU SSE (text/event-stream) walau non-stream diminta.
                        let toolCallsArr = null;
                        if (txt.includes('data:')) {
                            for (const line of txt.split('\n')) {
                                if (!line.startsWith('data: ')) continue;
                                const payload = line.slice(6).trim();
                                if (!payload || payload === '[DONE]') continue;
                                try {
                                    const obj = JSON.parse(payload);
                                    const piece = obj.choices?.[0]?.delta || obj.choices?.[0]?.message || {};
                                    if (piece.tool_calls) toolCallsArr = piece.tool_calls;
                                } catch { /* chunk non-JSON: abaikan */ }
                            }
                        } else {
                            const j = JSON.parse(txt);
                            toolCallsArr = j.choices?.[0]?.message?.tool_calls || null;
                        }
                        ok = true;
                        toolCalls = !!(toolCallsArr && toolCallsArr.length);
                    } else {
                        try { error = JSON.parse(txt).error?.message || `HTTP ${r.status}`; } catch { error = `HTTP ${r.status}`; }
                    }
                } catch (e) {
                    error = e.name === 'AbortError' ? 'timeout (20s)' : e.message;
                } finally {
                    clearTimeout(timer);
                }
                results.push({ model: id, ok, toolCalls, ms: Date.now() - t0, error: ok ? undefined : String(error).slice(0, 120) });
            }
        };
        await Promise.all(Array.from({ length: 4 }, worker));

        const worked = results.filter(r => r.ok)
            .sort((a, b) => (b.toolCalls ? 1 : 0) - (a.toolCalls ? 1 : 0) || a.ms - b.ms);
        // AI Agent bergantung pada function-calling → prioritaskan model yang mendukung tools
        const toolCaps = worked.filter(r => r.toolCalls);
        const others = worked.filter(r => !r.toolCalls);
        // Jalur Verify biasa (tanpa auto-detect): pertahankan logika lama — fallback murni tool-capable bila ada
        const fallbackSaved = (toolCaps.length ? toolCaps : worked).slice(0, 8).map(r => r.model);
        // Jalur auto-detect: ranking tool-capable & tercepat dulu, lalu model lain yang bekerja
        const pool = apply_fastest && toolCaps.length ? [...toolCaps, ...others] : (toolCaps.length ? toolCaps : worked);

        // Persist working models as automatic fallback list (meta.fallback_models)
        const row = await knex('ai_settings').orderBy('id', 'asc').first();
        let appliedModel = null;
        let appliedFallbacks = [];
        if (row && fallbackSaved.length) {
            let meta = {};
            try { meta = row.meta ? JSON.parse(row.meta) : {}; } catch { meta = {}; }
            meta.fallback_models = fallbackSaved;
            const update = { meta: JSON.stringify(meta) };
            if (apply_fastest) {
                // Auto-detect: model tool-capable tercepat jadi model utama, 3 berikutnya jadi cadangan.
                // Hanya diterapkan jika model tercepat mendukung tool-calling (agar agent tidak kehilangan tools).
                const fastest = pool[0];
                if (fastest && fastest.toolCalls) {
                    appliedModel = fastest.model;
                    update.model = fastest.model;
                    const fallbacks = pool.slice(1, 4).map(r => r.model);
                    meta.fallback_models = fallbacks.length ? fallbacks : (meta.fallback_models || []);
                    update.meta = JSON.stringify(meta);
                }
            }
            await knex('ai_settings').where('id', row.id).update(update);
            // Laporkan fallback aktual yang tersimpan di DB (konsisten dengan yang diterapkan)
            try { appliedFallbacks = JSON.parse(update.meta)?.fallback_models || []; } catch { appliedFallbacks = []; }
        }

        const data = {
            total: candidates.length,
            worked: worked.length,
            fallbackSaved,
            appliedModel,
            appliedFallbacks,
            results: results.sort((a, b) => Number(b.ok) - Number(a.ok) || a.model.localeCompare(b.model))
        };
        // Auto-detect selalu fresh; jangan menimpa cache verifikasi biasa dengan data bentuk berbeda
        if (!apply_fastest) verifyCache.set(cacheKey, { ts: Date.now(), data });
        res.json({ success: true, fromCache: false, ...data });
    } catch (e) {
        handleError(res, e, 'Verify AI Models');
    }
};
