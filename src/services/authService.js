import { API_URL } from './database';
import { apiClient } from './apiClient';

export const authService = {
    async getUsers() {
        return apiClient.fetchJson(`${API_URL}/users`);
    },
    async createUser(payload) {
        return apiClient.fetchJson(`${API_URL}/users`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },
    async updateUser(id, payload) {
        return apiClient.fetchJson(`${API_URL}/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
    },
    async deleteUser(id) {
        return apiClient.fetchJson(`${API_URL}/users/${id}`, { method: 'DELETE' });
    },
    async getRoles() {
        return apiClient.fetchJson(`${API_URL}/roles`);
    },
    async getDepartments() {
        return apiClient.fetchJson(`${API_URL}/departments`);
    },
    async updateDepartment(id, name) {
        return apiClient.fetchJson(`${API_URL}/departments/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ name })
        });
    },
    async createDepartment(name) {
        return apiClient.fetchJson(`${API_URL}/departments`, {
            method: 'POST',
            body: JSON.stringify({ name })
        });
    }
};