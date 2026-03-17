#!/bin/bash
set -euo pipefail

echo "======================================"
echo "INSTALL REDIS SERVER - UBUNTU"
echo "======================================"

# Update package
echo "[1/6] Update package..."
sudo apt update -y

# Install Redis
echo "[2/6] Install Redis..."
sudo apt install redis-server -y

# Backup config
echo "[3/6] Backup config Redis..."
sudo cp /etc/redis/redis.conf /etc/redis/redis.conf.backup

# Set Redis agar jalan di background (supervised systemd)
echo "[4/6] Konfigurasi Redis..."
sudo sed -i 's/^supervised no/supervised systemd/' /etc/redis/redis.conf

# Optional: bind ke localhost saja (lebih aman)
sudo sed -i 's/^bind .*/bind 127.0.0.1 ::1/' /etc/redis/redis.conf

# Restart Redis (compatible for systemd and non-systemd containers)
echo "[5/6] Restart Redis..."
if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
	sudo systemctl restart redis-server
	echo "[6/6] Enable Redis saat boot..."
	sudo systemctl enable redis-server
	echo "======================================"
	echo "STATUS REDIS:"
	sudo systemctl status redis-server --no-pager
elif command -v service >/dev/null 2>&1; then
	sudo service redis-server restart || sudo service redis-server start
	echo "[6/6] Skipping enable on non-systemd environment"
	echo "======================================"
	echo "STATUS REDIS:"
	sudo service redis-server status || true
else
	echo "[5/6] service manager tidak tersedia, jalankan redis-server manual"
	redis-server --daemonize yes
	echo "[6/6] Skipping enable (manual mode)"
fi

# Test koneksi Redis
echo "======================================"
echo "TEST REDIS (PING)..."
redis-cli ping

echo "======================================"
echo "INSTALL SELESAI!"
echo "Jika muncul PONG berarti Redis berjalan."