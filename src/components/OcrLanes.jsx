import React, { useState, useEffect, useRef } from 'react';
import { ScanLine, Activity, CheckCircle2, Clock, ChevronDown, Cpu } from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';

/**
 * OcrLanes Component
 * Menampilkan status antrean OCR dengan desain modern dan minimalis.
 * - variant="topbar"  : pill inline (di samping notifikasi di topbar), panel dropdown saat diklik
 * - variant="floating": pill mengambang (untuk mobile, di bawah header/bell)
 */
const OcrLanes = ({ variant = 'floating' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHiddenByModal, setIsHiddenByModal] = useState(false);
  const { ocrStats } = useInventoryStore();
  const wrapRef = useRef(null);
  const isTopbar = variant === 'topbar';

  useEffect(() => {
    const checkModalState = () => {
      setIsHiddenByModal(Boolean(document.querySelector('[data-app-modal="true"]')));
    };

    checkModalState();
    const observer = new MutationObserver(checkModalState);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-app-modal']
    });

    return () => observer.disconnect();
  }, []);

  // Tutup dropdown saat klik di luar / tekan Escape (khusus topbar)
  useEffect(() => {
    if (!isTopbar) return;
    const onClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setIsExpanded(false);
      }
    };
    const onEsc = (e) => { if (e.key === 'Escape') setIsExpanded(false); };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [isTopbar]);

  // Mengambil data asli dari store dan memetakannya ke 3 Lane
  const activeJobs = ocrStats?.activeJobs || [];

  const lanes = [0, 1, 2].map(index => {
    const job = activeJobs[index];
    return {
      id: index + 1,
      name: `process-ocr-lane-${index + 1}`,
      current: job ? (job.progress || 0) : 0,
      total: 100,
      status: job ? (job.status === 'active' ? 'active' : 'waiting') : 'idle',
      filename: job?.data?.originalName || job?.filename || 'Ready'
    };
  });

  const totalActive = (ocrStats?.counts?.active || 0) + (ocrStats?.counts?.waiting || 0);

  if (isHiddenByModal) return null;

  const lanesContent = (
    <div className="space-y-4">
      {lanes.map((lane) => (
        <div key={lane.id} className="group">
          <div className="flex justify-between items-center mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              {lane.status === 'active' ? (
                <Activity size={12} className="text-emerald-500 animate-pulse shrink-0" />
              ) : lane.status === 'idle' ? (
                <CheckCircle2 size={12} className="text-slate-300 dark:text-slate-600 shrink-0" />
              ) : (
                <Clock size={12} className="text-amber-400 shrink-0" />
              )}
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 transition-colors uppercase tracking-wider truncate">
                {lane.status !== 'idle' ? lane.filename : lane.name}
              </span>
            </div>
            <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 shrink-0">
              {lane.status !== 'idle' ? `${lane.current}%` : '-'}
            </span>
          </div>
          <div className="w-full bg-emerald-100/30 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden border border-emerald-100/50 dark:border-slate-700">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${lane.status === 'active' ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]' : 'bg-slate-200 dark:bg-slate-700'}`}
              style={{ width: `${lane.current}%` }}
            ></div>
          </div>
        </div>
      ))}
    </div>
  );

  /* ── VARIANT TOPBAR: pill inline + dropdown panel ── */
  if (isTopbar) {
    return (
      <div className="relative font-sans" ref={wrapRef}>
        <button
          onClick={() => setIsExpanded(o => !o)}
          className={'neo-icon-btn relative w-10 h-10 group ' + (totalActive > 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-300 hover:text-emerald-500 dark:hover:text-emerald-400')}
          title={totalActive > 0 ? `OCR Monitor — ${totalActive} proses aktif` : 'OCR Monitor'}
        >
          <ScanLine size={18} />
          {totalActive > 0 && (
            <>
              {/* Ping ring — indikator proses aktif */}
              <span className="absolute inset-0 rounded-xl bg-emerald-400/30 animate-ping pointer-events-none"></span>
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-black text-white shadow-lg border-2 border-white dark:border-slate-900">
                {totalActive > 9 ? '9+' : totalActive}
              </span>
            </>
          )}
        </button>

        {isExpanded && (
          <div className="absolute right-0 top-[calc(100%+10px)] w-72 bg-white/95 dark:bg-[#0d1440]/95 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-emerald-500/10 dark:shadow-black/40 animate-in fade-in zoom-in-95 duration-150 z-[60]">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <span className="text-xs font-black text-slate-700 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <ScanLine size={14} className="text-emerald-500" /> OCR Monitor
              </span>
              {totalActive > 0 && (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  {totalActive} aktif
                </span>
              )}
            </div>
            <div className="p-4">
              {lanesContent}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── VARIANT FLOATING: pill mengambang (mobile, di bawah header & bell) ── */
  return (
    <div className="fixed top-[140px] right-4 z-[40] font-sans pointer-events-none">
      <div
        className={`pointer-events-auto bg-white/80 dark:bg-slate-800/90 backdrop-blur-xl border border-emerald-200/40 dark:border-emerald-500/20 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] overflow-hidden ${
          isExpanded ? 'w-72' : 'w-14 h-14'
        }`}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-full flex items-center transition-all ${isExpanded ? 'p-4 justify-between' : 'p-0 h-14 justify-center'}`}
        >
          <div className={`flex items-center ${isExpanded ? 'gap-3' : 'justify-center relative'}`}>
            <div className="relative">
              <div className={`rounded-full bg-emerald-500 transition-all flex items-center justify-center ${isExpanded ? 'w-2.5 h-2.5' : 'w-10 h-10 shadow-lg shadow-emerald-500/40'}`}>
                {!isExpanded && <Cpu size={20} className="text-white" />}
              </div>
              <div className="absolute inset-0 w-full h-full rounded-full bg-emerald-500 animate-ping opacity-40"></div>
            </div>
            {isExpanded && (
              <div className="flex items-center gap-2">
                <ScanLine size={18} className="text-emerald-600" />
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">OCR Monitor</span>
              </div>
            )}
            {!isExpanded && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-black text-white shadow-lg border-2 border-white/50 dark:border-slate-900/50">
                {totalActive}
              </span>
            )}
          </div>

          {isExpanded && (
            <ChevronDown
              size={18}
              className={`text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
            />
          )}
        </button>

        <div
          className={`transition-all duration-500 ease-in-out ${
            isExpanded ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="p-4 pt-0 space-y-4">
            <div className="h-px bg-slate-200/60 dark:bg-slate-700/50 mb-4"></div>
            {lanesContent}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OcrLanes;
