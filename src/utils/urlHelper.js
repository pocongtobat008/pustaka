export const getFullUrl = (url) => {
    if (!url || typeof url !== 'string') return null;
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;

    const { hostname, port, protocol } = window.location;
    const isDev = port === '3000' || port === '5173' || hostname === 'localhost';
    const backendPort = '5005';

    let cleanUrl = url;
    if (cleanUrl.includes('/uploads/')) {
        cleanUrl = '/uploads/' + cleanUrl.split('/uploads/')[1];
    } else if (url.startsWith('uploads/')) {
        cleanUrl = '/' + url;
    }

    // Gunakan relative path untuk memanfaatkan Vite Proxy dan Same-Origin policy
    if (cleanUrl.startsWith('/uploads/')) {
        if (window.location.protocol === 'file:') {
            // Fallback Electron Desktop App
            return `http://localhost:5005${cleanUrl}`;
        }
        return cleanUrl;
    }
    return cleanUrl;
};