# 📁 Archive-OS (Professional Document Management System)

Archive-OS adalah sistem manajemen dokumen digital yang tangguh, dilengkapi dengan teknologi **AI Semantic Search** dan **OCR (Optical Character Recognition)** otomatis. Proyek ini dirancang untuk memudahkan pengarsipan, pencarian cerdas berbasis makna, serta alur persetujuan (*approval flows*) dokumen secara terintegrasi.

## 📘 Dokumentasi Instalasi Lengkap
- Panduan lengkap Windows, Ubuntu, versi lokal (React + Node.js), dan versi Docker:
   - [INSTALLATION_WINDOWS_UBUNTU.md](INSTALLATION_WINDOWS_UBUNTU.md)

## ✨ Fitur Utama
- **AI Semantic Search**: Pencarian berbasis makna menggunakan *embedding* vektor (berjalan super cepat di RAM).
- **Automated OCR**: Ekstraksi teks otomatis dari PDF dan Gambar menggunakan Tesseract.js.
- **Approval Engine**: Manajemen alur kerja persetujuan dokumen dengan roles dan step-by-step logic.
- **Inventory & Tax Tracking**: Modul khusus untuk manajemen aset dan pelaporan pajak (PPN/PPh).
- **Professional Dashboard**: Visualisasi data statistik dokumen dan status sistem secara real-time.

## 🚀 Persiapan (Prerequisites)
Pastikan perangkat Anda telah ter-install:
- **Node.js**: Versi 18 atau lebih baru.
- **MySQL**: Sebagai database utama.

## 🛠️ Instalasi & Setup (Zero-Config)
Archive-OS dirancang untuk dapat berjalan dengan konfigurasi minimal (*default*).

1. **Clone Repositori**
   ```bash
   git clone <repository-url>
   cd archive-os
   ```

2. **Install Dependencies**
   ```bash
   npm install
   npm install cookie-parser
   npm install pdf-parse
   npm install sharp
   npm install date-fns
   npm install canvas
   ```

3. **Persiapan Database**
   Pastikan MySQL Anda menyala. Secara *default*, aplikasi akan mencoba terhubung ke:
   - **Host**: `127.0.0.1`
   - **User**: `root`
   - **Password**: (Kosong)
   - **Database**: `archive_os` (Buat database ini secara manual di MySQL Anda: `CREATE DATABASE archive_os;`)

4. **Jalankan Migrasi Database**
   ```bash
   npx knex migrate:latest
   ```

## 💻 Cara Menjalankan

### Cara Cepat (Rekomendasi)
Jalankan Frontend, Backend, dan Worker secara bersamaan dengan satu perintah:
```bash
npm run dev
```

### Menjalankan Manual (Hanya Node.js)
Jika Anda ingin menjalankan modul secara terpisah tanpa *concurrently*:

- **Server Utama (Api & Socket.io)**:
  ```bash
  node server/index.js
  ```
- **Background Worker (OCR & AI Processing)**:
  ```bash
  node server/worker.js
  ```
- **Frontend (Vite)**:
  ```bash
  npm run build && npx vite preview
  # Atau untuk mode development:
  npx vite
  ```

## ⚙️ Konfigurasi Lanjutan (.env)
Jika Anda perlu mengubah port atau kredensial database, buat file `.env` di root direktori:
```env
DB_HOST=127.0.0.1
DB_USER=root
DB_PASS=password_anda
DB_NAME=archive_os
PORT=5005
VITE_API_URL=http://localhost:5005
```

---
*Dibuat dengan ❤️ untuk manajemen arsip yang lebih modern.*
