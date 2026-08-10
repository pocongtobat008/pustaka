# 📚 Panduan Training AnyDoc Converter — Template Mapping PDF → Excel

Dokumen ini menjelaskan cara **melatih (training)** sistem ekstraksi dokumen agar bisa menyesuaikan
**setiap kasus dan kondisi** PDF: 1 lembar, bulk berlembar-lembar, satu nomor 3+ lembar, tabel
bersambung antar halaman, kolom grup (No Faktur di atas baris), dan seterusnya.

> Prinsip utama: **1 template = 1 jenis dokumen** (mis. "Nota Retur"). Satu template bisa
> menangani **banyak dokumen sekaligus** dalam satu PDF (bulk) karena ada **segmentasi otomatis**.

---

## 1. Konsep Dasar

| Istilah | Arti |
|---|---|
| **Template** | Kumpulan aturan ekstraksi untuk satu jenis dokumen (header fields + kolom tabel + split config) |
| **Header Field** | Data di luar tabel: nama penjual, NPWP, nomor nota retur, tanggal, dll. |
| **Kolom Tabel** | Kolom item yang diulang per baris: No, Nama Barang, Kuantum, Harga, dll. |
| **Kolom Grup** | Nilai di baris **di atas** baris data (mis. **No Faktur**) yang diwariskan ke semua baris di bawahnya |
| **Split Pattern** | Label penanda **awal dokumen baru** dalam PDF bulk (mis. `NOMOR`) |
| **Anchor** | Judul bagian (mis. `KEPADA PENJUAL`) untuk membedakan label kembar (NAMA pembeli vs penjual) |
| **Confidence** | Skor keyakinan 0–1; `0.97` = label cocok persis, `0.9` = label sebagian, `0.8` = fallback teks baris |

---

## 2. Match Type (Cara Mencari Nilai Field Header)

Saat menambah field header, pilih cara mesin mencari nilainya:

### 2.1 `label_same_line` — Label dan nilai di baris yang sama *(paling umum)*
```
NOMOR : 0127/YDI/NR/FEB/2026        →  pattern = "NOMOR"  → nilai = "0127/YDI/NR/FEB/2026"
NAMA  : PT. AMESU UTAMA
```
- **Pattern** = teks label persis seperti di PDF (case & spasi tidak masalah, `nomor` dan `NOMOR :` sama-sama cocok).
- Nilai diambil dari **sisa baris setelah label**, titik dua di depan otomatis dibuang.

### 2.2 `label_next_line` — Label di satu baris, nilai di baris berikutnya
```
NAMA BARANG
GOV.LVR.SHAFT 75/155                 →  pattern = "NAMA BARANG" → nilai baris bawahnya
```

### 2.3 `label_after_anchor` — Label kembar di dalam bagian (section) *(untuk NAMA/NPWP penjual)*
Banyak nota retur punya **dua blok**: "PEMBELI" dan "KEPADA PENJUAL" — keduanya punya label `NAMA` dan `NPWP`.
```
KEPADA PENJUAL                       ← anchor
NAMA    : PT. AMESU UTAMA            ← label ditemukan DI BAWAH anchor → nilai di sini
ALAMAT  : JL. RAYA ...
NPWP    : 31.230.286.2-412.000
```
- **Anchor** = judul bagian (`KEPADA PENJUAL`).
- **Pattern** = label di dalam bagian (`NAMA` / `NPWP`).
- Mesin mencari baris anchor, lalu **label pertama di bawahnya** → nilai pada baris yang sama.
- Ini menyelesaikan masalah "NAMA" yang selalu tertangkap milik PEMBELI.

### 2.4 `regex` — Pola teks bebas (untuk nilai yang formatnya tidak rapi)
```regex
(?:No|Nomor)\s*[:.]?\s*([0-9]{3,}/[A-Z/0-9]+)
```
- Ambil grup tangkap `(...)` pertama; jika tidak ada, seluruh hasil cocok dipakai.

---

## 3. Ekstraksi Tabel (Kolom per Baris)

Mesin memetakan **kolom berdasarkan posisi teks** (bukan urutan baris), jadi tabel dinamis aman.

### 3.1 Header tabel bertingkat / terpecah 2 baris
Header seperti `HARGA JUAL YANG` di baris atas dan `DIKEMBALIKAN` di baris bawah **otomatis digabung**
(jarak antar baris ≤ 12 pt dianggap satu header). Yang penting: **pattern/kolom cukup satu kata
kunci** — untuk kolom `HARGA JUAL YANG / DIKEMBALIKAN` cukup pakai pattern `DIKEMBALIKAN`.

