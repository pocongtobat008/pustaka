import React from 'react';
import { X } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children, size = 'max-w-4xl' }) => {
    if (!isOpen) return null;
    return (
        <div
            data-app-modal="true"
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-300 pointer-events-auto"
            onClick={onClose}
        >
            <div
                className={`bg-white/80 dark:bg-slate-900/80 backdrop-blur-3xl border border-white/50 dark:border-white/10 w-full ${size} max-h-[90vh] overflow-hidden rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300 relative group`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Decorative Gradients */}
                <div className="absolute -top-24 -right-24 w-60 h-60 bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none group-hover:bg-indigo-500/30 transition-all duration-1000"></div>
                <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-purple-500/20 rounded-full blur-[100px] pointer-events-none group-hover:bg-purple-500/30 transition-all duration-1000"></div>

                <div className="flex justify-between items-center p-8 border-b border-white/20 dark:border-white/5 sticky top-0 bg-white/20 dark:bg-slate-900/20 backdrop-blur-xl z-20">
                    <div>
                        <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 tracking-tight">
                            {title}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700 rounded-2xl text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white transition-all shadow-sm hover:shadow-xl hover:-translate-y-0.5"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar max-h-[calc(90vh-100px)]">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;
