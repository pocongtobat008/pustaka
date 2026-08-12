import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// ── Komponen Modal terpusat — gaya glass seragam di semua menu ──
// Props:
//   isOpen, onClose, title, children
//   size       : kelas max-width (default 'max-w-4xl')
//   hideHeader : sembunyikan baris header + tombol X (mis. spinner/progress)
//   noPadding  : hilangkan padding standar (untuk konten full-bleed)
//   center     : konten benar-benar di tengah layar
//   footer     : JSX opsional untuk baris aksi (dirender setelah children)
// Penghitung modal terbuka agar body scroll-lock aman saat modal bertumpuk
let openModalCount = 0;

export const Modal = ({ isOpen, onClose, title, children, size = 'max-w-4xl', hideHeader = false, noPadding = false, center = false, footer = null }) => {
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; });

    // ESC untuk menutup + kunci scroll body saat modal terbuka (aman saat bertumpuk)
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => { if (e.key === 'Escape' && onCloseRef.current) onCloseRef.current(); };
        document.addEventListener('keydown', onKey);
        if (openModalCount === 0) document.body.style.overflow = 'hidden';
        openModalCount += 1;
        return () => {
            openModalCount = Math.max(0, openModalCount - 1);
            if (openModalCount === 0) document.body.style.overflow = '';
            document.removeEventListener('keydown', onKey);
        };
    }, [isOpen]);

    if (!isOpen || typeof document === 'undefined') return null;

    const modalContent = (
        <div
            data-app-modal="true"
            className={`fixed inset-0 z-[1000] flex p-4 overflow-y-auto ${center ? 'items-center justify-center' : 'items-start justify-center sm:items-center'} bg-black/50 backdrop-blur-md animate-in fade-in duration-200`}
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className={`my-6 glass-card w-full ${size} ${noPadding ? '' : 'max-h-[92vh] overflow-y-auto'} rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 sm:my-0`}
            >
                {!hideHeader && (
                    <div className="flex justify-between items-center p-6 border-b border-white/20 dark:border-white/10 sticky top-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl z-10">
                        <h2 className="text-lg font-extrabold text-slate-800 dark:text-white tracking-tight">{title}</h2>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                )}
                <div className={noPadding ? '' : 'p-6'}>
                    {children}
                </div>
                {footer && !noPadding && (
                    <div className="px-6 pb-6">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
