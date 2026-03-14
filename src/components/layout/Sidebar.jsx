
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
    ClipboardCheck
} from 'lucide-react';

import { useAuthStore } from '../../store/useAuthStore';
import { useDocStore } from '../../store/useDocStore';
import { API_URL } from '../../services/apiClient';

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
        fixed inset-y-0 left-0 z-50 md:static md:z-0 transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)]
        ${isSidebarCollapsed ? 'w-24' : 'w-72'}
        bg-white/80 dark:bg-[#111C44]/80 backdrop-blur-2xl border-r border-white/20 dark:border-white/5 
        rounded-r-[2.5rem] shadow-2xl shadow-indigo-500/10 flex flex-col justify-between
        ${!isSidebarCollapsed && 'md:w-72'}
        transform ${!isSidebarCollapsed ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}
        >
            {/* Logo Section */}
            <div className={`flex items-center ${isSidebarCollapsed ? 'flex-col justify-center gap-4' : 'justify-between'} p-8 transition-all duration-300`}>
                <div className={`flex items-center gap-3 transition-all duration-300 ${isSidebarCollapsed ? 'scale-90' : ''}`}>
                    <div className="relative group cursor-pointer" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
                        <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-30 rounded-full group-hover:opacity-50 transition-opacity duration-300 animate-pulse-slow"></div>
                        <div className="w-10 h-10 relative z-10 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg transform group-hover:rotate-12 transition-transform duration-300">
                            <BookOpen className="text-white" size={24} />
                        </div>

                        {/* Collapsed OCR Badge */}
                        {isSidebarCollapsed && (ocrStats?.counts?.active > 0 || ocrStats?.counts?.waiting > 0) && (
                            <div
                                title={`Antrian OCR: ${ocrStats?.counts?.active || 0} Aktif, ${ocrStats?.counts?.waiting || 0} Menunggu`}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-blue-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-[#111C44] z-20 animate-bounce shadow-lg shadow-blue-500/40"
                            >
                                {(ocrStats?.counts?.active || 0) + (ocrStats?.counts?.waiting || 0)}
                            </div>
                        )}
                    </div>
                    {!isSidebarCollapsed && (
                        <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                            <h1 className="text-2xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#2B3674] to-[#A3AED0] dark:from-white dark:to-slate-400 font-display">
                                Pus<span className="text-indigo-500">Taka</span>
                            </h1>
                        </div>
                    )}
                </div>
                {!isSidebarCollapsed && (
                    <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="hidden md:flex w-8 h-8 items-center justify-center rounded-full bg-indigo-50 dark:bg-slate-800 text-indigo-500 dark:text-slate-400 hover:bg-indigo-100 hover:text-indigo-700 transition-all shadow-sm hover:scale-110">
                        <ChevronLeft size={18} />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-4 space-y-6 overflow-y-auto no-scrollbar relative">
                {[
                    {
                        category: 'GENERAL',
                        items: [
                            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                            { id: 'job-due-date', icon: ClipboardCheck, label: 'My Job' },
                            { id: 'pustaka', icon: BookOpen, label: 'Manual Book' },
                            { id: 'flow', icon: GitBranch, label: 'SOP' },
                        ]
                    },
                    {
                        category: 'Document',
                        items: [
                            { id: 'inventory', icon: Grid3x3, label: 'Filling' },
                            { id: 'documents', icon: FileStack, label: 'Documents' },
                            { id: 'approvals', icon: FileCheck, label: 'Approvals' },
                        ]
                    },
                    {
                        category: 'TAX & COMPLIANCE',
                        items: [
                            { id: 'tax-monitoring', icon: ShieldCheck, label: 'Compliance' },
                            { id: 'tax-calculation', icon: Calculator, label: 'Tax Calc' },
                            { id: 'tax-summary', icon: PieChart, label: 'Reporting' },
                        ]
                    },
                    {
                        category: 'SYSTEM',
                        items: [
                            { id: 'master', icon: Settings, label: 'Master Data' },
                        ]
                    }
                ].map((section, sectionIdx) => (
                    <div key={section.category} className="space-y-2">
                        {!isSidebarCollapsed && (
                            <h3 className="px-4 text-[10px] font-bold text-[#A3AED0] dark:text-slate-500 uppercase tracking-[0.2em] mb-2 animate-in fade-in slide-in-from-left-2 duration-500">
                                {section.category}
                            </h3>
                        )}
                        <div className="space-y-1">
                            {section.items.filter(item => hasPermission(item.id, 'view')).map((item) => {
                                const isActive = activeTab === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            setActiveTab(item.id);
                                            if (window.innerWidth < 768) setIsSidebarCollapsed(true);
                                        }}
                                        className={`
                                            w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-start'} gap-4 px-4 py-3.5 
                                            rounded-2xl transition-all duration-500 relative group active:scale-95 overflow-hidden
                                            ${isActive
                                                ? 'text-white shadow-lg shadow-indigo-500/25'
                                                : 'text-[#A3AED0] dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white'
                                            }
                                        `}
                                    >
                                        {/* Animated Background Indicator */}
                                        <div className={`
                                            absolute inset-0 bg-gradient-to-r from-[#4318FF] to-[#868CFF]
                                            transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                                            ${isActive ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full'}
                                        `} />

                                        {/* Hover Glow Effect */}
                                        <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                        <item.icon
                                            size={isSidebarCollapsed ? 24 : 20}
                                            strokeWidth={isActive ? 2.5 : 2}
                                            className={`relative z-10 transition-all duration-500 ${isActive ? 'scale-110' : 'group-hover:scale-110'} ${isActive ? 'text-white' : ''}`}
                                        />

                                        {!isSidebarCollapsed && (
                                            <span className={`relative z-10 font-bold tracking-tight text-sm transition-all duration-500 ${isActive ? 'translate-x-1' : ''} flex-1 text-left`}>
                                                {item.label}
                                            </span>
                                        )}

                                        {item.id === 'approvals' && unreadApprovalsCount > 0 && (
                                            <div className={`absolute ${isSidebarCollapsed ? 'top-1.5 right-1.5' : 'right-4 top-1/2 -translate-y-1/2'} w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md shadow-red-500/50 z-20 animate-pulse`}>
                                                {unreadApprovalsCount > 99 ? '99+' : unreadApprovalsCount}
                                            </div>
                                        )}

                                        {/* Collapsed Tooltip */}
                                        {isSidebarCollapsed && (
                                            <div className="absolute left-full ml-6 px-4 py-2 bg-[#1B254B] dark:bg-white text-white dark:text-[#1B254B] text-sm font-bold rounded-xl opacity-0 scale-90 -translate-x-2 group-hover:opacity-100 group-hover:scale-100 group-hover:translate-x-0 transition-all duration-300 whitespace-nowrap z-50 shadow-2xl origin-left pointer-events-none">
                                                <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-[#1B254B] dark:bg-white rotate-45 rounded-sm"></div>
                                                {item.label}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}

                {/* OCR STATUS WIDGET - CROSS-MENU MONITORING */}
                {!isSidebarCollapsed && (
                    <div className="mt-8 px-2">
                        <div
                            onClick={() => {
                                setModalTab('ocr-details');
                                setIsModalOpen(true);
                            }}
                            className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-4 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden transition-all duration-500 border border-white/10 cursor-pointer hover:scale-[1.02] active:scale-95 group/ocr"
                        >
                            <div className="absolute top-0 right-0 p-2 opacity-10">
                                <ScanLine size={60} />
                            </div>

                            <div className="relative z-10">
                                {((ocrStats?.counts?.active || 0) === 0 && (ocrStats?.counts?.waiting || 0) === 0) ? (
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm shrink-0">
                                            <CheckCircle2 size={16} className="text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-xs font-bold">OCR Siap</h3>
                                            <p className="text-blue-100 text-[10px]">Antrian kosong</p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex justify-between items-start mb-4">
                                            <h3 className="text-xs font-bold flex items-center gap-2">
                                                <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                                                Proses OCR...
                                            </h3>
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (window.confirm("Yakin ingin mereset antrian yang macet?")) {
                                                        try {
                                                            await fetch(`${API_URL}/ocr/reset`, {
                                                                method: 'POST',
                                                                credentials: 'include'
                                                            });
                                                            window.location.reload();
                                                        } catch (err) {
                                                            alert("Gagal reset: " + err.message);
                                                        }
                                                    }
                                                }
                                                }
                                                className="text-[8px] bg-white/10 hover:bg-white/20 px-2 py-1 rounded-md border border-white/20 transition-colors font-bold text-white uppercase"
                                            >
                                                Reset
                                            </button>
                                        </div>

                                        {(ocrStats?.activeJobs || []).length > 0 && (
                                            <div className="mb-4 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10">
                                                <div className="flex justify-between items-end mb-1.5">
                                                    <div className="min-w-0">
                                                        <p className="text-[8px] text-blue-100 font-black uppercase tracking-wider mb-0.5">Aktif</p>
                                                        <p className="text-[10px] font-bold truncate">{ocrStats.activeJobs[0].filename}</p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-sm font-black">{ocrStats.activeJobs[0].progress || 0}%</p>
                                                    </div>
                                                </div>
                                                <div className="w-full bg-black/20 rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className="bg-white h-full rounded-full transition-all duration-500 ease-out"
                                                        style={{ width: `${ocrStats.activeJobs[0].progress || 0}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="bg-white/10 backdrop-blur-md rounded-lg p-2 border border-white/10 text-center">
                                                <p className="text-[8px] text-blue-100 uppercase font-black mb-0.5">Antri</p>
                                                <p className="text-xs font-bold">{ocrStats?.counts?.waiting || 0}</p>
                                            </div>
                                            <div className="bg-white/10 backdrop-blur-md rounded-lg p-2 border border-white/10 text-center">
                                                <p className="text-[8px] text-blue-100 uppercase font-black mb-0.5">OK</p>
                                                <p className="text-xs font-bold">{ocrStats?.counts?.completed || 0}</p>
                                            </div>
                                            <div className="bg-white/10 backdrop-blur-md rounded-lg p-2 border border-white/10 text-center">
                                                <p className="text-[8px] text-blue-100 uppercase font-black mb-0.5">Fail</p>
                                                <p className="text-xs font-bold">{ocrStats?.counts?.failed || 0}</p>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </nav>

            {/* User Profile Footer */}
            <div className={`px-4 pb-8 pt-4 transition-all duration-300 ${isSidebarCollapsed ? 'flex flex-col items-center gap-4' : ''}`}>
                <div className={`
                    relative overflow-hidden transition-all duration-500 group
                    ${isSidebarCollapsed
                        ? 'bg-transparent p-0 w-full flex flex-col gap-4 items-center'
                        : 'bg-gradient-to-b from-indigo-50 to-white dark:from-indigo-900/20 dark:to-[#111C44] border border-white/50 dark:border-white/5 shadow-lg rounded-3xl p-1'
                    }
                `}>
                    {/* User Info Row */}
                    <div
                        className={`flex items-center cursor-pointer hover:bg-white/40 dark:hover:bg-indigo-800/20 transition-colors ${isSidebarCollapsed ? 'flex-col gap-1' : 'gap-3 p-3'}`}
                        onClick={() => {
                            setActiveTab('profile');
                            if (window.innerWidth < 768) setIsSidebarCollapsed(true);
                        }}
                    >
                        <div className={`
                            relative rounded-full bg-gradient-to-tr from-[#4318FF] to-[#868CFF] p-[3px] shadow-lg shadow-indigo-500/30 transition-transform duration-300 group-hover:scale-105
                            ${isSidebarCollapsed ? 'w-12 h-12' : 'w-10 h-10'}
                        `}>
                            <div className="w-full h-full rounded-full bg-white dark:bg-[#111C44] flex items-center justify-center overflow-hidden border-2 border-white dark:border-[#0B1437]">
                                <span className="font-extrabold text-xs text-[#4318FF]">{currentUser?.name?.substring(0, 2).toUpperCase()}</span>
                            </div>
                            {/* Online Dot */}
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white dark:border-[#111C44] rounded-full animate-pulse"></div>
                        </div>

                        {!isSidebarCollapsed && (
                            <div className="flex-1 min-w-0 animate-in fade-in duration-300">
                                <h4 className="font-bold text-sm text-[#2B3674] dark:text-white truncate">{currentUser?.name || 'Guest'}</h4>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold truncate">{currentUser?.role || 'Viewer'}</p>
                            </div>
                        )}
                        {!isSidebarCollapsed && (
                            <ChevronRight size={14} className="text-[#A3AED0] opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
                        )}
                    </div>

                    {/* Actions: Collapsed vs Expanded */}
                    {isSidebarCollapsed ? (
                        <>
                            {/* Collapsed Actions: Stacked Icons */}
                            <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:text-yellow-500 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-all hover:scale-110" title="Toggle Theme">
                                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                            </button>
                            <button onClick={handleLogout} className="w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all hover:scale-110" title="Logout">
                                <LogOut size={20} />
                            </button>
                        </>
                    ) : (
                        /* Expanded Actions: Horizontal Row */
                        <div className="flex items-center gap-2 mt-2 px-3 pb-3">
                            <button onClick={() => setIsDarkMode(!isDarkMode)} className="flex-1 flex items-center justify-center p-2.5 rounded-xl text-gray-400 bg-white dark:bg-slate-800 hover:text-yellow-500 shadow-sm hover:shadow-md transition-all border border-transparent hover:border-indigo-100 hover:-translate-y-0.5" title="Toggle Theme">
                                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                            </button>
                            <button onClick={handleLogout} className="flex-1 flex items-center justify-center p-2.5 rounded-xl text-gray-400 bg-white dark:bg-slate-800 hover:text-red-500 shadow-sm hover:shadow-md transition-all border border-transparent hover:border-red-100 hover:-translate-y-0.5" title="Logout">
                                <LogOut size={18} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </aside >
    );
};


export default Sidebar;
