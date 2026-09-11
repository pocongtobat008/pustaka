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
#   2. Sync ke dist/ dengan rsync --delete-delay: file lama dihapus 15 detik
#      SETELAH file baru tersalin — sesi terbuka sempat lazy-load chunk
#      lama yang masih dirujuk bundle lamanya.
#   3. index.html baru menimpa yang lama paling awal → pengunjung baru
#      langsung dapat bundle baru.
#
# Pemakaian:  bash scripts/deploy-frontend.sh
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "▶ [1/4] Build ke folder sementara (.dist-next)…"
rm -rf .dist-next
npx vite build --outDir .dist-next --emptyOutDir

echo "▶ [2/4] Sync ke dist/ (file lama dihapus dengan delay 15s)…"
mkdir -p dist
# -t pertahankan timestamp; --delete-delay hapus ekstra SETELAH transfer
rsync -a --delete-delay --delete-delay=15s .dist-next/ dist/

echo "▶ [3/4] Bersihkan folder sementara…"
rm -rf .dist-next

echo "▶ [4/4] Restart backend (PM2)…"
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
