import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Plus, Trash2, Eye, FileSpreadsheet, FileText, Upload,
    X, Search, Filter, Edit3,
    Receipt, Save, ClipboardList,
    DollarSign, Loader2, CheckCircle2, MoreVertical, Info, Hash
} from 'lucide-react';
import { entertainmentService } from '../services/entertainmentService';
import { API_URL } from '../services/apiClient';
import { SummaryRow } from '../components/ui/Card';
import { useLanguage } from '../contexts/LanguageContext';
import { useModalKeydown, useModalScrollLock } from '../components/ui/useModalKeydown';

const JENIS_OPTIONS = ['Breakfast', 'Lunch', 'Dinner', 'Event', 'Custom'];
const JENIS_USAHA_OPTIONS = [
    'MANUFACTURING', 'TRADING', 'SERVICES', 'FINANCE', 'TECHNOLOGY',
    'CONSTRUCTION', 'TRANSPORTATION', 'AGRICULTURE', 'MINING',
    'EDUCATION', 'HEALTHCARE', 'HOSPITALITY', 'MEDIA', 'OTHER', 'Custom'
];
const JENIS_USAHA_PRESET = JENIS_USAHA_OPTIONS.filter(j => j !== 'Custom');

const emptyForm = () => ({
    tanggal: '', tempat: '', alamat: '', jenis: '', custom_jenis: '',
    nilai: '', no_gl: '', gl_number: '', groups: [{ relasi: '', jabatan: '', nama_perusahaan: '' }],
    jenis_usaha: '', custom_jenis_usaha: '', catatan_kode: ''
});

const silentToast = { success: () => {}, error: () => {}, info: () => {}, warning: () => {}, loading: () => {} };

