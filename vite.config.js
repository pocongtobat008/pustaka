import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Target API backend - bisa di-override via env VITE_API_TARGET (dev: http://127.0.0.1:5006)
const apiTarget = process.env.VITE_API_TARGET || 'http://127.0.0.1:5005';
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/

// ── Keamanan: teruskan IP asli klien ke backend agar rate limiting (anti-DDoS/bruteforce) akurat ──
const forwardClientIP = (proxy) => {
  proxy.on('proxyReq', (proxyReq, req) => {
    const ip = req.socket?.remoteAddress || '';
    if (ip) proxyReq.setHeader('X-Forwarded-For', ip);
  });
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['react-window', 'react-virtualized-auto-sizer']
  },
  server: {
    host: true, // Izinkan akses dari network
    allowedHosts: [
      "pustaka.izal.my.id"
    ],
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
        configure: forwardClientIP,
      },
      '/uploads': {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
        configure: forwardClientIP,
      },
      '/socket.io': {
        target: apiTarget,
        ws: true,
        changeOrigin: true,
        secure: false,
      }
    }
  },
  // Mode preview (produksi statis: vite build + vite preview)
  // Proxy sama seperti dev-server agar /api, /uploads, /socket.io tetap jalan
  preview: {
    host: true,
    allowedHosts: ["pustaka.izal.my.id"],
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true, secure: false, configure: forwardClientIP },
      '/uploads': { target: apiTarget, changeOrigin: true, secure: false, configure: forwardClientIP },
      '/socket.io': { target: apiTarget, ws: true, changeOrigin: true, secure: false }
    }
  }
})
