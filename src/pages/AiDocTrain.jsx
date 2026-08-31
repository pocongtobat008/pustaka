import React from 'react';
import { FlaskConical } from 'lucide-react';
import TemplateMapper from '../components/anydoc/TemplateMapper.jsx';
import { PageHeader } from '../components/ui/PageHeader';
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
            {/* Header halaman — PageHeader terpusat (konsisten semua menu) */}
            <PageHeader icon={FlaskConical} iconClass="from-blue-500 to-purple-600" title={title} subtitle={desc} />

            {/* TemplateMapper dalam mode training (lockView: tanpa tab ekstraksi) */}
            <TemplateMapper isDarkMode={isDarkMode} currentUser={currentUser} defaultView="train" lockView />
        </div>
    );
}
