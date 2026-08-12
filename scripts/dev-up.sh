#!/bin/bash
# Start environment DEV (tidak menyentuh produksi)
# Produksi tetap: FE :5174, BE :5005
# Dev:           FE :5173, BE :5006, DB pustaka_dev
set -e
cd /home/project/pustaka-dev
pm2 start ecosystem.dev.config.cjs
pm2 save
echo ""
echo "✅ DEV stack berjalan:"
echo "   Frontend dev : http://localhost:5173"
echo "   Backend dev  : http://127.0.0.1:5006"
echo "   Login        : admin / admin123 (khusus DB dev)"
