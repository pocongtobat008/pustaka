import { pipeline, env } from '@xenova/transformers';

// Suppress ONNX Runtime warnings
if (env && env.onnx) {
    env.onnx.logLevel = 'error';
}

// Singleton Promise mechanism to prevent race conditions
let embedderPromise = null;

async function initEmbedder() {
    if (!embedderPromise) {
        embedderPromise = (async () => {
            console.log('[AI Search] Initializing sentence-transformer model (all-MiniLM-L6-v2)...');
            const p = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
            console.log('[AI Search] Sentence-transformer model loaded.');
            return p;
        })();
    }
    return embedderPromise;
}


/**
 * Generate a vector embedding for a given text.
 * @param {string} text 
 * @returns {Promise<Array<number>>}
 */
export async function generateEmbedding(text) {
    console.log(`[AI Search] Generating embedding for: "${text.substring(0, 50)}..."`);
    const pipe = await initEmbedder();
    const output = await pipe(text, { pooling: 'mean', normalize: true });
    console.log('[AI Search] Embedding generated.');
    return Array.from(output.data);
}

/**
 * Calculate cosine similarity between two vectors.
 * @param {Array<number>} v1 
 * @param {Array<number>} v2 
 * @returns {number}
 */
export function cosineSimilarity(v1, v2) {
    if (v1.length !== v2.length) return 0;
    let dotProduct = 0;
    for (let i = 0; i < v1.length; i++) {
        dotProduct += v1[i] * v2[i];
    }
    return dotProduct; // Already normalized by pipeline
}

/**
 * Semantic Intent Classification using Anchor Vectors.
 */
const ANCHOR_QUERIES = {
    aggregation: [
        "berapa total pph bulan ini",
        "jumlah seluruh pph januari",
        "total akumulasi ppn",
        "hitung jumlah pajak januari 2024",
        "berapa pajak yang sudah dibayar"
    ],
    audit_status: [
        "status pemeriksaan pajak sampai mana",
        "audit pajak progres",
        "surat permintaan penjelasan data",
        "pemeriksaan lapangan sampai tahap apa",
        "daftar pending audit"
    ],
    comparison: [
        "bandingkan pph januari dan februari",
        "perbandingan ppn bulan maret vs april",
        "selisih pajak bulan ini dengan bulan lalu",
        "perkembangan pph dari januari sampai maret",
        "tampilkan perbedaan pembetulan 0 dan 1"
    ],
    trend_analysis: [
        "analisa trend pajak bulan depan",
        "prediksi pph untuk maret 2024",
        "proyeksi ppn dari trend bulan lalu",
        "perkiraan jumlah pajak kedepannya",
        "bagaimana trend pembayaran pph kita"
    ],
    tax_lookup: [
        "apa itu jasa konstruksi",
        "tarif pph 23 untuk sewa",
        "berapa rate pajak royalti",
        "kode objek pajak jasa teknik",
        "penjelasan mengenai pph pasal 4 ayat 2",
        "daftar objek pajak pph 21"
    ],
    over_under_payment: [
        "apakah kita lebih bayar bulan ini",
        "kapan terakhir kali kurang bayar",
        "status lebih bayar tahun 2024",
        "berapa kurang bayar pph",
        "kapan kita mulai lb",
        "apakah ada kb pph bulan januari"
    ]
};

let cachedAnchors = null;

async function getAnchorVectors() {
    if (cachedAnchors) return cachedAnchors;
    const anchors = {};
    for (const [intent, queries] of Object.entries(ANCHOR_QUERIES)) {
        const vectors = await Promise.all(queries.map(q => generateEmbedding(q)));
        // Average vector for the intent
        const avg = new Array(vectors[0].length).fill(0);
        vectors.forEach(v => v.forEach((val, i) => avg[i] += val));
        anchors[intent] = avg.map(v => v / vectors.length);
    }
    cachedAnchors = anchors;
    return anchors;
}

export async function classifyIntentSemantically(queryVector) {
    const anchors = await getAnchorVectors();
    let bestIntent = null;
    let maxSim = -1;

    for (const [intent, vector] of Object.entries(anchors)) {
        const sim = cosineSimilarity(queryVector, vector);
        if (sim > maxSim) {
            maxSim = sim;
            bestIntent = intent;
        }
    }

    return { intent: maxSim > 0.55 ? bestIntent : null, score: maxSim };
}

/**
 * Basic NLP Intent Parsing for Archive-OS.
 * Extracts: minAmount, maxAmount, vendor, dateRange.
 * Examples: "invoice > 5jt", "PT Maju Jaya Jan 2024"
 * @param {string} query 
 * @param {Array<number>} queryVector Optional query vector for semantic classification
 * @returns {object}
 */
