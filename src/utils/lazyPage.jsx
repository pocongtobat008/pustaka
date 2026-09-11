import React, { Suspense } from 'react';

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
 *  B. AUTO-RELOAD SEKALI — hanya jika semua retry gagal DAN error khas chunk
 *     (bukan error app). Dicegah loop via sessionStorage (berlaku 30 detik).
 *  C. FALLBACK UI — jika reload juga tidak membantu, tampilkan layar
 *     "Halaman gagal dimuat" dengan tombol Muat Ulang manual.
 */

const RELOAD_FLAG = 'lazy_page_reloaded';
const RELOAD_GUARD_MS = 30000;

// Retry ladder: jeda sebelum percobaan ulang ke-i (index 0 = percobaan pertama)
const RETRY_DELAYS_MS = [0, 800, 2000, 4000];

function isStaleChunkError(err) {
    const msg = String((err && (err.message || err)) || '');
    return (
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('error loading dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('Loading chunk') ||
        msg.includes('Loading CSS chunk') ||
        msg.includes('dynamically imported module') ||
        msg.includes('NetworkError') ||
        msg.includes('fetch failed')
    );
}

function alreadyReloadedRecently() {
    try {
        const at = Number(sessionStorage.getItem(RELOAD_FLAG) || 0);
        return at > 0 && Date.now() - at < RELOAD_GUARD_MS;
    } catch {
        return false;
    }
}
export { alreadyReloadedRecently };

function markReloaded() {
    try { sessionStorage.setItem(RELOAD_FLAG, String(Date.now())); } catch { /* ignore */ }
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
            return await loader();
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
            // Semua retry gagal → chunk lama kemungkinan sudah tidak ada di
            // server → reload sekali untuk mengambil bundle baru.
            if (!alreadyReloadedRecently()) {
                reloadForNewBundle();
                // Reload sedang berjalan — jangan resolve/reject. Jaringan
                // pengaman: jika 5 detik masih di halaman (reload diblok),
                // reject agar ErrorBoundary menampilkan UI pemulihan.
                await new Promise((_, rej) => setTimeout(() => rej(err), 5000));
            }
            throw err;
        })
    );

    // Wrapper Suspense + guard error khusus chunk
    return function LazyPageWrapper(props) {
        return (
            <Suspense fallback={null}>
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
        // Jaring pengaman terakhir di level halaman: jika sampai di sini
        // dan belum pernah reload, coba pulihkan sekali sebelum menampilkan UI.
        if (isStaleChunkError(err) && !alreadyReloadedRecently()) {
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
