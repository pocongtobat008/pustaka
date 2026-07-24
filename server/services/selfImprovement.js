import { knex } from '../db.js';
import { sanitizeApiKey } from './aiAgent.js';

// ── Categories ──
const CATEGORIES = ['tax_regulation', 'accounting_standard', 'procedure', 'guide', 'general'];

// ── Minimum repeat count to auto-generate training doc ──
const MIN_REPEAT_FOR_TRAINING = 2;
const MIN_KNOWLEDGE_FOR_DOC = 2;

// ── Log a single interaction for learning ──
export async function logInteraction({ sessionId, messageId, question, answer, toolCalls }) {
    if (!question || !answer || question.length < 10 || answer.length < 20) return null;

    try {
        // Use LLM to extract knowledge from this Q&A pair
        const extracted = await extractKnowledge(question, answer);
        if (!extracted || !extracted.topic) return null;

        // Check if similar topic already exists
        const existing = await knex('ai_learning_logs')
            .where('topic', 'ilike', extracted.topic)
            .first();

        if (existing) {
            // Update repeat count and merge knowledge
            await knex('ai_learning_logs')
                .where('id', existing.id)
                .update({
                    repeat_count: existing.repeat_count + 1,
                    confidence: Math.min(1, existing.confidence + 0.1),
                    answer_summary: extracted.answerSummary || existing.answer_summary,
                    updated_at: knex.fn.now()
                });
            console.log(`[SelfImprovement] Updated topic "${extracted.topic}" (repeat: ${existing.repeat_count + 1})`);
            return existing.id;
        }

        // Insert new learning log
        const [id] = await knex('ai_learning_logs').insert({
            session_id: sessionId || null,
            message_id: messageId || null,
            category: extracted.category || 'general',
            topic: extracted.topic,
            question_summary: extracted.questionSummary || question.slice(0, 200),
            answer_summary: extracted.answerSummary || answer.slice(0, 500),
            knowledge_extracted: extracted.knowledge || answer.slice(0, 500),
            source_type: 'chat',
            confidence: extracted.confidence || 0.5,
            repeat_count: 1,
        }).returning('id');

        console.log(`[SelfImprovement] New knowledge: "${extracted.topic}" (cat: ${extracted.category})`);
        return id;
    } catch (err) {
        console.warn(`[SelfImprovement] logInteraction failed: ${err.message}`);
        return null;
    }
}

