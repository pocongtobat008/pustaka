import React, { useState, useMemo } from 'react';
import { Search, Plus, Edit2, Trash2, ChevronLeft, ChevronRight, Filter, X, Save, AlertCircle, Info } from 'lucide-react';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';

export default function MasterTaxObjectsTab({
    masterData,
    onRefresh,
    onSave,
    onDelete,
    onUpdate,
    hasPermission
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 15;
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        code: '',
        name: '',
        tax_type: '23',
        rate: 0,
        note: '',
        is_pph21_bukan_pegawai: 0,
        use_ppn: 1,
        markup_mode: 'none'
    });

    const canCreate = hasPermission ? hasPermission('tax-calculation', 'create') : true;
    const canEdit = hasPermission ? hasPermission('tax-calculation', 'edit') : true;
    const canDelete = hasPermission ? hasPermission('tax-calculation', 'delete') : true;

    // Filtering & Searching
    const filteredData = useMemo(() => {
        return masterData.filter(item => {
            const matchesSearch =
                (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.code || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesFilter = filterType === 'all' || item.tax_type === filterType;
            return matchesSearch && matchesFilter;
        });
    }, [masterData, searchTerm, filterType]);

    // Pagination
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return filteredData.slice(start, start + rowsPerPage);
    }, [filteredData, currentPage]);

    const handleOpenForm = (item = null) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                code: item.code || '',
                name: item.name || '',
                tax_type: item.tax_type || '23',
                rate: item.rate || 0,
                note: item.note || '',
                is_pph21_bukan_pegawai: item.is_pph21_bukan_pegawai || 0,
                use_ppn: item.use_ppn !== undefined ? item.use_ppn : 1,
                markup_mode: item.markup_mode || 'none'
            });
        } else {
            setEditingItem(null);
            setFormData({
                code: '',
                name: '',
                tax_type: '23',
                rate: 0,
                note: '',
                is_pph21_bukan_pegawai: 0,
                use_ppn: 1,
                markup_mode: 'none'
            });
        }
        setIsFormOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (editingItem) {
                await onUpdate(editingItem.id, formData);
            } else {
                await onSave(formData);
            }
            setIsFormOpen(false);
            onRefresh();
        } catch (error) {
            console.error("Submit Error:", error);
            alert("Gagal menyimpan data: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Yakin ingin menghapus objek pajak ini?")) {
            try {
                await onDelete(id);
                onRefresh();
            } catch (error) {
                alert("Gagal menghapus: " + error.message);
            }
        }
    };

    return (
        <div className="space-y-4">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="flex flex-1 gap-2">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Cari Nama atau Kode..."
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <select
                            className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white appearance-none"
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                        >
                            <option value="all">Semua Jenis</option>
                            <option value="21">PPh 21</option>
                            <option value="23">PPh 23</option>
                            <option value="4(2)">PPh 4(2)</option>
                            <option value="26">PPh 26</option>
                        </select>
                    </div>
                </div>
                {canCreate && (
                    <button
                        onClick={() => handleOpenForm()}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                    >
                        <Plus size={18} /> Tambah Objek
                    </button>
                )}
            </div>

            {/* Table Card */}
            <Card className="overflow-hidden border-none shadow-xl bg-white dark:bg-slate-900">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-slate-800/50 text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wider font-bold">
                                <th className="px-6 py-4 border-b dark:border-slate-800">Kode</th>
                                <th className="px-6 py-4 border-b dark:border-slate-800">Nama Objek Pajak</th>
                                <th className="px-6 py-4 border-b dark:border-slate-800">Jenis</th>
                                <th className="px-6 py-4 border-b dark:border-slate-800 text-center">Tarif</th>
                                <th className="px-6 py-4 border-b dark:border-slate-800 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                            {paginatedData.length > 0 ? paginatedData.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="font-mono text-xs font-bold bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded text-gray-600 dark:text-slate-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 group-hover:text-indigo-600 transition-colors">
                                            {item.code}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 line-clamp-1" title={item.name}>
                                            {item.name}
                                        </div>
                                        {item.note && (
                                            <div className="text-[10px] text-gray-400 line-clamp-1 italic mt-0.5">
                                                {item.note}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${item.tax_type === '21' ? 'bg-amber-100 text-amber-700' :
                                            item.tax_type === '23' ? 'bg-indigo-100 text-indigo-700' :
                                                item.tax_type === '4(2)' ? 'bg-emerald-100 text-emerald-700' :
                                                    'bg-rose-100 text-rose-700'
                                            }`}>
                                            PPh {item.tax_type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center whitespace-nowrap">
                                        <span className="font-bold text-gray-700 dark:text-gray-300">
                                            {item.rate}%
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center whitespace-nowrap">
                                        <div className="flex justify-center gap-2">
                                            {canEdit && (
                                                <button
                                                    onClick={() => handleOpenForm(item)}
                                                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                                                    title="Hapus"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-400">
                                        <AlertCircle className="mx-auto mb-2 opacity-20" size={48} />
                                        <p>Tidak ada data ditemukan</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 bg-gray-50 dark:bg-slate-800/30 border-t dark:border-slate-800 flex items-center justify-between">
                        <div className="text-xs text-gray-500">
                            Menampilkan <span className="font-bold">{(currentPage - 1) * rowsPerPage + 1}</span> - <span className="font-bold">{Math.min(currentPage * rowsPerPage, filteredData.length)}</span> dari <span className="font-bold">{filteredData.length}</span> data
                        </div>
                        <div className="flex gap-1">
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => prev - 1)}
                                className="p-1 rounded bg-white dark:bg-slate-800 border dark:border-slate-700 disabled:opacity-30 transition-all hover:bg-gray-50 dark:hover:bg-slate-700"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            {[...Array(totalPages)].map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setCurrentPage(i + 1)}
                                    className={`w-8 h-8 rounded text-xs font-bold transition-all ${currentPage === i + 1
                                        ? 'bg-indigo-600 text-white shadow-lg'
                                        : 'bg-white dark:bg-slate-800 border dark:border-slate-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    {i + 1}
                                </button>
                            ))}
                            <button
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(prev => prev + 1)}
                                className="p-1 rounded bg-white dark:bg-slate-800 border dark:border-slate-700 disabled:opacity-30 transition-all hover:bg-gray-50 dark:hover:bg-slate-700"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                )}
            </Card>

            {/* Modal Form */}
            <Modal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                title={editingItem ? 'Edit Master Objek Pajak' : 'Tambah Master Objek Baru'}
                size="max-w-xl"
            >
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* section: Basic Info */}
                    <div className="bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Informasi Objek</h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="col-span-1">
                                <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">Kode Objek</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-mono text-sm"
                                    placeholder="Contoh: 23-100-01"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">Jenis Pajak</label>
                                <select
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white appearance-none"
                                    value={formData.tax_type}
                                    onChange={(e) => setFormData({ ...formData, tax_type: e.target.value })}
                                >
                                    <option value="21">PPh Pasal 21</option>
                                    <option value="23">PPh Pasal 23</option>
                                    <option value="4(2)">PPh Pasal 4(2)</option>
                                    <option value="26">PPh Pasal 26</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">Nama Objek Pajak</label>
                            <input
                                type="text"
                                required
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-semibold"
                                placeholder="Nama deskripsi objek pajak..."
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* section: Calculation Settings */}
                    <div className="bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-1.5 h-4 bg-emerald-500 rounded-full"></div>
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Pengaturan Tarif & Perhitungan</h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="col-span-1">
                                <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">Tarif (%)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        className="w-full pl-4 pr-10 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-black text-lg"
                                        placeholder="0"
                                        value={formData.rate}
                                        onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-gray-400">%</span>
                                </div>
                            </div>
                            <div className="col-span-1">
                                <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">Mode Mark-up</label>
                                <select
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white appearance-none"
                                    value={formData.markup_mode}
                                    onChange={(e) => setFormData({ ...formData, markup_mode: e.target.value })}
                                >
                                    <option value="none">Normal (Tanpa Gross Up)</option>
                                    <option value="pph">Gross Up PPh</option>
                                    <option value="ppn">Gross Up PPN</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${formData.is_pph21_bukan_pegawai ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900'}`}>
                                <span className={`text-[11px] font-bold ${formData.is_pph21_bukan_pegawai ? 'text-indigo-600' : 'text-gray-500'}`}>BUKAN PEGAWAI?</span>
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded-full text-indigo-600 focus:ring-indigo-500 border-gray-300 transition-all"
                                    checked={!!formData.is_pph21_bukan_pegawai}
                                    onChange={(e) => setFormData({ ...formData, is_pph21_bukan_pegawai: e.target.checked ? 1 : 0 })}
                                />
                            </label>
                            <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${formData.use_ppn ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900'}`}>
                                <span className={`text-[11px] font-bold ${formData.use_ppn ? 'text-indigo-600' : 'text-gray-500'}`}>GUNAKAN PPN?</span>
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded-full text-indigo-600 focus:ring-indigo-500 border-gray-300 transition-all"
                                    checked={!!formData.use_ppn}
                                    onChange={(e) => setFormData({ ...formData, use_ppn: e.target.checked ? 1 : 0 })}
                                />
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">Keterangan Internal</label>
                        <textarea
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white text-sm"
                            rows="2"
                            placeholder="Catatan tambahan untuk objek pajak ini..."
                            value={formData.note}
                            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                        ></textarea>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setIsFormOpen(false)}
                            className="flex-1 px-4 py-3 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 transition-all"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isSubmitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <Save size={20} />}
                            {editingItem ? 'Simpan Perubahan' : 'Daftarkan Objek'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
