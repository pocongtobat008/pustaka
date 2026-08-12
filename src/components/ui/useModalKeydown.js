import { useRef, useEffect } from 'react';

// Hook bersama: tutup modal saat tombol ESC ditekan (dipakai modal inline yang
// masih memakai motion.div agar perilaku SaaS seragam dengan komponen Modal).
// onEscape direferensikan lewat ref sehingga tidak perlu di-memoize oleh pemakai.
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
