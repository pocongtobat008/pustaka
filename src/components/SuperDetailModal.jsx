import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Receipt, HandCoins, FileText, Clock, FileSignature, CheckCircle2, RefreshCw, Upload, ImagePlus, Printer, XCircle, Ban, Scale, History, PenLine } from 'lucide-react';
import { STATUS_MAP, TIPE_MAP } from '../pages/Invoices';
import { API_URL } from '../services/apiClient';
import { buildRejectChain } from '../utils/invoiceChain';
import { motion, AnimatePresence } from 'framer-motion';

// parseJsonArray helper
const parseJsonArray = (str) => {
    if (!str) return [];
    try { const r = JSON.parse(str); return Array.isArray(r) ? r : []; } catch { return []; }
};

const fmtDT = (t) => {
    if (!t) return '';
    const d = new Date(t);
    if (isNaN(d.getTime())) return String(t);
    return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
};

const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

// Bangun rantai riwayat reject: mundur lewat rejected_from_id, maju lewat replacement_id
export const SuperDetailModal = ({ open, onClose, detailTarget, formatCurrency, invoiceService, proformas, invoices, onNavigate, digitalSign, onToggleDigitalSign }) => {
    const prof = (proformas || []).find(p => (p.invoices || []).some(inv => Number(inv.id) === Number(detailTarget?.id))) || null;
    const rejectChain = detailTarget ? buildRejectChain(detailTarget, invoices) : [];

    const [settledRows, setSettledRows] = useState(null);
    const [pdfBusy, setPdfBusy] = useState(null);
    const [pdfError, setPdfError] = useState(null);
    useEffect(() => { setPdfBusy(null); setPdfError(null); }, [open, detailTarget?.id]);
    useEffect(() => {
        let alive = true;
        if (open && prof?.status === 'settled' && prof?.id) {
            setSettledRows(null);
            invoiceService.getSettledInvoices(prof.id)
                .then(r => { if (alive) setSettledRows(Array.isArray(r) ? r : (r?.data || [])); })
                .catch(() => { if (alive) setSettledRows([]); });
        } else {
            setSettledRows(null);
        }
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, detailTarget?.id, prof?.id]);

    if (!detailTarget) return null;

    const settledTotal = (settledRows || []).reduce((s, x) => s + num(x.total_invoice), 0);
    const nominalProforma = num(prof?.total_nominal) || num(detailTarget.total_invoice);
    const uangMasuk = num(detailTarget.uang_masuk);
    const sisaTagihan = Math.max(0, nominalProforma - uangMasuk);
    const isBalance = settledRows != null && Math.abs(settledTotal - nominalProforma) < 0.01;

    const handleExportPdf = async (kind) => {
        if (pdfBusy) return;
        setPdfBusy(kind);
        setPdfError(null);
        try {
            if (kind === 'request') await invoiceService.exportRequestPdf(detailTarget.id);
            else await invoiceService.exportPdf(detailTarget.id, { digitalSign });
        } catch (e) {
            setPdfError(e.message || 'Gagal membuat PDF');
        } finally {
            setPdfBusy(null);
        }
    };

    return createPortal(
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop Overlay */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Side Drawer Panel */}
                    <motion.div 
                        initial={{ x: '100%', opacity: 0.5 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '100%', opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed inset-y-0 right-0 z-[110] w-full max-w-2xl lg:max-w-4xl bg-white/95 dark:bg-[#0d0d0d]/95 backdrop-blur-xl shadow-2xl flex flex-col border-l border-white/20 dark:border-white/[0.06]/50"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-500 to-blue-500 px-6 py-5 shrink-0 shadow-sm relative z-10">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3.5">
                                    <div className="shrink-0 w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/30">
                                        <Receipt size={24} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg sm:text-xl font-black text-white leading-tight">Detail Invoice #{detailTarget.id}</h3>
                                        <p className="text-xs text-white/80 mt-0.5">{detailTarget.dealer_name || '-'} • {detailTarget.no_po || '-'}</p>
                                    </div>
                                </div>
                                <button onClick={onClose} className="shrink-0 w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-sm flex items-center justify-center text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/50">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                            {/* Status & Basic Info */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="px-4 py-3 rounded-xl gradient-bg-soft">
                                    <div className="text-[10px] font-bold text-stone-400 uppercase">Status Invoice</div>
                                    <div className="mt-1"><span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_MAP[detailTarget.status]?.cls || ''}`}>{STATUS_MAP[detailTarget.status]?.label || detailTarget.status}</span></div>
                                    {detailTarget.rejected_from_id && <div className="mt-1.5 text-[10px] font-bold text-rose-500">← Dibuat ulang dari reject Invoice #{detailTarget.rejected_from_id}</div>}
                                    {detailTarget.replacement_id && <div className="mt-1.5 text-[10px] font-bold text-emerald-600">→ Diganti oleh Invoice #{detailTarget.replacement_id}</div>}
                                </div>
                                <div className="px-4 py-3 rounded-xl gradient-bg-soft">
                                    <div className="text-[10px] font-bold text-stone-400 uppercase">Tipe</div>
                                    <div className="text-sm font-bold text-stone-800 dark:text-white mt-1">{TIPE_MAP[detailTarget.tipe]?.label || detailTarget.tipe}</div>
                                </div>
                                <div className="px-4 py-3 rounded-xl gradient-bg-soft">
                                    <div className="text-[10px] font-bold text-stone-400 uppercase">Tgl Transaksi</div>
                                    <div className="text-sm font-bold text-stone-800 dark:text-white mt-1">{detailTarget.tgl_transaksi || '-'}</div>
                                </div>
                                <div className="px-4 py-3 rounded-xl gradient-bg-soft">
                                    <div className="text-[10px] font-bold text-stone-400 uppercase">No Proforma</div>
                                    <div className="text-sm font-bold text-blue-600 mt-1">{detailTarget.proforma_no || (prof?.proforma_no) || '-'}</div>
                                </div>
                            </div>

                            {/* Riwayat Reject (timeline vertikal) */}
                            {rejectChain.length > 1 && (
                                <div className="px-4 py-3 rounded-xl gradient-bg-soft border border-stone-100 dark:border-white/[0.06]">
                                    <h4 className="text-xs font-bold text-stone-500 dark:text-white/40 mb-3 flex items-center gap-2">
                                        <History size={14} className="text-rose-500" /> Riwayat Reject
                                    </h4>
                                    <div className="relative">
                                        {/* Garis timeline vertikal */}
                                        <div className="absolute left-[13px] top-2 bottom-2 w-px bg-stone-200 dark:bg-[#111]" />
                                        <div className="space-y-2.5">
                                            {rejectChain.map((c, idx) => {
                                                const isCurrent = Number(c.id) === Number(detailTarget.id);
                                                const isRejected = c.status === 'rejected';
                                                return (
                                                    <div key={c.id} className="relative flex items-start gap-3">
                                                        {/* Node ikon di atas garis */}
                                                        <div className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ring-4 ${isRejected
                                                            ? 'bg-red-50 text-rose-500 ring-red-50/60 dark:bg-red-500/10 dark:ring-red-500/5'
                                                            : isCurrent
                                                                ? 'gradient-bg text-white ring-blue-100 dark:ring-blue-500/20'
                                                                : 'bg-emerald-50 text-emerald-600 ring-emerald-50/60 dark:bg-emerald-500/10 dark:ring-emerald-500/5'}`}>
                                                            {isRejected ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                                                        </div>
                                                        {/* Isi node */}
                                                        <button
                                                            type="button"
                                                            disabled={isCurrent || !onNavigate}
                                                            onClick={() => onNavigate && onNavigate(c)}
                                                            className={`flex-1 text-left px-3 py-2 rounded-xl text-xs transition-all border ${isCurrent
                                                                ? 'bg-blue-600/10 dark:bg-blue-500/15 border-blue-300 dark:border-blue-500/40 cursor-default'
                                                                : 'bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl border-stone-200 dark:border-white/[0.06] hover:border-blue-400 hover:shadow-md hover:shadow-blue-500/5 cursor-pointer'}`}
                                                        >
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className={`font-black ${isCurrent ? 'text-blue-600 dark:text-blue-300' : 'text-stone-700 dark:text-white/80'}`}>
                                                                    #{c.id}{c.no_invoice ? ` · ${c.no_invoice}` : ''}
                                                                </span>
                                                                <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide ${isRejected ? 'bg-red-50 text-rose-500 dark:bg-red-500/10' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10'}`}>
                                                                    {STATUS_MAP[c.status]?.label || c.status}
                                                                </span>
                                                            </div>
                                                            <div className="text-[10px] text-stone-400 mt-1 flex items-center gap-1">
                                                                <span className="truncate">{c.dealer_name || '-'}</span>
                                                                {idx > 0 && <span className="shrink-0 text-stone-300 dark:text-stone-600">• {isRejected ? 'hasil reject dari #' + (c.rejected_from_id ?? '-') : 'pengganti dari #' + (c.rejected_from_id ?? '-')}</span>}
                                                            </div>
                                                            {isCurrent && <div className="text-[9px] font-bold text-blue-500 dark:text-blue-300 mt-1">◀ Invoice yang sedang dilihat</div>}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Dealer & Financial Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="px-4 py-3 rounded-xl gradient-bg-soft border border-stone-100 dark:border-white/[0.06]">
                                    <h4 className="text-xs font-bold text-stone-500 dark:text-white/40 mb-2">Informasi Dealer</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between items-center"><span className="text-stone-500 text-xs">Nama:</span><span className="font-semibold text-stone-800 dark:text-white text-right">{detailTarget.dealer_name || '-'}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-stone-500 text-xs">NPWP:</span><span className="font-mono text-stone-700 dark:text-white/70 text-right">{detailTarget.dealer_npwp || '-'}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-stone-500 text-xs">No. PO:</span><span className="font-semibold text-stone-800 dark:text-white text-right">{detailTarget.no_po || '-'}</span></div>
                                    </div>
                                </div>
                                <div className="px-4 py-3 rounded-xl gradient-bg-soft border border-stone-100 dark:border-white/[0.06]">
                                    <h4 className="text-xs font-bold text-stone-500 dark:text-white/40 mb-2">Ringkasan Nominal</h4>
                                    <div className="space-y-1.5 text-sm tabular-nums">
                                        <div className="flex justify-between"><span className="text-stone-500 text-xs">Subtotal:</span><span className="font-semibold text-stone-800 dark:text-white">{formatCurrency(detailTarget.subtotal)}</span></div>
                                        <div className="flex justify-between"><span className="text-stone-500 text-xs">PPN {Math.round((detailTarget.ppn_rate || 0.11) * 100)}%:</span><span className="font-semibold text-stone-700 dark:text-white/70">{formatCurrency(Math.round(Number(detailTarget.ppn) || 0))}</span></div>
                                        <div className="flex justify-between"><span className="text-stone-500 text-xs">Materai:</span><span className="font-semibold text-stone-700 dark:text-white/70">{formatCurrency(detailTarget.materai)}</span></div>
                                        <div className="flex justify-between"><span className="text-stone-500 text-xs">Diskon:</span><span className="font-semibold text-red-600">{formatCurrency(detailTarget.diskon)}</span></div>
                                        <div className="flex justify-between border-t border-stone-200 dark:border-white/[0.06] pt-1 mt-1"><span className="text-xs font-bold text-stone-600 dark:text-white/40">Total Invoice:</span><span className="text-lg font-black text-teal-600">{formatCurrency(detailTarget.total_invoice)}</span></div>
                                        <div className="flex justify-between"><span className="text-stone-500 text-xs">Uang Masuk:</span><span className="font-semibold text-blue-600">{formatCurrency(detailTarget.uang_masuk)}</span></div>
                                    </div>
                                </div>
                            </div>

                            {/* ── Detail Barang ── */}
                            {(() => {
                                const items = detailTarget.items || [];
                                if (!items.length) return null;
                                const totalHarga = items.reduce((s, it) => s + (num(it.harga) * (it.qty || 1)), 0);
                                const totalPpn = items.reduce((s, it) => s + Math.round((num(it.harga) * (it.qty || 1)) * (num(it.ppn_rate) || 0.11)), 0);
                                return (
                                    <div className="px-4 py-3 rounded-xl gradient-bg-soft border border-stone-100 dark:border-white/[0.06]">
                                        <h4 className="text-xs font-bold text-stone-500 dark:text-white/40 mb-3 flex items-center gap-2">
                                            <Receipt size={14} className="text-blue-500" /> Detail Barang ({items.length} item)
                                        </h4>
                                        <div className="rounded-xl overflow-hidden border border-stone-100 dark:border-white/[0.06] bg-white dark:bg-[#0d0d0d]/70">
                                            <div className="overflow-x-auto custom-scrollbar">
                                                <table className="w-full text-xs min-w-[520px]">
                                                    <thead>
                                                        <tr className="text-[9px] font-black uppercase tracking-wider text-stone-400 border-b border-stone-100 dark:border-white/[0.06]">
                                                            <th className="px-3 py-2 text-left">No</th>
                                                            <th className="px-3 py-2 text-left">Model</th>
                                                            <th className="px-3 py-2 text-left">Deskripsi</th>
                                                            <th className="px-3 py-2 text-right">Qty</th>
                                                            <th className="px-3 py-2 text-right">Harga Satuan</th>
                                                            <th className="px-3 py-2 text-right">Subtotal</th>
                                                            <th className="px-3 py-2 text-right">PPN</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {items.map((it, i) => (
                                                            <tr key={it.id || i} className="border-b border-stone-50 dark:border-white/[0.06]/50 last:border-0 hover:bg-blue-50/40 dark:hover:bg-blue-500/5 transition-colors">
                                                                <td className="px-3 py-2 text-stone-400 font-semibold tabular-nums">{i + 1}</td>
                                                                <td className="px-3 py-2 font-bold text-blue-700 dark:text-blue-300 whitespace-nowrap">{it.model || '-'}</td>
                                                                <td className="px-3 py-2 text-stone-600 dark:text-white/70 max-w-[160px] truncate" title={it.item_description || ''}>{it.item_description || '-'}</td>
                                                                <td className="px-3 py-2 text-right text-stone-700 dark:text-white/70 tabular-nums font-semibold">{it.qty || 1}</td>
                                                                <td className="px-3 py-2 text-right text-stone-700 dark:text-white/70 tabular-nums">{formatCurrency(it.harga)}</td>
                                                                <td className="px-3 py-2 text-right font-bold text-stone-800 dark:text-white tabular-nums">{formatCurrency(num(it.harga) * (it.qty || 1))}</td>
                                                                <td className="px-3 py-2 text-right text-blue-600 dark:text-blue-400 tabular-nums font-semibold">
                                                                    <span className="text-[10px] text-stone-400">{Math.round((num(it.ppn_rate) || 0.11) * 100)}%</span>{' '}
                                                                    {formatCurrency(Math.round((num(it.harga) * (it.qty || 1)) * (num(it.ppn_rate) || 0.11)))}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr className="bg-blue-50/60 dark:bg-blue-500/10">
                                                            <td className="px-3 py-2 font-black text-stone-600 dark:text-white/70" colSpan={3}>Total {items.length} Item</td>
                                                            <td className="px-3 py-2 text-right font-bold text-stone-700 dark:text-white/70 tabular-nums">{items.reduce((s, it) => s + (it.qty || 1), 0)}</td>
                                                            <td className="px-3 py-2 text-right text-stone-500 text-[10px]">DPP</td>
                                                            <td className="px-3 py-2 text-right font-black text-blue-700 dark:text-blue-300 tabular-nums">{formatCurrency(totalHarga)}</td>
                                                            <td className="px-3 py-2 text-right font-black text-blue-700 dark:text-blue-300 tabular-nums">{formatCurrency(totalPpn)}</td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* ── Flow Trail / Maps Invoice ── */}
                            {(() => {
                                const st = detailTarget.status;
                                const route = [
                                    { key: 'invoice_created', name: 'Request Invoice', desc: 'Invoice dibuat & diinput', icon: <Receipt size={15} />, doneCls: 'bg-blue-500 text-white', nodeCls: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400', textCls: 'text-stone-800 dark:text-white' },
                                    { key: 'proforma_pending', name: 'Approval Akunting', desc: 'Proforma diajukan, menunggu approval', icon: <FileSignature size={15} />, doneCls: 'bg-blue-500 text-white', nodeCls: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400', textCls: 'text-stone-800 dark:text-white' },
                                    { key: 'proforma_approved', name: 'Marketing', desc: 'Proforma disetujui', icon: <CheckCircle2 size={15} />, doneCls: 'bg-emerald-500 text-white', nodeCls: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400', textCls: 'text-stone-800 dark:text-white' },
                                    { key: 'tax_requested', name: 'Request Faktur ke Tax', desc: 'Faktur pajak diajukan', icon: <Upload size={15} />, doneCls: 'bg-orange-500 text-white', nodeCls: 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400', textCls: 'text-stone-800 dark:text-white' },
                                    { key: 'tax_approved', name: 'Approval Tax', desc: 'Faktur pajak disimpan', icon: <FileText size={15} />, doneCls: 'bg-blue-500 text-white', nodeCls: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400', textCls: 'text-stone-800 dark:text-white' },
                                    { key: 'settled', name: 'Marketing (Selesai)', desc: 'Proforma settled', icon: <HandCoins size={15} />, doneCls: 'bg-teal-500 text-white', nodeCls: 'bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400', textCls: 'text-stone-800 dark:text-white' },
                                ];

                                let curIdx = 0;
                                let branch = null;
                                if (prof) {
                                    if (prof.status === 'pending') curIdx = 1;
                                    else if (prof.status === 'sent_back') { curIdx = 1; branch = 'sent_back'; }
                                    else if (prof.status === 'rejected') { curIdx = 1; branch = 'rejected'; }
                                    else if (prof.status === 'approved' || st === 'proforma') curIdx = 2;
                                }
                                if (st === 'tax_requested') curIdx = 3;
                                else if (st === 'sent_back_tax') { curIdx = 3; branch = 'sent_back_tax'; }
                                if (st === 'tax') curIdx = 4;
                                if (st === 'settled') curIdx = 5;
                                if (st === 'cancelled') { branch = 'cancelled'; }

                                const branchCls = branch === 'rejected' || branch === 'cancelled'
                                    ? { node: 'bg-rose-500 text-white ring-rose-200 dark:ring-rose-500/30', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300', label: 'text-rose-600 dark:text-rose-400' }
                                    : { node: 'bg-amber-500 text-white ring-amber-200 dark:ring-amber-500/30', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300', label: 'text-amber-600 dark:text-amber-400' };
                                const branchLabel = branch === 'rejected' ? 'Ditolak — tidak dapat diajukan ulang'
                                    : branch === 'sent_back' ? 'Dikembalikan (sendback) — perbaiki & resubmit'
                                    : branch === 'sent_back_tax' ? 'Dikembalikan Tax — perbaiki faktur pajak'
                                    : branch === 'cancelled' ? 'Dibatalkan' : '';

                                return (
                                    <div className="border-t border-stone-100 dark:border-white/[0.06] pt-5 px-1">
                                        <div className="flex items-center justify-between mb-4 px-1">
                                            <h4 className="text-sm font-bold text-stone-700 dark:text-white/70">Alur Proses (Maps Invoice)</h4>
                                            {branch && <span className={`px-2 py-1 rounded-full ${branchCls.badge} text-[10px] font-bold`}>{branchLabel.split(' — ')[0]}</span>}
                                            {!branch && st === 'settled' && <span className="px-2 py-1 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300 text-[10px] font-bold">SELESAI</span>}
                                        </div>
                                        <div className="relative pl-1">
                                            <div className="absolute left-3 top-3 bottom-3 w-[2px] bg-stone-200 dark:bg-[#111] rounded-full" />
                                            {route.map((s, i) => {
                                                const done = i < curIdx;
                                                const isCurrent = i === curIdx && !branch;
                                                const isBlocked = i === curIdx && !!branch;
                                                const nodeColor = isBlocked ? branchCls.node : done ? s.doneCls : isCurrent ? 'gradient-bg text-white ring-blue-200 dark:ring-blue-500/30' : 'bg-stone-200 text-stone-400 dark:bg-[#111] dark:text-white/30';
                                                const textColor = isBlocked ? branchCls.label : done || isCurrent ? s.textCls : 'text-stone-400 dark:text-white/30';
                                                return (
                                                    <div key={s.key} className="relative flex items-start gap-3 pb-6 last:pb-0">
                                                        {i !== route.length - 1 && <div className={`absolute top-9 left-[11px] bottom-0 w-[2px] rounded-full ${done ? 'bg-blue-400 dark:bg-blue-500/60' : 'bg-stone-200 dark:bg-[#111]'}`} />}
                                                        <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center z-10 ring-4 ring-white dark:ring-slate-900 ${nodeColor}`}>{s.icon}</div>
                                                        <div className="flex-1 pt-0.5">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className={`text-sm font-bold ${textColor}`}>{s.name}</span>
                                                                {isCurrent && <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 text-[9px] font-bold">SEKARANG</span>}
                                                                {done && <span className="text-[10px] font-bold text-stone-400">✓ Selesai</span>}
                                                            </div>
                                                            <div className="text-[10px] text-stone-400 mt-0.5">{s.desc}</div>
                                                            {isBlocked && branch && <div className={`text-[10px] font-semibold mt-1 ${branchCls.label}`}>{branchLabel}</div>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* ── Detail Settle ── */}
                            {prof?.status === 'settled' && (
                                <div className="rounded-2xl overflow-hidden border border-teal-200 dark:border-teal-500/20 shadow-sm">
                                    <div className="px-4 py-3 bg-gradient-to-r from-teal-500 to-emerald-600 flex items-center justify-between">
                                        <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                                            <HandCoins size={15} /> Detail Settle
                                        </h4>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${isBalance ? 'bg-white/20 text-white' : 'bg-red-500 text-white'}`}>
                                            {isBalance ? 'BALANCE' : 'TIDAK BALANCE'}
                                        </span>
                                    </div>
                                    <div className="px-4 py-3 bg-teal-50/70 dark:bg-teal-500/10 space-y-3">
                                        {/* Summary */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                            <div className="px-3 py-2 rounded-xl bg-white dark:bg-[#0d0d0d]/70 border border-teal-100 dark:border-teal-500/20">
                                                <div className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase">Jumlah Invoice</div>
                                                <div className="font-black text-lg text-stone-800 dark:text-white tabular-nums">{settledRows == null ? '...' : (settledRows.length || 0)} <span className="text-xs font-semibold text-stone-400">invoice</span></div>
                                            </div>
                                            <div className="px-3 py-2 rounded-xl bg-white dark:bg-[#0d0d0d]/70 border border-teal-100 dark:border-teal-500/20">
                                                <div className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase">Total Settle</div>
                                                <div className="font-black text-lg text-teal-700 dark:text-teal-300 tabular-nums">{settledRows == null ? '...' : formatCurrency(settledTotal)}</div>
                                            </div>
                                            <div className="px-3 py-2 rounded-xl bg-white dark:bg-[#0d0d0d]/70 border border-teal-100 dark:border-teal-500/20">
                                                <div className="text-[10px] font-bold text-stone-500 dark:text-white/40 uppercase">Settled By</div>
                                                <div className="font-bold text-stone-800 dark:text-white">{prof.settled_by || '-'}</div>
                                                <div className="text-[10px] text-stone-400 mt-0.5">{fmtDT(prof.settled_at) || '-'}</div>
                                            </div>
                                            <div className="px-3 py-2 rounded-xl bg-white dark:bg-[#0d0d0d]/70 border border-teal-100 dark:border-teal-500/20">
                                                <div className="text-[10px] font-bold text-stone-500 dark:text-white/40 uppercase">Catatan</div>
                                                <div className="font-bold text-stone-800 dark:text-white text-xs leading-snug">{prof.notes || '-'}</div>
                                            </div>
                                        </div>

                                        {/* Balance clarity */}
                                        <div className="rounded-xl bg-white dark:bg-[#0d0d0d]/70 border border-teal-100 dark:border-teal-500/20 p-3">
                                            <div className="flex items-center gap-1.5 mb-2">
                                                <Scale size={13} className="text-teal-600 dark:text-teal-400" />
                                                <span className="text-[11px] font-black text-stone-600 dark:text-white/70 uppercase tracking-wider">Status Balance</span>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                                <div className="flex justify-between md:flex-col md:gap-0.5">
                                                    <span className="text-[10px] text-stone-500 uppercase">Nominal Proforma</span>
                                                    <span className="font-bold text-stone-800 dark:text-white tabular-nums">{formatCurrency(nominalProforma)}</span>
                                                </div>
                                                <div className="flex justify-between md:flex-col md:gap-0.5">
                                                    <span className="text-[10px] text-stone-500 uppercase">Total Settle</span>
                                                    <span className="font-bold text-stone-800 dark:text-white tabular-nums">{settledRows == null ? '...' : formatCurrency(settledTotal)}</span>
                                                </div>
                                                <div className="flex justify-between md:flex-col md:gap-0.5">
                                                    <span className="text-[10px] text-stone-500 uppercase">Uang Masuk</span>
                                                    <span className="font-bold text-blue-600 tabular-nums">{formatCurrency(uangMasuk)}</span>
                                                </div>
                                                <div className="flex justify-between md:flex-col md:gap-0.5">
                                                    <span className="text-[10px] text-stone-500 uppercase">Sisa Tagihan</span>
                                                    <span className={`font-bold tabular-nums ${sisaTagihan > 0.01 ? 'text-amber-600' : 'text-emerald-600'}`}>{formatCurrency(sisaTagihan)}</span>
                                                </div>
                                            </div>
                                            {settledRows != null && (
                                                <div className={`mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black ${isBalance ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'}`}>
                                                    {isBalance ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                                                    {isBalance ? 'Balance — total settle sesuai nominal proforma' : `Selisih ${formatCurrency(Math.abs(settledTotal - nominalProforma))}`}
                                                </div>
                                            )}
                                        </div>

                                        {/* Settled invoice list */}
                                        {settledRows == null ? (
                                            <div className="text-center text-xs text-stone-400 py-3 animate-pulse">Memuat detail invoice settled...</div>
                                        ) : settledRows.length === 0 ? (
                                            <div className="text-center text-xs text-stone-400 py-3">Belum ada data invoice settled</div>
                                        ) : (
                                            <div className="rounded-xl overflow-hidden border border-teal-100 dark:border-teal-500/20 bg-white dark:bg-[#0d0d0d]/70">
                                                <div className="px-3 py-2 gradient-bg-soft border-b border-stone-100 dark:border-white/[0.06] text-[10px] font-black text-stone-500 uppercase tracking-wider">Invoice Asli Hasil Settle</div>
                                                <div className="overflow-x-auto custom-scrollbar">
                                                    <table className="w-full text-xs min-w-[480px]">
                                                        <thead>
                                                            <tr className="text-[9px] font-black uppercase tracking-wider text-stone-400 border-b border-stone-100 dark:border-white/[0.06]">
                                                                <th className="px-3 py-2 text-left">No. Invoice</th>
                                                                <th className="px-3 py-2 text-left">Tgl</th>
                                                                <th className="px-3 py-2 text-right">DPP</th>
                                                                <th className="px-3 py-2 text-right">PPN</th>
                                                                <th className="px-3 py-2 text-right">Total</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {settledRows.map((s, i) => (
                                                                <tr key={i} className="border-b border-stone-50 dark:border-white/[0.06]/50 last:border-0">
                                                                    <td className="px-3 py-2 font-bold text-teal-700 dark:text-teal-300 tabular-nums whitespace-nowrap">{s.no_invoice || '-'}</td>
                                                                    <td className="px-3 py-2 text-stone-500">{s.tgl_invoice || '-'}</td>
                                                                    <td className="px-3 py-2 text-right text-stone-700 dark:text-white/70 tabular-nums">{formatCurrency(s.subtotal)}</td>
                                                                    <td className="px-3 py-2 text-right text-stone-700 dark:text-white/70 tabular-nums">{formatCurrency(s.ppn)}</td>
                                                                    <td className="px-3 py-2 text-right font-bold text-stone-800 dark:text-white tabular-nums">{formatCurrency(s.total_invoice)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                        <tfoot>
                                                            <tr className="bg-teal-50/60 dark:bg-teal-500/10">
                                                                <td className="px-3 py-2 font-black text-stone-600 dark:text-white/70" colSpan={4}>Total</td>
                                                                <td className="px-3 py-2 text-right font-black text-teal-700 dark:text-teal-300 tabular-nums">{formatCurrency(settledTotal)}</td>
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Faktur Pajak Info */}
                            {detailTarget.faktur_pajak_no && (
                                <div className="px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 shadow-sm">
                                    <h4 className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-1.5">
                                        <FileText size={14} /> Faktur Pajak
                                    </h4>
                                    <div className="space-y-1.5 text-sm">
                                        <div className="flex justify-between"><span className="text-stone-500 text-xs">No:</span><span className="font-bold text-blue-600 tabular-nums">{detailTarget.faktur_pajak_no}</span></div>
                                        <div className="flex justify-between"><span className="text-stone-500 text-xs">Disimpan oleh:</span><span className="font-semibold text-stone-800 dark:text-white">{detailTarget.tax_approved_by || '-'}</span></div>
                                        <div className="flex justify-between"><span className="text-stone-500 text-xs">Waktu:</span><span className="font-semibold text-stone-800 dark:text-white">{fmtDT(detailTarget.tax_approved_at) || '-'}</span></div>
                                        {detailTarget.faktur_pajak_file && (
                                            <a href={`${API_URL}/invoices/files/${detailTarget.faktur_pajak_file}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-xs hover:bg-blue-200 transition-colors font-medium">
                                                <FileText size={13} /> Download Faktur Pajak
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── Timeline Lengkap ── */}
                            <div className="border-t border-stone-100 dark:border-white/[0.06] pt-5">
                                <h4 className="text-sm font-bold text-stone-700 dark:text-white/70 mb-4 px-1">Timeline Transaksi</h4>
                                <div className="space-y-3 px-1">
                                    {(() => {
                                        const events = [];
                                        events.push({ icon: <Clock size={13} />, title: 'Invoice Dibuat', time: detailTarget.created_at, by: detailTarget.created_by || '-', color: 'bg-stone-100 text-stone-600 dark:bg-[#0d0d0d] dark:text-white/40 ring-stone-200 dark:ring-white/[0.06]', note: null, extra: null });

                                        if (prof) {
                                            events.push({ icon: <FileSignature size={13} />, title: 'Proforma Diajukan', time: prof.requested_at, by: prof.requested_by || '-', color: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 ring-blue-200 dark:ring-blue-500/30', note: null, extra: prof.proforma_no ? `No. Proforma: ${prof.proforma_no}` : null });
                                            if (prof.status === 'rejected') {
                                                events.push({ icon: <XCircle size={13} />, title: 'Proforma Ditolak', time: prof.approved_at, by: prof.approved_by || '-', color: 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 ring-rose-200 dark:ring-rose-500/30', note: prof.notes || null, extra: null });
                                            } else if (prof.status === 'sent_back') {
                                                events.push({ icon: <RefreshCw size={13} />, title: 'Sendback Proforma', time: prof.approved_at, by: prof.approved_by || '-', color: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 ring-amber-200 dark:ring-amber-500/30', note: prof.sendback_notes || null, extra: null });
                                            } else if (prof.approved_by) {
                                                events.push({ icon: <CheckCircle2 size={13} />, title: 'Proforma Disetujui', time: prof.approved_at, by: prof.approved_by, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 ring-emerald-200 dark:ring-emerald-500/30', note: null, extra: prof.proforma_no ? `No. Proforma: ${prof.proforma_no}` : null });
                                            }
                                        }

                                        const taxReqAttach = parseJsonArray(detailTarget.tax_request_attachments);
                                        if (detailTarget.tax_requested_at || detailTarget.tax_request_notes || taxReqAttach.length > 0) {
                                            events.push({ icon: <Upload size={13} />, title: 'Faktur Pajak Diajukan ke Tax', time: detailTarget.tax_requested_at, by: detailTarget.tax_requested_by || '-', color: 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 ring-orange-200 dark:ring-orange-500/30', note: (!detailTarget.tax_sendback_at ? detailTarget.tax_request_notes : null) || null, extra: taxReqAttach.length ? `${taxReqAttach.length} lampiran` : null });
                                        }
                                        if (detailTarget.tax_sendback_at) {
                                            events.push({ icon: <RefreshCw size={13} />, title: 'Sendback Faktur Pajak', time: detailTarget.tax_sendback_at, by: detailTarget.tax_sendback_by || '-', color: 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 ring-rose-200 dark:ring-rose-500/30', note: detailTarget.tax_request_notes || null, extra: null });
                                        }
                                        if (detailTarget.tax_rejected_at) {
                                            events.push({ icon: <XCircle size={13} />, title: 'Faktur Pajak Ditolak', time: detailTarget.tax_rejected_at, by: detailTarget.tax_rejected_by || '-', color: 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 ring-rose-200 dark:ring-rose-500/30', note: detailTarget.tax_reject_notes || null, extra: null });
                                        }
                                        if (detailTarget.faktur_pajak_no) {
                                            events.push({ icon: <FileText size={13} />, title: 'Faktur Pajak Disimpan', time: detailTarget.tax_approved_at, by: detailTarget.tax_approved_by || '-', color: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 ring-blue-200 dark:ring-blue-500/30', note: null, extra: `No. Faktur: ${detailTarget.faktur_pajak_no}` });
                                        }
                                        if (prof?.status === 'settled') {
                                            events.push({ icon: <HandCoins size={13} />, title: 'Proforma Settled', time: prof.settled_at, by: prof.settled_by || '-', color: 'bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400 ring-teal-200 dark:ring-teal-500/30', note: prof.notes || null, extra: prof.settled_amount != null ? `Nominal Settle: ${formatCurrency(prof.settled_amount)}` : null });
                                        }
                                        if (detailTarget.status === 'cancelled') {
                                            events.push({ icon: <Ban size={13} />, title: 'Invoice Dibatalkan', time: detailTarget.cancelled_at, by: detailTarget.cancelled_by || '-', color: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400 ring-red-200 dark:ring-red-500/30', note: null, extra: null });
                                        }

                                        return events.map((e, i) => (
                                            <div key={i} className="flex items-start gap-3 relative">
                                                {i !== events.length - 1 && <div className="absolute top-8 left-4 bottom-[-16px] w-[1px] bg-stone-200 dark:bg-[#111]"></div>}
                                                <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-slate-900 shadow-sm z-10 ${e.color}`}>
                                                    {e.icon}
                                                </div>
                                                <div className="flex-1 pb-2 pt-1.5">
                                                    <div className="text-sm font-bold text-stone-700 dark:text-white/80 leading-none">{e.title}</div>
                                                    <div className="text-[10px] text-stone-400 mt-1">{e.by} {e.time ? `• ${fmtDT(e.time)}` : ''}</div>
                                                    {(e.note || e.extra) && (
                                                        <div className="mt-1.5 space-y-1">
                                                            {e.extra && <div className="text-[11px] font-semibold text-stone-600 dark:text-white/70">{e.extra}</div>}
                                                            {e.note && (
                                                                <div className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium break-words ${/Ditolak|Sendback/.test(e.title) ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'gradient-bg-soft text-stone-600 dark:text-white/70'}`}>
                                                                    <span className="font-bold">{e.title.includes('Ditolak') ? 'Alasan penolakan: ' : e.title.includes('Sendback') ? 'Catatan sendback: ' : 'Catatan: '}</span>{e.note}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>

                            {/* All Attachments */}
                            {(() => {
                                const allAttachments = [];
                                const proformaAttach = parseJsonArray(prof?.attachments) || [];
                                const taxRequestAttach = parseJsonArray(detailTarget.tax_request_attachments) || [];

                                if (proformaAttach.length > 0) {
                                    allAttachments.push({ label: `Lampiran Proforma (${proformaAttach.length})`, files: proformaAttach, color: 'blue' });
                                }
                                if (taxRequestAttach.length > 0) {
                                    allAttachments.push({ label: `Lampiran Tax Request (${taxRequestAttach.length})`, files: taxRequestAttach, color: 'orange' });
                                }
                                if (detailTarget.faktur_pajak_file) {
                                    allAttachments.push({ label: 'Faktur Pajak', files: [detailTarget.faktur_pajak_file], color: 'blue' });
                                }

                                if (allAttachments.length === 0) return null;

                                return (
                                    <div className="border-t border-stone-100 dark:border-white/[0.06] pt-5 px-1">
                                        <h4 className="text-sm font-bold text-stone-700 dark:text-white/70 mb-3">Semua Lampiran</h4>
                                        <div className="space-y-3">
                                            {allAttachments.map((group, gi) => (
                                                <div key={gi} className="gradient-bg-soft p-3 rounded-xl border border-stone-100 dark:border-white/[0.06]">
                                                    <div className="text-[10px] font-black text-stone-500 dark:text-white/40 mb-2 uppercase tracking-wider">{group.label}</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {group.files.map((f, fi) => (
                                                            <a key={fi} href={`${API_URL}/invoices/files/${f}`} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-${group.color}-100 dark:bg-${group.color}-500/20 text-${group.color}-700 dark:text-${group.color}-300 text-xs hover:bg-${group.color}-200 transition-colors shadow-sm`}>
                                                                <ImagePlus size={14} /> {f.length > 30 ? f.slice(0, 30) + '...' : f}
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-stone-100 dark:border-white/[0.06] bg-stone-50/80 dark:bg-[#0d0d0d]/60 flex items-center justify-start gap-3 shrink-0 backdrop-blur">
                            <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl border border-stone-200 dark:border-white/[0.06] text-stone-600 dark:text-white/70 text-sm font-bold hover:bg-stone-50 dark:hover:bg-white/[0.06] transition-colors">Tutup</button>
                            {(detailTarget.proforma_no || prof?.proforma_no) && (
                                <>
                                    {/* Toggle Digital Sign — pakai TTD digital jika atasan tidak ada */}
                                    <button
                                        type="button"
                                        onClick={onToggleDigitalSign}
                                        title="Aktifkan untuk menempelkan TTD digital di atas garis SHOGO DATE pada PDF"
                                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${digitalSign ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/40 text-blue-700 dark:text-blue-300' : 'bg-white/70 dark:bg-[#0d0d0d]/60 border-stone-200 dark:border-white/[0.06] text-stone-500 dark:text-white/40 hover:bg-stone-50 dark:hover:bg-white/[0.06]'}`}
                                    >
                                        <PenLine size={14} />
                                        Digital Sign
                                        <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${digitalSign ? 'bg-blue-600' : 'bg-stone-300 dark:bg-[#1a1a1a]'}`}>
                                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${digitalSign ? 'translate-x-[15px]' : 'translate-x-[2px]'}`} />
                                        </span>
                                    </button>
                                    <button onClick={() => handleExportPdf('invoice')} disabled={!!pdfBusy} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:opacity-95 text-white text-sm font-bold shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                                        {pdfBusy === 'invoice' ? <RefreshCw size={15} className="animate-spin" /> : <Printer size={15} />} {pdfBusy === 'invoice' ? 'Membuat PDF...' : 'Invoice Proforma'}
                                    </button>
                                </>
                            )}
                            <button onClick={() => handleExportPdf('request')} disabled={!!pdfBusy} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-lg shadow-rose-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                                {pdfBusy === 'request' ? <RefreshCw size={15} className="animate-spin" /> : <FileText size={15} />} {pdfBusy === 'request' ? 'Membuat PDF...' : 'Pengajuan Proforma'}
                            </button>
                        </div>
                        {pdfError && (
                            <div className="px-6 py-2 bg-rose-50 dark:bg-rose-500/10 border-t border-rose-100 dark:border-rose-500/20 text-xs text-rose-600 dark:text-rose-400">{pdfError}</div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        document.body
    );
};
