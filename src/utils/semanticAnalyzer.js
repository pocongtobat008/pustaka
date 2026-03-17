/**
 * Semantic Text Analyzer for AI Tax Assistant
 * Detects analysis types and extracts intent from natural language queries
 */

// Analysis intent types
export const ANALYSIS_TYPES = {
    COMPARISON: 'comparison',           // versus, perbandingan, dibanding
    UNDERPAYMENT: 'underpayment',       // kurang bayar, belum lunas
    OVERPAYMENT: 'overpayment',         // lebih bayar, kelebihan
    HISTORY: 'history',                // terakhir, sebelumnya, riwayat
    TREND: 'trend',                    // tren, perkembangan, grafik, statistik
    STATUS: 'status',                  // status, kondisi, state
    FORECAST: 'forecast',              // prediksi, estimasi, proyeksi
    SUMMARY: 'summary',                // ringkasan, total, keseluruhan
    ANOMALY: 'anomaly',                // abnormal, tidak biasa, spike, lonjakan
    COMPLIANCE: 'compliance',          // kepatuhan, ketepatan waktu, deadline
};

// Tax type detection
export const TAX_TYPES = {
    PPN: 'ppn',                 // Pajak Pertambahan Nilai
    PPH: 'pph',                 // Pajak Penghasilan
    PPN_IN: 'ppn_in',           // PPN Masukan
    PPN_OUT: 'ppn_out',         // PPN Keluaran
    PPH_23: 'pph23',            // PPh Pasal 23
    PPH_4_2: 'pph42',           // PPh Pasal 4(2)
};

// Time period detection
export const TIME_PERIODS = {
    THIS_MONTH: 'this_month',           // bulan ini
    LAST_MONTH: 'last_month',           // bulan lalu
    THIS_QUARTER: 'this_quarter',       // kuartal ini
    LAST_QUARTER: 'last_quarter',       // kuartal lalu
    THIS_YEAR: 'this_year',             // tahun ini
    LAST_YEAR: 'last_year',             // tahun lalu
    SPECIFIC_MONTH: 'specific_month',   // bulan spesifik
    RANGE: 'range',                     // rentang periode
};

/**
 * Comprehensive semantic analyzer for tax queries
 */
export class SemanticAnalyzer {
    constructor() {
        this.keywords = {
            comparison: [
                'vs', 'versus', 'perbandingan', 'dibanding', 'banding', 
                'bedanya', 'perbedaan', 'selisih', 'difference', 'compare',
                'bandingkan', 'banding', 'ketimbang', 'daripada'
            ],
            underpayment: [
                'kurang bayar', 'kurang', 'belum lunas', 'belum bayar', 
                'defisit', 'deficit', 'utang pajak', 'sisa bayar',
                'kurang_bayar', 'kb', 'underpay', 'short paid'
            ],
            overpayment: [
                'lebih bayar', 'lebih', 'kelebihan', 'surplus', 
                'excess', 'overpay', 'lebih_bayar', 'lb',
                'restitusi', 'kompensasi'
            ],
            history: [
                'terakhir', 'sebelumnya', 'riwayat', 'history', 
                'kapan', 'sebelum', 'kemarin', 'waktu lalu',
                'periode lalu', 'bulan lalu'
            ],
            trend: [
                'tren', 'trend', 'perkembangan', 'progression', 
                'grafik', 'chart', 'statistik', 'statistic',
                'lonjakan', 'spike', 'naik', 'turun', 'pertumbuhan',
                'growth', 'pola', 'pattern'
            ],
            status: [
                'status', 'kondisi', 'state', 'bagaimana', 'apa',
                'berapa', 'ada', 'sekarang', 'saat ini', 'current'
            ],
            forecast: [
                'prediksi', 'forecast', 'estimasi', 'proyeksi', 
                'prediction', 'estimate', 'akan', 'nanti',
                'depan', 'mendatang', 'anticipate'
            ],
            summary: [
                'ringkasan', 'summary', 'total', 'keseluruhan', 
                'overall', 'aggregat', 'jumlah', 'sum',
                'kesimpulan', 'recap', 'overview'
            ],
            anomaly: [
                'abnormal', 'tidak biasa', 'aneh', 'strange',
                'lonjakan', 'spike', 'drop', 'unusual',
                'mencurigakan', 'suspicious', 'anomali'
            ],
            compliance: [
                'tepat waktu', 'deadline', 'jatuh tempo', 'due date',
                'kepatuhan', 'compliance', 'melaporkan', 'reporting',
                'sesuai', 'standar', 'regulasi', 'regulation'
            ]
        };

        this.months = [
            'januari', 'februari', 'maret', 'april', 'mei', 'juni',
            'juli', 'agustus', 'september', 'oktober', 'november', 'desember'
        ];
    }

