import React, { useState, useEffect } from 'react';
import { Terminal, RefreshCw, AlertCircle, AlertTriangle, FileWarning, Search, Download, Trash2 } from 'lucide-react';
import { Card, SummaryRow } from '../components/ui/Card';
import { systemService } from '../services/systemService';
import { useLanguage } from '../contexts/LanguageContext';

export default function SystemLogs({ isDarkMode }) {
    const { language } = useLanguage();
    const isEnglish = language === 'en';
    const text = isEnglish
        ? {
            loadFailed: 'Failed to load logs: ',
            systemErrors: 'System Errors',
            ocrFailures: 'OCR Failures',
            searchPlaceholder: 'Search logs...',
            entries: 'entries',
            loading: 'Loading logs...',
            empty: 'No logs found.',
            footer: 'This log is generated automatically by Winston Logger and Morgan HTTP Middleware',
        }
        : {
            loadFailed: 'Gagal memuat log: ',
            systemErrors: 'System Errors',
            ocrFailures: 'OCR Failures',
            searchPlaceholder: 'Cari di dalam log...',
            entries: 'entries',
            loading: 'Memuat data log...',
            empty: 'Tidak ada log yang ditemukan.',
            footer: 'Log ini dihasilkan secara otomatis oleh Winston Logger & Morgan HTTP Middleware',
        };
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
            setRawContent(text.loadFailed + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchLogs(); }, [logType, language]);

    const filteredLogs = rawContent.split('\n')
        .filter(line => line.trim() !== '')
        .filter(line => line.toLowerCase().includes(searchTerm.toLowerCase()))
        .reverse(); // Terbaru di atas

    // Statistik ringkasan (sebelum filter pencarian, agar akurat)
    const allLines = rawContent.split('\n').filter(l => l.trim() !== '');
    const errorCount = allLines.filter(l => l.includes('"level":"error"') || l.toLowerCase().includes('error')).length;
    const warnCount = allLines.filter(l => l.includes('"level":"warn"') || l.toLowerCase().includes('warn')).length;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex bg-white/60 dark:bg-[#0d0d0d]/60 backdrop-blur-xl border border-white/40 dark:border-white/10 p-1 rounded-xl shadow-sm">
                    <button
                        onClick={() => setLogType('error')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${logType === 'error' ? 'gradient-bg text-white shadow-md' : 'text-stone-500 dark:text-white/30 hover:text-stone-700 dark:hover:text-white/80'}`}
                    >
                        <AlertCircle size={16} /> {text.systemErrors}
                    </button>
                    <button
                        onClick={() => setLogType('ocr')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${logType === 'ocr' ? 'bg-white/70 dark:bg-[#111]/60 backdrop-blur-xl text-amber-600 shadow-sm' : 'text-stone-500'}`}
                    >
                        <FileWarning size={16} /> {text.ocrFailures}
                    </button>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                        <input
                            type="text"
                            placeholder={text.searchPlaceholder}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl border border-stone-200 dark:border-white/[0.06] rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <button onClick={fetchLogs} className="p-2 bg-white/70 dark:bg-[#0d0d0d]/60 backdrop-blur-xl border border-stone-200 dark:border-white/[0.06] rounded-xl hover:bg-stone-50">
                        <RefreshCw size={20} className={`text-stone-500 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Ringkasan log — konsisten dengan SummaryCard di semua menu */}
            <SummaryRow cards={[
                {
                    title: isEnglish ? 'Total Entries' : 'Total Entri',
                    value: allLines.length.toLocaleString('id-ID'),
                    subtext: isEnglish ? 'Log lines loaded' : 'Baris log dimuat',
                    icon: Terminal,
                    gradient: 'from-blue-500 to-blue-600',
                },
                {
                    title: isEnglish ? 'Errors' : 'Error',
                    value: errorCount.toLocaleString('id-ID'),
                    subtext: logType === 'error' ? 'error.log' : 'Semua level',
                    icon: AlertCircle,
                    gradient: 'from-rose-500 to-red-600',
                },
                {
                    title: isEnglish ? 'Warnings' : 'Warning',
                    value: warnCount.toLocaleString('id-ID'),
                    subtext: isEnglish ? 'warn level' : 'level warn',
                    icon: AlertTriangle,
                    gradient: 'from-amber-500 to-orange-600',
                },
                {
                    title: isEnglish ? 'Active Log' : 'Log Aktif',
                    value: logType === 'error' ? 'error.log' : 'ocr-failures.log',
                    subtext: isEnglish ? 'Currently viewed' : 'Sedang dilihat',
                    icon: FileWarning,
                    gradient: 'from-blue-500 to-fuchsia-600',
                },
            ]} />

            <Card className="p-0 sm:p-0 overflow-hidden border-0 shadow-2xl">
                <div className="bg-[#0a0a0a] p-4 flex items-center justify-between border-b border-white/10">
                    <div className="flex items-center gap-2">
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                        </div>
                        <span className="ml-4 text-xs font-mono text-stone-400 flex items-center gap-2">
                            <Terminal size={14} /> {logType === 'error' ? 'error.log' : 'ocr-failures.log'} — {filteredLogs.length} {text.entries}
                        </span>
                    </div>
                </div>
                <div className="bg-[#0d1117] p-6 font-mono text-sm h-[60vh] overflow-y-auto custom-scrollbar">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full text-stone-500">{text.loading}</div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-stone-600 italic">{text.empty}</div>
                    ) : (
                        <div className="space-y-1">
                            {filteredLogs.map((line, i) => {
                                let color = "text-stone-300";
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
            <p className="text-[10px] text-center text-stone-500 uppercase tracking-widest font-bold">
                {text.footer}
            </p>
        </div>
    );
}