// PM2 ecosystem khusus LINGKUNGAN DEV
// Jalankan:  pm2 start ecosystem.dev.config.cjs
// Hentikan:  pm2 stop ecosystem.dev.config.cjs
// Catatan: worker BullMQ/polling sengaja TIDAK dijalankan di dev agar
// antrian Redis tidak tercampur dengan produksi.
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
    ],
};
