import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { LanguageProvider } from './contexts/LanguageContext'
import AutoTranslateLayer from './components/AutoTranslateLayer'

// ── Splash screen (index.html #app-splash) ──
const SPLASH_MIN_MS = 900;
const splashShownAt = Date.now();
const splashEl = document.getElementById('app-splash');
const fillEl = document.getElementById('splash-fill');
const statusEl = document.getElementById('splash-status');

// Sinkron tema & mode DEV SEBELUM render pertama agar splash tampil dengan
// tema yang benar (cream/dark) dan badge merah di lingkungan development.
try {
    const savedTheme = localStorage.getItem('archive_theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia?.('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    }
    const envOverride = (import.meta.env.VITE_APP_ENV || '').trim().toLowerCase();
    const isDev = envOverride
        ? (envOverride === 'development' || envOverride === 'dev')
        : Boolean(import.meta.env.DEV);
    if (isDev) splashEl?.classList.add('env-dev');
} catch { /* abaikan jika localStorage tidak tersedia */ }

// Tagline splash — seragam dengan form login: Akurat. Patuh. Terintegrasi.
if (statusEl || splashEl) {
    const taglineEl = document.getElementById('splash-tagline');
    if (taglineEl) taglineEl.textContent = isEnglish ? 'Accurate · Compliant · Integrated' : 'Akurat · Patuh · Terintegrasi';
}

// ── Fake progress per modul: bar tipis berjalan sambil lazy chunk dimuat ──
// Tahap mengikuti urutan boot nyata: JS shell → provider → modul → data.
const isEnglish = (() => {
    try { return (localStorage.getItem('app-language') || 'id') === 'en'; } catch { return false; }
})();
const STAGES = isEnglish
    ? [
        'Initializing e-FinTaxDoc…',
        'Loading modules…',
        'Connecting to server…',
        'Preparing data…',
        'Almost ready…',
    ]
    : [
        'Menyiapkan e-FinTaxDoc…',
        'Memuat modul-modul…',
        'Menghubungkan ke server…',
        'Menyiapkan data…',
        'Hampir siap…',
    ];
const STAGE_MS = [0, 260, 620, 1050, 1500]; // waktu mulai tiap tahap (ms)
const STAGE_PCT = [8, 28, 52, 76, 94];      // target bar per tahap — tak pernah 100% selesai

let splashTimers = [];
function setSplashStage(idx) {
    if (!splashEl || idx >= STAGES.length) return;
    if (fillEl) fillEl.style.width = STAGE_PCT[idx] + '%';
    if (statusEl) statusEl.textContent = STAGES[idx];
}
if (splashEl) {
    setSplashStage(0);
    STAGE_MS.forEach((ms, i) => {
        if (i === 0) return;
        splashTimers.push(setTimeout(() => setSplashStage(i), ms));
    });
}

const removeSplash = () => {
    splashTimers.forEach(clearTimeout);
    splashTimers = [];
    if (!splashEl) return;
    if (fillEl) fillEl.style.width = '100%'; // selesaikan bar saat keluar
    splashEl.classList.add('splash-hide');
    setTimeout(() => splashEl.remove(), 500); // tunggu transisi fade-out
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <AutoTranslateLayer />
      <App />
    </LanguageProvider>
  </StrictMode>,
)

// Pastikan splash tampil minimal 900ms agar animasinya terlihat natural,
// lalu fade-out setelah konten aplikasi benar-benar tergambar.
requestAnimationFrame(() => requestAnimationFrame(() => {
    const elapsed = Date.now() - splashShownAt;
    setTimeout(removeSplash, Math.max(0, SPLASH_MIN_MS - elapsed));
}))
