import React from 'react';
import { X } from 'lucide-react';

export const Modal = ({ isOpen, onClose, title, children, size = 'max-w-4xl' }) => {
    if (!isOpen) return null;
    return (
        <div data-app-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
            <div className={`bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/40 dark:border-white/10 w-full ${size} max-h-[90vh] overflow-y-auto rounded-3xl shadow-3xl animate-in zoom-in-95 duration-200 transition-colors duration-300 ring-1 ring-black/5`}>
                <div className="flex justify-between items-center p-6 border-b border-white/20 dark:border-white/10 sticky top-0 bg-transparent backdrop-blur-xl z-10">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
};
