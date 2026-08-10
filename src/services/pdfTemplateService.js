import { apiClient, API_URL } from './apiClient';

export const pdfTemplateService = {
    async getAll() {
        return apiClient.fetchJson(`${API_URL}/pdf-templates`);
    },

    async getSample(docType = 'proforma') {
        return apiClient.fetchJson(`${API_URL}/pdf-templates/sample?doc_type=${docType}`);
    },

    async getRecentInvoices() {
        return apiClient.fetchJson(`${API_URL}/pdf-templates/recent-invoices`);
    },

    async create(data) {
        const response = await fetch(`${API_URL}/pdf-templates`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Gagal membuat template');
        }
        return response.json();
    },

    async update(id, data) {
        const response = await fetch(`${API_URL}/pdf-templates/${id}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Gagal update template');
        }
        return response.json();
    },

    async activate(id) {
        return apiClient.fetchJson(`${API_URL}/pdf-templates/${id}/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
    },

    async remove(id) {
        return apiClient.fetchJson(`${API_URL}/pdf-templates/${id}`, { method: 'DELETE' });
    },

    previewUrl() {
        return `${API_URL}/pdf-templates/test`;
    },

    previewRealDataUrl(invoiceId, docType = 'proforma') {
        return `${API_URL}/pdf-templates/preview/${invoiceId}?doc_type=${docType}`;
    },

    exportRealDataUrl(invoiceId) {
        return `${API_URL}/invoices/${invoiceId}/pdf`;
    },

    async testRender({ html, css, context }) {
        const response = await fetch(`${API_URL}/pdf-templates/test`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html, css, context })
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Gagal render test');
        }
        return response.blob();
    },

    async testRenderReal({ html, css, invoiceId }) {
        const response = await fetch(`${API_URL}/pdf-templates/test/${invoiceId}`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html, css })
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Gagal render test data asli');
        }
        return response.blob();
    },

    async openTestPdf({ html, css, context }) {
        const blob = await this.testRender({ html, css, context });
        const urlObj = window.URL.createObjectURL(blob);
        window.open(urlObj, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(urlObj), 30000);
    },

    async openTestPdfReal({ html, css, invoiceId }) {
        const blob = await this.testRenderReal({ html, css, invoiceId });
        const urlObj = window.URL.createObjectURL(blob);
        window.open(urlObj, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(urlObj), 30000);
    }
};
