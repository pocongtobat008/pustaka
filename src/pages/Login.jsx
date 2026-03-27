import React, { useState } from 'react';
import { User, FileKey, AlertCircle, ShieldCheck, Zap, ArrowRight, BookOpen, Sun, Moon, Globe } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAppStore } from '../store/useAppStore';

export default function Login({ onLogin }) {
    const [loginForm, setLoginForm] = useState({ username: '', password: '', error: '' });
    const { language, setLanguage } = useLanguage();
    const { isDarkMode, setIsDarkMode } = useAppStore();
    const isEnglish = language === 'en';

    const text = isEnglish
        ? {
            titleMain: 'One Unified\nSystem Management Solution',
            titleAccent: 'for Integrated Operations',
            subtitle: 'Smart integration between digital systems to support efficient and compliant corporate operations.',
            security: 'Enterprise Security',
            ocr: 'AI Powered OCR',
            welcome: 'Welcome Back',
            credentialHint: 'Enter your credentials to access the system.',
            username: 'Username',
            password: 'Password',
            submit: 'Sign In to Dashboard',
            or: 'or',
            guest: 'Continue as Guest (Read-Only)',
            version: '©2026 Pustaka Enterprise • v1.0.0 (Beta)',
        }
        : {
            titleMain: 'Solusi Satu\nManajemen Sistem Terpadu',
            titleAccent: 'untuk Operasional Terintegrasi',
            subtitle: 'Integrasi cerdas antara sistem digital untuk mendukung operasional korporat yang efisien dan patuh regulasi.',
            security: 'Keamanan Enterprise',
            ocr: 'OCR Bertenaga AI',
            welcome: 'Selamat Datang',
            credentialHint: 'Masukkan kredensial Anda untuk akses sistem.',
            username: 'Username',
            password: 'Password',
            submit: 'Masuk Ke Dashboard',
            or: 'Atau',
            guest: 'Masuk Sebagai Tamu (Read-Only)',
            version: '©2026 Pustaka Enterprise • v1.0.0 (Beta)',
        };

    const handleSubmit = (e) => {
        e.preventDefault();
        onLogin(loginForm.username, loginForm.password, (errorMsg) => {
            setLoginForm(prev => ({ ...prev, error: errorMsg }));
        });
    };

    const handleGuestLogin = () => {
        onLogin('', '', (errorMsg) => {
            setLoginForm(prev => ({ ...prev, error: errorMsg }));
        });
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#F4F7FE] dark:bg-[#0B1437] overflow-hidden relative p-4">
            {/* Animated Background Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>

            <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border border-white/40 dark:border-white/10 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-700">

                {/* Left Side: Branding & Illustration (Startup Style) */}
                <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-indigo-600 to-purple-700 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10">
                        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <path d="M0 0 L100 0 L100 100 Z" fill="white" />
                        </svg>
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl">
                                <BookOpen className="text-white" size={24} />
                            </div>
                            <span className="text-2xl font-black text-white tracking-tighter">Pustaka</span>
                        </div>

                        <h1 className="text-5xl font-black text-white leading-tight mb-6">
                            {text.titleMain.split('\n')[0]}<br />
                            <span className="text-indigo-200">{text.titleAccent}</span>
                        </h1>
                        <p className="text-indigo-100 text-lg font-medium max-w-md">
                            {text.subtitle}
                        </p>
                    </div>

                    {/* Animated SVG Illustration */}
                    <div className="relative z-10 flex justify-center py-10">
                        <div className="relative w-64 h-64">
                            {/* Floating Elements */}
                            <div className="absolute top-0 left-0 w-full h-full animate-bounce-slow">
                                <svg viewBox="0 0 200 200" className="w-full h-full text-white/20">
                                    <rect x="40" y="40" width="120" height="120" rx="20" fill="currentColor" />
                                    <rect x="60" y="70" width="80" height="10" rx="5" fill="white" fillOpacity="0.3" />
                                    <rect x="60" y="95" width="50" height="10" rx="5" fill="white" fillOpacity="0.3" />
                                    <circle cx="140" cy="140" r="20" fill="#4ade80" className="animate-pulse" />
                                    <path d="M135 140 L138 145 L145 135" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
                                </svg>
                            </div>
                            {/* Decorative Rings */}
                            <div className="absolute inset-[-20px] border-2 border-dashed border-white/10 rounded-full animate-spin-slow"></div>
                            <div className="absolute inset-[-40px] border border-white/5 rounded-full animate-reverse-spin-slow"></div>
                        </div>
                    </div>

                    <div className="relative z-10 flex gap-6">
                        <div className="flex items-center gap-2 text-white/70 text-sm font-bold">
                            <ShieldCheck size={18} className="text-emerald-400" /> {text.security}
                        </div>
                        <div className="flex items-center gap-2 text-white/70 text-sm font-bold">
                            <Zap size={18} className="text-amber-400" /> {text.ocr}
                        </div>
                    </div>
                </div>

                {/* Right Side: Login Form */}
                <div className="p-8 md:p-16 flex flex-col justify-center">
                    <div className="lg:hidden flex justify-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl flex items-center justify-center shadow-2xl">
                            <BookOpen className="text-white" size={32} />
                        </div>
                    </div>

                    <div className="mb-10 relative">
                        {/* Language & Theme Toggles */}
                        <div className="absolute -top-4 right-0 flex items-center gap-2">
                            <button
                                onClick={() => setLanguage(isEnglish ? 'id' : 'en')}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-slate-800 border-2 border-transparent hover:border-indigo-500/30 rounded-xl transition-all group"
                                title={isEnglish ? 'Change to Indonesian' : 'Ganti ke Bahasa Inggris'}
                            >
                                <Globe size={14} className="text-gray-400 group-hover:text-indigo-500" />
                                <span className="text-[10px] font-black text-gray-500 dark:text-slate-300 uppercase tracking-widest">{isEnglish ? 'EN' : 'ID'}</span>
                            </button>

                            <button
                                onClick={() => setIsDarkMode(!isDarkMode)}
                                className="p-2 bg-gray-50 dark:bg-slate-800 border-2 border-transparent hover:border-indigo-500/30 rounded-xl transition-all group"
                                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                            >
                                {isDarkMode ? (
                                    <Sun size={14} className="text-amber-400 group-hover:scale-110 transition-transform" />
                                ) : (
                                    <Moon size={14} className="text-indigo-600 group-hover:scale-110 transition-transform" />
                                )}
                            </button>
                        </div>

                        <h2 className="text-3xl font-black text-[#2B3674] dark:text-white mb-2 tracking-tight">{text.welcome}</h2>
                        <p className="text-gray-500 dark:text-slate-400 font-bold">{text.credentialHint}</p>
                    </div>

                    {loginForm.error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 text-red-600 dark:text-red-400 text-sm font-bold rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2">
                            <AlertCircle size={20} /> {loginForm.error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="group">
                            <label className="block text-sm font-black text-[#2B3674] dark:text-slate-300 mb-2 uppercase tracking-widest ml-1">{text.username}</label>
                            <div className="relative group-focus-within:scale-[1.01] transition-all duration-300">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                <input
                                    type="text"
                                    value={loginForm.username}
                                    onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
                                    className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-slate-950 border-2 border-gray-100 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:text-white transition-all font-bold outline-none"
                                    placeholder="admin / staff"
                                />
                            </div>
                        </div>
                        <div className="group">
                            <label className="block text-sm font-black text-[#2B3674] dark:text-slate-300 mb-2 uppercase tracking-widest ml-1">{text.password}</label>
                            <div className="relative group-focus-within:scale-[1.01] transition-all duration-300">
                                <FileKey className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                <input
                                    type="password"
                                    value={loginForm.password}
                                    onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                                    className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-slate-950 border-2 border-gray-100 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:text-white transition-all font-bold outline-none"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>
                        <button type="submit" className="w-full py-4 bg-[#4318FF] hover:bg-indigo-700 text-white rounded-2xl font-black shadow-xl shadow-indigo-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 group">
                            {text.submit}
                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </button>

                        <div className="relative flex items-center py-2">
                            <div className="flex-grow border-t border-gray-100 dark:border-slate-800"></div>
                            <span className="flex-shrink mx-4 text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">{text.or}</span>
                            <div className="flex-grow border-t border-gray-100 dark:border-slate-800"></div>
                        </div>

                        <button
                            type="button"
                            onClick={handleGuestLogin}
                            className="w-full py-4 bg-white dark:bg-slate-900/40 border-2 border-indigo-50 dark:border-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl font-black shadow-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-3 group border-dashed"
                        >
                            <User size={20} className="group-hover:scale-110 transition-transform" />
                            {text.guest}
                        </button>
                    </form>
                    <p className="text-center text-xs text-gray-400 mt-12 font-bold uppercase tracking-widest">{text.version}</p>
                </div>
            </div>
        </div>
    );
}
