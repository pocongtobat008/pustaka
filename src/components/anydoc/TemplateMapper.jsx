import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import DocIntelligenceStudio from './DocIntelligenceStudio.jsx';
import {
    FileSpreadsheet, Loader2, Plus, Trash2, UploadCloud, CheckCircle2, AlertCircle,
    X, Save, FlaskConical, Table2, ListChecks, Download,
    FolderOpen, Sparkles, Layers, History, BarChart3, AlertTriangle, RefreshCw, ChevronDown, Lock, Share2,
    Archive, Files, FileText,
} from 'lucide-react';
import { SummaryRow } from '../ui/Card';

const getApiUrl = () => (window.location.protocol === 'file:' ? 'http://localhost:5005/api' : '/api');
const API_URL = getApiUrl();

const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field';
const uid = () => Math.random().toString(36).slice(2, 8);
const formatFileSize = (b) => {
    if (!b && b !== 0) return '-';
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1024 / 1024).toFixed(2) + ' MB';
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

// Pecah item teks satu baris menjadi sel (berdasarkan celah x)
const cellsFromItems = (items, gap = 10) => {
    const sorted = [...items].sort((a, b) => a.x - b.x);
    const cells = [];
    let cur = null;
    for (const it of sorted) {
        if (!cur) cur = { x: it.x, w: it.w, text: it.str };
        else if (it.x > cur.x + cur.w + gap) { cells.push(cur); cur = { x: it.x, w: it.w, text: it.str }; }
        else { cur.text += ' ' + it.str; cur.w = Math.max(cur.w, it.x + it.w - cur.x); }
    }
    if (cur) cells.push(cur);
    return cells;
};

