import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Textarea } from '../components/ui/textarea';
import { SummaryRow } from '../components/ui/Card';
import { useModalKeydown, useModalScrollLock } from '../components/ui/useModalKeydown';
import { useLanguage } from '../contexts/LanguageContext';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, FileText, Printer, CheckCircle2, XCircle, Clock, Upload,
    Trash2, Pencil, Search, RefreshCw, FileSignature, ImagePlus, Receipt,
    Landmark, Package, ShieldCheck, HandCoins, X, Save, LayoutDashboard,
    ArrowUpDown, ArrowUp, ArrowDown, Download, History, Filter, Ban, Megaphone,
    FileSpreadsheet, Mail, Workflow, ArrowRight, Power, ChevronUp, ChevronDown, ChevronRight, Sparkles,
    Eye, Users, AtSign, MoreVertical, FileDown, Settings2, Trophy, TrendingUp, RotateCcw, PenLine
} from 'lucide-react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
    CartesianGrid, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { invoiceService } from '../services/invoiceService';
import { authService } from '../services/authService';
import { API_URL } from '../services/apiClient';
export { API_URL } from '../services/apiClient';
import { buildRejectChain } from '../utils/invoiceChain';
import { SuperDetailModal } from '../components/SuperDetailModal';
import { AuditTrailModal } from '../components/AuditTrailModal';


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

