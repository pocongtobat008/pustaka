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
        const interval = setInterval(fetchQueue, 5000); // Polling every 5s (reduced from 3s)
        return () => clearInterval(interval);
    }, []);

    if (loading && !queue.total) {
        return (
            <div className="flex flex-col items-center justify-center p-6 text-stone-500">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500 mb-2" />
                <span className="text-xs font-bold">Memuat Antrian OCR...</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <h2 className="text-base font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-600 dark:from-blue-400 dark:to-blue-400 flex items-center gap-2">
                    <ScanLine className="text-blue-500" size={16} /> Antrian OCR
                </h2>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                    <Layers size={12} />
                    {queue.total} Dokumen
                </div>
            </div>

            {error ? (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg border border-red-100 dark:border-red-900/30 mb-3">
                    <AlertCircle size={14} />
                    <p className="text-[11px] font-bold">{error}</p>
                </div>
            ) : null}

            <div className="flex-1 space-y-2.5 overflow-y-auto custom-scrollbar">
                {/* ACTIVE JOBS */}
                {queue.active.map(job => (
                    <div key={job.id} className="p-3 bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-blue-600 rounded-md text-white shadow-md shadow-blue-500/20">
                                    <Loader2 size={12} className="animate-spin" />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-xs font-black text-blue-900 dark:text-blue-200 truncate leading-tight">
                                        {job.data.originalName || 'Memproses Dokumen...'}
                                    </h4>
                                </div>
                            </div>
                            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-white dark:bg-blue-900/50 px-1.5 py-0.5 rounded-md">
                                {job.progress}%
                            </span>
                        </div>
                        <div className="w-full bg-blue-100 dark:bg-blue-950 h-1 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-blue-500 to-blue-500 h-full transition-all duration-500"
                                style={{ width: `${job.progress}%` }}
                            ></div>
                        </div>
                    </div>
                ))}

                {/* WAITING JOBS */}
                {queue.waiting.map((job, idx) => (
                    <div key={job.id} className="flex items-center gap-3 p-3 border border-transparent hover:border-stone-100 dark:hover:border-white/5 transition-all">
                        <div className="w-8 h-8 rounded-md bg-stone-100 dark:bg-white/5 flex items-center justify-center text-stone-400 hover:text-blue-500 transition-colors font-black text-[10px]">
                            {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-bold text-stone-700 dark:text-white/80 truncate hover:text-blue-600 transition-colors">
                                {job.data.originalName}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <Clock size={10} className="text-stone-400" />
                                <span className="text-[9px] font-medium text-stone-400 uppercase tracking-wider">Menunggu</span>
                            </div>
                        </div>
                        <div className="p-1.5 rounded-md bg-stone-50 dark:bg-white/5 opacity-0 group-hover:opacity-100 hover:opacity-100 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
                            <CheckCircle2 size={14} className="text-blue-500/50" />
                        </div>
                    </div>
                ))}

                {queue.total === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                        <div className="p-3 bg-stone-50 dark:bg-white/5 rounded-lg mb-2 text-stone-300">
                            <CheckCircle2 size={24} />
                        </div>
                        <p className="text-sm font-bold text-stone-600 dark:text-white/40">Semua Beres!</p>
                        <p className="text-[10px] text-stone-400 mt-0.5 uppercase tracking-widest font-medium">Tidak ada antrian OCR aktif</p>
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(29, 78, 216, 0.1);
                    border-radius: 2px;
                }
                .custom-scrollbar:hover::-webkit-scrollbar-thumb {
                    background: rgba(29, 78, 216, 0.3);
                }
            ` }} />
        </div>
    );
}
