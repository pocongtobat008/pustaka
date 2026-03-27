import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Grid3x3, ScanLine, History, PieChart, FileText, FileDigit, ChevronDown, ChevronUp, ArrowRight, ArrowUpRight, Package, Truck, FileBarChart, Download, X, CheckCircle2, FileSearch, FolderOpen, Users, Sparkles, Clock, Eye, Info, MessageSquare, BookOpen, FileCheck, ClipboardCheck, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Card as ShadCard, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import QueueStatus from '../components/ui/QueueStatus';
import WarehouseMap from '../components/WarehouseMap';
import TaxAnalytics from '../components/TaxAnalytics';
import { API_URL } from '../services/database';
import { parseApiError } from '../utils/errorHandler';
import { useLanguage } from '../contexts/LanguageContext';

export default function Dashboard({
    stats: propStats,
    docList: propDocList,
    logs: propLogs,
    docStats: propDocStats,
    TOTAL_SLOTS,
    handleViewDoc,
    handleNavigateToFolder,
    setActiveTab,
    setActiveInvTab,
    handleDownload,
    handleDownloadInvoice,
    taxSummaries = [],
    taxAudits = [],
    users = [],
    departments = [],
    externalItems = [],
    folders = [],
    todayWork,
    currentUser,
    onOpenLanding,
    ocrStats = {},
    inventory = [] // Prop baru
}) {
    // Language Context
    const { language } = useLanguage();
    const isEnglish = language === 'en';

    // Dashboard Translations
    const text = isEnglish
        ? {
            greetingMorning: 'Good Morning',
            greetingSoon: 'Good Afternoon',
            greetingEvening: 'Good Evening',
            greetingNight: 'Good Night',
            welcome: 'Welcome back to ',
            makeProductive: "Let's make your day more productive!",
            visionSystem: 'System Vision',
            aiSemanticSearch: 'AI Semantic Search',
            searchPlaceholder: "Search anything (examples: 'File management SOP', 'Tax notes last month', 'Pending approval')...",
            resetSearch: 'Reset Search',
            semanticAnalysis: 'Semantic Analysis Results',
            beta: 'Beta',
            systemData: 'System Data',
            metadata: 'Metadata',
            viewContext: 'View Context',
            preview: 'Preview',
            download: 'Download',
            databaseWp: 'WP Database',
            pemeriksaan: 'Audit',
            diskusi: 'Discussion',
            approval: 'Approval',
            pustaka: 'Knowledge Base',
            storageCenter: 'Storage Command Center',
            storageDesc: 'Control archive capacity and speed up module navigation.',
            live: 'Live',
            occupancy: 'Occupancy',
            usedSlots: 'Used Slots',
            externalBox: 'External Box',
            available: 'Available',
            openInventory: 'Open Inventory',
            viewDocuments: 'View Documents',
            taxSummaryTab: 'Tax Summary',
            taxControl: 'Tax Control',
            taxControlDesc: 'Audit status and compliance reporting.',
            auditRunning: 'Active Audits',
            taxSummaryCount: 'Tax Summary',
            ocrPipeline: 'OCR Pipeline',
            ocrDesc: 'Real-time OCR queue.',
            ocrActive: 'Active',
            ocrWaiting: 'Waiting',
            ocrSuccess: 'Success',
            ocrFailed: 'Failed',
            recentDocs: 'Recent Documents',
            recentDocsDesc: 'Quick access to new files without leaving dashboard.',
            noRecentDocs: 'No recent documents yet.',
            activityFeed: 'Activity Feed',
            activityDesc: 'Latest audit trail snapshot.',
            noActivity: 'No activity yet.',
            storageDistribution: 'Storage Distribution',
            stored: 'Stored',
            borrowed: 'Borrowed',
            audit: 'Audit',
            empty: 'Empty',
            noDocuments: 'No documents yet.',
            auditLog: 'Activity Log (Audit Trail)',
            system: 'System',
            auditBadge: 'AUDIT',
            before: 'BEFORE',
            after: 'AFTER',
            match: 'Match',
            workLabel: 'Work Suggestion',
            workSuggestion1: 'Check the latest documents that came in today!',
            workSuggestion2: 'There are several OCR queues waiting for your attention.',
            workSuggestion3: 'Time to organize the folder structure for better efficiency.',
            workSuggestion4: 'Don\'t forget to check the status of the running tax audits.',
            workSuggestion5: 'Check warehouse capacity, there might be slots to optimize.',
            workSuggestion6: 'Review today\'s activity log to ensure everything is secure.'
        }
        : {
            greetingMorning: 'Selamat Pagi',
            greetingSoon: 'Selamat Siang',
            greetingEvening: 'Selamat Sore',
            greetingNight: 'Selamat Malam',
            welcome: 'Selamat datang kembali di ',
            makeProductive: 'Mari buat Pekerjaan hari ini lebih produktif!',
            visionSystem: 'Visi Sistem',
            aiSemanticSearch: 'AI Semantic Search',
            searchPlaceholder: "Cari apa saja (contoh: 'SOP pengarsipan', 'Catatan pajak bulan lalu', 'Approval tertunda')...",
            resetSearch: 'Reset Pencarian',
            semanticAnalysis: 'Hasil Analisis Semantik',
            beta: 'Beta',
            systemData: 'System Data',
            metadata: 'Metadata',
            viewContext: 'Lihat Konteks',
            preview: 'Preview',
            download: 'Download',
            databaseWp: 'Database WP',
            pemeriksaan: 'Pemeriksaan',
            diskusi: 'Diskusi',
            approval: 'Approval',
            pustaka: 'Pustaka',
            storageCenter: 'Storage Command Center',
            storageDesc: 'Kontrol kapasitas arsip dan percepat navigasi modul.',
            live: 'Live',
            occupancy: 'Occupancy',
            usedSlots: 'Used Slots',
            externalBox: 'External Box',
            available: 'Available',
            openInventory: 'Buka Inventory',
            viewDocuments: 'Lihat Documents',
            taxSummaryTab: 'Tax Summary',
            taxControl: 'Tax Control',
            taxControlDesc: 'Status audit dan laporan kepatuhan.',
            auditRunning: 'Audit Berjalan',
            taxSummaryCount: 'Tax Summary',
            ocrPipeline: 'OCR Pipeline',
            ocrDesc: 'Antrian OCR realtime.',
            ocrActive: 'Aktif',
            ocrWaiting: 'Menunggu',
            ocrSuccess: 'Sukses',
            ocrFailed: 'Gagal',
            recentDocs: 'Dokumen Terbaru',
            recentDocsDesc: 'Akses cepat file baru tanpa keluar dari dashboard.',
            noRecentDocs: 'Belum ada dokumen terbaru.',
            activityFeed: 'Activity Feed',
            activityDesc: 'Snapshot audit trail terbaru.',
            noActivity: 'Belum ada aktivitas.',
            storageDistribution: 'Distribusi Penyimpanan',
            stored: 'Tersimpan',
            borrowed: 'Dipinjam',
            audit: 'Audit',
            empty: 'Kosong',
            noDocuments: 'Belum ada dokumen.',
            auditLog: 'Log Aktivitas (Audit Trail)',
            system: 'System',
            auditBadge: 'AUDIT',
            before: 'SEBELUM (BEFORE)',
            after: 'SESUDAH (AFTER)',
            match: 'Match',
            workLabel: 'Saran Kerja Hari Ini',
            workSuggestion1: 'Ayo cek dokumen terbaru yang masuk hari ini!',
            workSuggestion2: 'Ada beberapa antrian OCR yang menunggu perhatianmu.',
            workSuggestion3: 'Waktunya merapikan struktur folder agar lebih efisien.',
            workSuggestion4: 'Jangan lupa periksa status audit pajak yang sedang berjalan.',
            workSuggestion5: 'Cek kapasitas gudang, mungkin ada slot yang bisa dioptimalkan.',
            workSuggestion6: 'Review log aktivitas hari ini untuk memastikan semua aman.'
        };

    // Defensive Defaults
    const stats = propStats || { occupancy: 0, stored: 0, borrowed: 0, audit: 0, empty: 0 };
    const docList = Array.isArray(propDocList) ? propDocList : [];
    const logs = Array.isArray(propLogs) ? propLogs : [];
    const docStats = propDocStats || { totalSizeMB: 0, totalDocs: 0, totalRevisions: 0 };
    const safeTaxSummaries = Array.isArray(taxSummaries) ? taxSummaries : [];
    const safeTaxAudits = Array.isArray(taxAudits) ? taxAudits : [];

    const [expandedLogId, setExpandedLogId] = useState(null);
    const [semanticQuery, setSemanticQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const resultsPerPage = 10;

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!semanticQuery.trim()) return;

        setIsSearching(true);
        setCurrentPage(1);
        try {
            // Use the new AI Search Endpoint
            const res = await fetch(`${API_URL}/search/ai`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query: semanticQuery })
            });

            if (res.ok) {
                const data = await res.json();
                if (data.results) {
                    const mapped = data.results.map(item => ({
                        ...item,
                        title: item.name,
                        uploadDate: item.date,
                        size: item.amount ? `Rp ${parseInt(item.amount).toLocaleString('id-ID')}` : (item.size || 'Document'),
                        folderName: item.matchType === 'invoice' ? 'Finance' : 'General',
                    }));
                    setSearchResults(mapped);
                }
            } else {
                const errorText = await res.text();
                const isHtml = errorText.includes('<!DOCTYPE');
                console.warn(`Search failed (Status ${res.status}): ${isHtml ? 'Endpoint API /search/ai tidak ditemukan.' : errorText}`);
                setSearchResults([]);
            }
        } catch (err) {
            const msg = await parseApiError(err);
            console.error("Search failed:", msg);
        } finally {
            setIsSearching(false);
        }
    };

    const handleResetSearch = () => {
        setSemanticQuery('');
        setSearchResults([]);
        setCurrentPage(1);
    };

    const toggleLog = (id) => {
        setExpandedLogId(expandedLogId === id ? null : id);
    };

    // Get Greeting based on time
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 11) return text.greetingMorning;
        if (hour < 15) return text.greetingSoon;
        if (hour < 18) return text.greetingEvening;
        return text.greetingNight;
    };

    const getWorkSuggestion = () => {
        const suggestions = [
            text.workSuggestion1,
            text.workSuggestion2,
            text.workSuggestion3,
            text.workSuggestion4,
            text.workSuggestion5,
            text.workSuggestion6
        ];
        const dayIndex = new Date().getDate() % suggestions.length;
        return suggestions[dayIndex];
    };

    const bentoStats = useMemo(() => {
        const waiting = ocrStats?.counts?.waiting || 0;
        const active = ocrStats?.counts?.active || 0;
        const completed = ocrStats?.counts?.completed || 0;
        const failed = ocrStats?.counts?.failed || 0;
        const totalSlots = TOTAL_SLOTS || 1;
        const usedSlots = (stats?.stored || 0) + (stats?.borrowed || 0) + (stats?.audit || 0);

        return {
            waiting,
            active,
            completed,
            failed,
            usedSlots,
            totalSlots,
            occupancyPercent: Number(((usedSlots / totalSlots) * 100).toFixed(0)),
            activeAudits: (Array.isArray(taxAudits) ? taxAudits.filter(a => a.status !== 'Selesai').length : 0)
        };
    }, [ocrStats, stats, TOTAL_SLOTS, taxAudits]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* STARTUP STYLE GREETING SECTION */}
            <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-white/40 dark:border-white/5 shadow-2xl shadow-indigo-500/10 group">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all duration-700 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-all duration-700 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase tracking-[0.2em]">
                                <Clock size={14} />
                                <span>{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                            </div>
                            <button
                                onClick={onOpenLanding}
                                className="group relative flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full text-[11px] font-black uppercase tracking-widest transition-all hover:scale-110 hover:shadow-[0_0_20px_rgba(79,70,229,0.4)] active:scale-95 ring-4 ring-indigo-500/10 overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-white/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity animate-pulse"></div>
                                <Sparkles size={14} className="relative z-10 animate-pulse" />
                                <span className="relative z-10">{text.visionSystem}</span>
                                <ArrowRight size={14} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-[#2B3674] dark:text-white tracking-tight">
                            {getGreeting()}, <span className="text-indigo-600">{currentUser?.name?.split(' ')[0] || 'User'}</span>
                        </h1>
                        <p className="text-lg text-slate-500 dark:text-slate-400 font-medium max-w-xl leading-relaxed">
                            {text.welcome}<span className="font-bold text-indigo-500">Pustaka</span>. {text.makeProductive}
                        </p>
                    </div>

                    <div className="bg-indigo-50/50 dark:bg-indigo-900/20 backdrop-blur-md border border-indigo-100 dark:border-indigo-800/50 p-6 rounded-[2rem] md:max-w-xs w-full transform hover:scale-[1.02] transition-all duration-300">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-500/30">
                                <Sparkles size={18} />
                            </div>
                            <span className="font-black text-[10px] uppercase tracking-widest text-indigo-600 dark:text-indigo-400">{text.workLabel}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-snug italic">"{getWorkSuggestion()}"</p>
                    </div>
                </div>
            </div>

            {/* 🔍 SEMANTIC SEARCH BAR */}
            <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-6 rounded-3xl border border-white/20 shadow-xl shadow-indigo-500/5 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>

                <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 mb-4 flex items-center gap-2">
                    <ScanLine className="text-indigo-500" /> {text.aiSemanticSearch}
                </h2>

                <form onSubmit={handleSearch} className="relative z-10">
                    <div className="relative">
                        <input
                            type="text"
                            value={semanticQuery}
                            onChange={(e) => setSemanticQuery(e.target.value)}
                            placeholder={text.searchPlaceholder}
                            className="w-full pl-5 pr-24 py-4 rounded-2xl bg-white dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium text-slate-700 dark:text-slate-200 shadow-sm"
                        />
                        {semanticQuery && (
                            <button
                                type="button"
                                onClick={handleResetSearch}
                                className="absolute right-14 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-red-500 transition-colors"
                                title={text.resetSearch}
                            >
                                <X size={20} />
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={isSearching}
                            className="absolute right-2 top-2 bottom-2 aspect-square bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 active:scale-95"
                        >
                            {isSearching ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <ArrowRight size={20} />
                            )}
                        </button>
                    </div>
                </form>

                {/* SEARCH RESULTS */}
                {(searchResults.length > 0 || isSearching) && (
                    <div className="mt-6 space-y-3 animate-in fade-in slide-in-from-top-4 relative z-10">
                        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            {text.semanticAnalysis}
                            <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">{text.beta}</span>
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {searchResults.slice((currentPage - 1) * resultsPerPage, currentPage * resultsPerPage).map(doc => (
                                <div
                                    key={doc.id}
                                    onClick={() => handleViewDoc(doc)}
                                    className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 cursor-pointer transition-all group/card relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover/card:opacity-20 transition-opacity">
                                        <ScanLine size={100} />
                                    </div>

                                    <div className="flex justify-between items-start mb-2 relative z-10">
                                        <div className={`p-2 rounded-lg 
                                            ${doc.matchType === 'invoice' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' :
                                                doc.matchType === 'external_item' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' :
                                                    doc.matchType === 'tax_summary' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' :
                                                        doc.matchType === 'tax_monitoring' ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400' :
                                                            doc.matchType === 'approval' ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400' :
                                                                doc.matchType === 'pustaka' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' :
                                                                    doc.matchType === 'note' ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400' :
                                                                        doc.matchType === 'tax_object' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' :
                                                                            doc.matchType === 'inventory' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' :
                                                                                'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'}`}>
                                            {doc.matchType === 'invoice' ? <Package size={20} /> :
                                                doc.matchType === 'external_item' ? <Truck size={20} /> :
                                                    doc.matchType === 'tax_summary' ? <FileBarChart size={20} /> :
                                                        doc.matchType === 'tax_monitoring' ? <ClipboardCheck size={20} /> : doc.matchType === 'approval' ? <FileCheck size={20} /> : doc.matchType === 'pustaka' ? <BookOpen size={20} /> : doc.matchType === 'note' ? <MessageSquare size={20} /> :
                                                            doc.matchType === 'tax_object' ? <User size={20} /> :
                                                                doc.matchType === 'inventory' ? <Grid3x3 size={20} /> :
                                                                    (doc.type?.includes('pdf') ? <FileDigit size={20} /> : <FileText size={20} />)}
                                        </div>
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${doc.score > 0.3 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                                            {(doc.score * 100).toFixed(0)}% Match
                                        </span>
                                    </div>

                                    <h4 className="font-bold text-slate-800 dark:text-white mb-1 line-clamp-1 group-hover/card:text-indigo-600 dark:group-hover/card:text-indigo-400 transition-colors relative z-10 cursor-pointer" onClick={() => handleViewDoc(doc)}>
                                        {doc.title}
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 relative z-10 mb-3 block truncate">
                                        {doc.uploadDate ? new Date(doc.uploadDate).toLocaleDateString() : text.systemData} • {doc.size || doc.category || text.metadata}
                                    </p>

                                    {/* OCR Snippet Result */}
                                    {(doc.ocrContent || doc.content || doc.text) && (
                                        <div className="relative z-10 mb-3 text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-800 line-clamp-2 italic leading-relaxed">
                                            "{(doc.ocrContent || doc.content || doc.text).substring(0, 120).replace(/\n/g, ' ')}..."
                                        </div>
                                    )}

                                    <div className="flex gap-2 relative z-10">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleViewDoc(doc); }}
                                            className="flex-1 text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 py-2 rounded-lg transition-all font-bold flex items-center justify-center gap-1.5 border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100"
                                        >
                                            <Eye size={14} /> {doc.matchType === 'note' ? text.viewContext : text.preview}
                                        </button>
                                        {doc.matchType !== 'pustaka' && doc.matchType !== 'note' && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (doc.matchType === 'invoice') {
                                                        handleDownloadInvoice(doc.data || doc);
                                                    } else {
                                                        handleDownload(doc.data || doc);
                                                    }
                                                }}
                                                className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg transition-all font-medium flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                                            >
                                                <Download size={14} /> {text.download}
                                            </button>
                                        )}
                                    </div>
                                    <div className="mt-2 relative z-10">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (doc.matchType === 'invoice') {
                                                    setActiveTab('inventory');
                                                    setActiveInvTab('internal');
                                                } else if (doc.matchType === 'external_item') {
                                                    setActiveTab('inventory');
                                                    setActiveInvTab('external');
                                                } else if (doc.matchType === 'tax_summary') {
                                                    setActiveTab('tax-summary');
                                                } else if (doc.matchType === 'tax_monitoring') {
                                                    setActiveTab('tax-monitoring');
                                                } else if (doc.matchType === 'approval') {
                                                    setActiveTab('approvals');
                                                } else if (doc.matchType === 'pustaka') {
                                                    setActiveTab('pustaka');
                                                } else if (doc.matchType === 'tax_object') {
                                                    setActiveTab('tax-calculation');
                                                } else if (doc.matchType === 'note') {
                                                    if (doc.parentType === 'audit') {
                                                        setActiveTab('tax-monitoring');
                                                    } else {
                                                        setActiveTab('documents');
                                                        if (doc.folderId) handleNavigateToFolder(doc.folderId);
                                                    }
                                                } else if (doc.matchType === 'inventory') {
                                                    setActiveTab('inventory');
                                                    setActiveInvTab('internal');
                                                } else {
                                                    handleNavigateToFolder(doc.folderId);
                                                }
                                            }}
                                            className={`w-full text-[10px] py-1 rounded-lg transition-colors font-bold flex items-center justify-center gap-1 uppercase tracking-wider
                                                ${doc.matchType === 'invoice' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 hover:bg-amber-100' :
                                                    doc.matchType === 'external_item' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100' :
                                                        doc.matchType === 'tax_summary' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 hover:bg-purple-100' :
                                                            doc.matchType === 'tax_monitoring' ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 hover:bg-orange-100' :
                                                                doc.matchType === 'approval' ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 hover:bg-rose-100' :
                                                                    doc.matchType === 'pustaka' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100' :
                                                                        doc.matchType === 'tax_object' ? 'bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' :
                                                                            doc.matchType === 'inventory' ? 'bg-slate-50 dark:bg-slate-900/30 hover:bg-slate-100 dark:hover:bg-slate-900/50 text-slate-600 dark:text-slate-400' :
                                                                                'bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'}`}
                                        >
                                            {doc.matchType === 'invoice' ? `📦 ${doc.folderName}` :
                                                doc.matchType === 'external_item' ? `🚚 ${doc.folderName}` :
                                                    doc.matchType === 'tax_summary' ? `📊 ${doc.folderName}` :
                                                        doc.matchType === 'tax_monitoring' ? `🔍 ${doc.folderName || text.pemeriksaan}` :
                                                            doc.matchType === 'note' ? `💬 ${doc.folderName || text.diskusi}` :
                                                                doc.matchType === 'approval' ? `✅ ${doc.folderName || text.approval}` :
                                                                    doc.matchType === 'pustaka' ? `📚 ${doc.folderName || text.pustaka}` :
                                                                        doc.matchType === 'tax_object' ? `👥 ${doc.folderName || text.databaseWp}` :
                                                                            doc.matchType === 'inventory' ? `📦 internal: ${doc.size || 'Slot'}` :
                                                                                `📂 ${doc.folderName || 'General'}`}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pagination Controls */}
                        {searchResults.length > resultsPerPage && (
                            <div className="flex items-center justify-center gap-2 mt-8 relative z-20">
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 disabled:opacity-30 transition-all hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                                >
                                    <ChevronLeft size={20} />
                                </button>

                                <div className="flex items-center gap-1">
                                    {Array.from({ length: Math.ceil(searchResults.length / resultsPerPage) }).map((_, i) => {
                                        const page = i + 1;
                                        const totalPages = Math.ceil(searchResults.length / resultsPerPage);
                                        if (totalPages > 5 && page !== 1 && page !== totalPages && (page < currentPage - 1 || page > currentPage + 1)) {
                                            if (page === currentPage - 2 || page === currentPage + 2) return <span key={page} className="text-slate-400">...</span>;
                                            return null;
                                        }
                                        return (
                                            <button
                                                type="button"
                                                key={page}
                                                onClick={() => setCurrentPage(page)}
                                                className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${currentPage === page ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'}`}
                                            >
                                                {page}
                                            </button>
                                        );
                                    })}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(searchResults.length / resultsPerPage)))}
                                    disabled={currentPage === Math.ceil(searchResults.length / resultsPerPage)}
                                    className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 disabled:opacity-30 transition-all hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ===== BENTO GRID DASHBOARD ===== */}
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-5 auto-rows-min">

                {/* 1. Main Storage Command Center - Jumbo Bento Card */}
                <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} viewport={{ once: true }} className="md:col-span-4 lg:col-span-4 lg:row-span-2 group">
                    <ShadCard className="h-full relative overflow-hidden border-slate-200/50 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-500 flex flex-col justify-between">
                        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-[80px] group-hover:bg-indigo-500/20 transition-all duration-700" />
                        <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                    <Badge variant="outline" className="bg-indigo-50/50 text-indigo-600 border-indigo-200/50 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800/50 w-fit mb-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-2 animate-pulse"></div>
                                        {text.live} Sync
                                    </Badge>
                                    <CardTitle className="text-2xl font-black tracking-tight">{text.storageCenter}</CardTitle>
                                    <CardDescription className="text-sm font-medium">{text.storageDesc}</CardDescription>
                                </div>
                                <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                                    <Grid3x3 size={24} className="text-indigo-500" />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-4">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-4 dark:border-slate-700/50 dark:bg-slate-900/80 shadow-sm hover:shadow-md transition-shadow">
                                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">{text.occupancy}</p>
                                    <p className="text-3xl font-black text-slate-900 dark:text-white">{bentoStats.occupancyPercent}%</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-4 dark:border-slate-700/50 dark:bg-slate-900/80 shadow-sm hover:shadow-md transition-shadow">
                                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">{text.usedSlots}</p>
                                    <p className="text-3xl font-black text-slate-900 dark:text-white">{bentoStats.usedSlots}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-4 dark:border-slate-700/50 dark:bg-slate-900/80 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                                    <div className="absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-emerald-500/10 to-transparent"></div>
                                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">{text.externalBox}</p>
                                    <p className="text-3xl font-black text-slate-900 dark:text-white">{externalItems?.length || 0}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-4 dark:border-slate-700/50 dark:bg-slate-900/80 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                                    <div className="absolute bottom-0 w-full h-1 bg-slate-100 dark:bg-slate-800 left-0"></div>
                                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">{text.available}</p>
                                    <p className="text-3xl font-black text-slate-900 dark:text-white">{stats?.empty || 0}</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <button onClick={() => setActiveTab('inventory')} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-slate-800 hover:shadow-lg dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 active:scale-95">
                                    {text.openInventory} <ArrowRight size={14} />
                                </button>
                                <button onClick={() => setActiveTab('documents')} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 active:scale-95">
                                    {text.viewDocuments}
                                </button>
                                <button onClick={() => setActiveTab('tax-summary')} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 active:scale-95">
                                    {text.taxSummaryTab}
                                </button>
                            </div>
                        </CardContent>
                    </ShadCard>
                </motion.div>

                {/* 2. OCR Pipeline - Tall Bento Card */}
                <motion.div initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 }} viewport={{ once: true }} className="md:col-span-2 lg:col-span-2 lg:row-span-2">
                    <ShadCard className="h-full bg-gradient-to-b from-slate-900 to-slate-950 text-white border-0 shadow-xl flex flex-col justify-between">
                        <CardHeader className="pb-0">
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-lg font-bold"><ScanLine className="text-indigo-400" size={20} /> Pipeline OCR</CardTitle>
                                {bentoStats.active > 0 && <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>}
                            </div>
                            <CardDescription className="text-slate-400 font-medium">{text.ocrDesc}</CardDescription>
                        </CardHeader>
                        <CardContent className="mt-6 flex-1 flex flex-col justify-end space-y-3">
                            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between border border-white/5">
                                <span className="text-sm font-semibold text-slate-300">{text.ocrActive}</span>
                                <span className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">{bentoStats.active}</span>
                            </div>
                            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between border border-white/5">
                                <span className="text-sm font-semibold text-slate-400">{text.ocrWaiting}</span>
                                <span className="text-lg font-bold text-slate-300">{bentoStats.waiting}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 mt-2">
                                <div className="bg-emerald-500/10 rounded-2xl p-3 border border-emerald-500/20">
                                    <p className="text-[10px] text-emerald-400/80 uppercase font-bold text-center mb-1">{text.ocrSuccess}</p>
                                    <p className="text-lg text-emerald-400 font-black text-center">{bentoStats.completed}</p>
                                </div>
                                <div className="bg-rose-500/10 rounded-2xl p-3 border border-rose-500/20">
                                    <p className="text-[10px] text-rose-400/80 uppercase font-bold text-center mb-1">{text.ocrFailed}</p>
                                    <p className="text-lg text-rose-400 font-black text-center">{bentoStats.failed}</p>
                                </div>
                            </div>
                        </CardContent>
                    </ShadCard>
                </motion.div>

                {/* 3. Tax Control - Wide Bento Card */}
                <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }} viewport={{ once: true }} className="md:col-span-2 lg:col-span-3">
                    <ShadCard className="h-full border-slate-200/60 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md hover:shadow-lg transition-shadow">
                        <CardHeader className="pb-4">
                            <CardTitle className="flex items-center gap-2 text-base font-bold"><FileSearch className="text-amber-500" size={18} /> {text.taxControl}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 dark:border-amber-900/30 dark:bg-amber-950/20 group hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors cursor-pointer" onClick={() => setActiveTab('tax-monitoring')}>
                                    <p className="text-[11px] font-bold text-amber-700/80 dark:text-amber-400/80 uppercase tracking-wider mb-2">{text.auditRunning}</p>
                                    <div className="flex items-center justify-between">
                                        <p className="text-3xl font-black text-amber-800 dark:text-amber-300">{bentoStats.activeAudits}</p>
                                        <ArrowUpRight className="text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" size={20} />
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4 dark:border-violet-900/30 dark:bg-violet-950/20 group hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors cursor-pointer" onClick={() => setActiveTab('tax-summary')}>
                                    <p className="text-[11px] font-bold text-violet-700/80 dark:text-violet-400/80 uppercase tracking-wider mb-2">{text.taxSummaryCount}</p>
                                    <div className="flex items-center justify-between">
                                        <p className="text-3xl font-black text-violet-800 dark:text-violet-300">{taxSummaries?.length || 0}</p>
                                        <ArrowUpRight className="text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity" size={20} />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </ShadCard>
                </motion.div>

                {/* 4. Recent Docs - Compact List */}
                <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }} viewport={{ once: true }} className="md:col-span-2 lg:col-span-3">
                    <ShadCard className="h-full border-slate-200/60 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md hover:shadow-lg transition-shadow">
                        <CardHeader className="pb-3 flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-base font-bold"><FileText className="text-indigo-500" size={18} /> {text.recentDocs}</CardTitle>
                            <button onClick={() => setActiveTab('documents')} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 transition-colors">Lihat Semua</button>
                        </CardHeader>
                        <CardContent className="space-y-3 pb-6">
                            {docList.slice(0, 3).map((doc) => (
                                <button key={doc.id} onClick={() => handleViewDoc(doc)} className="group flex w-full items-center gap-3 rounded-2xl border border-transparent hover:border-slate-200 bg-transparent hover:bg-white p-2 text-left transition-all dark:hover:border-slate-700 dark:hover:bg-slate-800 shadow-none hover:shadow-sm">
                                    <div className="rounded-xl bg-slate-100 p-2.5 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-indigo-900/30 dark:group-hover:text-indigo-400 transition-colors">
                                        {doc.type?.includes('pdf') ? <FileDigit size={18} /> : <FileText size={18} />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">{doc.title}</p>
                                        <p className="text-xs font-medium text-slate-500/80 dark:text-slate-500 mt-0.5">{new Date(doc.uploadDate).toLocaleDateString()} • {doc.size}</p>
                                    </div>
                                </button>
                            ))}
                            {docList.length === 0 && <p className="text-sm font-medium text-slate-400 italic p-4 text-center">{text.noRecentDocs}</p>}
                        </CardContent>
                    </ShadCard>
                </motion.div>
            </div>

            {/* TAX ANALYTICS VISUALIZATION */}
            <div className="grid grid-cols-1 gap-6">
                <TaxAnalytics taxSummaries={taxSummaries} taxAudits={taxAudits} />
            </div>

            <div className="grid grid-cols-1 gap-6">
                <QueueStatus />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <h3 className="font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                        <PieChart size={20} className="text-indigo-500" /> {text.storageDistribution}
                    </h3>
                    <div className="space-y-4">
                        <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-6 overflow-hidden flex shadow-inner">
                            <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${((stats?.stored || 0) / (TOTAL_SLOTS || 1)) * 100}%` }} title={`Tersimpan: ${stats?.stored || 0}`}></div>
                            <div className="bg-amber-500 h-full transition-all duration-500" style={{ width: `${((stats?.borrowed || 0) / (TOTAL_SLOTS || 1)) * 100}%` }} title={`Dipinjam: ${stats?.borrowed || 0}`}></div>
                            <div className="bg-purple-500 h-full transition-all duration-500" style={{ width: `${((stats?.audit || 0) / (TOTAL_SLOTS || 1)) * 100}%` }} title={`Audit: ${stats?.audit || 0}`}></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div><span className="text-gray-600 dark:text-slate-400">{text.stored} ({stats?.stored || 0})</span></div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500"></div><span className="text-gray-600 dark:text-slate-400">{text.borrowed} ({stats?.borrowed || 0})</span></div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500"></div><span className="text-gray-600 dark:text-slate-400">{text.audit} ({stats?.audit || 0})</span></div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gray-200 dark:bg-slate-700"></div><span className="text-gray-600 dark:text-slate-400">{text.empty} ({stats?.empty || 0})</span></div>
                        </div>
                    </div>
                </Card>

                <Card>
                    <h3 className="font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                        <FileText size={20} className="text-blue-500" /> {text.recentDocs}
                    </h3>
                    <div className="space-y-3">
                        {docList.slice(0, 3).map(doc => (
                            <div key={doc.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer" onClick={() => handleViewDoc(doc)}>
                                <div className="w-10 h-10 rounded bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500">
                                    {doc.type?.includes('pdf') ? <FileDigit size={20} /> : <FileText size={20} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-900 dark:text-white truncate text-sm">{doc.title}</div>
                                    <div className="text-xs text-gray-500 dark:text-slate-400">{new Date(doc.uploadDate).toLocaleDateString()} • {doc.size}</div>
                                </div>
                            </div>
                        ))}
                        {docList.length === 0 && <p className="text-sm text-gray-500 italic">{text.noDocuments}</p>}
                    </div>
                </Card>
            </div>

            <Card className="max-h-[400px] overflow-y-auto relative p-0 sm:p-0">
                <div className="sticky top-0 bg-white dark:bg-slate-900 z-10 p-6 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <History size={20} className="text-purple-500" /> {text.auditLog}
                    </h3>
                </div>
                <div className="p-6 pt-2 space-y-3">
                    {logs.map(log => (
                        <div key={log.id} className="border-b border-slate-100 dark:border-slate-800 pb-2">
                            <div
                                className="flex justify-between text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 p-2 rounded-lg transition-colors"
                                onClick={() => toggleLog(log.id)}
                            >
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">{log.action}</span>
                                        {log.oldValue && <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded border border-amber-200">{text.auditBadge}</span>}
                                    </div>
                                    <p className="text-gray-500">{log.details}</p>
                                    <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                                        <span>{log.user || text.system}</span> • <span>{new Date(log.timestamp).toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="text-gray-400 flex items-center">
                                    {expandedLogId === log.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </div>
                            </div>

                            {expandedLogId === log.id && (log.oldValue || log.newValue) && (
                                <div className="mt-2 text-xs bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700 font-mono animate-in slide-in-from-top-1">
                                    <div className="grid grid-cols-1 gap-2">
                                        {log.oldValue && (
                                            <div className="bg-red-50 dark:bg-red-900/10 p-2 rounded border border-red-100 dark:border-red-900/20 text-red-700 dark:text-red-400 overflow-x-auto">
                                                <div className="font-bold mb-1 border-b border-red-200 dark:border-red-900/30 pb-1">{text.before}</div>
                                                <pre className="whitespace-pre-wrap">{log.oldValue.startsWith('{') ? JSON.stringify(JSON.parse(log.oldValue), null, 2) : log.oldValue}</pre>
                                            </div>
                                        )}
                                        {log.newValue && (
                                            <div className="bg-emerald-50 dark:bg-emerald-900/10 p-2 rounded border border-emerald-100 dark:border-emerald-900/20 text-emerald-700 dark:text-emerald-400 overflow-x-auto">
                                                <div className="font-bold mb-1 border-b border-emerald-200 dark:border-emerald-900/30 pb-1">{text.after}</div>
                                                <pre className="whitespace-pre-wrap">{log.newValue.startsWith('{') ? JSON.stringify(JSON.parse(log.newValue), null, 2) : log.newValue}</pre>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}