export const STATUS_MAP = {
    submitted: { label: 'Submitted', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' },
    proforma: { label: 'Proforma', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' },
    sent_back: { label: 'Dikembalikan', cls: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' },
    rejected: { label: 'Ditolak', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400' },
    tax_requested: { label: 'Tax Requested', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400' },
    sent_back_tax: { label: 'Tax Sent Back', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400' },
    tax: { label: 'Faktur Pajak', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' },
    settled: { label: 'Settled', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' },
    cancelled: { label: 'Dibatalkan', cls: 'bg-stone-200 text-stone-600 dark:bg-stone-500/10 dark:text-white/40 line-through' },
};

export const TIPE_MAP = {
    CBD: { label: 'CBD (Cash by Delivery)', desc: 'Uang masuk = total invoice (harus balance)' },
    PP: { label: 'PP (Partial Payment)', desc: 'Uang masuk sebagai DP, pelunasan menyusul' },
    PF: { label: 'PF (Performa First)', desc: 'Barang dikirim dulu, pembayaran menyusul' },
};

export const paymentBadge = (inv) => {
    const tipe = (inv?.tipe || 'CBD').toUpperCase();
    const ppType = (inv?.pp_type || '').toLowerCase();
    if (tipe === 'PP' && ppType === 'dp') return { label: 'DP', cls: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400' };
    if (tipe === 'PP' && ppType === 'pelunasan') return { label: 'Pelunasan', cls: 'bg-teal-100 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400' };
    if (tipe === 'PP') return { label: 'PP', cls: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400' };
    if (tipe === 'PF') return { label: 'PF', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' };
    return { label: 'CBD', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' };
};

export const PROFORMA_STATUS_OPTIONS = [
    { value: '', label: 'Semua Status' },
    { value: 'pending', label: 'Menunggu Approve' },
    { value: 'approved', label: 'Disetujui' },
    { value: 'sent_back', label: 'Dikembalikan' },
    { value: 'rejected', label: 'Ditolak' },
    { value: 'settled', label: 'Settled' },
];

export const PROFORMA_STATUS_BADGE = {
    approved: { label: 'Disetujui', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30', dot: 'bg-emerald-500' },
    sent_back: { label: 'Dikembalikan', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30', dot: 'bg-amber-500' },
    rejected: { label: 'Ditolak', cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30', dot: 'bg-red-500' },
    settled: { label: 'Settled', cls: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/30', dot: 'bg-teal-500' },
    pending: { label: 'Menunggu', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30', dot: 'bg-amber-500 animate-pulse' },
};

export const TAX_STATUS_BADGE = {
    tax_requested: { label: 'Menunggu Approve', cls: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/30', dot: 'bg-orange-500 animate-pulse' },
    sent_back_tax: { label: 'Dikembalikan', cls: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30', dot: 'bg-rose-500' },
    rejected: { label: 'Ditolak', cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30', dot: 'bg-red-500' },
    proforma: { label: 'Menunggu Faktur', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30', dot: 'bg-amber-500' },
    done: { label: 'Faktur Pajak', cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30', dot: 'bg-blue-500' },
};

export const TAX_STATUS_OPTIONS = [
    { value: '', label: 'Semua Status' },
    { value: 'tax_requested', label: 'Menunggu Approve' },
    { value: 'sent_back_tax', label: 'Dikembalikan' },
    { value: 'rejected', label: 'Ditolak' },
    { value: 'proforma', label: 'Menunggu Faktur' },
    { value: 'done', label: 'Faktur Pajak' },
];

// Status TAX turunan dari invoice (prioritas: menunggu > dikembalikan > ditolak > menunggu faktur > selesai).
// Dipakai bersama oleh filter tab Tax dan badge di render agar selalu konsisten.
export const taxKeyOfProforma = (p) => {
    const invs = (p.invoices || []).filter(inv => inv.status !== 'cancelled');
    const has = (s) => invs.some(inv => inv.status === s);
    if (has('tax_requested')) return 'tax_requested';
    if (has('sent_back_tax')) return 'sent_back_tax';
    if (has('rejected')) return 'rejected';
    if (has('proforma')) return 'proforma';
    return invs.length > 0 ? 'done' : '';
};

export const PERM_VIEW_FIELDS = [
    ['can_view_dashboard', 'Dashboard'],
    ['can_view_invoice', 'Tab Invoices'],
    ['can_view_proforma', 'Tab Proforma'],
    ['can_view_tax', 'Tab Tax'],
    ['can_view_dealer', 'Tab Master Dealer'],
    ['can_view_barang', 'Tab Master Barang'],
    ['can_view_rule', 'Tab Rule'],
    ['can_view_flow', 'Tab Flow'],
];

export const PERM_ACTION_FIELDS = [
    ['can_create', 'Buat Invoice'],
    ['can_edit', 'Edit Invoice'],
    ['can_delete', 'Hapus Invoice'],
    ['can_cancel', 'Batalkan Invoice'],
    ['can_proforma', 'Ajukan Proforma'],
    ['can_approve', 'Approve Proforma'],
    ['can_sendback', 'Sendback Proforma'],
    ['can_reject', 'Reject Proforma'],
    ['can_tax_request', 'Ajukan Faktur Pajak'],
    ['can_tax', 'Lampirkan / Approve Faktur Pajak'],
    ['can_tax_sendback', 'Sendback Faktur Pajak'],
    ['can_settle', 'Settle Proforma'],
    ['can_manage_master', 'Kelola Master Dealer/Barang'],
    ['can_manage_rule', 'Kelola Rule'],
    ['can_print', 'PDF Proforma'],
];

export const ALL_PERM_FIELDS = [...PERM_VIEW_FIELDS.map(([k]) => k), ...PERM_ACTION_FIELDS.map(([k]) => k)];

export const DEFAULT_PERMS = () => {
    const d = {};
    ALL_PERM_FIELDS.forEach(k => d[k] = true);
    return d;
};

export const EMPTY_RULE_FORM = () => {
    const f = { target_type: 'user', target_value: '', is_active: true };
    ALL_PERM_FIELDS.forEach(k => f[k] = true);
    return f;
};

const PAGE_SIZE = 10;

const usePager = (total) => {
    const [page, setPage] = useState(1);
    const totalPages = Math.max(1, Math.ceil((total || 0) / PAGE_SIZE));
    useEffect(() => { setPage(1); }, [total]);
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return {
        page: safePage,
        totalPages,
        start,
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
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/60 dark:border-white/10 bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl">
            <div className="text-xs text-stone-500 dark:text-white/40 font-medium">Page <span className="font-bold text-stone-800 dark:text-white">{page}</span> of {totalPages}</div>
            <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page" title="Previous" className={`${btnCls} text-stone-500 dark:text-white/70 hover:bg-stone-100 dark:hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed`}>«</button>
                {pages.map((p, i) => p === '...' ? (
                    <span key={`e${i}`} className="px-1 text-xs text-stone-400">…</span>
                ) : (
                    <button key={p} onClick={() => setPage(p)} className={`${btnCls} ${p === page ? 'gradient-bg text-white shadow-lg shadow-blue-500/25' : 'text-stone-500 dark:text-white/70 hover:bg-stone-100 dark:hover:bg-white/[0.05]'}`}>{p}</button>
                ))}
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} aria-label="Next page" title="Next" className={`${btnCls} text-stone-500 dark:text-white/70 hover:bg-stone-100 dark:hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed`}>»</button>
            </div>
        </div>
    );
};

// ── Mini Stepper Component ──
const StatusStepper = ({ status, t }) => {
    let step = 0;
    if (['proforma', 'sent_back', 'rejected', 'tax_requested', 'sent_back_tax', 'tax', 'settled'].includes(status)) step = 1;
    if (['tax', 'settled'].includes(status)) step = 2;
    if (status === 'settled') step = 3;
    if (status === 'cancelled') return <div className="text-[9px] text-red-500 font-bold uppercase tracking-widest mt-1.5 flex items-center gap-1"><Ban size={10} /> {t('invoice.status.cancelled')}</div>;
    if (status === 'rejected') return <div className="text-[9px] text-rose-500 font-bold uppercase tracking-widest mt-1.5 flex items-center gap-1"><XCircle size={10} /> {t('invoice.status.rejected')}</div>;
    if (status === 'sent_back') return <div className="text-[9px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-widest mt-1.5 flex items-center gap-1"><RefreshCw size={10} /> {t('invoice.status.sentBack')}</div>;

    const titles = [t('invoice.stepper.submit'), t('invoice.stepper.proforma'), t('invoice.stepper.tax'), t('invoice.stepper.settle')];

    return (
        <div className="flex items-center mt-1.5 group relative w-fit">
            {[0, 1, 2, 3].map(i => (
                <React.Fragment key={i}>
                    <div className={`relative w-2 h-2 rounded-full transition-colors ${i <= step ? 'bg-blue-500 shadow-[0_0_5px_rgba(29,78,216,0.5)]' : 'bg-stone-200 dark:bg-[#111]'}`} title={titles[i]} />
                    {i < 3 && <div className={`h-[2px] w-3 transition-colors ${i < step ? 'bg-blue-500' : 'bg-stone-200 dark:bg-[#111]'}`} />}
                </React.Fragment>
            ))}
        </div>
    );
};

// ── Gaya tabel profesional (dipakai dashboard & invoice) ──
const TH_CLS = "px-4 py-3.5 text-[10px] font-black uppercase tracking-wider text-stone-400 border-b border-white/60 dark:border-white/10 bg-stone-50/80 dark:bg-[#0d0d0d]/50 sticky top-0 z-10 backdrop-blur";
const TH_SORT_CLS = "px-4 py-3.5 text-[10px] font-black uppercase tracking-wider text-stone-400 border-b border-white/60 dark:border-white/10 bg-stone-50/80 dark:bg-[#0d0d0d]/50 sticky top-0 z-10 backdrop-blur cursor-pointer select-none hover:text-blue-600 transition-colors";
const TD_CLS = "px-4 py-3 text-sm text-stone-600 dark:text-white/70";
const TROW_CLS = "border-b border-stone-100 dark:border-white/[0.06]/60 transition-colors hover:bg-blue-50/70 dark:hover:bg-white/[0.05]/50";
const NUM_RIGHT = "px-4 py-3 text-right tabular-nums whitespace-nowrap";

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
                <Search size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            </div>
            {open && matches.length > 0 && (
                <div className="absolute z-30 mt-1 w-full max-h-52 overflow-y-auto rounded-xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl shadow-xl">
                    {matches.slice(0, 50).map(o => (
                        <button
                            key={o.id}
                            type="button"
                            onMouseDown={e => { e.preventDefault(); select(o); }}
                            className="block w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-white/[0.05]"
                        >
                            <div className="font-semibold text-xs text-stone-800 dark:text-white">{o[labelKey]}</div>
                            {o[subKey] && <div className="text-[10px] text-stone-400 truncate">{o[subKey]}</div>}
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


function parseJsonArray(str) {
    if (!str) return [];
    try { const r = JSON.parse(str); return Array.isArray(r) ? r : []; } catch { return []; }
}


const Invoices = ({ currentUser, hasPermission, toast }) => {
    const { t, isEnglish } = useLanguage();
    const [tab, setTab] = useState('dashboard');

    const [dashSearch, setDashSearch] = useState('');
    const [dashDealer, setDashDealer] = useState('');
    const [dashStatus, setDashStatus] = useState('');
    const [exporting, setExporting] = useState(false);
    const [actionId, setActionId] = useState(null);
    const [duplicatingId, setDuplicatingId] = useState(null);
    const [savingInvoice, setSavingInvoice] = useState(false);
    const [savingProforma, setSavingProforma] = useState(false);
    const [settling, setSettling] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);
    const [savingTax, setSavingTax] = useState(false);
    const [savingTaxRequest, setSavingTaxRequest] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [savingRule, setSavingRule] = useState(false);
    const [savingDealer, setSavingDealer] = useState(false);
    const [savingBarang, setSavingBarang] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const [importing, setImporting] = useState(false);
    const [pdfBusyId, setPdfBusyId] = useState(null);
    const [actionMenu, setActionMenu] = useState(null);
    const [flowSteps, setFlowSteps] = useState([]);
    const [flowEvents, setFlowEvents] = useState({});
    const [flowOpen, setFlowOpen] = useState(false);
    const [flowSaving, setFlowSaving] = useState(false);
    const [flowForm, setFlowForm] = useState({ id: null, name: '', event: 'proforma_pending', assignee_type: 'role', assignee_value: '', custom_emails: '', notify_email: true, is_active: true });
    const [mailStatus, setMailStatus] = useState({ configured: false, loaded: false });
    const [recipOpen, setRecipOpen] = useState(false);
    const [recipLoading, setRecipLoading] = useState(false);
    const [recipList, setRecipList] = useState([]);
    const [emailTpl, setEmailTpl] = useState({ loaded: false, items: [], tokens: [] });
    const [emailTplEditing, setEmailTplEditing] = useState(null);
    const [emailTplSaving, setEmailTplSaving] = useState(false);
    const [emailTplPreview, setEmailTplPreview] = useState(null);
    const [recipTitle, setRecipTitle] = useState('');
    const [dashSortKey, setDashSortKey] = useState('id');
    const [dashSortDir, setDashSortDir] = useState('desc');
    const [invStatus, setInvStatus] = useState('');
    const [profStatus, setProfStatus] = useState('');
    const [taxStatus, setTaxStatus] = useState('');
    const [expandedDps, setExpandedDps] = useState(new Set()); // DP ids whose pelunasan sub-rows are expanded
    const [invSortKey, setInvSortKey] = useState('id');
    const [invSortDir, setInvSortDir] = useState('desc');
    const [invoices, setInvoices] = useState([]);
    const [proformas, setProformas] = useState([]);
    const [dealers, setDealers] = useState([]);
    const [barang, setBarang] = useState([]);
    const [rules, setRules] = useState([]);
    const [perms, setPerms] = useState(DEFAULT_PERMS());
    const isAdmin = ['admin', 'superadmin'].includes(String(currentUser?.role || '').toLowerCase());
    const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'invoice'|'proforma', item }
    const [deleting, setDeleting] = useState(false);
    const [trashData, setTrashData] = useState(null); // { invoices: [], proformas: [] }
    const [trashLoading, setTrashLoading] = useState(false);
    const [permTarget, setPermTarget] = useState(null); // { type, item } konfirmasi hapus permanen
    const [permDeleting, setPermDeleting] = useState(false);
    const [trashFilter, setTrashFilter] = useState('all'); // 'all' | 'invoice' | 'proforma'
    const [trashSearch, setTrashSearch] = useState('');
    const [masterUsers, setMasterUsers] = useState([]);
    const [masterRoles, setMasterRoles] = useState([]);
    const [masterDivisions, setMasterDivisions] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const order = ['dashboard', 'invoice', 'proforma', 'tax', 'dealer', 'barang', 'rule', 'flow'];
        const visible = order.filter(t => perms['can_view_' + t]);
        // Tab 'trash' (Sampah) dikelola oleh isAdmin, bukan permission per-tab — jangan tendang keluar
        if (tab !== 'trash' && !perms['can_view_' + tab] && visible.length) {
            setTab(visible[0]);
        }
    }, [perms, tab]);
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

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
        pp_type: 'dp', pelunasan_of_id: '',
    });
    const [invError, setInvError] = useState(null);
    const [editInvoiceId, setEditInvoiceId] = useState(null);
    const totalTouchedRef = useRef(false);

    // Proforma modal
    const [showProforma, setShowProforma] = useState(false);
    const [proformaForm, setProformaForm] = useState({ invoice_ids: [], attachments: [] });
    const [proformaFiles, setProformaFiles] = useState([]);
    const [proformaResubmit, setProformaResubmit] = useState(false);

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
    const [settleRows, setSettleRows] = useState([]);
    const [settleNotes, setSettleNotes] = useState('');
    const [settleTglSet, setSettleTglSet] = useState('');
    const [settleDraftAt, setSettleDraftAt] = useState(null);
    const [settleError, setSettleError] = useState(null);
    const [settleDraftIds, setSettleDraftIds] = useState(new Set());
    const [cancelTarget, setCancelTarget] = useState(null);
    const [deleteReplTarget, setDeleteReplTarget] = useState(null);
    const [deletingRepl, setDeletingRepl] = useState(false);

    // Rule form
    const [ruleForm, setRuleForm] = useState(EMPTY_RULE_FORM());
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
            const [inv, prof, dlr, brg, perm, drafts] = await Promise.all([
                invoiceService.getAll(),
                invoiceService.getProformas(),
                invoiceService.getDealers(),
                invoiceService.getBarang(),
                invoiceService.getPermissions().catch(() => DEFAULT_PERMS()),
                invoiceService.getSettleDrafts().catch(() => []),
            ]);
            // Backend returns { data, total, page, totalPages } or legacy array
            const invList = Array.isArray(inv) ? inv : (inv?.data || []);
            setInvoices(invList);
            setProformas(prof || []);
            setDealers(dlr || []);
            setBarang(brg || []);
            setPerms(perm || DEFAULT_PERMS());
            setSettleDraftIds(new Set((drafts || []).map(d => Number(d.proforma_id))));
            if (perm?.can_view_rule) {
                invoiceService.getRules().then(setRules).catch(() => {});
            }
            if (perm?.can_view_flow || perm?.can_view_rule) {
                loadFlow();
            }
            authService.getUsers().then(setMasterUsers).catch(() => {});
            authService.getRoles().then(setMasterRoles).catch(() => {});
            authService.getDepartments().then(setMasterDivisions).catch(() => {});
        } catch (e) {
            toast?.error?.('Gagal memuat data: ' + e.message);
        } finally {
            setLoading(false);
        }
    }, [toast]);

    const handleExportExcel = async () => {
        setExporting(true);
        try {
            await invoiceService.exportExcel();
            toast?.success?.('Export Excel berhasil');
        } catch (e) {
            toast?.error?.('Gagal export Excel: ' + e.message);
        } finally {
            setExporting(false);
        }
    };

    const openRowMenu = (inv, r, source) => {
        const W = 264, GAP = 6;
        const btnTop = r.top, btnBottom = r.bottom;
        const x = Math.max(8, Math.min(r.left, window.innerWidth - W - 8));
        const below = btnBottom + GAP;
        const above = btnTop - GAP;
        // Prefer opening downward; flip upward only when not enough room below.
        const openUp = (below + 320) > window.innerHeight && above > 8;
        const dir = openUp ? 'up' : 'down';
        const estH = 320;
        const y = openUp ? Math.max(8, above - estH) : below;
        const maxH = Math.max(120, window.innerHeight - y - 8);
        return { inv, source, x, y, maxH, btnTop, btnBottom, dir };
    };

    // After the menu renders, measure its real height and re-position it to hug
    // the ⋮ button (no big gap), then stop re-running.
    const menuRef = useRef(null);
    useEffect(() => {
        if (!actionMenu || actionMenu._fixed || !menuRef.current) return;
        const h = menuRef.current.offsetHeight;
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

    const [digitalSign, setDigitalSign] = useState(() => {
        try { return localStorage.getItem('inv_digital_sign') === '1'; } catch { return false; }
    });
    const toggleDigitalSign = useCallback(() => {
        setDigitalSign(prev => {
            const next = !prev;
            try { localStorage.setItem('inv_digital_sign', next ? '1' : '0'); } catch {}
            return next;
        });
    }, []);

    const handleExportPdf = async (id, kind) => {
        if (pdfBusyId) return;
        const key = `${kind}:${id}`;
        setPdfBusyId(key);
        try {
            if (kind === 'request') await invoiceService.exportRequestPdf(id);
            else await invoiceService.exportPdf(id, { digitalSign });
        } catch (e) {
            toast?.error?.(e.message || 'Gagal membuat PDF');
        } finally {
            setPdfBusyId(null);
        }
    };

    // ── Flow / Workflow ──
    const loadFlow = useCallback(async () => {
        try {
            const [r, ms, et] = await Promise.all([
                invoiceService.getFlow(),
                invoiceService.getMailStatus().catch(() => null),
                invoiceService.getEmailTemplates().catch(() => null),
            ]);
            setFlowEvents(r.events || {});
            setFlowSteps(r.steps || []);
            if (ms) setMailStatus({ ...ms, loaded: true });
            if (et) setEmailTpl({ loaded: true, items: et.items || [], tokens: et.tokens || [] });
        } catch { /* flow optional */ }
    }, []);

    const openEmailTpl = (item) => {
        setEmailTplEditing({ event: item.event, label: item.label, subject: item.subject, body_html: item.body_html, custom: !!item.custom, default_subject: item.default_subject, default_body_html: item.default_body_html });
        setEmailTplPreview(null);
    };

    const saveEmailTpl = async () => {
        if (!emailTplEditing?.subject?.trim()) return toast?.error?.('Subjek email wajib diisi');
        if (!emailTplEditing?.body_html?.trim()) return toast?.error?.('Isi email wajib diisi');
        setEmailTplSaving(true);
        try {
            await invoiceService.updateEmailTemplate(emailTplEditing.event, { subject: emailTplEditing.subject, body_html: emailTplEditing.body_html });
            toast?.success?.('Template email disimpan');
            setEmailTplEditing(null);
            setEmailTplPreview(null);
            await loadFlow();
        } catch (e) {
            toast?.error?.('Gagal simpan: ' + e.message);
        } finally {
            setEmailTplSaving(false);
        }
    };

    const resetEmailTpl = async (item) => {
        if (!window.confirm(`Kembalikan template "${item.label}" ke versi default?`)) return;
        setEmailTplSaving(true);
        try {
            await invoiceService.deleteEmailTemplate(item.event);
            toast?.success?.('Template dikembalikan ke default');
            setEmailTplEditing(null);
            await loadFlow();
        } catch (e) {
            toast?.error?.('Gagal reset: ' + e.message);
        } finally {
            setEmailTplSaving(false);
        }
    };

    const previewEmailTpl = async () => {
        if (!emailTplEditing) return;
        try {
            const res = await invoiceService.previewEmailTemplate(emailTplEditing.event, { subject: emailTplEditing.subject, body_html: emailTplEditing.body_html });
            setEmailTplPreview(res);
        } catch (e) {
            toast?.error?.(e.message);
        }
    };

    const flowAssigneeOptions = useMemo(() => {
        const roles = [...new Set((masterUsers || []).map(u => u.role).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id'));
        const divisions = [...new Set((masterUsers || []).map(u => u.department).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id'));
        return { users: masterUsers || [], roles, divisions };
    }, [masterUsers]);

    const openFlowForm = (step = null) => {
        if (step) {
            setFlowForm({ id: step.id, name: step.name, event: step.event, assignee_type: step.assignee_type || 'all', assignee_value: step.assignee_value || '', custom_emails: Array.isArray(step.custom_emails) ? step.custom_emails.join(', ') : (step.custom_emails || ''), notify_email: !!step.notify_email, is_active: !!step.is_active });
        } else {
            setFlowForm({ id: null, name: '', event: 'proforma_pending', assignee_type: 'role', assignee_value: '', custom_emails: '', notify_email: true, is_active: true });
        }
        setFlowOpen(true);
    };

    const saveFlowStep = async () => {
        if (!flowForm.name.trim()) return toast?.error?.('Nama step wajib diisi');
        if (flowForm.assignee_type && flowForm.assignee_type !== 'all' && !String(flowForm.assignee_value || '').trim()) {
            return toast?.error?.(`Penanggung jawab wajib diisi untuk tipe "${flowForm.assignee_type}"`);
        }
        setFlowSaving(true);
        try {
            const data = { ...flowForm };
            if (data.assignee_type === 'all') data.assignee_value = '';
            data.custom_emails = data.custom_emails || '';
            if (data.id) await invoiceService.updateFlowStep(data.id, data);
            else await invoiceService.createFlowStep(data);
            toast?.success?.('Step flow disimpan');
            setFlowOpen(false);
            await loadFlow();
        } catch (e) {
            toast?.error?.('Gagal simpan: ' + e.message);
        } finally {
            setFlowSaving(false);
        }
    };

    const removeFlowStep = async (s) => {
        if (!window.confirm(`Hapus step "${s.name}" dari alur?`)) return;
        try {
            await invoiceService.deleteFlowStep(s.id);
            await loadFlow();
            toast?.success?.('Step dihapus');
        } catch (e) {
            toast?.error?.(e.message);
        }
    };

    const moveFlowStep = async (s, dir) => {
        const sorted = [...flowSteps].sort((a, b) => a.step_no - b.step_no);
        const idx = sorted.findIndex(x => x.id === s.id);
        const j = idx + dir;
        if (idx < 0 || j < 0 || j >= sorted.length) return;
        const arr = [...sorted];
        [arr[idx], arr[j]] = [arr[j], arr[idx]];
        try {
            const rows = await invoiceService.reorderFlow(arr.map(x => x.id));
            setFlowSteps(rows);
        } catch (e) {
            toast?.error?.(e.message);
        }
    };

    const seedDefaultFlow = async () => {
        if (!window.confirm('Isi alur dengan contoh default (request invoice → approval akunting → marketing → request faktur → tax → approval tax → marketing)? Hanya bisa jika alur masih kosong.')) return;
        if (seeding) return;
        setSeeding(true);
        try {
            const rows = await invoiceService.seedFlow();
            setFlowSteps(rows);
            toast?.success?.('Alur default berhasil dibuat');
        } catch (e) {
            toast?.error?.(e.message);
        } finally {
            setSeeding(false);
        }
    };

    // ── Preview penerima notifikasi (TIDAK mengirim email) ──
    const openRecipients = async (opts) => {
        setRecipTitle(opts.title || 'Preview Penerima Notifikasi');
        setRecipOpen(true);
        setRecipLoading(true);
        setRecipList([]);
        try {
            const r = await invoiceService.getFlowRecipients({ event: opts.event, stepId: opts.stepId });
            setRecipList(r.recipients || []);
        } catch (e) {
            toast?.error?.('Gagal memuat penerima: ' + e.message);
        } finally {
            setRecipLoading(false);
        }
    };

    const previewFormRecipients = async () => {
        const f = flowForm;
        if (f.assignee_type && f.assignee_type !== 'all' && !f.assignee_value) {
            return toast?.error?.('Pilih penanggung jawab dulu sebelum preview');
        }
        setRecipTitle('Preview Penerima (konfigurasi form)');
        setRecipOpen(true);
        setRecipLoading(true);
        setRecipList([]);
        try {
            const r = await invoiceService.getFlowRecipients({ assigneeType: f.assignee_type, assigneeValue: f.assignee_value, customEmails: f.custom_emails });
            setRecipList(r.recipients || []);
        } catch (e) {
            toast?.error?.('Gagal memuat penerima: ' + e.message);
        } finally {
            setRecipLoading(false);
        }
    };

    useEffect(() => { loadAll(); }, [loadAll]);

    const newBlankItem = () => ({ model: '', qty: 1, ppn_rate: 0.11, ppn_override: '' });
    const [invRows, setInvRows] = useState([newBlankItem()]);

    const handleCancelInvoice = (inv) => {
        setCancelTarget(inv);
    };

    const handleDeleteReplacement = (inv) => {
        setDeleteReplTarget(inv);
    };

    // ── Hapus data (khusus admin) — invoice & proforma ──
    const openDeleteInvoice = (inv) => setDeleteTarget({ type: 'invoice', item: inv });
    const openDeleteProforma = (p) => setDeleteTarget({ type: 'proforma', item: p });

    const confirmDelete = async () => {
        if (!deleteTarget || deleting) return;
        setDeleting(true);
        try {
            if (deleteTarget.type === 'invoice') {
                await invoiceService.delete(deleteTarget.item.id);
                toast?.success?.('Invoice dipindah ke Sampah');
            } else {
                await invoiceService.deleteProforma(deleteTarget.item.id);
                toast?.success?.('Proforma beserta invoice-nya dipindah ke Sampah');
            }
            setDeleteTarget(null);
            loadAll();
            loadTrash();
        } catch (e) {
            toast?.error?.(e.message);
        } finally {
            setDeleting(false);
        }
    };

    // ── Sampah (soft delete): load, restore, hapus permanen ──
    const loadTrash = useCallback(async () => {
        if (!isAdmin) return;
        setTrashLoading(true);
        try {
            const data = await invoiceService.getTrash();
            setTrashData(data);
        } catch (e) {
            toast?.error?.(e.message);
        } finally {
            setTrashLoading(false);
        }
    }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (tab === 'trash') loadTrash();
    }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

    const doRestore = async (type, item) => {
        try {
            if (type === 'invoice') {
                await invoiceService.restoreInvoice(item.id);
                toast?.success?.('Invoice dikembalikan');
            } else {
                await invoiceService.restoreProforma(item.id);
                toast?.success?.('Proforma dikembalikan');
            }
            loadTrash();
            loadAll();
        } catch (e) {
            toast?.error?.(e.message);
        }
    };

    const openPermanentDelete = (type, item) => setPermTarget({ type, item });

    const confirmPermanentDelete = async () => {
        if (!permTarget || permDeleting) return;
        setPermDeleting(true);
        try {
            if (permTarget.type === 'invoice') {
                await invoiceService.deletePermanentInvoice(permTarget.item.id);
                toast?.success?.('Invoice dihapus permanen');
            } else {
                await invoiceService.deletePermanentProforma(permTarget.item.id);
                toast?.success?.('Proforma dihapus permanen');
            }
            setPermTarget(null);
            loadTrash();
            loadAll();
        } catch (e) {
            toast?.error?.(e.message);
        } finally {
            setPermDeleting(false);
        }
    };

    const confirmDeleteReplacement = async () => {
        if (!deleteReplTarget) return;
        if (deletingRepl) return;
        setDeletingRepl(true);
        try {
            await invoiceService.delete(deleteReplTarget.id);
            toast?.success?.('Invoice pengganti dihapus');
            setDeleteReplTarget(null);
            loadAll();
        } catch (e) {
            toast?.error?.(e.message);
        } finally {
            setDeletingRepl(false);
        }
    };

    const confirmCancel = async () => {
        if (!cancelTarget) return;
        if (cancelling) return;
        setCancelling(true);
        try {
            await invoiceService.cancel(cancelTarget.id);
            toast?.success?.('Invoice dibatalkan');
            setCancelTarget(null);
            loadAll();
        } catch (e) {
            toast?.error?.(e.message);
        } finally {
            setCancelling(false);
        }
    };

    const openNewInvoice = () => {
        setEditInvoiceId(null);
        totalTouchedRef.current = false;
        setInvForm({
            dealer_id: '', no_po: '', tgl_po: '', tipe: 'CBD', tgl_transaksi: '',
            uang_masuk: '', tgl_uang_masuk: '', ppn_rate: 0.11, diskon: '', materai: '',
            pelunasan: '', ppn_custom: false, ppn_amount: '', total_invoice: '',
            pp_type: 'dp', pelunasan_of_id: '',
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
            pp_type: inv.pp_type || 'dp',
            pelunasan_of_id: inv.pelunasan_of_id ? String(inv.pelunasan_of_id) : '',
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
                ppn_rate: it.ppn_rate != null ? Number(it.ppn_rate) : 0.11,
                ppn_override: it.ppn_override != null ? Number(it.ppn_override) : '',
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

    const ppRemaining = (parentId, excludeId = null) => {
        const parent = (invoices || []).find(i => String(i.id) === String(parentId));
        if (!parent) return 0;
        const full = parseFloat(parent.total_invoice) || 0;
        const dp = parseFloat(parent.uang_masuk) || 0;
        const others = (invoices || []).filter(i =>
            String(i.pelunasan_of_id) === String(parentId)
            && i.status !== 'cancelled'
            && (!excludeId || String(i.id) !== String(excludeId))
        );
        const paid = others.reduce((s, i) => s + (parseFloat(i.uang_masuk) || 0), 0);
        return round2(full - dp - paid);
    };

    const ppParents = useMemo(() => {
        if (invForm.tipe !== 'PP' || invForm.pp_type !== 'pelunasan' || !invForm.dealer_id) return [];
        return (invoices || []).filter(i =>
            String(i.dealer_id) === String(invForm.dealer_id)
            && i.tipe === 'PP'
            && i.status !== 'cancelled'
            && (i.pp_type === 'dp' || !i.pelunasan_of_id)
        );
    }, [invoices, invForm.tipe, invForm.pp_type, invForm.dealer_id]);

    const handleSelectPelunasanPo = async (pid) => {
        if (!pid) {
            setInvForm(prev => ({ ...prev, pelunasan_of_id: '' }));
            return;
        }
        const parent = (invoices || []).find(i => String(i.id) === String(pid));
        if (!parent) return;
        setInvForm(prev => ({
            ...prev,
            pelunasan_of_id: String(parent.id),
            no_po: parent.no_po || '',
            tgl_po: parent.tgl_po ? String(parent.tgl_po).slice(0, 10) : '',
        }));
        totalTouchedRef.current = true;
        try {
            const detail = await invoiceService.getById(parent.id);
            const rows = (detail.items || []).map(it => ({
                model: it.model || '',
                qty: it.qty || 1,
                item_description: it.item_description || '',
                harga: parseCurrency(it.harga),
                ppn_rate: it.ppn_rate != null ? Number(it.ppn_rate) : 0.11,
                ppn_override: it.ppn_override != null ? Number(it.ppn_override) : '',
            }));
            const sisa = ppRemaining(parent.id, editInvoiceId);
            const fullAmount = parseCurrency(parent.total_invoice);
            setInvRows(rows.length ? rows : [newBlankItem()]);
            setInvForm(prev => ({
                ...prev,
                total_invoice: fullAmount,   // daftar barang = full amount (sama dengan DP)
                uang_masuk: parseCurrency(sisa), // amount pelunasan = sisa (full − DP)
            }));
        } catch (e) {
            toast?.error?.(e.message || 'Gagal mengambil detail PO DP');
        }
    };

    const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;
    const subtotalAll = useMemo(() =>
        round2(invRows.reduce((s, r) => s + ((parseFloat(r.harga) || 0) * (parseInt(r.qty) || 0)), 0)), [invRows]);
    const ppnPerItem = useMemo(() =>
        invRows.map(r => {
            if (r.ppn_override !== '' && r.ppn_override != null) return Math.round(parseFloat(r.ppn_override) || 0);
            return Math.round(((parseFloat(r.harga) || 0) * (parseInt(r.qty) || 0)) * (parseFloat(invForm.ppn_rate) || 0.11));
        }), [invRows, invForm.ppn_rate]);
    const ppnVal = invForm.ppn_custom
        ? Math.round(parseFloat(invForm.ppn_amount) || 0)
        : ppnPerItem.reduce((s, v) => s + v, 0);
    const diskonVal = round2(invForm.diskon);
    const materaiVal = round2(invForm.materai);
    const computedTotal = round2(subtotalAll + ppnVal - diskonVal + materaiVal);
    const totalInvoice = invForm.total_invoice !== '' && invForm.total_invoice != null
        ? round2(invForm.total_invoice)
        : computedTotal;

    useEffect(() => {
        // PP: Total Invoice (Full Amount) diisi manual (DP) / dari PO DP (pelunasan),
        // TIDAK auto-dihitung dari daftar barang. CBD/PF tetap auto dari barang.
        if (invForm.tipe === 'PP') return;
        if (!totalTouchedRef.current) {
            setInvForm(prev => ({ ...prev, total_invoice: parseCurrency(computedTotal) }));
        }
    }, [computedTotal, invForm.tipe]);

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
            if (invForm.pp_type === 'pelunasan') {
                if (!invForm.pelunasan_of_id) return setInvError('Pilih No. PO DP yang akan dilunasi');
                const parent = (invoices || []).find(i => String(i.id) === String(invForm.pelunasan_of_id));
                const fullAmount = parent ? (parseFloat(parent.total_invoice) || 0) : 0;
                const rem = ppRemaining(invForm.pelunasan_of_id, editInvoiceId);
                // Amount pelunasan tidak boleh lebih dari sisa (full − DP).
                if (uangMasuk > rem + 0.01) {
                    return setInvError(`Amount pelunasan tidak boleh lebih dari sisa (${formatCurrency(rem)}). Saat ini ${formatCurrency(uangMasuk)}`);
                }
                // Daftar barang (total) harus sama dengan full amount DP.
                if (parent && Math.abs(totalInvoice - fullAmount) > 0.01) {
                    return setInvError(`Daftar barang pelunasan harus sama dengan full amount DP (${formatCurrency(fullAmount)}). Saat ini ${formatCurrency(totalInvoice)}. Yang boleh beda hanya amount, bukan daftar barang.`);
                }
            } else {
                if (!(uangMasuk < totalInvoice)) return setInvError('Uang masuk (DP) harus lebih kecil dari total invoice');
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
            pp_type: invForm.tipe === 'PP' ? (invForm.pp_type || 'dp') : null,
            pelunasan_of_id: (invForm.tipe === 'PP' && invForm.pp_type === 'pelunasan') ? (invForm.pelunasan_of_id || null) : null,
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
                ppn_rate: parseFloat(invForm.ppn_rate) || 0.11,
                ppn_override: r.ppn_override !== '' && r.ppn_override != null ? parseFloat(r.ppn_override) || 0 : null,
            })),
        };
        if (savingInvoice) return;
        setSavingInvoice(true);
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
        } finally {
            setSavingInvoice(false);
        }
    };

    const handleNewProforma = async () => {
        if (!proformaForm.invoice_ids.length) return toast?.error?.('Pilih minimal satu invoice');
        if (!proformaFiles.length && !(proformaForm.attachments || []).length) return toast?.error?.('Lampiran wajib diunggah');
        const fd = new FormData();
        fd.append('invoice_ids', JSON.stringify(proformaForm.invoice_ids.map(Number)));
        if ((proformaForm.attachments || []).length) fd.append('keep_attachments', JSON.stringify(proformaForm.attachments));
        proformaFiles.forEach(f => fd.append('attachments', f));
        if (savingProforma) return;
        setSavingProforma(true);
        try {
            await invoiceService.submitProforma(fd);
            toast?.success?.('Proforma diajukan, menunggu approval accounting');
            setShowProforma(false);
            setProformaForm({ invoice_ids: [], attachments: [] });
            setProformaFiles([]);
            loadAll();
        } catch (e) {
            toast?.error?.(e.message);
        } finally {
            setSavingProforma(false);
        }
    };

    const [actionModal, setActionModal] = useState(null);
    const [actionModalSaving, setActionModalSaving] = useState(false);

    const openActionModal = (type, p) => setActionModal({ type, p, notes: '' });

    const runAction = async () => {
        if (!actionModal) return;
        const { type, p } = actionModal;
        const notes = (actionModal.notes || '').trim();
        if (type === 'sendback' && !notes) return toast?.error?.('Alasan sendback wajib diisi');
        if (type === 'sendback_tax' && !notes) return toast?.error?.('Alasan sendback wajib diisi');

        if (actionId) return;
        setActionId(p?.id);
        setActionModalSaving(true);
        try {
            if (type === 'approve') {
                const row = await invoiceService.approveProforma(p.id);
                toast?.success?.(`Disetujui. No Proforma: ${row.proforma_no}`);

            } else if (type === 'sendback') {
                await invoiceService.sendbackProforma(p.id, notes);
                toast?.success?.('Proforma dikembalikan ke requester');
            } else if (type === 'sendback_tax') {
                await invoiceService.sendbackTax(p.id, notes);
                toast?.success?.('Tax request dikembalikan ke requester');

            }
            setActionModal(null);
            loadAll();
        } catch (e) {
            toast?.error?.(e.message);
        } finally {
            setActionId(null);
            setActionModalSaving(false);
        }
    };

    const blankSettleRow = (src) => ({
        source_invoice_id: src?.id ?? null,
        no_invoice: '',
        tgl_invoice: src?.tgl_transaksi || '',
        no_faktur: '',
        dpp: src?.subtotal != null ? Number(src.subtotal) : '',
        ppn: src?.subtotal != null ? round2(Number(src.subtotal) * 0.11) : '',
        materai: src?.materai != null ? Number(src.materai) : '',
        diskon: src?.diskon != null ? Number(src.diskon) : '',
        tgl_settle: '',
    });

    const rowTotal = (r) => round2((parseFloat(r.dpp) || 0) + (parseFloat(r.ppn) || 0) + (parseFloat(r.materai) || 0) - (parseFloat(r.diskon) || 0));

    const hydrateDraftRows = (rows, p) => {
        // Tiap proforma berisi invoice sendiri-sendiri (DP & pelunasan terpisah).
        let srcs = (p.invoices || []).filter(i => i.status !== 'cancelled');
        if (!srcs.length) srcs = p.invoices?.length ? p.invoices : [null];
        if (Array.isArray(rows) && rows.length) {
            return rows.map(d => ({
                source_invoice_id: d.source_invoice_id ?? null,
                no_invoice: d.no_invoice || '',
                tgl_invoice: d.tgl_invoice || '',
                no_faktur: d.no_faktur || p.proforma_no || '',
                dpp: d.dpp != null && d.dpp !== '' ? d.dpp : '',
                ppn: d.ppn != null && d.ppn !== '' ? d.ppn : '',
                materai: d.materai != null && d.materai !== '' ? d.materai : '',
                diskon: d.diskon != null && d.diskon !== '' ? d.diskon : '',
                tgl_settle: d.tgl_settle || '',
            }));
        }
        return srcs.map(s => ({ ...blankSettleRow(s), no_faktur: p.proforma_no || '' }));
    };

    const openSettle = async (p) => {
        setSettleTarget(p);
        setSettleRows([]);
        setSettleNotes('');
        setSettleTglSet(new Date().toISOString().slice(0, 10));
        setSettleError(null);
        setSettleDraftAt(null);
        setShowSettle(true);
        try {
            const draft = await invoiceService.getSettleDraft(p.id).catch(() => null);
            if (draft?.rows) {
                setSettleRows(hydrateDraftRows(draft.rows, p));
                setSettleNotes(draft.notes || '');
                if (draft.tgl_settle) setSettleTglSet(draft.tgl_settle);
                if (draft.updated_at) setSettleDraftAt(draft.updated_at);
            } else {
                setSettleRows(hydrateDraftRows(null, p));
            }
        } catch {
            setSettleRows(hydrateDraftRows(null, p));
        }
    };

    const updateSettleRow = (idx, patch) => {
        setSettleRows(prev => prev.map((r, i) => {
            if (i !== idx) return r;
            const next = { ...r, ...patch };
            if (patch.dpp != null && !patch.ppn && !patch.ppn_manual) {
                next.ppn = round2((parseFloat(next.dpp) || 0) * 0.11);
            }
            return next;
        }));
    };

    const handleSettle = async () => {
        setSettleError(null);
        if (!settleRows.length) return setSettleError('Minimal satu invoice asli wajib diisi');
        for (const [i, r] of settleRows.entries()) {
            if (!String(r.no_invoice || '').trim()) return setSettleError(`Baris #${i + 1}: No invoice wajib diisi`);
            if (!String(r.tgl_invoice || '').trim()) return setSettleError(`Baris #${i + 1}: Tanggal invoice wajib diisi`);
            if (!((parseFloat(r.dpp) || 0) >= 0)) return setSettleError(`Baris #${i + 1}: DPP wajib diisi`);
        }
        const total = settleRows.reduce((s, r) => s + rowTotal(r), 0);
        // Nominal per-invoice: PP pakai uang_masuk, CBD/PF pakai total_invoice.
        const target = round2((settleTarget?.invoices || [])
            .filter(i => i.status !== 'cancelled')
            .reduce((s, i) => s + (i.tipe === 'PP' ? (parseFloat(i.uang_masuk) || 0) : (parseFloat(i.total_invoice) || 0)), 0));
        if (Math.abs(round2(total) - target) > 0.01) {
            return setSettleError(`Total invoice asli harus balance dengan total proforma (${formatCurrency(target)}). Saat ini ${formatCurrency(round2(total))}`);
        }
        if (settling) return;
        setSettling(true);
        try {
            const payload = {
                invoices: settleRows.map(r => ({
                    source_invoice_id: r.source_invoice_id,
                    no_invoice: r.no_invoice,
                    tgl_invoice: r.tgl_invoice,
                    no_faktur: r.no_faktur || settleTarget.proforma_no,
                    faktur_pajak_no: r.no_faktur || settleTarget.proforma_no,
                    dpp: r.dpp,
                    ppn: r.ppn,
                    ppn_rate: 0.11,
                    materai: r.materai,
                    diskon: r.diskon,
                    tgl_settle: r.tgl_settle || settleTglSet,
                })),
                notes: settleNotes,
            };
            await invoiceService.settleProforma(settleTarget.id, payload);
            toast?.success?.(`Proforma ${settleTarget.proforma_no} telah di-settle`);
            setShowSettle(false);
            loadAll();
        } catch (e) {
            setSettleError(e.message);
        } finally {
            setSettling(false);
        }
    };

    const handleSaveDraft = async () => {
        setSettleError(null);
        if (!settleRows.length) return setSettleError('Isi minimal satu baris invoice asli sebelum menyimpan draft');
        if (savingDraft) return;
        setSavingDraft(true);
        try {
            const payload = {
                invoices: settleRows.map(r => ({
                    source_invoice_id: r.source_invoice_id,
                    no_invoice: r.no_invoice,
                    tgl_invoice: r.tgl_invoice,
                    no_faktur: r.no_faktur || settleTarget.proforma_no,
                    faktur_pajak_no: r.no_faktur || settleTarget.proforma_no,
                    dpp: r.dpp,
                    ppn: r.ppn,
                    ppn_rate: 0.11,
                    materai: r.materai,
                    diskon: r.diskon,
                    tgl_settle: r.tgl_settle || settleTglSet,
                })),
                notes: settleNotes,
                tgl_settle: settleTglSet,
            };
            await invoiceService.saveSettleDraft(settleTarget.id, payload);
            toast?.success?.(`Draft settle ${settleTarget.proforma_no} tersimpan`);
            setSettleDraftAt(new Date().toISOString());
            loadAll();
        } catch (e) {
            setSettleError(e.message);
        } finally {
            setSavingDraft(false);
        }
    };

    const saveRule = async () => {
        if (!ruleForm.target_value.trim()) return toast?.error?.('Nilai target wajib diisi');
        if (savingRule) return;
        setSavingRule(true);
        try {
            if (ruleEditId) {
                await invoiceService.updateRule(ruleEditId, ruleForm);
                toast?.success?.('Rule diperbarui');
            } else {
                await invoiceService.createRule(ruleForm);
                toast?.success?.('Rule ditambahkan');
            }
            setRuleEditId(null);
            setRuleForm(EMPTY_RULE_FORM());
            loadAll();
        } catch (e) {
            toast?.error?.(e.message);
        } finally {
            setSavingRule(false);
        }
    };

    const editRule = (r) => {
        setRuleEditId(r.id);
        const f = EMPTY_RULE_FORM();
        f.target_type = r.target_type;
        f.target_value = r.target_value;
        f.is_active = !!r.is_active;
        ALL_PERM_FIELDS.forEach(k => { f[k] = !!r[k]; });
        setRuleForm(f);
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
        const no = String(taxForm.faktur_pajak_no || '').trim();
        if (!no) return toast?.error?.('No faktur pajak wajib diisi');
        if (!/^\d{17}$/.test(no)) return toast?.error?.('No faktur pajak harus 17 digit angka');
        if (!taxForm.file) return toast?.error?.('File faktur pajak wajib dilampirkan');
        const fd = new FormData();
        fd.append('faktur_pajak_no', no);
        if (taxForm.file) fd.append('faktur_pajak', taxForm.file);
        if (savingTax) return;
        setSavingTax(true);
        try {
            await invoiceService.submitTax(taxTarget.id, fd);
            toast?.success?.('Faktur pajak tersimpan');
            setShowTax(false);
            loadAll();
        } catch (e) {
            toast?.error?.(e.message);
        } finally {
            setSavingTax(false);
        }
    };

    const handleSubmitTax = async (invId) => {
        if (!taxRequestFiles.length) return toast?.error?.('Lampiran wajib diunggah');
        const fd = new FormData();
        taxRequestFiles.forEach(f => fd.append('attachments', f));
        fd.append('notes', taxRequestNotes);
        if (savingTaxRequest) return;
        setSavingTaxRequest(true);
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
        } finally {
            setSavingTaxRequest(false);
        }
    };

    const openTaxRequest = (inv) => {
        setTaxRequestTarget(inv);
        setTaxRequestFiles([]);
        setTaxRequestNotes('');
        setShowTaxRequest(true);
    };

    // ── Detail modal ──
    const [showDetail, setShowDetail] = useState(false);
    const [detailTarget, setDetailTarget] = useState(null);

    const openDetail = async (target) => {
        setShowDetail(true);
        // Set target awal (supaya modal langsung terbuka)
        setDetailTarget(target);
        // Fetch data lengkap termasuk items
        try {
            const detail = await invoiceService.getById(target.id);
            setDetailTarget(prev => ({ ...prev, ...detail }));
        } catch (e) {
            // tetap tampilkan target awal jika gagal fetch
        }
    };

    const openProforma = (inv) => {
        if (!inv) return;
        const prev = findProformaByInvoice(inv.id);
        const isResubmit = prev && prev.status === 'sent_back';
        const prevIds = isResubmit && (prev.invoices || []).length
            ? (prev.invoices || []).map(i => Number(i.id))
            : [Number(inv.id)];
        const prevFiles = isResubmit && prev.attachments
            ? parseJsonArray(prev.attachments)
            : [];
        setProformaForm({ invoice_ids: prevIds, attachments: prevFiles });
        setProformaFiles([]);
        setProformaResubmit(!!isResubmit);
        setShowProforma(true);
    };

    // ── Audit Trail modal ──
    const [showAudit, setShowAudit] = useState(false);
    const [auditTarget, setAuditTarget] = useState(null);

    // ESC menutup modal paling atas (konsisten dengan komponen Modal bersama)
    useModalKeydown(() => {
        if (permTarget) { setPermTarget(null); return; }
        if (deleteTarget) { setDeleteTarget(null); return; }
        if (deleteReplTarget) { setDeleteReplTarget(null); return; }
        if (cancelTarget) { setCancelTarget(null); return; }
        if (showAudit) { setShowAudit(false); return; }
        if (showDetail) { setShowDetail(false); return; }
        if (showTaxRequest) { setShowTaxRequest(false); return; }
        if (showTax) { setShowTax(false); return; }
        if (showSettle) { setShowSettle(false); return; }
        if (showProforma) { setShowProforma(false); return; }
        if (showNewInvoice) { setShowNewInvoice(false); return; }
        if (recipOpen) { setRecipOpen(false); return; }
        if (attachTarget) { setAttachTarget(null); return; }
    });

    // Kunci scroll body saat salah satu modal inline terbuka (konsisten dengan Modal bersama)
    useModalScrollLock(!!(permTarget || deleteTarget || deleteReplTarget || cancelTarget || showAudit || showDetail || showTaxRequest || showTax || showSettle || showProforma || showNewInvoice || recipOpen || attachTarget));

    const openAudit = (target) => {
        setAuditTarget(target);
        setShowAudit(true);
    };

    // ── Master Dealer handlers ──
    const saveDealer = async () => {
        if (!/^\d{16}$/.test(String(dealerForm.npwp).trim())) return toast?.error?.('NPWP harus 16 digit angka');
        if (!dealerForm.nama.trim()) return toast?.error?.('Nama dealer wajib diisi');
        if (savingDealer) return;
        setSavingDealer(true);
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
        } finally {
            setSavingDealer(false);
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
        if (importing) return;
        setImporting(true);
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
        } finally {
            setImporting(false);
        }
    };

    const handleBarangImport = async (file) => {
        if (!file) return;
        if (importing) return;
        setImporting(true);
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
        } finally {
            setImporting(false);
        }
    };

    // ── Master Barang handlers ──
    const saveBarang = async () => {
        if (!barangForm.model.trim()) return toast?.error?.('Model wajib diisi');
        if (savingBarang) return;
        setSavingBarang(true);
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
        } finally {
            setSavingBarang(false);
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

    const inDateRange = (val) => {
        if (!dateFrom && !dateTo) return true;
        const d = val ? String(val).slice(0, 10) : '';
        if (!d) return true;
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
    };

    const matchSearch = (item, keys) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return keys.some(k => {
            const v = item[k];
            if (v == null) return false;
            return String(v).toLowerCase().includes(q);
        });
    };

    const filteredInvoices = useMemo(() => {
        const rows = invoices.filter(i =>
            (!invStatus || i.status === invStatus) &&
            inDateRange(i.tgl_transaksi || i.created_at) &&
            matchSearch(i, ['dealer_name', 'no_po', 'proforma_no', 'no_invoice', 'faktur_pajak_no', 'tipe', 'id'])
        );
        const dir = invSortDir === 'asc' ? 1 : -1;
        const k = invSortKey;
        return [...rows].sort((a, b) => {
            let va = a[k], vb = b[k];
            if (k === 'uang_masuk' || k === 'total_invoice' || k === 'id') { va = Number(va) || 0; vb = Number(vb) || 0; }
            else { va = String(va ?? ''); vb = String(vb ?? ''); }
            if (typeof va === 'number') return (va - vb) * dir;
            return String(va).localeCompare(String(vb), 'id') * dir;
        });
    }, [invoices, search, dateFrom, dateTo, invStatus, invSortKey, invSortDir]);

    // Expand/collapse: pelunasan shown as sub-rows only when its DP is expanded.
    const toggleExpandDp = (id) => {
        setExpandedDps(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };
    // Root rows for pagination = filteredInvoices excluding pelunasan (pelunasan render as expandable sub-rows).
    const rootInvoiceRows = useMemo(() =>
        filteredInvoices.filter(i => !(i.tipe === 'PP' && i.pp_type === 'pelunasan')),
        [filteredInvoices]
    );
    const pelunasanChildrenOf = (dpId) => filteredInvoices.filter(i =>
        String(i.pelunasan_of_id) === String(dpId) && i.tipe === 'PP' && i.pp_type === 'pelunasan'
    );

    const filteredProformas = useMemo(() => {
        return proformas.filter(p =>
            (p.invoices || []).some(inv => inv.status !== 'cancelled') &&
            (!profStatus || p.status === profStatus) &&
            inDateRange(p.requested_at || p.created_at) &&
            (matchSearch(p, ['proforma_no', 'requested_by', 'id', 'total_nominal']) ||
                (p.invoices || []).some(inv => matchSearch(inv, ['dealer_name', 'no_po', 'no_invoice', 'faktur_pajak_no'])))
        );
    }, [proformas, search, dateFrom, dateTo, profStatus]);

    const filteredDealers = useMemo(() => {
        return dealers.filter(d =>
            inDateRange(d.created_at) &&
            matchSearch(d, ['nama', 'npwp', 'alamat', 'id'])
        );
    }, [dealers, search, dateFrom, dateTo]);

    const filteredBarang = useMemo(() => {
        return barang.filter(b =>
            inDateRange(b.created_at) &&
            matchSearch(b, ['model', 'item_description', 'harga', 'id'])
        );
    }, [barang, search, dateFrom, dateTo]);

    const filteredRules = useMemo(() => {
        return rules.filter(r =>
            inDateRange(r.created_at) &&
            matchSearch(r, ['target_type', 'target_value', 'id'])
        );
    }, [rules, search, dateFrom, dateTo]);

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

    const proformaBlockedInvoiceIds = useMemo(() => {
        const s = new Set();
        (proformas || []).filter(p => p.status === 'pending' || p.status === 'approved').forEach(p => {
            (p.invoices || []).forEach(inv => s.add(Number(inv.id)));
        });
        return s;
    }, [proformas]);

    const findProformaByInvoice = (invId) => {
        const id = Number(invId);
        return (proformas || []).find(p => (p.invoices || []).some(inv => Number(inv.id) === id));
    };

    const taxItems = useMemo(() => {
        // Tab Tax menampilkan SELURUH history proforma (seperti tab Proforma),
        // dengan fokus pada lampiran faktur pajak per invoice.
        // Filter status memakai status TAX (turunan dari invoice), bukan status proforma.
        return proformas.filter(p =>
            (p.invoices || []).some(inv => inv.status !== 'cancelled') &&
            (!taxStatus || taxKeyOfProforma(p) === taxStatus) &&
            inDateRange(p.requested_at || p.created_at) &&
            (matchSearch(p, ['proforma_no', 'requested_by', 'id', 'total_nominal']) ||
                (p.invoices || []).some(inv => matchSearch(inv, ['dealer_name', 'no_po', 'no_invoice', 'faktur_pajak_no'])))
        );
    }, [proformas, search, dateFrom, dateTo, taxStatus]);

    const pagedInvoices = usePager(rootInvoiceRows.length);
    const pagedProformas = usePager(filteredProformas.length);
    const pagedTax = usePager(taxItems.length);
    const pagedDealers = usePager(filteredDealers.length);
    const pagedBarang = usePager(filteredBarang.length);
    const pagedRules = usePager(filteredRules.length);

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

    // ── Ringkasan ──
    const summary = useMemo(() => {
        const now = Date.now();
        const day = 86400000;
        const aged = (proformas || []).filter(p => {
            const at = p.requested_at ? new Date(p.requested_at).getTime() : null;
            return at && p.status === 'approved' && (now - at) > 30 * day;
        });
        const pendingTax = (proformas || []).filter(p => p.status === 'approved' && (p.invoices || []).some(inv => inv.status === 'tax_requested'));
        const totalInvoice = (invoices || []).reduce((s, i) => s + (parseFloat(i.total_invoice) || 0), 0);
        const totalSettled = (proformas || []).filter(p => p.status === 'settled').reduce((s, p) => s + (parseFloat(p.settled_amount) || 0), 0);
        const pendingProforma = (proformas || []).filter(p => p.status === 'pending');
        const sentBackProforma = (proformas || []).filter(p => p.status === 'sent_back');
        return {
            totalInvoice: invoices.length,
            totalProforma: (proformas || []).length,
            totalApproved: (proformas || []).filter(p => p.status === 'approved').length,
            totalSettled: (proformas || []).filter(p => p.status === 'settled').length,
            pendingTax: pendingTax.length,
            pendingProforma: pendingProforma.length,
            sentBackProforma: sentBackProforma.length,
            aged30: aged.length,
            aged30List: aged,
            nominalInvoice: totalInvoice,
            nominalSettled: totalSettled,
            totalNominal: (proformas || []).reduce((s, p) => s + (parseFloat(p.total_nominal) || 0), 0),
        };
    }, [invoices, proformas]);

    // ── Notifikasi penting (ringkasan yang perlu tindakan) ──
    const actionSummary = useMemo(() => {
        const items = [];
        const pendingCount = summary.pendingProforma;
        const taxCount = summary.pendingTax;
        const agedCount = summary.aged30;
        const sentBackCount = summary.sentBackProforma;
        if (pendingCount > 0) items.push({ type: 'proforma', label: `${pendingCount} proforma menunggu approve`, tab: 'proforma' });
        if (taxCount > 0) items.push({ type: 'tax', label: `${taxCount} proforma menunggu faktur pajak`, tab: 'tax' });
        if (agedCount > 0) items.push({ type: 'aged', label: `${agedCount} proforma >30 hari belum settle`, tab: 'invoice' });
        if (sentBackCount > 0) items.push({ type: 'sentback', label: `${sentBackCount} proforma dikirim balik`, tab: 'proforma' });
        return items;
    }, [summary]);

    // ── Dashboard data ──
    const dashRows = useMemo(() => {
        return (invoices || []).map(inv => {
            const prof = findProformaByInvoice(inv.id);
            return {
                ...inv,
                _proforma: prof,
                _proformaAttachments: prof ? parseJsonArray(prof.attachments) : [],
            };
        });
    }, [invoices, proformas]);

    const dashDealerOptions = useMemo(() =>
        [...new Set((invoices || []).map(i => i.dealer_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id')),
        [invoices]
    );

    const dashStatusOptions = useMemo(() =>
        [...new Set((invoices || []).map(i => i.status).filter(Boolean))].map(s => ({ value: s, label: STATUS_MAP[s]?.label || s })),
        [invoices]
    );

    const dashFiltered = useMemo(() => {
        const q = dashSearch.trim().toLowerCase();
        let rows = dashRows;
        if (dashDealer) rows = rows.filter(r => r.dealer_name === dashDealer);
        if (dashStatus) rows = rows.filter(r => r.status === dashStatus);
        if (q) {
            rows = rows.filter(r =>
                [r.id, r.dealer_name, r.no_po, r.proforma_no, r.no_invoice, r.faktur_pajak_no, r.tipe]
                    .some(v => v != null && String(v).toLowerCase().includes(q))
            );
        }
        const dir = dashSortDir === 'asc' ? 1 : -1;
        const k = dashSortKey;
        return [...rows].sort((a, b) => {
            let va = a[k], vb = b[k];
            if (k === 'uang_masuk' || k === 'total_invoice' || k === 'id') { va = Number(va) || 0; vb = Number(vb) || 0; }
            else { va = String(va ?? ''); vb = String(vb ?? ''); }
            if (typeof va === 'number') return (va - vb) * dir;
            return String(va).localeCompare(String(vb), 'id') * dir;
        });
    }, [dashRows, dashSearch, dashDealer, dashStatus, dashSortKey, dashSortDir]);

    const dashRootRows = useMemo(() =>
        dashFiltered.filter(i => !(i.tipe === 'PP' && i.pp_type === 'pelunasan')),
        [dashFiltered]
    );
    const dashPelunasanChildrenOf = (dpId) => dashFiltered.filter(i =>
        String(i.pelunasan_of_id) === String(dpId) && i.tipe === 'PP' && i.pp_type === 'pelunasan'
    );

    const pagedDashboard = usePager(dashRootRows.length);

    const dashToggleSort = (key) => {
        if (dashSortKey === key) setDashSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        else { setDashSortKey(key); setDashSortDir('asc'); }
    };

    const invToggleSort = (key) => {
        if (invSortKey === key) setInvSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        else { setInvSortKey(key); setInvSortDir('asc'); }
    };

    // ── Shared invoice-table row renderer (dipakai di tab Dashboard & Invoices) ──
    const ROW_COLS = [
        { k: 'status', label: 'Status', right: false },
        { k: 'dealer_name', label: 'Dealer', right: false },
        { k: 'no_po', label: 'No. PO', right: false },
        { k: 'tipe', label: 'Tipe', right: false },
        { k: 'tgl_transaksi', label: 'Tgl Transaksi', right: false },
        { k: 'total_invoice', label: 'Total', right: true },
        { k: 'uang_masuk', label: 'Uang Masuk', right: true },
        { k: 'proforma_no', label: 'No Proforma', right: false },
    ];

    const InvoiceTableHeader = ({ sortKey, sortDir, onSort, withActions = true }) => (
        <tr>
            <th className="w-8 px-1 py-3"><span className="sr-only">Select</span></th>
            <th className={`${TH_CLS} text-left`}>No</th>
            {withActions && <th className={`${TH_CLS} text-left`}>Aksi</th>}
            {ROW_COLS.map(col => (
                <th key={col.k} className={`${TH_SORT_CLS} ${col.right ? 'text-right' : 'text-left'}`} onClick={() => onSort(col.k)}>
                    <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortKey === col.k
                            ? (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)
                            : <ArrowUpDown size={12} className="opacity-40" />}
                    </span>
                </th>
            ))}
        </tr>
    );

    const renderInvoiceRows = (rootRows, pager, opts = {}) => {
        const { withActions = true, childrenOf = pelunasanChildrenOf, emptyText = 'Belum ada invoice' } = opts;
        const colSpan = withActions ? 11 : 10;
        if (loading) {
            return Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skel-${i}`} className="border-b border-white/60 dark:border-white/10">
                    <td className="w-8 px-1 py-3"></td>
                    <td className="px-4 py-3"><div className="h-4 w-6 bg-stone-200 dark:bg-[#111] rounded animate-pulse"></div></td>
                    {withActions && <td className="px-4 py-3"><div className="h-6 w-6 bg-stone-200 dark:bg-[#111] rounded-lg animate-pulse"></div></td>}
                    <td className="px-4 py-3"><div className="h-5 w-20 bg-stone-200 dark:bg-[#111] rounded-full animate-pulse"></div></td>
                    <td className="px-4 py-3"><div className="h-4 w-32 bg-stone-200 dark:bg-[#111] rounded animate-pulse mb-1"></div><div className="h-3 w-20 bg-stone-200 dark:bg-[#111] rounded animate-pulse"></div></td>
                    <td className="px-4 py-3"><div className="h-4 w-20 bg-stone-200 dark:bg-[#111] rounded animate-pulse"></div></td>
                    <td className="px-4 py-3"><div className="h-5 w-10 bg-stone-200 dark:bg-[#111] rounded-full animate-pulse"></div></td>
                    <td className="px-4 py-3"><div className="h-4 w-24 bg-stone-200 dark:bg-[#111] rounded animate-pulse"></div></td>
                    <td className="px-4 py-3 text-right"><div className="h-4 w-24 bg-stone-200 dark:bg-[#111] rounded animate-pulse ml-auto"></div></td>
                    <td className="px-4 py-3 text-right"><div className="h-4 w-24 bg-stone-200 dark:bg-[#111] rounded animate-pulse ml-auto"></div></td>
                    <td className="px-4 py-3"><div className="h-4 w-20 bg-stone-200 dark:bg-[#111] rounded animate-pulse"></div></td>
                </tr>
            ));
        }
        if (rootRows.length === 0) {
            return <tr><td colSpan={colSpan} className="px-4 py-10 text-center text-stone-400">{emptyText}</td></tr>;
        }
        return pager.slice(rootRows).flatMap((inv, rowIdx) => {
            const isDp = inv.tipe === 'PP' && (inv.pp_type === 'dp' || !inv.pelunasan_of_id);
            const kids = isDp ? childrenOf(inv.id) : [];
            const hasKids = kids.length > 0;
            const expanded = expandedDps.has(inv.id);
            const rowBg = rowIdx % 2 === 0 ? 'bg-white/60 dark:bg-[#0d0d0d]/50' : 'bg-stone-50/70 dark:bg-[#0d0d0d]/30';
            const rows = [];
            rows.push(
                <tr key={inv.id} onClick={() => openDetail(inv)} className={TROW_CLS + ' ' + rowBg + ' cursor-pointer'}>
                    <td className="w-8 px-1 py-3 text-center">
                        {hasKids && (
                            <button onClick={(e) => { e.stopPropagation(); toggleExpandDp(inv.id); }} className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-stone-500 hover:text-blue-600 hover:bg-stone-200/70 dark:hover:bg-white/[0.06] transition-colors" title={expanded ? 'Sembunyikan pelunasan' : 'Tampilkan pelunasan'}>
                                {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            </button>
                        )}
                    </td>
                    <td className="px-4 py-3 font-bold text-stone-500 dark:text-white/40 tabular-nums text-center">{pager.start + rowIdx + 1}</td>
                    {withActions && (
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <button onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setActionMenu(prev => prev && prev.inv?.id === inv.id ? null : openRowMenu(inv, r, 'invoice')); }} className={'p-1.5 rounded-lg transition-colors ' + (actionMenu?.inv?.id === inv.id ? 'bg-blue-50 text-blue-600 dark:bg-[#0d0d0d]' : 'text-stone-400 hover:bg-stone-100 dark:hover:bg-white/[0.05] hover:text-stone-600 dark:hover:text-white/80')} title="Aksi">
                                <MoreVertical size={15} />
                            </button>
                        </td>
                    )}
                    <td className="px-4 py-3">
                        <span className={'inline-block whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] font-bold leading-tight ' + (STATUS_MAP[inv.status]?.cls || '')}>{STATUS_MAP[inv.status]?.label || inv.status}</span>
                        <StatusStepper status={inv.status} t={t} />
                    </td>
                    <td className="px-4 py-3">
                        <div className="font-semibold text-stone-800 dark:text-white truncate max-w-[220px]" title={inv.dealer_name || '-'}>{inv.dealer_name || '-'}</div>
                        <div className="text-[10px] text-stone-400 truncate max-w-[220px]" title={'NPWP: ' + (inv.dealer_npwp || '-')}>NPWP: {inv.dealer_npwp || '-'}</div>
                    </td>
                    <td className={TD_CLS + ' whitespace-nowrap'}>{inv.no_po || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-stone-100 dark:bg-[#0d0d0d] text-stone-700 dark:text-white/80">{inv.tipe}</span>
                        {isDp && <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">DP</span>}
                        {hasKids && <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" title={kids.length + ' pelunasan'}>{kids.length}x PLN</span>}
                    </td>
                    <td className={TD_CLS + ' whitespace-nowrap'}>{inv.tgl_transaksi || '-'}</td>
                    <td className={NUM_RIGHT + ' font-bold text-stone-800 dark:text-white'}>{formatCurrency(inv.total_invoice)}</td>
                    <td className={NUM_RIGHT + ' text-stone-600 dark:text-white/70'}>{formatCurrency(inv.uang_masuk)}</td>
                    <td className="px-4 py-3 text-blue-600 dark:text-blue-400 font-semibold text-xs whitespace-nowrap">
                        {inv.proforma_no || '-'}
                        {inv.no_invoice && <div className="text-[9px] text-stone-400 font-medium mt-0.5">No: {inv.no_invoice}</div>}
                        {(() => {
                            const chain = (inv.rejected_from_id || inv.replacement_id) ? buildRejectChain(inv, invoices) : [];
                            if (chain.length < 2) return null;
                            return (
                                <div className="flex flex-wrap items-center gap-0.5 mt-0.5" title={`Riwayat reject: ${chain.map(c => `#${c.id}${c.no_invoice ? ' (' + c.no_invoice + ')' : ''}`).join(' → ')}`}>
                                    <span className="text-[8px] font-bold uppercase tracking-wider text-stone-400 mr-0.5">Rwy:</span>
                                    {chain.map((c, idx) => {
                                        const isCur = Number(c.id) === Number(inv.id);
                                        return (
                                            <React.Fragment key={c.id}>
                                                {idx > 0 && <span className="text-[8px] text-stone-300 dark:text-stone-600">→</span>}
                                                <span className={`px-1 py-px rounded text-[8px] font-bold leading-tight ${isCur ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/25 dark:text-blue-300' : c.status === 'rejected' ? 'bg-red-50 text-rose-500 dark:bg-red-500/10' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10'}`}>
                                                    #{c.id}{c.no_invoice ? ` ${c.no_invoice}` : ''}
                                                </span>
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </td>
                </tr>
            );
            if (hasKids && expanded) {
                kids.forEach((child) => {
                    rows.push(
                        <tr key={'child-' + child.id} onClick={() => openDetail(child)} className={TROW_CLS + ' bg-blue-50/40 dark:bg-blue-500/5 cursor-pointer'}>
                            <td className="w-8 px-1 py-3 text-center text-blue-400">↳</td>
                            <td className="px-4 py-3"></td>
                            {withActions && (
                                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                    <button onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setActionMenu(prev => prev && prev.inv?.id === child.id ? null : openRowMenu(child, r, 'invoice')); }} className={'p-1.5 rounded-lg transition-colors ' + (actionMenu?.inv?.id === child.id ? 'bg-blue-50 text-blue-600 dark:bg-[#0d0d0d]' : 'text-stone-400 hover:bg-stone-100 dark:hover:bg-white/[0.05] hover:text-stone-600 dark:hover:text-white/80')} title="Aksi">
                                        <MoreVertical size={15} />
                                    </button>
                                </td>
                            )}
                            <td className="px-4 py-3">
                                <span className={'inline-block whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] font-bold leading-tight ' + (STATUS_MAP[child.status]?.cls || '')}>{STATUS_MAP[child.status]?.label || child.status}</span>
                                <StatusStepper status={child.status} />
                            </td>
                            <td className="px-4 py-3">
                                <div className="font-semibold text-stone-700 dark:text-white/80 truncate max-w-[220px] pl-5" title={child.dealer_name || '-'}>{child.dealer_name || '-'}</div>
                                <div className="text-[10px] text-stone-400 truncate max-w-[220px]" title={'NPWP: ' + (child.dealer_npwp || '-')}>NPWP: {child.dealer_npwp || '-'}</div>
                            </td>
                            <td className={TD_CLS + ' whitespace-nowrap'}>{child.no_po || '-'}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                                <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-stone-100 dark:bg-[#0d0d0d] text-stone-700 dark:text-white/80">{child.tipe}</span>
                                <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">PELUNASAN</span>
                            </td>
                            <td className={TD_CLS + ' whitespace-nowrap'}>{child.tgl_transaksi || '-'}</td>
                            <td className={NUM_RIGHT + ' font-bold text-stone-700 dark:text-white/80'}>{formatCurrency(child.total_invoice)}</td>
                            <td className={NUM_RIGHT + ' text-blue-600 dark:text-blue-400 font-semibold'}>{formatCurrency(child.uang_masuk)}</td>
                            <td className="px-4 py-3 text-blue-600 dark:text-blue-400 font-semibold text-xs whitespace-nowrap">{child.proforma_no || '-'}</td>
                        </tr>
                    );
                });
            }
            return rows;
        });
    };

    const dashStatusDist = useMemo(() => {
        const map = {};
        (invoices || []).forEach(i => {
            const key = STATUS_MAP[i.status]?.label || i.status || 'unknown';
            map[key] = (map[key] || 0) + 1;
        });
        let entries = Object.entries(map).map(([name, value]) => ({ name, value }));
        if (entries.length > 5) {
            entries.sort((a, b) => b.value - a.value);
            const rest = entries.slice(5).reduce((s, e) => s + e.value, 0);
            entries = [...entries.slice(0, 5)];
            if (rest > 0) entries.push({ name: 'Lainnya', value: rest });
        }
        return entries;
    }, [invoices]);

    const CHART_COLORS = ['#6366f1', '#f59e0b', '#ef4444', '#f97316', '#8b5cf6', '#10b981', '#94a3b8', '#3b82f6'];

    const dashMonthly = useMemo(() => {
        const map = {};
        (invoices || []).forEach(i => {
            const d = String(i.tgl_transaksi || i.created_at || '').slice(0, 7);
            if (!/^\d{4}-\d{2}$/.test(d)) return;
            map[d] = map[d] || { month: d, invoice: 0, masuk: 0, settled: 0 };
            map[d].invoice += Number(i.total_invoice) || 0;
            map[d].masuk += Number(i.uang_masuk) || 0;
        });
        (proformas || []).forEach(p => {
            if (p.status !== 'settled') return;
            const d = String(p.settled_at || '').slice(0, 7);
            if (!/^\d{4}-\d{2}$/.test(d)) return;
            map[d] = map[d] || { month: d, invoice: 0, masuk: 0, settled: 0 };
            map[d].settled += Number(p.settled_amount) || 0;
        });
        return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).slice(-6)
            .map(([k, v]) => ({ ...v, month: `${k.slice(5)}/${k.slice(2, 4)}` }));
    }, [invoices, proformas]);

    const dashDealerTop = useMemo(() => {
        const map = {};
        (invoices || []).forEach(i => {
            const n = i.dealer_name || 'Unknown';
            map[n] = (map[n] || 0) + (Number(i.total_invoice) || 0);
        });
        return Object.entries(map).map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value).slice(0, 6);
    }, [invoices]);

    const renderTabBtn = (id, icon, label) => (
        <button
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === id
                ? 'gradient-bg text-white shadow-lg shadow-blue-500/25'
                : 'text-stone-600 dark:text-white/70 hover:bg-stone-100 dark:hover:bg-white/[0.05]'}`}
        >
            {icon}{label}
        </button>
    );

    const inputCls = "w-full rounded-xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl px-3 py-2 text-sm text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500";

    return (
        <div className="p-4 md:p-6 space-y-4">

            {/* ── Dashboard Cards (di atas tab) ── */}
            <SummaryRow cards={[
                { title: 'Total Invoice', value: summary.totalInvoice.toLocaleString('id-ID'), icon: Receipt, gradient: 'from-blue-600 to-blue-700', subtext: `${formatCurrency(summary.nominalInvoice)} • ${summary.sentBackProforma} sent back`, valueClass: 'text-2xl' },
                { title: 'Proforma', value: summary.totalProforma.toLocaleString('id-ID'), icon: FileSignature, gradient: 'from-amber-500 to-orange-600', subtext: `${summary.totalApproved} approved • ${summary.pendingProforma} pending • ${formatCurrency(summary.totalNominal)}`, valueClass: 'text-2xl' },
                { title: 'Menunggu Tax', value: summary.pendingTax.toLocaleString('id-ID'), icon: FileText, gradient: 'from-blue-600 to-blue-700', subtext: 'Proforma perlu faktur pajak — segera lampirkan', valueClass: 'text-2xl' },
                { title: 'Settled', value: summary.totalSettled.toLocaleString('id-ID'), icon: HandCoins, gradient: 'from-teal-500 to-emerald-700', subtext: `${formatCurrency(summary.nominalSettled)} • selesai di-settle`, valueClass: 'text-2xl' },
            ]} />

            {/* Notifikasi penting (1 baris ringkasan yang perlu tindakan) */}
            {actionSummary.length > 0 && (
                <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-white p-3.5 px-4 shadow-lg shadow-orange-500/25">
                    <div className="p-2.5 rounded-xl bg-white/20 shrink-0"><Megaphone size={18} /></div>
                    <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-bold">
                        <span className="uppercase tracking-widest text-[10px] font-black bg-white/20 px-2 py-0.5 rounded-lg shrink-0">Perlu Tindakan</span>
                        {actionSummary.map((a, i) => (
                            <span key={a.type}>
                                <button
                                    onClick={() => setTab(a.tab)}
                                    className="underline decoration-white/50 underline-offset-2 hover:bg-white/20 hover:decoration-white rounded-md px-1 transition-colors"
                                    title={`Buka tab ${a.tab}`}
                                >
                                    {a.label}
                                </button>
                                {i < actionSummary.length - 1 && <span className="mx-1 text-white/50">•</span>}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Header / Tabs + Aksi */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-1.5 flex-wrap">
                    {perms.can_view_dashboard && renderTabBtn('dashboard', <LayoutDashboard size={16} />, 'Dashboard')}
                    {perms.can_view_invoice && renderTabBtn('invoice', <Receipt size={16} />, 'Invoices')}
                    {perms.can_view_proforma && renderTabBtn('proforma', <FileSignature size={16} />, 'Proforma')}
                    {perms.can_view_tax && renderTabBtn('tax', <FileText size={16} />, 'Tax')}
                    {perms.can_view_dealer && renderTabBtn('dealer', <Landmark size={16} />, 'Master Dealer')}
                    {perms.can_view_barang && renderTabBtn('barang', <Package size={16} />, 'Master Barang')}
                    {perms.can_view_rule && renderTabBtn('rule', <ShieldCheck size={16} />, 'Rule')}
                    {perms.can_view_flow && renderTabBtn('flow', <Workflow size={16} />, 'Flow')}
                    {isAdmin && renderTabBtn('trash', <Trash2 size={16} />, 'Sampah')}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {tab !== 'dashboard' && (
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder={t("invoice.searchPlaceholder")}
                                className="pl-9 rounded-xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl px-3 py-2 text-sm text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                            />
                        </div>
                    )}
                    {tab !== 'dashboard' && (
                        <>
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="rounded-xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl px-2.5 py-2 text-sm text-stone-600 dark:text-white/70 focus:outline-none focus:ring-2 focus:ring-blue-500" title="Dari Tanggal" />
                            <span className="text-xs text-stone-400">s/d</span>
                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="rounded-xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl px-2.5 py-2 text-sm text-stone-600 dark:text-white/70 focus:outline-none focus:ring-2 focus:ring-blue-500" title="Sampai Tanggal" />
                            {(search || dateFrom || dateTo) && (
                                <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }} className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-[#0d0d0d] text-stone-500 hover:text-red-600 text-sm font-semibold" title="Reset filter">Reset</button>
                            )}
                        </>
                    )}
                    {tab === 'invoice' && perms.can_create && (
                        <button
                            onClick={openNewInvoice}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-lg shadow-emerald-500/25 transition-all"
                        >
                            <Plus size={16} /> New Invoice
                        </button>
                    )}
                    <button onClick={loadAll} className="p-2 rounded-xl text-stone-500 hover:text-blue-600 hover:bg-stone-100 dark:hover:bg-white/[0.05] transition-all" title="Refresh">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* ── Dashboard Tab ── */}
            {tab === 'dashboard' && (
                <div className="space-y-4">
                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Status distribution */}
                        <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-white/10 p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-bold text-stone-700 dark:text-white/70 flex items-center gap-2">
                                    <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"><PieChart size={14} /></span>
                                    Distribusi Status
                                </h2>
                                <span className="text-[11px] font-semibold text-stone-400 tabular-nums">{dashStatusDist.reduce((s, e) => s + e.value, 0)} invoice</span>
                            </div>
                            {dashStatusDist.length === 0 ? (
                                <div className="py-10 text-center text-sm text-stone-400">Belum ada data</div>
                            ) : (
                                <>
                                    <ResponsiveContainer width="100%" height={230}>
                                        <PieChart>
                                            <Pie data={dashStatusDist} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={52} outerRadius={76} paddingAngle={3}>
                                                {dashStatusDist.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip formatter={(v) => [`${v} invoice`, '']} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
                                        {dashStatusDist.map((e, i) => (
                                            <div key={e.name} className="flex items-center justify-between gap-2 text-xs">
                                                <span className="flex items-center gap-1.5 min-w-0">
                                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                                                    <span className="truncate text-stone-600 dark:text-white/70 font-medium">{e.name}</span>
                                                </span>
                                                <span className="font-bold text-stone-800 dark:text-white/80 tabular-nums">{e.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Monthly trend */}
                        <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-white/10 p-5 lg:col-span-2 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-bold text-stone-700 dark:text-white/70 flex items-center gap-2">
                                    <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><TrendingUp size={14} /></span>
                                    Tren Nominal (6 Bulan Terakhir)
                                </h2>
                                <span className="text-[11px] font-semibold text-stone-400">Total {formatCurrency(dashMonthly.reduce((s, d) => s + (d.invoice || 0), 0))}</span>
                            </div>
                            {dashMonthly.length === 0 ? (
                                <div className="py-10 text-center text-sm text-stone-400">Belum ada data</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={dashMonthly}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1e6)}jt`} />
                                        <Tooltip formatter={(v) => formatCurrency(v)} />
                                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                                        <Bar dataKey="invoice" name="Total Invoice" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="masuk" name={t("invoice.chartUangMasuk")} fill="#10b981" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="settled" name="Settled" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* Dealer top + overview strip */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-white/10 p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-bold text-stone-700 dark:text-white/70 flex items-center gap-2">
                                    <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"><Trophy size={14} /></span>
                                    Top Dealer
                                </h2>
                                <span className="text-[11px] font-semibold text-stone-400">by nominal invoice</span>
                            </div>
                            {dashDealerTop.length === 0 ? (
                                <div className="py-10 text-center text-sm text-stone-400">Belum ada data</div>
                            ) : (
                                <div className="space-y-3">
                                    {dashDealerTop.map((d, i) => {
                                        const max = dashDealerTop[0]?.value || 1;
                                        const rankCls = i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' : i === 1 ? 'bg-stone-200 text-stone-600 dark:bg-[#111] dark:text-white/70' : i === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300' : 'bg-stone-100 text-stone-400 dark:bg-[#0d0d0d] dark:text-white/30';
                                        return (
                                            <div key={d.name} className="group">
                                                <div className="flex items-center gap-2 text-xs mb-1">
                                                    <span className={`w-5 h-5 shrink-0 rounded-md flex items-center justify-center text-[10px] font-black ${rankCls}`}>{i + 1}</span>
                                                    <span className="font-semibold text-stone-600 dark:text-white/70 truncate flex-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{d.name}</span>
                                                    <span className="font-bold text-stone-700 dark:text-white/80 tabular-nums">{formatCurrency(d.value)}</span>
                                                    <span className="text-[10px] font-semibold text-stone-400 tabular-nums w-9 text-right">{Math.round((d.value / max) * 100)}%</span>
                                                </div>
                                                <div className="h-1.5 rounded-full bg-stone-100 dark:bg-[#0d0d0d] overflow-hidden ml-7">
                                                    <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-500" style={{ width: `${(d.value / max) * 100}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Quick stats */}
                        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { label: 'Total Invoice', val: summary.totalInvoice.toLocaleString('id-ID'), sub: formatCurrency(summary.nominalInvoice), icon: <Receipt size={16} />, cls: 'from-blue-600 to-blue-700', w: 'text-blue-100' },
                                { label: 'Proforma', val: summary.totalProforma.toLocaleString('id-ID'), sub: `${summary.totalApproved} approved • ${summary.pendingProforma} pending`, icon: <FileSignature size={16} />, cls: 'from-amber-500 to-orange-600', w: 'text-amber-100' },
                                { label: 'Menunggu Tax', val: summary.pendingTax.toLocaleString('id-ID'), sub: 'perlu faktur pajak', icon: <FileText size={16} />, cls: 'from-blue-600 to-blue-700', w: 'text-blue-100' },
                                { label: 'Settled', val: summary.totalSettled.toLocaleString('id-ID'), sub: formatCurrency(summary.nominalSettled), icon: <HandCoins size={16} />, cls: 'from-teal-500 to-emerald-700', w: 'text-teal-100' },
                            ].map((c, i) => (
                                <div key={i} className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${c.cls} text-white p-4 shadow-lg`}>
                                    <div className="absolute -right-3 -top-3 opacity-15">{c.icon}</div>
                                    <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${c.w}`}>{c.icon} {c.label}</div>
                                    <div className="text-2xl font-black mt-2 leading-none">{c.val}</div>
                                    <div className={`text-[10px] font-semibold ${c.w} mt-1.5`}>{c.sub}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Table header + filters */}
                    <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl shadow-sm border border-white/60 dark:border-white/10 overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-white/60 dark:border-white/10">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600"><LayoutDashboard size={16} /></div>
                                <div>
                                    <h3 className="font-bold text-stone-800 dark:text-white">Daftar Invoice</h3>
                                    <div className="text-[11px] text-stone-400">{dashFiltered.length} data</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="relative">
                                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                                    <input value={dashSearch} onChange={e => setDashSearch(e.target.value)} placeholder={t("invoice.searchData")} className="pl-9 rounded-xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <select aria-label="Dealer" value={dashDealer} onChange={e => setDashDealer(e.target.value)} className="rounded-xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl px-3 py-2 text-sm text-stone-600 dark:text-white/70 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[160px]">
                                    <option value="">{t("opt.allDealer")}</option>
                                    {dashDealerOptions.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                                <select aria-label="Status" value={dashStatus} onChange={e => setDashStatus(e.target.value)} className="rounded-xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl px-3 py-2 text-sm text-stone-600 dark:text-white/70 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="">{t("opt.allStatus")}</option>
                                    {dashStatusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                                {(dashSearch || dashDealer || dashStatus) && (
                                    <button onClick={() => { setDashSearch(''); setDashDealer(''); setDashStatus(''); }} className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-[#0d0d0d] text-stone-500 hover:text-red-600 text-sm font-semibold">Reset</button>
                                )}
                                {(perms.can_view_invoice || perms.can_view_dashboard) && (
                                    <button
                                        onClick={handleExportExcel}
                                        disabled={exporting}
                                        title={t("invoice.exportAll")}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${exporting ? 'bg-stone-100 dark:bg-[#0d0d0d] text-stone-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/25'}`}
                                    >
                                        <FileSpreadsheet size={15} className={exporting ? 'animate-pulse' : ''} />
                                        {exporting ? 'Exporting...' : 'Export Excel'}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="overflow-auto max-h-[500px] custom-scrollbar" onScroll={() => setActionMenu(null)}>
                            <table className="w-full text-sm border-collapse min-w-[1100px]">
                                <thead>
                                    <InvoiceTableHeader sortKey={dashSortKey} sortDir={dashSortDir} onSort={dashToggleSort} withActions={false} />
                                </thead>
                                <tbody>
                                    {renderInvoiceRows(dashRootRows, pagedDashboard, { withActions: false, childrenOf: dashPelunasanChildrenOf, emptyText: t('invoice.emptyData') })}
                                </tbody>
                            </table>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-4 py-3 border-t border-stone-200 dark:border-white/[0.06] bg-stone-50/60 dark:bg-[#0d0d0d]/40">
                            <div className="flex flex-col gap-0.5 rounded-xl bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl border border-white/60 dark:border-white/10 px-3 py-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Jumlah Data</span>
                                <span className="text-sm font-bold text-stone-700 dark:text-white/80 tabular-nums">{dashFiltered.length} invoice</span>
                            </div>
                            <div className="flex flex-col gap-0.5 rounded-xl bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl border-l-4 border-l-teal-500 border border-white/60 dark:border-white/10 px-3 py-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Total Invoice</span>
                                <span className="text-sm font-black text-teal-600 dark:text-teal-400 tabular-nums whitespace-nowrap">{formatCurrency(dashFiltered.filter(r => !(r.pp_type === 'pelunasan')).reduce((s, r) => s + (parseFloat(r.total_invoice) || 0), 0))}</span>
                            </div>
                            <div className="flex flex-col gap-0.5 rounded-xl bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl border-l-4 border-l-blue-500 border border-white/60 dark:border-white/10 px-3 py-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Uang Masuk</span>
                                <span className="text-sm font-black text-blue-600 dark:text-blue-400 tabular-nums whitespace-nowrap">{formatCurrency(dashFiltered.reduce((s, r) => s + (parseFloat(r.uang_masuk) || 0), 0))}</span>
                            </div>
                            <div className="flex flex-col gap-0.5 rounded-xl bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl border-l-4 border-l-amber-500 border border-white/60 dark:border-white/10 px-3 py-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Sisa (Total − Uang Masuk)</span>
                                <span className="text-sm font-black text-amber-600 dark:text-amber-400 tabular-nums whitespace-nowrap">{formatCurrency(dashFiltered.filter(r => !(r.pp_type === 'pelunasan')).reduce((s, r) => s + (parseFloat(r.total_invoice) || 0), 0) - dashFiltered.reduce((s, r) => s + (parseFloat(r.uang_masuk) || 0), 0))}</span>
                            </div>
                        </div>
                        {(dashSearch || dashDealer || dashStatus) && (
                            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-white/60 dark:border-white/10">
                                <button onClick={() => { setDashSearch(''); setDashDealer(''); setDashStatus(''); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 hover:bg-red-100 dark:hover:bg-red-500/20 text-sm font-semibold transition-colors">
                                    <X size={14} /> Reset Filter
                                </button>
                            </div>
                        )}
                        <Pagination page={pagedDashboard.page} totalPages={pagedDashboard.totalPages} setPage={pagedDashboard.setPage} />
                    </div>
                </div>
            )}

            {/* ── Invoice List Tab ── */}
            {tab === 'invoice' && (
                <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl shadow-sm border border-white/60 dark:border-white/10 overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-white/60 dark:border-white/10">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600"><Receipt size={16} /></div>
                            <div>
                                <h3 className="font-bold text-stone-800 dark:text-white">Daftar Invoice</h3>
                                <div className="text-[11px] text-stone-400">{filteredInvoices.length} data</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <select aria-label="Status Invoice" value={invStatus} onChange={e => setInvStatus(e.target.value)} className="rounded-xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl px-3 py-2 text-sm text-stone-600 dark:text-white/70 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="">{t("opt.allStatus")}</option>
                                {dashStatusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                            {invStatus && <button onClick={() => setInvStatus('')} className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-[#0d0d0d] text-stone-500 hover:text-red-600 text-sm font-semibold">Reset</button>}
                        </div>
                    </div>
                        <div className="overflow-auto max-h-[600px] custom-scrollbar" onScroll={() => setActionMenu(null)}>
                            <table className="w-full text-sm border-collapse min-w-[1100px]">
                                <thead>
                                    <InvoiceTableHeader sortKey={invSortKey} sortDir={invSortDir} onSort={invToggleSort} withActions />
                                </thead>
                                <tbody>
                                    {renderInvoiceRows(rootInvoiceRows, pagedInvoices, { withActions: true, childrenOf: pelunasanChildrenOf, emptyText: 'Belum ada invoice' })}
                                </tbody>
                            </table>
                        </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-4 py-3 border-t border-stone-200 dark:border-white/[0.06]">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Jumlah Data</span>
                            <span className="text-sm font-bold text-stone-700 dark:text-white/80 tabular-nums">{filteredInvoices.length} invoice</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Total Invoice</span>
                            <span className="text-sm font-bold text-teal-600 dark:text-teal-400 tabular-nums whitespace-nowrap">{formatCurrency(filteredInvoices.filter(r => !(r.pp_type === 'pelunasan')).reduce((s, r) => s + (parseFloat(r.total_invoice) || 0), 0))}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Uang Masuk</span>
                            <span className="text-sm font-bold text-blue-600 dark:text-blue-400 tabular-nums whitespace-nowrap">{formatCurrency(filteredInvoices.reduce((s, r) => s + (parseFloat(r.uang_masuk) || 0), 0))}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Sisa (Total − Uang Masuk)</span>
                            <span className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums whitespace-nowrap">{formatCurrency(filteredInvoices.filter(r => !(r.pp_type === 'pelunasan')).reduce((s, r) => s + (parseFloat(r.total_invoice) || 0), 0) - filteredInvoices.reduce((s, r) => s + (parseFloat(r.uang_masuk) || 0), 0))}</span>
                        </div>
                    </div>
                    <Pagination page={pagedInvoices.page} totalPages={pagedInvoices.totalPages} setPage={pagedInvoices.setPage} />
                </div>
            )}

            {/* ── Proforma List Tab ── */}
            {tab === 'proforma' && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="font-bold text-stone-800 dark:text-white">Daftar Pengajuan Proforma</h3>
                        <div className="flex items-center gap-2">
                            <select aria-label="Status Proforma" value={profStatus} onChange={e => setProfStatus(e.target.value)} className="rounded-xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl px-3 py-2 text-sm text-stone-600 dark:text-white/70 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                {PROFORMA_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            {profStatus && <button onClick={() => setProfStatus('')} className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-[#0d0d0d] text-stone-500 hover:text-red-600 text-sm font-semibold" title="Reset filter">Reset</button>}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                    {filteredProformas.length === 0 && (
                        <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl p-10 text-center text-stone-400 border border-white/60 dark:border-white/10">
                            Belum ada pengajuan proforma
                        </div>
                    )}
                    {pagedProformas.slice(filteredProformas).map((p, pi) => (
                        <div key={p.id} className={`${pi % 2 === 0 ? 'bg-white/60 dark:bg-[#0d0d0d]/50' : 'bg-stone-50/70 dark:bg-[#0d0d0d]/30'} rounded-2xl border border-white/60 dark:border-white/10 p-5 space-y-3 hover:border-blue-200 dark:hover:border-blue-500/40 transition-colors`}>
                            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`p-3 rounded-2xl shrink-0 ${p.status === 'approved' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                                        : p.status === 'rejected' ? 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400'
                                        : p.status === 'settled' ? 'bg-teal-100 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400'
                                        : p.status === 'sent_back' ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400'
                                        : 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                                        {p.status === 'approved' ? <CheckCircle2 size={20} /> : p.status === 'rejected' ? <XCircle size={20} /> : p.status === 'settled' ? <HandCoins size={20} /> : p.status === 'sent_back' ? <RefreshCw size={20} /> : <Clock size={20} />}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-bold text-stone-800 dark:text-white truncate">
                                            {p.proforma_no || 'Menunggu No Proforma'}
                                        </div>
                                        <div className="text-xs text-stone-400">
                                            Diajukan: {p.requested_by || '-'} • {p.requested_at ? new Date(p.requested_at).toLocaleString('id-ID') : '-'}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                                    {/* Status badge dengan dot indikator */}
                                    {(() => {
                                        const st = PROFORMA_STATUS_BADGE[p.status] || PROFORMA_STATUS_BADGE.pending;
                                        return (
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${st.cls}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                                                {st.label}
                                            </span>
                                        );
                                    })()}
                                    {settleDraftIds.has(Number(p.id)) && p.status === 'approved' && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" title="Ada draft settle tersimpan">
                                            <Clock size={11} /> DRAFT
                                        </span>
                                    )}
                                    <div className="hidden sm:block w-px h-8 bg-stone-100 dark:bg-[#111] mx-0.5" />
                                    <button onClick={() => openDetail(p.invoices?.[0] || { id: p.id })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 font-semibold transition-colors" title="Lihat Detail Invoice">
                                        <FileText size={15} /> Detail
                                    </button>
                                    <button onClick={() => openAudit(p.invoices?.[0] || { id: p.id })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-500/20 font-semibold transition-colors" title="Lihat Audit Trail">
                                        <History size={15} /> Audit
                                    </button>
                                    {isAdmin && (
                                        <button onClick={() => openDeleteProforma(p)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 font-semibold transition-colors" title="Hapus Proforma beserta invoice-nya (hanya admin)">
                                            <Trash2 size={15} /> Hapus
                                        </button>
                                    )}
                                    {/* Total amount — terpisah, tidak wrap */}
                                    <div className="text-right pl-3 sm:pl-4 border-l-2 border-white/60 dark:border-white/10 max-w-full">
                                        <div className="text-[10px] text-stone-400 uppercase tracking-wider whitespace-nowrap">Total Proforma</div>
                                        <div className="text-lg font-black text-stone-800 dark:text-white tabular-nums whitespace-nowrap leading-tight max-w-full overflow-hidden" title={formatCurrency(p.total_nominal)}>{formatCurrency(p.total_nominal)}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {(p.invoices || []).filter(inv => inv.status !== 'cancelled').map(inv => {
                                    const invStatus = inv.status || 'proforma';
                                    const isTaxDone = invStatus === 'tax' || invStatus === 'settled';
                                    return (
                                        <div key={inv.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl gradient-bg-soft border border-white/60 dark:border-white/10 min-w-[200px] max-w-full hover:border-blue-200 dark:hover:border-blue-500/40 transition-colors">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${paymentBadge(inv).cls}`}>{paymentBadge(inv).label}</span>
                                                    <span className="text-xs font-semibold text-stone-700 dark:text-white/80 truncate" title={inv.dealer_name}>#{inv.id} • {inv.dealer_name}</span>
                                                </div>
                                                <div className="text-[10px] text-stone-400 truncate mt-0.5" title={inv.no_po || '-'}>{inv.no_po || '-'}</div>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${isTaxDone ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                                                        {isTaxDone ? '✓ Faktur Pajak' : 'Faktur Pajak'}
                                                    </span>
                                                    {isTaxDone && inv.faktur_pajak_no && (
                                                        <span className="text-[10px] text-blue-500 truncate" title={inv.faktur_pajak_no}>{inv.faktur_pajak_no}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="text-[9px] text-stone-400 uppercase tracking-wider whitespace-nowrap">Total</div>
                                                <div className="text-sm font-black text-stone-800 dark:text-white tabular-nums whitespace-nowrap">{formatCurrency(inv.total_invoice)}</div>
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

                            {p.status === 'pending' && (
                                <div className="flex items-center gap-2 pt-2">
                                    {perms.can_approve && (
                                        <button onClick={() => openActionModal('approve', p)} disabled={actionId === p.id} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                            <CheckCircle2 size={15} /> {actionId === p.id ? 'Menyetujui...' : 'Approve & No Proforma'}
                                        </button>
                                    )}
                                    {perms.can_sendback && (
                                        <button onClick={() => openActionModal('sendback', p)} disabled={actionId === p.id} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                            <RefreshCw size={15} /> {actionId === p.id ? 'Mengirim...' : 'Sendback'}
                                        </button>
                                    )}

                                </div>
                            )}
                            {p.status !== 'pending' && (
                                <div className="text-xs text-stone-400 space-y-0.5">
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
                </div>
            )}

            {/* ── Tax Tab ── */}
            {tab === 'tax' && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="font-bold text-stone-800 dark:text-white">Daftar Faktur Pajak</h3>
                        <div className="flex items-center gap-2">
                            <select aria-label="Status Pajak" value={taxStatus} onChange={e => setTaxStatus(e.target.value)} className="rounded-xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl px-3 py-2 text-sm text-stone-600 dark:text-white/70 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                {TAX_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            {taxStatus && <button onClick={() => setTaxStatus('')} className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-[#0d0d0d] text-stone-500 hover:text-red-600 text-sm font-semibold" title="Reset filter">Reset</button>}
                        </div>
                    </div>
                    {taxItems.length === 0 && (
                        <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl p-10 text-center text-stone-400 border border-white/60 dark:border-white/10">
                            Belum ada data proforma
                        </div>
                    )}
                    {pagedTax.slice(taxItems).map((p, ti) => (
                        <div key={p.id} className={`${ti % 2 === 0 ? 'bg-white/60 dark:bg-[#0d0d0d]/50' : 'bg-stone-50/70 dark:bg-[#0d0d0d]/30'} rounded-2xl border border-white/60 dark:border-white/10 p-5 space-y-3 hover:border-blue-200 dark:hover:border-blue-500/40 transition-colors`}>
                            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="p-3 rounded-2xl shrink-0 bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                                        <FileText size={20} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-bold text-stone-800 dark:text-white truncate">
                                            {p.proforma_no || 'Proforma #' + p.id}
                                        </div>
                                        <div className="text-xs text-stone-400">
                                            Diajukan: {p.requested_by || '-'} • {p.requested_at ? new Date(p.requested_at).toLocaleString('id-ID') : '-'}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                                    {(() => {
                                        // Badge mencerminkan status TAX per invoice (konsisten dengan filter via taxKeyOfProforma)
                                        const b = TAX_STATUS_BADGE[taxKeyOfProforma(p)] || PROFORMA_STATUS_BADGE[p.status] || PROFORMA_STATUS_BADGE.pending;
                                        return (
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${b.cls}`} title="Status faktur pajak">
                                                <span className={`w-1.5 h-1.5 rounded-full ${b.dot}`} />
                                                {b.label}
                                            </span>
                                        );
                                    })()}
                                    <div className="hidden sm:block w-px h-8 bg-stone-100 dark:bg-[#111] mx-0.5" />
                                    <button onClick={() => openDetail(p.invoices?.[0] || { id: p.id })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 font-semibold transition-colors" title="Lihat Detail Invoice">
                                        <FileText size={15} /> Detail
                                    </button>
                                    <button onClick={() => openAudit(p.invoices?.[0] || { id: p.id })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-500/20 font-semibold transition-colors" title="Lihat Audit Trail">
                                        <History size={15} /> Audit
                                    </button>
                                    {isAdmin && (
                                        <button onClick={() => openDeleteProforma(p)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 font-semibold transition-colors" title="Hapus Proforma beserta invoice-nya (hanya admin)">
                                            <Trash2 size={15} /> Hapus
                                        </button>
                                    )}
                                    {/* Total amount — terpisah, tidak wrap */}
                                    <div className="text-right pl-3 sm:pl-4 border-l-2 border-white/60 dark:border-white/10 max-w-full">
                                        <div className="text-[10px] text-stone-400 uppercase tracking-wider whitespace-nowrap">Total Proforma</div>
                                        <div className="text-lg font-black text-stone-800 dark:text-white tabular-nums whitespace-nowrap leading-tight max-w-full overflow-hidden" title={formatCurrency(p.total_nominal)}>{formatCurrency(p.total_nominal)}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Invoices in this proforma */}
                            <div className="flex flex-wrap gap-2">
                                {(p.invoices || []).filter(inv => inv.status !== 'cancelled').map(inv => {
                                    const invStatus = inv.status || 'proforma';
                                    const isTaxDone = invStatus === 'tax' || invStatus === 'settled';
                                    const isWaitingUpdate = invStatus === 'sent_back_tax' || invStatus === 'rejected';
                                    const isAwaitingTax = invStatus === 'proforma' || invStatus === 'tax_requested';
                                    return (
                                        <div key={inv.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl gradient-bg-soft border border-white/60 dark:border-white/10 min-w-[200px] max-w-full flex-1 hover:border-blue-200 dark:hover:border-blue-500/40 transition-colors">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${paymentBadge(inv).cls}`}>{paymentBadge(inv).label}</span>
                                                    <span className="text-xs font-semibold text-stone-700 dark:text-white/80 truncate" title={inv.dealer_name}>#{inv.id} • {inv.dealer_name}</span>
                                                </div>
                                                <div className="text-[10px] text-stone-400 truncate mt-0.5" title={inv.no_po || '-'}>{inv.no_po || '-'}</div>
                                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${isTaxDone ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' : isWaitingUpdate ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                                                        {isTaxDone ? '✓ Faktur Pajak' : isWaitingUpdate ? 'Menunggu Update' : 'Belum Faktur Pajak'}
                                                    </span>
                                                    {isTaxDone && inv.faktur_pajak_no && (
                                                        <span className="text-[10px] text-blue-500 truncate" title={inv.faktur_pajak_no}>{inv.faktur_pajak_no}</span>
                                                    )}
                                                    {isWaitingUpdate && (
                                                        <span className="text-[10px] text-rose-500 truncate" title={inv.tax_reject_notes || inv.tax_request_notes || inv.sendback_notes || ''}>
                                                            {inv.tax_reject_notes || inv.tax_request_notes || inv.sendback_notes || 'Ditunggu update requester'}
                                                        </span>
                                                    )}
                                                </div>
                                                {isAwaitingTax && (
                                                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                                        {perms.can_tax && (
                                                            <button onClick={() => openTax(inv)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm shadow-blue-500/30 transition-colors">
                                                                <CheckCircle2 size={13} /> Approve Tax
                                                            </button>
                                                        )}
                                                        {perms.can_tax_sendback && (
                                                            <button onClick={() => openActionModal('sendback_tax', inv)} disabled={actionId === inv.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="Sendback tax ke requester">
                                                                <RefreshCw size={13} /> Sendback
                                                            </button>
                                                        )}

                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="text-[9px] text-stone-400 uppercase tracking-wider whitespace-nowrap">Total</div>
                                                <div className="text-sm font-black text-stone-800 dark:text-white tabular-nums whitespace-nowrap">{formatCurrency(inv.total_invoice)}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Tax info & attachments */}
                            {(p.invoices || []).filter(inv => parseJsonArray(inv.tax_request_attachments).length > 0 || inv.tax_request_notes).length > 0 && (
                                <div className="border-t border-white/60 dark:border-white/10 pt-3 space-y-2">
                                    <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Lampiran Tax Request</div>
                                    {(p.invoices || []).filter(inv => parseJsonArray(inv.tax_request_attachments).length > 0 || inv.tax_request_notes).map(inv => (
                                        <div key={inv.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-stone-50/70 dark:bg-[#0d0d0d]/40 px-3 py-2">
                                            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">#{inv.id}</span>
                                            {parseJsonArray(inv.tax_request_attachments).map(f => (
                                                <a key={f} href={`${API_URL}/invoices/files/${f}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs hover:bg-orange-100 transition-colors">
                                                    <ImagePlus size={14} /> {f.length > 30 ? f.slice(0, 30) + '…' : f}
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

            {/* ── Sampah Tab (soft delete — khusus admin) ── */}
            {tab === 'trash' && isAdmin && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600"><Trash2 size={16} /></div>
                            <div>
                                <h3 className="font-bold text-stone-800 dark:text-white">Sampah</h3>
                                <div className="text-[11px] text-stone-400">Data yang dihapus bisa dipulihkan. Penghapusan permanen tidak bisa dibatalkan.</div>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={15} />
                                <input
                                    type="text"
                                    value={trashSearch}
                                    onChange={e => setTrashSearch(e.target.value)}
                                    placeholder={t("invoice.searchInvoice")}
                                    className="w-56 pl-9 pr-3 py-2 rounded-xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl text-sm text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <select aria-label="Filter Sampah" value={trashFilter} onChange={e => setTrashFilter(e.target.value)} className="rounded-xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl px-3 py-2 text-sm text-stone-600 dark:text-white/70 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="all">{t("opt.all")}</option>
                                <option value="invoice">{t("opt.invoice")}</option>
                                <option value="proforma">{t("opt.proforma")}</option>
                            </select>
                            <button onClick={loadTrash} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 dark:bg-[#0d0d0d] text-stone-500 hover:text-blue-600 text-sm font-semibold" title="Muat ulang Sampah">
                                <RefreshCw size={15} className={trashLoading ? 'animate-spin' : ''} /> Muat Ulang
                            </button>
                        </div>
                    </div>

                    {(() => {
                        // Filter Sampah berdasarkan tipe + pencarian
                        const q = trashSearch.trim().toLowerCase();
                        const fInv = (trashData?.invoices || []).filter(inv =>
                            !q || String(inv.id).includes(q) ||
                            String(inv.no_invoice || inv.no_po || '').toLowerCase().includes(q) ||
                            String(inv.dealer_name || '').toLowerCase().includes(q));
                        const fProf = (trashData?.proformas || []).filter(p =>
                            !q || String(p.id).includes(q) ||
                            String(p.proforma_no || '').toLowerCase().includes(q));
                        const showInv = trashFilter !== 'proforma';
                        const showProf = trashFilter !== 'invoice';
                        const filteredCount = (showInv ? fInv.length : 0) + (showProf ? fProf.length : 0);

                        if (trashLoading) return (
                            <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl p-10 text-center text-stone-400 border border-white/60 dark:border-white/10">
                                Memuat Sampah...
                            </div>
                        );
                        if (!trashData || (trashData.invoices?.length === 0 && trashData.proformas?.length === 0)) return (
                            <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl p-10 text-center text-stone-400 border border-white/60 dark:border-white/10">
                                <Trash2 size={32} className="mx-auto mb-2 opacity-40" />
                                Sampah kosong
                            </div>
                        );
                        if (filteredCount === 0) return (
                            <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl p-10 text-center text-stone-400 border border-white/60 dark:border-white/10">
                                <Search size={28} className="mx-auto mb-2 opacity-40" />
                                Tidak ada hasil untuk "{trashSearch}"
                            </div>
                        );

                        return (
                            <>
                    {/* Invoice terhapus */}
                    {showInv && fInv.length > 0 && (
                        <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl shadow-sm border border-white/60 dark:border-white/10 overflow-hidden">
                            <div className="p-4 border-b border-white/60 dark:border-white/10 flex items-center gap-2">
                                <Receipt size={16} className="text-stone-400" />
                                <span className="font-bold text-stone-800 dark:text-white">Invoice Terhapus ({fInv.length})</span>
                            </div>
                            <div className="divide-y divide-white/60 dark:divide-white/10">
                                {fInv.map(inv => (
                                    <div key={inv.id} className="flex flex-wrap items-center gap-3 p-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="font-bold text-stone-800 dark:text-white truncate">#{inv.id} • {inv.dealer_name || '-'}</div>
                                            <div className="text-[11px] text-stone-400 truncate">
                                                {inv.no_invoice || inv.no_po || '-'} • {inv.status || '-'} • {formatCurrency(inv.total_invoice)}
                                            </div>
                                            <div className="text-[10px] text-red-400 mt-0.5">Dihapus oleh: {inv.deleted_by || '-'} • {inv.deleted_at ? new Date(inv.deleted_at).toLocaleString('id-ID') : '-'}</div>
                                        </div>
                                        <button onClick={() => doRestore('invoice', inv)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 font-semibold text-xs transition-colors" title="Kembalikan invoice">
                                            <RotateCcw size={14} /> Restore
                                        </button>
                                        <button onClick={() => openPermanentDelete('invoice', inv)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 font-semibold text-xs transition-colors" title="Hapus permanen (tidak bisa dibatalkan)">
                                            <Trash2 size={14} /> Hapus Permanen
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Proforma terhapus */}
                    {showProf && fProf.length > 0 && (
                        <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl shadow-sm border border-white/60 dark:border-white/10 overflow-hidden">
                            <div className="p-4 border-b border-white/60 dark:border-white/10 flex items-center gap-2">
                                <FileSignature size={16} className="text-stone-400" />
                                <span className="font-bold text-stone-800 dark:text-white">Proforma Terhapus ({fProf.length})</span>
                            </div>
                            <div className="divide-y divide-white/60 dark:divide-white/10">
                                {fProf.map(p => (
                                    <div key={p.id} className="flex flex-wrap items-center gap-3 p-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="font-bold text-stone-800 dark:text-white truncate">Proforma #{p.id} • {p.proforma_no || 'Tanpa No'}</div>
                                            <div className="text-[11px] text-stone-400 truncate">{(p.invoices || []).length} invoice • {formatCurrency(p.total_nominal)}</div>
                                            <div className="text-[10px] text-red-400 mt-0.5">Dihapus oleh: {p.deleted_by || '-'} • {p.deleted_at ? new Date(p.deleted_at).toLocaleString('id-ID') : '-'}</div>
                                        </div>
                                        <button onClick={() => doRestore('proforma', p)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 font-semibold text-xs transition-colors" title="Kembalikan proforma beserta invoice-nya">
                                            <RotateCcw size={14} /> Restore
                                        </button>
                                        <button onClick={() => openPermanentDelete('proforma', p)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 font-semibold text-xs transition-colors" title="Hapus permanen (tidak bisa dibatalkan)">
                                            <Trash2 size={14} /> Hapus Permanen
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                            </>
                        );
                    })()}
                </div>
            )}

            {/* ── Master Dealer Tab ── */}
            {tab === 'dealer' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {perms.can_manage_master && (
                    <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-white/10 p-5 space-y-3 h-fit">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="font-bold text-stone-800 dark:text-white">{dealerEditId ? 'Edit Dealer' : 'Tambah Dealer'}</h3>
                            <div className="flex items-center gap-1">
                                <button onClick={() => { if (pdfBusyId) return; setPdfBusyId('dtpl'); invoiceService.downloadDealerTemplate().catch(e => toast?.error?.(e.message)).finally(() => setPdfBusyId(null)); }} disabled={!!pdfBusyId} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-[#0d0d0d] text-stone-600 dark:text-white/70 text-[10px] font-bold hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed" title="Download Template">
                                    <FileText size={12} /> Template
                                </button>
                                <input ref={dealerImportRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { if (e.target.files[0]) handleDealerImport(e.target.files[0]); e.target.value = ''; }} />
                                <button onClick={() => dealerImportRef.current?.click()} disabled={importing} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold hover:bg-emerald-100 dark:hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed" title="Import Data Excel">
                                    <Upload size={12} /> {importing ? 'Mengimpor...' : 'Import'}
                                </button>
                            </div>
                        </div>
                        <input className={inputCls} placeholder={t("invoice.placeNPWP")} value={dealerForm.npwp} onChange={e => setDealerForm({ ...dealerForm, npwp: e.target.value.replace(/\D/g, '').slice(0, 16) })} />
                        <input className={inputCls} placeholder={t("invoice.placeDealerName")} value={dealerForm.nama} onChange={e => setDealerForm({ ...dealerForm, nama: e.target.value })} />
                        <Textarea placeholder="Alamat" rows={2} value={dealerForm.alamat} onChange={e => setDealerForm({ ...dealerForm, alamat: e.target.value })} />
                        <div className="flex gap-2">
                            <button onClick={saveDealer} disabled={savingDealer} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl gradient-bg hover:opacity-95 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                <Plus size={15} /> {savingDealer ? 'Menyimpan...' : (dealerEditId ? 'Update' : 'Simpan')}
                            </button>
                            {dealerEditId && (
                                <button onClick={() => { setDealerEditId(null); setDealerForm({ npwp: '', nama: '', alamat: '' }); }} className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-[#0d0d0d] text-stone-600 dark:text-white/70 text-sm font-semibold">
                                    Batal
                                </button>
                            )}
                        </div>
                    </div>
                    )}

                    <div className={`${perms.can_manage_master ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-white/10 overflow-hidden`}>
                        <div className="overflow-auto max-h-[600px] custom-scrollbar">
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr>
                                        <th className={`${TH_CLS} text-left`}>NPWP</th>
                                        <th className={`${TH_CLS} text-left`}>Nama</th>
                                        <th className={`${TH_CLS} text-left`}>Alamat</th>
                                        <th className={`${TH_CLS} text-right`}>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedDealers.slice(filteredDealers).map((d, di) => (
                                        <tr key={d.id} className={`${TROW_CLS} ${di % 2 === 0 ? 'bg-white/60 dark:bg-[#0d0d0d]/50' : 'bg-stone-50/70 dark:bg-[#0d0d0d]/30'}`}>
                                            <td className="px-4 py-3 font-mono text-xs text-stone-600 dark:text-white/70 whitespace-nowrap">{d.npwp}</td>
                                            <td className="px-4 py-3 font-semibold text-stone-800 dark:text-white">{d.nama}</td>
                                            <td className="px-4 py-3 text-stone-500 dark:text-white/40 text-xs">{d.alamat}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    {perms.can_manage_master && <button onClick={() => editDealer(d)} className="p-1.5 rounded-lg text-stone-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-white/[0.05]" title="Edit"><Pencil size={15} /></button>}
                                                    {perms.can_manage_master && <button onClick={() => deleteDealer(d)} className="p-1.5 rounded-lg text-stone-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-white/[0.05]" title="Hapus"><Trash2 size={15} /></button>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredDealers.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-stone-400">Belum ada dealer</td></tr>}
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
                    {perms.can_manage_master && (
                    <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-white/10 p-5 space-y-3 h-fit">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="font-bold text-stone-800 dark:text-white">{barangEditId ? 'Edit Barang' : 'Tambah Barang'}</h3>
                            <div className="flex items-center gap-1">
                                <button onClick={() => { if (pdfBusyId) return; setPdfBusyId('btpl'); invoiceService.downloadBarangTemplate().catch(e => toast?.error?.(e.message)).finally(() => setPdfBusyId(null)); }} disabled={!!pdfBusyId} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-[#0d0d0d] text-stone-600 dark:text-white/70 text-[10px] font-bold hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed" title="Download Template">
                                    <FileText size={12} /> Template
                                </button>
                                <input ref={barangImportRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { if (e.target.files[0]) handleBarangImport(e.target.files[0]); e.target.value = ''; }} />
                                <button onClick={() => barangImportRef.current?.click()} disabled={importing} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold hover:bg-emerald-100 dark:hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed" title="Import Data Excel">
                                    <Upload size={12} /> {importing ? 'Mengimpor...' : 'Import'}
                                </button>
                            </div>
                        </div>
                        <input className={inputCls} placeholder={t("invoice.placeModel")} value={barangForm.model} onChange={e => setBarangForm({ ...barangForm, model: e.target.value })} />
                        <input className={inputCls} placeholder={t("invoice.placeItemDesc")} value={barangForm.item_description} onChange={e => setBarangForm({ ...barangForm, item_description: e.target.value })} />
                        <MoneyInput className={inputCls} placeholder={t("invoice.placePrice")} value={barangForm.harga} onChange={v => setBarangForm({ ...barangForm, harga: v })} />
                        <div className="flex gap-2">
                            <button onClick={saveBarang} disabled={savingBarang} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl gradient-bg hover:opacity-95 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                <Plus size={15} /> {savingBarang ? 'Menyimpan...' : (barangEditId ? 'Update' : 'Simpan')}
                            </button>
                            {barangEditId && (
                                <button onClick={() => { setBarangEditId(null); setBarangForm({ model: '', item_description: '', harga: '' }); }} className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-[#0d0d0d] text-stone-600 dark:text-white/70 text-sm font-semibold">
                                    Batal
                                </button>
                            )}
                        </div>
                    </div>
                    )}

                    <div className={`${perms.can_manage_master ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-white/10 overflow-hidden`}>
                        <div className="overflow-auto max-h-[600px] custom-scrollbar">
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr>
                                        <th className={`${TH_CLS} text-left`}>Model</th>
                                        <th className={`${TH_CLS} text-left`}>Item Description</th>
                                        <th className={`${TH_CLS} text-right`}>Harga</th>
                                        <th className={`${TH_CLS} text-right`}>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedBarang.slice(filteredBarang).map((b, bi) => (
                                        <tr key={b.id} className={`${TROW_CLS} ${bi % 2 === 0 ? 'bg-white/60 dark:bg-[#0d0d0d]/50' : 'bg-stone-50/70 dark:bg-[#0d0d0d]/30'}`}>
                                            <td className="px-4 py-3 font-mono text-xs font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">{b.model}</td>
                                            <td className="px-4 py-3 text-stone-600 dark:text-white/70 text-xs">{b.item_description}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-stone-800 dark:text-white whitespace-nowrap tabular-nums">{formatCurrency(b.harga)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    {perms.can_manage_master && <button onClick={() => editBarang(b)} className="p-1.5 rounded-lg text-stone-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-white/[0.05]" title="Edit"><Pencil size={15} /></button>}
                                                    {perms.can_manage_master && <button onClick={() => deleteBarang(b)} className="p-1.5 rounded-lg text-stone-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-white/[0.05]" title="Hapus"><Trash2 size={15} /></button>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredBarang.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-stone-400">Belum ada barang</td></tr>}
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
                    {perms.can_manage_rule && (
                    <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-white/10 p-5 space-y-3 h-fit">
                        <h3 className="font-bold text-stone-800 dark:text-white">{ruleEditId ? 'Edit Rule' : 'Tambah Rule'}</h3>
                        <div>
                            <label className="text-xs font-bold text-stone-500 dark:text-white/40 mb-1 block">Tipe Target</label>
                            <select className={inputCls} value={ruleForm.target_type} onChange={e => setRuleForm({ ...ruleForm, target_type: e.target.value, target_value: '' })}>
                                <option value="user">{t("opt.user")}</option>
                                <option value="role">{t("opt.role")}</option>
                                <option value="division">{t("opt.division")}</option>
                            </select>
                        </div>
                        {ruleForm.target_type === 'user' && (
                            <div>
                                <label className="text-xs font-bold text-stone-500 dark:text-white/40 mb-1 block">Pilih User (Master Data)</label>
                                <select className={inputCls} value={ruleForm.target_value} onChange={e => setRuleForm({ ...ruleForm, target_value: e.target.value })}>
                                    <option value="">{t("opt.selectUser")}</option>
                                    {masterUsers.map(u => (
                                        <option key={u.id} value={u.username}>{u.name || u.username} (@{u.username})</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {ruleForm.target_type === 'role' && (
                            <div>
                                <label className="text-xs font-bold text-stone-500 dark:text-white/40 mb-1 block">Pilih Role (Master Data)</label>
                                <select className={inputCls} value={ruleForm.target_value} onChange={e => setRuleForm({ ...ruleForm, target_value: e.target.value })}>
                                    <option value="">{t("opt.selectRole")}</option>
                                    {masterRoles.map(r => (
                                        <option key={r.id} value={r.id}>{r.label || r.id}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {ruleForm.target_type === 'division' && (
                            <div>
                                <label className="text-xs font-bold text-stone-500 dark:text-white/40 mb-1 block">Pilih Divisi (Master Data)</label>
                                <select className={inputCls} value={ruleForm.target_value} onChange={e => setRuleForm({ ...ruleForm, target_value: e.target.value })}>
                                    <option value="">{t("opt.selectDivision")}</option>
                                    {masterDivisions.map(d => (
                                        <option key={d.id} value={d.name}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {ruleForm.target_value && (
                            <div className="space-y-3">
                                <div>
                                    <div className="text-xs font-bold text-stone-500 dark:text-white/40 mb-1">Akses Tab</div>
                                    <div className="space-y-1.5">
                                        {PERM_VIEW_FIELDS.map(([key, label]) => (
                                            <label key={key} className="flex items-center gap-2 text-sm text-stone-700 dark:text-white/80">
                                                <input type="checkbox" checked={!!ruleForm[key]} onChange={e => setRuleForm({ ...ruleForm, [key]: e.target.checked })} className="w-4 h-4 accent-blue-600" />
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-stone-500 dark:text-white/40 mb-1">Aksi</div>
                                    <div className="space-y-1.5">
                                        {PERM_ACTION_FIELDS.map(([key, label]) => (
                                            <label key={key} className="flex items-center gap-2 text-sm text-stone-700 dark:text-white/80">
                                                <input type="checkbox" checked={!!ruleForm[key]} onChange={e => setRuleForm({ ...ruleForm, [key]: e.target.checked })} className="w-4 h-4 accent-blue-600" />
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        {!ruleForm.target_value && (
                            <p className="text-xs text-stone-400 italic">Pilih target terlebih dahulu untuk mengatur akses tab & tombol.</p>
                        )}
                        <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-white/80 pt-1">
                            <input type="checkbox" checked={!!ruleForm.is_active} onChange={e => setRuleForm({ ...ruleForm, is_active: e.target.checked })} className="w-4 h-4 accent-blue-600" />
                            Rule Aktif (matikan untuk nonaktifkan sementara)
                        </label>
                        <div className="flex gap-2 pt-1">
                            <button onClick={saveRule} disabled={!ruleForm.target_value || savingRule} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl gradient-bg hover:opacity-95 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                                <Plus size={15} /> {savingRule ? 'Menyimpan...' : (ruleEditId ? 'Update' : 'Simpan')}
                            </button>
                            {ruleEditId && (
                                <button onClick={() => { setRuleEditId(null); setRuleForm(EMPTY_RULE_FORM()); }} className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-[#0d0d0d] text-stone-600 dark:text-white/70 text-sm font-semibold">
                                    Batal
                                </button>
                            )}
                        </div>
                        <p className="text-[10px] text-stone-400">Default semua akses aktif untuk semua user. Buat rule untuk membatasi akses user/role/divisi tertentu (flag rule akan menimpa default). Target dipilih dari master data.</p>
                    </div>
                    )}

                    <div className={`${perms.can_manage_rule ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-white/10 overflow-hidden`}>
                        <div className="overflow-auto max-h-[600px] custom-scrollbar">
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr>
                                        <th className={`${TH_CLS} text-left`}>Target</th>
                                        {PERM_VIEW_FIELDS.map(([key, label]) => (
                                            <th key={key} className={`${TH_CLS} text-center`} title={label}>{label}</th>
                                        ))}
                                        {PERM_ACTION_FIELDS.map(([key, label]) => (
                                            <th key={key} className={`${TH_CLS} text-center`} title={label}>{label}</th>
                                        ))}
                                        <th className={`${TH_CLS} text-center`}>Aktif</th>
                                        <th className={`${TH_CLS} text-right`}>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedRules.slice(filteredRules).map((r, ri) => (
                                        <tr key={r.id} className={`${TROW_CLS} ${ri % 2 === 0 ? 'bg-white/60 dark:bg-[#0d0d0d]/50' : 'bg-stone-50/70 dark:bg-[#0d0d0d]/30'}`}>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="font-semibold text-stone-800 dark:text-white">{r.target_value}</div>
                                                <div className="text-[10px] text-stone-400 uppercase font-medium">{r.target_type}</div>
                                            </td>
                                            {PERM_VIEW_FIELDS.map(([key]) => (
                                                <td key={key} className="px-4 py-3 text-center">
                                                    {r[key] ? <CheckCircle2 size={15} className="inline text-emerald-500" /> : <XCircle size={15} className="inline text-stone-300 dark:text-stone-600" />}
                                                </td>
                                            ))}
                                            {PERM_ACTION_FIELDS.map(([key]) => (
                                                <td key={key} className="px-4 py-3 text-center">
                                                    {r[key] ? <CheckCircle2 size={15} className="inline text-emerald-500" /> : <XCircle size={15} className="inline text-stone-300 dark:text-stone-600" />}
                                                </td>
                                            ))}
                                            <td className="px-4 py-3 text-center">
                                                {r.is_active ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">ON</span> : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-500 dark:bg-[#0d0d0d]">OFF</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    {perms.can_manage_rule && <button onClick={() => editRule(r)} className="p-1.5 rounded-lg text-stone-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-white/[0.05]" title="Edit"><Pencil size={15} /></button>}
                                                    {perms.can_manage_rule && <button onClick={() => deleteRule(r)} className="p-1.5 rounded-lg text-stone-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-white/[0.05]" title="Hapus"><Trash2 size={15} /></button>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredRules.length === 0 && <tr><td colSpan={ALL_PERM_FIELDS.length + 3} className="px-4 py-10 text-center text-stone-400">Belum ada rule</td></tr>}
                                </tbody>
                            </table>
                        </div>
                        <Pagination page={pagedRules.page} totalPages={pagedRules.totalPages} setPage={pagedRules.setPage} />
                    </div>
                </div>
            )}

            {/* ── Flow / Workflow Tab ── */}
            {tab === 'flow' && (
                <div className="space-y-6">
                    {/* Header bar */}
                    <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl p-5 border border-white/60 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                <Workflow size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-stone-800 dark:text-white">Alur Approval & Notifikasi Invoice</h3>
                                <p className="text-xs text-stone-400">Konfigurasi urutan tahap, penanggung jawab, dan notifikasi email per tahap alur</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {mailStatus.loaded && (
                                <span
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold ${mailStatus.configured ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'}`}
                                    title={mailStatus.configured ? `SMTP: ${mailStatus.host}:${mailStatus.port} • From: ${mailStatus.from}` : 'SMTP belum dikonfigurasi — email hanya disimulasikan di log server'}
                                >
                                    <ShieldCheck size={12} /> {mailStatus.configured ? 'SMTP Aktif' : 'Mode Simulasi'}
                                </span>
                            )}
                            {flowSteps.length === 0 && perms.can_manage_rule && (
                                <button
                                    onClick={seedDefaultFlow}
                                    disabled={seeding}
                                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Sparkles size={14} /> {seeding ? 'Mengisi...' : 'Isi Flow Default (Contoh)'}
                                </button>
                            )}
                            {perms.can_manage_rule && (
                                <button
                                    onClick={() => openFlowForm(null)}
                                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl gradient-bg hover:opacity-95 text-white text-xs font-semibold shadow-lg shadow-blue-500/25 transition-all"
                                >
                                    <Plus size={14} /> Tambah Step Alur
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Inline Form (Add/Edit) */}
                    {flowOpen && (
                        <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl p-5 border-2 border-blue-500/30 dark:border-blue-500/40 space-y-4 shadow-xl">
                            <div className="flex items-center justify-between border-b border-white/60 dark:border-white/10 pb-3">
                                <h4 className="font-bold text-sm text-stone-800 dark:text-white">
                                    {flowForm.id ? 'Edit Step Alur' : 'Tambah Step Alur Baru'}
                                </h4>
                                <button onClick={() => setFlowOpen(false)} className="text-stone-400 hover:text-stone-600 dark:hover:text-white/80">
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                <div>
                                    <label className="block text-xs font-bold text-stone-600 dark:text-white/40 mb-1">Nama Step / Tahap *</label>
                                    <input
                                        type="text"
                                        value={flowForm.name}
                                        onChange={e => setFlowForm({ ...flowForm, name: e.target.value })}
                                        placeholder={t("invoice.placeExample")}
                                        className="w-full rounded-xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl px-3 py-2 text-sm text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-stone-600 dark:text-white/40 mb-1">Event Pemicu *</label>
                                    <select
                                        value={flowForm.event}
                                        onChange={e => setFlowForm({ ...flowForm, event: e.target.value })}
                                        className="w-full rounded-xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl px-3 py-2 text-sm text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {Object.entries(flowEvents).map(([k, v]) => (
                                            <option key={k} value={k}>{v}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-stone-600 dark:text-white/40 mb-1">Penanggung Jawab</label>
                                    <div className="flex gap-2">
                                        <select
                                            value={flowForm.assignee_type}
                                            onChange={e => setFlowForm({ ...flowForm, assignee_type: e.target.value, assignee_value: '' })}
                                            className="w-1/3 rounded-xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl px-2 py-2 text-sm text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="all">{t("opt.all")}</option>
                                            <option value="role">{t("opt.role")}</option>
                                            <option value="user">{t("opt.user")}</option>
                                            <option value="division">{t("opt.division")}</option>
                                        </select>
                                        {flowForm.assignee_type !== 'all' && (
                                            <select
                                                value={flowForm.assignee_value}
                                                onChange={e => setFlowForm({ ...flowForm, assignee_value: e.target.value })}
                                                className="w-2/3 rounded-xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl px-2 py-2 text-sm text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="">{t("opt.selectSomething")} {flowForm.assignee_type}</option>
                                                {flowForm.assignee_type === 'role' && flowAssigneeOptions.roles.map(r => <option key={r} value={r}>{r}</option>)}
                                                {flowForm.assignee_type === 'user' && flowAssigneeOptions.users.map(u => <option key={u.username} value={u.username}>{u.name || u.username}</option>)}
                                                {flowForm.assignee_type === 'division' && flowAssigneeOptions.divisions.map(d => <option key={d} value={d}>{d}</option>)}
                                            </select>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-stone-600 dark:text-white/40 mb-1">
                                    Penerima Email Tambahan (Custom)
                                </label>
                                <Textarea
                                    value={flowForm.custom_emails}
                                    onChange={e => setFlowForm({ ...flowForm, custom_emails: e.target.value })}
                                    rows={2}
                                    placeholder={t("invoice.placeEmail")}
                                    className="w-full rounded-xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl px-3 py-2 text-sm text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-[11px] text-stone-400 mt-1">Email custom ikut menerima notifikasi selain penanggung jawab di atas. Bisa lebih dari satu.</p>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-stone-700 dark:text-white/70">
                                        <input
                                            type="checkbox"
                                            checked={flowForm.notify_email}
                                            onChange={e => setFlowForm({ ...flowForm, notify_email: e.target.checked })}
                                            className="rounded border-stone-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        Kirim Notifikasi Email & In-App
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-stone-700 dark:text-white/70">
                                        <input
                                            type="checkbox"
                                            checked={flowForm.is_active}
                                            onChange={e => setFlowForm({ ...flowForm, is_active: e.target.checked })}
                                            className="rounded border-stone-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        Aktif
                                    </label>
                                </div>
                                {flowForm.notify_email && flowForm.assignee_type === 'all' && (
                                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-2.5 py-1.5">
                                        <Megaphone size={11} /> Email akan dikirim ke SEMUA user — pastikan jumlah user wajar.
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <button onClick={previewFormRecipients} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-semibold hover:bg-blue-50 dark:hover:bg-blue-500/10" title="Lihat daftar penerima email untuk konfigurasi ini (tanpa mengirim)">
                                        <Eye size={13} /> Preview Penerima
                                    </button>
                                    <button onClick={() => setFlowOpen(false)} className="px-4 py-2 rounded-xl border border-stone-200 dark:border-white/[0.06] text-stone-600 dark:text-white/70 text-xs font-semibold hover:bg-stone-100 dark:hover:bg-white/[0.05]">
                                        Batal
                                    </button>
                                    <button onClick={saveFlowStep} disabled={flowSaving} className="flex items-center gap-1.5 px-4 py-2 rounded-xl gradient-bg hover:opacity-95 text-white text-xs font-semibold shadow-lg shadow-blue-500/25">
                                        <Save size={14} /> {flowSaving ? 'Menyimpan...' : 'Simpan Step'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Pipeline Visual Flow */}
                    <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/60 dark:border-white/10 shadow-sm space-y-4">
                        <div className="text-xs font-bold uppercase tracking-wider text-stone-400">Visualisasi Alur Kerja (Pipeline)</div>
                        {flowSteps.length === 0 ? (
                            <div className="py-12 text-center text-stone-400 text-sm space-y-3">
                                <div>Belum ada alur yang dikonfigurasi.</div>
                                {perms.can_manage_rule && (
                                    <button onClick={seedDefaultFlow} disabled={seeding} className="px-4 py-2 rounded-xl gradient-bg text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                        {seeding ? 'Mengisi...' : 'Buat Alur Default (Contoh)'}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 overflow-x-auto pb-4 custom-scrollbar">
                                {[...flowSteps].sort((a, b) => a.step_no - b.step_no).map((s, idx, arr) => (
                                    <div key={s.id} className="flex items-center gap-2 shrink-0">
                                        <div className={`p-4 rounded-2xl border ${s.is_active ? 'bg-stone-50 dark:bg-[#0d0d0d]/80 border-blue-200 dark:border-blue-500/30' : 'bg-stone-100/50 dark:bg-[#0d0d0d]/50 border-stone-200 dark:border-white/[0.06] opacity-60'} min-w-[200px] space-y-2 relative group`}>
                                            <div className="flex items-center justify-between">
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                                                    Step {s.step_no}
                                                </span>
                                                {perms.can_manage_rule && (
                                                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                                                        <button onClick={() => moveFlowStep(s, -1)} disabled={idx === 0} className="p-1 hover:text-blue-600 disabled:opacity-30" title="Geser Kiri"><ChevronUp size={13} className="-rotate-90" /></button>
                                                        <button onClick={() => moveFlowStep(s, 1)} disabled={idx === arr.length - 1} className="p-1 hover:text-blue-600 disabled:opacity-30" title="Geser Kanan"><ChevronDown size={13} className="-rotate-90" /></button>
                                                        <button onClick={() => openFlowForm(s)} className="p-1 hover:text-blue-600" title="Edit"><Pencil size={13} /></button>
                                                        <button onClick={() => removeFlowStep(s)} className="p-1 hover:text-red-500" title="Hapus"><Trash2 size={13} /></button>
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm text-stone-800 dark:text-white truncate">{s.name}</div>
                                                <div className="text-[11px] text-stone-400 truncate">{flowEvents[s.event] || s.event}</div>
                                            </div>
                                            <div className="pt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                                                <span className="px-2 py-0.5 rounded bg-stone-200 dark:bg-[#111] text-stone-700 dark:text-white/70 font-semibold">
                                                    {s.assignee_type === 'all' ? 'Semua User' : `${s.assignee_type}: ${s.assignee_value}`}
                                                </span>
                                                {Array.isArray(s.custom_emails) && s.custom_emails.length > 0 && (
                                                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 font-semibold" title={s.custom_emails.join(', ')}>
                                                        <AtSign size={10} className="inline mr-0.5" /> Custom {s.custom_emails.length}
                                                    </span>
                                                )}
                                                {s.notify_email && (
                                                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 font-semibold" title="Notifikasi terkirim saat event ini terpicu">
                                                        <Mail size={10} className="inline mr-0.5" /> Notif ON
                                                    </span>
                                                )}
                                                <button onClick={() => openRecipients({ stepId: s.id, title: `Penerima — Step ${s.step_no}: ${s.name}` })} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 font-semibold hover:bg-blue-200 dark:hover:bg-blue-500/20" title="Lihat penerima email untuk step ini (tanpa mengirim)">
                                                    <Eye size={10} /> Penerima
                                                </button>
                                            </div>
                                        </div>
                                        {idx < arr.length - 1 && (
                                            <ArrowRight size={18} className="text-stone-300 dark:text-stone-700 shrink-0" />
                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* ── Template Email Notifikasi ── */}
                                                    <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl p-5 border border-white/60 dark:border-white/10 space-y-4 shadow-sm">
                                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                                                    <Mail size={20} />
                                                                </div>
                                                                <div>
                                                                    <h3 className="font-bold text-stone-800 dark:text-white">Template Email Notifikasi</h3>
                                                                    <p className="text-xs text-stone-400">Kustomisasi subjek & isi email per event. Gunakan token agar data terisi otomatis.</p>
                                                                </div>
                                                            </div>
                                                            {emailTpl.loaded && (
                                                                <span className="text-[10px] font-bold px-2.5 py-1.5 rounded-xl bg-stone-100 dark:bg-[#0d0d0d] text-stone-500 dark:text-white/40">
                                                                    {emailTpl.items.filter(i => i.custom).length} template dikustomisasi
                                                                </span>
                                                            )}
                                                        </div>

                                                        {emailTpl.tokens.length > 0 && (
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Token:</span>
                                                                {emailTpl.tokens.map(([tk, desc]) => (
                                                                    <span key={tk} title={desc} className="px-2 py-0.5 rounded-lg bg-stone-100 dark:bg-[#0d0d0d] text-[10px] font-mono text-blue-600 dark:text-blue-400 cursor-help">{tk}</span>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {!emailTpl.loaded ? (
                                                            <div className="text-center text-sm text-stone-400 py-6">Memuat template...</div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {emailTpl.items.map(item => (
                                                                    <div key={item.event} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-stone-50 dark:bg-[#0d0d0d]/50 border border-white/60 dark:border-white/10">
                                                                        <div className="min-w-0">
                                                                            <div className="text-sm font-semibold text-stone-800 dark:text-white truncate">{item.label}</div>
                                                                            <div className="text-[11px] text-stone-400 font-mono truncate">{item.custom ? item.subject : '(default) ' + item.subject}</div>
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                                            {item.custom && (
                                                                                <button onClick={() => resetEmailTpl(item)} disabled={emailTplSaving} className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 disabled:opacity-40" title="Kembalikan ke versi default">Reset</button>
                                                                            )}
                                                                            <button onClick={() => openEmailTpl(item)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold">
                                                                                <Settings2 size={13} /> {item.custom ? 'Edit' : 'Customize'}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {emailTplEditing && (
                                                            <div className="rounded-2xl border-2 border-emerald-500/30 dark:border-emerald-500/40 p-4 space-y-4 bg-stone-50/60 dark:bg-[#0d0d0d]/30">
                                                                <div className="flex items-center justify-between">
                                                                    <h4 className="font-bold text-sm text-stone-800 dark:text-white">Template: {emailTplEditing.label}</h4>
                                                                    <button onClick={() => { setEmailTplEditing(null); setEmailTplPreview(null); }} className="text-stone-400 hover:text-stone-600 dark:hover:text-white/80"><X size={16} /></button>
                                                                </div>
                                                                <div className="text-sm space-y-1">
                                                                    <label className="block text-xs font-bold text-stone-600 dark:text-white/40 mb-1">Subjek Email</label>
                                                                    <input
                                                                        type="text"
                                                                        value={emailTplEditing.subject}
                                                                        onChange={e => setEmailTplEditing({ ...emailTplEditing, subject: e.target.value })}
                                                                        className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl text-sm text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                                                                    />
                                                                </div>
                                                                <div className="text-sm space-y-1">
                                                                    <label className="block text-xs font-bold text-stone-600 dark:text-white/40 mb-1">Isi Email (HTML)</label>
                                                                    <Textarea
                                                                        value={emailTplEditing.body_html}
                                                                        onChange={e => setEmailTplEditing({ ...emailTplEditing, body_html: e.target.value })}
                                                                        rows={8}
                                                                        className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl text-sm font-mono text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-y"
                                                                    />
                                                                </div>
                                                                {emailTplPreview && (
                                                                    <div className="rounded-xl bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl border border-stone-200 dark:border-white/[0.06] overflow-hidden">
                                                                        <div className="px-3 py-2 border-b border-white/60 dark:border-white/10 text-xs font-bold text-stone-500">Preview — {emailTplPreview.subject}</div>
                                                                        <div className="p-3 text-sm text-stone-700 dark:text-white/80" dangerouslySetInnerHTML={{ __html: emailTplPreview.body_html }} />
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center gap-2">
                                                                    <button onClick={previewEmailTpl} className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-[#0d0d0d] text-stone-600 dark:text-white/70 text-sm font-semibold hover:bg-stone-200 dark:hover:bg-white/[0.06]">Preview</button>
                                                                    <button onClick={saveEmailTpl} disabled={emailTplSaving} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed">
                                                                        {emailTplSaving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Simpan Template
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                    {/* ── Preview Penerima Notifikasi Modal ── */}
                    {recipOpen && createPortal(
                        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setRecipOpen(false)}>
                            <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-between p-5 border-b border-white/60 dark:border-white/10">
                                    <div className="flex items-center gap-2">
                                        <Users size={18} className="text-blue-600" />
                                        <h3 className="font-bold text-stone-800 dark:text-white">{recipTitle}</h3>
                                    </div>
                                    <button onClick={() => setRecipOpen(false)} className="text-stone-400 hover:text-stone-600 dark:hover:text-white/80"><X size={18} /></button>
                                </div>
                                <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
                                    {recipLoading ? (
                                        <div className="text-center text-sm text-stone-400 py-8">Memuat penerima...</div>
                                    ) : recipList.length === 0 ? (
                                        <div className="text-center text-sm text-stone-400 py-8 space-y-1">
                                            <div>Tidak ada penerima yang cocok.</div>
                                            <div className="text-[11px]">Pastikan ada user dengan role/divisi/email yang sesuai pada konfigurasi step ini.</div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="text-xs text-stone-500 dark:text-white/40 mb-3">{recipList.length} penerima (sudah di-dedup berdasarkan email)</div>
                                            <div className="space-y-2">
                                                {recipList.map((r, i) => (
                                                    <div key={i} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-stone-50 dark:bg-[#0d0d0d]/50 border border-white/60 dark:border-white/10">
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-semibold text-stone-800 dark:text-white truncate">{r.custom ? r.email : r.name} {!r.custom && <span className="text-[10px] text-stone-400 font-normal">@{r.username}</span>}</div>
                                                            <div className={`text-[11px] truncate ${r.has_email ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{r.custom ? 'Email Custom' : r.email}</div>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <div className="text-[10px] text-stone-400">{r.step_name || `Step ${r.step_no}`}</div>
                                                            <div className="text-[10px] font-semibold text-stone-500 dark:text-white/40">{r.custom ? 'Penerima Custom' : (r.assignee_type === 'all' ? 'Semua' : `${r.assignee_type}: ${r.assignee_value}`)}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}
                </div>
            )}
            {/* ── Settle Modal ── */}
            {showSettle && settleTarget && createPortal(
                <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setShowSettle(false)}>
                    <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-5xl my-8 p-6 space-y-5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-black text-stone-800 dark:text-white">Settle Proforma → Invoice Asli</h3>
                                <p className="text-xs text-stone-400">{settleTarget.proforma_no} • {settleTarget.invoices?.map(i => i.dealer_name).join(', ')} • Total Proforma: {formatCurrency(settleTarget.total_nominal)}</p>
                            </div>
                            <button onClick={() => setShowSettle(false)} className="p-2 rounded-xl text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:bg-white/[0.05]">✕</button>
                        </div>
                        {settleError && (
                            <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">{settleError}</div>
                        )}

                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-left text-[10px] font-black uppercase tracking-wider text-stone-400 border-b border-white/60 dark:border-white/10">
                                        <th className="px-2 py-2">#</th>
                                        <th className="px-2 py-2">No Invoice Asli *</th>
                                        <th className="px-2 py-2">Tgl Invoice *</th>
                                        <th className="px-2 py-2">No Faktur (auto proforma)</th>
                                        <th className="px-2 py-2 text-right">DPP *</th>
                                        <th className="px-2 py-2 text-right">PPn (11%)</th>
                                        <th className="px-2 py-2 text-right">Materai</th>
                                        <th className="px-2 py-2 text-right">Diskon</th>
                                        <th className="px-2 py-2 text-right">Total</th>
                                        <th className="px-2 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {settleRows.map((r, i) => {
                                        const total = rowTotal(r);
                                        return (
                                            <tr key={i} className="border-b border-stone-50 dark:border-white/[0.06]">
                                                <td className="px-2 py-2 text-stone-400">{i + 1}</td>
                                                <td className="px-2 py-2">
                                                    <input className={inputCls + ' min-w-[140px]'} placeholder={t("invoice.placeNoInvoice")} value={r.no_invoice} onChange={e => updateSettleRow(i, { no_invoice: e.target.value })} />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input type="date" className={inputCls + ' min-w-[140px]'} value={r.tgl_invoice} onChange={e => updateSettleRow(i, { tgl_invoice: e.target.value })} />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input className={inputCls + ' min-w-[150px]'} value={r.no_faktur} onChange={e => updateSettleRow(i, { no_faktur: e.target.value })} />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <MoneyInput className={inputCls + ' text-right min-w-[120px]'} placeholder="0" value={r.dpp} onChange={v => updateSettleRow(i, { dpp: v })} />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <MoneyInput className={inputCls + ' text-right min-w-[100px]'} placeholder="0" value={r.ppn} onChange={v => updateSettleRow(i, { ppn: v, ppn_manual: true })} />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <MoneyInput className={inputCls + ' text-right min-w-[90px]'} placeholder="0" value={r.materai} onChange={v => updateSettleRow(i, { materai: v })} />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <MoneyInput className={inputCls + ' text-right min-w-[90px]'} placeholder="0" value={r.diskon} onChange={v => updateSettleRow(i, { diskon: v })} />
                                                </td>
                                                <td className="px-2 py-2 text-right font-bold text-teal-600 dark:text-teal-400 whitespace-nowrap">{formatCurrency(total)}</td>
                                                <td className="px-2 py-2 text-center">
                                                    {settleRows.length > 1 && (
                                                        <button onClick={() => setSettleRows(prev => prev.filter((_, j) => j !== i))} className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-white/[0.05]" title="Hapus baris">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <button
                                onClick={() => setSettleRows(prev => [...prev, { ...blankSettleRow(null), no_faktur: settleTarget.proforma_no || '' }])}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 dark:bg-[#0d0d0d] text-stone-600 dark:text-white/70 text-xs font-semibold hover:bg-stone-200"
                            >
                                <Plus size={14} /> Tambah Invoice Asli
                            </button>
                            <div className="text-xs text-stone-500 space-x-3">
                                <span>Total Proforma: <b className="text-stone-800 dark:text-white">{formatCurrency(round2((settleTarget?.invoices || []).filter(i => !(i.pp_type === 'pelunasan')).reduce((s, i) => s + (parseFloat(i.total_invoice) || 0), 0)))}</b></span>
                                <span>Total Settle: <b className={Math.abs(round2(settleRows.reduce((s, x) => s + rowTotal(x), 0)) - round2((settleTarget?.invoices || []).filter(i => !(i.pp_type === 'pelunasan')).reduce((s, i) => s + (parseFloat(i.total_invoice) || 0), 0))) <= 0.01 ? 'text-teal-600 dark:text-teal-400' : 'text-red-600'}>{formatCurrency(round2(settleRows.reduce((s, x) => s + rowTotal(x), 0)))}</b></span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label className="text-xs font-bold text-stone-500 dark:text-white/40 mb-1 block">Tanggal Settle</label>
                                <input type="date" className={inputCls} value={settleTglSet} onChange={e => setSettleTglSet(e.target.value)} />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs font-bold text-stone-500 dark:text-white/40 mb-1 block">Catatan</label>
                                <Textarea rows={1} value={settleNotes} onChange={e => setSettleNotes(e.target.value)} />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2">
                            {settleDraftAt && (
                                <div className="mr-auto text-[11px] text-amber-600 dark:text-amber-400">
                                    Draft tersimpan • {new Date(settleDraftAt).toLocaleString('id-ID')}
                                </div>
                            )}
                            <button onClick={handleSaveDraft} disabled={savingDraft || settling} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed">
                                <Save size={16} /> {savingDraft ? 'Menyimpan...' : 'Simpan Draft'}
                            </button>
                            <button onClick={() => setShowSettle(false)} disabled={settling || savingDraft} className="px-4 py-2.5 rounded-xl bg-stone-100 dark:bg-[#0d0d0d] text-stone-600 dark:text-white/70 text-sm font-semibold">Batal</button>
                             <button onClick={handleSettle} disabled={settling || savingDraft} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold shadow-lg shadow-teal-500/25 disabled:opacity-60 disabled:cursor-not-allowed">
                                <HandCoins size={16} /> {settling ? 'Menyetel...' : 'Settle'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ── New Invoice Modal ── */}
            {showNewInvoice && createPortal(
                <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setShowNewInvoice(false)}>
                    <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-4xl my-8 p-6 space-y-5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-black text-stone-800 dark:text-white">{editInvoiceId ? `Edit Invoice #${editInvoiceId}` : 'Buat Invoice'}</h3>
                                <p className="text-xs text-stone-400">Lengkapi data dealer dan daftar barang</p>
                            </div>
                            <button onClick={() => setShowNewInvoice(false)} className="p-2 rounded-xl text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:bg-white/[0.05]">✕</button>
                        </div>

                        {invError && (
                            <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">{invError}</div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-stone-500 dark:text-white/40 mb-1 block">Nama Dealer *</label>
                                <SearchAutocomplete
                                    value={dealers.find(d => Number(d.id) === Number(invForm.dealer_id))?.nama || ''}
                                    options={dealers}
                                    labelKey="nama"
                                    subKey="npwp"
                                    onSelect={(o) => setInvForm(prev => ({ ...prev, dealer_id: String(o.id), pelunasan_of_id: '' }))}
                                    className={inputCls + ' pr-7'}
                                    placeholder={t("invoice.searchDealer")}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-stone-500 dark:text-white/40 mb-1 block">No. PO *</label>
                                <input className={inputCls} value={invForm.no_po} onChange={e => setInvForm({ ...invForm, no_po: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-stone-500 dark:text-white/40 mb-1 block">Tgl. PO *</label>
                                <input type="date" className={inputCls} value={invForm.tgl_po} onChange={e => setInvForm({ ...invForm, tgl_po: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-stone-500 dark:text-white/40 mb-1 block">Tipe Invoice *</label>
                                <select className={inputCls} value={invForm.tipe} onChange={e => {
                                    const tipe = e.target.value;
                                    setInvForm(prev => ({
                                        ...prev,
                                        tipe,
                                        pp_type: tipe === 'PP' ? (prev.pp_type || 'dp') : 'dp',
                                        pelunasan_of_id: tipe === 'PP' ? prev.pelunasan_of_id : '',
                                    }));
                                }}>
                                    {Object.entries(TIPE_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                </select>
                                <p className="text-[10px] text-stone-400 mt-1">{TIPE_MAP[invForm.tipe]?.desc}</p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-stone-500 dark:text-white/40 mb-1 block">Tgl. Transaksi *</label>
                                <input type="date" className={inputCls} value={invForm.tgl_transaksi} onChange={e => setInvForm({ ...invForm, tgl_transaksi: e.target.value })} />
                            </div>
                            {invForm.tipe === 'PP' ? (
                                <>
                                    <div>
                                        <label className="text-xs font-bold text-stone-500 dark:text-white/40 mb-1 block">Opsi Partial Payment *</label>
                                        <select className={inputCls} value={invForm.pp_type || 'dp'} onChange={e => {
                                            const ppType = e.target.value;
                                            setInvForm(prev => ({
                                                ...prev,
                                                pp_type: ppType,
                                                pelunasan_of_id: ppType === 'pelunasan' ? prev.pelunasan_of_id : '',
                                            }));
                                        }}>
                                            <option value="dp">{t("opt.dp")}</option>
                                            <option value="pelunasan">{t("opt.pelunasan")}</option>
                                        </select>
                                        <p className="text-[10px] text-stone-400 mt-1">
                                            {invForm.pp_type === 'pelunasan'
                                                ? 'Pilih PO DP sebagai referensi pelunasan — data otomatis ditarik.'
                                                : 'Input nilai penuh & DP; sisanya dihitung otomatis.'}
                                        </p>
                                    </div>

                                    {invForm.pp_type === 'pelunasan' ? (
                                        <>
                                            <div>
                                                <label className="text-xs font-bold text-stone-500 dark:text-white/40 mb-1 block">{t("invoice.refPoDp")}</label>
                                                <select
                                                    className={inputCls}
                                                    value={invForm.pelunasan_of_id || ''}
                                                    onChange={e => handleSelectPelunasanPo(e.target.value)}
                                                >
                                                    <option value="">{t("opt.selectPoDp")}</option>
                                                    {ppParents.map(p => {
                                                        const rem = ppRemaining(p.id, editInvoiceId);
                                                        return (
                                                            <option key={p.id} value={String(p.id)}>
                                                                #{p.id} - {p.no_po || '-'} ({formatCurrency(p.total_invoice)} / DP {formatCurrency(p.uang_masuk)}, Sisa {formatCurrency(rem)})
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                                {!ppParents.length && (
                                                    <p className="text-[10px] text-red-500 mt-1">Tidak ada invoice PP (DP) untuk dealer ini.</p>
                                                )}
                                            </div>
                                            {(() => {
                                                const rem = invForm.pelunasan_of_id ? ppRemaining(invForm.pelunasan_of_id, editInvoiceId) : null;
                                                if (rem == null) return null;
                                                const parent = (invoices || []).find(i => String(i.id) === String(invForm.pelunasan_of_id));
                                                const others = (invoices || []).filter(i =>
                                                    String(i.pelunasan_of_id) === String(invForm.pelunasan_of_id)
                                                    && i.status !== 'cancelled'
                                                    && String(i.id) !== String(editInvoiceId)
                                                );
                                                const paidPelunasan = others.reduce((s, i) => s + (parseFloat(i.uang_masuk) || 0), 0);
                                                return (
                                                    <div className="col-span-full rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-4 py-3 text-xs space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-semibold text-blue-700 dark:text-blue-300">Sisa Full Amount {invForm.pelunasan_of_id ? `(PO ${parent?.no_po || '-'})` : ''}</span>
                                                            <span className="text-base font-black text-blue-800 dark:text-blue-200">{formatCurrency(rem)}</span>
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-2 text-[11px] text-blue-600 dark:text-blue-400">
                                                            <span>Full: <b>{formatCurrency(parent?.total_invoice)}</b></span>
                                                            <span>DP: <b>{formatCurrency(parent?.uang_masuk)}</b></span>
                                                            <span>{t("invoice.pelunasanOther")} <b>{formatCurrency(paidPelunasan)}</b></span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                            <div>
                                                <label className="text-xs font-bold text-stone-500 dark:text-white/40 mb-1 block">Total Invoice (Full Amount) — sama dengan DP *</label>
                                                <MoneyInput className={inputCls + ' bg-stone-100 dark:bg-[#111] cursor-not-allowed'} placeholder="0" value={invForm.total_invoice} onChange={() => {}} />
                                                <p className="text-[10px] text-stone-400 mt-1">{t("invoice.pelunasanHelp")}</p>
                                            </div>
                                        </>
                                    ) : (
                                        <div>
                                            <label className="text-xs font-bold text-stone-500 dark:text-white/40 mb-1 block">Total Invoice (Full Amount) *</label>
                                            <MoneyInput className={inputCls} placeholder="0" value={invForm.total_invoice} onChange={v => { totalTouchedRef.current = true; setInvForm(prev => ({ ...prev, total_invoice: v })); }} />
                                            <p className="text-[10px] text-stone-400 mt-1">{t("invoice.dpHelp")}</p>
                </div>
            )}


                                    <div>
                                        <label className="text-xs font-bold text-stone-500 dark:text-white/40 mb-1 block">{invForm.pp_type === 'pelunasan' ? 'Uang Masuk (Pelunasan) *' : 'Uang Masuk (DP) *'}</label>
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
                                        <label className="text-xs font-bold text-stone-500 dark:text-white/40 mb-1 block">Tgl. Uang Masuk *</label>
                                        <input type="date" className={inputCls} value={invForm.tgl_uang_masuk} onChange={e => setInvForm({ ...invForm, tgl_uang_masuk: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-stone-500 dark:text-white/40 mb-1 block">PPN Rate (%)</label>
                                        <input type="number" step="1" min="0" max="100" className={inputCls + ' text-center tabular-nums'} value={Math.round((parseFloat(invForm.ppn_rate) || 0.11) * 100)} onChange={e => {
                                            const pct = parseFloat(e.target.value) || 0;
                                            setInvForm(prev => ({ ...prev, ppn_rate: Math.min(100, Math.max(0, pct)) / 100 }));
                                        }} />
                                        <p className="text-[10px] text-stone-400 mt-1">PPN: {formatCurrency(ppnVal)}</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className="text-xs font-bold text-stone-500 dark:text-white/40 mb-1 block">{invForm.tipe === 'PF' ? 'Uang Masuk (Opsional)' : 'Uang Masuk *'}</label>
                                        <MoneyInput className={inputCls} placeholder="0" value={invForm.uang_masuk} onChange={v => setInvForm({ ...invForm, uang_masuk: v })} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-stone-500 dark:text-white/40 mb-1 block">{invForm.tipe === 'PF' ? 'Tgl. Uang Masuk (Opsional)' : 'Tgl. Uang Masuk *'}</label>
                                        <input type="date" className={inputCls} value={invForm.tgl_uang_masuk} onChange={e => setInvForm({ ...invForm, tgl_uang_masuk: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-stone-500 dark:text-white/40 mb-1 block">PPN Rate (%)</label>
                                        <input type="number" step="1" min="0" max="100" className={inputCls + ' text-center tabular-nums'} value={Math.round((parseFloat(invForm.ppn_rate) || 0.11) * 100)} onChange={e => {
                                            const pct = parseFloat(e.target.value) || 0;
                                            setInvForm(prev => ({ ...prev, ppn_rate: Math.min(100, Math.max(0, pct)) / 100 }));
                                        }} />
                                        <p className="text-[10px] text-stone-400 mt-1">PPN: {formatCurrency(ppnVal)}</p>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Items */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-bold text-stone-500 dark:text-white/40">Daftar Barang *</label>
                                <button onClick={addRow} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-500/20">
                                    <Plus size={13} /> Tambah Barang
                                </button>
                            </div>
                            <div className="rounded-xl border border-stone-200 dark:border-white/[0.06]">
                                <div className="grid grid-cols-14 gap-2 px-3 py-2 bg-stone-100 dark:bg-[#0d0d0d] text-[10px] font-bold text-stone-500 dark:text-white/40 uppercase tracking-wide border-b border-stone-200 dark:border-white/[0.06] rounded-t-xl">
                                    <div className="col-span-3">Model</div>
                                    <div className="col-span-3">Item Description</div>
                                    <div className="col-span-1 text-center">Qty</div>
                                    <div className="col-span-2 text-right">Harga</div>
                                    <div className="col-span-2 text-right">Subtotal</div>
                                    <div className="col-span-2 text-right">PPN</div>
                                    <div className="col-span-1"></div>
                                </div>
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {invRows.map((row, idx) => (
                                        <div key={idx} className="grid grid-cols-14 gap-1.5 px-3 py-2 items-center">
                                            <div className="col-span-3">
                                                <SearchAutocomplete
                                                    value={row.model}
                                                    options={barang}
                                                    labelKey="model"
                                                    subKey="item_description"
                                                    onSelect={(o) => onSelectModel(idx, o.model)}
                                                    className={inputCls + ' pr-7 h-[38px]'}
                                                    placeholder={t("invoice.searchModel")}
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                <input className={inputCls + ' h-[38px]'} placeholder="Item Description (otomatis)" readOnly value={row.item_description || ''} />
                                            </div>
                                            <div className="col-span-1">
                                                <input className={inputCls + ' h-[38px] text-center tabular-nums'} type="number" min="1" value={row.qty} onChange={e => updateRow(idx, { qty: e.target.value })} />
                                            </div>
                                            <div className="col-span-2">
                                                <MoneyInput className={inputCls + ' h-[38px] text-right tabular-nums'} placeholder={t("invoice.placePrice")} value={row.harga} onChange={v => updateRow(idx, { harga: v })} />
                                            </div>
                                            <div className="col-span-2 h-[38px] flex items-center justify-end text-right font-bold text-sm text-stone-800 dark:text-white tabular-nums whitespace-nowrap">
                                                {formatCurrency((parseFloat(row.harga) || 0) * (parseInt(row.qty) || 0))}
                                            </div>
                                            <div className="col-span-2 h-[38px] flex items-center justify-end pr-1">
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    className={inputCls + ' h-[30px] w-full text-right text-[11px] font-bold text-blue-600 dark:text-blue-400 tabular-nums px-1.5 cursor-text'}
                                                    placeholder={formatCurrency(Math.round(((parseFloat(row.harga) || 0) * (parseInt(row.qty) || 0)) * (parseFloat(invForm.ppn_rate) || 0.11)))}
                                                    value={row.ppn_override != null && row.ppn_override !== '' ? formatCurrency(Math.round(parseFloat(row.ppn_override) || 0)) : formatCurrency(Math.round(((parseFloat(row.harga) || 0) * (parseInt(row.qty) || 0)) * (parseFloat(invForm.ppn_rate) || 0.11)))}
                                                    onFocus={e => e.target.select()}
                                                    onChange={e => {
                                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                                        updateRow(idx, { ppn_override: raw ? Number(raw) : '' });
                                                    }}
                                                />
                                            </div>
                                            <div className="col-span-1 h-[38px] flex items-center justify-end">
                                                <button onClick={() => removeRow(idx)} className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-white/[0.05]"><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 bg-stone-50 dark:bg-[#0d0d0d]/50 rounded-2xl p-4 items-stretch">
                            <div className="flex flex-col gap-1.5 min-w-0">
                                <label className="text-[10px] font-bold text-stone-400 uppercase truncate">Subtotal</label>
                                <div className="min-h-[38px] flex items-center font-bold text-stone-800 dark:text-white text-sm tabular-nums">{formatCurrency(subtotalAll)}</div>
                                <div className="h-[12px] text-[9px] text-stone-400 truncate">Total seluruh barang</div>
                            </div>
                            <div className="flex flex-col gap-1.5 min-w-0">
                                <label className="text-[10px] font-bold text-stone-400 uppercase truncate">Total PPN</label>
                                <MoneyInput
                                    className="w-full rounded-lg border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl px-2 h-[38px] text-sm font-bold text-blue-600 dark:text-blue-400 tabular-nums"
                                    placeholder="0"
                                    value={invForm.ppn_custom ? (invForm.ppn_amount || '') : ppnVal || ''}
                                    onChange={v => setInvForm(prev => ({ ...prev, ppn_custom: true, ppn_amount: v }))}
                                />
                                <div className="h-[12px] text-[9px] text-stone-400 truncate">{invForm.ppn_custom ? 'Custom override' : 'Auto dari item'}</div>
                            </div>
                            <div className="flex flex-col gap-1.5 min-w-0">
                                <label className="text-[10px] font-bold text-stone-400 uppercase truncate">Diskon</label>
                                <MoneyInput className="w-full rounded-lg border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl px-2 h-[38px] text-xs text-stone-800 dark:text-white tabular-nums" placeholder="0" value={invForm.diskon} onChange={v => setInvForm(prev => ({ ...prev, diskon: v }))} />
                                <div className="h-[12px] text-[9px] text-stone-400 truncate">Potongan harga</div>
                            </div>
                            <div className="flex flex-col gap-1.5 min-w-0">
                                <label className="text-[10px] font-bold text-stone-400 uppercase truncate">Materai</label>
                                <MoneyInput className="w-full rounded-lg border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl px-2 h-[38px] text-xs text-stone-800 dark:text-white tabular-nums" placeholder="0" value={invForm.materai} onChange={v => setInvForm(prev => ({ ...prev, materai: v }))} />
                                <div className="h-[12px] text-[9px] text-stone-400 truncate">Biaya materai</div>
                            </div>
                            <div className="flex flex-col gap-1.5 min-w-0">
                                <label className="text-[10px] font-bold text-stone-400 uppercase truncate">Total Invoice {invForm.tipe === 'PP' ? '(Full Amount) *' : '*'}</label>
                                <div className="h-[38px] flex items-center">
                                    <MoneyInput
                                        className="w-full rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl px-2 h-[38px] text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums"
                                        placeholder="0"
                                        value={invForm.total_invoice}
                                        onChange={v => {
                                            totalTouchedRef.current = true;
                                            setInvForm(prev => ({ ...prev, total_invoice: v }));
                                        }}
                                    />
                                </div>
                                <div className="h-[12px] text-[9px] text-stone-400 truncate" title="Otomatis dari barang, bisa disesuaikan jika ada selisih pembulatan">Auto dari barang • bisa disesuaikan (pembulatan)</div>
                            </div>
                            {invForm.tipe === 'PP' && (() => {
                                const uangMasukNow = parseFloat(invForm.uang_masuk) || 0;
                                let sisaVal;
                                let sisaLabel;
                                if (invForm.pp_type === 'pelunasan') {
                                    sisaVal = invForm.pelunasan_of_id
                                        ? round2(ppRemaining(invForm.pelunasan_of_id, editInvoiceId) - uangMasukNow)
                                        : round2(totalInvoice - uangMasukNow);
                                    sisaLabel = 'Sisa grup setelah pelunasan ini';
                                } else {
                                    sisaVal = round2(totalInvoice - uangMasukNow);
                                    sisaLabel = t('invoice.pelunasanToPay');
                                }
                                const lunas = sisaVal <= 0.01;
                                return (
                                    <div className="flex flex-col gap-1.5 min-w-0">
                                        <label className="text-[10px] font-bold text-stone-400 uppercase truncate">Sisa (Yang Harus Dilunasi)</label>
                                        <div className={`h-[38px] flex items-center text-sm font-black tabular-nums whitespace-nowrap ${lunas ? 'text-teal-600 dark:text-teal-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                            {lunas ? 'LUNAS' : formatCurrency(sisaVal)}
                                        </div>
                                        <div className="h-[12px] text-[9px] text-stone-400 truncate" title={sisaLabel}>{sisaLabel}</div>
                                    </div>
                                );
                            })()}
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button onClick={() => setShowNewInvoice(false)} disabled={savingInvoice} className="px-4 py-2.5 rounded-xl bg-stone-100 dark:bg-[#0d0d0d] text-stone-600 dark:text-white/70 text-sm font-semibold">Batal</button>
                            <button onClick={handleCreateInvoice} disabled={savingInvoice} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-lg shadow-emerald-500/25 disabled:opacity-60 disabled:cursor-not-allowed">
                                <CheckCircle2 size={16} /> {savingInvoice ? 'Menyimpan...' : (editInvoiceId ? 'Update Invoice' : 'Simpan Invoice')}
                             </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ── Proforma Request Modal ── */}
            {showProforma && createPortal(
                <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setShowProforma(false)}>
                    <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-2xl my-8 p-6 space-y-5" onClick={e => e.stopPropagation()}>
                        <div>
                            <h3 className="text-xl font-black text-stone-800 dark:text-white">{proformaResubmit ? 'Submit Ulang Proforma' : 'Ajukan No Proforma'}</h3>
                            <p className="text-xs text-stone-400">{proformaResubmit ? 'Perbaiki data & lampiran yang salah, lalu ajukan kembali' : 'Lampirkan dokumen pendukung untuk invoice terpilih'}</p>
                        </div>
                        <div className="space-y-2">
                            {(() => {
                                const sels = (proformaForm.invoice_ids || []).map(id =>
                                    filteredInvoices.find(i => i.id === id) || invoices.find(i => i.id === id)
                                ).filter(Boolean);
                                if (!sels.length) return <div className="text-sm text-stone-400">Invoice tidak ditemukan.</div>;
                                return sels.map(sel => (
                                    <div key={sel.id} className="p-3 rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10">
                                        <div className="text-sm font-semibold text-stone-800 dark:text-white">#{sel.id} • {sel.dealer_name}</div>
                                        <div className="text-xs text-stone-400">{sel.no_po} • {formatCurrency(sel.total_invoice)}</div>
                                    </div>
                                ));
                            })()}
                        </div>
                        <div>
                            <label className="text-xs font-bold text-stone-500 dark:text-white/40 mb-1 block">Lampiran Dokumen Pendukung <span className="text-red-500">*</span></label>
                            {(proformaForm.attachments || []).length > 0 && (
                                <div className="mb-2 flex flex-wrap gap-2">
                                    {(proformaForm.attachments || []).map((f, i) => (
                                        <span key={'old-' + i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs">
                                            <FileText size={12} /> {f.length > 26 ? f.slice(0, 26) + '…' : f}
                                            <button type="button" onClick={() => setProformaForm(prev => ({ ...prev, attachments: (prev.attachments || []).filter((_, j) => j !== i) }))} className="text-red-400 hover:text-red-600" title="Hapus lampiran lama">
                                                <X size={12} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => setProformaFiles([...e.target.files])} />
                            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-stone-300 dark:border-white/[0.08] text-stone-500 dark:text-white/70 text-sm w-full justify-center hover:border-blue-400 hover:text-blue-500">
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
                            <button onClick={() => setShowProforma(false)} className="px-4 py-2.5 rounded-xl bg-stone-100 dark:bg-[#0d0d0d] text-stone-600 dark:text-white/70 text-sm font-semibold">Batal</button>
                            <button onClick={handleNewProforma} disabled={savingProforma} className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-bg hover:opacity-95 text-white text-sm font-bold shadow-lg shadow-blue-500/25 disabled:opacity-60 disabled:cursor-not-allowed">
                                <FileSignature size={16} /> {savingProforma ? 'Mengirim...' : proformaResubmit ? 'Ajukan Ulang' : 'Ajukan'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ── Tax Modal ── */}
            {showTax && taxTarget && createPortal(
                <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setShowTax(false)}>
                    <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-lg my-8 p-6 space-y-5" onClick={e => e.stopPropagation()}>
                        <div>
                            <h3 className="text-xl font-black text-stone-800 dark:text-white">Faktur Pajak</h3>
                            <p className="text-xs text-stone-400">Invoice #{taxTarget.id} • {taxTarget.proforma_no} • {taxTarget.dealer_name}</p>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-stone-500 dark:text-white/40 mb-1 block">No. Faktur Pajak *</label>
                            <input className={inputCls} inputMode="numeric" maxLength={17} placeholder="17 digit angka" value={taxForm.faktur_pajak_no}
                                onChange={e => setTaxForm({ ...taxForm, faktur_pajak_no: e.target.value.replace(/\D/g, '') })} />
                            <p className="text-[10px] text-stone-400 mt-1">Wajib 17 digit angka</p>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-stone-500 dark:text-white/40 mb-1 block">File Faktur Pajak <span className="text-red-500">*</span></label>
                            <input ref={taxFileRef} type="file" className="hidden" onChange={e => setTaxForm({ ...taxForm, file: e.target.files[0] })} />
                            <button onClick={() => taxFileRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-stone-300 dark:border-white/[0.08] text-stone-500 dark:text-white/70 text-sm w-full justify-center hover:border-blue-400 hover:text-blue-500">
                                <Upload size={16} /> {taxForm.file ? taxForm.file.name : 'Pilih File Faktur Pajak'}
                            </button>
                        </div>
                         <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setShowTax(false)} className="px-4 py-2.5 rounded-xl bg-stone-100 dark:bg-[#0d0d0d] text-stone-600 dark:text-white/70 text-sm font-semibold">Batal</button>
                            <button onClick={handleTax} disabled={savingTax} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-lg shadow-blue-500/25 disabled:opacity-60 disabled:cursor-not-allowed">
                                <FileText size={16} /> {savingTax ? 'Menyimpan...' : 'Simpan Faktur Pajak'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ── Tax Request Modal (Ajukan ke bagian tax) ── */}
            {showTaxRequest && taxRequestTarget && createPortal(
                <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setShowTaxRequest(false)}>
                    <div className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-lg my-8 p-6 space-y-5" onClick={e => e.stopPropagation()}>
                        <div>
                            <h3 className="text-xl font-black text-stone-800 dark:text-white">Ajukan Faktur Pajak</h3>
                            <p className="text-xs text-stone-400">Invoice #{taxRequestTarget.id} • {taxRequestTarget.proforma_no} • {taxRequestTarget.dealer_name}</p>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-stone-500 dark:text-white/40 mb-1 block">Lampiran Pendukung <span className="text-red-500">*</span></label>
                            <input ref={taxRequestFileRef} type="file" multiple className="hidden" onChange={e => setTaxRequestFiles([...(e.target.files || [])])} />
                            <button onClick={() => taxRequestFileRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-stone-300 dark:border-white/[0.08] text-stone-500 dark:text-white/70 text-sm w-full justify-center hover:border-orange-400 hover:text-orange-500">
                                <Upload size={16} /> {taxRequestFiles.length ? `${taxRequestFiles.length} file dipilih` : 'Pilih File Lampiran'}
                            </button>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-stone-500 dark:text-white/40 mb-1 block">Catatan (opsional)</label>
                            <Textarea rows={2} value={taxRequestNotes} onChange={e => setTaxRequestNotes(e.target.value)} placeholder="Catatan untuk bagian tax..." />
                        </div>
                        <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setShowTaxRequest(false)} className="px-4 py-2.5 rounded-xl bg-stone-100 dark:bg-[#0d0d0d] text-stone-600 dark:text-white/70 text-sm font-semibold">Batal</button>
                            <button onClick={() => handleSubmitTax(taxRequestTarget.id)} disabled={savingTaxRequest} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold shadow-lg shadow-orange-500/25 disabled:opacity-60 disabled:cursor-not-allowed">
                                <Upload size={16} /> {savingTaxRequest ? 'Mengirim...' : 'Ajukan ke Tax'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ── Cancel Confirmation Modal ── */}
            {deleteTarget && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 10 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-md p-6 relative z-10 space-y-4 border border-white/60 dark:border-white/10"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 ring-4 ring-red-50 dark:ring-red-500/5">
                                    <Trash2 size={24} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-stone-800 dark:text-white leading-tight">
                                        {deleteTarget.type === 'proforma' ? 'Hapus Proforma?' : 'Hapus Invoice?'}
                                    </h3>
                                    <p className="text-xs text-stone-400 mt-0.5">
                                        {deleteTarget.type === 'proforma'
                                            ? `Proforma ${deleteTarget.item.proforma_no || '#' + deleteTarget.item.id} • ${(deleteTarget.item.invoices || []).length} invoice`
                                            : `Invoice #${deleteTarget.item.id} • ${deleteTarget.item.dealer_name || '-'}`}
                                    </p>
                                </div>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 space-y-2">
                                <p className="font-bold">Data akan dipindahkan ke Sampah.</p>
                                <ul className="list-disc list-inside text-[11px] text-amber-600 dark:text-amber-400 space-y-1 font-medium">
                                    {deleteTarget.type === 'proforma' ? (
                                        <>
                                            <li>Seluruh invoice di dalam proforma ini ikut dipindahkan ke Sampah.</li>
                                            <li>Masih bisa dipulihkan (Restore) dari tab Sampah kapan pun.</li>
                                        </>
                                    ) : (
                                        <>
                                            <li>Invoice dipindahkan ke Sampah, bukan dihapus permanen.</li>
                                            <li>Masih bisa dipulihkan (Restore) dari tab Sampah kapan pun.</li>
                                        </>
                                    )}
                                </ul>
                            </div>

                            <div className="flex items-center justify-end gap-2.5 pt-1">
                                <button
                                    onClick={() => setDeleteTarget(null)}
                                    className="px-4 py-2.5 rounded-xl bg-stone-100 dark:bg-[#0d0d0d] text-stone-600 dark:text-white/70 text-xs font-bold hover:bg-stone-200 dark:hover:bg-white/[0.06] transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    disabled={deleting}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-xs font-bold shadow-lg shadow-red-600/25 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <Trash2 size={14} /> {deleting ? 'Menghapus...' : (deleteTarget.type === 'proforma' ? 'Ya, Hapus Proforma' : 'Ya, Hapus Invoice')}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </AnimatePresence>,
                document.body
            )}

            {permTarget && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[125] flex items-center justify-center p-4" onClick={() => setPermTarget(null)}>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 10 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-md p-6 relative z-10 space-y-4 border border-white/60 dark:border-white/10"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 ring-4 ring-red-50 dark:ring-red-500/5">
                                    <Trash2 size={24} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-stone-800 dark:text-white leading-tight">
                                        {permTarget.type === 'proforma' ? 'Hapus Permanen Proforma?' : 'Hapus Permanen Invoice?'}
                                    </h3>
                                    <p className="text-xs text-stone-400 mt-0.5">
                                        {permTarget.type === 'proforma'
                                            ? `Proforma ${permTarget.item.proforma_no || '#' + permTarget.item.id} • ${(permTarget.item.invoices || []).length} invoice`
                                            : `Invoice #${permTarget.item.id} • ${permTarget.item.dealer_name || '-'}`}
                                    </p>
                                </div>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-xs text-red-600 dark:text-red-300 space-y-2">
                                <p className="font-bold">Tindakan ini TIDAK dapat dibatalkan!</p>
                                <ul className="list-disc list-inside text-[11px] text-red-500 dark:text-red-400 space-y-1 font-medium">
                                    <li>Data dihapus permanen dari database (termasuk item & lampiran).</li>
                                    <li>Data tidak dapat dipulihkan lagi setelah ini.</li>
                                </ul>
                            </div>

                            <div className="flex items-center justify-end gap-2.5 pt-1">
                                <button
                                    onClick={() => setPermTarget(null)}
                                    className="px-4 py-2.5 rounded-xl bg-stone-100 dark:bg-[#0d0d0d] text-stone-600 dark:text-white/70 text-xs font-bold hover:bg-stone-200 dark:hover:bg-white/[0.06] transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={confirmPermanentDelete}
                                    disabled={permDeleting}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-xs font-bold shadow-lg shadow-red-600/25 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <Trash2 size={14} /> {permDeleting ? 'Menghapus...' : 'Ya, Hapus Permanen'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </AnimatePresence>,
                document.body
            )}

            {cancelTarget && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" onClick={() => setCancelTarget(null)}>
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                        />
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 10 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-md p-6 relative z-10 space-y-4 border border-white/60 dark:border-white/10" 
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 ring-4 ring-red-50 dark:ring-red-500/5">
                                    <Ban size={24} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-stone-800 dark:text-white leading-tight">Konfirmasi Pembatalan Invoice</h3>
                                    <p className="text-xs text-stone-400 mt-0.5">Invoice #{cancelTarget.id} • {cancelTarget.dealer_name || '-'}</p>
                                </div>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#0d0d0d]/50 border border-white/60 dark:border-white/10 text-xs text-stone-600 dark:text-white/70 space-y-2">
                                <p>Apakah Anda yakin ingin membatalkan invoice ini?</p>
                                <ul className="list-disc list-inside text-[11px] text-stone-500 space-y-1 font-medium">
                                    <li>Data akan tetap tersimpan dalam riwayat (history).</li>
                                    {cancelTarget.no_po && <li>No. PO akan diubah menjadi unik, mis. <code className="px-1 py-0.5 rounded bg-stone-200 dark:bg-[#111] font-mono font-bold text-red-600 dark:text-red-400">{cancelTarget.no_po.replace(/_batal\d*$/, '')}_batal001</code> (ditambah nomor urut otomatis).</li>}
                                    {cancelTarget.proforma_no && <li>No. Proforma akan diubah menjadi unik, mis. <code className="px-1 py-0.5 rounded bg-stone-200 dark:bg-[#111] font-mono font-bold text-red-600 dark:text-red-400">{cancelTarget.proforma_no.replace(/_batal\d*$/, '')}_batal001</code>.</li>}
                                </ul>
                            </div>

                            <div className="flex items-center justify-end gap-2.5 pt-1">
                                <button 
                                    onClick={() => setCancelTarget(null)} 
                                    className="px-4 py-2.5 rounded-xl bg-stone-100 dark:bg-[#0d0d0d] text-stone-600 dark:text-white/70 text-xs font-bold hover:bg-stone-200 dark:hover:bg-white/[0.06] transition-colors"
                                >
                                    Batal
                                </button>
                                <button 
                                    onClick={confirmCancel} 
                                    disabled={cancelling}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-xs font-bold shadow-lg shadow-red-600/25 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <Ban size={14} /> {cancelling ? 'Membatalkan...' : 'Ya, Batalkan Invoice'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </AnimatePresence>,
                document.body
            )}

            {deleteReplTarget && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" onClick={() => setDeleteReplTarget(null)}>
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                        />
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 10 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-md p-6 relative z-10 space-y-4 border border-white/60 dark:border-white/10" 
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 ring-4 ring-red-50 dark:ring-red-500/5">
                                    <Trash2 size={24} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-stone-800 dark:text-white leading-tight">Hapus Invoice Pengganti?</h3>
                                    <p className="text-xs text-stone-400 mt-0.5">Invoice #{deleteReplTarget.id} • {deleteReplTarget.no_invoice || '-'} • {deleteReplTarget.dealer_name || '-'}</p>
                                </div>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#0d0d0d]/50 border border-white/60 dark:border-white/10 text-xs text-stone-600 dark:text-white/70 space-y-2">
                                <p>Apakah Anda yakin ingin menghapus invoice pengganti ini?</p>
                                <ul className="list-disc list-inside text-[11px] text-stone-500 space-y-1 font-medium">
                                    <li>{t("invoice.delReplaceWarning")} <b>{deleteReplTarget.no_invoice || '#' + deleteReplTarget.id}</b> akan dihapus permanen beserta item barangnya.</li>
                                    <li>Invoice asal <b>#{deleteReplTarget.rejected_from_id}</b> akan kembali ke status <b className="text-rose-500">rejected</b> tanpa pengganti, dan bisa dibuat ulang lewat menu <b>"Input Data Baru"</b>.</li>
                                </ul>
                            </div>

                            <div className="flex items-center justify-end gap-2.5 pt-1">
                                <button 
                                    onClick={() => setDeleteReplTarget(null)} 
                                    className="px-4 py-2.5 rounded-xl bg-stone-100 dark:bg-[#0d0d0d] text-stone-600 dark:text-white/70 text-xs font-bold hover:bg-stone-200 dark:hover:bg-white/[0.06] transition-colors"
                                >
                                    Batal
                                </button>
                                <button 
                                    onClick={confirmDeleteReplacement} 
                                    disabled={deletingRepl}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-xs font-bold shadow-lg shadow-red-600/25 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <Trash2 size={14} /> {deletingRepl ? 'Menghapus...' : 'Ya, Hapus Pengganti'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </AnimatePresence>,
                document.body
            )}

            {/* ── Detail Modal ── */}
            <SuperDetailModal
                open={showDetail && !!detailTarget}
                onClose={() => setShowDetail(false)}
                detailTarget={detailTarget}
                proformas={proformas}
                invoices={invoices}
                onNavigate={async (inv) => {
                    if (!inv || !inv.id) return;
                    setDetailTarget(inv);
                    try {
                        const detail = await invoiceService.getById(inv.id);
                        setDetailTarget(prev => ({ ...prev, ...detail }));
                    } catch {}
                }}
                formatCurrency={formatCurrency}
                invoiceService={invoiceService}
                digitalSign={digitalSign}
                onToggleDigitalSign={toggleDigitalSign}
            />

            {/* ── Audit Trail Modal ── */}
            <AuditTrailModal
                open={showAudit && !!auditTarget}
                onClose={() => setShowAudit(false)}
                target={auditTarget}
                proformas={proformas}
                formatCurrency={formatCurrency}
            />

            {/* ── Modal Aksi Proforma (Approve / Sendback) ── */}
            {actionModal && createPortal(
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    onClick={() => setActionModal(null)}
                >
                    <motion.div
                        initial={{ scale: 0.95, y: 12 }}
                        animate={{ scale: 1, y: 0 }}
                        transition={{ type: 'spring', damping: 24, stiffness: 300 }}
                        className="w-full max-w-md bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {(() => {
                            const type = actionModal.type;
                            const p = actionModal.p;
                            const isTax = type === 'sendback_tax';
                            const config = {
                                approve: { title: 'Approve Proforma', icon: <CheckCircle2 size={20} className="text-emerald-600" />, accent: 'bg-emerald-500', confirm: 'Ya, Approve', noteRequired: false, noteLabel: '', notePlaceholder: '' },
                                sendback: { title: 'Sendback Proforma', icon: <RefreshCw size={20} className="text-amber-600" />, accent: 'bg-amber-500', confirm: 'Kirim Balik', noteRequired: true, noteLabel: 'Alasan sendback *', notePlaceholder: 'Jelaskan perbaikan yang diperlukan...' },

                                sendback_tax: { title: 'Sendback Tax Request', icon: <RefreshCw size={20} className="text-rose-600" />, accent: 'bg-rose-500', confirm: 'Kirim Balik', noteRequired: true, noteLabel: 'Alasan sendback *', notePlaceholder: 'Jelaskan perbaikan yang diperlukan...' },

                            }[type] || { title: type, icon: <CheckCircle2 size={20} className="text-stone-600" />, accent: 'bg-stone-500', confirm: 'Simpan', noteRequired: false, noteLabel: '', notePlaceholder: '' };
                            const dealer = p?.dealer_name || (p?.invoices?.[0]?.dealer_name) || '-';
                            const po = p?.no_po || (p?.invoices?.[0]?.no_po) || '-';
                            const total = p?.total_invoice != null ? p.total_invoice : (p?.total_nominal != null ? p.total_nominal : (p?.invoices?.[0]?.total_invoice));
                            const proformaNo = p?.proforma_no || (p?._proforma?.proforma_no) || (isTax ? (p?.proforma_no || 'Proforma #' + (p?._proforma?.id || p?.proforma_id || '')) : 'Menunggu No Proforma');
                            const invCount = Array.isArray(p?.invoices) ? p.invoices.length : (p?.id ? 1 : 0);
                            return (
                                <>
                                    <div className={`h-1.5 ${config.accent}`} />
                                    <div className="px-6 py-5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="p-3 rounded-2xl bg-stone-100 dark:bg-[#0d0d0d]">{config.icon}</div>
                                                <div>
                                                    <h3 className="font-black text-lg text-stone-800 dark:text-white leading-tight">{config.title}</h3>
                                                    <p className="text-xs text-stone-400 mt-0.5">{isTax ? 'Mengembalikan request faktur pajak ke requester' : 'Konfirmasi tindakan untuk proforma ini'}</p>
                                                </div>
                                            </div>
                                            <button onClick={() => setActionModal(null)} className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 dark:hover:bg-white/[0.05] hover:text-stone-600 dark:hover:text-white/80">
                                                <X size={18} />
                                            </button>
                                        </div>

                                        <div className="mt-5 space-y-2.5 rounded-2xl bg-stone-50 dark:bg-[#0d0d0d]/50 border border-white/60 dark:border-white/10 p-4 text-sm">
                                            <div className="flex justify-between gap-3"><span className="text-xs text-stone-400 shrink-0">No Proforma</span><span className="font-semibold text-stone-700 dark:text-white/80 text-right">{proformaNo}</span></div>
                                            <div className="flex justify-between gap-3"><span className="text-xs text-stone-400 shrink-0">Dealer</span><span className="font-semibold text-stone-700 dark:text-white/80 text-right truncate max-w-[220px]">{dealer}</span></div>
                                            <div className="flex justify-between gap-3"><span className="text-xs text-stone-400 shrink-0">No. PO</span><span className="font-semibold text-stone-700 dark:text-white/80 text-right">{po}</span></div>
                                            <div className="flex justify-between gap-3"><span className="text-xs text-stone-400 shrink-0">Total</span><span className="font-black text-stone-800 dark:text-white tabular-nums text-right">{formatCurrency(total)}</span></div>
                                            <div className="flex justify-between gap-3"><span className="text-xs text-stone-400 shrink-0">Diajukan oleh</span><span className="font-semibold text-stone-700 dark:text-white/80 text-right">{p?.requested_by || (p?._proforma?.requested_by) || '-'}</span></div>
                                            {invCount > 1 && <div className="flex justify-between gap-3"><span className="text-xs text-stone-400 shrink-0">Invoice</span><span className="font-semibold text-stone-700 dark:text-white/80 text-right">{invCount} invoice</span></div>}
                                        </div>

                                        {config.noteLabel && (
                                            <div className="mt-4">
                                                <label className="block text-xs font-bold text-stone-600 dark:text-white/40 mb-1">{config.noteLabel}</label>
                                                <Textarea
                                                    autoFocus
                                                    rows={3}
                                                    value={actionModal.notes || ''}
                                                    onChange={e => setActionModal({ ...actionModal, notes: e.target.value })}
                                                    placeholder={config.notePlaceholder}
                                                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-white/[0.06] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl text-sm text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
                                                />
                                            </div>
                                        )}

                                        <div className="mt-5 flex items-center gap-2">
                                            <button
                                                onClick={() => setActionModal(null)}
                                                disabled={actionModalSaving}
                                                className="px-4 py-2.5 rounded-xl bg-stone-100 dark:bg-[#0d0d0d] text-stone-600 dark:text-white/70 text-sm font-semibold hover:bg-stone-200 dark:hover:bg-white/[0.06] disabled:opacity-50"
                                            >
                                                Batal
                                            </button>
                                            <button
                                                onClick={runAction}
                                                disabled={actionModalSaving || actionId !== null}
                                                className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${config.accent} hover:brightness-105`}
                                            >
                                                {actionModalSaving ? <RefreshCw size={15} className="animate-spin" /> : config.icon}
                                                {actionModalSaving ? 'Memproses...' : config.confirm}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </motion.div>
                </motion.div>,
                document.body
            )}

            {/* ── Row Action Menu (⋮) ── */}
            {actionMenu && createPortal(
                <>
                    <div className="fixed inset-0 z-[58]" onClick={() => setActionMenu(null)} />
                    <div
                        ref={menuRef}
                        className="fixed z-[59] min-w-[224px] max-w-[264px] bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/60 dark:border-white/10 p-1.5 overflow-auto custom-scrollbar"
                        style={{ left: actionMenu.x, top: actionMenu.y, maxHeight: actionMenu.maxH }}
                    >
                        {(() => {
                            const inv = actionMenu.inv;
                            const st = inv?.status;
                            const prof = inv?._proforma;
                            const invPdfBusy = pdfBusyId === `invoice:${inv?.id}`;
                            const reqPdfBusy = pdfBusyId === `request:${inv?.id}`;
                            const rowBusy = actionId === inv?.id;
                            const itemCls = 'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
                            const ActionBtn = ({ disabled, loading, icon, label, onClick }) => (
                                <button type="button" disabled={disabled} onClick={onClick} className={`${itemCls} text-stone-600 dark:text-white/70 hover:bg-stone-100 dark:hover:bg-white/[0.06]`}>
                                    {loading ? <RefreshCw size={15} className="animate-spin" /> : icon}
                                    {label}
                                </button>
                            );
                            const DangerBtn = ({ disabled, loading, icon, label, onClick }) => (
                                <button type="button" disabled={disabled} onClick={onClick} className={`${itemCls} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10`}>
                                    {loading ? <RefreshCw size={15} className="animate-spin" /> : icon}
                                    {label}
                                </button>
                            );
                            return (
                                <div className="py-0.5 space-y-0.5">
                                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400">#{inv?.id} • {inv?.dealer_name || '-'}</div>

                                    <button type="button" onClick={() => { setActionMenu(null); openDetail(inv); }} className={`${itemCls} text-stone-600 dark:text-white/70 hover:bg-stone-100 dark:hover:bg-white/[0.06]`}>
                                        <Eye size={15} /> Lihat Detail
                                    </button>

                                    {isAdmin && (
                                        <button type="button" onClick={() => { setActionMenu(null); openEditInvoice(inv); }} className={`${itemCls} text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-500/10`}>
                                            <Pencil size={15} /> Edit Invoice
                                        </button>
                                    )}

                                    {perms.can_edit && st === 'rejected' && (() => {
                                        const repl = inv?.replacement_id ? (invoices || []).find(i => Number(i.id) === Number(inv.replacement_id)) : null;
                                        return (
                                            <button type="button" disabled={duplicatingId === inv.id} onClick={async () => {
                                                if (duplicatingId) return;
                                                setActionMenu(null);
                                                // Jika sudah ada pengganti, buka langsung; jika belum, buat duplikat on-demand
                                                try {
                                                    if (repl) {
                                                        await openEditInvoice(repl);
                                                    } else {
                                                        setDuplicatingId(inv.id);
                                                        const created = await invoiceService.duplicateForInput(inv.id);
                                                        if (!created?.id) throw new Error('Gagal membuat invoice pengganti');
                                                        toast?.success?.(`Invoice pengganti dibuat${created?.no_invoice ? `: ${created.no_invoice}` : ''}`);
                                                        await loadAll();
                                                        await openEditInvoice(created);
                                                    }
                                                } catch (e) {
                                                    toast?.error?.(e.message);
                                                } finally {
                                                    setDuplicatingId(null);
                                                }
                                            }} className={`${itemCls} text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-500/10 disabled:opacity-40`} title="Buat invoice baru (data tersalin) untuk input data baru">
                                                {duplicatingId === inv.id ? <RefreshCw size={15} className="animate-spin" /> : <Pencil size={15} />} Input Data Baru{repl?.no_invoice ? ` (${repl.no_invoice})` : ''}
                                            </button>
                                        );
                                    })()}
                                    {perms.can_proforma && ['submitted', 'sent_back'].includes(st) && (!prof) && !proformaBlockedInvoiceIds.has(Number(inv?.id)) && (
                                        <button type="button" onClick={() => { setActionMenu(null); openProforma(inv); }} className={`${itemCls} text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10`}>
                                            <FileSignature size={15} /> {st === 'submitted' ? 'Ajukan Proforma' : 'Resubmit Proforma'}
                                        </button>
                                    )}

                                    {perms.can_tax_request && st === 'proforma' && (
                                        <button type="button" onClick={() => { setActionMenu(null); openTaxRequest(inv); }} className={`${itemCls} text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10`}>
                                            <FileText size={15} /> Ajukan Faktur Pajak
                                        </button>
                                    )}

                                    {perms.can_tax && ['proforma', 'tax_requested', 'sent_back_tax'].includes(st) && (
                                        <button type="button" onClick={() => { setActionMenu(null); openTax(inv); }} className={`${itemCls} text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10`}>
                                            <FileText size={15} /> Lampirkan Faktur Pajak
                                        </button>
                                    )}

                                    {perms.can_tax_sendback && st === 'tax_requested' && (
                                        <button type="button" onClick={() => { setActionMenu(null); openActionModal('sendback_tax', inv); }} className={`${itemCls} text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10`}>
                                            <RefreshCw size={15} /> Sendback Tax
                                        </button>
                                    )}



                                    {perms.can_settle && prof && ['proforma', 'tax', 'settled'].includes(st) && (
                                        <button type="button" onClick={() => { setActionMenu(null); openSettle(prof); }} className={`${itemCls} text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10`}>
                                            <HandCoins size={15} /> Settle Proforma
                                        </button>
                                    )}

                                    <div className="my-1.5 border-t border-white/60 dark:border-white/10" />

                                    <ActionBtn disabled={reqPdfBusy || rowBusy} loading={reqPdfBusy} icon={<FileDown size={15} />} label="Export Request PDF" onClick={() => { setActionMenu(null); handleExportPdf(inv.id, 'request'); }} />
                                    {(inv?.proforma_no || prof?.proforma_no) && (
                                        <>
                                            {/* Toggle Digital Sign — pakai TTD digital jika atasan tidak ada */}
                                            <div className="flex items-center justify-between gap-3 px-3 py-2 text-[13px] font-semibold text-stone-600 dark:text-white/70" title="Aktifkan untuk menempelkan TTD digital di atas garis SHOGO DATE pada PDF">
                                                <span className="flex items-center gap-2"><PenLine size={15} className={digitalSign ? 'text-blue-600 dark:text-blue-400' : ''} /> Digital Sign</span>
                                                <button
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={digitalSign}
                                                    onClick={toggleDigitalSign}
                                                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${digitalSign ? 'bg-blue-600' : 'bg-stone-300 dark:bg-[#1a1a1a]'}`}
                                                >
                                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${digitalSign ? 'translate-x-[19px]' : 'translate-x-[3px]'}`} />
                                                </button>
                                            </div>
                                            <ActionBtn disabled={invPdfBusy || rowBusy} loading={invPdfBusy} icon={<FileDown size={15} />} label={digitalSign ? 'Export Invoice PDF (Signed)' : 'Export Invoice PDF'} onClick={() => { setActionMenu(null); handleExportPdf(inv.id, 'invoice'); }} />
                                        </>
                                    )}

                                    <button type="button" onClick={() => { setActionMenu(null); openAudit(inv); }} className={`${itemCls} text-stone-600 dark:text-white/70 hover:bg-stone-100 dark:hover:bg-white/[0.06]`}>
                                        <History size={15} /> Riwayat / Audit
                                    </button>

                                    {actionMenu.source !== 'dashboard' && perms.can_delete && st === 'submitted' && inv?.rejected_from_id && (
                                        <>
                                            <div className="my-1.5 border-t border-white/60 dark:border-white/10" />
                                            <DangerBtn disabled={rowBusy} loading={false} icon={<Trash2 size={15} />} label="Hapus Pengganti" onClick={() => { setActionMenu(null); handleDeleteReplacement(inv); }} />
                                        </>
                                    )}

                                    {actionMenu.source !== 'dashboard' && perms.can_delete && !['settled', 'cancelled'].includes(st) && !(st === 'submitted' && inv?.rejected_from_id) && (
                                        <>
                                            <div className="my-1.5 border-t border-white/60 dark:border-white/10" />
                                            <DangerBtn disabled={rowBusy} loading={false} icon={<XCircle size={15} />} label="Batalkan Invoice" onClick={() => { setActionMenu(null); handleCancelInvoice(inv); }} />
                                        </>
                                    )}

                                    {isAdmin && actionMenu.source !== 'dashboard' && (
                                        <>
                                            <div className="my-1.5 border-t border-white/60 dark:border-white/10" />
                                            <DangerBtn disabled={rowBusy} loading={false} icon={<Trash2 size={15} />} label="Hapus Invoice" onClick={() => { setActionMenu(null); openDeleteInvoice(inv); }} />
                                        </>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </>,
                document.body
            )}
        </div>
    );
};

export default Invoices;
