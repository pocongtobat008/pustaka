import { API_URL } from './database';
import { apiClient } from './apiClient';

export const pustakaService = {
    async getGuides() {
        return apiClient.fetchJson(`${API_URL}/pustaka/guides`);
    },
    async getCategories() {
        return apiClient.fetchJson(`${API_URL}/pustaka/categories`);
    },
    async createCategory(name) {
        return apiClient.fetchJson(`${API_URL}/pustaka/categories`, {
            method: 'POST',
            body: JSON.stringify({ name })
        });
    },
    async createGuide(payload) {
        return apiClient.fetchJson(`${API_URL}/pustaka/guides`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },
    async updateGuide(id, payload) {
        return apiClient.fetchJson(`${API_URL}/pustaka/guides/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
    },
    async deleteGuide(id) {
        return apiClient.fetchJson(`${API_URL}/pustaka/guides/${id}`, { method: 'DELETE' });
    },
    async getSlides(guideId) {
        return apiClient.fetchJson(`${API_URL}/pustaka/guides/${guideId}/slides`);
    },
    async createSlide(payload) {
        return apiClient.fetchJson(`${API_URL}/pustaka/slides`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },
    async deleteSlidesByGuideId(guideId) {
        return apiClient.fetchJson(`${API_URL}/pustaka/guides/${guideId}/slides`, { method: 'DELETE' });
    },
    async search(query) {
        return apiClient.fetchJson(`${API_URL}/pustaka/search?q=${encodeURIComponent(query)}`);
    }
};