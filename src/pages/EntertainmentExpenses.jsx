import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Plus, Trash2, Eye, FileSpreadsheet, FileText, Upload,
    X, Search, Filter, Edit3,
    Receipt, Save, ClipboardList,
    DollarSign, Loader2, CheckCircle2
} from 'lucide-react';
import { entertainmentService } from '../services/entertainmentService';
import { API_URL } from '../services/apiClient';
import { SummaryCard } from '../components/ui/Card';
import { useLanguage } from '../contexts/LanguageContext';

const JENIS_OPTIONS = ['Breakfast', 'Lunch', 'Dinner', 'Event', 'Custom'];
const JENIS_USAHA_OPTIONS = [
    'MANUFACTURING', 'TRADING', 'SERVICES', 'FINANCE', 'TECHNOLOGY',
    'CONSTRUCTION', 'TRANSPORTATION', 'AGRICULTURE', 'MINING',
    'EDUCATION', 'HEALTHCARE', 'HOSPITALITY', 'MEDIA', 'OTHER', 'Custom'
];
const JENIS_USAHA_PRESET = JENIS_USAHA_OPTIONS.filter(j => j !== 'Custom');

const emptyForm = () => ({
    tanggal: '', tempat: '', alamat: '', jenis: '', custom_jenis: '',
    nilai: '', no_gl: '', groups: [{ relasi: '', jabatan: '', nama_perusahaan: '' }],
    jenis_usaha: '', custom_jenis_usaha: '', catatan_kode: ''
});

const silentToast = { success: () => {}, error: () => {}, info: () => {}, warning: () => {}, loading: () => {} };

