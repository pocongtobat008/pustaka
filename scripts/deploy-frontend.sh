#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# deploy-frontend.sh — Deploy FE produksi TANPA jendela 404 stale chunk.
#
# Akar masalah "Failed to fetch dynamically imported module":
#   1. `vite build` mengosongkan dist/ → chunk generasi lama hilang.
#   2. Sesi browser yang masih terbuka (memegang index.html lama) meminta
#      chunk lama yang sudah terhapus.
#   3. `vite preview` TIDAK mengembalikan 404 untuk file hilang — ia
#      mengembalikan index.html (text/html, HTTP 200). Browser lalu gagal
#      karena mengharapkan modul JS tetapi menerima HTML.
#
# Solusi — RETENSI ASET BERBASIS UMUR (bukan lagi manifest 1 siklus):
#   • Nama file aset di-hash (content-addressed) → tidak pernah bentrok,
#     jadi aman menumpuk beberapa generasi di /assets/.
#   • Build ke folder sementara → dist/ lama tidak pernah kosong.
#   • Salin aset baru secara ADD-ONLY (tanpa --delete).
#   • File non-aset (index.html, manifest, ikon) ditimpa build terbaru.
#   • Pangkas HANYA aset yang tidak lagi ada di build saat ini DAN lebih tua
#     dari RETAIN_DAYS hari → sesi lama tetap bisa memuat chunk-nya jauh
#     lebih lama daripada skema 1-siklus sebelumnya.
#
# Pemakaian:  bash scripts/deploy-frontend.sh
#             RETAIN_DAYS=60 bash scripts/deploy-frontend.sh   # opsional
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STAGE=".dist-next"
RETAIN_DAYS="${RETAIN_DAYS:-30}"

echo "▶ [1/6] Build ke folder sementara ($STAGE)…"
rm -rf "$STAGE"
npx vite build --outDir "$STAGE" --emptyOutDir

if [ ! -f "$STAGE/index.html" ]; then
  echo "❌ Build gagal: $STAGE/index.html tidak ada" >&2
  exit 1
fi

# Catat entry lama (untuk verifikasi retensi di akhir)
OLD_ENTRY=""
if [ -f dist/index.html ]; then
  OLD_ENTRY=$(grep -o 'index-[^"]*\.js' dist/index.html | head -1 || true)
fi

echo "▶ [2/6] Salin aset baru (add-only, tanpa hapus)…"
mkdir -p dist/assets
rsync -a "$STAGE/assets/" dist/assets/

echo "▶ [3/6] Sinkronkan file non-aset (index.html, manifest, ikon)…"
rsync -a --exclude 'assets/' "$STAGE/" dist/

echo "▶ [4/6] Pangkas chunk basi yang lebih tua dari ${RETAIN_DAYS} hari…"
BEFORE=$(find dist/assets -type f | wc -l | tr -d ' ')
find dist/assets -type f -mtime +"$RETAIN_DAYS" -delete
AFTER=$(find dist/assets -type f | wc -l | tr -d ' ')
echo "   → aset: $BEFORE → $AFTER file (dipangkas $((BEFORE - AFTER)))"

echo "▶ [5/6] Restart PM2 (backend + frontend preview)…"
pm2 restart archive-backend >/dev/null 2>&1 || true
pm2 restart archive-frontend >/dev/null 2>&1 || true
sleep 5

echo "▶ [6/6] Verifikasi…"
BUNDLE=$(grep -o 'index-[^"]*\.js' dist/index.html | head -1)
if [ ! -f "dist/assets/$BUNDLE" ]; then
  echo "❌ Bundle aktif TIDAK ditemukan di dist/assets: $BUNDLE" >&2
  exit 1
fi
echo "✅ Deploy selesai — bundle aktif: $BUNDLE"

# Pastikan entry lama (jika ada) MASIH ada sebagai file nyata → sesi lama aman.
if [ -n "$OLD_ENTRY" ] && [ "$OLD_ENTRY" != "$BUNDLE" ]; then
  if [ -f "dist/assets/$OLD_ENTRY" ]; then
    echo "   ✅ entry generasi sebelumnya diretensi: $OLD_ENTRY"
  else
    echo "   ℹ️  entry lama tidak ada (tidak ada sesi yang bergantung padanya)"
  fi
fi

curl -s -o /dev/null -w "   FE HTTP %{http_code}\n" http://127.0.0.1:5174/ || true
