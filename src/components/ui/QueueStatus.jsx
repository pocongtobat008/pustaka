import React, { useState, useEffect } from 'react';
import { Loader2, Clock, CheckCircle2, AlertCircle, ScanLine, Layers } from 'lucide-react';

export default function QueueStatus() {
    const [queue, setQueue] = useState({ active: [], waiting: [], total: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchQueue = async () => {
        try {
            const API_URL = window.location.protocol === 'file:' ? 'http://localhost:5005/api' : '/api';
            const res = await fetch(`${API_URL}/ocr/queue`, {
                credentials: 'include'
            });
            if (res.status === 401) {
                console.warn("QueueStatus: 401 Unauthorized - trigger reload");
                window.location.reload();
                return;
            }
            if (!res.ok) throw new Error('Gagal mengambil data antrian');
            const data = await res.json();
            setQueue(data);
            setError(null);
        } catch (err) {
            console.error("Queue fetch error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQueue();
        const interval = setInterval(fetchQueue, 3000); // Polling every 3s
        return () => clearInterval(interval);
    }, []);

    if (loading && !queue.total) {
        return (
            <div className="flex items-center justify-center p-8 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-3xl border border-white/20 shadow-xl">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mr-3" />
                <span className="text-sm font-bold text-slate-500">Memuat Antrian OCR...</span>
            </div>
        );
    }

    return (
        <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-6 rounded-[2rem] border border-white/20 shadow-xl shadow-indigo-500/5 relative overflow-hidden group h-full">
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-all duration-700 pointer-events-none"></div>

            <div className="flex items-center justify-between mb-6 relative z-10">
                <h2 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 flex items-center gap-2">
                    <ScanLine className="text-indigo-500" /> Antrian OCR
                </h2>
                <div className="flex items-center gap-2 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                    <Layers size={14} />
                    {queue.total} Dokumen
                </div>
            </div>

            {error ? (
                <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl border border-red-100 dark:border-red-900/30 mb-4 animate-in fade-in duration-300">
                    <AlertCircle size={18} />
                    <p className="text-xs font-bold">{error}</p>
                </div>
            ) : null}

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar relative z-10">
                {/* ACTIVE JOBS */}
                {queue.active.map(job => (
                    <div key={job.id} className="p-4 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 animate-pulse-slow">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-500/20">
                                    <Loader2 size={16} className="animate-spin" />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-sm font-black text-indigo-900 dark:text-indigo-200 truncate leading-tight">
                                        {job.data.originalName || 'Memproses Dokumen...'}
                                    </h4>
                                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Sedang Diproses</span>
                                </div>
                            </div>
                            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-white dark:bg-indigo-900/50 px-2 py-1 rounded-lg">
                                {job.progress}%
                            </span>
                        </div>
                        <div className="w-full bg-indigo-100 dark:bg-indigo-950 rounded-full h-1.5 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                                style={{ width: `${job.progress}%` }}
                            ></div>
                        </div>
                    </div>
                ))}

                {/* WAITING JOBS */}
                {queue.waiting.map((job, idx) => (
                    <div key={job.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-2xl transition-all group/item border border-transparent hover:border-slate-100 dark:hover:border-slate-800">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover/item:bg-indigo-50 dark:group-hover/item:bg-indigo-900/30 group-hover/item:text-indigo-500 transition-all font-black text-xs">
                            {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate group-hover/item:text-indigo-600 transition-colors">
                                {job.data.originalName}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5">
                                <Clock size={12} className="text-slate-400" />
                                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Menunggu Antrian</span>
                            </div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 group-hover/item:bg-indigo-50 dark:group-hover/item:bg-indigo-900/30 transition-all opacity-0 group-hover/item:opacity-100 scale-90 group-hover/item:scale-100">
                            <CheckCircle2 size={16} className="text-indigo-500/50" />
                        </div>
                    </div>
                ))}

                {queue.total === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-full mb-4 text-slate-300">
                            <CheckCircle2 size={40} />
                        </div>
                        <h4 className="text-sm font-bold text-slate-600 dark:text-slate-400">Semua Beres!</h4>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-medium">Tidak ada antrian OCR aktif</p>
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .animate-pulse-slow {
                    animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.8; }
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(99, 102, 241, 0.1);
                    border-radius: 10px;
                }
                .custom-scrollbar:hover::-webkit-scrollbar-thumb {
                    background: rgba(99, 102, 241, 0.3);
                }
            ` }} />
        </div>
    );
}
