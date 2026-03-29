# TEMPLATE EXCEL UNTUK IMPORT INVENTORY - PANDUAN LENGKAP

**Status**: ✅ PRODUCTION READY  
**Updated**: 28 Maret 2026

---

## 📊 TEMPLATE EXCEL YANG BENAR

### Struktur Dasar
File Excel harus memiliki **1 sheet** dengan kolom-kolom berikut:

| Urutan | Kolom | Tipe | Required? | Contoh | Catatan |
|--------|-------|------|-----------|--------|---------|
| 1 | **No Slot** | Number | ✅ YES | 1, 2, 3, ..., 120 | Range: 1-120 |
| 2 | **No Kardus** | Text | ✅ YES | BOX-2024-001 | Harus UNIK di sistem |
| 3 | **Status** | Text | ⚠️ OPTIONAL | TERISI | Akan ditimpa dengan IMPORTED |
| 4 | **No Ordner** | Text | ✅ YES* | ORD-001 | *Jika ada invoice |
| 5 | **Periode** | Text | ✅ YES* | Jan 2024 | *Jika ada invoice |
| 6 | **No Invoice** | Text | ✅ YES | INV/001 | Key grouping field |
| 7 | **Vendor** | Text | ⚠️ OPTIONAL | Vendor A | Nama supplier |
| 8 | **Tgl Pembayaran** | Date | ⚠️ OPTIONAL | 2024-01-31 | Format: YYYY-MM-DD |
| 9 | **No Faktur Pajak** | Text | ⚠️ OPTIONAL | 010.000-24.00000001 | Format: XXX.XXX-XX.XXXXXXXX |
| 10 | **Keterangan Kusus** | Text | ⚠️ OPTIONAL | Catatan khusus | Max 255 char |

---

## 📝 CONTOH TEMPLATE YANG BENAR

### Format A: Single Ordner per Slot

```
No Slot | No Kardus      | Status | No Ordner | Periode   | No Invoice | Vendor       | Tgl Pembayaran | No Faktur Pajak      | Keterangan Kusus
--------|----------------|--------|-----------|-----------|------------|--------------|----------------|----------------------|------------------
1       | BOX-2024-001   | TERISI | ORD-001   | Jan 2024  | INV/001    | Vendor A     | 2024-01-31     | 010.000-24.00000001  | Pembayaran tepat waktu
1       | BOX-2024-001   | TERISI | ORD-001   | Jan 2024  | INV/002    | Vendor A     | 2024-01-31     | 010.000-24.00000002  | Pembayaran tepat waktu
2       | BOX-2024-002   | TERISI | ORD-002   | Feb 2024  | INV/003    | Vendor B     | 2024-02-15     | 010.000-24.00000003  | Diskon 5%
3       | BOX-2024-003   | TERISI | ORD-003   | Mar 2024  | INV/004    | Vendor C     | 2024-03-10     | 010.000-24.00000004  |
```

### Format B: Multiple Ordners per Slot

```
No Slot | No Kardus      | No Ordner | Periode   | No Invoice | Vendor       | Tgl Pembayaran
--------|----------------|-----------|-----------|------------|--------------|----------------
1       | BOX-2024-001   | ORD-001   | Jan 2024  | INV/001    | Vendor A     | 2024-01-31
1       | BOX-2024-001   | ORD-001   | Jan 2024  | INV/002    | Vendor A     | 2024-01-31
1       | BOX-2024-001   | ORD-002   | Feb 2024  | INV/003    | Vendor B     | 2024-02-15
1       | BOX-2024-001   | ORD-002   | Feb 2024  | INV/004    | Vendor B     | 2024-02-15
```

> **Penjelasan**: Satu slot (No Slot = 1) dengan satu box (BOX-2024-001) dapat memiliki MULTIPLE ordners. Sistem akan otomatis mengelompokkan berdasarkan No Ordner.

---

## ✅ CHECKLIST SEBELUM IMPORT

### Data Validation
- [ ] Semua No Slot dalam range 1-120
- [ ] Semua No Slot unik PER file (tidak boleh duplikat slot dalam satu file)
- [ ] Semua No Kardus UNIK di SISTEM (tidak ada di slot lain)
- [ ] No Kardus menggunakan format: `BOX-YYYY-NNN` atau konsisten
- [ ] Tidak ada kolom yang completely kosong
- [ ] Tidak ada baris yang completely kosong

