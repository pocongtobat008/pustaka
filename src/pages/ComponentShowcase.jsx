import React, { useState } from 'react';
import {
    Palette, Copy, Check, LayoutGrid, Rows3, Columns2, Banknote, ClipboardList, FileText,
} from 'lucide-react';
import { SummaryCard, SummaryRow } from '../components/ui/Card';
import { useLanguage } from '../contexts/LanguageContext';

// ── Galeri Komponen / Component Gallery — showcase SummaryCard & SummaryRow ──
// Referensi cepat untuk tim developer/designer: lihat live preview + salin kodenya.

const gradients = [
    { name: 'indigo → purple', cls: 'from-indigo-500 to-purple-600', icon: Palette },
    { name: 'emerald → teal', cls: 'from-emerald-500 to-teal-600', icon: ClipboardList },
    { name: 'amber → orange', cls: 'from-amber-500 to-orange-600', icon: FileText },
    { name: 'rose → red', cls: 'from-rose-500 to-red-600', icon: Banknote },
    { name: 'violet → fuchsia', cls: 'from-violet-500 to-fuchsia-600', icon: Rows3 },
    { name: 'sky → cyan', cls: 'from-sky-500 to-cyan-600', icon: LayoutGrid },
    { name: 'slate → slate', cls: 'from-slate-500 to-slate-700', icon: Columns2 },
    { name: 'blue → cyan', cls: 'from-blue-500 to-cyan-600', icon: Check },
];

