import React from 'react';
import { motion } from 'framer-motion';
import { Activity, RefreshCw } from 'lucide-react';

export default function OcrQueueModal({ ocrStats, API_BASE, toast }) {
  return (
    <div className="space-y-6 pt-4 px-1 pb-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800">
          <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Aktif</p>
          <p className="text-2xl font-black text-blue-800 dark:text-white">{ocrStats?.counts?.active || 0}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-800">
          <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">Menunggu</p>
          <p className="text-2xl font-black text-amber-800 dark:text-white">{ocrStats?.counts?.waiting || 0}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800">
          <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Selesai</p>
          <p className="text-2xl font-black text-emerald-800 dark:text-white">{ocrStats?.counts?.completed || 0}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl border border-red-100 dark:border-red-800">
          <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest mb-1">Gagal</p>
          <p className="text-2xl font-black text-red-800 dark:text-white">{ocrStats?.counts?.failed || 0}</p>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Activity size={16} /> Pekerjaan Saat Ini
        </h4>
        <div className="space-y-3">
          {(ocrStats?.activeJobs || []).length === 0 ? (
            <div className="text-center py-8 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
              <p className="text-slate-400 font-bold">Tidak ada pekerjaan yang sedang berjalan.</p>
            </div>
          ) : (
            ocrStats.activeJobs.map(job => (
              <div key={job.id} className="bg-white dark:bg-slate-800 p-4 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-800 dark:text-white truncate">{job.filename}</p>
                    <p className="text-[10px] text-slate-400 font-black uppercase mt-0.5">Job ID: {job.id}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{job.progress || 0}%</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-full h-3 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${job.progress || 0}%` }}
                    className="bg-indigo-600 h-full rounded-full"
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
        <button
          onClick={async () => {
            if (window.confirm("Yakin ingin mereset antrian?")) {
              try {
                await fetch(`${API_BASE}/ocr/reset`, {
                  method: 'POST',
                  credentials: 'include'
                });
                toast.success('Antrian direset.');
              } catch (e) { toast.error(e.message); }
            }
          }}
          className="flex items-center gap-2 px-6 py-3 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-colors"
        >
          <RefreshCw size={14} /> Reset Antrian Macet
        </button>
      </div>
    </div>
  );
}