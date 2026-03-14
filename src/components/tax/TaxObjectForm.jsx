import React, { useState, useRef } from 'react';
import { User, FileText, Download, Upload, Save, TrendingUp } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card } from '../ui/Card';
import TaxCalculator from './TaxCalculator';
import { API_URL } from '../../services/database';

export default function TaxObjectForm({
    formData, setFormData,
    calcData, setCalcData,
    editingId, setEditingId,
    masterData, fetchMasterData,
    handleSave, onCopy,
    hasPermission, isLoading, setIsLoading
}) {
    const [showObjectDropdown, setShowObjectDropdown] = useState(false);
    const masterFileInputRef = useRef(null);

    const canCreate = hasPermission ? hasPermission('tax-calculation', 'create') : true;
    const isReadOnly = !hasPermission('tax-calculation', 'edit') && !canCreate;

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            let sanitizedValue = value;
            if (name === 'identityNumber') {
                sanitizedValue = value.replace(/\D/g, '').slice(0, 16);
            }
            const newData = { ...prev, [name]: sanitizedValue };

            if (name === 'taxType' || (name === 'idType' && value === 'KTP' && newData.taxType === '23')) {
                if (name === 'idType' && value === 'KTP' && newData.taxType === '23') {
                    newData.taxType = '21';
                }
                const isPph21 = newData.taxType === '21';
                newData.isPph21BukanPegawai = isPph21;
                newData.usePpn = !isPph21;
                setCalcData(c => ({ ...c, isPph21BukanPegawai: isPph21, usePpn: !isPph21 }));
            }
            return newData;
        });
    };

    const handleDownloadMasterTemplate = () => {
        const headers = ["name", "code", "tax_type", "rate"];
        const data = [
            ["Jasa Teknik", "24-104-01", "23", 2],
            ["Jasa Manajemen", "24-104-02", "23", 2],
            ["Sewa Bangunan", "28-402-01", "4(2)", 10]
        ];
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template Master Objek");
        XLSX.writeFile(wb, "Template_Master_Objek_Pajak.xlsx");
    };

    const handleImportMaster = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch(`${API_URL}/tax/objects/import`, {
                method: 'POST',
                body: formData
            });

            const result = await res.json();

            if (res.ok) {
                alert(result.message || "Master data berhasil diimport.");
                fetchMasterData();
            } else {
                alert("Gagal import: " + (result.error || "Terjadi kesalahan"));
            }
        } catch (error) {
            console.error("Import master error:", error);
            alert('Gagal import master data: ' + error.message);
        } finally {
            setIsLoading(false);
            e.target.value = null; // Reset input
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency', currency: 'IDR', minimumFractionDigits: 0
        }).format(value);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <Card className={`relative ${showObjectDropdown ? 'z-30' : 'z-10'}`}>
                    <div className="flex justify-between items-center mb-6 border-b pb-2 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            <User size={20} className="text-indigo-600" /> Data Subjek & Objek Pajak
                        </h3>
                        <div className="flex gap-2">
                            <button onClick={handleDownloadMasterTemplate} className="text-xs flex items-center gap-1 text-gray-500 hover:text-indigo-600 transition-colors">
                                <Download size={14} /> Template Master
                            </button>
                            {canCreate && <button onClick={() => masterFileInputRef.current.click()} className="text-xs flex items-center gap-1 text-gray-500 hover:text-indigo-600 transition-colors">
                                <Upload size={14} /> Import Master
                            </button>}
                            <input type="file" ref={masterFileInputRef} onChange={handleImportMaster} accept=".xlsx, .xls" className="hidden" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jenis Identitas</label>
                            <select name="idType" value={formData.idType} onChange={handleInputChange} disabled={isReadOnly} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white">
                                <option value="NPWP">NPWP</option>
                                <option value="KTP">KTP (NIK)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nomor Identitas</label>
                            <input type="text" name="identityNumber" value={formData.identityNumber} onChange={handleInputChange} disabled={isReadOnly} maxLength={16} placeholder="16 digit angka" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Wajib Pajak</label>
                            <input type="text" name="name" value={formData.name} onChange={handleInputChange} disabled={isReadOnly} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white" placeholder="Nama Lengkap / Badan Usaha" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Wajib Pajak</label>
                            <input type="email" name="email" value={formData.email} onChange={handleInputChange} disabled={isReadOnly} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white" placeholder="contoh@email.com" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jenis Pajak</label>
                            <select name="taxType" value={formData.taxType} onChange={handleInputChange} disabled={isReadOnly} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white">
                                <option value="23" disabled={formData.idType === 'KTP'}>PPh 23 {formData.idType === 'KTP' ? '(Hanya NPWP)' : ''}</option>
                                <option value="4(2)">PPh 4(2)</option>
                                <option value="21">PPh 21</option>
                                <option value="26">PPh 26</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kode Objek Pajak</label>
                            <input type="text" name="taxObjectCode" value={formData.taxObjectCode} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 outline-none dark:text-gray-300 cursor-not-allowed" placeholder="Auto-fill" readOnly />
                        </div>
                        <div className="md:col-span-2 relative">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Objek Pajak (Cari & Pilih)</label>
                            <input type="text" name="taxObjectName" value={formData.taxObjectName} onChange={(e) => { if (isReadOnly) return; handleInputChange(e); setShowObjectDropdown(true); }} onFocus={() => !isReadOnly && setShowObjectDropdown(true)} onBlur={() => setTimeout(() => setShowObjectDropdown(false), 200)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white" placeholder="Ketik untuk mencari..." autoComplete="off" />
                            {showObjectDropdown && (
                                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                    {masterData.filter(item => String(item.tax_type) === String(formData.taxType) && ((item.name || '').toLowerCase().includes((formData.taxObjectName || '').toLowerCase()) || (item.code || '').toLowerCase().includes((formData.taxObjectName || '').toLowerCase()))).map((item) => (
                                        <button key={item.id} className="w-full text-left px-4 py-3 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors border-b border-gray-100 dark:border-slate-700 last:border-0" onClick={() => {
                                            const isPph21 = String(item.tax_type) === '21';
                                            setFormData(prev => ({ ...prev, taxObjectName: item.name, taxObjectCode: item.code, taxType: item.tax_type, isPph21BukanPegawai: isPph21, usePpn: !isPph21 }));
                                            setCalcData(prev => ({ ...prev, rate: item.rate ?? prev.rate, isPph21BukanPegawai: isPph21, usePpn: !isPph21 }));
                                            setShowObjectDropdown(false);
                                        }}>
                                            <div className="font-medium text-gray-800 dark:text-gray-200">{item.name}</div>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                                <span className="bg-gray-100 dark:bg-slate-900 px-1.5 py-0.5 rounded font-mono">{item.code}</span>
                                                <span className="text-indigo-500 font-medium">PPh {item.tax_type}</span>
                                                {item.rate !== undefined && <span className="bg-indigo-100 dark:bg-indigo-900/40 px-1.5 py-0.5 rounded text-indigo-700 dark:text-indigo-300 font-bold ml-auto">{item.rate}%</span>}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </Card>

                <TaxCalculator
                    title="Perhitungan Pajak"
                    onCalculate={setCalcData}
                    initialDpp={calcData.dpp || ''}
                    initialRate={calcData.rate || ''}
                    initialDiscount={calcData.discount || ''}
                    initialMarkupMode={calcData.markupMode}
                    initialIsPph21BukanPegawai={calcData.isPph21BukanPegawai}
                    initialUsePpn={calcData.usePpn}
                    onCopy={onCopy}
                    isReadOnly={isReadOnly}
                />

                {!isReadOnly && <div className="flex justify-end gap-3">
                    {editingId && <button onClick={() => { setEditingId(null); setFormData({ idType: 'NPWP', identityNumber: '', name: '', email: '', taxType: '23', taxObjectCode: '', taxObjectName: '', markupMode: 'none', isPph21BukanPegawai: false, usePpn: true }); setCalcData({ dpp: 0, rate: 0, pph: 0, ppn: 0, totalPayable: 0, discount: 0, dppNet: 0, markupMode: 'none', isPph21BukanPegawai: false, usePpn: true }); }} className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-xl transition-all">Batal Edit</button>}
                    <button onClick={handleSave} disabled={isLoading || !formData.identityNumber || !formData.name} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg transition-all disabled:opacity-50">
                        <Save size={20} /> {isLoading ? 'Menyimpan...' : editingId ? 'Update Data' : 'Simpan Data to Database WP'}
                    </button>
                </div>}
            </div>

            <div className="space-y-6">
                <Card className="bg-slate-50 dark:bg-slate-900 border-dashed border-2 border-slate-200 dark:border-slate-700 h-full flex flex-col justify-center items-center text-center p-8 text-gray-500">
                    <FileText size={48} className="mb-4 text-slate-300" />
                    <p className="font-medium">Summary Data</p>
                    {(calcData.dpp > 0 || formData.name) && (
                        <div className="w-full text-left bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 text-sm space-y-2 mt-4">
                            <div className="flex justify-between"><span className="text-gray-500">Nama:</span><span className="font-medium">{formData.name || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Jenis:</span><span className="font-medium">PPh {formData.taxType}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Total Diterima:</span><span className="font-bold text-emerald-600">{formatCurrency(calcData.totalPayable)}</span></div>
                            <div className="flex justify-between border-t border-gray-100 dark:border-slate-700 pt-2 mt-1">
                                <span className="text-gray-500">DPP + PPN:</span>
                                <span className="font-bold text-indigo-600">{formatCurrency((calcData.calculationDpp || 0) + (calcData.ppn || 0))}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">DPP - PPh:</span>
                                <span className="font-bold text-rose-600">{formatCurrency((calcData.calculationDpp || 0) - (calcData.pph || 0))}</span>
                            </div>
                            {calcData.markupMode !== 'none' && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Gross Up:</span>
                                    <span className="font-bold text-indigo-600 uppercase">{calcData.markupMode}</span>
                                </div>
                            )}
                            {calcData.breakdown && calcData.breakdown.length > 0 && (
                                <div className="mt-4 pt-3 border-t border-dashed border-gray-200 dark:border-slate-700">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Detail Penjumlah:</p>
                                    <div className="space-y-2">
                                        {calcData.breakdown.map((item, i) => (
                                            <div key={i} className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg text-[11px]">
                                                <div className="flex justify-between font-bold">
                                                    <span>Item {i + 1}</span>
                                                    <span>{formatCurrency(item.value)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}