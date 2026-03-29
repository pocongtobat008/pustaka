import React from 'react';
import {
    Package, History, Edit3, Trash2, ChevronRight, ChevronLeft,
    FolderOpen, Paperclip, Plus, Save, RefreshCw,
    Eye, X, ArrowLeftRight, CheckCircle2, Clock,
    AlertCircle, Truck, LogOut, FileText, Download, User, Shield
} from 'lucide-react';
import PdfViewer from '../ui/PdfViewer';
import { useState, useEffect } from 'react';

function OrdnerInput({ editingItem, newOrdner, setNewOrdner, addOrdner }) {
    const [local, setLocal] = useState({ noOrdner: '', period: '' });

    useEffect(() => {
        setLocal({ noOrdner: newOrdner.noOrdner || '', period: newOrdner.period || '' });
    }, [newOrdner, editingItem]);

    return (
        <>
            <div className="flex-1">
                <label className="text-[10px] uppercase font-black text-slate-400 ml-1 mb-2 block tracking-[0.2em]">No Ordner</label>
                <input
                    value={local.noOrdner}
                    onChange={e => setLocal(prev => ({ ...prev, noOrdner: e.target.value }))}
                    onBlur={() => setNewOrdner(prev => ({ ...prev, noOrdner: local.noOrdner }))}
                    className="w-full px-4 py-3 border-b-2 border-transparent bg-white/50 dark:bg-slate-900/50 rounded-xl focus:border-indigo-500 dark:text-white text-sm font-black transition-all outline-none"
                    placeholder="ORD-001"
                />
            </div>
            <div className="flex-1">
                <label className="text-[10px] uppercase font-black text-slate-400 ml-1 mb-2 block tracking-[0.2em]">Periode</label>
                <input
                    value={local.period}
                    onChange={e => setLocal(prev => ({ ...prev, period: e.target.value }))}
                    onBlur={() => setNewOrdner(prev => ({ ...prev, period: local.period }))}
                    className="w-full px-4 py-3 border-b-2 border-transparent bg-white/50 dark:bg-slate-900/50 rounded-xl focus:border-indigo-500 dark:text-white text-sm font-black transition-all outline-none"
                    placeholder="2024"
                />
            </div>
            <button
                onClick={() => addOrdner(local)}
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg transition-all hover:scale-105 active:scale-95 ${editingItem?.type === 'ordner' ? 'bg-amber-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}
            >
                {editingItem?.type === 'ordner' ? <Save size={20} /> : <Plus size={20} />}
            </button>
        </>
    );
}

function InvoiceInput({ newInvoice, setNewInvoice, invoiceFileInputRef, handleInvoiceFileSelect, addInvoice, ord, editingItem }) {
    const [local, setLocal] = useState({
        invoiceNo: '', vendor: '', paymentDate: '', taxInvoiceNo: '', specialNote: '', file: null, fileName: '', rawFile: null, isProcessing: false
    });

    useEffect(() => {
        // Only apply incoming values when they are meaningful (non-empty strings
        // or defined non-null values). This prevents file attach updates (which
        // may set parent `newInvoice` fields to empty strings) from wiping
        // user-typed local input.
        setLocal(prev => {
            const pickString = (key) => {
                const v = newInvoice[key];
                if (typeof v === 'string') return v.trim().length > 0 ? v : prev[key];
                return (v !== undefined && v !== null) ? v : prev[key];
            };

            return {
                invoiceNo: pickString('invoiceNo'),
                vendor: pickString('vendor'),
                paymentDate: pickString('paymentDate'),
                taxInvoiceNo: pickString('taxInvoiceNo'),
                specialNote: pickString('specialNote'),
                file: newInvoice.file ?? prev.file,
                rawFile: newInvoice.rawFile ?? prev.rawFile,
                fileName: (typeof newInvoice.fileName === 'string' && newInvoice.fileName.trim().length > 0) ? newInvoice.fileName : prev.fileName,
                isProcessing: (newInvoice.isProcessing !== undefined && newInvoice.isProcessing !== null) ? newInvoice.isProcessing : prev.isProcessing
            };
        });
    }, [newInvoice, editingItem]);

    return (
        <div className="flex flex-col gap-3 bg-white/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-white/50 dark:border-white/5 w-full">
            <div className="flex gap-3 items-center">
                <input placeholder="NO INVOICE" value={local.invoiceNo} onChange={e => setLocal(prev => ({ ...prev, invoiceNo: e.target.value }))} className="flex-1 min-w-[100px] px-3 py-2 text-[10px] border-b border-slate-200 dark:border-slate-800 bg-transparent dark:text-white font-black uppercase tracking-wider focus:ring-0" title="Nomor Invoice" />
                <input placeholder="VENDOR" value={local.vendor} onChange={e => setLocal(prev => ({ ...prev, vendor: e.target.value }))} className="flex-1 min-w-[100px] px-3 py-2 text-[10px] border-b border-slate-200 dark:border-slate-800 bg-transparent dark:text-white font-black uppercase tracking-wider focus:ring-0" title="Nama Vendor" />
                <input placeholder="NO FAKTUR" value={local.taxInvoiceNo} onChange={e => setLocal(prev => ({ ...prev, taxInvoiceNo: e.target.value }))} className="flex-1 min-w-[100px] px-3 py-2 text-[10px] border-b border-indigo-500/20 bg-transparent dark:text-white font-black uppercase tracking-wider focus:ring-0" title="Nomor Faktur Pajak" />
                <input type="date" value={local.paymentDate} onChange={e => setLocal(prev => ({ ...prev, paymentDate: e.target.value }))} className="w-28 px-3 py-2 text-[10px] border-b border-slate-200 dark:border-slate-800 bg-transparent dark:text-white font-black focus:ring-0" title="Tanggal Pembayaran" />
            </div>
            <div className="flex gap-3 items-center">
                <input placeholder="KETERANGAN KUSUS (OPSIONAL)..." value={local.specialNote} onChange={e => setLocal(prev => ({ ...prev, specialNote: e.target.value }))} className="flex-1 px-3 py-2 text-[10px] border-b border-amber-500/20 bg-transparent dark:text-white font-bold uppercase tracking-wider focus:ring-0" title="Keterangan Kusus" />

                <div className="relative">
                    <input type="file" ref={invoiceFileInputRef} className="hidden" onChange={(e) => { handleInvoiceFileSelect(e); setLocal(prev => ({ ...prev, file: e.target.files[0], rawFile: e.target.files[0], fileName: e.target.files[0]?.name })); }} accept="image/*,.pdf,.docx,.doc,.xlsx,.xls,.pptx" />
                    <button onClick={() => invoiceFileInputRef.current.click()} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${local.file ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`} title={local.fileName || "Lampirkan File (OCR Auto)"}>
                        {local.isProcessing ? <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /> : <Paperclip size={14} />}
                    </button>
                </div>

                <button onClick={() => { addInvoice(ord.id, local); setLocal({ invoiceNo: '', vendor: '', paymentDate: '', taxInvoiceNo: '', specialNote: '', file: null, fileName: '', rawFile: null, isProcessing: false }); }} className={`w-8 h-8 rounded-lg flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 ${editingItem?.type === 'invoice' ? 'bg-amber-500' : 'bg-indigo-600'}`}>
                    {editingItem?.type === 'invoice' ? <Save size={14} /> : <Plus size={14} />}
                </button>
            </div>
        </div>
    );
}

export default function InventoryModals({
    modalTab, setModalTab,
    selectedSlotId, selectedExternalItem, inventory,
    boxForm, setBoxForm, hasPermission,
    newOrdner, setNewOrdner, addOrdner, editOrdner, removeOrdner,
    expandedOrdnerIds, setExpandedOrdnerIds,
    newInvoice, setNewInvoice, addInvoice, editInvoice, removeInvoice, handleViewInvoice,
    editingItem, showMoveInput, setShowMoveInput,
    moveTargetSlot, setMoveTargetSlot, handleMoveBox, handleSaveBox,
    handleStatusChange, setShowExternalForm, setExternalDate, handleEmptySlot,
    invoiceFileInputRef, handleInvoiceFileSelect, fetchInventory,
    selectedInvoice, handleDownloadInvoice, isGeneratingPreview,
    getFullUrl, pdfBlobUrl, previewHtml,
    handleResetSlot, inventoryIssues = []
}) {
    if (!['details', 'history', 'invoice-detail'].includes(modalTab)) return null;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pt-4">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -z-10 animate-pulse"></div>

            {/* Header Box ID - Capsule Style */}
            <div className="bg-white/40 dark:bg-slate-900/40 p-5 rounded-[2rem] border border-white/60 dark:border-white/5 shadow-sm mb-8 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-600 shadow-inner">
                        <Package size={24} />
                    </div>
                    <div className="flex flex-col min-w-[120px]">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-0.5">Status Lokasi</span>
                        <span className="font-black text-slate-800 dark:text-white text-sm whitespace-nowrap">{selectedSlotId ? `INTERNAL SLOT #${selectedSlotId}` : 'EXTERNAL ITEM'}</span>
                    </div>
                    <div className="h-8 w-px bg-slate-200 dark:bg-white/10 mx-2"></div>
                    <div className="flex-1 relative group/input">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-0.5 block ml-1">Nama Kardus</span>
                        <input
                            type="text"
                            value={boxForm.boxId}
                            onChange={(e) => setBoxForm(prev => ({ ...prev, boxId: e.target.value }))}
                            className="text-base font-black text-slate-900 dark:text-white bg-transparent border-0 focus:ring-0 w-full placeholder:text-slate-300 focus:outline-none transition-all p-1"
                            placeholder="KETIK NAMA KARDUS..."
                        />
                    </div>
                </div>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex bg-slate-100/50 dark:bg-slate-800/50 p-1.5 rounded-2xl mb-8 backdrop-blur-sm border border-white/20 dark:border-white/5">
                <button
                    onClick={() => setModalTab('details')}
                    className={`flex-1 py-3 text-sm font-black rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${modalTab === 'details' ? 'bg-white dark:bg-slate-700 shadow-xl text-indigo-600 dark:text-white scale-[1.02] ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'}`}
                >
                    <Package size={18} /> Detail Isi Kardus
                </button>
                <button
                    onClick={() => setModalTab('history')}
                    className={`flex-1 py-3 text-sm font-black rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${modalTab === 'history' ? 'bg-white dark:bg-slate-700 shadow-xl text-indigo-600 dark:text-white scale-[1.02] ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'}`}
                >
                    <History size={18} /> Riwayat Mutasi
                </button>
            </div >

            {modalTab === 'details' && (
                <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500">
                    {/* Input Area - Integrated Row */}
                    {hasPermission('inventory', 'edit') && (
                        <div className="flex gap-4 items-end bg-indigo-500/5 dark:bg-indigo-500/10 p-6 rounded-3xl border border-indigo-500/10 group/input transition-all hover:bg-indigo-500/[0.08]">
                            <OrdnerInput
                                hasPermission={hasPermission}
                                editingItem={editingItem}
                                newOrdner={newOrdner}
                                setNewOrdner={setNewOrdner}
                                addOrdner={addOrdner}
                                editOrdner={editOrdner}
                            />
                        </div>
                    )
                    }

                    <div className="space-y-3 max-h-[450px] overflow-y-auto pr-3 custom-scrollbar">
                        {(boxForm.ordners || []).length === 0 && (
                            <div className="text-center py-16 text-slate-300">
                                <Package size={48} className="mx-auto mb-4 opacity-20" />
                                <p className="font-black text-sm tracking-widest uppercase opacity-40">Kardus Kosong</p>
                            </div>
                        )}
                        {(boxForm.ordners || []).map((ord, ordIdx) => (
                            <div key={ord.id || `ordner-${ordIdx}`} className={`group transition-all duration-300 rounded-3xl border ${expandedOrdnerIds.includes(ord.id) ? 'bg-indigo-500/10 border-indigo-500/30 shadow-lg shadow-indigo-500/5' : 'bg-white/40 dark:bg-slate-800/40 border-white/50 dark:border-white/5 hover:bg-white/60 dark:hover:bg-slate-800/60'}`}>
                                <div className="flex justify-between items-center p-4 cursor-pointer" onClick={() => setExpandedOrdnerIds(prev => prev.includes(ord.id) ? prev.filter(id => id !== ord.id) : [...prev, ord.id])}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${expandedOrdnerIds.includes(ord.id) ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/40'}`}>
                                            {expandedOrdnerIds.includes(ord.id) ? <FolderOpen size={20} /> : <Package size={20} />}
                                        </div>
                                        <div>
                                            <div className="font-black dark:text-white text-base text-slate-800 tracking-tight">{ord.noOrdner}</div>
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{ord.period}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0 mr-2">
                                            {hasPermission('inventory', 'edit') && (
                                                <button onClick={(e) => { e.stopPropagation(); editOrdner(ord); }} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 transition-all"><Edit3 size={14} /></button>
                                            )}
                                            {hasPermission('inventory', 'delete') && (
                                                <button onClick={(e) => { e.stopPropagation(); removeOrdner(ord.id); }} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 transition-all"><Trash2 size={14} /></button>
                                            )}
                                        </div>
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${expandedOrdnerIds.includes(ord.id) ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                                            <ChevronRight size={22} className={`transition-transform duration-300 ${expandedOrdnerIds.includes(ord.id) ? 'rotate-90' : ''}`} />
                                        </div>
                                    </div>
                                </div >

                                {/* Nested Invoice - Minimalist List */}
                                {
                                    expandedOrdnerIds.includes(ord.id) && (
                                        <div className="px-4 pb-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                            {hasPermission('inventory', 'edit') && (
                                                <InvoiceInput
                                                    newInvoice={newInvoice}
                                                    setNewInvoice={setNewInvoice}
                                                    invoiceFileInputRef={invoiceFileInputRef}
                                                    handleInvoiceFileSelect={handleInvoiceFileSelect}
                                                    addInvoice={addInvoice}
                                                    ord={ord}
                                                    editingItem={editingItem}
                                                />
                                            )
                                            }

                                            {/* Manual Refresh Button for OCR */}
                                            <div className="flex justify-end mb-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); fetchInventory(); }}
                                                    className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
                                                >
                                                    <RefreshCw size={12} /> Refresh Status OCR
                                                </button>
                                            </div>

                                            <div className="space-y-1">
                                                {(ord.invoices || []).map(inv => {
                                                    return (
                                                        <div key={inv.id} className="group/inv flex items-center justify-between p-3 hover:bg-white dark:hover:bg-slate-900/50 rounded-xl transition-all border border-transparent hover:border-slate-200 dark:hover:border-white/5">
                                                            <div className="flex items-center gap-3">
                                                                <FileText size={14} className="text-slate-400 group-hover/inv:text-indigo-500 transition-colors" />
                                                                <div className="flex flex-col">
                                                                    <span className="font-black text-xs text-slate-700 dark:text-white tracking-tight">{inv.invoiceNo ? String(inv.invoiceNo) : '-'}</span>
                                                                    <div className="flex items-center gap-2 mt-0.5">
                                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{inv.vendor ? String(inv.vendor) : ''}</span>
                                                                        {inv.paymentDate && <span className="text-[10px] font-black text-emerald-600 px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-md">{String(inv.paymentDate)}</span>}
                                                                    </div>
                                                                    {inv.fileName && (
                                                                        <div className="flex items-center gap-1 text-[9px] text-slate-400 mt-1">
                                                                            <Paperclip size={10} /> {String(inv.fileName)}
                                                                            {inv.status === 'uploading' ? (
                                                                                <span className="text-indigo-500 font-bold text-[8px] border border-indigo-200 dark:border-indigo-800 px-1 rounded ml-1 animate-pulse">UPLOADING...</span>
                                                                            ) : inv.status === 'done' ? (
                                                                                <span className="text-emerald-500 font-bold text-[8px] border border-emerald-200 dark:border-emerald-800 px-1 rounded ml-1">OCR READY</span>
                                                                            ) : (
                                                                                <span className="text-amber-500 font-bold text-[8px] border border-amber-200 dark:border-amber-800 px-1 rounded ml-1 animate-pulse">PROSES OCR...</span>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-1 opacity-0 group-hover/inv:opacity-100 transition-all">
                                                                <button onClick={() => inv.status !== 'uploading' && handleViewInvoice(inv)} className={`p-1.5 text-slate-400 transition-colors ${inv.status === 'uploading' ? 'opacity-40 cursor-not-allowed' : 'hover:text-indigo-600'}`} title="Lihat Detail"><Eye size={12} /></button>
                                                                {hasPermission('inventory', 'edit') && (
                                                                    <button onClick={() => editInvoice(inv, ord.id)} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"><Edit3 size={12} /></button>
                                                                )}
                                                                {hasPermission('inventory', 'delete') && (
                                                                    <button onClick={() => removeInvoice(ord.id, inv.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"><X size={12} /></button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div >
                                    )}
                            </div >
                        ))}
                    </div >

                    {/* FOOTER ACTIONS - Capsule Style */}
                    < div className="bg-white/40 dark:bg-slate-900/40 p-6 rounded-[2.5rem] border border-white/60 dark:border-white/5 shadow-sm mt-8 backdrop-blur-sm" >
                        <div className="flex flex-wrap items-center justify-between gap-6">
                            <div className="flex gap-4">
                                {selectedSlotId && hasPermission('inventory', 'edit') && (
                                    <button
                                        onClick={() => setShowMoveInput(!showMoveInput)}
                                        className={`px-8 py-4 rounded-2xl text-[10px] font-black flex items-center gap-3 transition-all active:scale-95 ${showMoveInput ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/30' : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 hover:text-indigo-600 border border-slate-200 dark:border-white/5 shadow-sm'}`}
                                    >
                                        <ArrowLeftRight size={18} /> PINDAH SLOT
                                    </button>
                                )}
                            </div>

                            {
                                selectedSlotId && hasPermission('inventory', 'edit') && (
                                    <button
                                        onClick={handleSaveBox}
                                        className="px-12 py-4 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-2xl shadow-2xl shadow-indigo-500/20 flex items-center gap-3 text-[10px] font-black transition-all hover:shadow-indigo-500/40 active:scale-95 hover:-translate-y-1"
                                    >
                                        <Save size={18} /> SIMPAN DATA
                                    </button>
                                )
                            }
                        </div >

                        {/* Row 2: Move Input */}
                        {
                            showMoveInput && (
                                <div className="mt-6 flex gap-4 items-center bg-indigo-500/5 dark:bg-indigo-500/10 p-5 rounded-3xl border border-indigo-500/10 animate-in slide-in-from-top-2 duration-300">
                                    <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                        <ArrowLeftRight size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-300 uppercase tracking-widest block mb-1 ml-1">Slot Tujuan</span>
                                        <input
                                            type="number"
                                            placeholder="1-100"
                                            value={moveTargetSlot}
                                            onChange={(e) => setMoveTargetSlot(e.target.value)}
                                            className="w-full bg-transparent border-0 text-lg font-black dark:text-white placeholder:text-slate-300 focus:ring-0 p-0"
                                        />
                                    </div>
                                    <button
                                        onClick={handleMoveBox}
                                        className="px-8 py-3 bg-indigo-600 text-white text-[10px] font-black rounded-xl hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 transition-all active:scale-95"
                                    >
                                        KONFIRMASI
                                    </button>
                                </div>
                            )
                        }

                        {/* Row 3: Status & External Actions - Capsule Style */}
                        {
                            (selectedSlotId || selectedExternalItem) && (selectedSlotId ? (inventory.find(s => s.id == selectedSlotId) || inventory[selectedSlotId - 1])?.status !== 'EMPTY' : true) && (
                                <div className="bg-white/40 dark:bg-slate-900/40 p-6 rounded-[2.5rem] border border-white/60 dark:border-white/5 shadow-sm mt-8 backdrop-blur-sm">
                                    <div className={`grid ${selectedSlotId ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                                        {selectedSlotId && hasPermission('inventory', 'edit') && (
                                            <>
                                                {((inventory.find(s => s.id == selectedSlotId) || inventory[selectedSlotId - 1])?.status === 'BORROWED' || (inventory.find(s => s.id == selectedSlotId) || inventory[selectedSlotId - 1])?.status === 'AUDIT') ? (
                                                    <button onClick={() => handleStatusChange('STORED', 'Dikembalikan User')} className="p-5 border-2 border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-3xl text-sm font-black flex items-center justify-center gap-3 transition-all transform active:scale-95 group shadow-sm">
                                                        <CheckCircle2 size={24} className="group-hover:scale-110 transition-transform" /> KEMBALIKAN
                                                    </button>
                                                ) : (
                                                    <button onClick={() => handleStatusChange('BORROWED', 'Dipinjam User')} className="p-5 border-2 border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-3xl text-sm font-black flex items-center justify-center gap-3 transition-all transform active:scale-95 group shadow-sm">
                                                        <Clock size={24} className="group-hover:scale-110 transition-transform" /> SET DIPINJAM
                                                    </button>
                                                )}
                                                <button onClick={() => handleStatusChange('AUDIT', 'Sedang Audit')} className="p-5 border-2 border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-3xl text-sm font-black flex items-center justify-center gap-3 transition-all transform active:scale-95 group shadow-sm">
                                                    <AlertCircle size={24} className="group-hover:scale-110 transition-transform" /> SET AUDIT
                                                </button>
                                                <button onClick={() => {
                                                    setShowExternalForm(true);
                                                    setExternalDate(new Date().toISOString().split('T')[0]);
                                                }} className="p-5 border-2 border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-3xl text-sm font-black flex items-center justify-center gap-3 transition-all transform active:scale-95 group shadow-sm">
                                                    <Truck size={24} className="group-hover:scale-110 transition-transform" /> KIRIM KE INDOARSIP
                                                </button>
                                            </>
                                        )}
                                        {hasPermission('inventory', 'delete') && (
                                            <button onClick={handleEmptySlot} className="p-5 border-2 border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-600 dark:text-red-400 rounded-3xl text-sm font-black flex items-center justify-center gap-3 transition-all transform active:scale-95 group shadow-sm">
                                                <LogOut size={24} className="group-hover:scale-110 transition-transform" /> KOSONGKAN
                                            </button>
                                        )}

                                        {/* EMERGENCY RESET BUTTON FOR CORRUPTED/DUPLICATE SLOTS */}
                                        {selectedSlotId && hasPermission('inventory', 'delete') && inventoryIssues.some(issue => (Number(issue.slotId) === Number(selectedSlotId) || (issue.slots && issue.slots.includes(Number(selectedSlotId)))) && (issue.type === 'CORRUPT' || issue.type === 'DUPLICATE')) && (
                                            <button
                                                onClick={() => handleResetSlot(selectedSlotId)}
                                                className="col-span-2 p-5 border-4 border-red-600 bg-red-600 text-white rounded-3xl text-sm font-black flex items-center justify-center gap-3 transition-all transform active:scale-95 group shadow-2xl animate-pulse"
                                            >
                                                <Shield size={24} className="group-hover:rotate-12 transition-transform" /> PERBAIKI DATA (RESET SLOT)
                                            </button>
                                        )}
                                    </div>
                                </div >
                            )
                        }

                    </div >
                </div >
            )}

            {
                modalTab === 'history' && (
                    <div className="space-y-6 py-4 animate-in fade-in duration-500 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
                        {/* Current Status Summary Card */}
                        <div className="bg-indigo-600 rounded-[2rem] p-6 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden mb-8">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <History size={120} />
                            </div>
                            <div className="relative z-10">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-100 mb-2">Status Terkini Kardus</p>
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
                                        <Package size={28} />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black tracking-tight">{boxForm.boxId}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="px-2 py-0.5 bg-white/20 rounded-lg text-[10px] font-black uppercase tracking-wider">
                                                {selectedSlotId ? `Slot #${selectedSlotId}` : selectedExternalItem?.destination || 'External'}
                                            </span>
                                            <div className="w-1 h-1 rounded-full bg-white/40"></div>
                                            <span className="text-[10px] font-bold text-indigo-100">
                                                Update: {new Date((selectedSlotId ? (inventory.find(s => s.id == selectedSlotId))?.lastUpdated : selectedExternalItem?.sentDate) || Date.now()).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="relative pl-4">
                            {/* Vertical Trail Line */}
                            <div className="absolute left-[39px] top-4 bottom-4 w-1 bg-slate-100 dark:bg-slate-800 rounded-full"></div>

                            {(() => {
                                const history = (selectedSlotId ? (inventory.find(s => s.id == selectedSlotId))?.history : selectedExternalItem?.history) || [];
                                if (history.length === 0) {
                                    return (
                                        <div className="text-center py-20 text-slate-400 italic">
                                            <div className="flex justify-center mb-4 opacity-20"><History size={64} /></div>
                                            <p className="font-black tracking-widest uppercase text-xs">Belum ada riwayat tercatat.</p>
                                        </div>
                                    );
                                }

                                return history.slice().reverse().map((hist, idx) => {
                                    // Ensure all history fields exist with defaults
                                    const histItem = {
                                        action: hist.action || 'UNKNOWN',
                                        note: hist.note || '',
                                        timestamp: hist.timestamp || new Date().toISOString(),
                                        user: hist.user || 'System'
                                    };
                                    const getActionConfig = (action) => {
                                        const a = action?.toUpperCase();
                                        if (a === 'CREATED' || a === 'IMPORTED') return { icon: Plus, color: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50' };
                                        if (a === 'STORED' || a === 'RESTORED') return { icon: CheckCircle2, color: 'bg-indigo-500', text: 'text-indigo-600', bg: 'bg-indigo-50' };
                                        if (a === 'MOVED') return { icon: ArrowLeftRight, color: 'bg-blue-500', text: 'text-blue-600', bg: 'bg-blue-50' };
                                        if (a === 'BORROWED') return { icon: User, color: 'bg-amber-500', text: 'text-amber-600', bg: 'bg-amber-50' };
                                        if (a === 'AUDIT') return { icon: Shield, color: 'bg-purple-500', text: 'text-purple-600', bg: 'bg-purple-50' };
                                        if (a === 'EXTERNAL') return { icon: Truck, color: 'bg-orange-500', text: 'text-orange-600', bg: 'bg-orange-50' };
                                        if (a === 'REMOVED') return { icon: Trash2, color: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-50' };
                                        return { icon: History, color: 'bg-slate-500', text: 'text-slate-600', bg: 'bg-slate-50' };
                                    };

                                    const config = getActionConfig(histItem.action);
                                    const Icon = config.icon;

                                    return (
                                        <div key={idx} className="relative pl-16 pb-10 group last:pb-0">
                                            {/* Trail Node */}
                                            <div className={`absolute left-0 top-0 w-12 h-12 rounded-2xl border-4 border-white dark:border-slate-900 shadow-xl z-10 transition-all group-hover:scale-110 flex items-center justify-center ${config.color} text-white`}>
                                                <Icon size={20} />
                                            </div>

                                            {/* Content Card */}
                                            <div className="bg-white dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm group-hover:shadow-md transition-all group-hover:-translate-y-1">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${config.bg} ${config.text}`}>
                                                            {histItem.action}
                                                        </span>
                                                        <h4 className="mt-2 font-bold text-slate-800 dark:text-white text-sm leading-tight">
                                                            {histItem.note}
                                                        </h4>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="flex items-center justify-end gap-1.5 text-[10px] font-black text-slate-400">
                                                            <Clock size={10} /> {new Date(histItem.timestamp).toLocaleDateString()}
                                                        </div>
                                                        <div className="text-[9px] font-bold text-slate-300 mt-0.5">
                                                            {new Date(histItem.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50 dark:border-white/5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-black text-slate-500">
                                                            {histItem.user?.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Oleh: <span className="text-indigo-500">{histItem.user}</span></span>
                                                    </div>
                                                    <div className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">Verified Trail</div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div >
                    </div >
                )}

            {
                modalTab === 'invoice-detail' && selectedInvoice && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <button onClick={() => setModalTab('details')} className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors uppercase tracking-wider">
                            <ChevronLeft size={14} /> Kembali ke Daftar
                        </button>

                        <div className="bg-white/50 dark:bg-slate-800/50 p-6 rounded-3xl border border-white/60 dark:border-white/5 shadow-sm">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Nomor Invoice</span>
                                    <h3 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">{selectedInvoice.invoiceNo || '-'}</h3>
                                </div>
                                {selectedInvoice.paymentDate && (
                                    <div className="text-right">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Tanggal Bayar</span>
                                        <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-black">{String(selectedInvoice.paymentDate)}</span>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-6 mb-6">
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Vendor</span>
                                    <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{selectedInvoice.vendor || '-'}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Lokasi File (Kardus / Ordner)</span>
                                    <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                                        {selectedInvoice.location || selectedInvoice.folderName || 'Inventory'}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6 mb-6">
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">No Faktur Pajak</span>
                                    <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{selectedInvoice.taxInvoiceNo || '-'}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Lampiran File</span>
                                    {selectedInvoice.fileName ? <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm"><Paperclip size={16} /> {String(selectedInvoice.fileName)}</div> : <span className="text-sm text-slate-400 italic">Tidak ada file</span>}
                                </div>
                            </div>

                            <div className="mb-6">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Keterangan Kusus</span>
                                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl">
                                    <p className="text-sm font-medium text-amber-900 dark:text-amber-200 leading-relaxed italic">
                                        {selectedInvoice.specialNote || 'Tidak ada keterangan kusus.'}
                                    </p>
                                </div>
                            </div>

                            {selectedInvoice.file && <button onClick={() => handleDownloadInvoice(selectedInvoice)} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"><Download size={18} /> Download Lampiran PDF/Gambar</button>}

                            {/* Invoice Preview */}
                            {selectedInvoice.file && (
                                <div className="mt-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-inner">
                                    <div className="p-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Preview Lampiran</span>
                                    </div>
                                    <div className="h-[450px] overflow-auto bg-slate-50 dark:bg-slate-950 flex items-center justify-center relative">
                                        {isGeneratingPreview ? (
                                            <div className="flex flex-col items-center gap-3">
                                                <RefreshCw size={32} className="text-indigo-500 animate-spin" />
                                                <p className="text-[10px] font-bold text-slate-500 animate-pulse uppercase tracking-widest text-center">Menyiapkan Preview...</p>
                                            </div>
                                        ) : (typeof selectedInvoice.file === 'string' && (selectedInvoice.file.match(/.(jpg|jpeg|png|webp)$/i) || selectedInvoice.file.startsWith('data:image'))) ? (
                                            <img src={getFullUrl(selectedInvoice.file)} alt="Invoice Preview" className="max-w-full mx-auto" />
                                        ) : (pdfBlobUrl) ? (
                                            <PdfViewer src={pdfBlobUrl} className="w-full h-full" />
                                        ) : (previewHtml) ? (
                                            <div className="w-full h-full p-6 prose dark:prose-invert max-w-none overflow-auto custom-scrollbar" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full py-12 text-slate-400 text-center px-6">
                                                <FileText size={48} className="mb-4 opacity-20" />
                                                <p className="text-xs font-black uppercase tracking-[0.2em] mb-2 text-slate-500/80">Preview Terbatas</p>
                                                <p className="text-[10px] opacity-60 leading-relaxed">Sistem tidak dapat menampilkan pratinjau langsung untuk format ini atau file tidak ditemukan.<br />Gunakan tombol <b>Download</b> di atas untuk melihat file secara penuh.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {selectedInvoice.ocrContent && (
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-3xl border border-slate-200 dark:border-slate-800">
                                <div className="flex items-center gap-2 mb-3"><FileText size={16} className="text-indigo-500" /><h4 className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">Hasil Scan OCR</h4></div>
                                <div className="p-4 bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs font-mono text-slate-600 dark:text-slate-400 leading-relaxed max-h-60 overflow-y-auto custom-scrollbar whitespace-pre-wrap">{typeof selectedInvoice.ocrContent === 'object' ? JSON.stringify(selectedInvoice.ocrContent, null, 2) : selectedInvoice.ocrContent}</div>
                            </div>
                        )}
                    </div>
                )
            }
        </div >
    );
}
