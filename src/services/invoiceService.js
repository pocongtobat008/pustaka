import { apiClient, API_URL } from './apiClient';

const parseApiError = async (response, fallback) => {
    try {
        const err = await response.json();
        const details = Array.isArray(err.details) ? err.details.join('; ') : (err.details || '');
        return details ? `${err.error || fallback}: ${details}` : (err.error || fallback);
    } catch {
        return `${fallback} (HTTP ${response.status})`;
    }
};

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

    // Hapus proforma beserta seluruh invoice di dalamnya (hanya admin)
    async deleteProforma(id) {
        return apiClient.fetchJson(`${API_URL}/invoices/proforma/${id}`, { method: 'DELETE' });
    },

    async cancel(id) {
        const response = await fetch(`${API_URL}/invoices/${id}/cancel`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Gagal membatalkan invoice');
        }
        return response.json();
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

    async getSettleDraft(id) {
        return apiClient.fetchJson(`${API_URL}/invoices/proforma/${id}/settle/draft`);
    },

    async getSettledInvoices(proformaId) {
        return apiClient.fetchJson(`${API_URL}/invoices/proforma/${proformaId}/settled`);
    },

    async getSettleDrafts() {
        return apiClient.fetchJson(`${API_URL}/invoices/proforma/settle/drafts`);
    },

    async saveSettleDraft(id, data) {
        const response = await fetch(`${API_URL}/invoices/proforma/${id}/settle/draft`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Gagal menyimpan draft');
        }
        return response.json();
    },

    async clearSettleDraft(id) {
        return apiClient.fetchJson(`${API_URL}/invoices/proforma/${id}/settle/draft`, { method: 'DELETE' });
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

    async submitTaxRequest(id, formData) {
        const response = await fetch(`${API_URL}/invoices/${id}/submit-tax`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            const details = Array.isArray(err.details) ? err.details.join('; ') : '';
            throw new Error(details ? `${err.error || 'Gagal mengajukan tax'}: ${details}` : (err.error || 'Gagal mengajukan tax'));
        }
        return response.json();
    },

    async sendbackTax(id, notes) {
        return apiClient.fetchJson(`${API_URL}/invoices/${id}/tax/sendback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes })
        });
    },

    async duplicateForInput(id) {
        return apiClient.fetchJson(`${API_URL}/invoices/${id}/duplicate-input`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
    },

    async rejectTax(id, notes) {
        return apiClient.fetchJson(`${API_URL}/invoices/${id}/tax/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes })
        });
    },

    async sendbackProforma(id, notes) {
        return apiClient.fetchJson(`${API_URL}/invoices/proforma/${id}/sendback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes })
        });
    },

    // ── PDF ──
    async notifyProforma(id) {
        return apiClient.fetchJson(`${API_URL}/invoices/proforma/${id}/notify`, { method: 'POST' });
    },

    async testEmail() {
        return apiClient.fetchJson(`${API_URL}/invoices/test-email`, { method: 'POST' });
    },

    // ── Flow / Workflow ──
    async getFlow() {
        return apiClient.fetchJson(`${API_URL}/invoices/flow`);
    },

    async seedFlow() {
        return apiClient.fetchJson(`${API_URL}/invoices/flow/seed`, { method: 'POST' });
    },

    async createFlowStep(data) {
        return apiClient.fetchJson(`${API_URL}/invoices/flow`, { method: 'POST', body: JSON.stringify(data) });
    },

    async updateFlowStep(id, data) {
        return apiClient.fetchJson(`${API_URL}/invoices/flow/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },

    async deleteFlowStep(id) {
        return apiClient.fetchJson(`${API_URL}/invoices/flow/${id}`, { method: 'DELETE' });
    },

    async reorderFlow(ids) {
        return apiClient.fetchJson(`${API_URL}/invoices/flow/reorder`, { method: 'POST', body: JSON.stringify({ ids }) });
    },

    async getMailStatus() {
        return apiClient.fetchJson(`${API_URL}/invoices/flow/mail-status`);
    },

    async getFlowRecipients({ event, stepId, assigneeType, assigneeValue, customEmails } = {}) {
        const qs = new URLSearchParams();
        if (event) qs.set('event', event);
        if (stepId) qs.set('step_id', String(stepId));
        if (assigneeType) qs.set('assignee_type', assigneeType);
        if (assigneeValue) qs.set('assignee_value', assigneeValue);
        if (customEmails) qs.set('custom_emails', String(customEmails));
        const query = qs.toString();
        return apiClient.fetchJson(`${API_URL}/invoices/flow/recipients${query ? '?' + query : ''}`);
    },

    async getEmailTemplates() {
        return apiClient.fetchJson(`${API_URL}/invoices/flow/email-templates`);
    },

    async previewEmailTemplate(event, { subject, body_html, ctx } = {}) {
        return apiClient.fetchJson(`${API_URL}/invoices/flow/email-templates/preview`, {
            method: 'POST',
            body: JSON.stringify({ event, subject, body_html, ctx: ctx || {} }),
        });
    },

    async updateEmailTemplate(event, { subject, body_html }) {
        return apiClient.fetchJson(`${API_URL}/invoices/flow/email-templates/${encodeURIComponent(event)}`, {
            method: 'PUT',
            body: JSON.stringify({ subject, body_html }),
        });
    },

    async deleteEmailTemplate(event) {
        return apiClient.fetchJson(`${API_URL}/invoices/flow/email-templates/${encodeURIComponent(event)}`, { method: 'DELETE' });
    },

    async exportExcel() {
        const response = await fetch(`${API_URL}/invoices/export-excel`, { credentials: 'include' });
        if (!response.ok) throw new Error('Gagal export Excel');
        const blob = await response.blob();
        const dateStr = new Date().toISOString().slice(0, 10);
        const urlObj = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlObj;
        a.download = `data_invoice_${dateStr}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(urlObj);
    },

    async exportPdf(id) {
        const response = await fetch(`${API_URL}/invoices/${id}/pdf`, { credentials: 'include' });
        if (!response.ok) throw new Error(await parseApiError(response, 'Gagal export PDF'));
        const blob = await response.blob();
        if (!blob.type.includes('pdf')) throw new Error('Respons bukan file PDF. Pastikan template aktif sudah benar.');
        const urlObj = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlObj;
        a.download = `proforma_invoice_${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(urlObj);
    },

    async exportRequestPdf(id) {
        const response = await fetch(`${API_URL}/invoices/${id}/pdf/request`, { credentials: 'include' });
        if (!response.ok) throw new Error(await parseApiError(response, 'Gagal export pengajuan proforma'));
        const blob = await response.blob();
        if (!blob.type.includes('pdf')) throw new Error('Respons bukan file PDF. Pastikan template aktif sudah benar.');
        const urlObj = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlObj;
        a.download = `pengajuan_proforma_${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(urlObj);
    }
};
