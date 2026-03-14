import { API_URL } from './database';
import { apiClient } from './apiClient';

export const inventoryService = {
    async getInventory() {
        return apiClient.fetchJson(`${API_URL}/inventory`);
    },
    async updateInventory(id, payload) {
        return apiClient.fetchJson(`${API_URL}/inventory/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
    },
    async moveInventory(sourceId, targetId, user) {
        return apiClient.fetchJson(`${API_URL}/inventory/move`, {
            method: 'POST',
            body: JSON.stringify({ sourceId, targetId, user })
        });
    },
    async createExternalItem(payload) {
        return apiClient.fetchJson(`${API_URL}/inventory/external`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },
    async deleteExternalItem(id) {
        return apiClient.fetchJson(`${API_URL}/inventory/external/${id}`, { method: 'DELETE' });
    }
};