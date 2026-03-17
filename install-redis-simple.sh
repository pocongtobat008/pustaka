#!/bin/bash

# The SIMPLEST Redis Setup - All-in-one
# Works around apt issues and uses minimal dependencies

echo "🚀 Starting Redis Setup..."

# Check root
if [[ $EUID -ne 0 ]]; then
   echo "Need sudo: sudo bash install-redis-simple.sh"
   exit 1
fi

# Detect what we have available
if command -v redis-cli &> /dev/null; then
    echo "✅ Redis already installed!"
    redis-cli ping && echo "✅ Redis is running!" || echo "⚠️  Redis not responding"
    echo ""
    echo "Use: redis-cli"
    exit 0
fi

echo "Installing Redis..."

# Function to try command
try_install() {
    if command -v wget &> /dev/null; then
        wget -q "$1" -O /tmp/redis.tar.gz
    elif command -v curl &> /dev/null; then
        curl -s "$1" -o /tmp/redis.tar.gz
    else
        return 1
    fi
}

# Make sure we have build tools
if ! command -v gcc &> /dev/null; then
    echo "Installing build tools..."
    apt-get update -qq 2>/dev/null || true
    apt-get install -y build-essential 2>/dev/null || {
        echo "⚠️  Could not install build-essential"
        echo "Try: sudo apt-get install -y build-essential"
        exit 1
    }
fi

# Get Redis (with fallback)
if ! try_install "http://download.redis.io/redis-stable.tar.gz"; then
    echo "❌ Download failed"
    exit 1
fi

# Build it
cd /tmp
tar -xzf redis.tar.gz
cd redis-stable
make -j$(nproc) 2>/dev/null || make
make install

# Setup user & dirs
useradd --system --home /var/lib/redis --shell /bin/false redis 2>/dev/null || true
mkdir -p /var/lib/redis /var/log/redis /etc/redis
chown redis:redis /var/lib/redis /var/log/redis

# Config
cat > /etc/redis/redis.conf << 'EOF'
port 6379
bind 127.0.0.1
dir /var/lib/redis
logfile /var/log/redis/redis-server.log
save 900 1
save 300 10
save 60 10000
maxmemory 256mb
maxmemory-policy allkeys-lru
EOF

# Service file
cat > /etc/systemd/system/redis-server.service << 'EOF'
[Unit]
Description=Redis Server
After=network.target

[Service]
User=redis
Group=redis
ExecStart=/usr/local/bin/redis-server /etc/redis/redis.conf
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Start it
systemctl daemon-reload
systemctl enable redis-server
systemctl start redis-server

# Verify
sleep 1
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis installed and running!"
    echo ""
    echo "Connect: redis-cli"
    echo "Check:   systemctl status redis-server"
else
    echo "⚠️  Redis installed but not responding yet"
    echo "Check:   systemctl status redis-server"
    echo "Logs:    sudo journalctl -u redis-server -f"
fi
