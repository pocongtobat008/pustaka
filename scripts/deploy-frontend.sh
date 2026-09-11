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
#   2. Salin file baru ke dist/ (chunk lama tetap ada selama grace 30s).
#   3. Chunk basi diARSIPKAN ke dist/.assets-prev (bukan dihapus) — tetap
#      tersedia SATU SIKLUS DEPLOY penuh untuk sesi yang masih memegang
#      bundle lama; baru dihapus saat deploy berikutnya.
#
# Pemakaian:  bash scripts/deploy-frontend.sh
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
GRACE_SECONDS=30
PREV_DIR="dist/.assets-prev"

echo "▶ [1/6] Build ke folder sementara (.dist-next)…"
rm -rf .dist-next
npx vite build --outDir .dist-next --emptyOutDir

echo "▶ [2/6] Kosongkan arsip chunk prev dari deploy sebelumnya…"
rm -rf "$PREV_DIR"
mkdir -p dist

echo "▶ [3/6] Salin file baru ke dist/ (chunk lama TIDAK dihapus dulu)…"
rsync -a .dist-next/ dist/

echo "▶ [4/6] Catat chunk basi (ada di dist/assets tapi tidak di build baru)…"
OBSOLETE="$ROOT/.obsolete-chunks.txt"
(cd dist/assets && ls | sort) > "$ROOT/.old-list.txt" 2>/dev/null || true
(cd .dist-next/assets && ls | sort) > "$ROOT/.new-list.txt" 2>/dev/null || true
comm -23 "$ROOT/.old-list.txt" "$ROOT/.new-list.txt" > "$OBSOLETE" || true
rm -f "$ROOT/.old-list.txt" "$ROOT/.new-list.txt"
OBS_COUNT=$(wc -l < "$OBSOLETE" | tr -d ' ')
echo "   → $OBS_COUNT chunk basi akan diarsipkan setelah grace ${GRACE_SECONDS}s"

echo "▶ [5/6] Grace period ${GRACE_SECONDS}s untuk sesi browser terbuka…"
sleep "$GRACE_SECONDS"

# Arsipkan (BUKAN hapus) chunk basi → sesi lama tetap bisa lazy-load
mkdir -p "$PREV_DIR"
if [ -s "$OBSOLETE" ]; then
  (cd dist/assets && while IFS= read -r f; do
    [ -f "$f" ] && mv -- "$f" "$ROOT/$PREV_DIR/" 2>/dev/null || true
  done < "$OBSOLETE")
fi
rm -f "$OBSOLETE"
# Final sync: dist persis build baru (basi sudah pindah ke .assets-prev)
rsync -a --delete --exclude='.assets-prev' .dist-next/ dist/
rm -rf .dist-next

echo "▶ [6/6] Restart PM2 (backend + frontend preview)…"
pm2 restart archive-backend >/dev/null 2>&1 || true
pm2 restart archive-frontend >/dev/null 2>&1 || true
sleep 5

# Verifikasi
BUNDLE=$(grep -o 'index-[^"]*\.js' dist/index.html | head -1)
if [ -f "dist/assets/$BUNDLE" ]; then
  echo "✅ Deploy selesai — bundle aktif: $BUNDLE"
  echo "   Retensi chunk lama: $(ls "$PREV_DIR" 2>/dev/null | wc -l | tr -d ' ') file di dist/.assets-prev"
else
  echo "❌ Bundle aktif TIDAK ditemukan di dist/assets!" >&2
  exit 1
fi
curl -s -o /dev/null -w "FE HTTP %{http_code}\n" http://127.0.0.1:5174/ || true
