#!/bin/bash
# ⚠️ DEPLOY dev -> produksi. Jalankan manual HANYA saat fitur sudah stabil.
# Produksi kini memakai BUILD STATIS (vite build + vite preview).
# 1) Commit & push branch dev
# 2) Pull branch dev ke folder produksi (fast-forward SAJA)
# 3) Normalisasi .env produksi (PORT=5005)
# 4) Build dist produksi
# 5) Restart archive-backend & archive-frontend
set -e
TS=$(date +%Y%m%d-%H%M)

echo "== 1. Commit & push branch dev =="
cd /home/project/pustaka-dev
git add -A
git commit -m "deploy dev -> prod ($TS)" || echo "   (tidak ada perubahan baru)"
git push origin dev

echo "== 2. Update produksi dari branch dev (fast-forward only) =="
cd /home/project/pustaka
git pull --ff-only origin dev

echo "== 3. Normalisasi .env produksi (PORT wajib 5005) =="
sed -i 's/^PORT=.*/PORT=5005/' /home/project/pustaka/.env
grep '^PORT=' /home/project/pustaka/.env

echo "== 4. Install dependensi produksi (jika ada dependency baru) =="
cd /home/project/pustaka
npm install --omit=dev 2>&1 | tail -2 || npm install 2>&1 | tail -2

echo "== 5. Build produksi (dist) =="
cd /home/project/pustaka
npx vite build

echo "== 6. Restart layanan produksi =="
pm2 restart archive-backend archive-frontend
pm2 save

echo ""
echo "✅ DEPLOY SELESAI — produksi sekarang: $(cd /home/project/pustaka && git log --oneline -1)"
echo "   Verifikasi: FE :5174 (preview) dan BE :5005 harus hidup."
