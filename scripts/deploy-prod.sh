#!/bin/bash
# ⚠️ DEPLOY dev -> produksi. Jalankan manual HANYA saat fitur sudah stabil.
# 1) Commit & push branch dev ke GitHub
# 2) Pull branch dev ke folder produksi (fast-forward SAJA)
# 3) Pastikan .env produksi memakai PORT=5005 (kode sekarang env-driven!)
# 4) Restart layanan produksi (archive-backend, archive-frontend)
set -e
TS=$(date +%Y%m%d-%H%M)

echo "== 1. Commit & push branch dev =="
cd /home/project/pustaka-dev
git add -A
git commit -m "deploy dev -> prod ($TS)" || echo "   (tidak ada perubahan baru)"
git push origin dev

echo "== 2. Update produksi dari branch dev (fast-forward only) =="
cd /home/project/pustaka
git checkout dist/index.html 2>/dev/null || true   # kembalikan artifact build lama
git pull --ff-only origin dev

echo "== 3. Normalisasi .env produksi (PORT wajib 5005) =="
# Kode backend kini membaca PORT dari env. .env produksi lama berisi PORT=5000
# yang akan memindahkan backend ke port salah. Paksa 5005.
sed -i 's/^PORT=.*/PORT=5005/' /home/project/pustaka/.env
grep '^PORT=' /home/project/pustaka/.env

echo "== 4. Restart layanan produksi =="
pm2 restart archive-backend archive-frontend
pm2 save

echo ""
echo "✅ DEPLOY SELESAI — produksi sekarang: $(cd /home/project/pustaka && git log --oneline -1)"
echo "   Verifikasi: FE :5174 dan BE :5005 harus hidup."
