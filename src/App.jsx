﻿import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import mammoth from 'mammoth';
import { db as api, API_URL } from './services/database';
import { TOTAL_SLOTS, getStatusStyle } from './utils/constants'; // Import constants
import { checkPermission, APP_MODULES } from './utils/permissions';
import { performAdvancedOCR } from './utils/ocr';
import { parseApiError } from './utils/errorHandler';
import { documentService } from './services/documentService';
import { inventoryService } from './services/inventoryService';
import { taxService } from './services/taxService';
import { authService } from './services/authService';
import { pustakaService } from './services/pustakaService';
import { getSocket, disconnectSocket } from './services/socketService';
import Sidebar from './components/layout/Sidebar';
import Modal from './components/common/Modal';
import MasterDataModals from './components/modals/MasterDataModals';
import TaxModals from './components/modals/TaxModals';
import InventoryModals from './components/modals/InventoryModals';
import DocumentViewerModal from './components/modals/DocumentViewerModal';
import WorkflowDesigner from './components/workflow/WorkflowDesigner';
import UploadModal from './components/modals/UploadModal';
import OcrQueueModal from './components/modals/OcrQueueModal';
import InitialLandingPage from './components/layout/InitialLandingPage';
import MenuLandingSection from './components/layout/MenuLandingSection';
import WorkflowModal from './components/modals/WorkflowModal';
import RestoreBoxModal from './components/modals/RestoreBoxModal';
import ExternalTransferModal from './components/modals/ExternalTransferModal';
import CopyNotification from './components/ui/CopyNotification';

import { useAuthStore } from './store/useAuthStore';
import { useAppStore } from './store/useAppStore';
import { useDocStore } from './store/useDocStore';
import { useInventoryStore } from './store/useInventoryStore';

