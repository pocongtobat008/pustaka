import React from 'react';
import { FlaskConical } from 'lucide-react';
import TemplateMapper from '../components/anydoc/TemplateMapper.jsx';
import { useLanguage } from '../contexts/LanguageContext';

// ── Training Dokumen — mapping field & melatih AI per jenis dokumen ──
// Menu terpisah dari AI Document Intelligence agar pengguna fokus menyiapkan template dulu.
export default function AiDocTrain({ isDarkMode, currentUser }) {
    const { isEnglish } = useLanguage();
    const title = isEnglish ? 'Document Training' : 'Training Dokumen';
    const desc = isEnglish
        ? <>Prepare templates: upload samples, map columns, test, and save. Once ready, use them in the{' '}<span className="font-bold text-emerald-500">AI Document Intelligence</span> menu.</>
        : <>Siapkan template: upload sampel, mapping kolom, uji coba, dan simpan. Setelah template siap, gunakan di menu{' '}<span className="font-bold text-emerald-500">AI Document Intelligence</span>.</>;
    return (
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6">
            {/* Header halaman */}
            <div className="mb-6 flex items-start gap-3.5">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20 bg-gradient-to-br from-indigo-500 to-purple-600`}>
                    <FlaskConical size={20} className="text-white" />
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

            {/* TemplateMapper dalam mode training (lockView: tanpa tab ekstraksi) */}
            <TemplateMapper isDarkMode={isDarkMode} currentUser={currentUser} defaultView="train" lockView />
        </div>
    );
}