// ── Extract knowledge from Q&A pair using LLM ──
async function extractKnowledge(question, answer) {
    try {
        const settings = await knex('ai_settings').where('enabled', true).first();
        if (!settings?.base_url || !settings?.api_key) return fallbackExtract(question, answer);

        const prompt = `Analisis pasangan pertanyaan-jawaban ini dan ekstrak pengetahuan yang dapat ditindaklanjuti.

PERTANYAAN:
${question.slice(0, 500)}

JAWABAN:
${answer.slice(0, 1000)}

Ekstrak dalam format JSON (hanya JSON, tanpa penjelasan tambahan):
{
  "topic": "topik spesifik (maks 200 karakter)",
  "category": "salah satu dari: ${CATEGORIES.join(', ')}",
  "questionSummary": "ringkasan pertanyaan dalam 1-2 kalimat",
  "answerSummary": "ringkasan jawaban dalam 2-3 kalimat",
  "knowledge": "pengetahuan konkret yang bisa digunakan untuk menjawab pertanyaan serupa di masa depan",
  "confidence": angka 0-1 (seberapa yakin pengetahuan ini benar dan berguna)
}`;

        const url = settings.base_url.replace(/\/+$/, '') + '/chat/completions';
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sanitizeApiKey(settings.api_key)}`,
            },
            body: JSON.stringify({
                model: settings.model || 'gpt-4',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 500,
            }),
            signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) return fallbackExtract(question, answer);

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '';

        // Parse JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return fallbackExtract(question, answer);

        const parsed = JSON.parse(jsonMatch[0]);
        if (!parsed.topic || !CATEGORIES.includes(parsed.category)) {
            return fallbackExtract(question, answer);
        }

        return {
            topic: parsed.topic.slice(0, 200),
            category: parsed.category,
            questionSummary: parsed.questionSummary || question.slice(0, 200),
            answerSummary: parsed.answerSummary || answer.slice(0, 500),
            knowledge: parsed.knowledge || answer.slice(0, 500),
            confidence: Math.max(0, Math.min(1, parseFloat(parsed.confidence) || 0.5)),
        };
    } catch (err) {
        console.warn(`[SelfImprovement] LLM extraction failed, using fallback: ${err.message}`);
        return fallbackExtract(question, answer);
    }
}

// ── Fallback: rule-based extraction when LLM unavailable ──
function fallbackExtract(question, answer) {
    const q = question.toLowerCase();
    const topicPatterns = [
        { pattern: /ppn|pajak pertambahan nilai|vat/i, topic: 'PPN (Pajak Pertambahan Nilai)', category: 'tax_regulation' },
        { pattern: /spt masa|spt tahunan|pelaporan pajak/i, topic: 'SPT Pajak', category: 'tax_regulation' },
        { pattern: /faktur pajak|fp|invoice pajak/i, topic: 'Faktur Pajak', category: 'tax_regulation' },
        { pattern: /coa|chart of account|akun/i, topic: 'Chart of Accounts (COA)', category: 'accounting_standard' },
        { pattern: /inventory|stok|barang|gudang/i, topic: 'Inventory Management', category: 'procedure' },
        { pattern: /invoice|faktur|billing/i, topic: 'Invoice & Billing', category: 'procedure' },
        { pattern: /upload|import|excel/i, topic: 'Data Upload & Import', category: 'guide' },
        { pattern: /login|akun|password|autentikasi/i, topic: 'Authentication & Access', category: 'guide' },
    ];

    let matched = { topic: question.slice(0, 100), category: 'general' };
    for (const { pattern, topic, category } of topicPatterns) {
        if (pattern.test(q)) {
            matched = { topic, category };
            break;
        }
    }

    return {
        ...matched,
        questionSummary: question.slice(0, 200),
        answerSummary: answer.slice(0, 500),
        knowledge: answer.slice(0, 500),
        confidence: 0.3,
    };
}

// ── Analyze all unprocessed chat messages ──
export async function analyzeRecentChats(sinceHours = 24) {
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);

    // Get user messages that don't have learning logs yet
    const unprocessed = await knex('ai_chat_messages as m')
        .leftJoin('ai_learning_logs as l', 'l.message_id', 'm.id')
        .where('m.role', 'user')
        .where('m.created_at', '>=', since)
        .whereNull('l.id')
        .select('m.id', 'm.session_id', 'm.content', 'm.created_at')
        .orderBy('m.created_at', 'desc')
        .limit(50);

    console.log(`[SelfImprovement] Found ${unprocessed.length} unprocessed messages (last ${sinceHours}h)`);

    let processed = 0;
    for (const msg of unprocessed) {
        // Get the corresponding assistant response
        const reply = await knex('ai_chat_messages')
            .where('session_id', msg.session_id)
            .where('role', 'assistant')
            .where('created_at', '>', msg.created_at)
            .orderBy('created_at', 'asc')
            .first();

        if (!reply) continue;

        const logId = await logInteraction({
            sessionId: msg.session_id,
            messageId: msg.id,
            question: msg.content,
            answer: reply.content,
            toolCalls: reply.tool_calls,
        });

        if (logId) processed++;
    }

    console.log(`[SelfImprovement] Processed ${processed}/${unprocessed.length} messages`);
    return { total: unprocessed.length, processed };
}

// ── Auto-generate training documents from accumulated knowledge ──
export async function generateTrainingDocsFromKnowledge(embedFn) {
    // Find topics that have been asked multiple times but not yet trained
    const untrained = await knex('ai_learning_logs')
        .where('used_in_training', false)
        .where('repeat_count', '>=', MIN_REPEAT_FOR_TRAINING)
        .orderBy('repeat_count', 'desc')
        .limit(20);

    if (untrained.length < MIN_KNOWLEDGE_FOR_DOC) {
        console.log(`[SelfImprovement] Only ${untrained.length} untrained topics (need ${MIN_KNOWLEDGE_FOR_DOC}). Skipping.`);
        return { generated: 0, topics: [] };
    }

    // Group by category
    const byCategory = {};
    for (const log of untrained) {
        if (!byCategory[log.category]) byCategory[log.category] = [];
        byCategory[log.category].push(log);
    }

    const { saveDocument, parseDocument, generateDocEmbedding } = await import('./trainingDocs.js');
    const generated = [];

    for (const [category, topics] of Object.entries(byCategory)) {
        if (topics.length < 2) continue;

        // Build document content from knowledge
        const sections = topics.map(t =>
            `## ${t.topic}\n\nPertanyaan: ${t.question_summary}\n\nPengetahuan: ${t.knowledge_extracted}`
        );

        const content = `# Pengetahuan Otomatis - ${category}\n\n` +
            `Dokumen ini dihasilkan secara otomatis dari ${topics.length} interaksi pengguna.\n\n` +
            sections.join('\n\n---\n\n');

        // Save as training document
        const title = `Auto: ${category} (${topics.map(t => t.topic).join(', ').slice(0, 100)})`;

        try {
            const docId = await saveDocument({
                title,
                content,
                category,
                tags: `auto-generated,${category}`,
                sourceType: 'auto',
                sourceUrl: null,
                filename: `auto_${category}_${Date.now()}.txt`,
                fileType: 'txt',
                uploadedBy: 1,
            });

            // Generate embeddings
            if (embedFn) {
                await generateDocEmbedding(docId, embedFn, { autoCat: false });
            }

            // Mark topics as trained
            const logIds = topics.map(t => t.id);
            await knex('ai_learning_logs')
                .whereIn('id', logIds)
                .update({
                    used_in_training: true,
                    training_doc_id: docId,
                    updated_at: knex.fn.now()
                });

            generated.push({ docId, category, topicCount: topics.length, title });
            console.log(`[SelfImprovement] Generated training doc: ${title} (${topics.length} topics)`);
        } catch (err) {
            console.warn(`[SelfImprovement] Failed to generate doc for ${category}: ${err.message}`);
        }
    }

    return { generated, topics: untrained.map(t => t.topic) };
}

