import React, { useState, useEffect, useRef } from 'react';
import { Calculator, Sparkles, TrendingUp, AlertCircle, FileText, Search, Database, User, Download, Upload, Save, Loader2, Book } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card } from '../components/ui/Card';
import TaxCalculator from '../components/tax/TaxCalculator';
import { db as taxService } from '../services/database';
import TaxObjectForm from '../components/tax/TaxObjectForm';
import { API_URL } from '../services/database';
import { parseApiError } from '../utils/errorHandler';
import TaxWpDatabase from '../components/tax/TaxWpDatabase';
import { useToast } from '../components/ui/Toast';
import MasterTaxObjectsTab from '../components/tax/MasterTaxObjectsTab';

export default function TaxCalculation({ onCopy, hasPermission }) {
    const { toast, updateToast } = useToast();
    const [activeTab, setActiveTab] = useState('simulation'); // 'simulation', 'object', 'database', 'master'
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [calcData, setCalcData] = useState({ dpp: 0, rate: 0, pph: 0, ppn: 0, totalPayable: 0, discount: 0, dppNet: 0, markupMode: 'none', isPph21BukanPegawai: false, usePpn: true });
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 15;
    const [editingId, setEditingId] = useState(null);
    const [showObjectDropdown, setShowObjectDropdown] = useState(false);
    const [masterData, setMasterData] = useState([]);
    const [isImporting, setIsImporting] = useState(false);
    const [savedData, setSavedData] = useState([]); // Moved here for TaxWpDatabase

    const masterFileInputRef = useRef(null);

    const canEdit = hasPermission ? hasPermission('tax-calculation', 'edit') : true;
    const canCreate = hasPermission ? hasPermission('tax-calculation', 'create') : true;
    const canDelete = hasPermission ? hasPermission('tax-calculation', 'delete') : true;
    const isReadOnly = !canEdit && !canCreate;

    // Form State for "Objek Pajak"
    const [formData, setFormData] = useState({
        idType: 'NPWP',
        identityNumber: '',
        name: '',
        email: '',
        taxType: '23',
        taxObjectCode: '',
        taxObjectName: '',
        markupMode: 'none',
        isPph21BukanPegawai: false,
        usePpn: true
    });

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            let sanitizedValue = value;
            if (name === 'identityNumber') {
                sanitizedValue = value.replace(/\D/g, '').slice(0, 16);
            }
            const newData = { ...prev, [name]: sanitizedValue };

            // Automation for PPh 21
            if (name === 'taxType' || (name === 'idType' && value === 'KTP' && newData.taxType === '23')) {
                if (name === 'idType' && value === 'KTP' && newData.taxType === '23') {
                    newData.taxType = '21';
                }
                const isPph21 = newData.taxType === '21';
                newData.isPph21BukanPegawai = isPph21;
                newData.usePpn = !isPph21;

                // Also update calculation data to stay in sync
                setCalcData(c => ({ ...c, isPph21BukanPegawai: isPph21, usePpn: !isPph21 }));
            }

            return newData;
        });
    };

    const fetchDatabase = async () => {
        try {
            const data = await taxService.getWpDatabase();
            console.log("[Debug] Raw Data from Service:", data);

            if (Array.isArray(data)) {
                const validData = data.filter(item => item && (item.name || item.identityNumber));
                console.log("WP Database Loaded:", validData.length, "records");
                setSavedData(validData);
                return validData;
            } else {
                console.error("Fetch WP Database returned non-array:", data);
                setSavedData([]);
                return [];
            }
        } catch (error) {
            console.error("Failed to fetch WP Database:", error);
            setSavedData([]);
            return [];
        }
    };

    const fetchMasterData = async () => {
        try {
            const data = await taxService.getTaxObjects();
            // Data sudah dinormalisasi di service

            if (Array.isArray(data)) {
                setMasterData(data);
            } else {
                console.error("Fetch master-tax-objects returned non-array:", data);
                setMasterData([]);
            }
        } catch (error) {
            console.error("Failed to fetch master tax objects:", error);
            setMasterData([]);
        }
    };

    useEffect(() => {
        if (activeTab === 'database') {
            fetchDatabase(); // Call fetchDatabase here
        }
        // Fetch master data once on mount or when switching to object/database
        if (activeTab === 'object' || activeTab === 'database') {
            if (masterData.length === 0) fetchMasterData();
        }
    }, [activeTab]);

    // Real-time sync: auto-refresh WP database and master objects when another client modifies tax data
    useEffect(() => {
        let cleanup;
        import('../services/socketService.js').then(({ getSocket }) => {
            const socket = getSocket();
            const handler = ({ channel }) => {
                if (channel === 'tax') {
                    console.log('[Socket.IO] Tax data changed — refreshing WP database & master...');
                    if (activeTab === 'database') fetchDatabase();
                    if (activeTab === 'master' || activeTab === 'object') fetchMasterData();
                }
            };
            socket.on('data:changed', handler);
            cleanup = () => socket.off('data:changed', handler);
        });
        return () => cleanup?.();
    }, [activeTab]);

    // Reset ke halaman 1 saat mencari atau pindah tab
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, activeTab]);
    // --- DATABASE WP HANDLERS ---
    const handleImportDatabase = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const tid = toast.loading(`Menyiapkan file "${file.name}"...`);
        setIsImporting(true);

        try {
            updateToast(tid, { message: "Mengunggah file ke server...", progress: 30 });
            const result = await taxService.importWpExcel(file);

            if (result && !result.error) {
                updateToast(tid, { message: "Sinkronisasi data & indexing...", progress: 70 });

                // Berikan jeda agar DB commit selesai, lalu verifikasi data
                setTimeout(async () => {
                    const finalData = await fetchDatabase();
                    const finalCount = finalData?.length || 0;

                    if (finalCount === 0) {
                        updateToast(tid, {
                            type: 'error',
                            message: "Kritis: Server melaporkan sukses, tapi 0 data tersimpan. Database sedang diperbaiki otomatis, silakan coba lagi.",
                            progress: 100
                        });
                    } else {
                        updateToast(tid, {
                            type: 'success',
                            message: `Berhasil! ${finalCount} data Wajib Pajak telah disinkronkan.`,
                            progress: 100
                        });
                    }
                }, 3500);
            } else {
                throw new Error(result?.error || "Respons server tidak valid");
            }
        } catch (error) {
            console.error("Import Error Detail:", error);
            updateToast(tid, {
                type: 'error',
                message: `Gagal Import: ${error.message}. Pastikan kolom Excel sudah sesuai template.`
            });
        } finally {
            setIsImporting(false);
            e.target.value = null; // Reset input
        }
    };

    const handleImportMaster = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const tid = toast.loading(`Mengimport Master Objek Pajak...`);
        setIsImporting(true);

        try {
            updateToast(tid, { message: "Memproses file master...", progress: 40 });
            const result = await taxService.importMasterExcel(file);

            if (result && !result.error) {
                updateToast(tid, { message: "Memperbarui daftar objek...", progress: 80 });
                await fetchMasterData();
                updateToast(tid, { type: 'success', message: 'Master Objek Pajak berhasil diperbarui!', progress: 100 });
            } else {
                updateToast(tid, { type: 'error', message: 'Gagal import master: ' + (result?.error || 'Terjadi kesalahan') });
            }
        } catch (error) {
            updateToast(tid, { type: 'error', message: 'Gagal import master: ' + error.message });
        } finally {
            setIsImporting(false);
            e.target.value = null; // Reset input
        }
    };

    const handleDownloadWpTemplate = () => {
        const ws = XLSX.utils.json_to_sheet([
            { "Nama WP": "PT. Contoh Maju", "Jenis Identitas": "NPWP", "Nomor Identitas": "1234567890123456", "Email": "admin@contoh.com", "Jenis Pajak": "23", "Kode Objek": "23-100-01", "Nama Objek": "Sewa Alat", "Gross Up": "none", "Bukan Pegawai": 0, "Gunakan PPN": 1 },
            { "Nama WP": "Budi Santoso", "Jenis Identitas": "KTP", "Nomor Identitas": "3201234567890001", "Email": "budi@email.com", "Jenis Pajak": "21", "Kode Objek": "21-100-01", "Nama Objek": "Upah Harian", "Gross Up": "gross", "Bukan Pegawai": 1, "Gunakan PPN": 0 }
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Database WP");
        XLSX.writeFile(wb, "template_database_wajib_pajak.xlsx");
    };

    const handleDownloadMasterTemplate = () => {
        const ws = XLSX.utils.json_to_sheet([
            { "tax_object_code": "21-100-01", "tax_object_name": "Gaji, Upah, Honorarium, Tunjangan, dan Pembayaran Lain Sehubungan dengan Pekerjaan atau Jabatan", "tax_type": "21", "rate": 0.05, "is_pph21_bukan_pegawai": 1, "use_ppn": 0, "markup_mode": "none" },
            { "tax_object_code": "23-100-01", "tax_object_name": "Sewa dan Penghasilan Lain Sehubungan dengan Penggunaan Harta", "tax_type": "23", "rate": 0.02, "is_pph21_bukan_pegawai": 0, "use_ppn": 1, "markup_mode": "none" },
            { "tax_object_code": "4(2)-100-01", "tax_object_name": "Sewa Tanah dan/atau Bangunan", "tax_type": "4(2)", "rate": 0.10, "is_pph21_bukan_pegawai": 0, "use_ppn": 1, "markup_mode": "none" }
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Master Objek Pajak");
        XLSX.writeFile(wb, "template_master_objek_pajak.xlsx");
    };

    const handleSave = async () => {
        if (!formData.identityNumber || !formData.name) {
            alert('Nomor Identitas dan Nama Wajib Pajak wajib diisi!');
            return;
        }

        if (formData.identityNumber.length !== 16) {
            alert('Nomor Identitas (NPWP/NIK) harus berjumlah 16 digit angka!');
            return;
        }

        const previousData = [...savedData];

        setIsLoading(true);
        try {
            const payload = {
                ...formData, // formData already has markupMode, isPph21BukanPegawai, usePpn
                dpp: calcData.dpp,
                rate: calcData.rate,
                pph: calcData.pph,
                ppn: calcData.ppn,
                totalPayable: calcData.totalPayable,
                discount: calcData.discount,
                dppNet: calcData.dppNet,
                markup_mode: calcData.markupMode,
                is_pph21_bukan_pegawai: calcData.isPph21BukanPegawai ? 1 : 0,
                use_ppn: calcData.usePpn ? 1 : 0,
                email: formData.email
            };

            const result = await taxService.saveWpData(payload, editingId);

            // Optimistic Update
            if (editingId) {
                setSavedData(savedData.map(d => d.id === editingId ? { ...d, ...payload } : d));
            } else {
                setSavedData([...savedData, { ...payload, id: Date.now() }]);
            }

            if (result) {
                alert(`Data berhasil ${editingId ? 'diperbarui' : 'disimpan'} ke Database WP!`);
                setEditingId(null);
                setFormData({
                    idType: 'NPWP',
                    identityNumber: '',
                    name: '',
                    email: '',
                    taxType: '23',
                    taxObjectCode: '',
                    taxObjectName: '',
                    markupMode: 'none',
                    isPph21BukanPegawai: false,
                    usePpn: true
                });
                setCalcData({ dpp: 0, rate: 0, pph: 0, ppn: 0, totalPayable: 0, discount: 0, dppNet: 0, markupMode: 'none', isPph21BukanPegawai: false, usePpn: true });
                setActiveTab('database');
            }
        } catch (error) {
            setSavedData(previousData);
            console.error("Error saving data:", error);
            const msg = await parseApiError(error);
            alert('Gagal menyimpan: ' + msg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEdit = (item) => {
        setEditingId(item.id);
        setFormData({
            idType: item.idType,
            identityNumber: item.identityNumber,
            name: item.name,
            email: item.email || '',
            taxType: item.taxType,
            taxObjectCode: item.taxObjectCode,
            taxObjectName: item.taxObjectName,
            markupMode: item.markupMode || 'none',
            isPph21BukanPegawai: !!item.isPph21BukanPegawai,
            usePpn: !!item.usePpn
        });
        setCalcData({
            dpp: item.dpp,
            rate: item.rate,
            pph: item.pph,
            ppn: item.ppn || (!!item.use_ppn ? (((11 / 12) * (item.dpp - (item.discount || 0))) * 0.12) : 0),
            discount: item.discount || 0,
            dppNet: !!item.use_ppn ? ((11 / 12) * (item.dpp - (item.discount || 0))) : 0,
            markupMode: item.markup_mode || 'none',
            isPph21BukanPegawai: !!item.is_pph21_bukan_pegawai,
            usePpn: item.use_ppn !== undefined ? !!item.use_ppn : true,
            totalPayable: item.total_payable || item.totalPayable ||
                Math.ceil((item.dpp - (item.discount || 0)) + // Recalculate totalPayable if not present
                    (item.ppn || (!!item.use_ppn ? (((11 / 12) * (item.dpp - (item.discount || 0))) * 0.12) : 0)) -
                    item.pph)
        });
        setActiveTab('object');
    };

    const handleDeleteAll = async () => {
        if (!window.confirm('PERINGATAN: Anda akan menghapus SELURUH data di Database WP. Tindakan ini tidak dapat dibatalkan. Lanjutkan?')) return; // Use window.confirm
        if (!canDelete) return alert('Anda tidak memiliki izin untuk menghapus data.');

        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/tax/wp-all`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (res.ok) {
                alert('Seluruh data Database WP berhasil dihapus.');
                fetchDatabase();
            } else {
                const errorText = await res.text();
                const isHtml = errorText.includes('<!DOCTYPE');
                alert(`Gagal menghapus (Status ${res.status}): ${isHtml ? 'API /tax/wp-all tidak ditemukan.' : errorText}`);
            }
        } catch (error) {
            console.error("Delete all error:", error);
            alert('Terjadi kesalahan saat menghapus data.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Yakin ingin menghapus data ini?')) return; // Use window.confirm
        if (!canDelete) return alert('Anda tidak memiliki izin untuk menghapus data.');

        const previousData = [...savedData];
        setSavedData(savedData.filter(d => d.id !== id));

        try {
            await taxService.deleteWpData(id);
        } catch (error) {
            setSavedData(previousData);
            const msg = await parseApiError(error);
            alert('Gagal menghapus data: ' + msg);
        }
    };

    // --- MASTER TAX OBJECT HANDLERS ---
    const handleSaveMaster = async (data) => {
        try {
            await taxService.createTaxObject(data);
            alert('Berhasil menambah objek pajak baru!');
            fetchMasterData();
        } catch (error) {
            const msg = await parseApiError(error);
            alert('Gagal menambah objek: ' + msg);
        }
    };

    const handleUpdateMaster = async (id, data) => {
        try {
            await taxService.updateTaxObject(id, data);
            alert('Berhasil memperbarui objek pajak!');
            fetchMasterData();
        } catch (error) {
            const msg = await parseApiError(error);
            alert('Gagal memperbarui: ' + msg);
        }
    };

    const handleDeleteMaster = async (id) => {
        try {
            await taxService.deleteTaxObject(id);
            alert('Berhasil menghapus objek pajak!');
            fetchMasterData();
        } catch (error) {
            const msg = await parseApiError(error);
            alert('Gagal menghapus: ' + msg);
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    };

    const filteredData = savedData.filter(item =>
        item && (
            (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.identityNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.taxObjectName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.taxObjectCode || '').toLowerCase().includes(searchTerm.toLowerCase())
        ));

    const getSmartInsight = () => {
        // 1. Konteks Pencarian
        if (searchTerm) {
            return {
                text: `Analisis Pencarian: Menampilkan ${filteredData.length} hasil untuk "${searchTerm}". AI memindai nama WP, nomor identitas, dan nama objek pajak.`,
                icon: <Search className="text-indigo-500" size={20} />,
                color: "border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-900/10 text-indigo-800 dark:text-indigo-200"
            };
        }

        // 2. Analisis Master Data
        if (masterData.length === 0) {
            return {
                text: `Data Master Kosong: Gunakan fitur 'Import Master' untuk memuat daftar kode objek pajak resmi agar pengisian data lebih cepat dan akurat.`,
                icon: <AlertCircle className="text-amber-500" size={20} />,
                color: "border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-200"
            };
        }

        // 3. Analisis Kalkulasi Aktif
        if (calcData.pph > 0) {
            return {
                text: `Kalkulasi Terdeteksi: Anda memiliki perhitungan PPh senilai ${formatCurrency(calcData.pph)}. Gunakan tab 'Objek Pajak' untuk menyimpan data ini ke database.`,
                icon: <TrendingUp className="text-emerald-500" size={20} />,
                color: "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/10 text-emerald-800 dark:text-emerald-200"
            };
        }

        // 4. Analisis Kapasitas Database
        if (savedData.length > 50) {
            return {
                text: `Optimasi Database: Terdapat ${savedData.length} record Wajib Pajak. Gunakan fitur 'Export Excel' secara berkala untuk backup data offline.`,
                icon: <Database className="text-blue-500" size={20} />,
                color: "border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-900/10 text-blue-800 dark:text-blue-200"
            };
        }

        // 5. Default Tips
        const tips = [
            "Tips Efisiensi: Anda dapat mencari objek pajak berdasarkan kode (misal: 21-100-01) atau nama deskripsi.",
            "Info AI: Sistem otomatis mendeteksi tarif pajak yang berlaku berdasarkan kode objek yang Anda pilih.",
            "Saran: Pastikan nomor NPWP/NIK valid untuk menghindari kesalahan pelaporan pada sistem e-Bupot.",
            "Sistem Optimal: Database WP tersinkronisasi secara real-time dengan modul pelaporan pajak."
        ];
        return {
            text: tips[new Date().getHours() % tips.length],
            icon: <Sparkles className="text-indigo-500" size={20} />,
            color: "border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-900/10 text-indigo-800 dark:text-indigo-200"
        };
    };

    const insight = getSmartInsight();

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            {/* IMPORT LOADING OVERLAY */}
            {isImporting && (
                <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] shadow-2xl flex flex-col items-center max-w-sm text-center border border-indigo-100 dark:border-indigo-900/50">
                        <div className="relative mb-8">
                            <div className="w-24 h-24 border-4 border-indigo-100 dark:border-indigo-900/30 rounded-full"></div>
                            <div className="w-24 h-24 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                            <Database className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600 animate-pulse" size={32} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-3 uppercase tracking-tight">Memproses Database</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                            Sedang mengimport ratusan data Wajib Pajak ke sistem. <br />
                            <span className="font-bold text-indigo-500">Mohon jangan tutup atau refresh halaman ini.</span>
                        </p>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Calculator className="text-indigo-600" />
                    Tax Calculation
                </h2>

                {/* Tabs */}
                {/* Tabs */}
                <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto">
                    {[
                        { id: 'simulation', label: 'Simulasi PPh', icon: Calculator },
                        { id: 'object', label: 'Objek Pajak', icon: FileText },
                        { id: 'database', label: 'Database WP', icon: Database },
                        { id: 'master', label: 'Master Objek', icon: Book },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id
                                ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* AI SMART INSIGHT BANNER */}
            <div className={`p-4 rounded-2xl border backdrop-blur-md flex items-center gap-4 animate-in slide-in-from-top-4 duration-700 ${insight.color}`}>
                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl shadow-sm shrink-0">
                    {insight.icon}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Smart Assistant</span>
                        <div className="w-1 h-1 rounded-full bg-current opacity-40"></div>
                        <span className="text-[10px] font-bold opacity-60">Tax Intelligence</span>
                    </div>
                    <p className="text-sm font-bold leading-relaxed">{insight.text}</p>
                </div>
            </div>

            {/* SIMULATION TAB */}
            {activeTab === 'simulation' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <TaxCalculator
                        onCalculate={setCalcData}
                        onCopy={onCopy}
                        initialRate={calcData.rate}
                        initialIsPph21BukanPegawai={calcData.isPph21BukanPegawai}
                        initialUsePpn={calcData.usePpn}
                        initialMarkupMode={calcData.markupMode}
                    />

                    {/* Information Card */}
                    <Card className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white border-none h-full">
                        <h3 className="text-xl font-bold mb-4">Informasi Pajak</h3>
                        <p className="text-white/80 mb-6">
                            Gunakan kalkulator ini untuk melakukan estimasi perhitungan PPh berdasarkan DPP dan tarif yang berlaku.
                            Perhitungan ini hanya simulasi dan bukan merupakan bukti potong resmi.
                        </p>
                    </Card>
                </div>
            )}

            {/* MASTER OBJEK TAB */}
            {activeTab === 'master' && (
                <MasterTaxObjectsTab
                    masterData={masterData}
                    onRefresh={fetchMasterData}
                    onSave={handleSaveMaster}
                    onUpdate={handleUpdateMaster}
                    onDelete={handleDeleteMaster}
                    hasPermission={hasPermission}
                />
            )}

            {/* OBJEK PAJAK TAB */}
            {activeTab === 'object' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Form Section */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card className={`relative ${showObjectDropdown ? 'z-30' : 'z-10'}`}>
                            <div className="flex justify-between items-center mb-6 border-b pb-2 dark:border-gray-700">
                                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                    <User size={20} className="text-indigo-600" />
                                    Data Subjek & Objek Pajak
                                </h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleDownloadMasterTemplate}
                                        className="text-xs flex items-center gap-1 text-gray-500 hover:text-indigo-600 transition-colors"
                                        title="Download Template Master Objek Pajak"
                                    >
                                        <Download size={14} /> Template Master
                                    </button>
                                    {canCreate && <button
                                        onClick={() => masterFileInputRef.current.click()}
                                        className="text-xs flex items-center gap-1 text-gray-500 hover:text-indigo-600 transition-colors"
                                        title="Import Master Objek Pajak"
                                    >
                                        <Upload size={14} /> Import Master
                                    </button>}
                                    <input type="file" ref={masterFileInputRef} onChange={handleImportMaster} accept=".xlsx, .xls" className="hidden" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Identity Type */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Jenis Identitas
                                    </label>
                                    <select
                                        name="idType"
                                        value={formData.idType}
                                        onChange={handleInputChange}
                                        disabled={isReadOnly}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
                                    >
                                        <option value="NPWP">NPWP</option>
                                        <option value="KTP">KTP (NIK)</option>
                                    </select>
                                </div>

                                {/* Identity Number */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Nomor Identitas
                                    </label>
                                    <input
                                        type="text"
                                        name="identityNumber"
                                        value={formData.identityNumber}
                                        onChange={handleInputChange}
                                        disabled={isReadOnly}
                                        maxLength={16}
                                        inputMode="numeric"
                                        placeholder="16 digit angka"
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
                                    />
                                </div>

                                {/* Name */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Nama Wajib Pajak
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        disabled={isReadOnly}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
                                        placeholder="Nama Lengkap / Badan Usaha"
                                    />
                                </div>

                                {/* Email */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Email Wajib Pajak
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        disabled={isReadOnly}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
                                        placeholder="contoh@email.com"
                                    />
                                </div>

                                {/* Tax Type */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Jenis Pajak
                                    </label>
                                    <select
                                        name="taxType"
                                        value={formData.taxType}
                                        onChange={handleInputChange}
                                        disabled={isReadOnly}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
                                    >
                                        <option value="23" disabled={formData.idType === 'KTP'}>PPh 23 {formData.idType === 'KTP' ? '(Hanya NPWP)' : ''}</option>
                                        <option value="4(2)">PPh 4(2)</option>
                                        <option value="21">PPh 21</option>
                                        <option value="26">PPh 26</option>
                                    </select>
                                </div>

                                {/* Tax Object Code */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Kode Objek Pajak
                                    </label>
                                    <input
                                        type="text"
                                        name="taxObjectCode"
                                        value={formData.taxObjectCode}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-gray-300 cursor-not-allowed"
                                        placeholder="Auto-fill dari Nama Objek"
                                        readOnly
                                    />
                                </div>

                                {/* Tax Object Name (Searchable Dropdown) */}
                                <div className="md:col-span-2 relative">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Nama Objek Pajak (Cari & Pilih)
                                    </label>
                                    <input
                                        type="text"
                                        name="taxObjectName"
                                        value={formData.taxObjectName}
                                        onChange={(e) => {
                                            if (isReadOnly) return;
                                            handleInputChange(e);
                                            setShowObjectDropdown(true);
                                        }}
                                        onFocus={() => !isReadOnly && setShowObjectDropdown(true)}
                                        onBlur={() => setTimeout(() => setShowObjectDropdown(false), 200)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
                                        placeholder="Ketik untuk mencari objek pajak..."
                                        autoComplete="off"
                                    />

                                    {/* Dropdown List */}
                                    {showObjectDropdown && (
                                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                            {masterData.filter(item =>
                                                String(item.taxType) === String(formData.taxType) && (
                                                    (item.name || '').toLowerCase().includes((formData.taxObjectName || '').toLowerCase()) ||
                                                    (item.code || '').toLowerCase().includes((formData.taxObjectName || '').toLowerCase())
                                                ) && !(formData.idType === 'KTP' && String(item.taxType) === '23')
                                            ).length === 0 ? (
                                                <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                                    Tidak ada data ditemukan. <br />
                                                    <button onClick={() => masterFileInputRef.current.click()} className="text-indigo-600 hover:underline mt-1">
                                                        Import Master Data Sekarang?
                                                    </button>
                                                </div>
                                            ) : (
                                                masterData.filter(item => {
                                                    const search = (formData.taxObjectName || '').toLowerCase();
                                                    const matchesSearch = (item.name || '').toLowerCase().includes(search) ||
                                                        (item.code || '').toLowerCase().includes(search);
                                                    const matchesType = String(item.taxType) === String(formData.taxType);
                                                    const ktpRestriction = !(formData.idType === 'KTP' && String(item.taxType) === '23');
                                                    return matchesSearch && matchesType && ktpRestriction;
                                                }).map((item) => (
                                                    <button
                                                        key={item.id}
                                                        className="w-full text-left px-4 py-3 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors border-b border-gray-100 dark:border-slate-700 last:border-0"
                                                        onClick={() => {
                                                            const isPph21 = String(item.taxType) === '21';
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                taxObjectName: item.name,
                                                                taxObjectCode: item.code || item.taxObjectCode,
                                                                taxType: item.taxType,
                                                                isPph21BukanPegawai: isPph21,
                                                                usePpn: !isPph21
                                                            }));
                                                            // Auto-fill rate in calcData and apply toggles
                                                            setCalcData(prev => ({
                                                                ...prev,
                                                                rate: item.rate !== undefined && item.rate !== null ? item.rate : prev.rate,
                                                                isPph21BukanPegawai: isPph21,
                                                                usePpn: !isPph21
                                                            }));
                                                            setShowObjectDropdown(false);
                                                        }}
                                                    >
                                                        <div className="font-medium text-gray-800 dark:text-gray-200">{item.name}</div>
                                                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                                            <span className="bg-gray-100 dark:bg-slate-900 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400 font-mono">
                                                                {item.code || item.taxObjectCode}
                                                            </span>
                                                            <span className="text-indigo-500 font-medium">PPh {item.taxType}</span>
                                                            {item.rate !== undefined && item.rate !== null && (
                                                                <span className="bg-indigo-100 dark:bg-indigo-900/40 px-1.5 py-0.5 rounded text-indigo-700 dark:text-indigo-300 font-bold ml-auto">
                                                                    {item.rate}%
                                                                </span>
                                                            )}
                                                        </div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>

                        {/* Reusable Calculator Section */}
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

                        {/* Submit Button */}
                        {!isReadOnly && <div className="flex justify-end gap-3">
                            {editingId && (
                                <button
                                    onClick={() => {
                                        setEditingId(null);
                                        setFormData({
                                            idType: 'NPWP',
                                            identityNumber: '',
                                            name: '',
                                            taxType: '23',
                                            taxObjectCode: '',
                                            taxObjectName: '',
                                            markupMode: 'none',
                                            isPph21BukanPegawai: false,
                                            usePpn: true
                                        });
                                        setCalcData({ dpp: 0, rate: 0, pph: 0, ppn: 0, totalPayable: 0, discount: 0, dppNet: 0, markupMode: 'none', isPph21BukanPegawai: false, usePpn: true });
                                    }}
                                    className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-xl transition-all"
                                >
                                    Batal Edit
                                </button>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={isLoading || !formData.identityNumber || !formData.name}
                                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                            >
                                <Save size={20} />
                                {isLoading ? 'Menyimpan...' : editingId ? 'Update Data' : 'Simpan Data to Database WP'}
                            </button>
                        </div>}
                    </div>

                    {/* Summary / Info Sidebar */}
                    <div className="space-y-6">
                        <Card className="bg-slate-50 dark:bg-slate-900 border-dashed border-2 border-slate-200 dark:border-slate-700 h-full flex flex-col justify-center items-center text-center p-8 text-gray-500">
                            <FileText size={48} className="mb-4 text-slate-300" />
                            <p className="font-medium">Summary Data</p>
                            <p className="text-sm mt-2 mb-4">
                                Isi formulir dan lakukan perhitungan untuk melihat ringkasan disini.
                            </p>

                            {(calcData.dpp > 0 || formData.name) && (
                                <div className="w-full text-left bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 text-sm space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Nama:</span>
                                        <span className="font-medium">{formData.name || '-'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Jenis:</span>
                                        <span className="font-medium">PPh {formData.taxType}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Tarif:</span>
                                        <span className="font-medium">{calcData.rate}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Gross Up:</span>
                                        <span className={`font-bold uppercase ${calcData.markupMode !== 'none' ? 'text-indigo-600' : 'text-gray-500'}`}>
                                            {calcData.markupMode}
                                        </span>
                                    </div>
                                    {calcData.isPph21BukanPegawai && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Kategori:</span>
                                            <span className="font-black text-amber-600 text-[10px] uppercase">Bukan Pegawai</span>
                                        </div>
                                    )}
                                    {calcData.markupMode !== 'none' && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Total Dibukukan:</span>
                                            <span className="font-bold text-indigo-600">{new Intl.NumberFormat('id-ID').format(Math.round(calcData.totalDibukukan || 0))}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Total Diterima:</span>
                                        <span className="font-bold text-emerald-600">{formatCurrency(calcData.totalPayable)}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-gray-100 dark:border-slate-700 pt-2 mt-1">
                                        <span className="text-gray-500">DPP + PPN:</span>
                                        <span className="font-bold text-indigo-600">{formatCurrency((calcData.calculationDpp || 0) + (calcData.ppn || 0))}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">DPP - PPh:</span>
                                        <span className="font-bold text-rose-600">{formatCurrency((calcData.calculationDpp || 0) - (calcData.pph || 0))}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Gunakan PPN:</span>
                                        <span className={`font-bold ${calcData.usePpn ? 'text-green-600' : 'text-red-500'}`}>
                                            {calcData.usePpn ? 'Ya (12%)' : 'Tidak'}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 italic mt-4">
                                        Hasil perhitungan otomatis muncul di panel kalkulator di sebelah kiri.
                                    </p>

                                    {/* Breakdown Section for Formula */}
                                    {calcData.breakdown && calcData.breakdown.length > 0 && (
                                        <div className="mt-4 pt-3 border-t border-dashed border-gray-200 dark:border-slate-700">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Detail Penjumlah:</p>
                                            <div className="space-y-2.5">
                                                {calcData.breakdown.map((item, i) => (
                                                    <div key={i} className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] animate-in slide-in-from-left-2" style={{ animationDelay: `${i * 50}ms` }}>
                                                        <div className="flex justify-between font-black text-slate-700 dark:text-slate-200 mb-1.5">
                                                            <span className="opacity-60">Item {i + 1}: {item.label}</span>
                                                            <span>{formatCurrency(item.value)}</span>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="flex justify-between text-indigo-600 dark:text-indigo-400 font-bold">
                                                                <span>PPN:</span>
                                                                <span>+{formatCurrency(item.ppn)}</span>
                                                            </div>
                                                            <div className="flex justify-between text-rose-600 dark:text-rose-400 font-bold">
                                                                <span>PPh:</span>
                                                                <span>-{formatCurrency(item.pph)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Total Breakdown Row */}
                                                <div className="bg-indigo-600 dark:bg-indigo-500 p-3 rounded-xl border border-indigo-400 text-[11px] text-white shadow-lg mt-2 animate-in slide-in-from-bottom-2">
                                                    <div className="flex justify-between font-black mb-1.5">
                                                        <span className="uppercase tracking-wider">Total Penjumlahan</span>
                                                        <span>{formatCurrency(calcData.totalBreakdown?.value || 0)}</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 border-t border-white/20 pt-1.5">
                                                        <div className="flex justify-between font-bold text-indigo-100">
                                                            <span>Total PPN:</span>
                                                            <span>+{formatCurrency(calcData.totalBreakdown?.ppn || 0)}</span>
                                                        </div>
                                                        <div className="flex justify-between font-bold text-rose-100">
                                                            <span>Total PPh:</span>
                                                            <span>-{formatCurrency(calcData.totalBreakdown?.pph || 0)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            )}
            {/* DATABASE WP TAB */}
            {activeTab === 'database' && (
                <TaxWpDatabase
                    savedData={filteredData} // FIX: Gunakan filteredData agar pencarian berfungsi
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                    rowsPerPage={rowsPerPage}
                    handleEdit={handleEdit}
                    handleDelete={handleDelete}
                    handleDeleteAll={handleDeleteAll}
                    handleImportDatabase={handleImportDatabase}
                    onCopy={onCopy}
                    onRefresh={fetchDatabase} // Tambahkan prop refresh
                    onDownloadTemplate={handleDownloadWpTemplate} // Tambahkan prop template
                    canCreate={canCreate}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    isLoading={isLoading}
                    isImporting={isImporting}
                />
            )}
        </div>
    );
}
