# Panduan Instalasi Lengkap Pustaka (Windows & Ubuntu)

Dokumen ini menjelaskan instalasi dari nol untuk:
- Versi lokal (React + Backend Node.js tanpa Docker)
- Versi Docker
- Windows dan Ubuntu
- Setup database sampai aplikasi berjalan

## 1. Ringkasan Arsitektur

Aplikasi ini terdiri dari:
- Frontend: React + Vite
- Backend: Node.js + Express
- Database utama: MySQL/MariaDB
- Queue:
  - BullMQ + Redis (opsional, performa lebih baik)
  - Fallback ke MySQL Polling (tetap bisa jalan tanpa Redis)

Port umum:
- Frontend dev: `5173`
- Backend API: dari `PORT` di `.env` (contoh `5000`)

## 2. Prasyarat Tools

### 2.1 Wajib (Local & Docker)
- Git
- Node.js 18+ (disarankan Node.js 20 LTS)
- npm (ikut terpasang saat install Node.js)

### 2.2 Wajib untuk versi lokal (tanpa Docker)
- MySQL Server 8+ atau MariaDB 10+

### 2.3 Opsional (direkomendasikan)
- Redis 7+ (untuk BullMQ lane cepat)

### 2.4 Wajib untuk versi Docker
- Docker
- Docker Compose plugin (`docker compose`)

## 3. Clone Proyek

```bash
git clone <URL_REPOSITORY_ANDA>
cd pustaka
```

## 4. Konfigurasi Environment

Buat atau sesuaikan file `.env` di root proyek:

```env
DB_HOST=127.0.0.1
DB_USER=root
DB_PASS=root123
DB_NAME=pustaka
PORT=5000
JWT_SECRET=ganti_dengan_secret_acak_yang_panjang
SESSION_TTL_MS=604800000
ALLOW_DEV_TOKEN=false
ALLOW_QUERY_TOKEN=false
AI_VECTOR_LAZY_INIT=true
AI_VECTOR_INIT_BATCH_SIZE=250

# Opsional Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

Catatan:
- Gunakan nilai sesuai server Anda.
- Jangan pakai `JWT_SECRET` contoh untuk production.

---

## 5. Versi Lokal (React + Node.js)

## 5A. Windows (PowerShell)

### 5A.1 Install tools
1. Install Git dari situs resmi Git.
2. Install Node.js 20 LTS.
3. Install MySQL Community Server atau MariaDB.
4. (Opsional) Install Redis:
- Cara paling cepat di proyek ini: jalankan script Docker Redis.

```powershell
bash install-redis-docker.sh
```

Jika tidak memakai Redis, aplikasi tetap bisa berjalan dengan polling MySQL.

### 5A.2 Buat database dan user
Login MySQL lalu jalankan SQL berikut:

```sql
CREATE DATABASE IF NOT EXISTS pustaka CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'pustaka_user'@'localhost' IDENTIFIED BY 'pustaka_pass';
GRANT ALL PRIVILEGES ON pustaka.* TO 'pustaka_user'@'localhost';
FLUSH PRIVILEGES;
```

Lalu sesuaikan `.env`:

```env
DB_HOST=127.0.0.1
DB_USER=pustaka_user
DB_PASS=pustaka_pass
DB_NAME=pustaka
```

### 5A.3 Install dependency dan migrate

```powershell
npm install
npx knex migrate:latest
```

### 5A.4 Jalankan aplikasi
Opsi 1 (single command, default proyek):

```powershell
npm run dev
```

Opsi 2 (manual, lebih mudah debug):
Terminal 1:

```powershell
node --watch server/index.js
```

Terminal 2:

```powershell
node --watch server/worker.js --mode=polling
```

Terminal 3:

```powershell
npx vite --host 0.0.0.0 --port 5173
```

Akses:
- Frontend: `http://localhost:5173`
- API: `http://localhost:5000` (atau sesuai `PORT`)

---

## 5B. Ubuntu 22.04/24.04

### 5B.1 Install tools sistem

```bash
sudo apt update
sudo apt install -y git curl build-essential
```

Install Node.js 20 LTS:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

Install MySQL Server:

```bash
sudo apt install -y mysql-server
sudo systemctl enable --now mysql
```

### 5B.2 Buat database dan user

```bash
sudo mysql
```

