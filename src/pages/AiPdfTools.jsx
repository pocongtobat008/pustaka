import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SummaryCard } from '../components/ui/Card';
import {
    FileText, FileArchive, Scissors, LockOpen, ScanText, RotateCw, Eye,
    UploadCloud, Download, Loader2, X, AlertCircle, Layers,
    FileDown, Wand2, Sparkles, History, Trash2, RefreshCw, ChevronDown, Lock, Share2,
} from 'lucide-react';

const getApiUrl = () => (window.location.protocol === 'file:' ? 'http://localhost:5005/api' : '/api');
const API_URL = getApiUrl();

const formatFileSize = (b) => {
    if (!b && b !== 0) return '-';
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1024 / 1024).toFixed(2) + ' MB';
};

const compressPct = (row) => {
    if (!row.original_size || !row.file_size || row.file_size >= row.original_size) return null;
    return (1 - row.file_size / row.original_size) * 100;
};

// ── Definisi 6 tool ──
const TOOLS = [
    {
        id: 'convert', label: 'PDF → Word', icon: FileText, gradient: 'from-indigo-500 to-blue-600', shadow: 'shadow-indigo-500/25',
        desc: 'Konversi PDF ke DOCX dengan tata letak asli (teks, tabel, gambar)',
        multiple: false, fields: [],
    },
    {
        id: 'compress', label: 'Kompres PDF', icon: FileArchive, gradient: 'from-emerald-500 to-green-600', shadow: 'shadow-emerald-500/25',
        desc: 'Perkecil ukuran file PDF — 3 tingkat kualitas',
        multiple: false, fields: [{ key: 'quality', label: 'Kualitas', type: 'select', options: ['low', 'medium', 'high'] }],
    },
    {
        id: 'merge', label: 'Gabung PDF', icon: Layers, gradient: 'from-purple-500 to-violet-600', shadow: 'shadow-purple-500/25',
        desc: 'Gabungkan banyak PDF menjadi satu dokumen',
        multiple: true, fields: [],
    },
    {
        id: 'split', label: 'Pecah PDF', icon: Scissors, gradient: 'from-amber-500 to-orange-600', shadow: 'shadow-amber-500/25',
        desc: 'Pisahkan halaman per file atau rentang tertentu (hasil: ZIP)',
        multiple: false, fields: [
            { key: 'mode', label: 'Mode', type: 'select', options: ['all', 'pages'] },
            { key: 'pages', label: 'Halaman (mode Pages, mis. 1-3,5)', type: 'text', showWhen: { key: 'mode', value: 'pages' } },
        ],
    },
    {
        id: 'unlock', label: 'Buka Proteksi', icon: LockOpen, gradient: 'from-rose-500 to-pink-600', shadow: 'shadow-rose-500/25',
        desc: 'Hapus kata sandi / proteksi dari PDF terenkripsi',
        multiple: false, fields: [{ key: 'password', label: 'Kata sandi (opsional)', type: 'password' }],
    },
    {
        id: 'ocr', label: 'OCR Teks', icon: ScanText, gradient: 'from-cyan-500 to-teal-600', shadow: 'shadow-cyan-500/25',
        desc: 'Ekstrak teks dari PDF hasil scan/gambar — 120+ bahasa didukung',
        multiple: false, fields: [{ key: 'language', label: 'Bahasa', type: 'select', options: [] }], // options dinamis dari /pdf-tools/languages
    },
];

const ToolCard = ({ tool, active, onClick, isDarkMode }) => {
    const Icon = tool.icon;
    return (
        <button
            onClick={onClick}
            className={`group flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-left transition-all ${active
                ? (isDarkMode ? 'bg-white/10 border-white/20' : 'bg-white/70 backdrop-blur-xl border-slate-200 shadow-md')
                : (isDarkMode ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white/50 border-slate-200/70 hover:bg-white hover:shadow-sm')}`}
        >
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center flex-shrink-0 shadow-lg ${tool.shadow}`}>
                <Icon size={18} className="text-white" />
            </div>
            <div className="min-w-0">
                <p className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>{tool.label}</p>
                <p className={`text-[9px] truncate mt-0.5 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>{tool.desc}</p>
            </div>
        </button>
    );
};

