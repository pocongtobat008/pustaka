# DATABASE SCHEMA REFERENCE - Inventory Import

**Status**: ✅ Current & Verified  
**Date**: 28 Maret 2026

---

## 📋 TABLE: inventory

### Overview
Tabel utama untuk menyimpan informasi slot inventory dengan data box yang kompleks (nested JSON).

### Schema Lengkap

```sql
CREATE TABLE inventory (
  -- Primary Key & Identifiers
  id                 INTEGER PRIMARY KEY NOT NULL,      -- Nomor Slot (1-120)
  
  -- Status
  status             VARCHAR(20) DEFAULT 'EMPTY' NOT NULL,
                     -- Enum values: 'EMPTY', 'STORED', 'BORROWED', 'AUDIT', 'IMPORTED'
  
  -- Box Reference & Data
  box_id             VARCHAR(255) NULL,                -- ID Kardus (mirrored dari boxData.id)
  box_data           JSON NULL,                        -- Struktur lengkap data kardus (snake_case)
  boxData            JSON NULL,                        -- REDUNDANT: Duplikasi untuk backward compat (camelCase)
  
  -- Tracking
  lastUpdated        TIMESTAMP NULL,                   -- Waktu last update
  history            JSON NULL,                        -- Array of history entries
  
  -- Optional: Physical Location
  rack               VARCHAR(10) NULL,                 -- Identifier rak (A, B, C, dst)
  shelf              INTEGER NULL,                     -- Nomor shelf di rak
  position           INTEGER NULL                      -- Posisi di shelf
);
```

### Constraints
```sql
PRIMARY KEY (id)                                    -- Slot ID unik
UNSIGNED INT range: 1-120                           -- Implicit (aplikasi enforce)
UNIQUE (box_id) across all non-EMPTY slots          -- Implicit (aplikasi enforce)
NOT NULL: id, status                                -- Hard constraint
NULLABLE: Semua fields lain
```

### Indexes
```sql
CREATE INDEX idx_inventory_status ON inventory(status);
CREATE INDEX idx_inventory_box_id ON inventory(box_id);
-- Rekomendasi untuk query performance
```

---

## 📦 JSON STRUCTURE: box_data (boxData)

### Root Level
```json
{
  "id": "BOX-2024-001",              // Box ID (string) - REQUIRED
  "ordners": [                        // Array of ordner - REQUIRED (min 1)
    { /* ordner object */ },
    { /* ordner object */ }
  ]
}
```

### Ordner Level
```json
{
  "id": 1234567890,                  // Unique ordner ID (number) - REQUIRED
  "noOrdner": "ORD-001",             // Ordner number (string) - REQUIRED
  "period": "Jan 2024",              // Period/tahun (string) - REQUIRED
  "invoices": [                      // Array of invoices - REQUIRED (min 1)
    { /* invoice object */ },
    { /* invoice object */ }
  ]
}
```

### Invoice Level
```json
{
  "id": 1234567891,                  // Unique invoice ID (number) - REQUIRED
  "invoiceNo": "INV/001",            // Invoice number (string) - REQUIRED
  "vendor": "Vendor A",              // Vendor name (string) - OPTIONAL
  "paymentDate": "2024-01-31",       // Payment date YYYY-MM-DD (string) - OPTIONAL
  "taxInvoiceNo": "010.000-24.00000001",  // Tax invoice number (string) - OPTIONAL
  "specialNote": "Pembayaran tepat waktu", // Special note (string) - OPTIONAL
  "fileName": "INV-001.pdf",         // Attached file name (string) - OPTIONAL
  "status": "done",                  // Processing status - OPTIONAL (auto-set)
  "rawFile": null                    // Binary file data (transient) - OPTIONAL
}
```

### Complete Example
```json
{
  "id": "BOX-2024-001",
  "ordners": [
    {
      "id": 1709000001,
      "noOrdner": "ORD-001",
      "period": "Jan 2024",
      "invoices": [
        {
          "id": 1709000002,
          "invoiceNo": "INV/001",
          "vendor": "PT Maju Jaya",
          "paymentDate": "2024-01-31",
          "taxInvoiceNo": "010.000-24.00000001",
          "specialNote": "Pembayaran diskon 5%",
          "fileName": "INV-001.pdf",
          "status": "done"
        },
        {
          "id": 1709000003,
          "invoiceNo": "INV/002",
          "vendor": "PT Maju Jaya",
          "paymentDate": "2024-01-31",
          "taxInvoiceNo": "010.000-24.00000002",
          "specialNote": "",
          "fileName": "INV-002.pdf",
          "status": "done"
        }
      ]
    },
    {
      "id": 1709000004,
      "noOrdner": "ORD-002",
      "period": "Feb 2024",
      "invoices": [
        {
          "id": 1709000005,
          "invoiceNo": "INV/003",
          "vendor": "PT Sukses Bersama",
          "paymentDate": "2024-02-15",
          "taxInvoiceNo": "010.000-24.00000003",
          "specialNote": "",
          "fileName": "INV-003.pdf",
          "status": "done"
        }
      ]
    }
  ]
}
```

