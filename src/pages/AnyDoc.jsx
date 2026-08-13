import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SummaryRow } from '../components/ui/Card';
import * as XLSX from 'xlsx';
import {
    UploadCloud, FileText, FileSpreadsheet, File as FileIcon, Copy, Check, Download,
    Archive, Brain, Loader2, X, History, Sparkles, AlertCircle, CheckCircle2, Eye,
    FileCode2, Trash2, Clock, BookOpen, Plus, ListChecks, Table2, ChevronDown, ChevronRight,
} from 'lucide-react';

const getApiUrl = () => {
    if (window.location.protocol === 'file:') return 'http://localhost:5005/api';
    return '/api';
};
const API_URL = getApiUrl();

const SUPPORTED_FORMATS = [
    { ext: 'Word', icon: '📝', colors: 'from-blue-500 to-indigo-600', desc: '.doc .docx .docm' },
    { ext: 'Excel', icon: '📊', colors: 'from-emerald-500 to-green-600', desc: '.xls .xlsx .xlsm .xlsb' },
    { ext: 'PowerPoint', icon: '📽️', colors: 'from-orange-500 to-red-600', desc: '.ppt .pptx .pps .pot' },
    { ext: 'PDF', icon: '📄', colors: 'from-rose-500 to-pink-600', desc: '.pdf' },
    { ext: 'OpenDocument', icon: '📂', colors: 'from-teal-500 to-cyan-600', desc: '.odt .ods .odp' },
    { ext: 'Lainnya', icon: '📚', colors: 'from-purple-500 to-violet-600', desc: '.rtf .epub .csv .txt' },
];

const EXTENSION_PATTERN = /\.(docx?|docm|pptx?|ppsx?|potx?|pptm|ppsm|xlsx?|xlsm|xlsb|odt|ods|odp|rtf|epub|csv|pdf|md|txt)$/i;

const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
};

const formatRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'baru saja';
    if (mins < 60) return `${mins} mnt lalu`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} jam lalu`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} hari lalu`;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

const isSeparatorRow = (line) => /^\|?[\s:|-]+\|?$/.test(line) && line.includes('---');

const SimpleMarkdown = ({ content, isDarkMode }) => {
    if (!content) return null;
    const lines = content.split('\n');

    return (
        <div className="space-y-1">
            {lines.map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={i} className="h-1" />;

                // Table separator row (skip; next row is a data row)
                if (isSeparatorRow(trimmed)) return null;

                // Table row — the row right before a separator is the header
                if (trimmed.startsWith('|') || trimmed.endsWith('|')) {
                    const cells = trimmed.split('|').filter(c => c.trim() !== '').map(c => c.trim());
                    if (cells.length > 0) {
                        const isHeader = !!lines[i + 1] && isSeparatorRow(lines[i + 1].trim());
                        return (
                            <div key={i} className={`grid gap-2 py-1 px-2 text-xs border-b ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}
                                style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0,1fr))` }}>
                                {cells.map((c, ci) => (
                                    <div key={ci} className={isHeader ? `font-bold ${isDarkMode ? 'text-indigo-300' : 'text-indigo-600'}` : ''}>{c}</div>
                                ))}
                            </div>
                        );
                    }
                }

                // Headings
                const h3 = trimmed.match(/^###\s+(.+)/);
                const h2 = trimmed.match(/^##\s+(.+)/);
                const h1 = trimmed.match(/^#\s+(.+)/);
                if (h1) return <div key={i} className={`text-lg font-extrabold mt-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{h1[1]}</div>;
                if (h2) return <div key={i} className={`text-base font-bold mt-2 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>{h2[1]}</div>;
                if (h3) return <div key={i} className={`text-sm font-bold mt-2 ${isDarkMode ? 'text-indigo-300/80' : 'text-indigo-600'}`}>{h3[1]}</div>;

                // Lists
                const ul = trimmed.match(/^\s*[-*]\s+(.+)/);
                const ol = trimmed.match(/^\s*(\d+)[.)]\s+(.+)/);
                if (ul) return <div key={i} className={`flex gap-2 text-sm ${isDarkMode ? 'text-white/80' : 'text-slate-700'}`}><span className="text-indigo-500">•</span><span>{ul[1]}</span></div>;
                if (ol) return <div key={i} className={`flex gap-2 text-sm ${isDarkMode ? 'text-white/80' : 'text-slate-700'}`}><span className="text-indigo-500 font-bold">{ol[1]}.</span><span>{ol[2]}</span></div>;

                // Blockquote
                if (trimmed.startsWith('>')) return <div key={i} className={`text-sm italic pl-3 border-l-4 ${isDarkMode ? 'border-indigo-500/50 text-white/60' : 'border-indigo-300 text-slate-500'}`}>{trimmed.replace(/^>\s?/, '')}</div>;

                // Inline code
                if (trimmed.startsWith('```')) return null;

                // Regular paragraph with inline formatting
                const parts = trimmed.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
                return (
                    <p key={i} className={`text-sm leading-relaxed ${isDarkMode ? 'text-white/85' : 'text-slate-700'}`}>
                        {parts.map((p, pi) => {
                            if (p.startsWith('**') && p.endsWith('**')) return <strong key={pi} className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{p.slice(2, -2)}</strong>;
                            if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return <em key={pi} className="italic">{p.slice(1, -1)}</em>;
                            if (p.startsWith('`') && p.endsWith('`')) return <code key={pi} className={`px-1 py-0.5 rounded text-xs font-mono ${isDarkMode ? 'bg-white/10 text-pink-300' : 'bg-slate-100 text-pink-600'}`}>{p.slice(1, -1)}</code>;
                            return p;
                        })}
                    </p>
                );
            })}
        </div>
    );
};

