import React, { useState } from 'react';
import { User, Lock, Save, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { API_URL } from '../services/database';

export default function Profile({ currentUser, onUpdateProfile }) {
    const [name, setName] = useState(currentUser?.name || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setMessage({ type: '', text: '' });

        if (newPassword && newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'Konfirmasi password tidak cocok' });
            setIsSaving(false);
            return;
        }

        try {
            const res = await fetch(`${API_URL}/users/profile/${currentUser.id}`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    currentPassword: newPassword ? currentPassword : null,
                    newPassword: newPassword || null
                })
            });

            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    setMessage({ type: 'success', text: 'Profil berhasil diperbarui' });
                    onUpdateProfile(data.user);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                } else {
                    setMessage({ type: 'error', text: data.error || 'Gagal memperbarui profil' });
                }
            } else {
                const errorText = await res.text();
                const isHtml = errorText.includes('<!DOCTYPE');
                setMessage({ type: 'error', text: `Gagal (Status ${res.status}): ${isHtml ? 'API Profile tidak ditemukan.' : errorText}` });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Terjadi kesalahan sistem' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-indigo-100 dark:border-indigo-900/30">
                <div>
                    <h2 className="text-3xl font-extrabold text-[#2B3674] dark:text-white flex items-center gap-3">
                        <User className="text-indigo-500" size={32} />
                        Profil Pengguna
                    </h2>
                    <p className="text-gray-500 dark:text-slate-400 mt-2 font-medium">
                        Atur informasi pribadi dan keamanan akun Anda
                    </p>
                </div>

                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 rounded-full">
                    Account Status: <span className="text-green-500 ml-1">Active</span>
                </div>
            </div>

            {message.text && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in zoom-in duration-300 ${message.type === 'success'
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-900/30'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30'
                    }`}>
                    {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                    <span className="font-semibold">{message.text}</span>
                </div>
            )}

            <form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Profile Overview Card */}
                <div className="md:col-span-1 space-y-6">
                    <Card className="overflow-hidden">
                        <div className="relative h-24 bg-gradient-to-r from-indigo-600 to-indigo-400"></div>
                        <div className="px-6 pb-8 -mt-12 flex flex-col items-center">
                            <div className="relative group">
                                <div className="w-24 h-24 rounded-full bg-white dark:bg-[#111C44] p-1 shadow-xl border-4 border-white dark:border-[#111C44] relative overflow-hidden">
                                    <div className="w-full h-full rounded-full bg-indigo-50 dark:bg-indigo-900 shadow-inner flex items-center justify-center">
                                        <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400 uppercase">
                                            {currentUser?.name?.substring(0, 2)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <h3 className="mt-4 font-bold text-xl text-[#2B3674] dark:text-white text-center">
                                {currentUser?.name}
                            </h3>
                            <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mt-1">
                                {currentUser?.role}
                            </p>

                            <div className="mt-6 w-full space-y-3">
                                <div className="flex items-center justify-between text-sm p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700">
                                    <span className="text-gray-500 dark:text-slate-400">Username</span>
                                    <span className="font-bold dark:text-white">{currentUser?.username}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700">
                                    <span className="text-gray-500 dark:text-slate-400">Department</span>
                                    <span className="font-bold dark:text-white">{currentUser?.department || '-'}</span>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Edit Form Section */}
                <div className="md:col-span-2 space-y-6">
                    {/* Basic Info */}
                    <Card className="p-8">
                        <div className="flex items-center gap-3 mb-8 border-b border-gray-50 dark:border-slate-800 pb-4">
                            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600">
                                <User size={20} />
                            </div>
                            <h3 className="font-bold text-lg dark:text-white text-[#2B3674]">Informasi Pribadi</h3>
                        </div>

                        <div className="space-y-6">
                            <div className="group">
                                <label className="block text-sm font-bold text-[#A3AED0] dark:text-slate-400 mb-2 transition-colors group-focus-within:text-indigo-500 uppercase tracking-wider">
                                    Nama Lengkap
                                </label>
                                <div className="relative group-focus-within:scale-[1.01] transition-transform duration-300">
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full pl-4 pr-10 py-4 bg-gray-50/50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all dark:text-white font-semibold"
                                        placeholder="Masukkan nama lengkap Anda"
                                        required
                                    />
                                    <User className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Security Info */}
                    <Card className="p-8">
                        <div className="flex items-center gap-3 mb-8 border-b border-gray-50 dark:border-slate-800 pb-4">
                            <div className="p-2.5 bg-amber-50 dark:bg-amber-900/30 rounded-xl text-amber-600">
                                <Lock size={20} />
                            </div>
                            <h3 className="font-bold text-lg dark:text-white text-[#2B3674]">Keamanan & Password</h3>
                        </div>

                        <div className="space-y-6">
                            <div className="p-4 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-2xl flex gap-3">
                                <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                                <p className="text-xs text-amber-800 dark:text-amber-400 leading-relaxed font-medium">
                                    Biarkan kosong jika Anda tidak ingin merubah password. Jika ingin merubah password, pastikan Anda mengingat password saat ini.
                                </p>
                            </div>

                            <div className="group">
                                <label className="block text-sm font-bold text-[#A3AED0] dark:text-slate-400 mb-2 transition-colors group-focus-within:text-indigo-500 uppercase tracking-wider">
                                    Password Saat Ini
                                </label>
                                <div className="relative group-focus-within:scale-[1.01] transition-transform duration-300">
                                    <input
                                        type="password"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        className="w-full pl-4 pr-10 py-4 bg-gray-50/50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all dark:text-white font-semibold"
                                        placeholder="••••••••"
                                        required={newPassword.length > 0}
                                    />
                                    <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="group">
                                    <label className="block text-sm font-bold text-[#A3AED0] dark:text-slate-400 mb-2 transition-colors group-focus-within:text-indigo-500 uppercase tracking-wider">
                                        Password Baru
                                    </label>
                                    <div className="relative group-focus-within:scale-[1.01] transition-transform duration-300">
                                        <input
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full pl-4 pr-10 py-4 bg-gray-50/50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all dark:text-white font-semibold"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                                <div className="group">
                                    <label className="block text-sm font-bold text-[#A3AED0] dark:text-slate-400 mb-2 transition-colors group-focus-within:text-indigo-500 uppercase tracking-wider">
                                        Konfirmasi Password Baru
                                    </label>
                                    <div className="relative group-focus-within:scale-[1.01] transition-transform duration-300">
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full pl-4 pr-10 py-4 bg-gray-50/50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all dark:text-white font-semibold"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className={`
                                flex items-center gap-3 px-10 py-4 bg-[#4318FF] text-white rounded-2xl font-bold shadow-xl shadow-indigo-500/20 
                                hover:bg-indigo-700 hover:shadow-indigo-500/40 hover:-translate-y-1 active:scale-95 transition-all duration-300
                                disabled:opacity-50 disabled:translate-y-0
                            `}
                        >
                            {isSaving ? (
                                <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full"></div>
                            ) : (
                                <Save size={20} />
                            )}
                            Simpan Perubahan
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
