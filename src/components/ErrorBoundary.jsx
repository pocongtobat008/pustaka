import React from 'react';

/**
 * ErrorBoundary — lapisan 3 pengaman crash.
 *
 * Menangkap error render di dalam tree React (perubahan state/props,
 * undefined access di komponen, dsb.) dan menampilkan layar fallback
 * bergaya e-FinTaxDoc dengan aksi pemulihan — bukan white screen.
 *
 * Catatan: error saat evaluasi modul (import gagal, TDZ) terjadi SEBELUM
 * boundary ini ada; kasus itu ditangani guard pre-React di index.html
 * (watchdog + window.__BOOT_FATAL__).
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null, info: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        this.setState({ info });
        // eslint-disable-next-line no-console
        console.error('[ErrorBoundary]', error, info && info.componentStack);
    }

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        // Coba pulih tanpa reload: reset boundary + kembali ke landing
        this.setState({ error: null, info: null });
        try {
            const returnTo = this.props.returnTo || '/';
            if (window.location.pathname !== returnTo) {
                window.history.pushState({}, '', returnTo);
                window.dispatchEvent(new PopStateEvent('popstate'));
            }
        } catch {
            this.handleReload();
        }
    };

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;

        const isEnglish = (() => {
            try { return (localStorage.getItem('app-language') || 'id') === 'en'; } catch { return false; }
        })();

        const t = isEnglish
            ? {
                title: 'Something went wrong',
                desc: 'A module encountered an unexpected error. Your data is safe — try returning to the home page or reloading the app.',
                detail: 'Error detail',
                home: 'Back to Home',
                reload: 'Reload Application',
            }
            : {
                title: 'Terjadi Kesalahan',
                desc: 'Sebuah modul mengalami error tak terduga. Data Anda aman — coba kembali ke halaman awal atau muat ulang aplikasi.',
                detail: 'Detail error',
                home: 'Kembali ke Awal',
                reload: 'Muat Ulang Aplikasi',
            };

        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-[#FAF5EE] dark:bg-[#0a0a0a] p-6">
                <div className="max-w-md w-full glass-panel rounded-3xl p-8 text-center flex flex-col items-center gap-3">
                    <div className="text-4xl">🛠️</div>
                    <h1 className="text-lg font-black text-stone-800 dark:text-white">
                        {t.title}
                    </h1>
                    <p className="text-[13px] text-stone-500 dark:text-white/50 leading-relaxed">
                        {t.desc}
                    </p>
                    <details className="w-full text-left mt-1">
                        <summary className="text-[11px] font-bold uppercase tracking-wider text-blue-500 dark:text-blue-300 cursor-pointer select-none">
                            {t.detail}
                        </summary>
                        <pre className="mt-2 text-[10px] leading-relaxed bg-stone-900/5 dark:bg-white/5 rounded-xl p-3 overflow-auto max-h-40 text-red-600 dark:text-red-300 whitespace-pre-wrap break-all">
                            {String(error && error.message ? error.message : error)}
                            {this.state.info && this.state.info.componentStack ? '\n' + this.state.info.componentStack : ''}
                        </pre>
                    </details>
                    <div className="flex gap-2.5 mt-3 flex-wrap justify-center">
                        <button
                            onClick={this.handleGoHome}
                            className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-white gradient-bg shadow-lg shadow-blue-500/30 hover:scale-[1.03] transition-transform"
                        >
                            {t.home}
                        </button>
                        <button
                            onClick={this.handleReload}
                            className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-blue-600 dark:text-blue-300 border border-blue-500/30 hover:bg-blue-500/10 transition-colors"
                        >
                            {t.reload}
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;
