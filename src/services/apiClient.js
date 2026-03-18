import { useAuthStore } from '../store/useAuthStore';

const getApiUrl = () => {
    // Gunakan relative path '/api' untuk memastikan request diperlakukan Same-Origin.
    // Ini mengizinkan HttpOnly cookie dikirim dengan benar di Local Network (IP)
    // mengandalkan konfigurasi `proxy` di vite.config.js dan nginx proxy di Production.
    if (window.location.protocol === 'file:') {
        return 'http://localhost:5005/api'; // Fallback Electron Desktop App
    }
    return '/api';
};

export const API_URL = getApiUrl();

export const apiClient = {
    async fetchJson(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });
        // Auto-logout on 401: reload to login page (cookie is already invalid/gone)
        if (response.status === 401) {
            console.warn('[apiClient] 401 Unauthorized - clearing state');
            useAuthStore.getState().logout();
            window.location.reload();
            throw new Error('Session expired. Please login again.');
        }
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            const details = Array.isArray(error.details)
                ? error.details
                    .map((d) => `${d.path || '(root)'}: ${d.message || 'invalid value'}`)
                    .join('; ')
                : '';
            const baseMessage = error.error || error.message || `Request failed with status ${response.status}`;
            throw new Error(details ? `${baseMessage} - ${details}` : baseMessage);
        }
        return response.json();
    },

    async fetchRaw(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            credentials: 'include'
        });
        if (!response.ok) throw response;
        return response;
    },

    async upload(url, formData) {
        const response = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            body: formData,
        });
        if (!response.ok) throw new Error('Upload failed');
        return response.json();
    }
};
