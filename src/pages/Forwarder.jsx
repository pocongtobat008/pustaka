import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

// Daftarkan semua modul community AG Grid (editing, filter, sorting, autosize, row API, dll)
ModuleRegistry.registerModules([AllCommunityModule]);
import {
    Ship, Plus, Trash2, Download, RefreshCw, Search, Loader2, Save, Info, Users, FileSpreadsheet
} from 'lucide-react';
import { apiClient, API_URL } from '../services/apiClient';
import { useLanguage } from '../contexts/LanguageContext';
import { SummaryRow } from '../components/ui/Card';
import { useToast } from '../components/ui/Toast';
import { useModalKeydown, useModalScrollLock } from '../components/ui/useModalKeydown';

// ── Kolom laporan (gabungan semua divisi) ──
const ALL_FIELDS = [
    { key: 'delivery_month', label: 'DELIVERY MONTH' },
    { key: 'imp_exp', label: 'IMP / EXP Commercial Transfer' },
    { key: 'forwarder_name', label: 'FORWARDER NAME' },
    { key: 'bl_awb', label: 'BL / AWB (EXIM)' },
    { key: 'inv_no_i', label: 'INV No. (I)' },
    { key: 'inv_no_ii', label: 'INV No. (II)' },
    { key: 'yadin_inv_sj', label: 'YADIN INV. / SJ' },
    { key: 'from_to', label: 'From / To' },
];

// ── Kolom per divisi (setiap divisi mengisi kolom yang relevan) ──
const DIVISION_PRESETS = {
    all: ALL_FIELDS.map(f => f.key),
    // Konsep: tiap divisi mengisi kolom tertentu → digabung jadi 1 laporan penuh
    EXIM: ['delivery_month', 'imp_exp', 'forwarder_name', 'bl_awb', 'inv_no_i', 'inv_no_ii', 'yadin_inv_sj'],
    Marketing: ['imp_exp', 'forwarder_name', 'bl_awb', 'from_to', 'notes'],
    Accounting: ['delivery_month', 'forwarder_name', 'inv_no_i', 'inv_no_ii', 'yadin_inv_sj', 'from_to'],
    Tax: ALL_FIELDS.map(f => f.key),
    Warehouse: ['delivery_month', 'forwarder_name', 'bl_awb', 'from_to'],
    IT: ALL_FIELDS.map(f => f.key),
    General: ALL_FIELDS.map(f => f.key),
};

const FIELD_SHORT = {
    delivery_month: 'MONTH', imp_exp: 'IMP/EXP', forwarder_name: 'FORWARDER',
    bl_awb: 'BL/AWB', inv_no_i: 'INV I', inv_no_ii: 'INV II',
    yadin_inv_sj: 'YADIN/SJ', from_to: 'FROM/TO', notes: 'NOTES',
};

const DIVISION_COLORS = {
    EXIM: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
    Marketing: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300',
    Accounting: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
    Tax: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    Warehouse: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
    IT: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
    General: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-white/70',
};

const divColor = (d) => DIVISION_COLORS[d] || 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300';