---

## 📝 JSON STRUCTURE: history

### Array Format
```json
[
  {
    "action": "IMPORTED",           // Action type (string) - REQUIRED
    "details": "Import: BOX-2024-001",  // Detail description - REQUIRED
    "timestamp": "2024-03-28T12:34:56Z", // ISO 8601 timestamp - REQUIRED
    "user": "admin"                 // Username atau "system" - OPTIONAL
  },
  {
    "action": "STORED",
    "details": "Status: Dikembalikan User",
    "timestamp": "2024-03-28T13:00:00Z",
    "user": "user123"
  },
  {
    "action": "BORROWED",
    "details": "Status: Dipinjam User",
    "timestamp": "2024-03-28T14:30:00Z",
    "user": "user456"
  }
]
```

### Action Types
- `IMPORTED` - Data diimport dari Excel
- `STORED` - Status diubah ke STORED
- `BORROWED` - Status diubah ke BORROWED
- `AUDIT` - Status diubah ke AUDIT
- `MOVED` - Box dipindahkan ke slot lain
- `UPDATED` - Data box diupdate
- `RESET` - Slot direset (kosongkan)
- `MOVE_IN` - Box masuk dari slot lain
- `MOVE_OUT` - Box keluar ke slot lain

---

## 🔄 STATUS ENUM

### Valid Values
```javascript
const STATUS = {
  EMPTY: 'EMPTY',           // Slot kosong, siap terisi
  STORED: 'STORED',         // Box tersimpan normal
  BORROWED: 'BORROWED',     // Box sedang dipinjam
  AUDIT: 'AUDIT',           // Box sedang dalam audit
  IMPORTED: 'IMPORTED'      // Box baru diimport dari Excel
};
```

### Status Flow
```
    ┌─────────────────────────────────────────────┐
    │                                             │
    ↓                                             │
[EMPTY] ──import─→ [IMPORTED] ──status-change─→ [STORED]
                                                    ↕
                                                [BORROWED]
                                                    ↕
                                                [AUDIT]
```

---

## 🔗 RELATIONSHIP MAPPING

### Excel Columns → Database Fields

```
Excel Row Data:
├─ No Slot (1)
│  └─ Maps to: inventory.id
│
├─ No Kardus (BOX-2024-001)
│  ├─ Maps to: inventory.box_id
│  └─ Maps to: box_data.id
│
├─ Status (TERISI)
│  └─ Maps to: inventory.status [CURRENTLY IGNORED, HARDCODED TO 'IMPORTED']
│
└─ Ordner Group
   ├─ No Ordner (ORD-001)
   │  └─ Maps to: ordner.noOrdner
   │
   ├─ Periode (Jan 2024)
   │  └─ Maps to: ordner.period
   │
   └─ Invoice List
      ├─ No Invoice (INV/001)
      │  └─ Maps to: invoice.invoiceNo
      │
      ├─ Vendor (Vendor A)
      │  └─ Maps to: invoice.vendor
      │
      ├─ Tgl Pembayaran (2024-01-31)
      │  └─ Maps to: invoice.paymentDate
      │
      ├─ No Faktur Pajak (010.000-24.00000001)
      │  └─ Maps to: invoice.taxInvoiceNo
      │
      └─ Keterangan Kusus (Catatan)
         └─ Maps to: invoice.specialNote
```

---

## ⚙️ DATABASE OPERATIONS

### INSERT (Saat Import)
```javascript
// Frontend: Update slot dengan box data
await api.updateInventory(slotId, {
  status: 'IMPORTED',
  box_id: 'BOX-2024-001',
  box_data: JSON.stringify({ /* boxData */ }),
  boxData: JSON.stringify({ /* boxData */ }),  // Redundant
  lastUpdated: new Date().toISOString(),
  history: [{ action: 'IMPORTED', ... }]
});

// Backend: Update query
UPDATE inventory 
SET 
  status = 'IMPORTED',
  box_id = 'BOX-2024-001',
  box_data = '{"id":"BOX-2024-001","ordners":[...]}',
  boxData = '{"id":"BOX-2024-001","ordners":[...]}',
  lastUpdated = NOW(),
  history = '[{"action":"IMPORTED",...}]'
WHERE id = 1;
```

### SELECT (Saat Read/Fetch)
```javascript
// Fetch inventory list
const inventory = await knex('inventory').select('*');

// Parse hasil:
inventory.forEach(row => {
  row.boxData = row.box_data ? JSON.parse(row.box_data) : null;
  row.history = row.history ? JSON.parse(row.history) : [];
  // row.boxData sekarang available sebagai JS object
});
```

