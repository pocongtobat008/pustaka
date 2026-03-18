import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Blocks,
  BookOpen,
  Brain,
  Briefcase,
  Building2,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  FileCheck,
  FileDigit,
  FileSearch,
  FolderOpen,
  GitBranch,
  Grid3x3,
  LineChart,
  Rocket,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react';

const menuLandingConfig = {
  dashboard: {
    kicker: 'Command Center',
    title: 'Dashboard Eksekutif untuk Operasional Harian',
    subtitle:
      'Ringkasan performa dokumen, aktivitas tim, status OCR, dan sinyal risiko dalam satu layar agar keputusan bisa dibuat cepat dan akurat.',
    icon: Rocket,
    accent: 'from-sky-500 to-indigo-600',
    features: [
      'Snapshot KPI real-time: occupancy, status dokumen, revisi, dan tren produktivitas.',
      'AI semantic search untuk menemukan arsip lintas modul berdasarkan konteks, bukan nama file saja.',
      'Feed aktivitas yang memudahkan audit trail operasional harian.',
    ],
    functions: [
      'Mengarahkan user ke modul prioritas saat ada bottleneck proses.',
      'Menjadi titik kontrol untuk validasi status proses dokumen sebelum approval.',
      'Menyediakan insight cepat untuk koordinasi lintas divisi.',
    ],
    useCases: ['Morning briefing tim', 'Daily control room', 'Monitoring beban kerja'],
    quickActions: [
      { label: 'Buka Manajemen Rak', tab: 'inventory', icon: Grid3x3 },
      { label: 'Lihat Dokumen', tab: 'documents', icon: FileDigit },
    ],
  },
  inventory: {
    kicker: 'Archive Operations',
    title: 'Filling & Manajemen Rak Arsip Fisik',
    subtitle:
      'Kelola lokasi box, mutasi keluar-masuk, dan status ketersediaan ruang dengan visual gudang yang terstruktur dan mudah dipantau.',
    icon: Grid3x3,
    accent: 'from-emerald-500 to-teal-600',
    features: [
      'Visual slot rak untuk mengetahui posisi arsip secara presisi.',
      'Import/export data inventaris untuk sinkronisasi cepat dengan operasional lapangan.',
      'Tracking item eksternal dan histori peminjaman untuk mencegah kehilangan dokumen.',
    ],
    functions: [
      'Mengurangi waktu pencarian dokumen fisik di gudang.',
      'Mendukung kontrol kapasitas agar pemakaian ruang tetap optimal.',
      'Menyediakan data dasar untuk audit internal inventaris.',
    ],
    useCases: ['Stock opname arsip', 'Pelacakan box eksternal', 'Rekonsiliasi lokasi fisik'],
    quickActions: [
      { label: 'Ke Dokumen Digital', tab: 'documents', icon: FileSearch },
      { label: 'Pantau Approval', tab: 'approvals', icon: FileCheck },
    ],
  },
  documents: {
    kicker: 'Digital Vault',
    title: 'Pusat Dokumen Digital Terstruktur',
    subtitle:
      'Kelola folder, metadata, OCR content, versi dokumen, dan akses lintas unit dalam satu alur kerja yang aman dan scalable.',
    icon: FolderOpen,
    accent: 'from-indigo-500 to-fuchsia-600',
    features: [
      'Hierarki folder dan navigasi histori untuk pengelolaan arsip yang rapi.',
      'Preview konten OCR untuk mempercepat verifikasi isi tanpa membuka file penuh.',
      'Aksi dokumen lengkap: upload, edit, rename, delete, copy, move, hingga bulk upload.',
    ],
    functions: [
      'Menjadi sumber data utama untuk approval, compliance, dan pelaporan.',
      'Mempercepat retrieval dokumen saat ada kebutuhan audit atau klarifikasi.',
      'Meningkatkan kualitas arsip digital melalui metadata yang konsisten.',
    ],
    useCases: ['Konsolidasi dokumen tim', 'Pencarian cepat bukti transaksi', 'Persiapan audit file'],
    quickActions: [
      { label: 'Buka Approval', tab: 'approvals', icon: FileCheck },
      { label: 'Lihat Compliance', tab: 'tax-monitoring', icon: ShieldCheck },
    ],
  },
  approvals: {
    kicker: 'Governance Flow',
    title: 'Persetujuan Dokumen Berjenjang',
    subtitle:
      'Pastikan setiap dokumen melewati alur otorisasi yang benar dengan jejak persetujuan yang transparan dan dapat ditelusuri.',
    icon: FileCheck,
    accent: 'from-rose-500 to-orange-500',
    features: [
      'Workflow approval multi-level sesuai role dan departemen.',
      'Status approval yang jelas untuk meminimalkan bottleneck proses.',
      'Riwayat keputusan untuk kebutuhan governance dan audit trail.',
    ],
    functions: [
      'Menjaga kontrol kualitas dokumen sebelum dipublikasikan atau dipakai operasional.',
      'Meningkatkan akuntabilitas antar pemangku kepentingan.',
      'Mengurangi risiko human error pada keputusan penting.',
    ],
    useCases: ['Review dokumen lintas level', 'Kontrol dokumen sensitif', 'Audit keputusan'],
    quickActions: [
      { label: 'Atur SOP', tab: 'flow', icon: GitBranch },
      { label: 'Kembali ke Dokumen', tab: 'documents', icon: FileDigit },
    ],
  },
  'tax-monitoring': {
    kicker: 'Compliance Control',
    title: 'Monitoring Pemeriksaan Pajak End-to-End',
    subtitle:
      'Pantau status audit, kebutuhan dokumen pendukung, dan progres tindak lanjut agar tim compliance selalu siap menghadapi pemeriksaan.',
    icon: ShieldCheck,
    accent: 'from-amber-500 to-orange-600',
    features: [
      'Pencatatan kasus audit dan progres penyelesaian secara terpusat.',
      'Keterkaitan dokumen pendukung untuk respon pemeriksaan yang cepat.',
      'Visibilitas status tindak lanjut per PIC dan timeline.',
    ],
    functions: [
      'Meningkatkan kesiapan data saat ada permintaan dari auditor.',
      'Membantu tim mengidentifikasi area risiko kepatuhan lebih awal.',
      'Menyatukan koordinasi antara finance, tax, dan operasional.',
    ],
    useCases: ['War room pemeriksaan', 'Tracking permintaan auditor', 'Follow-up temuan'],
    quickActions: [
      { label: 'Kalkulasi Pajak', tab: 'tax-calculation', icon: Calculator },
      { label: 'Ringkasan Pajak', tab: 'tax-summary', icon: LineChart },
    ],
  },
  'tax-calculation': {
    kicker: 'Finance Engine',
    title: 'Kalkulasi Pajak yang Presisi',
    subtitle:
      'Hitung komponen pajak dengan parameter yang konsisten untuk mengurangi risiko salah hitung dan mempercepat proses pelaporan.',
    icon: Calculator,
    accent: 'from-cyan-500 to-blue-600',
    features: [
      'Perhitungan berbasis parameter terstruktur dan mudah ditinjau ulang.',
      'Format hasil yang siap dipakai untuk proses dokumentasi maupun review internal.',
      'Integrasi alur dengan modul monitoring dan summary pajak.',
    ],
    functions: [
      'Menyederhanakan proses hitung berkala untuk tim tax.',
      'Mendukung validasi data sebelum masuk ke pelaporan.',
      'Mengurangi ketergantungan pada perhitungan manual di spreadsheet terpisah.',
    ],
    useCases: ['Perhitungan periodik', 'Uji skenario tarif', 'Finalisasi basis pelaporan'],
    quickActions: [
      { label: 'Buka Monitoring Pajak', tab: 'tax-monitoring', icon: ShieldCheck },
      { label: 'Lihat Ringkasan', tab: 'tax-summary', icon: LineChart },
    ],
  },
  'tax-summary': {
    kicker: 'Reporting Hub',
    title: 'Ringkasan Kepatuhan & Pembayaran Pajak',
    subtitle:
      'Tampilkan insight kepatuhan, histori pembayaran, dan tren performa agar manajemen punya gambaran pajak yang komprehensif.',
    icon: LineChart,
    accent: 'from-violet-500 to-indigo-600',
    features: [
      'Visual ringkas untuk status pembayaran dan indikator kepatuhan.',
      'Konsolidasi data dari proses monitoring dan kalkulasi.',
      'Dukungan ekspor data untuk kebutuhan pelaporan eksternal.',
    ],
    functions: [
      'Menjadi referensi manajemen untuk evaluasi periodik.',
      'Mempercepat penyusunan laporan kepatuhan pajak.',
      'Membantu identifikasi tren agar perencanaan fiskal lebih terarah.',
    ],
    useCases: ['Review bulanan manajemen', 'Persiapan laporan compliance', 'Analisis tren pembayaran'],
    quickActions: [
      { label: 'Ke Monitoring Pajak', tab: 'tax-monitoring', icon: ShieldCheck },
      { label: 'Ke Kalkulasi Pajak', tab: 'tax-calculation', icon: Calculator },
    ],
  },
  master: {
    kicker: 'System Foundation',
    title: 'Master Data & Konfigurasi Inti',
    subtitle:
      'Kelola role, user, departemen, dan struktur proses agar seluruh modul berjalan sesuai governance organisasi.',
    icon: Users,
    accent: 'from-slate-600 to-indigo-600',
    features: [
      'Manajemen user, role, dan permission berbasis kebutuhan bisnis.',
      'Pengaturan master departemen untuk konsistensi data lintas modul.',
      'Kontrol konfigurasi flow yang memengaruhi alur kerja sistem.',
    ],
    functions: [
      'Menjaga keamanan akses berdasarkan prinsip least privilege.',
      'Membentuk fondasi data agar proses tetap stabil saat tim bertambah.',
      'Memudahkan administrasi sistem tanpa intervensi teknis berlebih.',
    ],
    useCases: ['Onboarding user baru', 'Penyesuaian akses', 'Pembaruan struktur organisasi'],
    quickActions: [
      { label: 'Kelola SOP', tab: 'flow', icon: GitBranch },
      { label: 'Lihat Approval', tab: 'approvals', icon: FileCheck },
    ],
  },
  pustaka: {
    kicker: 'Knowledge Center',
    title: 'Manual Book & Pusat Pengetahuan Tim',
    subtitle:
      'Dokumentasi panduan kerja, best practice, dan referensi operasional dalam format yang mudah dibaca, dicari, dan dibagikan.',
    icon: BookOpen,
    accent: 'from-blue-500 to-cyan-500',
    features: [
      'Koleksi materi pembelajaran dan panduan SOP dalam satu tempat.',
      'Akses cepat untuk transfer knowledge antar tim dan lintas periode.',
      'Sinkronisasi konten dengan dokumentasi proses kerja aktual.',
    ],
    functions: [
      'Menurunkan risiko knowledge loss saat rotasi personel.',
      'Mempercepat onboarding anggota tim baru.',
      'Menjaga standar kualitas kerja tetap seragam.',
    ],
    useCases: ['Onboarding tim', 'Self-learning operasional', 'Standarisasi cara kerja'],
    quickActions: [
      { label: 'Lihat SOP', tab: 'flow', icon: GitBranch },
      { label: 'Buka Dashboard', tab: 'dashboard', icon: Blocks },
    ],
  },
  flow: {
    kicker: 'Process Design',
    title: 'SOP Flow yang Visual dan Adaptif',
    subtitle:
      'Rancang, kelola, dan komunikasikan alur proses kerja secara visual agar eksekusi tim konsisten, cepat, dan mudah diaudit.',
    icon: GitBranch,
    accent: 'from-fuchsia-500 to-pink-600',
    features: [
      'Representasi alur SOP dalam format visual yang mudah dipahami semua role.',
      'Standarisasi langkah kerja untuk menekan variasi proses yang tidak perlu.',
      'Dokumentasi perubahan alur sebagai referensi perbaikan berkelanjutan.',
    ],
    functions: [
      'Menyelaraskan ekspektasi antar tim pada proses kritikal.',
      'Mempercepat troubleshooting karena jalur kerja terlihat jelas.',
      'Mendukung kepatuhan terhadap prosedur operasional perusahaan.',
    ],
    useCases: ['Desain alur baru', 'Optimasi proses lama', 'Sosialisasi SOP antar unit'],
    quickActions: [
      { label: 'Buka Master Data', tab: 'master', icon: Users },
      { label: 'Ke Manual Book', tab: 'pustaka', icon: BookOpen },
    ],
  },
  'job-due-date': {
    kicker: 'Execution Tracker',
    title: 'Monitoring Job & Due Date Harian',
    subtitle:
      'Pantau pekerjaan aktif, tenggat waktu, dan prioritas eksekusi agar tim bergerak fokus pada task yang paling berdampak.',
    icon: ClipboardCheck,
    accent: 'from-lime-500 to-emerald-600',
    features: [
      'Daftar pekerjaan prioritas dengan visibilitas status yang jelas.',
      'Pemantauan due date untuk mencegah keterlambatan deliverable.',
      'Tracking issue kerja untuk eskalasi dan penyelesaian lebih cepat.',
    ],
    functions: [
      'Membantu manajer memonitor kapasitas dan beban tim.',
      'Menjadi pengingat eksekusi agar target harian tercapai.',
      'Meningkatkan ketepatan waktu melalui alarm prioritas operasional.',
    ],
    useCases: ['Daily standup', 'Kontrol SLA internal', 'Eskalasi task kritikal'],
    quickActions: [
      { label: 'Kembali ke Dashboard', tab: 'dashboard', icon: Rocket },
      { label: 'Lihat Approval', tab: 'approvals', icon: CheckCircle2 },
    ],
  },
};