    /**
     * Analyze query and extract intent
     */
    analyze(query) {
        const q = query.toLowerCase().trim();
        
        return {
            query: query,
            normalized: q,
            intent: this._detectIntent(q),
            taxTypes: this._detectTaxTypes(q),
            timePeriods: this._detectTimePeriods(q),
            entities: this._extractEntities(q),
            confidence: this._calculateConfidence(q),
            keywords: this._extractKeywords(q),
            suggestions: this._generateSuggestions(q)
        };
    }

    /**
     * Detect analysis intent from keywords
     */
    _detectIntent(q) {
        const intents = [];
        
        for (const [type, keywords] of Object.entries(this.keywords)) {
            if (keywords.some(kw => q.includes(kw))) {
                intents.push(type);
            }
        }

        // If no intents detected, try to infer from context
        if (intents.length === 0) {
            if (q.includes('?')) intents.push('status');
            if (q.includes('berapa') || q.includes('banyak')) intents.push('summary');
        }

        return intents.length > 0 ? intents : ['status'];
    }

    /**
     * Detect tax types mentioned in query
     */
    _detectTaxTypes(q) {
        const types = [];
        
        if (q.includes('ppn')) {
            types.push(TAX_TYPES.PPN);
            if (q.includes('masukan') || q.includes('input')) types.push(TAX_TYPES.PPN_IN);
            if (q.includes('keluaran') || q.includes('output')) types.push(TAX_TYPES.PPN_OUT);
        }
        
        if (q.includes('pph')) {
            types.push(TAX_TYPES.PPH);
            if (q.includes('23')) types.push(TAX_TYPES.PPH_23);
            if (q.includes('4(2)') || q.includes('4 2')) types.push(TAX_TYPES.PPH_4_2);
        }

        // If no specific tax mentioned, return general
        return types.length > 0 ? types : [TAX_TYPES.PPH, TAX_TYPES.PPN];
    }

    /**
     * Detect time periods
     */
    _detectTimePeriods(q) {
        const periods = [];
        
        // Exact phrases first
        if (q.includes('bulan ini')) periods.push(TIME_PERIODS.THIS_MONTH);
        if (q.includes('bulan lalu')) periods.push(TIME_PERIODS.LAST_MONTH);
        if (q.includes('kuartal ini')) periods.push(TIME_PERIODS.THIS_QUARTER);
        if (q.includes('kuartal lalu')) periods.push(TIME_PERIODS.LAST_QUARTER);
        if (q.includes('tahun ini')) periods.push(TIME_PERIODS.THIS_YEAR);
        if (q.includes('tahun lalu')) periods.push(TIME_PERIODS.LAST_YEAR);
        
        // Check for specific months
        const monthsFound = this.months.filter(m => q.includes(m) || q.includes(m.substring(0, 3)));
        if (monthsFound.length > 0) periods.push(TIME_PERIODS.SPECIFIC_MONTH);
        
        // Check for ranges
        if (q.includes('sampai') || q.includes('hingga') || q.includes('s.d') || q.includes('-')) {
            periods.push(TIME_PERIODS.RANGE);
        }

        return periods.length > 0 ? periods : [TIME_PERIODS.THIS_MONTH];
    }

    /**
     * Extract numeric entities and amounts
     */
    _extractEntities(q) {
        const entities = {};
        
        // Extract numbers
        const numbers = q.match(/\d+(?:\.\d+)?/g) || [];
        entities.numbers = numbers.map(Number);
        
        // Extract percentages
        const percentages = q.match(/(\d+)%/g) || [];
        entities.percentages = percentages.map(p => parseInt(p));
        
        // Extract currency mentions
        entities.hasCurrency = q.includes('rp') || q.includes('juta') || q.includes('ribu');
        
        // Extract company/department mentions
        if (q.includes('perusahaan') || q.includes('divisi') || q.includes('departemen')) {
            entities.entityType = 'organization';
        }

        return entities;
    }

    /**
     * Calculate confidence level of analysis
     */
    _calculateConfidence(q) {
        let score = 0.5; // Base score
        
        // Keyword presence
        const allKeywords = Object.values(this.keywords).flat();
        const matchedKeywords = allKeywords.filter(kw => q.includes(kw)).length;
        score += (matchedKeywords * 0.1);
        
        // Query length (longer = more specific)
        if (q.length > 50) score += 0.15;
        if (q.length > 100) score += 0.15;
        
        // Specific dates
        if (this.months.some(m => q.includes(m))) score += 0.1;
        
        // Numbers present
        if (/\d+/.test(q)) score += 0.05;

        return Math.min(score, 1.0);
    }

    /**
     * Extract relevant keywords for highlighting
     */
    _extractKeywords(q) {
        const allKeywords = Object.values(this.keywords).flat();
        return allKeywords.filter(kw => q.includes(kw));
    }

