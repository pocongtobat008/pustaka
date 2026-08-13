#!/bin/bash
# ── Auto-start stack DEV saat server boot (dipanggil cron @reboot) ──
# Idempotent: hanya me-start app dev yang BELUM online (tidak me-restart yang lain).
# Log: /var/log/pustaka-dev-boot.log
LOG=/var/log/pustaka-dev-boot.log
mkdir -p /var/log
exec >> "$LOG" 2>&1
echo "=== boot-dev $(date '+%F %T') ==="

# 1) Tunggu PostgreSQL siap (maks ±60 detik)
DB_READY=0
for i in $(seq 1 30); do
    if sudo -u postgres psql -d pustaka_dev -tAc 'SELECT 1' >/dev/null 2>&1; then
        DB_READY=1
        echo "PostgreSQL siap (percobaan ke-$i)"
        break
    fi
    sleep 2
done
[ "$DB_READY" = "1" ] || echo "PERINGATAN: PostgreSQL belum siap dalam 60 detik — tetap lanjut"

# 2) Tunggu PM2 daemon siap
pm2 ping >/dev/null 2>&1 || { echo "Menunggu PM2 daemon..."; sleep 5; pm2 ping >/dev/null 2>&1 || echo "PERINGATAN: PM2 daemon belum merespons"; }

# 2b) Pastikan Redis terisolasi dev (port 6399) hidup — dipakai ecosystem.dev.config.cjs
if redis-cli -p 6399 ping 2>/dev/null | grep -q PONG; then
    echo "Redis dev :6399 sudah hidup — skip"
else
    echo "Redis dev :6399 mati — menyalakan..."
    redis-server --port 6399 --daemonize yes --pidfile /var/run/redis-6399.pid --logfile /var/log/redis-6399.log
    sleep 2
fi

# 3) Start per-app hanya yang belum online (idempotent)
cd /home/project/pustaka-dev
for app in dev-backend dev-frontend dev-worker; do
    PID=$(pm2 pid "$app" 2>/dev/null)
    if [ -n "$PID" ] && [ "$PID" != "0" ]; then
        echo "$app sudah online (pid $PID) — skip"
    else
        echo "Memulai $app..."
        pm2 start ecosystem.dev.config.cjs --only "$app"
    fi
done
pm2 save >/dev/null 2>&1

echo "Status stack dev:"
pm2 list 2>/dev/null | grep -E 'dev-' || echo "(tidak ada proses dev terlihat)"
echo "=== selesai $(date '+%F %T') ==="
