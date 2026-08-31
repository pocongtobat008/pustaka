import React from 'react';

// ── PageHeader — satu sumber kebenaran untuk header halaman (ikon + judul + subjudul) ──
// Dipakai di SEMUA halaman agar identik. Topbar App menampilkan breadcrumb + judul;
// header ini menambah identitas halaman (ikon gradien + deskripsi + aksi opsional).
// Props:
//   icon       : komponen lucide (wajib)
//   iconClass  : gradient ikon, default 'from-blue-500 to-purple-600'
//   title      : judul halaman
//   subtitle   : deskripsi singkat (node/string, opsional)
//   meta       : node tambahan di bawah subtitle (mis. badge status), opsional
//   actions    : node di kanan (tombol aksi), opsional
//   className  : tambahan pada container
export const PageHeader = ({ icon: Icon, iconClass, title, subtitle, meta, actions, className = '' }) => (
    <div className={`mb-6 flex items-start gap-3.5 ${className}`}>
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20 bg-gradient-to-br ${iconClass || 'from-blue-500 to-purple-600'}`}>
            {Icon && <Icon size={20} className="text-white" />}
        </div>
        <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black tracking-tight text-slate-800 dark:text-white leading-tight">{title}</h1>
            {subtitle && <p className="text-xs mt-0.5 text-slate-500 dark:text-white/50 leading-relaxed">{subtitle}</p>}
            {meta && <div className="mt-1.5">{meta}</div>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
);

export default PageHeader;