// ── Get learning statistics ──
export async function getLearningStats() {
    const totalLogs = await knex('ai_learning_logs').count('* as total').first();
    const trained = await knex('ai_learning_logs').where('used_in_training', true).count('* as total').first();
    const untrained = await knex('ai_learning_logs').where('used_in_training', false).count('* as total').first();

    const byCategory = await knex('ai_learning_logs')
        .select('category')
        .count('* as count')
        .avg('confidence as avg_confidence')
        .groupBy('category')
        .orderBy('count', 'desc');

    const topTopics = await knex('ai_learning_logs')
        .select('topic', 'category', 'repeat_count', 'confidence', 'used_in_training')
        .orderBy('repeat_count', 'desc')
        .limit(10);

    const recentActivity = await knex('ai_learning_logs')
        .select('topic', 'category', 'created_at')
        .orderBy('created_at', 'desc')
        .limit(5);

    const trainingDocsGenerated = await knex('ai_learning_logs')
        .where('used_in_training', true)
        .countDistinct('training_doc_id as docs_generated')
        .first();

    return {
        totalKnowledgePoints: parseInt(totalLogs?.total || 0),
        trainedPoints: parseInt(trained?.total || 0),
        untrainedPoints: parseInt(untrained?.total || 0),
        trainingEfficiency: totalLogs?.total > 0
            ? ((trained?.total / totalLogs.total) * 100).toFixed(1) + '%'
            : '0%',
        byCategory,
        topTopics,
        recentActivity,
        docsGenerated: parseInt(trainingDocsGenerated?.docs_generated || 0),
    };
}