```sql
CREATE DATABASE IF NOT EXISTS pustaka CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'pustaka_user'@'localhost' IDENTIFIED BY 'pustaka_pass';
GRANT ALL PRIVILEGES ON pustaka.* TO 'pustaka_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Set `.env`:

```env
DB_HOST=127.0.0.1
DB_USER=pustaka_user
DB_PASS=pustaka_pass
DB_NAME=pustaka
```

### 5B.3 (Opsional) Install Redis
Pilihan paling cepat dari repo ini:

```bash
sudo bash install-redis-simple.sh
```

Verifikasi:

```bash
redis-cli ping
# PONG
```

### 5B.4 Install dependency dan migrate

```bash
npm install
npx knex migrate:latest
```

### 5B.5 Jalankan aplikasi
Direkomendasikan manual 3 terminal (cross-platform, stabil):

Terminal 1:

```bash
node --watch server/index.js
```

Terminal 2:

```bash
node --watch server/worker.js --mode=polling
```

Terminal 3:

```bash
npx vite --host 0.0.0.0 --port 5173
```

Akses:
- Frontend: `http://localhost:5173`
- API: `http://localhost:5000` (atau sesuai `.env`)

Catatan:
- Script `npm run dev` bisa dipakai, tetapi untuk Linux mode manual di atas lebih aman jika Anda mengalami perbedaan command environment antar shell.

---

## 6. Versi Docker

Ada 2 pola penggunaan Docker.

## 6A. Docker untuk App + Database di host (mengikuti compose saat ini)

File `docker-compose.yml` saat ini menjalankan:
- `backend`
- `frontend`

Database tetap di host (bukan container DB).

### 6A.1 Siapkan DB di host
Buat database seperti langkah local (bagian 5A/5B).

### 6A.2 Sesuaikan env di `docker-compose.yml`
Nilai contoh saat ini:

```yaml
environment:
  - DB_HOST=host.docker.internal
  - DB_USER=root
  - DB_PASSWORD=
  - DB_NAME=archive_os
```

Sesuaikan dengan DB Anda, terutama:
- Gunakan key `DB_PASS` (bukan `DB_PASSWORD`) agar terbaca oleh konfigurasi aplikasi.
- `DB_NAME` menjadi `pustaka`
- user/password sesuai yang dibuat

### 6A.3 Jalankan

```bash
docker compose build
docker compose up -d
```

Cek log:

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

Akses:
- Frontend: `http://localhost`
- Backend: expose pada port yang dipetakan di compose (contoh `5000`)

Catatan Linux:
- `host.docker.internal` kadang perlu mapping manual.
- Jika backend tidak bisa konek DB host, gunakan IP host bridge Docker (sering `172.17.0.1`) atau tambah `extra_hosts`.

## 6B. Docker Full Stack (disarankan untuk konsistensi tim)

Jalankan DB sebagai container terpisah:

1. Start MariaDB container:

```bash
docker run -d \
  --name pustaka-mariadb \
  -e MYSQL_ROOT_PASSWORD=rootpass \
  -e MYSQL_DATABASE=pustaka \
  -e MYSQL_USER=pustaka_user \
  -e MYSQL_PASSWORD=pustaka_pass \
  -p 3306:3306 \
  --restart unless-stopped \
  mariadb:11
```

2. (Opsional) Start Redis container:

```bash
docker run -d \
  --name pustaka-redis \
  -p 6379:6379 \
  --restart unless-stopped \
  redis:7-alpine
```

3. Jalankan app container dengan env yang sesuai DB/Redis.

Tips:
- Untuk production, gunakan network Docker khusus dan jangan expose port DB ke publik.

---

## 7. Migrasi, Reset, dan Test

Perintah umum:

```bash
# Jalankan migrasi terbaru
npx knex migrate:latest

# Reset migrasi (HATI-HATI: data bisa hilang)
npm run db:reset

# Test backend
npm run test:server
```

---

## 8. Verifikasi Instalasi

Checklist minimal:
- `npm install` sukses
- DB bisa diakses kredensial `.env`
- `npx knex migrate:latest` sukses tanpa error
- Backend menyala dan endpoint auth bisa diakses
- Frontend bisa terbuka di browser
- Worker berjalan (mode polling atau BullMQ)

Login seed default (dibuat saat tabel user kosong):
- `admin` / `admin123`
- `staff` / `staff123`
- `viewer` / `viewer123`

Segera ubah password default setelah instalasi pertama.

---

## 9. Troubleshooting Cepat

1. `ER_ACCESS_DENIED_ERROR`:
- Cek `DB_USER`, `DB_PASS`, dan host grant user MySQL (`localhost` vs `%`).

2. `ECONNREFUSED 127.0.0.1:3306`:
- Pastikan service MySQL/MariaDB aktif.

3. Worker log Redis error:
- Normal jika Redis tidak dipakai. Sistem fallback ke MySQL polling.

4. OCR lambat:
- Pastikan file bahasa OCR tersedia (`eng.traineddata`, `ind.traineddata`) dan resource CPU/RAM cukup.

5. Port bentrok:
- Ubah `PORT` backend di `.env` dan/atau port Vite (`5173`).

---

## 10. Rekomendasi Deployment

- Development cepat lokal: gunakan versi lokal (bagian 5).
- Demo/staging cepat: gunakan Docker (bagian 6).
- Production: gunakan reverse proxy, TLS, backup database, rotasi log, dan secret management.