export async function parseIntent(query, queryVector = null) {
    const q = query.toLowerCase();
    const intent = {
        minAmount: null,
        maxAmount: null,
        vendor: null,
        month: null,
        year: null,
        months: [], // For comparison
        years: [],  // For comparison
        type: null,
        taxType: null,
        pembetulan: null,
        semanticConfidence: 0
    };

    // 1. Keyword Overrides (Strong indicators)
    if (q.includes('banding') || q.includes('vs') || q.includes('perbandingan') || q.includes('selisih')) {
        intent.type = 'comparison';
    } else if (q.includes('trend') || q.includes('proyeksi') || q.includes('prediksi') || q.includes('depan')) {
        intent.type = 'trend_analysis';
    } else if (q.includes('pemeriksaan') || q.includes('audit')) {
        intent.type = 'audit_status';
    } else if (q.includes('apa itu') || q.includes('tarif') || q.includes('rate') || q.includes('kode') || q.includes('objek pajak')) {
        intent.type = 'tax_lookup';
    } else if (q.includes('lebih bayar') || q.includes('kurang bayar') || q.includes(' lb ') || q.includes(' kb ') || q.includes('nihil')) {
        intent.type = 'over_under_payment';
    } else if (q.includes('kapan')) {
        // "Kapan kita mulai lebih bayar", "kapan kita kurang bayar"
        intent.type = 'over_under_payment_timeline';
    }

    // 2. Semantic Classification (Fallback or refinement)
    if (!intent.type && queryVector) {
        const semantic = await classifyIntentSemantically(queryVector);
        if (semantic.intent) {
            intent.type = semantic.intent;
            intent.semanticConfidence = semantic.score;
        }
    }

    // 2. Parse Amount (jt/juta/rb/ribu) - Improved to ignore years
    const amountMatch = q.match(/(>|<|diatas|dibawah|di atas|di bawah)?\s*(\b\d{5,}\b|\b\d+(?:\.\d+)?\s*(jt|juta|rb|ribu|k)\b)/i);
    if (amountMatch) {
        let valueStr = amountMatch[2];
        let value = parseFloat(valueStr);
        const unit = amountMatch[3]?.toLowerCase();
        if (unit === 'jt' || unit === 'juta') value *= 1000000;
        else if (unit === 'rb' || unit === 'ribu' || unit === 'k') value *= 1000;
        else if (valueStr.length < 5) value = null; // Ignore small numbers like 2024

        if (value !== null) {
            const modifier = amountMatch[1];
            if (modifier?.includes('>') || modifier?.includes('atas')) intent.minAmount = value;
            else if (modifier?.includes('<') || modifier?.includes('bawah')) intent.maxAmount = value;
            else intent.minAmount = value;
        }
    }

    // 3. Parse Date/Month (Improved for Multi-entity & Relative Times)
    const monthPatterns = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember',
        'jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agt', 'sep', 'okt', 'nov', 'des'];

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    const currentYear = currentDate.getFullYear();

    // Check Relative Time Keywords
    let relativeMonthAdded = false;
    let relativeYearAdded = false;

    if (q.includes('bulan ini')) {
        intent.months.push(currentMonth);
        intent.years.push(currentYear);
        relativeMonthAdded = true;
    }
    if (q.includes('bulan lalu') || q.includes('kemarin')) {
        let lastMonth = currentMonth - 1;
        let y = currentYear;
        if (lastMonth === 0) {
            lastMonth = 12;
            y--;
        }
        intent.months.push(lastMonth);
        intent.years.push(currentYear);
        relativeMonthAdded = true;
    }
    if (q.includes('tahun ini')) {
        if (!intent.years.includes(currentYear)) intent.years.push(currentYear);
        relativeYearAdded = true;
    }
    if (q.includes('tahun lalu')) {
        if (!intent.years.includes(currentYear - 1)) intent.years.push(currentYear - 1);
        relativeYearAdded = true;
    }

    // Find all explicitly stated month occurrences
    monthPatterns.forEach((m, idx) => {
        // Regex word boundary, but ensure it's not part of another word
        const regex = new RegExp(`\\b${m}\\b`, 'gi');
        if (q.match(regex)) {
            const mVal = (idx % 12) + 1;
            if (!intent.months.includes(mVal)) intent.months.push(mVal);
        }
    });

    // If a month is found but no year is specified and it wasn't a relative "bulan lalu", default to current year
    if (intent.months.length > 0 && intent.years.length === 0 && !relativeYearAdded) {
        intent.years.push(currentYear);
    }

    if (intent.months.length > 0) intent.month = intent.months[0];

    // Find all explicitly stated years
    const yearMatches = q.match(/\b(20\d{2})\b/g);
    if (yearMatches) {
        yearMatches.forEach(y => {
            const yInt = parseInt(y);
            if (!intent.years.includes(yInt)) intent.years.push(yInt);
        });
        intent.year = intent.years[0];
    } else if (intent.years.length > 0) {
        intent.year = intent.years[0];
    }

    // 4. Extract Vendor
    const vendorMatch = q.match(/dari\s+([^>|<|bulan|tahun|diatas|dibawah|dan|vs]+)/);
    if (vendorMatch) {
        intent.vendor = vendorMatch[1].trim();
    }

    // 5. Special Keywords (Already handled in Step 1, but keep specific entity overrides)
    if (q.includes('pph')) intent.taxType = 'PPH';
    else if (q.includes('ppn')) intent.taxType = 'PPN';

    const pembetulanMatch = q.match(/pembetulan\s*(\d+)/i);
    if (pembetulanMatch) intent.pembetulan = parseInt(pembetulanMatch[1]);

    // 6. Final check for aggregation if no other intent found
    if (!intent.type) {
        if (q.includes('total') || q.includes('berapa') || q.includes('jumlah') || q.includes('hitung')) {
            if (intent.taxType || q.includes('pajak') || q.includes('uang') || q.includes('bayar') || q.includes('masukan') || q.includes('keluaran')) {
                intent.type = 'aggregation';
            }
        }
    }

    // Optional: refine further if asking specifically for input/output PPN
    if (intent.taxType === 'PPN') {
        if (q.includes('masukan') || q.includes('input')) intent.ppnTarget = 'IN';
        if (q.includes('keluaran') || q.includes('output')) intent.ppnTarget = 'OUT';
    }

    return intent;
}


