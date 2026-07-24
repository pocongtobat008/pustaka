import { apiClient, API_URL } from './apiClient';

export const entertainmentService = {
    async getAll(params = {}) {
        const query = new URLSearchParams(params).toString();
        return apiClient.fetchJson(`${API_URL}/entertainment${query ? '?' + query : ''}`);
    },

    async getById(id) {
        return apiClient.fetchJson(`${API_URL}/entertainment/${id}`);
    },

    async create(formData) {
        const response = await fetch(`${API_URL}/entertainment`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            const details = Array.isArray(err.details) ? err.details.join('; ') : '';
            throw new Error(details ? `${err.error || 'Gagal membuat data'}: ${details}` : (err.error || 'Gagal membuat data'));
        }
        return response.json();
    },

    async update(id, formData) {
        const response = await fetch(`${API_URL}/entertainment/${id}`, {
            method: 'PUT',
            credentials: 'include',
            body: formData
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            const details = Array.isArray(err.details) ? err.details.join('; ') : '';
            throw new Error(details ? `${err.error || 'Gagal mengupdate data'}: ${details}` : (err.error || 'Gagal mengupdate data'));
        }
        return response.json();
    },

    async delete(id) {
        return apiClient.fetchJson(`${API_URL}/entertainment/${id}`, { method: 'DELETE' });
    },

    async uploadFiles(files) {
        const formData = new FormData();
        files.forEach(f => formData.append('files', f));
        const response = await fetch(`${API_URL}/entertainment/upload`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        if (!response.ok) throw new Error('Upload gagal');
        return response.json();
    },

    async exportPdf(id) {
        const url = id ? `${API_URL}/entertainment/export/pdf?id=${id}` : `${API_URL}/entertainment/export/pdf`;
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) throw new Error('Gagal export PDF');
        const blob = await response.blob();
        const urlObj = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlObj;
        a.download = `entertainment_expenses_${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(urlObj);
    },

    async exportExcel(id) {
        const url = id ? `${API_URL}/entertainment/export/excel?id=${id}` : `${API_URL}/entertainment/export/excel`;
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) throw new Error('Gagal export Excel');
        const blob = await response.blob();
        const urlObj = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlObj;
        a.download = `entertainment_expenses_${Date.now()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(urlObj);
    },

    async settle(id, formData) {
        const response = await fetch(`${API_URL}/entertainment/${id}/settle`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Gagal settle');
        }
        return response.json();
    },

    async getRules() {
        return apiClient.fetchJson(`${API_URL}/entertainment/rules`);
    },

    async createRule(data) {
        const response = await fetch(`${API_URL}/entertainment/rules`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Gagal membuat rule');
        }
        return response.json();
    },

    async updateRule(id, data) {
        const response = await fetch(`${API_URL}/entertainment/rules/${id}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Gagal update rule');
        }
        return response.json();
    },

    async deleteRule(id) {
        return apiClient.fetchJson(`${API_URL}/entertainment/rules/${id}`, { method: 'DELETE' });
    },

    async getPermissions() {
        return apiClient.fetchJson(`${API_URL}/entertainment/rules/permissions`);
    }
};
