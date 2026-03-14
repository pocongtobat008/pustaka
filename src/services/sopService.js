import { API_URL } from './database';
import { apiClient } from './apiClient';

export const sopService = {
    async getFlows() {
        return apiClient.fetchJson(`${API_URL}/sop-flows`);
    },
    async createFlow(payload) {
        return apiClient.fetchJson(`${API_URL}/sop-flows`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },
    async updateFlow(id, payload) {
        return apiClient.fetchJson(`${API_URL}/sop-flows/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
    },
    async deleteFlow(id) {
        return apiClient.fetchJson(`${API_URL}/sop-flows/${id}`, { method: 'DELETE' });
    }
};