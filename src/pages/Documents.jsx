import React, { useState, useEffect, useRef } from 'react';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import {
    HardDrive, ChevronRight, ChevronLeft, Search, Plus, UploadCloud, FolderOpen,
    Trash2, Edit3, FileDigit, FileText, Highlighter, History, PenLine, User, Clock, Paperclip,
    Copy, Move, RefreshCw, X, Lock, Users, Building, Shield, Download, Eye, File, Image, MoreVertical, Sparkles, AlertCircle, TrendingUp, ShieldCheck, Truck, ArrowLeftRight, FileStack,
    LayoutGrid, List, Check
} from 'lucide-react';
import { SummaryCard } from '../components/ui/Card';
import { db as api, API_URL } from '../services/database';
import { parseApiError } from '../utils/errorHandler';
import { getFullUrl } from '../utils/urlHelper';
import Modal from '../components/common/Modal';
import PdfViewer from '../components/ui/PdfViewer';
import { useDocStore } from '../store/useDocStore';

export default function Documents({
    docList, folders, currentFolderId, setCurrentFolderId,
    searchQuery, setSearchQuery,
    handleCreateFolder, handleDeleteFolder, handleRenameFolder,
    handleViewDoc, handleEditDoc, handleDeleteDoc, handleRenameDoc,
    setUploadForm, setModalTab, setIsModalOpen,
    hasPermission, docStats,
    getSearchSnippet, logs,
    navigateFolder, navigateBack, navigateForward, folderHistory, historyIndex,
    onRefresh, users, departments, currentUser, handleEditFolder, handleDownload, ocrStats,
    handleMultipleDocUpload
}) {
    const {
        deleteDocument, copyDocument, moveDocument, restoreDocumentVersion,
        promoteCommentAttachment, addComment
    } = useDocStore();

    const [showHistory, setShowHistory] = useState(false);
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
    const [activeMenuId, setActiveMenuId] = useState(null); // ID of the document whose menu is open
    const [activeFolderMenuId, setActiveFolderMenuId] = useState(null); // ID of the folder whose menu is open
    const [menuLocation, setMenuLocation] = useState({ top: null, bottom: null, right: 0 }); // Coordinates for fixed menu positioning

    const [statusFilter, setStatusFilter] = useState('all'); // all, active, removed, external, moved, renamed

    // --- COMMENTS STATE ---
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [commentAttachment, setCommentAttachment] = useState(null);
    const [isPostingComment, setIsPostingComment] = useState(false);

    // --- PREVIEW STATE ---
    const [selectedDocPreview, setSelectedDocPreview] = useState(null);
    const [previewFile, setPreviewFile] = useState(null);
    const [previewHtml, setPreviewHtml] = useState('');
    const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
    const [pdfBlobUrl, setPdfBlobUrl] = useState(null);

    // --- BULK SELECTION STATE ---
    const [selectedDocIds, setSelectedDocIds] = useState(new Set());
    const [selectedFolderIds, setSelectedFolderIds] = useState(new Set());
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    // --- FOLDER MODAL STATE ---
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [folderForm, setFolderForm] = useState({ id: '', name: '', privacy: 'public', allowedDepts: [], allowedUsers: [], owner: '' }); // privacy: 'public' | 'private' | 'dept' | 'user'

    // --- MANAGEMENT OPS STATE ---
    const [mgmtOp, setMgmtOp] = useState(null); // { type: 'copy' | 'move', itemType: 'file' | 'folder', item: any }
    const [isMgmtModalOpen, setIsMgmtModalOpen] = useState(false);
    const [opProgress, setOpProgress] = useState(0);
    const [isExecutingOp, setIsExecutingOp] = useState(false);

    // --- REVISION STATE ---
    const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
    const [selectedDocForRevision, setSelectedDocForRevision] = useState(null);
    const [isRestoring, setIsRestoring] = useState(false);

    const bulkInputRef = useRef(null);

    const dataBoxFolder = (folders || []).find(f => f.name === 'DataBox');
    const isViewingDataBox = currentFolderId && dataBoxFolder && String(currentFolderId) === String(dataBoxFolder.id);

    useEffect(() => {
        setStatusFilter('all');
    }, [currentFolderId]);

    // Auto-scroll chat history
    const chatEndRef = useRef(null);
    useEffect(() => {
        if (selectedDocPreview && comments.length > 0) {
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
    }, [comments, selectedDocPreview]);

    // getFullUrl is now imported from urlHelper

    const handlePreview = async (doc, isAttachment = false) => {
        setIsGeneratingPreview(true);
        setPreviewHtml('');
        // Clear previous PDF data
        if (pdfBlobUrl) setPdfBlobUrl(null);

        let fullDoc = doc;
        // Ambil data lengkap jika fileData kosong (optimasi bandwidth list)
        if (!isAttachment && !doc.fileData && !doc.file_data && !doc.filedata) {
            try {
                const fetched = await api.getDocumentById(doc.id);
                if (fetched) fullDoc = fetched;
            } catch (err) {
                console.error("Gagal mengambil data lengkap:", err);
            }
        }

        if (!isAttachment) {
            setSelectedDocPreview(fullDoc);
        }
        setPreviewFile(fullDoc);

        // Support URL fallback for files stored on disk
        const content = fullDoc?.fileData || fullDoc?.file_data || fullDoc?.filedata || fullDoc?.url;
        const type = String(fullDoc?.type || '').toLowerCase();
        const name = String(fullDoc?.title || '').toLowerCase();
        const isPdf = type.includes('pdf') || name.endsWith('.pdf') || (typeof content === 'string' && (content.match(/\.pdf$/i) || content.startsWith('data:application/pdf')));

        console.log('[Preview] Documents.handlePreview:', { type, name, isPdf, hasContent: !!content });

        if (content && typeof content === 'string') {
            try {
                let buffer;
                // IDM Bypass: Use Stream Endpoint for PDFs
                let effectiveUrl = content;
                if (isPdf && fullDoc.id && !isAttachment) {
                    // Check if it's already a full URL or local path
                    if (content.startsWith('/uploads/') || !content.startsWith('http')) {
                        // Use stream endpoint
                        effectiveUrl = `${API_URL}/documents/${fullDoc.id}/stream`;
                        console.log('[Preview] Using Stream Endpoint for PDF:', effectiveUrl);
                    }
                }
                const normalizedUrl = effectiveUrl.startsWith('http') ? effectiveUrl : getFullUrl(effectiveUrl);

                console.log('[Preview] Normalized URL:', normalizedUrl);

                if (normalizedUrl.startsWith('http') || normalizedUrl.startsWith('/') || normalizedUrl.startsWith('blob:')) {
                    console.log('[Preview] Fetching buffer from URL...');
                    const response = await fetch(normalizedUrl, {
                        credentials: 'include'
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        const isHtml = errorText.includes('<!DOCTYPE');
                        throw new Error(isHtml ? `File tidak ditemukan di server (404).` : `Gagal mengambil file: ${response.status}`);
                    }
                    buffer = await response.arrayBuffer();
                    console.log('[Preview] Buffer obtained, size:', buffer.byteLength);
                } else if (content.includes('base64,') || content.length > 1000) {
                    let base64 = content;
                    if (base64.includes('base64,')) base64 = base64.split('base64,')[1];
                    base64 = base64.replace(/[\n\r\s]/g, ''); // Clean whitespace
                    try {
                        const binaryString = atob(base64);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
                        buffer = bytes.buffer;
                    } catch (e) { console.error("Base64 decode error", e); }
                }

                // For PDFs: pass ArrayBuffer directly to PdfViewer
                if (buffer && isPdf) {
                    setPdfBlobUrl(buffer);
                } else if (buffer && (type?.includes('word') || name?.endsWith('.docx'))) {
                    const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
                    setPreviewHtml(result.value);
                } else if (buffer && (type?.includes('sheet') || type?.includes('excel') || name?.endsWith('.xlsx') || name?.endsWith('.xls'))) {
                    const wb = XLSX.read(buffer, { type: 'array' });
                    const firstSheet = wb.Sheets[wb.SheetNames[0]];
                    setPreviewHtml(XLSX.utils.sheet_to_html(firstSheet));
                }
            } catch (e) {
                console.error("Preview error:", e);
                const msg = await parseApiError(e);
                alert(`Gagal memuat preview: ${msg}`);
            }
        }
        setIsGeneratingPreview(false);
    };

    const fetchComments = async (docId) => {
        const data = await api.getComments(docId);
        setComments(data);
    };

    useEffect(() => {
        if (selectedDocPreview) {
            fetchComments(selectedDocPreview.id);
        }
    }, [selectedDocPreview]);

    // --- REAL-TIME SYNC: useRef for stable closure ---
    const selectedDocPreviewRef = useRef(selectedDocPreview);
    useEffect(() => { selectedDocPreviewRef.current = selectedDocPreview; }, [selectedDocPreview]);

    useEffect(() => {
        let cleanup;
        import('../services/socketService.js').then(({ getSocket }) => {
            const socket = getSocket();
            const handler = ({ channel }) => {
                if (channel === 'documents') {
                    const doc = selectedDocPreviewRef.current;
                    if (doc) {
                        console.log('[Socket.IO] Documents changed — refreshing comments...');
                        fetchComments(doc.id);
                    }
                }
            };
            socket.on('data:changed', handler);
            cleanup = () => socket.off('data:changed', handler);
        });
        return () => cleanup?.();
    }, []);

    const handlePostComment = async () => {
        if (!newComment.trim() && !commentAttachment) return;
        setIsPostingComment(true);

        const previousComments = [...comments];
        const tempComment = {
            id: Date.now(),
            user: currentUser?.name || 'Anonymous',
            text: newComment,
            timestamp: new Date().toISOString(),
            attachmentName: commentAttachment?.name,
            isOptimistic: true
        };

        // Update UI Seketika
        setComments([...comments, tempComment]);

        const formData = new FormData();
        formData.append('user', currentUser?.name || 'Anonymous');
        formData.append('text', newComment);
        if (commentAttachment) formData.append('attachment', commentAttachment);

        try {
            const res = await addComment(selectedDocPreview.id, formData);
            if (res.success) {
                setNewComment('');
                setCommentAttachment(null);
                fetchComments(selectedDocPreview.id);
            }
        } catch (e) {
            setComments(previousComments);
            const msg = await parseApiError(e);
            alert("Gagal mengirim komentar: " + msg);
        }
        setIsPostingComment(false);
    };

    const handlePromoteAttachment = async (commentId) => {
        if (!window.confirm("Jadikan file lampiran ini sebagai revisi terbaru dokumen? Proses OCR akan dijalankan.")) return;
        const res = await promoteCommentAttachment(selectedDocPreview.id, commentId);
        if (res.success) {
            alert("Berhasil menjadikan revisi. Dokumen sedang diproses OCR.");
            setSelectedDocPreview(null);
            // onRefresh() is now handled by store
        }
    };

    const startMgmtOp = (type, itemType, item) => {
        setMgmtOp({ type, itemType, item });
        setIsMgmtModalOpen(true);
    };

    const performCopyMove = async (targetFolderId) => {
        if (!mgmtOp) return;

        // Proteksi folder DataBox agar tidak bisa dipindah/disalin
        if (mgmtOp.itemType === 'folder' && (['DataBox', 'TaxAudit', 'PUSTAKA', 'ApprovalDoc', 'SOP'].includes(mgmtOp.item.name))) {
            alert("Folder sistem 'DataBox' tidak dapat dipindahkan atau disalin.");
            setIsMgmtModalOpen(false);
            setMgmtOp(null);
            return;
        }

        setIsExecutingOp(true);
        setOpProgress(10);

        try {
            if (mgmtOp.itemType === 'file') {
                const owner = currentUser?.name || currentUser?.username || 'System';
                if (mgmtOp.type === 'copy') {
                    await copyDocument(mgmtOp.item.id, targetFolderId, owner);
                } else {
                    await moveDocument(mgmtOp.item.id, targetFolderId, owner);
                }
            } else {
                if (mgmtOp.type === 'copy') {
                    await api.copyFolder(mgmtOp.item.id, targetFolderId);
                    if (onRefresh) onRefresh(); // Folder actions still need manual refresh until added to store
                } else {
                    await api.moveFolder(mgmtOp.item.id, targetFolderId);
                    if (onRefresh) onRefresh();
                }
            }
            setOpProgress(100);
            setTimeout(() => {
                setIsExecutingOp(false);
                setIsMgmtModalOpen(false);
                setMgmtOp(null);
                setOpProgress(0);
                if (onRefresh) onRefresh();
            }, 500);
        } catch (e) {
            const msg = await parseApiError(e);
            alert("Operasi gagal: " + msg);
            setIsExecutingOp(false);
            setOpProgress(0);
        }
    };

    const handleRestoreVersion = async (docId, versionTimestamp) => {
        if (!window.confirm("Yakin ingin mengembalikan dokumen ke versi ini? Versi saat ini akan disimpan sebagai revisi baru.")) return;

        setIsRestoring(true);
        try {
            await restoreDocumentVersion(docId, versionTimestamp);
            setIsRevisionModalOpen(false);
            // onRefresh() is now handled by store
        } catch (e) {
            const msg = await parseApiError(e);
            alert("Gagal mengembalikan versi: " + msg);
        } finally {
            setIsRestoring(false);
        }
    };

    // --- BULK HANDLERS ---
    const toggleDocSelection = (id) => {
        const newSet = new Set(selectedDocIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedDocIds(newSet);
    };

    const toggleFolderSelection = (id, folderName) => {
        // Protect system folders
        if (['DataBox', 'TaxAudit', 'PUSTAKA', 'ApprovalDoc', 'SOP'].includes(folderName)) return;

        const newSet = new Set(selectedFolderIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedFolderIds(newSet);
    };

    const getVisibleItems = () => {
        const visibleFolders = (folders || []).filter(f => {
            const isCurrentRoot = !currentFolderId || currentFolderId === 'null' || currentFolderId === 'undefined' || currentFolderId === 0 || currentFolderId === '0';
            const isFolderRoot = !f.parentId || f.parentId === 'null' || f.parentId === 'undefined' || f.parentId === 0 || f.parentId === '0';
            const structureMatch = isCurrentRoot ? isFolderRoot : (String(f.parentId) === String(currentFolderId));
            const searchMatch = (f.name || '').toLowerCase().includes(searchQuery.toLowerCase());
            return structureMatch && searchMatch;
        });

        const visibleDocs = (docList || []).filter(d => {
            const matchesSearch = ((d.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || (d.ocrContent || '').toLowerCase().includes(searchQuery.toLowerCase()));
            if (searchQuery) return matchesSearch;
            return (String(d.folderId) === String(currentFolderId) || ((!d.folderId || d.folderId === 'null') && (currentFolderId === null || currentFolderId === 'null')));
        });

        return { visibleFolders, visibleDocs };
    };

    const handleSelectAll = () => {
        const { visibleFolders, visibleDocs } = getSmartVisibleItems();

        const newDocSet = new Set(selectedDocIds);
        const newFolderSet = new Set(selectedFolderIds);

        // System folder list for protection
        const systemFolders = ['DataBox', 'TaxAudit', 'PUSTAKA', 'ApprovalDoc', 'SOP'];

        visibleDocs.forEach(d => newDocSet.add(d.id));
        visibleFolders.forEach(f => {
            if (!systemFolders.includes(f.name)) {
                newFolderSet.add(f.id);
            }
        });

        setSelectedDocIds(newDocSet);
        setSelectedFolderIds(newFolderSet);
    };

    const handleDeselectAll = () => {
        setSelectedDocIds(new Set());
        setSelectedFolderIds(new Set());
    };

    const getSmartVisibleItems = () => {
        const { visibleFolders, visibleDocs } = getVisibleItems();
        // apply any additional filters if viewing DataBox
        let filteredFolders = visibleFolders;
        if (isViewingDataBox && statusFilter !== 'all') {
            filteredFolders = visibleFolders.filter(f => {
                const name = f.name || '';
                if (statusFilter === 'active') return !name.startsWith('RM_') && !name.startsWith('TR_') && !name.startsWith('MV_') && !name.startsWith('ED_');
                if (statusFilter === 'removed') return name.startsWith('RM_');
                if (statusFilter === 'external') return name.startsWith('TR_');
                if (statusFilter === 'moved') return name.startsWith('MV_');
                if (statusFilter === 'renamed') return name.startsWith('ED_');
                if (statusFilter === 'borrowed') return name.includes(' - BORROWED');
                if (statusFilter === 'audit') return name.includes(' - AUDIT');
                return true;
            });
        }
        return { visibleFolders: filteredFolders, visibleDocs };
    };

    const handleBulkDelete = async () => {
        const totalItems = selectedDocIds.size + selectedFolderIds.size;
        if (totalItems === 0) return;

        let confirmMsg = `Yakin ingin menghapus ${totalItems} item terpilih?`;
        if (selectedFolderIds.size > 0) {
            confirmMsg += `\nPERINGATAN: ${selectedFolderIds.size} folder akan dihapus beserta seluruh contributes isinya secara permanen.`;
        }

        if (!window.confirm(confirmMsg)) return;

        setIsBulkDeleting(true);
        try {
            // Delete Folders
            if (selectedFolderIds.size > 0) {
                const folderPromises = Array.from(selectedFolderIds).map(id => api.deleteFolder(id));
                await Promise.all(folderPromises);
                if (onRefresh) onRefresh(); // Refresh folders
            }

            // Delete Documents
            if (selectedDocIds.size > 0) {
                const docPromises = Array.from(selectedDocIds).map(id => deleteDocument(id));
                await Promise.all(docPromises);
            }

            setSelectedDocIds(new Set());
            setSelectedFolderIds(new Set());
            alert(`Berhasil menghapus ${totalItems} item.`);
        } catch (e) {
            const msg = await parseApiError(e);
            alert("Gagal menghapus beberapa item: " + msg);
        } finally {
            setIsBulkDeleting(false);
        }
    };

    // Filter logs for document activities
    const docLogs = logs?.filter(l =>
        l.action && ['Upload', 'Delete', 'Rename', 'Folder', 'Revisi', 'Download', 'Copy', 'Move', 'Hapus'].some(k => l.action.includes(k))
    ) || [];

    const getSmartInsight = () => {
        // 1. Konteks Pencarian
        if (searchQuery) {
            const matches = docList.filter(d => d.title.toLowerCase().includes(searchQuery.toLowerCase()) || (d.ocrContent || '').toLowerCase().includes(searchQuery.toLowerCase())).length;
            return {
                text: `Analisis Pencarian: Ditemukan ${matches} dokumen yang relevan. AI mendeteksi kecocokan pada judul dan isi konten OCR.`,
                icon: <Search className="text-indigo-500" size={20} />,
                color: "border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-900/10 text-indigo-800 dark:text-indigo-200"
            };
        }

        // 2. Analisis OCR Processing
        const totalPending = (ocrStats?.counts?.active || 0) + (ocrStats?.counts?.waiting || 0);
        if (totalPending > 0) {
            return {
                text: `Antrian OCR: ${totalPending} dokumen sedang dalam proses ekstraksi teks. Anda dapat terus bekerja, sistem akan memperbarui konten secara otomatis.`,
                icon: <RefreshCw className="text-amber-500 animate-spin" size={20} />,
                color: "border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-200"
            };
        }

        // 3. Analisis Keamanan (Public Folders)
        const publicFolders = folders.filter(f => f.privacy === 'public').length;
        if (publicFolders > 15) {
            return {
                text: `Saran Keamanan: Terdapat ${publicFolders} folder dengan akses publik. Pertimbangkan untuk membatasi akses pada folder sensitif menggunakan fitur 'Unit Kerja'.`,
                icon: <ShieldCheck className="text-emerald-500" size={20} />,
                color: "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/10 text-emerald-800 dark:text-emerald-200"
            };
        }

        // 4. Analisis Kapasitas
        const totalSize = parseFloat(docStats?.totalSizeMB || 0);
        if (totalSize > 500) {
            return {
                text: `Optimasi Penyimpanan: Total dokumen digital mencapai ${totalSize.toFixed(1)} MB. Gunakan fitur 'Riwayat Revisi' untuk menghapus versi lama yang tidak diperlukan.`,
                icon: <TrendingUp className="text-blue-500" size={20} />,
                color: "border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-900/10 text-blue-800 dark:text-blue-200"
            };
        }

        // 5. Default Tips
        const tips = [
            "Tips AI: Gunakan fitur 'Salin/Pindah' untuk merapikan struktur arsip tanpa harus upload ulang.",
            "Info: Dokumen yang di upload otomatis di indeks oleh AI untuk pencarian semantik yang lebih akurat.",
            "Saran: Lakukan penamaan file yang konsisten (Contoh: YYYY-MM-DD_Judul) untuk memudahkan sortir.",
            "Keamanan: Selalu periksa log aktivitas untuk memantau siapa saja yang mengakses dokumen sensitif."
        ];
        return {
            text: tips[new Date().getHours() % tips.length],
            icon: <Sparkles className="text-indigo-500" size={20} />,
            color: "border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-900/10 text-indigo-800 dark:text-indigo-200"
        };
    };

    const insight = getSmartInsight();

    return (
        <>
            <div className="animate-in fade-in zoom-in-95 duration-300 space-y-6 relative">
                {/* SUMMARY CARDS FOR DOCUMENTS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                    <SummaryCard
                        title="Total Dokumen"
                        value={(docList || []).length}
                        icon={FileText}
                        colorClass="bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                    />
                    <SummaryCard
                        title="Total Folder"
                        value={(folders || []).length}
                        icon={FolderOpen}
                        colorClass="bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
                    />
                    <SummaryCard
                        title="Total Revisi"
                        value={docStats?.totalRevisions || 0}
                        icon={History}
                        colorClass="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"
                    />
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
                            <span className="text-[10px] font-bold opacity-60">Document Analysis</span>
                        </div>
                        <p className="text-sm font-bold leading-relaxed">{insight.text}</p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-4 rounded-2xl border border-white/40 dark:border-white/10 shadow-xl ring-1 ring-black/5">
                    <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto">
                        <div className="flex gap-1 mr-2 bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
                            <button onClick={navigateBack} disabled={historyIndex <= 0} className={`p-1 rounded hover:bg-white dark:hover:bg-slate-700 transition-colors ${historyIndex <= 0 ? 'text-gray-300 dark:text-slate-600' : 'text-gray-600 dark:text-slate-300'}`}>
                                <ChevronLeft size={18} />
                            </button>
                            <button onClick={navigateForward} disabled={!folderHistory || historyIndex >= folderHistory.length - 1} className={`p-1 rounded hover:bg-white dark:hover:bg-slate-700 transition-colors ${!folderHistory || historyIndex >= folderHistory.length - 1 ? 'text-gray-300 dark:text-slate-600' : 'text-gray-600 dark:text-slate-300'}`}>
                                <ChevronRight size={18} />
                            </button>
                        </div>
                        <button onClick={() => navigateFolder(null)} className={`p-2 rounded-lg ${currentFolderId === null ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-100 text-gray-500'}`}>
                            <HardDrive size={20} />
                        </button>
                        {currentFolderId && (
                            <>
                                <ChevronRight size={16} className="text-gray-400" />
                                <span className="font-bold text-gray-700 dark:text-white">{folders.find(f => String(f.id) === String(currentFolderId))?.name || 'Unknown'}</span>
                            </>
                        )}
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Cari dokumen..."
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
                            />
                        </div>
                        {isViewingDataBox && (
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 shadow-sm">
                                <AlertCircle size={14} className="text-indigo-500" />
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="bg-transparent py-2 text-xs font-bold text-gray-600 dark:text-slate-300 focus:outline-none cursor-pointer"
                                >
                                    <option value="all">Semua Status</option>
                                    <option value="active">Normal (Gudang)</option>
                                    <option value="removed">Dihapus (RM_)</option>
                                    <option value="external">Indoarsip (TR_)</option>
                                    <option value="moved">Pindah Slot (MV_)</option>
                                    <option value="renamed">Diedit (ED_)</option>
                                    <option value="borrowed">Dipinjam</option>
                                    <option value="audit">Audit</option>
                                </select>
                            </div>
                        )}
                        <button onClick={onRefresh} className="group px-3 py-2 rounded-lg border bg-white text-gray-600 border-gray-200 hover:bg-gray-50 flex items-center gap-2" title="Refresh Data">
                            <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                        </button>
                        <div className="flex bg-white rounded-lg border border-gray-200 p-1">
                            <button
                                onClick={() => {
                                    const { visibleFolders, visibleDocs } = getSmartVisibleItems();
                                    const allDocsSelected = visibleDocs.every(d => selectedDocIds.has(d.id));
                                    const selectableFolders = visibleFolders.filter(f => !['DataBox', 'TaxAudit', 'PUSTAKA', 'ApprovalDoc', 'SOP'].includes(f.name));
                                    const allFoldersSelected = selectableFolders.every(f => selectedFolderIds.has(f.id));

                                    if (allDocsSelected && (selectableFolders.length === 0 || allFoldersSelected)) {
                                        handleDeselectAll();
                                    } else {
                                        handleSelectAll();
                                    }
                                }}
                                className={`group p-1.5 rounded-md transition-all ${(selectedDocIds.size > 0 || selectedFolderIds.size > 0) ? 'bg-indigo-100 text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                title="Pilih Semua (Select All)"
                            >
                                <Check size={18} className="group-hover:scale-110 transition-transform" />
                            </button>
                        </div>
                        <div className="flex bg-white rounded-lg border border-gray-200 p-1">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`group p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-indigo-100 text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                title="Grid View"
                            >
                                <LayoutGrid size={18} className="group-hover:scale-110 transition-transform" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`group p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-indigo-100 text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                title="List View"
                            >
                                <List size={18} className="group-hover:scale-110 transition-transform" />
                            </button>
                        </div>
                        <button onClick={() => setShowHistory(!showHistory)} className={`px-3 py-2 rounded-lg border flex items-center gap-2 ${showHistory ? 'bg-indigo-100 text-indigo-600 border-indigo-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                            <History size={18} />
                        </button>
                        {hasPermission('documents', 'create') && (
                            <>
                                <input
                                    type="file"
                                    ref={bulkInputRef}
                                    onChange={handleMultipleDocUpload}
                                    multiple
                                    className="hidden"
                                />
                                <button
                                    onClick={() => bulkInputRef.current.click()}
                                    className="group px-4 py-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-lg font-medium flex items-center justify-center gap-2 transition-all"
                                    title="Upload Banyak File Sekaligus"
                                >
                                    <FileStack size={18} className="group-hover:scale-110 transition-transform" /> Bulk
                                </button>
                                <button
                                    onClick={() => {
                                        setFolderForm({ id: '', name: '', privacy: 'public', allowedDepts: [], allowedUsers: [], owner: '' });
                                        setIsFolderModalOpen(true);
                                    }}
                                    className="group px-4 py-2 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-lg font-medium flex items-center justify-center gap-2 transition-all">
                                    <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" /> Folder
                                </button>
                                <button
                                    onClick={() => {
                                        // RESET TOTAL: Pastikan tidak ada sisa data dari edit sebelumnya
                                        setUploadForm({
                                            id: '', title: '', ocrContent: '', fileType: '', fileSize: '',
                                            previewUrl: null, fileData: null, isProcessing: false,
                                            processingMessage: '', editMode: false, originalDoc: null
                                        });
                                        setModalTab('upload');
                                        setIsModalOpen(true);
                                    }}
                                    className="group px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all hover:scale-105"
                                >
                                    <UploadCloud size={18} className="group-hover:-translate-y-1 transition-transform duration-300" /> Upload
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* HISTORY PANEL */}
                {showHistory && (
                    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 animate-in slide-in-from-top-2">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><History size={18} /> Riwayat Aktivitas Dokumen</h3>
                        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                            {docLogs.slice(0, 20).map(log => (
                                <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-100 dark:border-slate-800">
                                    <div className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-sm">
                                        <User size={14} className="text-indigo-500" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between">
                                            <span className="font-bold text-sm dark:text-white">{log.user}</span>
                                            <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={12} /> {new Date(log.timestamp).toLocaleString()}</span>
                                        </div>
                                        <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">{log.action}</p>
                                        <p className="text-sm text-gray-600 dark:text-slate-300">{log.details}</p>
                                    </div>
                                </div>
                            ))}
                            {docLogs.length === 0 && <p className="text-center text-gray-400 italic py-4">Belum ada riwayat aktivitas.</p>}
                        </div>
                    </div>
                )}

                {/* FOLDERS SECTION */}
                <div>
                    {(folders || []).some(f => {
                        // ROBUST FILTER: Treat null, undefined, 0, '0', '', 'null', 'undefined' as ROOT
                        const isCurrentRoot = !currentFolderId || currentFolderId === 'null' || currentFolderId === 'undefined' || currentFolderId === 0 || currentFolderId === '0';
                        const isFolderRoot = !f.parentId || f.parentId === 'null' || f.parentId === 'undefined' || f.parentId === 0 || f.parentId === '0';

                        if (isCurrentRoot) return isFolderRoot;
                        return String(f.parentId) === String(currentFolderId);
                    }) && (
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Folders</h3>
                                <span className="text-xs text-red-500 font-mono">

                                </span>
                            </div>
                        )}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                        {(folders || []).filter(f => {
                            // 1. ROBUST PARENT MATCH
                            const isCurrentRoot = !currentFolderId || currentFolderId === 'null' || currentFolderId === 'undefined' || currentFolderId === 0 || currentFolderId === '0';
                            const isFolderRoot = !f.parentId || f.parentId === 'null' || f.parentId === 'undefined' || f.parentId === 0 || f.parentId === '0';

                            const structureMatch = isCurrentRoot ? isFolderRoot : (String(f.parentId) === String(currentFolderId));

                            // 2. Search Filter
                            const searchMatch = (f.name || '').toLowerCase().includes(searchQuery.toLowerCase());

                            // 3. Permission Filter
                            let accessMatch = true;
                            if (currentUser?.role === 'admin') {
                                accessMatch = true;
                            } else if (f.privacy === 'private') {
                                accessMatch = f.owner === currentUser?.name || f.owner === currentUser?.username;
                            } else if (f.privacy === 'dept') {
                                accessMatch = (f.allowedDepts || []).includes(currentUser?.department) || f.owner === currentUser?.name;
                            } else if (f.privacy === 'user') {
                                accessMatch = (f.allowedUsers || []).includes(currentUser?.username) || f.owner === currentUser?.name;
                            }

                            if (!structureMatch || !searchMatch || !accessMatch) return false;

                            // DataBox Status Filter Logic
                            if (isViewingDataBox && statusFilter !== 'all') {
                                const name = f.name || '';
                                if (statusFilter === 'active') return !name.startsWith('RM_') && !name.startsWith('TR_') && !name.startsWith('MV_') && !name.startsWith('ED_');
                                if (statusFilter === 'removed') return name.startsWith('RM_');
                                if (statusFilter === 'external') return name.startsWith('TR_');
                                if (statusFilter === 'moved') return name.startsWith('MV_');
                                if (statusFilter === 'renamed') return name.startsWith('ED_');
                                if (statusFilter === 'borrowed') return name.includes(' - BORROWED');
                                if (statusFilter === 'audit') return name.includes(' - AUDIT');
                            }

                            return true;
                        }).sort((a, b) => {
                            if (isViewingDataBox) {
                                const isAInv = a.name.startsWith('[INV]');
                                const isBInv = b.name.startsWith('[INV]');
                                const isASpecial = a.name.startsWith('RM_') || a.name.startsWith('TR_') || a.name.startsWith('MV_') || a.name.startsWith('ED_');
                                const isBSpecial = b.name.startsWith('RM_') || b.name.startsWith('TR_') || b.name.startsWith('MV_') || b.name.startsWith('ED_');

                                if (!isASpecial && isBSpecial) return -1;
                                if (isASpecial && !isBSpecial) return 1;

                                // Jika keduanya aktif, urutkan berdasarkan No Slot (angka terakhir di BOX-YYYY-SLOT)
                                if (!isAInv && !isBInv) {
                                    const slotA = parseInt(a.name.split('-').pop()) || 0;
                                    const slotB = parseInt(b.name.split('-').pop()) || 0;
                                    return slotA - slotB;
                                }
                            }
                            return (a.name || '').localeCompare(b.name || '');
                        }).map((folder, idx) => {
                            const isInvSync = folder.name.startsWith('[INV]') || folder.name.startsWith('RM_') || folder.name.startsWith('TR_') || folder.name.startsWith('MV_') || folder.name.startsWith('ED_');
                            const isTaxSync = folder.name.startsWith('[TAX]');
                            const isSyncFolder = isInvSync || isTaxSync;

                            // Menentukan ikon dan badge spesifik berdasarkan kata kunci status di nama folder
                            let SyncIcon = History;
                            let BadgeIcon = RefreshCw;
                            let badgeColor = isInvSync ? 'bg-blue-500' : 'bg-purple-500';
                            let badgeTitle = "Synced/History Folder";

                            if (isSyncFolder) {
                                if (folder.name.startsWith('RM_')) {
                                    SyncIcon = Trash2; BadgeIcon = Trash2; badgeColor = 'bg-red-500'; badgeTitle = "Folder Box Dihapus";
                                } else if (folder.name.startsWith('TR_')) {
                                    SyncIcon = Truck; BadgeIcon = Truck; badgeColor = 'bg-orange-500'; badgeTitle = "Pindah ke Indoarsip";
                                } else if (folder.name.startsWith('MV_')) {
                                    SyncIcon = ArrowLeftRight; BadgeIcon = ArrowLeftRight; badgeColor = 'bg-blue-600'; badgeTitle = "Pindah Slot Rak";
                                } else if (folder.name.startsWith('ED_')) {
                                    SyncIcon = Edit3; BadgeIcon = Edit3; badgeColor = 'bg-indigo-500'; badgeTitle = "Box Diganti Nama";
                                } else if (folder.name.includes(' - BORROWED')) {
                                    SyncIcon = Clock; BadgeIcon = Clock; badgeColor = 'bg-amber-500'; badgeTitle = "Box Sedang Dipinjam";
                                } else if (folder.name.includes(' - AUDIT')) {
                                    SyncIcon = Shield; BadgeIcon = Shield; badgeColor = 'bg-purple-600'; badgeTitle = "Box Sedang Audit";
                                }
                            }

                            return (
                                <div key={folder.id}
                                    onClick={() => navigateFolder(folder.id)}
                                    style={{ animationDelay: `${idx * 20}ms` }}
                                    className={`group relative flex flex-col items-center p-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/10 hover:border-indigo-200 dark:hover:border-indigo-800 cursor-pointer transition-all duration-500 animate-in zoom-in-90 fade-in fill-mode-both shadow-sm aspect-[1/1.1] hover:scale-110 hover:-rotate-1 ${selectedFolderIds.has(folder.id) ? 'ring-2 ring-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-md' : ''} ${activeFolderMenuId === folder.id ? 'z-[120] ring-2 ring-indigo-500 shadow-2xl scale-[1.02]' : 'z-10'} ${isSyncFolder ? 'opacity-80 grayscale-[0.3]' : ''}`}
                                >
                                    {/* Folder Selection Checkbox */}
                                    {hasPermission('documents', 'delete') && !(['DataBox', 'TaxAudit', 'PUSTAKA', 'ApprovalDoc', 'SOP'].includes(folder.name)) && (
                                        <div className={`absolute top-3 left-3 z-30 ${selectedFolderIds.has(folder.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                            <input
                                                type="checkbox"
                                                checked={selectedFolderIds.has(folder.id)}
                                                onChange={(e) => { e.stopPropagation(); toggleFolderSelection(folder.id, folder.name); }}
                                                className="w-5 h-5 rounded-md border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shadow-sm"
                                            />
                                        </div>
                                    )}
                                    <div className="flex-1 flex items-center justify-center w-full relative">
                                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${isInvSync ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-500' :
                                            isTaxSync ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-500' :
                                                'bg-amber-100 dark:bg-amber-900/30 text-amber-500'
                                            }`}>
                                            {isSyncFolder ? <SyncIcon size={32} /> : <FolderOpen size={36} fill="currentColor" className="opacity-80" />}
                                        </div>
                                        {/* Privacy Indicator Badge */}
                                        {folder.privacy !== 'public' && (
                                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center border border-gray-200 dark:border-slate-700 shadow-sm" title={folder.privacy === 'private' ? 'Private' : folder.privacy === 'dept' ? 'Department' : 'Specific Users'}>
                                                {folder.privacy === 'private' && <Lock size={12} className="text-red-500" />}
                                                {folder.privacy === 'dept' && <Building size={12} className="text-blue-500" />}
                                                {folder.privacy === 'user' && <User size={12} className="text-purple-500" />}
                                            </div>
                                        )}
                                        {/* Sync/History Badge */}
                                        {isSyncFolder && (
                                            <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-sm ${badgeColor}`} title={badgeTitle}>
                                                <BadgeIcon size={10} className="text-white" />
                                            </div>
                                        )}
                                        {/* System Lock Badge */}
                                        {(['DataBox', 'TaxAudit', 'PUSTAKA', 'ApprovalDoc'].includes(folder.name)) && (
                                            <div className="absolute -top-1 -left-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-sm" title="System Folder">
                                                <Lock size={10} className="text-white" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="w-full text-center mt-3">
                                        <span className="font-medium text-gray-700 dark:text-gray-200 text-sm line-clamp-2 break-words leading-tight px-1">
                                            {folder.name}
                                        </span>
                                        {/* Creator Info Tooltip/Text */}
                                        <div className="text-[10px] text-gray-400 mt-1 truncate">
                                            Author: {folder.owner || 'Unknown'}
                                        </div>
                                    </div>

                                    {/* Actions Overlay - Minimalist Dropdown */}
                                    <div className="absolute top-2 right-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveFolderMenuId(activeFolderMenuId === folder.id ? null : folder.id);
                                            }}
                                            className="p-1.5 bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700 text-gray-500 hover:text-indigo-600 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <MoreVertical size={16} />
                                        </button>

                                        {activeFolderMenuId === folder.id && (
                                            <div
                                                className={`absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 z-[130] overflow-hidden animate-in zoom-in-95 slide-in-from-top-2 duration-200 origin-top-right`}
                                            >
                                                <div className="py-1">
                                                    {hasPermission('documents', 'edit') && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setFolderForm({
                                                                    id: folder.id,
                                                                    name: folder.name,
                                                                    privacy: folder.privacy || 'public',
                                                                    allowedDepts: folder.allowedDepts || [],
                                                                    allowedUsers: folder.allowedUsers || []
                                                                });
                                                                setIsFolderModalOpen(true);
                                                                setActiveFolderMenuId(null);
                                                            }}
                                                            className="group w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2"
                                                        >
                                                            {(['DataBox', 'TaxAudit', 'PUSTAKA', 'ApprovalDoc'].includes(folder.name)) ? (
                                                                <Shield size={14} className="text-amber-500 group-hover:scale-110 transition-transform" />
                                                            ) : (
                                                                <PenLine size={14} className="group-hover:rotate-12 transition-transform" />
                                                            )}
                                                            {(['DataBox', 'TaxAudit', 'PUSTAKA', 'ApprovalDoc'].includes(folder.name)) ? 'Akses Kontrol' : 'Edit'}
                                                        </button>
                                                    )}

                                                    {!(['DataBox', 'TaxAudit', 'PUSTAKA', 'ApprovalDoc'].includes(folder.name)) && (
                                                        <>
                                                            {hasPermission('documents', 'create') && (
                                                                <button onClick={(e) => { e.stopPropagation(); startMgmtOp('copy', 'folder', folder); setActiveFolderMenuId(null); }} className="group w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2">
                                                                    <Copy size={14} className="group-hover:scale-110 group-hover:text-indigo-500 transition-all" /> Salin
                                                                </button>
                                                            )}
                                                            {hasPermission('documents', 'edit') && (
                                                                <button onClick={(e) => { e.stopPropagation(); startMgmtOp('move', 'folder', folder); setActiveFolderMenuId(null); }} className="group w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2">
                                                                    <Move size={14} className="group-hover:translate-x-1 transition-transform" /> Pindah
                                                                </button>
                                                            )}
                                                            {hasPermission('documents', 'delete') && (
                                                                <>
                                                                    <div className="h-px bg-gray-100 dark:bg-slate-800 my-1" />
                                                                    <button
                                                                        onClick={(e) => { handleDeleteFolder(e, folder.id); setActiveFolderMenuId(null); }}
                                                                        className="group w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center gap-2"
                                                                    >
                                                                        <Trash2 size={14} className="group-hover:scale-110 transition-transform" /> Hapus
                                                                    </button>
                                                                </>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* DOCUMENTS LIST */}
                <div>
                    {(docList || []).some(d => {
                        const matchesSearch = ((d.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || (d.ocrContent || '').toLowerCase().includes(searchQuery.toLowerCase()));
                        if (searchQuery) return matchesSearch;
                        return (String(d.folderId) === String(currentFolderId) || ((!d.folderId || d.folderId === 'null') && (currentFolderId === null || currentFolderId === 'null')));
                    }) && (
                            <h3 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider mt-6">Files</h3>
                        )}
                    {viewMode === 'grid' ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {(docList || []).filter(d => {
                                const matchesSearch = ((d.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || (d.ocrContent || '').toLowerCase().includes(searchQuery.toLowerCase()));
                                if (searchQuery) return matchesSearch; // Global search
                                return (String(d.folderId) === String(currentFolderId) || ((!d.folderId || d.folderId === 'null') && (currentFolderId === null || currentFolderId === 'null')));
                            }).map((doc, idx) => {
                                const isContentMatch = (doc.ocrContent || '').toLowerCase().includes(searchQuery.toLowerCase()) && searchQuery.length > 0;

                                return (
                                    <div key={doc.id} style={{ animationDelay: `${(folders.length + idx) * 20}ms` }}
                                        className={`group relative flex flex-col p-4 glass-card rounded-2xl transition-all duration-500 animate-in zoom-in-90 fade-in fill-mode-both h-full hover:scale-105 hover:shadow-2xl ${selectedDocIds.has(doc.id) ? 'ring-2 ring-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20' : ''} ${activeMenuId === doc.id ? 'z-[120] ring-2 ring-indigo-500 shadow-2xl scale-[1.02]' : 'z-10'}`}>

                                        {/* Realtime OCR Overlay */}
                                        {(() => {
                                            const activeJob = ocrStats?.activeJobs?.find(j => {
                                                // Match by docId in job data (preferred) or filename fallback
                                                try {
                                                    const data = j.data || {};
                                                    return String(data.docId) === String(doc.id);
                                                } catch (e) { return false; }
                                            });

                                            const isWaiting = ocrStats?.counts?.waiting > 0 && doc.status === 'processing' && !activeJob;

                                            if (activeJob) {
                                                return (
                                                    <div className="absolute inset-x-0 top-0 h-1 bg-gray-100 dark:bg-gray-700 overflow-hidden rounded-t-2xl z-20">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500 ease-out"
                                                            style={{ width: `${activeJob.progress || 5}%` }}
                                                        />
                                                    </div>
                                                );
                                            }
                                            if (isWaiting) {
                                                return (
                                                    <div className="absolute inset-x-0 top-0 h-1 bg-gray-100 dark:bg-gray-700 overflow-hidden rounded-t-2xl z-20">
                                                        <div className="h-full bg-amber-400 w-full animate-pulse" />
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}

                                        {/* Selection Checkbox */}
                                        {hasPermission('documents', 'delete') && (
                                            <div className={`absolute top-3 left-3 z-30 ${selectedDocIds.has(doc.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedDocIds.has(doc.id)}
                                                    onChange={(e) => { e.stopPropagation(); toggleDocSelection(doc.id); }}
                                                    className="w-5 h-5 rounded-md border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shadow-sm"
                                                />
                                            </div>
                                        )}
                                        {/* Actions Overlay */}
                                        { /* Minimalist Action Menu */}
                                        <div className="absolute top-2 right-2 z-20">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveMenuId(activeMenuId === doc.id ? null : doc.id);
                                                }}
                                                className="p-1.5 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                                            >
                                                <MoreVertical size={16} />
                                            </button>

                                            { /* Dropdown Menu */}
                                            {activeMenuId === doc.id && (
                                                <div
                                                    className={`absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 z-[130] overflow-hidden animate-in zoom-in-95 slide-in-from-top-2 duration-200 origin-top-right`}
                                                >
                                                    <div className="py-1">
                                                        <button onClick={(e) => { e.stopPropagation(); handlePreview(doc); setActiveMenuId(null); }} className="group w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2">
                                                            <Eye size={14} className="text-blue-500 group-hover:scale-110 transition-transform" /> Lihat Detail
                                                        </button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleDownload(doc); setActiveMenuId(null); }} className="group w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2">
                                                            <Download size={14} className="text-green-500 group-hover:translate-y-0.5 transition-transform" /> Download
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedDocForRevision(doc);
                                                                setIsRevisionModalOpen(true);
                                                                setActiveMenuId(null);
                                                            }}
                                                            className="group w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2"
                                                        >
                                                            <History size={14} className="text-indigo-500 group-hover:rotate-[-20deg] transition-transform" /> Riwayat Revisi
                                                        </button>
                                                        <div className="h-px bg-gray-100 dark:bg-slate-800 my-1" />

                                                        {hasPermission('documents', 'create') && (
                                                            <button onClick={(e) => { e.stopPropagation(); startMgmtOp('copy', 'file', doc); setActiveMenuId(null); }} className="group w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2">
                                                                <Copy size={14} className="group-hover:scale-110 transition-transform" /> Salin
                                                            </button>
                                                        )}
                                                        {hasPermission('documents', 'edit') && (
                                                            <>
                                                                <button onClick={(e) => { e.stopPropagation(); startMgmtOp('move', 'file', doc); setActiveMenuId(null); }} className="group w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2">
                                                                    <Move size={14} className="group-hover:translate-x-1 transition-transform" /> Pindah
                                                                </button>
                                                                <button onClick={(e) => { handleRenameDoc(e, doc); setActiveMenuId(null); }} className="group w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2">
                                                                    <PenLine size={14} className="group-hover:rotate-12 transition-transform" /> Ganti Nama
                                                                </button>
                                                                <button onClick={(e) => { handleEditDoc(e, doc); setActiveMenuId(null); }} className="group w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2">
                                                                    <UploadCloud size={14} className="group-hover:-translate-y-1 transition-transform" /> Update File
                                                                </button>
                                                            </>
                                                        )}
                                                        {hasPermission('documents', 'delete') && (
                                                            <>
                                                                <div className="h-px bg-gray-100 dark:bg-slate-800 my-1" />
                                                                <button onClick={(e) => { handleDeleteDoc(e, doc.id); setActiveMenuId(null); }} className="group w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center gap-2">
                                                                    <Trash2 size={14} className="group-hover:scale-110 transition-transform" /> Hapus
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Quick Actions (Hover Only) */}
                                        <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-10">
                                            <button onClick={(e) => { e.stopPropagation(); handlePreview(doc); }} className="p-2 bg-white dark:bg-slate-800 text-gray-500 hover:text-blue-600 rounded-full shadow-md border border-gray-100 dark:border-slate-700" title="Lihat">
                                                <Eye size={16} />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDownload(doc); }} className="p-2 bg-white dark:bg-slate-800 text-gray-500 hover:text-green-600 rounded-full shadow-md border border-gray-100 dark:border-slate-700" title="Download">
                                                <Download size={16} />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); setSelectedDocForRevision(doc); setIsRevisionModalOpen(true); }} className="p-2 bg-white dark:bg-slate-800 text-gray-500 hover:text-indigo-600 rounded-full shadow-md border border-gray-100 dark:border-slate-700" title="Riwayat Revisi">
                                                <History size={16} />
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-center py-4 mb-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                            {doc.type && doc.type.includes('pdf') ?
                                                <FileDigit size={40} className="text-red-500 drop-shadow-sm" strokeWidth={1.5} /> :
                                                doc.type && doc.type.includes('image') ?
                                                    <Image size={40} className="text-purple-500 drop-shadow-sm" strokeWidth={1.5} /> :
                                                    <File size={40} className="text-blue-500 drop-shadow-sm" strokeWidth={1.5} />
                                            }
                                        </div>

                                        <div className="flex-1 w-full">
                                            <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm line-clamp-2 leading-snug mb-2 break-words" title={doc.title}>
                                                {doc.title}
                                            </h3>

                                            <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-slate-500 mt-auto">
                                                <span className="font-mono bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{doc.size}</span>
                                                {doc.status === 'processing' || doc.status === 'waiting' ? (
                                                    <span className="text-amber-500 font-bold animate-pulse">PROSES OCR...</span>
                                                ) : doc.status === 'failed' ? (
                                                    <span className="text-red-500 font-bold">OCR GAGAL</span>
                                                ) : (
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-bold text-indigo-500">v{doc.version}</span>
                                                        {doc.versionsHistory?.length > 0 && (
                                                            <span className="text-[8px] text-slate-400 font-medium">({doc.versionsHistory.length} Revisi)</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {searchQuery && (
                                                <div className="mt-1 text-[10px] text-gray-400 flex items-center gap-1">
                                                    <FolderOpen size={10} />
                                                    <span className="truncate max-w-[100px]">{(folders || []).find(f => f.id === doc.folderId)?.name || 'Root'}</span>
                                                </div>
                                            )}

                                            {isContentMatch && (
                                                <div className="mt-2 p-1.5 bg-yellow-50 dark:bg-yellow-900/10 rounded border border-yellow-100 dark:border-yellow-900/20 text-[10px] text-gray-600 dark:text-slate-300">
                                                    <span className="flex items-center gap-1 font-bold text-yellow-700 dark:text-yellow-500 mb-0.5"><Highlighter size={10} /> Match:</span>
                                                    <p className="line-clamp-2 italic leading-tight opacity-90">"{getSearchSnippet(doc.ocrContent, searchQuery)}"</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        // --- LIST VIEW ---
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
                            <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-800 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                <div className="col-span-6 md:col-span-5">Nama Dokumen</div>
                                <div className="col-span-2 hidden md:block">Ukuran</div>
                                <div className="col-span-2 hidden md:block">Versi</div>
                                <div className="col-span-2 md:col-span-3 text-right">Aksi</div>
                            </div>
                            <div className="divide-y divide-gray-100 dark:divide-slate-800">
                                {/* Folders in List View */}
                                {(folders || []).filter(f => {
                                    const isCurrentRoot = !currentFolderId || currentFolderId === 'null' || currentFolderId === 'undefined' || currentFolderId === 0 || currentFolderId === '0';
                                    const isFolderRoot = !f.parentId || f.parentId === 'null' || f.parentId === 'undefined' || f.parentId === 0 || f.parentId === '0';
                                    const structureMatch = isCurrentRoot ? isFolderRoot : (String(f.parentId) === String(currentFolderId));
                                    const searchMatch = (f.name || '').toLowerCase().includes(searchQuery.toLowerCase());
                                    return structureMatch && searchMatch;
                                }).map((folder) => (
                                    <div key={folder.id} className={`group grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors cursor-pointer ${selectedFolderIds.has(folder.id) ? 'bg-indigo-50/40 dark:bg-indigo-900/10' : ''}`}
                                        onClick={() => navigateFolder(folder.id)}
                                    >
                                        <div className="col-span-6 md:col-span-12 flex items-center gap-4 overflow-hidden">
                                            {hasPermission('documents', 'delete') && !(['DataBox', 'TaxAudit', 'PUSTAKA', 'ApprovalDoc', 'SOP'].includes(folder.name)) && (
                                                <div onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedFolderIds.has(folder.id)}
                                                        onChange={() => toggleFolderSelection(folder.id, folder.name)}
                                                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                    />
                                                </div>
                                            )}
                                            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-amber-50 dark:bg-amber-900/20 text-amber-500 rounded-lg">
                                                <FolderOpen size={18} fill="currentColor" className="opacity-70" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-gray-800 dark:text-gray-200 text-sm truncate" title={folder.name}>{folder.name}</div>
                                                <div className="text-[10px] text-gray-400">Folder • {folder.owner || 'System'}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Documents in List View */}
                                {(docList || []).filter(d => {
                                    const matchesSearch = ((d.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || (d.ocrContent || '').toLowerCase().includes(searchQuery.toLowerCase()));
                                    if (searchQuery) return matchesSearch; // Global search
                                    return (String(d.folderId) === String(currentFolderId) || ((!d.folderId || d.folderId === 'null') && (currentFolderId === null || currentFolderId === 'null')));
                                }).map((doc) => {
                                    const isContentMatch = (doc.ocrContent || '').toLowerCase().includes(searchQuery.toLowerCase()) && searchQuery.length > 0;

                                    return (
                                        <div key={doc.id} className={`group grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${selectedDocIds.has(doc.id) ? 'bg-indigo-50/40 dark:bg-indigo-900/10' : ''}`}
                                            onClick={(e) => {
                                                // Handle row click based on selection mode logic or just view
                                                if (e.ctrlKey || e.metaKey) {
                                                    toggleDocSelection(doc.id);
                                                } else {
                                                    handlePreview(doc)
                                                }
                                            }}
                                        >
                                            <div className="col-span-6 md:col-span-5 flex items-center gap-4 overflow-hidden">
                                                {hasPermission('documents', 'delete') && (
                                                    <div onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedDocIds.has(doc.id)}
                                                            onChange={() => toggleDocSelection(doc.id)}
                                                            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                        />
                                                    </div>
                                                )}
                                                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg">
                                                    {doc.type && doc.type.includes('pdf') ?
                                                        <FileDigit size={18} className="text-red-500" /> :
                                                        doc.type && doc.type.includes('image') ?
                                                            <Image size={18} className="text-purple-500" /> :
                                                            <File size={18} className="text-blue-500" />
                                                    }
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-semibold text-gray-800 dark:text-gray-200 text-sm truncate" title={doc.title}>{doc.title}</div>
                                                    {isContentMatch && (
                                                        <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                                                            <Highlighter size={10} className="text-yellow-500" />
                                                            <span className="truncate italic">"{getSearchSnippet(doc.ocrContent, searchQuery)}"</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="col-span-2 hidden md:flex items-center text-sm text-gray-500 dark:text-slate-400 font-mono">
                                                {doc.size}
                                            </div>
                                            <div className="col-span-2 hidden md:flex items-center">
                                                <div className="flex flex-col">
                                                    <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-md">v{doc.version}</span>
                                                    {doc.versionsHistory && (Array.isArray(doc.versionsHistory) ? doc.versionsHistory.length > 0 : (typeof doc.versionsHistory === 'string' && doc.versionsHistory !== '[]')) && (
                                                        <span className="text-[9px] text-slate-400 font-medium ml-1">({Array.isArray(doc.versionsHistory) ? doc.versionsHistory.length : JSON.parse(doc.versionsHistory).length} Revisi)</span>
                                                    )}
                                                </div>

                                            </div>
                                            <div className="col-span-2 md:col-span-3 flex items-center justify-end gap-2">
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mr-2">
                                                    <button onClick={(e) => { e.stopPropagation(); handlePreview(doc) }} className="group/btn p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg" title="Lihat">
                                                        <Eye size={16} className="group-hover/btn:scale-110 transition-transform" />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDownload(doc) }} className="group/btn p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg" title="Download">
                                                        <Download size={16} className="group-hover/btn:translate-y-0.5 transition-transform" />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); setSelectedDocForRevision(doc); setIsRevisionModalOpen(true); }} className="group/btn p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg" title="Riwayat Revisi">
                                                        <History size={16} className="group-hover/btn:rotate-[-20deg] transition-transform" />
                                                    </button>
                                                </div>
                                                <div className="relative">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === doc.id ? null : doc.id); }}
                                                        className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg transition-colors"
                                                    >
                                                        <MoreVertical size={16} />
                                                    </button>
                                                    {/* Re-use Dropdown Logic from Grid View - Maybe abstract later? For now inline to keep it working */}
                                                    {activeMenuId === doc.id && (
                                                        <div
                                                            className={`absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 z-[130] overflow-hidden animate-in zoom-in-95`}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <div className="py-1">
                                                                <button onClick={() => { handlePreview(doc); setActiveMenuId(null); }} className="group w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2">
                                                                    <Eye size={14} className="text-blue-500 group-hover:scale-110 transition-transform" /> Lihat Detail
                                                                </button>
                                                                <button onClick={() => { handleDownload(doc); setActiveMenuId(null); }} className="group w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2">
                                                                    <Download size={14} className="text-green-500 group-hover:translate-y-0.5 transition-transform" /> Download
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedDocForRevision(doc);
                                                                        setIsRevisionModalOpen(true);
                                                                        setActiveMenuId(null);
                                                                    }}
                                                                    className="group w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2"
                                                                >
                                                                    <History size={14} className="text-indigo-500 group-hover:rotate-[-20deg] transition-transform" /> Riwayat Revisi
                                                                </button>
                                                                <div className="h-px bg-gray-100 dark:bg-slate-800 my-1" />

                                                                {hasPermission('documents', 'create') && (
                                                                    <button onClick={() => { startMgmtOp('copy', 'file', doc); setActiveMenuId(null); }} className="group w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2">
                                                                        <Copy size={14} className="group-hover:scale-110 transition-transform" /> Salin
                                                                    </button>
                                                                )}
                                                                {hasPermission('documents', 'edit') && (
                                                                    <>
                                                                        <button onClick={() => { startMgmtOp('move', 'file', doc); setActiveMenuId(null); }} className="group w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2">
                                                                            <Move size={14} className="group-hover:translate-x-1 transition-transform" /> Pindah
                                                                        </button>
                                                                        <button onClick={(e) => { handleRenameDoc(e, doc); setActiveMenuId(null); }} className="group w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2">
                                                                            <PenLine size={14} className="group-hover:rotate-12 transition-transform" /> Ganti Nama
                                                                        </button>
                                                                        <button onClick={(e) => { handleEditDoc(e, doc); setActiveMenuId(null); }} className="group w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2">
                                                                            <UploadCloud size={14} className="group-hover:-translate-y-1 transition-transform" /> Update File
                                                                        </button>
                                                                    </>
                                                                )}
                                                                {hasPermission('documents', 'delete') && (
                                                                    <>
                                                                        <div className="h-px bg-gray-100 dark:bg-slate-800 my-1" />
                                                                        <button onClick={(e) => { handleDeleteDoc(e, doc.id); setActiveMenuId(null); }} className="group w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center gap-2">
                                                                            <Trash2 size={14} className="group-hover:scale-110 transition-transform" /> Hapus
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            {(docList || []).filter(d => (String(d.folderId) === String(currentFolderId) || (!d.folderId && currentFolderId === null))).length === 0 && (
                                <div className="p-8 text-center text-gray-400 italic">
                                    Folder ini kosong.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div >

            {/* Global Backdrop for Menus - Click anywhere to close */}
            {
                (activeMenuId || activeFolderMenuId) && (
                    <div
                        className="fixed inset-0 z-[100] bg-transparent"
                        onClick={() => {
                            setActiveMenuId(null);
                            setActiveFolderMenuId(null);
                        }}
                    />
                )
            }

            {/* MANAGEMENT MODAL (COPY/MOVE) */}
            <Modal
                isOpen={isMgmtModalOpen}
                onClose={() => !isExecutingOp && setIsMgmtModalOpen(false)}
                title={mgmtOp?.type === 'copy' ? 'Salin Dokumen' : 'Pindah Dokumen'}
                size="max-w-md"
            >
                <div className="flex flex-col relative pt-4">
                    <div className="mb-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`p-2.5 rounded-2xl ${mgmtOp?.type === 'copy' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                {mgmtOp?.type === 'copy' ? <Copy size={20} /> : <Move size={20} />}
                            </div>
                            <div>
                                <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-tight">
                                    {mgmtOp?.type === 'copy' ? 'Salin' : 'Pindah'} <span className="opacity-50">{mgmtOp?.itemType === 'file' ? 'File' : 'Folder'}</span>
                                </h4>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pilih Folder Tujuan</p>
                            </div>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">
                                "{mgmtOp?.item?.title || mgmtOp?.item?.name}"
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2 mb-6 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">
                        <button
                            onClick={() => performCopyMove(null)}
                            className="w-full flex items-center gap-3 px-4 py-3 bg-white/40 dark:bg-slate-800/40 hover:bg-white/80 dark:hover:bg-slate-800 hover:shadow-lg hover:scale-[1.02] border border-transparent hover:border-indigo-200 transition-all rounded-2xl group"
                        >
                            <div className="p-2.5 bg-slate-100 dark:bg-slate-700/50 rounded-xl group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/40 text-slate-500 group-hover:text-indigo-600 transition-colors">
                                <HardDrive size={20} />
                            </div>
                            <span className="font-bold text-slate-700 dark:text-slate-200">Semua Dokumen (Root)</span>
                        </button>

                        {folders.filter(f => mgmtOp?.item && String(f.id) !== String(mgmtOp.item.id)).map(folder => (
                            <button
                                key={folder.id}
                                onClick={() => performCopyMove(folder.id)}
                                className="w-full flex items-center gap-3 px-4 py-3 bg-white/40 dark:bg-slate-800/40 hover:bg-white/80 dark:hover:bg-slate-800 hover:shadow-lg hover:scale-[1.02] border border-transparent hover:border-amber-200 transition-all rounded-2xl group"
                            >
                                <div className="p-2.5 bg-amber-50 dark:bg-amber-900/10 rounded-xl group-hover:bg-amber-100 dark:group-hover:bg-amber-900/30 text-amber-500/70 group-hover:text-amber-600 transition-colors">
                                    <FolderOpen size={20} fill="currentColor" className="opacity-80" />
                                </div>
                                <div className="text-left">
                                    <span className="font-bold text-slate-700 dark:text-slate-200 block">{folder.name}</span>
                                    <span className="text-[10px] text-slate-400 font-mono">ID: {folder.id}</span>
                                </div>
                            </button>
                        ))}
                    </div>

                    {isExecutingOp && (
                        <div className="pt-4 border-t border-white/20 dark:border-white/5">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2 px-1">
                                <span className="text-indigo-600 animate-pulse">Menghubungkan...</span>
                                <span className="text-slate-500">{opProgress}%</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className="bg-indigo-600 h-full transition-all duration-300 ease-out shadow-[0_0_15px_rgba(79,70,229,0.5)]"
                                    style={{ width: `${opProgress}%` }}
                                ></div>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            {/* FOLDER MODAL */}
            <Modal
                isOpen={isFolderModalOpen}
                onClose={() => setIsFolderModalOpen(false)}
                title={folderForm.id ? 'Edit Konfigurasi Folder' : 'Buat Folder Baru'}
                size="max-w-md"
            >
                <div className="space-y-6 px-1 pt-4 custom-scrollbar">
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest ml-1">Nama Folder</label>
                        <input
                            value={folderForm.name}
                            onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
                            disabled={['DataBox', 'TaxAudit', 'PUSTAKA', 'ApprovalDoc'].includes(folderForm.name)}
                            className={`w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:border-indigo-500 transition-all outline-none dark:text-white font-black ${folderForm.name === 'DataBox' || folderForm.name === 'TaxAudit' || folderForm.name === 'ApprovalDoc' ? 'opacity-50 cursor-not-allowed' : ''}`}
                            placeholder="Contoh: Laporan Keuangan"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest ml-1">Privasi & Akses Kontrol</label>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { id: 'public', label: 'Umum', icon: Users, desc: 'Akses Publik' },
                                { id: 'private', label: 'Pribadi', icon: Lock, desc: 'Akses Terbatas' },
                                { id: 'dept', label: 'Unit Kerja', icon: Building, desc: 'Departemen' },
                                { id: 'user', label: 'Spesifik', icon: User, desc: 'User Terpilih' }
                            ].map(type => (
                                <button
                                    key={type.id}
                                    onClick={() => setFolderForm({ ...folderForm, privacy: type.id })}
                                    className={`p-4 rounded-3xl border-2 text-left transition-all relative overflow-hidden group/btn ${folderForm.privacy === type.id
                                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-lg scale-[1.02]'
                                        : 'border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-800/30 hover:border-indigo-300'
                                        }`}
                                >
                                    <div className="flex items-center gap-2 mb-1 relative z-10">
                                        <type.icon size={18} className={`${folderForm.privacy === type.id ? 'text-indigo-600' : 'text-slate-400'} group-hover/btn:scale-110 transition-transform duration-300`} />
                                        <span className={`text-xs font-black uppercase tracking-tight ${folderForm.privacy === type.id ? 'text-indigo-950 dark:text-indigo-100' : 'text-slate-600 dark:text-slate-300'}`}>{type.label}</span>
                                    </div>
                                    <p className={`text-[9px] font-bold uppercase tracking-widest relative z-10 ${folderForm.privacy === type.id ? 'text-indigo-600/70 dark:text-indigo-400/80' : 'text-slate-400'}`}>{type.desc}</p>

                                    {folderForm.privacy === type.id && (
                                        <div className="absolute top-0 right-0 w-12 h-12 bg-indigo-500/10 rounded-full -mr-6 -mt-6 blur-xl"></div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Conditional Inputs */}
                    {folderForm.privacy === 'dept' && (
                        <div className="p-5 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-[2rem] border border-indigo-100 dark:border-indigo-800/50 animate-in slide-in-from-top-2">
                            <label className="block text-[10px] font-black text-indigo-700 dark:text-indigo-300 mb-3 uppercase tracking-widest">Pilih Departemen Terdaftar</label>
                            <div className="max-h-40 overflow-y-auto pr-2 custom-scrollbar space-y-1.5">
                                {(departments || []).map(dept => (
                                    <label key={dept.id} className="flex items-center gap-3 p-3 bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-indigo-200">
                                        <input
                                            type="checkbox"
                                            checked={folderForm.allowedDepts.includes(dept.name)}
                                            onChange={(e) => {
                                                const newDepts = e.target.checked
                                                    ? [...folderForm.allowedDepts, dept.name]
                                                    : folderForm.allowedDepts.filter(d => d !== dept.name);
                                                setFolderForm({ ...folderForm, allowedDepts: newDepts });
                                            }}
                                            className="w-5 h-5 rounded-lg text-indigo-600 focus:ring-indigo-500 border-indigo-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                        />
                                        <span className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">{dept.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {folderForm.privacy === 'user' && (
                        <div className="p-5 bg-purple-50/50 dark:bg-purple-900/20 rounded-[2rem] border border-purple-100 dark:border-purple-800/50 animate-in slide-in-from-top-2">
                            <label className="block text-[10px] font-black text-purple-700 dark:text-purple-300 mb-3 uppercase tracking-widest">Akses Pengguna Spesifik</label>
                            <div className="max-h-40 overflow-y-auto pr-2 custom-scrollbar space-y-1.5">
                                {(users || []).filter(u => u.username !== currentUser?.username).map(user => (
                                    <label key={user.id} className="flex items-center gap-3 p-3 bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-purple-200">
                                        <input
                                            type="checkbox"
                                            checked={folderForm.allowedUsers.includes(user.username)}
                                            onChange={(e) => {
                                                const newUsers = e.target.checked
                                                    ? [...folderForm.allowedUsers, user.username]
                                                    : folderForm.allowedUsers.filter(u => u !== user.username);
                                                setFolderForm({ ...folderForm, allowedUsers: newUsers });
                                            }}
                                            className="w-5 h-5 rounded-lg text-purple-600 focus:ring-purple-500 border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                        />
                                        <div className="text-left leading-tight">
                                            <span className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight block">{user.name}</span>
                                            <span className="text-[10px] text-purple-600/70 font-bold">{user.department}</span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 pt-6 border-t border-slate-100 dark:border-slate-800 mt-2">
                        <button onClick={() => setIsFolderModalOpen(false)} className="flex-1 py-4 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white text-xs font-black uppercase tracking-widest transition-all">Batalkan</button>
                        <button
                            onClick={() => {
                                if (folderForm.id) {
                                    handleEditFolder(null, folders.find(f => f.id === folderForm.id), folderForm);
                                } else {
                                    handleCreateFolder(folderForm);
                                }
                                setIsFolderModalOpen(false);
                            }}
                            disabled={!folderForm.name}
                            className="flex-[2] py-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-black uppercase tracking-widest rounded-[1.25rem] shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {folderForm.id ? 'Simpan Perubahan' : 'Buat Folder Sekarang'}
                        </button>
                    </div>
                </div>
            </Modal>
            {/* FLOATING BULK ACTIONS BAR */}
            {
                (selectedDocIds.size > 0 || selectedFolderIds.size > 0) && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/70 dark:bg-slate-900/80 backdrop-blur-3xl shadow-2xl rounded-full px-6 py-3 flex items-center gap-4 z-50 border border-white/40 dark:border-white/10 animate-in slide-in-from-bottom-4 duration-300 ring-1 ring-black/5">
                        <span className="text-sm font-bold text-slate-700 dark:text-gray-200 pl-2 border-r border-slate-200 dark:border-slate-700 pr-5">
                            {selectedDocIds.size + selectedFolderIds.size} item dipilih
                        </span>

                        <button
                            onClick={handleDeselectAll}
                            className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white text-sm font-medium transition-colors"
                        >
                            Batal
                        </button>

                        <button
                            onClick={handleBulkDelete}
                            disabled={isBulkDeleting}
                            className="bg-red-600 hover:bg-red-500 text-white px-5 py-2 rounded-full text-sm font-bold flex items-center gap-2 shadow-red-500/30 shadow-lg transition-transform active:scale-95"
                        >
                            {isBulkDeleting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white rounded-full animate-spin border-t-transparent" />
                                    Menghapus...
                                </>
                            ) : (
                                <>
                                    <Trash2 size={16} />
                                    Hapus ({selectedDocIds.size + selectedFolderIds.size})
                                </>
                            )}
                        </button>
                    </div>
                )
            }

            {/* REVISION HISTORY MODAL */}
            <Modal
                isOpen={isRevisionModalOpen}
                onClose={() => setIsRevisionModalOpen(false)}
                title="Riwayat Revisi Dokumen"
                size="max-w-xl"
            >
                <div className="space-y-4 pt-4">
                    <div className="flex items-center gap-3 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/50">
                        <div className="p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
                            <FileText size={24} className="text-indigo-600" />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-800 dark:text-white truncate max-w-[300px]">{selectedDocForRevision?.title}</h4>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">ID: {selectedDocForRevision?.id} • Versi Saat Ini: v{selectedDocForRevision?.version}</p>
                        </div>
                    </div>

                    <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                        {(() => {
                            let history = [];
                            try {
                                const rawH = selectedDocForRevision?.versionsHistory;
                                history = Array.isArray(rawH) ? rawH : (typeof rawH === 'string' ? JSON.parse(rawH) : []);

                            } catch (e) { }

                            if (history.length === 0) {
                                return (
                                    <div className="py-12 text-center text-slate-400 italic bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                        Belum ada riwayat revisi untuk dokumen ini.
                                    </div>
                                );
                            }

                            return history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map((rev, idx) => (
                                <div key={idx} className="group flex items-center gap-4 p-4 bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-indigo-200 dark:hover:border-indigo-800 transition-all">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold rounded uppercase">Revisi</span>
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{new Date(rev.timestamp).toLocaleString()}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-medium truncate">Diunggah oleh: <span className="text-indigo-600 dark:text-indigo-400">{rev.user}</span> • Ukuran: {rev.size}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <a
                                            href={rev.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-blue-600 rounded-xl transition-colors"
                                            title="Lihat Versi Ini"
                                        >
                                            <Eye size={16} />
                                        </a>
                                        <button
                                            onClick={() => handleRestoreVersion(selectedDocForRevision.id, rev.timestamp)}
                                            disabled={isRestoring}
                                            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                                        >
                                            <RefreshCw size={14} className={isRestoring ? 'animate-spin' : ''} />
                                            Restore
                                        </button>
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                </div>
            </Modal>

            {/* QUICK PREVIEW MODAL */}
            <Modal
                isOpen={!!selectedDocPreview}
                onClose={() => {
                    setSelectedDocPreview(null);
                    setPdfBlobUrl(null);
                }}
                title="Preview Dokumen & OCR"
                size="max-w-[95vw]"
            >
                <div className="flex h-full min-h-0 flex-col gap-4 pt-4 lg:flex-row">
                    {/* COLUMN 1: FILE PREVIEW */}
                    <div className="flex-[2] bg-slate-100 dark:bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-800 relative shadow-inner min-w-0">
                        {isGeneratingPreview ? (
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-sm font-bold text-slate-500 animate-pulse">Menyiapkan Preview...</p>
                            </div>
                        ) : previewFile?.type?.toLowerCase()?.startsWith('image/') ? (
                            <img src={previewFile?.fileData || previewFile?.file_data || previewFile?.filedata || getFullUrl(previewFile?.url) || undefined} alt="Preview" className="max-w-full max-h-full object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                        ) : previewFile?.type?.toLowerCase()?.includes('pdf') ? (
                            pdfBlobUrl ? (
                                <PdfViewer src={pdfBlobUrl} className="w-full h-full" />
                            ) : (
                                <div className="flex flex-col items-center gap-3">
                                    <FileText size={64} className="text-slate-300" />
                                    <p className="text-sm font-bold text-slate-500">Data PDF tidak tersedia</p>
                                    <p className="text-[10px] text-slate-400">File mungkin belum diunggah ulang ke server.</p>
                                    <button onClick={() => handleDownload(selectedDocPreview)} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg hover:scale-105 transition-all">DOWNLOAD PDF</button>
                                </div>
                            )
                        ) : previewHtml ? (
                            <div className="w-full h-full p-8 bg-white dark:bg-slate-900 overflow-auto prose dark:prose-invert max-w-none shadow-inner" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                        ) : (
                            <div className="text-center p-10 text-slate-400">
                                <FileText size={64} className="mx-auto mb-4 opacity-20" />
                                <p className="font-bold uppercase tracking-widest text-xs">Preview Terbatas</p>
                                <p className="text-[10px] mt-2 opacity-60">Format ini tidak mendukung preview langsung.<br />Gunakan tombol Download untuk melihat file.</p>
                                <button onClick={() => handleDownload(selectedDocPreview)} className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all">DOWNLOAD FILE</button>
                            </div>
                        )}
                    </div>

                    {/* COLUMN 2: METADATA & CHAT */}
                    <div className="flex-1 flex flex-col h-full space-y-3 overflow-hidden min-w-[280px]">
                        {/* Doc Info */}
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 shrink-0">
                            <h4 className="font-black text-indigo-900 dark:text-indigo-100 text-sm truncate mb-1">{selectedDocPreview?.title}</h4>
                            <div className="flex flex-wrap gap-2 text-[10px] font-bold text-indigo-600/70 dark:text-indigo-400/70 uppercase tracking-wider">
                                <span>{selectedDocPreview?.size}</span>
                                <span>•</span>
                                <span>v{selectedDocPreview?.version}</span>
                                <span>•</span>
                                <span>{new Date(selectedDocPreview?.uploadDate).toLocaleDateString()}</span>
                            </div>
                        </div>

                        {/* Chat Messages */}
                        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2 shrink-0">
                                <MoreVertical size={12} className="text-indigo-500" /> Riwayat Koordinasi
                            </h4>
                            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-1 bg-slate-50/30 dark:bg-slate-900/30 rounded-2xl p-2">
                                <div className="space-y-4 flex flex-col">
                                    {Array.isArray(comments) && comments.map(c => {
                                        const isMe = c.user === currentUser?.name || c.user === currentUser?.username;
                                        const timestamp = c.timestamp ? new Date(c.timestamp) : null;
                                        const isValidDate = timestamp && !isNaN(timestamp.getTime());

                                        return (
                                            <div key={c.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} w-full animate-in slide-in-from-bottom-2`}>
                                                <div className={`max-w-[85%] p-3 rounded-2xl shadow-sm ${isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-tl-none'}`}>
                                                    <div className="flex justify-between items-center gap-4 text-[9px] mb-1 opacity-80 font-black uppercase tracking-wider">
                                                        {!isMe && <span className="text-indigo-600 dark:text-indigo-400">{c.user}</span>}
                                                        <span className={isMe ? 'text-indigo-100 ml-auto' : 'text-slate-400'}>
                                                            {isValidDate ? timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs leading-relaxed break-words">{c.text}</p>
                                                    {c.attachmentUrl && (
                                                        <div className={`mt-2 flex items-center justify-between p-2 rounded-lg border border-dashed ${isMe ? 'bg-white/10 border-white/20' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                <Paperclip size={10} className={isMe ? 'text-indigo-200' : 'text-indigo-500'} />
                                                                <span className="text-[9px] font-bold truncate max-w-[100px]">{c.attachmentName}</span>
                                                            </div>
                                                            <div className="flex gap-2 shrink-0 ml-2">
                                                                <button onClick={() => handlePreview({ id: 'att-' + c.id, url: c.attachmentUrl, title: c.attachmentName, type: c.attachmentType, fileData: null }, true)} className={`text-[9px] font-black uppercase hover:underline ${isMe ? 'text-white' : 'text-indigo-600'}`}>Preview</button>
                                                                {hasPermission('documents', 'edit') && (
                                                                    <button onClick={() => handlePromoteAttachment(c.id)} className={`text-[9px] font-black uppercase hover:underline ${isMe ? 'text-emerald-300' : 'text-emerald-600'}`}>Revisi</button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={chatEndRef} />
                                </div>
                            </div>
                        </div>

                        {/* Chat Input */}
                        <div className="space-y-2 shrink-0">
                            <textarea
                                value={newComment} onChange={e => setNewComment(e.target.value)}
                                placeholder="Tulis komentar..."
                                className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white resize-none"
                                rows="2"
                            />
                            <div className="flex justify-between items-center">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <div className={`p-2 rounded-lg ${commentAttachment ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                        <Paperclip size={14} />
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-500 truncate max-w-[100px]">{commentAttachment ? commentAttachment.name : 'Lampiran'}</span>
                                    <input type="file" className="hidden" onChange={e => setCommentAttachment(e.target.files[0])} />
                                </label>
                                <button onClick={handlePostComment} disabled={isPostingComment || (!newComment.trim() && !commentAttachment)} className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-lg disabled:opacity-50">Kirim</button>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 shrink-0">
                            <button onClick={() => setSelectedDocPreview(null)} className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Tutup</button>
                            <button onClick={() => handleDownload(selectedDocPreview)} className="flex-[2] py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition-all flex items-center justify-center gap-2"><Download size={14} /> Download</button>
                        </div>
                    </div>

                    {/* COLUMN 3: OCR RESULTS */}
                    <div className="flex-1 flex flex-col h-full min-w-[280px] overflow-hidden">
                        <div className="flex items-center gap-2 mb-2 shrink-0">
                            <Sparkles size={14} className="text-indigo-500" />
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Hasil Ekstraksi Teks (OCR)</h4>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap shadow-inner">
                            {selectedDocPreview?.ocrContent || "Tidak ada data teks yang terdeteksi."}
                        </div>
                    </div>
                </div>
            </Modal>
        </>
    );
}