export default function TemplateMapper({ isDarkMode, defaultView = 'train', lockView = false, currentUser = null }) {
    const [templates, setTemplates] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [view, setView] = useState('list'); // 'list' | 'train' | 'extract'

    // ── Train state ──
    const [tplName, setTplName] = useState('');
    const [tplType, setTplType] = useState('');
    const [tplDesc, setTplDesc] = useState('');
    const [tplSplitPattern, setTplSplitPattern] = useState(''); // label awal tiap dokumen (bulk)
    const [tplSplitKey, setTplSplitKey] = useState('');         // field_key identitas dokumen
    const [samples, setSamples] = useState([]);       // [{filename, path, size}]
    const [sampleFiles, setSampleFiles] = useState([]); // File objects (utk upload/validate)
    const [linesData, setLinesData] = useState(null);   // {pages:[{page,lines:[{y,text,items}]}]}
    const [previewName, setPreviewName] = useState('');
    const [headerFields, setHeaderFields] = useState([]); // [{uid,key,label,matchType,pattern}]
    const [tableCols, setTableCols] = useState([]);       // [{uid,key,label}]
    const [valResults, setValResults] = useState(null);
    const [busy, setBusy] = useState(null); // 'upload' | 'lines' | 'validate' | 'save' | 'extract'
    const [error, setError] = useState(null);
    const [msg, setMsg] = useState('');
    const sampleInputRef = useRef(null);

    // ── Extract state ──
    const [extFiles, setExtFiles] = useState([]);
    const [extTplId, setExtTplId] = useState(''); // '' = auto
    const [results, setResults] = useState([]);
    const [monitoringWarn, setMonitoringWarn] = useState([]); // files dgn layout_changed
    const [extractions, setExtractions] = useState([]);       // riwayat ekstraksi
    const [extractionSummary, setExtractionSummary] = useState([]); // ringkasan per bulan
    const [showMonitor, setShowMonitor] = useState(false);
    const [monitorBusy, setMonitorBusy] = useState(false);
    // ── Arsip Dokumen (penyimpanan PDF asli — unduh / ekstrak ulang tanpa upload) ──
    const [archiveFiles, setArchiveFiles] = useState([]);
    const [showArchive, setShowArchive] = useState(false);
    const [archiveBusy, setArchiveBusy] = useState(false);
    const [archiveSel, setArchiveSel] = useState(new Set()); // id terpilih utk ekstrak ulang massal
    // ── History Export Excel (unduh ulang tanpa extract ulang) ──
    const [exportHistory, setExportHistory] = useState([]);
    const [showExportHistory, setShowExportHistory] = useState(false);
    const [exportBusy, setExportBusy] = useState(false);
    const [delExportTarget, setDelExportTarget] = useState(null); // baris yang dikonfirmasi hapus
    const [delExportBusy, setDelExportBusy] = useState(false);
    const savingExportRef = useRef(false); // cegah double-klik export membuat duplikat
    const extInputRef = useRef(null);
    // ── Berbagi lintas departemen ──
    const [departments, setDepartments] = useState([]);
    const [shareTarget, setShareTarget] = useState(null); // { type: 'archive'|'export', row }
    const [shareDepts, setShareDepts] = useState([]);
    const [shareBusy, setShareBusy] = useState(false);

    const loadTemplates = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/anydoc/templates`, { credentials: 'include' });
            if (res.ok) setTemplates(await res.json());
        } catch { /* ignore */ }
    }, []);

    const loadMonitoring = useCallback(async (tplId) => {
        setMonitorBusy(true);
        try {
            const qs = tplId ? `?templateId=${tplId}` : '';
            const [sRes, lRes] = await Promise.all([
                fetch(`${API_URL}/anydoc/templates/extractions/summary${qs}`, { credentials: 'include' }),
                fetch(`${API_URL}/anydoc/templates/extractions${qs}`, { credentials: 'include' }),
            ]);
            if (sRes.ok) setExtractionSummary(await sRes.json());
            if (lRes.ok) setExtractions(await lRes.json());
        } catch { /* ignore */ }
        finally { setMonitorBusy(false); }
    }, []);

    const loadArchive = useCallback(async (tplId) => {
        setArchiveBusy(true);
        try {
            const qs = tplId ? `?templateId=${tplId}` : '';
            const res = await fetch(`${API_URL}/anydoc/templates/archive${qs}`, { credentials: 'include' });
            if (res.ok) setArchiveFiles(await res.json());
        } catch { /* ignore */ }
        finally { setArchiveBusy(false); }
    }, []);

    const loadExportHistory = useCallback(async (tplId) => {
        setExportBusy(true);
        try {
            const qs = tplId ? `?templateId=${tplId}` : '';
            const res = await fetch(`${API_URL}/anydoc/templates/exports${qs}`, { credentials: 'include' });
            if (res.ok) setExportHistory(await res.json());
        } catch { /* ignore */ }
        finally { setExportBusy(false); }
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
    const canManage = (row) => isAdminUser || (row?.created_by && (row.created_by === currentUser?.username || row.created_by === currentUser?.name));

    const openShare = (type, row) => {
        setShareTarget({ type, row });
        setShareDepts(sharedDeptsOf(row));
    };

    const saveShare = async () => {
        if (!shareTarget) return;
        setShareBusy(true);
        try {
            const { type, row } = shareTarget;
            const base = type === 'archive'
                ? `${API_URL}/anydoc/templates/archive/${row.id}/share`
                : `${API_URL}/anydoc/templates/exports/${row.id}/share`;
            const res = await fetch(base, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ departments: shareDepts }),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Gagal menyimpan berbagi.');
            const upd = { ...row, shared_departments: j.shared_departments?.length ? JSON.stringify(j.shared_departments) : null };
            if (type === 'archive') setArchiveFiles(prev => prev.map(x => Number(x.id) === Number(row.id) ? upd : x));
            else setExportHistory(prev => prev.map(x => Number(x.id) === Number(row.id) ? upd : x));
            setShareTarget(null);
            showMsg('✅ Pengaturan berbagi tersimpan.');
        } catch (e) { showError(e); }
        finally { setShareBusy(false); }
    };

    useEffect(() => { loadTemplates(); }, [loadTemplates]);
    useEffect(() => { loadMonitoring(activeId); }, [loadMonitoring, activeId]);
    useEffect(() => { loadArchive(activeId); }, [loadArchive, activeId]);
    useEffect(() => { loadExportHistory(activeId); }, [loadExportHistory, activeId]);

    // ── Arsip: unduh / ekstrak ulang / hapus ──
    const downloadArchived = async (row) => {
        try {
            const res = await fetch(row.downloadUrl, { credentials: 'include' });
            if (!res.ok) throw new Error('Gagal mengunduh.');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = row.filename || 'dokumen.pdf';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e) { showError(e); }
    };

    const toggleArchiveSel = (id) => {
        setArchiveSel(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    // Ekstrak ulang file arsip (1 file) — hasil tampil di studio tanpa upload ulang
    const reExtractArchived = async (row) => {
        setError(null); setBusy('extract'); setResults([]); setMonitoringWarn([]);
        try {
            const blobRes = await fetch(row.downloadUrl, { credentials: 'include' });
            const blob = blobRes.ok ? await blobRes.blob() : null;
            const res = await fetch(`${API_URL}/anydoc/templates/archive/re-extract`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ ids: [row.id], templateId: activeId }),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Gagal ekstrak ulang.');
            const results = j.results || [];
            setResults(results);
            setExtFiles(blob ? [new File([blob], row.filename || `arsip-${row.id}.pdf`)] : []);
            const warned = results.filter(r => r.success && r.monitoring?.layout_changed)
                .map(r => ({ filename: r.filename, warning: r.monitoring?.warning || '' }));
            setMonitoringWarn(warned);
            loadMonitoring(activeId);
            loadArchive(activeId);
        } catch (e) { showError(e); } finally { setBusy(null); }
    };

    // Ekstrak ulang beberapa file arsip sekaligus (checkbox)
    const reExtractBatch = async () => {
        const ids = [...archiveSel];
        if (!ids.length) return;
        setError(null); setBusy('extract'); setResults([]); setMonitoringWarn([]);
        try {
            const res = await fetch(`${API_URL}/anydoc/templates/archive/re-extract`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ ids, templateId: activeId }),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Gagal ekstrak ulang.');
            const results = j.results || [];
            // Siapkan File objects utk preview PDF (ambil blob tiap file arsip terpilih)
            const files = [];
            for (const id of ids) {
                const row = archiveFiles.find(x => Number(x.id) === Number(id));
                if (!row) continue;
                const br = await fetch(row.downloadUrl, { credentials: 'include' });
                if (br.ok) files.push(new File([await br.blob()], row.filename || `arsip-${id}.pdf`));
            }
            setResults(results);
            setExtFiles(files);
            const warned = results.filter(r => r.success && r.monitoring?.layout_changed)
                .map(r => ({ filename: r.filename, warning: r.monitoring?.warning || '' }));
            setMonitoringWarn(warned);
            setArchiveSel(new Set());
            loadMonitoring(activeId);
            loadArchive(activeId);
        } catch (e) { showError(e); } finally { setBusy(null); }
    };

    const deleteArchived = async (row) => {
        if (!window.confirm(`Hapus "${row.filename}" dari arsip? File asli di server ikut terhapus.`)) return;
        try {
            const res = await fetch(`${API_URL}/anydoc/templates/archive/${row.id}`, { method: 'DELETE', credentials: 'include' });
            if (!res.ok) throw new Error('Gagal menghapus.');
            setArchiveFiles(prev => prev.filter(x => Number(x.id) !== Number(row.id)));
            setArchiveSel(prev => { const n = new Set(prev); n.delete(Number(row.id)); return n; });
            loadMonitoring(activeId);
            showMsg('File dihapus dari arsip.');
        } catch (e) { showError(e); }
    };

    // Unduh ulang file Excel yang tersimpan di History Export
    const downloadExportFile = async (x) => {
        try {
            const res = await fetch(x.downloadUrl, { credentials: 'include' });
            if (!res.ok) throw new Error('Gagal mengunduh.');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = x.file_name || `${x.title || 'export'}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e) { showError(e); }
    };

    const deleteExport = async () => {
        if (!delExportTarget) return;
        setDelExportBusy(true);
        try {
            const res = await fetch(`${API_URL}/anydoc/templates/exports/${delExportTarget.id}`, {
                method: 'DELETE', credentials: 'include',
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Gagal menghapus export.');
            setExportHistory(prev => prev.filter(e => e.id !== delExportTarget.id));
            setDelExportTarget(null);
            showMsg('✅ History export dihapus.');
        } catch (e) { showError(e); }
        finally { setDelExportBusy(false); }
    };

    const showError = (e) => setError(e.message || String(e));
    const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

    // ── Template CRUD ──
    const createTemplate = async () => {
        if (!tplName.trim()) { setError('Nama template wajib diisi.'); return; }
        setError(null); setBusy('save');
        try {
            const res = await fetch(`${API_URL}/anydoc/templates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name: tplName, doc_type: tplType, description: tplDesc, split_pattern: tplSplitPattern, split_key: tplSplitKey, fields: [] }),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Gagal membuat template.');
            await loadTemplates();
            setActiveId(j.id);
            setSamples(j.sample_files || []);
            setView(defaultView);
        } catch (e) { showError(e); } finally { setBusy(null); }
    };

    const openTemplate = (t) => {
        setActiveId(t.id);
        setTplName(t.name);
        setTplType(t.doc_type || '');
        setTplDesc(t.description || '');
        setTplSplitPattern(t.split_pattern || '');
        setTplSplitKey(t.split_key || '');
        setSamples(t.sample_files || []);
        setSampleFiles([]);
        setHeaderFields((t.fields || []).filter(f => f.group !== 'table').map(f => ({ uid: uid(), key: f.field_key, label: f.field_label, matchType: f.match_type, pattern: f.pattern || '', anchor: f.anchor || '' })));
        setTableCols((t.fields || []).filter(f => f.group === 'table').map(f => ({ uid: uid(), key: f.field_key, label: f.field_label || f.pattern, pattern: f.pattern || f.field_label, isGroup: !!f.is_group })));
        setValResults(null);
        setResults([]);
        setLinesData(null);
        setError(null);
        setView(defaultView);
    };

    // ── Sampel ──
    const uploadSamples = async (files) => {
        if (!files.length || busy) return;
        setError(null); setBusy('upload');
        try {
            const fd = new FormData();
            [...files].forEach(f => fd.append('files', f));
            const res = await fetch(`${API_URL}/anydoc/templates/samples`, { method: 'POST', credentials: 'include', body: fd });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Gagal upload sampel.');
            setSamples(prev => {
                const merged = [...prev];
                for (const s of j.files) if (!merged.some(x => x.path === s.path)) merged.push(s);
                return merged;
            });
            setSampleFiles(prev => [...prev, ...[...files]]);
            showMsg(`${j.files.length} sampel ditambahkan.`);
        } catch (e) { showError(e); } finally { setBusy(null); }
    };

    const loadLines = async (fileObj) => {
        setError(null); setBusy('lines');
        try {
            let target = fileObj;
            let name = fileObj?.name || '';
            if (!target) {
                // ambil dari file tersimpan server (sampel pertama)
                const stored = samples[0];
                if (!stored) { setError('Tidak ada sampel.'); return; }
                const blobRes = await fetch(`${API_URL}/anydoc/templates/samples/file?name=${encodeURIComponent(stored.path)}`, { credentials: 'include' });
                if (!blobRes.ok) throw new Error('Gagal mengambil file sampel.');
                const blob = await blobRes.blob();
                target = new File([blob], stored.filename);
                name = stored.filename;
            }
            const fd = new FormData();
            fd.append('file', target);
            const res = await fetch(`${API_URL}/anydoc/templates/sample-lines`, { method: 'POST', credentials: 'include', body: fd });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Gagal membaca baris sampel.');
            setLinesData(j);
            setPreviewName(name);
        } catch (e) { showError(e); } finally { setBusy(null); }
    };

    // ── Mapping ──
    const addHeaderField = (lineTextValue) => {
        const label = lineTextValue.split(':')[0].trim().slice(0, 60) || 'Field';
        const key = slugify(label);
        // pattern = teks asli dari dokumen (untuk matching); label bisa diganti bebas tanpa merusak match
        const f = { uid: uid(), key, label, matchType: 'label_same_line', pattern: label };
        setHeaderFields(prev => [...prev, f]);
    };

    const updateHeaderField = (u, patch) => setHeaderFields(prev => prev.map(f => f.uid === u ? { ...f, ...patch } : f));
    const removeHeaderField = (u) => setHeaderFields(prev => prev.filter(f => f.uid !== u));

    const makeTable = (line) => {
        const cells = cellsFromItems(line.items);
        // simpan pattern = teks asli header dari dokumen; label boleh diedit tanpa merusak matching
        const cols = cells.map(c => ({ uid: uid(), key: slugify(c.text), label: c.text, pattern: c.text, isGroup: false }));
        setTableCols(cols);
    };
    const updateCol = (u, patch) => setTableCols(prev => prev.map(c => c.uid === u ? { ...c, ...patch } : c));
    const removeCol = (u) => setTableCols(prev => prev.filter(c => c.uid !== u));
    // Tambah kolom grup: nilainya ada pada baris DI ATAS baris data (mis. No Faktur di atas item)
    const addGroupCol = () => {
        setTableCols(prev => [...prev, {
            uid: uid(), key: 'no_faktur', label: 'No Faktur (baris di atas)', pattern: "^['’]?\\d{15,}$", isGroup: true,
        }]);
    };

    // ── Validasi semua sampel (training loop) ──
    const validateAll = async () => {
        if (!samples.length) { setError('Upload minimal 1 sampel.'); return; }
        setError(null); setBusy('validate'); setValResults(null);
        try {
            const fd = new FormData();
            const files = [];
            for (const s of samples) {
                const obj = sampleFiles.find(f => f.name === s.filename);
                if (obj) files.push(obj);
                else {
                    const r = await fetch(`${API_URL}/anydoc/templates/samples/file?name=${encodeURIComponent(s.path)}`, { credentials: 'include' });
                    if (r.ok) files.push(new File([await r.blob()], s.filename));
                }
            }
            files.forEach(f => fd.append('files', f));
            fd.append('fields', JSON.stringify(buildFields()));
            fd.append('split_pattern', tplSplitPattern || '');
            fd.append('split_key', tplSplitKey || '');
            const res = await fetch(`${API_URL}/anydoc/templates/validate`, { method: 'POST', credentials: 'include', body: fd });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Gagal validasi.');
            setValResults(j.results);
        } catch (e) { showError(e); } finally { setBusy(null); }
    };

    const buildFields = () => [
        ...headerFields.map((f, i) => ({
            group: 'header', group_key: null, field_key: f.key || slugify(f.label),
            field_label: f.label, match_type: f.matchType, pattern: f.pattern,
            anchor: f.anchor || '', sort_order: i,
        })),
        ...tableCols.map((c, i) => ({
            group: 'table', group_key: 'items', field_key: c.key || slugify(c.label),
            field_label: c.label, match_type: 'label_same_line', pattern: c.pattern || c.label,
            is_group: !!c.isGroup, sort_order: i,
        })),
    ];

    const saveTemplate = async () => {
        if (!activeId) return;
        // Kolom grup wajib punya pola (regex) nilai baris di atas
        const badGroup = tableCols.find(c => c.isGroup && !String(c.pattern || '').trim());
        if (badGroup) { setError('Kolom grup (No Faktur) wajib diisi pola regex nilai baris di atasnya.'); return; }
        setError(null); setBusy('save');
        try {
            const res = await fetch(`${API_URL}/anydoc/templates/${activeId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    name: tplName, doc_type: tplType, description: tplDesc,
                    split_pattern: tplSplitPattern, split_key: tplSplitKey,
                    sample_files: samples,
                    fields: buildFields(),
                }),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Gagal menyimpan template.');
            await loadTemplates();
            showMsg('✅ Template tersimpan.');
        } catch (e) { showError(e); } finally { setBusy(null); }
    };

    // ── Ekstraksi PDF asli ──
    const addExtFiles = (list) => {
        setError(null); setResults([]);
        const ok = [...list].filter(f => /\.(pdf|docx|txt)$/i.test(f.name));
        setExtFiles(prev => {
            const merged = [...prev];
            for (const f of ok) if (!merged.some(x => x.name === f.name && x.size === f.size)) merged.push(f);
            return merged;
        });
    };

    const runExtract = async () => {
        if (!extFiles.length || busy) return;
        setError(null); setBusy('extract'); setResults([]); setMonitoringWarn([]);
        try {
            const fd = new FormData();
            extFiles.forEach(f => fd.append('files', f));
            if (extTplId) fd.append('templateId', extTplId);
            const res = await fetch(`${API_URL}/anydoc/templates/extract`, { method: 'POST', credentials: 'include', body: fd });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Gagal ekstraksi.');
            setResults(j.results || []);
            // Peringatan perubahan layout: file dgn confidence/field/header bermasalah
            const warned = (j.results || []).filter(r => r.success && r.monitoring?.layout_changed)
                .map(r => ({ filename: r.filename, warning: r.monitoring?.warning || '' }));
            setMonitoringWarn(warned);
            loadMonitoring(activeId); // refresh riwayat bulanan
            loadArchive(activeId);    // refresh arsip dokumen
        } catch (e) { showError(e); } finally { setBusy(null); }
    };

    // Update dari DocIntelligenceStudio (patch sebagian: data / items)
    const updateResult = (ri, patch) => setResults(prev => prev.map((r, i) => i === ri ? { ...r, ...patch } : r));

    const downloadExcel = async () => {
        // Guard double-klik: cegah SEMUA kerja ulang (unduhan lokal + POST) bila masih berjalan
        if (savingExportRef.current) return;
        savingExportRef.current = true;
        const okRows = results.filter(r => r.success);
        if (!okRows.length) { savingExportRef.current = false; return; }
        // Map key → label field dari template yang dipakai (header Excel lebih terbaca)
        const usedTpl = templates.find(t => String(t.id) === String(results[0]?.template?.id));
        const labelOf = (key) => usedTpl?.fields?.find(f => f.field_key === key)?.field_label || key;
        // Kumpulkan dokumen dari semua file (hasil bulk punya documents[])
        const docsOf = (r) => (r.documents && r.documents.length) ? r.documents : [{ ...r }];
        const allDocs = okRows.flatMap(docsOf);
        const headerKeys = [...new Set(allDocs.flatMap(d => Object.keys(d.data || {})))];
        const itemKeys = [...new Set(allDocs.flatMap(d => (d.items || []).flatMap(it => Object.keys(it))))];
        const wb = XLSX.utils.book_new();

        // ── Sheet utama: FLAT per-baris item — field header (penjual/npwp/nomor/tgl) diulang di setiap baris ──
        const flatRows = [];
        okRows.forEach(r => {
            docsOf(r).forEach(d => {
                const items = (d.items && d.items.length) ? d.items : [{}];
                items.forEach(it => {
                    const row = { 'Nama File': r.filename };
                    if (d.value) row['No Dokumen'] = d.value;
                    if (d.pageStart) row['Halaman'] = d.pageStart === d.pageEnd ? `hal ${d.pageStart}` : `hal ${d.pageStart}-${d.pageEnd}`;
                    headerKeys.forEach(k => { row[labelOf(k)] = d.data?.[k] ?? ''; });
                    itemKeys.forEach(k => { row[labelOf(k)] = it[k] ?? ''; });
                    flatRows.push(row);
                });
            });
        });
        if (flatRows.length) {
            const ws = XLSX.utils.json_to_sheet(flatRows);
            ws['!cols'] = [{ wch: 26 }, ...(flatRows[0] && 'No Dokumen' in flatRows[0] ? [{ wch: 24 }] : []), ...headerKeys.map(() => ({ wch: 22 })), ...itemKeys.map(() => ({ wch: 16 }))];
            XLSX.utils.book_append_sheet(wb, ws, 'Data per Baris');
        }

        // ── Sheet cadangan: header per dokumen + item mentah ──
        const headerRows = allDocs.map(d => {
            const row = { 'Nama File': okRows.find(r => docsOf(r).includes(d))?.filename || '' };
            if (d.value) row['No Dokumen'] = d.value;
            headerKeys.forEach(k => { row[labelOf(k)] = d.data?.[k] ?? ''; });
            return row;
        });
        const ws1 = XLSX.utils.json_to_sheet(headerRows);
        ws1['!cols'] = [{ wch: 30 }, ...headerKeys.map(() => ({ wch: 18 }))];
        XLSX.utils.book_append_sheet(wb, ws1, 'Header per Dokumen');

        const itemRows = [];
        okRows.forEach(r => docsOf(r).forEach(d =>
            (d.items || []).forEach(it => {
                const row = { 'Nama File': r.filename };
                if (d.value) row['No Dokumen'] = d.value;
                itemKeys.forEach(k => { row[labelOf(k)] = it[k] ?? ''; });
                itemRows.push(row);
            })
        ));
        if (itemRows.length) {
            const ws2 = XLSX.utils.json_to_sheet(itemRows);
            ws2['!cols'] = [{ wch: 30 }, ...itemKeys.map(() => ({ wch: 16 }))];
            XLSX.utils.book_append_sheet(wb, ws2, 'Item Barang');
        }

        // ── Unduh lokal dulu (fungsi inti — selalu jalan) ──
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const title = `ekstrak_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        const fileName = `${title}.xlsx`;
        const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const saveLocal = () => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        };
        saveLocal();

        // ── Simpan ke History Export (server) — best-effort, tidak menghalangi unduhan ──
        try {
            const fd = new FormData();
            fd.append('file', blob, fileName);
            fd.append('title', title);
            if (activeId) fd.append('templateId', activeId);
            fd.append('fileCount', okRows.length);
            fd.append('docCount', allDocs.length);
            fd.append('totalRows', flatRows.length);
            const res = await fetch(`${API_URL}/anydoc/templates/exports`, {
                method: 'POST', credentials: 'include', body: fd,
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Gagal menyimpan export.');
            loadExportHistory(activeId);
            setShowExportHistory(true);
            showMsg('✅ Excel terunduh & tersimpan di History Export.');
        } catch (e) {
            // Unduhan lokal sudah jalan — history gagal disimpan bukan masalah kritis
            console.warn('[AnyDoc] Simpan history export gagal:', e);
        } finally {
            savingExportRef.current = false;
        }
    };

    const inputCls = `flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-xs border outline-none transition-colors ${isDarkMode ? 'bg-white/5 border-white/10 text-white placeholder-white/30 focus:border-indigo-500/60' : 'bg-white border-slate-200 text-slate-700 placeholder-slate-300 focus:border-indigo-400'}`;
    const cardCls = `rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`;
    const labelCls = `text-[10px] font-black uppercase tracking-widest mb-3 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`;
    const chipCls = (active) => active
        ? 'bg-gradient-to-r from-indigo-600 to-purple-700 text-white shadow-md shadow-indigo-500/25'
        : isDarkMode ? 'text-white/50 hover:text-white/90 hover:bg-white/5' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50';

    return (
        <div>
            {error && (
                <div className={`mb-4 flex items-start gap-2.5 p-3.5 rounded-xl border text-sm ${isDarkMode ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-600'}`}>
                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                    <div className="flex-1">{error}</div>
                    <button onClick={() => setError(null)} className="opacity-60 hover:opacity-100"><X size={14} /></button>
                </div>
            )}
            {msg && (
                <div className={`mb-4 flex items-center gap-2 p-3.5 rounded-xl border text-sm ${isDarkMode ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
                    <CheckCircle2 size={16} /> {msg}
                </div>
            )}
            {monitoringWarn.length > 0 && (
                <div className={`mb-4 rounded-xl border p-3.5 text-sm ${isDarkMode ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-300'}`}>
                    <div className={`flex items-center gap-2 font-bold ${isDarkMode ? 'text-amber-300' : 'text-amber-700'}`}>
                        <AlertTriangle size={16} /> Layout dokumen kemungkinan berubah — perlu update mapping template
                    </div>
                    <div className="mt-2 space-y-1.5">
                        {monitoringWarn.map((w, i) => (
                            <div key={i} className={`flex items-start gap-2 text-[11px] ${isDarkMode ? 'text-amber-200/80' : 'text-amber-800/80'}`}>
                                <FileSpreadsheet size={12} className="flex-shrink-0 mt-0.5" />
                                <span className="flex-1"><b>{w.filename}</b>{w.warning ? ` — ${w.warning}` : ''}</span>
                            </div>
                        ))}
                    </div>
                    <p className={`mt-2 text-[10px] ${isDarkMode ? 'text-amber-200/60' : 'text-amber-700/70'}`}>
                        Buka tab <b>Training Mapping</b>, upload sampel layout terbaru, lalu periksa hasil uji & simpan template untuk menyesuaikan.
                    </p>
                </div>
            )}

            {/* ── Ringkasan — konsisten dengan SummaryCard di semua menu ── */}
            <SummaryRow className="mb-5" cards={[
                {
                    title: 'Template',
                    value: templates.length,
                    subtext: 'Jenis dokumen (dibagikan)',
                    icon: FolderOpen,
                    gradient: 'from-indigo-500 to-purple-600',
                },
                {
                    title: 'Ekstraksi',
                    value: extractions.length,
                    subtext: activeId ? 'Riwayat monitoring' : 'Pilih template',
                    icon: Files,
                    gradient: 'from-emerald-500 to-teal-600',
                },
                {
                    title: 'Arsip Dokumen',
                    value: archiveFiles.length,
                    subtext: activeId ? 'PDF asli tersimpan' : 'Pilih template',
                    icon: Archive,
                    gradient: 'from-amber-500 to-orange-600',
                },
                {
                    title: 'Export Excel',
                    value: exportHistory.length,
                    subtext: activeId ? 'Bisa diunduh ulang' : 'Pilih template',
                    icon: FileText,
                    gradient: 'from-violet-500 to-fuchsia-600',
                },
            ]} />

            {/* ── Pilih template / daftar ── */}
            <div className={`${cardCls} p-4 mb-5`}>
                <p className={labelCls}>Template (Jenis Dokumen)</p>
                <p className={`text-[10px] -mt-2 mb-3 flex items-center gap-1.5 ${isDarkMode ? 'text-white/35' : 'text-slate-400'}`}>
                    <Lock size={11} />
                    Template dipakai bersama, tetapi hasil ekstraksi, arsip &amp; export hanya terlihat oleh pembuatnya (admin melihat semua).
                </p>
                {templates.length === 0 && (
                    <p className={`text-xs mb-3 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                        Belum ada template. Buat template baru, upload sampel (1 atau banyak), lalu mapping data satu per satu.
                    </p>
                )}
                <div className="flex flex-wrap gap-2 items-center">
                    {templates.map(t => (
                        <button
                            key={t.id}
                            onClick={() => openTemplate(t)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${activeId === t.id
                                ? isDarkMode ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                : isDarkMode ? 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                            <FolderOpen size={12} /> {t.name}
                            {t.doc_type && <span className={`opacity-50 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>• {t.doc_type}</span>}
                            {t.created_by && (
                                <span className={`text-[9px] font-semibold ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>
                                    • oleh {t.created_by}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
                <div className="flex flex-wrap gap-2 mt-3 items-end">
                    <input value={tplName} onChange={e => setTplName(e.target.value)} placeholder="Nama template baru (mis. Nota Retur)" className={`${inputCls} max-w-[240px]`} />
                    <input value={tplType} onChange={e => setTplType(e.target.value)} placeholder="Jenis dokumen (mis. Nota Retur Internal)" className={`${inputCls} max-w-[200px]`} />
                    <button
                        onClick={createTemplate}
                        disabled={busy}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all ${busy ? 'opacity-50' : 'hover:scale-[1.02]'} ${isDarkMode ? 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30' : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'}`}
                    >
                        <Plus size={13} /> Template Baru
                    </button>
                </div>
            </div>

            {/* ── Sub view tabs (disembunyikan jika lockView) ── */}
            {activeId && !lockView && (
                <div className={`inline-flex p-1 rounded-xl border gap-1 mb-5 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <button onClick={() => setView('train')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${view === 'train' ? chipCls(true) : chipCls(false)}`}>
                        <FlaskConical size={14} /> Training Mapping
                    </button>
                    <button onClick={() => setView('extract')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${view === 'extract' ? chipCls(true) : chipCls(false)}`}>
                        <FileSpreadsheet size={14} /> Ekstrak PDF Asli
                    </button>
                </div>
            )}

            {/* ── VIEW: TRAIN ── */}
            {view === 'train' && activeId && (
                <div className="grid lg:grid-cols-2 gap-6 items-start">
                    {/* KIRI: sampel + baris */}
                    <div className="space-y-4">
                        <div
                            onDragOver={e => e.preventDefault()}
                            onDrop={e => { e.preventDefault(); uploadSamples(e.dataTransfer.files); }}
                            onClick={() => sampleInputRef.current?.click()}
                            className={`rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${isDarkMode ? 'border-white/15 bg-white/5 hover:border-indigo-500/50' : 'border-slate-300 bg-white hover:border-indigo-400'}`}
                        >
                            <input ref={sampleInputRef} type="file" multiple accept=".pdf,.docx,.txt" className="hidden"
                                onChange={e => { uploadSamples(e.target.files); e.target.value = ''; }} />
                            <UploadCloud size={22} className={`mx-auto mb-2 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`} />
                            <p className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>Upload Sampel Dokumen</p>
                            <p className={`text-xs mt-1 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Bisa banyak (berbagai variasi layout jenis dokumen ini)</p>
                        </div>

                        {samples.length > 0 && (
                            <div className={cardCls + ' p-3'}>
                                <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Sampel ({samples.length})</p>
                                <div className="space-y-1.5">
                                    {samples.map((s, i) => (
                                        <div key={i} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                                            <FileSpreadsheet size={12} className={`flex-shrink-0 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-500'}`} />
                                            <span className={`flex-1 min-w-0 truncate text-xs font-semibold ${isDarkMode ? 'text-white/80' : 'text-slate-700'}`}>{s.filename}</span>
                                            <span className={`text-[10px] ${isDarkMode ? 'text-white/35' : 'text-slate-400'}`}>{formatFileSize(s.size)}</span>
                                            <button
                                                onClick={() => loadLines(s)}
                                                disabled={busy === 'lines'}
                                                className={`p-1 rounded-md ${isDarkMode ? 'hover:bg-white/10 text-white/40' : 'hover:bg-slate-200 text-slate-400'}`} title="Lihat baris"
                                            >
                                                <Layers size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {linesData && (
                            <div className={cardCls + ' overflow-hidden'}>
                                <div className={`flex items-center gap-2 px-3 py-2 border-b ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
                                    <Table2 size={13} className={`${isDarkMode ? 'text-indigo-300' : 'text-indigo-500'}`} />
                                    <span className={`text-[11px] font-bold truncate ${isDarkMode ? 'text-white/80' : 'text-slate-600'}`}>Baris: {previewName}</span>
                                </div>
                                <div className="max-h-[420px] overflow-y-auto p-2">
                                    {linesData.pages.map(pg => (
                                        <div key={pg.page} className="mb-2">
                                            <p className={`text-[10px] font-black px-1.5 py-1 ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>Halaman {pg.page}</p>
                                            {pg.lines.map((l, li) => (
                                                <div key={li} className={`group flex items-center gap-1 rounded-lg px-1.5 py-1 cursor-pointer transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-indigo-50'}`}>
                                                    <span className={`text-[9px] w-8 flex-shrink-0 ${isDarkMode ? 'text-white/20' : 'text-slate-300'}`}>{l.y}</span>
                                                    <span className={`flex-1 min-w-0 text-[11px] truncate ${isDarkMode ? 'text-white/70' : 'text-slate-600'}`}>{l.text}</span>
                                                    <button
                                                        onClick={() => addHeaderField(l.text)}
                                                        className={`opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded-md text-[9px] font-bold transition-opacity ${isDarkMode ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-600'}`}
                                                        title="Map sebagai field header"
                                                    >
                                                        Map field
                                                    </button>
                                                    <button
                                                        onClick={() => makeTable(l)}
                                                        className={`opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded-md text-[9px] font-bold transition-opacity ${isDarkMode ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-600'}`}
                                                        title="Jadikan header tabel item"
                                                    >
                                                        Tabel
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* KANAN: mapping + validasi */}
                    <div className="space-y-4">
                        <div className={cardCls + ' p-4'}>
                            <p className={labelCls}>Pemisah Dokumen (PDF Bulk)</p>
                            <p className={`text-[10px] mb-3 ${isDarkMode ? 'text-white/35' : 'text-slate-400'}`}>
                                Isi jika <b>satu PDF berisi banyak dokumen</b> (mis. banyak nota retur).
                                Label yang menandai <b>awal tiap dokumen</b> (mis. <code className="font-mono">NOMOR</code>) — setiap nilai berbeda = dokumen baru;
                                nilai sama di halaman berikutnya = lembar lanjutan dokumen yang sama (3 lembar 1 nomor otomatis digabung).
                            </p>
                            <div className="flex gap-2">
                                <input value={tplSplitPattern} onChange={e => setTplSplitPattern(e.target.value)} className={inputCls} placeholder="Label awal dokumen (mis. NOMOR / NOTA RETUR)" />
                                <input value={tplSplitKey} onChange={e => setTplSplitKey(e.target.value)} className={`${inputCls} max-w-[180px]`} placeholder="ID identitas (mis. nomor_nota_retur)" />
                            </div>
                            {tplSplitPattern && (
                                <p className={`text-[9px] mt-1.5 ${isDarkMode ? 'text-cyan-300/60' : 'text-cyan-600'}`}>
                                    ✓ Aktif: setiap nilai berbeda dari <b>{tplSplitPattern}</b> = dokumen terpisah; export Excel akan memecah per dokumen.
                                </p>
                            )}
                        </div>

                        <div className={cardCls + ' p-4'}>
                            <div className="flex items-center justify-between mb-3">
                                <p className={labelCls + ' mb-0'}>Mapping Field Header</p>
                                <span className={`text-[10px] ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>{headerFields.length} field</span>
                            </div>
                            <p className={`text-[10px] mb-3 ${isDarkMode ? 'text-white/35' : 'text-slate-400'}`}>
                                Klik <b>Map field</b> di baris sampel (kiri). Nilai diambil: baris sama setelah label / baris berikutnya / regex.
                            </p>
                            {headerFields.length === 0 && (
                                <p className={`text-[11px] italic ${isDarkMode ? 'text-white/30' : 'text-slate-300'}`}>Belum ada mapping. Arahkan kursor ke baris di sampel lalu klik "Map field".</p>
                            )}
                            <div className="space-y-2">
                                {headerFields.map(f => (
                                    <div key={f.uid} className={`p-2.5 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                                        <div className="flex gap-1.5 items-center">
                                            <input value={f.label} onChange={e => updateHeaderField(f.uid, { label: e.target.value })} className={inputCls} placeholder="Nama field (mis. No. Invoice)" />
                                            <input value={f.key} onChange={e => updateHeaderField(f.uid, { key: slugify(e.target.value) })} className={`${inputCls} max-w-[130px]`} placeholder="ID" />
                                            <button onClick={() => removeHeaderField(f.uid)} className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-rose-500/20 text-white/40' : 'hover:bg-rose-50 text-slate-400'}`}><Trash2 size={13} /></button>
                                        </div>
                                        <div className="flex gap-1.5 mt-1.5 items-center">
                                            <select value={f.matchType} onChange={e => updateHeaderField(f.uid, { matchType: e.target.value })} className={`${inputCls} max-w-[190px] ${isDarkMode ? 'bg-[#161a2e]' : 'bg-white'}`}>
                                                <option value="label_same_line">Label → nilai (baris sama)</option>
                                                <option value="label_next_line">Label → baris berikutnya</option>
                                                <option value="label_after_anchor">Label di bagian (anchor)</option>
                                                <option value="regex">Pola Regex</option>
                                            </select>
                                            <input value={f.pattern} onChange={e => updateHeaderField(f.uid, { pattern: e.target.value })} className={inputCls} placeholder="Label / pola (mis. NAMA)" />
                                        </div>
                                        {f.matchType === 'label_after_anchor' && (
                                            <div className="flex gap-1.5 mt-1.5 items-center">
                                                <input value={f.anchor} onChange={e => updateHeaderField(f.uid, { anchor: e.target.value })} className={inputCls} placeholder="Bagian (anchor) mis. KEPADA PENJUAL" />
                                                <span className={`text-[9px] ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>label dicari di bawah bagian ini</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={cardCls + ' p-4'}>
                            <div className="flex items-center justify-between mb-3">
                                <p className={labelCls + ' mb-0'}>Tabel Barang (Dinamis)</p>
                                <span className={`text-[10px] ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>{tableCols.length} kolom</span>
                            </div>
                            <p className={`text-[10px] mb-3 ${isDarkMode ? 'text-white/35' : 'text-slate-400'}`}>
                                Klik <b>Tabel</b> di baris header item (mis. "No Model Deskripsi Qty..."). Kolom terdeteksi otomatis dari posisi — atur nama & ID tiap kolom.
                                Kolom <b className="text-purple-500">Grup</b> untuk nilai di baris ATAS data (mis. No Faktur) — diwariskan ke semua baris di bawahnya.
                            </p>
                            {tableCols.length === 0 && (
                                <p className={`text-[11px] italic ${isDarkMode ? 'text-white/30' : 'text-slate-300'}`}>Belum ada tabel. Klik "Tabel" pada baris header item di sampel.</p>
                            )}
                            <div className="flex flex-wrap gap-1.5">
                                {tableCols.map(c => (
                                    <span key={c.uid} className={`inline-flex items-center gap-1 px-1.5 py-1 rounded-lg border ${c.isGroup
                                        ? isDarkMode ? 'bg-purple-500/15 border-purple-500/40' : 'bg-purple-50 border-purple-300'
                                        : isDarkMode ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-emerald-50 border-emerald-200'}`}>
                                        <input value={c.label} onChange={e => updateCol(c.uid, { label: e.target.value })} className={`w-[80px] px-1 py-0.5 rounded text-[10px] border-none bg-transparent outline-none ${c.isGroup ? (isDarkMode ? 'text-purple-200' : 'text-purple-700') : (isDarkMode ? 'text-emerald-200' : 'text-emerald-700')}`} />
                                        <input value={c.key} onChange={e => updateCol(c.uid, { key: slugify(e.target.value) })} className={`w-[70px] px-1 py-0.5 rounded text-[10px] border ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-500'}`} placeholder="id" />
                                        {c.isGroup && (
                                            <input value={c.pattern} onChange={e => updateCol(c.uid, { pattern: e.target.value })} title="Pola regex nilai grup (baris di atas)" className={`w-[110px] px-1 py-0.5 rounded text-[9px] font-mono border ${isDarkMode ? 'bg-white/5 border-purple-500/40 text-purple-200' : 'bg-white border-purple-300 text-purple-700'}`} placeholder="^['’]?\d{15,}$" />
                                        )}
                                        <button
                                            onClick={() => updateCol(c.uid, { isGroup: !c.isGroup })}
                                            title="Jadikan kolom grup: nilainya ada di baris DI ATAS baris data (mis. No Faktur) dan diwariskan ke baris di bawahnya"
                                            className={`px-1 py-0.5 rounded text-[9px] font-bold border transition-all ${c.isGroup
                                                ? isDarkMode ? 'bg-purple-500/30 text-purple-200 border-purple-500/50' : 'bg-purple-200 text-purple-700 border-purple-400'
                                                : isDarkMode ? 'bg-white/5 text-white/40 border-white/10' : 'bg-white text-slate-400 border-slate-200'}`}
                                        >
                                            Grup
                                        </button>
                                        <button onClick={() => removeCol(c.uid)} className={`opacity-50 hover:opacity-100 ${c.isGroup ? (isDarkMode ? 'text-purple-300' : 'text-purple-600') : (isDarkMode ? 'text-emerald-300' : 'text-emerald-600')}`}><X size={11} /></button>
                                    </span>
                                ))}
                            </div>
                            <button
                                onClick={addGroupCol}
                                className={`mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${isDarkMode ? 'bg-purple-500/15 text-purple-300 hover:bg-purple-500/25' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}
                            >
                                <Plus size={11} /> Kolom Grup (No Faktur di atas baris)
                            </button>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                            <button
                                onClick={validateAll}
                                disabled={busy}
                                className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${busy ? 'opacity-50' : 'hover:scale-[1.01]'} ${isDarkMode ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30' : 'bg-purple-100 text-purple-600 hover:bg-purple-200'}`}
                            >
                                {busy === 'validate' ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />} Uji ke Semua Sampel
                            </button>
                            <button
                                onClick={saveTemplate}
                                disabled={busy}
                                className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${busy ? 'opacity-50' : 'hover:scale-[1.01]'} ${isDarkMode ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30' : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'}`}
                            >
                                {busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan Template
                            </button>
                        </div>

                        {valResults && (
                            <div className={cardCls + ' p-4'}>
                                <p className={labelCls}>Hasil Uji (per sampel)</p>
                                <div className="space-y-3">
                                    {valResults.map((vr, vi) => (
                                        <div key={vi} className={`rounded-xl border p-3 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                                            <p className={`text-[11px] font-bold mb-2 flex items-center gap-1.5 ${isDarkMode ? 'text-white/80' : 'text-slate-700'}`}>
                                                <FileSpreadsheet size={12} className={isDarkMode ? 'text-indigo-300' : 'text-indigo-500'} /> {vr.filename}
                                            </p>
                                            <div className="grid gap-1">
                                                {Object.entries(vr.fields || {}).map(([k, r]) => {
                                                    if (k === '__doc_count__') return (
                                                        <div key={k} className={`flex items-center gap-2 text-[11px] ${r > 1 ? (isDarkMode ? 'text-cyan-300' : 'text-cyan-700') : (isDarkMode ? 'text-white/50' : 'text-slate-500')}`}>
                                                            {r > 1 ? <Layers size={12} /> : <CheckCircle2 size={12} />}
                                                            <b>{r} dokumen</b>
                                                            <span className={isDarkMode ? 'text-white/40' : 'text-slate-400'}>{r > 1 ? 'terdeteksi (bulk) — dipecah otomatis' : 'dalam file ini'}</span>
                                                        </div>
                                                    );
                                                    if (k === '__table__') return (
                                                        <div key={k} className={`flex items-center gap-2 text-[11px] ${r.found ? (isDarkMode ? 'text-emerald-300' : 'text-emerald-600') : (isDarkMode ? 'text-rose-300' : 'text-rose-500')}`}>
                                                            {r.found ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                                                            <b>Tabel item</b>
                                                            <span className={isDarkMode ? 'text-white/40' : 'text-slate-400'}>header {r.found ? 'ditemukan' : 'TIDAK'} • {r.rows} baris</span>
                                                        </div>
                                                    );
                                                    return (
                                                        <div key={k} className={`flex items-center gap-2 text-[11px] ${r.found ? (isDarkMode ? 'text-emerald-300' : 'text-emerald-600') : (isDarkMode ? 'text-rose-300' : 'text-rose-500')}`}>
                                                            {r.found ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                                                            <span className={`w-24 truncate font-bold ${isDarkMode ? 'text-white/60' : 'text-slate-500'}`}>{r.label}</span>
                                                            {r.found ? <span className="truncate">{r.value}</span> : <span>TIDAK DITEMUKAN</span>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── VIEW: EXTRACT ── */}
            {view === 'extract' && activeId && (
                <div className="space-y-5">
                    <div className="grid lg:grid-cols-3 gap-5 items-start">
                        <div className="space-y-4 lg:col-span-1">
                            <div
                                onDragOver={e => e.preventDefault()}
                                onDrop={e => { e.preventDefault(); addExtFiles(e.dataTransfer.files); }}
                                onClick={() => extInputRef.current?.click()}
                                className={`rounded-2xl border-2 border-dashed p-7 text-center cursor-pointer transition-all ${isDarkMode ? 'border-white/15 bg-white/5 hover:border-emerald-500/50' : 'border-slate-300 bg-white hover:border-emerald-400'}`}
                            >
                                <input ref={extInputRef} type="file" multiple accept=".pdf,.docx,.txt" className="hidden"
                                    onChange={e => { addExtFiles(e.target.files); e.target.value = ''; }} />
                                <FileSpreadsheet size={24} className={`mx-auto mb-2 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`} />
                                <p className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>Upload PDF Asli</p>
                                <p className={`text-xs mt-1 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Banyak file sekaligus — template terdeteksi otomatis dari label/judul</p>
                            </div>

                            {extFiles.length > 0 && (
                                <div className={cardCls + ' p-3'}>
                                    <div className="space-y-1.5">
                                        {extFiles.map((f, i) => (
                                            <div key={i} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                                                <FileSpreadsheet size={12} className={`flex-shrink-0 ${isDarkMode ? 'text-emerald-300' : 'text-emerald-600'}`} />
                                                <span className={`flex-1 min-w-0 truncate text-xs font-semibold ${isDarkMode ? 'text-white/80' : 'text-slate-700'}`}>{f.name}</span>
                                                <span className={`text-[10px] flex-shrink-0 ${isDarkMode ? 'text-white/35' : 'text-slate-400'}`}>{formatFileSize(f.size)}</span>
                                                <button onClick={() => setExtFiles(prev => prev.filter((_, x) => x !== i))} className={`p-1 rounded-md ${isDarkMode ? 'hover:bg-white/10 text-white/40' : 'hover:bg-slate-200 text-slate-400'}`}><X size={12} /></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className={cardCls + ' p-4'}>
                                <p className={labelCls}>Pilih Template</p>
                                <div className="flex flex-wrap gap-1.5">
                                    <button
                                        onClick={() => setExtTplId('')}
                                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${!extTplId
                                            ? isDarkMode ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                            : isDarkMode ? 'bg-white/5 border-white/10 text-white/50' : 'bg-white border-slate-200 text-slate-500'}`}
                                    >
                                        <Sparkles size={11} className="inline mr-1" /> Deteksi Otomatis
                                    </button>
                                    {templates.map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => setExtTplId(String(t.id))}
                                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${String(extTplId) === String(t.id)
                                                ? isDarkMode ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                                : isDarkMode ? 'bg-white/5 border-white/10 text-white/50' : 'bg-white border-slate-200 text-slate-500'}`}
                                        >
                                            {t.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={runExtract}
                                disabled={!extFiles.length || busy}
                                className={`w-full py-3.5 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all ${!extFiles.length || busy
                                    ? isDarkMode ? 'bg-white/5 text-white/30 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]'}`}
                            >
                                {busy === 'extract' ? <><Loader2 size={17} className="animate-spin" /> Mengekstrak {extFiles.length} file...</> : <><Sparkles size={17} /> Ekstrak dengan Template</>}
                            </button>
                        </div>

                        <div className="lg:col-span-2 space-y-4">
                            {results.length === 0 ? (
                                <div className={`rounded-2xl border-2 border-dashed p-10 text-center min-h-[300px] flex flex-col items-center justify-center ${isDarkMode ? 'border-white/10 bg-white/2' : 'border-slate-200 bg-white/50'}`}>
                                    <div className={`text-5xl mb-4 ${isDarkMode ? 'opacity-30' : 'opacity-20'}`}>🗂️ → 🔍</div>
                                    <p className={`text-sm font-bold ${isDarkMode ? 'text-white/60' : 'text-slate-500'}`}>AI Document Intelligence</p>
                                    <p className={`text-xs mt-1 max-w-xs ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>
                                        Upload PDF asli di kiri lalu klik Ekstrak. Hasil tampil di dokumen dengan kotak deteksi + confidence — ala Azure Document Intelligence Studio.
                                    </p>
                                </div>
                            ) : (
                                <DocIntelligenceStudio
                                    files={extFiles}
                                    results={results}
                                    isDarkMode={isDarkMode}
                                    onUpdateResult={updateResult}
                                    onDownloadExcel={downloadExcel}
                                />
                            )}
                        </div>
                    </div>

                    {/* ── Monitoring hasil bulanan + peringatan layout ── */}
                    <div className={cardCls + ' overflow-hidden'}>
                        <button
                            onClick={() => setShowMonitor(s => !s)}
                            className={`w-full flex items-center gap-2.5 px-4 py-3 text-left transition-colors ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}
                        >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-cyan-500/15 text-cyan-300' : 'bg-cyan-100 text-cyan-600'}`}>
                                <BarChart3 size={15} />
                            </div>
                            <div className="flex-1">
                                <p className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>Monitoring Hasil Bulanan</p>
                                <p className={`text-[10px] ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Riwayat ekstraksi per periode — deteksi perubahan layout dokumen</p>
                            </div>
                            <button
                                onClick={e => { e.stopPropagation(); loadMonitoring(activeId); }}
                                className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-white/10 text-white/50' : 'hover:bg-slate-200 text-slate-400'}`} title="Muat ulang"
                            >
                                <RefreshCw size={12} className={monitorBusy ? 'animate-spin' : ''} />
                            </button>
                            <span className={`transition-transform ${showMonitor ? 'rotate-180' : ''}`}>
                                <ChevronDown size={15} className={isDarkMode ? 'text-white/40' : 'text-slate-400'} />
                            </span>
                        </button>

                        {showMonitor && (
                            <div className={`border-t ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
                                {extractionSummary.length === 0 && (
                                    <div className={`px-6 py-8 text-center ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                                        <div className={`w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-white/5 text-white/30' : 'bg-slate-100 text-slate-300'}`}>
                                            <BarChart3 size={22} />
                                        </div>
                                        <p className={`text-xs font-bold ${isDarkMode ? 'text-white/70' : 'text-slate-600'}`}>Belum ada riwayat ekstraksi</p>
                                        <p className="text-[10px] mt-1 max-w-[280px] mx-auto leading-relaxed">
                                            Lakukan ekstraksi — hasil terekam otomatis per periode dokumen (bulan dari nomor nota / tanggal).
                                        </p>
                                    </div>
                                )}
                                {extractionSummary.length > 0 && (
                                    <>
                                        <div className={`grid grid-cols-3 gap-2 px-4 py-3 border-b ${isDarkMode ? 'border-white/5 bg-white/5' : 'border-slate-100 bg-slate-50/50'}`}>
                                            {[
                                                { label: 'Periode', value: extractionSummary.length, icon: BarChart3 },
                                                { label: 'Dokumen', value: extractionSummary.reduce((a, s) => a + (Number(s.doc_count) || 0), 0), icon: FileSpreadsheet },
                                                { label: 'Baris Data', value: extractionSummary.reduce((a, s) => a + (Number(s.total_rows) || 0), 0), icon: Table2 },
                                            ].map(st => {
                                                const Icon = st.icon;
                                                return (
                                                    <div key={st.label} className={`rounded-xl px-3 py-2 border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                                                        <div className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-white/35' : 'text-slate-400'}`}>
                                                            <Icon size={10} className={isDarkMode ? 'text-cyan-300' : 'text-cyan-600'} /> {st.label}
                                                        </div>
                                                        <p className={`mt-0.5 text-sm font-black tabular-nums ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{st.value.toLocaleString('id-ID')}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="overflow-x-auto">
                                        <table className="w-full text-left text-[11px]">
                                            <thead>
                                                <tr className={`border-b ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
                                                    <th className={`px-3 py-2 text-[9px] font-black uppercase ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Periode</th>
                                                    <th className={`px-3 py-2 text-[9px] font-black uppercase ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>File</th>
                                                    <th className={`px-3 py-2 text-[9px] font-black uppercase ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Dokumen</th>
                                                    <th className={`px-3 py-2 text-[9px] font-black uppercase ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Baris</th>
                                                    <th className={`px-3 py-2 text-[9px] font-black uppercase ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Confidence</th>
                                                    <th className={`px-3 py-2 text-[9px] font-black uppercase ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Masalah Layout</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {extractionSummary.map((s, i) => {
                                                    const conf = Number(s.avg_confidence || 0);
                                                    const issues = Number(s.layout_issues || 0);
                                                    return (
                                                        <tr key={i} className={`border-b ${isDarkMode ? 'border-white/5' : 'border-slate-50'}`}>
                                                            <td className={`px-3 py-2 font-bold ${isDarkMode ? 'text-white/80' : 'text-slate-700'}`}>{s.period}</td>
                                                            <td className={`px-3 py-2 ${isDarkMode ? 'text-white/60' : 'text-slate-500'}`}>{s.file_count}</td>
                                                            <td className={`px-3 py-2 ${isDarkMode ? 'text-white/60' : 'text-slate-500'}`}>{s.doc_count}</td>
                                                            <td className={`px-3 py-2 ${isDarkMode ? 'text-white/60' : 'text-slate-500'}`}>{s.total_rows}</td>
                                                            <td className={`px-3 py-2`}>
                                                                <span className={`font-bold ${conf >= 0.9 ? 'text-emerald-500' : conf >= 0.7 ? 'text-amber-500' : 'text-rose-500'}`}>
                                                                    {Math.round(conf * 100)}%
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                {issues > 0
                                                                    ? <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black ${isDarkMode ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'}`}><AlertTriangle size={9} /> {issues} file</span>
                                                                    : <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black ${isDarkMode ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-600'}`}><CheckCircle2 size={9} /> Normal</span>}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                        </div>
                                    </>
                                )}

                                {extractions.length > 0 && (
                                    <div className={`border-t ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
                                        <div className={`px-4 py-2.5 flex items-center gap-1.5 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                                            <History size={11} />
                                            <span className="text-[9px] font-black uppercase tracking-widest">Riwayat Ekstraksi Terakhir</span>
                                        </div>
                                        <div className="max-h-[220px] overflow-y-auto pb-1">
                                            {extractions.map((x, i) => (
                                                <div key={i} className={`flex items-center gap-2 px-4 py-1.5 ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${x.layout_changed ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                                    <span className={`text-[11px] font-semibold flex-1 min-w-0 truncate ${isDarkMode ? 'text-white/70' : 'text-slate-600'}`}>{x.filename}</span>
                                                    <span className={`text-[10px] ${isDarkMode ? 'text-white/35' : 'text-slate-400'}`}>{x.period}</span>
                                                    <span className={`text-[10px] ${isDarkMode ? 'text-white/35' : 'text-slate-400'}`}>{x.doc_count} dok • {x.total_rows} baris</span>
                                                    {x.layout_changed
                                                        ? <span title={x.warning || ''} className={`text-[9px] font-bold ${isDarkMode ? 'text-amber-300' : 'text-amber-600'}`}>⚠ layout</span>
                                                        : <CheckCircle2 size={11} className={isDarkMode ? 'text-emerald-400' : 'text-emerald-500'} />}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Arsip Dokumen: penyimpanan PDF asli — unduh / ekstrak ulang tanpa upload ── */}
                    <div className={cardCls + ' overflow-hidden'}>
                        <button
                            onClick={() => setShowArchive(s => !s)}
                            className={`w-full flex items-center gap-2.5 px-4 py-3 text-left transition-colors ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}
                        >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-100 text-amber-600'}`}>
                                <FolderOpen size={15} />
                            </div>
                            <div className="flex-1">
                                <p className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>Arsip Dokumen (Penyimpanan)</p>
                                <p className={`text-[10px] ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>PDF asli tersimpan otomatis setelah ekstraksi — unduh atau ekstrak ulang tanpa upload</p>
                                <p className={`text-[9px] mt-0.5 flex items-center gap-1 ${isDarkMode ? 'text-amber-300/60' : 'text-amber-600/70'}`}><Lock size={9} /> Pribadi: hanya pembuat (atau admin) — bisa dibagikan ke departemen lain via ikon <Share2 size={9} className="inline" /></p>
                            </div>
                            <button
                                onClick={e => { e.stopPropagation(); loadArchive(activeId); }}
                                className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-white/10 text-white/50' : 'hover:bg-slate-200 text-slate-400'}`} title="Muat ulang"
                            >
                                <RefreshCw size={12} className={archiveBusy ? 'animate-spin' : ''} />
                            </button>
                            <span className={`transition-transform ${showArchive ? 'rotate-180' : ''}`}>
                                <ChevronDown size={15} className={isDarkMode ? 'text-white/40' : 'text-slate-400'} />
                            </span>
                        </button>

                        {showArchive && (
                            <div className={`border-t ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
                                {archiveFiles.length === 0 && (
                                    <p className={`px-4 py-4 text-[11px] italic ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>
                                        Belum ada arsip. Lakukan ekstraksi — file PDF asli otomatis tersimpan di sini untuk periode berikutnya (tanpa upload ulang).
                                    </p>
                                )}
                                {archiveFiles.length > 0 && (
                                    <>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-[11px]">
                                                <thead>
                                                    <tr className={`border-b ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
                                                        <th className={`px-3 py-2 text-[9px] font-black uppercase ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Pilih</th>
                                                        <th className={`px-3 py-2 text-[9px] font-black uppercase ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>File</th>
                                                        <th className={`px-3 py-2 text-[9px] font-black uppercase ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Periode</th>
                                                        <th className={`px-3 py-2 text-[9px] font-black uppercase ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Dokumen</th>
                                                        <th className={`px-3 py-2 text-[9px] font-black uppercase ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Baris</th>
                                                        <th className={`px-3 py-2 text-[9px] font-black uppercase ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Privasi</th>
                                                        <th className={`px-3 py-2 text-[9px] font-black uppercase ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Ukuran</th>
                                                        <th className={`px-3 py-2 text-[9px] font-black uppercase ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Aksi</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {archiveFiles.map(x => (
                                                        <tr key={x.id} className={`border-b ${isDarkMode ? 'border-white/5' : 'border-slate-50'} ${archiveSel.has(Number(x.id)) ? (isDarkMode ? 'bg-amber-500/10' : 'bg-amber-50/60') : ''}`}>
                                                            <td className="px-3 py-2">
                                                                <input type="checkbox" checked={archiveSel.has(Number(x.id))}
                                                                    onChange={() => toggleArchiveSel(Number(x.id))}
                                                                    className="accent-amber-500" />
                                                            </td>
                                                            <td className={`px-3 py-2 min-w-[160px] truncate max-w-[220px] ${isDarkMode ? 'text-white/80' : 'text-slate-700'}`}>
                                                                <span className="font-semibold">{x.filename}</span>
                                                                {x.created_by && (
                                                                    <span className={`block text-[9px] font-normal ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>oleh {x.created_by}</span>
                                                                )}
                                                            </td>
                                                            <td className={`px-3 py-2 ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>{x.period}</td>
                                                            <td className={`px-3 py-2 ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>{x.doc_count}</td>
                                                            <td className={`px-3 py-2 ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>{x.total_rows}</td>
                                                            <td className="px-3 py-2">
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
                                                            </td>
                                                            <td className={`px-3 py-2 ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>{formatFileSize(x.size)}</td>
                                                            <td className="px-3 py-2">
                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        onClick={() => downloadArchived(x)}
                                                                        title="Unduh PDF asli"
                                                                        className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-indigo-500/20 text-indigo-300' : 'hover:bg-indigo-50 text-indigo-500'}`}
                                                                    >
                                                                        <Download size={13} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => reExtractArchived(x)}
                                                                        disabled={busy === 'extract'}
                                                                        title="Ekstrak ulang tanpa upload"
                                                                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold transition-all ${busy === 'extract' ? 'opacity-40' : ''} ${isDarkMode ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                                                                    >
                                                                        <Sparkles size={9} /> Ekstrak Lagi
                                                                    </button>
                                                                    {canManage(x) && (
                                                                        <button
                                                                            onClick={() => openShare('archive', x)}
                                                                            title="Bagikan ke departemen lain"
                                                                            className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-sky-500/20 text-sky-300' : 'hover:bg-sky-50 text-sky-500'}`}
                                                                        >
                                                                            <Share2 size={12} />
                                                                        </button>
                                                                    )}
                                                                    {canManage(x) && (
                                                                        <button
                                                                            onClick={() => deleteArchived(x)}
                                                                            title="Hapus dari arsip"
                                                                            className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-rose-500/20 text-white/40' : 'hover:bg-rose-50 text-slate-400'}`}
                                                                        >
                                                                            <Trash2 size={12} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        {archiveSel.size > 0 && (
                                            <div className={`px-3 py-2.5 border-t flex items-center gap-2 ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
                                                <button
                                                    onClick={reExtractBatch}
                                                    disabled={busy === 'extract'}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${busy === 'extract' ? 'opacity-50' : 'hover:scale-[1.01]'} ${isDarkMode ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30' : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'}`}
                                                >
                                                    {busy === 'extract' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Ekstrak {archiveSel.size} File dari Arsip
                                                </button>
                                                <button
                                                    onClick={() => setArchiveSel(new Set())}
                                                    className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold ${isDarkMode ? 'text-white/40 hover:bg-white/5' : 'text-slate-400 hover:bg-slate-100'}`}
                                                >
                                                    Batal
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── History Export Excel: unduh ulang tanpa extract ulang ── */}
                    <div className={cardCls + ' overflow-hidden'}>
                        <button
                            onClick={() => setShowExportHistory(s => !s)}
                            className={`w-full flex items-center gap-2.5 px-4 py-3 text-left transition-colors ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}
                        >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-600'}`}>
                                <Download size={15} />
                            </div>
                            <div className="flex-1">
                                <p className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>History Export Excel</p>
                                <p className={`text-[10px] ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>File Excel yang pernah di-export — unduh ulang kapan saja tanpa extract ulang</p>
                                <p className={`text-[9px] mt-0.5 flex items-center gap-1 ${isDarkMode ? 'text-emerald-300/60' : 'text-emerald-600/70'}`}><Lock size={9} /> Pribadi: hanya pembuat (atau admin) — bisa dibagikan ke departemen lain via ikon <Share2 size={9} className="inline" /></p>
                            </div>
                            {exportHistory.length > 0 && (
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${isDarkMode ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-600'}`}>
                                    {exportHistory.length}
                                </span>
                            )}
                            <button
                                onClick={e => { e.stopPropagation(); loadExportHistory(activeId); }}
                                className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-white/10 text-white/50' : 'hover:bg-slate-200 text-slate-400'}`} title="Muat ulang"
                            >
                                <RefreshCw size={12} className={exportBusy ? 'animate-spin' : ''} />
                            </button>
                            <span className={`transition-transform ${showExportHistory ? 'rotate-180' : ''}`}>
                                <ChevronDown size={15} className={isDarkMode ? 'text-white/40' : 'text-slate-400'} />
                            </span>
                        </button>

                        {showExportHistory && (
                            <div className={`border-t ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
                                {exportHistory.length === 0 && (
                                    <div className={`px-6 py-8 text-center ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                                        <div className={`w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-white/5 text-white/30' : 'bg-slate-100 text-slate-300'}`}>
                                            <History size={22} />
                                        </div>
                                        <p className={`text-xs font-bold ${isDarkMode ? 'text-white/70' : 'text-slate-600'}`}>Belum ada export tersimpan</p>
                                        <p className="text-[10px] mt-1 max-w-[260px] mx-auto leading-relaxed">
                                            Lakukan ekstraksi lalu klik "Export Excel" — file otomatis tersimpan di sini untuk diunduh ulang kapan saja tanpa extract ulang.
                                        </p>
                                    </div>
                                )}
                                {exportHistory.length > 0 && (
                                    <>
                                        <div className={`grid grid-cols-3 gap-2 px-4 py-3 border-b ${isDarkMode ? 'border-white/5 bg-white/5' : 'border-slate-100 bg-slate-50/50'}`}>
                                            {[
                                                { label: 'Total Export', value: exportHistory.length, icon: Download },
                                                { label: 'Dokumen', value: exportHistory.reduce((a, x) => a + (x.doc_count || 0), 0), icon: FileSpreadsheet },
                                                { label: 'Baris Data', value: exportHistory.reduce((a, x) => a + (x.total_rows || 0), 0), icon: Table2 },
                                            ].map(st => {
                                                const Icon = st.icon;
                                                return (
                                                    <div key={st.label} className={`rounded-xl px-3 py-2 border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                                                        <div className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-white/35' : 'text-slate-400'}`}>
                                                            <Icon size={10} className={isDarkMode ? 'text-emerald-300' : 'text-emerald-600'} /> {st.label}
                                                        </div>
                                                        <p className={`mt-0.5 text-sm font-black tabular-nums ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{st.value.toLocaleString('id-ID')}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="max-h-[300px] overflow-y-auto">
                                        {exportHistory.map(x => {
                                            const t = x.created_at ? new Date(x.created_at) : null;
                                            const dateStr = t && !isNaN(t) ? t.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '';
                                            return (
                                                <div key={x.id} className={`group flex items-center gap-2.5 px-4 py-2.5 border-b last:border-b-0 ${isDarkMode ? 'border-white/5 hover:bg-white/5' : 'border-slate-50 hover:bg-slate-50'}`}>
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-600'}`}>
                                                        <FileSpreadsheet size={14} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-[11px] font-bold truncate ${isDarkMode ? 'text-white/80' : 'text-slate-700'}`}>{x.title}</p>
                                                        <p title={dateStr} className={`text-[9px] truncate ${isDarkMode ? 'text-white/35' : 'text-slate-400'}`}>
                                                            {formatRelativeTime(x.created_at)}{formatRelativeTime(x.created_at) ? ' • ' : ''}{x.file_count ?? 0} file • {x.doc_count ?? 0} dok • {x.total_rows ?? 0} baris • {formatFileSize(x.file_size)}
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
                                                    <button
                                                        onClick={() => downloadExportFile(x)}
                                                        disabled={x.fileExists === false}
                                                        title="Unduh ulang Excel ini (tanpa extract ulang)"
                                                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${x.fileExists === false ? 'opacity-40 cursor-not-allowed' : 'hover:scale-[1.02]'} ${isDarkMode ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                                                    >
                                                        <Download size={11} /> Unduh
                                                    </button>
                                                    {canManage(x) && (
                                                        <button
                                                            onClick={() => openShare('export', x)}
                                                            title="Bagikan ke departemen lain"
                                                            className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-sky-500/20 text-sky-300' : 'hover:bg-sky-50 text-sky-500'}`}
                                                        >
                                                            <Share2 size={12} />
                                                        </button>
                                                    )}
                                                    {canManage(x) && (
                                                        <button
                                                            onClick={() => setDelExportTarget(x)}
                                                            title="Hapus history export ini"
                                                            className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'text-white/25 hover:text-rose-300 hover:bg-rose-500/15' : 'text-slate-300 hover:text-rose-500 hover:bg-rose-50'}`}
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Modal konfirmasi hapus history export ── */}
            {delExportTarget && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setDelExportTarget(null)}>
                    <div
                        onClick={e => e.stopPropagation()}
                        className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl animate-[fadeInUp_.2s_ease] ${isDarkMode ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}`}
                    >
                        <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-50 text-rose-500'}`}>
                                <AlertTriangle size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Hapus history export?</p>
                                <p className={`text-[11px] mt-1 leading-relaxed ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>
                                    <b className={isDarkMode ? 'text-white/80' : 'text-slate-700'}>{delExportTarget.title}</b> akan dihapus permanen dari riwayat beserta file Excel-nya di server. Tindakan ini tidak dapat dibatalkan.
                                </p>
                            </div>
                        </div>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                onClick={() => setDelExportTarget(null)}
                                className={`px-3.5 py-2 rounded-xl text-[11px] font-bold transition-colors ${isDarkMode ? 'bg-white/10 text-white/70 hover:bg-white/15' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                Batal
                            </button>
                            <button
                                onClick={deleteExport}
                                disabled={delExportBusy}
                                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all ${delExportBusy ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'} ${isDarkMode ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30' : 'bg-rose-500 text-white hover:bg-rose-600'}`}
                            >
                                {delExportBusy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Hapus Permanen
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal Bagikan ke Departemen (portal ke body agar backdrop full-layar) ── */}
            {shareTarget && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShareTarget(null)}>
                    <div
                        onClick={e => e.stopPropagation()}
                        className={`w-full max-w-md rounded-2xl border p-5 shadow-2xl animate-[fadeInUp_.2s_ease] ${isDarkMode ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}`}
                    >
                        <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-sky-500/15 text-sky-300' : 'bg-sky-50 text-sky-500'}`}>
                                <Share2 size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Bagikan ke Departemen</p>
                                <p className={`text-[11px] mt-1 leading-relaxed ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>
                                    <b className={isDarkMode ? 'text-white/80' : 'text-slate-700'}>{shareTarget.row.filename || shareTarget.row.title}</b>
                                    <br />
                                    Anggota departemen terpilih bisa <b>melihat &amp; mengunduh</b> dokumen ini (tidak bisa edit/hapus). Kosongkan semua untuk kembali pribadi.
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
            , document.body)}
        </div>
    );
}