### UPDATE (Saat Status Change)
```javascript
UPDATE inventory
SET
  status = 'STORED',
  lastUpdated = NOW(),
  history = JSON_ARRAY_APPEND(history, '$', 
    JSON_OBJECT('action', 'STORED', 'timestamp', NOW(), ...))
WHERE id = 1;
```

### DELETE (Saat Reset Slot)
```javascript
UPDATE inventory
SET
  status = 'EMPTY',
  box_id = NULL,
  box_data = NULL,
  boxData = NULL,
  lastUpdated = NOW(),
  history = JSON_ARRAY_APPEND(history, '$', 
    JSON_OBJECT('action', 'RESET', ...))
WHERE id = 1;
```

---

## 🔍 QUERIES YANG SERING DIGUNAKAN

### 1. Get semua box yang tersimpan
```sql
SELECT 
  id, 
  box_id,
  status,
  box_data,
  lastUpdated
FROM inventory
WHERE status IN ('STORED', 'BORROWED', 'AUDIT')
  AND box_id IS NOT NULL
ORDER BY id ASC;
```

### 2. Cek slot kosong
```sql
SELECT id, status
FROM inventory
WHERE status = 'EMPTY'
LIMIT 10;
```

### 3. Cari box berdasarkan ID
```sql
SELECT *
FROM inventory
WHERE box_id = 'BOX-2024-001'
   OR LOWER(box_data) LIKE '%BOX-2024-001%';
```

### 4. Get inventory stats
```sql
SELECT
  COUNT(CASE WHEN status = 'EMPTY' THEN 1 END) as empty_slots,
  COUNT(CASE WHEN status = 'STORED' THEN 1 END) as stored_boxes,
  COUNT(CASE WHEN status = 'BORROWED' THEN 1 END) as borrowed_boxes,
  COUNT(CASE WHEN status = 'AUDIT' THEN 1 END) as audit_boxes,
  COUNT(CASE WHEN status = 'IMPORTED' THEN 1 END) as imported_boxes
FROM inventory;
```

### 5. Timeline perubahan slot
```sql
SELECT 
  id,
  JSON_EXTRACT(history, '$[*].action') as actions,
  JSON_EXTRACT(history, '$[*].timestamp') as timestamps
FROM inventory
WHERE id = 1
ORDER BY lastUpdated DESC;
```

---

## ⚠️ CATATAN PENTING

### Field Redundancy
```
⚠️ ISSUE: Ada 2 field yang sama:
  - box_data (snake_case)
  - boxData (camelCase)

✅ CURRENT: Keduanya disinkronkan saat update
⚠️ RISK: Bisa desync jika update partial

🔄 REKOMENDASI:
  - Standardisasi ke 1 field saja
  - Suggestion: box_data (mengikuti DB convention)
  - Migration: Migrate all boxData references ke box_data
```

### Type Safety
```
⚠️ ISSUE: JSON data tidak strictly validated di DB level

✅ CURRENT: Validasi di aplikasi level (Frontend & Backend)
⚠️ RISK: Invalid JSON bisa masuk jika validation bypass

🔄 REKOMENDASI:
  - Add JSON schema validation di backend
  - Implement database constraint (MySQL 5.7.8+)
```

### Performance
```
⚠️ ISSUE: JSON parsing terjadi di setiap read

✅ CURRENT: No major performance issue (120 slots only)
⚠️ FUTURE: Jika scale ke 1000+ slots, consider:
  - Denormalisasi frequently accessed fields
  - Add calculated columns untuk search
  - Add indexes pada JSON extracted fields
```

---

## 📊 FIELD USAGE STATISTICS

| Field | Used | % | Notes |
|-------|------|---|-------|
| id | 100% | Essential | Always set |
| status | 100% | Essential | Always set |
| box_id | ~80% | High | Set when occupied |
| box_data | ~80% | High | Set when occupied |
| boxData | ~80% | High | Redundant (same as box_data) |
| lastUpdated | ~80% | High | Auto-set on update |
| history | ~80% | High | Auto-append on change |
| rack | <5% | Low | Optional, rarely used |
| shelf | <5% | Low | Optional, rarely used |
| position | <5% | Low | Optional, rarely used |

---

## 🎯 OPTIMIZATION OPPORTUNITIES

### Short-term (Easy wins)
- [ ] Add INDEX on (box_id, status)
- [ ] Add INDEX on (lastUpdated DESC)
- [ ] Remove redundant boxData column

### Medium-term (Worthwhile)
- [ ] Extract frequently-queried fields from JSON
- [ ] Add generated columns for search
- [ ] Implement JSON schema validation

### Long-term (Future-proofing)
- [ ] Normalize ordners & invoices ke separate tables
- [ ] Implement full-text search on JSON content
- [ ] Add audit trail table untuk compliance

---

**Document Version**: 1.0  
**Last Updated**: 28 Maret 2026  
**Verified**: ✅ Current & Accurate