// ── Get topic summary view ──
export async function getTopicSummary({ limit = 20, category = null } = {}) {
    let query = knex('ai_learning_topic_summary').select('*');
    if (category) query = query.where('category', category);
    return query.limit(limit);
}

// ── Get all learning logs ──
export async function getLearningLogs({ limit = 50, category = null, untrainedOnly = false } = {}) {
    let query = knex('ai_learning_logs').select(
        'id', 'session_id', 'category', 'topic',
        'question_summary', 'answer_summary', 'knowledge_extracted',
        'source_type', 'used_in_training', 'training_doc_id',
        'confidence', 'repeat_count', 'created_at'
    );
    if (category) query = query.where('category', category);
    if (untrainedOnly) query = query.where('used_in_training', false);
    return query.orderBy('created_at', 'desc').limit(limit);
}

// ── Train a single topic by ID (manual) ──
export async function trainSingleTopic(logId, embedFn) {
    const log = await knex('ai_learning_logs').where('id', logId).first();
    if (!log) throw new Error('Knowledge point tidak ditemukan');
    if (log.used_in_training) return { alreadyTrained: true, topic: log.topic };

    const { saveDocument, generateDocEmbedding } = await import('./trainingDocs.js');

    // Build doc content from this single topic
    const content = `# Pengetahuan Otomatis - ${log.category}\n\n` +
        `## ${log.topic}\n\n` +
        `Pertanyaan: ${log.question_summary}\n\n` +
        `Pengetahuan: ${log.knowledge_extracted}`;

    const title = `Auto: ${log.topic}`;

    const docId = await saveDocument({
        title,
        content,
        category: log.category,
        tags: `auto-generated,${log.category},manual`,
        sourceType: 'auto',
        sourceUrl: null,
        filename: `auto_${log.category}_${Date.now()}.txt`,
        fileType: 'txt',
        uploadedBy: 1,
    });

    // Generate embeddings if available
    if (embedFn) {
        await generateDocEmbedding(docId, embedFn, { autoCat: false });
    }

    // Mark as trained
    await knex('ai_learning_logs')
        .where('id', logId)
        .update({
            used_in_training: true,
            training_doc_id: docId,
            updated_at: knex.fn.now()
        });

    console.log(`[SelfImprovement] Manual train: "${log.topic}" → doc ${docId}`);
    return { docId, topic: log.topic, category: log.category };
}

// ── Train ALL pending topics (manual batch) ──
export async function trainAllPending(embedFn) {
    const pending = await knex('ai_learning_logs')
        .where('used_in_training', false)
        .orderBy('repeat_count', 'desc');

    if (pending.length === 0) return { trained: 0, topics: [] };

    const results = [];
    for (const log of pending) {
        try {
            const r = await trainSingleTopic(log.id, embedFn);
            results.push(r);
        } catch (err) {
            console.warn(`[SelfImprovement] Failed to train "${log.topic}": ${err.message}`);
            results.push({ topic: log.topic, error: err.message });
        }
    }

    const successCount = results.filter(r => r.docId).length;
    console.log(`[SelfImprovement] Batch train: ${successCount}/${pending.length} success`);
    return { trained: successCount, total: pending.length, results };
}

// ── Train by topic name (finds first untrained log for that topic) ──
export async function trainByTopic(topicName, embedFn) {
    const log = await knex('ai_learning_logs')
        .where('topic', 'ilike', topicName)
        .where('used_in_training', false)
        .first();

    if (!log) {
        // Check if already trained
        const trained = await knex('ai_learning_logs')
            .where('topic', 'ilike', topicName)
            .where('used_in_training', true)
            .first();
        if (trained) return { alreadyTrained: true, topic: topicName };
        throw new Error(`Topic "${topicName}" tidak ditemukan`);
    }

    return trainSingleTopic(log.id, embedFn);
}

