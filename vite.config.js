import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const apiTarget = process.env.API_PROXY_TARGET || 'http://127.0.0.1:5005'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Mode dev-server (dipakai di pustaka-dev)
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['pustaka-dev.izal.my.id', 'localhost', '127.0.0.1'],
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true, secure: false, configure: forwardClientIP },
      '/uploads': { target: apiTarget, changeOrigin: true, secure: false, configure: forwardClientIP },
      '/socket.io': { target: apiTarget, ws: true, changeOrigin: true, secure: false }
    }
  },
  // Mode preview (produksi statis: vite build + vite preview)
  preview: {
    host: true,
    port: 5174,
    allowedHosts: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD',
      'Access-Control-Allow-Headers': '*',
    },
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true, secure: false, configure: forwardClientIP },
      '/uploads': { target: apiTarget, changeOrigin: true, secure: false, configure: forwardClientIP },
      '/socket.io': { target: apiTarget, ws: true, changeOrigin: true, secure: false }
    }
  }
})

function forwardClientIP(proxyCtx) {
  proxyCtx.on('proxyReq', (proxyReq, req) => {
    const ip = req.socket?.remoteAddress || ''
    if (ip) proxyReq.setHeader('X-Forwarded-For', ip.replace(/^::ffff:/, ''))
  })
}