### Format & Type
- [ ] File dalam format `.xlsx` (Microsoft Excel 2007+)
- [ ] TIDAK gunakan `.xls` atau `.csv` (mungkin error parsing)
- [ ] Kolom header di row pertama (CASE INSENSITIVE tapi spelling harus correct)
- [ ] Tanggal format: `YYYY-MM-DD` (ex: 2024-01-31)
- [ ] No Faktur Pajak format: `XXX.XXX-XX.XXXXXXXX` (ex: 010.000-24.00000001)
- [ ] No Invoice TIDAK boleh kosong
- [ ] No Ordner TIDAK boleh kosong

### Duplikasi & Konflik
- [ ] Box ID tidak ada di inventory lain (global check)
- [ ] Slot tujuan harus kosong (status = EMPTY)
- [ ] Tidak ada 2 invoices dengan nomor sama dalam ordner yang sama
- [ ] Invoice grouping sudah correct sesuai No Ordner

### Konten & Kelengkapan
- [ ] Vendor tidak boleh karakter spesial (gunakan A-Z, 0-9, spasi, dash)
- [ ] Keterangan < 255 karakter
- [ ] Periode format konsisten (ex: "Jan 2024" atau "2024-01" atau "January 2024")
- [ ] Tidak ada leading/trailing spaces di fields penting
- [ ] Tidak ada double quotes atau special characters di CSV

---

## ❌ CONTOH YANG SALAH (AKAN DI-SKIP)

### Case 1: Missing Required Field
```
No Slot | No Kardus    | No Invoice
--------|--------------|------------
1       |              | INV/001    ← SKIP: No Kardus kosong
2       | BOX-2024-002 |            ← SKIP: No Invoice kosong
3       | BOX-2024-003 | INV/003    ← OK
```

### Case 2: Slot Out of Range
```
No Slot | No Kardus      | No Invoice
--------|----------------|------------
0       | BOX-2024-001   | INV/001    ← SKIP: Slot 0 (harus 1-120)
121     | BOX-2024-002   | INV/002    ← SKIP: Slot 121 (harus 1-120)
1       | BOX-2024-003   | INV/003    ← OK
```

### Case 3: Slot Already Occupied
```
No Slot | No Kardus      | No Invoice
--------|----------------|------------
1       | BOX-2024-001   | INV/001    ← SKIP: Slot 1 sudah terisi
2       | BOX-2024-002   | INV/002    ← OK
```

### Case 4: Duplicate Slot in File
```
No Slot | No Kardus      | No Ordner | No Invoice
--------|----------------|-----------|------------
1       | BOX-2024-001   | ORD-001   | INV/001    ← OK: Grouped
1       | BOX-2024-002   | ORD-001   | INV/002    ← SKIP: Box ID berbeda
```

### Case 5: Invalid Date Format
```
No Slot | No Kardus      | Tgl Pembayaran
--------|----------------|----------------
1       | BOX-2024-001   | 31-01-2024     ← SKIP: Format salah (harus YYYY-MM-DD)
2       | BOX-2024-002   | 2024-01-31     ← OK
3       | BOX-2024-003   | Jan 31, 2024   ← SKIP: Format salah
```

---

## 🔄 DATA FLOW SETELAH IMPORT

```
Excel Row
    ↓
1. Parse & Grouping
    ├─ Group by (No Slot + No Kardus)
    ├─ Validate required fields
    └─ Skip invalid rows
    ↓
2. Transform ke Struktur Database
    ├─ Slot ID → inventory.id
    ├─ No Kardus → box_id
    ├─ Ordners[] → boxData.ordners[]
    └─ Invoices[] → ordner.invoices[]
    ↓
3. Sync Folder
    ├─ Create folder: /DataBox/{BoxID}
    └─ Create subfolder: /DataBox/{BoxID}/Ordner_{NoOrdner}
    ↓
4. Update Database
    ├─ INSERT/UPDATE inventory record
    ├─ Set status = 'IMPORTED'
    ├─ Set lastUpdated = NOW()
    └─ Add history entry
    ↓
5. Result
    ├─ UI refresh dengan data baru
    └─ Log activity di system
```

---

## 🎯 HASIL YANG DIHARAPKAN SETELAH IMPORT

### Struktur Database
```json
{
  "id": 1,
  "status": "IMPORTED",
  "box_id": "BOX-2024-001",
  "box_data": {
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
            "specialNote": "Pembayaran tepat waktu"
          }
        ]
      }
    ]
  },
  "history": [
    {
      "action": "IMPORTED",
      "details": "Import: BOX-2024-001",
      "timestamp": "2024-03-28T12:34:56Z"
    }
  ],
  "lastUpdated": "2024-03-28T12:34:56Z"
}
```