// ── Full self-improvement cycle ──
export async function runSelfImprovementCycle(embedFn) {
    console.log('[SelfImprovement] === Starting self-improvement cycle ===');

    // Step 1: Analyze recent chats
    const analyzed = await analyzeRecentChats(168); // last 7 days

    // Step 2: Generate training docs from accumulated knowledge
    const generated = await generateTrainingDocsFromKnowledge(embedFn);

    // Step 3: Get updated stats
    const stats = await getLearningStats();

    console.log('[SelfImprovement] === Cycle complete ===');
    console.log(`  Analyzed: ${analyzed.processed} messages`);
    console.log(`  Generated: ${generated.generated.length} training docs`);
    console.log(`  Total knowledge: ${stats.totalKnowledgePoints} points`);
    console.log(`  Training efficiency: ${stats.trainingEfficiency}`);

    return { analyzed, generated, stats };
}

// ════════════════════════════════════════════════════════════════
// ── ERROR DETECTION & CORRECTION LEARNING ──
// ════════════════════════════════════════════════════════════════

// Patterns that indicate user is correcting/rejecting AI response
const CORRECTION_PATTERNS = [
    // Direct correction
    /datamu\s+salah/i,
    /jawabanmu\s+salah/i,
    /responmu\s+salah/i,
    /kamu\s+salah/i,
    /itu\s+salah/i,
    /bukan\s+begitu/i,
    /bukan\s+seperti\s+itu/i,
    /tidak\s+benar/i,
    /tidak\s+tepat/i,
    /kurang\s+tepat/i,
    /tidak\s+akurat/i,
    // Revision request
    /revisi/i,
    /koreksi/i,
    /perbaiki/i,
    /ubah\s+jawaban/i,
    /update\s+jawaban/i,
    /ganti\s+jawaban/i,
    // Data is wrong
    /data\s+nya\s+salah/i,
    /data\s+andasalah/i,
    /angkanya\s+salah/i,
    /nomornya\s+salah/i,
    /salah\s+satu/i,
    // Clarification
    /maksudnya\s+bukan/i,
    /yang\s+benar\s+adalah/i,
    /yang\s+tepat\s+adalah/i,
    /seharusnya/i,
    /harusnya/i,
    // Negative feedback
    /tidak\s+sesuai/i,
    /tidak\s+sama/i,
    /berbeda/i,
    /tidak\s+cocok/i,
];

// ── Detect if a message is a correction ──
export function detectCorrection(userMessage) {
    if (!userMessage || userMessage.length < 5) return null;
    const msg = userMessage.toLowerCase();

    for (const pattern of CORRECTION_PATTERNS) {
        if (pattern.test(msg)) {
            // Determine severity based on pattern strength
            let severity = 0.5;
            if (/salah|benar|revisi|koreksi/i.test(msg)) severity = 0.8;
            if (/tidak\s+benar|tidak\s+tepat|bukan\s+begitu/i.test(msg)) severity = 0.9;
            if (/seharusnya|harusnya|yang\s+benar/i.test(msg)) severity = 0.7;

            return {
                detected: true,
                severity,
                matchedPattern: pattern.source,
            };
        }
    }
    return null;
}

// ── Log a correction from user feedback ──
export async function logCorrection({
    sessionId, messageId, question, wrongAnswer, correctAnswer,
    correctionNote, correctionType = 'correction', topic = null, category = 'general'
}) {
    // Try to extract topic from the wrong answer or question
    if (!topic) {
        const extracted = fallbackExtract(question, wrongAnswer);
        topic = extracted.topic || question.slice(0, 100);
        category = extracted.category || category;
    }

    // Check if similar correction exists
    const existing = await knex('ai_learning_corrections')
        .where('topic', 'ilike', topic)
        .where('correction_type', correctionType)
        .first();

    if (existing) {
        // Update existing correction with new info
        await knex('ai_learning_corrections')
            .where('id', existing.id)
            .update({
                correct_answer: correctAnswer || existing.correct_answer,
                correction_note: correctionNote || existing.correction_note,
                severity: Math.max(existing.severity, 0.8),
                updated_at: knex.fn.now()
            });
        console.log(`[SelfImprovement] Updated correction for "${topic}"`);
        return existing.id;
    }

    const [id] = await knex('ai_learning_corrections').insert({
        session_id: sessionId || null,
        message_id: messageId || null,
        correction_type: correctionType,
        topic,
        category,
        original_question: question,
        wrong_answer: wrongAnswer || '',
        correct_answer: correctAnswer || '',
        correction_note: correctionNote || null,
        severity: 0.8,
    }).returning('id');

    console.log(`[SelfImprovement] Correction logged: "${topic}" (${correctionType})`);
    return id;
}