function CodeBlock({ code, isDarkMode }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* ignore */ }
    };
    return (
        <div className="relative">
            <pre className={`overflow-x-auto rounded-xl p-4 text-[11px] leading-relaxed font-mono ${isDarkMode ? 'bg-[#0d1117] text-slate-300' : 'bg-slate-900 text-slate-200'}`}>
                <code>{code}</code>
            </pre>
            <button
                onClick={copy}
                className={`absolute top-2 right-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all active:scale-90 ${isDarkMode ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
                title="Salin kode"
            >
                {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                {copied ? 'Tersalin!' : 'Salin'}
            </button>
        </div>
    );
}

function Section({ icon: Icon, title, desc, children, code, isDarkMode, accent = 'from-indigo-500 to-purple-600' }) {
    return (
        <div className={`rounded-3xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-2xl ring-1 ring-black/5 dark:ring-white/5 overflow-hidden`}>
            <div className="p-5 border-b border-slate-100 dark:border-white/10 flex items-start gap-3">
                <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${accent} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                    {Icon && <Icon size={18} className="text-white" />}
                </div>
                <div className="min-w-0">
                    <h3 className="font-black text-sm text-slate-800 dark:text-white">{title}</h3>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{desc}</p>
                </div>
            </div>
            <div className="p-5 space-y-5">
                {children}
                <CodeBlock code={code} isDarkMode={isDarkMode} />
            </div>
        </div>
    );
}

export default function ComponentShowcase({ isDarkMode }) {
    const { isEnglish } = useLanguage();
    const copyAction = (
        <button
            onClick={(e) => { e.stopPropagation(); }}
            className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-white/10 transition-all active:scale-90 flex-shrink-0"
            title="Salin"
        >
            <Copy size={16} />
        </button>
    );

    const fourColCards = gradients.map((g, i) => ({
        title: isEnglish ? `Metric ${i + 1}` : `Metrik ${i + 1}`,
        value: (1234 + i * 137).toLocaleString('id-ID'),
        subtext: g.name,
        icon: g.icon,
        gradient: g.cls,
    }));

    const threeColCards = [
        { title: isEnglish ? 'Total Accounts' : 'Total Akun', value: 128, subtext: isEnglish ? 'Chart of Accounts' : 'Bagan akun', icon: FileText, gradient: 'from-indigo-500 to-purple-600' },
        { title: isEnglish ? 'Sub Accounts' : 'Sub Akun', value: 512, subtext: isEnglish ? 'Child accounts' : 'Akun turunan', icon: LayoutGrid, gradient: 'from-cyan-500 to-blue-600' },
        { title: isEnglish ? 'Departments' : 'Departemen', value: 14, subtext: isEnglish ? 'Active departments' : 'Departemen aktif', icon: Banknote, gradient: 'from-amber-500 to-orange-600' },
    ];

    const twoColCards = [
        { title: isEnglish ? 'Grand Total (valuePrefix)' : 'Total Keseluruhan (valuePrefix)', value: '1.250.000.000', valuePrefix: 'Rp ', valueClass: 'text-2xl', subtext: isEnglish ? 'With prefix & bigger font' : 'Dengan prefix & font besar', icon: Banknote, gradient: 'from-indigo-600 to-purple-700' },
        { title: isEnglish ? 'Long value truncates' : 'Nilai panjang ter-truncate', value: '1.234.567.890.123.456.789', subtext: isEnglish ? 'Automatically cut with ellipsis' : 'Terpotong otomatis dengan ellipsis', icon: ClipboardList, gradient: 'from-emerald-500 to-teal-600' },
    ];

    const actionCards = [
        {
            title: 'Estimasi PPh Terutang',
            value: '18.750.000',
            valuePrefix: 'Rp ',
            valueClass: 'text-lg',
            subtext: isEnglish ? 'With copy action button' : 'Dengan tombol aksi salin',
            icon: Banknote,
            gradient: 'from-indigo-600 to-purple-700',
            action: copyAction,
        },
        {
            title: 'PPh 23',
            value: '1,2 Jt',
            valuePrefix: 'Rp ',
            valueClass: 'text-lg',
            subtext: isEnglish ? 'Hover to reveal action' : 'Hover untuk munculkan aksi',
            icon: FileText,
            gradient: 'from-emerald-500 to-teal-600',
            action: (
                <button
                    onClick={(e) => { e.stopPropagation(); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-white/10 transition-all flex-shrink-0"
                    title="Salin"
                >
                    <Copy size={12} />
                </button>
            ),
        },
    ];

    return (
        <div className="max-w-[1200px] mx-auto px-4 lg:px-6 py-6 space-y-6">
            {/* Header halaman */}
            <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20 bg-gradient-to-br from-indigo-500 to-purple-600">
                    <Palette size={20} className="text-white" />
                </div>
                <div>
                    <h1 className="text-lg font-black tracking-tight text-slate-800 dark:text-white">
                        {isEnglish ? 'Component Gallery' : 'Galeri Komponen'}
                    </h1>
                    <p className="text-xs mt-0.5 text-slate-400">
                        {isEnglish
                            ? 'Live preview & copyable code for SummaryCard / SummaryRow — the single source of truth for every menu.'
                            : 'Preview langsung & kode yang bisa disalin untuk SummaryCard / SummaryRow — satu sumber kebenaran di semua menu.'}
                    </p>
                </div>
            </div>

            {/* Section 1 — SummaryRow default 4 kolom */}
            <Section
                icon={LayoutGrid}
                title={isEnglish ? 'SummaryRow — 4 Columns (default)' : 'SummaryRow — 4 Kolom (default)'}
                desc={isEnglish ? 'Used in Dashboard, Invoices, Pustaka, Inventory, SopFlow, MasterData, SystemLogs, PdfTemplateDesigner, AiPdfTools, AnyDoc, JobDueDate & AI Document Intelligence.' : 'Dipakai di Dashboard, Invoices, Pustaka, Inventory, SopFlow, MasterData, SystemLogs, PdfTemplateDesigner, AiPdfTools, AnyDoc, JobDueDate & AI Document Intelligence.'}
                accent="from-indigo-500 to-purple-600"
                code={`<SummaryRow cards={[
    { title: 'Total', value: 1234, icon: Package, gradient: 'from-indigo-500 to-purple-600' },
    { title: 'Aktif', value: 1371, icon: CheckCircle2, gradient: 'from-emerald-500 to-teal-600' },
    { title: 'Terlambat', value: 12, icon: AlertCircle, gradient: 'from-rose-500 to-red-600' },
    { title: 'Issue', value: 5, icon: Activity, gradient: 'from-amber-500 to-orange-600' },
]} />`}
                isDarkMode={isDarkMode}
            >
                <SummaryRow cards={fourColCards} />
            </Section>

            {/* Section 2 — 3 kolom */}
            <Section
                icon={Rows3}
                title={isEnglish ? 'SummaryRow — 3 Columns' : 'SummaryRow — 3 Kolom'}
                desc={isEnglish ? 'Used in Book, Documents, Entertainment Expenses & Document Approval.' : 'Dipakai di Book, Documents, Entertainment Expenses & Document Approval.'}
                accent="from-cyan-500 to-blue-600"
                code={`<SummaryRow cols={3} cards={[
    { title: 'Akun', value: 128, icon: BookOpen, gradient: 'from-indigo-500 to-purple-600' },
    { title: 'Sub Akun', value: 512, icon: FolderOpen, gradient: 'from-cyan-500 to-blue-600' },
    { title: 'Departemen', value: 14, icon: Building2, gradient: 'from-amber-500 to-orange-600' },
]} />`}
                isDarkMode={isDarkMode}
            >
                <SummaryRow cols={3} cards={threeColCards} />
            </Section>

            {/* Section 3 — 2 kolom + valuePrefix */}
            <Section
                icon={Columns2}
                title={isEnglish ? '2 Columns, valuePrefix & valueClass' : '2 Kolom, valuePrefix & valueClass'}
                desc={isEnglish ? 'valuePrefix adds a label before the number (e.g. "Rp "); valueClass controls font size.' : 'valuePrefix menambahkan label sebelum angka (mis. "Rp "); valueClass mengatur ukuran font.'}
                accent="from-violet-500 to-fuchsia-600"
                code={`<SummaryRow cols={2} cards={[
    { title: 'Grand Total', value: '1.250.000.000', valuePrefix: 'Rp ', valueClass: 'text-2xl', icon: Banknote, gradient: 'from-indigo-600 to-purple-700' },
    { title: 'Nilai Panjang', value: '1.234.567.890.123.456.789', icon: FileText, gradient: 'from-emerald-500 to-teal-600' },
]} />`}
                isDarkMode={isDarkMode}
            >
                <SummaryRow cols={2} cards={twoColCards} />
            </Section>

            {/* Section 4 — action prop */}
            <Section
                icon={ClipboardList}
                title={isEnglish ? 'action Prop (Copy Button)' : 'Prop action (Tombol Aksi)'}
                desc={isEnglish ? 'Add any node on the right side of the card — used by Tax Summary for copy buttons.' : 'Tambahkan node apa pun di sisi kanan kartu — dipakai Tax Summary untuk tombol salin.'}
                accent="from-emerald-500 to-teal-600"
                code={`<SummaryRow cards={[
    { title: 'Estimasi PPh', value: '18.750.000', valuePrefix: 'Rp ', valueClass: 'text-lg', icon: Banknote, gradient: 'from-indigo-600 to-purple-700',
      action: <button onClick={copy} className="p-2 rounded-xl ..."><Copy size={16} /></button> },
    { title: 'PPh 23', value: '1,2 Jt', valuePrefix: 'Rp ', valueClass: 'text-lg', icon: FileText, gradient: 'from-emerald-500 to-teal-600',
      action: <button className="opacity-0 group-hover:opacity-100 ..."><Copy size={12} /></button> },
]} />`}
                isDarkMode={isDarkMode}
            >
                <SummaryRow cards={actionCards} />
            </Section>

            {/* Footer note */}
            <p className="text-[10px] text-center text-slate-400 uppercase tracking-widest font-bold">
                {isEnglish
                    ? 'Source: src/components/ui/Card.jsx — SummaryCard & SummaryRow'
                    : 'Sumber: src/components/ui/Card.jsx — SummaryCard & SummaryRow'}
            </p>
        </div>
    );
}