### File System
```
📁 DataBox/
  └── 📁 BOX-2024-001/
      ├── 📁 Ordner_ORD-001/
      │   ├── 📄 INV-001.pdf (if uploaded later)
      │   └── 📄 INV-002.pdf (if uploaded later)
      └── 📁 Ordner_ORD-002/
          └── 📄 INV-003.pdf (if uploaded later)
```

---

## 🚨 ERROR MESSAGES & TROUBLESHOOTING

### ❌ "No data matches your search"
**Cause**: Semua baris di-skip (invalid data)  
**Solution**:
- Cek kolom header sesuai template
- Cek No Slot dalam range 1-120
- Cek No Kardus tidak kosong
- Cek No Invoice tidak kosong

### ❌ "Slot #X tidak ditemukan"
**Cause**: Slot ID di-parse sebagai string, bukan number  
**Solution**:
- Pastikan kolom No Slot adalah NUMBER, bukan TEXT
- Di Excel: Format Cell → Number

### ❌ "Box ID sudah ada di Slot #Y"
**Cause**: Box ID sudah terisi di slot lain  
**Solution**:
- Gunakan Box ID yang unik
- Atau kosongkan slot lama terlebih dahulu

### ❌ "Gagal menyimpan: JSON error"
**Cause**: Data corrupted atau format tidak sesuai  
**Solution**:
- Pastikan No Faktur Pajak format: XXX.XXX-XX.XXXXXXXX
- Pastikan Tgl Pembayaran format: YYYY-MM-DD
- Cek tidak ada special characters di Vendor

### ⚠️ "Import selesai dengan X error"
**Cause**: Beberapa baris gagal, tapi file lanjut  
**Solution**:
- Cek browser console untuk detail
- Perbaiki baris yang error
- Re-import file yang sudah diperbaiki

---

## 📋 COLUMN NAME VARIATIONS YANG DIKENALI SISTEM

Sistem dapat mengenali berbagai nama kolom (case-insensitive + special char removal):

### No Slot
✅ `No Slot`, `Slot`, `No. Slot`, `slot_no`, `No_Slot`, `SlotID`, `SLOT ID`

### No Kardus
✅ `No Kardus`, `Box ID`, `No. Kardus`, `box_id`, `No_Kardus`, `Kardus ID`, `BoxID`

### No Ordner
✅ `No Ordner`, `Ordner`, `No. Ordner`, `ordner_no`, `ORDNER_ID`

### Periode
✅ `Periode`, `Period`, `Tahun`, `YEAR`, `bulan_tahun`

### No Invoice
✅ `No Invoice`, `Invoice`, `No. Invoice`, `invoice_no`, `INV_NO`

### Vendor
✅ `Vendor`, `Supplier`, `Nama Vendor`, `VENDOR_NAME`

### Tgl Pembayaran
✅ `Tgl Pembayaran`, `Tanggal`, `Date`, `Payment Date`, `Tgl_Pembayaran`

### No Faktur Pajak
✅ `No Faktur Pajak`, `No Faktur`, `Faktur`, `Tax Invoice No`, `NO_FAKTUR`

### Keterangan Kusus
✅ `Keterangan Kusus`, `Keterangan`, `Note`, `Special Note`, `REMARK`

---

## 🔧 BEST PRACTICES

1. **Backup data sebelum import besar**
   ```
   Export laporan lengkap sebelum import
   File → Export Laporan Detail
   ```

2. **Test dengan beberapa baris dulu**
   ```
   Upload 5-10 baris untuk verify
   Cek hasil, baru upload full
   ```

3. **Gunakan naming convention yang konsisten**
   ```
   Box ID: BOX-YYYY-NNN (ex: BOX-2024-001)
   Ordner: ORD-NNN (ex: ORD-001)
   Invoice: INV/NNN (ex: INV/001)
   ```

4. **Dokumentasi invoice attachment**
   ```
   Simpan file invoice dengan nama: INV-{NoInvoice}.pdf
   Upload setelah import slot selesai
   ```

5. **Monitor import progress**
   ```
   Jangan tutup browser selama import
   Lihat toast notification untuk status
   Cek browser console untuk detail error
   ```

---

## 📞 SUPPORT & TROUBLESHOOTING

Jika ada masalah:

1. **Cek console browser** (F12 → Console)
   - Copy error message lengkap
   - Report dengan screenshot

2. **Download template terbaru**
   - Menu Inventory → Download Template
   - Jangan edit header column

3. **Contact admin**
   - Attach file Excel yang error
   - Attach screenshot console
   - Explain workflow yang dilakukan

---

**Last Updated**: 28 Maret 2026  
**Version**: 1.0  
**Status**: ✅ Production Ready