### 3.2 Kolom Grup — nilai di atas baris (No Faktur) diwariskan ke bawah
Struktur umum nota retur: No Faktur tercetak **di atas** sekelompok barang:
```
No Faktur  : 04002500248127866       ← baris grup (bukan baris data)
 1  GOV.LVR.SHAFT 75/155   20   10,500.00   210,000.00
 2  IDLE SHAFT 75/155     324   21,050.00   6,820,200.00
No Faktur  : 04002500313107150       ← nilai grup baru
 3  ...
```
Cara setting:
1. Tambah kolom tabel baru dengan **centang "Grup"** (is_group).
2. **Pattern** diisi pola yang menandai baris grup — bisa regex (`No\s*Faktur\s*:?\s*(\d+)`) atau
   teks biasa (`No Faktur`).
3. Semua baris data di bawahnya otomatis mendapat nilai grup yang sama, sampai ada baris grup baru.
4. Saat export Excel, kolom ini **diulang di setiap baris** (flat per-baris).

### 3.3 Tabel bersambung antar halaman
Jika satu dokumen 3+ lembar dan tabel lanjut di halaman berikutnya:
- Mesin **meneruskan pengambilan baris ke halaman berikutnya**.
- **Header tabel berulang** di halaman berikutnya otomatis dilewati (bukan dianggap data).
- Baris total/summary (`Subtotal`, `Total`, `PPN`, `Dibuat oleh`, dst.) otomatis menjadi **terminator**.

### 3.4 Baris-baris yang dilewati otomatis
- Baris yang terlihat seperti header (label kolom berulang).
- Baris berisi satu token mata uang (`IDR` / `Rp`) saja.
- Baris satu kata pendek (≤ 2 karakter) — biasanya nomor halaman / titik.
- Baris yang masih dalam "pita header" (label header di baris tambahan).

---

## 4. Segmentasi Dokumen Bulk (Satu PDF Banyak Nota Retur)

Ini jawaban untuk kondisi: **"bulk sampai berlembar-lembar dengan banyak No Nota Retur"** dan
**"3 lembar satu nomor, ada yang lebih dari 2 lembar"**.

### 4.1 Konfigurasi di template
| Field | Contoh | Fungsi |
|---|---|---|
| **Pemisah Dokumen (split_pattern)** | `NOMOR` | Label yang menandai **awal tiap dokumen** dalam PDF |
| **Kunci Dokumen (split_key)** | `nomor_nota_retur` | Field key yang nilainya jadi **identitas** dokumen |

### 4.2 Logika penggabungan
1. Mesin mencari **semua** baris berisi `split_pattern` (mis. `NOMOR`) di seluruh PDF.
2. Untuk tiap marker, ambil **nilai identitas** = teks setelah label di baris yang sama
   (mis. `0127/YDI/NR/FEB/2026`).
   - Jika marker **tidak membawa nilai** (mis. split_pattern = judul `NOTA RETUR` yang berdiri
     sendiri), identitas diambil dari nilai **field `split_key`** di dekat marker.
3. **Nilai sama** → bagian dari dokumen yang sama (halaman digabung) → **kasus 3+ lembar 1 nomor**.
4. **Nilai berbeda** → dokumen baru dimulai → **kasus bulk banyak nomor**.

### 4.3 Hasil
Setiap file yang diekstrak mengembalikan `documents[]`. Di UI:
- **Studio** menampilkan **chip pilihan dokumen** (doc 1, doc 2, ...) — klik untuk melihat field &
  tabel masing-masing.
- **Export Excel** menghasilkan **flat per-baris per dokumen** (field header diulang di setiap baris item).

### 4.4 Template yang TIDAK diisi split
Bila `split_pattern` kosong, seluruh PDF dianggap **satu dokumen** (perilaku lama) — tetap
didukung untuk dokumen tunggal 1–2 lembar.

---

## 5. Langkah Training Template Baru (Workflow)

1. **Siapkan sampel**: PDF asli (bukan scan bila memungkinkan). Untuk bulk, gunakan file yang
   berisi 2–3 dokumen sekaligus supaya split langsung teruji.
2. **Buat template** di menu AnyDoc → Template Mapping: beri nama (mis. `Nota Retur`) & jenis dokumen.
3. **Unggah sampel** → panel "Hasil Validasi" menampilkan jumlah dokumen terdeteksi
   (`__doc_count__`) + nilai field yang berhasil dicari.
4. **Tambah field header** satu per satu:
   - `NOMOR` → `label_same_line`
   - `TGL NOTA RETUR` (di bawah `DEPOK,`) → `label_same_line` atau `regex`
   - `NAMA` + anchor `KEPADA PENJUAL` → `label_after_anchor`
   - `NPWP` + anchor `KEPADA PENJUAL` → `label_after_anchor`
5. **Tambah kolom tabel**: `NO`, `NAMA BARANG`, `KUANTUM`, `HARGA`, `HARGA JUAL YANG DIKEMBALIKAN`
   (cukup pattern `DIKEMBALIKAN`), dan kolom **Grup** `NO FAKTUR`.