const manualAdvantageMap = {
  dashboard: [
    'Tanpa dashboard, tim perlu gabung data dari banyak sumber secara manual dan rawan telat.',
    'Pemantauan KPI menjadi real-time sehingga keputusan tidak menunggu rekap harian.',
    'Deteksi bottleneck lebih cepat dibanding memeriksa laporan satu per satu.',
  ],
  inventory: [
    'Pencarian box tidak lagi mengandalkan ingatan personal atau catatan kertas.',
    'Mutasi keluar-masuk tercatat otomatis, tidak mudah hilang seperti log manual.',
    'Kontrol kapasitas rak jadi presisi, bukan estimasi kasar lapangan.',
  ],
  documents: [
    'Dokumen tidak tercecer di folder lokal atau chat yang sulit ditelusuri.',
    'OCR dan metadata mempercepat pencarian isi dibanding buka file satu per satu.',
    'Riwayat dan struktur folder konsisten, tidak bergantung naming manual per user.',
  ],
  approvals: [
    'Alur persetujuan lebih terkontrol dibanding tanda tangan atau chat informal.',
    'Jejak keputusan terdokumentasi rapi untuk audit, bukan rekonstruksi manual.',
    'Status approval transparan sehingga follow-up tidak perlu tanya berulang.',
  ],
  'tax-monitoring': [
    'Kasus audit tidak tercecer di spreadsheet terpisah antar PIC.',
    'Dokumen pendukung langsung terhubung ke kasus, bukan dicari ulang saat diminta auditor.',
    'Timeline tindak lanjut lebih akurat daripada update manual via pesan.',
  ],
  'tax-calculation': [
    'Risiko salah hitung berkurang dibanding formula spreadsheet yang berubah-ubah.',
    'Parameter perhitungan lebih konsisten untuk tiap periode pelaporan.',
    'Review hasil jadi lebih cepat karena format output sudah terstandar.',
  ],
  'tax-summary': [
    'Ringkasan kepatuhan langsung tersedia tanpa kompilasi laporan manual berjam-jam.',
    'Manajemen dapat melihat tren periodik tanpa menunggu rekap tim.',
    'Analisis lebih akurat karena data terkonsolidasi dari proses operasional.',
  ],
  master: [
    'Kontrol akses tidak lagi dikelola manual per permintaan ad-hoc.',
    'Struktur user dan departemen tetap konsisten saat organisasi berubah.',
    'Administrasi sistem lebih cepat tanpa editing data berulang di banyak tempat.',
  ],
  pustaka: [
    'Knowledge tidak hilang saat personel berganti karena semua terdokumentasi terpusat.',
    'Tim baru belajar lebih cepat dibanding onboarding lisan yang tidak standar.',
    'Panduan selalu mudah dicari, tidak tersebar di file pribadi.',
  ],
  flow: [
    'SOP visual lebih mudah dipahami daripada deskripsi teks panjang yang ambigu.',
    'Perubahan proses bisa disosialisasikan cepat tanpa revisi dokumen manual berulang.',
    'Ketidaksesuaian eksekusi berkurang karena jalur kerja terlihat jelas.',
  ],
  'job-due-date': [
    'Prioritas kerja tidak lagi bergantung reminder personal yang sering terlewat.',
    'Due date terpantau terpusat, bukan tersebar di catatan masing-masing.',
    'Eskalasi issue lebih cepat dengan status yang terlihat real-time.',
  ],
};

