import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    LayoutDashboard,
    Grid3x3,
    FileStack,
    ShieldCheck,
    PieChart,
    Settings,
    ChevronRight,
    ChevronDown,
    LogOut,
    Calculator,
    Search,
    BookOpen,
    GitBranch,
    ClipboardCheck,
    Languages,
    Receipt,
    FileSignature,
    FileCode2,
    Server,
    ListOrdered,
    Lock,
    Unlock,
    FileSpreadsheet,
    FlaskConical,
    Wand2,
    Palette,
} from 'lucide-react';

import './Sidebar.css';

import { useLanguage } from '../../contexts/LanguageContext';
import { useAppStore } from '../../store/useAppStore';

const MENU_SECTIONS = [
    {
        id: 'general',
        categoryKey: 'sidebar.category.general',
        items: [
            { id: 'dashboard', icon: LayoutDashboard, labelKey: 'sidebar.item.dashboard' },
            { id: 'job-due-date', icon: ClipboardCheck, labelKey: 'sidebar.item.myJob' },
            { id: 'pustaka', icon: BookOpen, labelKey: 'sidebar.item.manualBook' },
            { id: 'flow', icon: GitBranch, labelKey: 'sidebar.item.sop' },
        ],
    },
    {
        id: 'document',
        categoryKey: 'sidebar.category.document',
        items: [
            { id: 'inventory', icon: Grid3x3, labelKey: 'sidebar.item.filling' },
            { id: 'documents', icon: FileStack, labelKey: 'sidebar.item.documents' },
            { id: 'anydoc', icon: FileCode2, labelKey: 'sidebar.item.anydoc' },
            { id: 'ai-doc-intel', icon: FileSpreadsheet, labelKey: 'sidebar.item.aiDocIntel' },
            { id: 'ai-doc-train', icon: FlaskConical, labelKey: 'sidebar.item.aiDocTrain' },
            { id: 'ai-pdf-tools', icon: Wand2, labelKey: 'sidebar.item.aiPdfTools' },
        ],
    },
    {
        id: 'tax',
        categoryKey: 'sidebar.category.tax',
        items: [
            { id: 'tax-monitoring', icon: ShieldCheck, labelKey: 'sidebar.item.compliance' },
            { id: 'tax-calculation', icon: Calculator, labelKey: 'sidebar.item.taxCalc' },
            { id: 'tax-summary', icon: PieChart, labelKey: 'sidebar.item.reporting' },
        ],
    },
    {
        id: 'accounting',
        categoryKey: 'sidebar.category.accounting',
        items: [
            { id: 'entertainment', icon: Receipt, labelKey: 'sidebar.item.entertainment' },
            { id: 'invoices', icon: FileSignature, labelKey: 'sidebar.item.invoices' },
            { id: 'book', icon: ListOrdered, labelKey: 'sidebar.item.book' },
            { id: 'pdf-templates', icon: FileCode2, labelKey: 'sidebar.item.pdfTemplates', adminOnly: true },
        ],
    },
    {
        id: 'system',
        categoryKey: 'sidebar.category.system',
        items: [
            { id: 'master', icon: Settings, labelKey: 'sidebar.item.masterData' },
            { id: 'system-logs', icon: Server, labelKey: 'sidebar.item.systemLogs' },
            { id: 'component-showcase', icon: Palette, labelKey: 'sidebar.item.componentShowcase' },
        ],
    },
];

