import { API_URL } from './database';
import { apiClient } from './apiClient';

export const systemService = {
    async getFileLogs(type) {
        return apiClient.fetchJson(`${API_URL}/system/logs-file/${type}`);
    }
};