// ── Apply a correction to the knowledge base ──
export async function applyCorrection(correctionId, embedFn) {
    const correction = await knex('ai_learning_corrections').where('id', correctionId).first();
    if (!correction) throw new Error('Correction not found');
    if (correction.applied) return { alreadyApplied: true };

    const { saveDocument, generateDocEmbedding } = await import('./trainingDocs.js');

    // Create a correction training doc (negative knowledge: what NOT to say + what IS correct)
    const content = `# KOREKSI: ${correction.topic}\n\n` +
        `## ❌ Jawaban yang SALAH (jangan ulangi)\n${correction.wrong_answer}\n\n` +
        `## ✅ Jawaban yang BENAR\n${correction.correct_answer}\n\n` +
        (correction.correction_note ? `## Catatan Koreksi\n${correction.correction_note}\n\n` : '') +
        `## Pertanyaan Asli\n${correction.original_question}`;

    const title = `Koreksi: ${correction.topic}`;

    const docId = await saveDocument({
        title,
        content,
        category: correction.category,
        tags: `correction,${correction.category}`,
        sourceType: 'correction',
        sourceUrl: null,
        filename: `correction_${Date.now()}.txt`,
        fileType: 'txt',
        uploadedBy: 1,
    });

    if (embedFn) {
        await generateDocEmbedding(docId, embedFn, { autoCat: false });
    }

    // Mark correction as applied
    await knex('ai_learning_corrections')
        .where('id', correctionId)
        .update({
            applied: true,
            training_doc_id: docId,
            updated_at: knex.fn.now()
        });

    // Update the original learning log if it exists
    const learningLog = await knex('ai_learning_logs')
        .where('topic', 'ilike', correction.topic)
        .first();
    if (learningLog) {
        await knex('ai_learning_logs')
            .where('id', learningLog.id)
            .update({
                confidence: Math.max(0.1, learningLog.confidence - 0.3), // Lower confidence for corrected topic
                updated_at: knex.fn.now()
            });
    }

    // Snapshot the change
    await knex('ai_data_snapshots').insert({
        snapshot_type: 'correction',
        entity_id: correctionId,
        entity_title: correction.topic,
        before_data: JSON.stringify({ answer: correction.wrong_answer }),
        after_data: JSON.stringify({ answer: correction.correct_answer, docId }),
        change_reason: 'manual_correction',
    });

    console.log(`[SelfImprovement] Correction applied: "${correction.topic}" → doc ${docId}`);
    return { docId, topic: correction.topic };
}

// ── Get all corrections ──
export async function getCorrections({ limit = 50, type = null, unappliedOnly = false } = {}) {
    let query = knex('ai_learning_corrections').select('*');
    if (type) query = query.where('correction_type', type);
    if (unappliedOnly) query = query.where('applied', false);
    return query.orderBy('created_at', 'desc').limit(limit);
}

// ── Get correction stats ──
export async function getCorrectionStats() {
    const total = await knex('ai_learning_corrections').count('* as total').first();
    const applied = await knex('ai_learning_corrections').where('applied', true).count('* as total').first();
    const unapplied = await knex('ai_learning_corrections').where('applied', false).count('* as total').first();
    const byType = await knex('ai_learning_corrections')
        .select('correction_type')
        .count('* as count')
        .groupBy('correction_type');

    return {
        total: parseInt(total?.total || 0),
        applied: parseInt(applied?.total || 0),
        unapplied: parseInt(unapplied?.total || 0),
        byType,
    };
}

