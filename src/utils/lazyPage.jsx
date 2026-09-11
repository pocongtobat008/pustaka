import React, { Suspense } from 'react';

/**
 * lazyPage — lazy import yang tahan stale chunk.
 *
 * Masalah yang diselesaikan: saat build baru di-deploy (dist dikosongkan lalu
 * diisi ulang selama ~30 detik), sesi browser yang terbuka masih memegang
 * bundle lama dan bisa gagal memuat chunk halaman yang hash-nya sudah berganti
 * → "Failed to fetch dynamically imported module".
 *
 * Solusi berlapis:
 * 1. RETRY — tunggu 800ms lalu coba import ulang (menutup jendela deploy yang
 *    sedang berlangsung; file baru biasanya sudah lengkap).
 * 2. AUTO-RELOAD SEKALI — jika retry gagal dan aplikasi sudah pernah boot
 *    (chunk lama benar-benar sudah tidak ada di server), reload penuh sekali
 *    agar browser mengambil index.html baru. Reload kedua dicegah via
 *    sessionStorage, sehingga tidak terjadi loop reload.
 * 3. FALLBACK UI — bila semua gagal, tampilkan layar "Halaman tidak dapat
 *    dimuat" dengan tombol Muat Ulang manual (bukan crash diam-diam).
 */

const RELOAD_FLAG = 'lazy_page_reloaded';

function isStaleChunkError(err) {
    const msg = String((err && (err.message || err)) || '');
    return (
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('error loading dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('Loading chunk') ||
        msg.includes('Loading CSS chunk')
    );
}

function alreadyReloadedRecently() {
    try {
        const at = Number(sessionStorage.getItem(RELOAD_FLAG) || 0);
        // Anggap reload berlaku 15 detik — mencegah loop reload jika server
        // memang bermasalah (bukan sekadar deploy).
        return at > 0 && Date.now() - at < 15000;
    } catch {
        return false;
    }
}

function markReloaded() {
    try { sessionStorage.setItem(RELOAD_FLAG, String(Date.now())); } catch { /* ignore */ }
}

export function reloadForNewBundle() {
    markReloaded();
    window.location.reload();
}

/**
 * Buat komponen lazy dengan ketahanan stale chunk.
 * Pemakaian: const Documents = lazyPage(() => import('./pages/Documents'));
 */
export function lazyPage(loader) {
    const LazyComp = React.lazy(() =>
        loader().catch(async (err) => {
            if (!isStaleChunkError(err)) throw err;
            // Percobaan 2: tunggu sebentar (kemungkinan sedang deploy), lalu ulang
            await new Promise((r) => setTimeout(r, 800));
            try {
                return await loader();
            } catch (err2) {
                if (!isStaleChunkError(err2)) throw err2;
                // Chunk lama benar-benar hilang → reload sekali untuk ambil bundle baru
                if (!alreadyReloadedRecently()) {
                    reloadForNewBundle();
                    // Beri waktu reload berjalan — jangan resolve/reject lagi
                    return new Promise(() => {});
                }
                throw err2;
            }
        })
    );

    // Wrapper Suspense + fallback error khusus stale chunk
    return function LazyPageWrapper(props) {
        return (
            <Suspense fallback={null}>
                <LazyChunkGuard LazyComp={LazyComp} componentProps={props} />
            </Suspense>
        );
    };
}

/**
 * Guard tampilan: menangkap reject dari komponen lazy pada fase render
 * lewat error boundary mini di sekitar LazyComp.
 */
class _LazyGuard extends React.Component {
    constructor(props) {
        super(props);
        this.state = { failed: false };
    }
    static getDerivedStateFromError() {
        return { failed: true };
    }
    componentDidCatch(err) {
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