6. **Isi Pemisah Dokumen** = `NOMOR` dan **Kunci Dokumen** = `nomor_nota_retur`.
7. **Validasi**: periksa `found: true` + nilai benar di tiap field, dan jumlah baris tabel sesuai.
8. **Simpan** template → hasil tersimpan di database.
9. **Ekstrak PDF asli**: unggah file apa pun (bisa bulk), sistem otomatis memakai template &
   memecah per dokumen → export Excel.

---

## 6. Studi Kasus (Kasus & Kondisi Nyata)

### Kasus A — Satu dokumen 2 lembar, satu nomor
`nr.pdf` (2 halaman, `0127/YDI/NR/FEB/2026`). Template `Nota Retur`:
- Split `NOMOR` → **1 dokumen**, halaman 1–2.
- Hasil: 14 baris, faktur grup benar, tabel bersambung antar halaman. ✅

### Kasus B — Bulk banyak nomor dalam satu PDF
PDF 4+ halaman berisi nota retur berbeda-beda:
- Split `NOMOR` menemukan marker tiap dokumen → **N dokumen** (masing-masing dengan barisnya).
- UI menampilkan chip dokumen; Excel flat per dokumen. ✅

### Kasus C — Satu nomor, 3+ lembar (sangat dinamis)
PDF 3+ halaman dengan **nomor sama**:
- Nilai identitas sama → **tetap 1 dokumen**, halaman 1–N, tabel diambil terus sampai terminator. ✅

### Kasus D — Jenis dokumen lain (Proforma Invoice)
Template `Proforma Invoice` (tanpa split) — field customer, NPWP, alamat, total tetap terekstrak
dengan benar. Jika ada varian invoice bulk, tinggal isi `split_pattern` dengan label nomor invoicenya.

### Kasus E — PDF hasil scan (gambar, tanpa text-layer)
Sistem berbasis teks (pdfjs) tidak bisa membaca gambar. Gunakan pipeline **OCR** yang sudah ada
(`ocr_pipeline.js`) untuk menghasilkan PDF ber-text-layer terlebih dahulu, lalu training normal.

---

## 6b. Monitoring Hasil Bulanan & Peringatan Perubahan Layout

Setiap ekstraksi **tersimpan otomatis** di tabel `pdf_extractions` untuk memantau kualitas lintas bulan:

| Kolom | Arti |
|---|---|
| `period` | Periode dokumen (`2026-05`) — diambil dari pola `/BULAN/TAHUN` pada nomor nota (mis. `0270/YDI/NR/MAY/2026` → `2026-05`) |
| `doc_count` | Jumlah dokumen terdeteksi (hasil split bulk) |
| `total_rows` | Total baris item semua dokumen |
| `avg_confidence` | Rata-rata confidence field header |
| `fields_found / fields_total` | Field header yang ditemukan vs total mapping |
| `table_found` | Header tabel item terdeteksi atau tidak |
| `layout_changed` | `true` bila ada indikasi perubahan layout |

**Deteksi perubahan layout** (warning otomatis di UI — banner amber):
- Confidence rata-rata < 70%
- Field header yang ditemukan < 60% dari mapping
- Header tabel tidak terdeteksi padahal template punya kolom tabel
- Tidak ada dokumen terdeteksi sama sekali

**Alur monitoring bulanan:** panel **"Monitoring Hasil Bulanan"** di tab Ekstrak menampilkan
ringkasan per periode (jumlah file, dokumen, baris, confidence, masalah layout) + riwayat ekstraksi
tiap file. Jika muncul warning layout → upload 1 sampel layout terbaru di tab Training Mapping,
validasi, sesuaikan field, simpan — sekali saja, bukan per dokumen.

## 7. Tips & Troubleshooting

| Gejala | Kemungkinan Penyebab | Solusi |
|---|---|---|
| Nilai field kosong / salah blok | Label kembar (NAMA pembeli vs penjual) | Pakai `label_after_anchor` + isi **Anchor** |
| Kolom tabel terisi teks dari kolom lain | Label kolom terlalu pendek / ambigu | Perpanjang pattern (mis. `DIKEMBALIKAN`, bukan `HARGA`) |
| Baris header ikut jadi data | Header terpecah baris > 12 pt | Pastikan kolom punya satu kata kunci unik; cek jarak header |
| No Faktur tidak muncul per baris | Kolom grup belum dicentang / pattern salah | Centang **Grup** dan isi pattern `No Faktur` |
| Bulk jadi satu dokumen semua | `split_pattern` kosong / salah | Isi label penanda awal dokumen (mis. `NOMOR`) |
| Dokumen terbelah berlebihan | Nilai identitas berubah antar halaman | Pastikan nomor konsisten; cek `split_key` benar |
| Marker tidak terdeteksi (bulk jadi 1) | Label `split_pattern` tidak persis ada di PDF | Gunakan label yang benar-benar tercetak; cek ejaan |
| Field di atas marker hilang | Marker bukan elemen paling atas dokumen | Mulai tiap dokumen di halaman baru; letakkan `NOMOR` di bagian atas lembar |
| Kolom/baris berlabel mirip marker ikut terpotong | Cocok-sebagian (mis. "NOMOR FAKTUR") | Marker memakai exact match; cocok-sebagian butuh nilai di belakangnya |
| Nomor dokumen ikut tertangkap jadi 2 | Sampel sintetis (pdf-lib) menyisakan teks asli | Uji dengan PDF asli dari printer |
| PDF hasil scan kosong | Tanpa text-layer | Jalankan OCR dulu (`ocr_pipeline.js`) |
| Tabel berhenti terlalu cepat | Kata terminator muncul di data | Ganti pattern kolom agar data tidak mengandung kata `total`/`subtotal` |

