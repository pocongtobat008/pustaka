import { create } from 'zustand';
import { taxService as api } from '../services/taxService';
import { API_URL } from '../services/database';
import { handleApiError } from '../utils/errorHelper';

const initialState = {
    taxSummaries: [],
    taxAudits: [],
    taxWp: [],
    isLoading: false,
};

export const useTaxStore = create((set, get) => ({
    ...initialState,

    // Setters
    setTaxSummaries: (taxSummaries) => set({ taxSummaries }),
    setTaxAudits: (taxAudits) => set({ taxAudits }),
    setTaxWp: (taxWp) => set({ taxWp }),

    // Fetchers
    fetchTaxSummaries: async () => {
        const data = await api.getTaxSummaries();
        set({ taxSummaries: data });
    },
    fetchTaxAudits: async () => {
        const data = await api.getTaxAudits();
        set({ taxAudits: data });
    },
    fetchTaxWp: async () => {
        try {
            const url = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL} /tax/wp` : 'http://localhost:5005/api/tax/wp';
            const res = await fetch(url, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                set({ taxWp: data });
            }
        } catch (e) {
            console.error("Failed to fetch Tax WP:", e);
        }
    },

    // Mutation Actions - Optimistic
    saveTaxSummary: async (data) => {
        const prev = get().taxSummaries;
        const isUpdate = !!data.id;
        if (isUpdate) {
            set({ taxSummaries: prev.map(s => s.id === data.id ? { ...s, ...data } : s) });
        } else {
            const tempId = `temp - ${Date.now()} `;
            set({ taxSummaries: [{ ...data, id: tempId }, ...prev] });
        }

        try {
            await api.saveTaxSummary(data);
            await get().fetchTaxSummaries();
        } catch (error) {
            set({ taxSummaries: prev });
            const msg = await handleApiError(error);
            console.error("Failed to save tax summary:", msg);
            throw msg;
        }
    },

    deleteTaxSummary: async (id) => {
        const prev = get().taxSummaries;
        set({ taxSummaries: prev.filter(s => s.id !== id) });
        try {
            await api.deleteTaxSummary(id);
            await get().fetchTaxSummaries();
        } catch (error) {
            set({ taxSummaries: prev });
            const msg = await handleApiError(error);
            console.error("Failed to delete tax summary:", msg);
            throw msg;
        }
    },

    createTaxAudit: async (data) => {
        const prev = get().taxAudits;
        const tempId = `temp - ${Date.now()} `;
        set({ taxAudits: [{ ...data, id: tempId }, ...prev] });
        try {
            await api.createTaxAudit(data);
            await get().fetchTaxAudits();
        } catch (error) {
            set({ taxAudits: prev });
            const msg = await handleApiError(error);
            console.error("Failed to create tax audit:", msg);
            throw msg;
        }
    },

    updateTaxAudit: async (id, data) => {
        const prev = get().taxAudits;
        set({ taxAudits: prev.map(a => a.id === id ? { ...a, ...data } : a) });
        try {
            await api.updateTaxAudit(id, data);
            await get().fetchTaxAudits();
        } catch (error) {
            set({ taxAudits: prev });
            const msg = await handleApiError(error);
            console.error("Failed to update tax audit:", msg);
            throw msg;
        }
    },

    deleteTaxAudit: async (id) => {
        const prev = get().taxAudits;
        set({ taxAudits: prev.filter(a => a.id !== id) });
        try {
            await api.deleteTaxAudit(id);
            await get().fetchTaxAudits();
        } catch (error) {
            set({ taxAudits: prev });
            const msg = await handleApiError(error);
            console.error("Failed to delete tax audit:", msg);
            throw msg;
        }
    },

    updateAuditStep: async (auditId, stepIndex, stepData) => {
        const prev = get().taxAudits;
        const audit = prev.find(a => a.id === auditId);
        if (!audit) return;

        const updatedSteps = [...audit.steps];
        updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], ...stepData };
        const updatedAudit = { ...audit, steps: updatedSteps };

        set({ taxAudits: prev.map(a => a.id === auditId ? updatedAudit : a) });

        try {
            await api.updateTaxAudit(auditId, updatedAudit);
            await get().fetchTaxAudits();
        } catch (error) {
            set({ taxAudits: prev });
            const msg = await handleApiError(error);
            console.error("Failed to update audit step:", msg);
            throw msg;
        }
    },

    saveAuditNote: async (auditId, stepIndex, formData) => {
        try {
            await api.addAuditNote(auditId, stepIndex, formData);
            await get().fetchTaxAudits();
        } catch (error) {
            const msg = await handleApiError(error);
            console.error("Failed to save audit note:", msg);
            throw msg;
        }
    },

    saveTaxWp: async (id, data) => {
        const prev = get().taxWp;
        const isUpdate = !!id;
        if (isUpdate) {
            set({ taxWp: prev.map(w => w.id === id ? { ...w, ...data } : w) });
        } else {
            const tempId = `temp-${Date.now()}`;
            set({ taxWp: [{ ...data, id: tempId }, ...prev] });
        }

        try {
            const url = isUpdate ? `${API_URL}/tax/wp/${id}` : `${API_URL}/tax/wp`;
            const res = await fetch(url, {
                method: isUpdate ? 'PUT' : 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw res;
            await get().fetchTaxWp();
        } catch (error) {
            set({ taxWp: prev });
            const msg = await handleApiError(error);
            console.error("Failed to save tax wp:", msg);
            throw msg;
        }
    },

    deleteTaxWp: async (id) => {
        const prev = get().taxWp;
        set({ taxWp: prev.filter(w => w.id !== id) });
        try {
            const res = await fetch(`${API_URL}/tax/wp/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (!res.ok) throw res;
            await get().fetchTaxWp();
        } catch (error) {
            set({ taxWp: prev });
            const msg = await handleApiError(error);
            console.error("Failed to delete tax wp:", msg);
            throw msg;
        }
    },

    reset: () => set(initialState),
}));
