import { io } from 'socket.io-client';

/**
 * Socket.IO Client Service
 * Singleton socket connection for real-time data sync across multiple browser sessions.
 */

const getServerUrl = () => {
    // Return empty string to connect to the same host/port the browser is currently at
    // In Vite dev, the proxy handles socket.io routing.
    // In Electron, fallback to localhost:5005
    if (window.location.protocol === 'file:') {
        return 'http://localhost:5005';
    }
    return '';
};

let socket = null;

export const getSocket = () => {
    if (!socket) {
        const url = getServerUrl();
        socket = io(url, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });

        socket.on('connect', () => {
            console.log('[Socket.IO] Connected:', socket.id);
        });

        socket.on('disconnect', (reason) => {
            console.log('[Socket.IO] Disconnected:', reason);
        });

        socket.on('connect_error', (err) => {
            console.warn('[Socket.IO] Connection error:', err.message);
        });
    }
    return socket;
};

/**
 * Subscribe to a data:changed event for a specific channel.
 * Returns an unsubscribe function.
 */
export const onDataChange = (callback) => {
    const s = getSocket();
    s.on('data:changed', callback);
    return () => s.off('data:changed', callback);
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};
