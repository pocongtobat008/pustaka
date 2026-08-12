import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
    Plus, Edit3, Trash2, Search, BookOpen, ChevronRight, ChevronLeft, ChevronDown,
    Upload, FileSpreadsheet, Save, X, Loader2, AlertCircle, CheckCircle2,
    FolderOpen, FolderMinus, Building2, RefreshCw, Download, Filter,
    Layers, ArrowRight, Eye, SlidersHorizontal, BarChart3, Trash, ChevronUp,
    AlertTriangle
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { db as api } from '../services/database';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../components/ui/Toast';

export default function Book({ hasPermission }) {
    const { language } = useLanguage();
    const { toast } = useToast();
    const isEnglish = language === 'en';

    const text = isEnglish ? {
        tabs: { overview: 'Overview', accounts: 'COA Induk', subs: 'Sub COA', departments: 'Departemen', import: 'Import Excel' },
        search: 'Search COA by code or name...',
        addNew: 'Add New',
        noData: 'No data found.',
        loading: 'Loading...',
        code: 'Code',
        name: 'Name',
        description: 'Description',
        status: 'Status',
        actions: 'Actions',
        active: 'Active',
        inactive: 'Inactive',
        parent: 'Parent',
        save: 'Save',
        cancel: 'Cancel',
        deleteConfirm: 'Are you sure you want to delete this?',
        importTitle: 'Import COA from Excel',
        importDesc: 'Upload Excel file with columns: No COA, Keterangan, Sub COA, Keterangan Sub, No Dep, Keterangan Dep',
        chooseFile: 'Choose File',
        importBtn: 'Import',
        imported: 'Import successful!',
        stats: { accounts: 'COA Induk', subs: 'Sub COA', deps: 'Departemen' },
        form: { addAccount: 'Add COA Induk', addSub: 'Add Sub COA', addDep: 'Add Departemen', editAccount: 'Edit COA Induk', editSub: 'Edit Sub COA', editDep: 'Edit Departemen' },
        selectParent: 'Select Parent',
        downloadTemplate: 'Download Template',
        showing: 'Showing',
        of: 'of',
        filterAll: 'All',
        filterActive: 'Active',
        filterInactive: 'Inactive',
        overviewTitle: 'Chart of Accounts Overview',
        overviewSubtitle: 'Complete hierarchy view of all accounts',
        viewDetails: 'View Details',
        subCount: 'Sub Accounts',
        depCount: 'Departments',
        totalItems: 'Total Items',
        importUploading: 'Uploading file...',
        importProcessing: 'Processing data...',
        importDone: 'Import complete!',
        importAnalyzing: 'Analyzing Excel data...',
        importCreating: 'Creating records...',
        importFinalizing: 'Finalizing...',
        deleteAll: 'Delete All',
        deleteAllConfirm: 'This will permanently delete ALL COA data. Are you sure?',
        deleteAllSuccess: 'All COA data deleted successfully',
        deleteAllTitle: 'Delete All COA Data?',
        deleteAllWarning: 'This action will permanently delete:',
        deleteAllConsequences: [
            'All COA accounts and their hierarchy',
            'All sub-accounts and departments',
            'This action cannot be undone',
        ],
        deleteAllTypeConfirm: 'Type DELETE to confirm',
        deleteAllInputLabel: 'Confirmation',
        filterCoaAll: 'All COA',
        pageAll: 'All',
        pageRows: 'rows',
        infoTitle: 'Book Information',
        infoTips: [
            'COA Induk represents the main account category (e.g., 1=Aktiva, 2=Pasiva).',
            'Sub COA can belong to multiple COA Induk for flexible grouping.',
            'Use Import Excel for bulk data entry with the standard template.',
            'Search supports code, name, and description across all levels.',
        ],
    } : {
        tabs: { overview: 'Ringkasan', accounts: 'COA Induk', subs: 'Sub COA', departments: 'Departemen', import: 'Import Excel' },
        search: 'Cari COA berdasarkan kode atau nama...',
        addNew: 'Tambah Baru',
        noData: 'Belum ada data.',
        loading: 'Memuat...',
        code: 'Kode',
        name: 'Nama',
        description: 'Keterangan',
        status: 'Status',
        actions: 'Aksi',
        active: 'Aktif',
        inactive: 'Nonaktif',
        parent: 'Induk',
        save: 'Simpan',
        cancel: 'Batal',
        deleteConfirm: 'Yakin ingin menghapus?',
        importTitle: 'Import COA dari Excel',
        importDesc: 'Upload file Excel dengan kolom: No COA, Keterangan, Sub COA, Keterangan Sub, No Dep, Keterangan Dep',
        chooseFile: 'Pilih File',
        importBtn: 'Import',
        imported: 'Import berhasil!',
        stats: { accounts: 'COA Induk', subs: 'Sub COA', deps: 'Departemen' },
        form: { addAccount: 'Tambah COA Induk', addSub: 'Tambah Sub COA', addDep: 'Tambah Departemen', editAccount: 'Edit COA Induk', editSub: 'Edit Sub COA', editDep: 'Edit Departemen' },
        selectParent: 'Pilih Induk',
        downloadTemplate: 'Download Template',
        showing: 'Menampilkan',
        of: 'dari',
        filterAll: 'Semua',
        filterActive: 'Aktif',
        filterInactive: 'Nonaktif',
        overviewTitle: 'Tinjauan Cart of Akun',
        overviewSubtitle: 'Tampilan hierarki lengkap seluruh akun',
        viewDetails: 'Lihat Detail',
        subCount: 'Sub Akun',
        depCount: 'Departemen',
        totalItems: 'Total Item',
        importUploading: 'Mengunggah file...',
        importProcessing: 'Memproses data...',
        importDone: 'Import selesai!',
        importAnalyzing: 'Menganalisis data Excel...',
        importCreating: 'Membuat record...',
        importFinalizing: 'Menyelesaikan...',
        deleteAll: 'Hapus Semua',
        deleteAllConfirm: 'Ini akan menghapus SEMUA data COA secara permanen. Yakin?',
        deleteAllSuccess: 'Semua data COA berhasil dihapus',
        deleteAllTitle: 'Hapus Semua Data COA?',
        deleteAllWarning: 'Aksi ini akan menghapus secara permanen:',
        deleteAllConsequences: [
            'Semua akun COA dan hierarkinya',
            'Semua sub-akun dan departemen',
            'Tindakan ini tidak dapat dibatalkan',
        ],
        deleteAllTypeConfirm: 'Ketik HAPUS untuk konfirmasi',
        deleteAllInputLabel: 'Konfirmasi',
        filterCoaAll: 'Semua COA',
        pageAll: 'Semua',
        pageRows: 'baris',
        infoTitle: 'Informasi Book (COA)',
        infoTips: [
            'COA Induk merepresentasikan kategori akun utama (contoh: 1=Aktiva, 2=Pasiva).',
            'Sub COA bisa dimiliki oleh berbagai COA Induk untuk pengelompokan fleksibel.',
            'Gunakan Import Excel untuk input data massal dengan template bawaan.',
            'Pencarian mendukung kode, nama, dan keterangan di semua level.',
        ],
    };

    const [activeTab, setActiveTab] = useState('overview');
    const [data, setData] = useState([]);
    const [stats, setStats] = useState({ accounts: 0, sub_accounts: 0, departments: 0 });
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formLevel, setFormLevel] = useState('account');
    const [editingItem, setEditingItem] = useState(null);
    const [form, setForm] = useState({ code: '', name: '', description: '', parent_id: '' });
    const [expandedAccounts, setExpandedAccounts] = useState(new Set());
    const [importFile, setImportFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [importStage, setImportStage] = useState('');
    const [importTotal, setImportTotal] = useState(0);
    const [importProcessed, setImportProcessed] = useState(0);
    const [importSuccess, setImportSuccess] = useState(0);
    const [importFailed, setImportFailed] = useState(0);
    const [page, setPage] = useState(0);
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterCoa, setFilterCoa] = useState('all');
    const [pageSize, setPageSize] = useState(15);
    const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const fileInputRef = useRef(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (search.trim()) params.search = search.trim();
            const [hierarchy, statsData] = await Promise.all([
                api.getCoaHierarchy(params),
                api.getCoaStats()
            ]);
            setData(hierarchy);
            setStats(statsData);
        } catch (e) {
            console.error('Failed to load COA:', e);
            toast({ title: 'Error', description: 'Gagal memuat data COA', type: 'error' });
        }
        setLoading(false);
    }, [search]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { setPage(0); }, [activeTab, search, filterStatus]);

    useEffect(() => {
        const handleSocket = () => fetchData();
        window.addEventListener('coa-data-changed', handleSocket);
        return () => window.removeEventListener('coa-data-changed', handleSocket);
    }, [fetchData]);

    const toggleExpand = (id) => {
        setExpandedAccounts(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const openAddForm = (level, parentId = null) => {
        setFormLevel(level);
        setEditingItem(null);
        setForm({ code: '', name: '', description: '', parent_id: parentId || '' });
        setShowForm(true);
    };

    const openEditForm = (level, item) => {
        setFormLevel(level);
        setEditingItem(item);
        setForm({
            code: item.code,
            name: item.name,
            description: item.description || '',
            parent_id: level === 'sub_account' ? item.account_id : (level === 'department' ? item.sub_account_id : '')
        });
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!form.code || !form.name) {
            toast({ title: 'Error', description: 'Kode dan Nama wajib diisi', type: 'error' });
            return;
        }
        try {
            const payload = { level: formLevel, code: form.code, name: form.name, description: form.description || null };
            if (formLevel === 'sub_account') payload.parent_id = form.parent_id;
            if (formLevel === 'department') payload.parent_id = form.parent_id;

            if (editingItem) {
                await api.updateCoa(formLevel, editingItem.id, payload);
                toast({ title: 'Berhasil', description: 'Data berhasil diupdate', type: 'success' });
            } else {
                await api.createCoa(payload);
                toast({ title: 'Berhasil', description: 'Data berhasil ditambahkan', type: 'success' });
            }
            setShowForm(false);
            fetchData();
        } catch (e) {
            toast({ title: 'Error', description: e.message || 'Gagal menyimpan data', type: 'error' });
        }
    };

    const handleDelete = async (level, item) => {
        if (!window.confirm(text.deleteConfirm)) return;
        try {
            await api.deleteCoa(level, item.id);
            toast({ title: 'Berhasil', description: 'Data berhasil dihapus', type: 'success' });
            fetchData();
        } catch (e) {
            toast({ title: 'Error', description: e.message || 'Gagal menghapus', type: 'error' });
        }
    };

    const handleDeleteAll = async () => {
        setDeleteConfirmText('');
        setShowDeleteAllModal(true);
    };

    const confirmDeleteAll = async () => {
        try {
            await api.deleteAllCoa();
            toast({ title: 'Berhasil', description: text.deleteAllSuccess, type: 'success' });
            setShowDeleteAllModal(false);
            setDeleteConfirmText('');
            fetchData();
        } catch (e) {
            toast({ title: 'Error', description: e.message || 'Gagal menghapus semua data', type: 'error' });
        }
    };

    const handleImport = async () => {
        if (!importFile) return;
        setImporting(true);
        setImportProgress(0);
        setImportProcessed(0);
        setImportSuccess(0);
        setImportFailed(0);
        try {
            setImportStage(text.importAnalyzing);

            const data = await importFile.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheetName = workbook.SheetNames[0];
            const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

            const getVal = (item, possibleKeys) => {
                const actualKeys = Object.keys(item);
                for (const pk of possibleKeys) {
                    const match = actualKeys.find(ak => ak.toLowerCase().replace(/[_\s]/g, '') === pk.toLowerCase().replace(/[_\s]/g, ''));
                    if (match) return item[match];
                }
                return undefined;
            };

            const rows = rawData.map(item => ({
                accountCode: String(getVal(item, ['no_coa', 'noCOA', 'code', 'kode_coa', 'kodeCOA']) || '').trim(),
                accountName: String(getVal(item, ['keterangan', 'name', 'nama_coa', 'namaCOA']) || '').trim(),
                subCode: String(getVal(item, ['sub_coa', 'subCOA', 'sub_code', 'subKode']) || '').trim(),
                subName: String(getVal(item, ['keterangan_sub', 'sub_name', 'sub_name', 'nama_sub']) || '').trim(),
                depCode: String(getVal(item, ['no_dep', 'noDep', 'dep_code', 'kode_dep']) || '').trim(),
                depName: String(getVal(item, ['keterangan_dep', 'dep_name', 'nama_dep']) || '').trim(),
            })).filter(row => row.accountCode && row.accountName);

            if (rows.length === 0) {
                toast({ title: 'Error', description: 'Tidak ada data valid di file', type: 'error' });
                setImporting(false);
                setImportStage('');
                return;
            }

            const BATCH_SIZE = 50;
            const batches = [];
            for (let i = 0; i < rows.length; i += BATCH_SIZE) {
                batches.push(rows.slice(i, i + BATCH_SIZE));
            }

            setImportTotal(rows.length);
            setImportStage(text.importProcessing);
            let totalSuccess = 0, totalFailed = 0;

            for (let bi = 0; bi < batches.length; bi++) {
                const batch = batches[bi];
                setImportStage(`${text.importProcessing} (${bi + 1}/${batches.length})`);
                try {
                    const result = await api.importCoaBatch(batch);
                    totalSuccess += result.imported || 0;
                    totalFailed += result.failed || 0;
                } catch {
                    totalFailed += batch.length;
                }
                const done = Math.min((bi + 1) * BATCH_SIZE, rows.length);
                setImportProcessed(done);
                setImportSuccess(totalSuccess);
                setImportFailed(totalFailed);
                setImportProgress(Math.round((done / rows.length) * 100));
            }

            setImportProgress(100);
            setImportStage(text.importDone);
            toast({
                title: 'Berhasil',
                description: `Import selesai: ${totalSuccess} berhasil, ${totalFailed} gagal dari ${rows.length} baris`,
                type: totalFailed > 0 ? 'warning' : 'success'
            });
            setImportFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            fetchData();
            await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
            toast({ title: 'Error', description: e.message || 'Gagal import', type: 'error' });
        }
        setImporting(false);
        setImportProgress(0);
        setImportStage('');
        setImportTotal(0);
        setImportProcessed(0);
        setImportSuccess(0);
        setImportFailed(0);
    };

    const handleDownloadTemplate = () => {
        const templateData = [
            { 'No COA': '1', 'Keterangan': 'Aktiva', 'Sub COA': '1-1', 'Keterangan Sub': 'Kas', 'No Dep': '1-1-01', 'Keterangan Dep': 'Kas Kecil' },
            { 'No COA': '1', 'Keterangan': 'Aktiva', 'Sub COA': '1-1', 'Keterangan Sub': 'Kas', 'No Dep': '1-1-02', 'Keterangan Dep': 'Kas di Bank' },
            { 'No COA': '1', 'Keterangan': 'Aktiva', 'Sub COA': '1-2', 'Keterangan Sub': 'Bank', 'No Dep': '1-2-01', 'Keterangan Dep': 'Bank BCA' },
            { 'No COA': '1', 'Keterangan': 'Aktiva', 'Sub COA': '1-3', 'Keterangan Sub': 'Piutang', 'No Dep': '1-3-01', 'Keterangan Dep': 'Piutang Usaha' },
            { 'No COA': '2', 'Keterangan': 'Pasiva', 'Sub COA': '2-1', 'Keterangan Sub': 'Utang Usaha', 'No Dep': '2-1-01', 'Keterangan Dep': 'Utang Supplier' },
            { 'No COA': '2', 'Keterangan': 'Pasiva', 'Sub COA': '2-2', 'Keterangan Sub': 'Utang Pajak', 'No Dep': '2-2-01', 'Keterangan Dep': 'Utang PPN' },
            { 'No COA': '3', 'Keterangan': 'Modal', 'Sub COA': '3-1', 'Keterangan Sub': 'Modal Disetor', 'No Dep': '3-1-01', 'Keterangan Dep': 'Modal Pokok' },
            { 'No COA': '4', 'Keterangan': 'Pendapatan', 'Sub COA': '4-1', 'Keterangan Sub': 'Pendapatan Usaha', 'No Dep': '4-1-01', 'Keterangan Dep': 'Pendapatan Penjualan' },
            { 'No COA': '5', 'Keterangan': 'Beban', 'Sub COA': '5-1', 'Keterangan Sub': 'Beban Gaji', 'No Dep': '5-1-01', 'Keterangan Dep': 'Gaji Karyawan' },
            { 'No COA': '5', 'Keterangan': 'Beban', 'Sub COA': '5-2', 'Keterangan Sub': 'Beban Sewa', 'No Dep': '5-2-01', 'Keterangan Dep': 'Sewa Kantor' },
        ];
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template COA');
        XLSX.writeFile(wb, 'Template_Import_COA.xlsx');
    };

    const filteredData = useMemo(() => {
        if (filterStatus === 'all') return data;
        const isActive = filterStatus === 'active';
        return data.map(acc => ({
            ...acc,
            is_active: isActive,
            sub_accounts: (acc.sub_accounts || []).map(s => ({
                ...s,
                is_active: isActive,
                departments: (s.departments || []).filter(d => d.is_active === isActive || filterStatus === 'all')
            })).filter(s => s.is_active === isActive || filterStatus === 'all')
        }));
    }, [data, filterStatus]);

    const allSubs = useMemo(() => {
        const src = filterStatus === 'all' ? data : filteredData;
        return src.flatMap(acc => (acc.sub_accounts || []).map(s => ({ ...s, account_code: acc.code, account_name: acc.name })));
    }, [data, filteredData, filterStatus]);

    const allDeps = useMemo(() => {
        return allSubs.flatMap(sub => (sub.departments || []).map(d => ({ ...d, sub_code: sub.code, sub_name: sub.name, account_code: sub.account_code })));
    }, [allSubs]);

    const parentOptions = useMemo(() => {
        if (formLevel === 'sub_account') return data.map(a => ({ id: a.id, label: `${a.code} - ${a.name}` }));
        if (formLevel === 'department') return allSubs.map(s => ({ id: s.id, label: `${s.code} - ${s.name}` }));
        return [];
    }, [formLevel, data, allSubs]);

    const tabs = [
        { id: 'overview', label: text.tabs.overview },
        { id: 'accounts', label: text.tabs.accounts, count: stats.accounts },
        { id: 'subs', label: text.tabs.subs, count: stats.sub_accounts },
        { id: 'departments', label: text.tabs.departments, count: stats.departments },
        { id: 'import', label: text.tabs.import },
    ];

    const Pagination = ({ total, current, onChange, rowCount }) => {
        if (total <= 1) return null;
        const pages = [];
        for (let i = 0; i < total; i++) pages.push(i);
        const visible = pages.filter(p => p === 0 || p === total - 1 || Math.abs(p - current) <= 1);
        return (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-400 dark:text-slate-500">
                    {text.showing} {current * pageSize + 1}-{Math.min((current + 1) * pageSize, rowCount || total * pageSize)} {text.of} {rowCount || total * pageSize}
                </p>
                <div className="flex items-center gap-1">
                    <button onClick={() => onChange(current - 1)} disabled={current === 0} className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-30 disabled:pointer-events-none transition-all">
                        <ChevronLeft size={16} />
                    </button>
                    {visible.map((p, i) => {
                        const prev = visible[i - 1];
                        const showEllipsis = prev !== undefined && p - prev > 1;
                        return (
                            <React.Fragment key={p}>
                                {showEllipsis && <span className="px-1 text-slate-300 dark:text-slate-600">...</span>}
                                <button onClick={() => onChange(p)} className={`min-w-[36px] h-9 rounded-xl text-xs font-bold transition-all ${p === current ? 'gradient-bg text-white shadow-lg shadow-indigo-500/30' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                                    {p + 1}
                                </button>
                            </React.Fragment>
                        );
                    })}
                    <button onClick={() => onChange(current + 1)} disabled={current >= total - 1} className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-30 disabled:pointer-events-none transition-all">
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        );
    };

    const renderTable = (columns, rows, level, emptyMsg) => {
        const safePage = pageSize === 0 ? 0 : Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)) - 1);
        const paged = pageSize === 0 ? rows : rows.slice(safePage * pageSize, (safePage + 1) * pageSize);
        const total = pageSize === 0 ? 1 : Math.max(1, Math.ceil(rows.length / pageSize));
        return (
            <div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-700/50">
                                {columns.map((col, i) => (
                                    <th key={i} className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{col}</th>
                                ))}
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">{text.actions}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                            {paged.length === 0 ? (
                                <tr><td colSpan={columns.length + 1} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">{emptyMsg || text.noData}</td></tr>
                            ) : paged.map((row, idx) => (
                                <tr key={row.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                    {columns.map((_, ci) => {
                                        const key = _ === text.code ? 'code' : _ === text.name ? 'name' : _ === text.description ? 'description' : _ === text.status ? 'is_active' : _ === text.parent ? (level === 'sub_account' ? 'account_name' : 'sub_name') : _ === text.parent + ' ' + text.code ? (level === 'sub_account' ? 'account_code' : 'sub_code') : null;
                                        if (key === 'is_active') return <td key={ci} className="px-6 py-4"><span className={`px-2 py-1 text-[10px] font-bold rounded-full ${row.is_active ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>{row.is_active ? text.active : text.inactive}</span></td>;
                                        if (key === 'account_name' || key === 'sub_name') return <td key={ci} className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">{row[key]}</td>;
                                        if (key === 'account_code' || key === 'sub_code') return <td key={ci} className="px-6 py-4 font-mono text-xs text-indigo-500 dark:text-indigo-400">{row[key]}</td>;
                                        return <td key={ci} className="px-6 py-4 font-medium text-slate-800 dark:text-white">{key ? row[key] : ''}</td>;
                                    })}
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {hasPermission('book', 'edit') && (
                                                <button onClick={() => openEditForm(level, row)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all" title="Edit">
                                                    <Edit3 size={14} />
                                                </button>
                                            )}
                                            {hasPermission('book', 'delete') && (
                                                <button onClick={() => handleDelete(level, row)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all" title="Hapus">
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                </tbody>
            </table>
        </div>
        <Pagination total={total} current={safePage} onChange={setPage} rowCount={rows.length} />
        </div>
        );
    };

    const renderOverview = () => {
        const baseData = filterStatus === 'all' ? data : filteredData;
        const overviewData = filterCoa === 'all' ? baseData : baseData.filter(acc => String(acc.id) === String(filterCoa));
        const totalSubs = overviewData.reduce((sum, a) => sum + (a.sub_accounts || []).length, 0);
        const totalDeps = overviewData.reduce((sum, a) => sum + (a.sub_accounts || []).reduce((s, sub) => s + (sub.departments || []).length, 0), 0);
        const safePage = pageSize === 0 ? 0 : Math.min(page, Math.max(1, Math.ceil(overviewData.length / pageSize)) - 1);
        const paged = pageSize === 0 ? overviewData : overviewData.slice(safePage * pageSize, (safePage + 1) * pageSize);
        const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(overviewData.length / pageSize));

        return (
            <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">{text.overviewTitle}</h2>
                        <p className="text-xs text-slate-400 mt-1">{text.overviewSubtitle}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Layers size={14} />
                        <span className="font-mono font-bold">{overviewData.length}</span>
                        <span>{text.tabs.accounts}</span>
                        <ArrowRight size={12} />
                        <span className="font-mono font-bold">{totalSubs}</span>
                        <span>{text.subCount}</span>
                        <ArrowRight size={12} />
                        <span className="font-mono font-bold">{totalDeps}</span>
                        <span>{text.depCount}</span>
                    </div>
                </div>

                {/* COA Filter Dropdown */}
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <Select
                            value={filterCoa}
                            onChange={(e) => { setFilterCoa(e.target.value); setPage(0); }}
                            className="pl-9 pr-8 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 appearance-none cursor-pointer min-w-[180px]"
                        >
                            <option value="all">{text.filterCoaAll}</option>
                            {data.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                            ))}
                        </Select>
                        <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {overviewData.length} {text.tabs.accounts}
                    </span>
                </div>

                {overviewData.length === 0 && (
                    <div className="py-20 text-center text-slate-400 dark:text-slate-500">{text.noData}</div>
                )}

                {/* COA Table with Expand/Collapse */}
                {overviewData.length > 0 && (
                    <div>
                        <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
                            <table className="w-full text-sm text-left">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-700/50 bg-slate-50/80 dark:bg-slate-800/50">
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest w-10">#</th>
                                        <th className="px-4 py-3 w-8" />
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">COA</th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{isEnglish ? 'Description' : 'Deskripsi'}</th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">{text.subCount}</th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">{text.depCount}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                    {paged.map((acc, idx) => {
                                        const globalIdx = pageSize === 0 ? idx : safePage * pageSize + idx;
                                        const subCount = (acc.sub_accounts || []).length;
                                        const depCount = (acc.sub_accounts || []).reduce((s, sub) => s + (sub.departments || []).length, 0);
                                        const isExpanded = expandedAccounts.has(acc.id);

                                        return (
                                            <React.Fragment key={acc.id}>
                                                {/* COA row */}
                                                <tr
                                                    className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors cursor-pointer"
                                                    onClick={() => toggleExpand(acc.id)}
                                                >
                                                    <td className="px-4 py-3 text-xs text-slate-400 font-mono">{globalIdx + 1}</td>
                                                    <td className="px-4 py-3">
                                                        <button className="p-1 rounded text-slate-400 hover:text-indigo-500 transition-all">
                                                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                        </button>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-md">{acc.code}</span>
                                                            <span className="text-xs font-bold text-slate-800 dark:text-white">{acc.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[200px]">{acc.description || '-'}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 text-[10px] font-black rounded-full bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400">{subCount}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 text-[10px] font-black rounded-full bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">{depCount}</span>
                                                    </td>
                                                </tr>

                                                {/* Expanded: Sub-accounts + Departments */}
                                                {isExpanded && (acc.sub_accounts || []).map(sub => (
                                                    <React.Fragment key={sub.id}>
                                                        {/* Sub COA row */}
                                                        <tr className="bg-cyan-50/20 dark:bg-cyan-900/5">
                                                            <td className="px-4 py-2" />
                                                            <td className="px-4 py-2" />
                                                            <td className="px-4 py-2 pl-8">
                                                                <div className="flex items-center gap-2 border-l-2 border-cyan-200 dark:border-cyan-800 pl-3">
                                                                    <span className="font-mono text-[11px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20 px-1.5 py-0.5 rounded">{sub.code}</span>
                                                                    <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">{sub.name}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-2 pl-8">
                                                                <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[180px] block border-l-2 border-cyan-200 dark:border-cyan-800 pl-3">{sub.description || '-'}</span>
                                                            </td>
                                                            <td className="px-4 py-2 text-center">
                                                                <span className="text-[10px] font-bold text-slate-400">{(sub.departments || []).length}</span>
                                                            </td>
                                                            <td className="px-4 py-2" />
                                                        </tr>

                                                        {/* Department rows */}
                                                        {(sub.departments || []).map(dep => (
                                                            <tr key={dep.id} className="bg-amber-50/15 dark:bg-amber-900/5">
                                                                <td className="px-4 py-1.5" />
                                                                <td className="px-4 py-1.5" />
                                                                <td className="px-4 py-1.5 pl-14">
                                                                    <div className="flex items-center gap-2 border-l-2 border-amber-200 dark:border-amber-800 pl-3">
                                                                        <span className="font-mono text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">{dep.code}</span>
                                                                        <span className="text-[11px] text-slate-600 dark:text-slate-400">{dep.name}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-1.5 pl-14">
                                                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[160px] block border-l-2 border-amber-200 dark:border-amber-800 pl-3">{dep.description || '-'}</span>
                                                                </td>
                                                                <td className="px-4 py-1.5" />
                                                                <td className="px-4 py-1.5" />
                                                            </tr>
                                                        ))}
                                                    </React.Fragment>
                                                ))}

                                                {/* Expanded but no sub-accounts */}
                                                {isExpanded && (!acc.sub_accounts || acc.sub_accounts.length === 0) && (
                                                    <tr className="bg-slate-50/30 dark:bg-slate-800/20">
                                                        <td className="px-4 py-3" />
                                                        <td className="px-4 py-3" />
                                                        <td colSpan={4} className="px-4 py-3 pl-10 text-[11px] text-slate-400 italic">{text.noData}</td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <Pagination total={totalPages} current={safePage} onChange={setPage} rowCount={overviewData.length} />
                    </div>
                )}
            </div>
        );
    };

    const renderImportTab = () => (
        <div className="p-8 max-w-xl mx-auto">
            <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl">
                    <FileSpreadsheet size={28} className="text-white" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-800 dark:text-white">{text.importTitle}</h3>
                <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto">{text.importDesc}</p>
            </div>

            {importing ? (
                <div className="space-y-5">
                    <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                {importProgress === 100 ? (
                                    <CheckCircle2 size={20} className="text-white" />
                                ) : (
                                    <Loader2 size={20} className="text-white animate-spin" />
                                )}
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800 dark:text-white">{importStage}</p>
                                <p className="text-[11px] text-slate-400">
                                    {importProcessed}/{importTotal} baris
                                    {importSuccess > 0 && <span className="text-emerald-600 dark:text-emerald-400 ml-2">{importSuccess} berhasil</span>}
                                    {importFailed > 0 && <span className="text-red-600 dark:text-red-400 ml-2">{importFailed} gagal</span>}
                                </p>
                            </div>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-300 ease-out ${importProgress === 100 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-indigo-500 to-purple-600'}`}
                                style={{ width: `${importProgress}%` }}
                            />
                        </div>
                        <div className="flex items-center justify-between mt-3 text-[10px] font-bold">
                            <span className="text-slate-400">{importProcessed}/{importTotal} baris diproses</span>
                            <span className="text-indigo-600 dark:text-indigo-300">{importProgress}%</span>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center hover:border-indigo-400 transition-colors">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={(e) => setImportFile(e.target.files[0])}
                            className="hidden"
                            id="coa-import-input"
                        />
                        <label htmlFor="coa-import-input" className="cursor-pointer">
                            <Upload size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{importFile ? importFile.name : text.chooseFile}</p>
                            <p className="text-[10px] text-slate-400 mt-1">.xlsx, .xls, .csv</p>
                        </label>
                    </div>

                    <div className="flex gap-3 mt-4">
                        <button
                            onClick={handleDownloadTemplate}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                        >
                            <Download size={14} /> {text.downloadTemplate}
                        </button>
                        {importFile && (
                            <button
                                onClick={handleImport}
                                disabled={importing}
                                className="flex-1 flex items-center justify-center gap-2 py-3 gradient-bg text-white text-xs font-black rounded-2xl hover:bg-indigo-500 shadow-xl shadow-indigo-500/30 transition-all uppercase tracking-widest disabled:opacity-50"
                            >
                                <Upload size={14} /> {text.importBtn}
                            </button>
                        )}
                    </div>

                    <div className="mt-8 gradient-bg-soft rounded-2xl p-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Format Kolom Excel</p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-700">
                                        {['No COA', 'Keterangan', 'Sub COA', 'Keterangan Sub', 'No Dep', 'Keterangan Dep'].map(h => (
                                            <th key={h} className="px-3 py-2 text-left font-bold text-slate-500 dark:text-slate-400">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-slate-100 dark:border-slate-800">
                                        <td className="px-3 py-2 font-mono text-indigo-500">1</td>
                                        <td className="px-3 py-2">Aktiva</td>
                                        <td className="px-3 py-2 font-mono text-indigo-500">1-1</td>
                                        <td className="px-3 py-2">Kas</td>
                                        <td className="px-3 py-2 font-mono text-indigo-500">1-1-01</td>
                                        <td className="px-3 py-2">Kas Kecil</td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2 font-mono text-indigo-500">2</td>
                                        <td className="px-3 py-2">Pasiva</td>
                                        <td className="px-3 py-2 font-mono text-indigo-500">2-1</td>
                                        <td className="px-3 py-2">Utang Usaha</td>
                                        <td className="px-3 py-2 font-mono text-indigo-500">2-1-01</td>
                                        <td className="px-3 py-2">Utang Supplier</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );

    const renderAccountsTab = () => {
        const accData = filterStatus === 'all' ? data : filteredData;
        const accTotal = pageSize === 0 ? 1 : Math.max(1, Math.ceil(accData.length / pageSize));
        const accPage = pageSize === 0 ? 0 : Math.min(page, accTotal - 1);
        const pagedData = pageSize === 0 ? accData : accData.slice(accPage * pageSize, (accPage + 1) * pageSize);

        return (
            <div>
                {accData.length === 0 && <div className="py-20 text-center text-slate-400 dark:text-slate-500">{text.noData}</div>}
                <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {pagedData.map(acc => (
                        <div key={acc.id} className="group">
                            <div className="flex items-center px-6 py-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={() => toggleExpand(acc.id)}>
                                <button className="mr-3 text-slate-400 group-hover:text-indigo-500 transition-colors">
                                    {expandedAccounts.has(acc.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                                <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                                    <div className="col-span-2 font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">{acc.code}</div>
                                    <div className="col-span-4 font-bold text-slate-800 dark:text-white">{acc.name}</div>
                                    <div className="col-span-3 text-xs text-slate-400 truncate">{acc.description || '-'}</div>
                                    <div className="col-span-2">
                                        <span className={`px-2 py-1 text-[10px] font-bold rounded-full ${acc.is_active !== false ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>{acc.is_active !== false ? text.active : text.inactive}</span>
                                    </div>
                                    <div className="col-span-1 text-right">
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{(acc.sub_accounts || []).length}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                    {hasPermission('book', 'edit') && (
                                        <>
                                            <button onClick={() => openAddForm('sub_account', acc.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all" title="Tambah Sub COA">
                                                <Plus size={12} />
                                            </button>
                                            <button onClick={() => openEditForm('account', acc)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all" title="Edit">
                                                <Edit3 size={12} />
                                            </button>
                                        </>
                                    )}
                                    {hasPermission('book', 'delete') && (
                                        <button onClick={() => handleDelete('account', acc)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all" title="Hapus">
                                            <Trash2 size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            {expandedAccounts.has(acc.id) && (acc.sub_accounts || []).map(sub => (
                                <div key={sub.id} className="ml-10">
                                    <div className="flex items-center px-6 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors border-l-2 border-indigo-100 dark:border-indigo-900/30">
                                        <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                                            <div className="col-span-2 font-mono text-xs font-bold text-cyan-600 dark:text-cyan-400">{sub.code}</div>
                                            <div className="col-span-4 font-medium text-sm text-slate-700 dark:text-slate-300">{sub.name}</div>
                                            <div className="col-span-3 text-xs text-slate-400 truncate">{sub.description || '-'}</div>
                                            <div className="col-span-2">
                                                <span className={`px-2 py-1 text-[10px] font-bold rounded-full ${sub.is_active !== false ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>{sub.is_active !== false ? text.active : text.inactive}</span>
                                            </div>
                                            <div className="col-span-1 text-right">
                                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{(sub.departments || []).length}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {hasPermission('book', 'edit') && (
                                                <>
                                                    <button onClick={() => openAddForm('department', sub.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all" title="Tambah Departemen">
                                                        <Plus size={12} />
                                                    </button>
                                                    <button onClick={() => openEditForm('sub_account', sub)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all" title="Edit">
                                                        <Edit3 size={12} />
                                                    </button>
                                                </>
                                            )}
                                            {hasPermission('book', 'delete') && (
                                                <button onClick={() => handleDelete('sub_account', sub)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all" title="Hapus">
                                                    <Trash2 size={12} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {(sub.departments || []).map(dep => (
                                        <div key={dep.id} className="ml-10">
                                            <div className="flex items-center px-6 py-2.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors border-l-2 border-cyan-100 dark:border-cyan-900/30">
                                                <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                                                    <div className="col-span-2 font-mono text-xs text-amber-600 dark:text-amber-400">{dep.code}</div>
                                                    <div className="col-span-4 text-sm text-slate-600 dark:text-slate-400">{dep.name}</div>
                                                    <div className="col-span-3 text-xs text-slate-400 truncate">{dep.description || '-'}</div>
                                                    <div className="col-span-2">
                                                        <span className={`px-2 py-1 text-[10px] font-bold rounded-full ${dep.is_active !== false ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>{dep.is_active !== false ? text.active : text.inactive}</span>
                                                    </div>
                                                    <div className="col-span-1" />
                                                </div>
                                                <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {hasPermission('book', 'edit') && (
                                                        <button onClick={() => openEditForm('department', dep)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all" title="Edit">
                                                            <Edit3 size={12} />
                                                        </button>
                                                    )}
                                                    {hasPermission('book', 'delete') && (
                                                        <button onClick={() => handleDelete('department', dep)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all" title="Hapus">
                                                            <Trash2 size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
                <Pagination total={accTotal} current={accPage} onChange={setPage} rowCount={accData.length} />
            </div>
        );
    };

    const filterStatusOptions = [
        { id: 'all', label: text.filterAll },
        { id: 'active', label: text.filterActive },
        { id: 'inactive', label: text.filterInactive },
    ];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { key: 'accounts', icon: BookOpen, color: 'from-indigo-500 to-purple-600' },
                    { key: 'subs', icon: FolderOpen, color: 'from-cyan-500 to-blue-600' },
                    { key: 'departments', icon: Building2, color: 'from-amber-500 to-orange-600' },
                ].map(({ key, icon: Icon, color }) => (
                    <Card key={key} className="p-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}>
                                <Icon size={18} className="text-white" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{text.stats[key === 'accounts' ? 'accounts' : key === 'subs' ? 'subs' : 'deps']}</p>
                                <p className="text-xl font-extrabold text-slate-800 dark:text-white">{stats[key === 'accounts' ? 'accounts' : key === 'subs' ? 'sub_accounts' : 'departments']}</p>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            <Card noPadding>
                {/* Toolbar: Search + Filter + Actions */}
                {activeTab !== 'import' && (
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                            <div className="relative flex-1 sm:flex-none">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <Input
                                    type="text"
                                    placeholder={text.search}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="sm:w-56 pl-9 pr-4 py-2 text-sm transition-all"
                                />
                            </div>
                            <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
                                {filterStatusOptions.map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setFilterStatus(opt.id)}
                                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
                                            filterStatus === opt.id
                                                ? 'gradient-bg text-white shadow-sm'
                                                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
                                {[0, 10, 15, 25, 50].map(size => (
                                    <button
                                        key={size}
                                        onClick={() => { setPageSize(size); setPage(0); }}
                                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
                                            pageSize === size
                                                ? 'gradient-bg text-white shadow-sm'
                                                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                        }`}
                                    >
                                        {size === 0 ? text.pageAll : size}
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-1.5 sm:ml-auto">
                                {hasPermission('book', 'edit') && activeTab !== 'overview' && (
                                    <button
                                        onClick={() => openAddForm(activeTab === 'accounts' ? 'account' : activeTab === 'subs' ? 'sub_account' : 'department')}
                                        className="flex items-center gap-2 px-3 py-2 gradient-bg text-white text-xs font-bold rounded-xl hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 transition-all whitespace-nowrap"
                                    >
                                        <Plus size={14} /> {text.addNew}
                                    </button>
                                )}
                                {hasPermission('book', 'delete') && (
                                    <button onClick={handleDeleteAll} className="flex items-center gap-1.5 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-all whitespace-nowrap" title={text.deleteAll}>
                                        <Trash size={13} /> <span className="hidden sm:inline">{text.deleteAll}</span>
                                    </button>
                                )}
                                <button onClick={fetchData} className="p-2 rounded-xl text-slate-400 hover:text-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all" title="Refresh">
                                    <RefreshCw size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Import Progress Bar (compact, inline) */}
                {importing && importTotal > 0 && (
                    <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-indigo-50/50 dark:bg-indigo-950/20">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{importStage}</span>
                            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400">
                                {importProcessed}/{importTotal}
                                {importSuccess > 0 && <span className="text-emerald-600 dark:text-emerald-400 ml-2">{importSuccess} ✓</span>}
                                {importFailed > 0 && <span className="text-red-600 dark:text-red-400 ml-2">{importFailed} ✗</span>}
                            </span>
                        </div>
                        <div className="w-full bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl rounded-full h-1.5 overflow-hidden shadow-inner">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300"
                                style={{ width: `${importProgress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Tab Navigation */}
                <div className="px-4 pt-3 pb-0">
                    <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto w-full sm:w-auto">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                                    activeTab === tab.id
                                        ? 'gradient-bg text-white shadow-md transform scale-105 z-10'
                                        : 'text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                                }`}
                            >
                                {tab.label}
                                {tab.count !== undefined && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${activeTab === tab.id ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40' : 'bg-gray-200 dark:bg-slate-600 text-gray-500 dark:text-slate-400'}`}>{tab.count}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="min-h-[400px]">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size={24} className="animate-spin text-indigo-500" />
                            <span className="ml-3 text-sm text-slate-400">{text.loading}</span>
                        </div>
                    ) : activeTab === 'overview' ? (
                        renderOverview()
                    ) : activeTab === 'import' ? (
                        renderImportTab()
                    ) : activeTab === 'accounts' ? (
                        renderAccountsTab()
                    ) : activeTab === 'subs' ? (
                        renderTable(
                            [text.code, text.name, text.description, text.parent + ' ' + text.code, text.parent + ' ' + text.name, text.status],
                            allSubs, 'sub_account'
                        )
                    ) : (
                        renderTable(
                            [text.code, text.name, text.description, text.parent + ' ' + text.code, text.parent + ' ' + text.name, text.status],
                            allDeps, 'department'
                        )
                    )}
                </div>
            </Card>

            <Modal
                isOpen={showForm}
                onClose={() => setShowForm(false)}
                title={editingItem ? text.form[`edit${formLevel === 'account' ? 'Account' : formLevel === 'sub_account' ? 'Sub' : 'Dep'}`] : text.form[`add${formLevel === 'account' ? 'Account' : formLevel === 'sub_account' ? 'Sub' : 'Dep'}`]}
                size="max-w-md"
                footer={
                    <div className="flex gap-3">
                        <button onClick={() => setShowForm(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white text-xs font-black rounded-2xl transition-all uppercase tracking-widest">{text.cancel}</button>
                        <button onClick={handleSave} className="flex-1 py-3 gradient-bg text-white text-xs font-black rounded-2xl hover:bg-indigo-500 shadow-xl shadow-indigo-500/30 transition-all uppercase tracking-widest">{text.save}</button>
                    </div>
                }
            >
                <div className="space-y-4">
                            {(formLevel === 'sub_account' || formLevel === 'department') && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{text.selectParent}</label>
                                    <Select
                                        value={form.parent_id}
                                        onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
                                    >
                                        <option value="">{text.selectParent}</option>
                                        {parentOptions.map(opt => (
                                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                                        ))}
                                    </Select>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{text.code}</label>
                                <Input
                                    type="text"
                                    value={form.code}
                                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                                    className="font-mono"
                                    placeholder="Contoh: 1, 1-1, 1-1-01"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{text.name}</label>
                                <Input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="Contoh: Aktiva, Kas, Kas Kecil"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{text.description}</label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    rows={3}
                                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl px-4 py-3 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none"
                                    placeholder="Deskripsi singkat (opsional)"
                                />
                            </div>
                        </div>

            </Modal>

            {/* Delete All Confirmation Modal */}
            <Modal isOpen={showDeleteAllModal} onClose={() => { setShowDeleteAllModal(false); setDeleteConfirmText(''); }} size="max-w-lg" hideHeader noPadding>
                        {/* Header with animated warning */}
                        <div className="relative px-8 pt-8 pb-6 text-center bg-gradient-to-b from-red-50 to-white dark:from-red-950/30 dark:to-slate-900">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center animate-pulse">
                                <div className="w-16 h-16 rounded-full bg-red-200 dark:bg-red-800/40 flex items-center justify-center">
                                    <AlertTriangle size={32} className="text-red-600 dark:text-red-400" />
                                </div>
                            </div>
                            <h3 className="text-xl font-extrabold text-slate-800 dark:text-white">{text.deleteAllTitle}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{text.deleteAllWarning}</p>
                        </div>

                        {/* Content */}
                        <div className="px-8 pb-6">
                            {/* Stats being deleted */}
                            <div className="flex items-center justify-center gap-6 py-4 mb-5 gradient-bg-soft rounded-2xl">
                                <div className="text-center">
                                    <p className="text-2xl font-extrabold text-slate-800 dark:text-white">{stats.accounts}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{text.stats.accounts}</p>
                                </div>
                                <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
                                <div className="text-center">
                                    <p className="text-2xl font-extrabold text-slate-800 dark:text-white">{stats.sub_accounts}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{text.stats.subs}</p>
                                </div>
                                <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
                                <div className="text-center">
                                    <p className="text-2xl font-extrabold text-slate-800 dark:text-white">{stats.departments}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{text.stats.deps}</p>
                                </div>
                            </div>

                            {/* Consequences list */}
                            <ul className="space-y-2.5 mb-6">
                                {text.deleteAllConsequences.map((item, i) => (
                                    <li key={i} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
                                        <div className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <X size={10} className="text-red-500" />
                                        </div>
                                        {item}
                                    </li>
                                ))}
                            </ul>

                            {/* Type-to-confirm input */}
                            <div className="space-y-2 mb-6">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{text.deleteAllInputLabel}</label>
                                <input
                                    type="text"
                                    value={deleteConfirmText}
                                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                                    placeholder={text.deleteAllTypeConfirm}
                                    className="w-full px-4 py-3 bg-red-50 dark:bg-red-950/30 border-2 border-red-200 dark:border-red-800/50 rounded-xl text-sm font-mono text-red-600 dark:text-red-400 placeholder:text-red-300 dark:placeholder:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                                    autoFocus
                                />
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setShowDeleteAllModal(false); setDeleteConfirmText(''); }}
                                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white text-xs font-black rounded-2xl transition-all uppercase tracking-widest"
                                >
                                    {text.cancel}
                                </button>
                                <button
                                    onClick={confirmDeleteAll}
                                    disabled={deleteConfirmText !== (isEnglish ? 'DELETE' : 'HAPUS')}
                                    className={`flex-1 py-3 text-xs font-black rounded-2xl transition-all uppercase tracking-widest ${
                                        deleteConfirmText === (isEnglish ? 'DELETE' : 'HAPUS')
                                            ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-xl shadow-red-500/30 hover:from-red-400 hover:to-rose-500 cursor-pointer'
                                            : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                    }`}
                                >
                                    {text.deleteAll}
                                </button>
                            </div>
                        </div>
            </Modal>
        </div>
    );
}