const Sidebar = ({
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    activeTab,
    setActiveTab,
    hasPermission,
    currentUser,
    handleLogout,
    ocrStats,
    setModalTab,
    setIsModalOpen,
    approvals = [],
}) => {
    const { language, setLanguage, t } = useLanguage();
    const { setIsSidebarPinned } = useAppStore();
    const [hovered, setHovered] = useState(false);

    const isAdmin = () => {
        const role = String(currentUser?.role || '').toLowerCase();
        return role === 'admin' || role === 'superadmin';
    };

    const unreadApprovalsCount = useMemo(() => {
        if (!approvals || !currentUser) return 0;
        if (activeTab === 'approvals') return 0;
        let readApprovals = [];
        try {
            readApprovals = JSON.parse(localStorage.getItem('readApprovals_' + currentUser.username) || '[]');
        } catch {
            readApprovals = [];
        }
        const visibleApprovals = approvals.filter(a => {
            if (!a) return false;
            const isAdminUser = currentUser.role === 'admin';
            const isRequester = a.requester_username === currentUser.username;
            const isInTrail = (a.steps || []).some(step => step.approver_username === currentUser.username);
            return isAdminUser || isRequester || isInTrail;
        });
        return visibleApprovals.filter(a => !readApprovals.includes(a.id)).length;
    }, [approvals, currentUser, activeTab]);

    const [paletteOpen, setPaletteOpen] = useState(false);
    const [paletteQuery, setPaletteQuery] = useState('');
    const paletteRef = useRef(null);

    const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
    const shortcutKey = isMac ? '\u2318K' : 'Ctrl K';

    const visibleSections = useMemo(
        () =>
            MENU_SECTIONS.map(sec => ({
                ...sec,
                items: sec.items.filter(item => hasPermission(item.id, 'view') && (!item.adminOnly || isAdmin())),
            })).filter(sec => sec.items.length > 0),
        [hasPermission]
    );

    // Flatten all visible items (for rail-mode icon grid)
    const flatNavItems = useMemo(
        () => visibleSections.flatMap(sec => sec.items),
        [visibleSections]
    );

    // Per-category expand state
    const storageKey = 'archive_sidebar_expanded';
    const [expandedCategories, setExpandedCategories] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
            return saved;
        } catch {
            return {};
        }
    });

    const toggleCategory = (catId) => {
        const next = { ...expandedCategories, [catId]: !expandedCategories[catId] };
        setExpandedCategories(next);
        localStorage.setItem(storageKey, JSON.stringify(next));
    };

    // Auto-expand the category containing the active tab
    useEffect(() => {
        visibleSections.forEach(sec => {
            const hasActive = sec.items.some(item => item.id === activeTab);
            if (hasActive && !expandedCategories[sec.id]) {
                setExpandedCategories(prev => ({ ...prev, [sec.id]: true }));
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, visibleSections]);

    useEffect(() => {
        const onKey = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setPaletteOpen(true);
            } else if (e.key === 'Escape') {
                setPaletteOpen(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    useEffect(() => {
        if (paletteOpen) {
            const id = setTimeout(() => paletteRef.current && paletteRef.current.focus(), 60);
            return () => clearTimeout(id);
        }
        setPaletteQuery('');
    }, [paletteOpen]);

    const paletteResults = useMemo(() => {
        const q = paletteQuery.trim().toLowerCase();
        const out = [];
        for (const sec of visibleSections) {
            for (const item of sec.items) {
                if (t(item.labelKey).toLowerCase().includes(q) || item.id.includes(q)) {
                    out.push({ ...item, sectionKey: sec.categoryKey });
                }
            }
        }
        return out;
    }, [paletteQuery, visibleSections, t]);

    const navigate = (id) => {
        setActiveTab(id);
        setPaletteOpen(false);
        if (window.innerWidth < 768) setIsSidebarCollapsed(true);
    };

    const isRail = isSidebarCollapsed;
    const isExpanded = !isSidebarCollapsed;
    const showLabels = isExpanded || hovered;

    // Lock button: toggle between rail (auto-collapse on leave) and expanded (locked)
    const handleLockToggle = () => {
        if (isRail) {
            // Expand and lock
            setIsSidebarCollapsed(false);
            setIsSidebarPinned(true);
            localStorage.setItem('archive_sidebar_pinned', 'true');
        } else {
            // Collapse (rail with hover-to-expand)
            setIsSidebarCollapsed(true);
            setIsSidebarPinned(false);
            localStorage.setItem('archive_sidebar_pinned', 'false');
        }
    };

    const sidebarRootClass = [
        'cf-sidebar fixed inset-y-0 left-0 z-50 md:static md:z-0',
        'flex flex-col overflow-hidden',
        'transition-all duration-300',
        'bg-white dark:bg-[#0b1437]',
        'border-r border-slate-200/50 dark:border-slate-700/50',
        // Rail mode: CSS handles width + hover expand
        isRail ? 'cf-rail' : 'cf-expanded',
    ].filter(Boolean).join(' ');

    // Mobile positioning
    const mobileBase = isRail ? '-translate-x-full md:translate-x-0' : 'translate-x-0';

    return (
        <aside
            className={sidebarRootClass + ' ' + mobileBase}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* Header: logo + name + lock button */}
            <div className={'h-16 flex items-center px-3 shrink-0 relative ' + (isRail && !showLabels ? 'border-b border-slate-200/5 dark:border-slate-700/5' : 'border-b border-slate-200/30 dark:border-slate-700/30')}>
                <div className="flex items-center gap-2">
                    <div className={'cf-logo-orb w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ' + (showLabels ? 'shadow-lg scale-100' : 'shadow-none scale-95')}>
                        <BookOpen size={16} className="text-white" strokeWidth={2.4} />
                    </div>
                    <div
                        className={
                            'cf-app-name transition-all duration-300 ' +
                            (showLabels ? 'opacity-100 w-auto' : 'opacity-0 w-0 pointer-events-none')
                        }
                    >
                        <div className="font-extrabold text-sm text-slate-800 dark:text-white leading-tight">Pustaka</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">v1.0.0</div>
                    </div>
                </div>

                {/* Lock button — top-right, fixed position during width transition */}
                <button
                    onClick={handleLockToggle}
                    className={
                        'cf-lock-btn absolute top-1/2 -translate-y-1/2 right-2 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300 ' +
                        (showLabels ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none')
                    }
                    title={isRail ? 'Kunci sidebar (perluas permanen)' : 'Buka kunci sidebar (auto collapse)'}
                >
                    {isRail ? <Unlock size={16} /> : <Lock size={16} />}
                </button>
            </div>

            {/* Search trigger */}
            <div className={'cf-search-box px-3 pb-2 pt-2 shrink-0 transition-all duration-300 ' + (!showLabels ? 'opacity-0 h-0 py-0 pointer-events-none' : 'opacity-100 h-auto')}>
                <button
                    onClick={() => setPaletteOpen(true)}
                    className="cf-search-trigger w-full h-9 px-3 flex items-center gap-2 rounded-xl text-slate-400 focus:outline-none text-sm"
                    title={shortcutKey}
                >
                    <Search size={15} className="shrink-0" />
                    <span className="flex-1 text-left truncate">{t('sidebar.search.placeholder')}</span>
                    <kbd className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-slate-100/80 dark:bg-slate-700 text-slate-400 font-semibold">{shortcutKey}</kbd>
                </button>
            </div>


            {/* Nav: flat icon grid (rail) or grouped accordion (expanded) */}
            <nav className="flex-1 overflow-y-auto py-2 px-3">
                {isRail && !showLabels ? (
                    /* Rail mode: clean flat icon grid — centered, perfectly sized */
                    <div className="flex flex-col items-center gap-1.5 py-2">
                        {flatNavItems.map(item => {
                            const isActive = activeTab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => navigate(item.id)}
                                    className={
                                        'cf-rail-item relative flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors ' +
                                        (isActive ? 'cf-active text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30' : '')
                                    }
                                    title={t(item.labelKey)}
                                >
                                    <item.icon size={20} strokeWidth={isActive ? 2.2 : 2} />
                                    {item.id === 'approvals' && unreadApprovalsCount > 0 && (
                                        <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                                            {unreadApprovalsCount > 99 ? '99+' : unreadApprovalsCount}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    /* Expanded / hover mode: grouped accordion with smooth animation */
                    <div className="space-y-1">
                        {visibleSections.map(section => {
                            const isGroupOpen = isRail ? true : expandedCategories[section.id] !== false;
                            const isActiveGroup = section.items.some(item => item.id === activeTab);

                            return (
                                <div key={section.id} className="cf-group">
                                    {/* Category header = MENU UTAMA (main menu) */}
                                    <button
                                        onClick={() => toggleCategory(section.id)}
                                        className={
                                            'cf-group-header flex items-center gap-2 w-full px-2.5 h-8 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ' +
                                            (isActiveGroup
                                                ? 'cf-header-active'
                                                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300')
                                        }
                                    >
                                        <ChevronDown
                                            size={13}
                                            className="shrink-0 transition-transform duration-200"
                                            style={{ transform: isGroupOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                                        />
                                        <span className="cf-category-text opacity-100">
                                            {t(section.categoryKey)}
                                        </span>
                                    </button>

                                    {/* Items = SUBMENU (indented, smooth expand animation) */}
                                    <div
                                        className={
                                            'cf-group-items space-y-0.5 ml-5 ' +
                                            (isGroupOpen ? 'cf-group-open' : 'cf-group-closed')
                                        }
                                    >
                                        {section.items.map(item => {
                                            const isActive = activeTab === item.id;
                                            return (
                                                <button
                                                    key={item.id}
                                                    onClick={() => navigate(item.id)}
                                                    className={
                                                        'cf-nav-subitem group relative flex items-center gap-2.5 rounded-lg text-sm transition-all h-9 px-2.5 ' +
                                                        (isActive ? 'cf-active' : 'cf-inactive')
                                                    }
                                                >
                                                    {/* Active left accent bar */}
                                                    <span
                                                        className={
                                                            'absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full transition-all ' +
                                                            (isActive
                                                                ? 'bg-gradient-to-b from-indigo-500 to-purple-600 opacity-100'
                                                                : 'opacity-0 group-hover:opacity-30')
                                                        }
                                                    />

                                                    {/* Icon */}
                                                    <span className="relative shrink-0 flex items-center justify-center">
                                                        <item.icon
                                                            size={16}
                                                            strokeWidth={isActive ? 2.2 : 1.8}
                                                            className={
                                                                'transition-colors ' +
                                                                (isActive
                                                                    ? 'text-indigo-600 dark:text-indigo-400'
                                                                    : 'text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 group-hover:dark:text-indigo-400')
                                                            }
                                                        />
                                                        {item.id === 'approvals' && unreadApprovalsCount > 0 && (
                                                            <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] px-0.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                                                                {unreadApprovalsCount > 99 ? '99+' : unreadApprovalsCount}
                                                            </span>
                                                        )}
                                                    </span>

                                                    {/* Label */}
                                                    <span className="cf-nav-label truncate whitespace-nowrap text-[13px] font-medium">
                                                        {t(item.labelKey)}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* OCR widget */}
                {!isRail && ((ocrStats && ocrStats.counts && (ocrStats.counts.active || 0)) > 0 || (ocrStats && ocrStats.counts && (ocrStats.counts.waiting || 0)) > 0) && (
                    <div
                        onClick={() => { setModalTab('ocr-details'); setIsModalOpen(true); }}
                        className="mt-4 mx-1 rounded-xl p-3 border border-indigo-100 dark:border-indigo-500/30 bg-indigo-50/70 dark:bg-indigo-500/10 cursor-pointer"
                    >
                        <div className="flex items-center justify-between">
                            <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-300 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>
                                OCR {t('sidebar.ocr.processing')}
                            </div>
                            <span className="text-sm font-black text-indigo-600 dark:text-indigo-300">
                                {(ocrStats.counts.active || 0) + (ocrStats.counts.waiting || 0)}
                            </span>
                        </div>
                    </div>
                )}
            </nav>

            {/* Footer: user + actions — hanya untuk mobile (desktop pakai dropdown profil di header) */}
            <div className={'md:hidden shrink-0 ' + (isRail && !showLabels ? 'border-t border-slate-200/10 dark:border-slate-700/10 p-2' : 'border-t border-slate-200/30 dark:border-slate-700/30 p-3')}>
                {isRail && !showLabels ? (
                    <div className="flex flex-col items-center gap-2">
                        <button
                            onClick={() => navigate('profile')}
                            className="w-9 h-9 rounded-full gradient-bg flex items-center justify-center text-white text-xs font-extrabold shadow-md"
                            title={currentUser && currentUser.name ? currentUser.name : t('sidebar.user.guest')}
                        >
                            {currentUser && currentUser.name ? currentUser.name.substring(0, 2).toUpperCase() : '?'}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setLanguage(language === 'id' ? 'en' : 'id'); }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors md:hidden"
                            title={t('settings.language.title')}
                        >
                            <Languages size={13} />
                        </button>
                        <button
                            onClick={handleLogout}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors md:hidden"
                            title="Logout"
                        >
                            <LogOut size={13} />
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="cf-user-card mb-2 px-2 py-2">
                            <button
                                onClick={() => navigate('profile')}
                                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-indigo-50/70 dark:hover:bg-indigo-900/20 text-left transition-colors"
                            >
                                <div className="w-9 h-9 rounded-full gradient-bg flex items-center justify-center text-[11px] font-extrabold text-white shrink-0 shadow-md">
                                    {currentUser && currentUser.name ? currentUser.name.substring(0, 2).toUpperCase() : '?'}
                                </div>
                                <span className="cf-user-label min-w-0 flex-1">
                                    <span className="block text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                                        {currentUser && currentUser.name ? currentUser.name : t('sidebar.user.guest')}
                                    </span>
                                    <span className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 truncate capitalize">
                                        {currentUser && currentUser.role ? currentUser.role : 'user'}
                                    </span>
                                </span>
                            </button>
                        </div>
                        {/* Aksi bahasa & logout hanya di mobile (desktop pakai dropdown profil di header) */}
                        <div className="grid grid-cols-2 gap-1.5 md:hidden">
                            <button
                                onClick={(e) => { e.stopPropagation(); setLanguage(language === 'id' ? 'en' : 'id'); }}
                                className="neo-btn flex items-center justify-center gap-1.5 h-9 text-slate-500 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-300 text-xs font-semibold"
                                title={t('settings.language.title')}
                            >
                                <Languages size={13} />
                                <span className="uppercase">{language}</span>
                            </button>
                            <button
                                onClick={handleLogout}
                                className="neo-btn flex items-center justify-center gap-1.5 h-9 text-slate-500 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-400 text-xs font-semibold"
                                title="Logout"
                            >
                                <LogOut size={13} />
                                <span className="hidden">{/* label kosong agar seimbang */}</span>
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Command Palette */}
            {paletteOpen && (
                <div
                    className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4 bg-black/40 backdrop-blur-sm"
                    onClick={() => setPaletteOpen(false)}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        className="cf-palette-panel w-full max-w-md rounded-2xl overflow-hidden"
                    >
                        <div className="flex items-center gap-2 px-4 h-12 border-b border-slate-100 dark:border-slate-700">
                            <Search size={16} className="text-slate-400" />
                            <input
                                ref={paletteRef}
                                value={paletteQuery}
                                onChange={e => setPaletteQuery(e.target.value)}
                                placeholder={t('sidebar.search.placeholder')}
                                className="flex-1 bg-transparent outline-none text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                            />
                            <kbd className="text-[9px] text-slate-400 border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5">ESC</kbd>
                        </div>
                        <div className="max-h-[55vh] overflow-y-auto p-2 saas-search-results">
                            {!paletteQuery.trim() ? (
                                <div className="px-3 py-6 text-center text-xs text-slate-400">
                                    {t('sidebar.search.placeholder')}
                                </div>
                            ) : paletteResults.length === 0 ? (
                                <div className="px-3 py-6 text-center text-xs text-slate-400">
                                    {t('sidebar.search.empty')}
                                </div>
                            ) : (
                                paletteResults.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => navigate(item.id)}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        <span className="w-7 h-7 rounded-md bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
                                            <item.icon size={15} />
                                        </span>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                            {t(item.labelKey)}
                                        </span>
                                        <ChevronRight size={14} className="ml-auto text-slate-300" />
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
};

export default Sidebar;
