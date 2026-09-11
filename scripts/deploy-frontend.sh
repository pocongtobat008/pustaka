#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# deploy-frontend.sh — Deploy FE produksi TANPA jendela 404 stale chunk.
#
# Masalah yang diselesaikan: `vite build` mengosongkan dist/ di awal build
# (~30-40 detik). Selama jendela itu, sesi browser yang terbuka gagal
# lazy-load chunk → "Failed to fetch dynamically imported module".
#
# Solusi — retensi chunk generasi sebelumnya DI PATH ASLINYA:
#   1. Build ke folder sementara (.dist-next) — dist/ lama TIDAK disentuh.
#   2. Hapus chunk yang diarsipkan deploy SEBELUMNYA (retensi 1 siklus
#      penuh berakhir) sesuai dist/.obsolete-manifest.txt.
#   3. Salin build baru ke dist/ — chunk generasi lama tetap ada di
#      /assets/ sehingga sesi terbuka tetap bisa lazy-load.
#   4. Chunk basi (ada di assets, tidak di build baru) dicatat ke
#      dist/.obsolete-manifest.txt dan DIBIARKAN di tempatnya — dihapus
#      oleh deploy berikutnya.
#
# Hasil: setiap chunk tersedia minimal satu interval deploy penuh di URL
# aslinya. Tidak ada jendela 404, tidak ada path aneh.
#
# Pemakaian:  bash scripts/deploy-frontend.sh
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
MANIFEST="dist/.obsolete-manifest.txt"

echo "▶ [1/5] Build ke folder sementara (.dist-next)…"
rm -rf .dist-next
npx vite build --outDir .dist-next --emptyOutDir

echo "▶ [2/5] Hapus chunk arsip deploy sebelumnya (retensi berakhir)…"
if [ -f "$MANIFEST" ]; then
  PREV_COUNT=$(wc -l < "$MANIFEST" | tr -d ' ')
  (cd dist/assets && while IFS= read -r f; do rm -f -- "$f"; done < "$ROOT/$MANIFEST")
  rm -f "$MANIFEST"
  echo "   → $PREV_COUNT chunk generasi lama dihapus"
else
  echo "   → tidak ada arsip (deploy pertama dengan skema ini)"
fi

echo "▶ [3/5] Salin build baru ke dist/ (chunk lama tetap di /assets/)…"
mkdir -p dist
rsync -a .dist-next/ dist/

echo "▶ [4/5] Catat chunk basi untuk dihapus di deploy berikutnya…"
(cd dist/assets && ls | sort) > "$ROOT/.old-list.txt" 2>/dev/null || true
(cd .dist-next/assets && ls | sort) > "$ROOT/.new-list.txt" 2>/dev/null || true
comm -23 "$ROOT/.old-list.txt" "$ROOT/.new-list.txt" > "$ROOT/.obsolete-next.txt" || true
rm -f "$ROOT/.old-list.txt" "$ROOT/.new-list.txt"

# Entry bundle (index-*.js) TIDAK perlu retensi: sesi lama tidak pernah
# me-fetch ulang entry bundle — yang perlu dipertahankan hanya chunk halaman
# (lazy import). Hapus entry basi SEKARANG, sisanya (chunk halaman) masuk
# manifest retensi untuk dihapus di deploy berikutnya.
OBS_COUNT=0
RETAINED=0
if [ -s "$ROOT/.obsolete-next.txt" ]; then
  while IFS= read -r f; do
    case "$f" in
      index-*)
        rm -f -- "dist/assets/$f" "dist/assets/${f%.js}.css"
        ;;
      *)
        echo "$f" >> "$ROOT/$MANIFEST"
        RETAINED=$((RETAINED + 1))
        ;;
    esac
  done < "$ROOT/.obsolete-next.txt"
fi
rm -f "$ROOT/.obsolete-next.txt"
if [ "$RETAINED" -gt 0 ]; then
  echo "   → $RETAINED chunk halaman lama dipertahankan di /assets/ sampai deploy berikutnya"
else
  echo "   → tidak ada chunk halaman basi yang perlu diretensi"
fi
rm -rf .dist-next

echo "▶ [5/5] Restart PM2 (backend + frontend preview)…"
pm2 restart archive-backend >/dev/null 2>&1 || true
pm2 restart archive-frontend >/dev/null 2>&1 || true
sleep 5

# Verifikasi
BUNDLE=$(grep -o 'index-[^"]*\.js' dist/index.html | head -1)
if [ -f "dist/assets/$BUNDLE" ]; then
  echo "✅ Deploy selesai — bundle aktif: $BUNDLE"
  echo "   Chunk generasi lama yang dipertahankan: $OBS_COUNT"
else
  echo "❌ Bundle aktif TIDAK ditemukan di dist/assets!" >&2
  exit 1
fi
curl -s -o /dev/null -w "FE HTTP %{http_code}\n" http://127.0.0.1:5174/ || true
