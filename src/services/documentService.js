import { API_URL } from './database';

export const documentService = {
    async getDocuments(params) {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${API_URL}/documents?${query}`, {
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Gagal mengambil dokumen');
        return res.json();
    },
    async getDocumentById(id) {
        const res = await fetch(`${API_URL}/documents/${id}`, {
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Gagal mengambil detail dokumen');
        return res.json();
    },
    async createDocument(payload) {
        const formData = new FormData();
        Object.keys(payload).forEach(key => {
            if (key === 'file' && payload[key]) formData.append('file', payload[key]);
            else formData.append(key, payload[key]);
        });
        const res = await fetch(`${API_URL}/documents`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        if (!res.ok) throw new Error('Gagal membuat dokumen');
        return res.json();
    },
    async updateDocument(id, payload) {
        const formData = new FormData();
        Object.keys(payload).forEach(key => {
            if (key === 'file' && payload[key]) formData.append('file', payload[key]);
            else formData.append(key, payload[key]);
        });
        const res = await fetch(`${API_URL}/documents/${id}`, {
            method: 'PUT',
            credentials: 'include',
            body: formData
        });
        if (!res.ok) throw new Error('Gagal memperbarui dokumen');
        return res.json();
    },
    async deleteDocument(id) {
        const res = await fetch(`${API_URL}/documents/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Gagal menghapus dokumen');
        return res.json();
    },
    async getFolders() {
        const res = await fetch(`${API_URL}/folders`, {
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Gagal mengambil folder');
        return res.json();
    },
    async createFolder(payload) {
        const res = await fetch(`${API_URL}/folders`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Gagal membuat folder');
        return res.json();
    },
    async updateFolder(id, payload) {
        const res = await fetch(`${API_URL}/folders/${id}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Gagal memperbarui folder');
        return res.json();
    },
    async deleteFolder(id) {
        const res = await fetch(`${API_URL}/folders/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Gagal menghapus folder');
        return res.json();
    }
};