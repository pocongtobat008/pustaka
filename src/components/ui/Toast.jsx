import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, Upload, X, Loader2 } from 'lucide-react';

// ─── Toast Hook ────────────────────────────────────────────
let toastIdCounter = 0;

export function useToast() {
    const [toasts, setToasts] = useState([]);
    const timersRef = useRef({});

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
        if (timersRef.current[id]) {
            clearTimeout(timersRef.current[id]);
            delete timersRef.current[id];
        }
    }, []);

    const addToast = useCallback((message, type = 'success', duration = 4000) => {
        const id = ++toastIdCounter;
        const toast = { id, message, type, createdAt: Date.now() };
        setToasts(prev => [...prev.slice(-4), toast]); // Max 5 visible

        if (duration > 0) {
            timersRef.current[id] = setTimeout(() => {
                removeToast(id);
            }, duration);
        }

        return id;
    }, [removeToast]);

    const updateToast = useCallback((id, updates) => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));

        // If updating to a final state, auto-dismiss after 3s
        if (updates.type && updates.type !== 'loading') {
            if (timersRef.current[id]) clearTimeout(timersRef.current[id]);
            timersRef.current[id] = setTimeout(() => {
                removeToast(id);
            }, 3500);
        }
    }, [removeToast]);

    const toast = useCallback({
        success: (msg) => addToast(msg, 'success', 4000),
        error: (msg) => addToast(msg, 'error', 6000),
        info: (msg) => addToast(msg, 'info', 4000),
        warning: (msg) => addToast(msg, 'warning', 5000),
        loading: (msg) => addToast(msg, 'loading', 0), // Stays until updated
    }, [addToast]);

    // Add return values to the object methods
    const toastApi = {
        success: (msg) => toast.success(msg),
        error: (msg) => toast.error(msg),
        info: (msg) => toast.info(msg),
        warning: (msg) => toast.warning(msg),
        loading: (msg) => toast.loading(msg),
    };

    const toastWithIds = useCallback({
        success: (msg) => addToast(msg, 'success', 4000),
        error: (msg) => addToast(msg, 'error', 6000),
        info: (msg) => addToast(msg, 'info', 4000),
        warning: (msg) => addToast(msg, 'warning', 5000),
        loading: (msg) => addToast(msg, 'loading', 0),
    }, [addToast]);

    return { toasts, toast: toastWithIds, removeToast, updateToast, addToast };
}

// ─── Toast Config ──────────────────────────────────────────
const TOAST_CONFIG = {
    success: {
        icon: CheckCircle2,
        bg: 'bg-emerald-500',
        ring: 'ring-emerald-500/10',
        border: 'border-emerald-500/30',
        label: 'Berhasil',
        labelColor: 'text-emerald-600 dark:text-emerald-400',
    },
    error: {
        icon: AlertCircle,
        bg: 'bg-red-500',
        ring: 'ring-red-500/10',
        border: 'border-red-500/30',
        label: 'Gagal',
        labelColor: 'text-red-600 dark:text-red-400',
    },
    info: {
        icon: Info,
        bg: 'bg-blue-500',
        ring: 'ring-blue-500/10',
        border: 'border-blue-500/30',
        label: 'Info',
        labelColor: 'text-blue-600 dark:text-blue-400',
    },
    warning: {
        icon: AlertCircle,
        bg: 'bg-amber-500',
        ring: 'ring-amber-500/10',
        border: 'border-amber-500/30',
        label: 'Peringatan',
        labelColor: 'text-amber-600 dark:text-amber-400',
    },
    loading: {
        icon: Loader2,
        bg: 'bg-indigo-500',
        ring: 'ring-indigo-500/10',
        border: 'border-indigo-500/30',
        label: 'Memproses',
        labelColor: 'text-indigo-600 dark:text-indigo-400',
    },
};

// ─── Toast Container Component ─────────────────────────────
export function ToastContainer({ toasts, onRemove }) {
    return (
        <div className="fixed bottom-6 right-6 z-[40] flex flex-col gap-3 pointer-events-none max-w-sm w-full">
            <AnimatePresence mode="popLayout">
                {toasts.map((toast) => {
                    const config = TOAST_CONFIG[toast.type] || TOAST_CONFIG.info;
                    const IconComponent = config.icon;
                    const isLoading = toast.type === 'loading';

                    return (
                        <motion.div
                            key={toast.id}
                            layout
                            initial={{ opacity: 0, y: 40, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 80, scale: 0.9 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                            className={`
                pointer-events-auto
                bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl 
                border ${config.border} 
                p-3.5 rounded-2xl shadow-2xl 
                ring-8 ${config.ring}
                flex items-center gap-3 
                cursor-pointer group
                hover:scale-[1.02] transition-transform
              `}
                            onClick={() => !isLoading && onRemove(toast.id)}
                        >
                            {/* Icon */}
                            <div className={`p-2.5 ${config.bg} rounded-xl text-white shadow-lg flex-shrink-0`}>
                                <IconComponent
                                    size={16}
                                    className={isLoading ? 'animate-spin' : ''}
                                />
                            </div>

                            {/* Content */}
                            <div className="flex flex-col flex-1 min-w-0">
                                <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${config.labelColor} mb-0.5`}>
                                    {config.label}
                                </span>
                                <span className="font-semibold text-slate-800 dark:text-white text-sm leading-tight truncate">
                                    {toast.message}
                                </span>

                                {/* Progress Bar */}
                                {toast.progress !== undefined && (
                                    <div className="mt-2 w-full bg-gray-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${toast.progress}%` }}
                                            className={`${config.bg} h-full transition-all duration-300`}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Close Button */}
                            {!isLoading && (
                                <button
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 flex-shrink-0"
                                    onClick={(e) => { e.stopPropagation(); onRemove(toast.id); }}
                                >
                                    <X size={12} className="text-slate-400" />
                                </button>
                            )}
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
