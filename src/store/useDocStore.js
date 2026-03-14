import { create } from 'zustand';
import { db as api } from '../services/database';

const initialState = {
    docList: [],
    folders: [],
    currentFolderId: null,
    folderHistory: [null],
    historyIndex: 0,
    approvals: [],
    flows: [],
};

export const useDocStore = create((set, get) => ({
    ...initialState,

    // Setters
    setDocList: (docList) => set({ docList }),
    setFolders: (folders) => set({ folders }),
    setApprovals: (approvals) => set({ approvals }),
    setFlows: (flows) => set({ flows }),
    setCurrentFolderId: (folderId) => set({ currentFolderId: folderId }),

    // Actions
    fetchDocs: async () => {
        const data = await api.getDocs();
        set({ docList: data });
    },
    fetchFolders: async () => {
        const data = await api.getFolders();
        set({ folders: data });
    },
    fetchApprovals: async () => {
        const data = await api.getApprovals();
        set({ approvals: data });
        const flowData = await api.getApprovalFlows();
        set({ flows: flowData });
    },

    navigateFolder: (folderId) => {
        const { folderHistory, historyIndex } = get();
        const newHistory = folderHistory.slice(0, historyIndex + 1);
        newHistory.push(folderId);
        set({
            folderHistory: newHistory,
            historyIndex: newHistory.length - 1,
            currentFolderId: folderId
        });
    },
    navigateBack: () => {
        const { folderHistory, historyIndex } = get();
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            set({
                historyIndex: newIndex,
                currentFolderId: folderHistory[newIndex]
            });
        }
    },
    navigateForward: () => {
        const { folderHistory, historyIndex } = get();
        if (historyIndex < folderHistory.length - 1) {
            const newIndex = historyIndex + 1;
            set({
                historyIndex: newIndex,
                currentFolderId: folderHistory[newIndex]
            });
        }
    },

    // Mutation Actions
    createDocument: async (doc) => {
        const res = await api.createDocument(doc);
        if (res) {
            await get().fetchDocs();
        }
        return res;
    },
    updateDocument: async (id, doc) => {
        await api.updateDocument(id, doc);
        await get().fetchDocs();
    },
    deleteDocument: async (id) => {
        await api.deleteDocument(id);
        await get().fetchDocs();
    },
    createFolder: async (folder) => {
        await api.createFolder(folder);
        await get().fetchFolders();
    },
    updateFolder: async (id, data) => {
        await api.updateFolder(id, data);
        await get().fetchFolders();
    },
    deleteFolder: async (id) => {
        await api.deleteFolder(id);
        await get().fetchFolders();
    },
    copyDocument: async (id, targetFolderId, owner) => {
        const res = await api.copyDocument(id, targetFolderId, owner);
        await get().fetchDocs();
        return res;
    },
    moveDocument: async (id, targetFolderId, owner) => {
        const res = await api.moveDocument(id, targetFolderId, owner);
        await get().fetchDocs();
        return res;
    },
    restoreDocumentVersion: async (id, versionTimestamp) => {
        const res = await api.restoreDocumentVersion(id, versionTimestamp);
        await get().fetchDocs();
        return res;
    },
    promoteCommentAttachment: async (docId, commentId) => {
        const res = await api.promoteCommentAttachment(docId, commentId);
        await get().fetchDocs();
        return res;
    },
    addComment: async (docId, formData) => {
        const res = await api.addComment(docId, formData);
        // Comments are usually fetched separately, but we can refresh docs if needed
        // For now, let's just return the result
        return res;
    },

    reset: () => set(initialState),
}));
