# 🔴 Redis Installation Guide for Pustaka

Redis is an in-memory data structure store used for caching, job queues, and real-time features in Pustaka.

## 📋 Installation Options

### Option 1: System Installation (Recommended for Production)

Install Redis directly on your Ubuntu system with systemd integration.

**Requirements:**
- Ubuntu 20.04 or later
- sudo/root access
- 2GB RAM minimum
- Internet connection

**Installation:**

```bash
sudo bash install-redis.sh
```

**What it does:**
- ✅ Downloads and compiles Redis from source
- ✅ Creates Redis user and directories
- ✅ Configures `/etc/redis/redis.conf`
- ✅ Sets up systemd service for auto-start
- ✅ Enables persistence (RDB snapshots)
- ✅ Configures 256MB memory limit

**Post-Installation:**

```bash
# Check status
systemctl status redis-server

# View logs
sudo tail -f /var/log/redis/redis-server.log

# Access Redis CLI
redis-cli

# Test connection
redis-cli ping  # Should return: PONG
```

---

### Option 2: Docker Installation (Recommended for Development)

Run Redis in a Docker container with automatic restart.

**Requirements:**
- Docker installed (`docker --version`)
- Docker daemon running
- 2GB disk space

**Installation:**

```bash
bash install-redis-docker.sh
```

**What it does:**
- ✅ Pulls Redis 7-alpine image
- ✅ Creates container with volume persistence
- ✅ Auto-restart on failure
- ✅ Exposes port 6379
- ✅ Enables AOF (Append-Only File) persistence

**Post-Installation:**

```bash
# Check status
docker ps | grep pustaka-redis

# View logs
docker logs -f pustaka-redis

# Access Redis CLI
docker exec -it pustaka-redis redis-cli

# Test connection
docker exec pustaka-redis redis-cli ping  # Should return: PONG

# Stop Redis
docker stop pustaka-redis

# Start Redis
docker start pustaka-redis
```

---

### Option 3: Manual Installation

Install Redis manually step-by-step.

**For Ubuntu/Debian:**

```bash
# Update packages
sudo apt-get update

# Install dependencies
sudo apt-get install -y build-essential tcl wget

# Download Redis
cd /tmp
wget http://download.redis.io/redis-stable.tar.gz
tar -xzf redis-stable.tar.gz
cd redis-stable

# Build and install
make
make test
sudo make install

# Create Redis user
sudo useradd --system --home /var/lib/redis --shell /bin/false redis

# Create directories
sudo mkdir -p /var/lib/redis /var/log/redis /etc/redis
sudo chown redis:redis /var/lib/redis /var/log/redis

# Copy configuration
sudo cp redis.conf /etc/redis/redis.conf
sudo chown redis:redis /etc/redis/redis.conf
sudo chmod 644 /etc/redis/redis.conf
```

**Create Systemd Service:**

Create `/etc/systemd/system/redis-server.service`:

```ini
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

[Install]
WantedBy=multi-user.target
```

**Enable and Start:**

```bash
sudo systemctl daemon-reload
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

---

### Option 4: Windows Installation

**Using WSL2 (Windows Subsystem for Linux):**

1. Install WSL2 with Ubuntu
2. Inside WSL, run: `sudo bash install-redis.sh`

**Using Docker Desktop:**

```bash
docker run -d `
  --name pustaka-redis `
  -p 6379:6379 `
  redis:7-alpine
```

---

## ✅ Verification

After installation, verify Redis is working:

```bash
bash verify-redis.sh
```

**Manual Verification:**

```bash
# Test PING command
redis-cli ping
# Expected output: PONG

# Check info
redis-cli INFO server

# Check database size
redis-cli DBSIZE

# Test SET/GET
redis-cli SET testkey "testvalue"
redis-cli GET testkey
# Expected output: testvalue
```

---

## 🔧 Configuration

### System Installation (`/etc/redis/redis.conf`)

Key settings:

```conf
# Network
port 6379
bind 127.0.0.1
protected-mode yes

# Memory
maxmemory 256mb
maxmemory-policy allkeys-lru

# Persistence (RDB)
save 900 1
save 300 10
save 60 10000

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log

# Database
databases 16
```

### Docker Installation

Customize Redis container:

```bash
docker run -d \
  --name pustaka-redis \
  -p 6379:6379 \
  -v redis-data:/data \
  -e REDIS_PASSWORD=yourpassword \
  --restart unless-stopped \
  redis:7-alpine \
  redis-server --requirepass yourpassword --appendonly yes
```

---

## 🔗 Node.js Connection

### Using ioredis (Recommended)

```javascript
const Redis = require('ioredis');

// Basic connection
const redis = new Redis({
  host: '127.0.0.1',
  port: 6379,
  db: 0
});

// With password
const redis = new Redis({
  host: '127.0.0.1',
  port: 6379,
  password: 'your-password',
  db: 0
});

// Connection string
const redis = new Redis('redis://:password@127.0.0.1:6379/0');
```

### Environment Variables

Create `.env`:

```env
# Redis Configuration
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=          # Leave empty if no password
REDIS_TIMEOUT=5000
```

In your Node.js app:

```javascript
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || 0),
  connectTimeout: parseInt(process.env.REDIS_TIMEOUT || 5000)
});
```

