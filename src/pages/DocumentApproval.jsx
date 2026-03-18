import React, { useState, useRef, useEffect } from 'react';
import {
    FileCheck, Plus, Search, Clock, CheckCircle2, XCircle, User,
    Building2, Paperclip, Send, ChevronRight, MoreVertical,
    Trash2, Eye, Download, MessageSquare, ShieldCheck, ArrowRight, Edit3,
    FileDigit, FileText, Sparkles, Map, List
} from 'lucide-react';
import WorkflowViewer from '../components/workflow/WorkflowViewer';
import { Card, SummaryCard } from '../components/ui/Card';
import Modal from '../components/common/Modal';
import { parseApiError } from '../utils/errorHandler';
import { getFullUrl } from '../utils/urlHelper';
import { db as api } from '../services/database';

export default function DocumentApproval({ approvals = [], users = [], departments = [], currentUser, onRefresh, hasPermission, flows = [], syncApprovalFolder }) {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedApproval, setSelectedApproval] = useState(null);
    const [editingApproval, setEditingApproval] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [previewFile, setPreviewFile] = useState(null);

    // Form State
    const [form, setForm] = useState({
        title: '',
        description: '',
        division: currentUser?.department || '',
        steps: [] // { username, name }
    });
    const [attachment, setNoteAttachment] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedFlowId, setSelectedFlowId] = useState("");

    // Action State
    const [actionNote, setActionNote] = useState('');
    const [actionAttachment, setActionAttachment] = useState(null);
    const [detailViewMode, setDetailViewMode] = useState('list'); // 'list' | 'visual'

    const [readApprovals, setReadApprovals] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(`readApprovals_${currentUser?.username}`) || '[]');
        } catch {
            return [];
        }
    });

    useEffect(() => {
        if (!currentUser || !approvals.length) return;

        const visibleApprovals = approvals.filter(a => {
            if (!a) return false;
            const isAdmin = currentUser?.role === 'admin';
            const isRequester = a.requester_username === currentUser?.username;
            const isInTrail = (a.steps || []).some(step => step.approver_username === currentUser?.username);
            return isAdmin || isRequester || isInTrail;
        });

        let currentRead = [];
        try {
            currentRead = JSON.parse(localStorage.getItem(`readApprovals_${currentUser.username}`) || '[]');
        } catch {
            currentRead = [];
        }

        let newReadArr = [...currentRead];
        let hasNew = false;
        visibleApprovals.forEach(a => {
            if (!newReadArr.includes(a.id)) {
                newReadArr.push(a.id);
                hasNew = true;
            }
        });

        if (hasNew) {
            localStorage.setItem(`readApprovals_${currentUser.username}`, JSON.stringify(newReadArr));
            setReadApprovals(newReadArr);
        }
    }, [approvals, currentUser]);

    const handleApprovalClick = (app) => {
        setSelectedApproval(app);
        if (!readApprovals.includes(app.id)) {
            const newRead = [...readApprovals, app.id];
            setReadApprovals(newRead);
            localStorage.setItem(`readApprovals_${currentUser?.username}`, JSON.stringify(newRead));
        }
    };

    const handleAddStep = (user) => {
        if (form.steps.find(s => s.username === user.username)) return;
        setForm({ ...form, steps: [...form.steps, { username: user.username, name: user.name }] });
    };

    const handleRemoveStep = (index) => {
        const newSteps = [...form.steps];
        newSteps.splice(index, 1);
        setForm({ ...form, steps: newSteps });
    };

    const handleFlowChange = (flowId) => {
        setSelectedFlowId(flowId);
        if (!flowId) {
            setForm({ ...form, steps: [] });
            return;
        }
        const flow = flows.find(f => String(f.id) === String(flowId));
        if (flow) setForm({ ...form, steps: flow.steps || [] });
    };

    const handleEdit = (app, e) => {
        e.stopPropagation();
        setEditingApproval(app);
        const steps = Array.isArray(app.steps) ? app.steps : [];
        setForm({
            title: app.title,
            description: app.description,
            division: app.division,
            steps: steps.map(s => ({ username: s.approver_username || s.username, name: s.approver_name || s.name, nodeId: s.node_id || s.nodeId, instruction: s.instruction }))
        });
        setSelectedFlowId(app.flow_id || "");
        setNoteAttachment(null);
        setIsCreateModalOpen(true);
    };

    const handleSubmit = async () => {
        if (!form.title || form.steps.length === 0) return alert("Judul dan minimal 1 Approver wajib diisi!");
        setIsSubmitting(true);

        // Sync folder ApprovalDoc
        let folderId = null;
        if (syncApprovalFolder) folderId = await syncApprovalFolder(form.title, 'ACTIVE');

        try {
            let fileUrl = editingApproval ? editingApproval.attachment_url : null;
            let fileName = editingApproval ? editingApproval.attachment_name : null;

            if (attachment) {
                // Gunakan createDocument agar file masuk ke folder ApprovalDoc dan diproses OCR
                const docPayload = {
                    title: attachment.name,
                    type: attachment.type,
                    size: (attachment.size / 1024 / 1024).toFixed(2) + ' MB',
                    folderId: folderId,
                    department: currentUser?.department || '',
                    owner: currentUser?.name || 'Admin',
                    status: 'waiting', // Masuk antrean OCR
                    file: attachment
                };

                const uploadRes = await api.createDocument(docPayload);
                if (uploadRes && (uploadRes.url || uploadRes.file_url)) {
                    fileUrl = uploadRes.url || uploadRes.file_url;
                    fileName = attachment.name;
                }
            }

            const payload = {
                ...form,
                requester_name: currentUser.name,
                requester_username: currentUser.username,
                attachment_url: fileUrl,
                attachment_name: fileName,
                flow_id: selectedFlowId || null
            };

            if (editingApproval) {
                await api.updateApproval(editingApproval.id, payload);
            } else {
                await api.createApproval(payload);
            }

            setIsCreateModalOpen(false);
            setEditingApproval(null);
            setForm({ title: '', description: '', division: currentUser?.department || '', steps: [] });
            setSelectedFlowId("");
            setNoteAttachment(null);
            onRefresh();
        } catch (e) {
            const msg = await parseApiError(e);
            alert(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAction = async (action) => {
        if (!selectedApproval) return;
        try {
            let fileUrl = null;
            let fileName = null;

            if (actionAttachment) {
                // Sync folder ApprovalDoc agar file masuk ke folder yang sama dengan pengajuan
                let folderId = null;
                if (syncApprovalFolder) folderId = await syncApprovalFolder(selectedApproval.title, 'ACTIVE');

                const docPayload = {
                    title: `[Decision] ${actionAttachment.name}`,
                    type: actionAttachment.type,
                    size: (actionAttachment.size / 1024 / 1024).toFixed(2) + ' MB',
                    folderId: folderId,
                    department: currentUser?.department || '',
                    owner: currentUser?.name || 'Admin',
                    status: 'waiting', // Masuk antrean OCR
                    file: actionAttachment
                };

                const uploadRes = await api.createDocument(docPayload);
                if (uploadRes && (uploadRes.url || uploadRes.file_url)) {
                    fileUrl = uploadRes.url || uploadRes.file_url;
                    fileName = actionAttachment.name;
                }
            }

            const formData = new FormData();
            formData.append('action', action);
            formData.append('note', actionNote);
            formData.append('username', currentUser.username);
            
            if (fileUrl) {
                formData.append('attachment_url', fileUrl);
                formData.append('attachment_name', fileName);
            } else if (actionAttachment) {
                formData.append('file', actionAttachment);
            }

            await api.submitApprovalAction(selectedApproval.id, formData);
            setActionNote('');
            setActionAttachment(null);
            setSelectedApproval(null);
            onRefresh();
        } catch (e) { 
            const msg = await parseApiError(e);
            alert(msg); 
        }
    };

    const handleResetStep = async (stepIndex) => {
        if (!selectedApproval) return;
        if (!window.confirm("Apakah Anda yakin ingin menarik kembali/mengubah keputusan pada langkah ini? Alur akan diulang dari posisi Anda.")) return;
        try {
            await api.resetApprovalStep(selectedApproval.id, stepIndex);
            onRefresh();
            setSelectedApproval(null);
        } catch (e) { 
            const msg = await parseApiError(e);
            alert(msg); 
        }
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm("Hapus pengajuan ini?")) return;
        try {
            await api.deleteApproval(id);
            onRefresh();
        } catch (e) { 
            const msg = await parseApiError(e);
            alert(msg); 
        }
    };

    const visibleApprovals = (approvals || []).filter(a => {
        if (!a) return false;
        const isAdmin = currentUser?.role === 'admin';
        const isRequester = a.requester_username === currentUser?.username;
        const isInTrail = (a.steps || []).some(step => step.approver_username === currentUser?.username);
        return isAdmin || isRequester || isInTrail;
    });

    const filteredApprovals = visibleApprovals.filter(a =>
        (a.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.requester_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SummaryCard title="Menunggu Persetujuan" value={visibleApprovals.filter(a => a?.status === 'Pending').length} icon={Clock} colorClass="bg-amber-100 text-amber-600" />
                <SummaryCard title="Disetujui" value={visibleApprovals.filter(a => a?.status === 'Approved').length} icon={CheckCircle2} colorClass="bg-emerald-100 text-emerald-600" />
                <SummaryCard title="Ditolak" value={visibleApprovals.filter(a => a?.status === 'Rejected').length} icon={XCircle} colorClass="bg-red-100 text-red-600" />
            </div>

            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-0 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                        placeholder="Cari pengajuan..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20"
                >
                    <Plus size={18} /> Buat Pengajuan
                </button>
            </div>

            {/* List View */}
            <div className="grid grid-cols-1 gap-4">
                {filteredApprovals.length === 0 && (
                    <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-800">
                        <FileCheck size={48} className="mx-auto mb-4 text-slate-200 dark:text-slate-800" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Tidak ada data pengajuan</p>
                    </div>
                )}

                {filteredApprovals.map(app => (
                    <div
                        key={app.id}
                        onClick={() => handleApprovalClick(app)}
                        className="group bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all cursor-pointer shadow-sm hover:shadow-xl flex items-center gap-6"
                    >
                        <div className="relative">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${app?.status === 'Approved' ? 'bg-emerald-50 text-emerald-600' :
                                app?.status === 'Rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                                }`}>
                                <FileCheck size={28} />
                            </div>
                            {!readApprovals.includes(app.id) && (
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md border-2 border-white dark:border-slate-900 shadow-red-500/50">
                                    1
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                                <h3 className="font-black text-slate-800 dark:text-white truncate">{app?.title}</h3>
                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${app?.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                                    app?.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                    }`}>{app?.status}</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-400 font-bold uppercase tracking-tight">
                                <span className="flex items-center gap-1"><User size={12} /> {app?.requester_name}</span>
                                <span className="flex items-center gap-1"><Building2 size={12} /> {app?.division}</span>
                                <span className="flex items-center gap-1"><Clock size={12} /> {app?.created_at ? new Date(app.created_at).toLocaleDateString() : '-'}</span>
                            </div>
                        </div>

                        <div className="hidden md:flex items-center gap-1">
                            {(app?.steps || []).map((step, idx) => (
                                <div key={idx} className="flex items-center">
                                    <div
                                        className={`w-3 h-3 rounded-full border-2 ${step?.status === 'Approved' ? 'bg-emerald-500 border-emerald-200' :
                                            step?.status === 'Rejected' ? 'bg-red-500 border-red-200' :
                                                idx === app?.current_step_index ? 'bg-amber-500 border-amber-200 animate-pulse' : 'bg-slate-200 border-slate-100'
                                            }`}
                                        title={`${step?.approver_name || 'Unknown'}: ${step?.status || 'Pending'}`}
                                    />
                                    {idx < (app?.steps?.length || 0) - 1 && <div className="w-4 h-0.5 bg-slate-200 dark:bg-slate-700" />}
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center gap-1">
                            {(currentUser?.role === 'admin' || (app?.status?.toLowerCase() === 'rejected' && app?.requester_username === currentUser?.username)) && (
                                <button onClick={(e) => handleEdit(app, e)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="Edit & Ajukan Ulang">
                                    <Edit3 size={18} />
                                </button>
                            )}
                            {(currentUser?.role === 'admin' || (app?.status?.toLowerCase() === 'rejected' && app?.requester_username === currentUser?.username)) && (
                                <button onClick={(e) => handleDelete(app.id, e)} className="p-2 text-slate-300 hover:text-red-500 transition-colors" title="Hapus Pengajuan">
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>
                        <ChevronRight className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                    </div>
                ))}
            </div>

            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => { setIsCreateModalOpen(false); setEditingApproval(null); }}
                title={editingApproval ? "Edit & Ajukan Ulang" : "Pengajuan Dokumen Baru"}
                size="max-w-2xl"
            >
                <div className="space-y-6 pt-4 px-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Judul Dokumen</label>
                            <input
                                className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none dark:text-white font-bold"
                                placeholder="Contoh: Pengajuan Cuti / Reimbursement"
                                value={form.title}
                                onChange={e => setForm({ ...form, title: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Master Flow (Alur Baku)</label>
                            <select
                                className="w-full px-5 py-3 bg-white dark:bg-slate-900 border-2 border-indigo-100 dark:border-indigo-800 rounded-2xl outline-none dark:text-white font-bold appearance-none"
                                value={selectedFlowId}
                                onChange={(e) => handleFlowChange(e.target.value)}
                            >
                                <option value="">-- Pilih Alur Persetujuan --</option>
                                {flows.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Divisi / Departemen</label>
                            <select
                                className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none dark:text-white font-bold appearance-none"
                                value={form.division}
                                onChange={e => setForm({ ...form, division: e.target.value })}
                            >
                                {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Keterangan</label>
                        <textarea
                            className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none dark:text-white font-medium resize-none"
                            rows="3"
                            placeholder="Jelaskan detail pengajuan..."
                            value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lampiran File</label>
                        <label className="flex items-center gap-3 px-5 py-4 bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl cursor-pointer hover:bg-indigo-50 transition-all group">
                            <Paperclip className="text-slate-400 group-hover:text-indigo-500" />
                            <span className="text-sm font-bold text-slate-500">{attachment ? attachment.name : 'Pilih file pendukung...'}</span>
                            <input type="file" className="hidden" onChange={e => setNoteAttachment(e.target.files[0])} />
                        </label>
                        {attachment && (
                            <div
                                onClick={() => setPreviewFile({ url: URL.createObjectURL(attachment), name: attachment.name, isLocal: true })}
                                className="mt-2 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-900 h-40 flex items-center justify-center animate-in fade-in zoom-in-95 cursor-zoom-in group relative"
                            >
                                {attachment.type.startsWith('image/') ? (
                                    <img src={URL.createObjectURL(attachment)} alt="Preview" className="max-w-full max-h-full object-contain" />
                                ) : (
                                    <div className="flex flex-col items-center gap-2 text-slate-400">
                                        <FileText size={32} />
                                        <span className="text-[10px] font-bold uppercase">File Attached</span>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-all flex items-center justify-center">
                                    <div className="p-2 bg-white/90 dark:bg-slate-900/90 rounded-xl shadow-lg scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all text-indigo-600">
                                        <Eye size={20} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {selectedFlowId && (
                        <div className="space-y-4 p-6 rounded-[2rem] border transition-all bg-slate-100/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                            <div className="flex justify-between items-center">
                                <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-500">
                                    <ShieldCheck size={16} /> Alur Persetujuan (Terkunci)
                                </h4>
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-100 dark:border-amber-800">MASTER FLOW AKTIF</span>
                            </div>
                            <div className="space-y-2">
                                {(form?.steps || []).map((step, idx) => (
                                    <div key={idx} className="flex items-center gap-3 p-3 rounded-2xl shadow-sm animate-in slide-in-from-left-2 bg-slate-50 dark:bg-slate-800/80">
                                        <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xs font-black">{idx + 1}</div>
                                        <div className="flex-1">
                                            <p className="text-sm font-black text-slate-800 dark:text-white">{step.name}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">{step.username}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <button onClick={() => { setIsCreateModalOpen(false); setEditingApproval(null); }} className="flex-1 py-4 text-slate-500 font-black uppercase text-xs tracking-widest">Batal</button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-500/20 hover:bg-indigo-500 transition-all active:scale-95"
                        >
                            {isSubmitting ? 'Memproses...' : editingApproval ? 'Simpan & Ajukan Ulang' : 'Kirim Pengajuan'}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={!!selectedApproval} onClose={() => setSelectedApproval(null)} title="Detail & Alur Persetujuan" size="max-w-7xl">
                <div className="flex h-full min-h-0 flex-col gap-8 pt-4 md:flex-row">
                    <div className="flex-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] border border-slate-100 dark:border-slate-800">
                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-2 block">Informasi Dokumen</span>
                            <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-4 leading-tight">{selectedApproval?.title}</h2>
                            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">{selectedApproval?.description}</p>
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm">
                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Pengaju</p>
                                    <p className="text-sm font-bold dark:text-white">{selectedApproval?.requester_name}</p>
                                </div>
                                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm">
                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Tanggal</p>
                                    <p className="text-sm font-bold dark:text-white">{selectedApproval?.created_at ? new Date(selectedApproval.created_at).toLocaleDateString() : '-'}</p>
                                </div>
                            </div>
                            {selectedApproval?.attachment_url && (
                                <div className="space-y-4">
                                    <div className="p-4 bg-indigo-600 rounded-2xl text-white flex items-center justify-between group shadow-lg shadow-indigo-500/20">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <Paperclip size={20} />
                                            <span className="text-xs font-bold truncate">{selectedApproval.attachment_name}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => setPreviewFile({ url: selectedApproval.attachment_url, name: selectedApproval.attachment_name })} className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all">
                                                <Eye size={16} />
                                            </button>
                                            <a href={getFullUrl(selectedApproval.attachment_url)} target="_blank" className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all">
                                                <Download size={16} />
                                            </a>
                                        </div>
                                    </div>
                                    <div onClick={() => setPreviewFile({ url: selectedApproval.attachment_url, name: selectedApproval.attachment_name })} className="rounded-[2rem] border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900 h-64 shadow-inner cursor-zoom-in group relative">
                                        {String(selectedApproval.attachment_url).toLowerCase().match(/\.(jpg|jpeg|png|webp)/) ? (
                                            <img src={getFullUrl(selectedApproval.attachment_url)} alt="Preview" className="w-full h-full object-contain" />
                                        ) : String(selectedApproval.attachment_url).toLowerCase().includes('.pdf') ? (
                                            <iframe src={getFullUrl(selectedApproval.attachment_url)} className="w-full h-full" title="Attachment Preview" />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full text-slate-300">
                                                <FileText size={48} className="mb-2 opacity-20" />
                                                <p className="text-[10px] font-black uppercase tracking-widest">Preview tidak tersedia</p>
                                            </div>
                                        )}
                                    </div>
                                    {selectedApproval.ocr_content && (
                                        <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                                <Sparkles size={12} className="text-indigo-500" /> Hasil OCR
                                            </h4>
                                            <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar">
                                                {selectedApproval.ocr_content}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {selectedApproval?.status === 'Pending' && (selectedApproval?.steps || [])[selectedApproval?.current_step_index]?.approver_username === currentUser?.username && (
                            <div className="p-6 bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-indigo-500 shadow-2xl animate-in zoom-in-95">
                                <h4 className="text-sm font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                    <ShieldCheck className="text-indigo-600" /> Keputusan Anda Diperlukan
                                </h4>
                                <textarea className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl mb-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white" placeholder="Tambahkan catatan (opsional)..." value={actionNote} onChange={e => setActionNote(e.target.value)} />

                                <div className="mb-4">
                                    <label className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl cursor-pointer hover:bg-slate-100 transition-all group">
                                        <Paperclip size={16} className="text-slate-400 group-hover:text-indigo-500" />
                                        <span className="text-[10px] font-bold text-slate-500 truncate">{actionAttachment ? actionAttachment.name : 'Tambahkan Lampiran (Opsional)...'}</span>
                                        <input type="file" className="hidden" onChange={e => setActionAttachment(e.target.files[0])} />
                                    </label>
                                    {actionAttachment && (
                                        <div
                                            onClick={() => setPreviewFile({ url: URL.createObjectURL(actionAttachment), name: actionAttachment.name, isLocal: true })}
                                            className="mt-3 relative h-24 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 flex items-center justify-center cursor-zoom-in group"
                                        >
                                            {actionAttachment.type.startsWith('image/') ? (
                                                <img src={URL.createObjectURL(actionAttachment)} alt="Preview" className="max-w-full max-h-full object-contain" />
                                            ) : (
                                                <FileText size={24} className="text-slate-400" />
                                            )}
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                                                <div className="p-1.5 bg-white/90 dark:bg-slate-900/90 rounded-lg shadow-sm text-indigo-600">
                                                    <Eye size={14} />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-3">
                                    <button onClick={() => handleAction('Reject')} className="flex-1 py-3 bg-red-50 text-red-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-all">Tolak</button>
                                    <button onClick={() => handleAction('Approve')} className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition-all">Setujui</button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 flex flex-col min-w-0">
                        <div className="flex justify-between items-center mb-8 shrink-0">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <ArrowRight size={12} className="text-indigo-500" /> Approval Trail Flow
                            </h4>
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                                <button onClick={() => setDetailViewMode('list')} className={`p-1.5 rounded-lg transition-all ${detailViewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-400'}`}><List size={14} /></button>
                                <button onClick={() => setDetailViewMode('visual')} className={`p-1.5 rounded-lg transition-all ${detailViewMode === 'visual' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-400'}`}><Map size={14} /></button>
                            </div>
                        </div>

                        <div className="relative flex-1 min-h-0">
                            {detailViewMode === 'list' ? (
                                <div className="space-y-6 overflow-y-auto h-full pr-2 custom-scrollbar">
                                    <div className="absolute left-[23px] top-4 bottom-4 w-0.5 bg-slate-100 dark:bg-slate-800 hidden md:block" />
                                    <div className="relative pl-0 md:pl-12 flex flex-col gap-8">
                                        <div className="relative flex items-center gap-4">
                                            <div className="absolute -left-12 top-0 w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center border-4 border-white dark:border-slate-900 hidden md:flex"><Send size={18} /></div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Submitted By</p>
                                                <p className="text-sm font-black text-slate-800 dark:text-white leading-none">{selectedApproval?.requester_name}</p>
                                            </div>
                                        </div>
                                        {(selectedApproval?.steps || []).map((step, idx) => {
                                            const isActive = selectedApproval?.status === 'Pending' && idx === selectedApproval?.current_step_index;
                                            const isDone = step?.status === 'Approved';
                                            const isRejected = step?.status === 'Rejected';
                                            return (
                                                <div key={idx} className={`relative p-5 rounded-3xl border transition-all ${isActive ? 'bg-white dark:bg-slate-900 border-amber-200 shadow-xl' : 'bg-slate-50/50 dark:bg-slate-800/30 border-transparent'}`}>
                                                    <div className={`absolute -left-[3.25rem] top-5 w-10 h-10 rounded-xl flex items-center justify-center border-4 border-white dark:border-slate-900 hidden md:flex ${isDone ? 'bg-emerald-500 text-white' : isRejected ? 'bg-red-500 text-white' : isActive ? 'bg-amber-500 text-white animate-pulse' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>{isDone ? <CheckCircle2 size={18} /> : isRejected ? <XCircle size={18} /> : <User size={18} />}</div>
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <p className={`text-[9px] font-black uppercase tracking-widest ${isActive ? 'text-amber-600' : 'text-slate-400'}`}>Step {idx + 1}: {step?.status || 'Pending'}</p>
                                                            <h5 className="text-sm font-black text-slate-800 dark:text-white leading-none mt-1">{step?.approver_name}</h5>
                                                        </div>
                                                        {step?.action_date && <span className="text-[9px] font-bold text-slate-400">{new Date(step.action_date).toLocaleDateString()}</span>}
                                                    </div>

                                                    {step?.instruction && (
                                                        <div className="mt-3 p-3 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100/50 dark:border-indigo-800/50 flex items-start gap-2 animate-in slide-in-from-left-2">
                                                            <Sparkles size={12} className="text-indigo-500 mt-0.5 shrink-0" />
                                                            <div className="flex-1">
                                                                <p className="text-[10px] text-indigo-700 dark:text-indigo-300 font-medium leading-relaxed">
                                                                    <span className="font-black uppercase mr-1">Instruksi Proses:</span>
                                                                    {step.instruction}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {step?.note && <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-2 border-l-2 border-slate-200 dark:border-slate-700 pl-3">"{step.note}"</p>}

                                                    {step?.attachment_url && (
                                                        <div className="mt-3 flex items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm animate-in slide-in-from-top-2">
                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
                                                                    <Paperclip size={12} />
                                                                </div>
                                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate max-w-[150px]">{step.attachment_name}</span>
                                                            </div>
                                                            <div className="flex gap-1 shrink-0">
                                                                <button
                                                                    onClick={() => setPreviewFile({ url: step.attachment_url, name: step.attachment_name })}
                                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                                    title="Zoom Preview"
                                                                >
                                                                    <Eye size={12} />
                                                                </button>
                                                                <a
                                                                    href={getFullUrl(step.attachment_url)}
                                                                    target="_blank"
                                                                    download={step.attachment_name}
                                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                                    title="Download File"
                                                                >
                                                                    <Download size={12} />
                                                                </a>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {step?.approver_username === currentUser?.username && step?.status !== 'Pending' && selectedApproval?.status !== 'Approved' && (
                                                        <button onClick={() => handleResetStep(idx)} className="mt-3 text-[9px] font-black uppercase text-amber-600 hover:underline flex items-center gap-1"><Edit3 size={10} /> Ubah Keputusan</button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {selectedApproval?.status !== 'Pending' && (
                                            <div className={`p-5 rounded-3xl text-white shadow-xl ${selectedApproval?.status === 'Approved' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-red-500 shadow-red-500/20'}`}>
                                                <p className="text-[9px] font-black uppercase tracking-widest opacity-70">Final Status</p>
                                                <p className="text-base font-black uppercase tracking-tight mt-1">{selectedApproval?.status}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full h-full rounded-3xl overflow-hidden border border-slate-100 dark:border-slate-800 relative">
                                    {(() => {
                                        const flow = flows.find(f => String(f.id) === String(selectedApproval?.flow_id));
                                        if (!flow?.visual_config) return <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-50 dark:bg-slate-900/50"><Map size={48} className="mb-4 opacity-20" /><p className="text-[10px] font-black uppercase tracking-widest">Peta Visual Tidak Tersedia</p></div>;
                                        
                                        // Pastikan visual_config adalah objek, bukan string JSON
                                        const config = typeof flow.visual_config === 'string' ? JSON.parse(flow.visual_config) : flow.visual_config;
                                        
                                        // Pastikan ID Node adalah string untuk sinkronisasi dengan Edges
                                        const nodesWithStrings = (config.nodes || []).map(node => ({
                                            ...node,
                                            id: String(node.id)
                                        }));

                                        // Pastikan arah panah (markerEnd) selalu ada di mode view
                                        const edgesWithArrows = (config.edges || [])
                                            .filter(edge => edge.source && edge.target)
                                            .map((edge, eIdx) => {
                                                const finalColor = flow?.accent_color || edge.style?.stroke || '#6366f1';
                                                return {
                                                    ...edge,
                                                    id: String(edge.id || `edge-${selectedApproval?.id}-${eIdx}`),
                                                    source: String(edge.source),
                                                    target: String(edge.target),
                                                    type: 'smoothstep',
                                                    // Timpa style edge dengan warna aksen dari flow master atau dari style yang tersimpan
                                                    style: { stroke: finalColor, strokeWidth: 3 },
                                                    markerEnd: { type: 'arrowclosed', color: finalColor, width: 25, height: 25 },
                                                    // Sanitasi handle untuk memastikan panah menempel dengan benar pada node
                                                    sourceHandle: (edge.sourceHandle === null || edge.sourceHandle === "null") ? undefined : edge.sourceHandle,
                                                    targetHandle: (edge.targetHandle === null || edge.targetHandle === "null") ? undefined : edge.targetHandle
                                                };
                                            });
                                        return (
                                            <div className="absolute inset-0">
                                                <WorkflowViewer 
                                                    key={`viewer-${selectedApproval?.id}`}
                                                    nodes={nodesWithStrings} 
                                                    edges={edgesWithArrows} 
                                                    currentStepNodeId={(selectedApproval?.steps || [])[selectedApproval?.current_step_index]?.node_id} 
                                                    approvalStatus={selectedApproval?.status} 
                                                    stepsStatus={selectedApproval?.steps} 
                                                />
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                        <button onClick={() => setSelectedApproval(null)} className="mt-8 shrink-0 w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all">Tutup Detail</button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={!!previewFile} onClose={() => setPreviewFile(null)} title={`Preview: ${previewFile?.name}`} size="max-w-7xl">
                <div className="flex h-full min-h-0 flex-col pt-4">
                    <div className="flex-1 bg-slate-100 dark:bg-slate-950 rounded-[2.5rem] overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner">
                        {previewFile?.url && String(previewFile.url).toLowerCase().match(/\.(jpg|jpeg|png|webp)/) ? (
                            <img src={getFullUrl(previewFile.url)} alt="Preview" className="w-full h-full object-contain" />
                        ) : String(previewFile?.url).toLowerCase().includes('.pdf') ? (
                            <iframe src={getFullUrl(previewFile.url)} className="w-full h-full" title="PDF Preview" />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400"><FileText size={48} className="mb-4 opacity-20" /><p className="font-black uppercase tracking-widest">Format tidak didukung untuk preview</p></div>
                        )}
                    </div>
                    <button onClick={() => setPreviewFile(null)} className="mt-4 px-8 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all self-end">Tutup Preview</button>
                </div>
            </Modal>
        </div>
    );
}