export default function MenuLandingSection({
  activeTab,
  setActiveTab,
  onOpenVision,
  isOpen,
  onClose,
  language = 'id',
}) {
  const isEnglish = language === 'en';
  const config = menuLandingConfig[activeTab];
  const manualAdvantages = manualAdvantageMap[activeTab] || [];

  const uiText = isEnglish
    ? {
        close: 'Close',
        mainFeatures: 'Core Features',
        businessFunctions: 'Business Functions',
        useCases: 'Use Cases',
        quickNavigation: 'Quick Navigation',
        platformVision: 'View Platform Vision',
        advantages: 'Advantages vs Manual Process',
        goTo: 'Go to',
      }
    : {
        close: 'Tutup',
        mainFeatures: 'Fitur Utama',
        businessFunctions: 'Fungsi Bisnis',
        useCases: 'Use Cases',
        quickNavigation: 'Quick Navigation',
        platformVision: 'Lihat Visi Platform',
        advantages: 'Kelebihan Dibanding Manual',
        goTo: 'Ke',
      };

  const tabLabelMap = isEnglish
    ? {
        dashboard: 'Dashboard',
        inventory: 'Inventory',
        documents: 'Documents',
        approvals: 'Approvals',
        'tax-monitoring': 'Tax Monitoring',
        'tax-calculation': 'Tax Calculation',
        'tax-summary': 'Tax Summary',
        master: 'Master Data',
        pustaka: 'Manual Book',
        flow: 'SOP Flow',
        'job-due-date': 'My Job',
      }
    : {
        dashboard: 'Dashboard',
        inventory: 'Manajemen Rak',
        documents: 'Dokumen Digital',
        approvals: 'Approval',
        'tax-monitoring': 'Monitoring Pajak',
        'tax-calculation': 'Kalkulasi Pajak',
        'tax-summary': 'Ringkasan Pajak',
        master: 'Master Data',
        pustaka: 'Manual Book',
        flow: 'SOP Flow',
        'job-due-date': 'My Job',
      };

  const englishHeadlineMap = {
    dashboard: {
      title: 'Executive Dashboard for Daily Operations',
      subtitle: 'A consolidated view of document performance, team activity, OCR status, and risk signals so decisions can be made quickly and accurately.',
    },
    inventory: {
      title: 'Filing and Physical Archive Rack Management',
      subtitle: 'Manage box locations, inbound-outbound transfers, and storage availability with a structured warehouse view that is easy to monitor.',
    },
    documents: {
      title: 'Structured Digital Document Center',
      subtitle: 'Manage folders, metadata, OCR content, document versions, and cross-unit access in a secure and scalable workflow.',
    },
    approvals: {
      title: 'Multi-level Document Approval',
      subtitle: 'Ensure every document follows the proper authorization flow with transparent and traceable approval history.',
    },
    'tax-monitoring': {
      title: 'End-to-End Tax Audit Monitoring',
      subtitle: 'Track audit status, supporting document requirements, and follow-up progress so compliance teams stay inspection-ready.',
    },
    'tax-calculation': {
      title: 'Accurate Tax Calculation',
      subtitle: 'Calculate tax components with consistent parameters to reduce errors and speed up reporting cycles.',
    },
    'tax-summary': {
      title: 'Tax Compliance and Payment Summary',
      subtitle: 'Show compliance insights, payment history, and trend performance so management gets a comprehensive tax view.',
    },
    master: {
      title: 'Master Data and Core Configuration',
      subtitle: 'Manage roles, users, departments, and process structure so all modules run in line with organizational governance.',
    },
    pustaka: {
      title: 'Manual Book and Team Knowledge Hub',
      subtitle: 'Store work guides, best practices, and operational references in a format that is easy to read, search, and share.',
    },
    flow: {
      title: 'Visual and Adaptive SOP Flow',
      subtitle: 'Design, manage, and communicate work processes visually so team execution is consistent, fast, and auditable.',
    },
    'job-due-date': {
      title: 'Daily Job and Due Date Monitoring',
      subtitle: 'Track active work, deadlines, and execution priorities so teams stay focused on the highest-impact tasks.',
    },
  };

  const displayTitle = isEnglish ? (englishHeadlineMap[activeTab]?.title || config.title) : config.title;
  const displaySubtitle = isEnglish ? (englishHeadlineMap[activeTab]?.subtitle || config.subtitle) : config.subtitle;

  if (!config || !isOpen) return null;

  const ActiveIcon = config.icon || Brain;

  return (
    <motion.div
      key={`menu-landing-${activeTab}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[1200] bg-slate-950/45 backdrop-blur-md p-4 md:p-8 overflow-y-auto"
      onClick={onClose}
    >
      <motion.section
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-[2.2rem] border border-white/30 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl p-6 md:p-8 max-w-6xl mx-auto shadow-2xl shadow-slate-900/20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full blur-3xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
        <div className={`absolute -bottom-16 -left-10 w-64 h-64 rounded-full blur-3xl bg-gradient-to-r ${config.accent} opacity-20 pointer-events-none`} />

        <div className="relative z-10 space-y-6">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              <X size={14} />
              {uiText.close}
            </button>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 text-white text-[11px] uppercase tracking-[0.18em] font-extrabold mb-3">
                <Sparkles size={12} />
                {config.kicker}
              </div>
              <h2 className="text-2xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white leading-tight mb-3">
                {displayTitle}
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                {displaySubtitle}
              </p>
            </div>

            <div className={`self-start inline-flex items-center justify-center w-16 h-16 rounded-2xl text-white bg-gradient-to-br ${config.accent} shadow-lg`}>
              <ActiveIcon size={28} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white/80 dark:bg-slate-950/50 p-5">
              <h3 className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 font-bold mb-3">{uiText.mainFeatures}</h3>
              <ul className="space-y-2">
                {config.features.map((item) => (
                  <li key={item} className="text-sm text-slate-700 dark:text-slate-200 flex gap-2 leading-relaxed">
                    <CheckCircle2 size={16} className="mt-0.5 text-emerald-500 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white/80 dark:bg-slate-950/50 p-5">
              <h3 className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 font-bold mb-3">{uiText.businessFunctions}</h3>
              <ul className="space-y-2">
                {config.functions.map((item) => (
                  <li key={item} className="text-sm text-slate-700 dark:text-slate-200 flex gap-2 leading-relaxed">
                    <Building2 size={16} className="mt-0.5 text-indigo-500 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white/80 dark:bg-slate-950/50 p-5">
              <h3 className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 font-bold mb-3">{uiText.useCases}</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {config.useCases.map((item) => (
                  <span key={item} className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200">
                    {item}
                  </span>
                ))}
              </div>

              <h4 className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 font-bold mb-2">{uiText.quickNavigation}</h4>
              <div className="space-y-2">
                {config.quickActions.map((action) => {
                  const ActionIcon = action.icon || Briefcase;
                  return (
                    <button
                      key={action.tab}
                      type="button"
                      onClick={() => {
                        setActiveTab(action.tab);
                        onClose();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-900 text-white hover:opacity-90 transition-opacity"
                    >
                      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
                        <ActionIcon size={14} />
                        {`${uiText.goTo} ${tabLabelMap[action.tab] || action.tab}`}
                      </span>
                      <ArrowRight size={14} />
                    </button>
                  );
                })}
                {activeTab === 'dashboard' && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenVision();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-indigo-300 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                  >
                    <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
                      <Rocket size={14} />
                      {uiText.platformVision}
                    </span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200/70 dark:border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-500/10 p-5">
            <h3 className="text-xs uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300 font-bold mb-3">
              {uiText.advantages}
            </h3>
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {manualAdvantages.map((item) => (
                <li key={item} className="rounded-xl bg-white/80 dark:bg-slate-900/60 border border-emerald-200/70 dark:border-emerald-500/30 p-3 text-sm text-slate-700 dark:text-slate-200 leading-relaxed flex gap-2">
                  <Zap size={16} className="mt-0.5 text-emerald-500 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}
