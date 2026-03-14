import React from 'react';
import { Search, Download, FileText, Upload, Trash2, Copy, ChevronLeft, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card } from '../ui/Card';
import { API_URL } from '../../services/database';

export default function TaxWpDatabase({
    savedData, searchTerm, setSearchTerm,
    currentPage, setCurrentPage, rowsPerPage,
    handleEdit, handleDelete, handleDeleteAll,
    handleImportDatabase, onCopy,
    canCreate, canEdit, canDelete, isLoading, isImporting
}) {
    const filteredData = savedData.filter(item =>
        (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.identity_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.tax_object_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.tax_object_code || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    const paginatedData = filteredData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    const handleDownloadDatabaseTemplate = () => {
        const headers = ["id_type", "identity_number", "name", "email", "tax_type", "tax_object_code", "tax_object_name", "markup_mode", "is_pph21_bukan_pegawai", "use_ppn", "dpp", "rate", "discount"];
        const data = [["NPWP", "1234567890123456", "PT. Contoh", "finance@contoh.com", "23", "24-104-01", "Jasa Teknik", "none", 0, 1, 1000000, 2, 0]];
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template WP");
        XLSX.writeFile(wb, "Template_Import_Database_WP.xlsx");
    };

    const handleExportDatabase = () => {
        window.open(`${API_URL}/tax/wp/export`, '_blank');
    };

    return (
        <Card>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div className="flex items-center gap-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Database Wajib Pajak</h3>
                    <div className="flex gap-2">
                        <button onClick={handleDownloadDatabaseTemplate} className="px-3 py-1.5 text-xs font-medium bg-green-50 text-green-600 hover:bg-green-100 rounded-lg flex items-center gap-1 border border-green-200"><Download size={14} /> Template</button>
                        <button onClick={handleExportDatabase} className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg flex items-center gap-1 shadow-sm"><FileText size={14} /> Export Excel</button>
                        {canCreate && <div className="relative">
                            <input type="file" accept=".xlsx, .xls" onChange={handleImportDatabase} className="absolute inset-0 opacity-0 cursor-pointer" disabled={isImporting} />
                            <button className={`px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg flex items-center gap-1 border border-blue-200 ${isImporting ? 'opacity-50 cursor-wait' : ''}`}><Upload size={14} /> {isImporting ? 'Uploading...' : 'Import Excel'}</button>
                        </div>}
                        {canDelete && <button onClick={handleDeleteAll} disabled={isLoading || savedData.length === 0} className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 rounded-lg flex items-center gap-1 border border-red-200 disabled:opacity-50"><Trash2 size={14} /> Hapus Semua</button>}
                    </div>
                </div>
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input type="text" placeholder="Cari Nama / Identitas..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-300 font-medium border-b dark:border-slate-700">
                        <tr>
                            <th className="px-4 py-3">Nama Wajib Pajak</th>
                            <th className="px-4 py-3">Jenis Pajak</th>
                            <th className="px-4 py-3 text-right">Tarif</th>
                            <th className="px-4 py-3">NPWP/NIK</th>
                            <th className="px-4 py-3">Kode Objek Pajak</th>
                            <th className="px-4 py-3">Email</th>
                            <th className="px-4 py-3 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {paginatedData.length === 0 ? (
                            <tr><td colSpan="7" className="px-4 py-8 text-center text-gray-500">Tidak ada data ditemukan.</td></tr>
                        ) : (
                            paginatedData.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-200">{item.name || '-'}</td>
                                    <td className="px-4 py-3"><span className="px-2 py-1 rounded bg-indigo-50 text-indigo-600 text-xs font-medium">PPh {item.tax_type}</span></td>
                                    <td className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">{item.rate}%</td>
                                    <td className="px-4 py-3 text-gray-500">
                                        <div className="flex items-center gap-2">
                                            <span>{item.id_type}: {item.identity_number}</span>
                                            {item.identity_number && <button onClick={() => onCopy(item.identity_number, "NPWP/NIK")} className="p-1 text-slate-400 hover:text-indigo-600"><Copy size={12} /></button>}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                                        <div className="flex items-center gap-2">
                                            <span>{item.tax_object_code || '-'}</span>
                                            {item.tax_object_code && <button onClick={() => onCopy(item.tax_object_code, "Kode Objek Pajak")} className="p-1 text-slate-400 hover:text-indigo-600"><Copy size={12} /></button>}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-indigo-500 font-medium">
                                        <div className="flex items-center gap-2">
                                            <span className="truncate max-w-[120px]" title={item.email}>{item.email || '-'}</span>
                                            {item.email && <button onClick={() => onCopy(item.email, "Email")} className="p-1 text-slate-400 hover:text-indigo-600"><Copy size={12} /></button>}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            {canEdit && <button onClick={() => handleEdit(item)} className="px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg">Edit</button>}
                                            {canDelete && <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="px-6 py-4 flex items-center justify-between border-t border-gray-100 dark:border-slate-800">
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <p className="text-sm text-gray-500">Showing <span className="font-bold">{(currentPage - 1) * rowsPerPage + 1}</span> to <span className="font-bold">{Math.min(currentPage * rowsPerPage, filteredData.length)}</span> of <span className="font-bold">{filteredData.length}</span> entries</p>
                        <nav className="relative z-0 inline-flex rounded-xl shadow-sm -space-x-px bg-white dark:bg-slate-800 p-1 border border-gray-200 dark:border-slate-700">
                            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="relative inline-flex items-center px-2 py-2 rounded-lg text-gray-400 hover:bg-indigo-50 disabled:opacity-30"><ChevronLeft size={20} /></button>
                            {[...Array(totalPages)].map((_, i) => {
                                const page = i + 1;
                                if (totalPages > 7 && page !== 1 && page !== totalPages && (page < currentPage - 1 || page > currentPage + 1)) {
                                    if (page === currentPage - 2 || page === currentPage + 2) return <span key={page} className="px-2 py-2 text-gray-400">...</span>;
                                    return null;
                                }
                                return (
                                    <button key={page} onClick={() => setCurrentPage(page)} className={`relative inline-flex items-center px-4 py-2 rounded-lg text-sm font-bold ${currentPage === page ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:bg-indigo-50'}`}>{page}</button>
                                );
                            })}
                            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="relative inline-flex items-center px-2 py-2 rounded-lg text-gray-400 hover:bg-indigo-50 disabled:opacity-30"><ChevronRight size={20} /></button>
                        </nav>
                    </div>
                </div>
            )}
        </Card>
    );
}