    /**
     * Generate suggestions based on analysis
     */
    _generateSuggestions(q) {
        const intents = this._detectIntent(q);
        const taxTypes = this._detectTaxTypes(q);
        const suggestions = [];

        if (!intents.includes('comparison')) {
            suggestions.push("Bandingkan dengan periode lain untuk analisis lebih mendalam");
        }

        if (intents.includes('underpayment') || intents.includes('overpayment')) {
            suggestions.push("Lihat riwayat pembayaran untuk memastikan compliance");
        }

        if (intents.includes('trend')) {
            suggestions.push("Analisis tren dapat membantu perencanaan cash flow");
        }

        if (!taxTypes.includes(TAX_TYPES.PPN) && !taxTypes.includes(TAX_TYPES.PPH)) {
            suggestions.push("Coba sebutkan jenis pajak (PPN/PPh) untuk hasil lebih spesifik");
        }

        return suggestions;
    }

    /**
     * Get semantic metadata for UI rendering
     */
    getSemanticMetadata(analysis) {
        return {
            icon: this._getIntentIcon(analysis.intent[0]),
            color: this._getIntentColor(analysis.intent[0]),
            label: this._getIntentLabel(analysis.intent[0]),
            description: this._getIntentDescription(analysis),
            confidence: analysis.confidence
        };
    }

    _getIntentIcon(intent) {
        const icons = {
            comparison: '⚖️',
            underpayment: '💰',
            overpayment: '↩️',
            history: '📅',
            trend: '📈',
            status: '📊',
            forecast: '🔮',
            summary: '📋',
            anomaly: '⚠️',
            compliance: '✅'
        };
        return icons[intent] || '🤔';
    }

    _getIntentColor(intent) {
        const colors = {
            comparison: 'indigo',
            underpayment: 'rose',
            overpayment: 'emerald',
            history: 'amber',
            trend: 'purple',
            status: 'blue',
            forecast: 'violet',
            summary: 'cyan',
            anomaly: 'orange',
            compliance: 'green'
        };
        return colors[intent] || 'slate';
    }

    _getIntentLabel(intent) {
        const labels = {
            comparison: 'Analisis Perbandingan',
            underpayment: 'Analisis Kurang Bayar',
            overpayment: 'Analisis Lebih Bayar',
            history: 'Riwayat Periode',
            trend: 'Analisis Tren',
            status: 'Status Pajak',
            forecast: 'Proyeksi',
            summary: 'Ringkasan',
            anomaly: 'Deteksi Anomali',
            compliance: 'Kepatuhan'
        };
        return labels[intent] || intent;
    }

    _getIntentDescription(analysis) {
        const intents = analysis.intent;
        if (intents.includes('comparison')) {
            return 'Membandingkan pajak antar periode';
        }
        if (intents.includes('underpayment')) {
            return 'Menganalisis Status Kurang Bayar (KB)';
        }
        if (intents.includes('overpayment')) {
            return 'Menganalisis Status Lebih Bayar (LB)';
        }
        if (intents.includes('trend')) {
            return 'Menampilkan tren perkembangan pajak';
        }
        return 'Analisis data pajak';
    }
}

/**
 * Create singleton instance
 */
export const semanticAnalyzer = new SemanticAnalyzer();

/**
 * Helper function to check if query is tax-related
 */
export function isTaxQuery(query) {
    const analyzer = new SemanticAnalyzer();
    const analysis = analyzer.analyze(query);
    return analysis.taxTypes.length > 0 || analysis.intent.length > 0;
}

/**
 * Get response template based on analysis type
 */
export function getResponseTemplate(analysisType) {
    const templates = {
        comparison: `### 📊 Analisis Perbandingan\n\nBerikut perbandingan data pajak yang Anda minta:\n\n`,
        underpayment: `### 💰 Status Kurang Bayar (KB)\n\nAnalisis kurang bayar periode ini:\n\n`,
        overpayment: `### ↩️ Status Lebih Bayar (LB)\n\nAnalisis lebih bayar periode ini:\n\n`,
        history: `### 📅 Riwayat Periode\n\nBerikut riwayat pajak yang dicari:\n\n`,
        trend: `### 📈 Analisis Tren\n\nPerkembangan pajak menunjukkan pola:\n\n`,
        status: `### 📊 Status Pajak\n\nStatus pajak saat ini:\n\n`,
        forecast: `### 🔮 Proyeksi\n\nBerdasarkan data historis, proyeksi periode mendatang:\n\n`,
        summary: `### 📋 Ringkasan Pajak\n\nRingkasan lengkap data pajak:\n\n`,
        anomaly: `### ⚠️ Deteksi Anomali\n\nDitemukan hal tidak biasa dalam data:\n\n`,
        compliance: `### ✅ Status Kepatuhan\n\nKepatuhan pajak Anda:\n\n`
    };
    
    return templates[analysisType] || templates.status;
}
