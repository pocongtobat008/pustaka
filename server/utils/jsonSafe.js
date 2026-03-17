export function parseJsonSafe(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;

    if (typeof value !== 'string') {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

export function parseJsonArraySafe(value) {
    const parsed = parseJsonSafe(value, []);
    return Array.isArray(parsed) ? parsed : [];
}

export function parseJsonObjectSafe(value, fallback = {}) {
    const parsed = parseJsonSafe(value, fallback);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
    }
    return fallback;
}
