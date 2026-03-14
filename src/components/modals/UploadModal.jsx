import React from 'react';
import { UploadCloud, FileText } from 'lucide-react';

export default function UploadModal({ uploadForm, setUploadForm, fileInputRef, handleFileSelect, handleProcessDoc }) {
  if (uploadForm.isProcessing) {
    return (
      <div className="text-center py-12">
        <div className="relative mx-auto mb-4 w-16 h-16">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <FileText className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-500" size={24} />
        </div>
        <h3 className="text-xl font-bold dark:text-white animate-pulse">Sedang Memproses...</h3>
        <p className="text-sm text-gray-500 mt-2">{uploadForm.processingMessage || 'Mohon tunggu...'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-24">
      <div
        className={`group relative flex flex-col items-center justify-center border-dashed rounded-2xl p-10 text-center transition-all duration-300 cursor-pointer ${uploadForm.fileData ? 'border-2 border-indigo-500 bg-indigo-50/30 dark:bg-indigo-900/10' : 'border border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:bg-slate-50/50 dark:hover:bg-slate-800/30'}`}
        onClick={() => fileInputRef.current.click()}
      >
        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*,.pdf,.docx,.doc,.xlsx,.xls,.pptx" />

        <div className="mb-4 p-4 rounded-full bg-slate-50 dark:bg-slate-800 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 transition-colors duration-300">
          <UploadCloud className="text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors duration-300" size={32} />
        </div>

        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {uploadForm.title || 'Klik di sini untuk upload file'}
        </p>
        {!uploadForm.title && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-medium uppercase tracking-wider">
            Semua Jenis File (PDF, Gambar, Office) - Max 30MB
          </p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Judul Dokumen</label>
        <input
          value={uploadForm.title}
          onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
          className="w-full px-4 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
        />
      </div>
      <div className="flex justify-end gap-3 pt-4">
        <p className="text-[10px] text-slate-400 italic mr-auto self-center">* OCR akan diproses otomatis di latar belakang.</p>
        <button onClick={handleProcessDoc} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-lg shadow-blue-500/20 hover:scale-105 transition-all">
          {uploadForm.editMode ? 'Simpan Revisi' : 'Upload & Proses'}
        </button>
      </div>
    </div>
  );
}