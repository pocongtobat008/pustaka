import { API_URL } from './database';
import { apiClient } from './apiClient';

const normalizeDateTimeForApi = (value) => {
    if (value === undefined || value === null || value === '') return value;
    if (typeof value !== 'string') return value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (value.includes('T')) return value.slice(0, 10);
    return value;
};

const sanitizeTaxAuditPayload = (payload, { forUpdate = false } = {}) => {
    if (!payload || typeof payload !== 'object') return payload;
    const next = { ...payload };
    if (forUpdate) delete next.id;
    if (Object.prototype.hasOwnProperty.call(next, 'startDate')) {
        next.startDate = normalizeDateTimeForApi(next.startDate);
    }
    return next;
};

export const taxService = {
    // Database Wajib Pajak
    async getWpDatabase() {
        return apiClient.fetchJson(`${API_URL}/tax/wp`);
    },

    async saveWpData(payload, id = null) {
        const url = id ? `${API_URL}/tax/wp/${id}` : `${API_URL}/tax/wp`;
        const method = id ? 'PUT' : 'POST';
        return apiClient.fetchJson(url, {
            method,
            body: JSON.stringify(payload)
        });
    },

    async deleteWpData(id) {
        return apiClient.fetchJson(`${API_URL}/tax/wp/${id}`, { method: 'DELETE' });
    },

    async deleteAllWpData() {
        return apiClient.fetchJson(`${API_URL}/tax/wp-all`, { method: 'DELETE' });
    },

    async importWpExcel(file) {
        const formData = new FormData();
        formData.append('file', file);
        return apiClient.upload(`${API_URL}/tax/wp/import`, formData);
    },

    // Master Objek Pajak
    async getTaxObjects() {
        return apiClient.fetchJson(`${API_URL}/tax/objects`);
    },

    async importMasterExcel(file) {
        const formData = new FormData();
        formData.append('file', file);
        return apiClient.upload(`${API_URL}/tax/objects/import`, formData);
    },

    // Audit Monitoring
    async getTaxAudits() {
        return apiClient.fetchJson(`${API_URL}/tax-audits`);
    },
    async createTaxAudit(payload) {
        const safePayload = sanitizeTaxAuditPayload(payload);
        return apiClient.fetchJson(`${API_URL}/tax-audits`, {
            method: 'POST',
            body: JSON.stringify(safePayload)
        });
    },
    async updateTaxAudit(id, payload) {
        const safePayload = sanitizeTaxAuditPayload(payload, { forUpdate: true });
        return apiClient.fetchJson(`${API_URL}/tax-audits/${id}`, {
            method: 'PUT',
            body: JSON.stringify(safePayload)
        });
    },
    async deleteTaxAudit(id) {
        return apiClient.fetchJson(`${API_URL}/tax-audits/${id}`, { method: 'DELETE' });
    },
    async getAuditNotes(auditId, stepIndex) {
        return apiClient.fetchJson(`${API_URL}/tax-audits/${auditId}/steps/${stepIndex}/notes`);
    },
    async addAuditNote(auditId, stepIndex, formData) {
        // formData handles its own content-type
        const response = await fetch(`${API_URL}/tax-audits/${auditId}/steps/${stepIndex}/notes`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        return response.json();
    }
};