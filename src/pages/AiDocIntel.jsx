import React from 'react';
import { FileSpreadsheet } from 'lucide-react';
import TemplateMapper from '../components/anydoc/TemplateMapper.jsx';
import { PageHeader } from '../components/ui/PageHeader';
import { useLanguage } from '../contexts/LanguageContext';

// ── AI Document Intelligence — fokus ekstraksi data dari PDF asli ──
// Menu terpisah dari Training Dokumen agar alur upload → ekstrak → Excel tidak ribet.
export default function AiDocIntel({ isDarkMode, currentUser }) {
    const { isEnglish } = useLanguage();
    const title = isEnglish ? 'AI Document Intelligence' : 'AI Document Intelligence';
    const desc = isEnglish
        ? <>Upload original PDF → auto-detect → extract data → export Excel. Template training is done in the{' '}<span className="font-bold text-blue-500">Document Training</span> menu.</>
        : <>Upload PDF asli → deteksi otomatis → ekstrak data → export Excel. Training template dilakukan di menu{' '}<span className="font-bold text-blue-500">Training Dokumen</span>.</>;
    return (
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6">
            {/* Header halaman — PageHeader terpusat (konsisten semua menu) */}
            <PageHeader icon={FileSpreadsheet} iconClass="from-emerald-500 to-teal-600" title={title} subtitle={desc} />

            {/* TemplateMapper dalam mode ekstraksi (lockView: tanpa tab training) */}
            <TemplateMapper isDarkMode={isDarkMode} currentUser={currentUser} defaultView="extract" lockView />
        </div>
    );
}
