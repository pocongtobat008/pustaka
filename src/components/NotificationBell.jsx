import React, { useState, useMemo, useEffect } from 'react';
import { Bell, X, AlertCircle, Clock, ShieldAlert, CheckCircle2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInventoryStore } from '../store/useInventoryStore';
import { useDocStore } from '../store/useDocStore';

/**
 * NotificationBell Component
 * Memberikan ringkasan hal-hal penting yang memerlukan perhatian user.
 */
const NotificationBell = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [dismissedIds, setDismissedIds] = useState(new Set());
    const { ocrStats, inventoryIssues } = useInventoryStore();
    const { approvals } = useDocStore();

    // Generate notifications dari state global
    const notifications = useMemo(() => {
        const list = [];

        // 1. Kegagalan OCR
        if (ocrStats?.counts?.failed > 0) {
            list.push({
                id: `ocr-failed-${ocrStats.counts.failed}`,
                type: 'error',
                title: 'Kegagalan OCR',
                message: `${ocrStats.counts.failed} dokumen gagal diproses. Periksa log untuk detailnya.`,
                icon: AlertCircle,
                color: 'text-rose-500',
                bg: 'bg-rose-50 dark:bg-rose-500/10'
            });
        }

        // 2. Persetujuan Menunggu (Approvals)
        const pendingApprovals = (approvals || []).filter(a => a.status === 'Pending');
        if (pendingApprovals.length > 0) {
            list.push({
                id: `approvals-pending-${pendingApprovals.length}`,
                type: 'info',
                title: 'Persetujuan Dokumen',
                message: `Ada ${pendingApprovals.length} pengajuan yang menunggu keputusan Anda.`,
                icon: Clock,
                color: 'text-indigo-500',
                bg: 'bg-indigo-50 dark:bg-indigo-500/10'
            });
        }

        // 3. Masalah Inventaris (Box Nyangkut)
        if (inventoryIssues?.length > 0) {
            list.push({
                id: `inv-issues-${inventoryIssues.length}`,
                type: 'warning',
                title: 'Masalah Inventaris',
                message: `Terdeteksi ${inventoryIssues.length} box yang tidak sinkron (nyangkut).`,
                icon: ShieldAlert,
                color: 'text-amber-500',
                bg: 'bg-amber-50 dark:bg-amber-500/10'
            });
        }

        // Filter out dismissed notifications
        return list.filter(n => !dismissedIds.has(n.id));
    }, [ocrStats, approvals, inventoryIssues, dismissedIds]);

    const handleDismiss = (e, id) => {
        e.stopPropagation();
        setDismissedIds(prev => new Set(prev).add(id));
    };

    const handleClearAll = () => {
        const newDismissed = new Set(dismissedIds);
        notifications.forEach(n => newDismissed.add(n.id));
        setDismissedIds(newDismissed);
    };

    const unreadCount = notifications.length;

    return (
        <div className="fixed top-4 right-20 z-[9998] font-sans pointer-events-none">
            <div className="pointer-events-auto relative">
                {/* Bell Icon Button */}
                <button 
                    onClick={() => setIsOpen(!isOpen)}
                    className="relative p-3 bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl shadow-lg hover:scale-110 transition-all group active:scale-95"
                >
                    <Bell size={24} className={`${unreadCount > 0 ? 'text-indigo-600 dark:text-indigo-400 animate-pulse' : 'text-slate-500 dark:text-slate-400'} group-hover:text-indigo-500 transition-colors`} />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white shadow-lg border-2 border-white dark:border-slate-900">
                            {unreadCount}
                        </span>
                    )}
                </button>

                {/* Notification Panel */}
                <AnimatePresence>
                    {isOpen && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute right-0 mt-4 w-80 bg-white/90 dark:bg-slate-900/95 backdrop-blur-2xl rounded-[2rem] shadow-2xl border border-slate-100 dark:border-white/5 overflow-hidden z-50"
                        >
                            <div className="p-6 border-b border-slate-50 dark:border-white/5 flex justify-between items-center">
                                <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-tight text-sm">Pusat Notifikasi</h3>
                                <div className="flex items-center gap-2">
                                    {notifications.length > 0 && (
                                        <button 
                                            onClick={handleClearAll}
                                            className="text-[10px] font-bold text-rose-500 hover:text-rose-600 uppercase tracking-widest px-2 py-1 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                                        >
                                            Hapus Semua
                                        </button>
                                    )}
                                    <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors text-slate-400"><X size={16} /></button>
                                </div>
                            </div>
                            
                            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                {notifications.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <CheckCircle2 size={32} className="text-slate-200 dark:text-slate-700" />
                                        </div>
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Semua Beres!</p>
                                        <p className="text-[10px] text-slate-400 mt-1">Tidak ada hal mendesak saat ini.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-50 dark:divide-white/5">
                                        {notifications.map(n => (
                                            <div key={n.id} className="p-5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer group relative">
                                                <button 
                                                    onClick={(e) => handleDismiss(e, n.id)}
                                                    className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10"
                                                    title="Hapus"
                                                >
                                                    <X size={14} />
                                                </button>
                                                <div className="flex gap-4">
                                                    <div className={`p-2.5 rounded-2xl shrink-0 h-fit ${n.bg} ${n.color}`}>
                                                        <n.icon size={20} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-black text-slate-800 dark:text-white leading-tight">{n.title}</p>
                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">{n.message}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            <div className="p-4 bg-slate-50/50 dark:bg-white/5 text-center">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Sistem Monitoring Real-time</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default NotificationBell;