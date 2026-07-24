import { knex } from '../db.js';
import { connection } from '../utils/queue.js';
import { sanitizeApiKey } from './aiAgent.js';

// ── Lightweight health checks for each critical dependency ──

async function checkDatabase() {
    const start = Date.now();
    try {
        await knex.raw('SELECT 1');
        return { status: 'ok', latencyMs: Date.now() - start };
    } catch (e) {
        return { status: 'down', error: e.message, latencyMs: Date.now() - start };
    }
}

async function checkRedis() {
    const start = Date.now();
    try {
        if (!connection || typeof connection.ping !== 'function') {
            return { status: 'unknown', error: 'Redis client not initialized' };
        }
        const pong = await Promise.race([
            connection.ping(),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000)),
        ]);
        return { status: pong === 'PONG' ? 'ok' : 'degraded', latencyMs: Date.now() - start };
    } catch (e) {
        return { status: 'down', error: e.message, latencyMs: Date.now() - start };
    }
}

async function checkEmbeddingApi() {
    const start = Date.now();
    try {
        const row = await knex('ai_settings').orderBy('id', 'asc').first();
        const settings = row ? { base_url: row.base_url, api_key: row.api_key } : null;
        if (!settings || !settings.base_url) {
            return { status: 'not_configured', note: 'Embedding API belum diatur di ai_settings' };
        }
        const url = settings.base_url.replace(/\/+$/, '') + '/embeddings';
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sanitizeApiKey(settings.api_key)}` },
            body: JSON.stringify({ model: 'we/text-embedding-v3', input: 'health-check' }),
            signal: AbortSignal.timeout(4000),
        });
        const latencyMs = Date.now() - start;
        if (res.ok) return { status: 'ok', latencyMs };
        return { status: 'degraded', httpStatus: res.status, latencyMs };
    } catch (e) {
        return { status: 'down', error: e.message, latencyMs: Date.now() - start };
    }
}

async function checkLlmApi() {
    const start = Date.now();
    try {
        const row = await knex('ai_settings').orderBy('id', 'asc').first();
        const settings = row ? { base_url: row.base_url, api_key: row.api_key, enabled: row.enabled } : null;
        if (!settings || !settings.base_url || !settings.api_key) {
            return { status: 'not_configured', note: 'LLM API belum diatur di ai_settings' };
        }
        const url = settings.base_url.replace(/\/+$/, '') + '/models';
        const res = await fetch(url, {
            method: 'GET',
            headers: { Authorization: `Bearer ${sanitizeApiKey(settings.api_key)}` },
            signal: AbortSignal.timeout(4000),
        });
        const latencyMs = Date.now() - start;
        if (res.ok) return { status: 'ok', latencyMs };
        return { status: 'degraded', httpStatus: res.status, latencyMs };
    } catch (e) {
        return { status: 'down', error: e.message, latencyMs: Date.now() - start };
    }
}

export async function getHealthStatus() {
    const [db, redis, embedding, llm] = await Promise.all([
        checkDatabase(),
        checkRedis(),
        checkEmbeddingApi(),
        checkLlmApi(),
    ]);

    const deps = { db, redis, embedding, llm };
    const healthy = db.status === 'ok' && redis.status === 'ok';
    const degraded = Object.values(deps).some(d => d.status === 'down' || d.status === 'degraded');

    let overall = 'ok';
    if (!healthy) overall = 'critical';
    else if (degraded) overall = 'degraded';

    return {
        status: overall,
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        dependencies: deps,
    };
}
