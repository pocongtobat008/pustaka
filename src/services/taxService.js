import { API_URL } from './database';
import { apiClient } from './apiClient';

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
        return apiClient.fetchJson(`${API_URL}/tax-audits`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },
    async updateTaxAudit(id, payload) {
        return apiClient.fetchJson(`${API_URL}/tax-audits/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
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