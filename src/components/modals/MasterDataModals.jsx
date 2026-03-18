import React from 'react';
import { Building2, Shield, ChevronRight } from 'lucide-react';

export default function MasterDataModals({
    modalTab,
    userForm, setUserForm, handleSaveUser,
    deptForm, setDeptForm, handleSaveDept,
    roleForm, setRoleForm, handleSaveRole, handleTogglePermission,
    roles, departments, APP_MODULES
}) {
    if (!['user-create', 'dept-form', 'role-create', 'role-edit'].includes(modalTab)) return null;

    return (
        <div className="space-y-6 pt-4">
            {modalTab === 'user-create' && (
                <div className="space-y-5 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Username</label>
                            <input
                                value={userForm.username}
                                onChange={e => setUserForm({ ...userForm, username: e.target.value })}
                                className="w-full px-4 py-3 border-0 bg-white/50 dark:bg-slate-800/50 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white shadow-inner placeholder:text-slate-400 font-bold"
                                placeholder="Username untuk login"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Password</label>
                            <input
                                type="password"
                                value={userForm.password}
                                onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                                className="w-full px-4 py-3 border-0 bg-white/50 dark:bg-slate-800/50 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white shadow-inner placeholder:text-slate-400"
                                placeholder={userForm.id ? "••••••••" : "Password login"}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Nama Lengkap</label>
                        <input
                            value={userForm.name}
                            onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                            className="w-full px-4 py-3 border-0 bg-white/50 dark:bg-slate-800/50 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white shadow-inner font-bold"
                            placeholder="Nama lengkap user"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Role</label>
                            <div className="relative">
                                <select
                                    value={userForm.role}
                                    onChange={e => setUserForm({ ...userForm, role: e.target.value })}
                                    className="w-full px-4 py-3 border-0 bg-white/50 dark:bg-slate-800/50 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white shadow-inner appearance-none font-bold"
                                >
                                    {roles.map(r => <option key={r.id} value={r.id}>{r.label || r.id}</option>)}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <ChevronRight size={16} className="rotate-90" />
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Departemen</label>
                            <div className="relative">
                                <select
                                    value={userForm.department}
                                    onChange={e => setUserForm({ ...userForm, department: e.target.value })}
                                    className="w-full px-4 py-3 border-0 bg-white/50 dark:bg-slate-800/50 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white shadow-inner appearance-none font-bold"
                                >
                                    <option value="">- Pilih Dept -</option>
                                    {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <ChevronRight size={16} className="rotate-90" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end pt-6 border-t border-white/20 dark:border-white/5">
                        <button
                            onClick={handleSaveUser}
                            className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl font-black shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all hover:-translate-y-0.5"
                        >
                            Simpan User
                        </button>
                    </div>
                </div>
            )}

            {modalTab === 'dept-form' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-white/30 dark:bg-slate-800/30 p-6 rounded-2xl border border-white/20 dark:border-white/5">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Nama Departemen</label>
                        <div className="relative">
                            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                value={deptForm.name}
                                onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
                                className="w-full pl-12 pr-4 py-4 border-0 bg-white/50 dark:bg-slate-900/50 rounded-2xl focus:ring-2 focus:ring-indigo-500 dark:text-white shadow-inner font-black text-lg"
                                placeholder="Contoh: IT Support"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end pt-4">
                        <button
                            onClick={handleSaveDept}
                            className="px-10 py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-2xl font-black shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all hover:-translate-y-0.5"
                        >
                            Simpan Departemen
                        </button>
                    </div>
                </div>
            )}

            {(modalTab === 'role-create' || modalTab === 'role-edit') && (
                <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-white/30 dark:bg-slate-800/30 p-6 rounded-2xl border border-white/20 dark:border-white/5">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Nama Role</label>
                        <div className="relative">
                            <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                value={roleForm.name}
                                onChange={e => setRoleForm({ ...roleForm, name: e.target.value })}
                                className="w-full pl-12 pr-4 py-4 border-0 bg-white/50 dark:bg-slate-900/50 rounded-2xl focus:ring-2 focus:ring-indigo-500 dark:text-white shadow-inner font-black text-lg"
                                placeholder="Contoh: Manager"
                            />
                        </div>
                    </div>

                    <div className="border border-white/20 dark:border-white/5 rounded-[2rem] overflow-hidden shadow-xl bg-white/20 dark:bg-slate-900/20 backdrop-blur-md">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-100/50 dark:bg-slate-800/50">
                                    <th className="px-6 py-4 text-left text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Modul</th>
                                    <th className="px-4 py-4 text-center text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">View</th>
                                    <th className="px-4 py-4 text-center text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Create</th>
                                    <th className="px-4 py-4 text-center text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Edit</th>
                                    <th className="px-4 py-4 text-center text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Delete</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10 dark:divide-white/5">
                                {Object.values(APP_MODULES).map(mod => (
                                    <tr key={mod.id} className="hover:bg-white/30 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="font-black text-slate-700 dark:text-slate-200">{mod.label}</span>
                                        </td>
                                        {['view', 'create', 'edit', 'delete'].map(action => (
                                            <td key={action} className="text-center py-4">
                                                <label className="relative inline-flex items-center cursor-pointer group">
                                                    <input
                                                        type="checkbox"
                                                        checked={roleForm.permissions[mod.id]?.includes(action) || false}
                                                        onChange={() => handleTogglePermission(mod.id, action)}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-10 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                                </label>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                            onClick={handleSaveRole}
                            className="px-12 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-2xl font-black shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all hover:-translate-y-0.5 active:scale-95"
                        >
                            Simpan Role & Izin
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