export default function EntertainmentExpenses({ currentUser, toast: toastProp }) {
    const toast = toastProp || silentToast;
    const { language, t } = useLanguage();
    const isEnglish = language === 'en';
    const text = isEnglish ? {
        // Summary
        totalEntries: 'Total Entries', totalEntriesSub: 'All entertainment data',
        totalNilai: 'Total Amount', totalNilaiSub: 'Accumulated total expenses',
        totalLampiran: 'Total Attachments', totalLampiranSub: 'Files uploaded',
        // Tabs
        pending: 'Pending', settled: 'Settled',
        // Buttons
        addNew: 'Add New Entry', exportPdf: 'Export PDF', exportExcel: 'Export Excel',
        searchPlaceholder: 'Search venue, type, AF, requester, ref...',
        // Filter
        filterTanggalFrom: 'Date From', filterTanggalTo: 'Date To', filterJenis: 'Filter Type', filterSearch: 'Search',
        filterAll: 'All', filterBtn: 'Filter', filterReset: 'Reset', filterNoAf: 'AF Number',
        // Table
        thAksi: 'Actions', thTanggal: 'Date', thNoAf: 'AF Number', thNoRef: 'Ref No', thNamaRelasi: 'Relation',
        thJabatan: 'Position', thNilai: 'Amount', thJenis: 'Type', thPengaju: 'Requester',
        loading: 'Loading data...', empty: 'No data yet',
        // Actions
        preview: 'Preview', edit: 'Edit', settle: 'Settle', exportPdfBtn: 'Export PDF', delete: 'Delete', glAction: 'GL Number',
        glTitle: 'Update GL Number', glCurrent: 'Current GL Number', glNew: 'New GL Number', glSave: 'Save GL Number', glSaved: 'GL number updated successfully', glEmpty: 'GL number is required',
        // Form
        formTitle: 'Entertainment Expenses', formEdit: 'Edit Entry', formNew: 'New Entry',
        lblTanggal: 'Date *', lblTempat: 'Venue', lblJenis: 'Type *', lblCustomJenis: 'Custom type',
        lblAlamat: 'Address Venue *', lblNilai: 'Amount (IDR) *', lblNoGl: 'AF Number *', lblGl: 'No GL *',
        lblJenisUsaha: 'Business Type *', lblCustomJenisUsaha: 'Custom business type',
        lblPlan: 'Plan *', lblMomResult: 'MOM/Result *', lblLampiran: 'Attachments', lblDragDrop: 'Click or drag files here',
        btnSave: 'Save', btnCancel: 'Cancel', btnUpdate: 'Update',
        // Settle
        settleTitle: 'Settle Entertainment', lblSettleDate: 'Settle Date *',
        lblSettleAmount: 'Settle Amount', lblDraw: 'Draw (Same)',
        lblOver: 'Over', lblShortage: 'Shortage', lblSame: 'Same', lblAfShortage: 'AF Shortage',
        filterAllSettle: 'All', filterOver: 'Over', filterDraw: 'Draw', filterShortage: 'Shortage',
        lblRelasiPerusahaan: 'Relation & Company', btnTambahRelasi: 'Add Relation',
        lblCatatan: 'Notes', btnSettle: 'Settle', btnBatal: 'Cancel',
        // Preview
        previewTitle: 'Preview Entertainment Expenses',
        detailTanggal: 'Date', detailTempat: 'Venue', detailJenis: 'Type',
        detailAlamat: 'Address Venue', detailNilai: 'Amount', detailNoGl: 'AF Number',
        detailGl: 'No GL',
        detailJenisUsaha: 'Business Type', detailRelasi: 'Relations',
        detailJumlahRelasi: 'Relation Count', detailPerusahaan: 'Companies',
        detailPlan: 'Plan', detailMomResult: 'MOM/Result', detailLampiran: 'Attachments',
        // Rules
        rulesTitle: 'Entertainment Rules', addRule: 'Add Rule', editRule: 'Edit Rule',
        ruleName: 'Rule Name', targetType: 'Target Type', targetValue: 'Target Value',
        viewAll: 'View All', canCreate: 'Create', canEdit: 'Edit', canDelete: 'Delete',
        canSettle: 'Settle', canExport: 'Export',         active: 'Active', aksi: 'Action',
        noRules: 'No rules yet', addNewRule: 'Add New Rule',
        targetUser: 'Select User', targetDivision: 'Select Division', targetRole: 'Select Role',
        permViewAll: 'View All Data (Bypass Row Security)', permExportAll: 'Export All',
        permCreate: 'Can Create', permEdit: 'Can Edit', permDelete: 'Can Delete',
        permSettle: 'Can Settle', permExport: 'Can Export',
        btnSaveRule: 'Save', btnCancelRule: 'Cancel', btnUpdateRule: 'Update',
        // Validation
        errTanggal: 'Date is required', errTempat: 'Venue is required',
        errAlamat: 'Address is required', errJenis: 'Type is required',
        errCustomJenis: 'Custom type is required', errNoGl: 'AF Number is required', errNoGlFormat: 'AF Number must be PR followed by 6 digits (e.g. PR000001)',
        errJenisUsaha: 'Business type is required', errCustomJenisUsaha: 'Custom business type is required',
        errGroups: 'At least 1 relation group is required', errAttachments: 'At least 1 attachment is required',
        errNilai: 'Amount is required', errMomResult: 'MOM/Result is required',
        errSettleDate: 'Settle date is required',
        // Misc
        placeholdRelasi: 'Relation Name', placeholdJabatan: 'Position', placeholdPerusahaan: 'Company Name',
        // Settle modal extra
        selectOption: 'Select', removeRelation: 'Remove relation',
        uploadAttachments: 'Click to upload additional attachments',
        savedAttachments: 'Saved Attachments', newAttachments: 'New Attachments',
        processing: 'Processing...',
        // Missing form labels
        pilihJenis: 'Select Type', customJenisPlaceholder: 'Enter custom type...',
        customJenisUsahaPlaceholder: 'Enter custom business type...',
        lblGroupRelasi: 'Relations & Companies *', lblGroupNamaRelasi: 'Relation Name *',
        lblGroupJabatan: 'Position',         lblGroupPerusahaan: 'Company Name (Full Name)',
        lblGroupRelasiPlaceholder: 'Relation {n}', lblGroupJabatanPlaceholder: 'Position {n}',
        lblGroupPerusahaanPlaceholder: 'Company {n}', btnHapusGroup: 'Remove Group',
        btnTambahGroupRelasi: 'Add Relation Group',
        lblJumlahRelasi: 'Total Relations',
        fromJumlahGroup: 'filled from {n} group(s)',
        uploadPaste: 'Click to upload or <strong>Paste (Ctrl+V)</strong> from clipboard',
        uploadSupport: 'Supports: PDF, JPG, PNG, DOCX, XLSX, etc.',
        // Pagination
        pagination: 'Page {page} of {totalPages} ({totalEntries} entries)',
        // Toasts
        pdfExportSuccess: 'PDF exported successfully', pdfExportFailed: 'Failed to export PDF',
        excelExportSuccess: 'Excel exported successfully', excelExportFailed: 'Failed to export Excel',
        exportExcelBtn: 'Export Excel',
        // Preview
        noAttachment: 'No attachments',
        // Delete tooltip
        deleteTitle: 'Delete',
    } : {
        // Summary
        totalEntries: 'Total Entries', totalEntriesSub: 'Semua data entertainment',
        totalNilai: 'Total Nilai', totalNilaiSub: 'Akumulasi seluruh biaya',
        totalLampiran: 'Total Lampiran', totalLampiranSub: 'File yang diunggah',
        // Tabs
        pending: 'Pending', settled: 'Settled',
        // Buttons
        addNew: 'Tambah Entry Baru', exportPdf: 'Export PDF', exportExcel: 'Export Excel',
        searchPlaceholder: 'Cari tempat, jenis, AF, pengaju, ref...',
        // Filter
        filterTanggalFrom: 'Tgl Dari', filterTanggalTo: 'Tgl Sampai', filterJenis: 'Filter Jenis', filterSearch: 'Pencarian',
        filterAll: 'Semua', filterBtn: 'Filter', filterReset: 'Reset', filterNoAf: 'No AF',
        // Table
        thAksi: 'Aksi', thTanggal: 'Tanggal', thNoAf: 'No AF', thNoRef: 'No Ref', thNamaRelasi: 'Nama Relasi',
        thJabatan: 'Jabatan', thNilai: 'Nilai', thJenis: 'Jenis', thPengaju: 'Pengaju',
        loading: 'Memuat data...', empty: 'Belum ada data',
        // Actions
        preview: 'Preview', edit: 'Edit', settle: 'Settle', exportPdfBtn: 'Export PDF', delete: 'Hapus', glAction: 'GL Number',
        glTitle: 'Update GL Number', glCurrent: 'GL Number Saat Ini', glNew: 'GL Number Baru', glSave: 'Simpan GL Number', glSaved: 'GL number berhasil diperbarui', glEmpty: 'GL number wajib diisi',
        // Form
        formTitle: 'Entertainment Expenses', formEdit: 'Edit Entry', formNew: 'Entry Baru',
        lblTanggal: 'Tanggal *', lblTempat: 'Tempat', lblJenis: 'Jenis *', lblCustomJenis: 'Custom jenis',
        lblAlamat: 'Alamat Venue *', lblNilai: 'Nilai (IDR) *', lblNoGl: 'No AF *', lblGl: 'No GL *',
        lblJenisUsaha: 'Jenis Usaha *', lblCustomJenisUsaha: 'Custom jenis usaha',
        lblPlan: 'Plan *', lblMomResult: 'MOM/Result *', lblLampiran: 'Lampiran', lblDragDrop: 'Klik atau seret file ke sini',
        btnSave: 'Simpan', btnCancel: 'Batal', btnUpdate: 'Update',
        // Settle
        settleTitle: 'Settle Entertainment', lblSettleDate: 'Tanggal Settle *',
        lblSettleAmount: 'Settle Amount', lblDraw: 'Draw (Sama)',
        lblOver: 'Over', lblShortage: 'Shortage', lblSame: 'Same', lblAfShortage: 'AF Shortage',
        filterAllSettle: 'Semua', filterOver: 'Over', filterDraw: 'Draw', filterShortage: 'Shortage',
        lblRelasiPerusahaan: 'Relasi & Perusahaan', btnTambahRelasi: 'Tambah Relasi',
        lblCatatan: 'Catatan', btnSettle: 'Settle', btnBatal: 'Batal',
        // Preview
        previewTitle: 'Preview Entertainment Expenses',
        detailTanggal: 'Tanggal', detailTempat: 'Tempat', detailJenis: 'Jenis',
        detailAlamat: 'Alamat Venue', detailNilai: 'Nilai', detailNoGl: 'No AF',
        detailGl: 'No GL',
        detailJenisUsaha: 'Jenis Usaha', detailRelasi: 'Relasi',
        detailJumlahRelasi: 'Jumlah Relasi', detailPerusahaan: 'Perusahaan',
        detailPlan: 'Plan', detailMomResult: 'MOM/Result', detailLampiran: 'Lampiran',
        // Rules
        rulesTitle: 'Entertainment Rules', addRule: 'Tambah Rule', editRule: 'Edit Rule',
        ruleName: 'Rule Name', targetType: 'Target Type', targetValue: 'Target Value',
        viewAll: 'View All', canCreate: 'Create', canEdit: 'Edit', canDelete: 'Delete',
        canSettle: 'Settle', canExport: 'Export',         active: 'Active', aksi: 'Aksi',
        noRules: 'Belum ada rule', addNewRule: 'Tambah Rule Baru',
        targetUser: 'Pilih User', targetDivision: 'Pilih Divisi', targetRole: 'Pilih Role',
        permViewAll: 'Lihat Semua Data (Bypass Row Security)', permExportAll: 'Export All',
        permCreate: 'Bisa Create', permEdit: 'Bisa Edit', permDelete: 'Bisa Delete',
        permSettle: 'Bisa Settle', permExport: 'Bisa Export',
        btnSaveRule: 'Simpan', btnCancelRule: 'Batal', btnUpdateRule: 'Update',
        // Validation
        errTanggal: 'Tanggal wajib diisi', errTempat: 'Tempat wajib diisi',
        errAlamat: 'Alamat wajib diisi', errJenis: 'Jenis wajib diisi',
        errCustomJenis: 'Custom jenis wajib diisi', errNoGl: 'No AF wajib diisi', errNoGlFormat: 'No AF harus format PR diikuti 6 digit (contoh: PR000001)',
        errJenisUsaha: 'Jenis Usaha wajib diisi', errCustomJenisUsaha: 'Custom jenis usaha wajib diisi',
        errGroups: 'Minimal 1 grup relasi wajib diisi', errAttachments: 'Minimal 1 lampiran wajib diupload',
        errNilai: 'Nilai wajib diisi', errMomResult: 'MOM/Result wajib diisi',
        errSettleDate: 'Tanggal settle wajib diisi',
        // Misc
        placeholdRelasi: 'Nama Relasi', placeholdJabatan: 'Jabatan', placeholdPerusahaan: 'Nama Perusahaan',
        // Settle modal extra
        selectOption: 'Pilih', removeRelation: 'Hapus relasi',
        uploadAttachments: 'Klik untuk upload lampiran tambahan',
        savedAttachments: 'Lampiran Tersimpan', newAttachments: 'Lampiran Baru',
        processing: 'Memproses...',
        // Missing form labels
        pilihJenis: 'Pilih Jenis', customJenisPlaceholder: 'Masukkan jenis custom...',
        customJenisUsahaPlaceholder: 'Masukkan jenis usaha custom...',
        lblGroupRelasi: 'Relasi & Perusahaan *', lblGroupNamaRelasi: 'Nama Relasi *',
        lblGroupJabatan: 'Jabatan',         lblGroupPerusahaan: 'Nama Perusahaan (Full Name)',
        lblGroupRelasiPlaceholder: 'Relasi {n}', lblGroupJabatanPlaceholder: 'Jabatan {n}',
        lblGroupPerusahaanPlaceholder: 'Perusahaan {n}', btnHapusGroup: 'Hapus Group',
        btnTambahGroupRelasi: 'Tambah Group Relasi',
        lblJumlahRelasi: 'Jumlah Relasi',
        fromJumlahGroup: 'diisi dari {n} group',
        uploadPaste: 'Klik untuk upload atau <strong>Paste (Ctrl+V)</strong> dari clipboard',
        uploadSupport: 'Support: PDF, JPG, PNG, DOCX, XLSX, dll',
        // Pagination
        pagination: 'Halaman {page} dari {totalPages} ({totalEntries} data)',
        // Toasts
        pdfExportSuccess: 'PDF berhasil diexport', pdfExportFailed: 'Gagal export PDF',
        excelExportSuccess: 'Excel berhasil diexport', excelExportFailed: 'Gagal export Excel',
        exportExcelBtn: 'Export Excel',
        // Preview
        noAttachment: 'Tidak ada lampiran',
        // Delete tooltip
        deleteTitle: 'Hapus',
    };
    const fileInputRef = useRef(null);
    const pasteZoneRef = useRef(null);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [showPreview, setShowPreview] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [searchParams, setSearchParams] = useState({ tanggal_from: '', tanggal_to: '', jenis: '', search: '', entry_type: '', no_gl: '' });
    const [exportingPdf, setExportingPdf] = useState(false);
    const [exportingExcel, setExportingExcel] = useState(false);
    
    const [form, setForm] = useState(emptyForm);
    const [entryType, setEntryType] = useState('plan'); // 'plan' | 'reimburse'
    const [errors, setErrors] = useState({});
    const [attachments, setAttachments] = useState([]);
    const [existingAttachments, setExistingAttachments] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalEntries, setTotalEntries] = useState(0);
    const [tab, setTab] = useState('pending');
    const [settleFilter, setSettleFilter] = useState('all');
    const [showSettleModal, setShowSettleModal] = useState(false);
    const [settleConfirmOpen, setSettleConfirmOpen] = useState(false);
    const [settleItem, setSettleItem] = useState(null);
    const [settleForm, setSettleForm] = useState({});
    const [settleSubmitting, setSettleSubmitting] = useState(false);
    const [settleAttachments, setSettleAttachments] = useState([]);
    const [settleExistingAttachments, setSettleExistingAttachments] = useState([]);
    const settleFileInputRef = useRef(null);
    const [rules, setRules] = useState([]);
    const [userPerms, setUserPerms] = useState({ view_all: false, can_create: true, can_edit: true, can_delete: true, can_settle: true, can_export: true });
    const [unsettledCount, setUnsettledCount] = useState(0);
    const [showRuleForm, setShowRuleForm] = useState(false);
    const [editingRule, setEditingRule] = useState(null);
    const [ruleForm, setRuleForm] = useState({ rule_name: '', target_type: 'user', target_value: '', view_all: false, can_create: true, can_edit: true, can_delete: true, can_settle: true, can_export: true, export_all: false });
    const [ruleSubmitting, setRuleSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [glTarget, setGlTarget] = useState(null);
    const [glValue, setGlValue] = useState('');
    const [glSaving, setGlSaving] = useState(false);
    const [deletingRuleId, setDeletingRuleId] = useState(null);
    const [exportingPdfId, setExportingPdfId] = useState(null);
    const [previewExporting, setPreviewExporting] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'data'|'rule', id, label }
    // Row action menu (⋮) — harmonized with Invoices
    const [actionMenu, setActionMenu] = useState(null);
    const actionMenuRef = useRef(null);
    const openRowMenu = (item, r) => {
        const W = 220, GAP = 6;
        const btnTop = r.top, btnBottom = r.bottom;
        const x = Math.max(8, Math.min(r.left, window.innerWidth - W - 8));
        const below = btnBottom + GAP;
        const above = btnTop - GAP;
        const openUp = (below + 300) > window.innerHeight && above > 8;
        const dir = openUp ? 'up' : 'down';
        const estH = 300;
        const y = openUp ? Math.max(8, above - estH) : below;
        const maxH = Math.max(120, window.innerHeight - y - 8);
        return { item, tab: tab, x, y, maxH, btnTop, btnBottom, dir };
    };
    useEffect(() => {
        if (!actionMenu || actionMenu._fixed || !actionMenuRef.current) return;
        const h = actionMenuRef.current.offsetHeight;
        const GAP = 6;
        let y, maxH;
        if (actionMenu.dir === 'up') {
            y = Math.max(8, actionMenu.btnTop - GAP - h);
            maxH = Math.max(120, actionMenu.btnTop - GAP - 8);
        } else {
            y = actionMenu.btnBottom + GAP;
            maxH = Math.max(120, window.innerHeight - y - 8);
        }
        setActionMenu(a => a ? { ...a, y, maxH, _fixed: true } : a);
    }, [actionMenu]);
    const [usersList, setUsersList] = useState([]);
    const [departmentsList, setDepartmentsList] = useState([]);
    const [rolesList, setRolesList] = useState([]);
    const WARNINGS_KEY = 'entertainment_anomaly_warnings';

    const [anomalyWarnings, setAnomalyWarnings] = useState(() => {
        try {
            const stored = localStorage.getItem(WARNINGS_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch { return []; }
    });

    const persistWarnings = (warnings) => {
        setAnomalyWarnings(warnings);
        try { localStorage.setItem(WARNINGS_KEY, JSON.stringify(warnings)); } catch {}
    };

    const dismissWarnings = () => {
        setAnomalyWarnings([]);
        try { localStorage.removeItem(WARNINGS_KEY); } catch {}
    };

    const parseField = (val, fallback = []) => {
        if (val == null || val === '') return fallback;
        if (typeof val === 'string') {
            try { return JSON.parse(val); } catch { return fallback; }
        }
        return val;
    };

    // ESC menutup modal paling atas (konsisten dengan komponen Modal bersama)
    useModalKeydown(() => {
        if (deleteTarget) { setDeleteTarget(null); return; }
        if (showSettleModal) { setShowSettleModal(false); return; }
        if (showRuleForm) { setShowRuleForm(false); return; }
        if (showPreview) { setShowPreview(false); return; }
        if (showForm) { setShowForm(false); return; }
    });

    // Kunci scroll body saat salah satu modal inline terbuka (konsisten dengan Modal bersama)
    useModalScrollLock(!!(deleteTarget || showSettleModal || showRuleForm || showPreview || showForm));

    const fetchData = useCallback(async (opts = {}) => {
        const silent = opts.silent === true;
        try {
            if (!silent) setLoading(true);
            const params = { page, perPage: 15, status: tab === 'settled' ? 'settled' : 'active,draft' };
            if (tab === 'settled' && settleFilter !== 'all') params.settle_status = settleFilter;
            if (searchParams.tanggal_from) params.tanggal_from = searchParams.tanggal_from;
            if (searchParams.tanggal_to) params.tanggal_to = searchParams.tanggal_to;
            if (searchParams.jenis) params.jenis = searchParams.jenis;
            if (searchParams.search) params.search = searchParams.search;
            if (searchParams.entry_type) params.entry_type = searchParams.entry_type;
            if (searchParams.no_gl) params.no_gl = searchParams.no_gl;
            const result = await entertainmentService.getAll(params);
            const list = Array.isArray(result) ? result : (result?.data || []);
            const parsed = list.map(item => ({
                ...item,
                relasi: parseField(item.relasi, []),
                jabatan: parseField(item.jabatan, []),
                nama_perusahaan: parseField(item.nama_perusahaan, []),
                attachments: parseField(item.attachments, [])
            }));
            setData(parsed);
            if (result && typeof result === 'object' && !Array.isArray(result)) {
                setTotalEntries(result.total || 0);
                setTotalPages(result.totalPages || 1);
                if (result.permissions) {
                    setUserPerms(result.permissions);
                    setUnsettledCount(result.permissions.unsettledCount || 0);
                }
            } else {
                setTotalEntries(parsed.length);
                setTotalPages(1);
            }
        } catch (e) {
            console.error('Fetch error:', e);
            if (!silent) toast.error(e.message || t('entertain.gagalLoad'));
        } finally {
            if (!silent) setLoading(false);
        }
    }, [searchParams, toast, page, tab, settleFilter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const resetForm = () => {
        setForm(emptyForm());
        setEntryType('plan');
        setErrors({});
        setAttachments([]);
        setExistingAttachments([]);
        setEditingId(null);
    };

    const resolveJenisUsaha = () => (
        form.jenis_usaha === 'Custom' ? (form.custom_jenis_usaha || '').trim() : form.jenis_usaha
    );

    const validate = () => {
        const errs = {};
        if (!form.tanggal) errs.tanggal = text.errTanggal;
        if (!form.tempat) errs.tempat = text.errTempat;
        if (!form.alamat) errs.alamat = text.errAlamat;
        if (!form.jenis) errs.jenis = text.errJenis;
        if (form.jenis === 'Custom' && !form.custom_jenis?.trim()) errs.custom_jenis = text.errCustomJenis;
        if (!form.nilai) errs.nilai = text.errNilai;
        if (!form.no_gl) {
            errs.no_gl = text.errNoGl;
        } else if (!/^PR\d{6}$/.test(String(form.no_gl).toUpperCase())) {
            errs.no_gl = text.errNoGlFormat;
        }
        if (!form.gl_number) errs.gl_number = isEnglish ? 'No GL is required' : 'No GL wajib diisi';
        if (!form.groups || form.groups.length === 0 || !form.groups[0].relasi?.trim()) errs.groups = text.errGroups;
        if (!form.jenis_usaha) errs.jenis_usaha = text.errJenisUsaha;
        if (form.jenis_usaha === 'Custom' && !form.custom_jenis_usaha?.trim()) {
            errs.custom_jenis_usaha = text.errCustomJenisUsaha;
        }
        if (!form.catatan_kode) errs.catatan_kode = text.errMomResult;
        return Object.keys(errs).length === 0;
    };

    const formatCurrency = (val) => {
        if (!val) return '';
        const num = parseFloat(String(val).replace(/[^\d.-]/g, '')) || 0;
        return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
    };

    const formatAf = (val) => {
        const digits = String(val || '').replace(/[^0-9]/g, '').slice(0, 6);
        return digits ? `PR${digits}` : '';
    };

    const parseCurrency = (val) => {
        return val ? val.toString().replace(/[^\d]/g, '') : '';
    };

    const handleNilaiChange = (e) => {
        const raw = parseCurrency(e.target.value);
        setForm(prev => ({ ...prev, nilai: raw }));
    };

    const handleSubmit = async (e, entryStatus) => {
        if (e && e.preventDefault) e.preventDefault();
        if (submitting) return; // anti double-submit
        if (!validate()) {
            toast.error(t('entertain.fieldRequired'));
            return;
        }
        setSubmitting(true);
        try {
            const fd = new FormData();
            fd.append('tanggal', form.tanggal);
            fd.append('tempat', form.tempat);
            fd.append('alamat', form.alamat);
            fd.append('jenis', form.jenis);
            fd.append('custom_jenis', form.custom_jenis);
            fd.append('nilai', form.nilai);
            fd.append('no_gl', String(form.no_gl).toUpperCase());
            fd.append('gl_number', form.gl_number);
            const filledGroups = form.groups.filter(g => g.relasi?.trim());
            const relasiArr = filledGroups.map(g => g.relasi.trim());
            const jabatanArr = filledGroups.map(g => (g.jabatan || '').trim());
            const perusahaanArr = filledGroups.map(g => (g.nama_perusahaan || '').trim());
            fd.append('relasi', JSON.stringify(relasiArr));
            fd.append('jabatan', JSON.stringify(jabatanArr));
            fd.append('nama_perusahaan', JSON.stringify(perusahaanArr));
            fd.append('jenis_usaha', resolveJenisUsaha());
            fd.append('entry_type', entryType);
            // Direct settle for reimburse (status 'settled') or save-as-draft (status 'draft')
            if (entryStatus) {
                fd.append('status', entryStatus);
                if (entryStatus === 'settled') {
                    fd.append('settle_date', form.tanggal || new Date().toISOString().split('T')[0]);
                }
            }
            fd.append('catatan_kode', form.catatan_kode);

            if (editingId) {
                fd.append('existing_attachments', JSON.stringify(existingAttachments));
            }

            attachments.forEach(file => {
                fd.append('attachments', file);
            });

            let result;
            if (editingId) {
                result = await entertainmentService.update(editingId, fd);
                toast.success(t('entertain.dataUpdated'));
            } else {
                result = await entertainmentService.create(fd);
                if (entryStatus === 'settled') {
                    toast.success(isEnglish ? 'Reimburse created and settled successfully' : 'Entry reimburse berhasil dibuat dan langsung di-settle');
                } else if (entryStatus === 'draft') {
                    toast.success(isEnglish ? 'Saved to draft' : 'Disimpan ke draft');
                } else {
                    toast.success(isEnglish ? 'Data saved successfully' : 'Data berhasil disimpan');
                }
            }

            const warns = result?.warnings;
            if (warns && Array.isArray(warns) && warns.length > 0) {
                persistWarnings(warns);
                toast.warning(
                    isEnglish
                        ? `⚠️ ${warns.length} anomali terdeteksi! Cek ${warns.map(w => w.ref_no || `ENT-${String(w.id).padStart(5, '0')}`).join(', ')}`
                        : `⚠️ ${warns.length} anomali terdeteksi! Cek ${warns.map(w => w.ref_no || `ENT-${String(w.id).padStart(5, '0')}`).join(', ')}`
                );
            }

            resetForm();
            setShowForm(false);
            // Jangan reset filter dulu agar fetch tidak double-trigger error
            await fetchData({ silent: false });
        } catch (e) {
            console.error('Submit error:', e);
            const msg = e?.message || 'Terjadi kesalahan saat menyimpan';
            // Tampilkan detail validasi jika ada
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (item) => {
        let editGroups = item.groups || [];
        if (!editGroups.length && (item.relasi || item.nama_perusahaan || item.jabatan)) {
            const maxLen = Math.max(
                (item.relasi || []).length,
                (item.jabatan || []).length,
                (item.nama_perusahaan || []).length
            );
            editGroups = Array.from({ length: maxLen || 1 }, (_, i) => ({
                relasi: (item.relasi || [])[i] || '',
                jabatan: (item.jabatan || [])[i] || '',
                nama_perusahaan: (item.nama_perusahaan || [])[i] || ''
            }));
        }
        const savedUsaha = item.jenis_usaha || '';
        const isCustomUsaha = savedUsaha && !JENIS_USAHA_PRESET.includes(savedUsaha);
        setForm({
            tanggal: item.tanggal || '',
            tempat: item.tempat || '',
            alamat: item.alamat || '',
            jenis: item.jenis || '',
            custom_jenis: item.custom_jenis || '',
        nilai: item.nilai ? String(item.nilai).replace(/\.00$/, '') : '',
            no_gl: item.no_gl || '',
            gl_number: item.gl_number || '',
            groups: editGroups.length > 0 ? editGroups : [{ relasi: '', jabatan: '', nama_perusahaan: '' }],
            jenis_usaha: isCustomUsaha ? 'Custom' : savedUsaha,
            custom_jenis_usaha: isCustomUsaha ? savedUsaha : '',
            catatan_kode: item.catatan_kode || ''
        });
        setExistingAttachments(Array.isArray(item.attachments) ? item.attachments : []);
        setAttachments([]);
        setEditingId(item.id);
        // Buka form sesuai tipe entry — draft reimburse langsung terbuka di tab Reimburse
        setEntryType(item.entry_type === 'reimburse' ? 'reimburse' : 'plan');
        setShowForm(true);
        setErrors({});
    };

    const handleDelete = (id, label) => {
        if (deletingId) return;
        setDeleteTarget({ type: 'data', id, label });
    };

    const handlePreview = (item) => {
        setPreviewData(item);
        setShowPreview(true);
    };

    // File handling
    const addFiles = useCallback((files) => {
        const list = (files || []).filter(Boolean);
        if (list.length === 0) return;
        setAttachments(prev => [...prev, ...list]);
        setErrors(prev => {
            if (!prev.attachments) return prev;
            const next = { ...prev };
            delete next.attachments;
            return next;
        });
    }, []);

    const handleFileChange = (e) => {
        addFiles(Array.from(e.target.files || []));
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handlePaste = useCallback((e) => {
        const clipboard = e.clipboardData || window.clipboardData;
        const items = clipboard?.items;
        if (!items) return;

        const files = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file' || item.type?.startsWith('image/')) {
                let file = null;
                try { file = item.getAsFile(); } catch { }
                if (file) {
                    if (!file.name || file.name.startsWith('image')) {
                        const ext = (file.type || 'image/png').split('/')[1] || 'png';
                        files.push(new File([file], `paste_${Date.now()}_${i}.${ext}`, { type: file.type }));
                    } else {
                        files.push(file);
                    }
                }
            }
        }

        if (files.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            addFiles(files);
            toast.success(`${files.length} ${t('entertain.fileAttached')}`);
        }
    }, [addFiles, toast]);

    useEffect(() => {
        if (!showForm) return;
        const onDocPaste = (e) => {
            const tag = (e.target?.tagName || '').toUpperCase();
            if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
            handlePaste(e);
        };
        document.addEventListener('paste', onDocPaste);
        return () => document.removeEventListener('paste', onDocPaste);
    }, [showForm, handlePaste]);

    // Settle paste handler
    const handleSettlePaste = useCallback((e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        const files = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file' || item.type?.startsWith('image/')) {
                let file = null;
                try { file = item.getAsFile(); } catch { }
                if (file) {
                    if (!file.name || file.name.startsWith('image')) {
                        const ext = (file.type || 'image/png').split('/')[1] || 'png';
                        files.push(new File([file], `paste_${Date.now()}_${i}.${ext}`, { type: file.type }));
                    } else {
                        files.push(file);
                    }
                }
            }
        }
        if (files.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            setSettleAttachments(prev => [...prev, ...files]);
            toast.success(`${files.length} ${t('entertain.fileAttached')}`);
        }
    }, [toast]);

    useEffect(() => {
        if (!showSettleModal) return;
        const onDocPaste = (e) => {
            const tag = (e.target?.tagName || '').toUpperCase();
            if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
            handleSettlePaste(e);
        };
        document.addEventListener('paste', onDocPaste);
        return () => document.removeEventListener('paste', onDocPaste);
    }, [showSettleModal, handleSettlePaste]);

    const removeAttachment = (index, e) => {
        e?.stopPropagation?.();
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const removeExistingAttachment = (index, e) => {
        e?.stopPropagation?.();
        setExistingAttachments(prev => prev.filter((_, i) => i !== index));
    };

    // Relasi helpers
    const addGroup = () => setForm(prev => ({ ...prev, groups: [...prev.groups, { relasi: '', jabatan: '', nama_perusahaan: '' }] }));
    const removeGroup = (idx) => {
        if (form.groups.length <= 1) return;
        setForm(prev => ({ ...prev, groups: prev.groups.filter((_, i) => i !== idx) }));
    };
    const updateGroup = (idx, field, val) => {
        setForm(prev => {
            const g = [...prev.groups];
            g[idx] = { ...g[idx], [field]: val };
            return { ...prev, groups: g };
        });
    };
    const jumlahRelasi = form.groups.filter(g => g.relasi.trim()).length;

    const totalNilai = data.reduce((sum, item) => sum + (parseFloat(item.nilai) || 0), 0);
    const totalLampiran = data.reduce((sum, item) => {
        const atts = item.attachments || [];
        return sum + atts.length;
    }, 0);

    const handleSearchKeyDown = (e) => {
        if (e.key === 'Enter') setPage(1);
    };

    const formatDateForInput = (date) => {
        if (!date) return '';
        if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) return date.slice(0, 10);
        try {
            const d = new Date(date);
            if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
        } catch {}
        return String(date).slice(0, 10);
    };
    const formatDateId = (date) => {
        if (!date) return '-';
        const raw = typeof date === 'string' ? date.slice(0, 10) : String(date).slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const [y, m, d] = raw.split('-');
        return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
    };

    const initSettleForm = (item) => ({
        tanggal: formatDateForInput(item.tanggal),
        tempat: item.tempat || '',
        alamat: item.alamat || '',
        jenis: item.jenis || '',
        custom_jenis: item.custom_jenis || '',
        nilai: item.nilai ? String(item.nilai).replace(/\.00$/, '') : '',
        no_gl: item.no_gl || '',
        gl_number: item.gl_number || '',
        no_gl_shortage: item.no_gl_shortage || '',
        groups: (item.relasi || []).map((relasi, i) => ({
            relasi,
            jabatan: (item.jabatan || [])[i] || '',
            nama_perusahaan: (item.nama_perusahaan || [])[i] || ''
        })),
        jenis_usaha: item.jenis_usaha || '',
        custom_jenis_usaha: (item.jenis_usaha && !JENIS_USAHA_PRESET.includes(item.jenis_usaha)) ? item.jenis_usaha : '',
        catatan_kode: item.catatan_kode || '',
        settle_date: item.settle_date || new Date().toISOString().split('T')[0],
        settle_amount: item.settle_amount ? String(item.settle_amount).replace(/\.00$/, '') : '',
        is_draw: !item.settle_amount
    });

    const handleSettle = (item) => {
        setSettleItem(item);
        setSettleForm(initSettleForm(item));
        setSettleExistingAttachments(Array.isArray(item.attachments) ? item.attachments : []);
        setSettleAttachments([]);
        setShowSettleModal(true);
    };

    const handleSettleSubmit = async () => {
        if (!settleItem) return;
        if (settleSubmitting) return; // anti double-submit
        if (!settleForm.settle_date) {
            toast.error(text.errSettleDate);
            return;
        }
        if (!settleForm.tanggal) { toast.error(text.errTanggal); return; }
        if (!settleForm.tempat) { toast.error(t('entertain.placeRequired')); return; }
        if (!settleForm.alamat) { toast.error(t('entertain.addressRequired')); return; }
        if (!settleForm.jenis) { toast.error(t('entertain.jenisRequired')); return; }
        if (settleForm.jenis === 'Custom' && !settleForm.custom_jenis?.trim()) { toast.error(t('entertain.customJenisRequired')); return; }
        if (!settleForm.nilai) { toast.error(text.errNilai); return; }
        if (!settleForm.is_draw && !settleForm.settle_amount) { toast.error(t('entertain.settleAmountRequired')); return; }
        if (!settleForm.no_gl) { toast.error(t('entertain.noAFRequired')); return; }
        if (!/^PR\d{6}$/.test(String(settleForm.no_gl).toUpperCase())) { toast.error(t('entertain.noAFFormat')); return; }
        if (!settleForm.gl_number) { toast.error(t('entertain.noGLRequired')); return; }
        if (!settleForm.groups || !settleForm.groups[0]?.relasi?.trim()) { toast.error(t('entertain.relasiRequired')); return; }
        if (!settleForm.jenis_usaha) { toast.error(t('entertain.jenisUsahaRequired')); return; }
        if (settleForm.jenis_usaha === 'Custom' && !settleForm.custom_jenis_usaha?.trim()) { toast.error(t('entertain.customJenisUsahaRequired')); return; }
        if (!settleForm.catatan_kode) { toast.error(text.errMomResult); return; }
        if (settleExistingAttachments.length === 0 && settleAttachments.length === 0) { toast.error(t('entertain.lampiranRequired')); return; }
        setSettleSubmitting(true);
        try {
            const fd = new FormData();
            fd.append('tanggal', settleForm.tanggal);
            fd.append('tempat', settleForm.tempat);
            fd.append('alamat', settleForm.alamat);
            fd.append('jenis', settleForm.jenis);
            fd.append('custom_jenis', settleForm.jenis === 'Custom' ? settleForm.custom_jenis : '');
            fd.append('nilai', settleForm.nilai);
            fd.append('settle_amount', settleForm.is_draw ? settleForm.nilai : settleForm.settle_amount);
            fd.append('no_gl', String(settleForm.no_gl).toUpperCase());
            fd.append('gl_number', settleForm.gl_number);
            fd.append('no_gl_shortage', settleForm.no_gl_shortage || '');
            fd.append('settle_date', settleForm.settle_date);

            const filledGroups = settleForm.groups.filter(g => g.relasi?.trim());
            fd.append('relasi', JSON.stringify(filledGroups.map(g => g.relasi.trim())));
            fd.append('jabatan', JSON.stringify(filledGroups.map(g => (g.jabatan || '').trim())));
            fd.append('nama_perusahaan', JSON.stringify(filledGroups.map(g => (g.nama_perusahaan || '').trim())));
            fd.append('jenis_usaha', settleForm.jenis_usaha === 'Custom' ? (settleForm.custom_jenis_usaha || '').trim() : settleForm.jenis_usaha);
            fd.append('catatan_kode', settleForm.catatan_kode);
            fd.append('existing_attachments', JSON.stringify(settleExistingAttachments));

            settleAttachments.forEach(file => {
                fd.append('attachments', file);
            });

            const result = await entertainmentService.settle(settleItem.id, fd);
            if (result && result.warnings) {
                persistWarnings(result.warnings);
                toast.warning(
                    isEnglish
                        ? `⚠️ ${result.warnings.length} anomali terdeteksi! Cek ${result.warnings.map(w => w.ref_no || `ENT-${String(w.id).padStart(5, '0')}`).join(', ')}`
                        : `⚠️ ${result.warnings.length} anomali terdeteksi! Cek ${result.warnings.map(w => w.ref_no || `ENT-${String(w.id).padStart(5, '0')}`).join(', ')}`
                );
            }
            if (result.changed) {
                toast.success(t('entertain.settledUpdated'));
            } else {
                toast.success(t('entertain.settledSuccess'));
            }
            setShowSettleModal(false);
            setSettleItem(null);
            setSettleAttachments([]);
            setSettleExistingAttachments([]);
            fetchData();
        } catch (e) {
            toast.error(e.message || t('entertain.gagalSettle'));
        } finally {
            setSettleSubmitting(false);
        }
    };

    const fetchRules = useCallback(async () => {
        try {
            const result = await entertainmentService.getRules();
            setRules(Array.isArray(result) ? result : []);
        } catch (e) {
            console.error('Fetch rules error:', e);
        }
        try {
            const res = await fetch(`${API_URL}/users`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setUsersList(Array.isArray(data) ? data : (data?.users || []));
            }
        } catch {}
        try {
            const res = await fetch(`${API_URL}/departments`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setDepartmentsList(Array.isArray(data) ? data : (data?.departments || []));
            }
        } catch {}
        try {
            const res = await fetch(`${API_URL}/system/roles`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setRolesList(Array.isArray(data) ? data : (data?.roles || []));
            }
        } catch {}
    }, []);

    useEffect(() => { if (tab === 'rules') fetchRules(); }, [tab, fetchRules]);

    const handleSaveRule = async () => {
        if (ruleSubmitting) return; // anti double-submit
        if (!ruleForm.rule_name || !ruleForm.target_value) {
            toast.error(t('entertain.ruleRequired'));
            return;
        }
        setRuleSubmitting(true);
        try {
            if (editingRule) {
                await entertainmentService.updateRule(editingRule.id, ruleForm);
                toast.success(t('entertain.ruleSaved'));
            } else {
                await entertainmentService.createRule(ruleForm);
                toast.success(t('entertain.ruleSaved'));
            }
            setShowRuleForm(false);
            setEditingRule(null);
            setRuleForm({ rule_name: '', target_type: 'user', target_value: '', view_all: false, can_create: true, can_edit: true, can_delete: true, can_settle: true, can_export: true, export_all: false });
            fetchRules();
        } catch (e) {
            toast.error(e.message || t('entertain.gagalSave'));
        } finally {
            setRuleSubmitting(false);
        }
    };

    const handleDeleteRule = (id, label) => {
        if (deletingRuleId) return;
        setDeleteTarget({ type: 'rule', id, label });
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        const { type, id } = deleteTarget;
        if (type === 'data') {
            if (deletingId) return; // anti double-submit
            setDeletingId(id);
            try {
                await entertainmentService.delete(id);
                toast.success(t('entertain.dataDeleted'));
                fetchData();
            } catch (e) {
                toast.error(e.message);
            } finally {
                setDeletingId(null);
            }
        } else {
            if (deletingRuleId) return; // anti double-submit
            setDeletingRuleId(id);
            try {
                await entertainmentService.deleteRule(id);
                toast.success(t('entertain.ruleDeleted'));
                fetchRules();
            } catch (e) {
                toast.error(e.message);
            } finally {
                setDeletingRuleId(null);
            }
        }
        setDeleteTarget(null);
    };

    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

    const levelBadge = (level) => {
        if (level === 'kuat') return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">KUAT</span>;
        if (level === 'sedang') return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">SEDANG</span>;
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">RINGAN</span>;
    };

    return (
        <div className="space-y-6">
            {/* Anomaly Warnings Banner */}
            {anomalyWarnings.length > 0 && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl p-4 relative">
                    <button onClick={dismissWarnings} className="absolute top-3 right-3 p-1 rounded-lg hover:bg-amber-200/50 dark:hover:bg-amber-800/50 transition-colors">
                        <X size={16} className="text-amber-600 dark:text-amber-400" />
                    </button>
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-800/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-2">
                                {isEnglish ? 'Potential duplicate data detected:' : 'Data anomali terdeteksi:'}
                            </h4>
                            <div className="space-y-1.5">
                                {anomalyWarnings.map((w, i) => (
                                    <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-amber-700 dark:text-amber-400 bg-white/50 dark:bg-black/20 rounded-lg px-3 py-1.5">
                                        <span className="font-mono font-bold text-amber-900 dark:text-amber-200">{w.ref_no || `ENT-${String(w.id).padStart(5, '0')}`}</span>
                                        <span className="text-amber-600 dark:text-amber-400">
                                            {isEnglish ? 'by' : 'oleh'} <span className="font-semibold">{w.requester_name || w.requester_username}</span>
                                        </span>
                                        <span className="hidden sm:inline text-amber-300 dark:text-amber-600">|</span>
                                        <span className="text-amber-600 dark:text-amber-400">
                                            {w.patterns.map(p => p.pola).join(', ')}
                                        </span>
                                        {levelBadge(w.highest_level)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            <SummaryRow cols={3} cards={[
                { title: text.totalEntries, value: totalEntries, icon: ClipboardList, gradient: 'from-blue-500 to-blue-600', subtext: text.totalEntriesSub },
                { title: text.totalNilai, value: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalNilai), icon: DollarSign, gradient: 'from-emerald-500 to-teal-600', subtext: text.totalNilaiSub },
                { title: text.totalLampiran, value: totalLampiran, icon: FileText, gradient: 'from-amber-500 to-orange-600', subtext: text.totalLampiranSub },
            ]} />

            {/* Unsettled Block Warning (non-admin users) */}
            {!isAdmin && unsettledCount > 0 && tab !== 'rules' && (
                <div className="flex items-start gap-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-300 dark:border-amber-700/50 rounded-2xl p-4">
                    <div className="w-8 h-8 rounded-full bg-amber-200 dark:bg-amber-800/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-amber-700 dark:text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-1">
                            {isEnglish ? 'Entries not yet settled' : 'Terdapat entry yang belum settle'}
                        </h4>
                        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                            {isEnglish
                                ? `Anda masih memiliki ${unsettledCount} entry yang belum settle. Semua entry harus berstatus "Settled" terlebih dahulu sebelum dapat membuat entry baru.`
                                : `Anda masih memiliki ${unsettledCount} entry yang belum settle. Semua entry harus berstatus "Settle" terlebih dahulu sebelum dapat membuat entry / data baru.`}
                        </p>
                    </div>
                </div>
            )}

            {/* Header Actions */}
            {tab !== 'rules' && (
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    {userPerms.can_create && (
                    <button
                        onClick={() => { if (!isAdmin && unsettledCount > 0) { if (showForm) setShowForm(false); toast.warning(t('entertain.unsettledWarning')); return; } resetForm(); setShowForm(!showForm); }}
                        disabled={(!isAdmin && unsettledCount > 0) || submitting}
                        title={(!isAdmin && unsettledCount > 0) ? (isEnglish ? 'Settle all pending entries first' : 'Selesaikan semua entry yang belum settle dulu') : ''}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-600 text-white rounded-xl hover:from-blue-500 hover:to-blue-500 transition-all shadow-lg shadow-blue-500/20 font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                        {showForm ? <X size={18} /> : <Plus size={18} />}
                        {showForm ? (isEnglish ? 'Close Form' : 'Tutup Form') : text.addNew}
                    </button>
                    )}
                    {userPerms.can_export && (
                    <>
                    <button
                        type="button"
                        disabled={exportingPdf}
                        onClick={async () => {
                            if (exportingPdf) return; // anti double-submit
                            setExportingPdf(true);
                            try { await entertainmentService.exportPdf(); toast.success(text.pdfExportSuccess); }
                            catch (e) { toast.error(e.message || text.pdfExportFailed); }
                            finally { setExportingPdf(false); }
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl hover:from-red-700 hover:to-rose-700 transition-all shadow-lg shadow-red-500/20 font-semibold text-sm disabled:opacity-50"
                    >
                        {exportingPdf ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
                        Export All PDF
                    </button>
                    <button
                        type="button"
                        disabled={exportingExcel}
                        onClick={async () => {
                            if (exportingExcel) return; // anti double-submit
                            setExportingExcel(true);
                            try { await entertainmentService.exportExcel(); toast.success(text.excelExportSuccess); }
                            catch (e) { toast.error(e.message || text.excelExportFailed); }
                            finally { setExportingExcel(false); }
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg shadow-green-500/20 font-semibold text-sm disabled:opacity-50"
                    >
                        {exportingExcel ? <Loader2 size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />}
                        Export Excel
                    </button>
                    </>
                    )}
                </div>
            </div>
            )}

            {/* Tab Navigation */}
            <div className="flex gap-1 bg-white/60 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl p-1 border border-white/40 dark:border-white/10">
                <button
                    onClick={() => { setTab('pending'); setPage(1); setSettleFilter('all'); }}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
                        tab === 'pending'
                            ? 'gradient-bg text-white shadow-md'
                            : 'text-stone-500 dark:text-white/40 hover:bg-stone-100 dark:hover:bg-white/[0.06]'
                    }`}
                >
                    {isEnglish ? 'Entertainment List' : 'Daftar Entertainment'}
                </button>
                <button
                    onClick={() => { setTab('settled'); setPage(1); setSettleFilter('all'); }}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
                        tab === 'settled'
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'text-stone-500 dark:text-white/40 hover:bg-stone-100 dark:hover:bg-white/[0.06]'
                    }`}
                >
                    {isEnglish ? 'Settlement' : 'Penyelesaian / Settle'}
                </button>
                {isAdmin && (
                    <button
                        onClick={() => { setTab('rules'); setPage(1); setSettleFilter('all'); }}
                        className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
                            tab === 'rules'
                                ? 'bg-amber-600 text-white shadow-md'
                                : 'text-stone-500 dark:text-white/40 hover:bg-stone-100 dark:hover:bg-white/[0.06]'
                        }`}
                    >
                        Rules
                    </button>
                )}
            </div>

            {/* Settle Status Filter — only on settled tab */}
            {tab === 'settled' && (
                <div className="flex gap-1 bg-white/60 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl p-1 border border-white/40 dark:border-white/10">
                    {[
                        { key: 'all', label: text.filterAll },
                        { key: 'over', label: text.filterOver, color: 'green' },
                        { key: 'draw', label: text.filterDraw, color: 'slate' },
                        { key: 'shortage', label: text.filterShortage, color: 'red' },
                    ].map(f => (
                        <button key={f.key}
                            onClick={() => { setSettleFilter(f.key); setPage(1); }}
                            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                                settleFilter === f.key
                                    ? f.key === 'over' ? 'bg-green-600 text-white shadow-md'
                                      : f.key === 'shortage' ? 'bg-red-600 text-white shadow-md'
                                      : f.key === 'draw' ? 'bg-[#1a1a1a] text-white shadow-md'
                                      : 'gradient-bg text-white shadow-md'
                                    : 'text-stone-500 dark:text-white/40 hover:bg-stone-100 dark:hover:bg-white/[0.06]'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Search / Filter */}
            <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl p-4 border border-white/40 dark:border-white/10">
            <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[130px]">
                    <label className="block text-xs font-semibold text-stone-500 dark:text-white/40 mb-1">{text.filterTanggalFrom}</label>
                    <input type="date" aria-label={text.filterTanggalFrom} value={searchParams.tanggal_from}
                        onChange={e => setSearchParams(p => ({ ...p, tanggal_from: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex-1 min-w-[130px]">
                    <label className="block text-xs font-semibold text-stone-500 dark:text-white/40 mb-1">{text.filterTanggalTo}</label>
                    <input type="date" aria-label={text.filterTanggalTo} value={searchParams.tanggal_to}
                        onChange={e => setSearchParams(p => ({ ...p, tanggal_to: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-xs font-semibold text-stone-500 dark:text-white/40 mb-1">{text.filterJenis}</label>
                        <select aria-label={text.filterJenis} value={searchParams.jenis}
                            onChange={e => setSearchParams(p => ({ ...p, jenis: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm focus:ring-2 focus:ring-blue-500">
                            <option value="">{text.filterAllSettle}</option>
                            {JENIS_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
                        </select>
                    </div>
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-xs font-semibold text-stone-500 dark:text-white/40 mb-1">{isEnglish ? 'Entry Type' : 'Tipe Entry'}</label>
                        <select aria-label={isEnglish ? 'Entry Type' : 'Tipe Entry'} value={searchParams.entry_type}
                            onChange={e => setSearchParams(p => ({ ...p, entry_type: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm focus:ring-2 focus:ring-blue-500">
                            <option value="">{text.filterAllSettle}</option>
                            <option value="reimburse">{t("opt.reimburse")}</option>
                            <option value="plan">{t("opt.plan")}</option>
                        </select>
                    </div>
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-xs font-semibold text-stone-500 dark:text-white/40 mb-1">{text.filterNoAf}</label>
                        <input type="text" placeholder={text.filterNoAf + ' (Enter)'} value={searchParams.no_gl}
                            onChange={e => setSearchParams(p => ({ ...p, no_gl: e.target.value }))}
                            onKeyDown={handleSearchKeyDown}
                            className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm font-mono focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex-[2] min-w-[200px]">
                        <label className="block text-xs font-semibold text-stone-500 dark:text-white/40 mb-1">{text.filterSearch}</label>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                            <input type="text" placeholder={text.searchPlaceholder + ' (Enter)'} value={searchParams.search}
                                onChange={e => setSearchParams(p => ({ ...p, search: e.target.value }))}
                                onKeyDown={handleSearchKeyDown}
                                className="w-full pl-10 pr-4 py-2 rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                    <button onClick={() => { setPage(1); }}
                        className="px-4 py-2 gradient-bg text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-semibold">
                        <Filter size={16} className="inline-block mr-1" />
                        {text.filterBtn}
                    </button>
                    <button onClick={() => { setSearchParams({ tanggal_from: '', tanggal_to: '', jenis: '', search: '', entry_type: '', no_gl: '' }); setPage(1); }}
                        className="px-4 py-2 border border-stone-300 dark:border-white/[0.08] text-stone-600 dark:text-white/70 rounded-xl hover:bg-stone-50 dark:hover:bg-white/[0.06] transition-colors text-sm font-semibold">
                        <X size={16} className="inline-block mr-1" />
                        {text.filterReset}
                    </button>
                </div>
            </div>

            {/* Rules Tab Content */}
            {tab === 'rules' && isAdmin && (
                <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl border border-white/40 dark:border-white/10 overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-b border-stone-200 dark:border-white/[0.06] flex items-center justify-between">
                        <h2 className="font-bold text-stone-700 dark:text-white/80">
                            <ClipboardList size={18} className="inline-block mr-2" />
                            {text.rulesTitle}
                        </h2>
                        <button onClick={() => { setShowRuleForm(!showRuleForm); setEditingRule(null); setRuleForm({ rule_name: '', target_type: 'user', target_value: '', view_all: false, can_create: true, can_edit: true, can_delete: true, can_settle: true, can_export: true, export_all: false }); }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors text-sm font-semibold">
                            <Plus size={16} /> {showRuleForm ? (isEnglish ? 'Close' : 'Tutup') : text.addRule}
                        </button>
                    </div>

                    {/* Rule Form */}
                    <AnimatePresence>
                        {showRuleForm && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                className="border-b border-stone-200 dark:border-white/[0.06] overflow-hidden">
                                <div className="p-6 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-1">Rule Name *</label>
                                            <input type="text" value={ruleForm.rule_name}
                                                onChange={e => setRuleForm(p => ({ ...p, rule_name: e.target.value }))}
                                                placeholder="Contoh: Allow finance view all"
                                                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-1">Target Type *</label>
                                            <select value={ruleForm.target_type}
                                                onChange={e => setRuleForm(p => ({ ...p, target_type: e.target.value, target_value: '' }))}
                                                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm">
                                                <option value="user">{t("opt.user")}</option>
                                                <option value="division">{t("opt.division")}</option>
                                                <option value="role">{t("opt.role")}</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-1">
                                                {ruleForm.target_type === 'user' ? 'Username' : ruleForm.target_type === 'division' ? 'Nama Divisi' : 'Role ID'} *
                                            </label>
                                            {ruleForm.target_type === 'user' ? (
                                                <select value={ruleForm.target_value}
                                                    onChange={e => setRuleForm(p => ({ ...p, target_value: e.target.value }))}
                                                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm">
                                                    <option value="">{text.targetUser}</option>
                                                    {usersList.map(u => (
                                                        <option key={u.username || u.id} value={u.username}>{u.name || u.username}</option>
                                                    ))}
                                                </select>
                                            ) : ruleForm.target_type === 'division' ? (
                                                <select value={ruleForm.target_value}
                                                    onChange={e => setRuleForm(p => ({ ...p, target_value: e.target.value }))}
                                                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm">
                                                    <option value="">{text.targetDivision}</option>
                                                    {departmentsList.map(d => (
                                                        <option key={d.id || d.name} value={d.name}>{d.name || d.label}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <select value={ruleForm.target_value}
                                                    onChange={e => setRuleForm(p => ({ ...p, target_value: e.target.value }))}
                                                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm">
                                                    <option value="">{text.targetRole}</option>
                                                    {rolesList.map(r => (
                                                        <option key={r.id} value={r.id}>{r.label || r.id}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-2">Permissions</label>
                                        <div className="flex flex-wrap gap-3">
                                                    {[
                                                        { key: 'view_all', label: text.permViewAll },
                                                        { key: 'export_all', label: text.permExportAll },
                                                        { key: 'can_create', label: text.permCreate },
                                                        { key: 'can_edit', label: text.permEdit },
                                                        { key: 'can_delete', label: text.permDelete },
                                                        { key: 'can_settle', label: text.permSettle },
                                                        { key: 'can_export', label: text.permExport }
                                                    ].map(p => (
                                                <label key={p.key} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] cursor-pointer hover:bg-stone-50 dark:hover:bg-[#1a1a1a] text-sm">
                                                    <input type="checkbox" checked={!!ruleForm[p.key]}
                                                        onChange={e => setRuleForm(prev => ({ ...prev, [p.key]: e.target.checked }))}
                                                        className="rounded border-stone-300 text-amber-600 focus:ring-amber-500" />
                                                    <span className="text-stone-700 dark:text-white/70">{p.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button onClick={handleSaveRule} disabled={ruleSubmitting}
                                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors text-sm font-semibold disabled:opacity-50">
                                            {ruleSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                            {editingRule ? text.btnUpdateRule : text.btnSaveRule}
                                        </button>
                                        <button onClick={() => { setShowRuleForm(false); setEditingRule(null); }}
                                            className="px-5 py-2.5 border border-stone-300 dark:border-white/[0.08] rounded-xl text-stone-600 dark:text-white/70 hover:bg-stone-50 dark:hover:bg-white/[0.06] text-sm">
                                            {text.btnCancelRule}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Rules Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-stone-50 dark:bg-[#111]/50 text-xs font-semibold text-stone-500 dark:text-white/70 uppercase tracking-wider">
                                    <th className="px-4 py-3 text-left">{text.ruleName}</th>
                                    <th className="px-4 py-3 text-center">{text.targetType}</th>
                                    <th className="px-4 py-3 text-left">{text.targetValue}</th>
                                    <th className="px-4 py-3 text-center">{text.viewAll}</th>
                                    <th className="px-4 py-3 text-center">Export All</th>
                                    <th className="px-4 py-3 text-center">{text.canCreate}</th>
                                    <th className="px-4 py-3 text-center">{text.canEdit}</th>
                                    <th className="px-4 py-3 text-center">{text.canDelete}</th>
                                    <th className="px-4 py-3 text-center">{text.canSettle}</th>
                                    <th className="px-4 py-3 text-center">{text.canExport}</th>
                                    <th className="px-4 py-3 text-center">{text.active}</th>
                                    <th className="px-4 py-3 text-center">{text.aksi}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {rules.length === 0 ? (
                                    <tr><td colSpan={12} className="px-4 py-8 text-center text-stone-400">{text.noRules}</td></tr>
                                ) : rules.map(rule => (
                                    <tr key={rule.id} className="hover:bg-stone-50 dark:hover:bg-white/[0.06]/30">
                                        <td className="px-4 py-3 font-semibold">{rule.rule_name}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                                                rule.target_type === 'user' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                                rule.target_type === 'division' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                                'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                                            }`}>{rule.target_type}</span>
                                        </td>
                                        <td className="px-4 py-3">{rule.target_value}</td>
                                        <td className="px-4 py-3 text-center">{rule.view_all ? <CheckCircle2 size={16} className="inline text-green-500" /> : <X size={16} className="inline text-stone-300" />}</td>
                                        <td className="px-4 py-3 text-center">{rule.export_all ? <CheckCircle2 size={16} className="inline text-green-500" /> : <X size={16} className="inline text-stone-300" />}</td>
                                        <td className="px-4 py-3 text-center">{rule.can_create ? <CheckCircle2 size={16} className="inline text-green-500" /> : <X size={16} className="inline text-red-400" />}</td>
                                        <td className="px-4 py-3 text-center">{rule.can_edit ? <CheckCircle2 size={16} className="inline text-green-500" /> : <X size={16} className="inline text-red-400" />}</td>
                                        <td className="px-4 py-3 text-center">{rule.can_delete ? <CheckCircle2 size={16} className="inline text-green-500" /> : <X size={16} className="inline text-red-400" />}</td>
                                        <td className="px-4 py-3 text-center">{rule.can_settle ? <CheckCircle2 size={16} className="inline text-green-500" /> : <X size={16} className="inline text-red-400" />}</td>
                                        <td className="px-4 py-3 text-center">{rule.can_export ? <CheckCircle2 size={16} className="inline text-green-500" /> : <X size={16} className="inline text-red-400" />}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${rule.is_active ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'}`}>
                                                {rule.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => { setEditingRule(rule); setRuleForm({ rule_name: rule.rule_name, target_type: rule.target_type, target_value: rule.target_value, view_all: rule.view_all, can_create: rule.can_create, can_edit: rule.can_edit, can_delete: rule.can_delete, can_settle: rule.can_settle, can_export: rule.can_export, export_all: rule.export_all }); setShowRuleForm(true); }}
                                                    className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg" title="Edit">
                                                    <Edit3 size={16} />
                                                </button>
                                                <button onClick={() => handleDeleteRule(rule.id, rule.rule_name)}
                                                    disabled={deletingRuleId === rule.id}
                                                    className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed" title="Hapus">
                                                    {deletingRuleId === rule.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Form — slide-in-from-right drawer (modern) */}
            {createPortal(
            <AnimatePresence>
                {showForm && (
                    <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[70] bg-[#0a0a0a]/50 backdrop-blur-sm"
                        onClick={() => { resetForm(); setShowForm(false); }} />
                    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                        className="fixed top-0 right-0 z-[71] h-full w-full max-w-[600px] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl shadow-2xl flex flex-col">
                        <div className="bg-gradient-to-r from-blue-600 to-blue-600 px-6 py-4 flex items-center justify-between shrink-0">
                            <h3 className="text-white font-bold text-lg">{editingId ? text.formEdit : text.formNew} Entertainment Expenses</h3>
                            <button type="button" onClick={() => { resetForm(); setShowForm(false); }}
                                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            {/* Entry Type (Plan / Reimburse) */}
                            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-stone-100 dark:bg-[#111]/40">
                                <button type="button" onClick={() => setEntryType('plan')}
                                    className={`py-2.5 rounded-xl text-sm font-bold transition-all ${entryType === 'plan' ? 'bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl text-blue-600 shadow' : 'text-stone-500 dark:text-white/40 hover:text-stone-700'}`}>
                                    Plan
                                </button>
                                <button type="button" onClick={() => setEntryType('reimburse')}
                                    className={`py-2.5 rounded-xl text-sm font-bold transition-all ${entryType === 'reimburse' ? 'bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl text-emerald-600 shadow' : 'text-stone-500 dark:text-white/40 hover:text-stone-700'}`}>
                                    Reimburse
                                </button>
                            </div>
                            {entryType === 'reimburse' && (
                                <div className="flex items-start gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-4 py-3">
                                    <Info size={16} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                                        {isEnglish ? 'Reimburse entries go directly to settle — no approval needed. All fields are required.' : 'Entry tipe Reimburse langsung ke settle tanpa perlu pengajuan. Semua field wajib diisi.'}
                                    </p>
                                </div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Tanggal */}
                                <div>
                                    <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-1">{text.lblTanggal}</label>
                                    <input type="date" value={form.tanggal}
                                        onChange={e => setForm(p => ({ ...p, tanggal: e.target.value }))}
                                        className={`w-full px-3 py-2.5 rounded-xl border ${errors.tanggal ? 'border-red-500' : 'border-stone-200 dark:border-white/[0.08]'} bg-white dark:bg-[#111] text-sm focus:ring-2 focus:ring-blue-500`} />
                                    {errors.tanggal && <p className="text-red-500 text-xs mt-1">{errors.tanggal}</p>}
                                </div>
                                {/* Jenis */}
                                <div>
                                    <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-1">{text.lblJenis}</label>
                                    <select value={form.jenis}
                                        onChange={e => setForm(p => ({ ...p, jenis: e.target.value }))}
                                        className={`w-full px-3 py-2.5 rounded-xl border ${errors.jenis ? 'border-red-500' : 'border-stone-200 dark:border-white/[0.08]'} bg-white dark:bg-[#111] text-sm focus:ring-2 focus:ring-blue-500`}>
                                        <option value="">{text.pilihJenis}</option>
                                        {JENIS_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
                                    </select>
                                    {errors.jenis && <p className="text-red-500 text-xs mt-1">{errors.jenis}</p>}
                                    {form.jenis === 'Custom' && (
                                        <input type="text" placeholder={text.customJenisPlaceholder} value={form.custom_jenis}
                                            onChange={e => setForm(p => ({ ...p, custom_jenis: e.target.value }))}
                                            className={`mt-2 w-full px-3 py-2 rounded-xl border ${errors.custom_jenis ? 'border-red-500' : 'border-stone-200 dark:border-white/[0.08]'} bg-white dark:bg-[#111] text-sm`} />
                                    )}
                                    {errors.custom_jenis && <p className="text-red-500 text-xs mt-1">{errors.custom_jenis}</p>}
                                </div>
                            </div>
                            {/* Venue & Address Venue (1 card) */}
                            <div className="border-2 border-white/60 dark:border-white/10 rounded-xl p-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Venue */}
                                    <div>
                                        <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-1">{text.lblTempat} *</label>
                                        <input type="text" value={form.tempat}
                                            onChange={e => setForm(p => ({ ...p, tempat: e.target.value }))}
                                            className={`w-full px-3 py-2.5 rounded-xl border ${errors.tempat ? 'border-red-500' : 'border-stone-200 dark:border-white/[0.08]'} bg-white dark:bg-[#111] text-sm focus:ring-2 focus:ring-blue-500`} />
                                        {errors.tempat && <p className="text-red-500 text-xs mt-1">{errors.tempat}</p>}
                                    </div>
                                    {/* Address Venue */}
                                    <div>
                                        <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-1">{text.lblAlamat}</label>
                                        <textarea value={form.alamat}
                                            onChange={e => setForm(p => ({ ...p, alamat: e.target.value }))}
                                            rows={2}
                                            className={`w-full px-3 py-2.5 rounded-xl border ${errors.alamat ? 'border-red-500' : 'border-stone-200 dark:border-white/[0.08]'} bg-white dark:bg-[#111] text-sm focus:ring-2 focus:ring-blue-500`} />
                                        {errors.alamat && <p className="text-red-500 text-xs mt-1">{errors.alamat}</p>}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Nilai */}
                                <div>
                                    <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-1">{text.lblNilai}</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">Rp</span>
                                        <input type="text" value={form.nilai ? formatCurrency(form.nilai) : ''}
                                            onChange={handleNilaiChange}
                                            className={`w-full pl-10 pr-3 py-2.5 rounded-xl border ${errors.nilai ? 'border-red-500' : 'border-stone-200 dark:border-white/[0.08]'} bg-white dark:bg-[#111] text-sm focus:ring-2 focus:ring-blue-500`} />
                                    </div>
                                    {errors.nilai && <p className="text-red-500 text-xs mt-1">{errors.nilai}</p>}
                                </div>
                                {/* No AF */}
                                <div>
                                    <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-1">{text.lblNoGl}</label>
                                    <input type="text" value={form.no_gl}
                                        onChange={e => setForm(p => ({ ...p, no_gl: formatAf(e.target.value) }))}
                                        placeholder="PR000001"
                                        className={`w-full px-3 py-2.5 rounded-xl border ${errors.no_gl ? 'border-red-500' : 'border-stone-200 dark:border-white/[0.08]'} bg-white dark:bg-[#111] text-sm focus:ring-2 focus:ring-blue-500`} />
                                    {errors.no_gl && <p className="text-red-500 text-xs mt-1">{errors.no_gl}</p>}
                                </div>
                                {/* No GL */}
                                <div>
                                    <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-1">{text.lblGl}</label>
                                    <input type="text" value={form.gl_number}
                                        onChange={e => setForm(p => ({ ...p, gl_number: e.target.value }))}
                                        placeholder={isEnglish ? 'Enter GL number' : 'Isi No GL'}
                                        className={`w-full px-3 py-2.5 rounded-xl border ${errors.gl_number ? 'border-red-500' : 'border-stone-200 dark:border-white/[0.08]'} bg-white dark:bg-[#111] text-sm focus:ring-2 focus:ring-blue-500`} />
                                    {errors.gl_number && <p className="text-red-500 text-xs mt-1">{errors.gl_number}</p>}
                                </div>
                                {/* Jenis Usaha */}
                                <div>
                                    <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-1">{text.lblJenisUsaha}</label>
                                    <select value={form.jenis_usaha}
                                        onChange={e => setForm(p => ({ ...p, jenis_usaha: e.target.value, custom_jenis_usaha: '' }))}
                                        className={`w-full px-3 py-2.5 rounded-xl border ${errors.jenis_usaha ? 'border-red-500' : 'border-stone-200 dark:border-white/[0.08]'} bg-white dark:bg-[#111] text-sm focus:ring-2 focus:ring-blue-500`}>
                                        <option value="">{t('entertain.selectBusinessType')}</option>
                                        {JENIS_USAHA_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
                                    </select>
                                    {errors.jenis_usaha && <p className="text-red-500 text-xs mt-1">{errors.jenis_usaha}</p>}
                                    {form.jenis_usaha === 'Custom' && (
                                        <input type="text" placeholder={text.customJenisUsahaPlaceholder} value={form.custom_jenis_usaha}
                                            onChange={e => setForm(p => ({ ...p, custom_jenis_usaha: e.target.value }))}
                                            className={`mt-2 w-full px-3 py-2 rounded-xl border ${errors.custom_jenis_usaha ? 'border-red-500' : 'border-stone-200 dark:border-white/[0.08]'} bg-white dark:bg-[#111] text-sm`} />
                                    )}
                                    {errors.custom_jenis_usaha && <p className="text-red-500 text-xs mt-1">{errors.custom_jenis_usaha}</p>}
                                </div>
                            </div>
                            {/* Relasi + Jabatan + Perusahaan Group */}
                            <div>
                                <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-2">{text.lblGroupRelasi}</label>
                                {form.groups.map((grp, idx) => (
                                    <div key={idx} className="bg-stone-50 dark:bg-[#111]/30 rounded-xl p-3 mb-3 border border-stone-200 dark:border-white/[0.08]">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                            <div>
                                                <label className="block text-[10px] font-semibold text-stone-500 uppercase mb-1">{text.lblGroupNamaRelasi}</label>
                                                <input type="text" value={grp.relasi}
                                                    onChange={e => updateGroup(idx, 'relasi', e.target.value)}
                                                    placeholder={text.lblGroupRelasiPlaceholder.replace('{n}', idx + 1)}
                                                    className={`w-full px-3 py-2 rounded-lg border ${errors.groups ? 'border-red-500' : 'border-stone-200 dark:border-white/[0.08]'} bg-white dark:bg-[#111] text-sm`} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-semibold text-stone-500 uppercase mb-1">{text.lblGroupJabatan}</label>
                                                <input type="text" value={grp.jabatan}
                                                    onChange={e => updateGroup(idx, 'jabatan', e.target.value)}
                                                    placeholder={text.lblGroupJabatanPlaceholder.replace('{n}', idx + 1)}
                                                    className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-semibold text-stone-500 uppercase mb-1">{text.lblGroupPerusahaan}</label>
                                                <input type="text" value={grp.nama_perusahaan}
                                                    onChange={e => updateGroup(idx, 'nama_perusahaan', e.target.value)}
                                                    placeholder={text.lblGroupPerusahaanPlaceholder.replace('{n}', idx + 1)}
                                                    className={`w-full px-3 py-2 rounded-lg border ${errors.groups ? 'border-red-500' : 'border-stone-200 dark:border-white/[0.08]'} bg-white dark:bg-[#111] text-sm`} />
                                            </div>
                                        </div>
                                        {form.groups.length > 1 && (
                                            <button type="button" onClick={() => removeGroup(idx)}
                                                className="mt-2 p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-xs flex items-center gap-1">
                                                <X size={14} /> {text.btnHapusGroup}
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <div className="flex flex-wrap items-center justify-between gap-3 mt-1">
                                    <button type="button" onClick={addGroup}
                                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-semibold">
                                        <Plus size={14} /> {text.btnTambahGroupRelasi}
                                    </button>
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700">
                                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-300 uppercase tracking-wide">{text.lblJumlahRelasi}</span>
                                        <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-lg gradient-bg text-white text-sm font-bold">
                                            {jumlahRelasi}
                                        </span>
                                        <span className="text-xs text-stone-500 dark:text-white/40">
                                            {text.fromJumlahGroup.replace('{n}', form.groups.length)}
                                        </span>
                                    </div>
                                </div>
                                {errors.groups && <p className="text-red-500 text-xs mt-1">{errors.groups}</p>}
                            </div>

                            {/* Plan */}
                            <div>
                                <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-1">{text.lblPlan}</label>
                                <textarea value={form.catatan_kode}
                                    onChange={e => setForm(p => ({ ...p, catatan_kode: e.target.value }))}
                                    rows={2}
                                    className={`w-full px-3 py-2.5 rounded-xl border ${errors.catatan_kode ? 'border-red-500' : 'border-stone-200 dark:border-white/[0.08]'} bg-white dark:bg-[#111] text-sm focus:ring-2 focus:ring-blue-500`} />
                                {errors.catatan_kode && <p className="text-red-500 text-xs mt-1">{errors.catatan_kode}</p>}
                            </div>

                            {/* Attachments */}
                            <div>
                                    <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-1">
                                    {text.lblLampiran} {errors.attachments && <span className="text-red-500">- {errors.attachments}</span>}
                                </label>
                                <div
                                    ref={pasteZoneRef}
                                    tabIndex={0}
                                    onPaste={handlePaste}
                                    onFocus={e => e.currentTarget?.classList?.add('ring-2', 'ring-emerald-500')}
                                    onBlur={e => e.currentTarget?.classList?.remove('ring-2', 'ring-emerald-500')}
                                    className="border-2 border-dashed border-stone-300 dark:border-white/[0.08] rounded-xl p-6 text-center hover:border-emerald-500 transition-colors cursor-pointer outline-none"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload size={32} className="mx-auto text-stone-400 mb-2" />
                                    <p className="text-sm text-stone-500 dark:text-white/40" dangerouslySetInnerHTML={{ __html: text.uploadPaste }} />
                                    <p className="text-xs text-stone-400 mt-1">{text.uploadSupport}</p>
                                    <input ref={fileInputRef} type="file" multiple
                                        onChange={handleFileChange}
                                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.txt,.csv"
                                        className="hidden" />
                                </div>

                                {/* Preview existing attachments */}
                                {existingAttachments.length > 0 && (
                                    <div className="mt-3">
                                        <p className="text-xs font-semibold text-stone-500 mb-2">{text.savedAttachments} ({existingAttachments.length}):</p>
                                        <div className="flex flex-wrap gap-2">
                                            {existingAttachments.map((att, idx) => (
                                                <div key={idx} className="relative group bg-stone-100 dark:bg-[#111] rounded-lg p-2 flex items-center gap-2">
                                                    {att.mimetype?.startsWith('image/') ? (
                                                        <img src={att.url} alt={att.name} className="w-10 h-10 object-cover rounded" />
                                                    ) : (
                                                        <div className="w-10 h-10 flex items-center justify-center bg-stone-200 dark:bg-[#1a1a1a] rounded">
                                                            <FileText size={20} className="text-stone-500" />
                                                        </div>
                                                    )}
                                                    <span className="text-xs truncate max-w-[120px]">{att.name}</span>
                                                    <button type="button" onClick={(e) => removeExistingAttachment(idx, e)}
                                                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <X size={10} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Preview new attachments */}
                                {attachments.length > 0 && (
                                    <div className="mt-3">
                                        <p className="text-xs font-semibold text-stone-500 mb-2">{text.newAttachments} ({attachments.length}):</p>
                                        <div className="flex flex-wrap gap-2">
                                            {attachments.map((file, idx) => (
                                                <div key={idx} className="relative group bg-stone-100 dark:bg-[#111] rounded-lg p-2 flex items-center gap-2">
                                                    {file.type?.startsWith('image/') ? (
                                                        <img src={URL.createObjectURL(file)} alt={file.name} className="w-10 h-10 object-cover rounded" />
                                                    ) : (
                                                        <div className="w-10 h-10 flex items-center justify-center bg-stone-200 dark:bg-[#1a1a1a] rounded">
                                                            <FileText size={20} className="text-stone-500" />
                                                        </div>
                                                    )}
                                                    <span className="text-xs truncate max-w-[120px]">{file.name}</span>
                                                    <button type="button" onClick={(e) => removeAttachment(idx, e)}
                                                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <X size={10} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Submit */}
                            <div className="flex flex-wrap items-center gap-3 pt-2">
                                {entryType === 'reimburse' ? (
                                    <>
                                        {/* Simpan ke Draft */}
                                        <button type="submit" onClick={(e) => { e.preventDefault(); handleSubmit(e, 'draft'); }} disabled={submitting}
                                            className="inline-flex items-center gap-2 px-6 py-3 bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all font-semibold disabled:opacity-50">
                                            {submitting ? (
                                                <Loader2 size={18} className="animate-spin" />
                                            ) : (
                                                <Save size={18} />
                                            )}
                                            {submitting ? (isEnglish ? 'Saving...' : 'Menyimpan...') : (isEnglish ? 'Save to Draft' : 'Simpan ke Draft')}
                                        </button>
                                        {/* Settle langsung — validasi dulu, baru buka konfirmasi ringkasan */}
                                        <button type="button" onClick={() => { if (!validate()) { toast.error(isEnglish ? 'Please fill all required fields' : 'Harap isi semua field yang wajib'); return; } setSettleConfirmOpen(true); }} disabled={submitting}
                                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg font-semibold disabled:opacity-50">
                                            {submitting ? (
                                                <Loader2 size={18} className="animate-spin" />
                                            ) : (
                                                <CheckCircle2 size={18} />
                                            )}
                                            {submitting ? (isEnglish ? 'Settling...' : 'Settle...') : (isEnglish ? 'Settle' : 'Settle')}
                                        </button>
                                    </>
                                ) : (
                                    <button type="submit" disabled={submitting}
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-600 text-white rounded-xl hover:from-blue-500 hover:to-blue-500 transition-all shadow-lg font-semibold disabled:opacity-50">
                                        {submitting ? (
                                            <Loader2 size={18} className="animate-spin" />
                                        ) : (
                                            <Save size={18} />
                                        )}
                                        {submitting ? (isEnglish ? 'Saving...' : 'Menyimpan...') : (editingId ? text.btnUpdate : text.btnSave)}
                                    </button>
                                )}
                                <button type="button" onClick={() => { resetForm(); setShowForm(false); }}
                                    className="px-6 py-3 border border-stone-300 dark:border-white/[0.08] rounded-xl text-stone-600 dark:text-white/70 hover:bg-stone-50 dark:hover:bg-white/[0.06] transition-colors">
                                    {text.btnCancel}
                                </button>
                            </div>
                        </form>
                        </div>
                    </motion.div>
                    </>
                )}
            </AnimatePresence>
            , document.body)}
            {/* Table */}
            <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl border border-white/40 dark:border-white/10 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-[#0d0d0d] dark:to-[#111] border-b border-stone-200 dark:border-white/[0.06]">
                    <h2 className="font-bold text-stone-700 dark:text-white/80">
                        <ClipboardList size={18} className="inline-block mr-2" />
                        {isEnglish ? 'Entertainment Expenses List' : 'Daftar Entertainment Expenses'}
                        <span className="ml-2 text-sm font-normal text-stone-400">({totalEntries} {isEnglish ? 'entries' : 'data'})</span>
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-stone-50 dark:bg-[#111]/50 text-xs font-semibold text-stone-500 dark:text-white/70 uppercase tracking-wider">
                                <th className="px-4 py-3 text-center w-32">{text.thAksi}</th>
                                <th className="px-4 py-3 text-left">{text.thTanggal}</th>
                                <th className="px-4 py-3 text-left">{text.thNoAf}</th>
                                <th className="px-4 py-3 text-left">{text.thNoRef}</th>
                                <th className="px-4 py-3 text-left">{text.thNamaRelasi}</th>
                                <th className="px-4 py-3 text-left">{text.thJabatan}</th>
                                <th className="px-4 py-3 text-right">{text.thNilai}</th>
                                <th className="px-4 py-3 text-left">{text.thJenis}</th>
                                <th className="px-4 py-3 text-left">{text.thPengaju}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {loading ? (
                                <tr><td colSpan={9} className="px-4 py-8 text-center text-stone-400">{text.loading}</td></tr>
                            ) : data.length === 0 ? (
                                <tr><td colSpan={9} className="px-4 py-8 text-center text-stone-400">{text.empty}</td></tr>
                            ) : data.map(item => (
                                <tr key={item.id} className="hover:bg-stone-50 dark:hover:bg-white/[0.06]/30 transition-colors">
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            onClick={(e) => {
                                                const r = e.currentTarget.getBoundingClientRect();
                                                setActionMenu(prev => prev && prev.item?.id === item.id ? null : openRowMenu(item, r));
                                            }}
                                            className={`p-1.5 rounded-lg transition-colors ${actionMenu?.item?.id === item.id ? 'bg-blue-50 text-blue-600 dark:bg-[#0d0d0d]' : 'text-stone-400 hover:bg-stone-100 dark:hover:bg-white/[0.05] hover:text-stone-600 dark:hover:text-white/80'}`}
                                            title={text.aksi}
                                        >
                                            <MoreVertical size={16} />
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">{formatDateId(item.tanggal)}</td>
                                    <td className="px-4 py-3 font-mono text-xs">{item.no_gl || '-'}</td>
                                    <td className="px-4 py-3 font-mono text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <span>{item.no_ref || `ENT-${String(item.id).padStart(5, '0')}`}</span>
                                            {item.entry_type === 'reimburse' ? (
                                                <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                                                    Reimburse
                                                </span>
                                            ) : (
                                                <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                                                    Plan
                                                </span>
                                            )}
                                            {item.status === 'draft' && (
                                                <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                                                    Draft
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 max-w-[150px] truncate" title={(item.relasi || []).join(', ')}>
                                        {(item.relasi || []).join(', ') || '-'}
                                    </td>
                                    <td className="px-4 py-3 max-w-[120px] truncate" title={(item.nama_perusahaan || []).join(', ')}>
                                        {(item.nama_perusahaan || []).join(', ') || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono whitespace-nowrap">
                                        {item.status === 'settled' && item.settle_amount ? (
                                            <div className="flex flex-col items-end">
                                                <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(item.settle_amount)}</span>
                                                {parseFloat(item.settle_amount) !== parseFloat(item.nilai) && (
                                                    <span className={`text-[10px] font-bold ${parseFloat(item.settle_amount) > parseFloat(item.nilai) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                        {parseFloat(item.settle_amount) > parseFloat(item.nilai) ? 'Over' : 'Short'} {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(Math.abs(parseFloat(item.settle_amount) - parseFloat(item.nilai)))}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(item.nilai)
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-semibold">
                                            {item.jenis === 'Custom' ? item.custom_jenis : item.jenis}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs">{item.requester_name || item.requester_username}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-3 bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl border border-white/40 dark:border-white/10">
                    <div className="text-sm text-stone-500 dark:text-white/40">
                        {text.pagination.replace('{page}', page).replace('{totalPages}', totalPages).replace('{totalEntries}', totalEntries)}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1 || loading}
                            className="px-3 py-1.5 text-sm font-semibold rounded-lg border border-stone-200 dark:border-white/[0.08] text-stone-600 dark:text-white/70 hover:bg-stone-50 dark:hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Previous
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                            .map((p, idx, arr) => (
                                <React.Fragment key={p}>
                                    {idx > 0 && arr[idx - 1] !== p - 1 && (
                                        <span className="px-1 text-stone-400">...</span>
                                    )}
                                    <button
                                        onClick={() => setPage(p)}
                                        disabled={loading}
                                        className={`min-w-[36px] h-9 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                            p === page
                                                ? 'gradient-bg text-white shadow-md'
                                                : 'border border-stone-200 dark:border-white/[0.08] text-stone-600 dark:text-white/70 hover:bg-stone-50 dark:hover:bg-white/[0.06]'
                                        }`}
                                    >
                                        {p}
                                    </button>
                                </React.Fragment>
                            ))}
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages || loading}
                            className="px-3 py-1.5 text-sm font-semibold rounded-lg border border-stone-200 dark:border-white/[0.08] text-stone-600 dark:text-white/70 hover:bg-stone-50 dark:hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
            {/* Settle Modal — slide-in-from-right drawer (modern) */}
            {createPortal(
            <AnimatePresence>
                {showSettleModal && settleItem && (
                    <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[74] bg-[#0a0a0a]/50 backdrop-blur-sm"
                        onClick={() => { setShowSettleModal(false); setSettleAttachments([]); setSettleExistingAttachments([]); }} />
                    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                        className="fixed top-0 right-0 z-[75] h-full w-full max-w-[600px] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl shadow-2xl flex flex-col"
                        onClick={e => e.stopPropagation()}>
                        {/* Header - fixed at top */}
                        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between shrink-0">
                            <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                <CheckCircle2 size={20} /> {text.settleTitle}
                            </h3>
                            <button onClick={() => { setShowSettleModal(false); setSettleAttachments([]); setSettleExistingAttachments([]); }}
                                className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        {/* Body - scrollable */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-1">{text.detailTanggal}</label>
                                        <input type="date" value={settleForm.tanggal || ''}
                                            onChange={e => setSettleForm(p => ({ ...p, tanggal: e.target.value }))}
                                            className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm focus:ring-2 focus:ring-emerald-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-1">{text.detailTempat}</label>
                                        <input type="text" value={settleForm.tempat || ''}
                                            onChange={e => setSettleForm(p => ({ ...p, tempat: e.target.value }))}
                                            className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm focus:ring-2 focus:ring-emerald-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-1">{text.detailJenis}</label>
                                        <select value={settleForm.jenis || ''}
                                            onChange={e => setSettleForm(p => ({ ...p, jenis: e.target.value }))}
                                            className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm focus:ring-2 focus:ring-emerald-500">
                                            <option value="">{text.selectOption}</option>
                                            {JENIS_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
                                        </select>
                                        {settleForm.jenis === 'Custom' && (
                                            <input type="text" placeholder={isEnglish ? 'Custom type' : 'Custom jenis'} value={settleForm.custom_jenis || ''}
                                                onChange={e => setSettleForm(p => ({ ...p, custom_jenis: e.target.value }))}
                                                className="mt-2 w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm" />
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-1">{text.detailAlamat}</label>
                                    <textarea value={settleForm.alamat || ''}
                                        onChange={e => setSettleForm(p => ({ ...p, alamat: e.target.value }))}
                                        rows={2}
                                        className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm focus:ring-2 focus:ring-emerald-500" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-1">{text.lblNilai}</label>
                                        <input type="text" value={settleForm.nilai ? formatCurrency(settleForm.nilai) : ''}
                                            onChange={e => setSettleForm(p => ({ ...p, nilai: parseCurrency(e.target.value) }))}
                                            className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm focus:ring-2 focus:ring-emerald-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-1">{text.lblNoGl}</label>
                                        <input type="text" value={settleForm.no_gl || ''}
                                            onChange={e => setSettleForm(p => ({ ...p, no_gl: formatAf(e.target.value) }))}
                                            placeholder="PR000001"
                                            className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm focus:ring-2 focus:ring-emerald-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-1">{text.lblGl}</label>
                                        <input type="text" value={settleForm.gl_number || ''}
                                            onChange={e => setSettleForm(p => ({ ...p, gl_number: e.target.value }))}
                                            placeholder={isEnglish ? 'Enter GL number' : 'Isi No GL'}
                                            className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm focus:ring-2 focus:ring-emerald-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-1">{text.lblJenisUsaha}</label>
                                        <select value={settleForm.jenis_usaha || ''}
                                            onChange={e => setSettleForm(p => ({ ...p, jenis_usaha: e.target.value, custom_jenis_usaha: '' }))}
                                            className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm focus:ring-2 focus:ring-emerald-500">
                                            <option value="">{text.selectOption}</option>
                                            {JENIS_USAHA_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
                                        </select>
                                        {settleForm.jenis_usaha === 'Custom' && (
                                            <input type="text" placeholder={text.customJenisUsahaPlaceholder} value={settleForm.custom_jenis_usaha || ''}
                                                onChange={e => setSettleForm(p => ({ ...p, custom_jenis_usaha: e.target.value }))}
                                                className="mt-2 w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm" />
                                        )}
                                    </div>
                                </div>
                                {/* Settle Amount */}
                                <div className="gradient-bg-soft rounded-xl p-4 border border-stone-200 dark:border-white/[0.06]">
                                    <div className="flex items-center gap-4 mb-3">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={settleForm.is_draw || false}
                                                onChange={e => setSettleForm(p => ({
                                                    ...p,
                                                    is_draw: e.target.checked,
                                                    settle_amount: e.target.checked ? p.nilai : ''
                                                }))}
                                                className="w-4 h-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500" />
                                            <span className="text-sm font-semibold text-stone-700 dark:text-white/70">{text.lblDraw}</span>
                                        </label>
                                    </div>
                                    {!settleForm.is_draw && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-1">{text.lblSettleAmount} *</label>
                                                <input type="text" value={settleForm.settle_amount ? formatCurrency(settleForm.settle_amount) : ''}
                                                    onChange={e => setSettleForm(p => ({ ...p, settle_amount: parseCurrency(e.target.value) }))}
                                                    placeholder={isEnglish ? 'Enter settle amount' : 'Masukkan jumlah settle'}
                                                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm focus:ring-2 focus:ring-emerald-500" />
                                            </div>
                                            <div className="flex flex-col gap-2 justify-end">
                                                {settleForm.settle_amount && (
                                                    (() => {
                                                        const pengajuan = parseFloat(settleForm.nilai) || 0;
                                                        const settle = parseFloat(settleForm.settle_amount) || 0;
                                                        const diff = settle - pengajuan;
                                                        const isShortage = diff < 0;
                                                        return (
                                                            <>
                                                                {isShortage && (
                                                                    <div>
                                                                        <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-1">{text.lblAfShortage}</label>
                                                                        <input type="text" value={settleForm.no_gl_shortage || ''}
                                                                            onChange={e => setSettleForm(p => ({ ...p, no_gl_shortage: e.target.value }))}
                                                                            placeholder={isEnglish ? 'Enter AF for shortage' : 'Masukkan AF untuk shortage'}
                                                                            className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm focus:ring-2 focus:ring-emerald-500" />
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center">
                                                                    {diff === 0 ? <span className="px-4 py-2 rounded-xl text-sm font-bold bg-stone-100 text-stone-600 dark:bg-[#111] dark:text-white/70">{text.lblSame}</span>
                                                                        : diff > 0 ? <span className="px-4 py-2 rounded-xl text-sm font-bold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">{text.lblOver} +{diff.toLocaleString('id-ID')}</span>
                                                                        : <span className="px-4 py-2 rounded-xl text-sm font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">{text.lblShortage} {diff.toLocaleString('id-ID')}</span>}
                                                                </div>
                                                            </>
                                                        );
                                                    })()
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-2">{text.lblRelasiPerusahaan}</label>
                                    {settleForm.groups && settleForm.groups.map((grp, idx) => (
                                        <div key={idx} className="bg-stone-50 dark:bg-[#111]/30 rounded-xl p-3 mb-3 border border-stone-200 dark:border-white/[0.08]">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                                <input type="text" value={grp.relasi || ''}
                                                    onChange={e => {
                                                        const g = [...settleForm.groups];
                                                        g[idx] = { ...g[idx], relasi: e.target.value };
                                                        setSettleForm(p => ({ ...p, groups: g }));
                                                    }}
                                                    placeholder={text.placeholdRelasi}
                                                    className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm" />
                                                <input type="text" value={grp.jabatan || ''}
                                                    onChange={e => {
                                                        const g = [...settleForm.groups];
                                                        g[idx] = { ...g[idx], jabatan: e.target.value };
                                                        setSettleForm(p => ({ ...p, groups: g }));
                                                    }}
                                                    placeholder={text.placeholdJabatan}
                                                    className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm" />
                                                <div className="flex gap-1">
                                                    <input type="text" value={grp.nama_perusahaan || ''}
                                                        onChange={e => {
                                                            const g = [...settleForm.groups];
                                                            g[idx] = { ...g[idx], nama_perusahaan: e.target.value };
                                                            setSettleForm(p => ({ ...p, groups: g }));
                                                        }}
                                                        placeholder={text.placeholdPerusahaan}
                                                        className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm" />
                                                    {settleForm.groups.length > 1 && (
                                                        <button type="button" onClick={() => {
                                                            const g = settleForm.groups.filter((_, i) => i !== idx);
                                                            setSettleForm(p => ({ ...p, groups: g }));
                                                         }} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg shrink-0" title={text.removeRelation}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <button type="button" onClick={() => {
                                        const g = [...(settleForm.groups || []), { relasi: '', jabatan: '', nama_perusahaan: '' }];
                                        setSettleForm(p => ({ ...p, groups: g }));
                                    }} className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 font-semibold mt-1">
                                        <Plus size={14} /> {text.btnTambahRelasi}
                                    </button>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-1">{text.lblMomResult}</label>
                                    <textarea value={settleForm.catatan_kode || ''}
                                        onChange={e => setSettleForm(p => ({ ...p, catatan_kode: e.target.value }))}
                                        rows={2}
                                        className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm focus:ring-2 focus:ring-emerald-500" />
                                </div>
                                {/* Tanggal Settle (required) */}
                                <div>
                                    <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-1">
                                        {text.lblSettleDate}
                                    </label>
                                    <input type="date" value={settleForm.settle_date || ''}
                                        onChange={e => setSettleForm(p => ({ ...p, settle_date: e.target.value }))}
                                        className="w-full px-3 py-2.5 rounded-xl border border-emerald-400 dark:border-emerald-600 bg-white dark:bg-[#111] text-sm focus:ring-2 focus:ring-emerald-500" />
                                </div>
                                {/* Lampiran */}
                                <div>
                                    <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-1">{text.lblLampiran}</label>
                                    <div className="border-2 border-dashed border-stone-300 dark:border-white/[0.08] rounded-xl p-6 text-center hover:border-emerald-500 transition-colors cursor-pointer"
                                        onClick={() => settleFileInputRef.current?.click()}>
                                        <Upload size={24} className="mx-auto text-stone-400 mb-2" />
                                        <p className="text-sm text-stone-500 dark:text-white/40">{text.uploadAttachments}</p>
                                        <input ref={settleFileInputRef} type="file" multiple
                                            onChange={(e) => {
                                                const files = Array.from(e.target.files || []);
                                                setSettleAttachments(prev => [...prev, ...files]);
                                                if (settleFileInputRef.current) settleFileInputRef.current.value = '';
                                            }}
                                            className="hidden" />
                                    </div>
                                    {settleExistingAttachments.length > 0 && (
                                        <div className="mt-3">
                                            <p className="text-xs font-semibold text-stone-500 mb-2">{text.savedAttachments} ({settleExistingAttachments.length}):</p>
                                            <div className="flex flex-wrap gap-2">
                                                {settleExistingAttachments.map((att, idx) => (
                                                    <div key={idx} className="relative group bg-stone-100 dark:bg-[#111] rounded-lg p-2 flex items-center gap-2">
                                                        {att.mimetype?.startsWith('image/') ? (
                                                            <img src={att.url} alt={att.name} className="w-10 h-10 object-cover rounded" />
                                                        ) : (
                                                            <div className="w-10 h-10 flex items-center justify-center bg-stone-200 dark:bg-[#1a1a1a] rounded">
                                                                <FileText size={20} className="text-stone-500" />
                                                            </div>
                                                        )}
                                                        <span className="text-xs truncate max-w-[120px]">{att.name}</span>
                                                        <button type="button" onClick={(e) => { e.stopPropagation(); setSettleExistingAttachments(prev => prev.filter((_, i) => i !== idx)); }}
                                                            className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <X size={10} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {settleAttachments.length > 0 && (
                                        <div className="mt-3">
                                            <p className="text-xs font-semibold text-stone-500 mb-2">{text.newAttachments} ({settleAttachments.length}):</p>
                                            <div className="flex flex-wrap gap-2">
                                                {settleAttachments.map((file, idx) => (
                                                    <div key={idx} className="relative group bg-stone-100 dark:bg-[#111] rounded-lg p-2 flex items-center gap-2">
                                                        {file.type?.startsWith('image/') ? (
                                                            <img src={URL.createObjectURL(file)} alt={file.name} className="w-10 h-10 object-cover rounded" />
                                                        ) : (
                                                            <div className="w-10 h-10 flex items-center justify-center bg-stone-200 dark:bg-[#1a1a1a] rounded">
                                                                <FileText size={20} className="text-stone-500" />
                                                            </div>
                                                        )}
                                                        <span className="text-xs truncate max-w-[120px]">{file.name}</span>
                                                        <button type="button" onClick={(e) => { e.stopPropagation(); setSettleAttachments(prev => prev.filter((_, i) => i !== idx)); }}
                                                            className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <X size={10} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 pt-2 border-t border-stone-200 dark:border-white/[0.06]">
                                    <button type="button" disabled={settleSubmitting}
                                        onClick={handleSettleSubmit}
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg font-semibold disabled:opacity-50">
                                        {settleSubmitting ? (
                                            <Loader2 size={18} className="animate-spin" />
                                        ) : (
                                            <CheckCircle2 size={18} />
                                        )}
                                        {settleSubmitting ? text.processing : text.btnSettle}
                                    </button>
                                    <button type="button" onClick={() => { setShowSettleModal(false); setSettleAttachments([]); setSettleExistingAttachments([]); }}
                                        className="px-6 py-3 border border-stone-300 dark:border-white/[0.08] rounded-xl text-stone-600 dark:text-white/70 hover:bg-stone-50 dark:hover:bg-white/[0.06] transition-colors">
                                        {text.btnBatal}
                                    </button>
                                </div>
                            </div>
                    </motion.div>
                    </>
                )}
            </AnimatePresence>
            , document.body)}
            {/* Preview — slide-in-from-right drawer (same as Form) */}
            {createPortal(
            <AnimatePresence>
                {showPreview && previewData && (
                    <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[70] bg-[#0a0a0a]/50 backdrop-blur-sm"
                        onClick={() => setShowPreview(false)} />
                    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                        className="fixed top-0 right-0 z-[71] h-full w-full max-w-[600px] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl shadow-2xl flex flex-col"
                        onClick={e => e.stopPropagation()}>
                            <div className="bg-gradient-to-r from-blue-600 to-blue-600 px-6 py-4 flex items-center justify-between shrink-0">
                                <h3 className="text-white font-bold text-lg">{text.previewTitle}</h3>
                                <button onClick={() => setShowPreview(false)}
                                    className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-4">
                                {/* Info header: ref + status + tipe entry */}
                                <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#111]/40 rounded-2xl px-4 py-3.5 border border-stone-200 dark:border-white/[0.08] shadow-sm">
                                    <div className="min-w-0">
                                        <p className="font-mono text-sm font-bold text-stone-800 dark:text-white truncate">
                                            {previewData.no_ref || `ENT-${String(previewData.id).padStart(5, '0')}`}
                                        </p>
                                        <p className="text-xs text-stone-500 dark:text-white/40 truncate">
                                            {previewData.requester_name || previewData.requester_username}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                                            previewData.entry_type === 'reimburse'
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                                                : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                                        }`}>
                                            {previewData.entry_type === 'reimburse' ? 'Reimburse' : 'Plan'}
                                        </span>
                                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                                            previewData.status === 'settled'
                                                ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300'
                                                : previewData.status === 'draft'
                                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                                                : 'bg-stone-100 text-stone-600 dark:bg-[#1a1a1a] dark:text-white/80'
                                        }`}>
                                            {previewData.status === 'settled' ? (isEnglish ? 'Settled' : 'Settled')
                                                : previewData.status === 'draft' ? 'Draft'
                                                : (isEnglish ? 'Active' : 'Aktif')}
                                        </span>
                                    </div>
                                </div>

                                {/* Informasi Umum */}
                                <div className="bg-white dark:bg-[#111]/40 rounded-2xl p-4 border border-stone-200 dark:border-white/[0.08] shadow-sm">
                                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-300 mb-3">
                                        {isEnglish ? 'General Information' : 'Informasi Umum'}
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <DetailField label={text.detailTanggal} value={previewData.tanggal} />
                                        <DetailField label={text.detailTempat} value={previewData.tempat} />
                                        <DetailField label={text.detailJenis} value={previewData.jenis === 'Custom' ? previewData.custom_jenis : previewData.jenis} />
                                        <DetailField label={text.detailPlan} value={previewData.catatan_kode} />
                                    </div>
                                    <div className="mt-4">
                                        <DetailField label={text.detailAlamat} value={previewData.alamat} />
                                    </div>
                                </div>

                                {/* Keuangan */}
                                <div className="bg-white dark:bg-[#111]/40 rounded-2xl p-4 border border-stone-200 dark:border-white/[0.08] shadow-sm">
                                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-300 mb-3">
                                        {isEnglish ? 'Financial' : 'Keuangan'}
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <DetailField label={text.detailNilai} value={new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(previewData.nilai)} />
                                        {previewData.status === 'settled' && previewData.settle_amount && (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-semibold text-stone-500 dark:text-white/40 mb-1">
                                                        {isEnglish ? 'Settle Amount' : 'Jumlah Settle'}
                                                    </label>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-semibold text-stone-800 dark:text-white">
                                                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(previewData.settle_amount)}
                                                        </p>
                                                        {parseFloat(previewData.settle_amount) !== parseFloat(previewData.nilai) && (
                                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                                                parseFloat(previewData.settle_amount) > parseFloat(previewData.nilai)
                                                                    ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300'
                                                                    : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                                                            }`}>
                                                                {parseFloat(previewData.settle_amount) > parseFloat(previewData.nilai) ? 'Over' : 'Short'} {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(Math.abs(parseFloat(previewData.settle_amount) - parseFloat(previewData.nilai)))}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <DetailField label={isEnglish ? 'Settle Date' : 'Tanggal Settle'} value={previewData.settle_date} />
                                            </>
                                        )}
                                        <DetailField label={text.detailNoGl} value={previewData.no_gl} />
                                        <DetailField label={text.detailGl} value={previewData.gl_number} />
                                        {previewData.no_gl_shortage && (
                                            <DetailField label={text.lblAfShortage} value={previewData.no_gl_shortage} />
                                        )}
                                    </div>
                                </div>

                                {/* Relasi / Perusahaan */}
                                <div className="bg-white dark:bg-[#111]/40 rounded-2xl p-4 border border-stone-200 dark:border-white/[0.08] shadow-sm">
                                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-300 mb-3">
                                        {isEnglish ? 'Relations / Company' : 'Relasi / Perusahaan'}
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <DetailField label={text.thNamaRelasi} value={(previewData.relasi || []).join(', ')} />
                                        <DetailField label={text.thJabatan} value={(previewData.jabatan || []).join(', ')} />
                                        <DetailField label={text.detailPerusahaan} value={(previewData.nama_perusahaan || []).join(', ')} />
                                        <DetailField label={text.detailJumlahRelasi} value={`${previewData.jumlah_relasi || (previewData.relasi || []).length || 0} ${isEnglish ? 'person(s)' : 'orang'}`} />
                                        <DetailField label={text.detailJenisUsaha} value={previewData.jenis_usaha} />
                                    </div>
                                </div>

                                {/* Lampiran */}
                                <div className="bg-white dark:bg-[#111]/40 rounded-2xl p-4 border border-stone-200 dark:border-white/[0.08] shadow-sm">
                                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300 mb-3">{text.detailLampiran}</h4>
                                    <div className="flex flex-wrap gap-3">
                                        {(previewData.attachments || []).length === 0 ? (
                                            <p className="text-sm text-stone-500 dark:text-white/40">{text.noAttachment}</p>
                                        ) : previewData.attachments.map((att, idx) => (
                                            <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer"
                                                className="flex items-center gap-2 px-3 py-2 bg-stone-50 dark:bg-[#0d0d0d]/60 rounded-lg border border-stone-200 dark:border-white/[0.08] hover:bg-stone-100 dark:hover:bg-white/[0.06] transition-colors">
                                                {att.mimetype?.startsWith('image/') ? (
                                                    <img src={att.url} alt={att.name} className="w-8 h-8 object-cover rounded" />
                                                ) : (
                                                    <FileText size={20} className="text-stone-500 dark:text-white/40" />
                                                )}
                                                <span className="text-xs text-stone-700 dark:text-white/80 truncate max-w-[150px]">{att.name}</span>
                                            </a>
                                        ))}
                                    </div>
                                </div>

                                {/* Export buttons */}
                                <div className="flex items-center gap-3 pt-1">
                                    <button type="button" onClick={async () => {
                                            if (previewExporting) return;
                                            setPreviewExporting('pdf');
                                            try { await entertainmentService.exportPdf(previewData.id); toast.success(text.pdfExportSuccess); }
                                            catch (e) { toast.error(e.message || text.pdfExportFailed); }
                                            finally { setPreviewExporting(null); }
                                        }}
                                        disabled={!!previewExporting}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                                        {previewExporting === 'pdf' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} {text.exportPdfBtn}
                                    </button>
                                    <button type="button" onClick={async () => {
                                            if (previewExporting) return;
                                            setPreviewExporting('excel');
                                            try { await entertainmentService.exportExcel(previewData.id); toast.success(text.excelExportSuccess); }
                                            catch (e) { toast.error(e.message || text.excelExportFailed); }
                                            finally { setPreviewExporting(null); }
                                        }}
                                        disabled={!!previewExporting}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                                        {previewExporting === 'excel' ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />} {text.exportExcelBtn}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
            , document.body)}
            {/* Settle Confirmation Modal — ringkasan sebelum entry reimburse di-settle langsung */}
            {createPortal(
            <AnimatePresence>
                {settleConfirmOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setSettleConfirmOpen(false)}>
                        <motion.div initial={{ scale: 0.9, y: 24, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 24, opacity: 0 }}
                            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
                            className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
                            onClick={e => e.stopPropagation()}>
                            <div className="pt-7 px-8 flex flex-col items-center text-center">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/30 flex items-center justify-center mb-4">
                                    <CheckCircle2 size={28} className="text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <h3 className="text-lg font-bold text-stone-800 dark:text-white/80">
                                    {isEnglish ? 'Settle This Entry?' : 'Settle Entry Ini?'}
                                </h3>
                                <p className="mt-1.5 text-sm text-stone-500 dark:text-white/40 leading-relaxed">
                                    {isEnglish
                                        ? 'This reimburse entry will be directly marked as Settled with the summary below.'
                                        : 'Entry reimburse ini akan langsung berstatus Settled dengan ringkasan berikut.'}
                                </p>
                            </div>
                            <div className="mt-4 px-8 space-y-2">
                                <div className="rounded-2xl bg-stone-50 dark:bg-[#0d0d0d]/60 border border-white/60 dark:border-white/10 p-4 text-sm">
                                    <div className="flex justify-between py-1"><span className="text-stone-500 dark:text-white/40">{isEnglish ? 'Date' : 'Tanggal'}</span><span className="font-semibold text-stone-700 dark:text-white/80 tabular-nums">{form.tanggal || '-'}</span></div>
                                    <div className="flex justify-between py-1"><span className="text-stone-500 dark:text-white/40">{isEnglish ? 'Place' : 'Tempat'}</span><span className="font-semibold text-stone-700 dark:text-white/80 truncate max-w-[60%]">{form.tempat || '-'}</span></div>
                                    <div className="flex justify-between py-1"><span className="text-stone-500 dark:text-white/40">{isEnglish ? 'Amount' : 'Nilai'}</span><span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">Rp {formatCurrency(form.nilai)}</span></div>
                                    <div className="flex justify-between py-1"><span className="text-stone-500 dark:text-white/40">{isEnglish ? 'Relasi' : 'Relasi'}</span><span className="font-semibold text-stone-700 dark:text-white/80 tabular-nums">{jumlahRelasi} {isEnglish ? 'person(s)' : 'orang'}</span></div>
                                    <div className="flex justify-between py-1"><span className="text-stone-500 dark:text-white/40">{isEnglish ? 'Attachments' : 'Lampiran'}</span><span className="font-semibold text-stone-700 dark:text-white/80 tabular-nums">{existingAttachments.length + attachments.length}</span></div>
                                    <div className="flex justify-between py-1 border-t border-stone-200 dark:border-white/[0.06] mt-1"><span className="text-stone-500 dark:text-white/40">No. AF</span><span className="font-semibold text-stone-700 dark:text-white/80">{form.no_gl || '-'}</span></div>
                                </div>
                            </div>
                            <div className="mt-6 px-8 pb-8 flex items-center gap-3">
                                <button type="button" onClick={() => setSettleConfirmOpen(false)}
                                    disabled={submitting}
                                    className="flex-1 px-4 py-3 rounded-2xl border border-stone-300 dark:border-white/[0.08] text-stone-600 dark:text-white/70 hover:bg-stone-50 dark:hover:bg-white/[0.06] transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                    {isEnglish ? 'Cancel' : 'Batal'}
                                </button>
                                <button type="button" onClick={() => { setSettleConfirmOpen(false); handleSubmit(null, 'settled'); }}
                                    disabled={submitting}
                                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-500/25 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                    {submitting ? (isEnglish ? 'Settling...' : 'Settle...') : (isEnglish ? 'Yes, Settle' : 'Ya, Settle')}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            , document.body)}
            {/* Delete Confirmation Modal (modern) */}
            {createPortal(
            <AnimatePresence>
                {deleteTarget && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setDeleteTarget(null)}>
                        <motion.div initial={{ scale: 0.9, y: 24, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 24, opacity: 0 }}
                            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
                            className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
                            onClick={e => e.stopPropagation()}>
                            <div className="pt-8 px-8 flex flex-col items-center text-center">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-900/40 dark:to-rose-900/30 flex items-center justify-center mb-4">
                                    <Trash2 size={28} className="text-red-500 dark:text-red-400" />
                                </div>
                                <h3 className="text-lg font-bold text-stone-800 dark:text-white/80">
                                    {deleteTarget.type === 'rule'
                                        ? (isEnglish ? 'Delete Rule?' : 'Hapus Rule?')
                                        : (isEnglish ? 'Delete Data?' : 'Hapus Data?')}
                                </h3>
                                <p className="mt-2 text-sm text-stone-500 dark:text-white/40 leading-relaxed">
                                    {deleteTarget.type === 'rule'
                                        ? (isEnglish
                                            ? `Are you sure you want to delete the rule "${deleteTarget.label}"? This action cannot be undone.`
                                            : `Anda yakin ingin menghapus rule "${deleteTarget.label}"? Tindakan ini tidak dapat dibatalkan.`)
                                        : (isEnglish
                                            ? `Data "${deleteTarget.label}" will be permanently deleted. This action cannot be undone.`
                                            : `Data "${deleteTarget.label}" akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.`)}
                                </p>
                            </div>
                            <div className="mt-6 px-8 pb-8 flex items-center gap-3">
                                <button type="button" onClick={() => setDeleteTarget(null)}
                                    disabled={!!deletingId || !!deletingRuleId}
                                    className="flex-1 px-4 py-3 rounded-2xl border border-stone-300 dark:border-white/[0.08] text-stone-600 dark:text-white/70 hover:bg-stone-50 dark:hover:bg-white/[0.06] transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                    {isEnglish ? 'Cancel' : 'Batal'}
                                </button>
                                <button type="button" onClick={confirmDelete}
                                    disabled={!!deletingId || !!deletingRuleId}
                                    className="flex-1 px-4 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 text-white hover:from-red-500 hover:to-rose-500 transition-all shadow-lg shadow-red-500/20 font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2">
                                    {!!deletingId || !!deletingRuleId
                                        ? <Loader2 size={18} className="animate-spin" />
                                        : <Trash2 size={18} />}
                                    {!!deletingId || !!deletingRuleId
                                        ? (isEnglish ? 'Deleting...' : 'Menghapus...')
                                        : (isEnglish ? 'Delete' : 'Hapus')}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            , document.body)}
            {/* Row Action Menu (⋮) — harmonized with Invoices */}
            {actionMenu && createPortal(
                <>
                    <div className="fixed inset-0 z-[58]" onClick={() => setActionMenu(null)} />
                    <div
                        ref={actionMenuRef}
                        className="fixed z-[59] min-w-[200px] max-w-[240px] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/60 dark:border-white/10 p-1.5 overflow-auto custom-scrollbar"
                        style={{ left: actionMenu.x, top: actionMenu.y, maxHeight: actionMenu.maxH }}
                    >
                        {(() => {
                            const item = actionMenu.item;
                            const isPending = actionMenu.tab === 'pending';
                            const label = item.no_ref || `ENT-${String(item.id).padStart(5, '0')}`;
                            const itemCls = 'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
                            return (
                                <div className="py-0.5 space-y-0.5">
                                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400">{label} • {item.tempat || '-'}</div>

                                    <button type="button" onClick={() => { setActionMenu(null); handlePreview(item); }} className={`${itemCls} text-stone-600 dark:text-white/70 hover:bg-stone-100 dark:hover:bg-white/[0.06]`}>
                                        <Eye size={15} /> {text.preview}
                                    </button>

                                    {isPending && userPerms.can_edit && (
                                        <button type="button" onClick={() => { setActionMenu(null); handleEdit(item); }} className={`${itemCls} text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10`}>
                                            <Edit3 size={15} /> {text.edit}
                                        </button>
                                    )}

                                    {isPending && item.entry_type !== 'reimburse' && userPerms.can_settle && (
                                        <button type="button" onClick={() => { setActionMenu(null); handleSettle(item); }} className={`${itemCls} text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10`}>
                                            <CheckCircle2 size={15} /> {text.settle}
                                        </button>
                                    )}

                                    {userPerms.can_edit && (
                                        <button type="button" onClick={() => { setActionMenu(null); setGlTarget(item); setGlValue(item.gl_number || ''); }}
                                            className={`${itemCls} text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-500/10`}>
                                            <Hash size={15} /> {text.glAction}
                                        </button>
                                    )}

                                    {userPerms.can_export && (
                                        <button type="button"
                                            disabled={exportingPdfId === item.id}
                                            onClick={() => { setActionMenu(null); if (exportingPdfId) return; setExportingPdfId(item.id); entertainmentService.exportPdf(item.id).then(() => toast.success(text.pdfExportSuccess)).catch(e => toast.error(e.message || text.pdfExportFailed)).finally(() => setExportingPdfId(null)); }}
                                            className={`${itemCls} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10`}>
                                            {exportingPdfId === item.id ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} {text.exportPdfBtn}
                                        </button>
                                    )}

                                    {isPending && userPerms.can_delete && (
                                        <>
                                            <div className="my-1.5 border-t border-white/60 dark:border-white/10" />
                                            <button type="button"
                                                disabled={deletingId === item.id}
                                                onClick={() => { setActionMenu(null); handleDelete(item.id, label); }}
                                                className={`${itemCls} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10`}>
                                                {deletingId === item.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} {text.delete}
                                            </button>
                                        </>
                                    )}

                                    {!isPending && isAdmin && (
                                        <>
                                            <div className="my-1.5 border-t border-white/60 dark:border-white/10" />
                                            <button type="button"
                                                disabled={deletingId === item.id}
                                                onClick={() => { setActionMenu(null); handleDelete(item.id, label); }}
                                                className={`${itemCls} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10`}>
                                                {deletingId === item.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} {text.delete}
                                            </button>
                                        </>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </>,
                document.body
            )}

            {/* GL Number Modal — update GL number even after settled */}
            {createPortal(
                <AnimatePresence>
                    {glTarget && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                            onClick={() => setGlTarget(null)}>
                            <motion.div initial={{ scale: 0.9, y: 24, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 24, opacity: 0 }}
                                transition={{ type: 'spring', damping: 22, stiffness: 300 }}
                                className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
                                onClick={e => e.stopPropagation()}>
                                <div className="bg-gradient-to-r from-sky-600 to-blue-600 px-6 py-4 flex items-center justify-between">
                                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                        <Hash size={20} /> {text.glTitle}
                                    </h3>
                                    <button onClick={() => setGlTarget(null)}
                                        className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="flex items-center justify-between gap-3 bg-stone-50 dark:bg-[#111]/40 rounded-xl px-4 py-3 border border-stone-200 dark:border-white/[0.08]">
                                        <div className="min-w-0">
                                            <p className="font-mono text-sm font-bold text-stone-800 dark:text-white/80 truncate">
                                                {glTarget.no_ref || `ENT-${String(glTarget.id).padStart(5, '0')}`}
                                            </p>
                                            <p className="text-xs text-stone-500 dark:text-white/40 truncate">{glTarget.tempat || '-'}</p>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 ${
                                            glTarget.status === 'settled'
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                                                : glTarget.status === 'draft'
                                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                                                : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                                        }`}>
                                            {glTarget.status === 'settled' ? (isEnglish ? 'Settled' : 'Settled')
                                                : glTarget.status === 'draft' ? 'Draft'
                                                : isEnglish ? 'Active' : 'Aktif'}
                                        </span>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-stone-500 dark:text-white/40 mb-1">{text.glCurrent}</label>
                                        <p className="px-4 py-2.5 rounded-xl bg-stone-100 dark:bg-[#111]/60 font-mono text-sm text-stone-700 dark:text-white/80">
                                            {glTarget.gl_number || '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-stone-600 dark:text-white/70 mb-1">{text.glNew} *</label>
                                        <input type="text" value={glValue}
                                            autoFocus
                                            onChange={e => setGlValue(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') document.getElementById('gl-save-btn')?.click(); }}
                                            placeholder={isEnglish ? 'Enter GL number' : 'Isi GL number'}
                                            className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-sm font-mono focus:ring-2 focus:ring-sky-500" />
                                    </div>
                                    <div className="flex items-center justify-end gap-3 pt-1">
                                        <button type="button" onClick={() => setGlTarget(null)}
                                            className="px-4 py-2 border border-stone-300 dark:border-white/[0.08] text-stone-600 dark:text-white/70 rounded-xl hover:bg-stone-50 dark:hover:bg-white/[0.06] transition-colors text-sm font-semibold">
                                            Cancel
                                        </button>
                                        <button id="gl-save-btn" type="button" disabled={glSaving}
                                            onClick={async () => {
                                                if (glSaving) return;
                                                if (!glValue.trim()) { toast.error(text.glEmpty); return; }
                                                setGlSaving(true);
                                                try {
                                                    await entertainmentService.updateGlNumber(glTarget.id, glValue.trim());
                                                    toast.success(text.glSaved);
                                                    setGlTarget(null);
                                                    fetchData({ silent: true });
                                                } catch (e) {
                                                    toast.error(e.message || text.glEmpty);
                                                } finally {
                                                    setGlSaving(false);
                                                }
                                            }}
                                            className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-sky-600 to-blue-600 text-white rounded-xl hover:opacity-90 transition-opacity text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed">
                                            {glSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {text.glSave}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
                , document.body)}
            </div>
    );
}

function DetailField({ label, value }) {
    return (
        <div>
            <label className="block text-xs font-semibold text-stone-500 dark:text-white/40 mb-1">{label}</label>
            <p className="px-3 py-2 rounded-lg bg-stone-50 dark:bg-[#0d0d0d]/60 border border-stone-100 dark:border-white/[0.08]/60 text-sm font-medium text-stone-800 dark:text-white min-h-[38px] break-words">{value || '-'}</p>
        </div>
    );
}
