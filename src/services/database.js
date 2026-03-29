import { apiClient } from './apiClient';
console.log('%c[Database Service] version 1.0.3 loaded', 'color: #4CAF50; font-weight: bold;');
// Gunakan URL absolut jika di lingkungan development (Vite port 3000)
// Gunakan relative path jika di production (Docker/Nginx)
const getApiUrl = () => {
    // Gunakan relative path '/api' untuk memastikan request diperlakukan Same-Origin.
    // Ini mengizinkan HttpOnly cookie dikirim dengan benar di Local Network (IP)
    // mengandalkan konfigurasi `proxy` di vite.config.js dan nginx proxy di Production.
    if (window.location.protocol === 'file:') {
        return 'http://localhost:5005/api'; // Fallback Electron Desktop App
    }
    return '/api';
};
export const API_URL = getApiUrl();

export const db = {
    async getInventory() {
        try {
            const response = await fetch(`${API_URL}/inventory`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Gagal mengambil data');
            const data = await response.json();

            return data.map(slot => {
                const rawBoxData = slot.box_data || slot.boxData || slot.boxdata;
                const rawHistory = slot.history || slot.history_data; // Defensive

                const parsedHistory = typeof rawHistory === 'string' ? JSON.parse(rawHistory) : (rawHistory || []);

                let parsedBoxData = null;
                try {
                    parsedBoxData = typeof rawBoxData === 'string' ? JSON.parse(rawBoxData) : (rawBoxData || null);
                } catch (e) {
                    console.error(`Gagal parse boxData pada slot ${slot.id}:`, e);
                    parsedBoxData = null; // Tandai sebagai null agar UI menampilkan pesan "Rusak"
                }

                return {
                    ...slot,
                    id: Number(slot.id),
                    boxId: slot.box_id || slot.boxId || (parsedBoxData ? parsedBoxData.id : null),
                    status: (slot.status || 'EMPTY').toUpperCase(),
                    boxData: parsedBoxData,
                    history: Array.isArray(parsedHistory) ? parsedHistory : []
                };
            });
        } catch (error) {
            console.error("DB Error (Inventory):", error);
            return [];
        }
    },

    async saveInventory(data) {
        try {
            await fetch(`${API_URL}/inventory`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
        } catch (e) { console.error("Gagal menyimpan inventory", e); }
    },

    async getLogs() {
        try {
            const response = await fetch(`${API_URL}/logs`, {
                credentials: 'include'
            });
            return await response.json();
        } catch { return []; }
    },

    async saveLogs(data) {
        try {
            await fetch(`${API_URL}/logs`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(latestLog)
            });
        } catch (e) { console.error("Gagal menyimpan logs", e); }
    },

    async getDocs() {
        try {
            const response = await fetch(`${API_URL}/documents`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Gagal mengambil data');
            const data = await response.json();
            return (Array.isArray(data) ? data : []).map(doc => {
                const rawVersions = doc.versionsHistory || doc.versions_history;
                return {
                    ...doc,
                    folderId: doc.folderId || doc.folder_id,
                    fileData: doc.fileData || doc.file_data || doc.filedata,
                    ocrContent: doc.ocrContent || doc.ocr_content,
                    status: doc.status || 'completed',
                    versionsHistory: typeof rawVersions === 'string' ? JSON.parse(rawVersions) : (rawVersions || [])
                };
            });
        } catch { return []; }
    },

    async getDocuments(params = {}) {
        try {
            const docQuery = new URLSearchParams(params).toString();
            console.log('[DEBUG] getDocuments called with:', params, 'Generated Query:', docQuery);
            const response = await fetch(`${API_URL}/documents?${docQuery}`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Gagal mengambil dokumen');
            const data = await response.json();
            return data.map(doc => {
                const rawVersions = doc.versionsHistory || doc.versions_history;
                return {
                    ...doc,
                    fileData: doc.fileData || doc.file_data || doc.filedata,
                    ocrContent: doc.ocrContent || doc.ocr_content,
                    versionsHistory: typeof rawVersions === 'string' ? JSON.parse(rawVersions) : (rawVersions || [])
                };
            });
        } catch (e) {
            console.error("DB Error (Documents):", e);
            return [];
        }
    },

    // NEW: Ambil detail dokumen (termasuk fileData) jika di list kosong
    async getDocumentById(id) {
        try {
            const response = await fetch(`${API_URL}/documents/${id}`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Gagal mengambil detail dokumen');
            const doc = await response.json();
            const rawVersions = doc.versionsHistory || doc.versions_history;
            return {
                ...doc,
                folderId: doc.folderId || doc.folder_id,
                fileData: doc.fileData || doc.file_data || doc.filedata,
                versionsHistory: typeof rawVersions === 'string' ? JSON.parse(rawVersions) : (rawVersions || [])
            };
        } catch (e) { console.error(e); return null; }
    },

    async saveDocs(data) {
        try {
            await fetch(`${API_URL}/documents`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
        } catch (e) { console.error("Gagal menyimpan dokumen", e); }

    },

    async getFolders() {
        try {
            const response = await fetch(`${API_URL}/folders`, {
                credentials: 'include'
            });
            return await response.json();
        } catch { return []; }
    },

    async createFolder(folder) {
        try {

            // Sinkronisasi payload ke camelCase sesuai standar database Anda
            const payload = {
                name: folder.name,
                parentId: folder.parentId || folder.parent_id || null,
                privacy: folder.privacy || 'public',
                owner: folder.owner || 'System',
                // PostgreSQL/Knex menangani Array/Object secara langsung tanpa stringify manual
                allowedDepts: Array.isArray(folder.allowedDepts) ? folder.allowedDepts : [],
                allowedUsers: Array.isArray(folder.allowedUsers) ? folder.allowedUsers : []
            };

            const response = await fetch(`${API_URL}/folders`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(await response.text());
            return await response.json();
        } catch (e) { console.error("Gagal membuat folder", e); throw e; }
    },

    async updateFolder(id, data) {
        try {

            // Bersihkan data dari field yang menyebabkan error SQL
            const payload = { ...data };
            if (payload.parent_id) { payload.parentId = payload.parent_id; delete payload.parent_id; }
            // Jangan stringify jika menggunakan PostgreSQL JSONB
            if (payload.allowedDepts && typeof payload.allowedDepts === 'string') payload.allowedDepts = JSON.parse(payload.allowedDepts);
            if (payload.allowedUsers && typeof payload.allowedUsers === 'string') payload.allowedUsers = JSON.parse(payload.allowedUsers);

            // Hapus field timestamp agar tidak bentrok dengan auto-timestamp DB
            delete payload.createdAt;
            delete payload.updatedAt;

            await fetch(`${API_URL}/folders/${id}`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
        } catch (e) { console.error("Gagal update folder", e); }
    },

    async deleteFolder(id) {
        try {
            await fetch(`${API_URL}/folders/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
        } catch (e) { console.error("Gagal hapus folder", e); }
    },

    async getTaxAudits() {
        try {
            return await apiClient.fetchJson(`${API_URL}/tax-audits`);
        } catch (err) {
            console.error("getTaxAudits failed:", err);
            return [];
        }
    },

    async createTaxAudit(data) {
        try {
            const response = await fetch(`${API_URL}/tax-audits`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Gagal membuat audit');
            return await response.json();
        } catch (e) { console.error("Gagal membuat tax audit", e); throw e; }
    },

    async updateTaxAudit(id, data) {
        try {
            const response = await fetch(`${API_URL}/tax-audits/${id}`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Gagal update audit');
        } catch (e) { console.error("Gagal update tax audit", e); throw e; }
    },

    async deleteTaxAudit(id) {
        try {
            const response = await fetch(`${API_URL}/tax-audits/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Gagal hapus audit');
        } catch (e) { console.error("Gagal hapus tax audit", e); throw e; }
    },

    async getTaxSummaries() {
        try {
            const response = await fetch(`${API_URL}/tax-summaries`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Gagal mengambil data');
            const data = await response.json();
            return data.map(item => ({
                ...item,
                id: String(item.id),
                data: typeof item.data === 'string' ? JSON.parse(item.data) : (item.data || {})
            }));
        } catch (error) {
            console.error("DB Error (TaxSummaries):", error);
            return JSON.parse(localStorage.getItem('tax_summaries') || '[]');
        }
    },
    async login(username, password) {
        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }
            return data;
        } catch (e) {
            console.error("Login error:", e);
            throw e;
        }
    },

    async getUsers() {
        try {
            const response = await fetch(`${API_URL}/users`, {
                credentials: 'include'
            });
            return await response.json();
        } catch { return []; }
    },
    async getRoles() {
        try {
            const response = await fetch(`${API_URL}/roles`, {
                credentials: 'include'
            });
            return await response.json();
        } catch { return []; }
    },
    async getDepartments() {
        try {
            const response = await fetch(`${API_URL}/departments`, {
                credentials: 'include'
            });
            return await response.json();
        } catch { return []; }
    },

    async getNotifications() {
        try {
            const response = await fetch(`${API_URL}/notifications`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Gagal mengambil notifikasi');
            return await response.json();
        } catch (e) {
            console.error('Gagal mengambil notifikasi', e);
            return [];
        }
    },

    async markNotificationRead(id) {
        try {
            const response = await fetch(`${API_URL}/notifications/${id}/read`, {
                method: 'POST',
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Gagal menandai notifikasi dibaca');
            return await response.json();
        } catch (e) {
            console.error('Gagal menandai notifikasi', e);
            return { success: false };
        }
    },

    async markAllNotificationsRead() {
        try {
            const response = await fetch(`${API_URL}/notifications/read-all`, {
                method: 'POST',
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Gagal menandai semua notifikasi');
            return await response.json();
        } catch (e) {
            console.error('Gagal menandai semua notifikasi', e);
            return { success: false, marked: 0 };
        }
    },

    async createNotification(data) {
        try {
            const response = await fetch(`${API_URL}/notifications`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || 'Gagal membuat notifikasi');
            }
            return await response.json();
        } catch (e) {
            console.error('Gagal membuat notifikasi', e);
            throw e;
        }
    },

    async createUser(data) {
        try {
            const response = await fetch(`${API_URL}/users`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Gagal membuat user');
            return await response.json();
        } catch (e) { console.error("Gagal membuat user", e); throw e; }
    },

    async updateUser(id, data) {
        try {
            await fetch(`${API_URL}/users/${id}`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
        } catch (e) { console.error("Gagal update user", e); }
    },

    async deleteUser(id) {
        try {
            await fetch(`${API_URL}/users/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
        } catch (e) { console.error("Gagal hapus user", e); }
    },

    async createRole(data) {
        try {
            const response = await fetch(`${API_URL}/roles`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Gagal membuat role');
            return await response.json();
        } catch (e) { console.error("Gagal membuat role", e); throw e; }
    },

    async updateRole(id, data) {
        try {
            await fetch(`${API_URL}/roles/${id}`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
        } catch (e) { console.error("Gagal update role", e); }
    },

    async deleteRole(id) {
        try {
            await fetch(`${API_URL}/roles/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
        } catch (e) { console.error("Gagal hapus role", e); }
    },

    async saveTaxSummary(data) {
        try {
            const isUpdate = !!data.id;
            const url = isUpdate ? `${API_URL}/tax-summaries/${data.id}` : `${API_URL}/tax-summaries`;
            const response = await fetch(url, {
                method: isUpdate ? 'PUT' : 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Gagal menyimpan ke server');
            return await response.json();
        } catch (e) { console.error("Gagal menyimpan tax summary", e); throw e; }
    },

    async deleteTaxSummary(id) {
        try {
            const response = await fetch(`${API_URL}/tax-summaries/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Gagal menghapus data di server');
        } catch (e) { console.error("Gagal hapus tax summary", e); throw e; }
    },

    async createDepartment(name) {
        try {
            const response = await fetch(`${API_URL}/departments`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name })
            });
            if (!response.ok) throw new Error('Gagal membuat dept');
            return await response.json();
        } catch (e) { console.error("Gagal membuat dept", e); throw e; }
    },

    async deleteDepartment(id) {
        try {
            await fetch(`${API_URL}/departments/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
        } catch (e) { console.error("Gagal hapus dept", e); }
    },
    async updateDepartment(id, name) {
        try {
            await fetch(`${API_URL}/departments/${id}`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name })
            });
        } catch (e) { console.error("Gagal update dept", e); }
    },

    // --- MISSING FUNCTIONS ADDED ---

    async uploadAttachmentLocal(formData) {
        try {
            const response = await fetch(`${API_URL}/documents`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });
            if (!response.ok) throw new Error('Gagal unggah lampiran');
            return await response.json();
        } catch (e) {
            console.error('uploadAttachmentLocal Error:', e);
            throw e;
        }
    },

    async createDocument(doc) {
        try {
            let body = doc;
            if (!(doc instanceof FormData)) {
                const formData = new FormData();
                Object.keys(doc).forEach(key => {
                    if (key === 'file' && doc[key] instanceof File) {
                        formData.append('file', doc[key]);
                    } else if (doc[key] !== null && doc[key] !== undefined) {
                        formData.append(key, doc[key]);
                    }
                });
                body = formData;
            }

            const response = await fetch(`${API_URL}/documents`, {
                method: 'POST',
                credentials: 'include',
                body: body
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText || 'Gagal buat dokumen'}`);
            }
            return await response.json();
        } catch (e) {
            console.error("createDocument Error:", e.message || e);
            throw e; // Re-throw so caller can handle
        }
    },

    async updateDocument(id, doc) {
        try {
            let body = doc;
            if (!(doc instanceof FormData)) {
                const formData = new FormData();
                Object.keys(doc).forEach(key => {
                    if (key === 'file' && doc[key] instanceof File) {
                        formData.append('file', doc[key]);
                    } else if (doc[key] !== null && doc[key] !== undefined) {
                        formData.append(key, doc[key]);
                    }
                });
                body = formData;
            }

            await fetch(`${API_URL}/documents/${id}`, {
                method: 'PUT',
                credentials: 'include',
                body: body
            });
        } catch (e) { console.error("Gagal update dokumen", e); }
    },

    async deleteDocument(id) {
        if (!id) {
            console.error("Gagal hapus dokumen: ID tidak valid", id);
            return;
        }
        try {
            await fetch(`${API_URL}/documents/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
        } catch (e) { console.error("Gagal hapus dokumen", e); }
    },

    async createLog(log) {
        try {
            await fetch(`${API_URL}/logs`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(log)
            });
        } catch (e) { console.error("Gagal buat log", e); }
    },

    async updateInventory(id, data) {
        const payload = { ...data };

        delete payload.id;         // Primary Key tidak boleh di-update
        delete payload.lastUpdated; // Biarkan MySQL menangani timestamp otomatis

        console.log(`[DB.updateInventory] Sending PUT for slot ${id}:`, JSON.stringify(payload).slice(0, 200));

        const response = await fetch(`${API_URL}/inventory/${id}`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || `Error ${response.status}`);
        }
    },

    async moveInventory(sourceId, targetId, user) {
        try {
            const response = await fetch(`${API_URL}/inventory/move`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sourceId, targetId, user })
            });

            const text = await response.text();
            let data = null;
            try {
                data = text ? JSON.parse(text) : null;
            } catch (e) {
                console.error("Gagal parse JSON respons:", text);
            }

            if (!response.ok) {
                const errorMsg = data?.error || (text && text.length < 100 ? text : `Server Error ${response.status}`);
                const fullError = data?.details ? `${errorMsg}: ${JSON.stringify(data.details)}` : errorMsg;
                console.error('[moveInventory] Error response:', { status: response.status, error: errorMsg, details: data?.details });
                throw new Error(fullError);
            }
            return data;
        } catch (e) { throw e; }
    },

    async createExternalItem(item) {
        try {
            const response = await fetch(`${API_URL}/inventory/external`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(item)
            });
            if (!response.ok) throw new Error('Gagal membuat external item');
            return await response.json();
        } catch (e) { console.error("Gagal buat external item", e); throw e; }
    },

    async getExternalItems() {
        try {
            const response = await fetch(`${API_URL}/inventory/external`, {
                credentials: 'include'
            });
            const data = await response.json();
            return data.map(item => ({
                ...item,
                boxData: typeof item.boxData === 'string' ? JSON.parse(item.boxData) : (item.boxData || {}),
                history: typeof item.history === 'string' ? JSON.parse(item.history) : (item.history || [])
            }));
        } catch (e) {
            console.error("Gagal mengambil external items", e);
            return [];
        }
    },

    async deleteExternalItem(id) {
        try {
            await fetch(`${API_URL}/inventory/external/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
        } catch (e) { console.error("Gagal hapus external item", e); }
    },

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const response = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });
            if (!response.ok) throw new Error('Upload failed');
            return await response.json();
        } catch (e) {
            console.error("Upload error:", e);
            throw e;
        }
    },

    async restoreDocumentVersion(id, versionTimestamp) {
        try {
            const response = await fetch(`${API_URL}/documents/${id}/restore`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    timestamp: versionTimestamp,
                    user: localStorage.getItem('currentUser') ? JSON.parse(localStorage.getItem('currentUser')).username : 'System'
                })
            });
            if (!response.ok) throw new Error('Gagal restore versi');
            return await response.json();
        } catch (e) {
            console.error("restoreDocumentVersion Error:", e);
            throw e;
        }
    },

    async copyDocument(id, targetFolderId, owner) {
        try {
            const response = await fetch(`${API_URL}/documents/copy`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id, targetFolderId, owner })
            });
            if (!response.ok) throw new Error('Gagal menyalin dokumen');
            return await response.json();
        } catch (e) {
            console.error("copyDocument Error:", e);
            throw e;
        }
    },

    async moveDocument(id, targetFolderId, owner) {
        try {
            const response = await fetch(`${API_URL}/documents/move`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id, targetFolderId, owner })
            });
            if (!response.ok) throw new Error('Gagal memindahkan dokumen');
            return await response.json();
        } catch (e) {
            console.error("moveDocument Error:", e);
            throw e;
        }
    },

    async copyFolder(id, targetParentId) {
        try {
            const response = await fetch(`${API_URL}/folders/copy`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id, targetParentId })
            });
            if (!response.ok) throw new Error('Gagal menyalin folder');
            return await response.json();
        } catch (e) {
            console.error("copyFolder Error:", e);
            throw e;
        }
    },

    async moveFolder(id, targetParentId) {
        try {
            const response = await fetch(`${API_URL}/folders/move`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id, targetParentId })
            });
            if (!response.ok) throw new Error('Gagal memindahkan folder');
            return await response.json();
        } catch (e) {
            console.error("moveFolder Error:", e);
            throw e;
        }
    },

    async getComments(docId) {
        try {
            const response = await fetch(`${API_URL}/documents/${docId}/comments`, {
                credentials: 'include'
            });
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        } catch { return []; }
    },

    async addComment(docId, formData) {
        try {
            const response = await fetch(`${API_URL}/documents/${docId}/comments`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || `Server Error ${response.status}`);
            }
            return result;
        } catch (e) { console.error("addComment Error:", e); return { success: false, error: e.message }; }
    },

    async promoteCommentAttachment(docId, commentId) {
        try {
            const response = await fetch(`${API_URL}/documents/${docId}/promote-comment-attachment`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ commentId })
            });
            return await response.json();
        } catch (e) { console.error(e); return { success: false }; }
    },

    async getAuditNotes(auditId, stepIndex) {
        try {
            const response = await fetch(`${API_URL}/tax-audits/${auditId}/steps/${stepIndex}/notes`, {
                credentials: 'include'
            });
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        } catch { return []; }
    },

    async addAuditNote(auditId, stepIndex, formData) {
        try {
            const response = await fetch(`${API_URL}/tax-audits/${auditId}/steps/${stepIndex}/notes`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            const text = await response.text();
            let result;
            try {
                result = JSON.parse(text);
            } catch {
                result = { error: text || response.statusText };
            }

            if (!response.ok) {
                throw new Error(result.error || `Server Error ${response.status}`);
            }
            return result;
        } catch (e) { console.error("addAuditNote Error:", e); return { success: false, error: e.message }; }
    },

    // --- DOCUMENT APPROVALS ---
    async getApprovals() {
        try {
            const response = await fetch(`${API_URL}/approvals`, {
                credentials: 'include'
            });
            if (!response.ok) return [];
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        } catch { return []; }
    },

    async createApproval(data) {
        try {
            const response = await fetch(`${API_URL}/approvals`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch (e) { console.error(e); return { success: false }; }
    },

    async updateApproval(id, data) {
        try {
            const response = await fetch(`${API_URL}/approvals/${id}`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch (e) { console.error(e); return { success: false }; }
    },

    async submitApprovalAction(id, data) {
        try {
            const isFormData = data instanceof FormData;
            const response = await fetch(`${API_URL}/approvals/${id}/action`, {
                method: 'POST',
                credentials: 'include',
                headers: isFormData ? {} : {
                    'Content-Type': 'application/json'
                },
                body: isFormData ? data : JSON.stringify(data)
            });
            return await response.json();
        } catch (e) { console.error(e); return { success: false }; }
    },

    async resetApprovalStep(id, stepIndex) {
        try {
            const response = await fetch(`${API_URL}/approvals/${id}/reset-step`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ stepIndex })
            });
            return await response.json();
        } catch (e) { console.error(e); return { success: false }; }
    },

    async deleteApproval(id) {
        try {
            await fetch(`${API_URL}/approvals/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
        } catch (e) { console.error(e); }
    },

    // --- APPROVAL FLOWS (MASTER) ---
    async getApprovalFlows() {
        try {
            const response = await fetch(`${API_URL}/approval-flows`, {
                credentials: 'include'
            });
            if (!response.ok) return [];
            const data = await response.json();
            return data.map(flow => ({
                ...flow,
                steps: typeof flow.steps === 'string' ? JSON.parse(flow.steps) : (flow.steps || []),
                visual_config: typeof flow.visual_config === 'string' ? JSON.parse(flow.visual_config) : (flow.visual_config || null)
            }));
        } catch { return []; }
    },

    async createApprovalFlow(data) {
        try {
            const response = await fetch(`${API_URL}/approval-flows`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch (e) { console.error(e); return { success: false }; }
    },

    async updateApprovalFlow(id, data) {
        try {
            const response = await fetch(`${API_URL}/approval-flows/${id}`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch (e) { console.error(e); return { success: false }; }
    },

    async deleteApprovalFlow(id) {
        try {
            await fetch(`${API_URL}/approval-flows/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
        } catch (e) { console.error(e); }
    },

    // --- PUSTAKA ---
    async getPustakaGuides() {
        try {
            const response = await fetch(`${API_URL}/pustaka/guides`, {
                credentials: 'include'
            });
            if (!response.ok) return [];
            return await response.json();
        } catch { return []; }
    },

    async getGuideSlides(guideId) {
        try {
            const response = await fetch(`${API_URL}/pustaka/guides/${guideId}/slides`, {
                credentials: 'include'
            });
            if (!response.ok) return [];
            return await response.json();
        } catch { return []; }
    },

    async createPustakaGuide(data) {
        try {
            const response = await fetch(`${API_URL}/pustaka/guides`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Gagal membuat panduan');
            return result;
        } catch (e) { console.error("createPustakaGuide Error:", e); throw e; }
    },

    async createPustakaSlide(data) {
        try {
            const response = await fetch(`${API_URL}/pustaka/slides`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Gagal membuat slide');
            return result;
        } catch (e) { console.error("createPustakaSlide Error:", e); throw e; }
    },

    async updatePustakaGuide(id, data) {
        try {
            const response = await fetch(`${API_URL}/pustaka/guides/${id}`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Gagal update panduan');
            return result;
        } catch (e) { console.error("updatePustakaGuide Error:", e); throw e; }
    },

    async deletePustakaGuide(id) {
        try {
            const response = await fetch(`${API_URL}/pustaka/guides/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Gagal menghapus panduan');
            return result;
        } catch (e) { console.error("deletePustakaGuide Error:", e); throw e; }
    },

    async deleteSlidesByGuideId(guideId) {
        try {
            const response = await fetch(`${API_URL}/pustaka/slides/by-guide/${guideId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            return await response.json();
        } catch (e) { console.error(e); return { success: false }; }
    },

    async getPustakaCategories() {
        try {
            const response = await fetch(`${API_URL}/pustaka/categories`, {
                credentials: 'include'
            });
            if (!response.ok) return [];
            return await response.json();
        } catch { return []; }
    },

    async searchPustaka(query) {
        try {
            const response = await fetch(`${API_URL}/pustaka/search?q=${encodeURIComponent(query)}`, {
                credentials: 'include'
            });
            if (!response.ok) return [];
            return await response.json();
        } catch { return []; }
    },

    async createPustakaCategory(name) {
        try {
            const response = await fetch(`${API_URL}/pustaka/categories`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Gagal membuat kategori');
            return result;
        } catch (e) { console.error("createPustakaCategory Error:", e); throw e; }
    },

    // --- NORMALIZED QUERY ENDPOINTS ---
    async getInvoices(params = {}) {
        try {
            const query = new URLSearchParams(params).toString();
            const response = await fetch(`${API_URL}/invoices?${query}`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Gagal mengambil data invoice');
            return await response.json();
        } catch (e) {
            console.error("getInvoices Error:", e);
            return [];
        }
    },

    async getInvoiceStats() {
        try {
            const response = await fetch(`${API_URL}/stats/invoices`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Gagal mengambil statistik invoice');
            return await response.json();
        } catch (e) {
            console.error("getInvoiceStats Error:", e);
            return { total_invoices: 0, total_boxes: 0, total_ordners: 0, top_vendors: [], by_period: [] };
        }
    },

    // --- TAX CALCULATION & WP DATABASE ---
    async getTaxObjects() {
        const response = await fetch(`${API_URL}/tax/objects?cb=${Date.now()}`, {
            credentials: 'include'
        });
        const data = await response.json();
        const list = Array.isArray(data) ? data : (data?.data || []);
        return list.map(item => ({
            ...item,
            taxType: item.tax_type || item.taxType,
            taxObjectCode: item.tax_object_code || item.taxObjectCode,
            taxObjectName: item.tax_object_name || item.taxObjectName,
        }));
    },

    async createTaxObject(data) {
        const response = await fetch(`${API_URL}/tax/objects`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await response.json();
    },

    async updateTaxObject(id, data) {
        const response = await fetch(`${API_URL}/tax/objects/${id}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await response.json();
    },

    async deleteTaxObject(id) {
        const response = await fetch(`${API_URL}/tax/objects/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        return await response.json();
    },

    async getWpDatabase() {
        const response = await fetch(`${API_URL}/tax/wp?cb=${Date.now()}`, {
            credentials: 'include'
        });
        if (!response.ok) return [];
        const data = await response.json();
        const list = Array.isArray(data) ? data : (data && Array.isArray(data.data) ? data.data : []);

        return list.filter(Boolean).map(item => ({
            ...item,
            name: item.name || item.wp_name || item.wpName || item.nama_wp || '',
            idType: item.id_type || item.idType || 'NPWP',
            identityNumber: String(item.identity_number || item.identityNumber || item.npwp || item.nik || ''),
            taxType: item.tax_type || item.taxType || '23',
            taxObjectCode: item.tax_object_code || item.taxObjectCode || item.code || item.kode_objek || '',
            taxObjectName: item.tax_object_name || item.taxObjectName || item.nama_objek || '',
            markupMode: item.markup_mode || item.markupMode,
            isPph21BukanPegawai: !!(item.is_pph21_bukan_pegawai || item.isPph21BukanPegawai),
            usePpn: item.use_ppn !== undefined ? !!item.use_ppn : (item.usePpn !== undefined ? !!item.usePpn : true)
        }));
    },

    async saveWpData(data, id) {
        const url = id ? `${API_URL}/tax/wp/${id}` : `${API_URL}/tax/wp`;
        const response = await fetch(url, {
            method: id ? 'PUT' : 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: data.name,
                id_type: data.idType || 'NPWP',
                identity_number: String(data.identityNumber || ''),
                email: data.email || null,
                tax_type: data.taxType,
                tax_object_code: data.taxObjectCode,
                tax_object_name: data.taxObjectName,
                markup_mode: data.markupMode || 'none',
                is_pph21_bukan_pegawai: !!data.isPph21BukanPegawai,
                use_ppn: data.usePpn !== undefined ? !!data.usePpn : true,
                dpp: parseFloat(data.dpp || 0),
                discount: parseFloat(data.discount || 0),
                dpp_net: parseFloat(data.dppNet || 0),
                pph: parseFloat(data.pph || 0),
                ppn: parseFloat(data.ppn || 0),
                total_payable: parseFloat(data.totalPayable || 0)
            })
        });
        if (!response.ok) throw new Error('Gagal menyimpan data WP');
        return await response.json();
    },

    async deleteWpData(id) {
        await fetch(`${API_URL}/tax/wp/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
    },

    async importWpExcel(file) {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch(`${API_URL}/tax/wp/import`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Server Error: ${response.status}`);
        }
        return await response.json();
    },

    async importMasterExcel(file) {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch(`${API_URL}/tax/objects/import`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Gagal import master data');
        }
        return await response.json();
    },

    async chatWithAi(message, history = []) {
        const response = await fetch(`${API_URL}/search/chat`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message, history })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Server Error: ${response.status}`);
        }
        return await response.json();
    }
};
