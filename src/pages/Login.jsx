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
            subtitle: 'Smart integration of digital systems to support efficient corporate operations.',
            security: 'Enterprise Security',
            ocr: 'AI Powered OCR',
            welcome: 'Welcome Back',
            credentialHint: 'Enter credentials to access the system.',
            username: 'Username',
            password: 'Password',
            submit: 'Sign In',
            or: 'or',
            guest: 'Guest Access (Read-Only)',
            version: '©2026 Pustaka Enterprise • v1.0.0',
        }
        : {
            titleMain: 'Solusi Satu\nManajemen Sistem Terpadu',
            titleAccent: 'untuk Operasional Terintegrasi',
            subtitle: 'Integrasi cerdas sistem digital untuk operasional korporat yang efisien.',
            security: 'Keamanan Enterprise',
            ocr: 'OCR Bertenaga AI',
            welcome: 'Selamat Datang',
            credentialHint: 'Masukkan kredensial untuk akses sistem.',
            username: 'Username',
            password: 'Password',
            submit: 'Masuk',
            or: 'Atau',
            guest: 'Akses Tamu (Read-Only)',
            version: '©2026 Pustaka Enterprise • v1.0.0',
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
                <div className="hidden lg:flex flex-col justify-between p-8 xl:p-12 bg-gradient-to-br from-indigo-600 to-purple-700 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10">
                        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <path d="M0 0 L100 0 L100 100 Z" fill="white" />
                        </svg>
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-2 xl:gap-3 mb-4 xl:mb-8">
                            <div className="p-1.5 xl:p-2 bg-white/20 backdrop-blur-md rounded-lg xl:rounded-xl">
                                <BookOpen className="text-white w-5 h-5 xl:w-6 xl:h-6" />
                            </div>
                            <span className="text-xl xl:text-2xl font-black text-white tracking-tighter">Pustaka</span>
                        </div>

                        <h1 className="text-3xl lg:text-4xl xl:text-5xl font-black text-white leading-tight mb-4 xl:mb-6">
                            {text.titleMain.split('\n')[0]}<br />
                            <span className="text-indigo-200">{text.titleAccent}</span>
                        </h1>
                        <p className="text-indigo-100 text-sm xl:text-lg font-medium max-w-md">
                            {text.subtitle}
                        </p>
                    </div>

                    {/* Animated SVG Illustration */}
                    <div className="relative z-10 flex justify-center py-4 xl:py-10">
                        <div className="relative w-40 h-40 lg:w-48 lg:h-48 xl:w-64 xl:h-64">
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
                <div className="p-5 sm:p-8 xl:p-12 flex flex-col justify-center">
                    <div className="lg:hidden flex justify-center mb-4 xl:mb-8">
                        <div className="w-12 h-12 xl:w-16 xl:h-16 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl flex items-center justify-center shadow-2xl">
                            <BookOpen className="text-white w-6 h-6 xl:w-8 xl:h-8" />
                        </div>
                    </div>

                    <div className="mb-4 xl:mb-10 relative">
                        {/* Language & Theme Toggles */}
                        <div className="absolute -top-2 xl:-top-4 right-0 flex items-center gap-2">
                            <button
                                onClick={() => setLanguage(isEnglish ? 'id' : 'en')}
                                className="flex items-center gap-1.5 px-2 py-1 xl:px-3 xl:py-1.5 bg-gray-50 dark:bg-slate-800 border-2 border-transparent hover:border-indigo-500/30 rounded-lg xl:rounded-xl transition-all group"
                                title={isEnglish ? 'Change to Indonesian' : 'Ganti ke Bahasa Inggris'}
                            >
                                <Globe size={14} className="text-gray-400 group-hover:text-indigo-500 w-3 h-3 xl:w-3.5 xl:h-3.5" />
                                <span className="text-[9px] xl:text-[10px] font-black text-gray-500 dark:text-slate-300 uppercase tracking-widest">{isEnglish ? 'EN' : 'ID'}</span>
                            </button>

                            <button
                                onClick={() => setIsDarkMode(!isDarkMode)}
                                className="p-1.5 xl:p-2 bg-gray-50 dark:bg-slate-800 border-2 border-transparent hover:border-indigo-500/30 rounded-lg xl:rounded-xl transition-all group"
                                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                            >
                                {isDarkMode ? (
                                    <Sun size={14} className="text-amber-400 group-hover:scale-110 transition-transform w-3.5 h-3.5 xl:w-4 xl:h-4" />
                                ) : (
                                    <Moon size={14} className="text-indigo-600 group-hover:scale-110 transition-transform w-3.5 h-3.5 xl:w-4 xl:h-4" />
                                )}
                            </button>
                        </div>

                        <h2 className="text-2xl xl:text-3xl font-black text-[#2B3674] dark:text-white mb-1 xl:mb-2 tracking-tight">{text.welcome}</h2>
                        <p className="text-xs xl:text-sm text-gray-500 dark:text-slate-400 font-bold">{text.credentialHint}</p>
                    </div>

                    {loginForm.error && (
                        <div className="mb-4 xl:mb-6 p-3 xl:p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 text-red-600 dark:text-red-400 text-xs xl:text-sm font-bold rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2">
                            <AlertCircle size={18} className="xl:w-5 xl:h-5" /> {loginForm.error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4 xl:space-y-6">
                        <div className="group">
                            <label className="block text-xs xl:text-sm font-black text-[#2B3674] dark:text-slate-300 mb-1.5 xl:mb-2 uppercase tracking-widest ml-1">{text.username}</label>
                            <div className="relative group-focus-within:scale-[1.01] transition-all duration-300">
                                <User className="absolute left-3 xl:left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors w-4 h-4 xl:w-5 xl:h-5" />
                                <input
                                    type="text"
                                    value={loginForm.username}
                                    onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
                                    className="w-full pl-10 xl:pl-12 pr-4 py-3 xl:py-4 bg-gray-50 dark:bg-slate-950 border-2 border-gray-100 dark:border-slate-800 rounded-xl xl:rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:text-white transition-all text-sm xl:text-base font-bold outline-none"
                                    placeholder="admin / staff"
                                />
                            </div>
                        </div>
                        <div className="group">
                            <label className="block text-xs xl:text-sm font-black text-[#2B3674] dark:text-slate-300 mb-1.5 xl:mb-2 uppercase tracking-widest ml-1">{text.password}</label>
                            <div className="relative group-focus-within:scale-[1.01] transition-all duration-300">
                                <FileKey className="absolute left-3 xl:left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors w-4 h-4 xl:w-5 xl:h-5" />
                                <input
                                    type="password"
                                    value={loginForm.password}
                                    onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                                    className="w-full pl-10 xl:pl-12 pr-4 py-3 xl:py-4 bg-gray-50 dark:bg-slate-950 border-2 border-gray-100 dark:border-slate-800 rounded-xl xl:rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:text-white transition-all text-sm xl:text-base font-bold outline-none"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>
                        <button type="submit" className="w-full py-3 xl:py-4 bg-[#4318FF] hover:bg-indigo-700 text-white rounded-xl xl:rounded-2xl text-sm xl:text-base font-black shadow-xl shadow-indigo-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 xl:gap-3 group">
                            {text.submit}
                            <ArrowRight className="group-hover:translate-x-1 transition-transform w-4 h-4 xl:w-5 xl:h-5" />
                        </button>

                        <div className="relative flex items-center py-1 xl:py-2">
                            <div className="flex-grow border-t border-gray-100 dark:border-slate-800"></div>
                            <span className="flex-shrink mx-4 text-gray-400 text-[9px] xl:text-[10px] font-black uppercase tracking-[0.2em]">{text.or}</span>
                            <div className="flex-grow border-t border-gray-100 dark:border-slate-800"></div>
                        </div>

                        <button
                            type="button"
                            onClick={handleGuestLogin}
                            className="w-full py-3 xl:py-4 bg-white dark:bg-slate-900/40 border-2 border-indigo-50 dark:border-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl xl:rounded-2xl text-sm xl:text-base font-black shadow-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 xl:gap-3 group border-dashed"
                        >
                            <User className="group-hover:scale-110 transition-transform w-4 h-4 xl:w-5 xl:h-5" />
                            {text.guest}
                        </button>
                    </form>
                    <p className="text-center text-[10px] xl:text-xs text-gray-400 mt-6 xl:mt-10 font-bold uppercase tracking-widest">{text.version}</p>
                </div>
            </div>
        </div>
    );
}
