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

const removeSplash = () => {
    if (!splashEl) return;
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
