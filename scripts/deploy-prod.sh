#!/bin/bash
# ⚠️ DEPLOY dev -> produksi. Jalankan manual HANYA saat fitur sudah stabil.
# 1) Commit & push branch dev ke GitHub
# 2) Pull branch dev ke folder produksi (fast-forward)
# 3) Restart layanan produksi (archive-backend, archive-frontend)
set -e
TS=$(date +%Y%m%d-%H%M)

echo "== 1. Commit & push branch dev =="
cd /home/project/pustaka-dev
git add -A
git commit -m "deploy dev -> prod ($TS)" || echo "   (tidak ada perubahan baru)"
git push origin dev

echo "== 2. Update produksi dari branch dev =="
cd /home/project/pustaka
git checkout dist/index.html 2>/dev/null || true   # kembalikan artifact build lama
git pull origin dev

echo "== 3. Restart layanan produksi =="
pm2 restart archive-backend archive-frontend
pm2 save

echo ""
echo "✅ DEPLOY SELESAI — produksi sekarang: $(cd /home/project/pustaka && git log --oneline -1)"
