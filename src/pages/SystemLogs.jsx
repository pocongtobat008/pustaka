import React, { useState, useEffect } from 'react';
import { Terminal, RefreshCw, AlertCircle, FileWarning, Search, Download, Trash2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { systemService } from '../services/systemService';

export default function SystemLogs({ isDarkMode }) {
    const [logType, setLogType] = useState('error'); // 'error' | 'ocr'
    const [rawContent, setRawContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const data = await systemService.getFileLogs(logType);
            setRawContent(data.content || '');
        } catch (err) {
            setRawContent("Gagal memuat log: " + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchLogs(); }, [logType]);

    const filteredLogs = rawContent.split('\n')
        .filter(line => line.trim() !== '')
        .filter(line => line.toLowerCase().includes(searchTerm.toLowerCase()))
        .reverse(); // Terbaru di atas

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                        onClick={() => setLogType('error')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${logType === 'error' ? 'bg-white dark:bg-slate-700 text-red-600 shadow-sm' : 'text-gray-500'}`}
                    >
                        <AlertCircle size={16} /> System Errors
                    </button>
                    <button
                        onClick={() => setLogType('ocr')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${logType === 'ocr' ? 'bg-white dark:bg-slate-700 text-amber-600 shadow-sm' : 'text-gray-500'}`}
                    >
                        <FileWarning size={16} /> OCR Failures
                    </button>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Cari di dalam log..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <button onClick={fetchLogs} className="p-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50">
                        <RefreshCw size={20} className={`text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <Card className="p-0 overflow-hidden border-0 shadow-2xl">
                <div className="bg-slate-900 p-4 flex items-center justify-between border-b border-white/10">
                    <div className="flex items-center gap-2">
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                        </div>
                        <span className="ml-4 text-xs font-mono text-slate-400 flex items-center gap-2">
                            <Terminal size={14} /> {logType === 'error' ? 'error.log' : 'ocr-failures.log'} — {filteredLogs.length} entries
                        </span>
                    </div>
                </div>
                <div className="bg-[#0d1117] p-6 font-mono text-sm h-[60vh] overflow-y-auto custom-scrollbar">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full text-slate-500">Memuat data log...</div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-slate-600 italic">Tidak ada log yang ditemukan.</div>
                    ) : (
                        <div className="space-y-1">
                            {filteredLogs.map((line, i) => {
                                let color = "text-slate-300";
                                if (line.includes('"level":"error"')) color = "text-red-400";
                                if (line.includes('"level":"warn"')) color = "text-amber-400";
                                
                                return (
                                    <div key={i} className={`${color} hover:bg-white/5 py-0.5 px-2 rounded transition-colors break-all`}>
                                        <span className="opacity-30 mr-3 select-none">{filteredLogs.length - i}</span>
                                        {line}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </Card>
            <p className="text-[10px] text-center text-slate-500 uppercase tracking-widest font-bold">
                Log ini dihasilkan secara otomatis oleh Winston Logger & Morgan HTTP Middleware
            </p>
        </div>
    );
}