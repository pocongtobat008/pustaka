import { useRef, useEffect } from 'react';

// ── Hook bersama 1: tutup modal saat tombol ESC ditekan ──
// (dipakai modal inline yang masih memakai motion.div agar perilaku SaaS
// seragam dengan komponen Modal). onEscape direferensikan lewat ref sehingga
// tidak perlu di-memoize oleh pemakai.
export const useModalKeydown = (onEscape) => {
    const ref = useRef(onEscape);
    useEffect(() => { ref.current = onEscape; });
    useEffect(() => {
        const onKey = (e) => {
            // Jika Modal bersama sedang terbuka, biarkan ESC ditangani Modal itu
            // (menghindari penutupan ganda saat modal bertumpuk).
            if (document.querySelector('[data-app-modal]')) return;
            if (e.key === 'Escape' && ref.current) ref.current();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);
};

// Penghitung modal inline terbuka agar body scroll-lock aman saat bertumpuk
let openInlineModals = 0;

// ── Hook bersama 2: kunci scroll body saat modal inline terbuka ──
// isOpen dihitung via useMemo di pemakai (OR dari semua state modal halaman).
// Counter membuat modal bertumpuk tidak meng-unlock scroll terlalu dini.
export const useModalScrollLock = (isOpen) => {
    const openRef = useRef(isOpen);
    useEffect(() => { openRef.current = isOpen; });
    useEffect(() => {
        if (openRef.current) {
            openInlineModals += 1;
        } else if (openInlineModals > 0) {
            openInlineModals -= 1;
        }
        const prev = document.body.style.overflow;
        document.body.style.overflow = openInlineModals > 0 ? 'hidden' : prev;
        return () => {
            openInlineModals = Math.max(0, openInlineModals - 1);
            if (openInlineModals === 0) document.body.style.overflow = prev;
        };
        // Hanya bergantung pada status terbuka/tutup, bukan pada setiap render
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [!!openRef.current]);
};