export default function AiPdfTools({ isDarkMode, currentUser }) {
    const [activeTool, setActiveTool] = useState('convert');
    const [files, setFiles] = useState([]);
    const [form, setForm] = useState({ quality: 'medium', mode: 'all', pages: '', language: 'eng', password: '', autoRotate: true, perPage: false });
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null); // { type: 'file'|'json', ... }
    const [error, setError] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const [serviceOk, setServiceOk] = useState(true);
    const [ocrLangs, setOcrLangs] = useState([]); // [{ code, name, installed }]
    const [ocrLangsLoading, setOcrLangsLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [historyBusy, setHistoryBusy] = useState(false);
    const [delHistTarget, setDelHistTarget] = useState(null);
    const [delHistBusy, setDelHistBusy] = useState(false);
    const [viewTextTarget, setViewTextTarget] = useState(null); // baris riwayat OCR yang teksnya dilihat
    const inputRef = useRef(null);
    // ── Berbagi lintas departemen ──
    const [departments, setDepartments] = useState([]);
    const [shareTarget, setShareTarget] = useState(null); // baris riwayat yang dibagikan
    const [shareDepts, setShareDepts] = useState([]);
    const [shareBusy, setShareBusy] = useState(false);

    const loadHistory = useCallback(async () => {
        setHistoryBusy(true);
        try {
            const res = await fetch(`${API_URL}/pdf-tools/history`, { credentials: 'include' });
            if (res.ok) setHistory(await res.json());
        } catch { /* ignore */ }
        finally { setHistoryBusy(false); }
    }, []);

    // Muat daftar departemen (untuk berbagi lintas departemen)
    useEffect(() => {
        fetch(`${API_URL}/departments`, { credentials: 'include' })
            .then(r => r.json())
            .then(d => setDepartments(Array.isArray(d) ? d : (d?.departments || [])))
            .catch(() => { /* ignore */ });
    }, []);

    // Helper privasi/berbagi
    const isAdminUser = !!currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin');
    const sharedDeptsOf = (row) => {
        const v = row?.shared_departments;
        if (Array.isArray(v)) return v;
        if (!v) return [];
        try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch { return []; }
    };
    const canManageHist = (row) => isAdminUser || (row?.created_by && (row.created_by === currentUser?.username || row.created_by === currentUser?.name));

    const openShare = (row) => {
        setShareTarget(row);
        setShareDepts(sharedDeptsOf(row));
    };

    const saveShare = async () => {
        if (!shareTarget) return;
        setShareBusy(true);
        try {
            const res = await fetch(`${API_URL}/pdf-tools/history/${shareTarget.id}/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ departments: shareDepts }),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Gagal menyimpan berbagi.');
            setHistory(prev => prev.map(x => Number(x.id) === Number(shareTarget.id)
                ? { ...x, shared_departments: j.shared_departments?.length ? JSON.stringify(j.shared_departments) : null }
                : x));
            setShareTarget(null);
        } catch (e) { setError(e.message || 'Gagal menyimpan berbagi.'); }
        finally { setShareBusy(false); }
    };

    useEffect(() => { loadHistory(); }, [loadHistory]);

    const downloadHistFile = async (row) => {
        try {
            const res = await fetch(row.downloadUrl, { credentials: 'include' });
            if (!res.ok) throw new Error('Gagal mengunduh.');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = row.file_name || 'hasil';
            document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
        } catch (e) { setError(e.message || 'Gagal mengunduh.'); }
    };

    const confirmDeleteHist = async () => {
        if (!delHistTarget) return;
        setDelHistBusy(true);
        try {
            const res = await fetch(`${API_URL}/pdf-tools/history/${delHistTarget.id}`, { method: 'DELETE', credentials: 'include' });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Gagal menghapus.');
            setHistory(prev => prev.filter(h => h.id !== delHistTarget.id));
            setDelHistTarget(null);
        } catch (e) { setError(e.message || 'Gagal menghapus.'); }
        finally { setDelHistBusy(false); }
    };

    const TOOL_LABEL = { convert: 'PDF → Word', compress: 'Kompres', merge: 'Gabung', split: 'Pecah', unlock: 'Buka Proteksi', ocr: 'OCR Teks' };
    const saveToHistory = async (blob, filename, origSize) => {
        try {
            const fd = new FormData();
            fd.append('file', blob, filename);
            fd.append('tool', tool.id);
            fd.append('title', filename);
            if (origSize) fd.append('originalSize', String(origSize));
            await fetch(`${API_URL}/pdf-tools/history`, { method: 'POST', credentials: 'include', body: fd });
            loadHistory();
        } catch { /* best-effort — unduhan lokal tetap jalan */ }
    };

    // Simpan hasil OCR Teks ke riwayat (teks + bahasa + orientasi)
    const saveToHistoryOcr = async (data) => {
        try {
            const fd = new FormData();
            fd.append('tool', 'ocr');
            fd.append('title', files[0]?.name || 'Hasil OCR Teks');
            fd.append('text_content', data.text || '');
            fd.append('language', data.language || '');
            fd.append('language_name', data.language_name || '');
            if (data.orientation?.detected) fd.append('orientation', `${data.orientation.degrees}°`);
            await fetch(`${API_URL}/pdf-tools/history`, { method: 'POST', credentials: 'include', body: fd });
            loadHistory();
        } catch { /* best-effort */ }
    };

    const tool = TOOLS.find(t => t.id === activeTool);

    // Cek status service Flask saat halaman dibuka + polling tiap 30 detik
    useEffect(() => {
        let alive = true;
        const check = () => {
            fetch(`${API_URL}/pdf-tools/health`, { credentials: 'include' })
                .then(r => r.json())
                .then(j => { if (alive) setServiceOk(!!j.ok); })
                .catch(() => { if (alive) setServiceOk(false); });
        };
        check();
        const t = setInterval(check, 30000);
        return () => { alive = false; clearInterval(t); };
    }, []);

    // Muat daftar bahasa OCR saat tool OCR dipilih
    useEffect(() => {
        if (activeTool !== 'ocr') return;
        setOcrLangsLoading(true);
        fetch(`${API_URL}/pdf-tools/languages`, { credentials: 'include' })
            .then(r => r.json())
            .then(j => {
                const arr = Array.isArray(j?.all) ? j.all : [];
                setOcrLangs(arr);
                // Pastikan bahasa yang dipilih valid; default 'eng' jika ada
                if (arr.length && form.language !== 'auto' && !arr.some(l => l.code === form.language)) {
                    const def = arr.find(l => l.code === 'eng') || arr[0];
                    setForm(f => ({ ...f, language: def.code }));
                }
            })
            .catch(() => { /* ignore */ })
            .finally(() => setOcrLangsLoading(false));
    }, [activeTool]); // eslint-disable-line react-hooks/exhaustive-deps

    const reset = () => { setResult(null); setError(''); setFiles([]); };

    const switchTool = (id) => { setActiveTool(id); reset(); };

    const onFiles = (list) => {
        const t = TOOLS.find(x => x.id === activeTool);
        const pdfs = [...list].filter(f => /\.pdf$/i.test(f.name));
        if (!pdfs.length) { setError('Pilih file PDF (ekstensi .pdf).'); return; }
        setError('');
        setResult(null);
        setFiles(t.multiple ? [...files, ...pdfs] : pdfs.slice(0, 1));
    };

    const removeFile = (i) => setFiles(prev => prev.filter((_, x) => x !== i));

    const downloadBlob = (blob, filename) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
    };

    const run = async () => {
        if (!files.length) { setError('Unggah file PDF dulu.'); return; }
        if (tool.id === 'merge' && files.length < 2) { setError('Gabung PDF butuh minimal 2 file.'); return; }
        if (tool.id === 'ocr' && !form.language) { setError('Bahasa OCR belum tersedia — muat ulang halaman atau hubungi admin.'); return; }
        setBusy(true); setError(''); setResult(null);
        try {
            const fd = new FormData();
            if (tool.multiple) files.forEach(f => fd.append('files', f));
            else fd.append('file', files[0]);
            Object.entries(form).forEach(([k, v]) => { if (v && k !== 'autoRotate' && k !== 'perPage') fd.append(k, v); });
            if (tool.id === 'ocr') {
                fd.append('auto_rotate', form.autoRotate ? 'true' : 'false');
                fd.append('per_page', form.perPage ? 'true' : 'false');
            }

            const res = await fetch(`${API_URL}/pdf-tools/${tool.id}`, { method: 'POST', credentials: 'include', body: fd });
            const contentType = res.headers.get('content-type') || '';
            const cd = res.headers.get('content-disposition') || '';
            const filename = (cd.match(/filename="?([^"]+)"?/i) || [])[1] || `hasil_${tool.id}`;

            if (!res.ok) {
                let msg = `Gagal (${res.status}).`;
                try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
                throw new Error(msg);
            }

            if (contentType.includes('application/json')) {
                const j = await res.json();
                setResult({ type: 'json', data: j, tool: tool.id });
                if (tool.id === 'ocr') saveToHistoryOcr(j); // simpan otomatis agar bisa dilihat/unduh ulang
            } else {
                const blob = await res.blob();
                const origSize = res.headers.get('x-original-size');
                const compSize = res.headers.get('x-compressed-size');
                setResult({
                    type: 'file', blob, filename,
                    tool: tool.id,
                    size: blob.size,
                    origSize: origSize ? Number(origSize) : null,
                    compSize: compSize ? Number(compSize) : null,
                });
                // Simpan ke riwayat (best-effort) agar bisa diunduh ulang tanpa proses ulang
                saveToHistory(blob, filename, origSize ? Number(origSize) : null);
            }
        } catch (e) {
            setError(e.message || 'Terjadi kesalahan.');
        } finally {
            setBusy(false);
        }
    };

    const renderResult = () => {
        if (!result) return null;
        if (result.type === 'json') {
            const d = result.data;
            return (
                <div className={`mt-5 rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/70 backdrop-blur-xl border-slate-200 shadow-sm'}`}>
                    <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
                        <ScanText size={13} className="text-cyan-500" />
                        <span className={`text-[11px] font-black uppercase tracking-wider ${isDarkMode ? 'text-white/60' : 'text-slate-500'}`}>Hasil OCR — {d.page_count || 0} halaman</span>
                        {d.detected && (
                            <span className={`ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${isDarkMode ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300' : 'bg-cyan-50 border-cyan-200 text-cyan-600'}`}>
                                <Sparkles size={10} /> Terdeteksi: {d.detected.name} · keyakinan {Math.min(100, d.detected.confidence)}%
                            </span>
                        )}
                        {!d.detected && d.language_name && (
                            <span className={`ml-2 text-[10px] font-bold ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Bahasa: {d.language_name}</span>
                        )}
                        {d.orientation?.detected && (
                            <span className={`ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${isDarkMode ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
                                <RotateCw size={10} /> Rotasi {d.orientation.degrees}° diperbaiki
                            </span>
                        )}
                        {d.per_page_languages?.length > 0 && (
                            <span className={`ml-2 inline-flex items-center gap-1 flex-wrap text-[10px] font-bold ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                                {d.per_page_languages.map(p => (
                                    <span key={p.page} className={`px-1.5 py-0.5 rounded-md ${isDarkMode ? 'bg-white/10 text-white/60' : 'bg-slate-100 text-slate-500'}`} title={`Halaman ${p.page}`}>
                                        Hal {p.page}: {p.name}
                                    </span>
                                ))}
                            </span>
                        )}
                    </div>
                    <div className="max-h-[320px] overflow-y-auto p-4 space-y-3">
                        {(d.pages || []).map((p, i) => (
                            <div key={i}>
                                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-white/35' : 'text-slate-400'}`}>Halaman {p.page}</p>
                                <pre className={`text-xs whitespace-pre-wrap rounded-xl p-3 ${isDarkMode ? 'bg-black/30 text-white/80' : 'bg-slate-50 text-slate-600'}`}>{p.text || '(kosong)'}</pre>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        // type 'file'
        const saved = (result.origSize && result.compSize) ? ((1 - result.compSize / result.origSize) * 100) : null;
        return (
            <div className={`mt-5 rounded-2xl border p-5 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/70 backdrop-blur-xl border-slate-200 shadow-sm'}`}>
                <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center shadow-lg ${tool.shadow}`}>
                        <FileDown size={20} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>{result.filename}</p>
                        <p className={`text-[10px] mt-0.5 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                            {formatFileSize(result.size)}
                            {saved !== null && saved > 0 && (
                                <span className="ml-2 text-emerald-500 font-bold">−{saved.toFixed(0)}% lebih kecil</span>
                            )}
                        </p>
                    </div>
                    <button
                        onClick={() => downloadBlob(result.blob, result.filename)}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-700 text-white shadow-lg shadow-indigo-500/25 hover:scale-[1.02] transition-all"
                    >
                        <Download size={14} /> Unduh
                    </button>
                </div>
            </div>
        );
    };

    const inputCls = `px-2.5 py-1.5 rounded-lg text-xs border outline-none transition-colors ${isDarkMode ? 'bg-white/5 border-white/10 text-white placeholder-white/30 focus:border-indigo-500/60' : 'bg-white/70 backdrop-blur-xl border-slate-200 text-slate-700 placeholder-slate-300 focus:border-indigo-400'}`;

    return (
        <div className="max-w-[1200px] mx-auto px-4 lg:px-6 py-6">
            {/* Header */}
            <div className="mb-6 flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20 bg-gradient-to-br from-indigo-500 to-purple-600">
                    <Wand2 size={20} className="text-white" />
                </div>
                <div className="flex-1">
                    <h1 className={`text-lg font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                        AI PDF Tools
                    </h1>
                    <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                        Konversi, kompres, gabung, pecah, buka proteksi & OCR — diproses lokal di server, file tidak dikirim ke pihak ketiga.
                    </p>
                </div>
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-bold border ${serviceOk ? (isDarkMode ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-600') : (isDarkMode ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-600')}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${serviceOk ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                    {serviceOk ? 'Service aktif' : 'Service mati'}
                </div>
            </div>

            {!serviceOk && (
                <div className={`mb-5 flex items-start gap-2.5 p-3.5 rounded-xl border text-sm ${isDarkMode ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-600'}`}>
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="font-bold text-xs">Service AI PDF Tools tidak aktif</p>
                        <p className="text-[11px] mt-0.5 opacity-80">Hubungi administrator untuk menjalankan service (pm2 start pdftoword).</p>
                    </div>
                </div>
            )}

            {/* ── Ringkasan ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                <SummaryCard title="Total Tools" value={TOOLS.length} icon={Wand2} gradient="from-indigo-500 to-purple-600" />
                <SummaryCard title="Riwayat Tersimpan" value={history.length} icon={History} gradient="from-emerald-500 to-teal-600" />
                <SummaryCard title="Tool Aktif" value={tool.label} icon={Sparkles} gradient="from-amber-500 to-orange-600" valueClass="text-base" />
                <SummaryCard title="Hasil OCR" value={history.filter(h => h.tool === 'ocr').length} icon={ScanText} gradient="from-cyan-500 to-teal-600" />
            </div>

            {/* Grid: pilihan tool + panel kerja */}
            <div className="grid lg:grid-cols-5 gap-5 items-start">
                {/* Kiri: daftar tool */}
                <div className="lg:col-span-2 space-y-2.5">
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Pilih Tool</p>
                    {TOOLS.map(t => (
                        <ToolCard key={t.id} tool={t} active={activeTool === t.id} onClick={() => switchTool(t.id)} isDarkMode={isDarkMode} />
                    ))}
                </div>

                {/* Kanan: panel kerja */}
                <div className="lg:col-span-3 space-y-4">
                    <div className={`rounded-2xl border p-5 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/70 backdrop-blur-xl border-slate-200 shadow-sm'}`}>
                        <div className="flex items-center gap-2 mb-1">
                            <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center shadow ${tool.shadow}`}>
                                <tool.icon size={15} className="text-white" />
                            </div>
                            <div>
                                <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{tool.label}</p>
                                <p className={`text-[10px] ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>{tool.desc}</p>
                            </div>
                        </div>

                        {/* Dropzone */}
                        <div
                            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={e => { e.preventDefault(); setDragOver(false); onFiles(e.dataTransfer.files); }}
                            onClick={() => inputRef.current?.click()}
                            className={`mt-4 rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${dragOver ? 'border-indigo-500 bg-indigo-500/5' : (isDarkMode ? 'border-white/15 bg-white/5 hover:border-indigo-500/50' : 'border-slate-300 bg-white hover:border-indigo-400')}`}
                        >
                            <input ref={inputRef} type="file" multiple accept=".pdf" className="hidden"
                                onChange={e => { onFiles(e.target.files); e.target.value = ''; }} />
                            <UploadCloud size={26} className={`mx-auto mb-2 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`} />
                            <p className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>
                                {tool.multiple ? 'Pilih / seret banyak PDF' : 'Pilih / seret file PDF'}
                            </p>
                            <p className={`text-[10px] mt-1 ${isDarkMode ? 'text-white/35' : 'text-slate-400'}`}>Maks 50 MB per file</p>
                        </div>

                        {/* File terpilih */}
                        {files.length > 0 && (
                            <div className="mt-3 space-y-1.5">
                                {files.map((f, i) => (
                                    <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                                        <FileText size={13} className={`flex-shrink-0 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-500'}`} />
                                        <span className={`flex-1 min-w-0 truncate text-xs font-semibold ${isDarkMode ? 'text-white/80' : 'text-slate-700'}`}>{f.name}</span>
                                        <span className={`text-[10px] flex-shrink-0 ${isDarkMode ? 'text-white/35' : 'text-slate-400'}`}>{formatFileSize(f.size)}</span>
                                        <button onClick={() => removeFile(i)} className={`p-1 rounded-md ${isDarkMode ? 'hover:bg-white/10 text-white/40' : 'hover:bg-slate-200 text-slate-400'}`}><X size={12} /></button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Field opsional */}
                        {tool.fields.length > 0 && (
                            <div className="mt-4 grid grid-cols-2 gap-3">
                                {tool.fields.map(f => {
                                    const hidden = f.showWhen && form[f.showWhen.key] !== f.showWhen.value;
                                    if (hidden) return null;
                                    return (
                                        <label key={f.key} className="block">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 block ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>{f.label}</span>
                                            {f.type === 'select' && f.key === 'language' ? (
                                                <select
                                                    value={form.language}
                                                    onChange={e => setForm({ ...form, language: e.target.value })}
                                                    className={`${inputCls} w-full`}
                                                >
                                                    {ocrLangsLoading && <option value="">Memuat daftar bahasa…</option>}
                                                    {!ocrLangsLoading && ocrLangs.length === 0 && <option value="">Bahasa tidak tersedia</option>}
                                                    <option value="auto" className="font-bold">✨ Auto — deteksi otomatis</option>
                                                    <option value="" disabled>────────── pilih manual ──────────</option>
                                                    {ocrLangs.map(l => (
                                                        <option key={l.code} value={l.code} disabled={!l.installed}>
                                                            {l.name}{!l.installed ? ' (pack belum terinstall)' : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : f.type === 'select' ? (
                                                <select value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} className={`${inputCls} w-full`}>
                                                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                                                </select>
                                            ) : (
                                                <input type={f.type || 'text'} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} className={`${inputCls} w-full`} />
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                        )}

                        {/* Opsi OCR: orientasi & deteksi per halaman */}
                        {tool.id === 'ocr' && (
                            <div className="mt-4 space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={form.autoRotate}
                                        onChange={e => setForm({ ...form, autoRotate: e.target.checked })}
                                        className="accent-indigo-500 w-3.5 h-3.5"
                                    />
                                    <span className={`text-[11px] font-bold ${isDarkMode ? 'text-white/70' : 'text-slate-600'}`}>Putar otomatis — deteksi orientasi halaman (landscape / miring)</span>
                                </label>
                                {form.language === 'auto' && (
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={form.perPage}
                                            onChange={e => setForm({ ...form, perPage: e.target.checked })}
                                            className="accent-indigo-500 w-3.5 h-3.5"
                                        />
                                        <span className={`text-[11px] font-bold ${isDarkMode ? 'text-white/70' : 'text-slate-600'}`}>Deteksi bahasa per halaman (dokumen campuran bahasa — lebih lambat)</span>
                                    </label>
                                )}
                            </div>
                        )}

                        {/* Tombol proses */}
                        <button
                            onClick={run}
                            disabled={busy || !files.length || !serviceOk}
                            className={`mt-5 w-full py-3 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 transition-all bg-gradient-to-r ${tool.gradient} text-white shadow-lg ${tool.shadow} ${(busy || !files.length || !serviceOk) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.01]'}`}
                        >
                            {busy ? <><Loader2 size={16} className="animate-spin" /> Memproses...</> : <><Sparkles size={16} /> Proses {tool.label}</>}
                        </button>

                        {error && (
                            <div className={`mt-4 flex items-start gap-2 p-3 rounded-xl border text-xs ${isDarkMode ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-600'}`}>
                                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}
                    </div>

                    {renderResult()}

                    {/* ── Riwayat hasil AI PDF Tools ── */}
                    <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/70 backdrop-blur-xl border-slate-200 shadow-sm'}`}>
                        <button
                            onClick={() => setShowHistory(s => !s)}
                            className={`w-full flex items-center gap-2.5 px-4 py-3 text-left transition-colors ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}
                        >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-100 text-indigo-600'}`}>
                                <History size={15} />
                            </div>
                            <div className="flex-1">
                                <p className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>Riwayat Hasil PDF Tools</p>
                                <p className={`text-[10px] ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>File yang pernah diproses — unduh ulang tanpa proses ulang</p>
                            </div>
                            {history.length > 0 && (
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${isDarkMode ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-600'}`}>
                                    {history.length}
                                </span>
                            )}
                            <button
                                onClick={e => { e.stopPropagation(); loadHistory(); }}
                                className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-white/10 text-white/50' : 'hover:bg-slate-200 text-slate-400'}`} title="Muat ulang"
                            >
                                <RefreshCw size={12} className={historyBusy ? 'animate-spin' : ''} />
                            </button>
                            <span className={`transition-transform ${showHistory ? 'rotate-180' : ''}`}>
                                <ChevronDown size={15} className={isDarkMode ? 'text-white/40' : 'text-slate-400'} />
                            </span>
                        </button>

                        {showHistory && (
                            <div className={`border-t ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
                                {history.length === 0 && (
                                    <p className={`px-4 py-4 text-[11px] italic ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>
                                        Belum ada hasil tersimpan. Proses file apa pun — hasil otomatis tersimpan di sini untuk diunduh ulang.
                                    </p>
                                )}
                                {history.length > 0 && (
                                    <div className="max-h-[280px] overflow-y-auto">
                                        {history.map(x => {
                                            const t = x.created_at ? new Date(x.created_at) : null;
                                            const dateStr = t && !isNaN(t) ? t.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '';
                                            return (
                                                <div key={x.id} className={`flex items-center gap-2.5 px-4 py-2.5 border-b last:border-b-0 ${isDarkMode ? 'border-white/5 hover:bg-white/5' : 'border-slate-50 hover:bg-slate-50'}`}>
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-indigo-500/10 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
                                                        <FileText size={14} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-[11px] font-bold truncate ${isDarkMode ? 'text-white/80' : 'text-slate-700'}`}>
                                                            <span className={`mr-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-black ${isDarkMode ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-100 text-indigo-600'}`}>
                                                                {TOOL_LABEL[x.tool] || x.tool}
                                                            </span>
                                                            {x.tool === 'ocr' && x.language_name && (
                                                                <span className={`mr-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-black ${isDarkMode ? 'bg-cyan-500/15 text-cyan-300' : 'bg-cyan-50 text-cyan-600'}`}>
                                                                    {x.language_name}
                                                                </span>
                                                            )}
                                                            {x.title}
                                                        </p>
                                                        <p className={`text-[9px] truncate ${isDarkMode ? 'text-white/35' : 'text-slate-400'}`}>
                                                            {dateStr}{dateStr ? ' • ' : ''}{formatFileSize(x.file_size)}
                                                            {compressPct(x) !== null && <span className="text-emerald-500 font-bold"> • −{compressPct(x).toFixed(0)}%</span>}
                                                            {x.tool === 'ocr' && x.orientation && <span className="text-amber-500 font-bold"> • rotasi {x.orientation}</span>}
                                                            {x.created_by ? ` • oleh ${x.created_by}` : ''}
                                                        </p>
                                                    </div>
                                                    {sharedDeptsOf(x).length > 0 ? (
                                                        <span title={`Dibagikan ke: ${sharedDeptsOf(x).join(', ')}`}
                                                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold border ${isDarkMode ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
                                                            <Share2 size={9} /> {sharedDeptsOf(x).length} dept
                                                        </span>
                                                    ) : (
                                                        <span title="Hanya pembuat (atau admin) yang bisa melihat"
                                                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold border ${isDarkMode ? 'bg-amber-500/10 border-amber-500/25 text-amber-300/80' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
                                                            <Lock size={9} /> Pribadi
                                                        </span>
                                                    )}
                                                    {x.fileExists === false && (
                                                        <span className={`text-[9px] font-bold ${isDarkMode ? 'text-rose-300' : 'text-rose-500'}`} title="File hilang dari disk">hilang</span>
                                                    )}
                                                    {x.tool === 'ocr' && (
                                                        <button
                                                            onClick={() => setViewTextTarget(x)}
                                                            title="Lihat teks hasil OCR"
                                                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:scale-[1.02] ${isDarkMode ? 'bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                                                        >
                                                            <Eye size={11} /> Lihat
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => downloadHistFile(x)}
                                                        disabled={x.fileExists === false}
                                                        title={x.tool === 'ocr' ? 'Unduh teks sebagai .txt' : 'Unduh ulang hasil ini'}
                                                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${x.fileExists === false ? 'opacity-40 cursor-not-allowed' : 'hover:scale-[1.02]'} ${isDarkMode ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                                                    >
                                                        <Download size={11} /> {x.tool === 'ocr' ? '.txt' : 'Unduh'}
                                                    </button>
                                                    {canManageHist(x) && (
                                                        <button
                                                            onClick={() => openShare(x)}
                                                            title="Bagikan ke departemen lain"
                                                            className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-sky-500/20 text-sky-300' : 'hover:bg-sky-50 text-sky-500'}`}
                                                        >
                                                            <Share2 size={12} />
                                                        </button>
                                                    )}
                                                    {canManageHist(x) && (
                                                        <button
                                                            onClick={() => setDelHistTarget(x)}
                                                            title="Hapus riwayat ini"
                                                            className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'text-white/25 hover:text-rose-300 hover:bg-rose-500/15' : 'text-slate-300 hover:text-rose-500 hover:bg-rose-50'}`}
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Modal lihat teks hasil OCR ── */}
            {viewTextTarget && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setViewTextTarget(null)}>
                    <div
                        onClick={e => e.stopPropagation()}
                        className={`w-full max-w-2xl rounded-2xl border shadow-2xl animate-[fadeInUp_.2s_ease] overflow-hidden ${isDarkMode ? 'bg-slate-900 border-white/10' : 'bg-white/70 backdrop-blur-xl border-slate-200'}`}
                    >
                        <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-cyan-500/15 text-cyan-300' : 'bg-cyan-50 text-cyan-600'}`}>
                                <ScanText size={14} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-xs font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{viewTextTarget.title}</p>
                                <p className={`text-[10px] ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                                    {viewTextTarget.language_name || viewTextTarget.language || 'Bahasa tidak diketahui'}
                                    {viewTextTarget.orientation ? ` • rotasi ${viewTextTarget.orientation}` : ''}
                                </p>
                            </div>
                            <button
                                onClick={() => setViewTextTarget(null)}
                                className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-white/10 text-white/50' : 'hover:bg-slate-100 text-slate-400'}`}
                            >
                                <X size={14} />
                            </button>
                        </div>
                        <pre className={`max-h-[420px] overflow-y-auto p-4 text-xs whitespace-pre-wrap leading-relaxed ${isDarkMode ? 'bg-black/30 text-white/80' : 'bg-slate-50 text-slate-600'}`}>
                            {viewTextTarget.text_content || '(kosong)'}
                        </pre>
                        <div className={`flex justify-end gap-2 px-4 py-3 border-t ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
                            <button
                                onClick={() => downloadHistFile(viewTextTarget)}
                                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all hover:scale-[1.02] ${isDarkMode ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-600'}`}
                            >
                                <Download size={12} /> Unduh .txt
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal konfirmasi hapus riwayat ── */}
            {delHistTarget && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setDelHistTarget(null)}>
                    <div
                        onClick={e => e.stopPropagation()}
                        className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl animate-[fadeInUp_.2s_ease] ${isDarkMode ? 'bg-slate-900 border-white/10' : 'bg-white/70 backdrop-blur-xl border-slate-200'}`}
                    >
                        <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-50 text-rose-500'}`}>
                                <AlertCircle size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Hapus riwayat ini?</p>
                                <p className={`text-[11px] mt-1 leading-relaxed ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>
                                    <b className={isDarkMode ? 'text-white/80' : 'text-slate-700'}>{delHistTarget.title}</b> akan dihapus permanen beserta file-nya di server.
                                </p>
                            </div>
                        </div>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                onClick={() => setDelHistTarget(null)}
                                className={`px-3.5 py-2 rounded-xl text-[11px] font-bold transition-colors ${isDarkMode ? 'bg-white/10 text-white/70 hover:bg-white/15' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                Batal
                            </button>
                            <button
                                onClick={confirmDeleteHist}
                                disabled={delHistBusy}
                                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all ${delHistBusy ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'} ${isDarkMode ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30' : 'bg-rose-500 text-white hover:bg-rose-600'}`}
                            >
                                {delHistBusy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Hapus Permanen
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal Bagikan ke Departemen ── */}
            {shareTarget && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShareTarget(null)}>
                    <div
                        onClick={e => e.stopPropagation()}
                        className={`w-full max-w-md rounded-2xl border p-5 shadow-2xl animate-[fadeInUp_.2s_ease] ${isDarkMode ? 'bg-slate-900 border-white/10' : 'bg-white/70 backdrop-blur-xl border-slate-200'}`}
                    >
                        <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-sky-500/15 text-sky-300' : 'bg-sky-50 text-sky-500'}`}>
                                <Share2 size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Bagikan ke Departemen</p>
                                <p className={`text-[11px] mt-1 leading-relaxed ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>
                                    <b className={isDarkMode ? 'text-white/80' : 'text-slate-700'}>{shareTarget.title}</b>
                                    <br />
                                    Anggota departemen terpilih bisa <b>melihat &amp; mengunduh</b> hasil ini (tidak bisa edit/hapus). Kosongkan semua untuk kembali pribadi.
                                </p>
                            </div>
                        </div>

                        <div className={`mt-4 rounded-xl border p-3 max-h-[240px] overflow-y-auto ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                            {departments.length === 0 ? (
                                <p className={`text-[11px] italic ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>Belum ada departemen terdaftar.</p>
                            ) : (
                                <div className="space-y-1.5">
                                    {departments.map(d => {
                                        const name = String(d.name || d).trim();
                                        const checked = shareDepts.some(x => String(x).trim() === name);
                                        return (
                                            <label key={name} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-colors ${checked
                                                ? (isDarkMode ? 'bg-sky-500/10 border-sky-500/40' : 'bg-sky-50 border-sky-300')
                                                : (isDarkMode ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-slate-200 hover:bg-slate-50')}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={e => {
                                                        setShareDepts(prev => e.target.checked
                                                            ? [...prev.filter(x => String(x).trim() !== name), name]
                                                            : prev.filter(x => String(x).trim() !== name));
                                                    }}
                                                    className="accent-sky-500"
                                                />
                                                <span className={`text-[11px] font-bold ${isDarkMode ? 'text-white/80' : 'text-slate-700'}`}>{name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                onClick={() => setShareTarget(null)}
                                className={`px-3.5 py-2 rounded-xl text-[11px] font-bold transition-colors ${isDarkMode ? 'bg-white/10 text-white/70 hover:bg-white/15' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                Batal
                            </button>
                            <button
                                onClick={saveShare}
                                disabled={shareBusy}
                                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all ${shareBusy ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'} ${isDarkMode ? 'bg-sky-500/20 text-sky-300 hover:bg-sky-500/30' : 'bg-sky-500 text-white hover:bg-sky-600'}`}
                            >
                                {shareBusy ? <Loader2 size={12} className="animate-spin" /> : <Share2 size={12} />} Simpan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
