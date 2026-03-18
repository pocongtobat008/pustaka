import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BookOpen, ChevronRight, ChevronLeft, Play,
    Lightbulb, Target, Rocket, HelpCircle, X,
    Sparkles, Info, CheckCircle2, ArrowRight, Plus, Trash2, Save, Image as ImageIcon, Layout, Upload, RefreshCw, Edit3, Copy, Search, ZoomIn, Lock, Users, Building, User
    , FileText, ShieldCheck, Zap, Globe, Award, AlertCircle
} from 'lucide-react';
import { SummaryCard } from '../components/ui/Card';
import { pustakaService } from '../services/pustakaService';
import { parseApiError } from '../utils/errorHandler';
import { getFullUrl } from '../utils/urlHelper';
import { db as api } from '../services/database'; // Keep for uploadFile
import { useLanguage } from '../contexts/LanguageContext';

const GuideAssistant = ({ message, isExplaining, onClick }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-8 right-8 z-[100] flex flex-col items-end gap-3 pointer-events-none"
    >
        <AnimatePresence mode="wait">
            {message && (
                <motion.div
                    key={message}
                    initial={{ opacity: 0, scale: 0.8, x: 20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.8, x: 20 }}
                    className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-2xl border border-indigo-100 dark:border-indigo-900 max-w-xs pointer-events-auto"
                >
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
                        {message}
                    </p>
                    <div className="absolute -bottom-2 right-8 w-4 h-4 bg-white dark:bg-slate-800 rotate-45 border-r border-b border-indigo-100 dark:border-indigo-900"></div>
                </motion.div>
            )}
        </AnimatePresence>

        <motion.div
            animate={isExplaining ? {
                y: [0, -10, 0],
                rotate: [0, -5, 5, 0]
            } : { y: [0, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
            onClick={onClick}
            className="w-20 h-20 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-full shadow-2xl flex items-center justify-center border-4 border-white dark:border-slate-900 pointer-events-auto cursor-pointer"
        >
            <Sparkles className="text-white animate-pulse" size={32} />
        </motion.div>
    </motion.div>
);


const PustakaLandingPage = ({ onClose }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-slate-50/80 dark:bg-[#0B1437]/90 backdrop-blur-xl overflow-y-auto custom-scrollbar p-6 md:p-12"
    >
        <div className="max-w-5xl mx-auto">
            <div className="flex justify-end mb-8">
                <button
                    onClick={onClose}
                    className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-lg text-slate-400 hover:text-red-500 transition-all hover:scale-110"
                >
                    <X size={24} />
                </button>
            </div>

            <div className="text-center mb-16 space-y-6">
                <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="inline-flex items-center gap-2 px-6 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-sm font-black uppercase tracking-widest mb-4"
                >
                    <Sparkles size={16} />
                    <span>The Vision</span>
                </motion.div>
                <motion.h1
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-5xl md:text-7xl font-black text-[#2B3674] dark:text-white tracking-tight leading-tight"
                >
                    Latar Belakang <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Pustaka Pengetahuan</span>
                </motion.h1>
                <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-xl text-slate-500 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed font-medium"
                >
                    Membangun fondasi pengetahuan yang kuat, terstruktur, dan siap menghadapi perkembangan di masa depan.
                </motion.p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                <motion.div
                    initial={{ x: -50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="p-8 bg-white dark:bg-slate-800 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-700 relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <AlertCircle size={120} />
                    </div>
                    <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                        <HelpCircle size={28} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-4 uppercase tracking-tight">Tantangan Operasional</h3>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                        Dalam lingkungan kerja yang dinamis, keberlangsungan operasional sangat bergantung pada ketersediaan informasi. Namun, banyak pengetahuan penting masih tersimpan secara personal pada masing-masing karyawan.
                    </p>
                    <div className="mt-6 p-4 bg-red-50/50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/20">
                        <p className="text-sm text-red-700 dark:text-red-400 font-bold italic">
                            "Kendala muncul saat karyawan cuti, mutasi, atau resign karena kurangnya panduan terdokumentasi."
                        </p>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ x: 50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="p-8 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[3rem] shadow-2xl text-white relative overflow-hidden group"
                >
                    <div className="absolute bottom-0 left-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Rocket size={120} />
                    </div>
                    <div className="w-14 h-14 bg-white/20 backdrop-blur-md text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                        <Target size={28} />
                    </div>
                    <h3 className="text-2xl font-black mb-4 uppercase tracking-tight">Solusi Terpadu</h3>
                    <p className="text-indigo-50 leading-relaxed font-medium">
                        Pustaka Pengetahuan dibangun sebagai pusat dokumentasi digital yang berisi panduan kerja, tutorial, prosedur operasional, serta best practice dari setiap divisi.
                    </p>
                    <ul className="mt-6 space-y-3">
                        {['User Guide Terpadu', 'Akses Kapan Saja', 'Dokumentasi Sistematis'].map((item, i) => (
                            <li key={i} className="flex items-center gap-3 text-sm font-bold">
                                <CheckCircle2 size={18} className="text-emerald-400" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </motion.div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
                {[
                    { icon: Users, title: "Kemandirian Tim", desc: "Pengetahuan tidak lagi bergantung pada individu tertentu, menjaga keberlangsungan pekerjaan.", color: "bg-blue-50 text-blue-600" },
                    { icon: Zap, title: "Adaptasi Cepat", desc: "Mempercepat proses onboarding karyawan baru melalui modul pembelajaran mandiri.", color: "bg-amber-50 text-amber-600" },
                    { icon: Award, title: "Kualitas Berkelanjutan", desc: "Peningkatan kualitas kerja secara terus-menerus melalui standarisasi best practice.", color: "bg-emerald-50 text-emerald-600" }
                ].map((feature, i) => (
                    <motion.div
                        key={i}
                        initial={{ y: 30, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.6 + (i * 0.1) }}
                        className="p-6 bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all hover:-translate-y-2"
                    >
                        <div className={`w-12 h-12 ${feature.color} rounded-2xl flex items-center justify-center mb-4 shadow-inner`}>
                            <feature.icon size={24} />
                        </div>
                        <h4 className="font-black text-slate-800 dark:text-white mb-2 uppercase tracking-tight text-sm">{feature.title}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{feature.desc}</p>
                    </motion.div>
                ))}
            </div>

            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.9 }} className="text-center">
                <button onClick={onClose} className="px-12 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-2xl shadow-indigo-500/40 transition-all hover:scale-105 active:scale-95 flex items-center gap-3 mx-auto">
                    Mulai Menjelajah <ArrowRight size={20} />
                </button>
            </motion.div>
        </div>
    </motion.div>
);

const SlideViewer = ({ guide, slides, currentIdx, onNext, onPrev, onClose, setZoomedImage, getFullUrl }) => {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight') onNext();
            if (e.key === 'ArrowLeft') onPrev();
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onNext, onPrev, onClose]);

    const currentSlide = slides[currentIdx];
    const progress = ((currentIdx + 1) / slides.length) * 100;

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-4 md:p-10"
        >
            {/* Top Progress Bar */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-800">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 shadow-[0_0_20px_rgba(99,102,241,0.6)]"
                />
            </div>

            <div className="max-w-7xl w-full h-full flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-indigo-500/20">
                            <BookOpen size={28} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tight">{guide.title}</h2>
                            <p className="text-xs font-bold text-indigo-400 uppercase tracking-[0.2em]">
                                Langkah {currentIdx + 1} dari {slides.length} â€¢ {guide.category}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-4 bg-white/5 hover:bg-red-500/20 text-white hover:text-red-500 rounded-2xl transition-all hover:scale-110 border border-white/10"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center min-h-0">
                    <motion.div
                        key={`text-${currentIdx}`}
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-8 overflow-y-auto custom-scrollbar pr-6 max-h-full"
                    >
                        <div className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-500/10 text-indigo-400 rounded-full text-xs font-black uppercase tracking-widest border border-indigo-500/20">
                            <Target size={14} /> Step {currentIdx + 1}
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black text-white leading-tight tracking-tighter">
                            {currentSlide?.title}
                        </h1>
                        <p className="text-xl md:text-2xl text-slate-400 leading-relaxed font-medium">
                            {currentSlide?.content}
                        </p>
                    </motion.div>

                    <motion.div
                        key={`img-${currentIdx}`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative group h-full min-h-[300px] lg:min-h-0"
                    >
                        <div className="absolute inset-0 bg-indigo-500/20 blur-[120px] rounded-full opacity-20 group-hover:opacity-40 transition-opacity"></div>
                        <div
                            onClick={() => currentSlide?.image && setZoomedImage(getFullUrl(currentSlide.image))}
                            className="relative h-full w-full rounded-[4rem] overflow-hidden border-4 border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] cursor-zoom-in group"
                        >
                            <img
                                src={getFullUrl(currentSlide?.image) || undefined}
                                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                                alt="Step Illustration"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-10">
                                <div className="flex items-center gap-3 text-white font-black text-xs uppercase tracking-widest">
                                    <ZoomIn size={20} /> Klik untuk memperbesar
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Footer Controls */}
                <div className="flex justify-between items-center mt-8 pt-8 border-t border-white/5">
                    <button
                        disabled={currentIdx === 0}
                        onClick={onPrev}
                        className="flex items-center gap-3 px-10 py-5 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all disabled:opacity-10 disabled:cursor-not-allowed border border-white/5"
                    >
                        <ChevronLeft size={20} /> Sebelumnya
                    </button>
                    <button
                        onClick={onNext}
                        className="flex items-center gap-3 px-14 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl shadow-indigo-500/40 transition-all hover:scale-105 active:scale-95"
                    >
                        {currentIdx === slides.length - 1 ? 'Selesai Belajar' : 'Langkah Berikutnya'} <ArrowRight size={20} />
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

export default function Pustaka({ currentUser, hasPermission, users = [], departments = [], syncPustakaFolder }) {
    const { language } = useLanguage();
    const isEnglish = language === 'en';
    const i18n = isEnglish
        ? {
            assistantInitial: 'Hello! I am your Pustaka assistant. Choose a guide to start learning.',
            assistantGuideStart: (title) => `Great! Let us learn about ${title}.`,
            assistantNext: 'The next step is very important, please pay attention.',
            assistantDone: 'Excellent! You have completed this guide.',
            emptySlideTitle: 'No slide yet',
            emptySlideContent: 'This guide does not have content yet.',
            totalGuides: 'Total Guides',
            categories: 'Categories',
            myGuides: 'My Guides',
            publicAccess: 'Public Access',
            filterCategory: 'Category Filter',
            allGuides: 'All Guides',
            addGuide: 'Add Guide',
            knowledgeCenter: 'Knowledge Center',
            knowledgeCenterDesc: 'Choose one module on the left to start an interactive tutorial.',
            updateGuidePrompt: (title) => `Let us update guide "${title}".`,
            deleteGuideConfirm: 'Delete this guide permanently?',
            guideDeleted: 'Guide has been removed from the library.',
            deleteFailed: (msg) => `Failed to delete: ${msg || 'Unknown error'}`,
            guideValidation: 'Please fill in the guide title and all slide titles.',
            savingGuide: 'Saving your guide to the digital shelf...',
            saveSuccessEdit: 'Changes saved successfully!',
            saveSuccessNew: 'Great! New guide published successfully.',
            saveFailedGetId: 'Failed to get guide ID. Please try again.',
            saveFailed: (msg) => `Failed to save: ${msg || 'System error.'}`,
            createGuidePrompt: 'You want to create a new guide? I am ready to help!',
            editGuideTitle: 'Edit Guide',
            newGuideEditor: 'New Guide Editor',
            editGuideDesc: 'Update existing work steps',
            newGuideDesc: 'Arrange interactive work steps',
            guideTitle: 'Guide Title',
            guideTitlePlaceholder: 'Example: How to Use the Scanner',
            category: 'Category',
            privacyAccess: 'Privacy & Access',
            privacyPublic: 'Public',
            privacyPrivate: 'Private',
            privacyDepartment: 'Department',
            privacySpecificUser: 'Specific User',
            slidesSteps: 'Steps (Slides)',
            addSlide: 'ADD SLIDE',
            duplicateSlide: 'Duplicate Slide',
            deleteSlide: 'Delete Slide',
            slideTitlePlaceholder: 'Step Title...',
            slideContentPlaceholder: 'Detailed explanation of work steps...',
            uploadPaste: 'Upload / Paste',
            cancel: 'Cancel',
            saving: 'Saving...',
            saveChanges: 'Save Changes',
            publishGuide: 'Publish Guide',
        }
        : {
            assistantInitial: 'Halo! Saya asisten Pustaka. Pilih panduan untuk mulai belajar.',
            assistantGuideStart: (title) => `Bagus! Mari kita pelajari tentang ${title}.`,
            assistantNext: 'Langkah selanjutnya sangat penting, perhatikan ya!',
            assistantDone: 'Luar biasa! Anda telah menyelesaikan panduan ini.',
            emptySlideTitle: 'Belum ada slide',
            emptySlideContent: 'Panduan ini belum memiliki konten.',
            totalGuides: 'Total Panduan',
            categories: 'Kategori',
            myGuides: 'Panduan Saya',
            publicAccess: 'Akses Publik',
            filterCategory: 'Filter Kategori',
            allGuides: 'Semua Panduan',
            addGuide: 'Tambah Panduan',
            knowledgeCenter: 'Pusat Pengetahuan',
            knowledgeCenterDesc: 'Pilih salah satu modul di sebelah kiri untuk memulai tutorial interaktif.',
            updateGuidePrompt: (title) => `Mari kita perbarui panduan "${title}".`,
            deleteGuideConfirm: 'Hapus panduan ini secara permanen?',
            guideDeleted: 'Panduan telah dihapus dari perpustakaan.',
            deleteFailed: (msg) => `Gagal menghapus: ${msg || 'Terjadi kesalahan'}`,
            guideValidation: 'Ups! Pastikan judul panduan dan semua judul slide sudah diisi ya.',
            savingGuide: 'Sedang menyimpan panduan baru Anda ke rak buku digital...',
            saveSuccessEdit: 'Perubahan berhasil disimpan!',
            saveSuccessNew: 'Hore! Panduan baru berhasil diterbitkan.',
            saveFailedGetId: 'Gagal mendapatkan ID panduan. Silakan coba lagi.',
            saveFailed: (msg) => `Gagal menyimpan: ${msg || 'Terjadi kesalahan sistem.'}`,
            createGuidePrompt: 'Wah, Anda ingin membuat panduan baru? Saya siap membantu!',
            editGuideTitle: 'Edit Panduan',
            newGuideEditor: 'Editor Panduan Baru',
            editGuideDesc: 'Perbarui langkah kerja yang sudah ada',
            newGuideDesc: 'Susun langkah kerja secara interaktif',
            guideTitle: 'Judul Panduan',
            guideTitlePlaceholder: 'Contoh: Cara Menggunakan Scanner',
            category: 'Kategori',
            privacyAccess: 'Privasi & Akses',
            privacyPublic: 'Umum',
            privacyPrivate: 'Pribadi',
            privacyDepartment: 'Departemen',
            privacySpecificUser: 'User Khusus',
            slidesSteps: 'Langkah-langkah (Slides)',
            addSlide: 'TAMBAH SLIDE',
            duplicateSlide: 'Duplikat Slide',
            deleteSlide: 'Hapus Slide',
            slideTitlePlaceholder: 'Judul Langkah...',
            slideContentPlaceholder: 'Penjelasan detail langkah kerja...',
            uploadPaste: 'Upload / Paste',
            cancel: 'Batalkan',
            saving: 'Menyimpan...',
            saveChanges: 'Simpan Perubahan',
            publishGuide: 'Terbitkan Panduan',
        };
    const [guides, setGuides] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedGuide, setSelectedGuide] = useState(null);
    const [slides, setSlides] = useState([]);
    const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
    const [assistantMsg, setAssistantMsg] = useState(i18n.assistantInitial);
    const [isCreating, setIsCreating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(null); // Index slide yang sedang upload
    const [editingGuideId, setEditingGuideId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [zoomedImage, setZoomedImage] = useState(null);
    const [showAbout, setShowAbout] = useState(false);

    const [newGuide, setNewGuide] = useState({
        title: '',
        category: '',
        description: '',
        icon: 'BookOpen',
        privacy: 'public',
        allowed_depts: [],
        allowed_users: [],
        slides: [{ title: '', content: '', image: '' }]
    });

    const fetchGuides = () => {
        api.getPustakaGuides().then(data => {
            setGuides(data || []);
        });

        api.getPustakaCategories().then(data => {
            if (data.length === 0) {
                // Keep default categories if none exist, or fetch from simplified default
                setCategories([{ id: 1, name: 'Operasional' }, { id: 2, name: 'Teknis' }, { id: 3, name: 'Compliance' }]);
                if (!newGuide.category) setNewGuide(prev => ({ ...prev, category: 'Operasional' }));
            } else {
                setCategories(data);
                if (!newGuide.category) setNewGuide(prev => ({ ...prev, category: data[0].name }));
            }
        });
    };

    useEffect(() => { fetchGuides(); }, []);

    // Real-time sync: auto-refresh when another client modifies pustaka data
    useEffect(() => {
        let cleanup;
        import('../services/socketService.js').then(({ getSocket }) => {
            const socket = getSocket();
            const handler = ({ channel }) => {
                if (channel === 'pustaka') {
                    console.log('[Socket.IO] Pustaka data changed — refetching...');
                    fetchGuides();
                }
            };
            socket.on('data:changed', handler);
            cleanup = () => socket.off('data:changed', handler);
        });
        return () => cleanup?.();
    }, []);

    // Handle Search
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchQuery.trim()) {
                api.searchPustaka(searchQuery).then(setGuides);
            } else {
                fetchGuides(); // Reset to all if empty
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const startGuide = async (guide) => {
        setSelectedGuide(guide);
        setIsCreating(false);
        setCurrentSlideIdx(0);
        setAssistantMsg(i18n.assistantGuideStart(guide.title));

        const data = await api.getGuideSlides(guide.id);
        if (data.length === 0) {
            // No slides available - show empty state instead of confusing mock data
            setSlides([{ title: i18n.emptySlideTitle, content: i18n.emptySlideContent, image: '' }]);
        } else {
            setSlides(data);
        }
    };

    const nextSlide = () => {
        if (currentSlideIdx < slides.length - 1) {
            setCurrentSlideIdx(prev => prev + 1);
            setAssistantMsg(i18n.assistantNext);
        } else {
            setAssistantMsg(i18n.assistantDone);
            setSelectedGuide(null); // Auto close on finish
        }
    };

    const handleAddSlide = () => {
        setNewGuide({ ...newGuide, slides: [...newGuide.slides, { title: '', content: '', image: '' }] });
    };

    const handleRemoveSlide = (idx) => {
        const updated = newGuide.slides.filter((_, i) => i !== idx);
        setNewGuide({ ...newGuide, slides: updated });
    };

    const handleCopySlide = (idx) => {
        const slides = [...newGuide.slides];
        const slideToCopy = { ...slides[idx] };
        slides.splice(idx + 1, 0, slideToCopy);
        setNewGuide({ ...newGuide, slides: slides });
    };

    const handleImageAction = async (file, index) => {
        if (!file || !file.type.startsWith('image/')) return;

        setIsUploading(index);
        setAssistantMsg("Wah, gambar yang bagus! Sedang saya simpan ya...");

        const previousSlides = [...newGuide.slides];
        const localPreviewUrl = URL.createObjectURL(file);

        // Update UI Seketika dengan Preview Lokal
        const updated = [...newGuide.slides];
        updated[index] = { ...updated[index], image: localPreviewUrl };
        setNewGuide({ ...newGuide, slides: updated });

        try {
            const res = await api.uploadFile(file);
            if (res.success) {
                // Ganti preview lokal dengan URL permanen dari server
                setNewGuide(prev => {
                    const newSlides = [...prev.slides];
                    newSlides[index] = { ...newSlides[index], image: res.url };
                    return { ...prev, slides: newSlides };
                });
                setAssistantMsg("Gambar berhasil terpasang di slide!");
            }
        } catch (e) {
            setNewGuide({ ...newGuide, slides: previousSlides });
            setAssistantMsg("Aduh, gagal mengunggah gambar. Coba lagi ya?");
        } finally {
            setIsUploading(null);
        }
    };

    const handlePaste = (e, index) => {
        const items = (e.clipboardData || window.clipboardData).items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    e.preventDefault(); // Stop default text paste if it's an image
                    handleImageAction(file, index);
                }
            }
        }
    };

    const handleAddCategory = async () => {
        const name = prompt("Masukkan nama kategori baru:");
        if (name) {
            const previousCategories = [...categories];
            // Optimistic Update
            setCategories([...categories, { id: Date.now(), name }]);
            try {
                await api.createPustakaCategory(name);
                fetchGuides(); // Sinkronisasi ulang untuk mendapatkan ID asli
            } catch (e) {
                setCategories(previousCategories);
                const msg = await parseApiError(e);
                alert("Gagal menambah kategori: " + msg);
            }
        }
    };

    const handleEditGuide = async (guide, e) => {
        e.stopPropagation();
        setIsCreating(true);
        setEditingGuideId(guide.id);
        setSelectedGuide(null);

        const guideSlides = await api.getGuideSlides(guide.id);
        setNewGuide({
            title: guide.title,
            category: guide.category,
            description: guide.description || '',
            privacy: guide.privacy || 'public',
            allowed_depts: guide.allowed_depts || [],
            allowed_users: guide.allowed_users || [],
            icon: guide.icon || 'BookOpen',
            slides: guideSlides.length > 0
                ? guideSlides.map(s => ({
                    ...s,
                    title: s.title || '',
                    content: s.content || '',
                    image: s.image || '' // Ensure image is populated for edit
                }))
                : [{ title: '', content: '', image: '' }]
        });
        setAssistantMsg(i18n.updateGuidePrompt(guide.title));
    };

    const handleDeleteGuide = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm(i18n.deleteGuideConfirm)) return;

        const previousGuides = [...guides];
        // Optimistic Update
        setGuides(guides.filter(g => g.id !== id));

        try {
            await api.deletePustakaGuide(id);
            setAssistantMsg(i18n.guideDeleted);
            if (selectedGuide?.id === id) setSelectedGuide(null);
        } catch (error) {
            setGuides(previousGuides);
            console.error("Delete Error:", error);
            setAssistantMsg(i18n.deleteFailed(error.message));
        }
    };

    const handleSaveGuide = async () => {
        if (!newGuide.title || newGuide.slides.some(s => !s.title)) {
            setAssistantMsg(i18n.guideValidation);
            return;
        }

        setIsSaving(true);
        setAssistantMsg(i18n.savingGuide);

        const oldTitle = guides.find(g => g.id === editingGuideId)?.title;

        // Sinkronisasi Folder Digital di Dokumen
        const pustakaFolderId = await syncPustakaFolder(newGuide.title, oldTitle);

        const previousGuides = [...guides];

        try {
            let guideId = editingGuideId;

            if (editingGuideId) {
                // Optimistic Update untuk mode Edit
                setGuides(guides.map(g => g.id === editingGuideId ? { ...g, ...newGuide } : g));

                await api.updatePustakaGuide(editingGuideId, {
                    title: newGuide.title,
                    description: newGuide.description,
                    category: newGuide.category,
                    privacy: newGuide.privacy,
                    allowed_depts: newGuide.allowed_depts,
                    allowed_users: newGuide.allowed_users,
                    icon: newGuide.icon
                });
                await api.deleteSlidesByGuideId(editingGuideId);
            } else {
                const guideRes = await api.createPustakaGuide({
                    title: newGuide.title,
                    description: newGuide.description,
                    category: newGuide.category,
                    icon: newGuide.icon,
                    privacy: newGuide.privacy,
                    allowed_depts: newGuide.allowed_depts,
                    allowed_users: newGuide.allowed_users,
                    owner: currentUser?.username
                });
                guideId = guideRes.id;
            }

            if (guideId) {
                // Fetch existing docs to manage file locations
                const existingDocs = await api.getDocs();

                const slidePromises = newGuide.slides.map(async (slide, idx) => {
                    await api.createPustakaSlide({
                        guide_id: guideId,
                        title: slide.title,
                        content: slide.content,
                        image_url: slide.image, // Send as image_url to match controller preference
                        step_order: idx + 1
                    });

                    // MANAJEMEN FILE: Pindahkan gambar ke folder Pustaka yang sesuai
                    if (slide.image && pustakaFolderId) {
                        // Cari dokumen yang URL-nya cocok dengan gambar slide
                        const matchDoc = existingDocs.find(d => d.url === slide.image);

                        if (matchDoc) {
                            // Jika dokumen ditemukan (biasanya di Root), pindahkan ke folder panduan
                            if (String(matchDoc.folderId) !== String(pustakaFolderId)) {
                                await api.updateDocument(matchDoc.id, { ...matchDoc, folderId: pustakaFolderId });
                            }
                        } else {
                            // Jika dokumen belum terdaftar, buat record baru di folder panduan
                            await api.createDocument({
                                id: `PUSTAKA-IMG-${Date.now()}-${idx}`,
                                title: `Gbr Step ${idx + 1} - ${slide.title || 'Untitled'}`,
                                type: 'image/png', // Default fallback
                                size: '0 KB',
                                uploadDate: new Date().toISOString(),
                                folderId: String(pustakaFolderId),
                                url: slide.image,
                                uploader: currentUser?.name || 'System'
                            });
                        }
                    }
                });
                await Promise.all(slidePromises);

                setAssistantMsg(editingGuideId ? i18n.saveSuccessEdit : i18n.saveSuccessNew);
                setIsCreating(false);
                setEditingGuideId(null);
                setNewGuide({ title: '', category: 'Operasional', description: '', icon: 'BookOpen', privacy: 'public', allowed_depts: [], allowed_users: [], slides: [{ title: '', content: '', image: '' }] });
                fetchGuides();
            } else {
                throw new Error(i18n.saveFailedGetId);
            }
        } catch (e) {
            setGuides(previousGuides);
            console.error("Save Guide Error:", e);
            setAssistantMsg(i18n.saveFailed(e.message));
        } finally {
            setIsSaving(false);
        }
    };

    // Filter guides based on privacy, current user, and category
    const filteredGuides = guides.filter(guide => {
        // Category Filter
        if (selectedCategory !== 'All' && guide.category !== selectedCategory) return false;

        // Admin sees all
        if (currentUser?.role === 'admin') return true;
        // Owner sees their own
        if (guide.owner === currentUser?.username) return true;

        if (guide.privacy === 'public') return true;
        if (guide.privacy === 'private') return false; // Only owner (checked above)
        if (guide.privacy === 'dept') return (guide.allowed_depts || []).includes(currentUser?.department);
        if (guide.privacy === 'user') return (guide.allowed_users || []).includes(currentUser?.username);
        return false;
    });

    const stats = {
        total: guides.length,
        categories: categories.length,
        myGuides: guides.filter(g => g.owner === currentUser?.username).length,
        public: guides.filter(g => g.privacy === 'public').length
    };

    return (
        <div className="relative min-h-[80vh] pb-20">
            {/* Header Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <SummaryCard
                    title={i18n.totalGuides}
                    value={stats.total}
                    icon={BookOpen}
                    colorClass="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"
                />
                <SummaryCard
                    title={i18n.categories}
                    value={stats.categories}
                    icon={Layout}
                    colorClass="bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400"
                />
                <SummaryCard
                    title={i18n.myGuides}
                    value={stats.myGuides}
                    icon={User}
                    colorClass="bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                />
                <SummaryCard
                    title={i18n.publicAccess}
                    value={stats.public}
                    icon={Globe}
                    colorClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Sidebar List Panduan */}
                <div className="space-y-4">
                    {/* Search removed - using AI Chat Assistant */}


                    {/* Modern Category Dropdown Filter */}
                    <div className="relative">
                        <button
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className="w-full flex items-center justify-between px-5 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-sm hover:border-indigo-500 transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600">
                                    <Layout size={18} />
                                </div>
                                <div className="text-left">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{i18n.filterCategory}</p>
                                    <p className="text-sm font-bold text-slate-700 dark:text-white">{selectedCategory === 'All' ? i18n.allGuides : selectedCategory}</p>
                                </div>
                            </div>
                            <ChevronRight size={18} className={`text-slate-400 transition-transform duration-300 ${isFilterOpen ? 'rotate-90' : ''}`} />
                        </button>

                        <AnimatePresence>
                            {isFilterOpen && (
                                <>
                                    <div className="fixed inset-0 z-[110]" onClick={() => setIsFilterOpen(false)} />
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] shadow-2xl z-[120] overflow-hidden p-2 backdrop-blur-xl"
                                    >
                                        <button
                                            onClick={() => { setSelectedCategory('All'); setIsFilterOpen(false); }}
                                            className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${selectedCategory === 'All' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Globe size={16} className={selectedCategory === 'All' ? 'text-white' : 'text-indigo-500'} />
                                                <span className="font-bold text-sm">{i18n.allGuides}</span>
                                            </div>
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${selectedCategory === 'All' ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}>{guides.length}</span>
                                        </button>
                                        {categories.map(cat => {
                                            const count = guides.filter(g => g.category === cat.name).length;
                                            return (
                                                <button
                                                    key={cat.id}
                                                    onClick={() => { setSelectedCategory(cat.name); setIsFilterOpen(false); }}
                                                    className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all mt-1 ${selectedCategory === cat.name ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-2 h-2 rounded-full ${selectedCategory === cat.name ? 'bg-white' : 'bg-indigo-500'}`} />
                                                        <span className="font-bold text-sm">{cat.name}</span>
                                                    </div>
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${selectedCategory === cat.name ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}>{count}</span>
                                                </button>
                                            );
                                        })}
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>

                    {hasPermission('pustaka', 'create') && (
                        <button
                            onClick={() => {
                                setIsCreating(true);
                                setEditingGuideId(null);
                                setSelectedGuide(null);
                                // Reset form to default state for new guide
                                setNewGuide({
                                    title: '',
                                    category: categories[0]?.name || 'Operasional',
                                    description: '',
                                    icon: 'BookOpen',
                                    privacy: 'public',
                                    allowed_depts: [],
                                    allowed_users: [],
                                    slides: [{ title: '', content: '', image: '' }]
                                });
                                setAssistantMsg(i18n.createGuidePrompt);
                            }}
                            className={`w-full p-5 rounded-[2rem] border-2 border-dashed transition-all flex items-center gap-4 group ${isCreating
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-indigo-400 hover:text-indigo-500'
                                }`}
                        >
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${isCreating ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800'
                                }`}>
                                <Plus size={24} />
                            </div>
                            <span className="font-black uppercase tracking-widest text-xs">{i18n.addGuide}</span>
                        </button>
                    )}

                    {filteredGuides.map(guide => (
                        <motion.div
                            key={guide.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            onClick={() => startGuide(guide)}
                            className={`p-5 rounded-[2rem] border cursor-pointer transition-all group ${selectedGuide?.id === guide.id
                                ? 'bg-indigo-600 border-indigo-500 shadow-xl text-white'
                                : 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-indigo-300 text-slate-800 dark:text-white shadow-sm hover:shadow-md'
                                }`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${selectedGuide?.id === guide.id ? 'bg-white/20' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600'
                                    }`}>
                                    <BookOpen size={24} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${selectedGuide?.id === guide.id ? 'text-indigo-200' : 'text-indigo-50'}`}>
                                        {guide.category}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-bold truncate">{guide.title}</h4>
                                        {guide.privacy !== 'public' && (
                                            <Lock size={10} className={selectedGuide?.id === guide.id ? 'text-indigo-200' : 'text-slate-400'} />
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {hasPermission('pustaka', 'edit') && (
                                        <button onClick={(e) => handleEditGuide(guide, e)} className={`p-1.5 rounded-lg transition-colors ${selectedGuide?.id === guide.id ? 'hover:bg-white/20 text-white' : 'hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'}`}>
                                            <Edit3 size={14} />
                                        </button>
                                    )}
                                    {hasPermission('pustaka', 'delete') && (
                                        <button onClick={(e) => handleDeleteGuide(guide.id, e)} className={`p-1.5 rounded-lg transition-colors ${selectedGuide?.id === guide.id ? 'hover:bg-white/20 text-white' : 'hover:bg-red-50 text-slate-400 hover:text-red-600'}`}>
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                    <ChevronRight size={18} className={selectedGuide?.id === guide.id ? 'text-white' : 'text-slate-300'} />
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Main Content Area (Slide Viewer) */}
                <div className="md:col-span-2">
                    <AnimatePresence mode="wait">
                        {isCreating ? (
                            <motion.div
                                key="form"
                                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                                className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col h-full"
                            >
                                <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-indigo-50/30 dark:bg-indigo-900/10">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                                            <Layout size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">{editingGuideId ? i18n.editGuideTitle : i18n.newGuideEditor}</h3>
                                            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{editingGuideId ? i18n.editGuideDesc : i18n.newGuideDesc}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setIsCreating(false)} className="p-3 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all">
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="p-8 space-y-8 overflow-y-auto max-h-[65vh] custom-scrollbar">
                                    {/* Guide Metadata */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{i18n.guideTitle}</label>
                                            <input
                                                className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none dark:text-white font-bold"
                                                placeholder={i18n.guideTitlePlaceholder}
                                                value={newGuide.title}
                                                onChange={e => setNewGuide({ ...newGuide, title: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{i18n.category}</label>
                                            <div className="flex gap-2">
                                                <select
                                                    className="flex-1 px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none dark:text-white font-bold appearance-none"
                                                    value={newGuide.category}
                                                    onChange={e => setNewGuide({ ...newGuide, category: e.target.value })}
                                                >
                                                    {categories.map(cat => (
                                                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                                                    ))}
                                                </select>
                                                <button onClick={handleAddCategory} className="p-4 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition-all">
                                                    <Plus size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Privacy Settings */}
                                    <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{i18n.privacyAccess}</label>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                            {[
                                                { id: 'public', label: i18n.privacyPublic, icon: Users },
                                                { id: 'private', label: i18n.privacyPrivate, icon: Lock },
                                                { id: 'dept', label: i18n.privacyDepartment, icon: Building },
                                                { id: 'user', label: i18n.privacySpecificUser, icon: User }
                                            ].map(type => (
                                                <button
                                                    key={type.id}
                                                    onClick={() => setNewGuide({ ...newGuide, privacy: type.id })}
                                                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${newGuide.privacy === type.id
                                                        ? 'bg-indigo-50 border-indigo-500 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-indigo-300'
                                                        }`}
                                                >
                                                    <type.icon size={16} />
                                                    <span className="text-[10px] font-bold uppercase">{type.label}</span>
                                                </button>
                                            ))}
                                        </div>

                                        {newGuide.privacy === 'dept' && (
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 max-h-32 overflow-y-auto custom-scrollbar">
                                                {departments.map(dept => (
                                                    <label key={dept.id} className="flex items-center gap-2 p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={newGuide.allowed_depts.includes(dept.name)}
                                                            onChange={(e) => {
                                                                const newDepts = e.target.checked
                                                                    ? [...newGuide.allowed_depts, dept.name]
                                                                    : newGuide.allowed_depts.filter(d => d !== dept.name);
                                                                setNewGuide({ ...newGuide, allowed_depts: newDepts });
                                                            }}
                                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                                        />
                                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{dept.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}

                                        {newGuide.privacy === 'user' && (
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 max-h-32 overflow-y-auto custom-scrollbar">
                                                {users.filter(u => u.username !== currentUser?.username).map(user => (
                                                    <label key={user.id} className="flex items-center gap-2 p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={newGuide.allowed_users.includes(user.username)}
                                                            onChange={(e) => {
                                                                const newUsers = e.target.checked
                                                                    ? [...newGuide.allowed_users, user.username]
                                                                    : newGuide.allowed_users.filter(u => u !== user.username);
                                                                setNewGuide({ ...newGuide, allowed_users: newUsers });
                                                            }}
                                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                                        />
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{user.name}</span>
                                                            <span className="text-[9px] text-slate-400">{user.department}</span>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Slides Editor */}
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">{i18n.slidesSteps}</h4>
                                            <button onClick={handleAddSlide} className="flex items-center gap-2 text-xs font-black text-indigo-600 hover:text-indigo-700">
                                                <Plus size={16} /> {i18n.addSlide}
                                            </button>
                                        </div>

                                        <div className="space-y-6">
                                            {newGuide.slides.map((slide, idx) => (
                                                <div key={idx} onPaste={(e) => handlePaste(e, idx)} className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-800 relative group/slide">
                                                    <div className="absolute -left-3 top-6 w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-xs font-black shadow-lg">{idx + 1}</div>
                                                    <div className="absolute -right-2 -top-2 flex gap-1.5 opacity-0 group-hover/slide:opacity-100 transition-opacity">
                                                        <button onClick={() => handleCopySlide(idx)} className="p-2 bg-white dark:bg-slate-700 text-blue-500 rounded-full shadow-md" title={i18n.duplicateSlide}>
                                                            <Copy size={14} />
                                                        </button>
                                                        {newGuide.slides.length > 1 && (
                                                            <button onClick={() => handleRemoveSlide(idx)} className="p-2 bg-white dark:bg-slate-700 text-red-500 rounded-full shadow-md" title={i18n.deleteSlide}>
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                        <div className="md:col-span-2 space-y-4">
                                                            <input
                                                                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none dark:text-white font-bold text-sm"
                                                                placeholder={i18n.slideTitlePlaceholder}
                                                                value={slide.title}
                                                                onChange={e => {
                                                                    const updated = [...newGuide.slides];
                                                                    updated[idx].title = e.target.value;
                                                                    setNewGuide({ ...newGuide, slides: updated });
                                                                }}
                                                            />
                                                            <textarea
                                                                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none dark:text-white text-xs min-h-[80px] resize-none"
                                                                placeholder={i18n.slideContentPlaceholder}
                                                                value={slide.content}
                                                                onChange={e => {
                                                                    const updated = [...newGuide.slides];
                                                                    updated[idx].content = e.target.value;
                                                                    setNewGuide({ ...newGuide, slides: updated });
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="w-full h-24 bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center text-slate-400 group cursor-pointer hover:border-indigo-400 transition-colors relative overflow-hidden">
                                                                {isUploading === idx ? (
                                                                    <RefreshCw size={24} className="animate-spin text-indigo-500" />
                                                                ) : slide.image ? (
                                                                    <img src={getFullUrl(slide.image)} className="w-full h-full object-cover rounded-xl shadow-sm" alt="Preview" />
                                                                ) : (
                                                                    <>
                                                                        <Upload size={24} className="mb-1 group-hover:text-indigo-500" />
                                                                        <span className="text-[8px] font-black uppercase">{i18n.uploadPaste}</span>
                                                                    </>
                                                                )}
                                                                <input
                                                                    type="file"
                                                                    className="hidden"
                                                                    accept="image/*"
                                                                    onChange={(e) => handleImageAction(e.target.files[0], idx)}
                                                                />
                                                            </label>
                                                            <input
                                                                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none dark:text-white text-[10px]"
                                                                placeholder="https://..."
                                                                value={slide.image}
                                                                onChange={e => {
                                                                    const updated = [...newGuide.slides];
                                                                    updated[idx].image = e.target.value;
                                                                    setNewGuide({ ...newGuide, slides: updated });
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-8 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-4">
                                    <button
                                        onClick={() => setIsCreating(false)}
                                        className="px-8 py-4 text-slate-500 font-black uppercase text-xs tracking-widest hover:text-slate-800 transition-colors"
                                    >
                                        {i18n.cancel}
                                    </button>
                                    <button
                                        onClick={handleSaveGuide}
                                        disabled={isSaving}
                                        className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-500/20 hover:bg-indigo-500 transition-all active:scale-95 flex items-center gap-3 disabled:opacity-50"
                                    >
                                        {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                                        {isSaving ? i18n.saving : editingGuideId ? i18n.saveChanges : i18n.publishGuide}
                                    </button>
                                </div>
                            </motion.div>
                        ) : !selectedGuide ? (
                            <motion.div
                                key="empty"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="h-full flex flex-col items-center justify-center text-center p-12 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800"
                            >
                                <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mb-6">
                                    <Lightbulb size={40} className="text-indigo-500 animate-pulse" />
                                </div>
                                <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">{i18n.knowledgeCenter}</h3>
                                <p className="text-slate-500 max-w-xs">{i18n.knowledgeCenterDesc}</p>
                            </motion.div>
                        ) : null}
                    </AnimatePresence>
                </div>
            </div>

            <AnimatePresence>
                {showAbout && (
                    <PustakaLandingPage onClose={() => setShowAbout(false)} />
                )}
            </AnimatePresence>

            {/* Slide Viewer Modal Overlay */}
            <AnimatePresence>
                {selectedGuide && !isCreating && (
                    <SlideViewer
                        guide={selectedGuide}
                        slides={slides}
                        currentIdx={currentSlideIdx}
                        onNext={nextSlide}
                        onPrev={() => currentSlideIdx > 0 && setCurrentSlideIdx(prev => prev - 1)}
                        onClose={() => setSelectedGuide(null)}
                        setZoomedImage={setZoomedImage}
                        getFullUrl={getFullUrl}
                    />
                )}
            </AnimatePresence>

            {/* Animated Assistant */}
            {!isCreating && !showAbout && !zoomedImage && (
                <GuideAssistant
                    message={assistantMsg}
                    isExplaining={!!selectedGuide}
                    onClick={() => setShowAbout(true)}
                />
            )}

            {/* Image Zoom Modal */}
            <AnimatePresence>
                {zoomedImage && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[400] bg-white/90 dark:bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 md:p-12"
                        onClick={() => setZoomedImage(null)}
                    >
                        <motion.img
                            initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
                            src={zoomedImage}
                            className="max-w-full max-h-full rounded-3xl shadow-2xl border-4 border-white dark:border-slate-800 object-contain"
                            onClick={(e) => e.stopPropagation()} // Prevent close on image click
                        />
                        <button onClick={() => setZoomedImage(null)} className="absolute top-6 right-6 p-4 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-500 dark:text-white rounded-2xl transition-all hover:scale-110 shadow-xl">
                            <X size={24} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}