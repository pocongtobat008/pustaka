import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Edit3, Trash2, Building2, GitCommit, ShieldCheck, ChevronRight, ChevronLeft, Users, User, Shield, History, Search, Clock, ChevronDown, ChevronUp, AlertCircle, FileText, Activity } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { APP_MODULES } from '../utils/permissions';

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
    const [masterTab, setMasterTab] = useState('users');
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [logSearchQuery, setLogSearchQuery] = useState('');
    const [expandedDepts, setExpandedDepts] = useState({});
    const [expandedLogId, setExpandedLogId] = useState(null);
    const [logCurrentPage, setLogCurrentPage] = useState(1);
    const logsPerPage = 15;
    const [logSource, setLogSource] = useState('database'); // 'database', 'error_file', 'ocr_file', 'server_file'
    const [fileLogs, setFileLogs] = useState({ error: '', ocr: '', server: '' });
    const [isFileLoading, setIsFileLoading] = useState(false);

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
            const dept = user.department || 'Tanpa Departemen';
            if (!acc[dept]) acc[dept] = [];
            acc[dept].push(user);
            return acc;
        }, {});
    }, [users, userSearchQuery]);

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

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl w-fit mb-4">
                {['users', 'roles', 'departments', 'flows', 'logs'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setMasterTab(tab)}
                        className={`px-4 py-2 rounded-lg capitalize text-sm font-bold transition-all ${masterTab === tab ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-slate-300'}`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {masterTab === 'users' && (
                <Card>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg dark:text-white">Manajemen User</h3>
                        <div className="flex gap-2">
                            <input
                                type="text" placeholder="Cari user..." className="px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white text-sm"
                                value={userSearchQuery} onChange={(e) => setUserSearchQuery(e.target.value)}
                            />
                            {hasPermission('master', 'create') && (
                                <button
                                    onClick={handleCreateUser}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                                >
                                    <Plus size={16} /> User Baru
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="space-y-4">
                        {Object.keys(groupedUsers).length === 0 ? (
                            <div className="text-center py-10 text-slate-400 italic">User tidak ditemukan.</div>
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
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{deptUsers.length} Anggota Terdaftar</p>
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
                        <h3 className="font-bold text-lg dark:text-white">Manajemen Role & Hak Akses</h3>
                        {hasPermission('master', 'create') && (
                            <button
                                onClick={handleCreateRole}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                            >
                                <Plus size={16} /> Role Baru
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
                                            <div className="text-xs text-gray-500 mt-1 uppercase tracking-wider">Hak Akses Modul</div>
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
                                            <span className="text-[10px] text-slate-400 italic">Belum ada hak akses yang diatur.</span>
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
                        <h3 className="font-bold text-lg dark:text-white">Master Alur Persetujuan</h3>
                        {hasPermission('master', 'create') && (
                            <button onClick={() => handleCreateFlow()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-indigo-700 transition-colors">
                                <Plus size={16} /> Flow Baru
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
                                            <button onClick={() => handleEditFlow(f)} className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg" title="Edit Flow"><Edit3 size={16} /></button>
                                        )}
                                        {hasPermission('master', 'delete') && (
                                            <button onClick={() => handleDeleteFlow(f.id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Hapus Flow"><Trash2 size={16} /></button>
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
                                {logSource === 'database' ? 'Audit Trail System' : `System Log: ${logSource.split('_')[0].toUpperCase()} File`}
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
                                    <Activity size={12} /> Server Logs
                                </button>
                                <button
                                    onClick={() => setLogSource('error_file')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${logSource === 'error_file' ? 'bg-white dark:bg-slate-800 text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <AlertCircle size={12} /> Errors
                                </button>
                                <button
                                    onClick={() => setLogSource('ocr_file')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${logSource === 'ocr_file' ? 'bg-white dark:bg-slate-800 text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <FileText size={12} /> OCR Failures
                                </button>
                            </div>
                        </div>
                        {logSource === 'database' && (
                            <div className="relative w-full md:w-72">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Cari aksi, user, atau detail..."
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
                                            <th className="px-6 py-4">Waktu</th>
                                            <th className="px-6 py-4">Pengguna</th>
                                            <th className="px-6 py-4">Aksi</th>
                                            <th className="px-6 py-4">Detail</th>
                                            <th className="px-6 py-4 text-right">Data</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                        {paginatedLogs.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="px-6 py-10 text-center text-slate-400 italic">Tidak ada catatan aktivitas ditemukan.</td>
                                            </tr>
                                        ) : (
                                            paginatedLogs.map((log) => (
                                                <React.Fragment key={log.id}>
                                                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                                        <td className="px-6 py-4 whitespace-nowrap text-slate-500 dark:text-slate-400 font-medium">
                                                            <div className="flex items-center gap-2">
                                                                <Clock size={12} />
                                                                {new Date(log.timestamp).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">{log.user || 'System'}</td>
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
                                                                    {log.oldValue && <div className="space-y-1"><p className="text-[9px] font-black text-red-500 uppercase ml-1">Sebelum (Old)</p><pre className="text-[10px] font-mono p-3 bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-xl text-red-700 dark:text-red-400 overflow-x-auto">{log.oldValue.startsWith('{') ? JSON.stringify(JSON.parse(log.oldValue), null, 2) : log.oldValue}</pre></div>}
                                                                    {log.newValue && <div className="space-y-1"><p className="text-[9px] font-black text-emerald-500 uppercase ml-1">Sesudah (New)</p><pre className="text-[10px] font-mono p-3 bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 rounded-xl text-emerald-700 dark:text-emerald-400 overflow-x-auto">{log.newValue.startsWith('{') ? JSON.stringify(JSON.parse(log.newValue), null, 2) : log.newValue}</pre></div>}
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
                                        Menampilkan <span className="font-bold text-indigo-600">{(logCurrentPage - 1) * logsPerPage + 1}</span> - <span className="font-bold text-indigo-600">{Math.min(logCurrentPage * logsPerPage, filteredLogs.length)}</span> dari <span className="font-bold text-indigo-600">{filteredLogs.length}</span> log
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
                                        <div className="text-sm font-bold text-slate-300">Memuat Log File...</div>
                                    </div>
                                </div>
                            ) : (
                                <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap overflow-x-auto overflow-y-auto max-h-[600px] custom-scrollbar p-2">
                                    {logSource === 'server_file' && fileLogs.server}
                                    {logSource === 'error_file' && fileLogs.error}
                                    {logSource === 'ocr_file' && fileLogs.ocr}
                                    {(!fileLogs.server && logSource === 'server_file') && "Tidak ada log server (File kosong)."}
                                    {(!fileLogs.error && logSource === 'error_file') && "Tidak ada error system (File kosong)."}
                                    {(!fileLogs.ocr && logSource === 'ocr_file') && "Tidak ada kegagalan OCR (File kosong)."}
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
                            <h3 className="font-bold text-lg dark:text-white">Daftar Departemen</h3>
                            {hasPermission('master', 'create') && (
                                <button onClick={handleCreateDept} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-indigo-700 transition-colors"><Plus size={16} /> Departemen Baru</button>
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
        </div >
    );
}
