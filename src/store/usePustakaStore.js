import { create } from 'zustand';
import { pustakaService as api } from '../services/pustakaService';
import { handleApiError } from '../utils/errorHelper';

const initialState = {
    guides: [],
    categories: [],
};

export const usePustakaStore = create((set, get) => ({
    ...initialState,

    setGuides: (guides) => set({ guides }),
    setCategories: (categories) => set({ categories }),

    fetchGuides: async () => {
        const data = await api.getPustakaGuides();
        set({ guides: data || [] });
    },
    fetchCategories: async () => {
        const data = await api.getPustakaCategories();
        if (data.length === 0) {
            set({ categories: [{ id: 1, name: 'Operasional' }, { id: 2, name: 'Teknis' }, { id: 3, name: 'Compliance' }] });
        } else {
            set({ categories: data });
        }
    },

    saveGuide: async (id, guideData, slides) => {
        const prev = get().guides;
        const isUpdate = !!id;

        // Optimistic update for guides list (simplified)
        if (isUpdate) {
            set({ guides: prev.map(g => g.id === id ? { ...g, ...guideData } : g) });
        } else {
            const tempId = `temp-${Date.now()}`;
            set({ guides: [{ ...guideData, id: tempId }, ...prev] });
        }

        try {
            let guideId = id;
            if (isUpdate) {
                await api.updatePustakaGuide(id, guideData);
                await api.deleteSlidesByGuideId(id);
            } else {
                const res = await api.createPustakaGuide({ ...guideData });
                guideId = res.id;
            }

            if (guideId && slides) {
                const slidePromises = slides.map((slide, idx) =>
                    api.createPustakaSlide({
                        guide_id: guideId,
                        title: slide.title,
                        content: slide.content,
                        image_url: slide.image,
                        step_order: idx + 1
                    })
                );
                await Promise.all(slidePromises);
            }
            await get().fetchGuides();
        } catch (error) {
            set({ guides: prev });
            const msg = await handleApiError(error);
            console.error("Failed to save guide:", msg);
            throw msg;
        }
    },

    deleteGuide: async (id) => {
        const prev = get().guides;
        set({ guides: prev.filter(g => g.id !== id) });
        try {
            await api.deletePustakaGuide(id);
            await get().fetchGuides();
        } catch (error) {
            set({ guides: prev });
            const msg = await handleApiError(error);
            console.error("Failed to delete guide:", msg);
            throw msg;
        }
    },

    createCategory: async (name) => {
        const prev = get().categories;
        const tempId = Date.now();
        set({ categories: [...prev, { id: tempId, name }] });
        try {
            await api.createPustakaCategory(name);
            await get().fetchCategories();
        } catch (error) {
            set({ categories: prev });
            const msg = await handleApiError(error);
            console.error("Failed to create category:", msg);
            throw msg;
        }
    },

    reset: () => set(initialState),
}));