// Editor kolom berupa chip (tambah/hapus) — untuk mapping field ekstraksi PDF
const ChipEditor = ({ items, onChange, placeholder, isDarkMode, accent = 'indigo' }) => {
    const [draft, setDraft] = useState('');
    const add = () => {
        const v = draft.trim();
        if (v && !items.includes(v)) onChange([...items, v]);
        setDraft('');
    };
    const accentCls = accent === 'emerald'
        ? (isDarkMode ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200')
        : (isDarkMode ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border-indigo-200');
    return (
        <div>
            <div className="flex flex-wrap gap-1.5 mb-2">
                {items.map((it, i) => (
                    <span key={i} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border ${accentCls}`}>
                        {it}
                        <button type="button" onClick={() => onChange(items.filter((_, x) => x !== i))} className="opacity-50 hover:opacity-100" title="Hapus kolom">
                            <X size={11} />
                        </button>
                    </span>
                ))}
                {items.length === 0 && (
                    <span className={`text-[11px] ${isDarkMode ? 'text-white/30' : 'text-slate-300'}`}>Belum ada kolom.</span>
                )}
            </div>
            <div className="flex gap-1.5">
                <input
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
                    placeholder={placeholder}
                    className={`flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-xs border outline-none transition-colors ${isDarkMode
                        ? 'bg-white/5 border-white/10 text-white placeholder-white/30 focus:border-indigo-500/60'
                        : 'bg-white/70 backdrop-blur-xl border-slate-200 text-slate-700 placeholder-slate-300 focus:border-indigo-400'}`}
                />
                <button type="button" onClick={add}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${isDarkMode
                        ? 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30'
                        : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'}`}>
                    <Plus size={12} /> Tambah
                </button>
            </div>
        </div>
    );
};

export default function AnyDoc({ isDarkMode, currentUser }) {
    const [file, setFile] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const [converting, setConverting] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [history, setHistory] = useState([]);
    const [copied, setCopied] = useState(false);
    const [saving, setSaving] = useState(null); // 'archive' | 'train' | null
    const [savedMsg, setSavedMsg] = useState('');
    const [showHistory, setShowHistory] = useState(false);
    const inputRef = useRef(null);
    const copyTimerRef = useRef(null);

    // ── Mode Ekstrak Data → Excel ──
    const [mode, setMode] = useState('convert'); // 'convert' | 'extract'
    const [extractFiles, setExtractFiles] = useState([]);
    const [dragOver2, setDragOver2] = useState(false);
    const [fields, setFields] = useState(['No. Faktur Pajak', 'Tanggal', 'No. Invoice', 'Customer', 'NPWP', 'Alamat', 'Total', 'PPN', 'DP', 'Keterangan']);
    const [itemFields, setItemFields] = useState(['Model', 'Deskripsi', 'Qty', 'Harga', 'Subtotal']);
    const [extracting, setExtracting] = useState(false);
    const [extractError, setExtractError] = useState(null);
    const [results, setResults] = useState([]);
    const [expanded, setExpanded] = useState({});
    const extractInputRef = useRef(null);

    const addExtractFiles = (list) => {
        setExtractError(null);
        setResults([]);
        const allowed = /\.(pdf|docx|txt)$/i;
        const ok = [...list].filter(f => allowed.test(f.name));
        setExtractFiles(prev => {
            const merged = [...prev];
            for (const f of ok) {
                if (!merged.some(x => x.name === f.name && x.size === f.size)) merged.push(f);
            }
            return merged;
        });
    };

    const removeExtractFile = (i) => setExtractFiles(prev => prev.filter((_, idx) => idx !== i));

    const handleExtract = async () => {
        if (!extractFiles.length || extracting) return;
        setExtracting(true);
        setExtractError(null);
        setResults([]);
        try {
            const fd = new FormData();
            extractFiles.forEach(f => fd.append('files', f));
            fd.append('fields', JSON.stringify(fields));
            fd.append('itemFields', JSON.stringify(itemFields));
            const res = await fetch(`${API_URL}/anydoc/extract`, { method: 'POST', credentials: 'include', body: fd });
            const raw = await res.text();
            let j = {};
            try { j = JSON.parse(raw); } catch { /* non-JSON */ }
            if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
            setResults(j.results || []);
        } catch (e) {
            setExtractError(e.message || 'Gagal mengekstrak dokumen.');
        } finally {
            setExtracting(false);
        }
    };

    const updateCell = (ri, field, val) => {
        setResults(prev => prev.map((r, i) => i === ri ? { ...r, data: { ...(r.data || {}), [field]: val } } : r));
    };

    const updateItemCell = (ri, ii, field, val) => {
        setResults(prev => prev.map((r, i) => {
            if (i !== ri) return r;
            const items = (r.items || []).map((it, x) => x === ii ? { ...it, [field]: val } : it);
            return { ...r, items };
        }));
    };

    const handleDownloadExcel = () => {
        const okRows = results.filter(r => r.success);
        if (!okRows.length) return;
        const rows = okRows.map(r => {
            const row = { 'Nama File': r.filename };
            fields.forEach(f => { row[f] = r.data?.[f] ?? ''; });
            return row;
        });
        const ws1 = XLSX.utils.json_to_sheet(rows);
        ws1['!cols'] = [{ wch: 30 }, ...fields.map(f => ({ wch: Math.min(Math.max(f.length * 1.8, 14), 40) }))];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws1, 'Data Nota');

        const itemRows = [];
        okRows.forEach(r => {
            (r.items || []).forEach((it, idx) => {
                const row = { 'Nama File': r.filename, 'No': idx + 1 };
                itemFields.forEach(f => { row[f] = it?.[f] ?? ''; });
                itemRows.push(row);
            });
        });
        if (itemRows.length) {
            const ws2 = XLSX.utils.json_to_sheet(itemRows);
            ws2['!cols'] = [{ wch: 30 }, { wch: 6 }, ...itemFields.map(f => ({ wch: Math.min(Math.max(f.length * 1.8, 12), 40) }))];
            XLSX.utils.book_append_sheet(wb, ws2, 'Item Barang');
        }
        XLSX.writeFile(wb, `ekstrak_data_pdf_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const loadHistory = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/anydoc/history`, { credentials: 'include' });
            if (res.ok) setHistory(await res.json());
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { loadHistory(); }, [loadHistory]);

    const handleFileSelect = (f) => {
        setError(null);
        setResult(null);
        setSavedMsg('');
        if (!f) return;
        if (!EXTENSION_PATTERN.test(f.name)) {
            setError('Format file tidak didukung. Gunakan Word, Excel, PowerPoint, PDF, EPUB, RTF, CSV, ODT, atau TXT.');
            setFile(null);
            return;
        }
        setFile(f);
    };

    const handleConvert = async () => {
        if (!file || converting) return;
        setConverting(true);
        setError(null);
        setResult(null);
        setSavedMsg('');
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch(`${API_URL}/anydoc/convert`, { method: 'POST', credentials: 'include', body: fd });
            const raw = await res.text();
            let j = {};
            try { j = JSON.parse(raw); } catch { /* non-JSON (e.g. HTML error page) */ }
            if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
            setResult(j);
            loadHistory();
        } catch (e) {
            setError(e.message || 'Gagal mengonversi dokumen.');
        } finally {
            setConverting(false);
        }
    };

    const handleCopy = async () => {
        if (!result) return;
        try {
            await navigator.clipboard.writeText(result.markdown);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = result.markdown;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        setCopied(true);
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopied(false), 1800);
    };

    const handleDownloadMd = () => {
        if (!result) return;
        const blob = new Blob([result.markdown], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (result.originalName || 'dokumen').replace(/\.[^.]+$/, '') + '.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleSave = async (target) => {
        if (!result || saving) return;
        setSaving(target);
        setSavedMsg('');
        try {
            const res = await fetch(`${API_URL}/anydoc/convert/${target}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    title: (result.originalName || '').replace(/\.[^.]+$/, ''),
                    originalName: result.originalName,
                    markdown: result.markdown,
                    formatLabel: result.formatLabel,
                }),
            });
            const raw = await res.text();
            let j = {};
            try { j = JSON.parse(raw); } catch { /* non-JSON */ }
            if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
            setSavedMsg(target === 'archive' ? '✅ Tersimpan ke arsip dokumen' : '✅ Dikirim ke AI Training (RAG)');
        } catch (e) {
            setError(e.message || `Gagal ${target === 'archive' ? 'menyimpan ke arsip' : 'mengirim ke training'}.`);
        } finally {
            setSaving(null);
        }
    };

    const resetAll = () => {
        setFile(null);
        setResult(null);
        setError(null);
        setSavedMsg('');
        if (inputRef.current) inputRef.current.value = '';
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
                <div>
                    <div className="flex items-center gap-2.5 mb-1">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <FileCode2 size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className={`text-xl font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>AnyDoc Converter</h1>
                            <p className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-slate-400'}`}>
                                Konversi dokumen apa pun menjadi Markdown bersih — didukung mesin Rust Firecrawl
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Mesin aktif
                        </span>
                        <span className={`text-[10px] ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>≈ 5 ms rata-rata per dokumen</span>
                    </div>
                </div>
                <button
                    onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadHistory(); }}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${isDarkMode
                        ? 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                        : 'bg-white/70 backdrop-blur-xl border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'}`}
                >
                    <History size={15} /> Riwayat ({history.length})
                </button>
            </div>

            {/* ── Ringkasan ── */}
            <SummaryRow className="mb-5" cards={[
                { title: 'Format Didukung', value: SUPPORTED_FORMATS.length, icon: FileText, gradient: 'from-indigo-500 to-purple-600' },
                { title: 'Riwayat Konversi', value: history.length, icon: History, gradient: 'from-emerald-500 to-teal-600' },
                { title: 'Mode Aktif', value: mode === 'convert' ? 'Konversi' : 'Ekstrak', icon: mode === 'convert' ? FileCode2 : FileSpreadsheet, gradient: mode === 'convert' ? 'from-amber-500 to-orange-600' : 'from-teal-500 to-emerald-600', valueClass: 'text-base' },
                { title: 'File Siap Ekstrak', value: extractFiles.length, icon: ListChecks, gradient: 'from-cyan-500 to-blue-600' },
            ]} />

            {/* Mode toggle */}
            <div className={`inline-flex p-1 rounded-xl border gap-1 mb-5 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/70 backdrop-blur-xl border-slate-200 shadow-sm'}`}>
                <button
                    onClick={() => setMode('convert')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'convert'
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-700 text-white shadow-md shadow-indigo-500/25'
                        : isDarkMode ? 'text-white/50 hover:text-white/90 hover:bg-white/5' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                >
                    <FileCode2 size={14} /> Konversi Markdown
                </button>
                <button
                    onClick={() => setMode('extract')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'extract'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-500/25'
                        : isDarkMode ? 'text-white/50 hover:text-white/90 hover:bg-white/5' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                >
                    <FileSpreadsheet size={14} /> Ekstrak Data → Excel
                </button>
            </div>

            {/* History drawer */}
            {showHistory && (
                <div className={`overflow-hidden mb-4 rounded-2xl border p-4 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/70 backdrop-blur-xl border-slate-200 shadow-sm'}`}>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>Hasil Konversi Terbaru</h3>
                        <button onClick={() => setShowHistory(false)} className={`p-1 rounded-lg ${isDarkMode ? 'hover:bg-white/10 text-white/50' : 'hover:bg-slate-100 text-slate-400'}`}><X size={15} /></button>
                    </div>
                    {history.length === 0 ? (
                        <p className={`text-xs text-center py-4 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Belum ada hasil konversi.</p>
                    ) : (
                        <div className="grid gap-2 md:grid-cols-2">
                            {history.map((h, i) => (
                                <a key={i} href={h.url} target="_blank" rel="noreferrer"
                                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:scale-[1.01] ${isDarkMode ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
                                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0`}>
                                        <FileText size={14} className="text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-xs font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>{h.name}</p>
                                        <p className={`text-[10px] flex items-center gap-1 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                                            <Clock size={9} /> {formatRelativeTime(h.modifiedAt)} • {formatFileSize(h.size)}
                                            {h.created_by ? ` • oleh ${h.created_by}` : ''}
                                        </p>
                                    </div>
                                    <Download size={14} className={`flex-shrink-0 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`} />
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Error banner */}
            {error && (
                <div className={`mb-4 flex items-start gap-2.5 p-3.5 rounded-xl border text-sm ${isDarkMode ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-600'}`}>
                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                    <div className="flex-1">{error}</div>
                    <button onClick={() => setError(null)} className="opacity-60 hover:opacity-100"><X size={14} /></button>
                </div>
            )}

            {/* Success message */}
            {savedMsg && (
                <div className={`mb-4 flex items-center gap-2 p-3.5 rounded-xl border text-sm ${isDarkMode ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
                    <CheckCircle2 size={16} /> {savedMsg}
                    <button onClick={() => setSavedMsg('')} className="ml-auto opacity-60 hover:opacity-100"><X size={14} /></button>
                </div>
            )}

            {mode === 'convert' && (
            <div className="grid lg:grid-cols-2 gap-6 items-start">
                {/* LEFT: Upload */}
                <div className="space-y-4">
                    {/* Dropzone */}
                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files?.[0]); }}
                        onClick={() => inputRef.current?.click()}
                        className={`relative rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all group ${dragOver
                            ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
                            : isDarkMode
                                ? 'border-white/15 bg-white/5 hover:border-indigo-500/50 hover:bg-white/8'
                                : 'border-slate-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/40 shadow-sm'}`}
                    >
                        <input
                            ref={inputRef}
                            type="file"
                            accept=".doc,.docx,.docm,.ppt,.pptx,.pps,.pot,.xls,.xlsx,.xlsm,.xlsb,.odt,.ods,.odp,.rtf,.epub,.csv,.pdf,.md,.txt"
                            className="hidden"
                            onChange={(e) => handleFileSelect(e.target.files?.[0])}
                        />
                        <div
                            style={{ transform: dragOver ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.2s' }}
                            className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/30 mb-4`}
                        >
                            <UploadCloud size={28} className="text-white" />
                        </div>
                        <p className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>
                            {file ? file.name : 'Seret & lepas dokumen di sini'}
                        </p>
                        <p className={`text-xs mt-1 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                            {file ? `${formatFileSize(file.size)} • klik untuk ganti` : 'atau klik untuk memilih file (maks 50 MB)'}
                        </p>
                        {file && (
                            <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${isDarkMode ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-600'}`}>
                                <FileText size={13} /> {file.name.split('.').pop().toUpperCase()}
                            </div>
                        )}
                    </div>

                    {/* Convert button */}
                    <button
                        onClick={handleConvert}
                        disabled={!file || converting}
                        className={`w-full py-3.5 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all ${!file || converting
                            ? isDarkMode ? 'bg-white/5 text-white/30 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-indigo-600 to-purple-700 text-white shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-[1.01] active:scale-[0.99]'}`}
                    >
                        {converting ? <><Loader2 size={17} className="animate-spin" /> Mengonversi...</> : <><Sparkles size={17} /> Konversi ke Markdown</>}
                    </button>

                    {/* Supported formats */}
                    <div className={`rounded-2xl border p-4 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/70 backdrop-blur-xl border-slate-200 shadow-sm'}`}>
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Format Didukung</p>
                        <div className="grid grid-cols-2 gap-2">
                            {SUPPORTED_FORMATS.map((f, i) => (
                                <div key={i} className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                                    <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${f.colors} flex items-center justify-center text-sm flex-shrink-0`}>{f.icon}</div>
                                    <div className="min-w-0">
                                        <p className={`text-xs font-bold ${isDarkMode ? 'text-white/80' : 'text-slate-700'}`}>{f.ext}</p>
                                        <p className={`text-[9px] truncate ${isDarkMode ? 'text-white/35' : 'text-slate-400'}`}>{f.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* RIGHT: Result */}
                <div className="space-y-4">
                    {!result ? (
                        <div className={`rounded-2xl border-2 border-dashed p-10 text-center min-h-[300px] flex flex-col items-center justify-center ${isDarkMode ? 'border-white/10 bg-white/2' : 'border-slate-200 bg-white/50'}`}>
                            <div className={`text-5xl mb-4 ${isDarkMode ? 'opacity-30' : 'opacity-20'}`}>📄 → ✨</div>
                            <p className={`text-sm font-bold ${isDarkMode ? 'text-white/60' : 'text-slate-500'}`}>Hasil Markdown akan tampil di sini</p>
                            <p className={`text-xs mt-1 max-w-xs ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>
                                Upload dokumen di sisi kiri, lalu klik Konversi. Heading, tabel, daftar, dan format lain akan dipertahankan.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Result meta */}
                            <div className={`rounded-2xl border p-4 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/70 backdrop-blur-xl border-slate-200 shadow-sm'}`}>
                                <div className="flex items-center gap-3 flex-wrap">
                                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0`}>
                                        <FileText size={16} className="text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>{result.originalName}</p>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${isDarkMode ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-600'}`}>{result.formatLabel}</span>
                                            <span className={`text-[10px] ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>{result.charCount} karakter • {result.lineCount} baris</span>
                                        </div>
                                    </div>
                                    <button onClick={resetAll} className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-white/10 text-white/40' : 'hover:bg-slate-100 text-slate-400'}`} title="Reset">
                                        <Trash2 size={15} />
                                    </button>
                                </div>

                                {/* Action buttons */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                                    <button onClick={handleCopy}
                                        className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-all border ${isDarkMode
                                            ? 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                                            : 'bg-white/70 backdrop-blur-xl border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                        {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />} {copied ? 'Tersalin' : 'Salin'}
                                    </button>
                                    <button onClick={handleDownloadMd}
                                        className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-all border ${isDarkMode
                                            ? 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                                            : 'bg-white/70 backdrop-blur-xl border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                        <Download size={13} /> Unduh .md
                                    </button>
                                    <button onClick={() => handleSave('archive')} disabled={!!saving}
                                        className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-all border ${isDarkMode
                                            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/20'
                                            : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'}`}>
                                        {saving === 'archive' ? <Loader2 size={13} className="animate-spin" /> : <Archive size={13} />} Arsip
                                    </button>
                                    <button onClick={() => handleSave('train')} disabled={!!saving}
                                        className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-all border ${isDarkMode
                                            ? 'bg-purple-500/10 border-purple-500/25 text-purple-300 hover:bg-purple-500/20'
                                            : 'bg-purple-50 border-purple-200 text-purple-600 hover:bg-purple-100'}`}>
                                        {saving === 'train' ? <Loader2 size={13} className="animate-spin" /> : <Brain size={13} />} AI Training
                                    </button>
                                </div>
                            </div>

                            {/* Markdown preview */}
                            <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/70 backdrop-blur-xl border-slate-200 shadow-sm'}`}>
                                <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
                                    <div className="flex gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ml-2 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                                        <Eye size={11} /> Preview Markdown
                                    </span>
                                </div>
                                <div className="p-4 max-h-[420px] overflow-y-auto">
                                    <SimpleMarkdown content={result.markdown} isDarkMode={isDarkMode} />
                                </div>
                            </div>

                            {/* Raw toggle */}
                            <details className={`rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/70 backdrop-blur-xl border-slate-200'}`}>
                                <summary className={`px-4 py-2.5 text-[11px] font-bold cursor-pointer select-none flex items-center gap-1.5 ${isDarkMode ? 'text-white/50 hover:text-white/80' : 'text-slate-400 hover:text-slate-600'}`}>
                                    <FileCode2 size={13} /> Lihat kode Markdown mentah
                                </summary>
                                <pre className={`p-4 text-xs font-mono overflow-x-auto border-t ${isDarkMode ? 'bg-black/30 border-white/10 text-emerald-300/90' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                                    {result.markdown}
                                </pre>
                            </details>
                        </>
                    )}
                </div>
            </div>
            )}

            {/* ── MODE: EKSTRAK DATA → EXCEL ── */}
            {mode === 'extract' && (
                <>
                    {extractError && (
                        <div className={`mb-4 flex items-start gap-2.5 p-3.5 rounded-xl border text-sm ${isDarkMode ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-600'}`}>
                            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                            <div className="flex-1">{extractError}</div>
                            <button onClick={() => setExtractError(null)} className="opacity-60 hover:opacity-100"><X size={14} /></button>
                        </div>
                    )}

                    <div className="grid lg:grid-cols-2 gap-6 items-start">
                        {/* LEFT: Upload + mapping */}
                        <div className="space-y-4">
                            <div
                                onDragOver={(e) => { e.preventDefault(); setDragOver2(true); }}
                                onDragLeave={() => setDragOver2(false)}
                                onDrop={(e) => { e.preventDefault(); setDragOver2(false); addExtractFiles(e.dataTransfer.files); }}
                                onClick={() => extractInputRef.current?.click()}
                                className={`relative rounded-2xl border-2 border-dashed p-7 text-center cursor-pointer transition-all ${dragOver2
                                    ? 'border-emerald-500 bg-emerald-500/10 scale-[1.01]'
                                    : isDarkMode
                                        ? 'border-white/15 bg-white/5 hover:border-emerald-500/50 hover:bg-white/8'
                                        : 'border-slate-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/40 shadow-sm'}`}
                            >
                                <input
                                    ref={extractInputRef}
                                    type="file"
                                    multiple
                                    accept=".pdf,.docx,.txt"
                                    className="hidden"
                                    onChange={(e) => { addExtractFiles(e.target.files); e.target.value = ''; }}
                                />
                                <div
                                    style={{ transform: dragOver2 ? 'scale(1.08)' : 'scale(1)', transition: 'transform 0.2s' }}
                                    className={`w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl shadow-emerald-500/30 mb-3`}
                                >
                                    <FileSpreadsheet size={24} className="text-white" />
                                </div>
                                <p className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>
                                    Seret & lepas banyak PDF di sini
                                </p>
                                <p className={`text-xs mt-1 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                                    atau klik untuk memilih file — PDF / DOCX / TXT, maks 20 file sekaligus
                                </p>
                                {extractFiles.length > 0 && (
                                    <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${isDarkMode ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-600'}`}>
                                        <ListChecks size={13} /> {extractFiles.length} file siap diekstrak
                                    </div>
                                )}
                            </div>

                            {extractFiles.length > 0 && (
                                <div className={`rounded-2xl border p-3 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/70 backdrop-blur-xl border-slate-200 shadow-sm'}`}>
                                    <div className="space-y-1.5">
                                        {extractFiles.map((f, i) => (
                                            <div key={i} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                                                <FileText size={13} className={`flex-shrink-0 ${isDarkMode ? 'text-emerald-300' : 'text-emerald-600'}`} />
                                                <span className={`flex-1 min-w-0 truncate text-xs font-semibold ${isDarkMode ? 'text-white/80' : 'text-slate-700'}`}>{f.name}</span>
                                                <span className={`text-[10px] flex-shrink-0 ${isDarkMode ? 'text-white/35' : 'text-slate-400'}`}>{formatFileSize(f.size)}</span>
                                                <button onClick={() => removeExtractFile(i)} className={`p-1 rounded-md flex-shrink-0 ${isDarkMode ? 'hover:bg-white/10 text-white/40' : 'hover:bg-slate-200 text-slate-400'}`} title="Hapus"><X size={12} /></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className={`rounded-2xl border p-4 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/70 backdrop-blur-xl border-slate-200 shadow-sm'}`}>
                                <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Mapping Kolom</p>
                                <p className={`text-[11px] font-bold mb-1.5 flex items-center gap-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-600'}`}>
                                    <Table2 size={12} /> Kolom Data Nota (1 baris per PDF)
                                </p>
                                <ChipEditor items={fields} onChange={setFields} placeholder="Tambah kolom, mis. No. Surat Jalan" isDarkMode={isDarkMode} />
                                <p className={`text-[11px] font-bold mb-1.5 mt-4 flex items-center gap-1 ${isDarkMode ? 'text-emerald-300' : 'text-emerald-600'}`}>
                                    <ListChecks size={12} /> Kolom Item Barang (detail per baris)
                                </p>
                                <ChipEditor items={itemFields} onChange={setItemFields} placeholder="Tambah kolom item, mis. Kode" isDarkMode={isDarkMode} accent="emerald" />
                                <p className={`text-[10px] mt-3 leading-relaxed ${isDarkMode ? 'text-white/35' : 'text-slate-400'}`}>
                                    AI membaca <b>semua halaman</b> setiap PDF (1, 2, atau lebih) lalu mengisi kolom di atas.
                                    Nominal otomatis dibersihkan (simbol Rp & pemisah ribuan dihapus). Hasil bisa dikoreksi manual sebelum diunduh.
                                    Estimasi ±6 detik per file, maks 20 file per proses.
                                </p>
                            </div>

                            <button
                                onClick={handleExtract}
                                disabled={!extractFiles.length || extracting || !fields.length}
                                title={!fields.length ? 'Tambahkan minimal 1 kolom data nota' : ''}
                                className={`w-full py-3.5 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all ${!extractFiles.length || extracting || !fields.length
                                    ? isDarkMode ? 'bg-white/5 text-white/30 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-[1.01] active:scale-[0.99]'}`}
                            >
                                {extracting ? <><Loader2 size={17} className="animate-spin" /> Mengekstrak {extractFiles.length} file...</> : <><Sparkles size={17} /> Ekstrak Data → Excel</>}
                            </button>
                        </div>

                        {/* RIGHT: Hasil */}
                        <div className="space-y-4">
                            {results.length === 0 ? (
                                <div className={`rounded-2xl border-2 border-dashed p-10 text-center min-h-[300px] flex flex-col items-center justify-center ${isDarkMode ? 'border-white/10 bg-white/2' : 'border-slate-200 bg-white/50'}`}>
                                    <div className={`text-5xl mb-4 ${isDarkMode ? 'opacity-30' : 'opacity-20'}`}>📊 → 📑</div>
                                    <p className={`text-sm font-bold ${isDarkMode ? 'text-white/60' : 'text-slate-500'}`}>Hasil ekstraksi akan tampil di sini</p>
                                    <p className={`text-xs mt-1 max-w-xs ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>
                                        Upload PDF di sisi kiri, atur kolom sesuai keinginan, lalu klik Ekstrak. Setiap PDF jadi 1 baris Excel + detail item di sheet terpisah.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {(() => {
                                        const ok = results.filter(r => r.success).length;
                                        const fail = results.length - ok;
                                        return (
                                            <div className={`rounded-2xl border p-4 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/70 backdrop-blur-xl border-slate-200 shadow-sm'}`}>
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0`}>
                                                        <FileSpreadsheet size={16} className="text-white" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>Hasil Ekstraksi</p>
                                                        <p className={`text-[11px] mt-0.5 flex items-center gap-2 flex-wrap ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-bold text-[10px] ${isDarkMode ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-600'}`}>
                                                                <CheckCircle2 size={10} /> {ok} berhasil
                                                            </span>
                                                            {fail > 0 && (
                                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-bold text-[10px] ${isDarkMode ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-50 text-rose-600'}`}>
                                                                    <AlertCircle size={10} /> {fail} gagal
                                                                </span>
                                                            )}
                                                            <span>Klik sel untuk mengoreksi sebelum diunduh.</span>
                                                        </p>
                                                    </div>
                                                    {ok > 0 && (
                                                        <button
                                                            onClick={handleDownloadExcel}
                                                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all border ${isDarkMode
                                                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                                                                : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'}`}
                                                        >
                                                            <Download size={13} /> Unduh Excel
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/70 backdrop-blur-xl border-slate-200 shadow-sm'}`}>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs">
                                                <thead>
                                                    <tr className={`border-b ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
                                                        <th className={`px-3 py-2.5 text-[10px] font-black uppercase tracking-wider sticky left-0 ${isDarkMode ? 'bg-[#161a2e] text-white/40' : 'bg-white text-slate-400'}`}>File</th>
                                                        {fields.map((f, i) => (
                                                            <th key={i} className={`px-3 py-2.5 text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>{f}</th>
                                                        ))}
                                                        <th className={`px-3 py-2.5 text-[10px] font-black uppercase tracking-wider ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {results.map((r, ri) => (
                                                        <React.Fragment key={ri}>
                                                            <tr className={`border-b ${isDarkMode ? 'border-white/5' : 'border-slate-50'}`}>
                                                                <td className={`px-3 py-2 text-[11px] font-bold max-w-[220px] truncate sticky left-0 ${isDarkMode ? 'bg-[#161a2e] text-white/80' : 'bg-white text-slate-700'}`} title={r.filename}>{r.filename}</td>
                                                                {fields.map((f, ci) => (
                                                                    <td key={ci} className="px-1.5 py-1.5 min-w-[110px]">
                                                                        {r.success ? (
                                                                            <input
                                                                                value={r.data?.[f] ?? ''}
                                                                                onChange={e => updateCell(ri, f, e.target.value)}
                                                                                className={`w-full px-2 py-1 rounded-lg text-[11px] border outline-none transition-colors ${isDarkMode
                                                                                    ? 'bg-white/5 border-white/10 text-white focus:border-emerald-500/60'
                                                                                    : 'bg-white/70 backdrop-blur-xl border-slate-200 text-slate-700 focus:border-emerald-400'}`}
                                                                            />
                                                                        ) : (
                                                                            <span className={`text-[11px] ${isDarkMode ? 'text-white/20' : 'text-slate-300'}`}>—</span>
                                                                        )}
                                                                    </td>
                                                                ))}
                                                                <td className="px-3 py-2">
                                                                    {r.success ? (
                                                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-bold text-[10px] ${isDarkMode ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-600'}`}><CheckCircle2 size={10} /> OK</span>
                                                                    ) : (
                                                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-bold text-[10px] ${isDarkMode ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-50 text-rose-600'}`} title={r.error}><AlertCircle size={10} /> Gagal</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                            {r.success && (
                                                                <tr className={`border-b ${isDarkMode ? 'border-white/5' : 'border-slate-50'}`}>
                                                                    <td colSpan={fields.length + 2} className="p-0">
                                                                        <button
                                                                            onClick={() => setExpanded(prev => ({ ...prev, [ri]: !prev[ri] }))}
                                                                            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold transition-colors ${isDarkMode ? 'text-emerald-300/80 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}
                                                                        >
                                                                            {expanded[ri] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                                            Item barang ({r.items?.length || 0})
                                                                        </button>
                                                                        {expanded[ri] && (
                                                                            <div className="px-3 pb-3 overflow-x-auto">
                                                                                <table className={`w-full text-left text-[11px] rounded-lg overflow-hidden border ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
                                                                                    <thead>
                                                                                        <tr className={isDarkMode ? 'bg-white/5' : 'bg-slate-50'}>
                                                                                            <th className={`px-2.5 py-1.5 text-[10px] font-black uppercase ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>No</th>
                                                                                            {itemFields.map((f, ci) => (
                                                                                                <th key={ci} className={`px-2.5 py-1.5 text-[10px] font-black uppercase whitespace-nowrap ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>{f}</th>
                                                                                            ))}
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody>
                                                                                        {(r.items || []).map((it, ii) => (
                                                                                            <tr key={ii} className={`border-t ${isDarkMode ? 'border-white/5' : 'border-slate-50'}`}>
                                                                                                <td className={`px-2.5 py-1.5 ${isDarkMode ? 'text-white/50' : 'text-slate-400'}`}>{ii + 1}</td>
                                                                                                {itemFields.map((f, ci) => (
                                                                                                    <td key={ci} className="px-1.5 py-1 min-w-[100px]">
                                                                                                        <input
                                                                                                            value={it?.[f] ?? ''}
                                                                                                            onChange={e => updateItemCell(ri, ii, f, e.target.value)}
                                                                                                            className={`w-full px-2 py-1 rounded-md text-[11px] border outline-none transition-colors ${isDarkMode
                                                                                                                ? 'bg-white/5 border-white/10 text-white focus:border-emerald-500/60'
                                                                                                                : 'bg-white/70 backdrop-blur-xl border-slate-200 text-slate-700 focus:border-emerald-400'}`}
                                                                                                        />
                                                                                                    </td>
                                                                                                ))}
                                                                                            </tr>
                                                                                        ))}
                                                                                        {(r.items || []).length === 0 && (
                                                                                            <tr className={`border-t ${isDarkMode ? 'border-white/5' : 'border-slate-50'}`}>
                                                                                                <td colSpan={itemFields.length + 1} className={`px-2.5 py-2 ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>Tidak ada item barang di dokumen ini.</td>
                                                                                            </tr>
                                                                                        )}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            )}
                                                            {!r.success && (
                                                                <tr className={`border-b ${isDarkMode ? 'border-white/5' : 'border-slate-50'}`}>
                                                                    <td colSpan={fields.length + 2} className={`px-3 py-2 text-[11px] ${isDarkMode ? 'text-rose-300/80' : 'text-rose-500'}`}>{r.error}</td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
