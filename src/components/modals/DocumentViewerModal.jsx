import React from 'react';
import {
    FileDigit, ImageIcon, User, Clock, FileJson,
    Download, Eye, RefreshCw, FileText, History
} from 'lucide-react';
import PdfViewer from '../ui/PdfViewer';

export default function DocumentViewerModal({
    modalTab,
    viewDocData,
    handleDownload,
    isGeneratingPreview,
    getFullUrl,
    pdfBlobUrl,
    previewHtml,
    handleRestoreVersion
}) {
    if (modalTab !== 'doc-view' || !viewDocData) return null;

    return (
        <div className="space-y-6 pt-4 pb-10">
            <div className="flex gap-4">
                <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
                    {String(viewDocData?.type || '').toLowerCase().includes('pdf') ? <FileDigit size={40} className="text-red-500" /> : <ImageIcon size={40} />}
                </div>
                <div className="flex-1">
                    <h3 className="text-2xl font-bold dark:text-white">{viewDocData.title}</h3>
                    <div className="flex gap-4 text-sm text-gray-500 mt-2">
                        <span className="flex items-center gap-1"><User size={14} /> {viewDocData.uploader || viewDocData.owner || 'Unknown'}</span>
                        <span className="flex items-center gap-1"><Clock size={14} /> {viewDocData.uploadDate ? new Date(viewDocData.uploadDate).toLocaleDateString() : '-'}</span>
                        <span className="flex items-center gap-1"><FileJson size={14} /> {viewDocData.size}</span>
                    </div>
                    <button onClick={() => handleDownload(viewDocData)} className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium"><Download size={16} /> Download File</button>
                </div>
            </div>

            {/* FILE PREVIEW SECTION */}
            <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
                <h4 className="font-bold mb-2 dark:text-white flex items-center gap-2"><Eye size={16} /> Preview Dokumen</h4>
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden min-h-[300px] max-h-[600px] overflow-y-auto shadow-inner flex items-center justify-center relative">
                    {isGeneratingPreview ? (
                        <div className="flex flex-col items-center gap-3">
                            <RefreshCw size={32} className="text-indigo-500 animate-spin" />
                            <p className="text-[10px] font-bold text-slate-500 animate-pulse uppercase tracking-widest text-center">Menyiapkan Preview...</p>
                        </div>
                    ) : String(viewDocData?.type || '').toLowerCase().includes('image') ? (
                        <img src={viewDocData?.fileData || viewDocData?.file_data || viewDocData?.filedata || getFullUrl(viewDocData?.url) || undefined} alt="Preview" className="max-w-full mx-auto" onError={(e) => { e.target.style.display = 'none'; }} />
                    ) : pdfBlobUrl ? (
                        <PdfViewer src={pdfBlobUrl} className="w-full h-[600px]" />
                    ) : previewHtml ? (
                        <div className="p-6 prose dark:prose-invert max-w-none overflow-x-auto preview-content w-full" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                            <FileText size={48} className="mb-2 opacity-20" />
                            <p className="text-sm font-medium">Preview tidak tersedia untuk format ini.</p>
                            <p className="text-xs opacity-60 mt-1">Gunakan tombol Download untuk melihat file secara penuh.</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
                <h4 className="font-bold mb-2 dark:text-white flex items-center gap-2"><FileText size={16} /> Isi Dokumen (OCR & Analisis)</h4>
                <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg font-mono text-sm max-h-60 overflow-y-auto border border-gray-200 dark:border-slate-700 dark:text-slate-300 whitespace-pre-wrap">{viewDocData.ocrContent || 'Tidak ada konten OCR.'}</div>
            </div>

            {/* Version History Section - Safe Render */}
            {(() => {
                let history = [];
                try {
                    if (viewDocData.versionsHistory) {
                        history = typeof viewDocData.versionsHistory === 'string'
                            ? JSON.parse(viewDocData.versionsHistory)
                            : viewDocData.versionsHistory;
                    }
                } catch (e) { console.error("History parse error", e); }

                if (Array.isArray(history) && history.length > 0) {
                    return (
                        <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
                            <h4 className="font-bold mb-3 dark:text-white flex items-center gap-2"><History size={16} /> Riwayat Versi & Revisi</h4>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                {history.slice().reverse().map((ver, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                                        <div>
                                            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Versi {new Date(ver.timestamp).toLocaleString()}</div>
                                            <div className="text-[10px] text-slate-500">Oleh: {ver.user} • {ver.size} • {ver.title}</div>
                                        </div>
                                        <button
                                            onClick={() => handleRestoreVersion(viewDocData.id, ver.timestamp)}
                                            className="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-3 py-1.5 rounded-md font-bold transition-colors"
                                        >
                                            RESTORE
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                }
                return null;
            })()}
        </div>
    );
}
