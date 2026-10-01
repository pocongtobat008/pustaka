import React, { Suspense } from 'react';
import LoadingFallback from '../components/common/LoadingFallback';

/**
 * lazyPage — lazy import yang tahan stale chunk & kegagalan jaringan sesaat.
 *
 * Skenario yang ditangani:
 *  1. Jendela deploy (dist sedang diisi build baru) → chunk sempat 404.
 *  2. Restart/restart-detik vite preview atau hiccup jaringan LAN → fetch
 *     in-flight gagal ("Failed to fetch dynamically imported module").
 *  3. Chunk lama benar-benar sudah dihapus pasca beberapa deploy.
 *
 * Strategi (paling murah → paling mahal):
 *  A. RETRY BERTINGKAT — 4 percobaan (0ms/800ms/2s/4s). Mayoritas kegagalan
 *     sesaat pulih di sini TANPA reload dan TANPA user sadar apa pun.
 *  B. AUTO-RELOAD — hanya jika semua retry gagal DAN error khas chunk (bukan
 *     error app). Anggaran reload memakai jendela 2 menit (maks 2x) sehingga
 *     sesi lama tetap bisa pulih, namun tetap dibatasi agar tidak loop.
 *  C. FALLBACK UI — jika reload juga tidak membantu, tampilkan layar
 *     "Halaman gagal dimuat" dengan tombol Muat Ulang manual.
 */

// Anggaran reload memakai JENDELA WAKTU (sliding window), bukan counter abadi.
// Sebelumnya counter `lazy_page_reload_count` tidak pernah di-reset sehingga
// tab yang berumur panjang kehabisan anggaran dan TIDAK BISA pulih sendiri lagi
// — penyebab utama error terus muncul di sesi lama.
const RELOAD_TIMES_KEY = 'lazy_page_reload_times';
const RELOAD_GUARD_MS = 30000;   // jeda minimum antar auto-reload (anti-loop)
const RELOAD_WINDOW_MS = 120000; // jendela hitung reload (2 menit)
const MAX_RELOADS = 2;           // maksimum auto-reload dalam jendela di atas

// Retry ladder: jeda sebelum percobaan ulang ke-i (index 0 = percobaan pertama)
const RETRY_DELAYS_MS = [0, 800, 2000, 4000];

function isStaleChunkError(err) {
    const msg = String((err && (err.message || err)) || '');
    return (
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('error loading dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('Failed to load module script') ||
        msg.includes('MIME type') ||
        msg.includes('Loading chunk') ||
        msg.includes('Loading CSS chunk') ||
        msg.includes('dynamically imported module') ||
        msg.includes('NetworkError') ||
        msg.includes('fetch failed')
    );
}

function getReloadTimes() {
    try {
        const raw = JSON.parse(sessionStorage.getItem(RELOAD_TIMES_KEY) || '[]');
        if (!Array.isArray(raw)) return [];
        const now = Date.now();
        return raw.filter((t) => typeof t === 'number' && now - t < RELOAD_WINDOW_MS);
    } catch {
        return [];
    }
}

function alreadyReloadedRecently() {
    const times = getReloadTimes();
    const last = times.length ? times[times.length - 1] : 0;
    return last > 0 && Date.now() - last < RELOAD_GUARD_MS;
}
export { alreadyReloadedRecently };

function hasExceededMaxReloads() {
    return getReloadTimes().length >= MAX_RELOADS;
}

function markReloaded() {
    const times = getReloadTimes();
    times.push(Date.now());
    try { sessionStorage.setItem(RELOAD_TIMES_KEY, JSON.stringify(times)); } catch { /* ignore */ }
}

/**
 * Reset anggaran reload. Dipanggil setiap kali sebuah chunk halaman BERHASIL
 * dimuat — menandakan sesi ini sehat, sehingga jatah auto-reload dikembalikan
 * dan sesi berumur panjang bisa pulih berkali-kali dari stale chunk.
 */
export function clearReloadBudget() {
    try { sessionStorage.removeItem(RELOAD_TIMES_KEY); } catch { /* ignore */ }
}

export function reloadForNewBundle() {
    markReloaded();
    window.location.reload();
}

/** True jika error khas chunk yang layak auto-reload (bukan error aplikasi). */
export function shouldAutoReload(err) {
    return isStaleChunkError(err);
}

/**
 * Coba import berkali-kali sesuai RETRY_DELAYS_MS.
 * Melempar error terakhir jika semua percobaan gagal.
 */
async function importWithRetry(loader) {
    let lastErr;
    for (let i = 0; i < RETRY_DELAYS_MS.length; i++) {
        if (RETRY_DELAYS_MS[i] > 0) {
            await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[i]));
        }
        try {
            const mod = await loader();
            // Chunk berhasil dimuat → sesi ini sehat, kembalikan anggaran reload.
            // Ini titik reset yang tepat: bila aplikasi memang rusak permanen,
            // import tidak akan pernah sukses sehingga anggaran TIDAK direset
            // (mencegah loop), sementara sesi sehat bebas pulih berkali-kali.
            clearReloadBudget();
            return mod;
        } catch (err) {
            lastErr = err;
            // Error non-chunk (bug aplikasi) → jangan buang waktu retry
            if (!isStaleChunkError(err)) throw err;
        }
    }
    throw lastErr;
}

