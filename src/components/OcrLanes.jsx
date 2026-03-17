import React, { useState, useEffect } from 'react';
import { ScanLine, Activity, CheckCircle2, Clock, ChevronDown, Cpu } from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';

/**
 * OcrLanes Component
 * Menampilkan status antrean OCR dengan desain modern dan minimalis.
 */
const OcrLanes = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHiddenByModal, setIsHiddenByModal] = useState(false);
  const { ocrStats } = useInventoryStore();

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

  // Mengambil data asli dari store dan memetakannya ke 3 Lane
  const activeJobs = ocrStats?.activeJobs || [];
  
  const lanes = [0, 1, 2].map(index => {
    const job = activeJobs[index];
    return {
      id: index + 1,
      name: `process-ocr-lane-${index + 1}`,
      // Jika ada job, gunakan progress asli (0-100), jika tidak ada set ke 0
      current: job ? (job.progress || 0) : 0,
      total: 100,
      // Status visual berdasarkan keberadaan job
      status: job ? (job.status === 'active' ? 'active' : 'waiting') : 'idle',
      // Nama file untuk ditampilkan saat di-expand
      filename: job?.data?.originalName || job?.filename || 'Ready'
    };
  });

  // Total dokumen yang sedang diproses atau menunggu
  const totalActive = (ocrStats?.counts?.active || 0) + (ocrStats?.counts?.waiting || 0);

  if (isHiddenByModal) return null;

  return (
    <div className="fixed top-4 right-4 z-[40] font-sans pointer-events-none">
      <div 
        className={`pointer-events-auto bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl border border-emerald-200/40 dark:border-emerald-500/20 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] overflow-hidden ${
          isExpanded ? 'w-72' : 'w-14 h-14'
        }`}
      >
        {/* Header / Toggle Area */}
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

        {/* Collapsible Content */}
        <div 
          className={`transition-all duration-500 ease-in-out ${
            isExpanded ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="p-4 pt-0 space-y-4">
            <div className="h-px bg-slate-200/60 dark:bg-slate-700/50 mb-4"></div>
            
            {lanes.map((lane) => (
              <div key={lane.id} className="group">
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-2">
                    {lane.status === 'active' ? (
                      <Activity size={12} className="text-emerald-500 animate-pulse" />
                    ) : lane.status === 'idle' ? (
                      <CheckCircle2 size={12} className="text-slate-300 dark:text-slate-600" />
                    ) : (
                      <Clock size={12} className="text-amber-400" />
                    )}
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 transition-colors uppercase tracking-wider">
                      {lane.status !== 'idle' ? lane.filename : lane.name}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
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
        </div>
      </div>
    </div>
  );
};

export default OcrLanes;