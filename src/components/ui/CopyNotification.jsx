import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export default function CopyNotification({ label }) {
  if (!label) return null;
  return (
    <div className="fixed bottom-10 right-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-emerald-500/50 p-4 rounded-[2rem] shadow-2xl z-[200] animate-in slide-in-from-bottom-8 flex items-center gap-4 ring-8 ring-emerald-500/5">
      <div className="p-3 bg-emerald-500 rounded-2xl text-white shadow-lg shadow-emerald-500/30 animate-bounce">
        <CheckCircle2 size={18} />
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-0.5">Copied to Clipboard</span>
        <span className="font-bold text-slate-800 dark:text-white text-sm">Berhasil menyalin {label}</span>
      </div>
    </div>
  );
}