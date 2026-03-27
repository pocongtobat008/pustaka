import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    Percent, FileBarChart, Trash2, Plus, ArrowUpRight, ArrowDownRight,
    TrendingUp, TrendingDown, LayoutGrid, List, SlidersHorizontal, Settings,
    ChevronDown, ArrowRight, Download, Calendar, Edit3, X, FileSpreadsheet, UploadCloud, Sparkles, AlertCircle, Search, Copy
} from 'lucide-react';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ComposedChart, PieChart, Pie, Cell
} from 'recharts';
import * as XLSX from 'xlsx';
import { api } from '../api';
import { parseApiError } from '../utils/errorHandler';
import { Card, SummaryCard } from '../components/ui/Card';
import { useLanguage } from '../contexts/LanguageContext';

// --- HELPERS ---
const getSafeValue = (record, type, category) => {
    if (!record) return 0;
    if (record.data && record.data[category] && record.data[category][type] !== undefined) {
        return record.data[category][type];
    }
    if (type === 'PPh 23') return record.pph23 || 0;
    if (type === 'PPh 4(2)') return record.pph42 || 0;
    return 0;
};

// --- TAB: COMPARISON COMPONENT ---
// Deklarasi dipindahkan ke luar fungsi utama untuk mencegah "reset state" akibat remounting di setiap re-render induk
const ComparisonTab = ({ sortedSummaries, config, onCopy, isEnglish }) => {
    const monthLabelMap = {
        Januari: 'January',
        Februari: 'February',
        Maret: 'March',
        April: 'April',
        Mei: 'May',
        Juni: 'June',
        Juli: 'July',
        Agustus: 'August',
        September: 'September',
        Oktober: 'October',
        November: 'November',
        Desember: 'December',
    };
    const t = {
        noData: isEnglish ? 'No data available for comparison yet.' : 'Belum ada data untuk dibandingkan.',
        modes: {
            manual: isEnglish ? 'Manual' : 'Manual',
            mom: isEnglish ? 'Month vs Month (Same Year)' : 'Bulan vs Bulan (Tahun Sama)',
            diffYear: isEnglish ? 'Month vs Month (Different Year)' : 'Bulan vs Bulan (Tahun Berbeda)',
            yoy: isEnglish ? 'Year vs Year (Same Month)' : 'Tahun vs Tahun (Bulan Sama)',
            rev: isEnglish ? 'Revision Comparison' : 'Perbandingan Pembetulan',
        },
        filter: isEnglish ? 'Filter:' : 'Filter:',
        allMonth: isEnglish ? 'All Months' : 'Semua Bulan',
        allYear: isEnglish ? 'All Years' : 'Semua Tahun',
        allRevision: isEnglish ? 'All Revisions' : 'Semua Pembetulan',
        choose: isEnglish ? 'Choose:' : 'Pilih:',
        pphComparison: isEnglish ? 'PPh Comparison' : 'Perbandingan PPh',
        ppnComparison: isEnglish ? 'PPN Comparison' : 'Perbandingan PPN',
        ppnInput: isEnglish ? 'Input VAT' : 'PPN Masukan',
        ppnOutput: isEnglish ? 'Output VAT' : 'PPN Keluaran',
        copyPeriodB: isEnglish ? 'Copy Period B Total PPh' : 'Salin Total PPh Periode B',
    };
    const monthDisplay = (m) => (isEnglish ? (monthLabelMap[m] || m) : m);
    const uniquePeriods = useMemo(() => {
        const groups = {};
        sortedSummaries.forEach(s => {
            const key = `${s.year}-${s.month}-${s.pembetulan || 0}`;
            if (!groups[key]) {
                groups[key] = {
                    key,
                    label: `${s.month} ${s.year}${s.pembetulan ? ` (Rev-${s.pembetulan})` : ''}`,
                    month: s.month,
                    year: s.year,
                    pembetulan: s.pembetulan || 0,
                    records: []
                };
            }
            groups[key].records.push(s);
        });

        const monthsList = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        return Object.values(groups).sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            if (a.month !== b.month) return monthsList.indexOf(a.month) - monthsList.indexOf(b.month);
            return a.pembetulan - b.pembetulan;
        });
    }, [sortedSummaries]);

    const [compMode, setCompMode] = useState('manual');
    const [compFilters, setCompFilters] = useState({ month: 'All', year: 'All', pembetulan: 'All' });

    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState('Januari');
    const [selectedMonthA, setSelectedMonthA] = useState('Januari');
    const [selectedMonthB, setSelectedMonthB] = useState('Februari');
    const [selectedYearA, setSelectedYearA] = useState(new Date().getFullYear() - 1);
    const [selectedYearB, setSelectedYearB] = useState(new Date().getFullYear());
    const [selectedRevA, setSelectedRevA] = useState(0);
    const [selectedRevB, setSelectedRevB] = useState(1);

    const filteredPeriods = useMemo(() => {
        if (compMode !== 'manual') return uniquePeriods;
        return uniquePeriods.filter(p => {
            if (compFilters.month !== 'All' && p.month !== compFilters.month) return false;
            if (compFilters.year !== 'All' && String(p.year) !== String(compFilters.year)) return false;
            if (compFilters.pembetulan !== 'All' && String(p.pembetulan) !== String(compFilters.pembetulan)) return false;
            return true;
        });
    }, [uniquePeriods, compFilters, compMode]);

    const [periodAKey, setPeriodAKey] = useState('');
    const [periodBKey, setPeriodBKey] = useState('');

    useEffect(() => {
        if (compMode === 'mom') {
            const findKey = (m, y) => {
                const candidates = uniquePeriods.filter(p => p.month === m && String(p.year) === String(y));
                if (candidates.length === 0) return '';
                return candidates.sort((a, b) => b.pembetulan - a.pembetulan)[0].key;
            };
            setPeriodAKey(findKey(selectedMonthA, selectedYear));
            setPeriodBKey(findKey(selectedMonthB, selectedYear));
        } else if (compMode === 'diff_year') {
            const findKey = (m, y) => {
                const candidates = uniquePeriods.filter(p => p.month === m && String(p.year) === String(y));
                if (candidates.length === 0) return '';
                return candidates.sort((a, b) => b.pembetulan - a.pembetulan)[0].key;
            };
            setPeriodAKey(findKey(selectedMonthA, selectedYearA));
            setPeriodBKey(findKey(selectedMonthB, selectedYearB));
        } else if (compMode === 'yoy') {
            const findKey = (m, y) => {
                const candidates = uniquePeriods.filter(p => p.month === m && String(p.year) === String(y));
                if (candidates.length === 0) return '';
                return candidates.sort((a, b) => b.pembetulan - a.pembetulan)[0].key;
            };
            setPeriodAKey(findKey(selectedMonth, selectedYearA));
            setPeriodBKey(findKey(selectedMonth, selectedYearB));
        } else if (compMode === 'rev') {
            const keyA = uniquePeriods.find(p => p.month === selectedMonth && String(p.year) === String(selectedYear) && String(p.pembetulan) === String(selectedRevA))?.key || '';
            const keyB = uniquePeriods.find(p => p.month === selectedMonth && String(p.year) === String(selectedYear) && String(p.pembetulan) === String(selectedRevB))?.key || '';
            setPeriodAKey(keyA);
            setPeriodBKey(keyB);
        } else {
            if (filteredPeriods.length > 0) {
                const isAValid = filteredPeriods.some(p => p.key === periodAKey);
                const isBValid = filteredPeriods.some(p => p.key === periodBKey);
                if (!isAValid || !isBValid) {
                    if (filteredPeriods.length > 1) {
                        if (!isAValid) setPeriodAKey(filteredPeriods[filteredPeriods.length - 2].key);
                        if (!isBValid) setPeriodBKey(filteredPeriods[filteredPeriods.length - 1].key);
                    } else {
                        if (!isAValid) setPeriodAKey(filteredPeriods[0].key);
                        if (!isBValid) setPeriodBKey(filteredPeriods[0].key);
                    }
                }
            }
        }
    }, [filteredPeriods, compMode, selectedYear, selectedMonth, selectedMonthA, selectedMonthB, selectedYearA, selectedYearB, selectedRevA, selectedRevB]);

    const getMergedData = (key) => {
        const group = uniquePeriods.find(p => p.key === key);
        if (!group) return {};
        const merged = {
            id: `merged-${key}`,
            month: group.month,
            year: group.year,
            pembetulan: group.pembetulan,
            data: { pph: {}, ppnIn: {}, ppnOut: {} }
        };
        group.records.forEach(r => {
            if (r.data?.pph) Object.entries(r.data.pph).forEach(([k, v]) => merged.data.pph[k] = (merged.data.pph[k] || 0) + (v || 0));
            if (r.data?.ppnIn) Object.entries(r.data.ppnIn).forEach(([k, v]) => merged.data.ppnIn[k] = (merged.data.ppnIn[k] || 0) + (v || 0));
            if (r.data?.ppnOut) Object.entries(r.data.ppnOut).forEach(([k, v]) => merged.data.ppnOut[k] = (merged.data.ppnOut[k] || 0) + (v || 0));
        });
        return merged;
    };

    const dataA = getMergedData(periodAKey);
    const dataB = getMergedData(periodBKey);
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const uniqueYears = [...new Set(sortedSummaries.map(s => s.year))].sort((a, b) => b - a);
    const uniquePembetulan = [...new Set(sortedSummaries.map(s => s.pembetulan || 0))].sort((a, b) => a - b);

    if (sortedSummaries.length === 0) return <div className="p-8 text-center text-gray-500">{t.noData}</div>;

    const renderDelta = (valA, valB) => {
        const diff = valB - valA;
        const percent = valA === 0 ? 0 : (diff / valA) * 100;
        const isPos = diff > 0;
        const isZero = diff === 0;

        return (
            <div className={`flex items-center gap-1 text-xs font-bold ${isZero ? 'text-gray-400' : isPos ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {isZero ? '-' : isPos ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {isZero ? '0%' : `${Math.abs(percent).toFixed(1)}%`}
                <span className="text-[10px] font-normal text-gray-500 ml-1">({diff > 0 ? '+' : ''}Rp {(diff / 1000).toFixed(0)}k)</span>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
            <Card className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 p-4">
                <div className="space-y-4">
                    <div className="flex gap-2 border-b border-gray-100 dark:border-slate-700 pb-4 overflow-x-auto">
                        {[
                            { id: 'manual', label: t.modes.manual },
                            { id: 'mom', label: t.modes.mom },
                            { id: 'diff_year', label: t.modes.diffYear },
                            { id: 'yoy', label: t.modes.yoy },
                            { id: 'rev', label: t.modes.rev }
                        ].map(mode => (
                            <button
                                key={mode.id}
                                onClick={() => setCompMode(mode.id)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${compMode === mode.id ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
                            >
                                {mode.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-wrap gap-3 items-center">
                        {compMode === 'manual' && (
                            <>
                                <span className="text-sm font-bold text-gray-500 mr-2">{t.filter}</span>
                                <select className="p-2 text-xs rounded-lg border dark:bg-slate-700 dark:border-slate-600" value={compFilters.month} onChange={e => setCompFilters(prev => ({ ...prev, month: e.target.value }))}>
                                    <option value="All">{t.allMonth}</option>
                                    {months.map(m => <option key={m} value={m}>{monthDisplay(m)}</option>)}
                                </select>
                                <select className="p-2 text-xs rounded-lg border dark:bg-slate-700 dark:border-slate-600" value={compFilters.year} onChange={e => setCompFilters(prev => ({ ...prev, year: e.target.value }))}>
                                    <option value="All">{t.allYear}</option>
                                    {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                                <select className="p-2 text-xs rounded-lg border dark:bg-slate-700 dark:border-slate-600" value={compFilters.pembetulan} onChange={e => setCompFilters(prev => ({ ...prev, pembetulan: e.target.value }))}>
                                    <option value="All">{t.allRevision}</option>
                                    {uniquePembetulan.map(p => <option key={p} value={p}>P-{p}</option>)}
                                </select>
                                <button onClick={() => setCompFilters({ month: 'All', year: 'All', pembetulan: 'All' })} className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg"><X size={16} /></button>
                            </>
                        )}

                        {compMode === 'mom' && (
                            <>
                                <span className="text-sm font-bold text-gray-500 mr-2">{t.choose}</span>
                                <select className="p-2 text-xs rounded-lg border dark:bg-slate-700 dark:border-slate-600" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                                    {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                                <div className="h-4 w-px bg-gray-300 mx-2"></div>
                                <select className="p-2 text-xs rounded-lg border dark:bg-slate-700 dark:border-slate-600" value={selectedMonthA} onChange={e => setSelectedMonthA(e.target.value)}>
                                    {months.map(m => <option key={m} value={m}>{monthDisplay(m)}</option>)}
                                </select>
                                <span className="text-xs text-gray-400">vs</span>
                                <select className="p-2 text-xs rounded-lg border dark:bg-slate-700 dark:border-slate-600" value={selectedMonthB} onChange={e => setSelectedMonthB(e.target.value)}>
                                    {months.map(m => <option key={m} value={m}>{monthDisplay(m)}</option>)}
                                </select>
                            </>
                        )}

                        {compMode === 'diff_year' && (
                            <>
                                <span className="text-sm font-bold text-gray-500 mr-2">{t.choose}</span>
                                <select className="p-2 text-xs rounded-lg border dark:bg-slate-700 dark:border-slate-600" value={selectedMonthA} onChange={e => setSelectedMonthA(e.target.value)}>
                                    {months.map(m => <option key={m} value={m}>{monthDisplay(m)}</option>)}
                                </select>
                                <select className="p-2 text-xs rounded-lg border dark:bg-slate-700 dark:border-slate-600" value={selectedYearA} onChange={e => setSelectedYearA(e.target.value)}>
                                    {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                                <span className="text-xs text-gray-400">vs</span>
                                <select className="p-2 text-xs rounded-lg border dark:bg-slate-700 dark:border-slate-600" value={selectedMonthB} onChange={e => setSelectedMonthB(e.target.value)}>
                                    {months.map(m => <option key={m} value={m}>{monthDisplay(m)}</option>)}
                                </select>
                                <select className="p-2 text-xs rounded-lg border dark:bg-slate-700 dark:border-slate-600" value={selectedYearB} onChange={e => setSelectedYearB(e.target.value)}>
                                    {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </>
                        )}

                        {compMode === 'yoy' && (
                            <>
                                <span className="text-sm font-bold text-gray-500 mr-2">{t.choose}</span>
                                <select className="p-2 text-xs rounded-lg border dark:bg-slate-700 dark:border-slate-600" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                                    {months.map(m => <option key={m} value={m}>{monthDisplay(m)}</option>)}
                                </select>
                                <div className="h-4 w-px bg-gray-300 mx-2"></div>
                                <select className="p-2 text-xs rounded-lg border dark:bg-slate-700 dark:border-slate-600" value={selectedYearA} onChange={e => setSelectedYearA(e.target.value)}>
                                    {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                                <span className="text-xs text-gray-400">vs</span>
                                <select className="p-2 text-xs rounded-lg border dark:bg-slate-700 dark:border-slate-600" value={selectedYearB} onChange={e => setSelectedYearB(e.target.value)}>
                                    {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </>
                        )}

                        {compMode === 'rev' && (
                            <>
                                <span className="text-sm font-bold text-gray-500 mr-2">{t.choose}</span>
                                <select className="p-2 text-xs rounded-lg border dark:bg-slate-700 dark:border-slate-600" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                                    {months.map(m => <option key={m} value={m}>{monthDisplay(m)}</option>)}
                                </select>
                                <select className="p-2 text-xs rounded-lg border dark:bg-slate-700 dark:border-slate-600" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                                    {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                                <div className="h-4 w-px bg-gray-300 mx-2"></div>
                                <select className="p-2 text-xs rounded-lg border dark:bg-slate-700 dark:border-slate-600" value={selectedRevA} onChange={e => setSelectedRevA(e.target.value)}>
                                    {uniquePembetulan.map(p => <option key={p} value={p}>P-{p}</option>)}
                                </select>
                                <span className="text-xs text-gray-400">vs</span>
                                <select className="p-2 text-xs rounded-lg border dark:bg-slate-700 dark:border-slate-600" value={selectedRevB} onChange={e => setSelectedRevB(e.target.value)}>
                                    {uniquePembetulan.map(p => <option key={p} value={p}>P-{p}</option>)}
                                </select>
                            </>
                        )}
                    </div>
                </div>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-900 dark:text-white">{t.pphComparison}</h3>
                        {dataB.data?.pph && (
                            <button
                                onClick={() => onCopy(Object.values(dataB.data.pph).reduce((a, b) => a + b, 0), "Total PPh Periode B")}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 transition-all"
                                title={t.copyPeriodB}
                            >
                                <Copy size={16} />
                            </button>
                        )}
                    </div>
                    <div className="space-y-3">
                        {config.pphTypes.map(t => {
                            const valA = getSafeValue(dataA, t, 'pph');
                            const valB = getSafeValue(dataB, t, 'pph');
                            return (
                                <div key={t} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                                    <div className="text-sm font-medium">{t}</div>
                                    <div className="text-right">
                                        <div className="text-sm font-bold dark:text-white">Rp {valB.toLocaleString()}</div>
                                        {renderDelta(valA, valB)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>

                <Card>
                    <h3 className="font-bold text-gray-900 dark:text-white mb-4">{t.ppnComparison}</h3>
                    <div className="space-y-4">
                        <div>
                            <h4 className="text-xs uppercase text-gray-500 font-bold mb-2">{t.ppnInput}</h4>
                            {config.ppnInTypes.map(t => {
                                const valA = getSafeValue(dataA, t, 'ppnIn');
                                const valB = getSafeValue(dataB, t, 'ppnIn');
                                return (
                                    <div key={t} className="flex justify-between items-center mb-1 text-sm border-b border-dashed border-gray-100 pb-1 last:border-0">
                                        <span className="text-gray-600 dark:text-slate-400">{t}</span>
                                        <div className="text-right flex items-center gap-3">
                                            <span>Rp {valB.toLocaleString()}</span>
                                            {renderDelta(valA, valB)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div>
                            <h4 className="text-xs uppercase text-gray-500 font-bold mb-2">{t.ppnOutput}</h4>
                            {config.ppnOutTypes.map(t => {
                                const valA = getSafeValue(dataA, t, 'ppnOut');
                                const valB = getSafeValue(dataB, t, 'ppnOut');
                                return (
                                    <div key={t} className="flex justify-between items-center mb-1 text-sm border-b border-dashed border-gray-100 pb-1 last:border-0">
                                        <span className="text-gray-600 dark:text-slate-400">{t}</span>
                                        <div className="text-right flex items-center gap-3">
                                            <span>Rp {valB.toLocaleString()}</span>
                                            {renderDelta(valA, valB)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};


export default function TaxSummary({ taxSummaries, hasPermission, setTaxForm, setModalTab, setIsModalOpen, config, saveConfig, handleDeleteRecord, handleRenameTaxType, onRefresh, onImport, onCopy }) {
    const { language } = useLanguage();
    const isEnglish = language === 'en';
    const [activeTab, setActiveTab] = useState('pph'); // pph, ppn, comparison
    const [viewMode, setViewMode] = useState('chart'); // chart, table
    const [filters, setFilters] = useState({ month: 'All', year: 'All', pembetulan: 'All', status: 'All' });
    const fileInputRef = useRef(null);
    const [importMode, setImportMode] = useState(null); // 'pph' or 'ppn'

    // Helper: Reset filters
    const resetFilters = () => setFilters({ month: 'All', year: 'All', pembetulan: 'All', status: 'All' });

    // Helper: Filter Logic
    const getFilteredData = (data, type) => {
        return data.filter(s => {
            // 1. Type Check (Start with base type)
            if (type === 'pph' && (s.type || 'PPH') !== 'PPH') return false;
            if (type === 'ppn' && s.type !== 'PPN') return false;

            // 2. Month Filter
            if (filters.month !== 'All' && s.month !== filters.month) return false;

            // 3. Year Filter
            if (filters.year !== 'All' && String(s.year) !== String(filters.year)) return false;

            // 4. Pembetulan Filter
            if (filters.pembetulan !== 'All' && String(s.pembetulan || 0) !== String(filters.pembetulan)) return false;

            // 5. Status Filter (PPN Only)
            if (type === 'ppn' && filters.status !== 'All') {
                const totalIn = config.ppnInTypes.reduce((acc, t) => acc + getSafeValue(s, t, 'ppnIn'), 0);
                const totalOut = config.ppnOutTypes.reduce((acc, t) => acc + getSafeValue(s, t, 'ppnOut'), 0);
                const net = totalOut - totalIn;

                if (filters.status === 'KB' && net <= 0) return false; // Want KB (>0)
                if (filters.status === 'LB' && net >= 0) return false; // Want LB (<0)
                if (filters.status === 'Nihil' && net !== 0) return false;
            }

            return true;
        });
    };

    // --- DYNAMIC CONFIGURATION (Now passed from App.jsx) ---
    // config and saveConfig are now props


    const handleAddType = (category) => {
        const name = prompt(isEnglish ? "Enter new tax type name:" : "Masukkan nama tipe pajak baru:");
        if (name && !config[category].includes(name)) {
            saveConfig({
                ...config,
                [category]: [...config[category], name]
            });
        }
    };

    const handleDeleteType = (category, typeId) => {
        if (window.confirm(isEnglish
            ? `Are you sure you want to delete column "${typeId}"? Historical data may no longer be visible.`
            : `Apakah Anda yakin ingin menghapus kolom "${typeId}"? Data historis mungkin tidak akan terlihat.`)) {
            const newTypes = config[category].filter(t => t !== typeId);
            saveConfig({
                ...config,
                [category]: newTypes
            });
        }
    };

    const handleEditRow = (record, type = 'all') => {
        // Construct form data from record
        const formData = {
            id: record.id,
            type: record.type || (activeTab === 'pph' ? 'PPH' : 'PPN'),
            month: record.month,
            year: record.year,
            pembetulan: record.pembetulan || 0,
            data: {
                pph: {},
                ppnIn: {},
                ppnOut: {}
            }
        };

        // Populate PPh
        config.pphTypes.forEach(t => { formData.data.pph[t] = getSafeValue(record, t, 'pph'); });
        // Populate PPN In
        config.ppnInTypes.forEach(t => { formData.data.ppnIn[t] = getSafeValue(record, t, 'ppnIn'); });
        // Populate PPN Out
        config.ppnOutTypes.forEach(t => { formData.data.ppnOut[t] = getSafeValue(record, t, 'ppnOut'); });

        setTaxForm(formData);
        // Determine modal tab based on active tab or passed type
        if (type === 'pph') setModalTab('tax-form-pph');
        else if (type === 'ppn') setModalTab('tax-form-ppn');
        else setModalTab(activeTab === 'pph' ? 'tax-form-pph' : 'tax-form-ppn'); // Default fallback
        setIsModalOpen(true);
    };

    const getSmartInsight = () => {
        // 1. Konteks Filter
        if (filters.month !== 'All' || filters.year !== 'All') {
            return {
                text: isEnglish
                    ? `Filter Analysis: Showing data for period ${filters.month !== 'All' ? filters.month : ''} ${filters.year !== 'All' ? filters.year : ''}. AI is comparing compliance trends for this period.`
                    : `Analisis Filter: Menampilkan data untuk periode ${filters.month !== 'All' ? filters.month : ''} ${filters.year !== 'All' ? filters.year : ''}. AI membandingkan tren kepatuhan pada periode ini.`,
                icon: <Search className="text-indigo-500" size={20} />,
                color: "border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-900/10 text-indigo-800 dark:text-indigo-200"
            };
        }

        // 2. Analisis Data Kosong (Bulan Berjalan)
        const now = new Date();
        const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const currentMonth = months[now.getMonth()];
        const currentYear = now.getFullYear();
        const hasCurrent = taxSummaries.some(s => s.month === currentMonth && s.year === currentYear);
        if (!hasCurrent) {
            return {
                text: isEnglish
                    ? `Reporting Reminder: Data for ${currentMonth} ${currentYear} is not available yet. Please input or import data to keep dashboard validity.`
                    : `Pengingat Laporan: Data untuk ${currentMonth} ${currentYear} belum tersedia. Segera lakukan input atau import data untuk menjaga validitas dashboard.`,
                icon: <AlertCircle className="text-amber-500" size={20} />,
                color: "border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-200"
            };
        }

        // 3. Analisis Kualitas (Banyak Pembetulan)
        const highRev = taxSummaries.filter(s => (s.pembetulan || 0) > 1).length;
        if (highRev > 0) {
            return {
                text: isEnglish
                    ? `Quality Analysis: Detected ${highRev} reports with revision > 1. It is recommended to review master data before final reporting.`
                    : `Analisis Kualitas: Terdeteksi ${highRev} laporan dengan pembetulan > 1. Disarankan untuk melakukan review data master sebelum pelaporan final.`,
                icon: <TrendingUp className="text-blue-500" size={20} />,
                color: "border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-900/10 text-blue-800 dark:text-blue-200"
            };
        }

        // 4. Default Tips
        const tips = [
            isEnglish
                ? "AI Tip: Use the 'Comparison' feature to inspect payment anomalies across periods in depth."
                : "Tips AI: Gunakan fitur 'Perbandingan' untuk melihat anomali pembayaran antar periode secara mendalam.",
            isEnglish
                ? "Info: PPh and PPN templates will auto-adjust when you add a new tax type column."
                : "Info: Template PPh dan PPN akan otomatis menyesuaikan jika Anda menambahkan kolom tipe pajak baru.",
            isEnglish
                ? "Suggestion: Export reports periodically as a backup for company tax compliance data."
                : "Saran: Lakukan ekspor laporan secara berkala sebagai backup data kepatuhan pajak perusahaan.",
            isEnglish
                ? "Optimal System: Input and Output VAT calculations are synchronized with the WP database."
                : "Sistem Optimal: Semua perhitungan PPN Masukan dan Keluaran telah disinkronkan dengan database WP."
        ];
        return {
            text: tips[new Date().getHours() % tips.length],
            icon: <Sparkles className="text-emerald-500" size={20} />,
            color: "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/10 text-emerald-800 dark:text-emerald-200"
        };
    };

    const insight = getSmartInsight();

    // --- COMPUTED DATA HELPERS ---
    const getSafeValue = (record, type, category) => {
        // Handle legacy vs new structure
        if (!record) return 0;
        // Check dynamic data object first
        if (record.data && record.data[category] && record.data[category][type] !== undefined) {
            return record.data[category][type];
        }
        // Fallback for legacy PPh23/42/etc if needed, or return 0
        if (type === 'PPh 23') return record.pph23 || 0;
        if (type === 'PPh 4(2)') return record.pph42 || 0;
        return 0;
    };

    // --- EXCEL IMPORT/EXPORT HANDLERS ---
    const downloadTemplate = (type) => {
        // Create headers based on dynamic config
        const isPPh = type === 'pph';
        const headers = [
            "Template Type", "Month (1-12)", "Year", "Pembetulan",
            ...(isPPh
                ? config.pphTypes
                : [
                    ...config.ppnInTypes.map(t => `IN_${t}`),
                    ...config.ppnOutTypes.map(t => `OUT_${t}`)
                ]
            )
        ];

        const exampleRow = [
            isPPh ? "PPH" : "PPN", 1, new Date().getFullYear(), 0,
            ...(isPPh ? config.pphTypes.map(() => 0) : [...config.ppnInTypes.map(() => 0), ...config.ppnOutTypes.map(() => 0)])
        ];

        const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, isPPh ? "Template PPh" : "Template PPN");
        XLSX.writeFile(wb, `Template_Import_${isPPh ? 'PPh' : 'PPN'}.xlsx`);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !importMode) return;

        const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

        try {
            const data = await file.arrayBuffer();
            const wb = XLSX.read(data);
            const ws = wb.Sheets[wb.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(ws);

            if (jsonData.length === 0) {
                alert(isEnglish ? "File is empty." : "File kosong.");
                return;
            }

            // --- 1. DETEKSI KOLOM BARU (DYNAMIC CONFIG UPDATE) ---
            // Scan semua baris untuk mendapatkan semua key (kolom) yang mungkin tidak ada di baris pertama
            const allKeys = new Set();
            jsonData.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)));
            const fileKeys = Array.from(allKeys);
            const standardKeys = ["Month (1-12)", "Month", "Bulan", "Year", "Tahun", "Pembetulan", "Type", "No", "No.", "Template Type"];

            // --- VALIDASI PROTEKSI PPH vs PPN ---
            const hasPpnMarkers = fileKeys.some(k => {
                const uk = k.trim().toUpperCase();
                return uk.startsWith('IN_') || uk.startsWith('OUT_');
            });
            const fileTypeMarker = String(jsonData[0]?.["Template Type"] || "").toUpperCase();

            if (importMode === 'ppn' && (fileTypeMarker === 'PPH' || (!hasPpnMarkers && fileTypeMarker !== 'PPN'))) {
                alert(isEnglish
                    ? "⚠️ PPN Import Failed: This file is detected as a PPh template. Please use the 'Import PPh' button or use the correct PPN template."
                    : "⚠️ Gagal Import PPN: File ini terdeteksi sebagai template PPh. Harap gunakan tombol 'Import PPh' atau gunakan template PPN yang benar.");
                return;
            }

            if (importMode === 'pph' && (fileTypeMarker === 'PPN' || hasPpnMarkers)) {
                alert(isEnglish
                    ? "⚠️ PPh Import Failed: This file is detected as a PPN template. Please use the 'Import PPN' button or use the correct PPh template."
                    : "⚠️ Gagal Import PPh: File ini terdeteksi sebagai template PPN. Harap gunakan tombol 'Import PPN' atau gunakan template PPh yang benar.");
                return;
            }

            // Gunakan copy dari config agar bisa langsung dipakai parsing di bawah
            let localConfig = JSON.parse(JSON.stringify(config));
            let configChanged = false;
            let newColumns = [];

            if (importMode === 'pph') {
                // Semua kolom selain standard dianggap tipe PPh baru
                const potentialTypes = fileKeys.filter(k => !standardKeys.includes(k) && !k.startsWith('__EMPTY'));
                potentialTypes.forEach(type => {
                    const cleanType = type.trim();
                    if (!localConfig.pphTypes.includes(cleanType)) {
                        localConfig.pphTypes.push(cleanType);
                        newColumns.push(cleanType);
                        configChanged = true;
                    }
                });
            } else {
                // PPN: Cari prefix IN_ dan OUT_
                fileKeys.forEach(key => {
                    const cleanKey = key.trim();
                    if (standardKeys.includes(cleanKey) || cleanKey.startsWith('__EMPTY')) return;

                    // Fuzzy match check (e.g. "Lain lain" matches "Lain-lain")
                    const normalizedKey = cleanKey.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const matchIn = localConfig.ppnInTypes.find(t => t.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedKey);
                    const matchOut = localConfig.ppnOutTypes.find(t => t.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedKey);

                    if (matchIn || matchOut) {
                        // Already exists (fuzzy or exact), no need to add new type
                        return;
                    }

                    if (cleanKey.toUpperCase().startsWith('IN_')) {
                        const type = cleanKey.substring(3).trim();
                        if (!localConfig.ppnInTypes.includes(type)) {
                            localConfig.ppnInTypes.push(type);
                            newColumns.push(`IN: ${type}`);
                            configChanged = true;
                        }
                    } else if (cleanKey.toUpperCase().startsWith('OUT_')) {
                        const type = cleanKey.substring(4).trim();
                        if (!localConfig.ppnOutTypes.includes(type)) {
                            localConfig.ppnOutTypes.push(type);
                            newColumns.push(`OUT: ${type}`);
                            configChanged = true;
                        }
                    } else {
                        // Handle columns without prefix (e.g. "FOC") -> Default to PPN Out
                        const type = cleanKey;
                        // Only add if not already in IN or OUT lists
                        if (!localConfig.ppnInTypes.includes(type) && !localConfig.ppnOutTypes.includes(type)) {
                            localConfig.ppnOutTypes.push(type);
                            newColumns.push(`OUT: ${type} (Auto)`);
                            configChanged = true;
                        }
                    }
                });
            }

            if (configChanged) {
                saveConfig(localConfig); // Simpan ke App state / LocalStorage
                alert(isEnglish
                    ? `Added new columns: ${newColumns.join(', ')}`
                    : `Menambahkan kolom baru: ${newColumns.join(', ')}`);
            }

            const payloads = [];

            for (const row of jsonData) {
                // Convert Month Number to Name
                let monthVal = row["Month (1-12)"] || row["Month"] || row["Bulan"];
                let monthName = "";

                if (typeof monthVal === 'number' && monthVal >= 1 && monthVal <= 12) {
                    monthName = months[monthVal - 1];
                } else if (typeof monthVal === 'string') {
                    const parsed = parseInt(monthVal);
                    if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) monthName = months[parsed - 1];
                    else monthName = months.find(m => m.toLowerCase() === monthVal.toLowerCase()) || "";
                }

                if (!monthName) continue; // Skip invalid month

                // Construct payload structure
                const payload = {
                    month: monthName,
                    year: row.Year || row.Tahun || new Date().getFullYear(),
                    pembetulan: row.Pembetulan !== undefined ? row.Pembetulan : 0,
                    type: importMode.toUpperCase(),
                    data: {
                        pph: {},
                        ppnIn: {},
                        ppnOut: {}
                    }
                };

                // Gunakan localConfig yang sudah diupdate untuk mapping
                if (importMode === 'pph') {
                    localConfig.pphTypes.forEach(t => {
                        // Cari key di file yang cocok (dengan trim)
                        const key = fileKeys.find(k => k.trim() === t);
                        if (key && row[key] !== undefined) payload.data.pph[t] = Number(row[key]) || 0;
                    });
                } else {
                    // PPN
                    localConfig.ppnInTypes.forEach(t => {
                        // Cari key yang cocok dengan format IN_Nama
                        let key = fileKeys.find(k => k.trim() === `IN_${t}`);
                        // Fallback: check exact match if not found with prefix
                        if (!key) key = fileKeys.find(k => k.trim() === t);
                        // Fallback: Fuzzy match (e.g. "Lain lain" -> "Lain-lain")
                        if (!key) {
                            const normT = t.toLowerCase().replace(/[^a-z0-9]/g, '');
                            key = fileKeys.find(k => k.trim().toLowerCase().replace(/[^a-z0-9]/g, '') === normT);
                        }
                        if (key && row[key] !== undefined) payload.data.ppnIn[t] = Number(row[key]) || 0;
                    });
                    localConfig.ppnOutTypes.forEach(t => {
                        let key = fileKeys.find(k => k.trim() === `OUT_${t}`);
                        // Fallback: check exact match (e.g. for "FOC")
                        if (!key) key = fileKeys.find(k => k.trim() === t);
                        // Fallback: Fuzzy match
                        if (!key) {
                            const normT = t.toLowerCase().replace(/[^a-z0-9]/g, '');
                            key = fileKeys.find(k => k.trim().toLowerCase().replace(/[^a-z0-9]/g, '') === normT);
                        }
                        if (key && row[key] !== undefined) payload.data.ppnOut[t] = Number(row[key]) || 0;
                    });
                }

                payloads.push(payload);
            }

            if (payloads.length > 0 && onImport) {
                onImport(payloads);
            }
        } catch (error) {
            console.error("Import failed", error);
            const msg = await parseApiError(error);
            alert((isEnglish ? "Failed to import file: " : "Gagal mengimport file: ") + msg);
        } finally {
            setImportMode(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // --- FILTER UI COMPONENT ---
    const renderFilterControls = (type) => {
        const uniqueYears = [...new Set(taxSummaries.map(s => s.year))].sort((a, b) => b - a);
        const uniquePembetulan = [...new Set(taxSummaries.map(s => s.pembetulan || 0))].sort((a, b) => a - b);
        const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

        return (
            <div className="flex flex-wrap gap-2 items-center bg-gray-50 dark:bg-slate-800 p-2 rounded-lg">
                <select
                    className="p-1.5 text-xs rounded border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                    value={filters.month}
                    onChange={e => setFilters(prev => ({ ...prev, month: e.target.value }))}
                >
                    <option value="All">{isEnglish ? 'All Months' : 'Semua Bulan'}</option>
                    {months.map(m => <option key={m} value={m}>{m}</option>)}
                </select>

                <select
                    className="p-1.5 text-xs rounded border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                    value={filters.year}
                    onChange={e => setFilters(prev => ({ ...prev, year: e.target.value }))}
                >
                    <option value="All">{isEnglish ? 'All Years' : 'Semua Tahun'}</option>
                    {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>

                <select
                    className="p-1.5 text-xs rounded border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                    value={filters.pembetulan}
                    onChange={e => setFilters(prev => ({ ...prev, pembetulan: e.target.value }))}
                >
                    <option value="All">{isEnglish ? 'All Revisions' : 'Semua Pembetulan'}</option>
                    {uniquePembetulan.map(p => <option key={p} value={p}>P-{p}</option>)}
                </select>

                {type === 'ppn' && (
                    <select
                        className="p-1.5 text-xs rounded border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                        value={filters.status}
                        onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    >
                        <option value="All">{isEnglish ? 'All Statuses' : 'Semua Status'}</option>
                        <option value="KB">{isEnglish ? 'Underpaid' : 'Kurang Bayar'}</option>
                        <option value="LB">{isEnglish ? 'Overpaid' : 'Lebih Bayar'}</option>
                        <option value="Nihil">Nihil</option>
                    </select>
                )}

                <button onClick={resetFilters} className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded" title={isEnglish ? 'Reset Filter' : 'Reset Filter'}>
                    <X size={14} />
                </button>
            </div>
        );
    };

    const sortedSummaries = useMemo(() => {
        const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        return [...taxSummaries].sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return months.indexOf(a.month) - months.indexOf(b.month);
        });
    }, [taxSummaries]);

    // --- TAB: PPH RENDERER ---
    const renderPPhTab = () => {
        // Transform data for charts
        const chartData = sortedSummaries.filter(s => (s.type || 'PPH') === 'PPH').map(s => {
            const item = { name: `${s.month} ${s.year}` };
            config.pphTypes.forEach(type => {
                item[type] = getSafeValue(s, type, 'pph');
            });
            return item;
        });

        const totalPerType = config.pphTypes.reduce((acc, type) => {
            acc[type] = sortedSummaries.reduce((sum, s) => sum + getSafeValue(s, type, 'pph'), 0);
            return acc;
        }, {});

        const grandTotalPPh = Object.values(totalPerType).reduce((a, b) => a + b, 0);

        return (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                {/* 1. Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* GRAND TOTAL CARD WITH COPY FUNCTION */}
                    <div className="p-4 bg-indigo-600 rounded-2xl border border-indigo-500 shadow-lg relative overflow-hidden group">
                        <div className="absolute right-0 top-0 w-16 h-16 bg-white/10 rounded-bl-3xl -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                        <h4 className="text-[10px] text-indigo-100 font-black uppercase tracking-[0.2em] mb-1">Estimasi PPh Terutang</h4>
                        <div className="flex items-center justify-between relative z-10">
                            <p className="text-lg font-black text-white">
                                Rp {grandTotalPPh.toLocaleString('id-ID')}
                            </p>
                            <button
                                onClick={(e) => { e.stopPropagation(); onCopy(grandTotalPPh, "Estimasi PPh Terutang"); }}
                                className="p-2 bg-white/20 hover:bg-white/30 rounded-xl text-white transition-all active:scale-90"
                                title="Salin Total"
                            >
                                <Copy size={16} />
                            </button>
                        </div>
                    </div>

                    {config.pphTypes.map(type => (
                        <div key={type} className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-indigo-100 dark:border-slate-700 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                            <div className="absolute right-0 top-0 w-16 h-16 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-bl-3xl -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                            <div className="flex justify-between items-start">
                                <h4 className="text-xs text-gray-500 dark:text-slate-400 font-semibold uppercase tracking-wider mb-1">{type}</h4>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onCopy(totalPerType[type], type); }}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 transition-all"
                                >
                                    <Copy size={12} />
                                </button>
                            </div>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">
                                Rp {(totalPerType[type] / 1000000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} Jt
                            </p>
                        </div>
                    ))}
                    {hasPermission('tax-summary', 'edit') && (
                        <button onClick={() => handleAddType('pphTypes')} className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-2xl text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors">
                            <Plus size={20} />
                            <span className="text-xs font-medium mt-1">{isEnglish ? 'Add Tax Type' : 'Tambah Tipe Pajak'}</span>
                        </button>
                    )}
                </div>

                {/* 2. Main Chart */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 2. Main Chart */}
                    <Card className="lg:col-span-2">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                                    <Percent size={20} className="text-indigo-500" /> Tren PPh (Year to Date)
                                </h3>
                                <p className="text-sm text-gray-500">{isEnglish ? 'Accumulated income tax payments per month.' : 'Akumulasi pembayaran pajak penghasilan per bulan.'}</p>
                            </div>
                            <div className="flex gap-2">
                                {hasPermission('tax-summary', 'create') && (
                                    <button
                                        onClick={() => {
                                            setTaxForm({
                                                type: 'PPH',
                                                month: 'Januari',
                                                year: new Date().getFullYear(),
                                                pembetulan: 0,
                                                data: {
                                                    pph: config.pphTypes.reduce((acc, t) => ({ ...acc, [t]: 0 }), {}),
                                                    ppnIn: {},
                                                    ppnOut: {}
                                                }
                                            });
                                            setModalTab('tax-form-pph');
                                            setIsModalOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
                                    >
                                        <Plus size={14} /> {isEnglish ? 'Input PPh' : 'Input PPh'}
                                    </button>
                                )}
                                <button className="p-2 hover:bg-gray-100 rounded-lg dark:hover:bg-slate-700"><Download size={16} className="text-gray-500" /></button>
                            </div>
                        </div>
                        <div className="h-[350px] min-h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorPh" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} tickFormatter={(val) => `${val / 1000000}M`} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                        formatter={(value) => `Rp ${value.toLocaleString()}`}
                                    />
                                    <Legend iconType="circle" />
                                    {config.pphTypes.map((type, idx) => (
                                        <Area
                                            key={type}
                                            type="monotone"
                                            dataKey={type}
                                            stackId="1"
                                            stroke={['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'][idx % 5]}
                                            fill={['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'][idx % 5]}
                                            fillOpacity={0.6}
                                        />
                                    ))}
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    {/* 2b. Distribution Pie Chart */}
                    <Card>
                        <h3 className="font-bold text-lg dark:text-white mb-6">Distribusi PPh (YTD)</h3>
                        <div className="h-[300px] min-h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={config.pphTypes.map(t => ({ name: t, value: totalPerType[t] })).filter(d => d.value > 0)}
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {config.pphTypes.map((t, index) => (
                                            <Cell key={`cell-${index}`} fill={['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'][index % 5]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => `Rp ${value.toLocaleString()}`} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>

                {/* 3. Detailed Table */}
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-900 dark:text-white">Rincian Data PPh</h3>
                        <div className="flex gap-2">
                            {renderFilterControls('pph')}
                        </div>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300">
                                <tr>
                                    <th className="px-6 py-4 font-semibold text-right border-b border-gray-200 dark:border-slate-700">Periode</th>
                                    {config.pphTypes.map(t => (
                                        <th key={t} className="px-6 py-4 font-semibold text-right border-b border-gray-200 dark:border-slate-700 group/th relative">
                                            <div className="flex items-center justify-end gap-1">
                                                {t}
                                                {hasPermission('tax-summary', 'edit') && (
                                                    <div className="flex opacity-0 group-hover/th:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleRenameTaxType('pphTypes', t); }}
                                                            className="p-1 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                            title="Ubah Nama"
                                                        >
                                                            <Edit3 size={12} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteType('pphTypes', t); }}
                                                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                            title="Hapus Kolom"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                    <th className="px-6 py-4 font-semibold text-right border-b border-gray-200 dark:border-slate-700">Total</th>
                                    <th className="px-6 py-4 font-semibold text-center border-b border-gray-200 dark:border-slate-700">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">

                                {getFilteredData(sortedSummaries, 'pph').map((s, idx) => {
                                    let rowTotal = 0;
                                    return (
                                        <tr key={idx}
                                            style={{ animationDelay: `${idx * 50}ms` }}
                                            className={`hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors group animate-in zoom-in-95 fade-in fill-mode-both duration-500 ${hasPermission('tax-summary', 'edit') ? 'cursor-pointer' : ''}`}
                                            onClick={() => hasPermission('tax-summary', 'edit') && handleEditRow(s)}>
                                            <td className="px-6 py-4 font-medium dark:text-white">{s.month} {s.year}</td>
                                            {config.pphTypes.map(t => {
                                                const val = getSafeValue(s, t, 'pph');
                                                rowTotal += val;
                                                return <td key={t} className="px-6 py-4 text-right">Rp {val.toLocaleString()}</td>
                                            })}
                                            <td className="px-6 py-4 text-right font-bold text-indigo-600 dark:text-indigo-400">Rp {rowTotal.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    {hasPermission('tax-summary', 'edit') && (
                                                        <button onClick={(e) => { e.stopPropagation(); handleEditRow(s, 'pph') }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100" title="Edit Data"><Settings size={16} /></button>
                                                    )}
                                                    {hasPermission('tax-summary', 'delete') && (
                                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteRecord(s.id) }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100" title="Hapus Data"><Trash2 size={16} /></button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        );
    };

    // --- TAB: PPN RENDERER ---
    const renderPPNTab = () => {
        // Prepare Data
        const chartData = sortedSummaries.filter(s => s.type === 'PPN').map(s => {
            const inTotal = config.ppnInTypes.reduce((sum, t) => sum + getSafeValue(s, t, 'ppnIn'), 0);
            const outTotal = config.ppnOutTypes.reduce((sum, t) => sum + getSafeValue(s, t, 'ppnOut'), 0);
            return {
                name: `${s.month} ${s.year}`,
                inTotal,
                outTotal,
                net: outTotal - inTotal // Out - In = Kurang Bayar (Positive) / Lebih Bayar (Negative)
            };
        });

        const totalInPerType = config.ppnInTypes.reduce((acc, type) => {
            acc[type] = sortedSummaries.reduce((sum, s) => sum + getSafeValue(s, type, 'ppnIn'), 0);
            return acc;
        }, {});

        const totalOutPerType = config.ppnOutTypes.reduce((acc, type) => {
            acc[type] = sortedSummaries.reduce((sum, s) => sum + getSafeValue(s, type, 'ppnOut'), 0);
            return acc;
        }, {});

        // Current Month Status (Latest)
        const latest = chartData[chartData.length - 1] || { inTotal: 0, outTotal: 0, net: 0 };
        const statusKB = latest.net > 0; // Kurang Bayar
        const statusLB = latest.net < 0; // Lebih Bayar

        return (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                {/* 1. Insight Card */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-900/10 border-emerald-200 dark:border-emerald-800">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900 rounded-lg text-emerald-600">
                                <ArrowDownRight size={20} />
                            </div>
                            <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">Total Masukan (Input)</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">Rp {latest.inTotal.toLocaleString()}</p>
                        <p className="text-xs text-gray-500 mt-1">Bulan Terakhir</p>
                    </Card>

                    <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-900/10 border-amber-200 dark:border-amber-800">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg text-amber-600">
                                <ArrowUpRight size={20} />
                            </div>
                            <span className="text-sm font-semibold text-amber-800 dark:text-amber-400">Total Keluaran (Output)</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">Rp {latest.outTotal.toLocaleString()}</p>
                        <p className="text-xs text-gray-500 mt-1">Bulan Terakhir</p>
                    </Card>

                    <Card className="relative overflow-hidden">
                        <div className={`absolute top-0 right-0 p-3 rounded-bl-xl text-xs font-bold ${statusKB ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {statusKB ? 'KURANG BAYAR' : 'LEBIH BAYAR'}
                        </div>
                        <div className="mt-2">
                            <h4 className="text-sm text-gray-500 font-medium">Status PPN (Net)</h4>
                            <p className={`text-3xl font-bold mt-1 ${statusKB ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                Rp {Math.abs(latest.net).toLocaleString()}
                            </p>
                            <div className="mt-3 text-xs text-gray-400">
                                {statusKB
                                    ? "PPN Keluaran > Masukan. Segera setorkan selisihnya."
                                    : "PPN Masukan > Keluaran. Dapat dikompensasikan."}
                            </div>
                        </div>
                    </Card>
                </div>

                {/* 2. Composed Chart */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 2. Composed Chart */}
                    <Card className="lg:col-span-2">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                                <FileBarChart size={20} className="text-orange-500" /> Analisis PPN (In vs Out)
                            </h3>
                            <div className="flex gap-2">
                                {hasPermission('tax-summary', 'create') && (
                                    <button
                                        onClick={() => {
                                            setTaxForm({
                                                type: 'PPN',
                                                month: 'Januari',
                                                year: new Date().getFullYear(),
                                                pembetulan: 0,
                                                data: {
                                                    pph: {},
                                                    ppnIn: config.ppnInTypes.reduce((acc, t) => ({ ...acc, [t]: 0 }), {}),
                                                    ppnOut: config.ppnOutTypes.reduce((acc, t) => ({ ...acc, [t]: 0 }), {})
                                                }
                                            });
                                            setModalTab('tax-form-ppn');
                                            setIsModalOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
                                    >
                                        <Plus size={14} /> Input PPN
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(val) => `${val / 1000000}M`} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', padding: '12px' }}
                                        formatter={(value) => [`Rp ${value.toLocaleString()}`, 'Net Balance']}
                                        labelStyle={{ color: '#374151', fontWeight: 'bold', marginBottom: '8px' }}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    <Line type="monotone" dataKey="net" name="Net Balance" stroke="#6366f1" strokeWidth={4} dot={{ r: 6, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 8 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    {/* 2b. Composition Charts */}
                    <div className="flex flex-col gap-6">
                        <Card className="flex-1">
                            <h4 className="text-sm font-bold text-gray-500 mb-2">Komposisi PPN Masukan (In)</h4>
                            <div className="h-[150px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={config.ppnInTypes.map(t => ({ name: t, value: totalInPerType[t] })).filter(d => d.value > 0)}
                                            innerRadius={30}
                                            outerRadius={50}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {config.ppnInTypes.map((t, index) => (
                                                <Cell key={`cell-${index}`} fill={['#10b981', '#34d399', '#6ee7b7', '#a7f3d0'][index % 4]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value) => `Rp ${value.toLocaleString()}`} />
                                        <Legend iconSize={8} wrapperStyle={{ fontSize: '10px' }} layout="vertical" align="right" verticalAlign="middle" />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                        <Card className="flex-1">
                            <h4 className="text-sm font-bold text-gray-500 mb-2">Komposisi PPN Keluaran (Out)</h4>
                            <div className="h-[150px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={config.ppnOutTypes.map(t => ({ name: t, value: totalOutPerType[t] })).filter(d => d.value > 0)}
                                            innerRadius={30}
                                            outerRadius={50}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {config.ppnOutTypes.map((t, index) => (
                                                <Cell key={`cell-${index}`} fill={['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a'][index % 4]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value) => `Rp ${value.toLocaleString()}`} />
                                        <Legend iconSize={8} wrapperStyle={{ fontSize: '10px' }} layout="vertical" align="right" verticalAlign="middle" />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* 3. Detailed Data Grid */}
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-900 dark:text-white">Rincian Komponen PPN</h3>
                        <div className="flex gap-2">
                            {renderFilterControls('ppn')}
                        </div>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300">
                                <tr className="border-b border-gray-200 dark:border-slate-700">
                                    <th className="px-6 py-4 font-semibold" rowSpan="2">Periode</th>
                                    <th className={`px-6 py-2 font-semibold text-center bg-emerald-50/50 dark:bg-emerald-900/20 ${hasPermission('tax-summary', 'edit') ? 'cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/30' : ''}`} colSpan={config.ppnInTypes.length} onClick={() => hasPermission('tax-summary', 'edit') && handleAddType('ppnInTypes')}>
                                        PPN Masukan (In) {hasPermission('tax-summary', 'edit') && <Plus size={12} className="inline ml-1 opacity-50" />}
                                    </th>
                                    <th className={`px-6 py-2 font-semibold text-center bg-amber-50/50 dark:bg-amber-900/20 ${hasPermission('tax-summary', 'edit') ? 'cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30' : ''}`} colSpan={config.ppnOutTypes.length} onClick={() => hasPermission('tax-summary', 'edit') && handleAddType('ppnOutTypes')}>
                                        PPN Keluaran (Out) {hasPermission('tax-summary', 'edit') && <Plus size={12} className="inline ml-1 opacity-50" />}
                                    </th>
                                    <th className="px-4 py-4 font-semibold text-center bg-gray-100 dark:bg-slate-700" rowSpan="2">Status</th>
                                    <th className="px-4 py-4 font-semibold" rowSpan="2">Aksi</th>
                                </tr>
                                <tr>
                                    {config.ppnInTypes.map(t => (
                                        <th key={t} className="px-4 py-2 text-xs font-medium text-right text-emerald-700 dark:text-emerald-400 border-b border-gray-100 dark:border-slate-800 group/th">
                                            <div className="flex items-center justify-end gap-1">
                                                {t}
                                                {hasPermission('tax-summary', 'edit') && (
                                                    <div className="flex opacity-0 group-hover/th:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleRenameTaxType('ppnInTypes', t); }}
                                                            className="p-0.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                        >
                                                            <Edit3 size={10} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteType('ppnInTypes', t); }}
                                                            className="p-0.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                        >
                                                            <Trash2 size={10} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                    {config.ppnOutTypes.map(t => (
                                        <th key={t} className="px-4 py-2 text-xs font-medium text-right text-amber-700 dark:text-amber-400 border-b border-gray-100 dark:border-slate-800 group/th">
                                            <div className="flex items-center justify-end gap-1">
                                                {t}
                                                {hasPermission('tax-summary', 'edit') && (
                                                    <div className="flex opacity-0 group-hover/th:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleRenameTaxType('ppnOutTypes', t); }}
                                                            className="p-0.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                        >
                                                            <Edit3 size={10} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteType('ppnOutTypes', t); }}
                                                            className="p-0.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                        >
                                                            <Trash2 size={10} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                {getFilteredData(sortedSummaries, 'ppn').map((s, idx) => {
                                    const totalIn = config.ppnInTypes.reduce((acc, t) => acc + getSafeValue(s, t, 'ppnIn'), 0);
                                    const totalOut = config.ppnOutTypes.reduce((acc, t) => acc + getSafeValue(s, t, 'ppnOut'), 0);
                                    const net = totalOut - totalIn;
                                    const isKB = net > 0;
                                    const isLB = net < 0;

                                    return (
                                        <tr key={idx}
                                            style={{ animationDelay: `${idx * 50}ms` }}
                                            className={`hover:bg-gray-50 dark:hover:bg-slate-800/50 group animate-in zoom-in-95 fade-in fill-mode-both duration-500 ${hasPermission('tax-summary', 'edit') ? 'cursor-pointer' : ''}`}
                                            onClick={() => hasPermission('tax-summary', 'edit') && handleEditRow(s, 'ppn')}>
                                            <td className="px-6 py-4 font-medium dark:text-white">{s.month} {s.year}</td>
                                            {config.ppnInTypes.map(t => <td key={t} className="px-4 py-4 text-right">Rp {getSafeValue(s, t, 'ppnIn').toLocaleString()}</td>)}
                                            {config.ppnOutTypes.map(t => <td key={t} className="px-4 py-4 text-right">Rp {getSafeValue(s, t, 'ppnOut').toLocaleString()}</td>)}

                                            <td className={`px-4 py-4 text-center font-bold text-xs ${isKB ? 'text-red-600 bg-red-50' : isLB ? 'text-emerald-600 bg-emerald-50' : 'text-gray-500'}`}>
                                                {isKB ? 'KURANG BAYAR' : isLB ? 'LEBIH BAYAR' : 'NIHIL'}
                                                <div className="text-[10px] opacity-75">Rp {Math.abs(net).toLocaleString()}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    {hasPermission('tax-summary', 'edit') && (
                                                        <button onClick={(e) => { e.stopPropagation(); handleEditRow(s, 'ppn') }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100" title="Edit Data"><Settings size={16} /></button>
                                                    )}
                                                    {hasPermission('tax-summary', 'delete') && (
                                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteRecord(s.id) }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100" title="Hapus Data"><Trash2 size={16} /></button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            {/* Header & Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex bg-gray-100 dark:bg-slate-800 border dark:border-slate-700/50 p-1 rounded-xl w-fit shadow-inner">
                    <button
                        onClick={() => setActiveTab('pph')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'pph' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        PPh (Pajak Penghasilan)
                    </button>
                    <button
                        onClick={() => setActiveTab('ppn')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'ppn' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        PPN (Pajak Pertambahan Nilai)
                    </button>
                    <button
                        onClick={() => setActiveTab('comparison')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'comparison' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <SlidersHorizontal size={14} className="inline mr-1" /> Perbandingan
                    </button>
                </div>

                {/* Import/Export Actions */}
                <div className="flex flex-wrap gap-2">
                    <div className="flex gap-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-1">
                        <button
                            onClick={() => downloadTemplate('pph')}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded flex items-center gap-2"
                            title="Download Template PPh"
                        >
                            <Download size={14} /> Template PPh
                        </button>
                        <div className="w-px bg-gray-200 dark:bg-slate-700 my-1"></div>
                        <button
                            onClick={() => downloadTemplate('ppn')}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded flex items-center gap-2"
                            title="Download Template PPN"
                        >
                            <Download size={14} /> Template PPN
                        </button>
                    </div>

                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx, .xls" />

                    {hasPermission('tax-summary', 'create') && (
                        <div className="flex gap-1">
                            <button
                                onClick={() => { setImportMode('pph'); setTimeout(() => fileInputRef.current?.click(), 0); }}
                                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm flex items-center gap-2 transition-colors shadow-sm"
                            >
                                <FileSpreadsheet size={16} /> Import PPh
                            </button>
                            <button
                                onClick={() => { setImportMode('ppn'); setTimeout(() => fileInputRef.current?.click(), 0); }}
                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm flex items-center gap-2 transition-colors shadow-sm"
                            >
                                <FileSpreadsheet size={16} /> Import PPN
                            </button>
                        </div>
                    )}
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
                        <span className="text-[10px] font-bold opacity-60">Tax Reporting Analysis</span>
                    </div>
                    <p className="text-sm font-bold leading-relaxed">{insight.text}</p>
                </div>
            </div>

            {/* Global Update Button Removed - replaced by specific buttons in tabs */}
            {/* Global Update Button Removed - replaced by specific buttons in tabs */}

            {/* Content Renderers */}
            {activeTab === 'pph' && renderPPhTab()}
            {activeTab === 'ppn' && renderPPNTab()}
            {activeTab === 'comparison' && <ComparisonTab sortedSummaries={sortedSummaries} config={config} onCopy={onCopy} isEnglish={isEnglish} />}
        </div >
    );
}
