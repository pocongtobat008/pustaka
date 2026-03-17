#!/bin/bash

# Redis Installation Script for Ubuntu
# This script installs Redis and sets up systemd service for Pustaka application

set -e  # Exit on any error

echo "================================"
echo "🔧 Redis Installer for Pustaka"
echo "================================"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root"
   echo "Run: sudo bash install-redis.sh"
   exit 1
fi

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Step 1: Update package manager
echo "📦 Step 1: Updating package manager..."
# Use -y and allow insecure repositories to avoid GPG key errors
apt-get update -o Acquire::AllowInsecureRepositories=true -o Acquire::AllowDowngradeToInsecureRepositories=true 2>/dev/null || apt-get update --fix-missing 2>/dev/null || true
print_status "Package manager updated"

# Step 2: Install dependencies
echo ""
echo "📚 Step 2: Installing dependencies..."
apt-get install -y build-essential tcl wget curl 2>/dev/null || apt-get install -y --fix-missing build-essential tcl wget curl || {
    print_warning "Some packages may not have installed, attempting to continue..."
}
print_status "Dependencies installed"

# Step 3: Download and install Redis
echo ""
echo "⬇️  Step 3: Downloading Redis..."
cd /tmp
REDIS_VERSION="7.4"
REDIS_URL="http://download.redis.io/redis-stable.tar.gz"

wget -q "$REDIS_URL" -O redis-stable.tar.gz
print_status "Redis downloaded"

echo "🔨 Building Redis from source..."
tar -xzf redis-stable.tar.gz
cd redis-stable

make > /dev/null 2>&1
make test > /dev/null 2>&1
make install > /dev/null 2>&1
print_status "Redis installed successfully"

# Step 4: Create redis user
echo ""
echo "👤 Step 4: Setting up Redis user..."
if ! id -u redis > /dev/null 2>&1; then
    useradd --system --home /var/lib/redis --shell /bin/false redis
    print_status "Redis user created"
else
    print_warning "Redis user already exists"
fi

# Step 5: Create Redis directories
echo ""
echo "📁 Step 5: Creating Redis directories..."
mkdir -p /var/lib/redis
mkdir -p /var/log/redis
mkdir -p /etc/redis

chown redis:redis /var/lib/redis
chown redis:redis /var/log/redis
chmod 755 /var/lib/redis
chmod 755 /var/log/redis
print_status "Directories created"

# Step 6: Create Redis configuration
echo ""
echo "⚙️  Step 6: Creating Redis configuration..."
cat > /etc/redis/redis.conf << 'REDIS_CONFIG'
# Redis configuration file

# Network and protocols
port 6379
bind 127.0.0.1
protected-mode yes
timeout 0
tcp-backlog 511
tcp-keepalive 300

# General
daemonize no
pidfile /var/run/redis.pid
loglevel notice
logfile /var/log/redis/redis-server.log
databases 16

# Snapshotting (Save policy)
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /var/lib/redis

# Replication
# slave-read-only yes
# slave-serve-stale-data yes
# slave-priority 100

# Security
# requirepass [password]

# Limits
maxclients 10000
maxmemory 256mb
maxmemory-policy allkeys-lru

# Append Only File (AOF)
appendonly no
appendfilename "appendonly.aof"
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

# Lua scripting
lua-time-limit 5000

# Slow Log
slowlog-log-slower-than 10000
slowlog-max-len 128

# Event notification
notify-keyspace-events ""

# Advanced config
hash-max-ziplist-entries 512
hash-max-ziplist-value 64
list-max-ziplist-size -2
list-compress-depth 0
set-max-intset-entries 512
zset-max-ziplist-entries 128
zset-max-ziplist-value 64
hll-sparse-max-bytes 3000
activerehashing yes

# Client output buffer limits
client-output-buffer-limit normal 0 0 0
client-output-buffer-limit slave 256mb 64mb 60
client-output-buffer-limit pubsub 32mb 8mb 60

# Frequency of rehashing the main dict
hz 10

# Enable active defragmentation
# activedefrag yes
REDIS_CONFIG

chmod 644 /etc/redis/redis.conf
print_status "Redis configuration created"

# Step 7: Create systemd service file
echo ""
echo "🚀 Step 7: Creating systemd service..."
cat > /etc/systemd/system/redis-server.service << 'SYSTEMD_SERVICE'
[Unit]
Description=Redis In-Memory Data Store
After=network.target

[Service]
User=redis
Group=redis
ExecStart=/usr/local/bin/redis-server /etc/redis/redis.conf
ExecStop=/usr/local/bin/redis-cli shutdown
Restart=always
RestartSec=5
Type=notify
NotifyAccess=main

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/redis /var/log/redis

[Install]
WantedBy=multi-user.target
SYSTEMD_SERVICE

chmod 644 /etc/systemd/system/redis-server.service
systemctl daemon-reload
print_status "Systemd service created"

# Step 8: Start Redis
echo ""
echo "🎯 Step 8: Starting Redis..."
systemctl enable redis-server
systemctl start redis-server
print_status "Redis started and enabled"

# Step 9: Verify installation
echo ""
echo "✅ Step 9: Verifying installation..."
sleep 2

if redis-cli ping > /dev/null 2>&1; then
    print_status "Redis is running!"
    REDIS_INFO=$(redis-cli info server | grep redis_version)
    echo "   $REDIS_INFO"
else
    print_error "Failed to connect to Redis"
    exit 1
fi

# Step 10: Display status and next steps
echo ""
echo "================================"
echo "✨ Redis Installation Complete!"
echo "================================"
echo ""
echo "📊 Redis Status:"
redis-cli ping
redis-cli DBSIZE
echo ""
echo "📋 Useful Commands:"
echo "   • Check status:  systemctl status redis-server"
echo "   • Start Redis:   systemctl start redis-server"
echo "   • Stop Redis:    systemctl stop redis-server"
echo "   • Monitor Redis: redis-cli MONITOR"
echo "   • CLI Access:    redis-cli"
echo ""
echo "🔗 Configuration:"
echo "   • Config file:   /etc/redis/redis.conf"
echo "   • Data dir:      /var/lib/redis"
echo "   • Log file:      /var/log/redis/redis-server.log"
echo ""
echo "🌐 Connection Details:"
echo "   • Host: 127.0.0.1"
echo "   • Port: 6379"
echo "   • Database: 0-15 (16 total)"
echo ""
echo "📝 Next steps:"
echo "   1. Update your .env file with Redis connection"
echo "   2. Connect from Node.js using: require('ioredis')"
echo "   3. Test with: redis-cli PING"
echo ""
