// PM2 ecosystem khusus LINGKUNGAN DEV
// Jalankan:  pm2 start ecosystem.dev.config.cjs
// Hentikan:  pm2 stop ecosystem.dev.config.cjs
//
// ISOLASI PENUH:
// - REDIS_PORT sengaja diarahkan ke port yang tidak dipakai (6399) sehingga
//   seluruh stack dev fallback ke polling berbasis DB (pustaka_dev) dan
//   TIDAK pernah menyentuh Redis/antrian produksi.
// - Worker dev memakai mode POLLING saja.
module.exports = {
    apps: [
        {
            name: 'dev-backend',
            namespace: 'dev',
            cwd: '/home/project/pustaka-dev',
            script: 'server/index.js',
            env: {
                NODE_ENV: 'development',
                PORT: 5006,
                REDIS_PORT: 6399,
            },
        },
        {
            name: 'dev-frontend',
            namespace: 'dev',
            cwd: '/home/project/pustaka-dev',
            script: 'node_modules/.bin/vite',
            args: '--host 0.0.0.0 --port 5173',
            env: {
                NODE_ENV: 'development',
                VITE_API_TARGET: 'http://127.0.0.1:5006',
            },
        },
        {
            name: 'dev-worker',
            namespace: 'dev',
            cwd: '/home/project/pustaka-dev',
            script: 'server/worker.js',
            args: '--mode=polling',
            env: {
                NODE_ENV: 'development',
                PORT: 5006,
                BACKEND_URL: 'http://127.0.0.1:5006',
                REDIS_PORT: 6399,
            },
        },
    ],
};
