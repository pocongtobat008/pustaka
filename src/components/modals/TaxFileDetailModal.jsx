import React from 'react';
import { FileText, CheckCircle2, Clock } from 'lucide-react';
import Modal from '../common/Modal';
import { useLanguage } from '../../contexts/LanguageContext';

export default function TaxFileDetailModal({
    isOpen,
    onClose,
    selectedFileDetail,
    setSelectedFileDetail,
    getFullUrl,
    handleSecureDownload,
    api
}) {
    const { t, isEnglish } = useLanguage();
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t("modal.taxFileDetail")}
            size="max-w-4xl"
        >
            <div className="flex h-full min-h-0 flex-col gap-6 pt-4 md:flex-row">
                {/* LEFT: PREVIEW */}
                <div className="flex-1 bg-stone-100 dark:bg-[#0d0d0d] rounded-xl overflow-hidden flex items-center justify-center border border-stone-200 dark:border-white/[0.06] relative">
                    {String(selectedFileDetail?.type || '').toLowerCase().startsWith('image/') ? (
                        <img src={selectedFileDetail?.fileData || getFullUrl(selectedFileDetail?.url)} alt="Preview" className="max-w-full max-h-full object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                    ) : String(selectedFileDetail?.type || '').toLowerCase().includes('pdf') ? (
                        <iframe src={selectedFileDetail?.fileData?.startsWith('data:') ? selectedFileDetail.fileData : getFullUrl(selectedFileDetail?.url)} className="w-full h-full" title="PDF Preview"></iframe>
                    ) : (
                        <div className="text-center p-6 text-stone-500">
                            <FileText size={48} className="mx-auto mb-2 opacity-50" />
                            <p>Preview tidak tersedia untuk format ini.</p>
                            <button onClick={() => handleSecureDownload(selectedFileDetail)} className="mt-4 text-blue-600 hover:underline">Download File</button>
                        </div>
                    )}
                </div>

                {/* RIGHT: OCR CONTENT */}
                <div className="flex-1 flex flex-col h-full">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-bold text-stone-700 dark:text-white/80 flex items-center gap-2">
                            <FileText size={16} className="text-blue-500" /> Extracted Text (OCR)
                        </h4>
                        {selectedFileDetail?.ocrContent ? (
                            <span className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded border border-emerald-100 dark:border-emerald-800 flex items-center gap-1">
                                <CheckCircle2 size={12} /> Auto-Generated
                            </span>
                        ) : (
                            <span className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded border border-amber-100 dark:border-amber-800 flex items-center gap-1 animate-pulse">
                                <Clock size={12} /> Pending / Empty
                            </span>
                        )}
                    </div>
                    <textarea
                        className="flex-1 w-full bg-stone-50 dark:bg-[#0d0d0d] border-2 border-stone-200 dark:border-white/[0.06] rounded-xl p-4 text-sm font-mono text-stone-700 dark:text-white/70 focus:border-blue-500 focus:ring-0 resize-none outline-none leading-relaxed"
                        value={selectedFileDetail?.ocrContent || ''}
                        onChange={(e) => setSelectedFileDetail({ ...selectedFileDetail, ocrContent: e.target.value })}
                        placeholder={selectedFileDetail?.ocrContent ? "Teks hasil scan..." : "Teks belum tersedia. Mohon tunggu proses OCR selesai atau klik tombol 'Regenerate/Refresh' di bawah."}
                    />
                    <div className="mt-4 flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl text-stone-500 font-bold hover:bg-stone-100 dark:hover:bg-white/[0.05] transition-colors"
                        >
                            Tutup
                        </button>
                        <button
                            onClick={async () => {
                                if (selectedFileDetail?.id && String(selectedFileDetail.id).startsWith('note-')) {
                                    alert("Data catatan (note) tidak memerlukan refresh OCR.");
                                    return;
                                }
                                try {
                                    const refreshedDoc = await api.getDocumentById(selectedFileDetail.id);
                                    if (refreshedDoc) {
                                        setSelectedFileDetail(refreshedDoc);
                                        alert("Data dokumen diperbarui dari server.");
                                    }
                                } catch (e) { alert("Gagal refresh: " + e.message); }
                            }}
                            className="px-5 py-2.5 rounded-xl text-blue-600 font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border border-blue-100 dark:border-blue-800"
                        >
                            Refresh / Cek OCR
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}