import React from 'react';
import { createPortal } from 'react-dom';
import { X, Receipt, FileSignature, CheckCircle2, XCircle, Clock, FileText, HandCoins, RefreshCw, History, Ban } from 'lucide-react';
import { STATUS_MAP } from '../pages/Invoices';
import { motion, AnimatePresence } from 'framer-motion';

const fmt = (val) => (val ? new Date(val).toLocaleString('id-ID') : '-');
const fmtBy = (val) => val || '-';

const durLabel = (from, to) => {
    if (!from || !to) return null;
    const fromMs = new Date(from).getTime();
    const toMs = new Date(to).getTime();
    if (isNaN(fromMs) || isNaN(toMs)) return null;
    const diff = Math.max(0, toMs - fromMs);
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (days > 0) return `${days} hr ${hours} jm`;
    if (hours > 0) return `${hours} jm ${mins} mnt`;
    if (mins > 0) return `${mins} mnt`;
    return '< 1 mnt';
};

const waitingLabel = (from) => {
    if (!from) return null;
    const fromMs = new Date(from).getTime();
    if (isNaN(fromMs)) return null;
    const diff = Math.max(0, Date.now() - fromMs);
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (days > 0) return `${days} hr ${hours} jm`;
    if (hours > 0) return `${hours} jm ${mins} mnt`;
    if (mins > 0) return `${mins} mnt`;
    return '< 1 mnt';
};

