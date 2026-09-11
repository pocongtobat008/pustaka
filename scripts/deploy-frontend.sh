#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# deploy-frontend.sh — Deploy FE produksi TANPA jendela 404 stale chunk.
#
# Masalah yang diselesaikan: `vite build` mengosongkan dist/ di awal build
# (~30-40 detik). Selama jendela itu, sesi browser yang terbuka gagal
# lazy-load chunk → "Failed to fetch dynamically imported module".
#
# Solusi:
#   1. Build ke folder sementara (.dist-next) — dist/ lama TIDAK disentuh.
#   2. Salin file baru ke dist/ TANPA menghapus (chunk lama tetap ada).
#   3. Tunggu 15 detik (grace period untuk sesi terbuka lazy-load chunk
#      lama), lalu hapus chunk basi agar dist/ persis build baru.
#
# Pemakaian:  bash scripts/deploy-frontend.sh
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
GRACE_SECONDS=15

echo "▶ [1/5] Build ke folder sementara (.dist-next)…"
rm -rf .dist-next
npx vite build --outDir .dist-next --emptyOutDir

echo "▶ [2/5] Salin file baru ke dist/ (chunk lama TIDAK dihapus dulu)…"
mkdir -p dist
rsync -a .dist-next/ dist/

echo "▶ [3/5] Catat chunk basi (ada di dist tapi tidak di build baru)…"
OBSOLETE="$ROOT/.obsolete-chunks.txt"
(cd dist/assets && ls | sort) > "$ROOT/.old-list.txt" 2>/dev/null || true
(cd .dist-next/assets && ls | sort) > "$ROOT/.new-list.txt" 2>/dev/null || true
comm -23 "$ROOT/.old-list.txt" "$ROOT/.new-list.txt" > "$OBSOLETE" || true
rm -f "$ROOT/.old-list.txt" "$ROOT/.new-list.txt"
OBS_COUNT=$(wc -l < "$OBSOLETE" | tr -d ' ')
echo "   → $OBS_COUNT chunk basi akan dihapus setelah grace ${GRACE_SECONDS}s"

echo "▶ [4/5] Grace period ${GRACE_SECONDS}s untuk sesi browser terbuka…"
sleep "$GRACE_SECONDS"
if [ -s "$OBSOLETE" ]; then
  (cd dist/assets && while IFS= read -r f; do rm -f -- "$f"; done < "$OBSOLETE")
fi
rm -f "$OBSOLETE"
# Pastikan dist/ persis sama dengan build baru (hapus folder basi sisa, dsb.)
rsync -a --delete .dist-next/ dist/
rm -rf .dist-next

echo "▶ [5/5] Restart backend (PM2)…"
pm2 restart archive-backend >/dev/null 2>&1 || true
sleep 3

# Verifikasi
BUNDLE=$(grep -o 'index-[^"]*\.js' dist/index.html | head -1)
if [ -f "dist/assets/$BUNDLE" ]; then
  echo "✅ Deploy selesai — bundle aktif: $BUNDLE (ada di dist/assets)"
else
  echo "❌ Bundle aktif TIDAK ditemukan di dist/assets!" >&2
  exit 1
fi
curl -s -o /dev/null -w "FE HTTP %{http_code}\n" http://127.0.0.1:5174/ || true
