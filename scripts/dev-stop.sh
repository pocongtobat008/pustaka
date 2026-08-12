#!/bin/bash
# Stop environment DEV (produksi tidak tersentuh)
cd /home/project/pustaka-dev
pm2 stop ecosystem.dev.config.cjs
pm2 save
echo "🛑 DEV stack dihentikan (produksi tetap jalan di :5174 / :5005)"
