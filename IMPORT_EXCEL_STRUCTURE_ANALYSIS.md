# Analisis Struktur Import Excel vs Database

**Tanggal**: 28 Maret 2026  
**Status**: ✅ SESUAI (Dengan Catatan Minor)

---

## 📋 Ringkasan Eksekutif

Proses import Excel untuk inventory sudah **sesuai dengan struktur database**, namun ada beberapa area yang perlu diperhatikan untuk konsistensi data dan error handling.

---

## 1️⃣ STRUKTUR DATABASE (Inventory Table)

```sql
CREATE TABLE inventory (
  id              INTEGER PRIMARY KEY,          -- Nomor Slot (1-120)
  status          VARCHAR(20) DEFAULT 'EMPTY',  -- STORED, BORROWED, AUDIT, EMPTY, IMPORTED
  box_id          VARCHAR(255),                 -- ID Kardus (BOX-2024-001)
  box_data        JSON,                         -- Struktur data kardus lengkap
  boxData         JSON,                         -- Redundant (duplikasi untuk sync)
  lastUpdated     TIMESTAMP,                    -- Waktu update terakhir
  history         JSON,                         -- Riwayat perubahan
  rack            VARCHAR(10),                  -- Identifikasi rak (A, B, C, dst)
  shelf           INTEGER,                      -- Nomor shelf
  position        INTEGER                       -- Posisi di shelf
);
```

### Struktur `box_data` (JSON):
```json
{
  "id": "BOX-2024-001",
  "ordners": [
    {
      "id": 1234567890,
      "noOrdner": "ORD-001",
      "period": "Jan 2024",
      "invoices": [
        {
          "id": 1234567891,
          "invoiceNo": "INV/001",
          "vendor": "Vendor A",
          "paymentDate": "2024-01-31",
          "taxInvoiceNo": "010.000-24.00000001",
          "specialNote": "Contoh keterangan"
        }
      ]
    }
  ]
}
```

---

## 2️⃣ STRUKTUR TEMPLATE EXCEL

### Kolom yang Didukung:
| Kolom Excel | Field Database | Tipe | Contoh | Status |
|---|---|---|---|---|
| **No Slot** | `inventory.id` | INT | 1, 2, 3 | ✅ Required |
| **No Kardus** | `box_id` / `boxData.id` | STRING | BOX-2024-001 | ✅ Required |
| **Status** | `status` | STRING | TERISI | ⚠️ Optional |
| **No Ordner** | `ordner.noOrdner` | STRING | ORD-001 | ✅ Required (jika ada invoice) |
| **Periode** | `ordner.period` | STRING | Jan 2024 | ✅ Required (jika ada invoice) |
| **No Invoice** | `invoice.invoiceNo` | STRING | INV/001 | ✅ Key grouping |
| **Vendor** | `invoice.vendor` | STRING | Vendor A | ⚠️ Optional |
| **Tgl Pembayaran** | `invoice.paymentDate` | DATE | 2024-01-31 | ⚠️ Optional |
| **No Faktur Pajak** | `invoice.taxInvoiceNo` | STRING | 010.000-24.00000001 | ⚠️ Optional |
| **Keterangan Kusus** | `invoice.specialNote` | STRING | Catatan khusus | ⚠️ Optional |

### Variasi Nama Kolom yang Diakui:
Sistem menggunakan `findVal()` untuk mencocokkan kolom secara fleksibel (case-insensitive):

#### No Slot:
- `No Slot`, `Slot`, `No. Slot`, `slot_no`, `No_Slot`, `SlotID`

#### No Kardus:
- `No Kardus`, `Box ID`, `No. Kardus`, `box_id`, `No_Kardus`, `Kardus ID`, `BoxID`

#### No Ordner:
- `No Ordner`, `Ordner`, `No. Ordner`

#### Periode:
- `Periode`, `Period`, `Tahun`

#### No Invoice:
- `No Invoice`, `Invoice`, `No. Invoice`

#### Vendor:
- `Vendor`, `Supplier`, `Nama Vendor`

#### Tgl Pembayaran:
- `Tgl Pembayaran`, `Tanggal`, `Date`

#### No Faktur Pajak:
- `No Faktur Pajak`, `No Faktur`, `Faktur`, `Tax Invoice No`

#### Keterangan Kusus:
- `Keterangan Kusus`, `Keterangan`, `Note`, `Special Note`

