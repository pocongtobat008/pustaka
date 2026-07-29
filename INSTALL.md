# 📦 Pustaka-OS — Panduan Instalasi Lengkap

Sistem manajemen dokumen dengan AI Semantic Search, OCR otomatis, approval flows, inventory & tax tracking, dan modul entertainment expenses.

## Daftar Isi

- [1. Arsitektur](#1-arsitektur)
- [2. Prasyarat](#2-prasyarat)
- [3. Clone & Setup](#3-clone--setup)
- [4. Database](#4-database)
- [5. Konfigurasi Environment](#5-konfigurasi-environment)
- [6. Redis (Opsional)](#6-redis-opsional)
- [7. Menjalankan Aplikasi](#7-menjalankan-aplikasi)
- [8. PM2 Production](#8-pm2-production)
- [9. Nginx Reverse Proxy](#9-nginx-reverse-proxy)
- [10. Docker](#10-docker)
- [11. Tesseract OCR](#11-tesseract-ocr)
- [12. Cloudflare Tunnel](#12-cloudflare-tunnel)
- [13. Perintah Penting](#13-perintah-penting)
- [14. Troubleshooting](#14-troubleshooting)
- [15. Upgrade](#15-upgrade)

---

## 1. Arsitektur

```
Browser → Nginx/Cloudflare → Vite (Frontend :5174)
                                   │
                          proxy /api → Express (Backend :5000)
                                            │
                                     ┌──────┼──────┐
                                     │      │      │
                                  Database  Redis  Worker
                                  (PG/MySQL)(Queue) (OCR/AI)
```

| Komponen | Teknologi | Port (default) |
|----------|-----------|----------------|
| Frontend | React + Vite + Tailwind | 5174 |
| Backend  | Express.js + Socket.io | 5000 |
| Database | PostgreSQL / MySQL / SQLite3 | 5432 / 3306 |
| Queue    | BullMQ (Redis) / MySQL polling | 6379 |
| Worker   | Node.js (OCR, AI, scheduler) | — |

---

## 2. Prasyarat

### Ubuntu / Debian

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential
```

### Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # v20.x
npm -v    # 10.x
```

### Windows

1. Install **Node.js 20 LTS** dari https://nodejs.org
2. Install **Git** dari https://git-scm.com
3. Install database sesuai pilihan di [bagian 4](#4-database)

---

## 3. Clone & Setup

```bash
git clone <repository-url>
cd pustaka
npm install
```

---

## 4. Database

Sistem mendukung **PostgreSQL**, **MySQL/MariaDB**, atau **SQLite3**. Pilih salah satu.

### 4a. PostgreSQL (default)

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql

sudo -u postgres psql
```

```sql
CREATE DATABASE pustaka;
CREATE USER admin WITH PASSWORD 'admin123';
GRANT ALL PRIVILEGES ON DATABASE pustaka TO admin;
\c pustaka
GRANT ALL ON SCHEMA public TO admin;
\q
```

### 4b. MySQL / MariaDB

```bash
sudo apt install -y mysql-server
sudo systemctl enable --now mysql
sudo mysql
```

```sql
CREATE DATABASE IF NOT EXISTS pustaka CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'pustaka_user'@'localhost' IDENTIFIED BY 'pustaka_pass';
GRANT ALL PRIVILEGES ON pustaka.* TO 'pustaka_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 4c. SQLite3

Set `DB_CLIENT=sqlite3` di `.env` — tidak perlu install server database.

### Migrasi Database

```bash
npx knex migrate:latest
```

---

## 5. Konfigurasi Environment

Buat atau edit `.env` di root proyek:

```env
# Database — pilih salah satu
DB_CLIENT=pg                          # pg / mysql2 / sqlite3
DB_HOST=127.0.0.1
DB_PORT=5432                          # 5432 (pg) / 3306 (mysql)
DB_USER=admin
DB_PASS=admin123
DB_NAME=pustaka
DB_SSL=false

# Server
PORT=5000
JWT_SECRET=ubah_dengan_string_acak_panjang
SESSION_TTL_MS=604800000              # 7 hari
ALLOW_DEV_TOKEN=false
ALLOW_QUERY_TOKEN=false

# AI / Vector
AI_VECTOR_LAZY_INIT=true
AI_VECTOR_INIT_BATCH_SIZE=250

# Redis (opsional — fallback ke MySQL polling)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

---

## 6. Redis (Opsional)

Redis dipakai untuk BullMQ (queue performa tinggi). Tanpa Redis, worker otomatis fallback ke polling MySQL.

### Install Redis

```bash
sudo apt install -y redis-server
sudo systemctl enable --now redis-server
redis-cli ping   # harus PONG
```

Atau via Docker:

```bash
docker run -d --name pustaka-redis -p 6379:6379 --restart unless-stopped redis:7-alpine
```

Atau jalankan script yang tersedia:

```bash
sudo bash install-redis-simple.sh    # Ubuntu
# atau
bash install-redis-docker.sh         # Windows/Universal
```

---

## 7. Menjalankan Aplikasi

### Dev Mode (semua services)

```bash
npm run dev
```

Ini menjalankan: backend + worker:bullmq + worker:polling + frontend concurrently.

### Manual (3 terminal)

```bash
# Terminal 1 — Backend
node --watch server/index.js

# Terminal 2 — Worker (BullMQ + polling)
node --watch server/worker.js --mode=bullmq

# Terminal 3 — Frontend
npx vite --host 0.0.0.0 --port 5174
```

Akses: `http://localhost:5174`

### Build Frontend (production)

```bash
npm run build
npx vite preview --host 0.0.0.0 --port 5174
```

---

## 8. PM2 Production

PM2 dipakai untuk production — auto-restart, logging, monitoring.

### Install PM2

```bash
sudo npm install -g pm2
```

### Start Semua Services

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup    # auto-start saat reboot
```

### Manajemen PM2

```bash
pm2 status                    # daftar semua process
pm2 logs archive-backend      # tail log backend
pm2 monit                     # monitoring realtime
pm2 restart all               # restart semua
pm2 stop all                  # stop semua
pm2 delete all                # hapus dari daftar
```

### Log Rotation

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
```

---

## 9. Nginx Reverse Proxy

Untuk production di port 80/443 dengan domain.

### Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable --now nginx
```

### Konfigurasi

```nginx
server {
    listen 80;
    server_name domain-anda.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:5174;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io {
        proxy_pass http://127.0.0.1:5000/socket.io;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location /uploads {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/pustaka /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### SSL (Letsencrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d domain-anda.com
```

---

## 10. Docker

### Build & Run

```bash
# Build images
docker compose build

# Jalankan
docker compose up -d

# Cek log
docker compose logs -f

# Stop
docker compose down
```

### docker-compose.yml

```yaml
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: pustaka-backend
    restart: always
    ports:
      - "5000:5000"
    environment:
      - DB_HOST=host.docker.internal
      - DB_USER=admin
      - DB_PASS=admin123
      - DB_NAME=pustaka
      - DB_CLIENT=pg
    volumes:
      - ./uploads:/app/uploads

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: pustaka-frontend
    restart: always
    ports:
      - "80:80"
    depends_on:
      - backend
```

### Docker Full Stack (dengan DB container)

```bash
# Database
docker run -d --name pustaka-db \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=admin123 \
  -e POSTGRES_DB=pustaka \
  -p 5432:5432 \
  --restart unless-stopped \
  postgres:16-alpine

# Redis
docker run -d --name pustaka-redis \
  -p 6379:6379 \
  --restart unless-stopped \
  redis:7-alpine
```

---

## 11. Tesseract OCR

Worker membutuhkan Tesseract untuk OCR otomatis.

### Ubuntu

```bash
sudo apt install -y tesseract-ocr tesseract-ocr-ind tesseract-ocr-eng
```

### Windows

Download installer dari https://github.com/UB-Mannheim/tesseract/wiki
Tambahkan ke PATH.

File bahasa `eng.traineddata` dan `ind.traineddata` sudah tersedia di root proyek.

---

## 12. Cloudflare Tunnel

Akses publik via Cloudflare tanpa port forwarding.

### Install cloudflared

```bash
sudo apt install -y cloudflared
# atau download dari https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
```

### Autentikasi & Tunnel

```bash
cloudflared tunnel login
cloudflared tunnel create pustaka
cloudflared tunnel route dns pustaka subdomain.domain.com
```

### Config (`~/.cloudflared/config.yml`)

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: subdomain.domain.com
    service: http://localhost:5174
  - hostname: api.subdomain.domain.com
    service: http://localhost:5000
  - service: http_status:404
```

### Service

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

---

## 13. Perintah Penting

### Database

```bash
npx knex migrate:latest          # jalankan migrasi
npx knex migrate:rollback        # rollback 1 batch
npx knex migrate:rollback --all  # rollback semua
npm run db:reset                  # rollback + migrate ulang
npm run db:wipe                   # hapus semua data (hati-hati)
```

### Testing

```bash
npm test                   # semua test (vitest)
npm run test:server        # test backend saja
```

### Build

```bash
npm run build              # build frontend ke dist/
npm run preview            # preview hasil build
```

### Lint

```bash
npm run lint
```

---

## 14. Troubleshooting

### Database Connection Error

```
ER_ACCESS_DENIED_ERROR / ECONNREFUSED
```

- Cek kredensial `.env`
- Pastikan service database berjalan: `sudo systemctl status postgresql` / `mysql`
- Untuk PostgreSQL, pastikan user punya akses ke schema: `GRANT ALL ON SCHEMA public TO admin;`

### Port Bentrok

```bash
sudo lsof -i :5000        # cek proses di port 5000
kill -9 <PID>             # kill jika perlu
# atau ubah PORT di .env
```

### Worker Error Redis

Normal jika Redis tidak dipasang — worker otomatis fallback ke MySQL polling.

### OCR Gagal / Lambat

- Pastikan `tesseract` terinstall: `which tesseract`
- File bahasa `.traineddata` di root proyek
- Worker butuh RAM cukup (min 1GB untuk processing)

### Frontend Blank / Error

```bash
rm -rf node_modules/.vite   # hapus cache vite
npm run build                # rebuild
# atau hard refresh browser: Ctrl+Shift+R
```

### Login Default

Jika tabel user kosong, seeder otomatis membuat:

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | superadmin |
| staff | staff123 | staff |
| viewer | viewer123 | viewer |

**Ganti password default segera setelah instalasi.**

---

## 15. Upgrade

```bash
git pull origin main
npm install
npx knex migrate:latest
pm2 restart all
```

---

## Referensi

- `INSTALLATION_WINDOWS_UBUNTU.md` — Panduan detail untuk Windows & Ubuntu
- `REDIS_QUICK_START.md` — Setup Redis
- `README.md` — Gambaran umum proyek
- `ecosystem.config.cjs` — Konfigurasi PM2
- `nginx.conf` — Konfigurasi Nginx untuk Docker
