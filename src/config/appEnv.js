// ── Environment branding — satu sumber kebenaran untuk nama & warna app ──
//
// Deteksi utama: import.meta.env.DEV (Vite otomatis true saat dev server,
// false saat `vite build` / `vite preview` — dipakai produksi).
// Override opsional via env: VITE_APP_ENV=development|production.
//
// Dipakai untuk membedakan tampilan DEV vs PROD:
//   - DEV  → nama "Pustaka DEV" + aksen merah (logo, badge, favicon)
//   - PROD → nama "Pustaka" + tema normal

const envOverride = (import.meta.env.VITE_APP_ENV || '').trim().toLowerCase();

export const IS_DEV = envOverride
    ? (envOverride === 'development' || envOverride === 'dev')
    : Boolean(import.meta.env.DEV);

export const APP_NAME = 'Pustaka';
export const APP_NAME_DISPLAY = IS_DEV ? 'Pustaka DEV' : 'Pustaka';
export const APP_VERSION = 'v1.0.0';

// Kelas Tailwind untuk badge/tanda DEV (merah mencolok)
export const DEV_BADGE_CLASS = 'bg-red-500 text-white';
export const DEV_TEXT_CLASS = 'text-red-600 dark:text-red-400';
