import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    Loader2, CheckCircle2, AlertCircle, AlertTriangle, ChevronLeft, ChevronRight,
    ZoomIn, ZoomOut, Scan, Download, Table2, ListChecks, MousePointerClick, Layers,
} from 'lucide-react';

// PDF.js worker setup (same pattern as PdfViewer.jsx)
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// Palet warna box per field (ala Azure Document Intelligence — warna stabil per index)
const PALETTE = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];
const TABLE_COLOR = '#06b6d4';

const confColor = (c) => {
    if (c >= 0.9) return '#10b981';
    if (c >= 0.7) return '#f59e0b';
    return '#ef4444';
};
const confLabel = (c) => {
    if (c >= 0.9) return 'Tinggi';
    if (c >= 0.7) return 'Sedang';
    return 'Rendah';
};
const fmtConf = (c) => `${Math.round((c ?? 0) * 100)}%`;

export default function DocIntelligenceStudio({ files, results, isDarkMode, onUpdateResult, onDownloadExcel }) {
    const [activeIdx, setActiveIdx] = useState(0);
    const [pageNum, setPageNum] = useState(1);
    const [scale, setScale] = useState(1.4);
    const [pdfDoc, setPdfDoc] = useState(null);
    const [pageDims, setPageDims] = useState(null); // {width, height} pdf point halaman aktif
    const [loading, setLoading] = useState(false);
    const [tab, setTab] = useState('fields'); // 'fields' | 'table'
    const [activeKey, setActiveKey] = useState(null);
    const [hoverKey, setHoverKey] = useState(null);
    const [docIdx, setDocIdx] = useState(0); // dokumen aktif dalam satu file (PDF bulk)
    const canvasWrapRef = useRef(null);
    const canvasRef = useRef(null);
    const renderTaskRef = useRef(null);
    const initSigRef = useRef('');

    const result = results[activeIdx];
    const file = files[activeIdx];
    // Dokumen aktif: hasil split (bulk) atau result itu sendiri (stabil utk useMemo deps)
    const { hasDocs, docs, doc, curDocIdx } = useMemo(() => {
        const hd = !!(result && result.documents && result.documents.length > 1);
        const ds = hd ? result.documents : (result ? [{ ...result, value: null, pageStart: 1, pageEnd: result.pages || 1 }] : []);
        const idx = Math.min(docIdx, Math.max(0, ds.length - 1));
        return { hasDocs: hd, docs: ds, doc: ds[idx] || result || {}, curDocIdx: hd ? idx : 0 };
    }, [result, docIdx]);

    // Pilih file pertama yang berhasil — hanya saat daftar BERUBAH (ekstraksi baru / file baru),
    // bukan saat user mengedit nilai (results di-replace tiap ketikan).
    const resultsSig = `${(results || []).length}|${(files || []).length}`;
    useEffect(() => {
        if (initSigRef.current === resultsSig) return;
        initSigRef.current = resultsSig;
        const firstOk = (results || []).findIndex(r => r?.success);
        setActiveIdx(firstOk >= 0 ? firstOk : 0);
        setPageNum(1);
        setActiveKey(null);
        setTab('fields');
        setDocIdx(0);
    }, [resultsSig, results, files]);

    // Muat PDF untuk file aktif
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setPdfDoc(null);
            setPageDims(null);
            setLoading(true);
            try {
                if (!file || !/\.pdf$/i.test(file.name || '')) { setLoading(false); return; }
                const buf = await file.arrayBuffer();
                if (cancelled) return;
                const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
                if (cancelled) return;
                setPdfDoc(pdf);
                setPageNum(1);
                const pg = await pdf.getPage(1);
                const vp = pg.getViewport({ scale: 1 });
                setPageDims({ width: vp.width, height: vp.height });
                // fit-to-width awal
                requestAnimationFrame(() => {
                    const w = canvasWrapRef.current?.clientWidth || 0;
                    if (w > 0) setScale(Math.max(0.5, Math.min((w - 32) / vp.width, 3)));
                });
            } catch (e) {
                console.error('[DocStudio] PDF load error:', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; if (renderTaskRef.current) { try { renderTaskRef.current.cancel(); } catch { /* */ } } };
    }, [file]);

    // Ambil dimensi halaman aktif (bukan hanya halaman 1) supaya overlay akurat di semua halaman
    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!pdfDoc) { setPageDims(null); return; }
            try {
                const pg = await pdfDoc.getPage(pageNum);
                if (cancelled) return;
                const vp = pg.getViewport({ scale: 1 });
                setPageDims({ width: vp.width, height: vp.height });
            } catch { /* ignore */ }
        })();
        return () => { cancelled = true; };
    }, [pdfDoc, pageNum]);

    // Render halaman aktif ke canvas
    const renderPage = useCallback(async () => {
        if (!pdfDoc || !canvasRef.current || !pageDims) return;
        try {
            if (renderTaskRef.current) { try { renderTaskRef.current.cancel(); } catch { /* */ } }
            const page = await pdfDoc.getPage(pageNum);
            const vp = page.getViewport({ scale });
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;
            canvas.width = Math.floor(vp.width * dpr);
            canvas.height = Math.floor(vp.height * dpr);
            canvas.style.width = `${Math.floor(vp.width)}px`;
            canvas.style.height = `${Math.floor(vp.height)}px`;
            const task = page.render({ canvasContext: ctx, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
            renderTaskRef.current = task;
            await task.promise;
            renderTaskRef.current = null;
        } catch (e) {
            if (e?.name !== 'RenderingCancelledException') console.error('[DocStudio] render err', e);
        }
    }, [pdfDoc, pageNum, scale, pageDims]);

    useEffect(() => { renderPage(); }, [renderPage]);

    // ── Hitung posisi overlay (PDF point → px layar) ──
    // PDF origin kiri-bawah; canvas origin kiri-atas → top = H - (y + h)
    const toScreen = useCallback((r) => {
        if (!pageDims) return null;
        return {
            left: r.x * scale,
            top: (pageDims.height - r.y - r.h) * scale,
            width: Math.max(2, r.w * scale),
            height: Math.max(2, r.h * scale),
        };
    }, [pageDims, scale]);

    const regions = useMemo(() => (doc?.regions || []), [doc]);
    const table = useMemo(() => (doc?.table || null), [doc]);

    // Region aktif halaman ini
    const pageRegions = useMemo(() => regions.filter(r => r.page === pageNum), [regions, pageNum]);

    // Kotak tabel aktif halaman ini
    const tableBox = useMemo(() => {
        if (!table?.found || !pageDims || table.page !== pageNum || !table.columns?.length) return null;
        const xs = table.columns.map(c => c.x * scale);
        const left = Math.min(...xs) - 30;
        const right = Math.max(...xs) + 30;
        const top = (pageDims.height - table.headerY - 12) * scale;
        const height = 12 * scale;
        return { left, right, top, height, colScreens: xs };
    }, [table, pageDims, pageNum, scale]);

    const tableRows = useMemo(() => {
        if (!table?.found || table.page !== pageNum || !pageDims) return [];
        return (table.rowYs || []).map(y => ({
            top: (pageDims.height - y - 12) * scale,
            height: 12 * scale,
        }));
    }, [table, pageDims, pageNum, scale]);

    const activeRegion = regions.find(r => r.key === activeKey);

    const onSelectField = (key) => {
        const r = regions.find(x => x.key === key);
        if (!r) return;
        setActiveKey(key);
        setTab('fields');
        if (r.page !== pageNum) setPageNum(r.page);
    };

    const onSelectRow = () => {
        setActiveKey(null);
        setTab('table');
        if (table?.page && table.page !== pageNum) setPageNum(table.page);
    };

    // ── Editing ──
    const setFieldValue = (key, val) => {
        if (!onUpdateResult) return;
        if (hasDocs) {
            const documents = (result.documents || []).map((d, x) => x === curDocIdx ? { ...d, data: { ...(d.data || {}), [key]: val } } : d);
            onUpdateResult(activeIdx, { documents });
        } else {
            onUpdateResult(activeIdx, { data: { ...(result.data || {}), [key]: val } });
        }
    };
    const setItemValue = (ii, key, val) => {
        if (!onUpdateResult) return;
        if (hasDocs) {
            const documents = (result.documents || []).map((d, x) => x === curDocIdx
                ? { ...d, items: (d.items || []).map((it, y) => y === ii ? { ...it, [key]: val } : it) }
                : d);
            onUpdateResult(activeIdx, { documents });
        } else {
            const items = (result.items || []).map((it, x) => x === ii ? { ...it, [key]: val } : it);
            onUpdateResult(activeIdx, { items });
        }
    };

    const ok = (results || []).filter(r => r?.success).length;
    const fail = (results || []).length - ok;

    const dark = isDarkMode;
    const card = `rounded-2xl border ${dark ? 'bg-white/5 border-white/10' : 'bg-white border-stone-200 shadow-sm'}`;
    const label = `text-[10px] font-black uppercase tracking-widest ${dark ? 'text-white/40' : 'text-stone-400'}`;
    const inp = `w-full px-2 py-1 rounded-lg text-[11px] border outline-none transition-colors ${dark ? 'bg-white/5 border-white/10 text-white focus:border-cyan-500/60' : 'bg-white border-stone-200 text-stone-700 focus:border-cyan-400'}`;
    const chipBase = `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all`;

    return (
        <div className="space-y-4">
            {/* ── Toolbar atas (ala Azure: pilih dokumen, zoom, unduh) ── */}
            <div className={card + ' p-3'}>
                <div className="flex items-center gap-2 flex-wrap">
                    <div className={`w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center flex-shrink-0`}>
                        <Scan size={15} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold ${dark ? 'text-white' : 'text-stone-700'}`}>AI Document Intelligence</p>
                        <p className={`text-[10px] ${dark ? 'text-white/40' : 'text-stone-400'}`}>
                            {ok} berhasil • {fail} gagal • klik field untuk menyorot posisinya di dokumen
                        </p>
                    </div>
                    {ok > 0 && (
                        <button onClick={onDownloadExcel}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border ${dark
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'}`}>
                            <Download size={13} /> Unduh Excel
                        </button>
                    )}
                </div>

                {/* Chips file */}
                <div className="flex gap-1.5 mt-2.5 overflow-x-auto pb-1">
                    {(results || []).map((r, i) => (
                        <button key={i} onClick={() => { setActiveIdx(i); setPageNum(1); setActiveKey(null); setDocIdx(0); }}
                            className={`${chipBase} flex-shrink-0 max-w-[220px] ${activeIdx === i
                                ? dark ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-cyan-50 border-cyan-300 text-cyan-700'
                                : dark ? 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10' : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'}`}>
                            {r?.success ? <CheckCircle2 size={12} className={dark ? 'text-emerald-300' : 'text-emerald-500'} /> : <AlertCircle size={12} className="text-rose-500" />}
                            <span className="truncate">{r?.filename || `File ${i + 1}`}</span>
                            {r?.documents?.length > 1 && (
                                <span className={`text-[9px] font-black px-1 py-0.5 rounded-md ${dark ? 'bg-cyan-500/25 text-cyan-200' : 'bg-cyan-100 text-cyan-700'}`}>{r.documents.length} dok</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Chips dokumen (PDF bulk: 1 file = banyak nota retur) */}
                {hasDocs && (
                    <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1 border-t pt-2.5" style={{ borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(226,232,240,1)' }}>
                        <span className={`text-[9px] font-black uppercase tracking-widest self-center flex-shrink-0 ${dark ? 'text-white/30' : 'text-stone-400'}`}>Dokumen</span>
                        {docs.map((d, i) => (
                            <button key={i} onClick={() => { setDocIdx(i); setPageNum(d.pageStart || 1); setActiveKey(null); }}
                                className={`${chipBase} flex-shrink-0 max-w-[240px] ${curDocIdx === i
                                    ? dark ? 'bg-blue-500/25 border-blue-500/50 text-blue-200' : 'bg-blue-50 border-blue-300 text-blue-700'
                                    : dark ? 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10' : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'}`}>
                                <span className="truncate">#{i + 1}{d.value ? ` • ${d.value}` : ''}</span>
                                <span className={`text-[9px] flex-shrink-0 ${dark ? 'text-white/30' : 'text-stone-400'}`}>
                                    {d.pageStart === d.pageEnd ? `hal ${d.pageStart}` : `hal ${d.pageStart}-${d.pageEnd}`}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Peringatan perubahan layout per file (dari monitoring ekstraksi) */}
            {result?.success && result?.monitoring?.layout_changed && (
                <div className={`rounded-2xl border p-3.5 flex items-start gap-2.5 ${dark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-300'}`}>
                    <AlertTriangle size={16} className={`flex-shrink-0 mt-0.5 ${dark ? 'text-amber-300' : 'text-amber-600'}`} />
                    <div className="flex-1">
                        <p className={`text-xs font-bold ${dark ? 'text-amber-300' : 'text-amber-700'}`}>Layout dokumen kemungkinan berubah — hasil perlu dicek</p>
                        <p className={`text-[10px] mt-0.5 ${dark ? 'text-amber-200/70' : 'text-amber-800/70'}`}>
                            {result.monitoring.warning || 'Terdeteksi penurunan kualitas ekstraksi.'} — update mapping di tab Training Mapping bila perlu.
                        </p>
                    </div>
                </div>
            )}

            {!result || !result.success ? (
                <div className={`rounded-2xl border-2 border-dashed p-10 text-center ${dark ? 'border-rose-500/30 bg-rose-500/5' : 'border-rose-200 bg-rose-50/40'}`}>
                    <AlertCircle size={28} className="mx-auto mb-2 text-rose-500" />
                    <p className={`text-sm font-bold ${dark ? 'text-white/80' : 'text-stone-600'}`}>{result?.error || 'Tidak ada hasil untuk file ini.'}</p>
                </div>
            ) : (
                <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
                    {/* ── Dokumen + overlay ── */}
                    <div className={card + ' overflow-hidden'}>
                        {/* kontrol halaman & zoom */}
                        <div className={`flex items-center gap-2 px-3 py-2 border-b ${dark ? 'border-white/10' : 'border-stone-100'}`}>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setPageNum(p => Math.max(1, p - 1))} disabled={pageNum <= 1}
                                    className={`p-1.5 rounded-lg transition-colors ${dark ? 'hover:bg-white/10 text-white/60 disabled:opacity-20' : 'hover:bg-stone-100 text-stone-500 disabled:opacity-20'}`}><ChevronLeft size={14} /></button>
                                <span className={`text-[11px] font-bold min-w-[52px] text-center ${dark ? 'text-white/70' : 'text-stone-600'}`}>{pageNum} / {pdfDoc?.numPages || result.pages || 1}</span>
                                <button onClick={() => setPageNum(p => Math.min(pdfDoc?.numPages || result.pages || 1, p + 1))} disabled={pageNum >= (pdfDoc?.numPages || result.pages || 1)}
                                    className={`p-1.5 rounded-lg transition-colors ${dark ? 'hover:bg-white/10 text-white/60 disabled:opacity-20' : 'hover:bg-stone-100 text-stone-500 disabled:opacity-20'}`}><ChevronRight size={14} /></button>
                            </div>
                            <div className="flex items-center gap-1 ml-auto">
                                <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className={`p-1.5 rounded-lg ${dark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-stone-100 text-stone-500'}`}><ZoomOut size={14} /></button>
                                <span className={`text-[10px] font-bold min-w-[42px] text-center ${dark ? 'text-white/40' : 'text-stone-400'}`}>{Math.round(scale * 100)}%</span>
                                <button onClick={() => setScale(s => Math.min(3, s + 0.2))} className={`p-1.5 rounded-lg ${dark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-stone-100 text-stone-500'}`}><ZoomIn size={14} /></button>
                            </div>
                        </div>

                        <div ref={canvasWrapRef} className={`overflow-auto p-4 flex justify-center ${dark ? 'bg-[#0b0e1a]' : 'bg-stone-100'}`} style={{ maxHeight: '70vh' }}>
                            {loading && (
                                <div className="py-16 flex flex-col items-center gap-2">
                                    <Loader2 size={24} className="animate-spin text-cyan-500" />
                                    <p className={`text-xs font-bold ${dark ? 'text-white/50' : 'text-stone-400'}`}>Memuat dokumen…</p>
                                </div>
                            )}
                            {!loading && /\.pdf$/i.test(file?.name || '') && pageDims && (
                                <div className="relative shadow-2xl rounded-lg overflow-hidden" style={{ width: pageDims.width * scale }}>
                                    <canvas ref={canvasRef} className="block" />
                                    {/* ── Overlay kotak hasil deteksi ── */}
                                    <svg
                                        width={pageDims.width * scale}
                                        height={pageDims.height * scale}
                                        className="absolute inset-0"
                                        style={{ left: 0, top: 0, pointerEvents: 'none' }}
                                    >
                                        {/* Tabel: header + garis kolom + baris */}
                                        {tableBox && (
                                            <g>
                                                <rect x={tableBox.left} y={tableBox.top} width={tableBox.right - tableBox.left} height={tableBox.height}
                                                    fill={TABLE_COLOR} fillOpacity="0.18" stroke={TABLE_COLOR} strokeWidth="1.5" rx="2" />
                                                {tableBox.colScreens.slice(0, -1).map((cx, i) => (
                                                    <line key={i} x1={cx} y1={tableBox.top} x2={cx} y2={tableBox.top + tableBox.height} stroke={TABLE_COLOR} strokeOpacity="0.5" strokeWidth="1" />
                                                ))}
                                            </g>
                                        )}
                                        {tableRows.map((r, i) => (
                                            <g key={`r${i}`}>
                                                <line x1={tableBox?.left ?? 0} y1={r.top} x2={tableBox?.right ?? pageDims.width * scale} y2={r.top} stroke={TABLE_COLOR} strokeOpacity="0.35" strokeWidth="1" />
                                                <rect x={tableBox?.left ?? 0} y={r.top} width={(tableBox?.right ?? pageDims.width * scale) - (tableBox?.left ?? 0)} height={r.height}
                                                    fill={TABLE_COLOR} fillOpacity="0.07" />
                                            </g>
                                        ))}

                                        {/* Field header */}
                                        {pageRegions.map((r, i) => {
                                            const b = toScreen(r);
                                            if (!b) return null;
                                            const color = PALETTE[i % PALETTE.length];
                                            const isActive = activeKey === r.key;
                                            const isHover = hoverKey === r.key;
                                            const opacity = isActive ? 0.35 : (isHover ? 0.28 : 0.15);
                                            return (
                                                <g key={r.key}
                                                    className="cursor-pointer"
                                                    style={{ pointerEvents: 'auto' }}
                                                    onClick={(e) => { e.stopPropagation(); onSelectField(r.key); }}
                                                    onMouseEnter={() => setHoverKey(r.key)}
                                                    onMouseLeave={() => setHoverKey(null)}
                                                >
                                                    <rect x={b.left} y={b.top} width={b.width} height={b.height} fill={color} fillOpacity={opacity}
                                                        stroke={color} strokeWidth={isActive ? 2.5 : 1.2} rx="2"
                                                        strokeDasharray={isActive ? 'none' : '3 2'} />
                                                    {(isActive || isHover) && (
                                                        <g>
                                                            <rect x={b.left} y={Math.max(0, b.top - 17)} width={Math.min(b.width + 8, 200)} height={15} rx="3" fill="#0f172a" stroke={color} />
                                                            <text x={b.left + 4} y={Math.max(11, b.top - 6)} fontSize="9" fill="#fff" fontWeight="700">{r.label}</text>
                                                        </g>
                                                    )}
                                                </g>
                                            );
                                        })}
                                    </svg>
                                </div>
                            )}
                            {!loading && !/\.pdf$/i.test(file?.name || '') && (
                                <div className={`py-12 text-center text-xs ${dark ? 'text-white/40' : 'text-stone-400'}`}>
                                    Preview visual hanya untuk PDF — data tetap bisa diperiksa di panel Field / Tabel.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Panel Field / Tabel (ala Azure) ── */}
                    <div className="space-y-3">
                        <div className={`inline-flex p-1 rounded-xl border gap-1 ${dark ? 'bg-white/5 border-white/10' : 'bg-white border-stone-200 shadow-sm'}`}>
                            <button onClick={() => setTab('fields')}
                                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${tab === 'fields'
                                    ? dark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-50 text-cyan-700'
                                    : dark ? 'text-white/50 hover:text-white/90' : 'text-stone-500 hover:text-stone-800'}`}>
                                <ListChecks size={13} /> Field ({regions.length})
                            </button>
                            <button onClick={() => setTab('table')}
                                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${tab === 'table'
                                    ? dark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-50 text-cyan-700'
                                    : dark ? 'text-white/50 hover:text-white/90' : 'text-stone-500 hover:text-stone-800'}`}>
                                <Table2 size={13} /> Tabel ({doc.items?.length || 0})
                            </button>
                        </div>

                        {tab === 'fields' && (
                            <div className={card + ' p-3'}>
                                <div className="flex items-center justify-between mb-2">
                                    <p className={label + ' mb-0'}>Field Terdeteksi</p>
                                    <span className={`text-[9px] ${dark ? 'text-white/30' : 'text-stone-300'}`}>
                                        <span className="text-emerald-500">●</span> ≥90% <span className="text-amber-500 mx-1">●</span> 70-89% <span className="text-rose-500 mx-1">●</span> &lt;70%
                                    </span>
                                </div>
                                {pageRegions.length === 0 && (
                                    <p className={`text-[11px] italic ${dark ? 'text-white/30' : 'text-stone-300'}`}>Tidak ada field terdeteksi di halaman ini.</p>
                                )}
                                <div className="space-y-1.5 max-h-[52vh] overflow-y-auto pr-1">
                                    {pageRegions.map((r, i) => {
                                        const color = PALETTE[i % PALETTE.length];
                                        const c = confColor(r.confidence);
                                        const isActive = activeKey === r.key;
                                        const val = doc.data?.[r.key] ?? r.value ?? '';
                                        return (
                                            <div key={r.key}
                                                onClick={() => onSelectField(r.key)}
                                                onMouseEnter={() => setHoverKey(r.key)}
                                                onMouseLeave={() => setHoverKey(null)}
                                                className={`rounded-xl border p-2.5 cursor-pointer transition-all ${isActive
                                                    ? dark ? 'bg-cyan-500/10 border-cyan-500/40' : 'bg-cyan-50 border-cyan-300'
                                                    : dark ? 'bg-white/5 border-white/10 hover:border-white/25' : 'bg-stone-50 border-stone-100 hover:border-stone-300'}`}>
                                                <div className="flex items-center gap-1.5 mb-1.5">
                                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider flex-1 truncate ${dark ? 'text-white/60' : 'text-stone-400'}`}>{r.label}</span>
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full`} style={{ background: `${c}22`, color: c }}>{fmtConf(r.confidence)}</span>
                                                </div>
                                                <input value={val} onClick={e => e.stopPropagation()}
                                                    onChange={e => setFieldValue(r.key, e.target.value)}
                                                    className={inp} />
                                                <div className="flex items-center gap-1.5 mt-1.5">
                                                    <div className="h-1 flex-1 rounded-full bg-stone-500/20 overflow-hidden">
                                                        <div className="h-full rounded-full transition-all" style={{ width: fmtConf(r.confidence), background: c }} />
                                                    </div>
                                                    <span className={`text-[9px] ${dark ? 'text-white/30' : 'text-stone-400'}`}>{confLabel(r.confidence)} • hal {r.page}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {activeRegion && (
                                    <div className={`mt-2.5 flex items-start gap-2 p-2.5 rounded-xl border text-[11px] ${dark ? 'bg-cyan-500/10 border-cyan-500/25 text-cyan-200' : 'bg-cyan-50 border-cyan-200 text-cyan-700'}`}>
                                        <MousePointerClick size={13} className="flex-shrink-0 mt-0.5" />
                                        <span>Klik kotak di dokumen juga bisa memilih field. Nilai bisa diedit langsung di sini.</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {tab === 'table' && (
                            <div className={card + ' overflow-hidden'}>
                                <div className={`px-3 py-2 border-b flex items-center gap-1.5 ${dark ? 'border-white/10' : 'border-stone-100'}`}>
                                    <Table2 size={13} className={dark ? 'text-cyan-300' : 'text-cyan-600'} />
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${dark ? 'text-white/40' : 'text-stone-400'}`}>
                                        Item Barang {table?.found ? `• hal ${table.page}` : '— tidak terdeteksi'}
                                    </span>
                                </div>
                                <div className="overflow-x-auto max-h-[52vh]">
                                    <table className="w-full text-left text-[11px]">
                                        <thead>
                                            <tr className={`border-b ${dark ? 'border-white/10' : 'border-stone-100'}`}>
                                                <th className={`px-2.5 py-2 text-[9px] font-black uppercase ${dark ? 'text-white/40' : 'text-stone-400'}`}>No</th>
                                                {(table?.columns || []).map((c, i) => (
                                                    <th key={i} className={`px-2.5 py-2 text-[9px] font-black uppercase whitespace-nowrap ${dark ? 'text-white/40' : 'text-stone-400'}`}>{c.label}</th>
                                                ))}
                                                {(table?.columns || []).length === 0 && (doc.items?.[0] ? Object.keys(doc.items[0]) : []).map((k, i) => (
                                                    <th key={i} className={`px-2.5 py-2 text-[9px] font-black uppercase whitespace-nowrap ${dark ? 'text-white/40' : 'text-stone-400'}`}>{k}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(doc.items || []).map((it, ii) => (
                                                <tr key={ii} onClick={() => onSelectRow(ii)}
                                                    className={`border-b cursor-pointer transition-colors ${dark ? 'border-white/5 hover:bg-cyan-500/5' : 'border-stone-50 hover:bg-cyan-50/60'}`}>
                                                    <td className={`px-2.5 py-1.5 ${dark ? 'text-white/40' : 'text-stone-400'}`}>{ii + 1}</td>
                                                    {(table?.columns || []).map((c, ci) => (
                                                        <td key={ci} className="px-1.5 py-1 min-w-[90px]">
                                                            <input value={it?.[c.key] ?? ''} onClick={e => e.stopPropagation()}
                                                                onChange={e => setItemValue(ii, c.key, e.target.value)}
                                                                className={inp} />
                                                        </td>
                                                    ))}
                                                    {(table?.columns || []).length === 0 && Object.keys(it || {}).map((k, ci) => (
                                                        <td key={ci} className="px-1.5 py-1 min-w-[90px]">
                                                            <input value={it?.[k] ?? ''} onClick={e => e.stopPropagation()}
                                                                onChange={e => setItemValue(ii, k, e.target.value)}
                                                                className={inp} />
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                            {(doc.items || []).length === 0 && (
                                                <tr><td colSpan={99} className={`px-3 py-3 text-center ${dark ? 'text-white/30' : 'text-stone-400'}`}>Tidak ada baris item.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                {table?.found && (
                                    <div className={`px-3 py-2 border-t flex items-center gap-1.5 text-[10px] ${dark ? 'border-white/10 text-white/40' : 'border-stone-100 text-stone-400'}`}>
                                        <Layers size={11} /> {table.columns.length} kolom • {(table.rowYs || []).length} baris terdeteksi
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
