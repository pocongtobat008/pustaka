import { knex } from '../db.js';

// ── Knowledge Graph builder ──
// Aggregates training docs, chunks, learning logs (knowledge), and corrections
// into a brain-style graph: nodes + edges for visualization.
//
// Node types: category (hub), training_doc, chunk, knowledge, correction
// Edge types: has_category, has_chunk, trained_into, corrected_into, refines

const CATEGORY_COLORS = {
    tax_regulation: '#ef4444',
    accounting: '#3b82f6',
    accounting_standard: '#3b82f6',
    procedure: '#f59e0b',
    guide: '#10b981',
    general: '#8b5cf6',
};

export function categoryColor(cat) {
    return CATEGORY_COLORS[cat] || CATEGORY_COLORS.general;
}

export async function buildKnowledgeGraph({ includeChunks = true } = {}) {
    // Normalize inconsistent category labels across tables so related
    // nodes cluster under one hub (docs use 'tax', logs use 'tax_regulation').
    const normCat = (c) => {
        const m = { tax: 'tax_regulation', akuntansi: 'accounting', accounting: 'accounting' };
        return m[c] || c;
    };

    const [docs, chunks, knowledge, corrections] = await Promise.all([
        knex('ai_training_documents')
            .select('id', 'title', 'category', 'status', 'chunk_count', 'created_at')
            .orderBy('created_at', 'desc'),
        includeChunks
            ? knex('ai_training_chunks').select('id', 'document_id', 'chunk_index')
            : [],
        knex('ai_learning_logs')
            .select('id', 'topic', 'category', 'used_in_training', 'training_doc_id', 'confidence', 'repeat_count')
            .orderBy('repeat_count', 'desc'),
        knex('ai_learning_corrections')
            .select('id', 'topic', 'category', 'applied', 'training_doc_id', 'severity', 'learning_log_id')
            .orderBy('severity', 'desc'),
    ]);

    const nodes = [];
    const edges = [];
    const seenCategories = new Set();

    const ensureCategory = (cat) => {
        const c = cat || 'general';
        if (!seenCategories.has(c)) {
            seenCategories.add(c);
            nodes.push({
                id: `cat:${c}`,
                type: 'category',
                label: c,
                color: categoryColor(c),
                size: 14,
            });
        }
        return `cat:${c}`;
    };

    // ── Training documents ──
    const docIds = new Set();
    for (const d of docs) {
        docIds.add(d.id);
        const catId = ensureCategory(normCat(d.category));
        nodes.push({
            id: `doc:${d.id}`,
            type: 'training_doc',
            label: d.title || `Doc #${d.id}`,
            category: normCat(d.category) || 'general',
            status: d.status,
            color: '#22d3ee',
            size: 10,
            meta: { chunkCount: d.chunk_count, createdAt: d.created_at },
        });
        edges.push({ id: `e-doc-cat-${d.id}`, source: `doc:${d.id}`, target: catId, type: 'has_category' });
    }

    // ── Chunks (children of docs) ──
    if (includeChunks) {
        for (const c of chunks) {
            if (!docIds.has(c.document_id)) continue;
            nodes.push({
                id: `chunk:${c.id}`,
                type: 'chunk',
                label: `Chunk ${c.chunk_index + 1}`,
                color: '#67e8f9',
                size: 4,
                meta: { documentId: c.document_id },
            });
            edges.push({
                id: `e-chunk-${c.id}`,
                source: `chunk:${c.id}`,
                target: `doc:${c.document_id}`,
                type: 'has_chunk',
            });
        }
    }

    // ── Knowledge (learning logs) ──
    for (const k of knowledge) {
        const catId = ensureCategory(normCat(k.category));
        nodes.push({
            id: `know:${k.id}`,
            type: 'knowledge',
            label: k.topic,
            category: normCat(k.category) || 'general',
            color: k.used_in_training ? '#34d399' : '#a3a3a3',
            size: k.used_in_training ? 9 : 6,
            meta: {
                usedInTraining: k.used_in_training,
                confidence: k.confidence,
                repeatCount: k.repeat_count,
                trainingDocId: k.training_doc_id,
            },
        });
        edges.push({ id: `e-know-cat-${k.id}`, source: `know:${k.id}`, target: catId, type: 'has_category' });

        if (k.used_in_training && k.training_doc_id && docIds.has(k.training_doc_id)) {
            edges.push({
                id: `e-know-doc-${k.id}`,
                source: `know:${k.id}`,
                target: `doc:${k.training_doc_id}`,
                type: 'trained_into',
            });
        }
    }

    // ── Corrections ──
    for (const c of corrections) {
        const catId = ensureCategory(normCat(c.category));
        nodes.push({
            id: `corr:${c.id}`,
            type: 'correction',
            label: c.topic,
            category: normCat(c.category) || 'general',
            color: c.applied ? '#fb7185' : '#f43f5e',
            size: 7,
            meta: { applied: c.applied, severity: c.severity, learningLogId: c.learning_log_id },
        });
        edges.push({ id: `e-corr-cat-${c.id}`, source: `corr:${c.id}`, target: catId, type: 'has_category' });

        if (c.training_doc_id && docIds.has(c.training_doc_id)) {
            edges.push({
                id: `e-corr-doc-${c.id}`,
                source: `corr:${c.id}`,
                target: `doc:${c.training_doc_id}`,
                type: 'corrected_into',
            });
        }

        const matchKnow = knowledge.find(k => k.topic === c.topic);
        if (matchKnow) {
            edges.push({
                id: `e-corr-know-${c.id}`,
                source: `corr:${c.id}`,
                target: `know:${matchKnow.id}`,
                type: 'refines',
            });
        }
    }

    const stats = {
        categories: seenCategories.size,
        trainingDocs: docs.length,
        chunks: chunks.length,
        knowledge: knowledge.length,
        knowledgeTrained: knowledge.filter(k => k.used_in_training).length,
        corrections: corrections.length,
        correctionsApplied: corrections.filter(c => c.applied).length,
    };

    return { nodes, edges, stats };
}
