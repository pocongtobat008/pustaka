# 🌱 Lingkungan DEV (terpisah dari Produksi)

Folder ini (`/home/project/pustaka-dev`) adalah workspace **pengembangan**.
Semua editing dilakukan di sini — **produksi di `/home/project/pustaka` tidak akan terganggu**.

## Perbandingan

| | 🟢 DEV (folder ini) | 🔴 PRODUKSI |
|---|---|---|
| Folder | `/home/project/pustaka-dev` | `/home/project/pustaka` |
| Git branch | `dev` | `main` |
| Frontend | `http://localhost:5173` | `http://<ip-server>:5174` |
| Backend | `127.0.0.1:5006` | `127.0.0.1:5005` |
| Database | `pustaka_dev` (clone) | `pustaka` |
| PM2 | `dev-backend`, `dev-frontend` (namespace `dev`) | `archive-*` (namespace `default`) |
| Worker | ❌ tidak dijalankan | ✅ bullmq + polling |

## Alur kerja harian

```bash
# 1. Edit kode di folder ini (HMR otomatis, produksi aman)
cd /home/project/pustaka-dev

# 2. Test di browser
#    buka http://localhost:5173  (login: admin / admin123 — khusus DB dev)

# 3. Setelah stabil, deploy ke produksi:
bash scripts/deploy-prod.sh
```

## Perintah

```bash
pm2 start ecosystem.dev.config.cjs   # atau bash scripts/dev-up.sh
pm2 stop  ecosystem.dev.config.cjs   # atau bash scripts/dev-stop.sh
pm2 logs dev-backend --lines 50      # lihat log backend dev
```

## Catatan penting

- **DB dev terpisah** (`pustaka_dev`) — data uji-coba tidak pernah masuk produksi.
  Password admin dev di-reset ke `admin123` (produksi tidak berubah).
- **Job queue berbasis DB** (tabel `job_queue`) — karena dev memakai DB sendiri,
  job dari dev otomatis terisolasi dari produksi. ✅
- **Port & proxy** diatur lewat env: backend `PORT=5006`, vite `VITE_API_TARGET=http://127.0.0.1:5006`
  (default tetap 5005 jika env tidak ada). **Saat deploy**, `deploy-prod.sh` otomatis
  memaksa `.env` produksi ke `PORT=5005` agar API produksi tidak pindah port.
- **⚠️ node_modules adalah hardlink** (copy hemat disk dari produksi):
  - JANGAN jalankan `chown`/`chmod` pada isi `node_modules` di folder ini —
    akan ikut mengubah file produksi.
  - `npm install` aman (npm mengganti file, memutus hardlink sendiri).
- **Branch `main` produksi hanya bergerak lewat `scripts/deploy-prod.sh`** —
  jangan commit langsung di `/home/project/pustaka` agar tidak bentrok saat `--ff-only`.
- **Worker dev tidak dijalankan** — fitur yang butuh job asinkron (OCR batch, dsb.)
  belum aktif di dev. Backend & seluruh CRUD tetap berfungsi.
- Sinkronisasi ulang DB dev dari produksi (opsional, saat butuh data terbaru):
  ```bash
  sudo -u postgres pg_dump pustaka | sudo -u postgres psql -q pustaka_dev
  ```
