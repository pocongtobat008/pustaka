import { apiClient, API_URL } from './apiClient';

export const invoiceService = {
    // ── Invoices ──
    async getAll(params = {}) {
        const query = new URLSearchParams(params).toString();
        return apiClient.fetchJson(`${API_URL}/invoices${query ? '?' + query : ''}`);
    },

    async getById(id) {
        return apiClient.fetchJson(`${API_URL}/invoices/${id}`);
    },

    async create(data) {
        const response = await fetch(`${API_URL}/invoices`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            const details = Array.isArray(err.details) ? err.details.join('; ') : '';
            throw new Error(details ? `${err.error || 'Gagal membuat invoice'}: ${details}` : (err.error || 'Gagal membuat invoice'));
        }
        return response.json();
    },

    async delete(id) {
        return apiClient.fetchJson(`${API_URL}/invoices/${id}`, { method: 'DELETE' });
    },

    async update(id, data) {
        const response = await fetch(`${API_URL}/invoices/${id}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            const details = Array.isArray(err.details) ? err.details.join('; ') : '';
            throw new Error(details ? `${err.error || 'Gagal update invoice'}: ${details}` : (err.error || 'Gagal update invoice'));
        }
        return response.json();
    },

    // ── Master Dealer ──
    async getDealers() {
        return apiClient.fetchJson(`${API_URL}/invoices/masters/dealers`);
    },

    async createDealer(data) {
        return apiClient.fetchJson(`${API_URL}/invoices/masters/dealers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async updateDealer(id, data) {
        return apiClient.fetchJson(`${API_URL}/invoices/masters/dealers/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async deleteDealer(id) {
        return apiClient.fetchJson(`${API_URL}/invoices/masters/dealers/${id}`, { method: 'DELETE' });
    },

    async downloadDealerTemplate() {
        const response = await fetch(`${API_URL}/invoices/masters/dealers/template`, { credentials: 'include' });
        if (!response.ok) throw new Error('Gagal download template');
        const blob = await response.blob();
        const urlObj = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlObj;
        a.download = 'template_master_dealer.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(urlObj);
    },

    async importDealers(file) {
        const fd = new FormData();
        fd.append('file', file);
        const response = await fetch(`${API_URL}/invoices/masters/dealers/import`, {
            method: 'POST',
            credentials: 'include',
            body: fd
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Gagal import dealer');
        }
        return response.json();
    },

    // ── Master Barang ──
    async getBarang() {
        return apiClient.fetchJson(`${API_URL}/invoices/masters/barang`);
    },

    async createBarang(data) {
        return apiClient.fetchJson(`${API_URL}/invoices/masters/barang`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async updateBarang(id, data) {
        return apiClient.fetchJson(`${API_URL}/invoices/masters/barang/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async deleteBarang(id) {
        return apiClient.fetchJson(`${API_URL}/invoices/masters/barang/${id}`, { method: 'DELETE' });
    },

    async downloadBarangTemplate() {
        const response = await fetch(`${API_URL}/invoices/masters/barang/template`, { credentials: 'include' });
        if (!response.ok) throw new Error('Gagal download template');
        const blob = await response.blob();
        const urlObj = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlObj;
        a.download = 'template_master_barang.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(urlObj);
    },

    async importBarang(file) {
        const fd = new FormData();
        fd.append('file', file);
        const response = await fetch(`${API_URL}/invoices/masters/barang/import`, {
            method: 'POST',
            credentials: 'include',
            body: fd
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Gagal import barang');
        }
        return response.json();
    },

    // ── Proforma Flow ──
    async submitProforma(formData) {
        const response = await fetch(`${API_URL}/invoices/proforma`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Gagal mengajukan proforma');
        }
        return response.json();
    },

    async getProformas() {
        return apiClient.fetchJson(`${API_URL}/invoices/proforma/list`);
    },

    async addProformaAttachments(id, formData) {
        const response = await fetch(`${API_URL}/invoices/proforma/${id}/attachments`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Gagal menambah lampiran');
        }
        return response.json();
    },

    async approveProforma(id) {
        return apiClient.fetchJson(`${API_URL}/invoices/proforma/${id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
    },

    async rejectProforma(id, notes) {
        return apiClient.fetchJson(`${API_URL}/invoices/proforma/${id}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes })
        });
    },

    async settleProforma(id, data) {
        const response = await fetch(`${API_URL}/invoices/proforma/${id}/settle`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            const details = Array.isArray(err.details) ? err.details.join('; ') : '';
            throw new Error(details ? `${err.error || 'Gagal settle'}: ${details}` : (err.error || 'Gagal settle'));
        }
        return response.json();
    },

    // ── Rules ──
    async getRules() {
        return apiClient.fetchJson(`${API_URL}/invoices/rules`);
    },

    async createRule(data) {
        return apiClient.fetchJson(`${API_URL}/invoices/rules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async updateRule(id, data) {
        return apiClient.fetchJson(`${API_URL}/invoices/rules/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async deleteRule(id) {
        return apiClient.fetchJson(`${API_URL}/invoices/rules/${id}`, { method: 'DELETE' });
    },

    async getPermissions() {
        return apiClient.fetchJson(`${API_URL}/invoices/rules/permissions`);
    },

    // ── Tax Invoice ──
    async submitTax(id, formData) {
        const response = await fetch(`${API_URL}/invoices/${id}/tax`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Gagal simpan faktur pajak');
        }
        return response.json();
    },

    async submitTaxRequest(id) {
        return apiClient.fetchJson(`${API_URL}/invoices/${id}/submit-tax`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
    },

    // ── PDF ──
    async exportPdf(id) {
        const response = await fetch(`${API_URL}/invoices/${id}/pdf`, { credentials: 'include' });
        if (!response.ok) throw new Error('Gagal export PDF');
        const blob = await response.blob();
        const urlObj = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlObj;
        a.download = `proforma_invoice_${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(urlObj);
    }
};