/**
 * Buat komponen lazy dengan ketahanan stale chunk.
 * Pemakaian: const Documents = lazyPage(() => import('./pages/Documents'));
 */
export function lazyPage(loader) {
    const LazyComp = React.lazy(() =>
        importWithRetry(loader).catch(async (err) => {
            if (!isStaleChunkError(err)) throw err;
            if (!alreadyReloadedRecently() && !hasExceededMaxReloads()) {
                reloadForNewBundle();
                await new Promise((_, rej) => setTimeout(() => rej(err), 5000));
            }
            throw err;
        })
    );

    // Wrapper Suspense + guard error khusus chunk
    return function LazyPageWrapper(props) {
        return (
            <Suspense fallback={<LoadingFallback />}>
                <LazyChunkGuard LazyComp={LazyComp} componentProps={props} />
            </Suspense>
        );
    };
}

/**
 * Guard tampilan: fallback UI lokal jika komponen lazy tetap gagal
 * setelah semua upaya pemulihan.
 */
class _LazyGuard extends React.Component {
    constructor(props) {
        super(props);
        this.state = { failed: false, err: null };
    }
    static getDerivedStateFromError(err) {
        return { failed: true, err };
    }
    componentDidCatch(err) {
        if (isStaleChunkError(err) && !alreadyReloadedRecently() && !hasExceededMaxReloads()) {
            reloadForNewBundle();
        }
    }
    render() {
        if (this.state.failed) {
            const isEnglish = (() => {
                try { return (localStorage.getItem('app-language') || 'id') === 'en'; } catch { return false; }
            })();
            return (
                <div className="min-h-[60vh] flex items-center justify-center p-6">
                    <div className="glass-panel rounded-2xl p-8 text-center max-w-sm flex flex-col items-center gap-3">
                        <div className="text-3xl">🔄</div>
                        <h2 className="font-black text-stone-800 dark:text-white">
                            {isEnglish ? 'Page failed to load' : 'Halaman gagal dimuat'}
                        </h2>
                        <p className="text-[12px] text-stone-500 dark:text-white/50">
                            {isEnglish
                                ? 'The application was just updated. Reload to get the latest version.'
                                : 'Aplikasi baru saja diperbarui. Muat ulang untuk mendapatkan versi terbaru.'}
                        </p>
                        <button
                            onClick={() => reloadForNewBundle()}
                            className="mt-1 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white gradient-bg shadow-lg shadow-blue-500/30 hover:scale-[1.03] transition-transform"
                        >
                            {isEnglish ? 'Reload' : 'Muat Ulang'}
                        </button>
                    </div>
                </div>
            );
        }
        const { LazyComp, componentProps } = this.props;
        return <LazyComp {...componentProps} />;
    }
}

function LazyChunkGuard({ LazyComp, componentProps }) {
    return <_LazyGuard LazyComp={LazyComp} componentProps={componentProps} />;
}

export default lazyPage;