// ════════════════════════════════════════════════════════════════
// ── DATA EVOLUTION SCANNER ──
// ════════════════════════════════════════════════════════════════

// ── Scan all training docs for quality issues ──
export async function scanTrainingDocsQuality() {
    const docs = await knex('ai_training_documents')
        .where('status', 'active')
        .select('id', 'title', 'content', 'category', 'chunk_count', 'created_at', 'updated_at');

    const issues = [];
    for (const doc of docs) {
        // Issue 1: Empty or too short content
        if (!doc.content || doc.content.length < 50) {
            issues.push({ docId: doc.id, issue: 'content_too_short', severity: 'high', title: doc.title });
        }
        // Issue 2: No chunks
        if (doc.chunk_count === 0) {
            issues.push({ docId: doc.id, issue: 'no_chunks', severity: 'high', title: doc.title });
        }
        // Issue 3: Very old content (potential staleness)
        const age = Date.now() - new Date(doc.updated_at || doc.created_at).getTime();
        if (age > 30 * 24 * 60 * 60 * 1000) { // > 30 days
            issues.push({ docId: doc.id, issue: 'stale_content', severity: 'medium', title: doc.title, ageDays: Math.floor(age / 86400000) });
        }
        // Issue 4: Generic/auto-generated that might need refresh
        if (doc.title?.startsWith('Auto:') && doc.chunk_count <= 1) {
            issues.push({ docId: doc.id, issue: 'thin_auto_doc', severity: 'low', title: doc.title });
        }
    }

    return { totalDocs: docs.length, issues };
}

// ── Scan knowledge base for improvement opportunities ──
export async function scanKnowledgeBase() {
    // Find low-confidence knowledge
    const lowConfidence = await knex('ai_learning_logs')
        .where('confidence', '<', 0.4)
        .where('used_in_training', false)
        .select('topic', 'category', 'confidence', 'repeat_count');

    // Find repeated but untrained topics
    const repeated = await knex('ai_learning_logs')
        .where('repeat_count', '>=', 3)
        .where('used_in_training', false)
        .select('topic', 'category', 'repeat_count', 'confidence');

    // Find corrections that haven't been applied
    const unappliedCorrections = await knex('ai_learning_corrections')
        .where('applied', false)
        .select('topic', 'correction_type', 'severity');

    return {
        lowConfidenceTopics: lowConfidence,
        repeatedUntrainedTopics: repeated,
        unappliedCorrections,
    };
}

// ── Prune outdated/low-quality knowledge ──
export async function pruneKnowledge() {
    // Remove very old, low-confidence, single-use knowledge
    const pruned = await knex('ai_learning_logs')
        .where('confidence', '<', 0.2)
        .where('repeat_count', 1)
        .where('used_in_training', false)
        .where('created_at', '<', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)) // > 60 days old
        .del();

    console.log(`[SelfImprovement] Pruned ${pruned} low-quality knowledge points`);
    return pruned;
}

// ── Auto-generate correction docs for unapplied corrections ──
export async function processCorrections(embedFn) {
    const unapplied = await knex('ai_learning_corrections').where('applied', false);
    if (unapplied.length === 0) return { processed: 0 };

    let processed = 0;
    for (const correction of unapplied) {
        try {
            await applyCorrection(correction.id, embedFn);
            processed++;
        } catch (err) {
            console.warn(`[SelfImprovement] Failed to apply correction ${correction.id}: ${err.message}`);
        }
    }

    console.log(`[SelfImprovement] Processed ${processed}/${unapplied.length} corrections`);
    return { processed, total: unapplied.length };
}

