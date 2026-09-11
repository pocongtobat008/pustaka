// ── LogoMark — logo aplikasi e-FinTaxDoc (satu sumber kebenaran) ──
//
// Glyph "E+F" di atas garis dokumen: melambangkan Finance + Tax (+Document).
// Dipakai di: sidebar, mobile header, login (desktop & mobile), favicon.
//
// Warna default `currentColor` agar mengikuti konteks (putih di atas orb gradient).
// Stroke butt/miter (bukan round) supaya garis bawah tidak menabrak glyph.

export default function LogoMark({
    size = 18,
    color = 'currentColor',
    strokeWidth = 2.6,
    className = '',
}) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
            strokeLinejoin="miter"
            className={className}
            aria-hidden="true"
        >
            <path d="M10 3v16M4.5 3H10M4.5 11H10M4.5 19H10M10 3h9.5M10 11h6M3.5 22.5h17" />
        </svg>
    );
}
