
import React from 'react';
import {
    LayoutDashboard,
    Grid3x3,
    FileStack,
    ShieldCheck,
    PieChart,
    Settings,
    ChevronRight,
    ChevronLeft,
    User,
    Sun,
    Moon,
    LogOut,
    Calculator,
    ScanLine,
    CheckCircle2,
    X,
    FileCheck,
    BookOpen,
    GitBranch,
    ClipboardCheck,
    Languages,
    Pin,
    PinOff
} from 'lucide-react';

import './Sidebar.css';

import { useAuthStore } from '../../store/useAuthStore';
import { useDocStore } from '../../store/useDocStore';
import { API_URL } from '../../services/apiClient';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAppStore } from '../../store/useAppStore';

const Sidebar = ({
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    activeTab,
    setActiveTab,
    hasPermission,
    currentUser,
    isDarkMode,
    setIsDarkMode,
    handleLogout,
    ocrStats,
    setModalTab,
    setIsModalOpen,
    approvals = []
}) => {
    const { language, setLanguage, t } = useLanguage();
    const { isSidebarPinned, setIsSidebarPinned } = useAppStore();

    // Calculate unread approvals count
    const unreadApprovalsCount = React.useMemo(() => {
        if (!approvals || !currentUser) return 0;
        if (activeTab === 'approvals') return 0; // Sembunyikan badge sidebar jika sedang di tab approvals

        let readApprovals = [];
        try {
            readApprovals = JSON.parse(localStorage.getItem(`readApprovals_${currentUser.username}`) || '[]');
        } catch {
            readApprovals = [];
        }

        const visibleApprovals = approvals.filter(a => {
            if (!a) return false;
            const isAdmin = currentUser.role === 'admin';
            const isRequester = a.requester_username === currentUser.username;
            const isInTrail = (a.steps || []).some(step => step.approver_username === currentUser.username);
            return isAdmin || isRequester || isInTrail;
        });

        return visibleApprovals.filter(a => !readApprovals.includes(a.id)).length;
    }, [approvals, currentUser, activeTab]);

    return (
        <aside
            className={`
        fixed inset-y-0 left-0 z-50 md:static md:z-0 transition-all duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)]
        magic-sidebar ${!isSidebarCollapsed ? 'mobile-open' : ''} ${isSidebarPinned ? 'is-pinned' : ''}
        flex flex-col justify-between
      `}
        >
            {/* Logo Section */}
            <div className="logo-container h-20 flex items-center overflow-hidden transition-all duration-300">
                <div className="flex items-center w-full relative">
                    {/* Fixed Icon for Center alignment when collapsed */}
                    <div className="w-[72px] flex-shrink-0 flex items-center justify-center">
                        <div className="relative group cursor-pointer" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
                            <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-30 rounded-full group-hover:opacity-50 transition-opacity duration-300 animate-pulse-slow"></div>
                            <div className="w-10 h-10 relative z-10 flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/40 dark:to-[#111C44] rounded-xl shadow-lg transform group-hover:rotate-12 transition-transform duration-300 border border-white/20">
                                <BookOpen className="text-indigo-600 dark:text-indigo-400" size={22} />
                            </div>
                        </div>
                    </div>
                    {/* Sliding Label & Pin */}
                    <div className="label-wrapper flex-1 flex items-center justify-between pr-4 overflow-hidden transition-all duration-300">
                        <h1 className="text-xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#2B3674] to-[#A3AED0] dark:from-white dark:to-slate-400 font-display whitespace-nowrap opacity-0 transition-opacity duration-500 magic-sidebar-show-on-hover">
                            Pus<span className="text-indigo-500">Taka</span>
                        </h1>

                        <button
                            onClick={() => setIsSidebarPinned(!isSidebarPinned)}
                            className="p-2 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all opacity-0 magic-sidebar-show-on-hover"
                            title={isSidebarPinned ? 'Unpin Sidebar' : 'Pin Sidebar'}
                        >
                            {isSidebarPinned ? (
                                <PinOff size={16} className="rotate-45" />
                            ) : (
                                <Pin size={16} />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <nav className="flex-1 py-1 space-y-3 overflow-y-auto no-scrollbar relative magic-nav">
                {[
                    {
                        categoryKey: 'sidebar.category.general',
                        items: [
                            { id: 'dashboard', icon: LayoutDashboard, labelKey: 'sidebar.item.dashboard' },
                            { id: 'job-due-date', icon: ClipboardCheck, labelKey: 'sidebar.item.myJob' },
                            { id: 'pustaka', icon: BookOpen, labelKey: 'sidebar.item.manualBook' },
                            { id: 'flow', icon: GitBranch, labelKey: 'sidebar.item.sop' },
                        ]
                    },
                    {
                        categoryKey: 'sidebar.category.document',
                        items: [
                            { id: 'inventory', icon: Grid3x3, labelKey: 'sidebar.item.filling' },
                            { id: 'documents', icon: FileStack, labelKey: 'sidebar.item.documents' },
                            { id: 'approvals', icon: FileCheck, labelKey: 'sidebar.item.approvals' },
                        ]
                    },
                    {
                        categoryKey: 'sidebar.category.tax',
                        items: [
                            { id: 'tax-monitoring', icon: ShieldCheck, labelKey: 'sidebar.item.compliance' },
                            { id: 'tax-calculation', icon: Calculator, labelKey: 'sidebar.item.taxCalc' },
                            { id: 'tax-summary', icon: PieChart, labelKey: 'sidebar.item.reporting' },
                        ]
                    },
                    {
                        categoryKey: 'sidebar.category.system',
                        items: [
                            { id: 'master', icon: Settings, labelKey: 'sidebar.item.masterData' },
                        ]
                    }
                ].map((section, sectionIdx) => (
                    <div key={section.categoryKey} className="space-y-1">
                        <h3 className="magic-category">
                            {t(section.categoryKey)}
                        </h3>
                        <div className="space-y-1 magic-item-container">
                            {section.items.filter(item => hasPermission(item.id, 'view')).map((item) => {
                                const isActive = activeTab === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            setActiveTab(item.id);
                                            if (window.innerWidth < 768) setIsSidebarCollapsed(true);
                                        }}
                                        className={`magic-item ${isActive ? 'active' : ''}`}
                                    >
                                        <div className="icon-wrapper">
                                            <item.icon
                                                size={20}
                                                strokeWidth={isActive ? 2.5 : 2}
                                                className={`transition-all duration-300 ${isActive ? 'scale-110' : ''}`}
                                            />
                                            {item.id === 'approvals' && unreadApprovalsCount > 0 && (
                                                <div className="absolute top-2 right-2 w-3.5 h-3.5 bg-red-500 text-white text-[7px] font-bold rounded-full flex items-center justify-center shadow-md animate-pulse">
                                                    {unreadApprovalsCount > 99 ? '99+' : unreadApprovalsCount}
                                                </div>
                                            )}
                                        </div>

                                        <span className="label-wrapper">
                                            {t(item.labelKey)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}

                {/* OCR STATUS WIDGET - Only visible on hover/expand */}
                <div className="mt-4 px-4 magic-sidebar-show-on-hover opacity-0 transition-opacity duration-300">
                    {((ocrStats?.counts?.active || 0) > 0 || (ocrStats?.counts?.waiting || 0) > 0) && (
                        <div
                            onClick={() => {
                                setModalTab('ocr-details');
                                setIsModalOpen(true);
                            }}
                            className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-3 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden transition-all duration-500 border border-white/10 cursor-pointer hover:scale-[1.02] active:scale-95 group/ocr"
                        >
                            <div className="absolute top-0 right-0 p-2 opacity-10">
                                <ScanLine size={30} />
                            </div>
                            <div className="relative z-10">
                                <h3 className="text-[9px] font-bold flex items-center gap-2">
                                    <div className="w-1 h-1 bg-white rounded-full animate-ping"></div>
                                    OCR {t('sidebar.ocr.processing')}
                                </h3>
                                <div className="mt-1 flex justify-between items-end">
                                    <p className="text-[12px] font-black">{(ocrStats?.counts?.active || 0) + (ocrStats?.counts?.waiting || 0)}</p>
                                    <p className="text-[7px] opacity-80 uppercase font-bold">{t('sidebar.ocr.waiting')}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </nav>

            {/* Profile Section */}
            <div className="px-4 pb-6 pt-2 relative">
                <div className="magic-sidebar-show-on-hover opacity-0 transition-opacity duration-300">
                    <div
                        className="flex items-center gap-3 p-2 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors"
                        onClick={() => {
                            setActiveTab('profile');
                            if (window.innerWidth < 768) setIsSidebarCollapsed(true);
                        }}
                    >
                        <div className="relative rounded-full bg-gradient-to-tr from-[#4318FF] to-[#868CFF] p-[2px]">
                            <div className="w-7 h-7 rounded-full bg-white dark:bg-[#111C44] flex items-center justify-center overflow-hidden">
                                <span className="font-extrabold text-[9px] text-[#4318FF]">{currentUser?.name?.substring(0, 2).toUpperCase()}</span>
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-xs text-[#2B3674] dark:text-white truncate">{currentUser?.name || t('sidebar.user.guest')}</h4>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setLanguage(language === 'id' ? 'en' : 'id');
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 p-2 rounded-xl text-gray-400 hover:text-indigo-500 transition-all border border-gray-100 dark:border-slate-800"
                            title={t('settings.language.title')}
                        >
                            <Languages size={14} />
                            <span className="text-[10px] font-bold uppercase">{language}</span>
                        </button>
                        <button onClick={() => setIsDarkMode(!isDarkMode)} className="flex-1 flex items-center justify-center p-2 rounded-xl text-gray-400 hover:text-yellow-500 transition-all border border-gray-100 dark:border-slate-800">
                            {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
                        </button>
                        <button onClick={handleLogout} className="flex-1 flex items-center justify-center p-2 rounded-xl text-gray-400 hover:text-red-500 transition-all border border-gray-100 dark:border-slate-800">
                            <LogOut size={14} />
                        </button>
                    </div>
                </div>

                {/* Fixed Profile Icon for Collapsed State */}
                <div className="magic-sidebar-hide-on-hover absolute bottom-6 left-0 w-[72px] flex flex-col items-center justify-center transition-opacity duration-300 pointer-events-none">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#4318FF] to-[#868CFF] p-[2px] shadow-lg">
                        <div className="w-full h-full rounded-full bg-white dark:bg-[#111C44] flex items-center justify-center overflow-hidden">
                            <span className="font-extrabold text-[9px] text-[#4318FF]">{currentUser?.name?.substring(0, 2).toUpperCase()}</span>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
};


export default Sidebar;