export const AuditTrailModal = ({ open, onClose, target, proformas, formatCurrency }) => {
    if (!target) return null;

    const prof = (proformas || []).find(p => (p.invoices || []).some(inv => Number(inv.id) === Number(target.id)));

    const steps = [];

    // 1. Pembuatan invoice
    steps.push({
        key: 'create',
        title: 'Invoice Dibuat',
        time: fmt(target.created_at),
        by: fmtBy(target.created_by),
        note: null,
        icon: <Receipt size={14} />,
        color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
        done: true,
        waiting: false,
        duration: null,
    });

    // 2. Request proforma
    if (prof) {
        steps.push({
            key: 'proforma_req',
            title: 'Request Proforma',
            time: fmt(prof.requested_at),
            by: fmtBy(prof.requested_by),
            note: null,
            icon: <FileSignature size={14} />,
            color: 'bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
            done: true,
            waiting: false,
            duration: null,
        });
    }

    // 3. Approve / Reject proforma
    if (prof) {
        if (prof.status === 'rejected') {
            steps.push({
                key: 'proforma_rej',
                title: 'Proforma Ditolak',
                time: fmt(prof.approved_at),
                by: fmtBy(prof.approved_by),
                note: prof.notes,
                icon: <XCircle size={14} />,
                color: 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400',
                done: true,
                waiting: false,
                duration: durLabel(prof.requested_at, prof.approved_at),
            });
        } else if (prof.status === 'sent_back') {
            steps.push({
                key: 'proforma_sb',
                title: 'Proforma Sendback (perbaikan)',
                time: fmt(prof.approved_at),
                by: fmtBy(prof.approved_by),
                note: prof.sendback_notes,
                icon: <RefreshCw size={14} />,
                color: 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
                done: true,
                waiting: false,
                duration: durLabel(prof.requested_at, prof.approved_at),
            });
        } else if (prof.approved_by) {
            steps.push({
                key: 'proforma_appr',
                title: 'Proforma Disetujui',
                time: fmt(prof.approved_at),
                by: fmtBy(prof.approved_by),
                note: prof.proforma_no ? `No Proforma: ${prof.proforma_no}` : null,
                icon: <CheckCircle2 size={14} />,
                color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
                done: true,
                waiting: false,
                duration: durLabel(prof.requested_at, prof.approved_at),
            });
        } else {
            // Masih menunggu approval proforma
            steps.push({
                key: 'proforma_wait',
                title: 'Menunggu Approval Proforma',
                time: fmt(prof.requested_at),
                by: fmtBy(prof.requested_by),
                note: `Menunggu sejak ${fmt(prof.requested_at)} • sudah ${waitingLabel(prof.requested_at)}`,
                icon: <Clock size={14} />,
                color: 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
                done: false,
                waiting: true,
                duration: null,
            });
        }
    }

    // 4. Request faktur pajak (ke tax)
    if (target.tax_requested_at || (target.status === 'tax_requested' || target.status === 'sent_back_tax' || target.status === 'tax' || target.status === 'settled')) {
        steps.push({
            key: 'tax_req',
            title: 'Request Faktur Pajak (ke Tax)',
            time: fmt(target.tax_requested_at),
            by: fmtBy(target.tax_requested_by),
            note: target.tax_request_notes,
            icon: <FileText size={14} />,
            color: 'bg-orange-100 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400',
            done: true,
            waiting: false,
            duration: null,
        });
    }

    // 5. Approve / Reject faktur pajak
    if (target.status === 'sent_back_tax') {
        steps.push({
            key: 'tax_sb',
            title: 'Faktur Pajak Sendback (revisi)',
            time: fmt(target.tax_sendback_at),
            by: fmtBy(target.tax_sendback_by),
            note: target.tax_request_notes,
            icon: <RefreshCw size={14} />,
            color: 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
            done: true,
            waiting: false,
            duration: durLabel(target.tax_requested_at, target.tax_sendback_at),
        });
    } else if (target.faktur_pajak_no || target.status === 'tax' || target.status === 'settled') {
        steps.push({
            key: 'tax_appr',
            title: 'Faktur Pajak Disetujui & Tersimpan',
            time: fmt(target.tax_approved_at),
            by: fmtBy(target.tax_approved_by),
            note: target.faktur_pajak_no ? `No Faktur: ${target.faktur_pajak_no}` : null,
            icon: <CheckCircle2 size={14} />,
            color: 'bg-violet-100 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400',
            done: true,
            waiting: false,
            duration: durLabel(target.tax_requested_at, target.tax_approved_at),
        });
    } else if (target.status === 'tax_requested') {
        steps.push({
            key: 'tax_wait',
            title: 'Menunggu Approval Faktur Pajak',
            time: fmt(target.tax_requested_at),
            by: fmtBy(target.tax_requested_by),
            note: `Menunggu sejak ${fmt(target.tax_requested_at)} • sudah ${waitingLabel(target.tax_requested_at)}`,
            icon: <Clock size={14} />,
            color: 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
            done: false,
            waiting: true,
            duration: null,
        });
    }

    // 6. Settle
    if (prof && prof.status === 'settled') {
        const settleFrom = target.tax_approved_at || (prof.status === 'settled' ? prof.approved_at : null);
        steps.push({
            key: 'settle',
            title: 'Proforma Settled',
            time: fmt(prof.settled_at),
            by: fmtBy(prof.settled_by),
            note: prof.settled_amount ? `Nominal Settle: ${formatCurrency(prof.settled_amount)}` : null,
            icon: <HandCoins size={14} />,
            color: 'bg-teal-100 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400',
            done: true,
            waiting: false,
            duration: durLabel(settleFrom, prof.settled_at),
        });
    }

    // 7. Invoice dibatalkan
    if (target.status === 'cancelled') {
        steps.push({
            key: 'cancel',
            title: 'Invoice Dibatalkan',
            time: fmt(target.cancelled_at),
            by: fmtBy(target.cancelled_by),
            note: target.no_po ? `PO diubah menjadi ${target.no_po}` : null,
            icon: <Ban size={14} />,
            color: 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400',
            done: true,
            waiting: false,
            duration: null,
        });
    }

    return createPortal(
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Side Drawer Panel */}
                    <motion.div 
                        initial={{ x: '100%', opacity: 0.5 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '100%', opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed inset-y-0 right-0 z-[110] w-full max-w-xl md:max-w-2xl bg-white dark:bg-slate-800 shadow-2xl flex flex-col border-l border-white/20 dark:border-slate-700/50"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-teal-500 to-emerald-600 px-6 py-5 shrink-0 shadow-sm relative z-10">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3.5">
                                    <div className="shrink-0 w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/30">
                                        <History size={24} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg sm:text-xl font-black text-white leading-tight">Audit Trail Invoice #{target.id}</h3>
                                        <p className="text-xs text-white/80 mt-0.5">{target.dealer_name || '-'} • {target.no_po || '-'}</p>
                                    </div>
                                </div>
                                <button onClick={onClose} className="shrink-0 w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-sm flex items-center justify-center text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/50">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
                            {/* Status saat ini */}
                            <div className="flex items-center gap-2 mb-5">
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Status Saat Ini:</span>
                                <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${STATUS_MAP[target.status]?.cls || ''}`}>
                                    {STATUS_MAP[target.status]?.label || target.status}
                                </span>
                                {prof?.proforma_no && <span className="text-[11px] text-slate-400 ml-auto">Proforma: {prof.proforma_no}</span>}
                            </div>

                            {/* Timeline */}
                            <div className="relative">
                                {steps.map((s, i) => {
                                    const isLast = i === steps.length - 1;
                                    return (
                                        <div key={s.key} className="flex items-start gap-3 relative pb-5">
                                            {!isLast && <div className="absolute left-4 top-8 bottom-0 w-px bg-slate-200 dark:bg-slate-700" />}
                                            <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${s.color}`}>
                                                {s.icon}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{s.title}</div>
                                                    {s.waiting
                                                        ? <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 animate-pulse">WAITING</span>
                                                        : s.done && <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">SELESAI</span>}
                                                    {s.duration && (
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" title="Durasi respon tahap ini">
                                                            ⏱ {s.duration}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-slate-400">
                                                    {s.by} • {s.time}
                                                </div>
                                                {s.note && (
                                                    <div className="mt-1 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300 inline-block">
                                                        {s.note}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 flex items-center justify-start shrink-0 backdrop-blur">
                            <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Tutup</button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        document.body
    );
};