export default function Forwarder({ isDarkMode, currentUser }) {
    const { language, t } = useLanguage();
    const isEnglish = language === 'en';
    const { toast } = useToast();

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [divisions, setDivisions] = useState([]);
    const [divisionFilter, setDivisionFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [saveState, setSaveState] = useState(null); // null | 'saving' | { savedAt }
    const [adding, setAdding] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const gridRef = useRef(null);
    const dirtyMap = useRef(new Map()); // rowId -> { fields: {key: value} }
    const flushTimer = useRef(null);
    const savingRef = useRef(false);
    const justStoppedRef = useRef(false);
    const stopResetTimer = useRef(null);

    const isAdmin = ['admin', 'superadmin'].includes(String(currentUser?.role || '').toLowerCase());
    const myDivision = currentUser?.department || currentUser?.division || 'General';

    const fetchDivisions = useCallback(async () => {
        try {
            const res = await apiClient.fetchJson(`${API_URL}/forwarder/divisions`);
            setDivisions(res.divisions || []);
        } catch { /* non-fatal */ }
    }, []);

    const fetchData = useCallback(async (opts = {}) => {
        if (!opts.silent) setLoading(true);
        try {
            const params = new URLSearchParams();
            if (divisionFilter && divisionFilter !== 'all') params.set('division', divisionFilter);
            if (search) params.set('search', search);
            params.set('perPage', '2000');
            const res = await apiClient.fetchJson(`${API_URL}/forwarder?${params.toString()}`);
            setRows(res.data || []);
        } catch (err) {
            toast.error(err.message || (isEnglish ? 'Failed to load forwarder data' : 'Gagal memuat data forwarder'));
        } finally {
            setLoading(false);
        }
    }, [divisionFilter, search, toast, isEnglish]);

    useEffect(() => { fetchData(); fetchDivisions(); }, [fetchData, fetchDivisions]);

    // ── Auto-save ala Excel (debounce) ──
    const flushDirty = useCallback(async () => {
        if (savingRef.current) return;
        const map = dirtyMap.current;
        if (map.size === 0) return;
        savingRef.current = true;
        setSaveState('saving');
        const entries = [...map.entries()];
        map.clear();
        try {
            await Promise.all(entries.map(async ([rowId, dirty]) => {
                const payload = {};
                Object.entries(dirty.fields).forEach(([k, v]) => { payload[k] = v; });
                try {
                    await apiClient.fetchJson(`${API_URL}/forwarder/${rowId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });
                } catch (e) {
                    toast.error(e.message || (isEnglish ? 'Failed to save row' : 'Gagal menyimpan baris'));
                }
            }));
            setSaveState({ savedAt: new Date() });
        } finally {
            savingRef.current = false;
        }
    }, [toast, isEnglish]);

    const scheduleFlush = useCallback(() => {
        if (flushTimer.current) clearTimeout(flushTimer.current);
        flushTimer.current = setTimeout(() => { flushDirty(); }, 500);
    }, [flushDirty]);

    useEffect(() => () => {
        if (flushTimer.current) clearTimeout(flushTimer.current);
        if (stopResetTimer.current) clearTimeout(stopResetTimer.current);
    }, []);

    const onCellValueChanged = useCallback((params) => {
        const row = params.data;
        if (!row || !row.id) return;
        const field = params.colDef?.field;
        if (!field || field === 'id' || field === 'division') return;
        const value = params.newValue == null ? '' : String(params.newValue);
        const existing = dirtyMap.current.get(row.id);
        if (existing) existing.fields[field] = value;
        else dirtyMap.current.set(row.id, { fields: { [field]: value } });
        scheduleFlush();
    }, [scheduleFlush]);

    const addRow = useCallback(async () => {
        if (adding) return;
        setAdding(true);
        try {
            const division = divisionFilter !== 'all' ? divisionFilter : (isAdmin ? 'General' : myDivision);
            const res = await apiClient.fetchJson(`${API_URL}/forwarder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ division }),
            });
            setRows(prev => [...prev, res]);
            toast.success(isEnglish ? 'New row added — start typing to fill' : 'Baris baru ditambahkan — mulai ketik untuk mengisi');
            setTimeout(() => {
                const api = gridRef.current?.api;
                if (api) {
                    const node = api.getRowNode(String(res.id));
                    if (node) api.ensureNodeVisible(node);
                }
            }, 150);
        } catch (e) {
            toast.error(e.message || (isEnglish ? 'Failed to add row' : 'Gagal menambah baris'));
        } finally {
            setAdding(false);
        }
    }, [adding, divisionFilter, isAdmin, myDivision, toast, isEnglish]);

    const handleDelete = useCallback(async () => {
        if (deleting || !deleteTarget) return;
        setDeleting(true);
        try {
            await apiClient.fetchJson(`${API_URL}/forwarder/${deleteTarget.id}`, { method: 'DELETE' });
            dirtyMap.current.delete(deleteTarget.id);
            setRows(prev => prev.filter(r => r.id !== deleteTarget.id));
            toast.success(isEnglish ? 'Row deleted' : 'Baris dihapus');
            setDeleteTarget(null);
        } catch (e) {
            toast.error(e.message || (isEnglish ? 'Failed to delete row' : 'Gagal menghapus baris'));
        } finally {
            setDeleting(false);
        }
    }, [deleting, deleteTarget, toast, isEnglish]);

    // ── Definisi kolom AG Grid ──
    const columnDefs = useMemo(() => {
        const preset = DIVISION_PRESETS[divisionFilter] || ALL_FIELDS.map(f => f.key);
        const cols = [];
        if (divisionFilter === 'all') {
            cols.push({
                field: 'division', headerName: 'DIVISI', width: 130, pinned: 'left', sortable: true, filter: true,
                cellRenderer: (p) => (
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold inline-block mt-1.5 ${divColor(p.value)}`}>{p.value || '-'}</span>
                ),
            });
        }
        ALL_FIELDS.forEach(f => {
            cols.push({
                field: f.key,
                headerName: f.label,
                width: f.key === 'from_to' ? 150 : 170,
                sortable: true,
                filter: true,
                editable: true,
                wrapText: true,
                autoHeight: true,
                cellClass: 'forwarder-cell',
            });
        });
        cols.push({
            field: 'notes', headerName: 'NOTES', width: 140, sortable: true, filter: true, editable: true,
        });
        cols.push({
            field: 'id', headerName: '', width: 52, pinned: 'right', sortable: false, filter: false,
            cellRenderer: (p) => (
                <button
                    onClick={() => setDeleteTarget(p.data)}
                    title={isEnglish ? 'Delete row' : 'Hapus baris'}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                    <Trash2 size={15} />
                </button>
            ),
        });
        if (preset.length < ALL_FIELDS.length) {
            return cols.filter(c => c.field === 'division' || c.field === 'notes' || c.field === 'id' || preset.includes(c.field));
        }
        return cols;
    }, [divisionFilter, isEnglish]);

    const onGridReady = useCallback((params) => {
        params.api.sizeColumnsToFit();
        window.__fwdApi = params.api;
    }, []);

    const gridTheme = isDarkMode ? 'ag-theme-quartz-dark' : 'ag-theme-quartz';

    const exportCsv = useCallback(() => {
        const api = gridRef.current?.api;
        if (!api) return;
        api.exportDataAsCsv({
            fileName: `forwarder-report-${new Date().toISOString().slice(0, 10)}.csv`,
            columnKeys: columnDefs.map(c => c.field).filter(Boolean),
        });
        toast.success(isEnglish ? 'CSV exported' : 'CSV berhasil di-export');
    }, [columnDefs, toast, isEnglish]);

    const totalRows = rows.length;
    const divisionsWithData = useMemo(() => new Set(rows.map(r => r.division)).size, [rows]);
    const filledRows = useMemo(() => rows.filter(r => ALL_FIELDS.some(f => (r[f.key] || '').trim())).length, [rows]);

    useModalKeydown(!!deleteTarget, () => setDeleteTarget(null));
    useModalScrollLock(!!deleteTarget);

    return (
        <div className="space-y-5">
            {/* Summary Cards */}
            <SummaryRow cols={4} cards={[
                { title: isEnglish ? 'Total Rows' : 'Total Baris', value: totalRows, icon: Ship, gradient: 'from-sky-500 to-blue-600', subtext: isEnglish ? 'All divisions combined' : 'Gabungan semua divisi' },
                { title: isEnglish ? 'Divisions' : 'Divisi', value: divisionsWithData, icon: Users, gradient: 'from-blue-500 to-blue-600', subtext: isEnglish ? 'Contributing divisions' : 'Divisi pengisi data' },
                { title: isEnglish ? 'Filled Rows' : 'Baris Terisi', value: filledRows, icon: FileSpreadsheet, gradient: 'from-emerald-500 to-teal-600', subtext: isEnglish ? 'Rows with at least 1 column filled' : 'Baris dengan minimal 1 kolom terisi' },
                { title: isEnglish ? 'Auto-Save' : 'Auto-Simpan', value: saveState === 'saving' ? (isEnglish ? 'Saving…' : 'Menyimpan…') : (saveState?.savedAt ? new Date(saveState.savedAt).toLocaleTimeString('id-ID') : (isEnglish ? 'Ready' : 'Siap')), icon: Save, gradient: 'from-amber-500 to-orange-600', subtext: isEnglish ? 'Changes saved like Excel' : 'Perubahan tersimpan layaknya Excel' },
            ]} />

            {/* Toolbar */}
            <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-white/10 shadow-sm">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-md">
                            <Ship size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-800 dark:text-white text-base leading-tight">
                                {isEnglish ? 'Forwarder Report' : 'Laporan Forwarder'}
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-white/40">
                                {isEnglish
                                    ? 'Unified report from all divisions — input per division, one full report'
                                    : 'Laporan gabungan semua divisi — input per divisi, satu laporan penuh'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => { dirtyMap.current.clear(); fetchData(); }}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-white/70 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors">
                            <RefreshCw size={14} /> {isEnglish ? 'Refresh' : 'Muat Ulang'}
                        </button>
                        <button onClick={exportCsv}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-white/70 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors">
                            <Download size={14} /> CSV
                        </button>
                    </div>
                </div>

                {/* Filter bar */}
                <div className="px-5 py-3 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-slate-500 dark:text-white/40">
                            {isEnglish ? 'Division' : 'Divisi'}:
                        </label>
                        <select value={divisionFilter} onChange={e => { setDivisionFilter(e.target.value); dirtyMap.current.clear(); }}
                            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-sky-500">
                            <option value="all">{isEnglish ? 'All Divisions (Full Report)' : 'Semua Divisi (Laporan Penuh)'}</option>
                            {divisions.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <div className="flex-1 min-w-[200px] relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder={isEnglish ? 'Search all columns…' : 'Cari di semua kolom…'}
                            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm focus:ring-2 focus:ring-sky-500" />
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-white/40">
                        <Info size={13} />
                        {isEnglish
                            ? 'Edit any cell — saved automatically like Excel'
                            : 'Edit sel mana pun — tersimpan otomatis layaknya Excel'}
                    </div>
                </div>

                {/* Legend: kolom yang diisi tiap divisi (digabung jadi 1 laporan) */}
                <div className="px-5 pb-4 flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-white/[0.06]">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        {isEnglish ? 'Division columns:' : 'Kolom per divisi:'}
                    </span>
                    {Object.entries(DIVISION_PRESETS).filter(([d]) => d !== 'all').map(([d, cols]) => (
                        <span key={d} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-semibold ${divColor(d)}`} title={cols.join(', ')}>
                            {d}
                            <span className="opacity-70 font-medium">{cols.map(c => FIELD_SHORT[c]).join(' · ')}</span>
                        </span>
                    ))}
                </div>
            </div>

            {/* Add bar — dekat tabel, layaknya Excel */}
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-white/10 shadow-sm">
                <button onClick={addRow} disabled={adding}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl gradient-bg text-white text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-md">
                    {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    {isEnglish ? 'Add Row' : 'Tambah Baris'}
                </button>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-white/40">
                    <Info size={13} />
                    {isEnglish
                        ? 'Press Enter on the last row to add a new row'
                        : 'Tekan Enter di baris terakhir untuk menambah baris baru'}
                </div>
            </div>

            {/* AG Grid */}
            <div className={`${gridTheme} relative rounded-2xl overflow-hidden border border-slate-200 dark:border-white/[0.06] shadow-sm`} style={{ height: 'calc(100vh - 360px)', minHeight: 380 }}>
                {loading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
                        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/80 dark:bg-[#0d0d0d]/80 backdrop-blur-xl shadow-lg border border-white/40 dark:border-white/10 text-sm text-slate-600 dark:text-white/70 font-semibold">
                            <Loader2 size={18} className="animate-spin text-sky-500" />
                            {isEnglish ? 'Loading…' : 'Memuat…'}
                        </div>
                    </div>
                )}
                <AgGridReact
                    ref={gridRef}
                    rowData={rows}
                    columnDefs={columnDefs}
                    theme="legacy"
                    onGridReady={onGridReady}
                    onCellValueChanged={onCellValueChanged}
                    onCellEditingStopped={() => {
                        // Edit baru saja di-commit — Enter/Tab berikutnya di baris terakhir = tambah baris
                        justStoppedRef.current = true;
                        if (stopResetTimer.current) clearTimeout(stopResetTimer.current);
                        stopResetTimer.current = setTimeout(() => { justStoppedRef.current = false; }, 1200);
                    }}
                    onCellKeyDown={(e) => {
                        // Enter yang meng-komit edit di baris TERAKHIR → tambah baris baru (layaknya Excel)
                        if (e.event.key === 'Enter' && justStoppedRef.current) {
                            justStoppedRef.current = false;
                            const isLastRow = e.node && e.api.getDisplayedRowCount() > 0
                                && e.api.getDisplayedRowAtIndex(e.api.getDisplayedRowCount() - 1) === e.node;
                            if (isLastRow) setTimeout(() => addRow(), 60);
                        }
                    }}
                    defaultColDef={{
                        resizable: true,
                        minWidth: 90,
                    }}
                    animateRows
                    singleClickEdit
                    stopEditingWhenCellsLoseFocus
                    ensureDomOrder
                    suppressMovableColumns={false}
                    getRowId={p => String(p.data.id)}
                    overlayLoadingTemplate={isEnglish ? '<span class="ag-overlay-loading-center">Loading…</span>' : '<span class="ag-overlay-loading-center">Memuat…</span>'}
                    overlayNoRowsTemplate={isEnglish ? '<span class="ag-overlay-no-rows-center">No data yet — click "Add Row"</span>' : '<span class="ag-overlay-no-rows-center">Belum ada data — klik "Tambah Baris"</span>'}
                />
            </div>

            {/* Footer: ringkasan + status simpan */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-white/10 shadow-sm text-xs">
                <div className="flex items-center gap-4 text-slate-600 dark:text-white/70">
                    <span className="font-semibold">
                        {totalRows} {isEnglish ? 'rows' : 'baris'}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="font-semibold">
                        {filledRows} {isEnglish ? 'filled' : 'terisi'}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="font-semibold">
                        {divisionsWithData} {isEnglish ? 'divisions' : 'divisi'}
                    </span>
                </div>
                <div className={`flex items-center gap-1.5 font-semibold ${saveState === 'saving' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {saveState === 'saving'
                        ? (<><Loader2 size={13} className="animate-spin" /> {isEnglish ? 'Saving…' : 'Menyimpan…'}</>)
                        : (<><Save size={13} /> {saveState?.savedAt
                            ? (isEnglish ? `Saved ${new Date(saveState.savedAt).toLocaleTimeString('id-ID')}` : `Tersimpan ${new Date(saveState.savedAt).toLocaleTimeString('id-ID')}`)
                            : (isEnglish ? 'Auto-save ready' : 'Auto-simpan siap')}</>)}
                </div>
            </div>

            {/* Delete confirmation */}
            {deleteTarget && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}>
                    <div className="bg-white/95 dark:bg-[#0d0d0d]/90 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-white/60 dark:border-white/10" onClick={e => e.stopPropagation()}>
                        <div className="pt-7 px-8 flex flex-col items-center text-center">
                            <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center mb-4">
                                <Trash2 size={24} className="text-red-600 dark:text-red-400" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                                {isEnglish ? 'Delete Row?' : 'Hapus Baris?'}
                            </h3>
                            <p className="mt-1.5 text-sm text-slate-500 dark:text-white/40 leading-relaxed">
                                {isEnglish
                                    ? `Row ${deleteTarget.forwarder_name || '#' + deleteTarget.id} will be permanently removed.`
                                    : `Baris ${deleteTarget.forwarder_name || '#' + deleteTarget.id} akan dihapus permanen.`}
                            </p>
                        </div>
                        <div className="mt-5 px-8 pb-7 flex gap-3">
                            <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/[0.08] text-slate-600 dark:text-white/70 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors">
                                {isEnglish ? 'Cancel' : 'Batal'}
                            </button>
                            <button onClick={handleDelete} disabled={deleting}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                {deleting ? <Loader2 size={15} className="animate-spin inline mr-1" /> : null}
                                {isEnglish ? 'Delete' : 'Hapus'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* AG Grid glass theme overrides */}
            <style>{`
                .ag-theme-quartz, .ag-theme-quartz-dark {
                    --ag-font-family: inherit;
                    --ag-border-color: transparent;
                    --ag-row-border-color: #e2e8f0;
                    --ag-header-background-color: #f8fafc;
                    --ag-header-foreground-color: #475569;
                    --ag-foreground-color: #1e293b;
                    --ag-background-color: #ffffff;
                    --ag-odd-row-background-color: #f8fafc;
                    --ag-row-hover-color: rgba(14,165,233,0.07);
                    --ag-selected-row-background-color: rgba(14,165,233,0.14);
                    --ag-header-height: 42px;
                    --ag-row-height: 44px;
                    --ag-font-size: 13px;
                    --ag-cell-horizontal-padding: 10px;
                    --ag-wrapper-border-radius: 0;
                    --ag-range-selection-border-color: #0ea5e9;
                }
                .ag-theme-quartz-dark {
                    --ag-row-border-color: #334155;
                    --ag-header-background-color: #1e293b;
                    --ag-header-foreground-color: #93c5fd;
                    --ag-foreground-color: #e2e8f0;
                    --ag-background-color: #0f172a;
                    --ag-odd-row-background-color: #16223a;
                    --ag-row-hover-color: rgba(14,165,233,0.14);
                    --ag-selected-row-background-color: rgba(14,165,233,0.22);
                }
                .ag-theme-quartz .ag-header, .ag-theme-quartz-dark .ag-header {
                    background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
                    border-bottom: 1px solid #e2e8f0;
                }
                .ag-theme-quartz-dark .ag-header {
                    background: linear-gradient(180deg, #1e293b 0%, #172554 100%);
                    border-bottom: 1px solid #334155;
                }
                .ag-theme-quartz .ag-header-cell, .ag-theme-quartz-dark .ag-header-cell {
                    font-weight: 700;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                    font-size: 10.5px;
                }
                .ag-theme-quartz .ag-header-cell::after, .ag-theme-quartz-dark .ag-header-cell::after {
                    border-right: 1px dashed #cbd5e1;
                }
                .ag-theme-quartz-dark .ag-header-cell::after {
                    border-right: 1px dashed #475569;
                }
                .ag-theme-quartz .ag-row, .ag-theme-quartz-dark .ag-row {
                    transition: background-color 0.15s ease;
                }
                .ag-theme-quartz .ag-cell, .ag-theme-quartz-dark .ag-cell {
                    line-height: 1.3;
                }
                .forwarder-cell {
                    font-family: inherit;
                }
                .ag-theme-quartz .ag-cell-inline-editing, .ag-theme-quartz-dark .ag-cell-inline-editing {
                    box-shadow: 0 0 0 2px rgba(14,165,233,0.55);
                    background: #fff;
                    z-index: 2;
                    border-radius: 4px;
                }
                .ag-theme-quartz-dark .ag-cell-inline-editing {
                    background: #1e293b;
                }
            `}</style>
        </div>
    );
}