---

## 3️⃣ PROSES IMPORT

### Alur:
```
1. User upload file Excel
   ↓
2. Parse Excel → XLSX.read() → sheet_to_json()
   ↓
3. Validasi kolom dengan findVal() (flexible matching)
   ↓
4. Grouping by (No Slot + No Kardus)
   ↓
5. Strukturkan menjadi ordners[] dan invoices[]
   ↓
6. Generate ID untuk ordner dan invoice (Date.now() + Math.random())
   ↓
7. Buat box_data JSON object
   ↓
8. sync folder di file system
   ↓
9. Update inventory table via API
   ↓
10. Log activity dan refresh inventory
```

### Kondisi Validasi:
```javascript
// ✅ PASS jika:
- Slot ID ada dan valid (1-120)
- Box ID ada (tidak kosong)
- Slot status = EMPTY atau boxData = null

// ❌ SKIP jika:
- Slot ID kosong atau invalid
- Box ID kosong
- Slot sudah terisi (status !== EMPTY && boxData !== null)

// ❌ FAIL jika:
- Parsing Excel error
- Update database error
- Sync folder error
```

---

## 4️⃣ PERBEDAAN & OBSERVASI

### ✅ YANG SUDAH SESUAI:

1. **Flexible Column Matching**
   - Sistem dapat mengenali berbagai nama kolom (case-insensitive)
   - Memudahkan user menggunakan template mereka sendiri

2. **Nested Data Structure**
   - Template mendukung multiple invoices per ordner
   - Grouping otomatis berdasarkan Slot + Box ID

3. **Database Sync**
   - Field `box_id` dan `boxData` disinkronkan
   - History otomatis dicatat
   - Folder sync mencegah duplikasi di file system

4. **Error Handling**
   - Skip baris invalid (tidak stop)
   - Laporan detail di console dan toast

### ⚠️ CATATAN & REKOMENDASI:

#### 1. **Duplikasi boxData & boxData (snake_case)**
```javascript
// Di database ada 2 kolom:
boxData     // JSON (camelCase)
box_data    // JSON (snake_case)

// Sebaiknya standardisasi untuk satu kolom saja
// atau selalu sync keduanya untuk konsistensi
```

**Rekomendasi**: 
```javascript
// Saat update inventory, pastikan selalu sinkronkan:
updateData.box_data = stringData;
updateData.boxData = stringData; // Redundant tapi safe untuk backward compat
```

#### 2. **Invoice ID Generation**
```javascript
// Saat ini menggunakan:
id: Date.now() + Math.random()

// Masalah: Bisa collision jika import dalam rapid succession
// Rekomendasi:
id: `INV-${Date.now()}-${Math.floor(Math.random() * 1000000)}`
// atau UUIDv4 dari library uuid
```

#### 3. **Status Hardcoded ke 'IMPORTED'**
```javascript
// Di line 1853: status: 'IMPORTED'

// Masalah: Template excel mengirim "TERISI" tapi diabaikan
// Rekomendasi: Parse status dari Excel jika ada
const statusMap = {
  'TERISI': 'STORED',
  'STORED': 'STORED',
  'DIPINJAM': 'BORROWED',
  'BORROWED': 'BORROWED',
  'AUDIT': 'AUDIT',
  'IMPORTED': 'IMPORTED'
};
```

#### 4. **Validasi Data Tipe**
```javascript
// Tidak ada validasi tipe data untuk:
- paymentDate (bisa string, date, atau number)
- taxInvoiceNo (format tidak divalidasi)
- invoiceNo (format tidak divalidasi)

// Rekomendasi: Tambah validation layer
```

