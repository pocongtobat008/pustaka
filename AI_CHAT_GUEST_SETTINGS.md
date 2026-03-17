# AI Chat Assistant - Pengaturan Visibility untuk Guest & Viewer

## 📋 Ringkasan

Fitur **AI Chat Assistant** kini dapat diatur visibilitasnya melalui sistem **Role-Based Access Control (RBAC)**. Administrator dapat mengontrol apakah pengguna guest, viewer, atau role lain dapat mengakses AI Chat Assistant.

## 🎯 Cara Mengatur Visibility

### 1. **Buka Master Data - Role Management**
   - Login sebagai **Admin**
   - Buka menu **Master Data** di sidebar
   - Pilih tab **Role Management** / **Kelola Role**

### 2. **Pilih atau Buat Role**
   Anda dapat:
   - **Edit role existing** (misalnya: Guest, Viewer, Staff)
   - **Buat role baru** dengan nama custom

### 3. **Cari Module "AI Chat Assistant"**
   Dalam tabel permissions yang muncul, cari baris dengan label **"AI Chat Assistant"**

### 4. **Atur Permissions**
   - **View**: Checklist ini untuk mengaktifkan AI Chat Assistant
   - **Create/Edit/Delete**: Tidak perlu (read-only module)

   ```
   Module: "AI Chat Assistant" 
   ├─ View    ☑️ (Dicentang = visible)
   ├─ Create  ☐ (Optional - tidak digunakan)
   ├─ Edit    ☐ (Optional - tidak digunakan)
   └─ Delete  ☐ (Optional - tidak digunakan)
   ```

### 5. **Simpan**
   - Klik tombol **"Simpan Role & Izin"** ("Save Role & Permissions")
   - Perubahan berlaku langsung untuk pengguna dengan role tersebut

## 🔐 Role Default & Rekomendasi

| Role | AI Chat | Rekomendasi | Alasan |
|------|---------|------------|--------|
| **Admin** | ✅ Always | Harus selalu aktif | Admin perlu akses penuh |
| **Staff** | ✅ Recommended | Aktifkan | Staff sering butuh analytics |
| **Viewer/Guest** | ⚙️ Configurable | Sesuaikan kebutuhan | Tamu mungkin tidak perlu akses |
| **Custom Roles** | ⚙️ Configurable | Sesuaikan case per case | Fleksibel sesuai org structure |

## 📊 Contoh Skenario Penggunan

### Skenario 1: Semua Pengguna Bisa Akses AI Chat
```
Guest Role       → AI Chat Assistant: View ✅
Viewer Role      → AI Chat Assistant: View ✅
Staff Role       → AI Chat Assistant: View ✅
Admin Role       → AI Chat Assistant: View ✅ (Default)
```

### Skenario 2: Hanya Admin & Staff yang Akses
```
Guest Role       → AI Chat Assistant: View ❌
Viewer Role      → AI Chat Assistant: View ❌
Staff Role       → AI Chat Assistant: View ✅
Admin Role       → AI Chat Assistant: View ✅ (Default)
```

### Skenario 3: Akses Terbatas per Departemen
Buat role spesifik:
```
Finance_Staff    → AI Chat Assistant: View ✅
HR_Viewer        → AI Chat Assistant: View ❌
IT_Admin         → AI Chat Assistant: View ✅
Operations_Guest → AI Chat Assistant: View ⚙️ (Tanyakan PM)
```

## 🛠️ Implementasi Teknis

### Backend (Permission Check)
```javascript
// File: src/utils/permissions.js
export const APP_MODULES = {
    ...
    'ai-chat': { id: 'ai-chat', label: 'AI Chat Assistant' }
};

export const checkPermission = (currentUser, roles, moduleId, action) => {
    // Mengecek apakah user memiliki permission 'view' untuk 'ai-chat' module
    // Jika tidak ada permission, AI Chat Assistant tidak ditampilkan
}
```

### Frontend (Conditional Rendering)
```javascript
// File: src/App.jsx
{currentUser && activeTab !== 'pustaka' && 
 checkPermission(currentUser, roles, 'ai-chat', 'view') && (
    <AiChatAssistant {...props} />
)}
```

### Role Database Schema
Permissions disimpan di database dalam format:
```json
{
  "dashboard": ["view"],
  "inventory": ["view", "create", "edit"],
  "ai-chat": ["view"],  // New module
  ...
}
```

## ⚡ Fitur Default

- **Admin**: Selalu memiliki akses ke semua module termasuk 'ai-chat' (hard-coded)
- **Non-Admin Roles**: Tergantung pengaturan role permissions
- **Guest Users** (role: 'viewer'): Harus dikonfigurasi eksplisit untuk akses

## 🔄 Perubahan Berlaku Kapan?

- **Langsung**: Pengguna baru yang login setelah perubahan role akan langsung mendapatkan permission terbaru
- **Session Aktif**: Pengguna dengan session aktif perlu refresh browser atau login ulang
- **No Cache Issues**: Permissions di-check real-time dari state & database

## 📝 Logging & Audit

Setiap perubahan role permissions dicatat dalam:
- **Database**: Table `roles` column `access`
- **Logs**: File `server/logs/` (jika enabled)
- **Monitoring**: Bisa dilihat di audit trail (jika ada)

## ❓ FAQ

**Q: Bisakah guest user mengakses AI Chat?**
A: Ya, jika admin mengaktifkan permission 'AI Chat Assistant' → 'View' untuk role 'guest/viewer'.

**Q: Apa yang terjadi kalau user tidak punya permission?**
A: AI Chat Assistant button tidak akan muncul di UI.

**Q: Apakah AI Chat berfungsi offline?**
A: Tidak, memerlukan koneksi ke backend untuk analisis data pajak.

**Q: Berapa menit setup ini?**
A: ±2-3 menit di Master Data → Role Management → Centang checkbox → Simpan.

---

## 📦 Files Modified

- ✅ `/src/utils/permissions.js` - Added 'ai-chat' module
- ✅ `/src/App.jsx` - Added permission check for AI Chat Assistant rendering
- ✅ `/src/components/modals/MasterDataModals.jsx` - Automatically shows 'ai-chat' in permission matrix

## 🚀 Next Steps

1. Login sebagai Admin
2. Buka Master Data → Role Management
3. Cari "AI Chat Assistant" di listing modul
4. Atur permissions sesuai kebijakan organisasi
5. Klik "Simpan Role & Izin"
6. Test dengan user dari berbagai role

---

**Last Updated**: March 17, 2026  
**Status**: ✅ Production Ready
