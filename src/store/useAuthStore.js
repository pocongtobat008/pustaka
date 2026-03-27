import { create } from 'zustand';
import { useAppStore } from './useAppStore';
import { useDocStore } from './useDocStore';
import { useInventoryStore } from './useInventoryStore';
import { usePustakaStore } from './usePustakaStore';
import { useTaxStore } from './useTaxStore';
import { useUserStore } from './useUserStore';

const initialState = {
    currentUser: (() => {
        try {
            const saved = localStorage.getItem('archive_user');
            return saved ? JSON.parse(saved) : null;
        } catch { return null; }
    })(),
    users: [],
    roles: [],
    departments: [],
};

export const useAuthStore = create((set) => ({
    ...initialState,

    setCurrentUser: (user) => {
        if (user) {
            localStorage.setItem('archive_user', JSON.stringify(user));
        } else {
            localStorage.removeItem('archive_user');
        }
        set({ currentUser: user });
    },
    setUsers: (users) => set((state) => ({ users: typeof users === 'function' ? users(state.users) : users })),
    setRoles: (roles) => set((state) => ({ roles: typeof roles === 'function' ? roles(state.roles) : roles })),
    setDepartments: (departments) => set((state) => ({ departments: typeof departments === 'function' ? departments(state.departments) : departments })),

    reset: () => set({
        ...initialState,
        currentUser: null // Explicitly clear on reset
    }),

    logout: async () => {
        // 1. Clear LocalStorage user data
        localStorage.removeItem('archive_user');

        // 2. Clear Cookie via Backend
        try {
            const { API_URL } = await import('../services/database');
            await fetch(`${API_URL}/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (err) {
            console.error("Backend logout failed:", err);
        }

        // 3. Reset all other stores
        useAppStore.getState().reset();
        useDocStore.getState().reset();
        useInventoryStore.getState().reset();
        usePustakaStore.getState().reset();
        useTaxStore.getState().reset();
        useUserStore.getState().reset();

        // 4. Reset self
        set({
            ...initialState,
            currentUser: null
        });
    }
}));
