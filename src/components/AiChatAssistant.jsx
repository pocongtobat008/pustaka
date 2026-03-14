import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageCircle, X, Send, FileText, FileSpreadsheet,
    Package, Sparkles, Search, ArrowRight, Loader2,
    ChevronDown, Bot, User, Eye
} from 'lucide-react';

const getApiUrl = () => {
    if (window.location.protocol === 'file:') {
        return 'http://localhost:5005/api';
    }
    return '/api';
};
const API_URL = getApiUrl();

// Format currency for Indonesian Rupiah
const formatRupiah = (amount) => {
    if (!amount && amount !== 0) return '-';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
};

// Result card component
const ResultCard = ({ result, isDarkMode, onNavigate, onLocationClick }) => {
    const typeConfig = {
        document: { icon: FileText, color: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50 dark:bg-blue-900/20', label: 'Dokumen' },
        invoice: { icon: FileSpreadsheet, color: 'from-emerald-500 to-green-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', label: 'Invoice' },
        external: { icon: Package, color: 'from-amber-500 to-orange-600', bg: 'bg-amber-50 dark:bg-amber-900/20', label: 'Eksternal' },
        tax_summary: { icon: Bot, color: 'from-purple-500 to-pink-600', bg: 'bg-purple-50 dark:bg-purple-900/20', label: 'Pajak' },
    };
    const config = typeConfig[result.type] || typeConfig.document;
    const Icon = config.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-3 rounded-xl border transition-all group hover:scale-[1.02] ${isDarkMode
                ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-indigo-300 shadow-sm'
                }`}
        >
            <div className="flex flex-col gap-3">
                <div
                    className="flex-1 flex items-start gap-3 cursor-pointer"
                    onClick={() => onNavigate?.(result)}
                >
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${config.color} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                        <Icon size={14} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${config.bg} ${isDarkMode ? 'text-white/70' : 'text-slate-600'
                                }`}>{config.label}</span>
                            {result.semantic && <Sparkles size={10} className="text-amber-400" />}
                        </div>
                        <p className={`text-sm font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                            {result.title}
                        </p>
                        {result.vendor && (
                            <p className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>
                                {result.vendor} {result.amount ? `• ${formatRupiah(result.amount)}` : ''}
                            </p>
                        )}
                        {result.snippet && (
                            <p className={`text-xs mt-1 line-clamp-2 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                                {result.snippet}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex gap-2 relative z-10 pt-2 border-t border-slate-100 dark:border-white/5">
                    <button
                        onClick={(e) => { e.stopPropagation(); onNavigate?.(result); }}
                        className="flex-1 text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 py-2 rounded-lg transition-all font-bold flex items-center justify-center gap-1.5 border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100"
                    >
                        <Eye size={14} /> {result.matchType === 'note' ? 'Lihat Konteks' : 'Preview'}
                    </button>
                </div>
                {onLocationClick && (
                    <div className="mt-2 relative z-10">
                        <button
                            onClick={(e) => { e.stopPropagation(); onLocationClick(result); }}
                            className={`w-full text-[10px] py-1.5 rounded-lg transition-colors font-bold flex items-center justify-center gap-1 uppercase tracking-wider
                                ${result.matchType === 'invoice' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 hover:bg-amber-100' :
                                    result.matchType === 'external_item' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100' :
                                        result.matchType === 'tax_summary' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 hover:bg-purple-100' :
                                            result.matchType === 'tax_monitoring' ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 hover:bg-orange-100' :
                                                result.matchType === 'approval' ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 hover:bg-rose-100' :
                                                    result.matchType === 'pustaka' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100' :
                                                        result.matchType === 'tax_object' ? 'bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' :
                                                            'bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'}`}
                        >
                            {result.matchType === 'invoice' ? `📦 ${result.folderName || 'Finance'}` :
                                result.matchType === 'external_item' ? `🚚 ${result.folderName || 'Eksternal'}` :
                                    result.matchType === 'tax_summary' ? `📊 ${result.folderName || 'Pajak'}` :
                                        result.matchType === 'tax_monitoring' ? `🔍 ${result.folderName || 'Pemeriksaan'}` :
                                            result.matchType === 'note' ? `💬 ${result.folderName || 'Diskusi'}` :
                                                result.matchType === 'approval' ? `✅ ${result.folderName || 'Approval'}` :
                                                    result.matchType === 'pustaka' ? `📚 ${result.folderName || 'Pustaka'}` :
                                                        result.matchType === 'tax_object' ? `👥 ${result.folderName || 'Database WP'}` :
                                                            `📂 ${result.folderName || 'General'}`}
                        </button>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

// Typing indicator
const TypingIndicator = ({ isDarkMode }) => (
    <div className="flex items-center gap-2 px-4 py-3">
        <div className={`w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg text-xs`}>
            🤖
        </div>
        <div className="flex gap-1">
            {[0, 1, 2].map(i => (
                <motion.div
                    key={i}
                    className={`w-2 h-2 rounded-full ${isDarkMode ? 'bg-white/40' : 'bg-slate-400'}`}
                    animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                />
            ))}
        </div>
    </div>
);

// Simple Markdown component to handle basic formatting, alerts, and tables
const MarkdownRenderer = ({ content, isDarkMode }) => {
    if (!content) return null;

    const lines = content.split('\n');
    let inTable = false;
    let tableRows = [];

    const renderLine = (line, index) => {
        // Handle Alerts
        if (line.startsWith('> [!')) {
            const match = line.match(/> \[!(\w+)\]/);
            const type = match ? match[1] : 'NOTE';
            const colors = {
                NOTE: 'blue',
                TIP: 'emerald',
                IMPORTANT: 'indigo',
                WARNING: 'amber',
                CAUTION: 'red'
            };
            const color = colors[type] || 'blue';
            return (
                <div key={index} className={`my-2 p-2 rounded-lg border-l-4 text-[11px] ${isDarkMode
                    ? `bg-${color}-500/10 border-${color}-500 text-${color}-300`
                    : `bg-${color}-50 border-${color}-500 text-${color}-700`
                    }`}>
                    <span className="font-bold uppercase tracking-tight mr-1">{type}:</span>
                    {line.replace(/> \[!\w+\]\s*/, '').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')}
                </div>
            );
        }

        // Handle Headers
        if (line.startsWith('### ')) {
            return <h3 key={index} className="text-sm font-bold mt-3 mb-1 text-indigo-500">{line.replace('### ', '')}</h3>;
        }

        // Handle Bold
        let formattedLine = line.split('**').map((part, i) => i % 2 === 1 ? <b key={i} className="font-bold text-indigo-400">{part}</b> : part);

        // Handle Lists
        if (line.trim().startsWith('- ')) {
            return <div key={index} className="flex gap-2 pl-1 my-0.5"><span className="text-indigo-500">•</span><div>{formattedLine}</div></div>;
        }

        // Handle Tables (Minimalist)
        if (line.includes('|')) {
            const cells = line.split('|').filter(c => c.trim() !== '').map(c => c.trim());
            if (cells.length > 0 && !line.includes('---')) {
                return (
                    <div key={index} className={`grid grid-cols-${cells.length} gap-2 py-1 px-2 text-[10px] border-b ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                        {cells.map((c, i) => <div key={i} className={index === 0 ? "font-bold text-indigo-400" : ""}>{c}</div>)}
                    </div>
                );
            }
            return null;
        }

        return <p key={index} className="mb-1">{formattedLine}</p>;
    };

    return <div className="markdown-content">{lines.map((line, i) => renderLine(line, i))}</div>;
};

// Quick action suggestions
const quickActions = [
    "Bandingkan PPN bulan ini vs bulan lalu",
    "Berapa total PPN masukan tahun ini",
    "Kapan terakhir kali kurang bayar?",
    "Status pemeriksaan pajak",
];

// --- AI TAX ANALYSIS ENGINE ---
const analyzeTaxData = (query, summaries, config) => {
    if (!summaries || summaries.length === 0) return null;
    const safeConfig = { pphTypes: config?.pphTypes || [], ppnInTypes: config?.ppnInTypes || [], ppnOutTypes: config?.ppnOutTypes || [] };
    
    const q = query.toLowerCase();
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    
    const getVal = (record, type, category) => {
        if (!record) return 0;
        if (record.data && record.data[category] && record.data[category][type] !== undefined) {
            return Number(record.data[category][type]) || 0;
        }
        if (type === 'PPh 23') return record.pph23 || 0;
        if (type === 'PPh 4(2)') return record.pph42 || 0;
        return 0;
    };

    const isComparison = q.includes('banding') || q.includes('vs') || q.includes('perbandingan');
    const isTrend = q.includes('tren') || q.includes('perkembangan') || q.includes('grafik') || q.includes('statistik');
    const isPPh = q.includes('pph');
    const isPPN = q.includes('ppn');
    const isTaxQuery = isPPh || isPPN || q.includes('pajak') || q.includes('spt');

    // Jika tidak ada kata kunci pajak eksplisit, namun ada instruksi perbandingan dan nama bulan, 
    // kita asumsikan ini adalah permintaan analisis pajak.
    const monthAbbrs = ["jan", "feb", "mar", "apr", "mei", "jun", "jul", "ags", "agu", "sep", "okt", "nov", "des"];
    const hasMonths = months.some(m => q.includes(m.toLowerCase())) || 
                      monthAbbrs.some(abbr => q.includes(abbr)) ||
                      q.includes('bulan ini') || q.includes('bulan lalu');
    
    if (!isTaxQuery && !(isComparison && hasMonths)) return null;

    const now = new Date();
    const currentMonthIdx = now.getMonth();
    const lastMonthIdx = (currentMonthIdx - 1 + 12) % 12;

    const foundMonths = [];

    // Deteksi istilah relatif dan petakan ke nama bulan nyata
    // Urutan 'bulan lalu' didahulukan agar menjadi m1 (baseline) dan 'bulan ini' menjadi m2 (target)
    if (q.includes('bulan lalu')) foundMonths.push(months[lastMonthIdx]);
    if (q.includes('bulan ini')) foundMonths.push(months[currentMonthIdx]);

    months.forEach(m => {
        const mLow = m.toLowerCase();
        const abbr = mLow.substring(0, 3);
        // Cek nama lengkap, singkatan 3 huruf, atau "ags" khusus untuk Agustus
        if (q.includes(mLow) || q.includes(abbr) || (mLow === "agustus" && q.includes("ags"))) {
            if (!foundMonths.includes(m)) foundMonths.push(m);
        }
    });

    const foundYears = [...new Set(summaries.map(s => String(s.year)))].filter(y => q.includes(y));
    const targetYear = foundYears.length > 0 ? parseInt(foundYears[0]) : now.getFullYear();

    // 1. Analisis Perbandingan
    if (isComparison && foundMonths.length >= 2) {
        const m1 = foundMonths[0];
        const m2 = foundMonths[1];

        // Penyesuaian tahun otomatis jika membandingkan Jan vs Des (kasus awal tahun)
        const m1Year = (m1 === "Desember" && months[currentMonthIdx] === "Januari" && q.includes('bulan lalu')) 
                       ? targetYear - 1 : targetYear;
        const m2Year = targetYear;

        // Mencari record spesifik berdasarkan tipe agar tidak tertukar antara PPh dan PPN
        const r1ppn = summaries.find(s => s.month === m1 && s.year === m1Year && s.type === 'PPN');
        const r2ppn = summaries.find(s => s.month === m2 && s.year === m2Year && s.type === 'PPN');
        const r1pph = summaries.find(s => s.month === m1 && s.year === m1Year && (s.type === 'PPH' || !s.type));
        const r2pph = summaries.find(s => s.month === m2 && s.year === m2Year && (s.type === 'PPH' || !s.type));

        const hasPPN = r1ppn && r2ppn;
        const hasPPh = r1pph && r2pph;

        if (!hasPPN && !hasPPh) return `> [!WARNING]\n> Data pajak untuk periode **${m1}** dan **${m2}** tidak ditemukan di database.`;

        let response = `### 📊 Analisis Perbandingan Pajak\nPeriode: **${m1} ${m1Year}** vs **${m2} ${m2Year}**\n\n`;
        
        if (isPPN || (!isPPh && !isPPN)) {
            if (!hasPPN) {
                response += `> [!WARNING]\n> Data **PPN** untuk perbandingan periode ini tidak lengkap.\n\n`;
            } else {
                const in1 = safeConfig.ppnInTypes.reduce((sum, t) => sum + getVal(r1ppn, t, 'ppnIn'), 0);
                const out1 = safeConfig.ppnOutTypes.reduce((sum, t) => sum + getVal(r1ppn, t, 'ppnOut'), 0);
                const net1 = out1 - in1;

                const in2 = safeConfig.ppnInTypes.reduce((sum, t) => sum + getVal(r2ppn, t, 'ppnIn'), 0);
                const out2 = safeConfig.ppnOutTypes.reduce((sum, t) => sum + getVal(r2ppn, t, 'ppnOut'), 0);
                const net2 = out2 - in2;

                const diff = net2 - net1;
                response += `#### 🔹 Pajak Pertambahan Nilai (PPN)\n`;
                response += `| Komponen | ${m1} | ${m2} | Selisih |\n| :--- | :--- | :--- | :--- |\n`;
                response += `| PPN Masukan | ${formatRupiah(in1)} | ${formatRupiah(in2)} | ${formatRupiah(in2-in1)} |\n`;
                response += `| PPN Keluaran | ${formatRupiah(out1)} | ${formatRupiah(out2)} | ${formatRupiah(out2-out1)} |\n`;
                response += `| **Netto (KB/LB)** | **${formatRupiah(net1)}** | **${formatRupiah(net2)}** | **${formatRupiah(diff)}** |\n\n`;
                
                response += `> [!NOTE]\n> Status PPN di ${m2} adalah **${net2 > 0 ? 'Kurang Bayar' : 'Lebih Bayar'}** sebesar ${formatRupiah(Math.abs(net2))}.\n\n`;
            }
        }

        if (isPPh || (!isPPh && !isPPN)) {
            if (!hasPPh) {
                response += `> [!WARNING]\n> Data **PPh** untuk perbandingan periode ini tidak lengkap.\n\n`;
            } else {
                const pph1 = safeConfig.pphTypes.reduce((sum, t) => sum + getVal(r1pph, t, 'pph'), 0);
                const pph2 = safeConfig.pphTypes.reduce((sum, t) => sum + getVal(r2pph, t, 'pph'), 0);
                response += `#### 🔸 Pajak Penghasilan (PPh)\n`;
                response += `- Total PPh ${m1}: **${formatRupiah(pph1)}**\n`;
                response += `- Total PPh ${m2}: **${formatRupiah(pph2)}**\n`;
                response += `- Perubahan: **${pph2 > pph1 ? 'Kenaikan' : 'Penurunan'}** sebesar ${formatRupiah(Math.abs(pph2-pph1))}.\n`;
            }
        }
        return response;
    }

    // 2. Analisis Tren / Ringkasan Tahunan
    if (isTrend || q.includes('ringkasan') || q.includes('total')) {
        const yearData = summaries.filter(s => s.year === targetYear);
        if (yearData.length === 0) return `Saya tidak menemukan data pajak untuk tahun ${targetYear}.`;

        const totalPPh = yearData.reduce((sum, s) => sum + safeConfig.pphTypes.reduce((pSum, t) => pSum + getVal(s, t, 'pph'), 0), 0);
        const totalPPNIn = yearData.reduce((sum, s) => sum + safeConfig.ppnInTypes.reduce((pSum, t) => pSum + getVal(s, t, 'ppnIn'), 0), 0);
        const totalPPNOut = yearData.reduce((sum, s) => sum + safeConfig.ppnOutTypes.reduce((pSum, t) => pSum + getVal(s, t, 'ppnOut'), 0), 0);

        let response = `### 📈 Ringkasan Eksekutif Pajak ${targetYear}\n\n`;
        response += `Berdasarkan data **${yearData.length} bulan** yang tercatat:\n\n`;
        response += `- **Total PPh Terutang:** ${formatRupiah(totalPPh)}\n`;
        response += `- **Total PPN Masukan:** ${formatRupiah(totalPPNIn)}\n`;
        response += `- **Total PPN Keluaran:** ${formatRupiah(totalPPNOut)}\n`;
        response += `- **Saldo PPN Netto:** ${formatRupiah(totalPPNOut - totalPPNIn)} (${(totalPPNOut - totalPPNIn) > 0 ? 'Kurang Bayar' : 'Lebih Bayar'})\n\n`;

        const maxPPh = Math.max(...yearData.map(s => safeConfig.pphTypes.reduce((sum, t) => sum + getVal(s, t, 'pph'), 0)));
        const peakMonth = yearData.find(s => safeConfig.pphTypes.reduce((sum, t) => sum + getVal(s, t, 'pph'), 0) === maxPPh)?.month;

        response += `> [!TIP]\n> Lonjakan pembayaran pajak tertinggi terjadi pada bulan **${peakMonth}**. Pastikan arus kas perusahaan siap untuk periode tersebut di tahun mendatang.`;
        
        return response;
    }

    return null;
};

export default function AiChatAssistant({
    isDarkMode,
    onNavigateToDoc,
    onNavigateToInvoice,
    handleNavigateToFolder,
    setActiveTab,
    setActiveInvTab,
    taxSummaries = [],
    taxConfig = {}
}) {
    // Semantic search widget state
    const [semanticQ, setSemanticQ] = useState('');
    const [semanticResults, setSemanticResults] = useState([]);
    const [semanticLoading, setSemanticLoading] = useState(false);
    const [showSemantic, setShowSemantic] = useState(true);

    const doSemanticSearch = async (q = semanticQ) => {
        if (!q || q.length < 2) return;
        setSemanticLoading(true);
        try {
                const headers = { 'Content-Type': 'application/json' };
                // In local dev, allow a dev-token bypass so searches work without login
                try {
                    const isLocal = API_URL.startsWith('http://localhost') || window.location.protocol === 'file:';
                    if (isLocal) headers['Authorization'] = 'Bearer dev-token';
                } catch (e) { /* ignore in non-browser env */ }

                const res = await fetch(`${API_URL}/search/ai`, {
                    method: 'POST',
                    headers,
                    credentials: 'include',
                    body: JSON.stringify({ query: q })
                });
            const json = await res.json();
            const results = (json.results || []).map(r => ({
                ...r,
                title: r.title || r.name || r.filename || 'Untitled',
                snippet: r.preview || r.snippet || '',
                filePath: r.filePath,
                downloadUrl: r.downloadUrl,
                matchType: r.matchType || r.type || 'document'
            }));
            setSemanticResults(results);
            // Append results into chat as assistant message
            setMessages(prev => [...prev, {
                role: 'assistant',
                text: `Hasil pencarian: "${q}"`,
                results: results,
            }]);
            // clear input after search
            setInput('');
        } catch (e) {
            console.error('Semantic search error', e);
            setSemanticResults([]);
            setMessages(prev => [...prev, { role: 'assistant', text: 'Gagal melakukan pencarian.', results: [] }]);
        } finally { setSemanticLoading(false); }
    };
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            text: 'Halo! 👋 Saya asisten AI Pustaka Sistem. Tanyakan apa saja tentang dokumen, invoice, atau arsip Anda.',
            results: []
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen]);

    const pollJobStatus = async (jobId) => {
        const poll = async () => {
            try {
                const res = await fetch(`${API_URL}/search/job/${jobId}`, {
                    credentials: 'include'
                });
                const data = await res.json();

                if (data.status === 'completed') {
                    const result = data.result;
                    let mappedResults = [];
                    if (result.results) {
                        mappedResults = result.results.map(item => ({
                            ...item,
                            title: item.title || item.name || 'Untitled',
                            uploadDate: item.uploadDate || item.date,
                            size: item.amount ? `Rp ${parseInt(item.amount).toLocaleString('id-ID')}` : (item.size || 'Document'),
                            folderName: item.folderName || (item.matchType === 'invoice' ? 'Finance' : 'General'),
                        }));
                    }

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        text: result.reply || 'Maaf, tidak ada respons.',
                        results: mappedResults,
                        intent: result.intent
                    }]);
                    setIsLoading(false);
                    return;
                }

                if (data.status === 'failed') {
                    throw new Error(data.error || 'Job failed');
                }

                // Continue polling
                setTimeout(poll, 1500);
            } catch (err) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    text: `Maaf, terjadi kendala saat memproses: ${err.message}`,
                    results: []
                }]);
                setIsLoading(false);
            }
        };
        poll();
    };

    const handleSend = async (text = input) => {
        const msg = text.trim();
        if (!msg || isLoading) return;

        // Add user message
        setMessages(prev => [...prev, { role: 'user', text: msg }]);
        setInput('');
        // Use send action to perform semantic search and append results into chat
        setIsLoading(true);
        try {
            // 1. Cek apakah ini permintaan analisis pajak
            const taxAnalysis = analyzeTaxData(msg, taxSummaries, taxConfig);
            if (taxAnalysis) {
                // Simulasi waktu berpikir AI
                await new Promise(resolve => setTimeout(resolve, 1000));
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    text: taxAnalysis,
                    results: [],
                    isAnalysis: true
                }]);
                setIsLoading(false);
                return;
            }

            // 2. Jika bukan pajak, lakukan pencarian semantik dokumen
            await doSemanticSearch(msg);
        } catch (err) {
            console.error('Search send error', err);
            setMessages(prev => [...prev, { role: 'assistant', text: `Gagal mencari data: ${err.message}`, results: [] }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            doSemanticSearch(input);
            return;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleResultClick = (result) => {
        // Dashboard style: Detail always calls handleViewDoc (onNavigateToDoc)
        // handleViewDoc in App.jsx already handles all matchTypes (invoice, tax, etc.)
        onNavigateToDoc?.(result);
        setIsOpen(false);
    };

    const handleLocationClick = (result) => {
        console.log("Navigating to location for result:", result);
        const matchType = result.matchType || result.type;

        if (matchType === 'invoice') {
            setActiveTab('inventory');
            if (setActiveInvTab) setActiveInvTab('internal');
        } else if (matchType === 'external_item') {
            setActiveTab('inventory');
            if (setActiveInvTab) setActiveInvTab('external');
        } else if (matchType === 'tax_summary') {
            setActiveTab('tax-summary');
        } else if (matchType === 'tax_monitoring') {
            setActiveTab('tax-monitoring');
        } else if (matchType === 'approval') {
            setActiveTab('approvals');
        } else if (matchType === 'pustaka') {
            setActiveTab('pustaka');
        } else if (matchType === 'tax_object') {
            setActiveTab('tax-calculation');
        } else if (matchType === 'note') {
            if (result.parentType === 'audit') {
                setActiveTab('tax-monitoring');
            } else {
                setActiveTab('documents');
                if (result.folderId) handleNavigateToFolder?.(result.folderId);
            }
        } else {
            // Default to documents/folder
            if ((result.folderId || result.folderId === null) && handleNavigateToFolder) {
                handleNavigateToFolder(result.folderId);
            } else {
                setActiveTab('documents');
            }
        }
        setIsOpen(false);
    };

    const clearChat = () => {
        setMessages([{
            role: 'assistant',
            text: 'Chat direset. Ada yang bisa saya bantu?',
            results: []
        }]);
    };

    return (
        <>
            {/* Floating Button */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setIsOpen(true)}
                        className="fixed bottom-6 right-6 z-[200] w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-2xl shadow-indigo-500/40 flex items-center justify-center group"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                        <span className="text-2xl group-hover:scale-110 transition-transform">🤖</span>
                        {/* Pulse ring */}
                        <span className="absolute inset-0 rounded-full bg-indigo-500 animate-ping opacity-20" />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Chat Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 40, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 40, scale: 0.9 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className={`fixed bottom-6 right-6 z-[200] w-[400px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-3rem)] rounded-3xl overflow-hidden flex flex-col shadow-2xl ${isDarkMode
                            ? 'bg-[#0d1230]/95 border border-white/10 shadow-black/50'
                            : 'bg-white/95 border border-slate-200 shadow-slate-300/50'
                            }`}
                        style={{ backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
                    >
                        {/* Header */}
                        <div className={`p-4 flex items-center gap-3 border-b flex-shrink-0 ${isDarkMode ? 'border-white/10' : 'border-slate-100'
                            }`}>
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center shadow-lg shadow-indigo-500/30 text-lg">
                                🤖
                            </div>
                            <div className="flex-1">
                                <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                    AI Assistant
                                </h3>
                                <p className={`text-[10px] ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} font-semibold flex items-center gap-1`}>
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                    Online • Hybrid Search
                                </p>
                            </div>
                            <button
                                onClick={clearChat}
                                className={`p-2 rounded-xl transition-all text-xs font-semibold ${isDarkMode ? 'hover:bg-white/10 text-white/50 hover:text-white/80' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
                                    }`}
                                title="Reset Chat"
                            >
                                Reset
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className={`p-2 rounded-xl transition-all ${isDarkMode ? 'hover:bg-white/10 text-white/50 hover:text-red-400' : 'hover:bg-red-50 text-slate-400 hover:text-red-500'
                                    }`}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Semantic search moved into chat input (search button) */}

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 custom-scrollbar">
                            {messages.map((msg, i) => (
                                <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    {msg.role === 'assistant' && (
                                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg mt-0.5 text-xs">
                                            🤖
                                        </div>
                                    )}
                                    <div className={`max-w-[85%] space-y-2`}>
                                        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words overflow-hidden ${msg.role === 'user'
                                            ? 'bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-br-lg shadow-lg shadow-indigo-500/20'
                                            : isDarkMode
                                                ? 'bg-white/8 text-white/90 rounded-bl-lg border border-white/5'
                                                : 'bg-slate-100 text-slate-700 rounded-bl-lg'
                                            }`}>
                                            <MarkdownRenderer content={msg.text} isDarkMode={isDarkMode} />
                                        </div>

                                        {/* Intent badges */}
                                        {msg.intent && (msg.intent.vendor || msg.intent.minAmount || msg.intent.maxAmount) && (
                                            <div className="flex flex-wrap gap-1 px-1">
                                                {msg.intent.vendor && (
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${isDarkMode ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700'}`}>
                                                        🏢 {msg.intent.vendor}
                                                    </span>
                                                )}
                                                {msg.intent.minAmount && (
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${isDarkMode ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        💰 ≥ {formatRupiah(msg.intent.minAmount)}
                                                    </span>
                                                )}
                                                {msg.intent.maxAmount && (
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${isDarkMode ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>
                                                        💰 ≤ {formatRupiah(msg.intent.maxAmount)}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Result cards */}
                                        {msg.results && msg.results.length > 0 && (
                                            <div className="space-y-2 mt-1">
                                                {msg.results.slice(0, 5).map((result, j) => (
                                                    <ResultCard
                                                        key={j}
                                                        result={result}
                                                        isDarkMode={isDarkMode}
                                                        onNavigate={handleResultClick}
                                                        onLocationClick={handleLocationClick}
                                                    />
                                                ))}
                                                {msg.results.length > 5 && (
                                                    <p className={`text-xs text-center py-1 ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>
                                                        +{msg.results.length - 5} hasil lainnya
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {msg.role === 'user' && (
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isDarkMode ? 'bg-white/10' : 'bg-slate-200'
                                            }`}>
                                            <User size={14} className={isDarkMode ? 'text-white/70' : 'text-slate-500'} />
                                        </div>
                                    )}
                                </div>
                            ))}

                            {isLoading && <TypingIndicator isDarkMode={isDarkMode} />}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Quick Actions (only show if few messages) */}
                        {messages.length <= 2 && !isLoading && (
                            <div className={`px-4 pb-2 flex flex-wrap gap-1.5 border-t pt-2 ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                                {quickActions.map((qa, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSend(qa)}
                                        className={`text-[11px] px-3 py-1.5 rounded-full font-medium transition-all ${isDarkMode
                                            ? 'bg-white/5 text-white/60 hover:bg-indigo-500/20 hover:text-indigo-300 border border-white/5'
                                            : 'bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-700'
                                            }`}
                                    >
                                        {qa}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Input */}
                        <div className={`p-3 border-t flex-shrink-0 ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
                            <div className={`flex items-center gap-2 rounded-2xl px-4 py-2 ${isDarkMode
                                ? 'bg-white/5 border border-white/10 focus-within:border-indigo-500/50'
                                : 'bg-slate-100 border border-transparent focus-within:border-indigo-300 focus-within:bg-white'
                                } transition-all`}>
                                <Search size={16} className={`flex-shrink-0 ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`} />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Tanya sesuatu..."
                                    disabled={isLoading}
                                    className={`flex-1 bg-transparent text-sm outline-none placeholder-opacity-50 ${isDarkMode
                                        ? 'text-white placeholder-white/30'
                                        : 'text-slate-800 placeholder-slate-400'
                                        }`}
                                />
                                {/* semantic search button removed per request */}
                                <button
                                    onClick={() => handleSend()}
                                    disabled={!input.trim() || isLoading}
                                    className={`p-2 rounded-xl transition-all ${input.trim() && !isLoading
                                        ? 'bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-lg shadow-indigo-500/30 hover:scale-105 active:scale-95'
                                        : isDarkMode ? 'text-white/20' : 'text-slate-300'
                                        }`}
                                >
                                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                </button>
                            </div>
                            <p className={`text-[9px] text-center mt-1.5 ${isDarkMode ? 'text-white/20' : 'text-slate-300'}`}>
                                Hybrid Search • Semantic + Keyword • parseIntent NLP
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
