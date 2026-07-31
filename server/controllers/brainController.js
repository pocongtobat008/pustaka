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

export async function syncTrainingToBrain(req, res) {
    try {
        const { knex } = await import('../db.js');
        const docs = await knex('ai_training_documents')
            .select('id', 'title', 'content', 'category', 'tags')
            .where('status', 'active')
            .whereNotNull('content')
            .orderBy('id');

        let synced = 0, errors = 0;
        const results = [];

        for (const doc of docs) {
            try {
                const markdown = `# ${doc.title}\n\n**Kategori:** ${doc.category || 'general'}\n**Tags:** ${doc.tags || '-'}\n\n${doc.content}`;
                const tags = (doc.tags || '').split(',').map(t => t.trim()).filter(Boolean);
                tags.push('training-doc', doc.category || 'general');
                const result = await brain.ingestMarkdown(doc.title, markdown, { tags });
                results.push({ id: doc.id, title: doc.title, stored: result.storedCount || 0 });
                synced++;
            } catch (e) {
                errors++;
                results.push({ id: doc.id, title: doc.title, error: e.message });
            }
        }

        res.json({ success: true, data: { synced, errors, total: docs.length, results } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}
