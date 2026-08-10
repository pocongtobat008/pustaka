import brain from '../services/brainService.js';

export async function getBrainHealth(req, res) {
    try {
        const health = await brain.getHealth();
        res.json({ success: true, data: health });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

export async function recallMemories(req, res) {
    try {
        const { query, limit, type } = req.body || {};
        if (!query) return res.status(400).json({ success: false, error: 'query required' });
        const results = await brain.recall(query, { limit, type });
        res.json({ success: true, data: results, count: results.length });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

export async function storeMemory(req, res) {
    try {
        const { content, type, importance, tags } = req.body || {};
        if (!content) return res.status(400).json({ success: false, error: 'content required' });
        const memory = await brain.remember(content, { type, importance, tags });
        res.json({ success: true, data: memory });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

export async function ingestKnowledge(req, res) {
    try {
        const { title, markdown, tags } = req.body || {};
        if (!title || !markdown) return res.status(400).json({ success: false, error: 'title and markdown required' });
        const result = await brain.ingestMarkdown(title, markdown, { tags });
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

export async function triggerConsolidation(req, res) {
    try {
        const { dryRun, clusterStrategy } = req.body || {};
        const result = await brain.consolidate({ dryRun, clusterStrategy });
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

export async function getMemoryStats(req, res) {
    try {
        const stats = await brain.getStats();
        res.json({ success: true, data: stats });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

export async function listAllMemories(req, res) {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const data = await brain.listMemories({ limit, offset });
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

export async function getNetworkGraph(req, res) {
    try {
        const data = await brain.getNetworkData();
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

const MIN_DOC_CHARS = 150;       // konten lebih pendek dari ini tidak layak disimpan
const DOC_TIMEOUT_MS = 60000;    // timeout per dokumen agar satu dokumen bermasalah tidak menggantung sync
const CHUNK_MAX_CHARS = 1400;    // ukuran maks per memori chunk
const MIN_CHUNK_CHARS = 80;      // potongan lebih pendek dari ini dibuang

function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timeout setelah ${Math.round(ms / 1000)}s`)), ms);
        promise.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
    });
}

// Potong teks jadi chunk per paragraf (maks CHUNK_MAX_CHARS) agar tiap memori tetap utuh & mudah dicari
function chunkText(text, maxChars = CHUNK_MAX_CHARS) {
    const parts = String(text || '').split(/\n\s*\n/);
    const chunks = [];
    let cur = '';
    for (const p of parts) {
        const t = p.trim();
        if (!t) continue;
        if (cur && (cur + '\n\n' + t).length > maxChars) {
            if (cur) chunks.push(cur);
            cur = t;
        } else {
            cur = cur ? cur + '\n\n' + t : t;
        }
        // Paragraf tunggal yang sangat panjang (umum di hasil OCR PDF) di-split paksa
        while (cur.length > maxChars) {
            chunks.push(cur.slice(0, maxChars));
            cur = cur.slice(maxChars);
        }
    }
    if (cur) chunks.push(cur);
    return chunks.filter(c => c.trim().length >= MIN_CHUNK_CHARS);
}

export async function runTrainingSync() {
    const { knex } = await import('../db.js');
    const docs = await knex('ai_training_documents')
        .select('id', 'title', 'content', 'category', 'tags')
        .where('status', 'active')
        .whereNotNull('content')
        .orderBy('id');

    let synced = 0, errors = 0, skipped = 0;
    let totalChunks = 0, totalStored = 0;
    const results = [];

    for (const doc of docs) {
        const content = String(doc.content || '').trim();
        if (content.length < MIN_DOC_CHARS) {
            skipped++;
            results.push({ id: doc.id, title: doc.title, skipped: 'konten terlalu pendek' });
            continue;
        }

        const baseTags = (doc.tags || '').split(',').map(t => t.trim()).filter(Boolean);
        baseTags.push('training-doc', doc.category || 'general', `doc:${doc.id}`);
        const chunks = chunkText(content);
        if (chunks.length === 0) {
            skipped++;
            results.push({ id: doc.id, title: doc.title, skipped: 'tidak ada paragraf layak' });
            continue;
        }
        totalChunks += chunks.length;

        let stored = 0, failed = 0;
        for (let i = 0; i < chunks.length; i++) {
            try {
                const mem = await withTimeout(
                    brain.remember(chunks[i], { type: 'semantic', importance: 0.75, tags: [...baseTags, `chunk:${i}`] }),
                    DOC_TIMEOUT_MS
                );
                if (mem) stored++; else failed++;
            } catch (e) {
                failed++;
            }
            // Jeda kecil agar tidak melewati rate-limit 1MBrain (100 req/menit)
            await new Promise(r => setTimeout(r, 200));
        }
        totalStored += stored;
        if (stored > 0) synced++;
        else if (failed > 0) errors++;
        results.push({ id: doc.id, title: doc.title, chunks: chunks.length, stored, failed });
    }

    return { synced, errors, skipped, total: docs.length, totalChunks, totalStored, results };
}

export async function syncTrainingToBrain(req, res) {
    try {
        const data = await runTrainingSync();
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

// ── Auto-sync terjadwal: sinkronisasi training → 1MBrain berkala ──
// Atur interval via env BRAIN_AUTO_SYNC_HOURS (default 6 jam). Hanya jalan jika 1MBrain online.
export function startBrainAutoSyncScheduler() {
    const hours = Math.max(1, Number(process.env.BRAIN_AUTO_SYNC_HOURS || 6));
    const run = async () => {
        try {
            const health = await brain.getHealth();
            if (!health || health.status !== 'ok') {
                console.warn('[Brain] Auto-sync dilewati: 1MBrain offline.');
                return;
            }
            const d = await runTrainingSync();
            console.log(`[Brain] Auto-sync selesai: ${d.synced}/${d.total} dokumen, ${d.totalStored} chunk (${d.errors} error, ${d.skipped} skip)`);
        } catch (e) {
            console.warn(`[Brain] Auto-sync gagal: ${e.message}`);
        }
    };
    setTimeout(run, 60 * 1000); // pertama kali 1 menit setelah server nyala
    setInterval(run, hours * 3600 * 1000);
    console.log(`[Brain] Auto-sync training terjadwal: setiap ${hours} jam`);
}
