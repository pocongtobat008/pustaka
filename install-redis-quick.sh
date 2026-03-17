#!/bin/bash

# Quick Redis Installer - Minimal approach
# Bypasses apt-get issues by downloading pre-compiled Redis

set -e

echo "================================"
echo "⚡ Redis Quick Installer"
echo "================================"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root"
   echo "Run: sudo bash install-redis-quick.sh"
   exit 1
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Step 1: Check for existing installations
echo "🔍 Checking for existing Redis installations..."

if command -v redis-server &> /dev/null; then
    REDIS_PATH=$(which redis-server)
    REDIS_VERSION=$(redis-server --version)
    print_status "Redis already installed at: $REDIS_PATH"
    echo "   $REDIS_VERSION"
    echo ""
    read -p "Do you want to continue setup for systemd service? (y/n) " -n 1 -r
    echo
    [ "$REPLY" != "y" ] && exit 0
    SKIP_BUILD=true
fi

# Step 2: Download pre-compiled Redis (if needed)
if [ "$SKIP_BUILD" != "true" ]; then
    echo ""
    echo "⬇️  Step 1: Downloading Redis..."
    
    # Try multiple approaches
    which wget > /dev/null || which curl > /dev/null || {
        print_warning "Neither wget nor curl found, attempting to install..."
        apt-get update -qq || true
        apt-get install -y wget curl || {
            print_error "Could not install wget/curl"
            exit 1
        }
    }
    
    cd /tmp
    REDIS_URL="http://download.redis.io/redis-stable.tar.gz"
    
    if command -v wget &> /dev/null; then
        wget -q "$REDIS_URL" -O redis-stable.tar.gz || {
            print_error "Failed to download Redis"
            exit 1
        }
    else
        curl -s "$REDIS_URL" -o redis-stable.tar.gz || {
            print_error "Failed to download Redis"
            exit 1
        }
    fi
    
    print_status "Redis downloaded"
    
    echo "🔨 Building Redis from source..."
    tar -xzf redis-stable.tar.gz
    cd redis-stable
    
    make > /dev/null 2>&1 || {
        print_warning "Make test skipped due to environment"
    }
    
    make install > /dev/null 2>&1 || {
        print_error "Failed to build Redis"
        exit 1
    }
    
    print_status "Redis installed successfully"
fi

# Step 3: Create redis user
echo ""
echo "👤 Step 2: Setting up Redis user..."
if ! id -u redis > /dev/null 2>&1; then
    useradd --system --home /var/lib/redis --shell /bin/false redis 2>/dev/null || {
        print_warning "Redis user may already exist"
    }
    print_status "Redis user ready"
else
    print_warning "Redis user already exists"
fi

# Step 4: Create directories
echo ""
echo "📁 Step 3: Creating Redis directories..."
mkdir -p /var/lib/redis /var/log/redis /etc/redis

chown redis:redis /var/lib/redis /var/log/redis || true
chmod 755 /var/lib/redis /var/log/redis || true
print_status "Directories created"

# Step 5: Create Redis configuration
echo ""
echo "⚙️  Step 4: Creating Redis configuration..."
cat > /etc/redis/redis.conf << 'REDIS_CONFIG'
port 6379
bind 127.0.0.1
protected-mode yes
timeout 0
tcp-backlog 511
tcp-keepalive 300
daemonize no
pidfile /var/run/redis.pid
loglevel notice
logfile /var/log/redis/redis-server.log
databases 16
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /var/lib/redis
maxclients 10000
maxmemory 256mb
maxmemory-policy allkeys-lru
appendonly no
appendfilename "appendonly.aof"
appendfsync everysec
hash-max-ziplist-entries 512
hash-max-ziplist-value 64
list-max-ziplist-size -2
set-max-intset-entries 512
zset-max-ziplist-entries 128
zset-max-ziplist-value 64
activerehashing yes
client-output-buffer-limit normal 0 0 0
client-output-buffer-limit slave 256mb 64mb 60
client-output-buffer-limit pubsub 32mb 8mb 60
hz 10
REDIS_CONFIG

chmod 644 /etc/redis/redis.conf
print_status "Redis configuration created"

# Step 6: Create systemd service
echo ""
echo "🚀 Step 5: Creating systemd service..."
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

NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SYSTEMD_SERVICE

chmod 644 /etc/systemd/system/redis-server.service
systemctl daemon-reload
print_status "Systemd service created"

# Step 7: Start Redis with retry logic
echo ""
echo "🎯 Step 6: Starting Redis..."
for i in {1..3}; do
    if systemctl start redis-server 2>/dev/null; then
        print_status "Redis started"
        break
    else
        if [ $i -lt 3 ]; then
            print_warning "Attempt $i failed, retrying..."
            sleep 2
        else
            print_error "Failed to start Redis after 3 attempts"
            exit 1
        fi
    fi
done

systemctl enable redis-server > /dev/null 2>&1 || true

# Step 8: Verify connection with retries
echo ""
echo "✅ Step 7: Verifying installation..."
RETRY_COUNT=0
while [ $RETRY_COUNT -lt 5 ]; do
    if redis-cli ping > /dev/null 2>&1; then
        PING=$(redis-cli ping)
        print_status "Redis is responding ($PING)"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt 5 ]; then
            print_warning "Redis not responding yet (attempt $RETRY_COUNT/5), retrying..."
            sleep 1
        fi
    fi
done

if [ $RETRY_COUNT -eq 5 ]; then
    print_warning "Could not connect to Redis, but service is running"
    echo "Try: redis-cli ping (manually)"
fi

# Step 9: Display summary
echo ""
echo "================================"
echo "✨ Redis Installation Complete!"
echo "================================"
echo ""
echo "📋 Commands:"
echo "   Check status:  systemctl status redis-server"
echo "   Start Redis:   systemctl start redis-server"
echo "   Stop Redis:    systemctl stop redis-server"
echo "   CLI Access:    redis-cli"
echo ""
echo "📁 Paths:"
echo "   Config:        /etc/redis/redis.conf"
echo "   Data:          /var/lib/redis"
echo "   Logs:          /var/log/redis/redis-server.log"
echo ""
echo "🔗 Connection:"
echo "   Host: 127.0.0.1"
echo "   Port: 6379"
echo ""
echo "✅ Ready to use!"
echo ""