let generatorPromise = null;

async function initGenerator() {
    if (!generatorPromise) {
        generatorPromise = (async () => {
            console.log('[AI Search] Initializing text-generation model (flan-t5-small)...');
            const p = await pipeline('text2text-generation', 'Xenova/flan-t5-small');
            console.log('[AI Search] Text-generation model loaded.');
            return p;
        })();
    }
    return generatorPromise;
}

/**
 * Generate a natural language answer based on context.
 * @param {string} query 
 * @param {string[]} contexts 
 * @returns {Promise<string>}
 */
export async function generateAnswer(query, contexts) {
    try {
        const gen = await initGenerator();

        // Prepare context (limit to ~1500 chars)
        const contextText = contexts.length > 0
            ? contexts.slice(0, 5).join("\n").substring(0, 1500)
            : "Data tidak ditemukan di sistem.";

        // Construct Prompt suitable for Flan-T5 with specific instructions
        const prompt = `System: Anda adalah asisten AI Archive-OS yang profesional dan membantu. Jawablah dalam Bahasa Indonesia yang ramah dan humanis. 
Jika pertanyaan bisa dijawab dengan "Ya" atau "Tidak", mulailah jawaban dengan kata tersebut diikuti penjelasan singkat.
Jika informasi tidak ada dalam konteks, katakan bahwa data tidak ditemukan.
Context: ${contextText}
Question: ${query}
Answer:`;

        console.log('[AI Search] Running text generation...');
        const output = await gen(prompt, {
            max_new_tokens: 160,
            temperature: 0.3, // Lower temperature for more factual responses
            repetition_penalty: 1.2
        });
        console.log('[AI Search] Text generation complete.');

        let reply = output[0].generated_text;

        // Clean up common prefix issues if the model repeats "Answer:"
        reply = reply.replace(/^Answer:\s*/i, '').trim();

        return reply;
    } catch (e) {
        console.error("Content Generation Error:", e);
        return "Maaf, saya tidak dapat membuat ringkasan saat ini.";
    }
}

/**
 * Fast In-Memory Vector Cache (ANN Alternative)
 * Stores embeddings in RAM as Float32Array for <5ms cosine similarity searches across 10k+ docs.
 */
import { knex } from './db.js';

class InMemoryVectorStore {
    constructor() {
        this.cache = new Map(); // key: id, value: { id, title, type, date, size, ocrContent, vector: Float32Array }
        this.isInitialized = false;
        this.isInitializing = false;
        this.initPromise = null;
        this.lastError = null;
        this.initializedAt = null;
        this.totalScanned = 0;
    }

