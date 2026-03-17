export const checkPermission = (currentUser, roles, moduleId, action = 'view') => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;

    // Normalisasi moduleId untuk menangani alias umum
    let targetModule = moduleId;
    if (moduleId === 'sop') targetModule = 'flow';
    if (moduleId === 'jobduedate') targetModule = 'job-due-date';

    // Check granular permissions from roles state
    const userRoleData = roles.find(r => r.id === currentUser.role || r.name === currentUser.role || r.label === currentUser.role);
    // Note: The database column is 'access', heavily dependent on server/db.js schema.
    // Let's support both 'access' (from DB) and 'permissions' (legacy state?)
    let rolePerms = userRoleData ? (userRoleData.access || userRoleData.permissions) : null;

    // Handle stringified JSON from DB
    if (typeof rolePerms === 'string') {
        try { rolePerms = JSON.parse(rolePerms); } catch (e) { rolePerms = {}; }
    }

    if (userRoleData && rolePerms && rolePerms[targetModule]) {
        return rolePerms[targetModule].includes(action);
    }

    // Simple role-based fallback
    if (currentUser.role === 'staff' || currentUser.role === 'viewer') {
        // Staff & Viewer hanya boleh melihat (view) secara default jika tidak ada aturan khusus di role
        if (action === 'view' && targetModule !== 'master') return true;
        return false;
    }
    return false;
};

export const APP_MODULES = {
    dashboard: { id: 'dashboard', label: 'Dashboard' },
    inventory: { id: 'inventory', label: 'Gudang (Inventory)' },
    documents: { id: 'documents', label: 'Dokumen Digital' },
    'tax-monitoring': { id: 'tax-monitoring', label: 'Tax Monitoring' },
    'tax-summary': { id: 'tax-summary', label: 'Tax Summary' },
    'tax-calculation': { id: 'tax-calculation', label: 'Tax Calculation' },
    master: { id: 'master', label: 'Master Data' },
    approvals: { id: 'approvals', label: 'Document Approval' },
    pustaka: { id: 'pustaka', label: 'Pustaka Pengetahuan' },
    flow: { id: 'flow', label: 'SOP' },
    'job-due-date': { id: 'job-due-date', label: 'My Job' },
    'ai-chat': { id: 'ai-chat', label: 'AI Chat Assistant' }
};
