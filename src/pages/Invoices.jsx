import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    Plus, FileText, Printer, CheckCircle2, XCircle, Clock, Upload,
    Trash2, Pencil, Search, RefreshCw, FileSignature, ImagePlus, Receipt,
    Landmark, Package, ShieldCheck, HandCoins
} from 'lucide-react';
import { invoiceService } from '../services/invoiceService';
import { API_URL } from '../services/apiClient';

function parseFlexNumber(val) {
    if (val === null || val === undefined) return 0;
    let s = String(val).trim().replace(/\s+/g, '');
    if (!s) return 0;
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    const lastSepPos = Math.max(lastDot, lastComma);
    let isDecimal = false;
    if (lastSepPos !== -1) {
        const after = s.slice(lastSepPos + 1);
        if (after.length >= 1 && after.length <= 2 && /^\d+$/.test(after)) isDecimal = true;
    }
    if (isDecimal) {
        s = s.slice(0, lastSepPos).replace(/[,.]/g, '') + '.' + s.slice(lastSepPos + 1);
    } else {
        s = s.replace(/[,.]/g, '');
    }
    return parseFloat(s) || 0;
}

const formatCurrency = (val) => {
    const num = parseFlexNumber(val);
    if (!num) return 'Rp 0';
    return 'Rp ' + num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const parseCurrency = (val) => {
    if (val === null || val === undefined) return '';
    const num = parseFlexNumber(val);
    return num === 0 ? '' : String(num);
};

const formatRupiahInput = (val) => {
    const s = String(val ?? '').trim();
    if (!s) return '';
    const num = parseFlexNumber(s);
    if (!num) return '';
    return num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const STATUS_MAP = {
    submitted: { label: 'Submitted', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' },
    proforma: { label: 'Proforma', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' },
    sent_back: { label: 'Sent Back', cls: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' },
    tax_requested: { label: 'Tax Requested', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400' },
    sent_back_tax: { label: 'Tax Sent Back', cls: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' },
    tax: { label: 'Faktur Pajak', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400' },
    settled: { label: 'Settled', cls: 'bg-slate-200 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400' },
};

const TIPE_MAP = {
    CBD: { label: 'CBD (Cash by Delivery)', desc: 'Uang masuk = total invoice (harus balance)' },
    PP: { label: 'PP (Partial Payment)', desc: 'Uang masuk sebagai DP, pelunasan menyusul' },
    PF: { label: 'PF (Performa First)', desc: 'Barang dikirim dulu, pembayaran menyusul' },
};

const PAGE_SIZE = 15;

const usePager = (total) => {
    const [page, setPage] = useState(1);
    const totalPages = Math.max(1, Math.ceil((total || 0) / PAGE_SIZE));
    useEffect(() => { setPage(1); }, [total]);
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return {
        page: safePage,
        totalPages,
        setPage,
        slice: (arr) => (Array.isArray(arr) ? arr.slice(start, start + PAGE_SIZE) : []),
    };
};

const Pagination = ({ page, totalPages, setPage }) => {
    if (totalPages <= 1) return null;
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) pages.push(i);
        else if (pages[pages.length - 1] !== '...') pages.push('...');
    }
    const btnCls = "min-w-8 h-8 px-2 flex items-center justify-center rounded-lg text-xs font-bold transition-all";
    return (
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-400">Halaman {page} dari {totalPages}</div>
            <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className={`${btnCls} text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed`}>«</button>
                {pages.map((p, i) => p === '...' ? (
                    <span key={`e${i}`} className="px-1 text-xs text-slate-400">…</span>
                ) : (
                    <button key={p} onClick={() => setPage(p)} className={`${btnCls} ${p === page ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{p}</button>
                ))}
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className={`${btnCls} text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed`}>»</button>
            </div>
        </div>
    );
};

const SearchAutocomplete = ({ value, options, labelKey, subKey, onSelect, className, placeholder }) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState(value || '');
    useEffect(() => { setQuery(value || ''); }, [value]);
    const q = query.trim().toLowerCase();
    const matches = q
        ? (options || []).filter(o => (o[labelKey] || '').toLowerCase().includes(q) || (o[subKey] || '').toLowerCase().includes(q))
        : (options || []);
    const select = (o) => {
        onSelect(o);
        setQuery(o[labelKey] || '');
        setOpen(false);
    };
    return (
        <div className="relative">
            <div className="relative">
                <input
                    className={className}
                    value={query}
                    placeholder={placeholder}
                    onChange={e => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && matches.length) { e.preventDefault(); select(matches[0]); }
                        else if (e.key === 'Escape') setOpen(false);
                    }}
                />
                <Search size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            {open && matches.length > 0 && (
                <div className="absolute z-30 mt-1 w-full max-h-52 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
                    {matches.slice(0, 50).map(o => (
                        <button
                            key={o.id}
                            type="button"
                            onMouseDown={e => { e.preventDefault(); select(o); }}
                            className="block w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-slate-800"
                        >
                            <div className="font-semibold text-xs text-slate-800 dark:text-white">{o[labelKey]}</div>
                            {o[subKey] && <div className="text-[10px] text-slate-400 truncate">{o[subKey]}</div>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const MoneyInput = ({ value, onChange, className, placeholder }) => {
    const [focused, setFocused] = useState(false);
    const [raw, setRaw] = useState('');
    useEffect(() => {
        if (!focused) setRaw(formatRupiahInput(value));
    }, [value, focused]);
    return (
        <input
            className={className}
            inputMode="decimal"
            placeholder={placeholder}
            value={focused ? raw : formatRupiahInput(value)}
            onFocus={() => { setFocused(true); setRaw(value == null || value === '' ? '' : String(value)); }}
            onChange={e => { setRaw(e.target.value); onChange(parseCurrency(e.target.value)); }}
            onBlur={() => { setFocused(false); onChange(parseCurrency(raw)); }}
        />
    );
};

const Invoices = ({ currentUser, hasPermission, toast }) => {
    const [tab, setTab] = useState('invoice');
    const [invoices, setInvoices] = useState([]);
    const [proformas, setProformas] = useState([]);
    const [dealers, setDealers] = useState([]);
    const [barang, setBarang] = useState([]);
    const [rules, setRules] = useState([]);
    const [perms, setPerms] = useState({ can_create: true, can_approve: true, can_tax: true, can_manage_master: true, can_settle: true, can_view: true });
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    // Masters state
    const [dealerForm, setDealerForm] = useState({ npwp: '', nama: '', alamat: '' });
    const [dealerEditId, setDealerEditId] = useState(null);
    const [barangForm, setBarangForm] = useState({ model: '', item_description: '', harga: '' });
    const [barangEditId, setBarangEditId] = useState(null);

    // New invoice modal
    const [showNewInvoice, setShowNewInvoice] = useState(false);
    const [invForm, setInvForm] = useState({
        dealer_id: '', no_po: '', tgl_po: '', tipe: 'CBD', tgl_transaksi: '',
        uang_masuk: '', tgl_uang_masuk: '', ppn_rate: 0.11, diskon: '', materai: '',
        pelunasan: '', ppn_custom: false, ppn_amount: '', total_invoice: '',
    });
    const [invError, setInvError] = useState(null);
    const [editInvoiceId, setEditInvoiceId] = useState(null);
    const totalTouchedRef = useRef(false);

    // Proforma modal
    const [showProforma, setShowProforma] = useState(false);
    const [proformaForm, setProformaForm] = useState({ invoice_ids: [], attachments: [] });
    const [proformaFiles, setProformaFiles] = useState([]);

    // Tax modal
    const [showTax, setShowTax] = useState(false);
    const [taxTarget, setTaxTarget] = useState(null);
    const [taxForm, setTaxForm] = useState({ faktur_pajak_no: '', file: null });

    // Tax request modal (ajukan ke bagian tax)
    const [showTaxRequest, setShowTaxRequest] = useState(false);
    const [taxRequestTarget, setTaxRequestTarget] = useState(null);
    const [taxRequestFiles, setTaxRequestFiles] = useState([]);
    const [taxRequestNotes, setTaxRequestNotes] = useState('');
    const taxRequestFileRef = useRef(null);

    // Settle modal
    const [showSettle, setShowSettle] = useState(false);
    const [settleTarget, setSettleTarget] = useState(null);
    const [settleForm, setSettleForm] = useState({ settled_amount: '', notes: '' });
    const [settleError, setSettleError] = useState(null);

    // Rule form
    const [ruleForm, setRuleForm] = useState({ target_type: 'user', target_value: '', can_create: true, can_approve: false, can_tax: false, can_manage_master: false, can_settle: false });
    const [ruleEditId, setRuleEditId] = useState(null);

    const [attachTarget, setAttachTarget] = useState(null);

    const fileInputRef = useRef(null);
    const taxFileRef = useRef(null);
    const dealerImportRef = useRef(null);
    const barangImportRef = useRef(null);
    const attachFileRef = useRef(null);

    const handleAddProformaAttachments = async (files) => {
        const pid = attachTarget;
        setAttachTarget(null);
        if (!pid || !files || !files.length) return;
        const fd = new FormData();
        [...files].forEach(f => fd.append('attachments', f));
        try {
            await invoiceService.addProformaAttachments(pid, fd);
            toast?.success?.('Lampiran proforma ditambahkan');
            loadAll();
        } catch (e) {
            toast?.error?.(e.message);
        }
    };

    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            const [inv, prof, dlr, brg, perm] = await Promise.all([
                invoiceService.getAll(),
                invoiceService.getProformas(),
                invoiceService.getDealers(),
                invoiceService.getBarang(),
                invoiceService.getPermissions().catch(() => ({})),
            ]);
            setInvoices(inv || []);
            setProformas(prof || []);
            setDealers(dlr || []);
            setBarang(brg || []);
            setPerms(perm || { can_create: true, can_approve: true, can_tax: true, can_manage_master: true, can_settle: true, can_view: true });
            if (perm?.can_manage_master) {
                invoiceService.getRules().then(setRules).catch(() => {});
            }
        } catch (e) {
            toast?.error?.('Gagal memuat data: ' + e.message);
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => { loadAll(); }, [loadAll]);

    const newBlankItem = () => ({ model: '', qty: 1 });
    const [invRows, setInvRows] = useState([newBlankItem()]);

    const openNewInvoice = () => {
        setEditInvoiceId(null);
        totalTouchedRef.current = false;
        setInvForm({
            dealer_id: '', no_po: '', tgl_po: '', tipe: 'CBD', tgl_transaksi: '',
            uang_masuk: '', tgl_uang_masuk: '', ppn_rate: 0.11, diskon: '', materai: '',
            pelunasan: '', ppn_custom: false, ppn_amount: '', total_invoice: '',
        });
        setInvRows([newBlankItem()]);
        setInvError(null);
        setShowNewInvoice(true);
    };

    const openEditInvoice = async (inv) => {
        setEditInvoiceId(inv.id);
        const ppnCustom = inv.ppn_custom === true || inv.ppn_custom === 'true' || inv.ppn_custom === 1 || inv.ppn_custom === '1';
        setInvForm({
            dealer_id: String(inv.dealer_id || ''),
            no_po: inv.no_po || '',
            tgl_po: inv.tgl_po ? String(inv.tgl_po).slice(0, 10) : '',
            tipe: inv.tipe || 'CBD',
            tgl_transaksi: inv.tgl_transaksi ? String(inv.tgl_transaksi).slice(0, 10) : '',
            uang_masuk: parseCurrency(inv.uang_masuk),
            tgl_uang_masuk: inv.tgl_uang_masuk ? String(inv.tgl_uang_masuk).slice(0, 10) : '',
            ppn_rate: ppnCustom
                ? (inv.ppn_rate != null && inv.ppn_rate !== '' ? Number(inv.ppn_rate) : 0.11)
                : (inv.ppn ? (inv.subtotal > 0 ? Math.round((parseFloat(inv.ppn) / parseFloat(inv.subtotal)) * 10000) / 100 : 0.11) : 0.11),
            diskon: parseCurrency(inv.diskon),
            materai: parseCurrency(inv.materai),
            pelunasan: inv.total_invoice != null && inv.uang_masuk != null ? parseCurrency(parseFloat(inv.total_invoice) - parseFloat(inv.uang_masuk)) : '',
            ppn_custom: ppnCustom,
            ppn_amount: ppnCustom ? parseCurrency(inv.ppn) : '',
            total_invoice: inv.total_invoice != null ? parseCurrency(inv.total_invoice) : '',
        });
        totalTouchedRef.current = true;
        setInvError(null);
        try {
            const detail = await invoiceService.getById(inv.id);
            const rows = (detail.items || []).map(it => ({
                model: it.model || '',
                qty: it.qty || 1,
                item_description: it.item_description || '',
                harga: parseCurrency(it.harga),
            }));
            setInvRows(rows.length ? rows : [newBlankItem()]);
        } catch (e) {
            toast?.error?.(e.message || 'Invoice tidak ditemukan');
            setInvoices(prev => (prev || []).filter(x => Number(x.id) !== Number(inv.id)));
            setShowNewInvoice(false);
            return;
        }
        setShowNewInvoice(true);
    };

    const onSelectModel = (rowIdx, model) => {
        const found = barang.find(b => b.model === model);
        setInvRows(prev => prev.map((r, i) => i === rowIdx ? {
            ...r, model,
            item_description: found?.item_description || '',
            harga: found ? parseCurrency(found.harga) : '',
        } : r));
    };

    const updateRow = (rowIdx, patch) => {
        setInvRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, ...patch } : r));
    };

    const addRow = () => setInvRows(prev => [...prev, newBlankItem()]);
    const removeRow = (rowIdx) => setInvRows(prev => prev.length > 1 ? prev.filter((_, i) => i !== rowIdx) : prev);

    const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;
    const subtotalAll = useMemo(() =>
        round2(invRows.reduce((s, r) => s + ((parseFloat(r.harga) || 0) * (parseInt(r.qty) || 0)), 0)), [invRows]);
    const ppnVal = invForm.ppn_custom
        ? round2(invForm.ppn_amount)
        : Math.round(subtotalAll * (parseFloat(invForm.ppn_rate) || 0.11) * 100) / 100;
    const diskonVal = round2(invForm.diskon);
    const materaiVal = round2(invForm.materai);
    const computedTotal = round2(subtotalAll + ppnVal - diskonVal + materaiVal);
    const totalInvoice = invForm.total_invoice !== '' && invForm.total_invoice != null
        ? round2(invForm.total_invoice)
        : computedTotal;

    useEffect(() => {
        if (!totalTouchedRef.current) {
            setInvForm(prev => ({ ...prev, total_invoice: parseCurrency(computedTotal) }));
        }
    }, [computedTotal]);

    const handleCreateInvoice = async () => {
        setInvError(null);
        const validRows = invRows.filter(r => r.model && (parseInt(r.qty) || 0) > 0);
        if (!invForm.dealer_id) return setInvError('Dealer wajib diisi');
        if (!invForm.no_po) return setInvError('No. PO wajib diisi');
        if (!invForm.tgl_po) return setInvError('Tgl. PO wajib diisi');
        if (!invForm.tgl_transaksi) return setInvError('Tgl. Transaksi wajib diisi');
        if (!invRows.length || !invRows.some(r => r.model)) return setInvError('Minimal satu barang dengan model terisi');
        if (invRows.some(r => r.model && !(parseInt(r.qty) > 0))) return setInvError('Qty semua barang harus lebih dari 0');
        if (invRows.some(r => r.model && !(parseFloat(r.harga) > 0))) return setInvError('Harga semua barang harus lebih dari 0');
        if (!(totalInvoice > 0)) return setInvError('Total invoice wajib diisi dan lebih dari 0');

        const uangMasuk = parseFloat(invForm.uang_masuk) || 0;
        if (invForm.tipe !== 'PF') {
            if (!(uangMasuk > 0)) return setInvError('Uang masuk wajib diisi untuk tipe ini');
            if (!invForm.tgl_uang_masuk) return setInvError('Tgl. Uang Masuk wajib diisi');
        }
        if (invForm.tipe === 'CBD' && Math.abs(uangMasuk - totalInvoice) > 0.01) {
            return setInvError(`CBD harus balance: Uang masuk harus sama dengan total (${formatCurrency(totalInvoice)}). Saat ini ${formatCurrency(uangMasuk)}`);
        }
        if (invForm.tipe === 'PP') {
            const pelunasan = parseFloat(invForm.pelunasan) || 0;
            if (!(uangMasuk < totalInvoice)) return setInvError('Uang masuk (DP) harus lebih kecil dari total invoice');
            if (!(pelunasan > 0)) return setInvError('Pelunasan wajib diisi untuk tipe PP');
            if (Math.abs(uangMasuk + pelunasan - totalInvoice) > 0.01) {
                return setInvError(`DP + Pelunasan harus sama dengan total invoice (${formatCurrency(totalInvoice)}). Saat ini ${formatCurrency(uangMasuk + pelunasan)}`);
            }
        }

        const dealer = dealers.find(d => Number(d.id) === Number(invForm.dealer_id));
        const payload = {
            dealer_id: invForm.dealer_id,
            dealer_name: dealer?.nama,
            dealer_npwp: dealer?.npwp,
            dealer_alamat: dealer?.alamat,
            no_po: invForm.no_po,
            tgl_po: invForm.tgl_po || null,
            tipe: invForm.tipe,
            tgl_transaksi: invForm.tgl_transaksi || null,
            uang_masuk: uangMasuk,
            tgl_uang_masuk: invForm.tgl_uang_masuk || null,
            ppn_rate: parseFloat(invForm.ppn_rate) || 0.11,
            ppn_custom: !!invForm.ppn_custom,
            ppn_amount: invForm.ppn_custom ? ppnVal : null,
            total_invoice: totalInvoice,
            diskon: diskonVal,
            materai: materaiVal,
            items: validRows.map(r => ({
                model: r.model,
                item_description: r.item_description || '',
                harga: parseFloat(r.harga) || 0,
                qty: parseInt(r.qty) || 1,
            })),
        };
        try {
            if (editInvoiceId) {
                await invoiceService.update(editInvoiceId, payload);
                toast?.success?.('Invoice diperbarui');
            } else {
                await invoiceService.create(payload);
                toast?.success?.('Invoice berhasil dibuat');
            }
            setShowNewInvoice(false);
            loadAll();
        } catch (e) {
            setInvError(e.message);
        }
    };

    const handleNewProforma = async () => {
        if (!proformaForm.invoice_ids.length) return toast?.error?.('Pilih minimal satu invoice');
        if (!proformaFiles.length) return toast?.error?.('Lampiran wajib diunggah');
        const fd = new FormData();
        fd.append('invoice_ids', JSON.stringify(proformaForm.invoice_ids.map(Number)));
        proformaFiles.forEach(f => fd.append('attachments', f));
        try {
            await invoiceService.submitProforma(fd);
            toast?.success?.('Proforma diajukan, menunggu approval accounting');
            setShowProforma(false);
            setProformaForm({ invoice_ids: [], attachments: [] });
            setProformaFiles([]);
            loadAll();
        } catch (e) {
            toast?.error?.(e.message);
        }
    };

    const handleApprove = async (id) => {
        try {
            const row = await invoiceService.approveProforma(id);
            toast?.success?.(`Disetujui. No Proforma: ${row.proforma_no}`);
            loadAll();
        } catch (e) {
            toast?.error?.(e.message);
        }
    };

    const handleReject = async (id) => {
        const notes = window.prompt('Alasan penolakan (opsional):') ?? '';
        try {
            await invoiceService.rejectProforma(id, notes);
            toast?.success?.('Proforma ditolak');
            loadAll();
        } catch (e) {
            toast?.error?.(e.message);
        }
    };

    const openSettle = (p) => {
        setSettleTarget(p);
        setSettleForm({ settled_amount: parseCurrency(p.total_nominal), notes: '' });
        setSettleError(null);
        setShowSettle(true);
    };

    const handleSettle = async () => {
        setSettleError(null);
        const amount = parseFloat(settleForm.settled_amount) || 0;
        const total = parseFloat(settleTarget?.total_nominal) || 0;
        if (!(amount > 0)) return setSettleError('Nominal settle wajib diisi');
        if (Math.abs(amount - total) > 0.01) {
            return setSettleError(`Nominal harus balance dengan total proforma (${formatCurrency(total)}). Saat ini ${formatCurrency(amount)}`);
        }
        try {
            await invoiceService.settleProforma(settleTarget.id, { settled_amount: amount, notes: settleForm.notes });
            toast?.success?.(`Proforma ${settleTarget.proforma_no} telah di-settle`);
            setShowSettle(false);
            loadAll();
        } catch (e) {
            setSettleError(e.message);
        }
    };

    const saveRule = async () => {
        if (!ruleForm.target_value.trim()) return toast?.error?.('Nilai target wajib diisi');
        try {
            if (ruleEditId) {
                await invoiceService.updateRule(ruleEditId, ruleForm);
                toast?.success?.('Invoice diperbarui');
            } else {
                await invoiceService.createRule(ruleForm);
                toast?.success?.('Rule ditambahkan');
            }
            setRuleEditId(null);
            setRuleForm({ target_type: 'user', target_value: '', can_create: true, can_approve: false, can_tax: false, can_manage_master: false, can_settle: false });
            loadAll();
        } catch (e) {
            toast?.error?.(e.message);
        }
    };

    const editRule = (r) => {
        setRuleEditId(r.id);
        setRuleForm({
            target_type: r.target_type,
            target_value: r.target_value,
            can_create: !!r.can_create,
            can_approve: !!r.can_approve,
            can_tax: !!r.can_tax,
            can_manage_master: !!r.can_manage_master,
            can_settle: !!r.can_settle,
        });
    };

    const deleteRule = async (r) => {
        if (!window.confirm('Hapus rule ini?')) return;
        try {
            await invoiceService.deleteRule(r.id);
            toast?.success?.('Rule dihapus');
            loadAll();
        } catch (e) {
            toast?.error?.(e.message);
        }
    };

    const openTax = (inv) => {
        setTaxTarget(inv);
        setTaxForm({ faktur_pajak_no: inv.faktur_pajak_no || '', file: null });
        setShowTax(true);
    };

    const handleTax = async () => {
        if (!taxTarget) return;
        const fd = new FormData();
        fd.append('faktur_pajak_no', taxForm.faktur_pajak_no);
        if (taxForm.file) fd.append('faktur_pajak', taxForm.file);
        try {
            await invoiceService.submitTax(taxTarget.id, fd);
            toast?.success?.('Faktur pajak tersimpan');
            setShowTax(false);
            loadAll();
        } catch (e) {
            toast?.error?.(e.message);
        }
    };

    const handleSubmitTax = async (invId) => {
        if (!taxRequestFiles.length) return toast?.error?.('Lampiran wajib diunggah');
        const fd = new FormData();
        taxRequestFiles.forEach(f => fd.append('attachments', f));
        fd.append('notes', taxRequestNotes);
        try {
            await invoiceService.submitTaxRequest(invId, fd);
            toast?.success?.('Faktur pajak diajukan ke bagian tax');
            setShowTaxRequest(false);
            setTaxRequestFiles([]);
            setTaxRequestNotes('');
            setTaxRequestTarget(null);
            loadAll();
        } catch (e) {
            toast?.error?.(e.message);
        }
    };

    const openTaxRequest = (inv) => {
        setTaxRequestTarget(inv);
        setTaxRequestFiles([]);
        setTaxRequestNotes('');
        setShowTaxRequest(true);
    };

    const handleSendbackProforma = async (id) => {
        const notes = window.prompt('Alasan sendback (kembali ke requester):') ?? '';
        if (!notes.trim()) return;
        try {
            await invoiceService.sendbackProforma(id, notes);
            toast?.success?.('Proforma dikembalikan ke requester');
            loadAll();
        } catch (e) {
            toast?.error?.(e.message);
        }
    };

    const handleSendbackTax = async (id) => {
        const notes = window.prompt('Alasan sendback (kembali ke requester):') ?? '';
        if (!notes.trim()) return;
        try {
            await invoiceService.sendbackTax(id, notes);
            toast?.success?.('Tax request dikembalikan ke requester');
            loadAll();
        } catch (e) {
            toast?.error?.(e.message);
        }
    };

    // ── Detail modal ──
    const [showDetail, setShowDetail] = useState(false);
    const [detailTarget, setDetailTarget] = useState(null);

    const openDetail = (target) => {
        setDetailTarget(target);
        setShowDetail(true);
    };

    // ── Master Dealer handlers ──
    const saveDealer = async () => {
        if (!/^\d{16}$/.test(String(dealerForm.npwp).trim())) return toast?.error?.('NPWP harus 16 digit angka');
        if (!dealerForm.nama.trim()) return toast?.error?.('Nama dealer wajib diisi');
        try {
            if (dealerEditId) {
                await invoiceService.updateDealer(dealerEditId, dealerForm);
                toast?.success?.('Dealer diperbarui');
            } else {
                await invoiceService.createDealer(dealerForm);
                toast?.success?.('Dealer ditambahkan');
            }
            setDealerForm({ npwp: '', nama: '', alamat: '' });
            setDealerEditId(null);
            loadAll();
        } catch (e) {
            toast?.error?.(e.message);
        }
    };

    const editDealer = (d) => {
        setDealerEditId(d.id);
        setDealerForm({ npwp: d.npwp, nama: d.nama, alamat: d.alamat || '' });
    };

    const deleteDealer = async (d) => {
        if (!window.confirm(`Hapus dealer ${d.nama}?`)) return;
        try {
            await invoiceService.deleteDealer(d.id);
            toast?.success?.('Dealer dihapus');
            loadAll();
        } catch (e) {
            toast?.error?.(e.message);
        }
    };

    const handleDealerImport = async (file) => {
        if (!file) return;
        try {
            const res = await invoiceService.importDealers(file);
            const msg = `Import selesai: ${res.inserted} masuk, ${res.skipped} duplikat${res.errors.length ? `, ${res.errors.length} error` : ''}`;
            if (res.errors.length) {
                toast?.warning?.(msg);
                console.warn('Import errors:', res.errors);
                alert(`Error:\n${res.errors.join('\n')}`);
            } else {
                toast?.success?.(msg);
            }
            loadAll();
        } catch (e) {
            toast?.error?.(e.message);
        }
    };

    const handleBarangImport = async (file) => {
        if (!file) return;
        try {
            const res = await invoiceService.importBarang(file);
            const msg = `Import selesai: ${res.inserted} masuk, ${res.skipped} duplikat${res.errors.length ? `, ${res.errors.length} error` : ''}`;
            if (res.errors.length) {
                toast?.warning?.(msg);
                console.warn('Import errors:', res.errors);
                alert(`Error:\n${res.errors.join('\n')}`);
            } else {
                toast?.success?.(msg);
            }
            loadAll();
        } catch (e) {
            toast?.error?.(e.message);
        }
    };

    // ── Master Barang handlers ──
    const saveBarang = async () => {
        if (!barangForm.model.trim()) return toast?.error?.('Model wajib diisi');
        try {
            if (barangEditId) {
                await invoiceService.updateBarang(barangEditId, barangForm);
                toast?.success?.('Barang diperbarui');
            } else {
                await invoiceService.createBarang(barangForm);
                toast?.success?.('Barang ditambahkan');
            }
            setBarangForm({ model: '', item_description: '', harga: '' });
            setBarangEditId(null);
            loadAll();
        } catch (e) {
            toast?.error?.(e.message);
        }
    };

    const editBarang = (b) => {
        setBarangEditId(b.id);
        setBarangForm({ model: b.model, item_description: b.item_description || '', harga: parseCurrency(b.harga) });
    };

    const deleteBarang = async (b) => {
        if (!window.confirm(`Hapus barang ${b.model}?`)) return;
        try {
            await invoiceService.deleteBarang(b.id);
            toast?.success?.('Barang dihapus');
            loadAll();
        } catch (e) {
            toast?.error?.(e.message);
        }
    };

    const filteredInvoices = useMemo(() => {
        if (!search.trim()) return invoices;
        const q = search.toLowerCase();
        return invoices.filter(i =>
            String(i.dealer_name || '').toLowerCase().includes(q) ||
            String(i.no_po || '').toLowerCase().includes(q) ||
            String(i.proforma_no || '').toLowerCase().includes(q) ||
            String(i.id).includes(q)
        );
    }, [invoices, search]);

    const submittedInvoices = useMemo(() => invoices.filter(i => i.status === 'submitted'), [invoices]);

    const proformaInvoiceIds = useMemo(() => {
        const s = new Set();
        (proformas || []).forEach(p => {
            (p.invoices || []).forEach(inv => s.add(Number(inv.id)));
        });
        return s;
    }, [proformas]);

    const proformaApprovedInvoiceIds = useMemo(() => {
        const s = new Set();
        (proformas || []).filter(p => p.status === 'approved').forEach(p => {
            (p.invoices || []).forEach(inv => s.add(Number(inv.id)));
        });
        return s;
    }, [proformas]);

    const pagedInvoices = usePager(filteredInvoices.length);
    const pagedProformas = usePager(proformas.length);
    const taxItems = useMemo(() => proformas.filter(p => p.status === 'approved' && (p.invoices || []).some(inv => inv.status === 'tax_requested')), [proformas]);
    const taxRequestedInvoices = useMemo(() => {
        const s = new Set();
        (proformas || []).forEach(p => {
            (p.invoices || []).forEach(inv => {
                if (inv.status === 'tax_requested') s.add(Number(inv.id));
            });
        });
        return s;
    }, [proformas]);
    const taxDoneInvoiceIds = useMemo(() => {
        const s = new Set();
        (proformas || []).forEach(p => {
            (p.invoices || []).forEach(inv => {
                if (inv.status === 'tax' || inv.status === 'settled') s.add(Number(inv.id));
            });
        });
        return s;
    }, [proformas]);
    const pagedTax = usePager(taxItems.length);
    const pagedDealers = usePager(dealers.length);
    const pagedBarang = usePager(barang.length);
    const pagedRules = usePager(rules.length);

    const renderTabBtn = (id, icon, label) => (
        <button
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
            {icon}{label}
        </button>
    );

    const inputCls = "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500";

    return (
        <div className="p-4 md:p-6 space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-1.5 flex-wrap">
                    {renderTabBtn('invoice', <Receipt size={16} />, 'Invoices')}
                    {renderTabBtn('proforma', <FileSignature size={16} />, 'Proforma')}
                    {renderTabBtn('tax', <FileText size={16} />, 'Tax')}
                    {renderTabBtn('dealer', <Landmark size={16} />, 'Master Dealer')}
                    {renderTabBtn('barang', <Package size={16} />, 'Master Barang')}
                    {renderTabBtn('rule', <ShieldCheck size={16} />, 'Rule')}
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Cari invoice..."
                            className="pl-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
                        />
                    </div>
                    {tab === 'invoice' && perms.can_create && (
                        <button
                            onClick={openNewInvoice}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-lg shadow-emerald-500/25 transition-all"
                        >
                            <Plus size={16} /> New Invoice
                        </button>
                    )}
                    <button onClick={loadAll} className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all" title="Refresh">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* ── Invoice List Tab ── */}
            {tab === 'invoice' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                    <th className="px-4 py-3">#</th>
                                    <th className="px-4 py-3">Dealer</th>
                                    <th className="px-4 py-3">No. PO</th>
                                    <th className="px-4 py-3">Tipe</th>
                                    <th className="px-4 py-3">Tgl Transaksi</th>
                                    <th className="px-4 py-3 text-right">Total</th>
                                    <th className="px-4 py-3 text-right">Uang Masuk</th>
                                    <th className="px-4 py-3">No Proforma</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredInvoices.length === 0 && (
                                    <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400">Belum ada invoice</td></tr>
                                )}
                                {pagedInvoices.slice(filteredInvoices).map(inv => (
                                    <tr key={inv.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                        <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">#{inv.id}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-semibold text-slate-800 dark:text-white">{inv.dealer_name || '-'}</div>
                                            <div className="text-[10px] text-slate-400">NPWP: {inv.dealer_npwp || '-'}</div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{inv.no_po || '-'}</td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">{inv.tipe}</span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{inv.tgl_transaksi || '-'}</td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-white">{formatCurrency(inv.total_invoice)}</td>
                                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{formatCurrency(inv.uang_masuk)}</td>
                                        <td className="px-4 py-3 text-indigo-600 dark:text-indigo-400 font-semibold text-xs">{inv.proforma_no || '-'}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-block whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] font-bold leading-tight ${STATUS_MAP[inv.status]?.cls || ''}`}>
                                                {STATUS_MAP[inv.status]?.label || inv.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => openDetail(inv)} className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800" title="Detail">
                                                    <FileText size={15} />
                                                </button>
                                                <button onClick={() => invoiceService.exportPdf(inv.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800" title="Print PDF">
                                                    <Printer size={15} />
                                                </button>
                                                {inv.status === 'proforma' && perms.can_tax && proformaApprovedInvoiceIds.has(Number(inv.id)) && !taxRequestedInvoices.has(Number(inv.id)) && !taxDoneInvoiceIds.has(Number(inv.id)) && (
                                                    <button onClick={() => openTaxRequest(inv)} className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-slate-800" title="Ajukan Faktur Pajak">
                                                        <Upload size={15} />
                                                    </button>
                                                )}
                                                {inv.status === 'submitted' && (
                                                    <>
                                                        {perms.can_create && !proformaInvoiceIds.has(Number(inv.id)) && (
                                                            <button onClick={() => { setProformaForm({ invoice_ids: [inv.id], attachments: [] }); setProformaFiles([]); setShowProforma(true); }} className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800" title="Ajukan Proforma">
                                                                <FileSignature size={15} />
                                                            </button>
                                                        )}
                                                        <button onClick={() => openEditInvoice(inv)} className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800" title="Edit">
                                                            <Pencil size={15} />
                                                        </button>
                                                        <button onClick={async () => {
                                                            if (!window.confirm(`Hapus invoice #${inv.id}?`)) return;
                                                            try { await invoiceService.delete(inv.id); toast?.success?.('Invoice dihapus'); loadAll(); } catch (e) { toast?.error?.(e.message); }
                                                        }} className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800" title="Hapus">
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pagination page={pagedInvoices.page} totalPages={pagedInvoices.totalPages} setPage={pagedInvoices.setPage} />
                </div>
            )}

            {/* ── Proforma List Tab ── */}
            {tab === 'proforma' && (
                <div className="grid grid-cols-1 gap-4">
                    {proformas.length === 0 && (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center text-slate-400 border border-slate-100 dark:border-slate-800">
                            Belum ada pengajuan proforma
                        </div>
                    )}
                    {pagedProformas.slice(proformas).map(p => (
                        <div key={p.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className={`p-3 rounded-2xl ${p.status === 'approved' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                                        : p.status === 'rejected' ? 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400'
                                        : 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                                        {p.status === 'approved' ? <CheckCircle2 size={20} /> : p.status === 'rejected' ? <XCircle size={20} /> : <Clock size={20} />}
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800 dark:text-white">
                                            {p.proforma_no || 'Menunggu No Proforma'}
                                        </div>
                                        <div className="text-xs text-slate-400">
                                            Diajukan: {p.requested_by || '-'} • {p.requested_at ? new Date(p.requested_at).toLocaleString('id-ID') : '-'}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => openDetail(p.invoices?.[0] || { id: p.id })} className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800" title="Detail">
                                        <FileText size={15} />
                                    </button>
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${p.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                                        : p.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                                        {p.status.toUpperCase()}
                                    </span>
                                    <div className="text-right">
                                        <div className="text-[10px] text-slate-400 uppercase">Total</div>
                                        <div className="font-bold text-slate-800 dark:text-white">{formatCurrency(p.total_nominal)}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {(p.invoices || []).map(inv => {
                                    const invStatus = inv.status || 'proforma';
                                    const isTaxDone = invStatus === 'tax' || invStatus === 'settled';
                                    return (
                                        <div key={inv.id} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 min-w-[180px]">
                                            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">#{inv.id} • {inv.dealer_name}</div>
                                            <div className="text-[10px] text-slate-400">{inv.no_po} • {formatCurrency(inv.total_invoice)}</div>
                                            <div className="flex items-center gap-1.5 mt-1.5">
                                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${isTaxDone ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                                                    {isTaxDone ? '✓ Faktur Pajak' : 'Faktur Pajak'}
                                                </span>
                                                {isTaxDone && inv.faktur_pajak_no && (
                                                    <span className="ml-auto text-[10px] text-violet-500 truncate max-w-[80px]" title={inv.faktur_pajak_no}>{inv.faktur_pajak_no}</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {p.attachments && parseJsonArray(p.attachments).length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {parseJsonArray(p.attachments).map(f => (
                                        <a key={f} href={`${API_URL}/invoices/files/${f}`} target="_blank" rel="noreferrer"
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs hover:bg-blue-100 dark:hover:bg-blue-500/20">
                                            <ImagePlus size={14} /> {f.length > 30 ? f.slice(0, 30) + '…' : f}
                                        </a>
                                    ))}
                                </div>
                            )}

                            {p.status === 'pending' && perms.can_approve && (
                                <div className="flex items-center gap-2 pt-2">
                                    <button onClick={() => handleApprove(p.id)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold">
                                        <CheckCircle2 size={15} /> Approve & No Proforma
                                    </button>
                                    <button onClick={() => handleSendbackProforma(p.id)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-sm font-semibold">
                                        <RefreshCw size={15} /> Sendback
                                    </button>
                                    <button onClick={() => handleReject(p.id)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 hover:bg-red-100 dark:hover:bg-red-500/20 text-sm font-semibold">
                                        <XCircle size={15} /> Reject
                                    </button>
                                </div>
                            )}
                            {p.status === 'approved' && perms.can_settle && (
                                <div className="flex items-center gap-2 pt-2">
                                    <button onClick={() => openSettle(p)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold">
                                        <HandCoins size={15} /> Settle Proforma
                                    </button>
                                </div>
                            )}
                            {p.status !== 'pending' && (
                                <div className="text-xs text-slate-400 space-y-0.5">
                                    {p.approved_by && <div>Disetujui oleh: {p.approved_by} • {p.approved_at ? new Date(p.approved_at).toLocaleString('id-ID') : ''}</div>}
                                    {p.status === 'settled' && p.settled_by && <div className="text-teal-600 dark:text-teal-400">Settled oleh: {p.settled_by} • {p.settled_at ? new Date(p.settled_at).toLocaleString('id-ID') : ''} • Nominal: {formatCurrency(p.settled_amount)}</div>}
                                    {p.sendback_notes && <div className="text-amber-600 dark:text-amber-400">Sendback: {p.sendback_notes}</div>}
                                    {p.notes && <div className="text-red-500">Catatan: {p.notes}</div>}
                                </div>
                            )}
                        </div>
                    ))}
                    <Pagination page={pagedProformas.page} totalPages={pagedProformas.totalPages} setPage={pagedProformas.setPage} />
                </div>
            )}

            {/* ── Tax Tab ── */}
            {tab === 'tax' && (
                <div className="space-y-4">
                    {taxItems.length === 0 && (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center text-slate-400 border border-slate-100 dark:border-slate-800">
                            Belum ada proforma yang perlu approval tax
                        </div>
                    )}
                    {pagedTax.slice(taxItems).map(p => (
                        <div key={p.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
                                        <FileText size={20} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800 dark:text-white">
                                            {p.proforma_no || 'Proforma #' + p.id}
                                        </div>
                                        <div className="text-xs text-slate-400">
                                            Diajukan: {p.requested_by || '-'} • {p.requested_at ? new Date(p.requested_at).toLocaleString('id-ID') : '-'}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => openDetail(p.invoices?.[0] || { id: p.id })} className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800" title="Detail">
                                        <FileText size={15} />
                                    </button>
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                                        {p.proforma_no || 'No Proforma'}
                                    </span>
                                </div>
                            </div>

                            {/* Invoices in this proforma */}
                            <div className="flex flex-wrap gap-2">
                                {(p.invoices || []).map(inv => {
                                    const invStatus = inv.status || 'proforma';
                                    const isTaxDone = invStatus === 'tax' || invStatus === 'settled';
                                    return (
                                        <div key={inv.id} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 min-w-[200px] flex-1">
                                            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">#{inv.id} • {inv.dealer_name}</div>
                                            <div className="text-[10px] text-slate-400">{inv.no_po} • {formatCurrency(inv.total_invoice)}</div>
                                            <div className="flex items-center gap-1.5 mt-1.5">
                                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${isTaxDone ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                                                    {isTaxDone ? '✓ Faktur Pajak' : 'Belum Faktur Pajak'}
                                                </span>
                                                {isTaxDone && inv.faktur_pajak_no && (
                                                    <span className="ml-auto text-[10px] text-violet-500 truncate max-w-[100px]" title={inv.faktur_pajak_no}>{inv.faktur_pajak_no}</span>
                                                )}
                                                {!isTaxDone && perms.can_tax && (
                                                    <>
                                                        <button onClick={() => openTax(inv)} className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold">
                                                            <FileText size={12} /> Lampirkan Faktur
                                                        </button>
                                                        <button onClick={() => handleSendbackTax(inv.id)} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 hover:bg-amber-100 text-xs font-semibold" title="Sendback ke requester">
                                                            <RefreshCw size={12} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Tax info & attachments */}
                            {(p.invoices || []).filter(inv => parseJsonArray(inv.tax_request_attachments).length > 0).length > 0 && (
                                <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lampiran Tax Request</div>
                                    {(p.invoices || []).filter(inv => parseJsonArray(inv.tax_request_attachments).length > 0).map(inv => (
                                        <div key={inv.id} className="flex flex-wrap items-center gap-2">
                                            <span className="text-xs text-slate-500">#{inv.id}:</span>
                                            {parseJsonArray(inv.tax_request_attachments).map(f => (
                                                <a key={f} href={`${API_URL}/invoices/files/${f}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs hover:bg-orange-100">
                                                    <ImagePlus size={14} /> {f.length > 30 ? f.slice(0, 30) + '...' : f}
                                                </a>
                                            ))}
                                            {inv.tax_request_notes && <span className="text-[10px] text-red-500">Catatan: {inv.tax_request_notes}</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {p.notes && (
                                <div className="text-xs text-red-500">Catatan: {p.notes}</div>
                            )}
                        </div>
                    ))}
                    <Pagination page={pagedTax.page} totalPages={pagedTax.totalPages} setPage={pagedTax.setPage} />
                </div>
            )}

            {/* ── Master Dealer Tab ── */}
            {tab === 'dealer' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 space-y-3 h-fit">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="font-bold text-slate-800 dark:text-white">{dealerEditId ? 'Edit Dealer' : 'Tambah Dealer'}</h3>
                            <div className="flex items-center gap-1">
                                <button onClick={() => invoiceService.downloadDealerTemplate().catch(e => toast?.error?.(e.message))} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700" title="Download Template">
                                    <FileText size={12} /> Template
                                </button>
                                <input ref={dealerImportRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { if (e.target.files[0]) handleDealerImport(e.target.files[0]); e.target.value = ''; }} />
                                <button onClick={() => dealerImportRef.current?.click()} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold hover:bg-emerald-100 dark:hover:bg-emerald-500/20" title="Import Data Excel">
                                    <Upload size={12} /> Import
                                </button>
                            </div>
                        </div>
                        <input className={inputCls} placeholder="NPWP (16 digit)" value={dealerForm.npwp} onChange={e => setDealerForm({ ...dealerForm, npwp: e.target.value.replace(/\D/g, '').slice(0, 16) })} />
                        <input className={inputCls} placeholder="Nama Dealer" value={dealerForm.nama} onChange={e => setDealerForm({ ...dealerForm, nama: e.target.value })} />
                        <textarea className={inputCls} placeholder="Alamat" rows={2} value={dealerForm.alamat} onChange={e => setDealerForm({ ...dealerForm, alamat: e.target.value })} />
                        <div className="flex gap-2">
                            <button onClick={saveDealer} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold">
                                <Plus size={15} /> {dealerEditId ? 'Update' : 'Simpan'}
                            </button>
                            {dealerEditId && (
                                <button onClick={() => { setDealerEditId(null); setDealerForm({ npwp: '', nama: '', alamat: '' }); }} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-semibold">
                                    Batal
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                        <th className="px-4 py-3">NPWP</th>
                                        <th className="px-4 py-3">Nama</th>
                                        <th className="px-4 py-3">Alamat</th>
                                        <th className="px-4 py-3 text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedDealers.slice(dealers).map(d => (
                                        <tr key={d.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                            <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{d.npwp}</td>
                                            <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">{d.nama}</td>
                                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{d.alamat}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => editDealer(d)} className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800"><Pencil size={15} /></button>
                                                    <button onClick={() => deleteDealer(d)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800"><Trash2 size={15} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {dealers.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">Belum ada dealer</td></tr>}
                                </tbody>
                            </table>
                        </div>
                        <Pagination page={pagedDealers.page} totalPages={pagedDealers.totalPages} setPage={pagedDealers.setPage} />
                    </div>
                </div>
            )}

            {/* ── Master Barang Tab ── */}
            {tab === 'barang' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 space-y-3 h-fit">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="font-bold text-slate-800 dark:text-white">{barangEditId ? 'Edit Barang' : 'Tambah Barang'}</h3>
                            <div className="flex items-center gap-1">
                                <button onClick={() => invoiceService.downloadBarangTemplate().catch(e => toast?.error?.(e.message))} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700" title="Download Template">
                                    <FileText size={12} /> Template
                                </button>
                                <input ref={barangImportRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { if (e.target.files[0]) handleBarangImport(e.target.files[0]); e.target.value = ''; }} />
                                <button onClick={() => barangImportRef.current?.click()} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold hover:bg-emerald-100 dark:hover:bg-emerald-500/20" title="Import Data Excel">
                                    <Upload size={12} /> Import
                                </button>
                            </div>
                        </div>
                        <input className={inputCls} placeholder="Model / Kode Barang" value={barangForm.model} onChange={e => setBarangForm({ ...barangForm, model: e.target.value })} />
                        <input className={inputCls} placeholder="Item Description" value={barangForm.item_description} onChange={e => setBarangForm({ ...barangForm, item_description: e.target.value })} />
                        <MoneyInput className={inputCls} placeholder="Harga" value={barangForm.harga} onChange={v => setBarangForm({ ...barangForm, harga: v })} />
                        <div className="flex gap-2">
                            <button onClick={saveBarang} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold">
                                <Plus size={15} /> {barangEditId ? 'Update' : 'Simpan'}
                            </button>
                            {barangEditId && (
                                <button onClick={() => { setBarangEditId(null); setBarangForm({ model: '', item_description: '', harga: '' }); }} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-semibold">
                                    Batal
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                        <th className="px-4 py-3">Model</th>
                                        <th className="px-4 py-3">Item Description</th>
                                        <th className="px-4 py-3 text-right">Harga</th>
                                        <th className="px-4 py-3 text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedBarang.slice(barang).map(b => (
                                        <tr key={b.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                            <td className="px-4 py-3 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">{b.model}</td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs">{b.item_description}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-white">{formatCurrency(b.harga)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => editBarang(b)} className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800"><Pencil size={15} /></button>
                                                    <button onClick={() => deleteBarang(b)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800"><Trash2 size={15} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {barang.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">Belum ada barang</td></tr>}
                                </tbody>
                            </table>
                        </div>
                        <Pagination page={pagedBarang.page} totalPages={pagedBarang.totalPages} setPage={pagedBarang.setPage} />
                    </div>
                </div>
            )}

            {/* ── Rule Tab ── */}
            {tab === 'rule' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 space-y-3 h-fit">
                        <h3 className="font-bold text-slate-800 dark:text-white">{ruleEditId ? 'Edit Rule' : 'Tambah Rule'}</h3>
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Tipe Target</label>
                            <select className={inputCls} value={ruleForm.target_type} onChange={e => setRuleForm({ ...ruleForm, target_type: e.target.value })}>
                                <option value="user">User</option>
                                <option value="role">Role</option>
                                <option value="division">Divisi</option>
                            </select>
                        </div>
                        <input className={inputCls} placeholder="Username / role / divisi" value={ruleForm.target_value} onChange={e => setRuleForm({ ...ruleForm, target_value: e.target.value })} />
                        <div className="space-y-2">
                            {[
                                ['can_create', 'Buat Invoice'],
                                ['can_approve', 'Approve Proforma'],
                                ['can_tax', 'Faktur Pajak'],
                                ['can_manage_master', 'Kelola Master & Rule'],
                                ['can_settle', 'Settle Proforma'],
                            ].map(([key, label]) => (
                                <label key={key} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                                    <input type="checkbox" checked={!!ruleForm[key]} onChange={e => setRuleForm({ ...ruleForm, [key]: e.target.checked })} className="w-4 h-4 accent-indigo-600" />
                                    {label}
                                </label>
                            ))}
                        </div>
                        <div className="flex gap-2 pt-1">
                            <button onClick={saveRule} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold">
                                <Plus size={15} /> {ruleEditId ? 'Update' : 'Simpan'}
                            </button>
                            {ruleEditId && (
                                <button onClick={() => { setRuleEditId(null); setRuleForm({ target_type: 'user', target_value: '', can_create: true, can_approve: false, can_tax: false, can_manage_master: false, can_settle: false }); }} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-semibold">
                                    Batal
                                </button>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-400">Default semua akses aktif untuk semua user. Buat rule untuk membatasi akses user/role/divisi tertentu (flag rule akan menimpa default).</p>
                    </div>

                    <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                        <th className="px-4 py-3">Target</th>
                                        <th className="px-4 py-3 text-center">Buat</th>
                                        <th className="px-4 py-3 text-center">Approve</th>
                                        <th className="px-4 py-3 text-center">Tax</th>
                                        <th className="px-4 py-3 text-center">Master</th>
                                        <th className="px-4 py-3 text-center">Settle</th>
                                        <th className="px-4 py-3 text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedRules.slice(rules).map(r => (
                                        <tr key={r.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-slate-800 dark:text-white">{r.target_value}</div>
                                                <div className="text-[10px] text-slate-400 uppercase">{r.target_type}</div>
                                            </td>
                                            {['can_create', 'can_approve', 'can_tax', 'can_manage_master', 'can_settle'].map(key => (
                                                <td key={key} className="px-4 py-3 text-center">
                                                    {r[key] ? <CheckCircle2 size={16} className="inline text-emerald-500" /> : <XCircle size={16} className="inline text-slate-300 dark:text-slate-600" />}
                                                </td>
                                            ))}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => editRule(r)} className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800"><Pencil size={15} /></button>
                                                    <button onClick={() => deleteRule(r)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800"><Trash2 size={15} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {rules.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Belum ada rule</td></tr>}
                                </tbody>
                            </table>
                        </div>
                        <Pagination page={pagedRules.page} totalPages={pagedRules.totalPages} setPage={pagedRules.setPage} />
                    </div>
                </div>
            )}

            {/* ── Settle Modal ── */}
            {showSettle && settleTarget && createPortal(
                <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setShowSettle(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg my-8 p-6 space-y-5" onClick={e => e.stopPropagation()}>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white">Settle Proforma</h3>
                            <p className="text-xs text-slate-400">{settleTarget.proforma_no} • {settleTarget.invoices?.map(i => i.dealer_name).join(', ')}</p>
                        </div>
                        {settleError && (
                            <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">{settleError}</div>
                        )}
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Total Proforma</label>
                            <div className="text-2xl font-black text-slate-800 dark:text-white">{formatCurrency(settleTarget.total_nominal)}</div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Nominal Settle * (harus balance)</label>
                            <MoneyInput className={inputCls} placeholder="0" value={settleForm.settled_amount} onChange={v => setSettleForm({ ...settleForm, settled_amount: v })} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Catatan</label>
                            <textarea className={inputCls} rows={2} value={settleForm.notes} onChange={e => setSettleForm({ ...settleForm, notes: e.target.value })} />
                        </div>
                        <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setShowSettle(false)} className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-semibold">Batal</button>
                             <button onClick={handleSettle} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold shadow-lg shadow-teal-500/25">
                                <HandCoins size={16} /> Settle
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ── New Invoice Modal ── */}
            {showNewInvoice && createPortal(
                <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setShowNewInvoice(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl my-8 p-6 space-y-5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-white">{editInvoiceId ? `Edit Invoice #${editInvoiceId}` : 'Buat Invoice'}</h3>
                                <p className="text-xs text-slate-400">Lengkapi data dealer dan daftar barang</p>
                            </div>
                            <button onClick={() => setShowNewInvoice(false)} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
                        </div>

                        {invError && (
                            <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">{invError}</div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Nama Dealer *</label>
                                <SearchAutocomplete
                                    value={dealers.find(d => Number(d.id) === Number(invForm.dealer_id))?.nama || ''}
                                    options={dealers}
                                    labelKey="nama"
                                    subKey="npwp"
                                    onSelect={(o) => setInvForm({ ...invForm, dealer_id: String(o.id) })}
                                    className={inputCls + ' pr-7'}
                                    placeholder="Cari Dealer..."
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">No. PO *</label>
                                <input className={inputCls} value={invForm.no_po} onChange={e => setInvForm({ ...invForm, no_po: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Tgl. PO *</label>
                                <input type="date" className={inputCls} value={invForm.tgl_po} onChange={e => setInvForm({ ...invForm, tgl_po: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Tipe Invoice *</label>
                                <select className={inputCls} value={invForm.tipe} onChange={e => setInvForm({ ...invForm, tipe: e.target.value })}>
                                    {Object.entries(TIPE_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                </select>
                                <p className="text-[10px] text-slate-400 mt-1">{TIPE_MAP[invForm.tipe]?.desc}</p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Tgl. Transaksi *</label>
                                <input type="date" className={inputCls} value={invForm.tgl_transaksi} onChange={e => setInvForm({ ...invForm, tgl_transaksi: e.target.value })} />
                            </div>
                            {invForm.tipe === 'PP' ? (
                                <>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Uang Masuk (DP) *</label>
                                        <MoneyInput
                                            className={inputCls}
                                            placeholder="0"
                                            value={invForm.uang_masuk}
                                            onChange={v => {
                                                const dp = parseFlexNumber(v);
                                                setInvForm(prev => ({
                                                    ...prev,
                                                    uang_masuk: v,
                                                    pelunasan: totalInvoice > 0 ? parseCurrency(totalInvoice - dp) : prev.pelunasan,
                                                }));
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Pelunasan *</label>
                                        <MoneyInput
                                            className={inputCls}
                                            placeholder="0"
                                            value={invForm.pelunasan}
                                            onChange={v => {
                                                const pel = parseFlexNumber(v);
                                                setInvForm(prev => ({
                                                    ...prev,
                                                    pelunasan: v,
                                                    uang_masuk: totalInvoice > 0 ? parseCurrency(totalInvoice - pel) : prev.uang_masuk,
                                                }));
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Tgl. Uang Masuk *</label>
                                        <input type="date" className={inputCls} value={invForm.tgl_uang_masuk} onChange={e => setInvForm({ ...invForm, tgl_uang_masuk: e.target.value })} />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">{invForm.tipe === 'PF' ? 'Uang Masuk (Opsional)' : 'Uang Masuk *'}</label>
                                        <MoneyInput className={inputCls} placeholder="0" value={invForm.uang_masuk} onChange={v => setInvForm({ ...invForm, uang_masuk: v })} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">{invForm.tipe === 'PF' ? 'Tgl. Uang Masuk (Opsional)' : 'Tgl. Uang Masuk *'}</label>
                                        <input type="date" className={inputCls} value={invForm.tgl_uang_masuk} onChange={e => setInvForm({ ...invForm, tgl_uang_masuk: e.target.value })} />
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Items */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Daftar Barang *</label>
                                <button onClick={addRow} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-500/20">
                                    <Plus size={13} /> Tambah Barang
                                </button>
                            </div>
                            <div className="space-y-2">
                                {invRows.map((row, idx) => (
                                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                        <div className="col-span-3">
                                            <SearchAutocomplete
                                                value={row.model}
                                                options={barang}
                                                labelKey="model"
                                                subKey="item_description"
                                                onSelect={(o) => onSelectModel(idx, o.model)}
                                                className={inputCls + ' pr-7'}
                                                placeholder="Cari Model..."
                                            />
                                        </div>
                                        <div className="col-span-4">
                                            <input className={inputCls} placeholder="Item Description (otomatis)" readOnly value={row.item_description || ''} />
                                        </div>
                                        <div className="col-span-1">
                                            <input className={inputCls} type="number" min="1" value={row.qty} onChange={e => updateRow(idx, { qty: e.target.value })} />
                                        </div>
                                        <div className="col-span-2">
                                            <MoneyInput className={inputCls} placeholder="Harga" value={row.harga} onChange={v => updateRow(idx, { harga: v })} />
                                        </div>
                                        <div className="col-span-1 text-right font-bold text-sm text-slate-800 dark:text-white">
                                            {(formatCurrency((parseFloat(row.harga) || 0) * (parseInt(row.qty) || 0)))}
                                        </div>
                                        <div className="col-span-1 text-right">
                                            <button onClick={() => removeRow(idx)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Subtotal</label>
                                <div className="font-bold text-slate-800 dark:text-white text-sm">{formatCurrency(subtotalAll)}</div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">PPN Rate</label>
                                    <button
                                        type="button"
                                        onClick={() => setInvForm(prev => {
                                            if (!prev.ppn_custom) {
                                                const computed = Math.round(subtotalAll * (parseFloat(prev.ppn_rate) || 0.11) * 100) / 100;
                                                return { ...prev, ppn_custom: true, ppn_amount: parseCurrency(computed) };
                                            }
                                            return { ...prev, ppn_custom: false };
                                        })}
                                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${invForm.ppn_custom ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300'}`}
                                        title="Pakai PPN custom"
                                    >
                                        {invForm.ppn_custom ? 'PPN Custom ✓' : 'Custom PPN'}
                                    </button>
                                </div>
                                {invForm.ppn_custom ? (
                                    <MoneyInput className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-800 dark:text-white" placeholder="Jumlah PPN" value={invForm.ppn_amount} onChange={v => setInvForm(prev => ({ ...prev, ppn_amount: v }))} />
                                ) : (
                                    <input className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-800 dark:text-white" type="number" step="0.01" value={invForm.ppn_rate} onChange={e => setInvForm({ ...invForm, ppn_rate: e.target.value })} />
                                )}
                                <div className="font-semibold text-slate-600 dark:text-slate-300 text-xs mt-0.5">{formatCurrency(ppnVal)}</div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Diskon</label>
                                <MoneyInput className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-800 dark:text-white" placeholder="0" value={invForm.diskon} onChange={v => setInvForm(prev => ({ ...prev, diskon: v }))} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Materai</label>
                                <MoneyInput className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-800 dark:text-white" placeholder="0" value={invForm.materai} onChange={v => setInvForm(prev => ({ ...prev, materai: v }))} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Total Invoice {invForm.tipe === 'PP' ? '(Full Amount) *' : '*'}</label>
                                <MoneyInput
                                    className="w-full rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-800 px-2 py-1 text-sm font-black text-emerald-600 dark:text-emerald-400"
                                    placeholder="0"
                                    value={invForm.total_invoice}
                                    onChange={v => {
                                        totalTouchedRef.current = true;
                                        setInvForm(prev => ({ ...prev, total_invoice: v }));
                                    }}
                                />
                                <div className="text-[9px] text-slate-400 mt-0.5">Otomatis dari barang, bisa disesuaikan jika ada selisih pembulatan</div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button onClick={() => setShowNewInvoice(false)} className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-semibold">Batal</button>
                            <button onClick={handleCreateInvoice} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-lg shadow-emerald-500/25">
                                <CheckCircle2 size={16} /> {editInvoiceId ? 'Update Invoice' : 'Simpan Invoice'}
                             </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ── Proforma Request Modal ── */}
            {showProforma && createPortal(
                <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setShowProforma(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl my-8 p-6 space-y-5" onClick={e => e.stopPropagation()}>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white">Ajukan No Proforma</h3>
                            <p className="text-xs text-slate-400">Pilih invoice & lampirkan dokumen pendukung</p>
                        </div>
                        <div className="space-y-2">
                            {submittedInvoices.length === 0 && <div className="text-sm text-slate-400">Tidak ada invoice status submitted.</div>}
                            {submittedInvoices.map(inv => (
                                <label key={inv.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                                    <input type="checkbox"
                                        checked={proformaForm.invoice_ids.includes(inv.id)}
                                        onChange={e => {
                                            const ids = e.target.checked
                                                ? [...proformaForm.invoice_ids, inv.id]
                                                : proformaForm.invoice_ids.filter(x => x !== inv.id);
                                            setProformaForm({ ...proformaForm, invoice_ids: ids });
                                        }}
                                        className="w-4 h-4 accent-indigo-600" />
                                    <div className="flex-1">
                                        <div className="text-sm font-semibold text-slate-800 dark:text-white">#{inv.id} • {inv.dealer_name}</div>
                                        <div className="text-xs text-slate-400">{inv.no_po} • {formatCurrency(inv.total_invoice)}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Lampiran Dokumen Pendukung <span className="text-red-500">*</span></label>
                            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => setProformaFiles([...e.target.files])} />
                            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-300 text-sm w-full justify-center hover:border-indigo-400 hover:text-indigo-500">
                                <Upload size={16} /> {proformaFiles.length ? `${proformaFiles.length} file dipilih` : 'Pilih File Pendukung'}
                            </button>
                            {proformaFiles.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {[...proformaFiles].map((f, i) => (
                                        <span key={i} className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs">{f.name}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setShowProforma(false)} className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-semibold">Batal</button>
                            <button onClick={handleNewProforma} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-lg shadow-indigo-500/25">
                                <FileSignature size={16} /> Ajukan
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ── Tax Modal ── */}
            {showTax && taxTarget && createPortal(
                <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setShowTax(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg my-8 p-6 space-y-5" onClick={e => e.stopPropagation()}>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white">Faktur Pajak</h3>
                            <p className="text-xs text-slate-400">Invoice #{taxTarget.id} • {taxTarget.proforma_no} • {taxTarget.dealer_name}</p>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">No. Faktur Pajak</label>
                            <input className={inputCls} value={taxForm.faktur_pajak_no} onChange={e => setTaxForm({ ...taxForm, faktur_pajak_no: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">File Faktur Pajak</label>
                            <input ref={taxFileRef} type="file" className="hidden" onChange={e => setTaxForm({ ...taxForm, file: e.target.files[0] })} />
                            <button onClick={() => taxFileRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-300 text-sm w-full justify-center hover:border-violet-400 hover:text-violet-500">
                                <Upload size={16} /> {taxForm.file ? taxForm.file.name : 'Pilih File Faktur Pajak'}
                            </button>
                        </div>
                         <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setShowTax(false)} className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-semibold">Batal</button>
                            <button onClick={handleTax} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold shadow-lg shadow-violet-500/25">
                                <FileText size={16} /> Simpan Faktur Pajak
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ── Tax Request Modal (Ajukan ke bagian tax) ── */}
            {showTaxRequest && taxRequestTarget && createPortal(
                <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setShowTaxRequest(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg my-8 p-6 space-y-5" onClick={e => e.stopPropagation()}>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white">Ajukan Faktur Pajak</h3>
                            <p className="text-xs text-slate-400">Invoice #{taxRequestTarget.id} • {taxRequestTarget.proforma_no} • {taxRequestTarget.dealer_name}</p>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Lampiran Pendukung <span className="text-red-500">*</span></label>
                            <input ref={taxRequestFileRef} type="file" multiple className="hidden" onChange={e => setTaxRequestFiles([...(e.target.files || [])])} />
                            <button onClick={() => taxRequestFileRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-300 text-sm w-full justify-center hover:border-orange-400 hover:text-orange-500">
                                <Upload size={16} /> {taxRequestFiles.length ? `${taxRequestFiles.length} file dipilih` : 'Pilih File Lampiran'}
                            </button>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Catatan (opsional)</label>
                            <textarea className={inputCls} rows={2} value={taxRequestNotes} onChange={e => setTaxRequestNotes(e.target.value)} placeholder="Catatan untuk bagian tax..." />
                        </div>
                        <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setShowTaxRequest(false)} className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-semibold">Batal</button>
                            <button onClick={() => handleSubmitTax(taxRequestTarget.id)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold shadow-lg shadow-orange-500/25">
                                <Upload size={16} /> Ajukan ke Tax
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ── Detail Modal ── */}
            {showDetail && detailTarget && createPortal(
                <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setShowDetail(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg my-8 p-6 space-y-5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-black text-slate-800 dark:text-white">Detail Invoice #{detailTarget.id}</h3>
                            <button onClick={() => setShowDetail(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                                <XCircle size={20} />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dealer</span><div className="font-semibold text-slate-800 dark:text-white">{detailTarget.dealer_name || '-'}</div></div>
                            <div><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">NPWP</span><div className="text-slate-600 dark:text-slate-300">{detailTarget.dealer_npwp || '-'}</div></div>
                            <div><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No. PO</span><div className="text-slate-800 dark:text-white">{detailTarget.no_po || '-'}</div></div>
                            <div><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipe</span><div className="font-semibold">{TIPE_MAP[detailTarget.tipe]?.label || detailTarget.tipe}</div></div>
                            <div><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Invoice</span><div className="font-bold">{formatCurrency(detailTarget.total_invoice)}</div></div>
                            <div><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Uang Masuk</span><div className="text-slate-600">{formatCurrency(detailTarget.uang_masuk)}</div></div>
                            <div><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</span><div><span className={`inline-block whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_MAP[detailTarget.status]?.cls || ''}`}>{STATUS_MAP[detailTarget.status]?.label || detailTarget.status}</span></div></div>
                            <div><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No Proforma</span><div className="text-indigo-600 font-semibold">{detailTarget.proforma_no || '-'}</div></div>
                        </div>
                        {detailTarget.faktur_pajak_no && (
                            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Faktur Pajak</h4>
                                <div className="text-sm">No: <span className="font-semibold text-violet-600">{detailTarget.faktur_pajak_no}</span></div>
                                {detailTarget.faktur_pajak_file && (
                                    <a href={`${API_URL}/invoices/files/${detailTarget.faktur_pajak_file}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg bg-violet-50 dark:bg-violet-500/10 text-violet-600 text-xs hover:bg-violet-100">
                                        <FileText size={14} /> Download / View Faktur Pajak
                                    </a>
                                )}
                            </div>
                        )}
                        {(() => {
                            const proforma = (proformas || []).find(p => {
                                const ids = parseJsonArray(p.invoice_ids) || [];
                                return ids.includes(Number(detailTarget.id));
                            });
                            if (!proforma) return null;
                            const attachments = parseJsonArray(proforma.attachments) || [];
                            if (!attachments.length) return null;
                            return (
                                <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Lampiran Proforma</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {attachments.map(f => (
                                            <a key={f} href={`${API_URL}/invoices/files/${f}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 text-xs hover:bg-blue-100">
                                                <ImagePlus size={14} /> {f.length > 30 ? f.slice(0, 30) + '...' : f}
                                            </a>
                                        ))}
                                    </div>
                                    {proforma.sendback_notes && <div className="text-[10px] text-red-500 mt-1">Sendback: {proforma.sendback_notes}</div>}
                                </div>
                            );
                        })()}
                        {(() => {
                            const taxAttach = parseJsonArray(detailTarget.tax_request_attachments) || [];
                            if (!taxAttach.length && !detailTarget.tax_request_notes) return null;
                            return (
                                <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Lampiran Tax Request</h4>
                                    {taxAttach.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {taxAttach.map(f => (
                                                <a key={f} href={`${API_URL}/invoices/files/${f}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-500/10 text-orange-600 text-xs hover:bg-orange-100">
                                                    <ImagePlus size={14} /> {f.length > 30 ? f.slice(0, 30) + '...' : f}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                    {detailTarget.tax_request_notes && <div className="text-[10px] text-red-500 mt-1">Sendback Tax: {detailTarget.tax_request_notes}</div>}
                                </div>
                            );
                        })()}
                        <div className="flex justify-end pt-2">
                            <button onClick={() => { invoiceService.exportPdf(detailTarget.id); }} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold">
                                <Printer size={15} /> Print PDF
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

function parseJsonArray(str) {
    try { return JSON.parse(str); } catch { return []; }
}

export default Invoices;
