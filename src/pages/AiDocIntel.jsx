import React from 'react';
import { FileSpreadsheet } from 'lucide-react';
import TemplateMapper from '../components/anydoc/TemplateMapper.jsx';
import { useLanguage } from '../contexts/LanguageContext';

// ── AI Document Intelligence — fokus ekstraksi data dari PDF asli ──
// Menu terpisah dari Training Dokumen agar alur upload → ekstrak → Excel tidak ribet.
export default function AiDocIntel({ isDarkMode }) {
    const { isEnglish } = useLanguage();
    const title = isEnglish ? 'AI Document Intelligence' : 'AI Document Intelligence';
    const desc = isEnglish
        ? <>Upload original PDF → auto-detect → extract data → export Excel. Template training is done in the{' '}<span className="font-bold text-indigo-500">Document Training</span> menu.</>
        : <>Upload PDF asli → deteksi otomatis → ekstrak data → export Excel. Training template dilakukan di menu{' '}<span className="font-bold text-indigo-500">Training Dokumen</span>.</>;
    return (
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6">
            {/* Header halaman */}
            <div className="mb-6 flex items-start gap-3.5">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20 bg-gradient-to-br from-emerald-500 to-teal-600`}>
                    <FileSpreadsheet size={20} className="text-white" />
                </div>
                <div>
                    <h1 className={`text-lg font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                        {title}
                    </h1>
                    <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                        {desc}
                    </p>
                </div>
            </div>

            {/* TemplateMapper dalam mode ekstraksi (lockView: tanpa tab training) */}
            <TemplateMapper isDarkMode={isDarkMode} defaultView="extract" lockView />
        </div>
    );
}
