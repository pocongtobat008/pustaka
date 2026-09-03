import React from 'react';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export default function LoadingFallback() {
    const { language } = useLanguage();
    const isEnglish = language === 'en';
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] w-full gap-4 animate-in fade-in duration-500">
            <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-100 dark:border-white/[0.06] rounded-full"></div>
                <Loader2 size={64} className="text-blue-600 dark:text-blue-400 animate-spin absolute top-0 left-0" />
            </div>
            <div className="text-center">
                <h3 className="text-lg font-black text-stone-800 dark:text-white uppercase tracking-widest">{isEnglish ? 'Loading' : 'Memuat'}</h3>
                <p className="text-xs font-bold text-stone-400 dark:text-white/30 uppercase tracking-tighter">{isEnglish ? 'Preparing the application module...' : 'Menyiapkan modul aplikasi...'}</p>
            </div>
        </div>
    );
}
