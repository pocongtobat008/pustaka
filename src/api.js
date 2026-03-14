const API_URL = '/api';

const fetchAPI = async (endpoint, options = {}) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'API request failed');
    }
    return response.json();
};

export const api = {
    // Users
    getUsers: () => fetchAPI('/users'),
    createUser: (user) => fetchAPI('/users', { method: 'POST', body: JSON.stringify(user) }),
    updateUser: (id, user) => fetchAPI(`/users/${id}`, { method: 'PUT', body: JSON.stringify(user) }),
    deleteUser: (id) => fetchAPI(`/users/${id}`, { method: 'DELETE' }),

    // Departments
    getDepartments: () => fetchAPI('/departments'),
    createDepartment: (name) => fetchAPI('/departments', { method: 'POST', body: JSON.stringify({ name }) }),
    updateDepartment: (id, name) => fetchAPI(`/departments/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
    deleteDepartment: (id) => fetchAPI(`/departments/${id}`, { method: 'DELETE' }),

    // Roles
    getRoles: () => fetchAPI('/roles'),
    createRole: (role) => fetchAPI('/roles', { method: 'POST', body: JSON.stringify(role) }),
    updateRole: (id, role) => fetchAPI(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(role) }),
    deleteRole: (id) => fetchAPI(`/roles/${id}`, { method: 'DELETE' }),

    // Inventory
    getInventory: () => fetchAPI('/inventory'),
    updateInventory: (id, data) => fetchAPI(`/inventory/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    getExternalItems: () => fetchAPI('/inventory/external'),
    createExternalItem: (data) => fetchAPI('/inventory/external', { method: 'POST', body: JSON.stringify(data) }),
    deleteExternalItem: (id) => fetchAPI(`/inventory/external/${id}`, { method: 'DELETE' }),

    // Logs
    getLogs: () => fetchAPI('/logs'),
    createLog: (log) => fetchAPI('/logs', { method: 'POST', body: JSON.stringify(log) }),

    // Folders
    getFolders: () => fetchAPI('/folders'),
    createFolder: (folder) => fetchAPI('/folders', { method: 'POST', body: JSON.stringify(folder) }),
    updateFolder: (id, folder) => fetchAPI(`/folders/${id}`, { method: 'PUT', body: JSON.stringify(folder) }),
    deleteFolder: (id) => fetchAPI(`/folders/${id}`, { method: 'DELETE' }),

    // Documents
    getDocuments: (params) => {
        const query = params ? '?' + new URLSearchParams(params).toString() : '';
        return fetchAPI(`/documents${query}`);
    },
    createDocument: (doc) => fetchAPI('/documents', { method: 'POST', body: JSON.stringify(doc) }),
    updateDocument: (id, doc) => fetchAPI(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(doc) }),
    deleteDocument: (id) => fetchAPI(`/documents/${id}`, { method: 'DELETE' }),

    // Tax Audits
    getTaxAudits: () => fetchAPI('/tax-audits'),
    createTaxAudit: (audit) => fetchAPI('/tax-audits', { method: 'POST', body: JSON.stringify(audit) }),
    updateTaxAudit: (id, audit) => fetchAPI(`/tax-audits/${id}`, { method: 'PUT', body: JSON.stringify(audit) }),
    deleteTaxAudit: (id) => fetchAPI(`/tax-audits/${id}`, { method: 'DELETE' }),

    // --- MANAGEMENT OPS ---
    copyDocument: (id, targetFolderId) => fetchAPI('/documents/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, targetFolderId })
    }),
    moveDocument: (id, targetFolderId) => fetchAPI('/documents/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, targetFolderId })
    }),
    copyFolder: (id, targetParentId) => fetchAPI('/folders/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, targetParentId })
    }),
    moveFolder: (id, targetParentId) => fetchAPI('/folders/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, targetParentId })
    }),

    // Tax Summaries
    getTaxSummaries: () => fetchAPI('/tax-summaries'),
    createTaxSummary: (data) => fetchAPI('/tax-summaries', { method: 'POST', body: JSON.stringify(data) }),
    updateTaxSummary: (id, data) => fetchAPI(`/tax-summaries/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteTaxSummary: (id) => fetchAPI(`/tax-summaries/${id}`, { method: 'DELETE' }),

    // Versioning
    restoreDocumentVersion: (id, versionTimestamp) => fetchAPI(`/documents/${id}/restore`, {
        method: 'POST',
        body: JSON.stringify({ versionTimestamp })
    }),
};