import {
  Package,
  LayoutDashboard,
  Grid3x3,
  History,
  Search,
  Plus,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  X,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  FileDigit,
  Trash2,
  GitCommit,
  User,
  FileKey,
  FileStack,
  UploadCloud,
  ShieldCheck,
  FileSearch,
  Eye,
  Edit3,
  FileText,
  Image as ImageIcon,
  Download,
  FileJson,
  PieChart,
  Highlighter,
  LogOut,
  ArrowLeftRight,
  Truck,
  Save,
  HardDrive,
  FileSpreadsheet, // Icon Excel
  Upload,            // Icon Upload
  Users,
  ClipboardCheck,
  Settings,
  Percent,
  FileBarChart,
  Shield,
  Printer,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Paperclip,
  Menu,
  RefreshCw,
  Activity,
  Rocket, Target, HelpCircle, Sparkles, Zap, Award, Globe, FileCheck, BookOpen, ScanLine,
  Calculator
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Documents from './pages/Documents';
import TaxMonitoring from './pages/TaxMonitoring';
import TaxSummary from './pages/TaxSummary';
import TaxCalculation from './pages/TaxCalculation';
import MasterData from './pages/MasterData';
import Profile from './pages/Profile';
import DocumentApproval from './pages/DocumentApproval';
import Pustaka from './pages/Pustaka';
import SystemLogs from './pages/SystemLogs';
import SopFlow from './pages/SopFlow';
import JobDueDate from './pages/JobDueDate';
import { getFullUrl } from './utils/urlHelper';
import { useToast, ToastContainer } from './components/ui/Toast';
import PdfViewer from './components/ui/PdfViewer';
import CommandPalette from './components/ui/CommandPalette';
import AiChatAssistant from './components/AiChatAssistant';
import OcrLanes from './components/OcrLanes';
import NotificationBell from './components/NotificationBell';
import { useLanguage } from './contexts/LanguageContext';


// --- API URL (Keep for local explicit use if needed, but db uses it internally) ---
console.log(`[System] API_URL initialized as: ${API_URL || '(relative)'}`);
const API_BASE = API_URL;

// Database adapter imported from ./services/database

// Constants imported from ./utils/constants
// Permissions logic imported from ./utils/permissions

// --- COMPONENTS ---

// Modal imported from ./components/common/Modal

// --- MAIN APPLICATION ---

export default function App() {
  // Toast Notification System
  const { toasts, toast, removeToast, updateToast } = useToast();
  const { language } = useLanguage();
  const isEnglish = language === 'en';

  const tabTextMap = useMemo(() => {
    if (language === 'en') {
      return {
        dashboard: { title: 'Executive Dashboard', subtitle: 'Dashboard' },
        inventory: { title: 'Rack Management', subtitle: 'Main Archive Warehouse - Floor 1' },
        documents: { title: 'Digital Documents', subtitle: 'Secure Digital Storage' },
        'tax-monitoring': { title: 'Audit Monitoring', subtitle: 'Tax Audit Monitoring System' },
        'tax-summary': { title: 'Tax Compliance', subtitle: 'Compliance & Payment Summary' },
        'tax-calculation': { title: 'Tax Calculation', subtitle: 'Tax Calculation & Reporting' },
        master: { title: 'Master Data', subtitle: 'System Settings' },
        approvals: { title: 'Document Approval', subtitle: 'Multi-level Document Approval System' },
        pustaka: { title: 'Knowledge Library', subtitle: 'Learning Center & Work Guidelines' },
        flow: { title: 'SOP List Menu', subtitle: 'Standard Operating Procedure' },
        'job-due-date': { title: 'Job Due Date Monitoring', subtitle: 'Task Deadline & Issue Monitoring' },
      };
    }

    return {
      dashboard: { title: 'Dashboard Ikhtisar', subtitle: 'Dashboard' },
      inventory: { title: 'Manajemen Rak', subtitle: 'Gudang Arsip Utama - Lantai 1' },
      documents: { title: 'Dokumen Digital', subtitle: 'Secure Digital Storage' },
      'tax-monitoring': { title: 'Monitoring Pemeriksaan', subtitle: 'Sistem Monitoring Pemeriksaan Pajak' },
      'tax-summary': { title: 'Kepatuhan Pajak', subtitle: 'Ringkasan Kepatuhan & Pembayaran' },
      'tax-calculation': { title: 'Kalkulasi Pajak', subtitle: 'Kalkulasi & Pelaporan Pajak' },
      master: { title: 'Master Data', subtitle: 'Pengaturan Sistem' },
      approvals: { title: 'Document Approval', subtitle: 'Sistem Persetujuan Dokumen Berjenjang' },
      pustaka: { title: 'Pustaka Pengetahuan', subtitle: 'Pusat Edukasi & Panduan Kerja' },
      flow: { title: 'SOP List Menu', subtitle: 'Standar Operasional Prosedur' },
      'job-due-date': { title: 'Job Due Date Monitoring', subtitle: 'Pemantauan Tenggat Waktu & Issue Kerja' },
    };
  }, [language]);

  const commandTextMap = useMemo(() => {
    if (language === 'en') {
      return {
        groups: {
          general: 'General',
          documents: 'Documents',
          tax: 'Tax',
          system: 'System',
        },
        items: {
          dashboard: { label: 'Dashboard', description: 'System overview' },
          'job-due-date': { label: 'My Job', description: 'Issue and due date monitoring' },
          pustaka: { label: 'Manual Book', description: 'Work guidelines and knowledge center' },
          flow: { label: 'SOP Flow', description: 'Interactive SOP flow' },
          inventory: { label: 'Inventory', description: 'Internal and external archive warehouse' },
          documents: { label: 'Documents', description: 'Digital documents' },
          approvals: { label: 'Approvals', description: 'Document approvals' },
          'tax-monitoring': { label: 'Tax Monitoring', description: 'Tax audit monitoring' },
          'tax-calculation': { label: 'Tax Calculation', description: 'Tax calculations' },
          'tax-summary': { label: 'Tax Summary', description: 'Tax compliance summary' },
          master: { label: 'Master Data', description: 'Users, roles, and reference data settings' },
          profile: { label: 'Profile', description: 'User profile' },
        },
        actions: {
          upload: { label: 'Upload Document', description: 'Open upload document modal' },
          ocrQueue: { label: 'View OCR Queue', description: 'Open OCR queue status' },
          themeLight: 'Switch to Light Mode',
          themeDark: 'Switch to Dark Mode',
          themeDescription: 'Switch app theme',
        },
        labels: {
          loading: 'Loading Database...',
          infoMenu: 'Menu Info',
        },
      };
    }

    return {
      groups: {
        general: 'General',
        documents: 'Documents',
        tax: 'Tax',
        system: 'System',
      },
      items: {
        dashboard: { label: 'Dashboard', description: 'Ikhtisar sistem' },
        'job-due-date': { label: 'My Job', description: 'Monitoring issue dan due date' },
        pustaka: { label: 'Manual Book', description: 'Panduan kerja dan pengetahuan' },
        flow: { label: 'SOP Flow', description: 'Alur SOP interaktif' },
        inventory: { label: 'Inventory', description: 'Gudang arsip internal dan eksternal' },
        documents: { label: 'Documents', description: 'Dokumen digital' },
        approvals: { label: 'Approvals', description: 'Persetujuan dokumen' },
        'tax-monitoring': { label: 'Tax Monitoring', description: 'Monitoring pemeriksaan pajak' },
        'tax-calculation': { label: 'Tax Calculation', description: 'Perhitungan pajak' },
        'tax-summary': { label: 'Tax Summary', description: 'Ringkasan kepatuhan pajak' },
        master: { label: 'Master Data', description: 'Pengaturan user, role, dan data referensi' },
        profile: { label: 'Profile', description: 'Profil pengguna' },
      },
      actions: {
        upload: { label: 'Upload Dokumen', description: 'Buka modal upload dokumen' },
        ocrQueue: { label: 'Lihat OCR Queue', description: 'Buka status antrian OCR' },
        themeLight: 'Switch ke Light Mode',
        themeDark: 'Switch ke Dark Mode',
        themeDescription: 'Ganti tema tampilan',
      },
      labels: {
        loading: 'Memuat Database...',
        infoMenu: 'Info Menu',
      },
    };
  }, [language]);

  // --- ZUSTAND GLOBAL STORES ---
  const {
    isDarkMode, setIsDarkMode,
    showInitialLanding, setShowInitialLanding,
    isSidebarCollapsed, setIsSidebarCollapsed,
    activeTab, setActiveTab,
    isModalOpen, setIsModalOpen,
    modalTab, setModalTab,
    copyNotification, setCopyNotification,
    logs, setLogs
  } = useAppStore();

  const {
    currentUser, setCurrentUser,
    users, setUsers,
    roles, setRoles,
    departments, setDepartments,
    logout
  } = useAuthStore();

  const {
    docList, setDocList,
    folders, setFolders,
    currentFolderId, setCurrentFolderId,
    folderHistory, historyIndex, navigateFolder, navigateBack, navigateForward,
    approvals, setApprovals,
    flows, setFlows,
    fetchDocs, fetchFolders, fetchApprovals,
    createDocument, updateDocument, deleteDocument,
    createFolder, updateFolder, deleteFolder,
    copyDocument, moveDocument
  } = useDocStore();

  const {
    inventory, setInventory,
    inventoryIssues, setInventoryIssues,
    stats, setStats,
    externalItems, setExternalItems,
    activeInvTab, setActiveInvTab,
    ocrStats, setOcrStats,
    fetchInventory,
    updateInventory, moveInventory,
    createExternalItem, deleteExternalItem
  } = useInventoryStore();

  // --- REAL-TIME STATUS HYDRATION ---
  // Menghubungkan status OCR dari tabel 'documents' ke dalam data 'inventory' secara dinamis
  const hydratedInventory = useMemo(() => {
    return inventory.map(slot => {
      const data = slot.box_data || slot.boxData;
      if (!data || !data.ordners) return slot;

      const updatedOrdners = data.ordners.map(ord => ({
        ...ord,
        invoices: (ord.invoices || []).map(inv => {
          const realDoc = docList.find(d => d.id === inv.id);
          return realDoc ? {
            ...inv,
            status: realDoc.status || inv.status,
            ocrContent: realDoc.ocrContent || inv.ocrContent
          } : inv;
        })
      }));

      return { ...slot, boxData: { ...data, ordners: updatedOrdners } };
    });
  }, [inventory, docList]);

  const handleCloseLanding = () => setShowInitialLanding(false);
  const handleOpenLanding = () => setShowInitialLanding(true);
  const [showMenuLandingPopup, setShowMenuLandingPopup] = useState(false);

  // Fungsi pembantu untuk menyalin teks ke clipboard dengan notifikasi
  const handleCopyToClipboard = (text, label = "Data") => {
    if (text === undefined || text === null) return;
    const textToCopy = String(text);
    const successAction = () => {
      setCopyNotification(label);
      setTimeout(() => setCopyNotification(null), 3000);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(textToCopy).then(successAction).catch(() => fallbackCopy(textToCopy, successAction));
    } else {
      fallbackCopy(textToCopy, successAction);
    }
  };

  const fallbackCopy = (text, callback) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try { document.execCommand('copy'); callback(); } catch (err) { console.error('Copy failed', err); }
    document.body.removeChild(textArea);
  };

  // getFullUrl is now imported from urlHelper

  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [showExternalForm, setShowExternalForm] = useState(false);
  const [externalDate, setExternalDate] = useState('');
  const [showRestoreForm, setShowRestoreForm] = useState(false);
  const [restoreTargetSlot, setRestoreTargetSlot] = useState('');
  const [selectedExternalItem, setSelectedExternalItem] = useState(null);
  const fileInputRef = useRef(null);
  const excelInputRef = useRef(null);
  const invoiceFileInputRef = useRef(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [viewDocData, setViewDocData] = useState(null);

  // Remaining features state
  const [taxAudits, setTaxAudits] = useState([]);
  const [taxSummaries, setTaxSummaries] = useState([]);

  const [isFlowModalOpen, setIsFlowModalOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState(null);
  const [flowForm, setFlowForm] = useState({ name: '', description: '', steps: [], visual_config: null });

  const [masterTab, setMasterTab] = useState('users');
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ name: '', permissions: {} });
  const [userForm, setUserForm] = useState({ id: null, username: '', password: '', name: '', role: 'staff', department: '' });
  const [deptForm, setDeptForm] = useState({ id: null, name: '' });

  const [showTaxForm, setShowTaxForm] = useState(false);
  const [taxForm, setTaxForm] = useState({
    id: '', type: 'PPH', month: '', year: new Date().getFullYear(), pembetulan: 0,
    data: { pph: {}, ppnIn: {}, ppnOut: {} }
  });

  const [isLoading, setIsLoading] = useState(!!currentUser);

  const lastOcrCompletedRef = useRef(0);
  const lastOcrFailedRef = useRef(0);
  const lastOcrWaitingRef = useRef(0);
  const lastOcrActiveRef = useRef(0);

  useEffect(() => {
    if (!currentUser) return;

    const fetchOcrStatus = async () => {
      try {
        const url = `${API_BASE}/ocr/status`;
        const res = await fetch(url, {
          credentials: 'include'
        });
        if (!res.ok) return;
        const data = await res.json();

        // Check for new completions/failures for general alerts
        const newCompleted = data?.counts?.completed || 0;
        const newFailed = data?.counts?.failed || 0;
        const newWaiting = data?.counts?.waiting || 0;
        const newActive = data?.counts?.active || 0;

        // Debug Heartbeat: Muncul setiap 5 detik untuk memastikan polling jalan
        // console.debug(`[OCR Poll] Active: ${newActive}, Completed: ${newCompleted} (Last: ${lastOcrCompletedRef.current})`);

        // Refresh logic: Dipicu saat jumlah selesai/gagal bertambah OR saat antrean baru saja selesai (transisi sibuk -> kosong)
        const isQueueEmpty = newActive === 0 && newWaiting === 0;
        const wasQueueBusy = lastOcrActiveRef.current > 0 || lastOcrWaitingRef.current > 0;
        const hasLocalProcessing = docList.some(d => d.status === 'processing' || d.status === 'waiting');

        // Hanya refresh jika ada progres nyata atau antrean baru saja tuntas
        if (newCompleted > lastOcrCompletedRef.current ||
          newFailed > lastOcrFailedRef.current ||
          (isQueueEmpty && wasQueueBusy && hasLocalProcessing)) {
          console.log("OCR Status Change detected. Refreshing data...");
          fetchInventory(); // Refresh Inventory
          fetchDocs();      // Refresh Documents
          fetchLogs();      // Refresh Logs
        }

        // Failure Toast
        if (lastOcrFailedRef.current > 0 && newFailed > lastOcrFailedRef.current) {
          const failedCount = newFailed - lastOcrFailedRef.current;
          toast.error(`OCR Gagal: ${failedCount} dokumen gagal diproses.`);
        }

        lastOcrCompletedRef.current = newCompleted;
        lastOcrFailedRef.current = newFailed;
        lastOcrWaitingRef.current = data?.counts?.waiting || 0;
        lastOcrActiveRef.current = data?.counts?.active || 0;
        setOcrStats(data || { counts: { active: 0, waiting: 0, completed: 0, failed: 0 }, activeJobs: [] });
      } catch (err) {
        console.error("Failed to fetch OCR status:", err);
      }
    };

    const interval = setInterval(fetchOcrStatus, 5000); // Poll every 5s
    // Initial fetch with small delay to allow server startup
    setTimeout(fetchOcrStatus, 1000);

    return () => clearInterval(interval);
  }, [currentUser]); // Dependency on currentUser ensures it runs only when logged in

  const fetchLogs = async () => {
    const data = await api.getLogs();
    setLogs(data);
  };

  const fetchTaxAudits = async () => {
    const data = await api.getTaxAudits();
    setTaxAudits(data);
  };

  useEffect(() => {
    if (!currentUser) return; // Only fetch data if logged in

    const initData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchDocs(),
        fetchFolders(),
        fetchLogs(),
        fetchTaxAudits(),
        fetchApprovals(),
        fetchInventory(),
        api.getTaxSummaries().then(setTaxSummaries),
        api.getUsers().then(setUsers),
        api.getRoles().then(setRoles),
        api.getDepartments().then(setDepartments),
        api.getApprovalFlows().then(setFlows) // Fetch flows on init
      ]);
      // Initialize OCR completion count
      try {
        const ocrRes = await fetch(`/api/ocr/status`, {
          credentials: 'include'
        });
        const ocrData = await ocrRes.json();
        lastOcrCompletedRef.current = ocrData?.counts?.completed || 0;
      } catch (e) { console.warn("Initial OCR status fetch failed", e); }

      setIsLoading(false);
    };
    initData();
  }, [currentUser]);

  // --- SOCKET.IO REAL-TIME SYNC ---
  useEffect(() => {
    if (!currentUser) return;

    const socket = getSocket();
    const debounceTimers = {};

    const handleDataChanged = ({ channel }) => {
      // Debounce: jika ada banyak perubahan cepat, tunggu 500ms sebelum refetch
      if (debounceTimers[channel]) clearTimeout(debounceTimers[channel]);
      debounceTimers[channel] = setTimeout(() => {
        console.log(`[Socket.IO] Data changed: ${channel} — refetching...`);
        switch (channel) {
          case 'inventory':
            fetchInventory();
            break;
          case 'documents':
            fetchDocs();
            fetchFolders();
            break;
          case 'tax':
            fetchTaxAudits();
            api.getTaxSummaries().then(setTaxSummaries);
            break;
          case 'approvals':
            fetchApprovals();
            break;
          case 'system':
            fetchFolders();
            api.getUsers().then(setUsers);
            api.getRoles().then(setRoles);
            api.getDepartments().then(setDepartments);
            fetchLogs();
            break;
          case 'users':
            api.getUsers().then(setUsers);
            break;
          case 'pustaka':
            // Pustaka data is fetched by the Pustaka page component itself
            break;
          case 'sop-flows':
            // SOP flows data is fetched by the SopFlow page component itself
            break;
          default:
            break;
        }
      }, 500);
    };

    socket.on('data:changed', handleDataChanged);

    return () => {
      socket.off('data:changed', handleDataChanged);
      Object.values(debounceTimers).forEach(clearTimeout);
    };
  }, [currentUser]);

  // Theme Effect
  useEffect(() => {
    localStorage.setItem('archive_theme', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Favicon & Title Effect
  useEffect(() => {
    document.title = "Pustaka - Sistem Manajemen Terpadu";
    const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
    link.type = 'image/svg+xml';
    link.rel = 'shortcut icon';
    // Menggunakan SVG BookOpen dari Lucide dengan warna Indigo (#4318FF)
    link.href = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%234318FF%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z%22/><path d=%22M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z%22/></svg>`;
    document.getElementsByTagName('head')[0].appendChild(link);
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [inventorySearchQuery, setInventorySearchQuery] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');

  const handleOpenNotificationChannel = useCallback((channel) => {
    const channelToTab = {
      documents: 'documents',
      inventory: 'inventory',
      tax: 'tax-monitoring',
      approvals: 'approvals',
      system: 'master',
      users: 'master',
      jobs: 'job-due-date',
      pustaka: 'pustaka',
      'sop-flows': 'flow',
      'tax-monitoring': 'tax-monitoring',
      'tax-summary': 'tax-summary'
    };

    const targetTab = channelToTab[channel];
    if (targetTab) {
      setActiveTab(targetTab);
    }
  }, [setActiveTab]);

  // Warehouse Form State
  const [boxForm, setBoxForm] = useState({
    boxId: '',
    ordners: []
  });

  const [editingItem, setEditingItem] = useState(null);
  const [moveTargetSlot, setMoveTargetSlot] = useState('');
  const [showMoveInput, setShowMoveInput] = useState(false);

  // Digital Doc Upload/Edit/View State
  const [uploadForm, setUploadForm] = useState({
    id: '', title: '', ocrContent: '', fileType: '', fileSize: '',
    previewUrl: null, fileData: null, isProcessing: false,
    processingMessage: '', editMode: false, originalDoc: null
  });



  // Temp State
  const [newOrdner, setNewOrdner] = useState({ noOrdner: '', period: '' });
  const [newInvoice, setNewInvoice] = useState({
    invoiceNo: '',
    vendor: '',
    paymentDate: '',
    taxInvoiceNo: '',
    specialNote: '',
    file: null,
    fileName: '',
    ocrContent: '',
    isProcessing: false
  });
  const [expandedOrdnerIds, setExpandedOrdnerIds] = useState([]);

  // --- INITIALIZATION ---



  const getSearchSnippet = (text, query) => {
    if (!text) return "";
    if (!query) return String(text).substring(0, 120) + "...";
    const lowerText = String(text).toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    if (index === -1) return text.substring(0, 120) + "...";
    const start = Math.max(0, index - 40);
    const end = Math.min(text.length, index + query.length + 60);
    return "..." + text.substring(start, end) + "...";
  };

  // --- HANDLERS: WAREHOUSE ---

  const syncBoxFolder = async (boxId, status, oldBoxId = null, existingFolders = null) => {
    if (!boxId) return null;
    try {
      // Use provided folders or fallback to state
      const currentFolders = existingFolders || folders;

      // 1. Cari atau Buat folder sistem "DataBox" di Root
      let dataBoxFolder = currentFolders.find(f => f.name === 'DataBox' && (!(f.parentId || f.parent_id) || [0, '0', 'null'].includes(f.parentId || f.parent_id)));
      if (!dataBoxFolder) {
        const allFolders = await api.getFolders();
        dataBoxFolder = allFolders.find(f => f.name === 'DataBox' && (!(f.parentId || f.parent_id) || [0, '0', 'null'].includes(f.parentId || f.parent_id)));
      }

      if (!dataBoxFolder && status !== 'EMPTY' && status !== 'REMOVED') {
        await api.createFolder({
          name: 'DataBox',
          parent_id: null,
          privacy: 'public',
          owner: 'System'
        });
        await fetchFolders();
        const updatedFolders = await api.getFolders();
        dataBoxFolder = updatedFolders.find(f => f.name === 'DataBox');
      }

      const dataBoxId = dataBoxFolder?.id || null;

      if (!dataBoxId) {
        throw new Error("Folder sistem 'DataBox' tidak ditemukan dan gagal dibuat. Hubungi administrator.");
      }

      // Helper function untuk mencari folder di parent tertentu
      const findInParent = (list, pId) => list.find(f => {
        const fParentId = f.parentId || f.parent_id;
        const isRootF = !fParentId || fParentId === 'null' || fParentId === 0 || fParentId === '0' || fParentId === null;

        const targetParentId = (!pId || pId === 'null' || pId === 0 || pId === '0') ? null : String(pId);
        const targetId = oldBoxId || boxId;
        if (targetParentId === null) {
          if (!isRootF) return false;
        } else if (String(fParentId) !== targetParentId) return false;

        const n = f.name || '';
        return n === targetId ||
          n.startsWith(`RM_${targetId}`) ||
          n.startsWith(`ED_${targetId}`) ||
          n.startsWith(`MV_${targetId}`) ||
          n.startsWith(`TR_${targetId}`) ||
          n.startsWith(`[INV] ${targetId}`);
      });

      // 2. Cari folder box di dalam DataBox
      let folder = findInParent(currentFolders, dataBoxId);
      if (!folder) {
        const allFolders = await api.getFolders();
        folder = findInParent(allFolders, dataBoxId);
      }

      // 3. MIGRASI: Jika tidak ada di DataBox, cek apakah ada di Root (terlanjur dibuat di root)
      if (!folder && dataBoxId) {
        let rootFolder = findInParent(currentFolders, null);
        if (!rootFolder) {
          const allFolders = await api.getFolders();
          rootFolder = findInParent(allFolders, null);
        }

        if (rootFolder) {
          // Pindahkan folder dari Root ke DataBox secara otomatis
          await api.moveFolder(rootFolder.id, dataBoxId);
          await fetchFolders();
          folder = rootFolder;
          console.log(`Migrasi: Folder box "${folder.name}" dipindahkan dari root ke DataBox.`);
        }
      }

      // Jika folder belum ada dan status bukan penghapusan, buat folder baru di dalam DataBox
      if (!folder && status !== 'EMPTY' && status !== 'REMOVED') {
        await api.createFolder({
          name: boxId,
          parent_id: dataBoxId,
          privacy: 'public',
          owner: currentUser?.name || 'System'
        });
        await fetchFolders();
        const updatedFolders = await api.getFolders();
        folder = findInParent(updatedFolders, dataBoxId);
      }

      if (folder) {
        let newName = boxId;

        if (status === 'REMOVED' || status === 'EMPTY') {
          newName = `RM_${boxId}`;
        } else if (status === 'UPDATED') {
          newName = `ED_${boxId}`;
        } else if (status === 'MOVED') {
          newName = `MV_${boxId}`;
        } else if (status === 'EXTERNAL') {
          newName = `TR_${boxId}`;
        }

        // FORCE CHECK: Pastikan nama sesuai DAN folder berada di dalam DataBox
        const currentParentId = folder.parentId || folder.parent_id;
        if (newName !== folder.name || String(currentParentId) !== String(dataBoxId)) {
          await api.updateFolder(folder.id, {
            name: newName,
            parentId: dataBoxId // Paksa masuk ke DataBox
          });
          await fetchFolders();
        }
        return folder.id;
      }
      return null;
    } catch (err) {
      console.error("Folder sync failed:", err);
      return null;
    }
  };

  const syncAuditFolder = async (auditTitle, status = 'ACTIVE') => {
    if (!auditTitle) return null;
    try {
      // 1. Cari atau Buat folder sistem "TaxAudit" di Root
      let taxAuditParent = folders.find(f => f.name === 'TaxAudit' && (!(f.parentId || f.parent_id) || [0, '0', 'null'].includes(f.parentId || f.parent_id)));
      if (!taxAuditParent) {
        const allFolders = await api.getFolders();
        taxAuditParent = allFolders.find(f => f.name === 'TaxAudit' && (!(f.parentId || f.parent_id) || [0, '0', 'null'].includes(f.parentId || f.parent_id)));
      }

      if (!taxAuditParent) {
        await api.createFolder({
          name: 'TaxAudit',
          parent_id: null,
          privacy: 'public',
          owner: 'System'
        });
        await fetchFolders();
        const updatedFolders = await api.getFolders();
        taxAuditParent = updatedFolders.find(f => f.name === 'TaxAudit');
      }

      const taxAuditParentId = taxAuditParent?.id || null;
      const folderName = `Pemeriksaan - ${auditTitle}`;

      const findInParent = (list, pId, name) => list.find(f => {
        const fParentId = f.parentId || f.parent_id;
        const isRootF = !fParentId || [0, '0', 'null'].includes(fParentId);
        const targetParentId = (!pId || pId === 'null' || pId === 0 || pId === '0') ? null : String(pId);
        if (targetParentId === null) return isRootF && f.name === name;
        return String(fParentId) === targetParentId && f.name === name;
      });

      let folder = findInParent(folders, taxAuditParentId, folderName);
      if (!folder) {
        const allFolders = await api.getFolders();
        folder = findInParent(allFolders, taxAuditParentId, folderName);
      }

      if (!folder && taxAuditParentId) {
        let rootFolder = findInParent(folders, null, folderName);
        if (!rootFolder) {
          const allFolders = await api.getFolders();
          rootFolder = findInParent(allFolders, null, folderName);
        }
        if (rootFolder) {
          await api.moveFolder(rootFolder.id, taxAuditParentId);
          await fetchFolders();
          folder = rootFolder;
        }
      }

      if (!folder && taxAuditParentId && status === 'ACTIVE') {
        await api.createFolder({
          name: folderName,
          parent_id: taxAuditParentId,
          privacy: 'public',
          owner: currentUser?.name || 'System'
        });
        await fetchFolders();
        const updatedFolders = await api.getFolders();
        folder = findInParent(updatedFolders, taxAuditParentId, folderName);
      }

      if (folder) {
        let newName = folderName;
        if (status !== 'ACTIVE') {
          const dateStr = new Date().toISOString().split('T')[0];
          newName = `[TAX] ${auditTitle} - ${status} (${dateStr}_${Date.now().toString().slice(-4)})`;
        }

        const currentParentId = folder.parentId || folder.parent_id;
        if (newName !== folder.name || String(currentParentId) !== String(taxAuditParentId)) {
          await api.updateFolder(folder.id, {
            name: newName,
            parentId: taxAuditParentId
          });
          await fetchFolders();
        }
      }

      return folder?.id || null;
    } catch (err) {
      console.error("Audit folder sync failed:", err);
      return null;
    }
  };

  const syncPustakaFolder = async (guideTitle, oldTitle = null) => {
    if (!guideTitle) return null;
    try {
      // Selalu ambil data terbaru untuk akurasi folder ID
      const allFolders = await api.getFolders();

      let pustakaParent = allFolders.find(f => f.name === 'PUSTAKA' && (!(f.parentId || f.parent_id) || [0, '0', 'null'].includes(f.parentId || f.parent_id)));

      if (!pustakaParent) {
        await api.createFolder({
          name: 'PUSTAKA',
          parent_id: null,
          privacy: 'public',
          owner: 'System'
        });
        await fetchFolders();
        const updatedFolders = await api.getFolders();
        pustakaParent = updatedFolders.find(f => f.name === 'PUSTAKA');
      }

      const pustakaParentId = pustakaParent?.id || null;
      const folderName = guideTitle;

      const findInParent = (list, pId, name) => list.find(f => {
        const fParentId = f.parentId || f.parent_id;
        const isRootF = !fParentId || [0, '0', 'null'].includes(fParentId);
        const targetParentId = (!pId || pId === 'null' || pId === 0 || pId === '0') ? null : String(pId);
        if (targetParentId === null) return isRootF && f.name === name;
        return String(fParentId) === targetParentId && f.name === name;
      });

      let folder = findInParent(allFolders, pustakaParentId, folderName) ||
        (oldTitle ? findInParent(folders, pustakaParentId, oldTitle) : null);

      // Migrasi jika folder panduan terlanjur ada di root
      if (!folder && pustakaParentId) {
        let rootFolder = findInParent(allFolders, null, folderName);
        if (!rootFolder) {
          const allFolders = await api.getFolders();
          rootFolder = findInParent(allFolders, null, folderName);
        }
        if (rootFolder) {
          await api.moveFolder(rootFolder.id, pustakaParentId);
          await fetchFolders();
          folder = rootFolder;
        }
      }

      // FORCE MOVE & RENAME: Pastikan nama sesuai dan berada di dalam PUSTAKA
      const currentParentId = folder?.parentId || folder?.parent_id;
      if (folder && (folder.name !== folderName || String(currentParentId) !== String(pustakaParentId))) {
        await api.updateFolder(folder.id, {
          name: folderName,
          parentId: pustakaParentId
        });
        await fetchFolders();
        folder = { ...folder, name: folderName };
      }

      if (!folder && pustakaParentId) {
        await api.createFolder({
          name: folderName,
          parent_id: pustakaParentId,
          privacy: 'public',
          owner: currentUser?.name || 'System'
        });
        await fetchFolders();
        const updatedFolders = await api.getFolders();
        folder = findInParent(updatedFolders, pustakaParentId, folderName);
      }

      return folder?.id || null;
    } catch (err) {
      console.error("Pustaka folder sync failed:", err);
      return null;
    }
  };

  const syncSopFolder = async (sopTitle, oldTitle = null) => {
    if (!sopTitle) return null;
    try {
      const allFolders = await api.getFolders();

      let sopParent = allFolders.find(f => f.name === 'SOP' && (!(f.parentId || f.parent_id) || [0, '0', 'null'].includes(f.parentId || f.parent_id)));

      if (!sopParent) {
        await api.createFolder({ name: 'SOP', parent_id: null, privacy: 'public', owner: 'System' });
        await fetchFolders();
        const updated = await api.getFolders();
        sopParent = updated.find(f => f.name === 'SOP');
      }

      const sopParentId = sopParent?.id || null;
      const findInParent = (list, pId, name) => list.find(f => {
        const fParentId = f.parentId || f.parent_id;
        const isRootF = !fParentId || [0, '0', 'null'].includes(fParentId);
        const targetParentId = (!pId || pId === 'null' || pId === 0 || pId === '0') ? null : String(pId);
        if (targetParentId === null) return isRootF && f.name === name;
        return String(fParentId) === targetParentId && f.name === name;
      });

      let folder = findInParent(allFolders, sopParentId, sopTitle) ||
        (oldTitle ? findInParent(folders, sopParentId, oldTitle) : null);

      const currentParentId = folder?.parentId || folder?.parent_id;
      if (folder && (folder.name !== sopTitle || String(currentParentId) !== String(sopParentId))) {
        await api.updateFolder(folder.id, {
          name: sopTitle,
          parentId: sopParentId
        });
        await fetchFolders();
        folder = { ...folder, name: sopTitle };
      }

      if (!folder && sopParentId) {
        await api.createFolder({
          name: sopTitle,
          parentId: sopParentId,
          privacy: 'public',
          owner: currentUser?.name || 'System'
        });
        await fetchFolders();
        const updatedFolders = await api.getFolders();
        folder = findInParent(updatedFolders, sopParentId, sopTitle);
      }

      return folder?.id || null;
    } catch (err) {
      console.error("SOP folder sync failed:", err);
      return null;
    }
  };

  const syncApprovalFolder = async (approvalTitle, status = 'ACTIVE') => {
    if (!approvalTitle) return null;
    try {
      // 1. Cari atau Buat folder sistem "ApprovalDoc" di Root
      let approvalParent = folders.find(f => f.name === 'ApprovalDoc' && (!(f.parentId || f.parent_id) || [0, '0', 'null'].includes(f.parentId || f.parent_id)));
      if (!approvalParent) {
        const allFolders = await api.getFolders();
        approvalParent = allFolders.find(f => f.name === 'ApprovalDoc' && (!(f.parentId || f.parent_id) || [0, '0', 'null'].includes(f.parentId || f.parent_id)));
      }

      if (!approvalParent) {
        await api.createFolder({
          name: 'ApprovalDoc',
          parent_id: null,
          privacy: 'public',
          owner: 'System'
        });
        await fetchFolders();
        const updatedFolders = await api.getFolders();
        approvalParent = updatedFolders.find(f => f.name === 'ApprovalDoc');
      }

      const approvalParentId = approvalParent?.id || null;
      const folderName = approvalTitle;

      const findInParent = (list, pId, name) => list.find(f => {
        const fParentId = f.parentId || f.parent_id;
        const isRootF = !fParentId || [0, '0', 'null'].includes(fParentId);
        const targetParentId = (!pId || pId === 'null' || pId === 0 || pId === '0') ? null : String(pId);
        if (targetParentId === null) return isRootF && f.name === name;
        return String(fParentId) === targetParentId && f.name === name;
      });

      let folder = findInParent(folders, approvalParentId, folderName);
      if (!folder) {
        const allFolders = await api.getFolders();
        folder = findInParent(allFolders, approvalParentId, folderName);
      }

      if (!folder && approvalParentId && status === 'ACTIVE') {
        await api.createFolder({
          name: folderName,
          parent_id: approvalParentId,
          privacy: 'public',
          owner: currentUser?.name || 'System'
        });
        await fetchFolders();
        const updatedFolders = await api.getFolders();
        folder = findInParent(updatedFolders, approvalParentId, folderName);
      }

      return folder?.id || null;
    } catch (err) {
      console.error("Approval folder sync failed:", err);
      return null;
    }
  };

  // --- PERMISSIONS HELPERS ---
  const hasPermission = (moduleId, action = 'view') => {
    return checkPermission(currentUser, roles, moduleId, action);
  };

  // --- HELPERS (RESTORED) ---

  const addLog = async (user, action, details) => {
    if (!currentUser && user !== 'Admin') {
      console.warn("addLog: Skipping log creation for unauthenticated user.");
      return;
    }
    try {
      await api.createLog({ user, action, details });
      const updatedLogs = await api.getLogs();
      setLogs(updatedLogs);
    } catch (error) {
      console.error("Failed to add log:", error);
    }
  };

  const createHistoryItem = (action, note) => ({
    id: Date.now(),
    timestamp: new Date().toISOString(),
    action,
    note,
    user: currentUser?.name || 'Admin'
  });

  const docStats = useMemo(() => {
    if (!Array.isArray(docList)) return { totalDocs: 0, totalRevisions: 0, totalSizeMB: '0' };
    const totalDocs = docList.length;
    const totalRevisions = docList.reduce((acc, doc) => acc + (doc.versionsHistory?.length || 0), 0);
    const totalSizeMB = docList.reduce((acc, doc) => acc + parseFloat(doc.size || '0'), 0);
    return { totalDocs, totalRevisions, totalSizeMB: totalSizeMB.toFixed(1) };
  }, [docList]);

  // --- AUTH HANDLERS ---

  const handleLogin = async (username, password, onError) => {
    try {
      // Handle Guest Login: Jika username & password kosong, gunakan akun 'viewer' default
      if (!username && !password) {
        username = 'viewer';
        password = 'viewer123';
      }

      const user = await api.login(username, password);
      setCurrentUser(user);
      localStorage.setItem('archive_user', JSON.stringify(user));
      addLog(user.name, 'Login', 'User logged in');
    } catch (error) {
      if (onError) onError(error.message);
    }
  };

  const handleLogout = () => {
    logout();
    addLog(currentUser?.name, 'Logout', 'User logged out');
  };

  const handleUpdateProfile = (updatedUser) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('archive_user', JSON.stringify(updatedUser));
    // Update users list if needed
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
  };

  // --- WAREHOUSE HANDLERS (API INTEGRATED) ---

  const handleSlotClick = (slot) => {
    if (!slot) return;

    console.log("Slot Clicked:", slot.id, "Status:", slot.status);
    console.log("Slot BoxData:", slot.boxData ? JSON.stringify(slot.boxData) : 'null');

    setSelectedSlotId(slot.id);
    let data = slot.box_data || slot.boxData;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (e) { data = null; }
    }

    if (slot.status === 'EMPTY' || !data) {
      setBoxForm({ boxId: `BOX-${new Date().getFullYear()}-${String(slot.id).padStart(3, '0')}`, ordners: [] });
    } else {
      setBoxForm({ boxId: data.id || slot.box_id || '', ordners: data.ordners || [] });
    }
    setNewOrdner({ noOrdner: '', period: '' });
    setNewInvoice({
      invoiceNo: '',
      vendor: '',
      paymentDate: '',
      taxInvoiceNo: '',
      specialNote: '',
      file: null,
      fileName: '',
      ocrContent: '',
      isProcessing: false
    });
    setExpandedOrdnerIds(slot.status !== 'EMPTY' && slot.boxData?.ordners ? slot.boxData.ordners.map(o => o.id) : []);
    setEditingItem(null);
    setShowMoveInput(false);
    setMoveTargetSlot('');

    setShowExternalForm(false);
    setExternalDate('');
    setModalTab('details');
    setIsModalOpen(true);
  };

  // --- SYNC BOX FORM WITH INVENTORY UPDATE (Auto-Refresh OCR) ---
  useEffect(() => {
    if (selectedSlotId && inventory.length > 0) {
      const currentSlot = inventory.find(s => s.id === selectedSlotId);
      let data = currentSlot?.box_data || currentSlot?.boxData;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { data = null; }
      }

      if (data) {
        // Hydrate invoices with real-time status from docList
        const hydratedOrdners = (data.ordners || []).map(ord => ({
          ...ord,
          invoices: (ord.invoices || []).map(inv => {
            // Cari dokumen asli di docList untuk mendapatkan status & ocrContent terbaru
            const realDoc = docList.find(d => d.id === inv.id);
            if (realDoc) {
              return {
                ...inv,
                status: realDoc.status || inv.status,
                ocrContent: realDoc.ocrContent || inv.ocrContent
              };
            }
            return inv;
          })
        }));

        setBoxForm(prev => ({
          ...prev,
          ordners: hydratedOrdners
        }));
      }
    }
  }, [inventory, selectedSlotId, docList]); // Tambahkan docList sebagai dependency

  const addOrdner = () => {
    if (!newOrdner.noOrdner || !newOrdner.period) return;
    if (editingItem && editingItem.type === 'ordner') {
      setBoxForm(prev => ({ ...prev, ordners: prev.ordners.map(o => o.id === editingItem.id ? { ...o, noOrdner: newOrdner.noOrdner, period: newOrdner.period } : o) }));
      setEditingItem(null);
    } else {
      const ordId = Date.now();
      setBoxForm(prev => ({ ...prev, ordners: [...prev.ordners, { ...newOrdner, id: ordId, invoices: [] }] }));
      setExpandedOrdnerIds(prev => [...prev, ordId]);
    }
    setNewOrdner({ noOrdner: '', period: '' });
  };

  const editOrdner = (ord) => { setNewOrdner({ noOrdner: ord.noOrdner, period: ord.period }); setEditingItem({ type: 'ordner', id: ord.id }); };
  const removeOrdner = (id) => { if (window.confirm("Hapus ordner?")) setBoxForm(prev => ({ ...prev, ordners: prev.ordners.filter(o => o.id !== id) })); };

  const addInvoice = (ordnerId) => {
    if (!newInvoice.invoiceNo || !newInvoice.vendor) return;

    const invoicePayload = {
      invoiceNo: newInvoice.invoiceNo,
      vendor: newInvoice.vendor,
      paymentDate: newInvoice.paymentDate,
      taxInvoiceNo: newInvoice.taxInvoiceNo,
      specialNote: newInvoice.specialNote,
      file: newInvoice.file,
      fileName: newInvoice.fileName,
      ocrContent: newInvoice.ocrContent,
      rawFile: newInvoice.rawFile // Pass raw file
    };

    if (editingItem && editingItem.type === 'invoice') {
      setBoxForm(prev => ({ ...prev, ordners: prev.ordners.map(o => o.id === ordnerId ? { ...o, invoices: o.invoices.map(i => i.id === editingItem.id ? { ...i, ...invoicePayload, id: i.id } : i) } : o) }));
      setEditingItem(null);
    } else {
      setBoxForm(prev => ({ ...prev, ordners: prev.ordners.map(o => o.id === ordnerId ? { ...o, invoices: [...o.invoices, { ...invoicePayload, id: Date.now() }] } : o) }));
    }
    setNewInvoice({
      invoiceNo: '',
      vendor: '',
      paymentDate: '',
      taxInvoiceNo: '',
      specialNote: '',
      file: null,
      fileName: '',
      ocrContent: '',
      isProcessing: false,
      rawFile: null
    });
  };

  const editInvoice = (inv, ordId) => {
    setNewInvoice({
      invoiceNo: inv.invoiceNo,
      vendor: inv.vendor,
      paymentDate: inv.paymentDate || '',
      taxInvoiceNo: inv.taxInvoiceNo || '',
      specialNote: inv.specialNote || '',
      file: inv.file || null,
      fileName: inv.fileName || '',
      ocrContent: inv.ocrContent || '',
      isProcessing: false,
      rawFile: null
    });
    setEditingItem({ type: 'invoice', id: inv.id, parentId: ordId });
  };
  const removeInvoice = (ordnerId, invoiceId) => { if (window.confirm("Hapus invoice?")) setBoxForm(prev => ({ ...prev, ordners: prev.ordners.map(o => o.id === ordnerId ? { ...o, invoices: o.invoices.filter(i => i.id !== invoiceId) } : o) })); };

  const handleSaveBox = async () => {
    // Validation: Unique Box ID Check
    const activeDuplicate = inventory.find(slot => {
      const data = slot.box_data || slot.boxData;
      return data?.id === boxForm.boxId && slot.id !== selectedSlotId;
    });
    const externalDuplicate = externalItems.find(item => item.boxId === boxForm.boxId);

    if (activeDuplicate) {
      toast.error(`Box ID "${boxForm.boxId}" sudah ada di Slot #${activeDuplicate.id}. ID Box harus unik.`);
      return;
    }
    if (externalDuplicate) {
      toast.error(`Box ID "${boxForm.boxId}" sudah ada di Indoarsip/Eksternal. ID Box harus unik.`);
      return;
    }

    if (!selectedSlotId) return;
    const currentSlot = inventory.find(s => Number(s.id) === Number(selectedSlotId));
    if (!currentSlot) return;

    // VALIDATION: Cegah menimpa slot yang sudah ada isinya dengan Box ID berbeda
    const currentData = currentSlot.box_data || currentSlot.boxData;
    if (currentSlot.status !== 'EMPTY' && currentData?.id && currentData.id !== boxForm.boxId) {
      toast.error(`Gagal: Slot #${selectedSlotId} sudah berisi Box "${currentData.id}". Kosongkan slot terlebih dahulu untuk mengganti Box.`);
      return;
    }

    // --- BACKGROUND BACKGROUND PROCESS START ---
    const runBackgroundSave = async (slotId, currentSlot, capturedBoxForm, capturedCurrentUser) => {
      const boxId = capturedBoxForm.boxId;
      const mainToastId = toast.loading(`Menyimpan Kardus ${boxId}...`);

      try {
        // --- SYNC FOLDER (Get or Create Box Folder) ---
        let currentData = currentSlot.box_data || currentSlot.boxData;
        if (typeof currentData === 'string') {
          try { currentData = JSON.parse(currentData); } catch (e) { currentData = null; }
        }
        const oldBoxId = currentData?.id || currentSlot.box_id;

        const isNew = (currentSlot.status || 'EMPTY').toUpperCase() === 'EMPTY';
        const boxFolderId = await syncBoxFolder(boxId, isNew ? 'STORED' : 'UPDATED', oldBoxId);
        // --- END SYNC FOLDER ---

        // --- BATCH UPLOAD START ---
        let updatedOrdners = [...capturedBoxForm.ordners];
        let uploadCount = 0;

        for (let oIdx = 0; oIdx < updatedOrdners.length; oIdx++) {
          let ordner = updatedOrdners[oIdx];
          if (ordner.invoices && ordner.invoices.length > 0) {
            let updatedInvoices = [...ordner.invoices];

            for (let iIdx = 0; iIdx < updatedInvoices.length; iIdx++) {
              let inv = updatedInvoices[iIdx];

              if (inv.rawFile) {
                const fileType = inv.rawFile.type;
                const fileSize = (inv.rawFile.size / 1024).toFixed(2) + ' KB';

                // Generate unique ID untuk menghubungkan invoice di box_data dengan tabel documents
                const docId = `DOC-INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

                // Sinkronisasi lampiran invoice ke tabel documents (Upload & Create dalam satu langkah)
                // Ini mencegah double upload (1 di root, 1 di folder DataBox)
                const docPayload = {
                  id: docId,
                  title: inv.fileName || `Invoice ${inv.invoiceNo}`,
                  forceOcr: true, // Aktifkan mode scan untuk PDF image-only
                  type: fileType,
                  size: fileSize,
                  uploadDate: new Date().toISOString(),
                  folderId: String(boxFolderId || ''),
                  owner: capturedCurrentUser?.name || 'Admin',
                  status: 'waiting', // Masuk antrean FIFO (1 per 1)
                  ocrContent: '',
                  file: inv.rawFile, // Kirim file mentah untuk diupload oleh createDocument
                  // Metadata for AI Search
                  invoiceNo: inv.invoiceNo,
                  vendor: inv.vendor,
                  taxInvoiceNo: inv.taxInvoiceNo,
                  specialNote: inv.specialNote
                };

                try {
                  const createdDoc = await createDocument(docPayload);

                  if (createdDoc) {
                    // Update invoice dengan URL asli dari dokumen yang baru dibuat
                    updatedInvoices[iIdx] = {
                      ...inv,
                      id: docId,
                      status: 'waiting',
                      file: createdDoc.url || createdDoc.file_url,
                      ocrContent: '',
                      rawFile: undefined // Bersihkan file mentah setelah upload sukses
                    };
                    inv = updatedInvoices[iIdx];
                    uploadCount++;
                  }
                } catch (docErr) {
                  console.error(`[BackgroundSave] Gagal upload/sinkronisasi dokumen ${inv.invoiceNo}:`, docErr);
                  throw new Error(`Gagal memproses invoice ${inv.invoiceNo}: ${docErr.message}`);
                }
              }
            }
            updatedOrdners[oIdx] = { ...ordner, invoices: updatedInvoices };
          }
        }

        if (uploadCount > 0) {
          console.log(`Berhasil mengupload ${uploadCount} dokumen baru.`);
          await fetchDocs(); // Segera update docList agar status 'waiting' muncul di UI
          // fetchDocs is handled by createDocument store action
        }
        // --- BATCH UPLOAD END ---

        let newHistory = isNew
          ? [createHistoryItem('CREATED', `Kardus baru: ${boxId}`), createHistoryItem('STORED', `Masuk Slot #${slotId}`)]
          : [createHistoryItem('UPDATED', oldBoxId !== boxId ? `Rename: ${oldBoxId} -> ${boxId}` : `Update data ${boxId}`)];

        const finalSlot = {
          ...currentSlot,
          status: (currentSlot.status || 'EMPTY').toUpperCase() === 'EMPTY' ? 'STORED' : currentSlot.status.toUpperCase(),
          lastUpdated: new Date().toISOString(),
          history: [...(currentSlot.history || []), ...newHistory],
          box_id: boxId,
          box_data: { id: boxId, ordners: updatedOrdners }
        };

        await updateInventory(slotId, finalSlot);
        await fetchInventory(); // Refresh UI dengan data final (termasuk URL file)
        addLog(capturedCurrentUser?.name || 'Admin', isNew ? 'Masuk Barang' : 'Update Barang', `Kardus ${boxId} di Slot #${slotId}`);
        updateToast(mainToastId, { message: isNew ? `Box ${boxId} berhasil disimpan!` : `Box ${boxId} berhasil diperbarui!`, type: 'success' });

      } catch (perr) {
        console.error("Background Save Error:", perr);
        updateToast(mainToastId, { message: `Gagal menyimpan box ${boxId}: ${perr.message}`, type: 'error' });
      }
    };

    // 1. Jalankan Simpan Metadata Awal (Skeleton) & Tutup Modal
    const isNewInitial = (currentSlot.status || 'EMPTY').toUpperCase() === 'EMPTY';
    const boxId = boxForm.boxId;
    const skeletonSlot = {
      ...currentSlot,
      status: isNewInitial ? 'STORED' : currentSlot.status.toUpperCase(),
      box_id: boxId,
      box_data: {
        id: boxId,
        ordners: boxForm.ordners.map(o => ({
          ...o,
          invoices: o.invoices.map(i => ({ ...i, status: i.rawFile ? 'waiting' : (i.status || 'completed'), rawFile: undefined })) // Set status awal 'waiting'
        }))
      }
    };

    try {
      // Reserved the slot immediately so UI reflects the new Box ID
      await updateInventory(selectedSlotId, skeletonSlot);

      // Tutup modal agar user bisa lanjut kerja
      setIsModalOpen(false);

      // Jalankan proses berat di latar belakang
      runBackgroundSave(selectedSlotId, currentSlot, { ...boxForm }, { ...currentUser });

    } catch (err) {
      const msg = await parseApiError(err);
      toast.error("Gagal inisialisasi penyimpanan: " + msg);
    }
  };

  const handleStatusChange = async (newStatus, label) => {
    if (!selectedSlotId) return;
    const slotIndex = selectedSlotId - 1;
    const currentSlot = inventory[slotIndex];

    const previousInventory = [...inventory];

    // --- SYNC FOLDER (Rename jika status berubah) ---
    if (currentSlot.boxData) {
      await syncBoxFolder(currentSlot.boxData.id, newStatus);
    }

    const updatedSlot = {
      ...currentSlot,
      status: newStatus,
      lastUpdated: new Date().toISOString(),
      history: [...(currentSlot.history || []), createHistoryItem(newStatus, `Status: ${label}`)]
    };

    try {
      await updateInventory(selectedSlotId, updatedSlot);
      addLog(currentUser?.name || 'Admin', 'Ubah Status', `Slot #${selectedSlotId} status: ${label}`);
      toast.success(`Status berhasil diubah ke ${label}`);
      setIsModalOpen(false);
    } catch (error) {
      setInventory(previousInventory);
      const msg = await parseApiError(error);
      toast.error("Gagal update status: " + msg);
    }
  };

  const handleMoveBox = async () => {
    const targetId = parseInt(moveTargetSlot);
    if (!targetId || targetId < 1 || targetId > TOTAL_SLOTS || inventory[targetId - 1].status !== 'EMPTY') { alert("Slot tujuan tidak valid/penuh."); return; }

    const sourceSlot = inventory[selectedSlotId - 1];
    const targetSlot = inventory[targetId - 1];

    const previousInventory = [...inventory];

    // --- SYNC FOLDER (Rename karena pindah slot) ---
    if (sourceSlot.boxData) {
      await syncBoxFolder(sourceSlot.boxData.id, 'MOVED');
    }

    try {
      // Optimized: Perform move on server-side to avoid sending large boxData payloads
      await moveInventory(selectedSlotId, targetId, currentUser?.name || 'Admin');

      addLog(currentUser?.name || 'Admin', 'Pindah Rak', `Kardus ${sourceSlot.boxData.id} -> Slot ${targetId}`);
      toast.success(`Box berhasil dipindahkan ke Slot #${targetId}`);
      setIsModalOpen(false);
    } catch (error) {
      setInventory(previousInventory);
      toast.error("Gagal memindahkan box: " + error.message);
    }
  };

  const handleExternalTransfer = async (destination, date) => {
    if (!selectedSlotId) return;
    if (!window.confirm(`Kirim ke ${destination} pada tanggal ${date}?`)) return;
    const currentSlot = inventory[selectedSlotId - 1];

    const previousInventory = [...inventory];
    const previousExternal = [...externalItems];

    try {
      // 1. Save to External Items
      if (currentSlot.boxData) {
        await syncBoxFolder(currentSlot.boxData.id, 'EXTERNAL');
        await createExternalItem({
          boxId: currentSlot.boxData.id,
          destination: destination,
          sentDate: date ? new Date(date).toISOString() : new Date().toISOString(),
          sender: currentUser?.name || 'Admin',
          boxData: currentSlot.boxData,
          history: currentSlot.history || []
        });
      }

      // 2. Clear Internal Slot
      const updatedSlot = { ...currentSlot, status: 'EMPTY', boxData: null, lastUpdated: new Date().toISOString(), history: [...(currentSlot.history || []), createHistoryItem(destination === 'Indoarsip' ? 'EXTERNAL' : 'REMOVED', `Dikirim ke ${destination} (${date})`)] };

      await updateInventory(selectedSlotId, updatedSlot);
      addLog(currentUser?.name || 'Admin', 'Barang Keluar', `Kardus ke ${destination}`);
      toast.success(`Berhasil dikirim ke ${destination}`);
      setIsModalOpen(false);
      setShowExternalForm(false);
    } catch (error) {
      setInventory(previousInventory);
      setExternalItems(previousExternal);
      toast.error("Gagal transfer keluar: " + error.message);
    }
  };

  const handleRestoreExternal = async () => {
    if (!restoreTargetSlot) { toast.error("Pilih slot tujuan!"); return; }
    const targetId = parseInt(restoreTargetSlot);
    if (isNaN(targetId) || targetId < 1 || targetId > TOTAL_SLOTS) { toast.error("Slot tidak valid!"); return; }

    const targetSlot = inventory[targetId - 1];
    if (targetSlot.status !== 'EMPTY') { toast.error(`Slot #${targetId} tidak kosong!`); return; }

    if (!window.confirm(`Kembalikan Box ${selectedExternalItem.boxId} ke Slot #${targetId}?`)) return;

    const previousInventory = [...inventory];
    const previousExternal = [...externalItems];

    try {
      // Rename folder kembali ke nama asli (tanpa status/timestamp)
      await syncBoxFolder(selectedExternalItem.boxId, 'STORED');

      // 1. Update Inventory Slot
      const updatedSlot = {
        ...targetSlot,
        status: 'STORED',
        boxData: { ...selectedExternalItem.boxData }, // Restore box data
        lastUpdated: new Date().toISOString(),
        history: [...(selectedExternalItem.history || []), createHistoryItem('RESTORED', `Dikembalikan dari ${selectedExternalItem.destination}`)]
      };

      await updateInventory(targetId, updatedSlot);

      // 2. Delete from External (handled within updateInventory refresh if needed, but here we call it explicitly through the store action)
      await deleteExternalItem(selectedExternalItem.id);

      addLog(currentUser?.name || 'Admin', 'Barang Masuk (Restore)', `Restore ${selectedExternalItem.boxId} dari ${selectedExternalItem.destination}`);
      toast.success(`Box ${selectedExternalItem.boxId} berhasil dikembalikan ke Slot #${targetId}`);

      setShowRestoreForm(false);
      setRestoreTargetSlot('');
      setSelectedExternalItem(null);
      setIsModalOpen(false); // Close generic modal if open?
    } catch (error) {
      setInventory(previousInventory);
      setExternalItems(previousExternal);
      toast.error("Gagal restore: " + error.message);
    }
  };

  const handleViewExternal = (item) => {
    setBoxForm({ boxId: item.boxId, ordners: item.boxData?.ordners || [] });
    setSelectedExternalItem(item); // Set this so we can access history
    setModalTab('details');
    setSelectedSlotId(null);
    setEditingItem(null);
    setExpandedOrdnerIds(item.boxData?.ordners?.map(o => o.id) || []);
    setIsModalOpen(true);
  };

  const handleEmptySlot = async () => {
    if (selectedSlotId) {
      if (!window.confirm("Kosongkan slot? Data kardus akan dihapus.")) return;
      const currentSlot = inventory[selectedSlotId - 1];

      const previousInventory = [...inventory];

      if (currentSlot.boxData) {
        await syncBoxFolder(currentSlot.boxData.id, 'REMOVED');
      }

      const updatedSlot = { ...currentSlot, status: 'EMPTY', boxData: null, lastUpdated: new Date().toISOString(), history: [...(currentSlot.history || []), createHistoryItem('REMOVED', `Dikosongkan manual`)] };

      try {
        await updateInventory(selectedSlotId, updatedSlot);
        addLog(currentUser?.name || 'Admin', 'Kosongkan Slot', `Slot #${selectedSlotId}`);
        toast.success("Slot berhasil dikosongkan.");
        setIsModalOpen(false);
      } catch (error) {
        setInventory(previousInventory);
        toast.error("Gagal mengosongkan slot: " + error.message);
      }
    } else if (selectedExternalItem) {
      if (!window.confirm("Hapus data box ini secara permanen dari Indoarsip?")) return;
      const previousExternal = [...externalItems];
      setExternalItems(externalItems.filter(e => e.id !== selectedExternalItem.id));

      try {
        await deleteExternalItem(selectedExternalItem.id);
        addLog(currentUser?.name || 'Admin', 'Hapus Permanen', `Box ${selectedExternalItem.boxId} dihapus dari Eksternal`);
        toast.success("Data box eksternal berhasil dihapus permanen.");
        setIsModalOpen(false);
      } catch (error) {
        setExternalItems(previousExternal);
        toast.error("Gagal menghapus: " + error.message);
      }
    }
  };

  const handlePrintLabel = (boxId) => {
    addLog(currentUser?.name, 'Cetak Label', `Mencetak label untuk Kardus: ${boxId}`);
    toast.info(`Label untuk ${boxId} telah dikirim ke antrean printer.`);
  };

  const handleTogglePermission = (modId, action) => {
    const currentPerms = roleForm.permissions[modId] || [];
    const newPerms = currentPerms.includes(action)
      ? currentPerms.filter(a => a !== action)
      : [...currentPerms, action];

    setRoleForm({
      ...roleForm,
      permissions: {
        ...roleForm.permissions,
        [modId]: newPerms
      }
    });
  };

  const handleBulkPermission = (type, value) => {
    const actions = ['view', 'create', 'edit', 'delete'];
    const modules = Object.values(APP_MODULES).map(m => m.id);
    let nextPermissions = { ...roleForm.permissions };

    if (type === 'all') {
      const isAllSelected = modules.every(mId =>
        actions.every(a => (nextPermissions[mId] || []).includes(a))
      );
      modules.forEach(mId => {
        nextPermissions[mId] = isAllSelected ? [] : [...actions];
      });
    } else if (type === 'module') {
      const isModuleSelected = actions.every(a => (nextPermissions[value] || []).includes(a));
      nextPermissions[value] = isModuleSelected ? [] : [...actions];
    } else if (type === 'action') {
      const isActionSelected = modules.every(mId => (nextPermissions[mId] || []).includes(value));
      modules.forEach(mId => {
        const current = nextPermissions[mId] || [];
        nextPermissions[mId] = isActionSelected
          ? current.filter(a => a !== value)
          : Array.from(new Set([...current, value]));
      });
    }

    setRoleForm({ ...roleForm, permissions: nextPermissions });
  };

  const handleSaveTaxForm = async (e) => {
    e.preventDefault();
    try {
      await api.saveTaxSummary(taxForm);
      setTaxSummaries(await api.getTaxSummaries());
      setShowTaxForm(false);
      addLog(currentUser?.name, 'Update Pajak', `${taxForm.month} ${taxForm.year}`);
    } catch (e) { alert(e.message); }
  };



  const handleExcelImport = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    let totalImported = 0;
    let totalSkipped = 0;
    const tid = toast.loading(`Menyiapkan import ${files.length} file...`);

    for (const file of files) {
      await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            // 1. Grouping logic: Gabungkan invoice yang memiliki Slot & Box ID yang sama
            const groupedBySlot = {};
            jsonData.forEach((row, rowIndex) => {
              const findVal = (keys) => {
                const rowKeys = Object.keys(row);
                const foundKey = rowKeys.find(rk => {
                  const cleanedRk = rk.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                  const cleanedKeys = keys.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
                  return cleanedKeys.includes(cleanedRk);
                });
                return foundKey ? row[foundKey] : null;
              };

              const sIdVal = findVal(['No Slot', 'Slot', 'No. Slot', 'slot_no', 'No_Slot', 'SlotID']);
              const bIdVal = findVal(['No Kardus', 'Box ID', 'No. Kardus', 'box_id', 'No_Kardus', 'Kardus ID', 'BoxID']);

              const sId = parseInt(sIdVal);
              const bId = bIdVal;

              if (!sId || !bId) return;

              if (!groupedBySlot[sId]) {
                groupedBySlot[sId] = { boxId: bId, ordnerMap: {} };
              }

              const oNo = findVal(['No Ordner', 'Ordner', 'No. Ordner']) || 'Imported';
              const oPer = findVal(['Periode', 'Period', 'Tahun']) || 'Imported';

              if (!groupedBySlot[sId].ordnerMap[oNo]) {
                groupedBySlot[sId].ordnerMap[oNo] = { noOrdner: oNo, period: oPer, invoices: [] };
              }

              const invNo = findVal(['No Invoice', 'Invoice', 'No. Invoice']);
              if (invNo) {
                groupedBySlot[sId].ordnerMap[oNo].invoices.push({
                  id: Date.now() + Math.random(),
                  invoiceNo: invNo,
                  vendor: findVal(['Vendor', 'Supplier', 'Nama Vendor']) || '-',
                  paymentDate: findVal(['Tgl Pembayaran', 'Tanggal', 'Date']) || '',
                  taxInvoiceNo: findVal(['No Faktur Pajak', 'No Faktur', 'Faktur', 'Tax Invoice No']) || '',
                  specialNote: findVal(['Keterangan Kusus', 'Keterangan', 'Note', 'Special Note']) || ''
                });
              }
            });
            const groupedEntries = Object.entries(groupedBySlot);
            if (groupedEntries.length === 0) {
              totalSkipped++;
              resolve();
              return;
            }

            let actualFolders = await api.getFolders();
            let importedCount = 0;
            let skippedLogs = [];

            for (let i = 0; i < groupedEntries.length; i++) {
              const [sIdStr, data] = groupedEntries[i];
              const currentProcessingSlot = parseInt(sIdStr);

              if (i % 5 === 0 || i === groupedEntries.length - 1) {
                updateToast(tid, { message: `File: ${file.name} - Mengimport ${i + 1}/${groupedEntries.length} box...` });
              }

              const currentSlot = inventory.find(s => Number(s.id) === currentProcessingSlot);
              if (!currentSlot || (currentSlot.status !== 'EMPTY' && currentSlot.boxData !== null)) {
                skippedLogs.push(`Slot #${currentProcessingSlot} dilewati.`);
                continue;
              }

              const ordners = Object.values(data.ordnerMap).map(o => ({ ...o, id: Math.floor(Date.now() + Math.random() * 1000000) }));
              const boxData = { id: data.boxId, ordners };

              await syncBoxFolder(data.boxId, 'IMPORTED', null, actualFolders);
              const updatedSlot = {
                ...currentSlot,
                status: 'IMPORTED',
                box_id: data.boxId,
                box_data: boxData,
                lastUpdated: new Date().toISOString(),
                history: [...(Array.isArray(currentSlot.history) ? currentSlot.history : []), createHistoryItem('IMPORTED', `Import: ${data.boxId}`)]
              };

              await api.updateInventory(currentProcessingSlot, updatedSlot);
              importedCount++;
            }
            totalImported += importedCount;
            resolve();
          } catch (error) {
            console.error(error);
            resolve();
          }
        };
        reader.readAsArrayBuffer(file);
      });
    }

    updateToast(tid, { type: 'success', message: `Import Selesai: ${totalImported} box berhasil dari ${files.length} file.` });
    await fetchInventory();
    addLog(currentUser?.name, 'Import Excel Multiple', `Import ${totalImported} box dari ${files.length} file`);
  };

  const handleInvoiceFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Remove 10MB limit check as server supports 50MB
    // if (file.size > 10 * 1024 * 1024) { ... }

    // DEFER UPLOAD: Store raw file for upload on "Simpan Data"
    setNewInvoice(prev => ({
      ...prev,
      isProcessing: false,
      fileName: file.name,
      file: null, // Clear old URL if any
      rawFile: file // Store File object
    }));
  };

  const handleViewInvoice = async (inv) => {
    // Ambil data terbaru dari server untuk memastikan ocrContent terbaru muncul
    let fullInv = inv;
    if (inv.id) {
      try {
        const fetched = await api.getDocumentById(inv.id);
        if (fetched) fullInv = { ...inv, ...fetched };
      } catch (e) { console.warn("Gagal fetch detail invoice", e); }
    }

    setSelectedInvoice(fullInv);
    setModalTab('invoice-detail');
    setIsModalOpen(true);

    // Robust Preview Logic
    setIsGeneratingPreview(true);
    setPdfBlobUrl(null);
    setPreviewHtml('');

    const content = fullInv.file || fullInv.url;
    const type = String(fullInv.type || '').toLowerCase();
    const name = String(fullInv.fileName || fullInv.title || '').toLowerCase();
    const isPdf = type.includes('pdf') || name.endsWith('.pdf') || (typeof content === 'string' && (content.match(/\.pdf$/i) || content.startsWith('data:application/pdf')));

    console.log('[Preview] handleViewInvoice:', { type, name, isPdf, hasContent: !!content });

    if (content && typeof content === 'string') {
      try {
        let buffer;
        const normalizedUrl = getFullUrl(content);
        console.log('[Preview] Normalized URL:', normalizedUrl);

        if (normalizedUrl.startsWith('http') || normalizedUrl.startsWith('/') || normalizedUrl.startsWith('blob:')) {
          console.log('[Preview] Fetching buffer from URL...');
          const response = await fetch(normalizedUrl, {
            credentials: 'include'
          });
          if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
          buffer = await response.arrayBuffer();
          console.log('[Preview] Buffer obtained, size:', buffer.byteLength);
        } else if (content.includes('base64,') || content.length > 200) {
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

        if (buffer) {
          if (isPdf) {
            setPdfBlobUrl(buffer);
          } else if (type.includes('word') || name.endsWith('.docx')) {
            if (buffer.byteLength > 10 * 1024 * 1024) {
              setPreviewHtml('<div class="p-10 text-center"><p class="text-slate-500 font-bold">Dokumen Word terlalu besar (>10MB) untuk diproses preview.</p><p class="text-sm text-slate-400 mt-2">Silakan unduh file untuk melihat isi lengkap.</p></div>');
            } else {
              const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
              setPreviewHtml(result.value);
            }
          } else if (type.includes('sheet') || type.includes('excel') || name.endsWith('.xlsx') || name.endsWith('.xls')) {
            const wb = XLSX.read(buffer, { type: 'array' });
            const firstSheet = wb.Sheets[wb.SheetNames[0]];
            setPreviewHtml(XLSX.utils.sheet_to_html(firstSheet));
          }
        }
      } catch (e) {
        console.error("Preview preparation error:", e);
      }
    }
    setIsGeneratingPreview(false);
  };

  const handleDownloadInvoice = (inv) => {
    console.log("Downloading Invoice:", inv.fileName, "URL:", inv.file);
    if (!inv.file) return alert("Tidak ada file lampiran.");
    try {
      const link = document.createElement('a');
      link.href = inv.file;
      link.download = inv.fileName || `Invoice-${inv.invoiceNo}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) { alert("Gagal download: " + e.message); }
  };

  const handleExportInventory = () => {
    // Flatten data logic
    const exportData = [];
    inventory.forEach(slot => {
      if (slot.status === 'EMPTY') {
        exportData.push({
          "No Slot": slot.id,
          "Status": "KOSONG",
          "No Kardus": "-",
          "No Ordner": "-",
          "No Invoice": "-",
          "Vendor": "-",
          "Tgl Pembayaran": "-"
        });
      } else if (slot.boxData) {
        if (slot.boxData.ordners && slot.boxData.ordners.length > 0) {
          slot.boxData.ordners.forEach(ord => {
            if (ord.invoices && ord.invoices.length > 0) {
              ord.invoices.forEach(inv => {
                exportData.push({
                  "No Slot": slot.id,
                  "Status": slot.status,
                  "No Kardus": slot.boxData.id,
                  "No Ordner": ord.noOrdner,
                  "Periode": ord.period,
                  "No Invoice": inv.invoiceNo,
                  "Vendor": inv.vendor,
                  "Tgl Pembayaran": inv.paymentDate || "-"
                });
              });
            } else {
              exportData.push({
                "No Slot": slot.id,
                "Status": slot.status,
                "No Kardus": slot.boxData.id,
                "No Ordner": ord.noOrdner,
                "Periode": ord.period,
                "No Invoice": "(Kosong)",
                "Vendor": "-",
                "Tgl Pembayaran": "-"
              });
            }
          });
        } else {
          exportData.push({
            "No Slot": slot.id,
            "Status": slot.status,
            "No Kardus": slot.boxData.id,
            "No Ordner": "(Kosong)",
            "No Invoice": "-",
            "Vendor": "-",
            "Tgl Pembayaran": "-"
          });
        }
      }
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Detail");
    XLSX.writeFile(wb, `Laporan_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
    addLog(currentUser?.name, 'Export Excel', 'Download laporan inventory info');
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        "No Slot": 1,
        "No Kardus": "BOX-2024-001",
        "Status": "TERISI",
        "No Ordner": "ORD-001",
        "Periode": "Jan 2024",
        "No Invoice": "INV/001",
        "Vendor": "Vendor A",
        "Tgl Pembayaran": "2024-01-31",
        "No Faktur Pajak": "010.000-24.00000001",
        "Keterangan Kusus": "Contoh keterangan kusus"
      },
      {
        "No Slot": 2,
        "No Kardus": "BOX-2024-002",
        "Status": "TERISI",
        "No Ordner": "",
        "Periode": "",
        "No Invoice": "",
        "Vendor": "",
        "Tgl Pembayaran": "",
        "No Faktur Pajak": "",
        "Keterangan Kusus": ""
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Template_Import_Arsip.xlsx");
  };

  // --- MASTER DATA HANDLERS ---

  const handleCreateUser = () => {
    setUserForm({ id: null, username: '', password: '', name: '', role: 'staff', department: '' });
    setModalTab('user-create');
    setIsModalOpen(true);
  };

  const handleEditUser = (user) => {
    setUserForm({ ...user, password: '' }); // Don't show password
    setModalTab('user-create'); // Reuse same form
    setIsModalOpen(true);
  };

  const handleSaveUser = async () => {
    try {
      const previousUsers = [...users];
      // Optimistic Update
      if (userForm.id) {
        setUsers(users.map(u => u.id === userForm.id ? { ...u, ...userForm } : u));
      } else {
        setUsers([...users, { ...userForm, id: Date.now().toString() }]);
      }

      setIsModalOpen(false);

      try {
        let res;
        if (userForm.id) {
          await api.updateUser(userForm.id, userForm);
        } else {
          res = await api.createUser(userForm);
          if (res && res.id) {
            const realId = res.id;
            setUsers(prev => prev.map(u => u.username === userForm.username ? { ...u, id: realId } : u));
          }
        }
        addLog(currentUser?.name, userForm.id ? 'Update User' : 'Create User', userForm.username);
      } catch (e) {
        setUsers(previousUsers);
        const msg = await parseApiError(e);
        toast.error("Gagal simpan user: " + msg);
      }
    } catch (e) {
      const msg = await parseApiError(e);
      alert(msg);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm("Hapus user ini?")) return;
    const previousUsers = [...users];
    setUsers(users.filter(u => u.id !== id));

    try {
      await api.deleteUser(id);
      addLog(currentUser?.name, 'Delete User', `ID ${id}`);
    } catch (e) {
      setUsers(previousUsers);
      const msg = await parseApiError(e);
      alert(msg);
    }
  };

  const handleEditDept = (dept) => {
    setDeptForm({ id: dept.id, name: dept.name });
    setModalTab('dept-form');
    setIsModalOpen(true);
  };

  const handleCreateDept = () => {
    setDeptForm({ id: null, name: '' });
    setModalTab('dept-form');
    setIsModalOpen(true);
  };

  const handleSaveDept = async () => {
    try {
      const previousDepts = [...departments];
      // Optimistic Update
      if (deptForm.id) {
        setDepartments(departments.map(d => d.id === deptForm.id ? { ...d, name: deptForm.name } : d));
      } else {
        setDepartments([...departments, { id: Date.now().toString(), name: deptForm.name }]);
      }

      setIsModalOpen(false);

      try {
        let res;
        if (deptForm.id) {
          await api.updateDepartment(deptForm.id, deptForm.name);
        } else {
          res = await api.createDepartment(deptForm.name);
          if (res && res.id) {
            const realId = res.id;
            setDepartments(prev => prev.map(d => d.name === deptForm.name ? { ...d, id: realId } : d));
          }
        }
      } catch (e) {
        setDepartments(previousDepts);
        const msg = await parseApiError(e);
        toast.error("Gagal simpan departemen: " + msg);
      }
    } catch (e) {
      const msg = await parseApiError(e);
      alert(msg);
    }
  };

  const handleDeleteDept = async (id) => {
    if (!window.confirm("Hapus dept?")) return;
    const previousDepts = [...departments];
    setDepartments(departments.filter(d => d.id !== id));
    try {
      await api.deleteDepartment(id);
    } catch (e) {
      setDepartments(previousDepts);
      const msg = await parseApiError(e);
      alert(msg);
    }
  };

  const handleCreateRole = () => {
    setEditingRole(null);
    setRoleForm({ name: '', permissions: {} });
    setModalTab('role-create');
    setIsModalOpen(true);
  };

  const handleEditRole = (role) => {
    setEditingRole(role);

    let perms = role.permissions || role.access || {};
    if (typeof perms === 'string') {
      try { perms = JSON.parse(perms); } catch { perms = {}; }
    }

    setRoleForm({ name: role.label || role.name, permissions: perms });
    setModalTab('role-edit');
    setIsModalOpen(true);
  };

  const handleSaveRole = async () => {
    try {
      const payload = {
        ...roleForm,
        label: roleForm.name,
        access: roleForm.permissions
      };

      const previousRoles = [...roles];
      // Optimistic Update
      if (editingRole) {
        setRoles(roles.map(r => r.id === editingRole.id ? { ...r, ...payload } : r));
      } else {
        setRoles([...roles, { ...payload, id: Date.now().toString() }]);
      }

      setIsModalOpen(false);

      try {
        let res;
        if (editingRole) {
          await api.updateRole(editingRole.id, payload);
        } else {
          res = await api.createRole(payload);
          if (res && res.id) {
            const realId = res.id;
            setRoles(prev => prev.map(r => (r.name === payload.name || r.label === payload.label) ? { ...r, id: realId } : r));
          }
        }
      } catch (e) {
        setRoles(previousRoles);
        const msg = await parseApiError(e);
        toast.error("Gagal simpan role: " + msg);
      }
    } catch (e) {
      const msg = await parseApiError(e);
      alert(msg);
    }
  };

  const handleDeleteRole = async (id) => {
    if (!window.confirm("Hapus role?")) return;
    const previousRoles = [...roles];
    setRoles(roles.filter(r => r.id !== id));
    try {
      await api.deleteRole(id);
    } catch (e) {
      setRoles(previousRoles);
      const msg = await parseApiError(e);
      alert(msg);
    }
  };

  const handleCreateFlow = () => {
    setEditingFlow(null);
    setFlowForm({ name: '', description: '', steps: [], visual_config: null });
    setIsFlowModalOpen(true);
  };

  const handleEditFlow = (flow) => {
    setEditingFlow(flow);
    setFlowForm({
      name: flow.name,
      description: flow.description,
      steps: flow.steps || [],
      visual_config: flow.visual_config || null
    });
    setIsFlowModalOpen(true);
  };

  const handleDeleteFlow = async (id) => {
    if (!window.confirm("Hapus alur persetujuan ini?")) return;
    const previousFlows = [...flows];
    setFlows(flows.filter(f => f.id !== id));

    try {
      await api.deleteApprovalFlow(id);
      addLog(currentUser?.name, 'Delete Flow', `ID ${id}`);
    } catch (e) {
      setFlows(previousFlows);
      alert(e.message);
    }
  };

  const handleAddFlowStep = (user) => {
    if (flowForm.steps.find(s => s.username === user.username)) return;
    setFlowForm({ ...flowForm, steps: [...flowForm.steps, { username: user.username, name: user.name }] });
  };

  const handleRemoveFlowStep = (index) => {
    const newSteps = [...flowForm.steps];
    newSteps.splice(index, 1);
    setFlowForm({ ...flowForm, steps: newSteps });
  };

  const handleSaveFlow = async () => {
    if (!flowForm.name) return alert("Nama alur wajib diisi!");
    try {
      const previousFlows = [...flows];
      // Optimistic Update
      if (editingFlow) {
        setFlows(flows.map(f => f.id === editingFlow.id ? { ...f, ...flowForm } : f));
      } else {
        setFlows([...flows, { ...flowForm, id: Date.now().toString() }]);
      }

      setIsFlowModalOpen(false);
      try {
        let res;
        if (editingFlow) {
          await api.updateApprovalFlow(editingFlow.id, flowForm);
        } else {
          res = await api.createApprovalFlow(flowForm);
          if (res && res.id) {
            const realId = res.id;
            setFlows(prev => prev.map(f => f.name === flowForm.name ? { ...f, id: realId } : f));
          }
        }
      } catch (e) {
        setFlows(previousFlows);
        const msg = await parseApiError(e);
        toast.error("Gagal simpan alur: " + msg);
      }
    } catch (e) {
      const msg = await parseApiError(e);
      alert(msg);
    }
  };

  const handleSaveVisualFlow = async (updatedPayload) => {
    if (!updatedPayload.name) return alert("Nama alur wajib diisi!");
    try {
      const previousFlows = [...flows];
      // Optimistic Update
      if (editingFlow) {
        setFlows(flows.map(f => f.id === editingFlow.id ? { ...f, ...updatedPayload } : f));
      } else {
        setFlows([...flows, { ...updatedPayload, id: Date.now().toString() }]);
      }

      setIsFlowModalOpen(false);
      try {
        let res;
        if (editingFlow) {
          await api.updateApprovalFlow(editingFlow.id, updatedPayload);
        } else {
          res = await api.createApprovalFlow(updatedPayload);
          if (res && res.id) {
            const realId = res.id;
            setFlows(prev => prev.map(f => f.name === updatedPayload.name ? { ...f, id: realId } : f));
          }
        }
        toast.success('Workflow berhasil disimpan');
      } catch (e) {
        setFlows(previousFlows);
        const msg = await parseApiError(e);
        toast.error("Gagal simpan workflow: " + msg);
      }
    } catch (e) {
      const msg = await parseApiError(e);
      alert(msg);
    }
  };


  // --- DOC HANDLERS (API INTEGRATED) ---

  const handleMultipleDocUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const tid = toast.loading(`Menyiapkan upload ${files.length} dokumen...`);
    let successCount = 0;

    for (const file of files) {
      const fileSize = (file.size / 1024 / 1024).toFixed(2) + ' MB';
      const docPayload = {
        title: file.name,
        type: file.type || 'application/octet-stream',
        size: fileSize,
        uploadDate: new Date().toISOString(),
        folderId: currentFolderId,
        owner: currentUser?.name || 'Admin',
        status: 'waiting',
        file: file,
        forceOcr: true
      };

      try {
        await createDocument(docPayload);
        successCount++;
        updateToast(tid, { message: `Mengupload ${successCount}/${files.length} dokumen...` });
      } catch (err) {
        console.error("Bulk upload error:", err);
      }
    }

    updateToast(tid, { type: 'success', message: `Berhasil mengupload ${successCount} dokumen.` });
    fetchDocs();
    fetchLogs();
    e.target.value = '';
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 30 * 1024 * 1024) {
      alert("File terlalu besar! Maksimal ukuran file adalah 30MB.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const fileSize = (file.size / 1024 / 1024).toFixed(2) + ' MB';

    if (file.size > 10 * 1024 * 1024) {
      alert("Peringatan: Ukuran file cukup besar (> 10MB). Pastikan koneksi stabil agar upload berhasil.");
    }

    // Only read Base64 for Image Previews (UI only)
    let previewUrl = null;
    if (file.type.startsWith('image/')) {
      previewUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    }

    setUploadForm(prev => ({
      ...prev,
      title: file.name,
      fileType: file.type || 'application/octet-stream',
      fileSize,
      fileData: file, // Store raw File object
      previewUrl: previewUrl,
      ocrContent: '',
      isProcessing: false
    }));
  };

  const handleProcessDoc = async () => {
    const capturedForm = { ...uploadForm };
    const file = capturedForm.fileData; // Raw File object
    if (uploadForm.isProcessing) return;

    if (!file && !capturedForm.editMode) {
      toast.warning("File belum dipilih.");
      return;
    }

    if (!capturedForm.editMode && docList && docList.length > 0) {
      const isDuplicate = docList.some(d => d.title === capturedForm.title && (String(d.folderId) === String(currentFolderId) || (!d.folderId && !currentFolderId)));
      if (isDuplicate) {
        toast.warning(`File "${capturedForm.title}" sudah ada. Melanjutkan...`);
      }
    }

    const previousDocs = [...docList];
    const docPayload = {
      id: capturedForm.editMode ? capturedForm.id : String(Date.now()),
      title: capturedForm.title,
      uploadDate: new Date().toISOString(),
      ocrContent: capturedForm.ocrContent || '',
      size: capturedForm.fileSize,
      type: capturedForm.fileType,
      owner: currentUser?.name || 'Admin',
      folderId: currentFolderId,
      department: capturedForm.department || '',
      forceOcr: true, // Pastikan PDF hasil scan diproses secara mendalam
      status: 'waiting' // Masuk antrean OCR (1 per 1)
    };

    // Update UI Seketika
    if (capturedForm.editMode) {
      setDocList(docList.map(d => d.id === capturedForm.id ? { ...d, ...docPayload } : d));
    } else {
      setDocList([...docList, docPayload]);
    }

    setUploadForm(prev => ({ ...prev, isProcessing: true }));
    setIsModalOpen(false);
    const toastId = toast.loading(capturedForm.editMode ? `Memperbarui "${capturedForm.title}"...` : `Mengupload "${capturedForm.title}"...`);

    try {
      let res;
      if (capturedForm.editMode) {
        await updateDocument(capturedForm.id, { ...docPayload, file });
        addLog(currentUser?.name, 'Revisi Dokumen', `Revisi ${docPayload.title}`);
        updateToast(toastId, { message: `"${docPayload.title}" diperbarui`, type: 'success' });
      } else {
        res = await createDocument({ ...docPayload, file });
        if (res && res.id) {
          const realId = res.id;
          setDocList(prev => prev.map(d => d.title === docPayload.title ? { ...d, id: realId } : d));
        }
        addLog(currentUser?.name, 'Upload Dokumen', `Upload ${docPayload.title}`);
        updateToast(toastId, { message: `"${docPayload.title}" diupload`, type: 'success' });
      }
      await fetchLogs();
    } catch (e) {
      console.error("Upload failed:", e);
      setDocList(previousDocs); // Rollback jika gagal
      const msg = await parseApiError(e);
      updateToast(toastId, { message: `Gagal: ${msg}`, type: 'error' });
    } finally {
      setUploadForm(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const handleEditDoc = async (e, doc) => {
    e.stopPropagation();

    let fullDoc = doc;
    // CRITICAL FIX: Jika data file kosong (karena optimasi list), ambil full data dari server dulu
    if (!doc.fileData && !doc.file_data && !doc.filedata) {
      try {
        const fetched = await api.getDocumentById(doc.id);
        if (fetched) fullDoc = fetched;
      } catch (err) {
        console.error("Gagal mengambil data lengkap dokumen untuk edit:", err);
      }
    }

    setUploadForm({
      id: fullDoc.id,
      title: fullDoc.title,
      ocrContent: fullDoc.ocrContent,
      fileType: fullDoc.type,
      fileSize: fullDoc.size,
      previewUrl: (fullDoc.type || '').startsWith('image/') ? (fullDoc.fileData || fullDoc.file_data || fullDoc.filedata) : null,
      fileData: null, // No new file selected yet
      isProcessing: false,
      processingMessage: '',
      editMode: true,
      originalDoc: fullDoc
    });
    setModalTab('upload');
    setIsModalOpen(true);
  };

  const handleDeleteDoc = async (e, docId) => {
    e.stopPropagation();
    if (!docId) {
      alert("Error: ID dokumen tidak valid.");
      return;
    }
    if (window.confirm('Hapus dokumen?')) {
      const previousDocs = [...docList];
      // Optimistic update: hapus dari list lokal segera
      setDocList(docList.filter(d => d.id !== docId));

      try {
        await deleteDocument(docId);
        await fetchLogs();
        addLog(currentUser?.name, 'Hapus Dokumen', `ID ${docId}`);
      } catch (e) {
        setDocList(previousDocs); // Rollback jika API gagal
        toast.error("Gagal menghapus dokumen: " + e.message);
      }
    }
  };

  // --- FIXED: HANDLE VIEW DOC ---
  const handleViewDoc = async (doc) => {
    // 0. Handle Special Search Result Types
    if (doc.matchType === 'invoice') {
      handleViewInvoice({ ...(doc.data || doc), boxId: doc.boxId, folderName: doc.folderName, location: doc.folderName });
      return;
    }
    if (doc.matchType === 'external_item') {
      handleViewExternal(doc.data || doc);
      return;
    }
    if (doc.matchType === 'tax_summary') {
      setActiveTab('tax-summary');
      // Potential improvement: pass filter to TaxSummary component
      return;
    }
    if (doc.matchType === 'tax_monitoring') {
      setActiveTab('tax-monitoring');
      return;
    }
    if (doc.matchType === 'approval') {
      setActiveTab('approvals');
      // Backend should return full approval object in doc.data
      setApprovals(prev => {
        const exists = prev.find(a => a.id === doc.id);
        return exists ? prev : [...prev, doc.data || doc];
      });
      // We might need a way to auto-open the modal in DocumentApproval.jsx
      return;
    }
    if (doc.matchType === 'pustaka') {
      setActiveTab('pustaka');
      // We can pass state to Pustaka component if needed
      return;
    }
    if (doc.matchType === 'tax_object') {
      setActiveTab('tax-calculation');
      return;
    }
    if (doc.matchType === 'note') {
      // If note is on a document, view that document
      if (doc.parentId && doc.parentType === 'document') {
        const parentDoc = docList.find(d => d.id === doc.parentId);
        if (parentDoc) handleViewDoc(parentDoc);
      }
      return;
    }

    // 1. Set data awal (meta data) agar modal muncul cepat
    setViewDocData(doc);
    setModalTab('doc-view');
    setIsModalOpen(true);
    setPreviewHtml('');
    setPdfBlobUrl(null);
    setIsGeneratingPreview(true);

    // 2. Inisialisasi data awal & Cek apakah data file (Base64) kosong?
    let fullDoc = doc;
    if (!doc.fileData && !doc.file_data && !doc.filedata) {
      try {
        console.log("Mengambil data lengkap dokumen dari server...", doc.id);
        const fetched = await api.getDocumentById(doc.id);
        if (fetched) {
          fullDoc = fetched;
          setViewDocData(fullDoc);
        }
      } catch (error) {
        console.error("Gagal memuat detail dokumen:", error);
      }
    }

    // 3. Generate Preview for Office Files (Support URL fallback for disk storage)
    const content = fullDoc?.fileData || fullDoc?.file_data || fullDoc?.filedata || fullDoc?.url;
    const type = String(fullDoc?.type || '').toLowerCase();
    const name = String(fullDoc?.title || '').toLowerCase();
    const isPdf = type.includes('pdf') || name.endsWith('.pdf') || (typeof content === 'string' && (content.match(/\.pdf$/i) || content.startsWith('data:application/pdf')));

    console.log('[Preview] handleViewDoc:', { type, name, isPdf, hasContent: !!content });

    if (content && typeof content === 'string') {
      try {
        let buffer;
        const normalizedUrl = getFullUrl(content);
        console.log('[Preview] Normalized URL:', normalizedUrl);

        if (normalizedUrl.startsWith('http') || normalizedUrl.startsWith('/') || normalizedUrl.startsWith('blob:')) {
          console.log('[Preview] Fetching buffer from URL...');
          const response = await fetch(normalizedUrl, {
            credentials: 'include'
          });
          if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
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
          } catch (atobErr) {
            console.error("Gagal decode Base64 di handleViewDoc:", atobErr);
          }
        }

        if (buffer && isPdf) {
          setPdfBlobUrl(buffer);
        } else if (buffer && (type?.includes('word') || name?.endsWith('.docx'))) {
          if (buffer.byteLength > 10 * 1024 * 1024) {
            setPreviewHtml('<div class="p-10 text-center"><p class="text-slate-500 font-bold">Dokumen Word terlalu besar (>10MB) untuk diproses preview.</p><p class="text-sm text-slate-400 mt-2">Silakan unduh file untuk melihat isi lengkap.</p></div>');
          } else {
            const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
            setPreviewHtml(result.value);
          }
        } else if (buffer && (type?.includes('sheet') || type?.includes('excel') || name?.endsWith('.xlsx') || name?.endsWith('.xls'))) {
          const wb = XLSX.read(buffer, { type: 'array' });
          const firstSheet = wb.Sheets[wb.SheetNames[0]];
          setPreviewHtml(XLSX.utils.sheet_to_html(firstSheet));
        }
      } catch (e) { console.error("Preview error:", e); }
    }
    setIsGeneratingPreview(false);
  };

  // --- HANDLE NAVIGATE TO FOLDER ---
  const handleNavigateToFolder = (folderId) => {
    setActiveTab('documents');
    setCurrentFolderId(folderId);
    // Optional: Add highlighting effect or scroll to folder
    console.log("Navigating to folder:", folderId);
  };

  // --- FIXED: HANDLE DOWNLOAD ---
  const handleDownload = async (doc) => {
    try {
      const element = document.createElement("a");
      let downloadUrl;
      let fileName = doc.title;

      // 1. Cek ketersediaan data file (File Data / Base64) dari parameter doc
      let base64Content = doc.fileData || doc.file_data || doc.filedata || doc.previewUrl;

      // 2. JIKA DATA KOSONG: Coba ambil paksa dari server (Fetch on Demand)
      if (!base64Content || (typeof base64Content === 'string' && base64Content.length < 1)) {
        console.log("Data file lokal kosong, mencoba fetch ulang dari server...", doc.id);
        try {
          const fullDoc = await api.getDocumentById(doc.id);
          if (fullDoc) {
            base64Content = fullDoc.fileData || fullDoc.file_data || fullDoc.filedata || fullDoc.previewUrl;
          }
        } catch (err) {
          console.error("Gagal fetch ulang:", err);
        }
      }

      // 3. Proses Base64 jika data ditemukan
      if (base64Content && typeof base64Content === 'string' && base64Content.length > 0) {
        try {
          // Cek apakah ini URL biasa (bukan base64)
          if (base64Content.startsWith('http') || base64Content.startsWith('blob:') || base64Content.startsWith('/uploads/')) {
            downloadUrl = getFullUrl(base64Content);
            element.target = "_blank";
          } else if (base64Content.includes('base64,') || base64Content.length > 1000) {
            let mime = doc.type || 'application/octet-stream'; // Default ke Binary Generic

            // Deteksi dan bersihkan prefix Data URI (data:application/pdf;base64,...)
            if (base64Content.includes('base64,')) {
              const parts = base64Content.split('base64,');
              if (parts.length > 1) {
                const header = parts[0];
                const mimeMatch = header.match(/data:(.*);/);
                if (mimeMatch) {
                  mime = mimeMatch[1];
                }
                base64Content = parts[1]; // Ambil isi murni setelah koma
              }
            }

            // Bersihkan spasi/enter yang mungkin ada
            const cleanBase64 = base64Content.replace(/[\n\r\s]/g, '');

            // Konversi Base64 ke Blob
            const binary = atob(cleanBase64);
            const len = binary.length;
            const buffer = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              buffer[i] = binary.charCodeAt(i);
            }
            const blob = new Blob([buffer], { type: mime });
            downloadUrl = URL.createObjectURL(blob);
          }
        } catch (err) {
          console.error("Gagal decode Base64:", err);
          // Jangan return, biarkan lanjut ke fallback URL/OCR
        }
      }

      // 4. Jika Blob gagal, coba URL eksternal (jika ada di masa depan)
      if (!downloadUrl && doc.url) {
        downloadUrl = doc.url;
        if (!doc.fileData) element.target = "_blank";
      }

      // 5. Fallback Terakhir: Jika file asli benar-benar hilang/corrupt
      if (!downloadUrl) {
        // Buat file teks berisi metadata dan pesan error agar user tetap mendapat sesuatu
        const errorMsg = "File asli tidak ditemukan di database (Mungkin file terlalu besar saat upload atau data corrupt).";
        const metaContent = `[METADATA DOKUMEN]\nID: ${doc.id}\nJudul: ${doc.title}\nTipe: ${doc.type}\nUkuran: ${doc.size}\nUpload: ${doc.uploadDate}\n\n[STATUS]\n${errorMsg}\n\n[OCR CONTENT]\n${doc.ocrContent || 'Tidak ada data OCR.'}`;

        const blob = new Blob([metaContent], { type: 'text/plain' });
        downloadUrl = URL.createObjectURL(blob);
        fileName += '_error_log.txt';

        alert(errorMsg + " Mengunduh log error & metadata sebagai gantinya.");
      }

      element.href = downloadUrl;
      element.download = fileName;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);

      // Clean up blob URL
      if (downloadUrl && downloadUrl.startsWith('blob:')) {
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      }

      addLog(currentUser?.name, 'Download', `Mengunduh file: ${doc.title}`);
    } catch (e) {
      console.error("Download error:", e);
      alert("Gagal mengunduh file: " + e.message);
    }
  };

  const handleRestoreVersion = async (docId, versionTimestamp) => {
    if (!window.confirm("Yakin ingin mengembalikan dokumen ke versi ini? Versi saat ini akan disimpan sebagai revisi baru.")) return;
    try {
      await restoreDocumentVersion(docId, versionTimestamp);
      // If detail modal is open, we might need to refresh its data
      if (viewDocData && viewDocData.id === docId) {
        const updated = await api.getDocumentById(docId);
        if (updated) setViewDocData(updated);
      }
      alert("Berhasil mengembalikan versi dokumen.");
    } catch (e) {
      alert("Gagal mengembalikan versi: " + e.message);
    }
  };

  const handleSaveTaxSummary = async () => {
    try {
      const currentType = taxForm.type || 'PPH';
      const payload = {
        ...taxForm,
        type: currentType,
        pembetulan: taxForm.pembetulan || 0,
        pph23: taxForm.data?.pph?.['PPh 23'] || 0,
        pph42: taxForm.data?.pph?.['PPh 4(2)'] || 0,
      };

      const previousSummaries = [...taxSummaries];
      if (taxForm.id) {
        setTaxSummaries(taxSummaries.map(s => s.id === taxForm.id ? payload : s));
      } else {
        const newRecord = { ...payload, id: Date.now().toString() };
        setTaxSummaries([...taxSummaries, newRecord]);
      }

      setIsModalOpen(false);
      try {
        const res = await api.saveTaxSummary(payload);
        if (!taxForm.id && res && res.id) {
          const realId = res.id;
          setTaxSummaries(prev => prev.map(s => (s.month === payload.month && s.year === payload.year && s.type === payload.type) ? { ...s, id: realId } : s));
        }
        addLog(currentUser?.name, taxForm.id ? 'Update Pajak' : 'Create Pajak', `${taxForm.type} - ${taxForm.month} ${taxForm.year}`);
      } catch (e) {
        setTaxSummaries(previousSummaries);
        const msg = await parseApiError(e);
        toast.error("Gagal sinkronisasi ke server: " + msg);
      }
    } catch (e) {
      const msg = await parseApiError(e);
      toast.error(msg);
    }
  };

  const handleTaxImport = async (importedData) => {
    let successCount = 0;
    let failCount = 0;

    try {
      // Proses satu per satu agar tidak membebani koneksi database
      for (const item of importedData) {
        try {
          await api.saveTaxSummary(item);
          successCount++;
        } catch (err) {
          console.error("Gagal simpan item import:", item, err);
          failCount++;
        }
      }

      const freshData = await api.getTaxSummaries();
      setTaxSummaries(freshData);
      localStorage.setItem('tax_summaries', JSON.stringify(freshData));

      addLog(currentUser?.name, 'Import Pajak', `Import selesai: ${successCount} sukses, ${failCount} gagal`);

      if (failCount > 0) {
        alert(`Import selesai. Berhasil: ${successCount}, Gagal: ${failCount}. Pastikan koneksi backend stabil.`);
      } else {
        alert(`Berhasil mengimport ${successCount} data ke database permanen.`);
      }
    } catch (error) {
      const msg = await parseApiError(error);
      alert("Gagal sinkronisasi import: " + msg);
    }
  };

  const handleCreateFolder = async (folderData) => {
    // folderData = { name, privacy, allowedDepts, allowedUsers }
    if (!folderData || !folderData.name) return;

    try {
      const previousFolders = [...folders];
      const payload = {
        ...folderData,
        parent_id: currentFolderId,
        owner: currentUser?.name || 'Admin'
      };

      // Hapus field yang mungkin terbawa dari state UI
      delete payload.id;

      // Optimistic Update
      setFolders([...folders, { ...payload, id: Date.now().toString() }]);

      try {
        const res = await createFolder(payload);
        if (res && res.id) {
          const realId = res.id;
          setFolders(prev => prev.map(f => f.name === payload.name ? { ...f, id: realId } : f));
        }
      } catch (e) {
        setFolders(previousFolders);
        const msg = await parseApiError(e);
        toast.error("Gagal membuat folder: " + msg);
      }
      await fetchLogs();
    } catch (e) {
      const msg = await parseApiError(e);
      alert(msg);
    }
  };

  const handleEditFolder = async (e, folder, newData) => {
    // newData = { name, privacy, allowedDepts, allowedUsers }
    if (e) e.stopPropagation();
    if (!newData || !newData.name) return;

    // Proteksi folder DataBox
    if ((folder.name === 'DataBox' || folder.name === 'TaxAudit' || folder.name === 'ApprovalDoc') && folder.name !== newData.name) {
      alert(`Nama folder sistem '${folder.name}' tidak dapat diubah.`);
      return;
    }

    try {
      const previousFolders = [...folders];
      // Optimistic Update
      setFolders(folders.map(f => f.id === folder.id ? { ...f, ...newData } : f));

      try {
        await updateFolder(folder.id, newData);
      } catch (e) {
        setFolders(previousFolders);
        const msg = await parseApiError(e);
        toast.error("Gagal update folder: " + msg);
      }
      addLog(currentUser?.name, 'Update Folder', `${folder.name} -> ${newData.name}`);
    } catch (e) {
      const msg = await parseApiError(e);
      alert(msg);
    }
  };

  const handleRenameDoc = async (e, doc) => {
    e.stopPropagation();
    const newTitle = prompt("Nama File Baru:", doc.title);
    if (newTitle && newTitle !== doc.title) {
      try {
        const previousDocs = [...docList];
        // Optimistic Update
        setDocList(docList.map(d => d.id === doc.id ? { ...d, title: newTitle } : d));

        try {
          await updateDocument(doc.id, { ...doc, title: newTitle });
        } catch (err) {
          setDocList(previousDocs);
          const msg = await parseApiError(err);
          toast.error("Gagal rename file: " + msg);
        }
        await fetchLogs();
      } catch (err) {
        const msg = await parseApiError(err);
        alert(msg);
      }
    }
  };

  const handleDeleteFolder = async (e, id) => {
    e.stopPropagation();

    // Proteksi folder DataBox
    const folder = folders.find(f => f.id === id);
    if (folder?.name === 'DataBox' || folder?.name === 'TaxAudit' || folder?.name === 'ApprovalDoc') {
      alert(`Folder sistem '${folder.name}' tidak dapat dihapus.`);
      return;
    }

    if (window.confirm("Hapus folder ini beserta isinya?")) {
      const previousFolders = [...folders];
      // Optimistic delete
      setFolders(folders.filter(f => f.id !== id));

      try {
        await deleteFolder(id);
        addLog(currentUser?.name, 'Delete Folder', `ID ${id}`);
      } catch (e) {
        setFolders(previousFolders);
        const msg = await parseApiError(e);
        toast.error("Gagal menghapus folder: " + msg);
      }
    }
  };



  // --- TAX CONFIGURATION STATE ---
  const [taxConfig, setTaxConfig] = useState(() => {
    const saved = localStorage.getItem('tax_config');
    return saved ? JSON.parse(saved) : {
      pphTypes: ['PPh 23', 'PPh 4(2)', 'PPh 21', 'PPh 26', 'PPh Final'],
      ppnInTypes: ['PIB', 'PPN Masukan', 'Dokumen Lain', 'Kelebihan Bayar Bulan Lalu', 'Lain-lain'],
      ppnOutTypes: ['Sales', 'PEB', 'Promotion Material', 'Manual Invoice']
    };
  });

  const saveTaxConfig = (newConfig) => {
    setTaxConfig(newConfig);
    localStorage.setItem('tax_config', JSON.stringify(newConfig));
  };

  const handleAddTaxField = (category) => {
    const name = prompt("Masukkan nama field baru:");
    if (!name) return;

    // Check if exists
    if (taxConfig[category].includes(name)) {
      alert("Field sudah ada!");
      return;
    }

    // Update Config
    const newConfig = {
      ...taxConfig,
      [category]: [...taxConfig[category], name]
    };
    saveTaxConfig(newConfig);

    // Update Current Form Data to include this new field with 0 value
    const categoryKey = category === 'pphTypes' ? 'pph' : category === 'ppnInTypes' ? 'ppnIn' : 'ppnOut';
    setTaxForm(prev => ({
      ...prev,
      data: {
        ...prev.data,
        [categoryKey]: {
          ...prev.data?.[categoryKey],
          [name]: 0
        }
      }
    }));
  };

  const handleDeleteTaxField = (category, name) => {
    if (!window.confirm(`Hapus field "${name}" secara permanen? Data tersimpan di field ini mungkin akan hilang.`)) return;

    // Remove from Config
    const newConfig = {
      ...taxConfig,
      [category]: taxConfig[category].filter(t => t !== name)
    };
    saveTaxConfig(newConfig);

    // Remove from Current Form
    const categoryKey = category === 'pphTypes' ? 'pph' : category === 'ppnInTypes' ? 'ppnIn' : 'ppnOut';
    const newDataIsGroup = { ...taxForm.data[categoryKey] };
    delete newDataIsGroup[name];

    setTaxForm(prev => ({
      ...prev,
      data: {
        ...prev.data,
        [categoryKey]: newDataIsGroup
      }
    }));
  };


  const handleDeleteTaxRecord = async (id) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus data ini secara permanen?")) {
      const previousSummaries = [...taxSummaries];
      setTaxSummaries(taxSummaries.filter(s => s.id !== id));

      try {
        await api.deleteTaxSummary(id);
        addLog(currentUser?.name, 'Hapus Rekod Pajak', `ID ${id}`);
      } catch (e) {
        setTaxSummaries(previousSummaries);
        toast.error("Gagal menghapus data dari server: " + e.message);
      }
    }
  };

  const handleRenameTaxType = (category, oldName) => {
    const newName = prompt("Nama Baru:", oldName);
    if (!newName || newName === oldName) return;
    if (taxConfig[category].includes(newName)) {
      alert("Nama tersebut sudah digunakan.");
      return;
    }

    // 1. Update Config
    const newConfig = {
      ...taxConfig,
      [category]: taxConfig[category].map(t => t === oldName ? newName : t)
    };
    saveTaxConfig(newConfig);

    // 2. Update Current Form Data (if applicable)
    // We need to migrate the value from oldName to newName in the current form state
    const categoryKey = category === 'pphTypes' ? 'pph' : category === 'ppnInTypes' ? 'ppnIn' : 'ppnOut';
    const oldVal = taxForm.data[categoryKey][oldName] || 0;

    // Create new data object for that category
    const categoryData = { ...taxForm.data[categoryKey] };
    delete categoryData[oldName]; // Remove old key
    categoryData[newName] = oldVal; // Add new key with old value

    setTaxForm(prev => ({
      ...prev,
      data: {
        ...prev.data,
        [categoryKey]: categoryData
      }
    }));
  };

  // --- AUTO CALCULATE PREVIOUS MONTH BALANCE ---

  useEffect(() => {
    // Only run if modal is open and we have a valid date
    if (!isModalOpen || !taxForm.month || !taxForm.year) return;

    // Only skip calculation if we are EDITING an existing record (prevents overwriting saved manual adjustments)
    // BUT user asked for "auto enter", so we might want to do it always or be smart.
    // For now, let's do it if the field is empty or 0 to be safe.

    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    let prevMonthIndex = months.indexOf(taxForm.month) - 1;
    let prevYear = taxForm.year;

    if (prevMonthIndex < 0) {
      prevMonthIndex = 11;
      prevYear -= 1;
    }
    const prevMonthName = months[prevMonthIndex];

    // Find previous record
    const prevRecord = taxSummaries.find(r => r.month === prevMonthName && r.year === prevYear);

    let overpaymentAmount = 0;

    if (prevRecord) {
      // Calculate PPN In Total
      const totalIn = taxConfig.ppnInTypes.reduce((sum, t) => {
        // Handle both structure versions if needed, but assuming data structure is consistent
        const val = prevRecord.data?.ppnIn?.[t] ?? 0;
        return sum + val;
      }, 0);

      // Calculate PPN Out Total
      const totalOut = taxConfig.ppnOutTypes.reduce((sum, t) => {
        const val = prevRecord.data?.ppnOut?.[t] ?? 0;
        return sum + val;
      }, 0);

      // Net = Out - In
      const net = totalOut - totalIn;

      // If Net is Negative, it means OVERPAYMENT (Lebih Bayar).
      // e.g. Out 100, In 150 -> Net -50. Overpayment = 50.
      if (net < 0) {
        overpaymentAmount = Math.abs(net);
      }
    }

    // Update Form
    // Only update if the value is different to avoid infinite loops, and maybe only if 0?
    // User requirement: "otomatis akan masuk". Let's force update it.
    const currentVal = taxForm.data?.ppnIn?.['Kelebihan Bayar Bulan Lalu'] ?? 0;

    if (currentVal !== overpaymentAmount) {
      setTaxForm(prev => ({
        ...prev,
        data: {
          ...prev.data,
          ppnIn: {
            ...prev.data?.ppnIn,
            'Kelebihan Bayar Bulan Lalu': overpaymentAmount
          }
        }
      }));
    }

  }, [taxForm.month, taxForm.year, isModalOpen, taxSummaries, taxConfig]);

  const commandItems = useMemo(() => {
    const items = [
      { id: 'dashboard', tab: 'dashboard', label: commandTextMap.items.dashboard.label, description: commandTextMap.items.dashboard.description, group: commandTextMap.groups.general, icon: LayoutDashboard, keywords: 'home statistik ringkasan' },
      { id: 'job-due-date', tab: 'job-due-date', label: commandTextMap.items['job-due-date'].label, description: commandTextMap.items['job-due-date'].description, group: commandTextMap.groups.general, icon: ClipboardCheck, keywords: 'task issue deadline' },
      { id: 'pustaka', tab: 'pustaka', label: commandTextMap.items.pustaka.label, description: commandTextMap.items.pustaka.description, group: commandTextMap.groups.general, icon: BookOpen, keywords: 'wiki guide docs' },
      { id: 'flow', tab: 'flow', label: commandTextMap.items.flow.label, description: commandTextMap.items.flow.description, group: commandTextMap.groups.general, icon: FileCheck, keywords: 'sop workflow' },
      { id: 'inventory', tab: 'inventory', label: commandTextMap.items.inventory.label, description: commandTextMap.items.inventory.description, group: commandTextMap.groups.documents, icon: Grid3x3, keywords: 'rak box warehouse' },
      { id: 'documents', tab: 'documents', label: commandTextMap.items.documents.label, description: commandTextMap.items.documents.description, group: commandTextMap.groups.documents, icon: FileStack, keywords: 'files upload folder' },
      { id: 'approvals', tab: 'approvals', label: commandTextMap.items.approvals.label, description: commandTextMap.items.approvals.description, group: commandTextMap.groups.documents, icon: ShieldCheck, keywords: 'approval workflow review' },
      { id: 'tax-monitoring', tab: 'tax-monitoring', label: commandTextMap.items['tax-monitoring'].label, description: commandTextMap.items['tax-monitoring'].description, group: commandTextMap.groups.tax, icon: Shield, keywords: 'audit pemeriksaan pajak' },
      { id: 'tax-calculation', tab: 'tax-calculation', label: commandTextMap.items['tax-calculation'].label, description: commandTextMap.items['tax-calculation'].description, group: commandTextMap.groups.tax, icon: Calculator, keywords: 'ppn pph hitung' },
      { id: 'tax-summary', tab: 'tax-summary', label: commandTextMap.items['tax-summary'].label, description: commandTextMap.items['tax-summary'].description, group: commandTextMap.groups.tax, icon: PieChart, keywords: 'summary compliance reporting' },
      { id: 'master', tab: 'master', label: commandTextMap.items.master.label, description: commandTextMap.items.master.description, group: commandTextMap.groups.system, icon: Settings, keywords: 'admin settings role' },
      { id: 'profile', tab: 'profile', label: commandTextMap.items.profile.label, description: commandTextMap.items.profile.description, group: commandTextMap.groups.system, icon: User, keywords: 'akun user' }
    ];

    return items.filter((item) => {
      if (item.id === 'profile') return true;
      return hasPermission(item.id, 'view');
    });
  }, [hasPermission, commandTextMap]);

  const commandQuickActions = useMemo(() => {
    const actions = [
      {
        id: 'quick-upload',
        label: commandTextMap.actions.upload.label,
        description: commandTextMap.actions.upload.description,
        icon: UploadCloud,
        keywords: 'unggah upload file dokumen',
        visible: hasPermission('documents', 'create'),
        action: () => {
          setModalTab('upload');
          setIsModalOpen(true);
        }
      },
      {
        id: 'quick-ocr-queue',
        label: commandTextMap.actions.ocrQueue.label,
        description: commandTextMap.actions.ocrQueue.description,
        icon: ScanLine,
        keywords: 'ocr queue status',
        visible: true,
        action: () => {
          setModalTab('ocr-details');
          setIsModalOpen(true);
        }
      },
      {
        id: 'quick-theme',
        label: isDarkMode ? commandTextMap.actions.themeLight : commandTextMap.actions.themeDark,
        description: commandTextMap.actions.themeDescription,
        icon: isDarkMode ? Sun : Moon,
        keywords: 'theme dark light mode',
        visible: true,
        action: () => setIsDarkMode(!isDarkMode)
      }
    ];

    return actions.filter((action) => action.visible);
  }, [hasPermission, isDarkMode, setIsDarkMode, setIsModalOpen, setModalTab, commandTextMap]);

  const isPopupInteractionLocked = isModalOpen || showRestoreForm || showExternalForm || showMenuLandingPopup || isFlowModalOpen;

  // --- LOGIN SCREEN ---

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 dark:text-slate-400 font-medium">{commandTextMap.labels.loading}</p>
        </div>
      </div>
    );
  }

  if (!currentUser) return (
    <Login
      onLogin={handleLogin}
    />
  );

  return (
    <div className="flex h-screen overflow-hidden p-3 gap-3 md:gap-4 md:p-4 selection:bg-indigo-500/30 selection:text-indigo-600 bg-[#F4F7FE] dark:bg-[#0B1437]">

      {/* FLOATING SIDEBAR */}
      <Sidebar
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasPermission={hasPermission}
        currentUser={currentUser}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        handleLogout={handleLogout}
        ocrStats={ocrStats}
        setModalTab={setModalTab}
        setIsModalOpen={setIsModalOpen}
        approvals={approvals}
      />

      {/* MOBILE OVERLAY */}
      {!isSidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-20 md:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarCollapsed(true)}
        />
      )}

      {/* MOBILE HEADER */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-b border-white/20 dark:border-white/10 flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
            <BookOpen className="text-white" size={18} />
          </div>
          <span className="font-bold text-lg dark:text-white tracking-tight">Pustaka</span>
        </div>
        <button onClick={() => setIsSidebarCollapsed(false)} className="p-2 text-gray-500 dark:text-white">
          <Menu size={24} />
        </button>
      </div>

      <main className="flex-1 overflow-y-auto relative bg-transparent pt-16 md:pt-0 scroll-smooth z-10">
        <div className="p-6 lg:p-10 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {tabTextMap[activeTab]?.title || 'Pustaka'}
              </h1>
              <p className="text-gray-500 dark:text-slate-400">
                {tabTextMap[activeTab]?.subtitle || (isEnglish ? 'Digital Info & Services Center' : 'Pusat Informasi & Layanan Digital')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <CommandPalette
                items={commandItems}
                quickActions={commandQuickActions}
                disabled={isPopupInteractionLocked}
                onSelect={(item) => {
                  if (item.action) {
                    item.action();
                    return;
                  }
                  if (item.tab) {
                    setActiveTab(item.tab);
                  }
                }}
              />

              {activeTab !== 'profile' && (
                <button
                  type="button"
                  onClick={() => setShowMenuLandingPopup(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-700 text-white text-xs font-black uppercase tracking-[0.14em] shadow-lg hover:opacity-95 transition-opacity"
                >
                  <Sparkles size={14} />
                  {commandTextMap.labels.infoMenu}
                </button>
              )}
            </div>

          </div>


          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {activeTab === 'dashboard' && (
                <Dashboard
                  stats={stats}
                  docList={docList}
                  docStats={docStats}
                  logs={logs}
                  TOTAL_SLOTS={TOTAL_SLOTS}
                  Grid3x3={Grid3x3}
                  isDarkMode={isDarkMode}
                  handleViewDoc={handleViewDoc}
                  handleNavigateToFolder={handleNavigateToFolder}
                  setActiveTab={setActiveTab}
                  setActiveInvTab={setActiveInvTab}
                  handleDownload={handleDownload}
                  handleDownloadInvoice={handleDownloadInvoice}
                  ocrStats={ocrStats}
                  taxSummaries={taxSummaries}
                  taxAudits={taxAudits}
                  users={users}
                  departments={departments}
                  externalItems={externalItems}
                  folders={folders}
                  currentUser={currentUser}
                  onCopy={handleCopyToClipboard}
                  onOpenLanding={handleOpenLanding}
                  inventory={inventory}
                />
              )}
              {activeTab === 'inventory' && (
                <Inventory
                  inventory={hydratedInventory}
                  stats={stats}
                  TOTAL_SLOTS={TOTAL_SLOTS}
                  getStatusStyle={getStatusStyle}
                  handleSlotClick={handleSlotClick}
                  handleExcelImport={handleExcelImport}
                  downloadTemplate={downloadTemplate}
                  excelInputRef={excelInputRef}
                  handleExportInventory={handleExportInventory}
                  inventorySearchQuery={inventorySearchQuery}
                  setInventorySearchQuery={setInventorySearchQuery}
                  hasPermission={hasPermission}
                  activeInvTab={activeInvTab}
                  setActiveInvTab={setActiveInvTab}
                  externalItems={externalItems}
                  onRestoreExternal={(item) => {
                    setSelectedExternalItem(item);
                    setRestoreTargetSlot(''); // Reset selection
                    setShowRestoreForm(true);
                  }}
                  onViewExternal={handleViewExternal}
                  ocrStats={ocrStats}
                  inventoryIssues={inventoryIssues}
                />
              )}
              {activeTab === 'documents' && (
                <Documents
                  docList={docList}
                  folders={folders}
                  currentFolderId={currentFolderId}
                  setCurrentFolderId={setCurrentFolderId}
                  folderHistory={folderHistory}
                  historyIndex={historyIndex}
                  navigateFolder={navigateFolder}
                  navigateBack={navigateBack}
                  navigateForward={navigateForward}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  handleCreateFolder={handleCreateFolder}
                  handleDeleteFolder={handleDeleteFolder}
                  handleViewDoc={handleViewDoc}
                  handleEditDoc={handleEditDoc}
                  handleDeleteDoc={handleDeleteDoc}
                  handleRenameDoc={handleRenameDoc}
                  setUploadForm={setUploadForm}
                  setModalTab={setModalTab}
                  setIsModalOpen={setIsModalOpen}
                  hasPermission={hasPermission}
                  docStats={docStats}
                  getSearchSnippet={getSearchSnippet}
                  logs={logs}
                  onRefresh={() => { fetchDocs(); fetchFolders(); fetchLogs(); }}
                  users={users}
                  departments={departments}
                  currentUser={currentUser}
                  handleEditFolder={handleEditFolder}
                  handleDownload={handleDownload}
                  ocrStats={ocrStats}
                  syncPustakaFolder={syncPustakaFolder}
                  handleMultipleDocUpload={handleMultipleDocUpload}
                />
              )}
              {activeTab === 'tax-monitoring' && (
                <TaxMonitoring
                  taxAudits={taxAudits}
                  onRefresh={(optimisticData) => {
                    if (optimisticData) setTaxAudits(optimisticData);
                    else { fetchTaxAudits(); fetchDocs(); fetchFolders(); fetchLogs(); }
                  }}
                  hasPermission={hasPermission}
                  currentUser={currentUser}
                  syncAuditFolder={syncAuditFolder}
                />
              )}
              {activeTab === 'approvals' && (
                <DocumentApproval
                  approvals={approvals}
                  users={users}
                  departments={departments}
                  currentUser={currentUser}
                  onRefresh={fetchApprovals}
                  hasPermission={hasPermission}
                  flows={flows}
                  syncApprovalFolder={syncApprovalFolder}
                />
              )}
              {activeTab === 'tax-summary' && (
                <TaxSummary
                  taxSummaries={taxSummaries}
                  hasPermission={hasPermission}
                  setTaxForm={setTaxForm}
                  setModalTab={setModalTab}
                  setIsModalOpen={setIsModalOpen}
                  config={taxConfig}
                  saveConfig={saveTaxConfig}
                  handleDeleteRecord={handleDeleteTaxRecord}
                  handleRenameTaxType={handleRenameTaxType}
                  onImport={handleTaxImport}
                  onCopy={handleCopyToClipboard}
                />
              )}
              {activeTab === 'tax-calculation' && <TaxCalculation onCopy={handleCopyToClipboard} hasPermission={hasPermission} />}
              {activeTab === 'master' && (
                <MasterData
                  masterTab={masterTab}
                  setMasterTab={setMasterTab}
                  users={users}
                  roles={roles}
                  departments={departments}
                  flows={flows} // Pass flows to MasterData
                  userSearchQuery={userSearchQuery}
                  setUserSearchQuery={setUserSearchQuery}
                  handleDeleteUser={handleDeleteUser}
                  handleCreateUser={handleCreateUser}
                  handleEditUser={handleEditUser}
                  handleEditRole={handleEditRole}
                  handleDeleteRole={handleDeleteRole}
                  handleCreateRole={handleCreateRole}
                  handleCreateDept={handleCreateDept}
                  handleEditDept={handleEditDept}
                  handleDeleteDept={handleDeleteDept}
                  handleCreateFlow={handleCreateFlow} // Pass flow handlers
                  handleEditFlow={handleEditFlow}
                  handleDeleteFlow={handleDeleteFlow}
                  setIsModalOpen={setIsModalOpen}
                  logs={logs}
                  setModalTab={setModalTab}
                  setRoles={setRoles}
                  setDepartments={setDepartments}
                  hasPermission={hasPermission}
                />
              )}
              {activeTab === 'profile' && (
                <Profile
                  currentUser={currentUser}
                  onUpdateProfile={handleUpdateProfile}
                />
              )}
              {activeTab === 'pustaka' && (
                <Pustaka
                  currentUser={currentUser}
                  hasPermission={hasPermission}
                  users={users}
                  departments={departments}
                  syncPustakaFolder={syncPustakaFolder}
                  syncSopFolder={syncSopFolder}
                />
              )}
              {activeTab === 'system-logs' && (
                <SystemLogs
                  isDarkMode={isDarkMode}
                />
              )}
              {activeTab === 'flow' && (
                <SopFlow
                  currentUser={currentUser}
                  hasPermission={hasPermission}
                  users={users}
                  departments={departments}
                  syncSopFolder={syncSopFolder}
                />
              )}
              {activeTab === 'job-due-date' && (
                <JobDueDate
                  currentUser={currentUser}
                  users={users}
                  departments={departments}
                  hasPermission={hasPermission}
                  isDarkMode={isDarkMode}
                  onCopy={handleCopyToClipboard}
                />
              )}
            </motion.div>
          </AnimatePresence>

        </div>

        {/* NOTIFIKASI COPY GLOBAL (STARTUP STYLE) */}
        <AnimatePresence>
          {showMenuLandingPopup && (
            <MenuLandingSection
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onOpenVision={handleOpenLanding}
              isOpen={showMenuLandingPopup}
              onClose={() => setShowMenuLandingPopup(false)}
              language={language}
            />
          )}

          {showInitialLanding && (
            <InitialLandingPage onClose={handleCloseLanding} />
          )}
        </AnimatePresence>

        {copyNotification && (
          <div className="fixed bottom-10 right-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-emerald-500/50 p-4 rounded-[2rem] shadow-2xl z-[200] animate-in slide-in-from-bottom-8 flex items-center gap-4 ring-8 ring-emerald-500/5">
            <div className="p-3 bg-emerald-500 rounded-2xl text-white shadow-lg shadow-emerald-500/30 animate-bounce">
              <CheckCircle2 size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-0.5">Copied to Clipboard</span>
              <span className="font-bold text-slate-800 dark:text-white text-sm">Berhasil menyalin {copyNotification}</span>
            </div>
          </div>
        )}
      </main>


      {/* MODAL SYSTEM */}
      <Modal
        isOpen={showRestoreForm}
        onClose={() => setShowRestoreForm(false)}
        title="Restore Box"
        size="max-w-md"
      >
        <div className="relative z-10 pt-4">
          <div className="flex justify-between items-center mb-6">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide uppercase mt-1">
                Kembalikan ke Gudang
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Truck className="text-white" size={24} />
            </div>
          </div>

          {/* Item Summary Card */}
          <div className="bg-white/50 dark:bg-slate-800/50 rounded-2xl p-4 border border-white/40 dark:border-white/5 mb-6 flex gap-4 items-center">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Package size={20} />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 dark:text-white text-lg">{selectedExternalItem?.boxId}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Dari: <span className="font-semibold text-indigo-500">{selectedExternalItem?.destination}</span>
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
                Pilih Slot Tujuan (Kosong)
              </label>
              <div className="relative">
                <select
                  className="w-full appearance-none bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer hover:bg-white/80 dark:hover:bg-slate-800/80"
                  value={restoreTargetSlot}
                  onChange={(e) => setRestoreTargetSlot(e.target.value)}
                >
                  <option value="">-- Pilih Slot Kosong --</option>
                  {inventory.filter(s => s.status === 'EMPTY').map(s => (
                    <option key={s.id} value={s.id}>Slot #{String(s.id).padStart(3, '0')}</option>
                  ))}
                </select>
                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" size={16} />
              </div>
              {restoreTargetSlot && (
                <p className="text-[10px] text-green-500 font-bold ml-1 flex items-center gap-1 animate-in fade-in slide-in-from-left-2">
                  <CheckCircle2 size={10} /> Slot tersedia
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setShowRestoreForm(false)}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleRestoreExternal}
                disabled={!restoreTargetSlot}
                className={`
                  flex-[2] px-4 py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 shadow-lg transition-all
                  ${!restoreTargetSlot
                    ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed text-slate-400'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 hover:shadow-indigo-500/25 hover:scale-[1.02] active:scale-95'
                  }
                `}
              >
                <ArrowRight size={18} />
                Konfirmasi
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          activeTab === 'master'
            ? (modalTab === 'user-create' ? 'Manajemen User'
              : modalTab === 'role-create' || modalTab === 'role-edit' ? 'Manajemen Role'
                : modalTab === 'dept-form' ? 'Manajemen Departemen'
                  : 'Master Data')
            : modalTab === 'tax-form' ? 'Input Data Pajak'
              : modalTab === 'tax-form-pph' ? 'Input Data PPh'
                : modalTab === 'tax-form-ppn' ? 'Input Data PPN'
                  : activeTab === 'documents'
                    ? (modalTab === 'upload' ? 'Upload Dokumen' : 'Detail Dokumen')
                    : modalTab === 'ocr-details' ? 'Antrian Background Process (OCR)'
                      : selectedSlotId ? `Slot #${selectedSlotId}` : `Detail Box Eksternal: ${boxForm?.boxId || ''}`
        }
      >
        {modalTab === 'upload' && (
          <UploadModal
            uploadForm={uploadForm}
            setUploadForm={setUploadForm}
            fileInputRef={fileInputRef}
            handleFileSelect={handleFileSelect}
            handleProcessDoc={handleProcessDoc}
          />
        )}

        {modalTab === 'ocr-details' && (
          <OcrQueueModal ocrStats={ocrStats} API_BASE={API_BASE} toast={toast} />
        )}
        <DocumentViewerModal
          modalTab={modalTab}
          viewDocData={viewDocData}
          handleDownload={handleDownload}
          isGeneratingPreview={isGeneratingPreview}
          getFullUrl={getFullUrl}
          pdfBlobUrl={pdfBlobUrl}
          previewHtml={previewHtml}
          handleRestoreVersion={handleRestoreVersion}
        />


        <InventoryModals
          modalTab={modalTab} setModalTab={setModalTab}
          selectedSlotId={selectedSlotId} selectedExternalItem={selectedExternalItem} inventory={inventory}
          boxForm={boxForm} setBoxForm={setBoxForm} hasPermission={hasPermission}
          newOrdner={newOrdner} setNewOrdner={setNewOrdner} addOrdner={addOrdner} editOrdner={editOrdner} removeOrdner={removeOrdner}
          expandedOrdnerIds={expandedOrdnerIds} setExpandedOrdnerIds={setExpandedOrdnerIds}
          newInvoice={newInvoice} setNewInvoice={setNewInvoice} addInvoice={addInvoice} editInvoice={editInvoice} removeInvoice={removeInvoice} handleViewInvoice={handleViewInvoice}
          editingItem={editingItem} showMoveInput={showMoveInput} setShowMoveInput={setShowMoveInput}
          moveTargetSlot={moveTargetSlot} setMoveTargetSlot={setMoveTargetSlot} handleMoveBox={handleMoveBox} handleSaveBox={handleSaveBox}
          handleStatusChange={handleStatusChange} setShowExternalForm={setShowExternalForm} setExternalDate={setExternalDate} handleEmptySlot={handleEmptySlot}
          invoiceFileInputRef={invoiceFileInputRef} handleInvoiceFileSelect={handleInvoiceFileSelect} fetchInventory={fetchInventory}
          selectedInvoice={selectedInvoice} handleDownloadInvoice={handleDownloadInvoice} isGeneratingPreview={isGeneratingPreview}
          getFullUrl={getFullUrl} pdfBlobUrl={pdfBlobUrl} previewHtml={previewHtml}
        />




        {/* MASTER DATA MODALS */}
        <MasterDataModals
          modalTab={modalTab}
          userForm={userForm} setUserForm={setUserForm} handleSaveUser={handleSaveUser}
          deptForm={deptForm} setDeptForm={setDeptForm} handleSaveDept={handleSaveDept}
          roleForm={roleForm} setRoleForm={setRoleForm} handleSaveRole={handleSaveRole}
          handleTogglePermission={handleTogglePermission}
          handleBulkPermission={handleBulkPermission}
          roles={roles} departments={departments} APP_MODULES={APP_MODULES}
        />

        <TaxModals
          modalTab={modalTab}
          taxForm={taxForm}
          setTaxForm={setTaxForm}
          handleAddTaxField={handleAddTaxField}
          handleDeleteTaxField={handleDeleteTaxField}
          handleSaveTaxSummary={handleSaveTaxSummary}
        />
      </Modal>

      {/* GLOBAL POPUPS - Root Level */}
      <Modal
        isOpen={showRestoreForm}
        onClose={() => setShowRestoreForm(false)}
        title="Restore Box"
        size="max-w-md"
      >
        <div className="relative z-10 pt-4">
          <div className="flex justify-between items-center mb-6">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide uppercase mt-1">
                Kembalikan ke Gudang
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Truck className="text-white" size={24} />
            </div>
          </div>

          {/* Item Summary Card */}
          <div className="bg-white/50 dark:bg-slate-800/50 rounded-2xl p-4 border border-white/40 dark:border-white/5 mb-6 flex gap-4 items-center">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Package size={20} />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 dark:text-white text-lg">{selectedExternalItem?.boxId}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Dari: <span className="font-semibold text-indigo-500">{selectedExternalItem?.destination}</span>
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
                Pilih Slot Tujuan (Kosong)
              </label>
              <div className="relative">
                <select
                  className="w-full appearance-none bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer hover:bg-white/80 dark:hover:bg-slate-800/80"
                  value={restoreTargetSlot}
                  onChange={(e) => setRestoreTargetSlot(e.target.value)}
                >
                  <option value="">-- Pilih Slot Kosong --</option>
                  {inventory.filter(s => s.status === 'EMPTY').map(s => (
                    <option key={s.id} value={s.id}>Slot #{String(s.id).padStart(3, '0')}</option>
                  ))}
                </select>
                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" size={16} />
              </div>
              {restoreTargetSlot && (
                <p className="text-[10px] text-green-500 font-bold ml-1 flex items-center gap-1 animate-in fade-in slide-in-from-left-2">
                  <CheckCircle2 size={10} /> Slot tersedia
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setShowRestoreForm(false)}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleRestoreExternal}
                disabled={!restoreTargetSlot}
                className={`
                  flex-[2] px-4 py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 shadow-lg transition-all
                  ${!restoreTargetSlot
                    ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed text-slate-400'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 hover:shadow-indigo-500/25 hover:scale-[1.02] active:scale-95'
                  }
                `}
              >
                <ArrowRight size={18} />
                Konfirmasi
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* GLOBAL POPUPS - Root Level */}
      <Modal
        isOpen={showExternalForm}
        onClose={() => setShowExternalForm(false)}
        title="Kirim ke Indoarsip"
        size="max-w-sm"
      >
        <div className="pt-4">
          <div className="w-16 h-16 rounded-[2rem] bg-indigo-600 text-white flex items-center justify-center shadow-2xl shadow-indigo-600/30 mx-auto mb-6">
            <Truck size={32} />
          </div>

          <p className="text-xs text-center text-slate-500 mb-8 font-black uppercase tracking-widest opacity-60">Tentukan Tanggal Pengiriman</p>

          <div className="space-y-6">
            <div className="relative group">
              <input
                type="date"
                value={externalDate}
                onChange={(e) => setExternalDate(e.target.value)}
                className="w-full px-6 py-4 text-lg font-black border-2 border-indigo-500/10 bg-slate-50 dark:bg-slate-800/50 rounded-2xl focus:border-indigo-500 transition-all outline-none dark:text-white"
              />
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleExternalTransfer('Indoarsip', externalDate)}
                className="w-full py-4 bg-indigo-600 text-white text-xs font-black rounded-2xl hover:bg-indigo-500 shadow-xl shadow-indigo-500/30 transition-all transform active:scale-95 uppercase tracking-widest"
              >
                Konfirmasi Pengiriman
              </button>
              <button
                onClick={() => setShowExternalForm(false)}
                className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white text-xs font-black rounded-2xl transition-all uppercase tracking-widest"
              >
                Batalkan
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* MODAL: VISUAL WORKFLOW DESIGNER */}
      <Modal
        isOpen={isFlowModalOpen}
        onClose={() => setIsFlowModalOpen(false)}
        title={editingFlow ? `Edit Alur: ${flowForm.name}` : "Desain Alur Baru"}
        size="max-w-7xl"
        noPadding
      >
        <div className="flex h-full min-h-0 flex-col">
          {/* Header Controls (Name & Description) */}
          <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Alur Persetujuan</label>
              <input
                className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none dark:text-white font-black"
                placeholder="Contoh: Alur Pengadaan Barang"
                value={flowForm.name}
                onChange={e => setFlowForm({ ...flowForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Deskripsi Singkat</label>
              <input
                className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none dark:text-white font-medium"
                placeholder="Tujuan dari alur persetujuan ini..."
                value={flowForm.description}
                onChange={e => setFlowForm({ ...flowForm, description: e.target.value })}
              />
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <WorkflowDesigner
              initialNodes={flowForm.visual_config?.nodes || []}
              initialEdges={flowForm.visual_config?.edges || []}
              users={users}
              onClose={() => setIsFlowModalOpen(false)}
              onSave={({ nodes, edges }) => {
                // Convert nodes to sequential steps for legacy compatibility (and backend logic)
                // Filter only 'approver' nodes and sort by graph position if needed
                // For now, we take all approver nodes
                const approverNodes = nodes.filter(n => n.type === 'approver');
                const steps = approverNodes.map(n => ({
                  username: n.data.username,
                  name: n.data.label,
                  nodeId: n.id,
                  instruction: n.data.instruction || n.data.notes || ''
                }));

                const sanitizedEdges = (edges || []).map(edge => ({
                  ...edge,
                  type: 'smoothstep',
                  style: { stroke: '#475569', strokeWidth: 3 },
                  markerEnd: { type: 'arrowclosed', color: '#475569', width: 25, height: 25 },
                  sourceHandle: (edge.sourceHandle === null || edge.sourceHandle === "null") ? undefined : edge.sourceHandle,
                  targetHandle: (edge.targetHandle === null || edge.targetHandle === "null") ? undefined : edge.targetHandle
                }));

                const updatedForm = {
                  ...flowForm,
                  steps: steps,
                  visual_config: { nodes, edges: sanitizedEdges }
                };

                // Save to state first
                setFlowForm(updatedForm);

                // Immediately call save logic to persist to backend
                // Wrap in a helper or call existing handleSaveFlow with the updated data
                handleSaveVisualFlow(updatedForm);
              }}
            />
          </div>
        </div>
      </Modal>


      {/* Toast Notification System */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <NotificationBell onOpenChannel={handleOpenNotificationChannel} />
      <OcrLanes />

      {/* Floating AI Chat Assistant - Dengan kontrol visibility untuk guest/viewer */}
      {currentUser && activeTab !== 'pustaka' && checkPermission(currentUser, roles, 'ai-chat', 'view') && (
        <AiChatAssistant
          isDarkMode={isDarkMode}
          onNavigateToDoc={handleViewDoc}
          onNavigateToInvoice={handleViewDoc}
          handleNavigateToFolder={handleNavigateToFolder}
          setActiveTab={setActiveTab}
          setActiveInvTab={setActiveInvTab}
          taxSummaries={taxSummaries}
          taxConfig={taxConfig}
        />
      )}
    </div>
  );
}
