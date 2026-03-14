import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, ChevronUp, ChevronDown, Loader2, FileText, Clock } from 'lucide-react';
import { getSocket } from '../services/socketService';

const OCRProcessingLanes = () => {
    const [ocrJobs, setOcrJobs] = useState([]);
    const [isCollapsed, setIsCollapsed] = useState(true); // Default: Collapsed

    const fetchOcrStatus = async () => {
        try {
            const res = await fetch('/api/ocr/status', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                // Validasi agar tidak error jika data atau activeJobs null/bukan array
                const jobsArray = Array.isArray(data) ? data : (Array.isArray(data?.activeJobs) ? data.activeJobs : []);
                const active = jobsArray.filter(j => j.status === 'queued' || j.status === 'processing');
                setOcrJobs(active);
            }
        } catch (err) {
            console.error("Gagal mengambil status OCR:", err);
        }
    };

    useEffect(() => {
        fetchOcrStatus();
        const socket = getSocket();
        
        const onUpdate = (payload) => {
            if (payload.channel === 'ocr' || payload.type === 'ocr') {
                fetchOcrStatus();
            }
        };

        socket.on('data:changed', onUpdate);
        socket.on('ocr:status', fetchOcrStatus);

        // Polling setiap 10 detik sebagai cadangan jika socket terputus
        const interval = setInterval(fetchOcrStatus, 10000);

        return () => {
            socket.off('data:changed', onUpdate);
            socket.off('ocr:status', fetchOcrStatus);
            clearInterval(interval);
        };
    }, []);

    // Sembunyikan jika tidak ada proses aktif
    if (ocrJobs.length === 0) return null;

    return (
        <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 right-8 z-[999] w-80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-2xl shadow-indigo-500/10 overflow-hidden"
        >
            {/* Header - Klik untuk Toggle */}
            <div 
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-600/20">
                        <Cpu size={20} className={ocrJobs.some(j => j.status === 'processing') ? "animate-pulse" : ""} />
                    </div>
                    <div>
                        <h4 className="text-[10px] font-black dark:text-white uppercase tracking-widest">OCR Engine</h4>
                        <p className="text-[9px] text-indigo-500 font-black uppercase tracking-tighter">
                            {ocrJobs.length} File Aktif
                        </p>
                    </div>
                </div>
                <div className="p-2 bg-slate-100 dark:bg-white/5 rounded-xl text-slate-400">
                    {isCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
            </div>

            {/* List Proses */}
            <AnimatePresence>
                {!isCollapsed && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-slate-100 dark:border-white/5"
                    >
                        <div className="p-5 space-y-4 max-h-72 overflow-y-auto custom-scrollbar">
                            {ocrJobs.map((job) => (
                                <div key={job.id} className="space-y-2 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-transparent hover:border-indigo-500/20 transition-all">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <FileText size={14} className="text-slate-400 shrink-0" />
                                            <span className="text-[10px] font-bold dark:text-white truncate">{job.filename}</span>
                                        </div>
                                        <span className="text-[10px] font-black text-indigo-600">{job.progress || 0}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${job.progress || 0}%` }}
                                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-600"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {job.status === 'processing' ? (
                                            <Loader2 size={10} className="text-indigo-500 animate-spin" />
                                        ) : (
                                            <Clock size={10} className="text-slate-400" />
                                        )}
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                            {job.status === 'processing' ? 'Mengekstrak Teks...' : 'Menunggu Antrean'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default OCRProcessingLanes;