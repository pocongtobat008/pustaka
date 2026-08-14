import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const LANGUAGE_STORAGE_KEY = 'app-language';

const translations = {
  id: {
    'language.id': 'ID',
    'language.en': 'EN',

    'sidebar.category.general': 'UMUM',
    'sidebar.category.document': 'DOKUMEN',
    'sidebar.category.tax': 'PAJAK & KEPATUHAN',
    'sidebar.category.system': 'SISTEM',
    'sidebar.category.accounting': 'AKUNTANSI',

    'sidebar.item.dashboard': 'Dashboard',
    'sidebar.item.myJob': 'Pekerjaan',
    'sidebar.item.manualBook': 'Manual Instruksi',
    'sidebar.item.sop': 'SOP',
    'sidebar.item.filling': 'Filling',
    'sidebar.item.documents': 'Dokumen',
    'sidebar.item.anydoc': 'AnyDoc Converter',
    'sidebar.item.aiDocIntel': 'AI Document Intelligence',
    'sidebar.item.aiDocTrain': 'Training Dokumen',
    'sidebar.item.aiPdfTools': 'AI PDF Tools',
    'sidebar.item.approvals': 'Laporan Entertainment',
    'sidebar.item.entertainment': 'Entertainment',
    'sidebar.item.invoices': 'Invoices',
    'sidebar.item.forwarder': 'Forwarder',
    'sidebar.item.pdfTemplates': 'Template PDF',
    'sidebar.item.compliance': 'Kepatuhan',
    'sidebar.item.taxCalc': 'Kalkulasi Pajak',
    'sidebar.item.reporting': 'Pelaporan',
    'sidebar.item.masterData': 'Master Data',
    'sidebar.item.book': 'Book (COA)',
    'sidebar.item.systemLogs': 'Log Sistem',

    'sidebar.ocr.ready': 'OCR Siap',
    'sidebar.ocr.queueEmpty': 'Antrian kosong',
    'sidebar.ocr.processing': 'Proses OCR...',
    'sidebar.ocr.active': 'Aktif',
    'sidebar.ocr.waiting': 'Antri',
    'sidebar.ocr.ok': 'OK',
    'sidebar.ocr.fail': 'Gagal',
    'sidebar.ocr.reset': 'Reset',

    'sidebar.user.guest': 'Tamu',
    'sidebar.user.viewer': 'Viewer',
    'sidebar.search.placeholder': 'Cari menu…',
    'sidebar.search.empty': 'Tidak ada menu ditemukan',
    'sidebar.search.results': 'Hasil Pencarian',
    'sidebar.action.toggleTheme': 'Ganti Tema',
    'sidebar.action.logout': 'Keluar',
  },
  en: {
    'language.id': 'ID',
    'language.en': 'EN',

    'sidebar.category.general': 'GENERAL',
    'sidebar.category.document': 'DOCUMENT',
    'sidebar.category.tax': 'TAX & COMPLIANCE',
    'sidebar.category.system': 'SYSTEM',
    'sidebar.category.accounting': 'ACCOUNTING',

    'sidebar.item.dashboard': 'Dashboard',
    'sidebar.item.myJob': 'My Job',
    'sidebar.item.manualBook': 'Manual Book',
    'sidebar.item.sop': 'SOP',
    'sidebar.item.filling': 'Filling',
    'sidebar.item.documents': 'Documents',
    'sidebar.item.anydoc': 'AnyDoc Converter',
    'sidebar.item.aiDocIntel': 'AI Document Intelligence',
    'sidebar.item.aiDocTrain': 'Document Training',
    'sidebar.item.aiPdfTools': 'AI PDF Tools',
    'sidebar.item.approvals': 'Entertainment Expenses',
    'sidebar.item.entertainment': 'Entertainment',
    'sidebar.item.invoices': 'Invoices',
    'sidebar.item.forwarder': 'Forwarder',
    'sidebar.item.pdfTemplates': 'PDF Templates',
    'sidebar.item.compliance': 'Compliance',
    'sidebar.item.taxCalc': 'Tax Calc',
    'sidebar.item.reporting': 'Reporting',
    'sidebar.item.masterData': 'Master Data',
    'sidebar.item.book': 'Book (COA)',
    'sidebar.item.systemLogs': 'System Logs',

    'sidebar.ocr.ready': 'OCR Ready',
    'sidebar.ocr.queueEmpty': 'Queue is empty',
    'sidebar.ocr.processing': 'OCR Processing...',
    'sidebar.ocr.active': 'Active',
    'sidebar.ocr.waiting': 'Queued',
    'sidebar.ocr.ok': 'Done',
    'sidebar.ocr.fail': 'Failed',
    'sidebar.ocr.reset': 'Reset',

    'sidebar.user.guest': 'Guest',
    'sidebar.user.viewer': 'Viewer',
    'sidebar.search.placeholder': 'Search menu…',
    'sidebar.search.empty': 'No menu found',
    'sidebar.search.results': 'Search Results',
    'sidebar.action.toggleTheme': 'Toggle Theme',
    'sidebar.action.logout': 'Logout',
  },
};

const LanguageContext = createContext(null);

const pickInitialLanguage = () => {
  if (typeof window === 'undefined') return 'id';
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === 'id' || stored === 'en') return stored;
  const preferred = navigator.language?.toLowerCase() || 'id';
  return preferred.startsWith('en') ? 'en' : 'id';
};

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(pickInitialLanguage);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  const value = useMemo(() => {
    const t = (key, fallback = key) => translations[language]?.[key] ?? fallback;
    return {
      language,
      setLanguage,
      t,
      isEnglish: language === 'en',
    };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