---

## 8. Ringkasan Konsep Training

```
PDF (1..N halaman, bisa bulk)
   │  split_pattern "NOMOR"  →  temukan awal tiap dokumen
   │  nilai identitas sama   →  gabung jadi 1 dokumen (3+ lembar 1 nomor)
   │  nilai berbeda          →  dokumen baru (bulk banyak nomor)
   ▼
per dokumen:
   ├─ Header fields : label_same_line / label_next_line / label_after_anchor / regex
   └─ Tabel         : kolom berposisi + kolom GRUP (No Faktur di atas) + lanjut antar halaman
   ▼
documents[] → UI chip dokumen → Export Excel flat per-baris
```

Dengan pola ini, **satu template yang sama** menangani semua kondisi dinamis:
dokumen tunggal, bulk puluhan lembar, 3+ lembar satu nomor, dan tabel bersambung — tanpa perlu
membuat template per kondisi. Tambah sampel baru → validasi → simpan, dan sistem menyesuaikan.

---

## 9. Keputusan OCR (Ollama-OCR / VLM) — Ditinjau 2026-08-10

**Status: TIDAK diimplementasikan.** Berikut pertimbangan & syarat bila suatu saat perlu.

### Kondisi server saat tinjauan
| Komponen | Nilai | Catatan |
|---|---|---|
| CPU | 32 core Xeon Silver 4110 | CPU-only, tanpa GPU NVIDIA |
| RAM | 19 GB (12 GB tersedia) | Swap sudah terpakai 75% |
| GPU | Tidak ada | VLM hanya jalan di CPU |
| Ollama | v0.32.5 aktif | Hanya model teks (qwen2.5-3b/7b/14b) |
| OCR yang sudah ada | Tesseract (tesseract.js) | `ocr_pipeline.js` + `trainingDocs.js` |

### Mengapa tidak diimplementasikan sekarang
1. **Dokumen Nota Retur bukan scan** — semua punya text-layer; ekstraksi posisi sudah 97% presisi
   selama 4 bulan berturut-turut (Feb–Jun 2026). Jalur utama TIDAK butuh OCR.
2. **VLM di CPU sangat lambat** — moondream ~1 menit/halaman, qwen2.5-vl:3b ~2–4 menit/halaman.
   Untuk bulk 50 dokumen tidak realistis.
3. **RAM ketat** — model vision 4–8 GB akan menabrak sisa 12 GB yang dipakai service lain
   (Node, 1Mbrain, worker) dan swap yang sudah 3/4 penuh.
4. **Sudah ada fallback OCR** (Tesseract) untuk PDF hasil scan di jalur training docs.

### Kapan harus diaktifkan (keputusan tertunda)
- **Pemicu**: muncul dokumen Nota Retur **hasil scan** (tanpa text-layer) yang harus diekstrak
  ke Excel, dan hasil Tesseract tidak cukup presisi untuk tabel.
- **Opsi yang disarankan (sesuai resource)**: fallback `moondream` (~1.7 GB, +2 GB RAM) —
  hanya aktif saat PDF tidak punya text-layer (auto-detect). Alur: extract gagal/tidak ada teks
  → render halaman → kirim ke Ollama vision → hasil masuk pipeline parsing yang sama.
- **Opsi lebih akurat tapi berat**: `qwen2.5-vl:3b` (+4 GB RAM, lebih lambat) — hanya jika
  akurasi moondream tidak cukup.
- **Jangan** mengubah jalur utama: PDF digital tetap pakai ekstraksi posisi (cepat & presisi).

### Langkah jika diputuskan aktif (referensi cepat)
```
ollama pull moondream                       # +1.7 GB disk
pip install ollama-ocr                      # opsional (wrapper python)
# alternatif: panggil langsung API Ollama dari Node: POST :11434/api/generate
# integrasi: deteksi text-layer kosong di pdfMappingService → render page → VLM → parse JSON
```
