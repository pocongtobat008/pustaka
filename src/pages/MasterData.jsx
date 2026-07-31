import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Edit3, Trash2, Building2, GitCommit, ShieldCheck, ChevronRight, ChevronLeft, Users, User, Shield, History, Search, Clock, ChevronDown, ChevronUp, AlertCircle, FileText, Activity, Bot, Save, Loader2, Zap, Upload, Download, Link, Eye, RefreshCw, X, Info, Brain } from 'lucide-react';
import { Card } from '../components/ui/Card';
import KnowledgeGraph from '../components/KnowledgeGraph.jsx';
import { apiClient, API_URL } from '../services/apiClient.js';
import { APP_MODULES } from '../utils/permissions';
import { useLanguage } from '../contexts/LanguageContext';

export default function MasterData({
    users, roles, departments, flows = [], logs = [],
    handleDeleteUser, handleEditRole, handleDeleteRole,
    handleSaveDept, handleDeleteDept,
    handleCreateUser, handleEditUser,
    handleCreateDept, handleEditDept,
    handleCreateRole,
    handleCreateFlow, handleEditFlow, handleDeleteFlow,
    setRoles, setDepartments,
    setIsModalOpen, setModalTab,
    hasPermission
}) {
    const { language } = useLanguage();
    const isEnglish = language === 'en';
    const dateLocale = isEnglish ? 'en-US' : 'id-ID';
    const text = isEnglish
        ? {
            tabs: {
                users: 'Users',
                roles: 'Roles',
                departments: 'Departments',
                flows: 'Flows',
                logs: 'Logs',
                ai: 'AI Agent',
                training: 'Training AI',
            },
            noDepartment: 'No Department',
            usersManagement: 'User Management',
            searchUser: 'Search user...',
            newUser: 'New User',
            userNotFound: 'User not found.',
            registeredMembers: 'Registered Members',
            roleAccessManagement: 'Role & Access Management',
            newRole: 'New Role',
            moduleAccess: 'Module Access',
            noPermissionSet: 'No access rights configured yet.',
            approvalFlowMaster: 'Approval Flow Master',
            newFlow: 'New Flow',
            editFlow: 'Edit Flow',
            deleteFlow: 'Delete Flow',
            auditTrailSystem: 'Audit Trail System',
            systemLogFile: 'System Log',
            serverLogs: 'Server Logs',
            errors: 'Errors',
            ocrFailures: 'OCR Failures',
            searchLogs: 'Search action, user, or details...',
            time: 'Time',
            user: 'User',
            action: 'Action',
            detail: 'Detail',
            data: 'Data',
            noActivity: 'No activity records found.',
            system: 'System',
            beforeOld: 'Before (Old)',
            afterNew: 'After (New)',
            showing: 'Showing',
            to: 'to',
            of: 'of',
            logsWord: 'logs',
            loadingLogFile: 'Loading Log File...',
            noServerLog: 'No server log (empty file).',
            noSystemError: 'No system errors (empty file).',
            noOcrFailure: 'No OCR failures (empty file).',
            aiSettingsTitle: 'AI Agent Settings',
            aiSettingsDesc: 'Configure the external LLM (OpenAI-compatible) used by the AI Agent in the Assistant to search the database and build reports.',
            baseUrl: 'Base URL',
            baseUrlPh: 'https://api.openai.com/v1',
            apiKey: 'API Key',
            apiKeyPh: 'sk-... (leave empty to keep existing)',
            model: 'Model',
            modelPh: 'gpt-4o-mini',
            enabled: 'Enable AI Agent',
            testConn: 'Test Connection',
            save: 'Save',
            aiStatus: 'Status',
            departmentList: 'Daftar Departemen',
            newDepartment: 'Departemen Baru',
            trainingTitle: 'Dokumen Training AI',
            trainingDesc: 'Upload dokumen (PDF, DOCX, TXT, link) sebagai referensi untuk AI Assistant.',
            uploadFile: 'Upload File',
            addLink: 'Tambah Link',
            title: 'Judul',
            titlePh: 'Judul dokumen...',
            category: 'Kategori',
            categories: { general: 'Umum', tax_regulation: 'Peraturan Pajak', accounting_standard: 'Standar Akuntansi', procedure: 'Prosedur', guide: 'Panduan' },
            tags: 'Tags',
            tagsPh: 'pajak, ppn, spt (pisah koma)',
            chooseFile: 'Pilih File',
            orPasteUrl: 'atau tempel URL',
            urlPh: 'https://...',
            upload: 'Upload & Proses',
            add: 'Tambah',
            processing: 'Diproses',
            active: 'Aktif',
            error: 'Error',
            preview: 'Lihat',
            reprocess: 'Proses Ulang',
            delete: 'Hapus',
            noTrainingDocs: 'Belum ada dokumen training.',
            uploadSuccess: 'File berhasil diunggah',
            linkSuccess: 'Link berhasil ditambahkan',
            deleteSuccess: 'Dokumen berhasil dihapus',
            deleteConfirm: 'Hapus dokumen ini?',
            fileType: 'Tipe File',
            uploadedAt: 'Diunggah',
            contentPreview: 'Isi Dokumen',
            refreshStatus: 'Refresh Status',
            detailLearning: 'Detail Proses',
            learningDetail: 'Detail Proses Learning',
            chunks: 'Jumlah Chunks',
            lastUpdated: 'Terakhir Diperbarui',
            embeddingStatus: 'Status Embedding',
            contentLength: 'Panjang Konten',
        }
        : {
            tabs: {
                users: 'Users',
                roles: 'Roles',
                departments: 'Departments',
                flows: 'Flows',
                logs: 'Logs',
                ai: 'AI Agent',
                training: 'Training AI',
            },
            noDepartment: 'Tanpa Departemen',
            usersManagement: 'Manajemen User',
            searchUser: 'Cari user...',
            newUser: 'User Baru',
            userNotFound: 'User tidak ditemukan.',
            registeredMembers: 'Anggota Terdaftar',
            roleAccessManagement: 'Manajemen Role & Hak Akses',
            newRole: 'Role Baru',
            moduleAccess: 'Hak Akses Modul',
            noPermissionSet: 'Belum ada hak akses yang diatur.',
            approvalFlowMaster: 'Master Alur Persetujuan',
            newFlow: 'Flow Baru',
            editFlow: 'Edit Flow',
            deleteFlow: 'Hapus Flow',
            auditTrailSystem: 'Audit Trail System',
            systemLogFile: 'System Log',
            serverLogs: 'Server Logs',
            errors: 'Errors',
            ocrFailures: 'OCR Failures',
            searchLogs: 'Cari aksi, user, atau detail...',
            time: 'Waktu',
            user: 'Pengguna',
            action: 'Aksi',
            detail: 'Detail',
            data: 'Data',
            noActivity: 'Tidak ada catatan aktivitas ditemukan.',
            system: 'System',
            beforeOld: 'Sebelum (Old)',
            afterNew: 'Sesudah (New)',
            showing: 'Menampilkan',
            to: '-',
            of: 'dari',
            logsWord: 'log',
            loadingLogFile: 'Memuat Log File...',
            noServerLog: 'Tidak ada log server (File kosong).',
            noSystemError: 'Tidak ada error system (File kosong).',
            noOcrFailure: 'Tidak ada kegagalan OCR (File kosong).',
            aiSettingsTitle: 'Pengaturan AI Agent',
            aiSettingsDesc: 'Atur LLM eksternal (kompatibel OpenAI) yang dipakai AI Agent di Asisten untuk mencari database dan menyusun laporan.',
            baseUrl: 'Base URL',
            baseUrlPh: 'https://api.openai.com/v1',
            apiKey: 'API Key',
            apiKeyPh: 'sk-... (kosongkan untuk mempertahankan yang ada)',
            model: 'Model',
            modelPh: 'gpt-4o-mini',
            enabled: 'Aktifkan AI Agent',
            testConn: 'Tes Koneksi',
            save: 'Simpan',
            aiStatus: 'Status',
            departmentList: 'Daftar Departemen',
            newDepartment: 'Departemen Baru',
            trainingTitle: 'Dokumen Training AI',
            trainingDesc: 'Upload dokumen (PDF, DOCX, TXT, link) sebagai referensi untuk AI Assistant.',
            uploadFile: 'Upload File',
            addLink: 'Tambah Link',
            title: 'Judul',
            titlePh: 'Judul dokumen...',
            category: 'Kategori',
            categories: { general: 'Umum', tax_regulation: 'Peraturan Pajak', accounting_standard: 'Standar Akuntansi', procedure: 'Prosedur', guide: 'Panduan' },
            tags: 'Tags',
            tagsPh: 'pajak, ppn, spt (pisah koma)',
            chooseFile: 'Pilih File',
            orPasteUrl: 'atau tempel URL',
            urlPh: 'https://...',
            upload: 'Upload & Proses',
            add: 'Tambah',
            processing: 'Diproses',
            active: 'Aktif',
            error: 'Error',
            preview: 'Lihat',
            reprocess: 'Proses Ulang',
            delete: 'Hapus',
            noTrainingDocs: 'Belum ada dokumen training.',
            uploadSuccess: 'File berhasil diunggah',
            linkSuccess: 'Link berhasil ditambahkan',
            deleteSuccess: 'Dokumen berhasil dihapus',
            deleteConfirm: 'Hapus dokumen ini?',
            fileType: 'Tipe File',
            uploadedAt: 'Diunggah',
            contentPreview: 'Isi Dokumen',
            refreshStatus: 'Refresh Status',
            detailLearning: 'Detail Proses',
            learningDetail: 'Detail Proses Learning',
            chunks: 'Jumlah Chunks',
            lastUpdated: 'Terakhir Diperbarui',
            embeddingStatus: 'Status Embedding',
            contentLength: 'Panjang Konten',
        };
    const [masterTab, setMasterTab] = useState('users');
    const [userSearchQuery, setUserSearchQuery] = useState('');

    // --- User Import from Excel ---
    const [importLoading, setImportLoading] = useState(false);
    const [importMsg, setImportMsg] = useState(null);
    const [importResult, setImportResult] = useState(null);
    const fileInputRef = React.useRef(null);

    const handleDownloadTemplate = async () => {
        try {
            const res = await fetch(`${API_URL}/users/template`, { credentials: 'include' });
            if (!res.ok) throw new Error('Gagal download template');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'template_import_users.xlsx';
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            setImportMsg({ type: 'error', text: e.message });
        }
    };

    const handleImportUsers = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportLoading(true);
        setImportMsg(null);
        setImportResult(null);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch(`${API_URL}/users/import`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });
            const data = await res.json();
            if (!res.ok && !data.created) throw new Error(data.error || 'Gagal import');
            setImportResult(data);
            setImportMsg({
                type: data.errors?.length > 0 ? 'warning' : 'success',
                text: `Import selesai: ${data.created} user dibuat, ${data.skipped} dilewati dari ${data.totalRows} baris.`,
            });
            // Socket event 'data:changed: users' emitted by backend auto-refreshes the list.
        } catch (e) {
            setImportMsg({ type: 'error', text: `Gagal import: ${e.message}` });
        } finally {
            setImportLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };
    const [logSearchQuery, setLogSearchQuery] = useState('');
    const [expandedDepts, setExpandedDepts] = useState({});
    const [expandedLogId, setExpandedLogId] = useState(null);
    const [logCurrentPage, setLogCurrentPage] = useState(1);
    const logsPerPage = 15;
    const [logSource, setLogSource] = useState('database'); // 'database', 'error_file', 'ocr_file', 'server_file'
    const [fileLogs, setFileLogs] = useState({ error: '', ocr: '', server: '' });
    const [isFileLoading, setIsFileLoading] = useState(false);

    // --- AI Agent settings (Master Data) ---
    const [aiSettings, setAiSettings] = useState({ base_url: '', api_key: '', model: '', enabled: false, hasApiKey: false, apiKeyMasked: '' });
    const [aiForm, setAiForm] = useState({ base_url: '', api_key: '', model: 'gpt-4o-mini', enabled: false });
    const [aiLoading, setAiLoading] = useState(false);
    const [aiTesting, setAiTesting] = useState(false);
    const [aiMsg, setAiMsg] = useState(null);
    const [aiModels, setAiModels] = useState([]);
    const [modelsLoading, setModelsLoading] = useState(false);

    // --- Training Documents (Master Data) ---
    const [trainingDocs, setTrainingDocs] = useState([]);
    const [trainingLoading, setTrainingLoading] = useState(false);
    const [trainingUploading, setTrainingUploading] = useState(false);
    const [trainingTab, setTrainingTab] = useState('upload'); // 'upload' or 'list'
    const [trainingForm, setTrainingForm] = useState({ title: '', category: 'general', tags: '', url: '' });
    const [trainingFile, setTrainingFile] = useState(null);
    const [trainingPreview, setTrainingPreview] = useState(null);
    const [trainingDetail, setTrainingDetail] = useState(null);
    const [trainingMsg, setTrainingMsg] = useState(null);

    // --- Self-Improvement / Learning ---
    const [learningStats, setLearningStats] = useState(null);
    const [learningTopics, setLearningTopics] = useState([]);
    const [learningLogs, setLearningLogs] = useState([]);
    const [learningLoading, setLearningLoading] = useState(false);
    const [learningAnalyzing, setLearningAnalyzing] = useState(false);
    const [learningGenerating, setLearningGenerating] = useState(false);
    const [learningMsg, setLearningMsg] = useState(null);

    // --- Corrections ---
    const [corrections, setCorrections] = useState([]);
    const [correctionStats, setCorrectionStats] = useState(null);

    // --- Evolution ---
    const [evolutionStats, setEvolutionStats] = useState(null);
    const [evolutionHistory, setEvolutionHistory] = useState([]);
    const [evolutionScanning, setEvolutionScanning] = useState(false);

    // --- Knowledge Graph (brain view) ---
    const [graphData, setGraphData] = useState(null);
    const [graphLoading, setGraphLoading] = useState(false);
    const fetchGraph = async () => {
        setGraphLoading(true);
        try {
            const g = await apiClient.fetchJson(`${API_URL}/ai/graph`);
            setGraphData(g);
        } catch (e) {
            console.warn('Graph fetch failed:', e.message);
        } finally {
            setGraphLoading(false);
        }
    };
    useEffect(() => {
        if (masterTab === 'training' && trainingTab === 'graph' && !graphData && !graphLoading) {
            fetchGraph();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [masterTab, trainingTab]);

    // --- 1MBrain Tab ---
    const [brainHealth, setBrainHealth] = useState(null);
    const [brainStats, setBrainStats] = useState(null);
    const [brainMemories, setBrainMemories] = useState([]);
    const [brainTotalMemories, setBrainTotalMemories] = useState(0);
    const [brainLoading, setBrainLoading] = useState(false);
    const [brainSearchQuery, setBrainSearchQuery] = useState('');
    const [brainSearchResults, setBrainSearchResults] = useState([]);
    const [brainSearching, setBrainSearching] = useState(false);
    const [brainConsolidating, setBrainConsolidating] = useState(false);
    const [brainConsolidateResult, setBrainConsolidateResult] = useState(null);
    const [brainIngestForm, setBrainIngestForm] = useState({ title: '', markdown: '' });
    const [brainIngesting, setBrainIngesting] = useState(false);
    const [brainSyncing, setBrainSyncing] = useState(false);
    const [brainSyncResult, setBrainSyncResult] = useState(null);

    const fetchBrainData = async () => {
        setBrainLoading(true);
        try {
            const [health, stats, memories] = await Promise.all([
                apiClient.fetchJson(`${API_URL}/ai/brain/health`),
                apiClient.fetchJson(`${API_URL}/ai/brain/stats`),
                apiClient.fetchJson(`${API_URL}/ai/brain/memories?limit=20`),
            ]);
            if (health?.success) setBrainHealth(health.data);
            if (stats?.success) setBrainStats(stats.data);
            if (memories?.success) {
                setBrainMemories(memories.data.memories || []);
                setBrainTotalMemories(memories.data.total || 0);
            }
        } catch (e) {
            console.warn('Brain data fetch failed:', e.message);
        } finally {
            setBrainLoading(false);
        }
    };

    const handleBrainSearch = async () => {
        if (!brainSearchQuery.trim()) return;
        setBrainSearching(true);
        try {
            const res = await apiClient.fetchJson(`${API_URL}/ai/brain/recall`, {
                method: 'POST',
                body: JSON.stringify({ query: brainSearchQuery, limit: 20 }),
            });
            if (res?.success) setBrainSearchResults(res.data || []);
        } catch (e) {
            console.warn('Brain search failed:', e.message);
        } finally {
            setBrainSearching(false);
        }
    };

    const handleBrainConsolidate = async () => {
        setBrainConsolidating(true);
        setBrainConsolidateResult(null);
        try {
            const res = await apiClient.fetchJson(`${API_URL}/ai/brain/consolidate`, {
                method: 'POST',
                body: JSON.stringify({}),
            });
            if (res?.success) setBrainConsolidateResult(res.data);
        } catch (e) {
            console.warn('Brain consolidate failed:', e.message);
        } finally {
            setBrainConsolidating(false);
        }
    };

    const handleBrainIngest = async (e) => {
        e.preventDefault();
        if (!brainIngestForm.title.trim() || !brainIngestForm.markdown.trim()) return;
        setBrainIngesting(true);
        try {
            const res = await apiClient.fetchJson(`${API_URL}/ai/brain/ingest`, {
                method: 'POST',
                body: JSON.stringify(brainIngestForm),
            });
            if (res?.success) {
                setBrainIngestForm({ title: '', markdown: '' });
                fetchBrainData();
            }
        } catch (e) {
            console.warn('Brain ingest failed:', e.message);
        } finally {
            setBrainIngesting(false);
        }
    };

    const handleBrainSyncTraining = async () => {
        setBrainSyncing(true);
        setBrainSyncResult(null);
        try {
            const res = await apiClient.fetchJson(`${API_URL}/ai/brain/sync-training`, {
                method: 'POST',
            });
            if (res?.success) setBrainSyncResult(res.data);
        } catch (e) {
            console.warn('Brain sync failed:', e.message);
        } finally {
            setBrainSyncing(false);
        }
    };

    // --- Pagination ---
    const [topicPage, setTopicPage] = useState(1);
    const [logPage, setLogPage] = useState(1);
    const [correctionPage, setCorrectionPage] = useState(1);
    const [evolutionPage, setEvolutionPage] = useState(1);
    const [docPage, setDocPage] = useState(1);
    const ROWS_PER_PAGE = 8;

    const fetchLearningData = async () => {
        setLearningLoading(true);
        try {
            const [stats, topics, logs] = await Promise.all([
                apiClient.fetchJson(`${API_URL}/ai/learning/stats`),
                apiClient.fetchJson(`${API_URL}/ai/learning/topics?limit=10`),
                apiClient.fetchJson(`${API_URL}/ai/learning/logs?limit=20`),
            ]);
            setLearningStats(stats);
            setLearningTopics(topics);
            setLearningLogs(logs);
            setTopicPage(1);
            setLogPage(1);
            setCorrectionPage(1);
            setEvolutionPage(1);
            setDocPage(1);

            // Also fetch corrections + evolution
            try {
                const [cStats, corrList, eStats, eHist] = await Promise.all([
                    apiClient.fetchJson(`${API_URL}/ai/corrections/stats`),
                    apiClient.fetchJson(`${API_URL}/ai/corrections?limit=20`),
                    apiClient.fetchJson(`${API_URL}/ai/evolution/stats`),
                    apiClient.fetchJson(`${API_URL}/ai/evolution/history?limit=10`),
                ]);
                setCorrectionStats(cStats);
                setCorrections(corrList);
                setEvolutionStats(eStats);
                setEvolutionHistory(eHist);
            } catch (e2) {
                console.warn('Corrections/Evolution fetch failed (non-critical):', e2.message);
            }
        } catch (e) {
            console.error('Failed to fetch learning data:', e);
        } finally {
            setLearningLoading(false);
        }
    };

    const handleAnalyze = async () => {
        setLearningAnalyzing(true);
        setLearningMsg(null);
        try {
            const res = await apiClient.fetchJson(`${API_URL}/ai/learning/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hours: 168 }),
            });
            setLearningMsg({ type: 'success', text: `Analisis selesai: ${res.processed} pesanan diproses dari ${res.total} total.` });
            await fetchLearningData();
        } catch (e) {
            setLearningMsg({ type: 'error', text: `Gagal menganalisis: ${e.message}` });
        } finally {
            setLearningAnalyzing(false);
        }
    };

    const handleGenerateFromKnowledge = async () => {
        setLearningGenerating(true);
        setLearningMsg(null);
        try {
            const res = await apiClient.fetchJson(`${API_URL}/ai/learning/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            setLearningMsg({
                type: 'success',
                text: `Berhasil generate ${res.generated?.length || 0} dokumen training dari knowledge otomatis.`
            });
            await fetchLearningData();
        } catch (e) {
            setLearningMsg({ type: 'error', text: `Gagal generate: ${e.message}` });
        } finally {
            setLearningGenerating(false);
        }
    };

    const handleRunFullCycle = async () => {
        setLearningAnalyzing(true);
        setLearningGenerating(true);
        setLearningMsg(null);
        try {
            const res = await apiClient.fetchJson(`${API_URL}/ai/learning/run-cycle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            setLearningMsg({
                type: 'success',
                text: `Cycle selesai: ${res.analyzed?.processed || 0} dianalisis, ${res.generated?.generated?.length || 0} dokumen di-generate.`
            });
            await fetchLearningData();
        } catch (e) {
            setLearningMsg({ type: 'error', text: `Gagal: ${e.message}` });
        } finally {
            setLearningAnalyzing(false);
            setLearningGenerating(false);
        }
    };

    const [trainingSingle, setTrainingSingle] = useState(null);
    const handleTrainSingle = async (logId, topic) => {
        setTrainingSingle(logId);
        setLearningMsg(null);
        try {
            const res = await apiClient.fetchJson(`${API_URL}/ai/learning/train/${logId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            setLearningMsg({
                type: 'success',
                text: `Berhasil train "${topic}" → doc ID ${res.docId}`
            });
            await fetchLearningData();
        } catch (e) {
            setLearningMsg({ type: 'error', text: `Gagal train "${topic}": ${e.message}` });
        } finally {
            setTrainingSingle(null);
        }
    };

    const handleTrainAll = async () => {
        setLearningGenerating(true);
        setLearningMsg(null);
        try {
            const res = await apiClient.fetchJson(`${API_URL}/ai/learning/train-all`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            setLearningMsg({
                type: 'success',
                text: `Batch train selesai: ${res.trained}/${res.total} topik berhasil di-train.`
            });
            await fetchLearningData();
        } catch (e) {
            setLearningMsg({ type: 'error', text: `Gagal batch train: ${e.message}` });
        } finally {
            setLearningGenerating(false);
        }
    };

    const handleTrainByTopic = async (topicName) => {
        setTrainingSingle(topicName);
        setLearningMsg(null);
        try {
            const res = await apiClient.fetchJson(`${API_URL}/ai/learning/train-by-topic`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic: topicName }),
            });
            setLearningMsg({
                type: 'success',
                text: `Berhasil train "${topicName}" → doc ID ${res.docId}`
            });
            await fetchLearningData();
        } catch (e) {
            setLearningMsg({ type: 'error', text: `Gagal train "${topicName}": ${e.message}` });
        } finally {
            setTrainingSingle(null);
        }
    };

    const handleApplyCorrection = async (correctionId) => {
        setLearningMsg(null);
        try {
            const res = await apiClient.fetchJson(`${API_URL}/ai/corrections/${correctionId}/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            setLearningMsg({
                type: 'success',
                text: `Koreksi diterapkan → doc ID ${res.docId}`
            });
            await fetchLearningData();
        } catch (e) {
            setLearningMsg({ type: 'error', text: `Gagal apply koreksi: ${e.message}` });
        }
    };

    const handleEvolutionScan = async () => {
        setEvolutionScanning(true);
        setLearningMsg(null);
        try {
            const res = await apiClient.fetchJson(`${API_URL}/ai/evolution/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            setLearningMsg({
                type: 'success',
                text: `Evolution scan selesai: ${res.docsScanned} dokumen, ${res.correctionsApplied} koreksi diterapkan, ${res.knowledgePruned} knowledge dipangkas.`
            });
            await fetchLearningData();
        } catch (e) {
            setLearningMsg({ type: 'error', text: `Gagal evolution scan: ${e.message}` });
        } finally {
            setEvolutionScanning(false);
        }
    };

    const fetchTrainingDocs = async () => {
        setTrainingLoading(true);
        try {
            const data = await apiClient.fetchJson(`${API_URL}/ai/training`);
            setTrainingDocs(data);
            setDocPage(1);
        } catch (e) {
            console.error('Failed to fetch training docs:', e);
        } finally {
            setTrainingLoading(false);
        }
    };

    const handleTrainingUpload = async (e) => {
        e.preventDefault();
        if (!trainingFile && !trainingForm.url) return;
        setTrainingUploading(true);
        setTrainingMsg(null);
        try {
            if (trainingFile) {
                const formData = new FormData();
                formData.append('file', trainingFile);
                formData.append('title', trainingForm.title);
                formData.append('category', trainingForm.category);
                formData.append('tags', trainingForm.tags);
                await apiClient.fetchJson(`${API_URL}/ai/training/upload`, { method: 'POST', body: formData });
                setTrainingMsg({ type: 'success', text: text.uploadSuccess });
            } else {
                await apiClient.fetchJson(`${API_URL}/ai/training/link`, {
                    method: 'POST',
                    body: JSON.stringify({ url: trainingForm.url, title: trainingForm.title, category: trainingForm.category, tags: trainingForm.tags }),
                });
                setTrainingMsg({ type: 'success', text: text.linkSuccess });
            }
            setTrainingForm({ title: '', category: 'general', tags: '', url: '' });
            setTrainingFile(null);
            fetchTrainingDocs();
        } catch (e) {
            setTrainingMsg({ type: 'error', text: e.message });
        } finally {
            setTrainingUploading(false);
        }
    };

    const handleTrainingDelete = async (id) => {
        if (!window.confirm(text.deleteConfirm)) return;
        try {
            await apiClient.fetchJson(`${API_URL}/ai/training/${id}`, { method: 'DELETE' });
            setTrainingMsg({ type: 'success', text: text.deleteSuccess });
            fetchTrainingDocs();
        } catch (e) {
            setTrainingMsg({ type: 'error', text: e.message });
        }
    };

    const handleTrainingReprocess = async (id) => {
        try {
            await apiClient.fetchJson(`${API_URL}/ai/training/${id}/reprocess`, { method: 'POST' });
            fetchTrainingDocs();
        } catch (e) {
            setTrainingMsg({ type: 'error', text: e.message });
        }
    };

    const openTrainingPreview = async (id) => {
        try {
            const data = await apiClient.fetchJson(`${API_URL}/ai/training/${id}`);
            setTrainingPreview(data);
        } catch (e) {
            setTrainingMsg({ type: 'error', text: e.message });
        }
    };

    const handleTrainingRefresh = () => {
        fetchTrainingDocs();
    };

    const openTrainingDetail = async (doc) => {
        try {
            const data = await apiClient.fetchJson(`${API_URL}/ai/training/${doc.id}`);
            setTrainingDetail(data);
        } catch (e) {
            setTrainingMsg({ type: 'error', text: e.message });
        }
    };

    const fetchAiModels = async (baseUrl, apiKey) => {
        setModelsLoading(true);
        try {
            let url = `${API_URL}/settings/ai/models`;
            if (baseUrl && apiKey) {
                url += `?base_url=${encodeURIComponent(baseUrl)}&api_key=${encodeURIComponent(apiKey)}`;
            }
            const data = await apiClient.fetchJson(url);
            setAiModels(Array.isArray(data.models) ? data.models : []);
            if (data.current && !aiForm.model) {
                setAiForm(f => ({ ...f, model: data.current }));
            }
        } catch (e) {
            setAiModels([]);
        } finally {
            setModelsLoading(false);
        }
    };

    useEffect(() => {
        if (masterTab === 'ai') {
            setAiLoading(true);
            setAiMsg(null);
            apiClient.fetchJson(`${API_URL}/settings/ai`)
                .then(d => {
                    setAiSettings(d);
                    setAiForm({ base_url: d.base_url || '', api_key: '', model: d.model || 'gpt-4o-mini', enabled: !!d.enabled });
                    if (d.base_url && d.hasApiKey) fetchAiModels();
                })
                .catch(e => setAiMsg({ type: 'error', text: 'Gagal memuat pengaturan: ' + e.message }))
                .finally(() => setAiLoading(false));
        }
    }, [masterTab]);

    useEffect(() => {
        if (masterTab === 'ai' && aiForm.base_url && aiForm.api_key) {
            fetchAiModels(aiForm.base_url, aiForm.api_key);
        }
    }, [aiForm.base_url, aiForm.api_key]);

    const saveAiSettings = async () => {
        setAiLoading(true);
        setAiMsg(null);
        try {
            const body = { base_url: aiForm.base_url, api_key: aiForm.api_key, model: aiForm.model, enabled: aiForm.enabled };
            const d = await apiClient.fetchJson(`${API_URL}/settings/ai`, { method: 'PUT', body: JSON.stringify(body) });
            setAiSettings(d);
            setAiForm(f => ({ ...f, base_url: d.base_url || '', model: d.model || 'gpt-4o-mini', enabled: !!d.enabled, api_key: '' }));
            setAiMsg({ type: 'success', text: isEnglish ? 'AI Agent settings saved.' : 'Pengaturan AI Agent tersimpan.' });
        } catch (e) {
            setAiMsg({ type: 'error', text: (isEnglish ? 'Save failed: ' : 'Gagal menyimpan: ') + e.message });
        } finally {
            setAiLoading(false);
        }
    };

    const testAiConnection = async () => {
        setAiTesting(true);
        setAiMsg(null);
        try {
            const body = { base_url: aiForm.base_url, api_key: aiForm.api_key, model: aiForm.model };
            const d = await apiClient.fetchJson(`${API_URL}/settings/ai/test`, { method: 'POST', body: JSON.stringify(body) });
            const parts = [];
            if (d.modelsOk !== undefined) parts.push(isEnglish ? `Models: ${d.modelsCount} found` : `Models: ${d.modelsCount} model`);
            if (d.chatOk) parts.push(isEnglish ? 'Chat: OK' : 'Chat: OK');
            if (d.sample) parts.push(`Sample: ${d.sample}`);
            if (d.modelsError) parts.push(`Models error: ${d.modelsError}`);
            if (d.chatError) parts.push(`Chat error: ${d.chatError}`);
            setAiMsg({ type: d.success ? 'success' : 'error', text: parts.join(' | ') || (d.error || 'Test failed') });
            if (d.success) fetchAiModels();
        } catch (e) {
            setAiMsg({ type: 'error', text: (isEnglish ? 'Test failed: ' : 'Test gagal: ') + e.message });
        } finally {
            setAiTesting(false);
        }
    };

    useEffect(() => {
        if (logSource !== 'database' && masterTab === 'logs') {
            const type = logSource.split('_')[0]; // error, ocr, server
            setIsFileLoading(true);
            fetch(`/api/system/logs-file/${type}`, { credentials: 'include' })
                .then(res => res.json())
                .then(data => {
                    setFileLogs(prev => ({ ...prev, [type]: data.content }));
                    setIsFileLoading(false);
                })
                .catch(err => {
                    console.error("Failed to fetch file logs", err);
                    setIsFileLoading(false);
                });
        }
    }, [logSource, masterTab]);

    useEffect(() => {
        setLogCurrentPage(1);
    }, [logSearchQuery]);

    useEffect(() => {
        if (masterTab === 'training') fetchTrainingDocs();
    }, [masterTab]);

    const toggleDept = (deptName) => {
        setExpandedDepts(prev => ({
            ...prev,
            [deptName]: !prev[deptName]
        }));
    };

    const groupedUsers = useMemo(() => {
        const filtered = users.filter(u =>
            u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
            (u.department || '').toLowerCase().includes(userSearchQuery.toLowerCase())
        );
        return filtered.reduce((acc, user) => {
            const dept = user.department || text.noDepartment;
            if (!acc[dept]) acc[dept] = [];
            acc[dept].push(user);
            return acc;
        }, {});
    }, [users, userSearchQuery, text.noDepartment]);

    const filteredLogs = useMemo(() => {
        return logs.filter(l =>
            l.action.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
            (l.user || '').toLowerCase().includes(logSearchQuery.toLowerCase()) ||
            (l.details || '').toLowerCase().includes(logSearchQuery.toLowerCase())
        );
    }, [logs, logSearchQuery]);

    const totalLogPages = Math.ceil(filteredLogs.length / logsPerPage);
    const paginatedLogs = useMemo(() => {
        const startIndex = (logCurrentPage - 1) * logsPerPage;
        return filteredLogs.slice(startIndex, startIndex + logsPerPage);
    }, [filteredLogs, logCurrentPage]);

    // ── Reusable Table Pagination ──
    const TablePagination = ({ total, page, setPage, perPage = ROWS_PER_PAGE }) => {
        const totalPages = Math.ceil(total / perPage);
        if (totalPages <= 1) return null;
        const start = (page - 1) * perPage + 1;
        const end = Math.min(page * perPage, total);
        return (
            <div className="flex items-center justify-between px-4 py-2 border-t dark:border-slate-700/50 bg-gray-50 dark:bg-slate-800/30">
                <p className="text-xs text-gray-500">
                    Menampilkan <span className="font-bold">{start}</span>–<span className="font-bold">{end}</span> dari <span className="font-bold">{total}</span>
                </p>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setPage(p => Math.max(p - 1, 1))}
                        disabled={page === 1}
                        className="p-1 rounded text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                        .reduce((acc, p, idx, arr) => {
                            if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                            acc.push(p);
                            return acc;
                        }, [])
                        .map((p, i) =>
                            p === '...' ? (
                                <span key={`e${i}`} className="px-1 text-xs text-gray-400">…</span>
                            ) : (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`px-2 py-0.5 rounded text-xs font-bold ${page === p ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-700'}`}
                                >
                                    {p}
                                </button>
                            )
                        )}
                    <button
                        onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                        disabled={page === totalPages}
                        className="p-1 rounded text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex bg-gray-100 dark:bg-slate-800 border dark:border-slate-700/50 p-1 rounded-xl w-fit mb-4 shadow-inner">
                {['users', 'roles', 'departments', 'flows', 'logs', 'ai', 'training'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setMasterTab(tab)}
                        className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${masterTab === tab ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-md' : 'text-gray-500 dark:text-slate-500 hover:bg-gray-200 dark:hover:bg-slate-700 dark:hover:text-slate-300'}`}
                    >
                        {text.tabs[tab] || tab}
                    </button>
                ))}
            </div>

            {masterTab === 'users' && (
                <Card>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg dark:text-white">{text.usersManagement}</h3>
                        <div className="flex gap-2">
                            <input
                                type="text" placeholder={text.searchUser} className="px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white text-sm"
                                value={userSearchQuery} onChange={(e) => setUserSearchQuery(e.target.value)}
                            />
                            {hasPermission('master', 'create') && (
                                <>
                                    <button
                                        onClick={handleDownloadTemplate}
                                        className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm flex items-center gap-1.5 hover:bg-emerald-700 transition-colors"
                                        title="Download template Excel untuk import users"
                                    >
                                        <Download size={15} /> Template
                                    </button>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={importLoading}
                                        className="px-3 py-2 bg-amber-600 text-white rounded-lg text-sm flex items-center gap-1.5 hover:bg-amber-700 transition-colors disabled:opacity-50"
                                        title="Import users dari file Excel"
                                    >
                                        {importLoading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Import
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".xlsx,.xls,.csv"
                                        className="hidden"
                                        onChange={handleImportUsers}
                                    />
                                    <button
                                        onClick={handleCreateUser}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                                    >
                                        <Plus size={16} /> {text.newUser}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Import message */}
                    {importMsg && (
                        <div className={`mb-4 text-xs px-4 py-2.5 rounded-lg ${importMsg.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : importMsg.type === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'}`}>
                            {importMsg.text}
                            {importResult?.errors?.length > 0 && (
                                <div className="mt-2 space-y-0.5">
                                    {importResult.errors.map((e, i) => (
                                        <div key={i} className="text-[11px] opacity-80">Row {e.row}: {e.error}</div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    <div className="space-y-4">
                        {Object.keys(groupedUsers).length === 0 ? (
                            <div className="text-center py-10 text-slate-400 italic">{text.userNotFound}</div>
                        ) : (
                            Object.entries(groupedUsers).map(([deptName, deptUsers]) => (
                                <div key={deptName} className="space-y-2">
                                    <button
                                        onClick={() => toggleDept(deptName)}
                                        className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl hover:shadow-md transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600">
                                                <Building2 size={18} />
                                            </div>
                                            <div className="text-left">
                                                <h4 className="font-black text-slate-800 dark:text-white text-sm uppercase tracking-wider">{deptName}</h4>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{deptUsers.length} {text.registeredMembers}</p>
                                            </div>
                                        </div>
                                        <div className={`p-2 rounded-xl transition-all ${expandedDepts[deptName] ? 'bg-indigo-600 text-white rotate-90' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 group-hover:text-indigo-600'}`}>
                                            <ChevronRight size={18} />
                                        </div>
                                    </button>

                                    {expandedDepts[deptName] && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-4 animate-in slide-in-from-top-2 duration-300">
                                            {deptUsers.map(u => (
                                                <div key={u.id} className="flex items-center justify-between p-4 bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm rounded-2xl border border-white/60 dark:border-white/5 hover:border-indigo-300 transition-all group/user">
                                                    <div className="flex items-center gap-4">
                                                        <div className="relative">
                                                            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-black text-lg shadow-lg">
                                                                {u.name.charAt(0)}
                                                            </div>
                                                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white dark:bg-slate-900 rounded-lg flex items-center justify-center border border-slate-100 dark:border-slate-800 shadow-sm">
                                                                <Shield size={10} className="text-indigo-500" />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="font-black text-slate-800 dark:text-white text-sm tracking-tight">{u.name}</div>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md">{u.role}</span>
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase">@{u.username}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1 opacity-0 group-hover/user:opacity-100 transition-all">
                                                        {hasPermission('master', 'edit') && (
                                                            <button onClick={() => handleEditUser(u)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors"><Edit3 size={16} /></button>
                                                        )}
                                                        {hasPermission('master', 'delete') && (
                                                            <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"><Trash2 size={16} /></button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </Card>
            )}

            {masterTab === 'roles' && (
                <Card>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg dark:text-white">{text.roleAccessManagement}</h3>
                        {hasPermission('master', 'create') && (
                            <button
                                onClick={handleCreateRole}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                            >
                                <Plus size={16} /> {text.newRole}
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {roles.map(r => {
                            let perms = r.permissions || r.access || {};
                            if (typeof perms === 'string') {
                                try { perms = JSON.parse(perms); } catch { perms = {}; }
                            }
                            return (
                                <div key={r.id} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="font-bold text-lg dark:text-white">{r.label || r.name}</div>
                                            <div className="text-xs text-gray-500 mt-1 uppercase tracking-wider">{text.moduleAccess}</div>
                                        </div>
                                        <div className="flex gap-1">
                                            {hasPermission('master', 'edit') && (
                                                <button onClick={() => handleEditRole(r)} className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg"><Edit3 size={16} /></button>
                                            )}
                                            {hasPermission('master', 'delete') && (
                                                <button onClick={() => handleDeleteRole(r.id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={16} /></button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(perms).map(([mod, actions]) => (
                                            <div key={mod} className="px-2 py-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded text-[10px] flex flex-col">
                                                <span className="font-bold text-indigo-500 uppercase">
                                                    {APP_MODULES[mod]?.label || mod}
                                                </span>
                                                <span className="text-gray-400">{Array.isArray(actions) ? actions.join(', ') : ''}</span>
                                            </div>
                                        ))}
                                        {Object.keys(perms).length === 0 && (
                                            <span className="text-[10px] text-slate-400 italic">{text.noPermissionSet}</span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </Card>
            )}

            {masterTab === 'flows' && (
                <Card>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg dark:text-white">{text.approvalFlowMaster}</h3>
                        {hasPermission('master', 'create') && (
                            <button onClick={() => handleCreateFlow()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-indigo-700 transition-colors">
                                <Plus size={16} /> {text.newFlow}
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {flows.map(f => (
                            <div key={f.id} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-indigo-300 transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="font-bold text-lg dark:text-white">{f.name}</div>
                                        <div className="text-xs text-gray-500 mt-1">{f.description}</div>
                                    </div>
                                    <div className="flex gap-1">
                                        {hasPermission('master', 'edit') && (
                                            <button onClick={() => handleEditFlow(f)} className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg" title={text.editFlow}><Edit3 size={16} /></button>
                                        )}
                                        {hasPermission('master', 'delete') && (
                                            <button onClick={() => handleDeleteFlow(f.id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title={text.deleteFlow}><Trash2 size={16} /></button>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {(f.steps || []).map((s, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-xs">
                                            <div className="w-5 h-5 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">{idx + 1}</div>
                                            <span className="dark:text-slate-300 font-medium flex items-center gap-1"><ShieldCheck size={12} /> {s.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {masterTab === 'logs' && (
                <Card>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div>
                            <h3 className="font-bold text-lg dark:text-white flex items-center gap-2 lowercase">
                                <History size={20} className="text-indigo-500" />
                                {logSource === 'database' ? text.auditTrailSystem : `${text.systemLogFile}: ${logSource.split('_')[0].toUpperCase()} File`}
                            </h3>
                            <div className="flex bg-gray-100 dark:bg-slate-900 p-1 rounded-xl mt-3 w-fit border border-slate-200 dark:border-slate-700">
                                <button
                                    onClick={() => setLogSource('database')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${logSource === 'database' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <History size={12} /> Database
                                </button>
                                <button
                                    onClick={() => setLogSource('server_file')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${logSource === 'server_file' ? 'bg-white dark:bg-slate-800 text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <Activity size={12} /> {text.serverLogs}
                                </button>
                                <button
                                    onClick={() => setLogSource('error_file')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${logSource === 'error_file' ? 'bg-white dark:bg-slate-800 text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <AlertCircle size={12} /> {text.errors}
                                </button>
                                <button
                                    onClick={() => setLogSource('ocr_file')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${logSource === 'ocr_file' ? 'bg-white dark:bg-slate-800 text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <FileText size={12} /> {text.ocrFailures}
                                </button>
                            </div>
                        </div>
                        {logSource === 'database' && (
                            <div className="relative w-full md:w-72">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder={text.searchLogs}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                    value={logSearchQuery}
                                    onChange={(e) => setLogSearchQuery(e.target.value)}
                                />
                            </div>
                        )}
                    </div>
                    {logSource === 'database' ? (
                        <>
                            <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest text-[10px]">
                                        <tr>
                                            <th className="px-6 py-4">{text.time}</th>
                                            <th className="px-6 py-4">{text.user}</th>
                                            <th className="px-6 py-4">{text.action}</th>
                                            <th className="px-6 py-4">{text.detail}</th>
                                            <th className="px-6 py-4 text-right">{text.data}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                        {paginatedLogs.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="px-6 py-10 text-center text-slate-400 italic">{text.noActivity}</td>
                                            </tr>
                                        ) : (
                                            paginatedLogs.map((log) => (
                                                <React.Fragment key={log.id}>
                                                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                                        <td className="px-6 py-4 whitespace-nowrap text-slate-500 dark:text-slate-400 font-medium">
                                                            <div className="flex items-center gap-2">
                                                                <Clock size={12} />
                                                                {new Date(log.timestamp).toLocaleString(dateLocale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">{log.user || text.system}</td>
                                                        <td className="px-6 py-4">
                                                            <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-black uppercase tracking-wider border border-indigo-100 dark:border-indigo-800">
                                                                {log.action}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400 max-w-xs truncate" title={log.details}>{log.details}</td>
                                                        <td className="px-6 py-4 text-right">
                                                            {(log.oldValue || log.newValue) && (
                                                                <button
                                                                    onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                                                                    className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl text-indigo-500 transition-all"
                                                                >
                                                                    {expandedLogId === log.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                    {expandedLogId === log.id && (
                                                        <tr>
                                                            <td colSpan="5" className="px-6 pb-4 pt-0">
                                                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                                                                    {log.oldValue && <div className="space-y-1"><p className="text-[9px] font-black text-red-500 uppercase ml-1">{text.beforeOld}</p><pre className="text-[10px] font-mono p-3 bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-xl text-red-700 dark:text-red-400 overflow-x-auto">{log.oldValue.startsWith('{') ? JSON.stringify(JSON.parse(log.oldValue), null, 2) : log.oldValue}</pre></div>}
                                                                    {log.newValue && <div className="space-y-1"><p className="text-[9px] font-black text-emerald-500 uppercase ml-1">{text.afterNew}</p><pre className="text-[10px] font-mono p-3 bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 rounded-xl text-emerald-700 dark:text-emerald-400 overflow-x-auto">{log.newValue.startsWith('{') ? JSON.stringify(JSON.parse(log.newValue), null, 2) : log.newValue}</pre></div>}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            {totalLogPages > 1 && (
                                <div className="px-6 py-4 flex items-center justify-between border-t border-slate-50 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 rounded-b-2xl">
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {text.showing} <span className="font-bold text-indigo-600">{(logCurrentPage - 1) * logsPerPage + 1}</span> {text.to} <span className="font-bold text-indigo-600">{Math.min(logCurrentPage * logsPerPage, filteredLogs.length)}</span> {text.of} <span className="font-bold text-indigo-600">{filteredLogs.length}</span> {text.logsWord}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setLogCurrentPage(prev => Math.max(prev - 1, 1))}
                                            disabled={logCurrentPage === 1}
                                            className="p-2 rounded-lg text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-30 transition-colors"
                                        >
                                            <ChevronLeft size={18} />
                                        </button>

                                        <div className="flex items-center gap-1">
                                            {[...Array(totalLogPages)].map((_, i) => {
                                                const page = i + 1;
                                                if (totalLogPages > 5 && page !== 1 && page !== totalLogPages && (page < logCurrentPage - 1 || page > logCurrentPage + 1)) {
                                                    if (page === logCurrentPage - 2 || page === logCurrentPage + 2) return <span key={page} className="text-slate-400 px-1">...</span>;
                                                    return null;
                                                }
                                                return (
                                                    <button
                                                        key={page}
                                                        onClick={() => setLogCurrentPage(page)}
                                                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${logCurrentPage === page ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'text-slate-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'}`}
                                                    >
                                                        {page}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <button
                                            onClick={() => setLogCurrentPage(prev => Math.min(prev + 1, totalLogPages))}
                                            disabled={logCurrentPage === totalLogPages}
                                            className="p-2 rounded-lg text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-30 transition-colors"
                                        >
                                            <ChevronRight size={18} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 relative min-h-[400px]">
                            {isFileLoading ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm rounded-2xl">
                                    <div className="flex flex-col items-center gap-3">
                                        <Activity className="w-8 h-8 text-indigo-500 animate-spin" />
                                        <div className="text-sm font-bold text-slate-300">{text.loadingLogFile}</div>
                                    </div>
                                </div>
                            ) : (
                                <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap overflow-x-auto overflow-y-auto max-h-[600px] custom-scrollbar p-2">
                                    {logSource === 'server_file' && fileLogs.server}
                                    {logSource === 'error_file' && fileLogs.error}
                                    {logSource === 'ocr_file' && fileLogs.ocr}
                                    {(!fileLogs.server && logSource === 'server_file') && text.noServerLog}
                                    {(!fileLogs.error && logSource === 'error_file') && text.noSystemError}
                                    {(!fileLogs.ocr && logSource === 'ocr_file') && text.noOcrFailure}
                                </pre>
                            )}
                        </div>
                    )}
                </Card>
            )
            }

            {
                masterTab === 'departments' && (
                    <Card>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg dark:text-white">{text.departmentList}</h3>
                            {hasPermission('master', 'create') && (
                                <button onClick={handleCreateDept} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-indigo-700 transition-colors"><Plus size={16} /> {text.newDepartment}</button>
                            )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {departments.map(d => (
                                <div key={d.id} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 flex flex-col items-center justify-center text-center group relative">
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {hasPermission('master', 'edit') && (
                                            <button onClick={() => handleEditDept(d)} className="p-1 text-gray-400 hover:text-blue-500"><Edit3 size={14} /></button>
                                        )}
                                    </div>
                                    <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 mb-2">
                                        <Building2 size={20} />
                                    </div>
                                    <div className="font-bold dark:text-white text-sm">{d.name}</div>
                                    <div className="text-[10px] text-gray-400 mt-1 uppercase">ID: {d.id}</div>
                                    {hasPermission('master', 'delete') && (
                                        <button onClick={() => handleDeleteDept(d.id)} className="mt-2 text-red-500 hover:text-red-700 text-xs"><Trash2 size={14} /></button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Card>
                )
            }

            {
                masterTab === 'ai' && (
                    <Card>
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                                    <Bot size={20} className="text-indigo-500" /> {text.aiSettingsTitle}
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">{text.aiSettingsDesc}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${aiSettings.enabled ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 border-emerald-200 dark:border-emerald-800' : 'bg-gray-100 dark:bg-slate-800 text-gray-400 border-gray-200 dark:border-slate-700'}`}>
                                {text.aiStatus}: {aiSettings.enabled ? (isEnglish ? 'ON' : 'AKTIF') : (isEnglish ? 'OFF' : 'NONAKTIF')}
                            </span>
                        </div>

                        <div className="space-y-4 max-w-2xl">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{text.baseUrl}</label>
                                <input
                                    type="text" placeholder={text.baseUrlPh}
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white text-sm"
                                    value={aiForm.base_url} onChange={(e) => setAiForm({ ...aiForm, base_url: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{text.apiKey}</label>
                                <input
                                    type="password" placeholder={aiSettings.hasApiKey ? `${text.apiKeyPh} (${aiSettings.apiKeyMasked})` : text.apiKeyPh}
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white text-sm"
                                    value={aiForm.api_key}
                                    onChange={(e) => {
                                        // Sanitize: remove non-ASCII characters (smart quotes, ellipsis, etc.)
                                        const sanitized = e.target.value.replace(/[^\x00-\x7F]/g, '');
                                        setAiForm({ ...aiForm, api_key: sanitized });
                                    }}
                                    onPaste={(e) => {
                                        // Sanitize pasted content
                                        const pasted = e.clipboardData.getData('text');
                                        const sanitized = pasted.replace(/[^\x00-\x7F]/g, '');
                                        if (sanitized !== pasted) {
                                            e.preventDefault();
                                            setAiForm({ ...aiForm, api_key: sanitized });
                                        }
                                    }}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{text.model}</label>
                                <select
                                    value={aiForm.model}
                                    onChange={(e) => setAiForm({ ...aiForm, model: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white text-sm"
                                >
                                    {modelsLoading && <option value="">Memuat model...</option>}
                                    {!modelsLoading && aiModels.length === 0 && <option value="">Tidak ada model</option>}
                                    {aiModels.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                                {!modelsLoading && aiModels.length > 0 && (
                                    <p className="text-[10px] text-gray-400 mt-1">{aiModels.length} model tersedia</p>
                                )}
                            </div>
                            <label className="flex items-center gap-3 cursor-pointer select-none">
                                <input
                                    type="checkbox" checked={aiForm.enabled}
                                    onChange={(e) => setAiForm({ ...aiForm, enabled: e.target.checked })}
                                    className="w-4 h-4 rounded text-indigo-600"
                                />
                                <span className="text-sm font-medium dark:text-slate-200">{text.enabled}</span>
                            </label>

                            {aiMsg && (
                                <div className={`text-xs px-3 py-2 rounded-lg ${aiMsg.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
                                    {aiMsg.text}
                                </div>
                            )}

                            <div className="flex gap-2">
                                {hasPermission('master', 'edit') && (
                                    <button
                                        onClick={saveAiSettings} disabled={aiLoading}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                    >
                                        {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {text.save}
                                    </button>
                                )}
                                {hasPermission('master', 'edit') && (
                                    <button
                                        onClick={testAiConnection} disabled={aiTesting}
                                        className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-sm flex items-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                                    >
                                        {aiTesting ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />} {text.testConn}
                                    </button>
                                )}
                            </div>
                        </div>
                    </Card>
                )
            }

            {
                masterTab === 'training' && (
                    <Card>
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                                    <FileText size={20} className="text-indigo-500" /> {text.trainingTitle}
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">{text.trainingDesc}</p>
                            </div>
                            <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-lg">
                                <button
                                    onClick={() => setTrainingTab('upload')}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${trainingTab === 'upload' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-slate-400'}`}
                                >
                                    {text.uploadFile}
                                </button>
                                <button
                                    onClick={() => setTrainingTab('list')}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${trainingTab === 'list' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-slate-400'}`}
                                >
                                    {text.addLink}
                                </button>
                                <button
                                    onClick={() => { setTrainingTab('learning'); setTopicPage(1); setLogPage(1); fetchLearningData(); }}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${trainingTab === 'learning' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-slate-400'}`}
                                >
                                    Self-Improvement
                                </button>
                                <button
                                    onClick={() => { setTrainingTab('corrections'); setCorrectionPage(1); fetchLearningData(); }}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${trainingTab === 'corrections' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-slate-400'}`}
                                >
                                    Corrections {correctionStats?.unapplied > 0 && <span className="ml-1 px-1 bg-red-500 text-white rounded-full text-[9px]">{correctionStats.unapplied}</span>}
                                </button>
                                <button
                                    onClick={() => { setTrainingTab('evolution'); setEvolutionPage(1); fetchLearningData(); }}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${trainingTab === 'evolution' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-slate-400'}`}
                                >
                                    Evolution
                                </button>
                                <button
                                    onClick={() => { setTrainingTab('graph'); fetchGraph(); }}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${trainingTab === 'graph' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-slate-400'}`}
                                >
                                    🧠 Graph
                                </button>
                                <button
                                    onClick={() => { setTrainingTab('brain'); fetchBrainData(); }}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${trainingTab === 'brain' ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-300 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-slate-400'}`}
                                >
                                    1MBrain
                                </button>
                            </div>
                        </div>

                        {trainingMsg && (
                            <div className={`mb-4 text-xs px-3 py-2 rounded-lg ${trainingMsg.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
                                {trainingMsg.text}
                            </div>
                        )}

                        {/* Upload Form */}
                        {trainingTab === 'upload' && (
                            <form onSubmit={handleTrainingUpload} className="space-y-4 max-w-2xl mb-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{text.title}</label>
                                    <input
                                        type="text"
                                        placeholder={text.titlePh}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white text-sm"
                                        value={trainingForm.title}
                                        onChange={(e) => setTrainingForm({ ...trainingForm, title: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{text.category}</label>
                                        <select
                                            className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white text-sm"
                                            value={trainingForm.category}
                                            onChange={(e) => setTrainingForm({ ...trainingForm, category: e.target.value })}
                                        >
                                            {Object.entries(text.categories).map(([k, v]) => (
                                                <option key={k} value={k}>{v}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{text.tags}</label>
                                        <input
                                            type="text"
                                            placeholder={text.tagsPh}
                                            className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white text-sm"
                                            value={trainingForm.tags}
                                            onChange={(e) => setTrainingForm({ ...trainingForm, tags: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{text.chooseFile}</label>
                                    <input
                                        type="file"
                                        accept=".pdf,.docx,.txt"
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white text-sm"
                                        onChange={(e) => setTrainingFile(e.target.files[0])}
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">PDF, DOCX, TXT</p>
                                </div>
                                <button
                                    type="submit"
                                    disabled={trainingUploading || !trainingFile}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                >
                                    {trainingUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} {text.upload}
                                </button>
                            </form>
                        )}

                        {/* Link Form */}
                        {trainingTab === 'list' && (
                            <form onSubmit={handleTrainingUpload} className="space-y-4 max-w-2xl mb-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{text.title}</label>
                                    <input
                                        type="text"
                                        placeholder={text.titlePh}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white text-sm"
                                        value={trainingForm.title}
                                        onChange={(e) => setTrainingForm({ ...trainingForm, title: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{text.orPasteUrl}</label>
                                    <input
                                        type="url"
                                        placeholder={text.urlPh}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white text-sm"
                                        value={trainingForm.url}
                                        onChange={(e) => setTrainingForm({ ...trainingForm, url: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{text.category}</label>
                                        <select
                                            className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white text-sm"
                                            value={trainingForm.category}
                                            onChange={(e) => setTrainingForm({ ...trainingForm, category: e.target.value })}
                                        >
                                            {Object.entries(text.categories).map(([k, v]) => (
                                                <option key={k} value={k}>{v}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{text.tags}</label>
                                        <input
                                            type="text"
                                            placeholder={text.tagsPh}
                                            className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white text-sm"
                                            value={trainingForm.tags}
                                            onChange={(e) => setTrainingForm({ ...trainingForm, tags: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={trainingUploading || !trainingForm.url}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                >
                                    {trainingUploading ? <Loader2 size={16} className="animate-spin" /> : <Link size={16} />} {text.add}
                                </button>
                            </form>
                        )}

                        {/* Self-Improvement Tab */}
                        {trainingTab === 'learning' && (
                            <div className="space-y-6">
                                {learningMsg && (
                                    <div className={`text-xs px-3 py-2 rounded-lg ${learningMsg.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
                                        {learningMsg.text}
                                    </div>
                                )}

                                {/* Stats Cards */}
                                {learningStats && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-black text-indigo-600 dark:text-indigo-300">{learningStats.totalKnowledgePoints}</div>
                                            <div className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">Knowledge Points</div>
                                        </div>
                                        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-300">{learningStats.trainingEfficiency}</div>
                                            <div className="text-xs text-emerald-500 dark:text-emerald-400 mt-1">Training Efficiency</div>
                                        </div>
                                        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-black text-amber-600 dark:text-amber-300">{learningStats.untrainedPoints}</div>
                                            <div className="text-xs text-amber-500 dark:text-amber-400 mt-1">Untrained Points</div>
                                        </div>
                                        <div className="bg-violet-50 dark:bg-violet-900/20 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-black text-violet-600 dark:text-violet-300">{learningStats.docsGenerated}</div>
                                            <div className="text-xs text-violet-500 dark:text-violet-400 mt-1">Docs Generated</div>
                                        </div>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-3 flex-wrap">
                                    <button
                                        onClick={() => fetchLearningData()}
                                        disabled={learningLoading}
                                        className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-gray-700 transition-colors disabled:opacity-50"
                                    >
                                        {learningLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                        Refresh
                                    </button>
                                    <button
                                        onClick={handleAnalyze}
                                        disabled={learningAnalyzing}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-50"
                                    >
                                        {learningAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />}
                                        Analisis Chat
                                    </button>
                                    <button
                                        onClick={handleTrainAll}
                                        disabled={learningGenerating}
                                        className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-amber-700 transition-colors disabled:opacity-50"
                                    >
                                        {learningGenerating ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                                        Train All Pending
                                    </button>
                                    <button
                                        onClick={handleRunFullCycle}
                                        disabled={learningAnalyzing || learningGenerating}
                                        className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-violet-700 transition-colors disabled:opacity-50"
                                    >
                                        {learningAnalyzing || learningGenerating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                        Full Cycle
                                    </button>
                                </div>

                                {/* Topic Summary */}
                                {learningTopics.length > 0 && (
                                    <div>
                                        <h4 className="font-bold text-sm text-gray-700 dark:text-slate-300 mb-3">Topik Yang Sering Ditanyakan</h4>
                                        <div className="border dark:border-slate-700/50 rounded-lg overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="bg-gray-50 dark:bg-slate-800/50">
                                                        <th className="text-left px-4 py-2 font-bold text-gray-500 dark:text-slate-400 text-xs">Topik</th>
                                                        <th className="text-left px-4 py-2 font-bold text-gray-500 dark:text-slate-400 text-xs">Kategori</th>
                                                        <th className="text-center px-4 py-2 font-bold text-gray-500 dark:text-slate-400 text-xs">Jumlah Tanya</th>
                                                        <th className="text-center px-4 py-2 font-bold text-gray-500 dark:text-slate-400 text-xs">Confidence</th>
                                                        <th className="text-center px-4 py-2 font-bold text-gray-500 dark:text-slate-400 text-xs">Trained</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {learningTopics.slice((topicPage - 1) * ROWS_PER_PAGE, topicPage * ROWS_PER_PAGE).map((t, i) => (
                                                        <tr key={i} className="border-t dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                                                            <td className="px-4 py-2 font-medium dark:text-white">{t.topic}</td>
                                                            <td className="px-4 py-2">
                                                                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300">{t.category}</span>
                                                            </td>
                                                            <td className="px-4 py-2 text-center font-bold dark:text-white">{t.ask_count}</td>
                                                            <td className="px-4 py-2 text-center">
                                                                <span className={`text-xs font-bold ${parseFloat(t.avg_confidence) >= 0.7 ? 'text-emerald-600' : parseFloat(t.avg_confidence) >= 0.4 ? 'text-amber-600' : 'text-red-600'}`}>
                                                                    {(parseFloat(t.avg_confidence) * 100).toFixed(0)}%
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2 text-center">
                                                                {t.is_trained ? (
                                                                    <span className="text-emerald-500 font-bold text-xs">✓ Yes</span>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handleTrainByTopic(t.topic)}
                                                                        disabled={trainingSingle === t.topic}
                                                                        className="px-2 py-0.5 bg-amber-500 text-white rounded text-xs font-bold hover:bg-amber-600 transition-colors disabled:opacity-50"
                                                                    >
                                                                        {trainingSingle === t.topic ? <Loader2 size={10} className="animate-spin inline" /> : '⚡ Train'}
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            <TablePagination total={learningTopics.length} page={topicPage} setPage={setTopicPage} />
                                        </div>
                                    </div>
                                )}

                                {/* Recent Learning Logs */}
                                {learningLogs.length > 0 && (
                                    <div>
                                        <h4 className="font-bold text-sm text-gray-700 dark:text-slate-300 mb-3">Recent Knowledge Extracted</h4>
                                        <div className="space-y-2">
                                            {learningLogs.slice((logPage - 1) * ROWS_PER_PAGE, logPage * ROWS_PER_PAGE).map((log, i) => (
                                                <div key={i} className="border dark:border-slate-700/50 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300">{log.category}</span>
                                                        <span className="font-bold text-sm dark:text-white">{log.topic}</span>
                                                        <span className="text-xs text-gray-400 ml-auto">×{log.repeat_count}</span>
                                                        {log.used_in_training && <span className="text-xs text-emerald-500 font-bold">✓ Trained</span>}
                                                    </div>
                                                    <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2">{log.knowledge_extracted}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="border dark:border-slate-700/50 rounded-lg overflow-hidden mt-2">
                                            <TablePagination total={learningLogs.length} page={logPage} setPage={setLogPage} />
                                        </div>
                                    </div>
                                )}

                                {learningLoading && (
                                    <div className="text-center py-8 text-gray-400">
                                        <Loader2 size={24} className="animate-spin inline-block" />
                                        <p className="mt-2 text-sm">Memuat data learning...</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Corrections Tab */}
                        {trainingTab === 'corrections' && (
                            <div className="space-y-6">
                                {learningMsg && (
                                    <div className={`text-xs px-3 py-2 rounded-lg ${learningMsg.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
                                        {learningMsg.text}
                                    </div>
                                )}

                                {correctionStats && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-black text-red-600 dark:text-red-300">{correctionStats.total}</div>
                                            <div className="text-xs text-red-500 dark:text-red-400 mt-1">Total Corrections</div>
                                        </div>
                                        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-300">{correctionStats.applied}</div>
                                            <div className="text-xs text-emerald-500 dark:text-emerald-400 mt-1">Applied</div>
                                        </div>
                                        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-black text-amber-600 dark:text-amber-300">{correctionStats.unapplied}</div>
                                            <div className="text-xs text-amber-500 dark:text-amber-400 mt-1">Pending Apply</div>
                                        </div>
                                        <div className="bg-violet-50 dark:bg-violet-900/20 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-black text-violet-600 dark:text-violet-300">{correctionStats.byType?.length || 0}</div>
                                            <div className="text-xs text-violet-500 dark:text-violet-400 mt-1">Types</div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-3 flex-wrap">
                                    <button
                                        onClick={() => fetchLearningData()}
                                        disabled={learningLoading}
                                        className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-gray-700 transition-colors disabled:opacity-50"
                                    >
                                        {learningLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                        Refresh
                                    </button>
                                </div>

                                {corrections.length > 0 ? (
                                    <div className="border dark:border-slate-700/50 rounded-lg overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-gray-50 dark:bg-slate-800/50">
                                                    <th className="text-left px-4 py-2 font-bold text-gray-500 dark:text-slate-400 text-xs">Topic</th>
                                                    <th className="text-left px-4 py-2 font-bold text-gray-500 dark:text-slate-400 text-xs">Type</th>
                                                    <th className="text-left px-4 py-2 font-bold text-gray-500 dark:text-slate-400 text-xs">Correct Answer</th>
                                                    <th className="text-center px-4 py-2 font-bold text-gray-500 dark:text-slate-400 text-xs">Severity</th>
                                                    <th className="text-center px-4 py-2 font-bold text-gray-500 dark:text-slate-400 text-xs">Status</th>
                                                    <th className="text-center px-4 py-2 font-bold text-gray-500 dark:text-slate-400 text-xs">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {corrections.slice((correctionPage - 1) * ROWS_PER_PAGE, correctionPage * ROWS_PER_PAGE).map((c, i) => (
                                                    <tr key={i} className="border-t dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                                                        <td className="px-4 py-2 font-medium dark:text-white text-xs">{c.topic}</td>
                                                        <td className="px-4 py-2">
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.correction_type === 'correction' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300'}`}>
                                                                {c.correction_type}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2 text-xs text-gray-600 dark:text-slate-400 max-w-[200px] truncate">{c.correct_answer}</td>
                                                        <td className="px-4 py-2 text-center">
                                                            <span className={`text-xs font-bold ${c.severity >= 0.7 ? 'text-red-600' : c.severity >= 0.4 ? 'text-amber-600' : 'text-gray-400'}`}>
                                                                {(c.severity * 100).toFixed(0)}%
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2 text-center">
                                                            {c.applied ? (
                                                                <span className="text-xs text-emerald-500 font-bold">✓ Applied</span>
                                                            ) : (
                                                                <span className="text-xs text-amber-500 font-bold">⏳ Pending</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2 text-center">
                                                            {!c.applied && (
                                                                <button
                                                                    onClick={() => handleApplyCorrection(c.id)}
                                                                    className="px-2 py-0.5 bg-emerald-500 text-white rounded text-[10px] font-bold hover:bg-emerald-600 transition-colors"
                                                                >
                                                                    Apply
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <TablePagination total={corrections.length} page={correctionPage} setPage={setCorrectionPage} />
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-400 dark:text-slate-500 text-sm">
                                        Belum ada koreksi. Ketik "datamu salah" atau "revisi" di chat untuk mengirim koreksi.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Evolution Tab */}
                        {trainingTab === 'evolution' && (
                            <div className="space-y-6">
                                {learningMsg && (
                                    <div className={`text-xs px-3 py-2 rounded-lg ${learningMsg.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
                                        {learningMsg.text}
                                    </div>
                                )}

                                {/* Evolution Stats */}
                                {evolutionStats && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-black text-blue-600 dark:text-blue-300">{evolutionStats.totalSnapshots}</div>
                                            <div className="text-xs text-blue-500 dark:text-blue-400 mt-1">Data Snapshots</div>
                                        </div>
                                        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-300">{evolutionStats.corrections?.applied || 0}</div>
                                            <div className="text-xs text-emerald-500 dark:text-emerald-400 mt-1">Corrections Applied</div>
                                        </div>
                                        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-black text-amber-600 dark:text-amber-300">{evolutionStats.corrections?.unapplied || 0}</div>
                                            <div className="text-xs text-amber-500 dark:text-amber-400 mt-1">Pending Corrections</div>
                                        </div>
                                        <div className="bg-violet-50 dark:bg-violet-900/20 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-black text-violet-600 dark:text-violet-300">{evolutionStats.latestEvolution?.docs_scanned || 0}</div>
                                            <div className="text-xs text-violet-500 dark:text-violet-400 mt-1">Docs Scanned</div>
                                        </div>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-3 flex-wrap">
                                    <button
                                        onClick={() => fetchLearningData()}
                                        disabled={learningLoading}
                                        className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-gray-700 transition-colors disabled:opacity-50"
                                    >
                                        {learningLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                        Refresh
                                    </button>
                                    <button
                                        onClick={handleEvolutionScan}
                                        disabled={evolutionScanning}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-50"
                                    >
                                        {evolutionScanning ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                        Run Evolution Scan
                                    </button>
                                </div>

                                {/* Evolution History */}
                                {evolutionHistory.length > 0 ? (
                                    <div>
                                        <h4 className="font-bold text-sm text-gray-700 dark:text-slate-300 mb-3">Riwayat Evolution Scan</h4>
                                        <div className="border dark:border-slate-700/50 rounded-lg overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="bg-gray-50 dark:bg-slate-800/50">
                                                        <th className="text-left px-4 py-2 font-bold text-gray-500 dark:text-slate-400 text-xs">Status</th>
                                                        <th className="text-center px-4 py-2 font-bold text-gray-500 dark:text-slate-400 text-xs">Docs Scanned</th>
                                                        <th className="text-center px-4 py-2 font-bold text-gray-500 dark:text-slate-400 text-xs">Docs Updated</th>
                                                        <th className="text-center px-4 py-2 font-bold text-gray-500 dark:text-slate-400 text-xs">Corrections</th>
                                                        <th className="text-center px-4 py-2 font-bold text-gray-500 dark:text-slate-400 text-xs">Pruned</th>
                                                        <th className="text-center px-4 py-2 font-bold text-gray-500 dark:text-slate-400 text-xs">New Topics</th>
                                                        <th className="text-right px-4 py-2 font-bold text-gray-500 dark:text-slate-400 text-xs">Date</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {evolutionHistory.slice((evolutionPage - 1) * ROWS_PER_PAGE, evolutionPage * ROWS_PER_PAGE).map((e, i) => (
                                                        <tr key={i} className="border-t dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                                                            <td className="px-4 py-2">
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${e.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300' : e.status === 'running' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300'}`}>
                                                                    {e.status}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2 text-center font-bold dark:text-white">{e.docs_scanned}</td>
                                                            <td className="px-4 py-2 text-center font-bold dark:text-white">{e.docs_updated}</td>
                                                            <td className="px-4 py-2 text-center font-bold dark:text-white">{e.corrections_applied}</td>
                                                            <td className="px-4 py-2 text-center font-bold dark:text-white">{e.knowledge_pruned}</td>
                                                            <td className="px-4 py-2 text-center font-bold dark:text-white">{e.new_topics_found}</td>
                                                            <td className="px-4 py-2 text-right text-xs text-gray-400">{new Date(e.created_at).toLocaleDateString()}</td>
                                                        </tr>
                                                    ))}
                                            </tbody>
                                        </table>
                                        <TablePagination total={evolutionHistory.length} page={evolutionPage} setPage={setEvolutionPage} />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-400 dark:text-slate-500 text-sm">
                                        Belum ada riwayat evolution scan. Klik "Run Evolution Scan" untuk memulai.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 1MBrain Tab */}
                        {trainingTab === 'brain' && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h4 className="font-bold text-sm text-gray-700 dark:text-slate-300 flex items-center gap-2">
                                            <Brain size={16} className="text-amber-500" /> 1MBrain — Semantic Graph Memory
                                        </h4>
                                        <p className="text-xs text-gray-500 mt-0.5">Status, pencarian, konsolidasi, dan manajemen memori AI.</p>
                                    </div>
                                    <button
                                        onClick={fetchBrainData}
                                        disabled={brainLoading}
                                        className="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-xs flex items-center gap-1.5 hover:bg-gray-700 transition-colors disabled:opacity-50"
                                    >
                                        {brainLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
                                    </button>
                                </div>

                                {/* Health & Stats Cards */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
                                        <div className="flex items-center justify-center gap-1 mb-1">
                                            <span className={`w-2 h-2 rounded-full ${brainHealth?.status === 'ok' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                            <span className="text-xs text-gray-500 dark:text-slate-400">Status</span>
                                        </div>
                                        <div className="text-sm font-black text-amber-600 dark:text-amber-300">{brainHealth?.status === 'ok' ? 'Connected' : 'Offline'}</div>
                                    </div>
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-black text-indigo-600 dark:text-indigo-300">{brainStats?.memoryCount ?? '-'}</div>
                                        <div className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">Memories</div>
                                    </div>
                                    <div className="bg-violet-50 dark:bg-violet-900/20 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-black text-violet-600 dark:text-violet-300">{brainStats?.associationCount ?? '-'}</div>
                                        <div className="text-xs text-violet-500 dark:text-violet-400 mt-1">Associations</div>
                                    </div>
                                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-black text-emerald-600 dark:text-emerald-300">{brainTotalMemories}</div>
                                        <div className="text-xs text-emerald-500 dark:text-emerald-400 mt-1">Total Listed</div>
                                    </div>
                                </div>

                                {/* Info Row */}
                                {brainHealth && (
                                    <div className="flex flex-wrap gap-4 text-[11px] text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800/50 rounded-lg px-3 py-2">
                                        <span>Uptime: <strong>{(brainHealth.uptime / 3600).toFixed(1)}h</strong></span>
                                        <span>Embedding: <strong>{brainHealth.embedding}</strong></span>
                                        <span>DB: <strong>{brainHealth.database}</strong></span>
                                        <span>Version: <strong>{brainHealth.version}</strong></span>
                                    </div>
                                )}

                                {/* Search */}
                                <div className="bg-white dark:bg-slate-900 border dark:border-slate-700/50 rounded-lg p-3">
                                    <h5 className="font-bold text-xs text-gray-600 dark:text-slate-300 mb-2 flex items-center gap-1.5"><Search size={13} /> Cari Memori</h5>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Kata kunci pencarian..."
                                            className="flex-1 px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                                            value={brainSearchQuery}
                                            onChange={(e) => setBrainSearchQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleBrainSearch()}
                                        />
                                        <button
                                            onClick={handleBrainSearch}
                                            disabled={brainSearching || !brainSearchQuery.trim()}
                                            className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs flex items-center gap-1 hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                        >
                                            {brainSearching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />} Cari
                                        </button>
                                    </div>
                                    {brainSearchResults.length > 0 && (
                                        <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                                            {brainSearchResults.map((r, i) => (
                                                <div key={r.memory?.id || i} className="text-xs bg-gray-50 dark:bg-slate-800/50 rounded p-2 border-l-2 border-indigo-400">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className="text-[10px] px-1 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">{r.memory?.type}</span>
                                                        <span className="text-[10px] text-gray-400">score: {(r.score * 100).toFixed(0)}%</span>
                                                    </div>
                                                    <p className="text-gray-700 dark:text-slate-300 line-clamp-2">{r.memory?.content}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Consolidation */}
                                <div className="bg-white dark:bg-slate-900 border dark:border-slate-700/50 rounded-lg p-3">
                                    <h5 className="font-bold text-xs text-gray-600 dark:text-slate-300 mb-2 flex items-center gap-1.5"><Zap size={13} /> Konsolidasi Memori</h5>
                                    <p className="text-[11px] text-gray-500 mb-2">Menjalankan konsolidasi akan mengelompokkan memori serupa, mengekstrak knowledge baru, dan mengarsipkan memori usang.</p>
                                    <button
                                        onClick={handleBrainConsolidate}
                                        disabled={brainConsolidating}
                                        className="px-3 py-2 bg-amber-600 text-white rounded-lg text-xs flex items-center gap-1 hover:bg-amber-700 transition-colors disabled:opacity-50"
                                    >
                                        {brainConsolidating ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />} Run Consolidation
                                    </button>
                                    {brainConsolidateResult && (
                                        <div className="mt-2 text-xs bg-emerald-50 dark:bg-emerald-900/20 rounded p-2 text-emerald-700 dark:text-emerald-300">
                                            Stored: {brainConsolidateResult.storedCount} · Archived: {brainConsolidateResult.archivedCount} · Clusters: {brainConsolidateResult.clustersProcessed}
                                            {brainConsolidateResult.summaryIds?.length > 0 && ` · Summaries: ${brainConsolidateResult.summaryIds.length}`}
                                        </div>
                                    )}
                                </div>

                                {/* Sync Training Docs to 1MBrain */}
                                <div className="bg-white dark:bg-slate-900 border dark:border-slate-700/50 rounded-lg p-3">
                                    <h5 className="font-bold text-xs text-gray-600 dark:text-slate-300 mb-2 flex items-center gap-1.5"><RefreshCw size={13} /> Sinkronisasi Data Training ke 1MBrain</h5>
                                    <p className="text-[11px] text-gray-500 mb-2">Sinkronkan semua dokumen training yang aktif ke 1MBrain agar pencarian memori lebih terpusat.</p>
                                    <button
                                        onClick={handleBrainSyncTraining}
                                        disabled={brainSyncing}
                                        className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs flex items-center gap-1 hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                    >
                                        {brainSyncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Sync Training ke 1MBrain
                                    </button>
                                    {brainSyncResult && (
                                        <div className="mt-2 text-xs bg-emerald-50 dark:bg-emerald-900/20 rounded p-2 text-emerald-700 dark:text-emerald-300">
                                            ✅ {brainSyncResult.synced} dokumen tersinkron · ❌ {brainSyncResult.errors} gagal · Total: {brainSyncResult.total}
                                        </div>
                                    )}
                                </div>

                                {/* Ingest Knowledge */}
                                <div className="bg-white dark:bg-slate-900 border dark:border-slate-700/50 rounded-lg p-3">
                                    <h5 className="font-bold text-xs text-gray-600 dark:text-slate-300 mb-2 flex items-center gap-1.5"><FileText size={13} /> Tambah Pengetahuan ke 1MBrain</h5>
                                    <form onSubmit={handleBrainIngest} className="space-y-2">
                                        <input
                                            type="text"
                                            placeholder="Judul..."
                                            className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                                            value={brainIngestForm.title}
                                            onChange={(e) => setBrainIngestForm({ ...brainIngestForm, title: e.target.value })}
                                            required
                                        />
                                        <textarea
                                            placeholder="Konten Markdown..."
                                            rows={4}
                                            className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                                            value={brainIngestForm.markdown}
                                            onChange={(e) => setBrainIngestForm({ ...brainIngestForm, markdown: e.target.value })}
                                            required
                                        />
                                        <button
                                            type="submit"
                                            disabled={brainIngesting || !brainIngestForm.title.trim() || !brainIngestForm.markdown.trim()}
                                            className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs flex items-center gap-1 hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                        >
                                            {brainIngesting ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Ingest ke 1MBrain
                                        </button>
                                    </form>
                                </div>

                                {/* Recent Memories */}
                                <div className="bg-white dark:bg-slate-900 border dark:border-slate-700/50 rounded-lg p-3">
                                    <h5 className="font-bold text-xs text-gray-600 dark:text-slate-300 mb-2 flex items-center gap-1.5"><Clock size={13} /> Memori Terbaru ({brainMemories.length})</h5>
                                    {brainLoading ? (
                                        <div className="text-center py-6 text-gray-400"><Loader2 size={20} className="animate-spin inline-block" /></div>
                                    ) : brainMemories.length === 0 ? (
                                        <div className="text-center py-6 text-gray-400 dark:text-slate-500 text-xs">Belum ada memori.</div>
                                    ) : (
                                        <div className="space-y-1 max-h-64 overflow-y-auto">
                                            {brainMemories.map((m, i) => (
                                                <div key={m.id || i} className="text-xs bg-gray-50 dark:bg-slate-800/50 rounded p-2 border-l-2 border-amber-400">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className="text-[10px] px-1 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">{m.type}</span>
                                                        {m.importance && <span className="text-[10px] text-gray-400">importance: {(m.importance * 100).toFixed(0)}%</span>}
                                                        {m.createdAt && <span className="text-[10px] text-gray-400 ml-auto">{new Date(m.createdAt).toLocaleDateString()}</span>}
                                                    </div>
                                                    <p className="text-gray-700 dark:text-slate-300 line-clamp-2">{m.content}</p>
                                                    {m.tags?.length > 0 && (
                                                        <div className="flex gap-1 mt-1 flex-wrap">
                                                            {m.tags.map((t, ti) => (
                                                                <span key={ti} className="text-[9px] px-1 rounded bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400">{t}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Knowledge Graph (Brain) Tab */}
                        {trainingTab === 'graph' && (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h4 className="font-bold text-sm text-gray-700 dark:text-slate-300 flex items-center gap-2">
                                            <Brain size={16} className="text-indigo-500" /> Peta Pengetahuan AI (Knowledge Brain)
                                        </h4>
                                        <p className="text-xs text-gray-500 mt-0.5">Visualisasi hubungan: dokumen training → chunk → knowledge → koreksi, dikelompokkan per kategori.</p>
                                    </div>
                                    <button
                                        onClick={fetchGraph}
                                        disabled={graphLoading}
                                        className="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-xs flex items-center gap-1.5 hover:bg-gray-700 transition-colors disabled:opacity-50"
                                    >
                                        {graphLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
                                    </button>
                                </div>
                                {graphLoading && !graphData ? (
                                    <div className="text-center py-16 text-gray-400 dark:text-slate-500"><Loader2 size={28} className="animate-spin inline-block" /></div>
                                ) : graphData && graphData.nodes?.length > 0 ? (
                                    <KnowledgeGraph data={graphData} height={540} />
                                ) : (
                                    <div className="text-center py-16 text-gray-400 dark:text-slate-500 text-sm">Belum ada data pengetahuan untuk ditampilkan.</div>
                                )}
                            </div>
                        )}

                        {/* Document List */}
                        <div className="border dark:border-slate-700/50 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-slate-800/50">
                                        <th className="text-left px-4 py-3 font-bold text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wider">{text.title}</th>
                                        <th className="text-left px-4 py-3 font-bold text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wider">{text.fileType}</th>
                                        <th className="text-left px-4 py-3 font-bold text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wider">{text.category}</th>
                                        <th className="text-left px-4 py-3 font-bold text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wider">{text.uploadedAt}</th>
                                        <th className="text-left px-4 py-3 font-bold text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wider">Status</th>
                                        <th className="text-right px-4 py-3 font-bold text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {trainingLoading ? (
                                        <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-400 dark:text-slate-500"><Loader2 size={20} className="animate-spin inline-block" /></td></tr>
                                    ) : trainingDocs.length === 0 ? (
                                        <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">{text.noTrainingDocs}</td></tr>
                                    ) : trainingDocs.slice((docPage - 1) * ROWS_PER_PAGE, docPage * ROWS_PER_PAGE).map(doc => (
                                        <tr key={doc.id} className="border-t dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <span className="font-medium dark:text-white">{doc.title}</span>
                                                {doc.tags && <p className="text-[10px] text-gray-400 mt-0.5">{doc.tags}</p>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">{doc.file_type}</span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{text.categories[doc.category] || doc.category}</td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{new Date(doc.created_at).toLocaleDateString()}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${doc.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : doc.status === 'processing' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                                                    {text[doc.status] || doc.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex gap-1 justify-end">
                                                    {doc.status === 'processing' && (
                                                        <button onClick={() => handleTrainingRefresh()} className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors" title={text.refreshStatus}>
                                                            <RefreshCw size={14} />
                                                        </button>
                                                    )}
                                                    <button onClick={() => openTrainingDetail(doc)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" title={text.detailLearning}>
                                                        <Info size={14} />
                                                    </button>
                                                    <button onClick={() => openTrainingPreview(doc.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors" title={text.preview}>
                                                        <Eye size={14} />
                                                    </button>
                                                    <button onClick={() => handleTrainingReprocess(doc.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors" title={text.reprocess}>
                                                        <RefreshCw size={14} />
                                                    </button>
                                                    <button onClick={() => handleTrainingDelete(doc.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title={text.delete}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <TablePagination total={trainingDocs.length} page={docPage} setPage={setDocPage} />
                        </div>
                    </Card>
                )
            }

            {/* Training Preview Modal */}
            {trainingPreview && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setTrainingPreview(null)}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border dark:border-slate-700/50" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b dark:border-slate-700/50">
                            <div>
                                <h3 className="font-bold text-lg dark:text-white">{trainingPreview.title}</h3>
                                <p className="text-xs text-gray-500 mt-1">{text.categories[trainingPreview.category] || trainingPreview.category}</p>
                            </div>
                            <button onClick={() => setTrainingPreview(null)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>
                        <div className="p-5 overflow-y-auto">
                            <div className="flex gap-2 mb-4">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">{trainingPreview.file_type}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${trainingPreview.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                                    {text[trainingPreview.status] || trainingPreview.status}
                                </span>
                            </div>
                            <pre className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap font-sans">{trainingPreview.content}</pre>
                        </div>
                        <div className="p-4 border-t dark:border-slate-700/50 flex justify-end">
                            <button onClick={() => setTrainingPreview(null)} className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Training Detail Modal */}
            {trainingDetail && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setTrainingDetail(null)}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col border dark:border-slate-700/50" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b dark:border-slate-700/50">
                            <div className="flex items-center gap-2">
                                <Info size={20} className="text-blue-500" />
                                <h3 className="font-bold text-lg dark:text-white">{text.learningDetail}</h3>
                            </div>
                            <button onClick={() => setTrainingDetail(null)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>
                        <div className="p-5 overflow-y-auto space-y-4">
                            <div className="flex items-center gap-2">
                                <FileText size={16} className="text-gray-400" />
                                <span className="font-medium dark:text-white">{trainingDetail.title}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{text.fileType}</p>
                                    <p className="text-sm font-bold dark:text-white">{trainingDetail.file_type}</p>
                                </div>
                                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{text.embeddingStatus}</p>
                                    <span className={`text-sm font-bold ${trainingDetail.status === 'active' ? 'text-emerald-600 dark:text-emerald-400' : trainingDetail.status === 'processing' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {text[trainingDetail.status] || trainingDetail.status}
                                    </span>
                                </div>
                                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{text.chunks}</p>
                                    <p className="text-sm font-bold dark:text-white">{trainingDetail.chunk_count || 0}</p>
                                </div>
                                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{text.category}</p>
                                    <p className="text-sm font-bold dark:text-white">{text.categories[trainingDetail.category] || trainingDetail.category}</p>
                                </div>
                                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{text.contentLength}</p>
                                    <p className="text-sm font-bold dark:text-white">{trainingDetail.content ? `${trainingDetail.content.length.toLocaleString()} chars` : '-'}</p>
                                </div>
                                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{text.lastUpdated}</p>
                                    <p className="text-sm font-bold dark:text-white">{trainingDetail.updated_at ? new Date(trainingDetail.updated_at).toLocaleString() : '-'}</p>
                                </div>
                            </div>
                            {trainingDetail.tags && (
                                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{text.tags}</p>
                                    <p className="text-sm dark:text-white">{trainingDetail.tags}</p>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t dark:border-slate-700/50 flex justify-end gap-2">
                            <button onClick={() => setTrainingDetail(null)} className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