---

## 📊 Monitoring

### View Real-time Activity

```bash
redis-cli MONITOR
```

### Check Memory Usage

```bash
redis-cli INFO memory
```

### Monitor Commands

```bash
redis-cli
> INFO
> DBSIZE
> KEYS *
> FLUSHDB      # Clear current database (be careful!)
> SHUTDOWN     # Graceful shutdown
```

### System Monitoring

**System Installation:**

```bash
# View service status
systemctl status redis-server

# View logs
sudo journalctl -u redis-server -f

# Check process
ps aux | grep redis
```

**Docker Installation:**

```bash
# View logs
docker logs -f pustaka-redis

# View stats
docker stats pustaka-redis

# Inspect container
docker inspect pustaka-redis
```

---

## 🚨 Troubleshooting

### Redis Not Starting

**System Installation:**

```bash
# Check error log
sudo tail -50 /var/log/redis/redis-server.log

# Try starting manually
sudo -u redis /usr/local/bin/redis-server /etc/redis/redis.conf

# Check port conflict
sudo lsof -i :6379
```

**Docker Installation:**

```bash
# View container logs
docker logs pustaka-redis

# Check container status
docker ps -a | grep pustaka-redis

# Rebuild container
docker rm pustaka-redis
bash install-redis-docker.sh
```

### Cannot Connect to Redis

```bash
# Check if Redis is running
redis-cli ping

# Check port 6379
netstat -tulpn | grep 6379

# Check firewall
sudo ufw status
sudo ufw allow 6379/tcp

# Try different host
redis-cli -h 127.0.0.1 -p 6379 ping
redis-cli -h localhost -p 6379 ping
```

### Memory Issues

```bash
# Check current memory usage
redis-cli INFO memory

# Evict old keys (if maxmemory-policy is set)
redis-cli FLUSHDB ASYNC

# Reduce maxmemory setting
# Edit /etc/redis/redis.conf and restart
```

### Port Already in Use

If port 6379 is busy:

```bash
# Find what's using the port
sudo lsof -i :6379

# Kill the process (if not Redis)
sudo kill -9 <PID>

# Or use different port
redis-server --port 6380
```

---

## 🔐 Security Best Practices

### 1. Set Password

**System Installation:**

Edit `/etc/redis/redis.conf`:

```conf
requirepass your_strong_password
```

Restart:

```bash
sudo systemctl restart redis-server
```

**Docker:**

```bash
docker run -d \
  --name pustaka-redis \
  -p 6379:6379 \
  redis:7-alpine \
  redis-server --requirepass your_strong_password
```

### 2. Bind to Localhost Only

Ensure Redis only listens locally (already configured):

```conf
bind 127.0.0.1
protected-mode yes
```

### 3. Use Firewall

```bash
# Allow only local connections
sudo ufw allow from 127.0.0.1 to any port 6379

# Or specific IP
sudo ufw allow from 192.168.1.100 to any port 6379
```

### 4. Disable Dangerous Commands

```conf
# In redis.conf
rename-command FLUSHDB "FLUSHDB_DISABLED"
rename-command FLUSHALL "FLUSHALL_DISABLED"
rename-command CONFIG ""
```

---

## 📈 Performance Tuning

### Memory Optimization

```conf
# Set max memory
maxmemory 256mb

# Eviction policy (remove old keys)
maxmemory-policy allkeys-lru
```

### Persistence Tuning

```conf
# RDB snapshots (for production)
save 900 1
save 300 10
save 60 10000

# AOF (Append-Only File - more durable)
appendonly yes
appendfsync everysec

# Background save
stop-writes-on-bgsave-error yes
rdbcompression yes
```

### Connection Pooling

Remove from code:

```javascript
// ❌ Don't do this
for (let i = 0; i < 1000; i++) {
  new Redis().set(key, val);
}

// ✅ Do this
const redis = new Redis();
redis.set(key1, val1);
redis.set(key2, val2);
```

---

## 🐛 Debugging

### Enable Redis Debug Logging

```conf
loglevel debug
```

### Monitor Client Commands

```bash
redis-cli MONITOR
```

### Slow Query Log

```bash
# Enable in config
slowlog-log-slower-than 10000  # 10ms
slowlog-max-len 128

# View slow queries
redis-cli SLOWLOG GET 10
redis-cli SLOWLOG RESET
```

---

## 📚 Useful Links

- **Official Documentation:** https://redis.io/documentation
- **Redis Commands:** https://redis.io/commands
- **Node.js ioredis:** https://github.com/luin/ioredis
- **Docker Hub:** https://hub.docker.com/_/redis

---

## 🎯 Next Steps

1. ✅ Install Redis using one of the options above
2. ✅ Run `bash verify-redis.sh` to test
3. ✅ Configure connection in `.env`
4. ✅ Update Node.js to use Redis
5. ✅ Test with `redis-cli ping`
6. ✅ Monitor with `redis-cli MONITOR`

---

**Need Help?**

Check logs and verify installation:

```bash
# System installation
sudo tail -f /var/log/redis/redis-server.log

# Docker installation
docker logs -f pustaka-redis

# Run verification
bash verify-redis.sh
```
