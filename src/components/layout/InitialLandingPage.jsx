import React from 'react';
import { motion } from 'framer-motion';
import { X, Rocket, Target, AlertCircle, Sparkles, ShieldCheck, Calculator, FileCheck, BookOpen, HelpCircle, FolderOpen, ScanLine, Zap, ArrowRight } from 'lucide-react';

const InitialLandingPage = ({ onClose }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[1000] bg-slate-50/80 dark:bg-[#0B1437]/90 backdrop-blur-2xl overflow-y-auto custom-scrollbar p-6 md:p-12"
  >
    <div className="max-w-6xl mx-auto">
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
          <Rocket size={16} className="animate-bounce" />
          <span>The Future of Knowledge</span>
        </motion.div>
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-4xl md:text-6xl font-black text-[#2B3674] dark:text-white tracking-tight leading-tight"
        >
          Sistem Pustaka <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Terintegrasi</span>
        </motion.h1>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-lg text-slate-500 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed font-medium"
        >
          Pusat pengelolaan pengetahuan dan dokumen yang aman, akurat, dan mudah digunakan.
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
            <Target size={28} />
          </div>
          <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-4 uppercase tracking-tight">Latar Belakang</h3>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
            Dalam era digital yang menuntut kecepatan, ketepatan, dan transparansi, perusahaan membutuhkan sistem pengelolaan informasi yang terpusat. Banyak data penting masih tersebar dan bergantung pada individu, yang berpotensi menimbulkan risiko kesalahan dan hilangnya pengetahuan.
          </p>
        </motion.div>

        <motion.div
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="p-8 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[3rem] shadow-2xl text-white relative overflow-hidden group"
        >
          <div className="absolute bottom-0 left-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Sparkles size={120} />
          </div>
          <div className="w-14 h-14 bg-white/20 backdrop-blur-md text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg">
            <ShieldCheck size={28} />
          </div>
          <h3 className="text-2xl font-black mb-4 uppercase tracking-tight">Visi & Misi</h3>
          <p className="text-indigo-50 leading-relaxed font-medium">
            Sistem ini dirancang untuk mengintegrasikan seluruh informasi penting dalam satu platform. Memastikan kontinuitas operasional tetap berjalan meskipun terjadi pergantian personel atau perubahan struktur organisasi.
          </p>
        </motion.div>
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="bg-indigo-600 rounded-[3rem] p-10 text-center text-white shadow-2xl shadow-indigo-500/40 relative overflow-hidden"
      >
        <h3 className="text-3xl font-black mb-4 relative z-10">Siap Memulai Transformasi?</h3>
        <button
          onClick={onClose}
          className="px-12 py-5 bg-white text-indigo-600 rounded-[2rem] font-black uppercase tracking-widest shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-3 mx-auto relative z-10"
        >
          Mulai Menjelajah <ArrowRight size={20} />
        </button>
      </motion.div>
    </div>
  </motion.div>
);

export default InitialLandingPage;