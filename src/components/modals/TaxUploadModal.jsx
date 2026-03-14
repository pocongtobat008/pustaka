import React from 'react';
import { FileText, CheckCircle2, CloudUpload } from 'lucide-react';
import Modal from '../common/Modal';

export default function TaxUploadModal({
    isOpen,
    onClose,
    uploadForm,
    setUploadForm,
    handleConfirmUpload,
    isUploadingFile
}) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Upload Dokumen Pemeriksaan"
            size="max-w-2xl"
        >
            <div className="space-y-6 pt-24 max-h-[85vh] overflow-y-auto custom-scrollbar px-1">
                {/* Preview Section */}
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="w-full md:w-1/3 bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center h-48 relative group">
                        {uploadForm.fileType?.startsWith('image/') ? (
                            <img src={uploadForm.fileData} alt="Preview" className="max-w-full max-h-full object-contain" />
                        ) : (
                            <div className="text-center p-4">
                                <FileText size={48} className="mx-auto mb-2 text-slate-400" />
                                <p className="text-xs text-slate-500 break-all">{uploadForm.fileName}</p>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-white text-xs font-bold">{uploadForm.fileSize}</p>
                        </div>
                    </div>
                    <div className="flex-1 space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Judul Dokumen</label>
                            <input
                                className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                value={uploadForm.title}
                                onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                                placeholder="Masukkan judul dokumen..."
                            />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400">Hasil OCR (Text Extraction)</label>
                                {uploadForm.ocrContent && (
                                    <span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded flex items-center gap-1">
                                        <CheckCircle2 size={10} /> Berhasil
                                    </span>
                                )}
                            </div>
                            <div className="relative">
                                <textarea
                                    className="w-full h-24 px-4 py-2 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 text-xs font-mono resize-none focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                                    value={uploadForm.ocrContent}
                                    onChange={(e) => setUploadForm({ ...uploadForm, ocrContent: e.target.value })}
                                    placeholder="Klik tombol 'Proses OCR' untuk mengekstrak teks otomatis dari dokumen..."
                                />
                                {!uploadForm.ocrContent && !uploadForm.isProcessing && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <span className="text-slate-400 text-xs italic">Menunggu proses OCR...</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Progress Bar if processing */}
                {uploadForm.isProcessing && (
                    <div className="space-y-2 animate-in fade-in duration-300">
                        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span>{uploadForm.processingMessage}</span>
                            <span className="animate-pulse font-bold text-indigo-500">Processing...</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-indigo-600 h-full rounded-full animate-progress-indeterminate"></div>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white font-bold text-sm transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleConfirmUpload}
                        disabled={uploadForm.isProcessing}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg shadow-indigo-500/20 transition-all transform active:scale-95 text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center gap-2"
                    >
                        <CloudUpload size={18} /> Upload & Proses Background
                    </button>
                </div>
            </div>
        </Modal>
    );
}