import React from 'react';
import { ChevronRight, Percent, Plus, Trash2, ArrowDownRight, ArrowUpRight, Save } from 'lucide-react';

export default function TaxModals({
    modalTab,
    taxForm,
    setTaxForm,
    handleAddTaxField,
    handleDeleteTaxField,
    handleSaveTaxSummary
}) {
    if (!['tax-form', 'tax-form-pph', 'tax-form-ppn'].includes(modalTab)) return null;

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300 pt-24">
            <div className="grid grid-cols-3 gap-6 bg-white/30 dark:bg-slate-800/30 p-6 rounded-3xl border border-white/20 dark:border-white/5">
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Bulan</label>
                    <div className="relative">
                        <select
                            value={taxForm.month}
                            onChange={e => setTaxForm({ ...taxForm, month: e.target.value })}
                            className="w-full px-4 py-3 border-0 bg-white/50 dark:bg-slate-900/50 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white shadow-inner appearance-none font-bold"
                        >
                            <option value="">- Pilih Bulan -</option>
                            {["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"].map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <ChevronRight size={16} className="rotate-90" />
                        </div>
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Tahun</label>
                    <input
                        type="number"
                        value={taxForm.year}
                        onChange={e => setTaxForm({ ...taxForm, year: parseInt(e.target.value) })}
                        className="w-full px-4 py-3 border-0 bg-white/50 dark:bg-slate-900/50 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white shadow-inner font-bold"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Pembetulan Ke-</label>
                    <input
                        type="number"
                        min="0"
                        value={taxForm.pembetulan || 0}
                        onChange={e => setTaxForm({ ...taxForm, pembetulan: parseInt(e.target.value) })}
                        className="w-full px-4 py-3 border-0 bg-white/50 dark:bg-slate-900/50 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white shadow-inner font-bold"
                    />
                </div>
            </div>

            {(modalTab === 'tax-form' || modalTab === 'tax-form-pph') && (
                <div className="bg-white/20 dark:bg-slate-900/40 p-6 rounded-[2rem] border border-white/20 dark:border-white/5 shadow-inner">
                    <div className="flex justify-between items-center mb-5">
                        <h4 className="font-black text-slate-800 dark:text-white flex items-center gap-3 text-lg">
                            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-500"><Percent size={18} /></div>
                            PPh (Pajak Penghasilan)
                        </h4>
                        <button type="button" onClick={() => handleAddTaxField('pphTypes')} className="flex items-center gap-2 text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-all border border-indigo-100/50">
                            <Plus size={14} /> TAMBAH FIELD
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        {Object.keys(taxForm.data?.pph || {}).map(key => (
                            <div key={key} className="group relative">
                                <div className="flex justify-between items-center mb-1.5 px-1">
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{key}</label>
                                    <button tabIndex="-1" onClick={() => handleDeleteTaxField('pphTypes', key)} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" title="Hapus Field"><Trash2 size={12} /></button>
                                </div>
                                <input
                                    type="text"
                                    value={taxForm.data?.pph?.[key] ? taxForm.data.pph[key].toLocaleString('id-ID') : ''}
                                    onChange={e => {
                                        const val = e.target.value.replace(/[^\d]/g, '');
                                        setTaxForm({
                                            ...taxForm,
                                            data: {
                                                ...taxForm.data,
                                                pph: { ...taxForm.data.pph, [key]: val ? parseInt(val, 10) : 0 }
                                            }
                                        })
                                    }}
                                    className="w-full px-4 py-3.5 border-0 bg-white/60 dark:bg-slate-900/60 rounded-2xl focus:ring-2 focus:ring-indigo-500 dark:text-white shadow-sm font-black text-right pr-6"
                                    placeholder="0"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {(modalTab === 'tax-form' || modalTab === 'tax-form-ppn') && (
                <div className="space-y-8">
                    <div className="bg-emerald-500/[0.03] dark:bg-emerald-500/[0.05] p-6 rounded-[2.5rem] border border-emerald-500/10">
                        <div className="flex justify-between items-center mb-5 px-2">
                            <h4 className="font-black text-slate-800 dark:text-white flex items-center gap-3 text-lg">
                                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500"><ArrowDownRight size={18} /></div>
                                PPN Masukan (Input)
                            </h4>
                            <button type="button" onClick={() => handleAddTaxField('ppnInTypes')} className="flex items-center gap-2 text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition-all border border-emerald-100/50">
                                <Plus size={14} /> TAMBAH FIELD
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            {Object.keys(taxForm.data?.ppnIn || {}).map(key => (
                                <div key={key} className="group relative">
                                    <div className="flex justify-between items-center mb-1.5 px-1">
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{key}</label>
                                        <button tabIndex="-1" onClick={() => handleDeleteTaxField('ppnInTypes', key)} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" title="Hapus Field"><Trash2 size={12} /></button>
                                    </div>
                                    <input
                                        type="text"
                                        value={taxForm.data?.ppnIn?.[key] ? taxForm.data.ppnIn[key].toLocaleString('id-ID') : ''}
                                        onChange={e => {
                                            const val = e.target.value.replace(/[^\d]/g, '');
                                            setTaxForm({
                                                ...taxForm,
                                                data: {
                                                    ...taxForm.data,
                                                    ppnIn: { ...taxForm.data.ppnIn, [key]: val ? parseInt(val, 10) : 0 }
                                                }
                                            })
                                        }}
                                        className="w-full px-4 py-3.5 border-0 bg-white/60 dark:bg-slate-900/60 rounded-2xl focus:ring-2 focus:ring-emerald-500 dark:text-white shadow-sm font-black text-right pr-6"
                                        placeholder="0"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-amber-500/[0.03] dark:bg-amber-500/[0.05] p-6 rounded-[2.5rem] border border-amber-500/10">
                        <div className="flex justify-between items-center mb-5 px-2">
                            <h4 className="font-black text-slate-800 dark:text-white flex items-center gap-3 text-lg">
                                <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500"><ArrowUpRight size={18} /></div>
                                PPN Keluaran (Output)
                            </h4>
                            <button type="button" onClick={() => handleAddTaxField('ppnOutTypes')} className="flex items-center gap-2 text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-50 px-3 py-1.5 rounded-full hover:bg-amber-100 transition-all border border-amber-100/50">
                                <Plus size={14} /> TAMBAH FIELD
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            {Object.keys(taxForm.data?.ppnOut || {}).map(key => (
                                <div key={key} className="group relative">
                                    <div className="flex justify-between items-center mb-1.5 px-1">
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{key}</label>
                                        <button tabIndex="-1" onClick={() => handleDeleteTaxField('ppnOutTypes', key)} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" title="Hapus Field"><Trash2 size={12} /></button>
                                    </div>
                                    <input
                                        type="text"
                                        value={taxForm.data?.ppnOut?.[key] ? taxForm.data.ppnOut[key].toLocaleString('id-ID') : ''}
                                        onChange={e => {
                                            const val = e.target.value.replace(/[^\d]/g, '');
                                            setTaxForm({
                                                ...taxForm,
                                                data: {
                                                    ...taxForm.data,
                                                    ppnOut: { ...taxForm.data.ppnOut, [key]: val ? parseInt(val, 10) : 0 }
                                                }
                                            })
                                        }}
                                        className="w-full px-4 py-3.5 border-0 bg-white/60 dark:bg-slate-900/60 rounded-2xl focus:ring-2 focus:ring-amber-500 dark:text-white shadow-sm font-black text-right pr-6"
                                        placeholder="0"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-end pt-8 border-t border-white/20 dark:border-white/5">
                <button
                    onClick={handleSaveTaxSummary}
                    className="px-12 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-2xl font-black shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all hover:-translate-y-0.5 active:scale-95 flex items-center gap-3"
                >
                    <Save size={20} />
                    SIMPAN DATA PAJAK
                </button>
            </div>
        </div>
    );
}
