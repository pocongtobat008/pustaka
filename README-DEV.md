# 🌱 Lingkungan DEV (terpisah dari Produksi)

Folder ini (`/home/project/pustaka-dev`) adalah workspace **pengembangan**.
Semua editing dilakukan di sini — **produksi di `/home/project/pustaka` tidak akan terganggu**.

## Perbandingan

| | 🟢 DEV (folder ini) | 🔴 PRODUKSI |
|---|---|---|
| Folder | `/home/project/pustaka-dev` | `/home/project/pustaka` |
| Git branch | `dev` | `main` |
| Frontend | `http://localhost:5173` (vite dev + HMR) | `http://<ip-server>:5174` (**build statis** via `vite preview`) |
| Backend | `127.0.0.1:5006` | `127.0.0.1:5005` |
| Database | `pustaka_dev` (clone) | `pustaka` |
| Redis | ❌ dimatikan (isolasi penuh) | ✅ aktif (BullMQ + cache) |
| PM2 | `dev-backend`, `dev-frontend`, `dev-worker` (ns `dev`) | `archive-*` (ns `default`) |
| Worker | ✅ polling (DB `job_queue` dev) | ✅ bullmq + polling |

## Alur kerja harian

```bash
# 1. Edit kode di folder ini (HMR otomatis, produksi aman)
cd /home/project/pustaka-dev

# 2. Test di browser
#    buka http://localhost:5173  (login: admin / admin123 — khusus DB dev)

# 3. Setelah stabil, deploy ke produksi:
bash scripts/deploy-prod.sh   # commit+push dev → pull prod → build → restart
```

## Perintah

```bash
pm2 start ecosystem.dev.config.cjs   # atau bash scripts/dev-up.sh
pm2 stop  ecosystem.dev.config.cjs   # atau bash scripts/dev-stop.sh
pm2 logs dev-worker --lines 50       # lihat log worker dev
```

## Auto-start saat server restart ⚡

Stack dev otomatis hidup kembali saat server reboot — **dua lapis**:

1. **PM2 startup** (systemd) — `pm2 save` menyertakan `dev-backend`, `dev-frontend`,
   `dev-worker` bersama seluruh stack produksi (`pm2 resurrect` saat boot).
2. **Cron `@reboot`** — `/home/project/pustaka-dev/scripts/boot-dev.sh`:
   - Menunggu PostgreSQL siap (±60 dtk) sebelum start (hindari race saat boot)
   - **Idempotent**: hanya me-start app dev yang belum online (tidak me-restart yang lain)
   - Log di `/var/log/pustaka-dev-boot.log`

## Catatan penting

- **DB dev terpisah** (`pustaka_dev`) — data uji-coba tidak pernah masuk produksi.
  Password admin dev di-reset ke `admin123` (produksi tidak berubah).
- **Job queue berbasis DB** (tabel `job_queue`) — karena dev memakai DB sendiri,
  job dari dev otomatis terisolasi dari produksi. ✅
- **Redis sengaja dimatikan di dev** (`REDIS_PORT=6399` di ecosystem) — seluruh
  stack dev fallback ke polling DB, jadi **tidak pernah menyentuh Redis/antrian produksi**. ✅
- **Dev worker aktif** (mode polling). Catatan: setiap kali worker dev start,
  ia melakukan **semantic indexing ulang seluruh data dev** (embedding lewat model
  lokal) — butuh beberapa menit & CPU. Hal ini wajar, hanya di data dev.
- **Port & proxy** diatur lewat env: backend `PORT=5006`, vite `VITE_API_TARGET=http://127.0.0.1:5006`
  (default tetap 5005 jika env tidak ada). **Saat deploy**, `deploy-prod.sh` otomatis
  memaksa `.env` produksi ke `PORT=5005` agar API produksi tidak pindah port.
- **⚠️ node_modules adalah hardlink** (copy hemat disk dari produksi):
  - JANGAN jalankan `chown`/`chmod` pada isi `node_modules` di folder ini —
    akan ikut mengubah file produksi.
  - `npm install` aman (npm mengganti file, memutus hardlink sendiri).
- **Produksi = build statis** (`vite build` + `vite preview` di :5174):
  - Edit apa pun di folder produksi TIDAK lagi berpengaruh langsung (tidak ada HMR).
  - `dist/` TIDAK di-track git — jangan pernah `git checkout dist/index.html`
    (akan merusak build yang sedang disajikan preview).
  - Setiap deploy harus build ulang → sudah otomatis ada di `deploy-prod.sh`.
- **Branch `main` produksi hanya bergerak lewat `scripts/deploy-prod.sh`** —
  jangan commit langsung di `/home/project/pustaka` agar tidak bentrok saat `--ff-only`.
- Sinkronisasi ulang DB dev dari produksi (opsional, saat butuh data terbaru):
  ```bash
  sudo -u postgres pg_dump pustaka | sudo -u postgres psql -q pustaka_dev
  ```
