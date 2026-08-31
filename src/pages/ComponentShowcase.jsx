import React, { useState } from 'react';
import {
    LayoutDashboard, Download, Trash2, Plus, Save, Eye, Bell, FileText,
    CheckCircle2, AlertTriangle, Info, ShieldCheck, Sparkles
} from 'lucide-react';
import { Card, SummaryRow, SummaryCard } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { useLanguage } from '../contexts/LanguageContext';

// ── Component Showcase — panduan tim: komponen UI terpusat (tema glass + gradient) ──
// ROUTE TERSEMBUNYI: tidak ada di menu sidebar. Dibuka via Command Palette (Ctrl+K) →
// cari "Component Showcase" (grup Developer). Hanya referensi visual — tidak ada data asli.
export default function ComponentShowcase({ isDarkMode }) {
    const { language, isEnglish } = useLanguage();
    const [showModal, setShowModal] = useState(false);
    const [sampleInput, setSampleInput] = useState('');
    const t = (en, id) => (isEnglish ? en : id);

    const btnPrimary = 'inline-flex items-center gap-2 px-4 py-2.5 gradient-bg text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/25 hover:opacity-90 transition-all';
    const btnOutline = 'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/[0.08] text-slate-600 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors text-sm font-semibold';
    const btnGreen = 'inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/25 transition-all';
    const btnRed = 'inline-flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-rose-500/25 transition-all';
    const sectionTitle = 'text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-white/40 mb-3';

    return (
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6 space-y-8 animate-in fade-in duration-500">
            {/* Header — pakai PageHeader (sama seperti halaman lain) */}
            <PageHeader
                icon={Sparkles}
                iconClass="from-blue-500 to-cyan-500"
                title={t('Component Showcase', 'Showcase Komponen')}
                subtitle={t('Central UI kit — glass + gradient. All components below come from src/components/ui.', 'Kit UI terpusat — glass + gradient. Semua komponen di bawah berasal dari src/components/ui.')}
                meta={(
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25">
                        <AlertTriangle size={10} /> {t('Hidden route — via Ctrl+K', 'Route tersembunyi — via Ctrl+K')}
                    </span>
                )}
            />

            {/* ── 1. SummaryCard / SummaryRow ── */}
            <section>
                <div className={sectionTitle}>{t('1. Summary Cards (SummaryRow)', '1. Kartu Ringkasan (SummaryRow)')}</div>
                <SummaryRow cards={[
                    { title: t('Total Invoice', 'Total Invoice'), value: '27', icon: FileText, gradient: 'from-blue-600 to-blue-700', subtext: t('Rp 1.240.000.000', 'Rp 1.240.000.000'), valueClass: 'text-2xl' },
                    { title: t('Proforma', 'Proforma'), value: '18', icon: CheckCircle2, gradient: 'from-amber-500 to-orange-600', subtext: t('5 approved', '5 disetujui'), valueClass: 'text-2xl' },
                    { title: t('Occupancy', 'Okupansi'), value: '72%', icon: LayoutDashboard, gradient: 'from-emerald-500 to-teal-600', subtext: t('Warehouse capacity', 'Kapasitas gudang'), valueClass: 'text-2xl' },
                    { title: t('Notifications', 'Notifikasi'), value: '3', icon: Bell, gradient: 'from-blue-500 to-blue-600', subtext: t('Need action', 'Perlu tindakan'), valueClass: 'text-2xl' },
                ]} />
            </section>

            {/* ── 2. PageHeader ── */}
            <section>
                <div className={sectionTitle}>{t('2. Page Header (PageHeader)', '2. Header Halaman (PageHeader)')}</div>
                <Card>
                    <PageHeader
                        icon={LayoutDashboard}
                        iconClass="from-blue-500 to-blue-600"
                        title={t('Example Page Header', 'Contoh Header Halaman')}
                        subtitle={t('Icon + title + subtitle + optional actions — identical across all pages.', 'Ikon + judul + subjudul + aksi opsional — identik di semua halaman.')}
                        actions={<button className={btnPrimary}><Download size={15} /> {t('Export', 'Ekspor')}</button>}
                    />
                </Card>
            </section>

            {/* ── 3. Buttons ── */}
            <section>
                <div className={sectionTitle}>{t('3. Buttons', '3. Tombol')}</div>
                <Card className="space-y-4">
                    <div className="flex flex-wrap gap-3 items-center">
                        <button className={btnPrimary}><Plus size={15} /> {t('Primary (gradient)', 'Primer (gradient)')}</button>
                        <button className={btnOutline}><Save size={15} /> {t('Outline / Secondary', 'Garis / Sekunder')}</button>
                        <button className={btnGreen}><CheckCircle2 size={15} /> {t('Success (green)', 'Sukses (hijau)')}</button>
                        <button className={btnRed}><Trash2 size={15} /> {t('Danger (red)', 'Bahaya (merah)')}</button>
                        <button className="p-2.5 rounded-xl glass-card text-slate-500 hover:text-blue-600 transition-colors" aria-label={t('Icon button', 'Tombol ikon')} title={t('Icon only — needs aria-label', 'Hanya ikon — perlu aria-label')}>
                            <Eye size={18} />
                        </button>
                        <button className={`${btnPrimary} opacity-50 cursor-not-allowed`} disabled>{t('Disabled', 'Nonaktif')}</button>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-white/30">{t('Rule: primary = gradient-bg; semantic colors = green (create/export), red (delete/danger), blue (info). Icon-only buttons must have aria-label/title.', 'Aturan: primer = gradient-bg; warna semantik = hijau (buat/ekspor), merah (hapus/bahaya), biru (info). Tombol ikon wajib punya aria-label/title.')}</p>
                </Card>
            </section>

            {/* ── 4. Form inputs ── */}
            <section>
                <div className={sectionTitle}>{t('4. Form Inputs (Input / Select / Textarea)', '4. Input Form (Input / Select / Textarea)')}</div>
                <Card className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-white/40 mb-1.5">{t('Text Input', 'Input Teks')}</label>
                        <Input value={sampleInput} onChange={(e) => setSampleInput(e.target.value)} placeholder={t('Type something…', 'Ketik sesuatu…')} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-white/40 mb-1.5">{t('Select', 'Pilihan')}</label>
                        <Select defaultValue="1">
                            <option value="1">{t('Option A', 'Pilihan A')}</option>
                            <option value="2">{t('Option B', 'Pilihan B')}</option>
                            <option value="3">{t('Option C', 'Pilihan C')}</option>
                        </Select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 dark:text-white/40 mb-1.5">{t('Textarea', 'Area Teks')}</label>
                        <Textarea rows={3} placeholder={t('Long description…', 'Deskripsi panjang…')} />
                    </div>
                </Card>
            </section>

            {/* ── 5. Badges ── */}
            <section>
                <div className={sectionTitle}>{t('5. Badges', '5. Badge')}</div>
                <Card className="flex flex-wrap gap-3 items-center">
                    <Badge className="bg-blue-600 text-white">{t('Status: Active', 'Status: Aktif')}</Badge>
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">{t('Approved', 'Disetujui')}</Badge>
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">{t('Pending', 'Tertunda')}</Badge>
                    <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{t('Rejected', 'Ditolak')}</Badge>
                    <Badge variant="outline" className="text-slate-500">{t('Outline', 'Garis')}</Badge>
                </Card>
            </section>

            {/* ── 6. Dark Mode Preview (forced-dark) ── */}
            <section>
                <div className={sectionTitle}>{t('6. Dark Mode Preview (forced-dark)', '6. Pratinjau Mode Gelap (paksa dark)')}</div>
                <div className="dark bg-[#0b1437] rounded-3xl p-6 border border-white/10 space-y-5">
                    <SummaryRow cards={[
                        { title: t('Total Invoice', 'Total Invoice'), value: '27', icon: FileText, gradient: 'from-blue-600 to-blue-700', subtext: t('Rp 1.240.000.000', 'Rp 1.240.000.000'), valueClass: 'text-2xl' },
                        { title: t('Proforma', 'Proforma'), value: '18', icon: CheckCircle2, gradient: 'from-amber-500 to-orange-600', subtext: t('5 approved', '5 disetujui'), valueClass: 'text-2xl' },
                        { title: t('Occupancy', 'Okupansi'), value: '72%', icon: LayoutDashboard, gradient: 'from-emerald-500 to-teal-600', subtext: t('Warehouse capacity', 'Kapasitas gudang'), valueClass: 'text-2xl' },
                        { title: t('Notifications', 'Notifikasi'), value: '3', icon: Bell, gradient: 'from-blue-500 to-blue-600', subtext: t('Need action', 'Perlu tindakan'), valueClass: 'text-2xl' },
                    ]} />
                    <div className="flex flex-wrap gap-3 items-center">
                        <button className="inline-flex items-center gap-2 px-4 py-2.5 gradient-bg text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/25"><Plus size={15} /> {t('Primary', 'Primer')}</button>
                        <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors text-sm font-semibold"><Save size={15} /> {t('Outline', 'Garis')}</button>
                        <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/25"><CheckCircle2 size={15} /> {t('Success', 'Sukses')}</button>
                        <Badge className="bg-emerald-500/15 text-emerald-300">{t('Approved', 'Disetujui')}</Badge>
                        <Badge className="bg-amber-500/15 text-amber-300">{t('Pending', 'Tertunda')}</Badge>
                    </div>
                    <Input placeholder={t('Dark input…', 'Input gelap…')} />
                    <p className="text-xs text-slate-400">{t('This section forces .dark to preview contrast — same components, dark: variants.', 'Seksi ini memaksa .dark untuk memeriksa kontras — komponen sama, varian dark: yang aktif.')}</p>
                </div>
            </section>

            {/* ── 7. Modal ── */}
            <section>
                <div className={sectionTitle}>{t('7. Modal (ui/Modal)', '7. Modal (ui/Modal)')}</div>
                <Card className="flex items-center gap-3">
                    <button className={btnPrimary} onClick={() => setShowModal(true)}>
                        <Info size={15} /> {t('Open Modal', 'Buka Modal')}
                    </button>
                    <p className="text-xs text-slate-400 dark:text-white/30">{t('ESC to close • glass header + body • scroll lock', 'ESC untuk tutup • header glass + body • kunci scroll')}</p>
                </Card>
            </section>

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={t('Modal Example', 'Contoh Modal')} size="max-w-lg">
                <div className="space-y-3">
                    <p className="text-sm text-slate-600 dark:text-white/70">{t('This modal uses the centralized ui/Modal component — glass styling, ESC to close, body scroll lock. Used identically across all menus.', 'Modal ini memakai komponen ui/Modal terpusat — gaya glass, ESC untuk menutup, kunci scroll body. Dipakai identik di semua menu.')}</p>
                    <div className="flex justify-end gap-2 pt-2">
                        <button className={btnOutline} onClick={() => setShowModal(false)}>{t('Cancel', 'Batal')}</button>
                        <button className={btnPrimary} onClick={() => setShowModal(false)}><CheckCircle2 size={15} /> {t('Confirm', 'Simpan')}</button>
                    </div>
                </div>
            </Modal>

            <p className="text-center text-[11px] text-slate-400 dark:text-white/30 pt-4">
                {t('All components share one source of truth: src/components/ui/* — changes here apply everywhere.', 'Semua komponen berbagi satu sumber kebenaran: src/components/ui/* — perubahan di sini berlaku di semua tempat.')}
            </p>
        </div>
    );
}