export default function EntertainmentExpenses({ currentUser, hasPermission, toast: toastProp }) {
    const toast = toastProp || silentToast;
    const { language } = useLanguage();
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
        searchPlaceholder: 'Search venue, type, GL...',
        // Filter
        filterTanggal: 'Filter Date', filterJenis: 'Filter Type', filterSearch: 'Search',
        filterAll: 'All', filterBtn: 'Filter', filterReset: 'Reset',
        // Table
        thAksi: 'Actions', thTanggal: 'Date', thNoRef: 'Ref No', thNamaRelasi: 'Relation',
        thJabatan: 'Position', thNilai: 'Amount', thJenis: 'Type', thPengaju: 'Requester',
        loading: 'Loading data...', empty: 'No data yet',
        // Actions
        preview: 'Preview', edit: 'Edit', settle: 'Settle', exportPdfBtn: 'Export PDF', delete: 'Delete',
        // Form
        formTitle: 'Entertainment Expenses', formEdit: 'Edit Entry', formNew: 'New Entry',
        lblTanggal: 'Date *', lblTempat: 'Venue', lblJenis: 'Type *', lblCustomJenis: 'Custom type',
        lblAlamat: 'Address', lblNilai: 'Amount (IDR) *', lblNoGl: 'GL Number',
        lblJenisUsaha: 'Business Type', lblCustomJenisUsaha: 'Custom business type',
        lblMomResult: 'MOM/Result *', lblLampiran: 'Attachments', lblDragDrop: 'Click or drag files here',
        btnSave: 'Save', btnCancel: 'Cancel', btnUpdate: 'Update',
        // Settle
        settleTitle: 'Settle Entertainment', lblSettleDate: 'Settle Date *',
        lblRelasiPerusahaan: 'Relation & Company', btnTambahRelasi: 'Add Relation',
        lblCatatan: 'Notes', btnSettle: 'Settle', btnBatal: 'Cancel',
        // Preview
        previewTitle: 'Preview Entertainment Expenses',
        detailTanggal: 'Date', detailTempat: 'Venue', detailJenis: 'Type',
        detailAlamat: 'Address', detailNilai: 'Amount', detailNoGl: 'GL Number',
        detailJenisUsaha: 'Business Type', detailRelasi: 'Relations',
        detailJumlahRelasi: 'Relation Count', detailPerusahaan: 'Companies',
        detailMomResult: 'MOM/Result', detailLampiran: 'Attachments',
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
        errCustomJenis: 'Custom type is required', errNoGl: 'GL Number is required',
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
        lblGroupJabatan: 'Position', lblGroupPerusahaan: 'Company Name * (Full Name)',
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
        searchPlaceholder: 'Cari tempat, jenis, GL...',
        // Filter
        filterTanggal: 'Filter Tanggal', filterJenis: 'Filter Jenis', filterSearch: 'Pencarian',
        filterAll: 'Semua', filterBtn: 'Filter', filterReset: 'Reset',
        // Table
        thAksi: 'Aksi', thTanggal: 'Tanggal', thNoRef: 'No Ref', thNamaRelasi: 'Nama Relasi',
        thJabatan: 'Jabatan', thNilai: 'Nilai', thJenis: 'Jenis', thPengaju: 'Pengaju',
        loading: 'Memuat data...', empty: 'Belum ada data',
        // Actions
        preview: 'Preview', edit: 'Edit', settle: 'Settle', exportPdfBtn: 'Export PDF', delete: 'Hapus',
        // Form
        formTitle: 'Entertainment Expenses', formEdit: 'Edit Entry', formNew: 'Entry Baru',
        lblTanggal: 'Tanggal *', lblTempat: 'Tempat', lblJenis: 'Jenis *', lblCustomJenis: 'Custom jenis',
        lblAlamat: 'Alamat', lblNilai: 'Nilai (IDR) *', lblNoGl: 'No GL',
        lblJenisUsaha: 'Jenis Usaha', lblCustomJenisUsaha: 'Custom jenis usaha',
        lblMomResult: 'MOM/Result *', lblLampiran: 'Lampiran', lblDragDrop: 'Klik atau seret file ke sini',
        btnSave: 'Simpan', btnCancel: 'Batal', btnUpdate: 'Update',
        // Settle
        settleTitle: 'Settle Entertainment', lblSettleDate: 'Tanggal Settle *',
        lblRelasiPerusahaan: 'Relasi & Perusahaan', btnTambahRelasi: 'Tambah Relasi',
        lblCatatan: 'Catatan', btnSettle: 'Settle', btnBatal: 'Batal',
        // Preview
        previewTitle: 'Preview Entertainment Expenses',
        detailTanggal: 'Tanggal', detailTempat: 'Tempat', detailJenis: 'Jenis',
        detailAlamat: 'Alamat', detailNilai: 'Nilai', detailNoGl: 'No GL',
        detailJenisUsaha: 'Jenis Usaha', detailRelasi: 'Relasi',
        detailJumlahRelasi: 'Jumlah Relasi', detailPerusahaan: 'Perusahaan',
        detailMomResult: 'MOM/Result', detailLampiran: 'Lampiran',
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
        errCustomJenis: 'Custom jenis wajib diisi', errNoGl: 'No GL wajib diisi',
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
        lblGroupJabatan: 'Jabatan', lblGroupPerusahaan: 'Nama Perusahaan * (Full Name)',
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
    const [searchParams, setSearchParams] = useState({ tanggal: '', jenis: '', search: '' });
    const [exportingPdf, setExportingPdf] = useState(false);
    const [exportingExcel, setExportingExcel] = useState(false);
    
    const [form, setForm] = useState(emptyForm);
    const [errors, setErrors] = useState({});
    const [attachments, setAttachments] = useState([]);
    const [existingAttachments, setExistingAttachments] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalEntries, setTotalEntries] = useState(0);
    const [tab, setTab] = useState('pending');
    const [showSettleModal, setShowSettleModal] = useState(false);
    const [settleItem, setSettleItem] = useState(null);
    const [settleForm, setSettleForm] = useState({});
    const [settleSubmitting, setSettleSubmitting] = useState(false);
    const [settleAttachments, setSettleAttachments] = useState([]);
    const [settleExistingAttachments, setSettleExistingAttachments] = useState([]);
    const settleFileInputRef = useRef(null);
    const [rules, setRules] = useState([]);
    const [userPerms, setUserPerms] = useState({ view_all: false, can_create: true, can_edit: true, can_delete: true, can_settle: true, can_export: true });
    const [showRuleForm, setShowRuleForm] = useState(false);
    const [editingRule, setEditingRule] = useState(null);
    const [ruleForm, setRuleForm] = useState({ rule_name: '', target_type: 'user', target_value: '', view_all: false, can_create: true, can_edit: true, can_delete: true, can_settle: true, can_export: true, export_all: false });
    const [ruleSubmitting, setRuleSubmitting] = useState(false);
    const [usersList, setUsersList] = useState([]);
    const [departmentsList, setDepartmentsList] = useState([]);
    const [rolesList, setRolesList] = useState([]);

    const parseField = (val, fallback = []) => {
        if (val == null || val === '') return fallback;
        if (typeof val === 'string') {
            try { return JSON.parse(val); } catch { return fallback; }
        }
        return val;
    };

    const fetchData = useCallback(async (opts = {}) => {
        const silent = opts.silent === true;
        try {
            if (!silent) setLoading(true);
            const params = { page, perPage: 15, status: tab === 'settled' ? 'settled' : 'active' };
            if (searchParams.tanggal) params.tanggal = searchParams.tanggal;
            if (searchParams.jenis) params.jenis = searchParams.jenis;
            if (searchParams.search) params.search = searchParams.search;
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
                if (result.permissions) setUserPerms(result.permissions);
            } else {
                setTotalEntries(parsed.length);
                setTotalPages(1);
            }
        } catch (e) {
            console.error('Fetch error:', e);
            if (!silent) toast.error(e.message || 'Gagal memuat data');
        } finally {
            if (!silent) setLoading(false);
        }
    }, [searchParams, toast, page, tab]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const resetForm = () => {
        setForm(emptyForm());
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
        if (!form.no_gl) errs.no_gl = text.errNoGl;
        if (!form.groups || form.groups.length === 0 || !form.groups[0].relasi?.trim()) errs.groups = text.errGroups;
        if (!form.jenis_usaha) errs.jenis_usaha = text.errJenisUsaha;
        if (form.jenis_usaha === 'Custom' && !form.custom_jenis_usaha?.trim()) {
            errs.custom_jenis_usaha = text.errCustomJenisUsaha;
        }
        if (!form.catatan_kode) errs.catatan_kode = text.errMomResult;
        if (attachments.length === 0 && existingAttachments.length === 0) errs.attachments = text.errAttachments;
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const formatCurrency = (val) => {
        if (!val) return '';
        const num = val.toString().replace(/[^\d]/g, '');
        return new Intl.NumberFormat('id-ID').format(num);
    };

    const parseCurrency = (val) => {
        return val ? val.toString().replace(/[^\d]/g, '') : '';
    };

    const handleNilaiChange = (e) => {
        const raw = parseCurrency(e.target.value);
        setForm(prev => ({ ...prev, nilai: raw }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) {
            toast.error('Harap isi semua field yang wajib');
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
            fd.append('no_gl', form.no_gl);
            const filledGroups = form.groups.filter(g => g.relasi?.trim());
            const relasiArr = filledGroups.map(g => g.relasi.trim());
            const jabatanArr = filledGroups.map(g => (g.jabatan || '').trim());
            const perusahaanArr = filledGroups.map(g => (g.nama_perusahaan || '').trim());
            fd.append('relasi', JSON.stringify(relasiArr));
            fd.append('jabatan', JSON.stringify(jabatanArr));
            fd.append('nama_perusahaan', JSON.stringify(perusahaanArr));
            fd.append('jenis_usaha', resolveJenisUsaha());
            fd.append('catatan_kode', form.catatan_kode);

            if (editingId) {
                fd.append('existing_attachments', JSON.stringify(existingAttachments));
            }

            attachments.forEach(file => {
                fd.append('attachments', file);
            });

            if (editingId) {
                await entertainmentService.update(editingId, fd);
                toast.success('Data berhasil diupdate');
            } else {
                await entertainmentService.create(fd);
                toast.success('Data berhasil disimpan');
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
            nilai: item.nilai ? String(item.nilai) : '',
            no_gl: item.no_gl || '',
            groups: editGroups.length > 0 ? editGroups : [{ relasi: '', jabatan: '', nama_perusahaan: '' }],
            jenis_usaha: isCustomUsaha ? 'Custom' : savedUsaha,
            custom_jenis_usaha: isCustomUsaha ? savedUsaha : '',
            catatan_kode: item.catatan_kode || ''
        });
        setExistingAttachments(Array.isArray(item.attachments) ? item.attachments : []);
        setAttachments([]);
        setEditingId(item.id);
        setShowForm(true);
        setErrors({});
    };

    const handleDelete = async (id) => {
        if (!confirm('Yakin ingin menghapus data ini?')) return;
        try {
            await entertainmentService.delete(id);
            toast.success('Data berhasil dihapus');
            fetchData();
        } catch (e) {
            toast.error(e.message);
        }
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
            toast.success(`${files.length} file ditempel ke lampiran`);
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

    const initSettleForm = (item) => ({
        tanggal: formatDateForInput(item.tanggal),
        tempat: item.tempat || '',
        alamat: item.alamat || '',
        jenis: item.jenis || '',
        custom_jenis: item.custom_jenis || '',
        nilai: item.nilai ? String(item.nilai) : '',
        no_gl: item.no_gl || '',
        groups: (item.relasi || []).map((relasi, i) => ({
            relasi,
            jabatan: (item.jabatan || [])[i] || '',
            nama_perusahaan: (item.nama_perusahaan || [])[i] || ''
        })),
        jenis_usaha: item.jenis_usaha || '',
        custom_jenis_usaha: (item.jenis_usaha && !JENIS_USAHA_PRESET.includes(item.jenis_usaha)) ? item.jenis_usaha : '',
        catatan_kode: item.catatan_kode || '',
        settle_date: item.settle_date || new Date().toISOString().split('T')[0]
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
        if (!settleForm.settle_date) {
            toast.error(text.errSettleDate);
            return;
        }
        setSettleSubmitting(true);
        try {
            const fd = new FormData();
            fd.append('tanggal', settleForm.tanggal);
            fd.append('tempat', settleForm.tempat);
            fd.append('alamat', settleForm.alamat);
            fd.append('jenis', settleForm.jenis);
            fd.append('custom_jenis', settleForm.jenis === 'Custom' ? settleForm.custom_jenis : '');
            fd.append('nilai', settleForm.nilai);
            fd.append('no_gl', settleForm.no_gl);
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
            if (result.changed) {
                toast.success('Data diupdate dan berhasil di-settle');
            } else {
                toast.success('Berhasil di-settle');
            }
            setShowSettleModal(false);
            setSettleItem(null);
            setSettleAttachments([]);
            setSettleExistingAttachments([]);
            fetchData();
        } catch (e) {
            toast.error(e.message || 'Gagal settle');
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
        if (!ruleForm.rule_name || !ruleForm.target_value) {
            toast.error('Nama rule dan target wajib diisi');
            return;
        }
        setRuleSubmitting(true);
        try {
            if (editingRule) {
                await entertainmentService.updateRule(editingRule.id, ruleForm);
                toast.success('Rule berhasil diupdate');
            } else {
                await entertainmentService.createRule(ruleForm);
                toast.success('Rule berhasil dibuat');
            }
            setShowRuleForm(false);
            setEditingRule(null);
            setRuleForm({ rule_name: '', target_type: 'user', target_value: '', view_all: false, can_create: true, can_edit: true, can_delete: true, can_settle: true, can_export: true, export_all: false });
            fetchRules();
        } catch (e) {
            toast.error(e.message || 'Gagal menyimpan rule');
        } finally {
            setRuleSubmitting(false);
        }
    };

    const handleDeleteRule = async (id) => {
        if (!confirm('Yakin ingin menghapus rule ini?')) return;
        try {
            await entertainmentService.deleteRule(id);
            toast.success('Rule berhasil dihapus');
            fetchRules();
        } catch (e) {
            toast.error(e.message);
        }
    };

    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SummaryCard
                    title={text.totalEntries}
                    value={totalEntries}
                    icon={ClipboardList}
                    colorClass="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300"
                    subtext={text.totalEntriesSub}
                />
                <SummaryCard
                    title={text.totalNilai}
                    value={new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalNilai)}
                    icon={DollarSign}
                    colorClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300"
                    subtext={text.totalNilaiSub}
                />
                <SummaryCard
                    title={text.totalLampiran}
                    value={totalLampiran}
                    icon={FileText}
                    colorClass="bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300"
                    subtext={text.totalLampiranSub}
                />
            </div>

            {/* Header Actions */}
            {tab !== 'rules' && (
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    {userPerms.can_create && (
                    <button
                        onClick={() => { resetForm(); setShowForm(!showForm); }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl hover:from-indigo-500 hover:to-blue-500 transition-all shadow-lg shadow-indigo-500/20 font-semibold text-sm"
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
            <div className="flex gap-1 bg-white dark:bg-slate-800/50 rounded-2xl p-1 border border-slate-200 dark:border-slate-700">
                <button
                    onClick={() => { setTab('pending'); setPage(1); }}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
                        tab === 'pending'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                >
                    {isEnglish ? 'Entertainment List' : 'Daftar Entertainment'}
                </button>
                <button
                    onClick={() => { setTab('settled'); setPage(1); }}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
                        tab === 'settled'
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                >
                    {isEnglish ? 'Settlement' : 'Penyelesaian / Settle'}
                </button>
                {isAdmin && (
                    <button
                        onClick={() => { setTab('rules'); setPage(1); }}
                        className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
                            tab === 'rules'
                                ? 'bg-amber-600 text-white shadow-md'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                    >
                        Rules
                    </button>
                )}
            </div>

            {/* Search / Filter */}
            <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{text.filterTanggal}</label>
                        <input type="date" value={searchParams.tanggal}
                            onChange={e => setSearchParams(p => ({ ...p, tanggal: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{text.filterJenis}</label>
                        <select value={searchParams.jenis}
                            onChange={e => setSearchParams(p => ({ ...p, jenis: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-indigo-500">
                            <option value="">{text.filterAll}</option>
                            {JENIS_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
                        </select>
                    </div>
                    <div className="flex-[2] min-w-[200px]">
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{text.filterSearch}</label>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="text" placeholder={text.searchPlaceholder + ' (Enter)'} value={searchParams.search}
                                onChange={e => setSearchParams(p => ({ ...p, search: e.target.value }))}
                                onKeyDown={handleSearchKeyDown}
                                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-indigo-500" />
                        </div>
                    </div>
                    <button onClick={() => { setPage(1); }}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm font-semibold">
                        <Filter size={16} className="inline-block mr-1" />
                        {text.filterBtn}
                    </button>
                    <button onClick={() => { setSearchParams({ tanggal: '', jenis: '', search: '' }); setPage(1); }}
                        className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-semibold">
                        <X size={16} className="inline-block mr-1" />
                        {text.filterReset}
                    </button>
                </div>
            </div>

            {/* Rules Tab Content */}
            {tab === 'rules' && isAdmin && (
                <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <h3 className="font-bold text-slate-700 dark:text-slate-200">
                            <ClipboardList size={18} className="inline-block mr-2" />
                            {text.rulesTitle}
                        </h3>
                        <button onClick={() => { setShowRuleForm(!showRuleForm); setEditingRule(null); setRuleForm({ rule_name: '', target_type: 'user', target_value: '', view_all: false, can_create: true, can_edit: true, can_delete: true, can_settle: true, can_export: true, export_all: false }); }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors text-sm font-semibold">
                            <Plus size={16} /> {showRuleForm ? (isEnglish ? 'Close' : 'Tutup') : text.addRule}
                        </button>
                    </div>

                    {/* Rule Form */}
                    <AnimatePresence>
                        {showRuleForm && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                className="border-b border-slate-200 dark:border-slate-700 overflow-hidden">
                                <div className="p-6 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Rule Name *</label>
                                            <input type="text" value={ruleForm.rule_name}
                                                onChange={e => setRuleForm(p => ({ ...p, rule_name: e.target.value }))}
                                                placeholder="Contoh: Allow finance view all"
                                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Target Type *</label>
                                            <select value={ruleForm.target_type}
                                                onChange={e => setRuleForm(p => ({ ...p, target_type: e.target.value, target_value: '' }))}
                                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm">
                                                <option value="user">User</option>
                                                <option value="division">Divisi</option>
                                                <option value="role">Role</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                                {ruleForm.target_type === 'user' ? 'Username' : ruleForm.target_type === 'division' ? 'Nama Divisi' : 'Role ID'} *
                                            </label>
                                            {ruleForm.target_type === 'user' ? (
                                                <select value={ruleForm.target_value}
                                                    onChange={e => setRuleForm(p => ({ ...p, target_value: e.target.value }))}
                                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm">
                                                    <option value="">{text.targetUser}</option>
                                                    {usersList.map(u => (
                                                        <option key={u.username || u.id} value={u.username}>{u.name || u.username}</option>
                                                    ))}
                                                </select>
                                            ) : ruleForm.target_type === 'division' ? (
                                                <select value={ruleForm.target_value}
                                                    onChange={e => setRuleForm(p => ({ ...p, target_value: e.target.value }))}
                                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm">
                                                    <option value="">{text.targetDivision}</option>
                                                    {departmentsList.map(d => (
                                                        <option key={d.id || d.name} value={d.name}>{d.name || d.label}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <select value={ruleForm.target_value}
                                                    onChange={e => setRuleForm(p => ({ ...p, target_value: e.target.value }))}
                                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm">
                                                    <option value="">{text.targetRole}</option>
                                                    {rolesList.map(r => (
                                                        <option key={r.id} value={r.id}>{r.label || r.id}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Permissions</label>
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
                                                <label key={p.key} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-600 text-sm">
                                                    <input type="checkbox" checked={!!ruleForm[p.key]}
                                                        onChange={e => setRuleForm(prev => ({ ...prev, [p.key]: e.target.checked }))}
                                                        className="rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
                                                    <span className="text-slate-700 dark:text-slate-300">{p.label}</span>
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
                                            className="px-5 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm">
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
                                <tr className="bg-slate-50 dark:bg-slate-700/50 text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider">
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
                                    <tr><td colSpan={12} className="px-4 py-8 text-center text-slate-400">{text.noRules}</td></tr>
                                ) : rules.map(rule => (
                                    <tr key={rule.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                        <td className="px-4 py-3 font-semibold">{rule.rule_name}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                                                rule.target_type === 'user' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                                rule.target_type === 'division' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                                                'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                                            }`}>{rule.target_type}</span>
                                        </td>
                                        <td className="px-4 py-3">{rule.target_value}</td>
                                        <td className="px-4 py-3 text-center">{rule.view_all ? <CheckCircle2 size={16} className="inline text-green-500" /> : <X size={16} className="inline text-slate-300" />}</td>
                                        <td className="px-4 py-3 text-center">{rule.export_all ? <CheckCircle2 size={16} className="inline text-green-500" /> : <X size={16} className="inline text-slate-300" />}</td>
                                        <td className="px-4 py-3 text-center">{rule.can_create ? <CheckCircle2 size={16} className="inline text-green-500" /> : <X size={16} className="inline text-red-400" />}</td>
                                        <td className="px-4 py-3 text-center">{rule.can_edit ? <CheckCircle2 size={16} className="inline text-green-500" /> : <X size={16} className="inline text-red-400" />}</td>
                                        <td className="px-4 py-3 text-center">{rule.can_delete ? <CheckCircle2 size={16} className="inline text-green-500" /> : <X size={16} className="inline text-red-400" />}</td>
                                        <td className="px-4 py-3 text-center">{rule.can_settle ? <CheckCircle2 size={16} className="inline text-green-500" /> : <X size={16} className="inline text-red-400" />}</td>
                                        <td className="px-4 py-3 text-center">{rule.can_export ? <CheckCircle2 size={16} className="inline text-green-500" /> : <X size={16} className="inline text-red-400" />}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${rule.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {rule.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => { setEditingRule(rule); setRuleForm({ rule_name: rule.rule_name, target_type: rule.target_type, target_value: rule.target_value, view_all: rule.view_all, can_create: rule.can_create, can_edit: rule.can_edit, can_delete: rule.can_delete, can_settle: rule.can_settle, can_export: rule.can_export, export_all: rule.export_all }); setShowRuleForm(true); }}
                                                    className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg" title="Edit">
                                                    <Edit3 size={16} />
                                                </button>
                                                <button onClick={() => handleDeleteRule(rule.id)}
                                                    className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Hapus">
                                                    <Trash2 size={16} />
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

            {/* Form */}
            <AnimatePresence>
                {showForm && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                        className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-4">
                            <h3 className="text-white font-bold text-lg">{editingId ? text.formEdit : text.formNew} Entertainment Expenses</h3>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {/* Tanggal */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{text.lblTanggal}</label>
                                    <input type="date" value={form.tanggal}
                                        onChange={e => setForm(p => ({ ...p, tanggal: e.target.value }))}
                                        className={`w-full px-3 py-2.5 rounded-xl border ${errors.tanggal ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'} bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-indigo-500`} />
                                    {errors.tanggal && <p className="text-red-500 text-xs mt-1">{errors.tanggal}</p>}
                                </div>
                                {/* Tempat */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{text.lblTempat} *</label>
                                    <input type="text" value={form.tempat}
                                        onChange={e => setForm(p => ({ ...p, tempat: e.target.value }))}
                                        className={`w-full px-3 py-2.5 rounded-xl border ${errors.tempat ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'} bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-indigo-500`} />
                                    {errors.tempat && <p className="text-red-500 text-xs mt-1">{errors.tempat}</p>}
                                </div>
                                {/* Jenis */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{text.lblJenis}</label>
                                    <select value={form.jenis}
                                        onChange={e => setForm(p => ({ ...p, jenis: e.target.value }))}
                                        className={`w-full px-3 py-2.5 rounded-xl border ${errors.jenis ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'} bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-indigo-500`}>
                                        <option value="">{text.pilihJenis}</option>
                                        {JENIS_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
                                    </select>
                                    {errors.jenis && <p className="text-red-500 text-xs mt-1">{errors.jenis}</p>}
                                    {form.jenis === 'Custom' && (
                                        <input type="text" placeholder={text.customJenisPlaceholder} value={form.custom_jenis}
                                            onChange={e => setForm(p => ({ ...p, custom_jenis: e.target.value }))}
                                            className={`mt-2 w-full px-3 py-2 rounded-xl border ${errors.custom_jenis ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'} bg-white dark:bg-slate-700 text-sm`} />
                                    )}
                                    {errors.custom_jenis && <p className="text-red-500 text-xs mt-1">{errors.custom_jenis}</p>}
                                </div>
                            </div>
                            {/* Alamat (full width) */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{text.lblAlamat}</label>
                                <textarea value={form.alamat}
                                    onChange={e => setForm(p => ({ ...p, alamat: e.target.value }))}
                                    rows={2}
                                    className={`w-full px-3 py-2.5 rounded-xl border ${errors.alamat ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'} bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-indigo-500`} />
                                {errors.alamat && <p className="text-red-500 text-xs mt-1">{errors.alamat}</p>}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Nilai */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{text.lblNilai}</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">Rp</span>
                                        <input type="text" value={form.nilai ? formatCurrency(form.nilai) : ''}
                                            onChange={handleNilaiChange}
                                            className={`w-full pl-10 pr-3 py-2.5 rounded-xl border ${errors.nilai ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'} bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-indigo-500`} />
                                    </div>
                                    {errors.nilai && <p className="text-red-500 text-xs mt-1">{errors.nilai}</p>}
                                </div>
                                {/* No GL */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{text.lblNoGl}</label>
                                    <input type="text" value={form.no_gl}
                                        onChange={e => setForm(p => ({ ...p, no_gl: e.target.value }))}
                                        className={`w-full px-3 py-2.5 rounded-xl border ${errors.no_gl ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'} bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-indigo-500`} />
                                    {errors.no_gl && <p className="text-red-500 text-xs mt-1">{errors.no_gl}</p>}
                                </div>
                                {/* Jenis Usaha */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{text.lblJenisUsaha}</label>
                                    <select value={form.jenis_usaha}
                                        onChange={e => setForm(p => ({ ...p, jenis_usaha: e.target.value, custom_jenis_usaha: '' }))}
                                        className={`w-full px-3 py-2.5 rounded-xl border ${errors.jenis_usaha ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'} bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-indigo-500`}>
                                        <option value="">{isEnglish ? 'Select Business Type' : 'Pilih Jenis Usaha'}</option>
                                        {JENIS_USAHA_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
                                    </select>
                                    {errors.jenis_usaha && <p className="text-red-500 text-xs mt-1">{errors.jenis_usaha}</p>}
                                    {form.jenis_usaha === 'Custom' && (
                                        <input type="text" placeholder={text.customJenisUsahaPlaceholder} value={form.custom_jenis_usaha}
                                            onChange={e => setForm(p => ({ ...p, custom_jenis_usaha: e.target.value }))}
                                            className={`mt-2 w-full px-3 py-2 rounded-xl border ${errors.custom_jenis_usaha ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'} bg-white dark:bg-slate-700 text-sm`} />
                                    )}
                                    {errors.custom_jenis_usaha && <p className="text-red-500 text-xs mt-1">{errors.custom_jenis_usaha}</p>}
                                </div>
                            </div>
                            {/* Relasi + Jabatan + Perusahaan Group */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">{text.lblGroupRelasi}</label>
                                {form.groups.map((grp, idx) => (
                                    <div key={idx} className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-3 mb-3 border border-slate-200 dark:border-slate-600">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                            <div>
                                                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">{text.lblGroupNamaRelasi}</label>
                                                <input type="text" value={grp.relasi}
                                                    onChange={e => updateGroup(idx, 'relasi', e.target.value)}
                                                    placeholder={text.lblGroupRelasiPlaceholder.replace('{n}', idx + 1)}
                                                    className={`w-full px-3 py-2 rounded-lg border ${errors.groups ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'} bg-white dark:bg-slate-700 text-sm`} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">{text.lblGroupJabatan}</label>
                                                <input type="text" value={grp.jabatan}
                                                    onChange={e => updateGroup(idx, 'jabatan', e.target.value)}
                                                    placeholder={text.lblGroupJabatanPlaceholder.replace('{n}', idx + 1)}
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">{text.lblGroupPerusahaan}</label>
                                                <input type="text" value={grp.nama_perusahaan}
                                                    onChange={e => updateGroup(idx, 'nama_perusahaan', e.target.value)}
                                                    placeholder={text.lblGroupPerusahaanPlaceholder.replace('{n}', idx + 1)}
                                                    className={`w-full px-3 py-2 rounded-lg border ${errors.groups ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'} bg-white dark:bg-slate-700 text-sm`} />
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
                                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 text-sm font-semibold">
                                        <Plus size={14} /> {text.btnTambahGroupRelasi}
                                    </button>
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700">
                                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 uppercase tracking-wide">{text.lblJumlahRelasi}</span>
                                        <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-lg bg-indigo-600 text-white text-sm font-bold">
                                            {jumlahRelasi}
                                        </span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                            {text.fromJumlahGroup.replace('{n}', form.groups.length)}
                                        </span>
                                    </div>
                                </div>
                                {errors.groups && <p className="text-red-500 text-xs mt-1">{errors.groups}</p>}
                            </div>

                            {/* MOM/Result */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{text.lblMomResult}</label>
                                <textarea value={form.catatan_kode}
                                    onChange={e => setForm(p => ({ ...p, catatan_kode: e.target.value }))}
                                    rows={2}
                                    className={`w-full px-3 py-2.5 rounded-xl border ${errors.catatan_kode ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'} bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-indigo-500`} />
                                {errors.catatan_kode && <p className="text-red-500 text-xs mt-1">{errors.catatan_kode}</p>}
                            </div>

                            {/* Attachments */}
                            <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                    {text.lblLampiran} * {errors.attachments && <span className="text-red-500">- {errors.attachments}</span>}
                                </label>
                                <div
                                    ref={pasteZoneRef}
                                    tabIndex={0}
                                    onPaste={handlePaste}
                                    onFocus={e => e.currentTarget?.classList?.add('ring-2', 'ring-emerald-500')}
                                    onBlur={e => e.currentTarget?.classList?.remove('ring-2', 'ring-emerald-500')}
                                    className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center hover:border-emerald-500 transition-colors cursor-pointer outline-none"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload size={32} className="mx-auto text-slate-400 mb-2" />
                                    <p className="text-sm text-slate-500 dark:text-slate-400" dangerouslySetInnerHTML={{ __html: text.uploadPaste }} />
                                    <p className="text-xs text-slate-400 mt-1">{text.uploadSupport}</p>
                                    <input ref={fileInputRef} type="file" multiple
                                        onChange={handleFileChange}
                                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.txt,.csv"
                                        className="hidden" />
                                </div>

                                {/* Preview existing attachments */}
                                {existingAttachments.length > 0 && (
                                    <div className="mt-3">
                                        <p className="text-xs font-semibold text-slate-500 mb-2">{text.savedAttachments} ({existingAttachments.length}):</p>
                                        <div className="flex flex-wrap gap-2">
                                            {existingAttachments.map((att, idx) => (
                                                <div key={idx} className="relative group bg-slate-100 dark:bg-slate-700 rounded-lg p-2 flex items-center gap-2">
                                                    {att.mimetype?.startsWith('image/') ? (
                                                        <img src={att.url} alt={att.name} className="w-10 h-10 object-cover rounded" />
                                                    ) : (
                                                        <div className="w-10 h-10 flex items-center justify-center bg-slate-200 dark:bg-slate-600 rounded">
                                                            <FileText size={20} className="text-slate-500" />
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
                                        <p className="text-xs font-semibold text-slate-500 mb-2">{text.newAttachments} ({attachments.length}):</p>
                                        <div className="flex flex-wrap gap-2">
                                            {attachments.map((file, idx) => (
                                                <div key={idx} className="relative group bg-slate-100 dark:bg-slate-700 rounded-lg p-2 flex items-center gap-2">
                                                    {file.type?.startsWith('image/') ? (
                                                        <img src={URL.createObjectURL(file)} alt={file.name} className="w-10 h-10 object-cover rounded" />
                                                    ) : (
                                                        <div className="w-10 h-10 flex items-center justify-center bg-slate-200 dark:bg-slate-600 rounded">
                                                            <FileText size={20} className="text-slate-500" />
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
                            <div className="flex items-center gap-3 pt-2">
                                <button type="submit" disabled={submitting}
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl hover:from-indigo-500 hover:to-blue-500 transition-all shadow-lg font-semibold disabled:opacity-50">
                                    {submitting ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        <Save size={18} />
                                    )}
                                        {submitting ? (isEnglish ? 'Saving...' : 'Menyimpan...') : (editingId ? text.btnUpdate : text.btnSave)}
                                </button>
                                <button type="button" onClick={() => { resetForm(); setShowForm(false); }}
                                    className="px-6 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                    {text.btnCancel}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* Table */}
            <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200">
                        <ClipboardList size={18} className="inline-block mr-2" />
                        {isEnglish ? 'Entertainment Expenses List' : 'Daftar Entertainment Expenses'}
                        <span className="ml-2 text-sm font-normal text-slate-400">({totalEntries} {isEnglish ? 'entries' : 'data'})</span>
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-700/50 text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                                <th className="px-4 py-3 text-center w-32">{text.thAksi}</th>
                                <th className="px-4 py-3 text-left">{text.thTanggal}</th>
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
                                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">{text.loading}</td></tr>
                            ) : data.length === 0 ? (
                                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">{text.empty}</td></tr>
                            ) : data.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                    <td className="px-4 py-3">
                                        {tab === 'pending' ? (
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => handlePreview(item)}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title={text.preview}>
                                                    <Eye size={16} />
                                                </button>
                                                {userPerms.can_edit && (
                                                <button onClick={() => handleEdit(item)}
                                                    className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors" title={text.edit}>
                                                    <Edit3 size={16} />
                                                </button>
                                                )}
                                                {userPerms.can_settle && (
                                                <button onClick={() => handleSettle(item)}
                                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors" title={text.settle}>
                                                    <CheckCircle2 size={16} />
                                                </button>
                                                )}
                                                {userPerms.can_export && (
                                                <button type="button" onClick={async (ev) => {
                                                        ev.stopPropagation();
                                                        try { await entertainmentService.exportPdf(item.id); toast.success(text.pdfExportSuccess); }
                                                        catch (e) { toast.error(e.message || text.pdfExportFailed); }
                                                    }}
                                                    className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title={text.exportPdfBtn}>
                                                    <FileText size={16} />
                                                </button>
                                                )}
                                                {userPerms.can_delete && (
                                                <button type="button" onClick={() => handleDelete(item.id)}
                                                    className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title={text.deleteTitle}>
                                                    <Trash2 size={16} />
                                                </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => handlePreview(item)}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title={text.preview}>
                                                    <Eye size={16} />
                                                </button>
                                                {userPerms.can_export && (
                                                <button type="button" onClick={async (ev) => {
                                                        ev.stopPropagation();
                                                        try { await entertainmentService.exportPdf(item.id); toast.success(text.pdfExportSuccess); }
                                                        catch (e) { toast.error(e.message || text.pdfExportFailed); }
                                                    }}
                                                    className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title={text.exportPdfBtn}>
                                                    <FileText size={16} />
                                                </button>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">{item.tanggal}</td>
                                    <td className="px-4 py-3 font-mono text-xs">{item.no_ref || `ENT-${String(item.id).padStart(5, '0')}`}</td>
                                    <td className="px-4 py-3 max-w-[150px] truncate" title={(item.relasi || []).join(', ')}>
                                        {(item.relasi || []).join(', ') || '-'}
                                    </td>
                                    <td className="px-4 py-3 max-w-[120px] truncate" title={(item.nama_perusahaan || []).join(', ')}>
                                        {(item.nama_perusahaan || []).join(', ') || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono whitespace-nowrap">
                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(item.nilai)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-semibold">
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
                <div className="flex items-center justify-between px-6 py-3 bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        {text.pagination.replace('{page}', page).replace('{totalPages}', totalPages).replace('{totalEntries}', totalEntries)}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="px-3 py-1.5 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Previous
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                            .map((p, idx, arr) => (
                                <React.Fragment key={p}>
                                    {idx > 0 && arr[idx - 1] !== p - 1 && (
                                        <span className="px-1 text-slate-400">...</span>
                                    )}
                                    <button
                                        onClick={() => setPage(p)}
                                        className={`min-w-[36px] h-9 text-sm font-semibold rounded-lg transition-colors ${
                                            p === page
                                                ? 'bg-indigo-600 text-white shadow-md'
                                                : 'border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        {p}
                                    </button>
                                </React.Fragment>
                            ))}
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="px-3 py-1.5 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
            {/* Settle Modal */}
            {createPortal(
            <AnimatePresence>
                {showSettleModal && settleItem && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] pb-4 px-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
                        onClick={() => setShowSettleModal(false)}>
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col my-auto"
                            onClick={e => e.stopPropagation()}>
                            {/* Header - fixed at top */}
                            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 rounded-t-2xl flex items-center justify-between shrink-0">
                                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                    <CheckCircle2 size={20} /> {text.settleTitle}
                                </h3>
                                <button onClick={() => setShowSettleModal(false)}
                                    className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            {/* Body - scrollable */}
                            <div className="p-6 space-y-5 overflow-y-auto flex-1">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{text.detailTanggal}</label>
                                        <input type="date" value={settleForm.tanggal || ''}
                                            onChange={e => setSettleForm(p => ({ ...p, tanggal: e.target.value }))}
                                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-emerald-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{text.detailTempat}</label>
                                        <input type="text" value={settleForm.tempat || ''}
                                            onChange={e => setSettleForm(p => ({ ...p, tempat: e.target.value }))}
                                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-emerald-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{text.detailJenis}</label>
                                        <select value={settleForm.jenis || ''}
                                            onChange={e => setSettleForm(p => ({ ...p, jenis: e.target.value }))}
                                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-emerald-500">
                                            <option value="">{text.selectOption}</option>
                                            {JENIS_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
                                        </select>
                                        {settleForm.jenis === 'Custom' && (
                                            <input type="text" placeholder={isEnglish ? 'Custom type' : 'Custom jenis'} value={settleForm.custom_jenis || ''}
                                                onChange={e => setSettleForm(p => ({ ...p, custom_jenis: e.target.value }))}
                                                className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" />
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{text.detailAlamat}</label>
                                    <textarea value={settleForm.alamat || ''}
                                        onChange={e => setSettleForm(p => ({ ...p, alamat: e.target.value }))}
                                        rows={2}
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-emerald-500" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{text.lblNilai}</label>
                                        <input type="text" value={settleForm.nilai || ''}
                                            onChange={e => setSettleForm(p => ({ ...p, nilai: e.target.value }))}
                                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-emerald-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{text.lblNoGl}</label>
                                        <input type="text" value={settleForm.no_gl || ''}
                                            onChange={e => setSettleForm(p => ({ ...p, no_gl: e.target.value }))}
                                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-emerald-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{text.lblJenisUsaha}</label>
                                        <select value={settleForm.jenis_usaha || ''}
                                            onChange={e => setSettleForm(p => ({ ...p, jenis_usaha: e.target.value, custom_jenis_usaha: '' }))}
                                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-emerald-500">
                                            <option value="">{text.selectOption}</option>
                                            {JENIS_USAHA_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
                                        </select>
                                        {settleForm.jenis_usaha === 'Custom' && (
                                            <input type="text" placeholder={text.customJenisUsahaPlaceholder} value={settleForm.custom_jenis_usaha || ''}
                                                onChange={e => setSettleForm(p => ({ ...p, custom_jenis_usaha: e.target.value }))}
                                                className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" />
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">{text.lblRelasiPerusahaan}</label>
                                    {settleForm.groups && settleForm.groups.map((grp, idx) => (
                                        <div key={idx} className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-3 mb-3 border border-slate-200 dark:border-slate-600">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                                <input type="text" value={grp.relasi || ''}
                                                    onChange={e => {
                                                        const g = [...settleForm.groups];
                                                        g[idx] = { ...g[idx], relasi: e.target.value };
                                                        setSettleForm(p => ({ ...p, groups: g }));
                                                    }}
                                                    placeholder={text.placeholdRelasi}
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" />
                                                <input type="text" value={grp.jabatan || ''}
                                                    onChange={e => {
                                                        const g = [...settleForm.groups];
                                                        g[idx] = { ...g[idx], jabatan: e.target.value };
                                                        setSettleForm(p => ({ ...p, groups: g }));
                                                    }}
                                                    placeholder={text.placeholdJabatan}
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" />
                                                <div className="flex gap-1">
                                                    <input type="text" value={grp.nama_perusahaan || ''}
                                                        onChange={e => {
                                                            const g = [...settleForm.groups];
                                                            g[idx] = { ...g[idx], nama_perusahaan: e.target.value };
                                                            setSettleForm(p => ({ ...p, groups: g }));
                                                        }}
                                                        placeholder={text.placeholdPerusahaan}
                                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" />
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
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{text.lblMomResult}</label>
                                    <textarea value={settleForm.catatan_kode || ''}
                                        onChange={e => setSettleForm(p => ({ ...p, catatan_kode: e.target.value }))}
                                        rows={2}
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-emerald-500" />
                                </div>
                                {/* Tanggal Settle (required) */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                        {text.lblSettleDate}
                                    </label>
                                    <input type="date" value={settleForm.settle_date || ''}
                                        onChange={e => setSettleForm(p => ({ ...p, settle_date: e.target.value }))}
                                        className="w-full px-3 py-2.5 rounded-xl border border-emerald-400 dark:border-emerald-600 bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-emerald-500" />
                                </div>
                                {/* Lampiran */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{text.lblLampiran}</label>
                                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center hover:border-emerald-500 transition-colors cursor-pointer"
                                        onClick={() => settleFileInputRef.current?.click()}>
                                        <Upload size={24} className="mx-auto text-slate-400 mb-2" />
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{text.uploadAttachments}</p>
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
                                            <p className="text-xs font-semibold text-slate-500 mb-2">{text.savedAttachments} ({settleExistingAttachments.length}):</p>
                                            <div className="flex flex-wrap gap-2">
                                                {settleExistingAttachments.map((att, idx) => (
                                                    <div key={idx} className="relative group bg-slate-100 dark:bg-slate-700 rounded-lg p-2 flex items-center gap-2">
                                                        {att.mimetype?.startsWith('image/') ? (
                                                            <img src={att.url} alt={att.name} className="w-10 h-10 object-cover rounded" />
                                                        ) : (
                                                            <div className="w-10 h-10 flex items-center justify-center bg-slate-200 dark:bg-slate-600 rounded">
                                                                <FileText size={20} className="text-slate-500" />
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
                                            <p className="text-xs font-semibold text-slate-500 mb-2">{text.newAttachments} ({settleAttachments.length}):</p>
                                            <div className="flex flex-wrap gap-2">
                                                {settleAttachments.map((file, idx) => (
                                                    <div key={idx} className="relative group bg-slate-100 dark:bg-slate-700 rounded-lg p-2 flex items-center gap-2">
                                                        {file.type?.startsWith('image/') ? (
                                                            <img src={URL.createObjectURL(file)} alt={file.name} className="w-10 h-10 object-cover rounded" />
                                                        ) : (
                                                            <div className="w-10 h-10 flex items-center justify-center bg-slate-200 dark:bg-slate-600 rounded">
                                                                <FileText size={20} className="text-slate-500" />
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
                                <div className="flex items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
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
                                        className="px-6 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                        {text.btnBatal}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            , document.body)}
            {/* Preview Modal */}
            {createPortal(
            <AnimatePresence>
                {showPreview && previewData && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowPreview(false)}>
                        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                            onClick={e => e.stopPropagation()}>
                            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
                                <h3 className="text-white font-bold text-lg">{text.previewTitle}</h3>
                                <button onClick={() => setShowPreview(false)}
                                    className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <DetailField label={text.detailTanggal} value={previewData.tanggal} />
                                    <DetailField label={text.detailTempat} value={previewData.tempat} />
                                    <DetailField label={text.detailAlamat} value={previewData.alamat} />
                                    <DetailField label={text.detailJenis} value={previewData.jenis === 'Custom' ? previewData.custom_jenis : previewData.jenis} />
                                    <DetailField label={text.detailNilai} value={new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(previewData.nilai)} />
                                    <DetailField label={text.detailNoGl} value={previewData.no_gl} />
                                    <DetailField label={text.thNamaRelasi} value={(previewData.relasi || []).join(', ')} />
                                    <DetailField label={text.thJabatan} value={(previewData.jabatan || []).join(', ')} />
                                    <DetailField label={text.detailJumlahRelasi} value={`${previewData.jumlah_relasi || (previewData.relasi || []).length || 0} ${isEnglish ? 'person(s)' : 'orang'}`} />
                                    <DetailField label={text.detailPerusahaan} value={(previewData.nama_perusahaan || []).join(', ')} />
                                    <DetailField label={text.detailJenisUsaha} value={previewData.jenis_usaha} />
                                    <DetailField label={text.detailMomResult} value={previewData.catatan_kode} />
                                    <DetailField label={text.thPengaju} value={previewData.requester_name || previewData.requester_username} />
                                </div>
                                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                                    <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">{text.detailLampiran}:</h4>
                                    <div className="flex flex-wrap gap-3">
                                        {(previewData.attachments || []).length === 0 ? (
                                            <p className="text-sm text-slate-400">{text.noAttachment}</p>
                                        ) : previewData.attachments.map((att, idx) => (
                                            <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer"
                                                className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                                                {att.mimetype?.startsWith('image/') ? (
                                                    <img src={att.url} alt={att.name} className="w-8 h-8 object-cover rounded" />
                                                ) : (
                                                    <FileText size={20} className="text-slate-500" />
                                                )}
                                                <span className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[150px]">{att.name}</span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                                <div className="border-t border-slate-200 dark:border-slate-700 pt-4 flex items-center gap-3">
                                    <button type="button" onClick={async () => {
                                            try { await entertainmentService.exportPdf(previewData.id); toast.success(text.pdfExportSuccess); }
                                            catch (e) { toast.error(e.message || text.pdfExportFailed); }
                                        }}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors text-sm font-semibold">
                                        <FileText size={16} /> {text.exportPdfBtn}
                                    </button>
                                    <button type="button" onClick={async () => {
                                            try { await entertainmentService.exportExcel(previewData.id); toast.success(text.excelExportSuccess); }
                                            catch (e) { toast.error(e.message || text.excelExportFailed); }
                                        }}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors text-sm font-semibold">
                                        <FileSpreadsheet size={16} /> {text.exportExcelBtn}
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
            <label className="block text-xs font-semibold text-slate-400 dark:text-slate-500 mb-0.5">{label}</label>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{value || '-'}</p>
        </div>
    );
}
