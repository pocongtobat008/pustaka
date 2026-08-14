import React, { useState } from 'react';
import { User, FileKey, AlertCircle, ShieldCheck, Zap, ArrowRight, BookOpen, Sun, Moon, Globe, Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAppStore } from '../store/useAppStore';

export default function Login({ onLogin }) {
    const [loginForm, setLoginForm] = useState({ username: '', password: '', error: '' });
    const [showPassword, setShowPassword] = useState(false);
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
        <main role="main" className="min-h-screen w-full flex items-center justify-center overflow-hidden relative p-4">
            {/* Animated Background Elements — gradient mesh */}
            <div className="absolute top-[-15%] left-[-10%] w-[45%] h-[45%] bg-indigo-500/25 dark:bg-indigo-500/30 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] bg-purple-500/25 dark:bg-purple-500/30 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
            <div className="absolute top-[35%] right-[5%] w-[22%] h-[22%] bg-cyan-400/15 dark:bg-cyan-400/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '4s' }}></div>
            <div className="absolute bottom-[10%] left-[20%] w-[18%] h-[18%] bg-pink-400/10 dark:bg-pink-400/15 rounded-full blur-[90px] animate-pulse" style={{ animationDelay: '3s' }}></div>

            <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-0 glass-panel rounded-[2.5rem] overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-700">

                {/* Left Side: Branding & Illustration (Startup Style) */}
                <div className="hidden lg:flex flex-col justify-between p-8 xl:p-12 gradient-bg relative overflow-hidden">
                    <div className="absolute inset-0 opacity-[0.07]">
                        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <path d="M0 0 L100 0 L100 100 Z" fill="white" />
                            <path d="M20 100 L100 40 L100 100 Z" fill="white" />
                        </svg>
                    </div>
                    <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10 blur-[80px]"></div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-2 xl:gap-3 mb-4 xl:mb-8">
                            <div className="p-1.5 xl:p-2 bg-white/20 backdrop-blur-md rounded-lg xl:rounded-xl border border-white/25 shadow-lg">
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
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-white/80 text-sm font-bold bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-3 py-2">
                                <ShieldCheck size={18} className="text-emerald-300" /> {text.security}
                            </div>
                            <div className="flex items-center gap-2 text-white/80 text-sm font-bold bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-3 py-2">
                                <Zap size={18} className="text-amber-300" /> {text.ocr}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side: Login Form */}
                <div className="p-5 sm:p-8 xl:p-12 flex flex-col justify-center">
                    <div className="lg:hidden flex justify-center mb-4 xl:mb-8">
                        <div className="cf-logo-orb w-12 h-12 xl:w-16 xl:h-16 rounded-2xl flex items-center justify-center shadow-2xl">
                            <BookOpen className="text-white w-6 h-6 xl:w-8 xl:h-8" />
                        </div>
                    </div>

                    <div className="mb-4 xl:mb-10 relative">
                        {/* Language & Theme Toggles */}
                        <div className="absolute -top-2 xl:-top-4 right-0 flex items-center gap-2">
                            <button
                                onClick={() => setLanguage(isEnglish ? 'id' : 'en')}
                                className="neo-btn flex items-center gap-1.5 px-2.5 py-1.5 xl:px-3 xl:py-2 text-slate-600 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 group"
                                title={isEnglish ? 'Change to Indonesian' : 'Ganti ke Bahasa Inggris'}
                            >
                                <Globe size={14} className="group-hover:text-indigo-500 w-3 h-3 xl:w-3.5 xl:h-3.5" />
                                <span className="text-[9px] xl:text-[10px] font-black uppercase tracking-widest">{isEnglish ? 'EN' : 'ID'}</span>
                            </button>

                            <button
                                onClick={() => setIsDarkMode(!isDarkMode)}
                                className="neo-icon-btn w-9 h-9 xl:w-10 xl:h-10 text-slate-500 dark:text-slate-300 hover:text-amber-500 dark:hover:text-amber-400 group"
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
                                    className="neo-input w-full pl-10 xl:pl-12 pr-4 py-3 xl:py-4 dark:text-white transition-all text-sm xl:text-base font-bold"
                                    placeholder="admin / staff"
                                />
                            </div>
                        </div>
                        <div className="group">
                            <label className="block text-xs xl:text-sm font-black text-[#2B3674] dark:text-slate-300 mb-1.5 xl:mb-2 uppercase tracking-widest ml-1">{text.password}</label>
                            <div className="relative group-focus-within:scale-[1.01] transition-all duration-300">
                                <FileKey className="absolute left-3 xl:left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors w-4 h-4 xl:w-5 xl:h-5" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={loginForm.password}
                                    onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                                    className="neo-input w-full pl-10 xl:pl-12 pr-12 xl:pr-14 py-3 xl:py-4 dark:text-white transition-all text-sm xl:text-base font-bold"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 xl:right-4 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                                    title={showPassword ? (isEnglish ? 'Hide password' : 'Sembunyikan password') : (isEnglish ? 'Show password' : 'Lihat password')}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff size={18} className="xl:w-5 xl:h-5" /> : <Eye size={18} className="xl:w-5 xl:h-5" />}
                                </button>
                            </div>
                        </div>
                        <button type="submit" className="w-full py-3 xl:py-4 gradient-bg text-white rounded-xl xl:rounded-2xl text-sm xl:text-base font-black shadow-xl shadow-indigo-500/35 transition-all hover:scale-[1.02] hover:shadow-indigo-500/50 active:scale-[0.98] flex items-center justify-center gap-2 xl:gap-3 group">
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
                            className="neo-btn w-full py-3 xl:py-4 text-indigo-600 dark:text-indigo-400 rounded-xl xl:rounded-2xl text-sm xl:text-base font-black hover:text-indigo-700 dark:hover:text-indigo-300 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 xl:gap-3 group"
                        >
                            <User className="group-hover:scale-110 transition-transform w-4 h-4 xl:w-5 xl:h-5" />
                            {text.guest}
                        </button>
                    </form>
                    <p className="text-center text-[10px] xl:text-xs text-slate-500 dark:text-slate-400 mt-6 xl:mt-10 font-bold uppercase tracking-widest">{text.version}</p>
                </div>
            </div>
        </main>
    );
}