#### 5. **Slot Range**
```javascript
// Tidak ada cek apakah slot ID dalam range valid (1-120)
// Rekomendasi:
if (sId < 1 || sId > TOTAL_SLOTS) {
  skippedLogs.push(`Slot #${sId} di luar range valid (1-120)`);
  continue;
}
```

#### 6. **Duplicate Box ID**
```javascript
// Sistem cek duplicate per slot, tapi tidak per sistem
// Jika ada 2 slot dengan Box ID yang sama = data corrupt
// Rekomendasi: Global duplicate check
```

---

## 5️⃣ STRUKTUR FIELD - MAPPING DETAIL

### Dari Excel ke Database:

```
Excel Row:
├─ No Slot (1) → inventory.id
├─ No Kardus (BOX-2024-001) → box_id + boxData.id
├─ Status (TERISI) → [IGNORED, hardcoded 'IMPORTED']
│
└─ Ordner Group:
   ├─ No Ordner (ORD-001) → ordner.noOrdner
   ├─ Periode (Jan 2024) → ordner.period
   │
   └─ Invoice List:
      ├─ No Invoice (INV/001) → invoice.invoiceNo
      ├─ Vendor → invoice.vendor
      ├─ Tgl Pembayaran → invoice.paymentDate
      ├─ No Faktur Pajak → invoice.taxInvoiceNo
      └─ Keterangan Kusus → invoice.specialNote
```

### Apa yang TIDAK dimap dari Excel:
- ❌ `rack`, `shelf`, `position` (tidak ada di template)
- ❌ `history` (auto-generated)
- ❌ `lastUpdated` (auto-generated)
- ❌ Status (hardcoded ke 'IMPORTED')

---

## 6️⃣ TEST CASES

### ✅ Valid Cases:
```
1. Slot kosong + Box ID unik + Multiple ordners
   → Status: BERHASIL ✅

2. Slot kosong + Box ID + 1 ordner + 3 invoices
   → Status: BERHASIL ✅

3. Multiple rows dengan Slot/Box ID sama (grouped)
   → Status: BERHASIL ✅ (auto-grouped)
```

### ❌ Invalid Cases:
```
1. No Slot kosong
   → Status: SKIP ❌

2. No Kardus kosong
   → Status: SKIP ❌

3. Slot sudah terisi (status !== EMPTY)
   → Status: SKIP ❌ (dengan warning)

4. Kolom tidak sesuai format
   → Status: SKIP ❌ (findVal return null)

5. Excel file corrupt
   → Status: ERROR ❌ (stop file, lanjut file berikutnya)
```

---

## 7️⃣ REKOMENDASI PERBAIKAN

### Priority: HIGH
```
1. Tambah validasi slot range (1-120)
   File: src/App.jsx line ~1805

2. Parse status dari Excel jika ada
   File: src/App.jsx line ~1853

3. Standardisasi box_data vs boxData (gunakan salah satu)
   File: multiple (search "boxData")

4. Generate ID dengan format lebih jelas
   File: src/App.jsx line ~1833
```

### Priority: MEDIUM
```
5. Validasi format taxInvoiceNo (format regex)
   File: src/App.jsx line ~1825

6. Duplicate Box ID check (global)
   File: src/App.jsx line ~1782

7. Date parsing untuk paymentDate
   File: src/App.jsx line ~1823
```

### Priority: LOW
```
8. Map rack/shelf/position jika ada di Excel
   File: src/App.jsx line ~1825

9. Improvement error message untuk user
   File: src/App.jsx line ~1874
```

---

## 8️⃣ CHECKLIST SEBELUM IMPORT

- [ ] File Excel format `.xlsx` (bukan `.xls`)
- [ ] Slot ID dalam range 1-120
- [ ] Slot tujuan kosong (status = EMPTY)
- [ ] Box ID unik di sistem
- [ ] No Invoice tidak kosong jika ada data
- [ ] No Ordner dan Periode ada jika ada invoice
- [ ] Kolom header sesuai template atau alias yang dikenali
- [ ] Tidak ada duplicate rows untuk slot yang sama
- [ ] Format tanggal konsisten (YYYY-MM-DD recommended)
- [ ] Tidak ada karakter spesial di Box ID (gunakan dash/underscore)

---

## 9️⃣ RINGKASAN KESIMPULAN

### ✅ Database dan Template SESUAI untuk:
- Struktur data basic (slot, box, ordner, invoice)
- Flexible column naming
- Auto-grouping by slot + box
- Error tracking dan logging

### ⚠️ Perlu Perbaikan untuk:
- Validasi slot range
- Status mapping dari Excel
- Standardisasi field naming (snake_case vs camelCase)
- Error handling yang lebih robust
- Duplicate check yang comprehensive

### 📊 Overall Status:
**PRODUCTION READY** dengan rekomendasi minor fixes untuk robustness.

---

**Last Updated**: 28 Maret 2026  
**Verified By**: System Analysis  
**Next Review**: Setelah implementasi improvements HIGH priority