// ── Full weekly evolution scan ──
export async function runEvolutionScan(embedFn) {
    console.log('[SelfImprovement] === Starting weekly evolution scan ===');

    const startTime = Date.now();
    const evolutionLog = {
        status: 'running',
        docsScanned: 0,
        docsUpdated: 0,
        correctionsApplied: 0,
        knowledgePruned: 0,
        newTopicsFound: 0,
        issues: [],
        knowledge: {},
    };

    try {
        // 1. Scan training docs quality
        const docScan = await scanTrainingDocsQuality();
        evolutionLog.docsScanned = docScan.totalDocs;
        evolutionLog.issues = docScan.issues;
        console.log(`[Evolution] Scanned ${docScan.totalDocs} docs, found ${docScan.issues.length} issues`);

        // 2. Scan knowledge base
        const knowledgeScan = await scanKnowledgeBase();
        evolutionLog.knowledge = knowledgeScan;
        evolutionLog.newTopicsFound = knowledgeScan.repeatedUntrainedTopics.length;
        console.log(`[Evolution] Knowledge: ${knowledgeScan.lowConfidenceTopics.length} low-confidence, ${knowledgeScan.repeatedUntrainedTopics.length} repeated untrained`);

        // 3. Apply unapplied corrections
        const corrections = await processCorrections(embedFn);
        evolutionLog.correctionsApplied = corrections.processed;

        // 4. Prune old knowledge
        evolutionLog.knowledgePruned = await pruneKnowledge();

        // 5. Generate training docs from new knowledge
        const generated = await generateTrainingDocsFromKnowledge(embedFn);
        evolutionLog.docsUpdated = generated.generated.length;

        // Mark all evolution snapshots as processed
        await knex('ai_data_snapshots')
            .where('evolution_processed', false)
            .update({ evolution_processed: true });

        evolutionLog.status = 'completed';
    } catch (err) {
        evolutionLog.status = 'failed';
        evolutionLog.errorMessage = err.message;
        console.error(`[Evolution] Scan failed: ${err.message}`);
    }

    const duration = Date.now() - startTime;

    // Save evolution log
    const [logId] = await knex('ai_evolution_logs').insert({
        status: evolutionLog.status,
        summary: JSON.stringify(evolutionLog),
        docs_scanned: evolutionLog.docsScanned,
        docs_updated: evolutionLog.docsUpdated,
        corrections_applied: evolutionLog.correctionsApplied,
        knowledge_pruned: evolutionLog.knowledgePruned,
        new_topics_found: evolutionLog.newTopicsFound,
        error_message: evolutionLog.errorMessage || null,
    }).returning('id');

    console.log(`[SelfImprovement] === Evolution scan complete in ${duration}ms ===`);
    console.log(`  Status: ${evolutionLog.status}`);
    console.log(`  Docs scanned: ${evolutionLog.docsScanned}`);
    console.log(`  Docs updated: ${evolutionLog.docsUpdated}`);
    console.log(`  Corrections applied: ${evolutionLog.correctionsApplied}`);
    console.log(`  Knowledge pruned: ${evolutionLog.knowledgePruned}`);
    console.log(`  New topics: ${evolutionLog.newTopicsFound}`);

    return { logId, ...evolutionLog, durationMs: duration };
}

// ── Get evolution history ──
export async function getEvolutionHistory({ limit = 10 } = {}) {
    return knex('ai_evolution_logs')
        .select('*')
        .orderBy('created_at', 'desc')
        .limit(limit);
}

// ── Get latest evolution status ──
export async function getLatestEvolution() {
    return knex('ai_evolution_logs')
        .select('*')
        .orderBy('created_at', 'desc')
        .first();
}

// ── Get data snapshots ──
export async function getDataSnapshots({ limit = 20, type = null } = {}) {
    let query = knex('ai_data_snapshots').select('*');
    if (type) query = query.where('snapshot_type', type);
    return query.orderBy('created_at', 'desc').limit(limit);
}

// ── Get full evolution stats (corrections + evolution combined) ──
export async function getEvolutionStats() {
    const corrections = await getCorrectionStats();
    const latestEvolution = await getLatestEvolution();
    const snapshotCount = await knex('ai_data_snapshots').count('* as total').first();

    return {
        corrections,
        latestEvolution,
        totalSnapshots: parseInt(snapshotCount?.total || 0),
    };
}
