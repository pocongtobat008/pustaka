import React from 'react';
import {
    BookOpen,
    LayoutDashboard,
    Grid3x3,
    FileStack,
    FileCode2,
    FileSpreadsheet,
    Wand2,
    ShieldCheck,
    Calculator,
    PieChart,
    Receipt,
    FileSignature,
    ListOrdered,
    GitBranch,
    ClipboardCheck,
    Settings,
    Server,
    Target,
    Rocket,
    Eye,
    Info,
} from 'lucide-react';
import Modal from '../common/Modal';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * AboutSystemModal — Tentang Sistem: deskripsi, visi & misi, dan ringkasan fitur.
 * Bilingual (ID/EN) mengikuti bahasa aktif aplikasi. Gaya konsisten dengan tema glass.
 */
const AboutSystemModal = ({ isOpen, onClose }) => {
    const { language } = useLanguage();
    const isEnglish = language === 'en';

    const text = isEnglish
        ? {
            aboutTitle: 'About Pustaka',
            aboutDesc: 'Pustaka is a unified document, archive & information management platform. Combining secure digital storage, AI-powered OCR and document intelligence, tax compliance tools, and enterprise workflow features in one modern workspace.',
            visionTitle: 'Vision',
            visionDesc: 'To be the trusted, intelligent, and secure unified platform for document, archive and information management — supporting efficient, compliant and transparent corporate operations.',
            missionTitle: 'Mission',
            mission: [
                'Provide a secure, structured and easily accessible digital archive center.',
                'Leverage artificial intelligence for OCR automation, data extraction and document analysis.',
                'Support tax compliance and comprehensive corporate document governance.',
                'Deliver a modern, fast and reliable user experience.',
            ],
            featuresTitle: 'Feature Summary',
            featuresSubtitle: 'Complete modules available in Pustaka',
            featureList: [
                { icon: LayoutDashboard, label: 'Executive Dashboard' },
                { icon: Grid3x3, label: 'Archive & Rack Management' },
                { icon: FileStack, label: 'Digital Documents' },
                { icon: FileCode2, label: 'AnyDoc Converter' },
                { icon: FileSpreadsheet, label: 'AI Document Intelligence' },
                { icon: Wand2, label: 'AI PDF Tools & OCR' },
                { icon: ShieldCheck, label: 'Tax Audit Monitoring' },
                { icon: Calculator, label: 'Tax Calculation' },
                { icon: PieChart, label: 'Tax Compliance Summary' },
                { icon: Receipt, label: 'Entertainment Expenses' },
                { icon: FileSignature, label: 'Invoices (Proforma)' },
                { icon: ListOrdered, label: 'Book / Chart of Accounts' },
                { icon: GitBranch, label: 'SOP Flow Designer' },
                { icon: ClipboardCheck, label: 'Job Due Date Monitoring' },
                { icon: BookOpen, label: 'Knowledge Library (Pustaka)' },
                { icon: Settings, label: 'Master Data' },
                { icon: Server, label: 'System Logs' },
                { icon: Eye, label: 'Document Approval' },
            ],
            version: 'Version',
            updated: 'All modules are integrated in one modern, glass-themed workspace.',
            close: 'Close',
        }
        : {
            aboutTitle: 'Tentang Pustaka',
            aboutDesc: 'Pustaka adalah platform manajemen dokumen, arsip & informasi yang terpadu. Menggabungkan penyimpanan digital yang aman, OCR dan document intelligence bertenaga AI, perangkat kepatuhan pajak, serta fitur alur kerja enterprise dalam satu ruang kerja modern.',
            visionTitle: 'Visi',
            visionDesc: 'Menjadi platform terpadu manajemen dokumen, arsip & informasi yang andal, cerdas, dan aman — mendukung operasional perusahaan yang efisien, patuh, dan transparan.',
            missionTitle: 'Misi',
            mission: [
                'Menyediakan pusat arsip digital yang aman, terstruktur, dan mudah diakses.',
                'Memanfaatkan kecerdasan buatan untuk otomatisasi OCR, ekstraksi data, dan analisis dokumen.',
                'Mendukung kepatuhan pajak dan tata kelola dokumen perusahaan secara menyeluruh.',
                'Menghadirkan pengalaman pengguna yang modern, cepat, dan andal.',
            ],
            featuresTitle: 'Ringkasan Fitur',
            featuresSubtitle: 'Modul lengkap yang tersedia di Pustaka',
            featureList: [
                { icon: LayoutDashboard, label: 'Dashboard Ikhtisar' },
                { icon: Grid3x3, label: 'Manajemen Rak & Arsip' },
                { icon: FileStack, label: 'Dokumen Digital' },
                { icon: FileCode2, label: 'AnyDoc Converter' },
                { icon: FileSpreadsheet, label: 'AI Document Intelligence' },
                { icon: Wand2, label: 'AI PDF Tools & OCR' },
                { icon: ShieldCheck, label: 'Monitoring Pemeriksaan Pajak' },
                { icon: Calculator, label: 'Kalkulasi Pajak' },
                { icon: PieChart, label: 'Ringkasan Kepatuhan Pajak' },
                { icon: Receipt, label: 'Entertainment Expenses' },
                { icon: FileSignature, label: 'Invoices (Proforma)' },
                { icon: ListOrdered, label: 'Book / Daftar COA' },
                { icon: GitBranch, label: 'SOP Flow Designer' },
                { icon: ClipboardCheck, label: 'Monitoring Job Due Date' },
                { icon: BookOpen, label: 'Pustaka Pengetahuan' },
                { icon: Settings, label: 'Master Data' },
                { icon: Server, label: 'Log Sistem' },
                { icon: Eye, label: 'Persetujuan Dokumen' },
            ],
            version: 'Versi',
            updated: 'Semua modul terintegrasi dalam satu ruang kerja modern bertema glass.',
            close: 'Tutup',
        };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={text.aboutTitle} size="max-w-3xl">
            {/* Header brand */}
            <div className="flex items-center gap-4 mb-6">
                <div className="cf-logo-orb w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl shrink-0">
                    <BookOpen size={24} className="text-white" strokeWidth={2.4} />
                </div>
                <div>
                    <div className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Pustaka</div>
                    <div className="text-xs font-bold text-slate-400 dark:text-slate-500">
                        {text.version} 1.0.0 • Document OS
                    </div>
                </div>
                <span className="ml-auto neo-chip px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-blue-500 dark:text-blue-300">
                    Enterprise
                </span>
            </div>

            {/* Deskripsi */}
            <div className="glass-card rounded-2xl p-5 mb-6">
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {text.aboutDesc}
                </p>
            </div>

            {/* Visi & Misi */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="glass-card rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 gradient-bg rounded-xl text-white shadow-lg shadow-blue-500/30">
                            <Target size={16} />
                        </div>
                        <h3 className="font-black text-sm text-slate-800 dark:text-white uppercase tracking-wider">
                            {text.visionTitle}
                        </h3>
                    </div>
                    <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
                        {text.visionDesc}
                    </p>
                </div>
                <div className="glass-card rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 gradient-bg rounded-xl text-white shadow-lg shadow-blue-500/30">
                            <Rocket size={16} />
                        </div>
                        <h3 className="font-black text-sm text-slate-800 dark:text-white uppercase tracking-wider">
                            {text.missionTitle}
                        </h3>
                    </div>
                    <ul className="space-y-2">
                        {text.mission.map((m, i) => (
                            <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full gradient-bg shrink-0"></span>
                                {m}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Ringkasan fitur */}
            <div className="mb-2">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 gradient-bg rounded-xl text-white shadow-lg shadow-blue-500/30">
                        <Info size={16} />
                    </div>
                    <div>
                        <h3 className="font-black text-sm text-slate-800 dark:text-white uppercase tracking-wider">
                            {text.featuresTitle}
                        </h3>
                        <p className="text-[11px] font-semibold text-slate-400">{text.featuresSubtitle}</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {text.featureList.map((f, i) => {
                        const Icon = f.icon;
                        return (
                            <div
                                key={i}
                                className="neo-btn flex items-center gap-2 px-3 py-2.5 text-left"
                                title={f.label}
                            >
                                <span className="w-7 h-7 rounded-lg gradient-bg-soft text-blue-500 dark:text-blue-300 flex items-center justify-center shrink-0">
                                    <Icon size={14} />
                                </span>
                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 leading-tight">
                                    {f.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-4 text-center">
                    {text.updated}
                </p>
            </div>
        </Modal>
    );
};

export default AboutSystemModal;