    async initialize(options = {}) {
        const lazy = options.lazy === true;
        const envBatchSize = globalThis?.process?.env?.AI_VECTOR_INIT_BATCH_SIZE;
        const batchSize = Math.max(50, Number(options.batchSize || envBatchSize || 250));

        if (this.isInitialized) return;

        if (!this.initPromise) {
            console.log(`[AI Search] Initializing Fast In-Memory Vector Store in batches of ${batchSize}...`);
            const startTime = Date.now();

            this.isInitializing = true;
            this.lastError = null;

            this.initPromise = (async () => {
                let offset = 0;
                let count = 0;
                let scanned = 0;

                try {
                    while (true) {
                        const docs = await knex('documents')
                            .select('id', 'title', 'type', 'uploadDate', 'size', 'ocrContent', 'folderId', 'vector')
                            .whereNotNull('vector')
                            .andWhereNot('vector', '')
                            .orderBy('id', 'asc')
                            .limit(batchSize)
                            .offset(offset);

                        if (!docs.length) break;

                        for (const d of docs) {
                            scanned++;
                            try {
                                const parsedArray = typeof d.vector === 'string' ? JSON.parse(d.vector) : d.vector;
                                if (Array.isArray(parsedArray)) {
                                    this.cache.set(d.id, {
                                        id: d.id,
                                        title: d.title,
                                        type: d.type || (d.title && d.title.toLowerCase().includes('invoice') ? 'invoice' : 'document'),
                                        date: d.uploadDate,
                                        size: d.size,
                                        ocrContent: d.ocrContent,
                                        folderId: d.folderId,
                                        vector: new Float32Array(parsedArray)
                                    });
                                    count++;
                                }
                            } catch {
                                console.warn(`[AI Search] Failed to parse vector for doc ${d.id}`);
                            }
                        }

                        offset += docs.length;
                        this.totalScanned = scanned;

                        // Yield to the event loop to avoid long startup stalls on large datasets.
                        await new Promise((resolve) => setTimeout(resolve, 0));
                    }

                    this.isInitialized = true;
                    this.initializedAt = new Date().toISOString();
                    const duration = Date.now() - startTime;
                    console.log(`[AI Search] Vector Store initialized. Cached ${count} vectors in ${duration}ms.`);
                } catch (err) {
                    this.lastError = err.message;
                    console.error('[AI Search] Failed to initialize Vector Store:', err);
                } finally {
                    this.isInitializing = false;
                    this.initPromise = null;
                }
            })();
        }

        if (!lazy) {
            await this.initPromise;
        }
    }

    getStatus() {
        return {
            initialized: this.isInitialized,
            initializing: this.isInitializing,
            cachedVectors: this.cache.size,
            totalScanned: this.totalScanned,
            initializedAt: this.initializedAt,
            lastError: this.lastError
        };
    }

    // Add or update a document in the cache instantly
    upsertDocument(doc, vectorArray) {
        if (!Array.isArray(vectorArray)) return;
        this.cache.set(doc.id, {
            id: doc.id,
            title: doc.title,
            type: doc.category || (doc.title && doc.title.toLowerCase().includes('invoice') ? 'invoice' : 'document'),
            date: doc.uploadDate,
            size: doc.size,
            ocrContent: doc.ocrContent,
            folderId: doc.folderId,
            vector: new Float32Array(vectorArray)
        });
        console.log(`[AI Search] Updated vector cache for document ${doc.id}. Total cached: ${this.cache.size}`);
    }

    // Remove a document from the cache
    removeDocument(id) {
        this.cache.delete(id);
        console.log(`[AI Search] Removed document ${id} from vector cache.`);
    }

    // Ultra-fast pure mathematical search across RAM
    searchNearest(queryVectorArray, minScore = 0.4, limit = 15) {
        if (!this.isInitialized) {
            if (!this.isInitializing) {
                this.initialize({ lazy: true }).catch((err) => {
                    console.error('[AI Search] Lazy initialization failed:', err.message);
                });
            }
            console.warn('[AI Search] Vector Store accessed before initialization. Returning empty result temporarily.');
            return [];
        }

        const queryFloat32 = new Float32Array(queryVectorArray);
        const dimension = queryFloat32.length;
        const results = [];

        // O(N) but massively optimized since we avoid I/O, JSON.parse, and JS Array wrappers
        for (const [, doc] of this.cache.entries()) {
            const v2 = doc.vector;
            if (v2.length !== dimension) continue;

            let dotProduct = 0;
            // Native loop over Float32Array is blazing fast in V8 Engine
            for (let i = 0; i < dimension; i++) {
                dotProduct += queryFloat32[i] * v2[i];
            }

            if (dotProduct > minScore) {
                results.push({
                    id: doc.id,
                    name: doc.title,
                    date: doc.date,
                    size: doc.size,
                    matchType: doc.type,
                    score: dotProduct,
                    data: {
                        id: doc.id,
                        title: doc.title,
                        category: doc.type,
                        uploadDate: doc.date,
                        size: doc.size,
                        folderId: doc.folderId,
                        ocrContent: doc.ocrContent
                    }
                });
            }
        }

        // Sort by highest similarity
        return results.sort((a, b) => b.score - a.score).slice(0, limit);
    }
}

export const vectorStore = new InMemoryVectorStore();

