import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingFallback() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] w-full gap-4 animate-in fade-in duration-500">
            <div className="relative">
                <div className="w-16 h-16 border-4 border-indigo-100 dark:border-slate-800 rounded-full"></div>
                <Loader2 size={64} className="text-indigo-600 dark:text-indigo-400 animate-spin absolute top-0 left-0" />
            </div>
            <div className="text-center">
                <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-widest">Memuat</h3>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Menyiapkan modul aplikasi...</p>
            </div>
        </div>
    );
}
