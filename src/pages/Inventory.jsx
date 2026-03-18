import React from 'react';
import { Grid3x3, Package, Clock, AlertCircle, Download, FileSpreadsheet, Search, FileText, Truck, Sparkles, TrendingUp, ShieldAlert, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { SummaryCard } from '../components/ui/Card';
import InventoryGrid from '../components/inventory/InventoryGrid';
import ExternalInventoryTable from '../components/inventory/ExternalInventoryTable';
import { useLanguage } from '../contexts/LanguageContext';

export default function Inventory({
    inventory, stats, TOTAL_SLOTS, getStatusStyle,
    handleSlotClick, handleExcelImport, downloadTemplate, excelInputRef,
    handleExportInventory, inventorySearchQuery, setInventorySearchQuery,
    hasPermission, activeInvTab, setActiveInvTab, externalItems, isProcessing,
    ocrStats, onRestoreExternal, onViewExternal, inventoryIssues = []
}) {
    const { language } = useLanguage();
    const isEnglish = language === 'en';
    const text = isEnglish
        ? {
            totalSlot: 'Total Slots',
            emptySlot: 'Empty Slots',
            borrowed: 'Borrowed',
            audit: 'Audit',
            dataIssueDetected: 'Data Issue Detected (Stuck Box)',
            fixSlot: 'FIX SLOT',
            checkSlot: 'CHECK SLOT',
            issueFootnote: '* This issue usually happens when rack transfer is interrupted before fix-up completes.',
            smartAssistant: 'Smart Assistant',
            realtimeAnalysis: 'Real-time Analysis',
            warehouse: 'Warehouse',
            searchPlaceholder: 'Search Box, Vendor, Ordner, Invoice...',
            templateTitle: 'Download Excel Template',
            importTitle: 'Import Data from Excel',
            reportTitle: 'Export Detailed Report',
            template: 'Template',
            importExcel: 'Import Excel',
            report: 'Report',
            noMatch: 'No data matches your search',
            movingBox: 'Moving Box...',
            movingHint: 'Please do not close browser or disconnect. Updating slot coordinates in database to prevent data loss.',
            syncingDb: 'Syncing Database...',
            tabWarehouse: 'Warehouse',
            tabIndoarsip: 'Indoarsip',
            insightSearch: (totalMatches) => `Search Analysis: Found ${totalMatches} relevant items. Click a box to see matching invoice details or OCR attachments.`,
            insightQueue: (totalPending) => `OCR Queue: ${totalPending} invoice attachments are being processed for text extraction. You can keep working, the system updates automatically.`,
            insightCritical: (occupancy) => `Critical Capacity (${occupancy.toFixed(0)}%)! Warehouse is almost full. Schedule moving old-period boxes to Indoarsip soon.`,
            insightRetention: (oldBoxes) => `Retention Suggestion: ${oldBoxes} boxes contain documents older than 5 years. Consider destruction or external archiving.`,
            insightActivity: (recentUpdates) => `High Activity: ${recentUpdates} data changes detected in the last 24 hours. Ensure physical labels stay aligned with system data.`,
            insightOptimize: "Data Optimization: Average invoices per box is high. Use 'Report' to verify invoice-number completeness periodically.",
            tips: [
                "System Optimal: Use 'Import Excel' to speed up bulk box input.",
                'Tip: Boxes moved to Indoarsip remain searchable via global search.',
                'Info: You can attach PDF files to each invoice for automatic OCR extraction.',
                'Suggestion: Perform physical rack audits every 6 months to keep data synchronized.'
            ]
        }
        : {
            totalSlot: 'Total Slot',
            emptySlot: 'Slot Kosong',
            borrowed: 'Dipinjam',
            audit: 'Audit',
            dataIssueDetected: 'Terdeteksi Masalah Data (Box Nyangkut)',
            fixSlot: 'PERBAIKI SLOT',
            checkSlot: 'CEK SLOT',
            issueFootnote: '* Masalah ini biasanya terjadi jika proses pindah rak terputus sebelum perbaikan kode dilakukan.',
            smartAssistant: 'Smart Assistant',
            realtimeAnalysis: 'Real-time Analysis',
            warehouse: 'Gudang',
            searchPlaceholder: 'Cari Box, Vendor, Ordner, Invoice...',
            templateTitle: 'Download Template Excel',
            importTitle: 'Import Data dari Excel',
            reportTitle: 'Export Laporan Detail',
            template: 'Template',
            importExcel: 'Import Excel',
            report: 'Laporan',
            noMatch: 'Tidak ditemukan data yang cocok dengan pencarian',
            movingBox: 'Memindahkan Box...',
            movingHint: 'Mohon jangan menutup browser atau memutuskan koneksi. Sedang memperbarui koordinat slot di database untuk mencegah data hilang.',
            syncingDb: 'Syncing Database...',
            tabWarehouse: 'Gudang',
            tabIndoarsip: 'Indoarsip',
            insightSearch: (totalMatches) => `Analisis Pencarian: Ditemukan ${totalMatches} item yang relevan. Klik pada box untuk melihat detail invoice atau lampiran OCR yang cocok.`,
            insightQueue: (totalPending) => `Antrian OCR: ${totalPending} lampiran invoice sedang dalam proses ekstraksi teks. Anda dapat terus bekerja, sistem akan memperbarui konten secara otomatis.`,
            insightCritical: (occupancy) => `Kapasitas Kritis (${occupancy.toFixed(0)}%)! Gudang hampir penuh. Segera jadwalkan pemindahan box dengan periode tahun lama ke Indoarsip.`,
            insightRetention: (oldBoxes) => `Saran Retensi: Terdapat ${oldBoxes} box dengan dokumen berusia di atas 5 tahun. Pertimbangkan untuk melakukan pemusnahan atau pengarsipan eksternal.`,
            insightActivity: (recentUpdates) => `Aktivitas Tinggi: Terdeteksi ${recentUpdates} perubahan data dalam 24 jam terakhir. Pastikan label fisik pada box sudah sesuai dengan sistem.`,
            insightOptimize: "Optimasi Data: Rata-rata invoice per box cukup tinggi. Gunakan fitur 'Laporan' untuk memverifikasi kelengkapan nomor invoice secara berkala.",
            tips: [
                "Sistem Optimal: Gunakan fitur 'Import Excel' untuk mempercepat input data box dalam jumlah besar.",
                'Tips : Box yang dipindahkan ke Indoarsip tetap dapat dicari melalui kolom pencarian global.',
                'Info: Anda dapat melampirkan file PDF pada setiap invoice untuk ekstraksi teks otomatis (OCR).',
                'Saran: Lakukan audit fisik rak setiap 6 bulan sekali untuk memastikan sinkronisasi data.'
            ]
        };

    const [currentPage, setCurrentPage] = React.useState(1);
    const itemsPerPage = 25;
    const pageCount = Math.ceil(TOTAL_SLOTS / itemsPerPage);

    // Reset page when search query changes to avoid being on an empty page
    React.useEffect(() => {
        setCurrentPage(1);
    }, [inventorySearchQuery]);

    // Unified match helper for both Internal Slot and External Item
    const isMatch = (item) => {
        if (!inventorySearchQuery) return true;
        const q = inventorySearchQuery.toLowerCase();

        // 1. Check ID-like fields (Slot ID or Box ID)
        if (item.id && String(item.id).toLowerCase().includes(q)) return true;
        if (item.boxId && String(item.boxId).toLowerCase().includes(q)) return true;

        // 2. Check boxData (could be item.boxData directly or slot.boxData)
        let data = item.box_data || item.boxData;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { return false; }
        }

        // Safety check for data object
        if (!data || typeof data !== 'object') return false;

        if (data.id && String(data.id).toLowerCase().includes(q)) return true;
        // Tambahkan pengecekan ocrContent di level box jika ada
        if (data.ocrContent && String(data.ocrContent).toLowerCase().includes(q)) return true;
        if (data.destination && String(data.destination).toLowerCase().includes(q)) return true;
        if (data.sender && String(data.sender).toLowerCase().includes(q)) return true;

        // 3. Check Ordners & Invoices
        if (data.ordners && Array.isArray(data.ordners)) {
            return data.ordners.some(ord => {
                const noOrdner = String(ord.noOrdner || '').toLowerCase();
                const period = String(ord.period || '').toLowerCase();
                if (noOrdner.includes(q) || period.includes(q)) return true;

                return ord.invoices?.some(inv =>
                    String(inv.invoiceNo || '').toLowerCase().includes(q) ||
                    String(inv.vendor || '').toLowerCase().includes(q) ||
                    String(inv.taxInvoiceNo || '').toLowerCase().includes(q) ||
                    String(inv.specialNote || '').toLowerCase().includes(q) ||
                    String(inv.ocrContent || inv.ocr_content || '').toLowerCase().includes(q) ||
                    ((inv.status === 'processing' || inv.status === 'waiting') && ('proses ocr'.includes(q) || 'ocr process'.includes(q)))
                );
            });
        }
        return false;
    };

    // Calculate match counts for tabs
    const internalMatchCount = inventory.filter(s => s.status !== 'EMPTY' && isMatch(s)).length;
    const externalMatchCount = externalItems.filter(isMatch).length;

    const getSmartInsight = () => {
        // 1. Konteks Pencarian (Prioritas Utama jika user sedang mencari)
        if (inventorySearchQuery) {
            const totalMatches = internalMatchCount + externalMatchCount;
            return {
                text: text.insightSearch(totalMatches),
                icon: <Search className="text-indigo-500" size={20} />,
                color: "border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-900/10 text-indigo-800 dark:text-indigo-200"
            };
        }

        // 2. Analisis OCR Processing (Background Queue)
        const totalPending = (ocrStats?.counts?.active || 0) + (ocrStats?.counts?.waiting || 0);
        if (totalPending > 0) {
            return {
                text: text.insightQueue(totalPending),
                icon: <RefreshCw className="text-amber-500 animate-spin" size={20} />,
                color: "border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-200"
            };
        }

        // 2. Analisis Kapasitas Kritis
        if (stats.occupancy > 90) {
            return {
                text: text.insightCritical(stats.occupancy),
                icon: <AlertCircle className="text-red-500" size={20} />,
                color: "border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/10 text-red-800 dark:text-red-200"
            };
        }

        // 3. Analisis Retensi (Mencari data lama > 5 tahun)
        const currentYear = new Date().getFullYear();
        const oldBoxes = inventory.filter(s => {
            let data = s.box_data || s.boxData;
            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch (e) { return false; }
            }

            if (!data?.ordners) return false;
            return data.ordners.some(o => {
                const periodYear = parseInt(o.period);
                return !isNaN(periodYear) && (currentYear - periodYear) >= 5;
            });
        });

        if (oldBoxes.length > 0) {
            return {
                text: text.insightRetention(oldBoxes.length),
                icon: <AlertCircle className="text-amber-500" size={20} />,
                color: "border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-200"
            };
        }

        // 4. Analisis Aktivitas Terkini
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentUpdates = inventory.filter(s => s.lastUpdated && new Date(s.lastUpdated) > oneDayAgo).length;
        if (recentUpdates > 3) {
            return {
                text: text.insightActivity(recentUpdates),
                icon: <TrendingUp className="text-blue-500" size={20} />,
                color: "border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-900/10 text-blue-800 dark:text-blue-200"
            };
        }

        // 5. Analisis Kepadatan Data
        const totalInvoices = inventory.reduce((acc, s) => {
            let data = s.box_data || s.boxData;
            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch (e) { return acc; }
            }

            if (!data?.ordners) return acc;
            return acc + data.ordners.reduce((sum, o) => sum + (o.invoices?.length || 0), 0);
        }, 0);

        if (totalInvoices > 0 && stats.stored > 0 && (totalInvoices / stats.stored) > 15) {
            return {
                text: text.insightOptimize,
                icon: <FileText className="text-emerald-500" size={20} />,
                color: "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/10 text-emerald-800 dark:text-emerald-200"
            };
        }

        // 6. Default Tips (Rotasi berdasarkan jam agar tidak membosankan)
        return {
            text: text.tips[new Date().getHours() % text.tips.length],
            icon: <Sparkles className="text-emerald-500" size={20} />,
            color: "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/10 text-emerald-800 dark:text-emerald-200"
        };
    };

    const insight = getSmartInsight();

    return (
        <div className="animate-in fade-in zoom-in-95 duration-300">
            {/* SUMMARY CARDS FOR INVENTORY */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <SummaryCard
                    title={text.totalSlot}
                    value={TOTAL_SLOTS}
                    icon={Grid3x3}
                    colorClass="bg-slate-500/10 text-slate-600 dark:text-slate-300 backdrop-blur-md ring-1 ring-slate-500/20"
                />
                <SummaryCard
                    title={text.emptySlot}
                    value={stats.empty}
                    icon={Package}
                    colorClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 backdrop-blur-md ring-1 ring-emerald-500/30"
                />
                <SummaryCard
                    title={text.borrowed}
                    value={stats.borrowed}
                    icon={Clock}
                    colorClass="bg-amber-500/10 text-amber-600 dark:text-amber-400 backdrop-blur-md ring-1 ring-amber-500/30"
                />
                <SummaryCard
                    title={text.audit}
                    value={stats.audit}
                    icon={AlertCircle}
                    colorClass="bg-purple-500/10 text-purple-600 dark:text-purple-400 backdrop-blur-md ring-1 ring-purple-500/30"
                />
            </div>

            {/* INCONSISTENCY WARNING (STUCK BOXES) */}
            {inventoryIssues.length > 0 && (
                <div className="mb-6 p-5 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-[2rem] animate-in slide-in-from-top-4 duration-500">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-red-100 dark:bg-red-900/50 rounded-2xl text-red-600 dark:text-red-400 shadow-sm">
                            <ShieldAlert size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-black text-red-800 dark:text-red-200 uppercase tracking-widest mb-2">{text.dataIssueDetected}</h3>
                            <div className="space-y-2">
                                {inventoryIssues.map((issue, idx) => (
                                    <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30">
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-red-700 dark:text-red-300">{issue.message}</p>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            {issue.type === 'CORRUPT' && (
                                                <button
                                                    onClick={() => {
                                                        const slot = inventory.find(s => Number(s.id) === Number(issue.slotId));
                                                        if (slot) handleSlotClick(slot);
                                                    }}
                                                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black rounded-lg transition-all shadow-sm active:scale-95"
                                                >
                                                    {text.fixSlot} #{issue.slotId}
                                                </button>
                                            )}
                                            {issue.type === 'DUPLICATE' && issue.slots.map(sid => (
                                                <button
                                                    key={sid}
                                                    onClick={() => {
                                                        const slot = inventory.find(s => Number(s.id) === Number(sid));
                                                        if (slot) handleSlotClick(slot);
                                                    }}
                                                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black rounded-lg transition-all shadow-sm active:scale-95"
                                                >
                                                    {text.checkSlot} #{sid}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p className="mt-4 text-[10px] text-red-600/70 dark:text-red-400/70 font-medium italic">{text.issueFootnote}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* AI SMART INSIGHT BANNER */}
            <div className={`mb-6 p-4 rounded-2xl border backdrop-blur-md flex items-center gap-4 animate-in slide-in-from-top-4 duration-700 ${insight.color}`}>
                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl shadow-sm shrink-0">
                    {insight.icon}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">{text.smartAssistant}</span>
                        <div className="w-1 h-1 rounded-full bg-current opacity-40"></div>
                        <span className="text-[10px] font-bold opacity-60">{text.realtimeAnalysis}</span>
                    </div>
                    <p className="text-sm font-bold leading-relaxed">{insight.text}</p>
                </div>
            </div>

            {/* CONTROL BAR */}
            <div className="flex flex-col gap-6 mb-8 bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/50 dark:border-white/10 shadow-2xl shadow-indigo-500/10 group hover:shadow-indigo-500/20 transition-all duration-500">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 w-full md:w-auto">
                        <div className="flex items-center gap-2 bg-slate-200/50 dark:bg-slate-800/50 p-1.5 rounded-2xl backdrop-blur-sm border border-white/20">
                            <button
                                onClick={() => setActiveInvTab('internal')}
                                className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all duration-300 ${activeInvTab === 'internal' ? 'bg-white dark:bg-slate-700 shadow-lg text-indigo-600 dark:text-white scale-105 ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700 dark:hover:text-slate-300 hover:bg-white/50'}`}
                            >
                                <Grid3x3 size={18} /> {text.tabWarehouse}
                                {inventorySearchQuery && internalMatchCount > 0 && (
                                    <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-bounce">{internalMatchCount}</span>
                                )}
                            </button>
                            <button
                                onClick={() => setActiveInvTab('external')}
                                className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all duration-300 ${activeInvTab === 'external' ? 'bg-white dark:bg-slate-700 shadow-lg text-indigo-600 dark:text-white scale-105 ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700 dark:hover:text-slate-300 hover:bg-white/50'}`}
                            >
                                <Truck size={18} /> {text.tabIndoarsip}
                                {inventorySearchQuery && externalMatchCount > 0 && (
                                    <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-bounce">{externalMatchCount}</span>
                                )}
                            </button>
                        </div>

                        {/* SEARCH BAR */}
                        <div className="relative w-full md:w-96 group/search">
                            <div className="absolute inset-0 bg-indigo-500/20 blur-xl opacity-0 group-hover/search:opacity-100 transition-opacity duration-500 rounded-full"></div>
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500/70" size={20} />
                            <input
                                type="text"
                                value={inventorySearchQuery}
                                onChange={(e) => setInventorySearchQuery(e.target.value)}
                                placeholder={text.searchPlaceholder}
                                className="w-full pl-12 pr-4 py-3 border border-white/40 dark:border-white/10 rounded-2xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-md focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500/50 dark:text-white transition-all text-sm font-medium shadow-inner placeholder:text-slate-400"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-3 w-full md:w-auto">
                        {hasPermission('inventory', 'create') && (
                            <>
                                <input
                                    type="file"
                                    ref={excelInputRef}
                                    onChange={handleExcelImport}
                                    accept=".xlsx, .xls, .csv"
                                    multiple
                                    className="hidden"
                                />
                                <button
                                    onClick={downloadTemplate}
                                    className="px-4 py-2 bg-white/50 hover:bg-white/80 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all border border-white/40 shadow-sm hover:shadow-md backdrop-blur-sm"
                                    title={text.templateTitle}
                                >
                                    <Download size={18} /> {text.template}
                                </button>
                                <button
                                    onClick={() => excelInputRef.current.click()}
                                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5"
                                    title={text.importTitle}
                                >
                                    <FileSpreadsheet size={18} /> {text.importExcel}
                                </button>
                            </>
                        )}
                        <button
                            onClick={handleExportInventory}
                            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5"
                            title={text.reportTitle}
                        >
                            <FileText size={18} /> {text.report}
                        </button>
                    </div>
                </div>

                {/* GRID */}
                {activeInvTab === 'internal' && (
                    <>
                        <InventoryGrid
                            TOTAL_SLOTS={TOTAL_SLOTS}
                            inventory={inventory}
                            handleSlotClick={handleSlotClick}
                            getStatusStyle={getStatusStyle}
                            isMatch={isMatch}
                            inventorySearchQuery={inventorySearchQuery}
                            ocrStats={ocrStats}
                            currentPage={currentPage}
                            itemsPerPage={itemsPerPage}
                        />

                        {/* PAGINATION CONTROLS */}
                        {!inventorySearchQuery && (
                            <div className="mt-8 flex items-center justify-center gap-4">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2.5 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-white/40 dark:border-white/10 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm"
                                >
                                    <ChevronLeft size={20} />
                                </button>

                                <div className="flex items-center gap-2">
                                    {Array.from({ length: pageCount }).map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setCurrentPage(i + 1)}
                                            className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${currentPage === i + 1
                                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-110'
                                                    : 'bg-white/50 dark:bg-slate-800/50 text-slate-500 hover:bg-white dark:hover:bg-slate-700 border border-white/40 dark:border-white/10'
                                                }`}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(pageCount, prev + 1))}
                                    disabled={currentPage === pageCount}
                                    className="p-2.5 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-white/40 dark:border-white/10 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        )}
                    </>
                )}

                {/* EXTERNAL / INDOARSIP TAB CONTENT */}
                {activeInvTab === 'external' && (
                    <ExternalInventoryTable
                        externalItems={externalItems}
                        isMatch={isMatch}
                        onViewExternal={onViewExternal}
                        onRestoreExternal={onRestoreExternal}
                        ocrStats={ocrStats}
                        hasPermission={hasPermission}
                    />
                )}
            </div>

            {activeInvTab === 'internal' && inventory.filter(isMatch).length === 0 && (
                <div className="text-center py-12 text-gray-500">
                    <p>{text.noMatch} "{inventorySearchQuery}".</p>
                </div>
            )}

            {/* MOVING/PROCESSING LOADING OVERLAY - Mencegah Data Corrupt saat Pindah Slot */}
            {isProcessing && (
                <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-md flex items-center justify-center">
                    <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] shadow-2xl flex flex-col items-center animate-in zoom-in-95 max-w-sm text-center border border-white/20">
                        <div className="relative mb-8">
                            <div className="w-24 h-24 border-4 border-indigo-100 dark:border-indigo-900/30 rounded-full"></div>
                            <div className="w-24 h-24 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                            <Package className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600 animate-bounce" size={32} />
                        </div>
                        <h3 className="text-2xl font-black text-gray-800 dark:text-white mb-3 uppercase tracking-tight">{text.movingBox}</h3>
                        <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed font-medium">
                            {text.movingHint}
                        </p>
                        <div className="mt-6 flex items-center gap-2 text-indigo-500 font-bold text-xs uppercase tracking-widest">
                            <RefreshCw size={14} className="animate-spin" /> {text.syncingDb}
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
