// PM2 ecosystem khusus LINGKUNGAN DEV
// Jalankan:  pm2 start ecosystem.dev.config.cjs
// Hentikan:  pm2 stop ecosystem.dev.config.cjs
// Catatan: worker dev memakai mode POLLING saja (DB job_queue pustaka_dev).
// BullMQ worker sengaja TIDAK dijalankan di dev agar antrian Redis
// tidak tercampur dengan produksi.
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
            },
        },
    ],
};
