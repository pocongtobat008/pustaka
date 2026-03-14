import {
    CheckCircle2,
    Clock,
    AlertCircle,
    ArrowLeftRight,
    Truck,
    LogOut,
    FileSpreadsheet
} from 'lucide-react';

export const TOTAL_SLOTS = 100;

export const getStatusStyle = (status) => {
    switch (status) {
        case 'STORED': return {
            label: 'Tersimpan',
            color: 'bg-emerald-500/10 backdrop-blur-md border-emerald-500/30 text-emerald-700 dark:text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:bg-emerald-500/20 hover:border-emerald-500/50',
            icon: CheckCircle2
        };
        case 'BORROWED': return {
            label: 'Dipinjam',
            color: 'bg-amber-500/10 backdrop-blur-md border-amber-500/30 text-amber-700 dark:text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)] hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:bg-amber-500/20 hover:border-amber-500/50',
            icon: Clock
        };
        case 'AUDIT': return {
            label: 'Sedang Audit',
            color: 'bg-purple-500/10 backdrop-blur-md border-purple-500/30 text-purple-700 dark:text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.1)] hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:bg-purple-500/20 hover:border-purple-500/50',
            icon: AlertCircle
        };
        case 'MOVED': return {
            label: 'Pindah Rak',
            color: 'bg-blue-500/10 backdrop-blur-md border-blue-500/30 text-blue-700 dark:text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)] hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:bg-blue-500/20 hover:border-blue-500/50',
            icon: ArrowLeftRight
        };
        case 'EXTERNAL': return {
            label: 'Indoarsip',
            color: 'bg-indigo-500/10 backdrop-blur-md border-indigo-500/30 text-indigo-700 dark:text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.1)] hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:bg-indigo-500/20 hover:border-indigo-500/50',
            icon: Truck
        };
        case 'REMOVED': return {
            label: 'Keluar',
            color: 'bg-red-500/10 backdrop-blur-md border-red-500/30 text-red-700 dark:text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:bg-red-500/20 hover:border-red-500/50',
            icon: LogOut
        };
        case 'IMPORTED': return {
            label: 'Import Excel',
            color: 'bg-teal-500/10 backdrop-blur-md border-teal-500/30 text-teal-700 dark:text-teal-400 shadow-[0_0_15px_rgba(20,184,166,0.1)] hover:shadow-[0_0_20px_rgba(20,184,166,0.3)] hover:bg-teal-500/20 hover:border-teal-500/50',
            icon: FileSpreadsheet
        };
        default: return {
            label: 'Tersedia',
            color: 'bg-slate-500/5 backdrop-blur-md border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-500 hover:bg-slate-500/10 hover:border-slate-400',
            icon: null
        };
    }
};

export const APP_MODULES = {
    DASHBOARD: { id: 'dashboard', label: 'Dashboard', actions: ['view'] },
    INVENTORY: { id: 'inventory', label: 'Rak Gudang', actions: ['view', 'create', 'edit', 'delete'] },
    DOCUMENTS: { id: 'documents', label: 'Dokumen Digital', actions: ['view', 'create', 'edit', 'delete'] },
    TAX_MONITORING: { id: 'tax-monitoring', label: 'Monitoring Pemeriksaan', actions: ['view', 'create', 'edit', 'delete'] },
    TAX_SUMMARY: { id: 'tax-summary', label: 'Tax Summary', actions: ['view', 'create', 'edit', 'delete'] },
    MASTER_DATA: { id: 'master', label: 'Master Data', actions: ['view', 'create', 'edit', 'delete'] }
};
