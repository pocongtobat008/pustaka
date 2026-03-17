# 🚨 Redis Installation Troubleshooting

## ❌ "GPG error" or "The repository is not signed"

**Error:**
```
E: The repository 'https://dl.yarnpkg.com/debian stable InRelease' is not signed.
```

**Solution 1: Use the Simple Installer (Recommended)**

This bypasses the apt issue entirely:

```bash
sudo bash install-redis-simple.sh
```

**Solution 2: Fix apt sources**

Remove problematic repositories:

```bash
# Find and remove yarn repo
sudo rm /etc/apt/sources.list.d/yarn.list*
sudo apt-get update
```

Then run the installer:

```bash
sudo bash install-redis-quick.sh
```

**Solution 3: Skip GPG verification (Temporary)**

```bash
sudo apt-get update --allow-unauthenticated || true
sudo bash install-redis.sh
```

---

## 🔴 "redis-server: command not found"

**Solution:**

Make sure installation completed:

```bash
# Check if installed
which redis-server

# Manually add to PATH if needed
export PATH="/usr/local/bin:$PATH"
redis-server --version
```

---

## ⚠️ "Failed to start redis-server.service"

**Check what went wrong:**

```bash
# View service status
systemctl status redis-server

# View detailed logs
sudo journalctl -u redis-server -n 50

# Try starting manually to see errors
sudo -u redis /usr/local/bin/redis-server /etc/redis/redis.conf
```

**Common issues:**

1. **Port 6379 already in use:**
   ```bash
   sudo lsof -i :6379
   sudo kill -9 <PID>
   systemctl start redis-server
   ```

2. **Permission denied:**
   ```bash
   sudo chown redis:redis /var/redis /var/lib/redis /var/log/redis
   sudo chmod 755 /var/lib/redis /var/log/redis
   systemctl restart redis-server
   ```

3. **Config file issues:**
   ```bash
   sudo redis-server /etc/redis/redis.conf --test-memory 1
   ```

---

## ❌ "redis-cli: command not found"

Make sure full installation:

```bash
# Check if redis-cli exists
ls -la /usr/local/bin/redis-cli

# If not, compile failed - try again
cd /tmp/redis-stable
make install
```

---

## 🔗 "Cannot connect to Redis"

**Test connection:**

```bash
redis-cli ping
# Should return: PONG
```

**If that fails:**

```bash
# Check if Redis is running
ps aux | grep redis-server

# Start it
sudo systemctl start redis-server

# Check port
netstat -tulpn | grep 6379
```

---

## 📊 "Redis running but slow/unresponsive"

**Check memory usage:**

```bash
redis-cli INFO memory

# If memory full, clear old keys
redis-cli FLUSHDB
```

**Check slow operations:**

```bash
redis-cli SLOWLOG GET 10
```

---

## ✅ Quick Fixes (Try These First)

### Fix 1: Just use Docker

Skip all the complexity:

```bash
bash install-redis-docker.sh
```

### Fix 2: Use the simple installer

```bash
sudo bash install-redis-simple.sh
```

### Fix 3: Manual 2-minute setup

```bash
# Update without GPG errors
sudo apt-get update -o Acquire::AllowInsecureRepositories=true 2>/dev/null || true

# Install build tools
sudo apt-get install -y build-essential

# Download and build
cd /tmp
wget http://download.redis.io/redis-stable.tar.gz
tar -xzf redis-stable.tar.gz
cd redis-stable
make
sudo make install

# Test
redis-cli ping
```

---

## 🐳 If All Else Fails: Use Docker

Docker avoids all system-level issues:

```bash
# Requires: docker installed
docker run -d --name redis -p 6379:6379 redis:7-alpine
docker exec redis redis-cli ping
```

---

## 📋 Verification Checklist

After any installation attempt, check:

```bash
✅ redis-cli --version        # Should show version
✅ redis-cli ping            # Should show PONG
✅ redis-cli DBSIZE          # Should show: db0:keys=X
✅ redis-cli SET test "ok"   # Should show: OK
✅ redis-cli GET test        # Should show: ok
```

---

## 🆘 Still Not Working?

1. **Try Docker first** (most reliable):
   ```bash
   bash install-redis-docker.sh
   ```

2. **Show error logs:**
   ```bash
   sudo systemctl status redis-server
   sudo journalctl -u redis-server -n 100
   ```

3. **Check prerequisites:**
   ```bash
   gcc --version          # Should be installed
   make --version         # Should be installed
   wget --version         # Should be installed
   ```

4. **Share the output of:**
   ```bash
   sudo bash install-redis-simple.sh 2>&1 | tee /tmp/redis-install.log
   cat /tmp/redis-install.log
   ```

---

## 🔧 Alternative: Pre-compiled Redis

If compilation fails, use pre-compiled version:

```bash
# Download pre-compiled Redis
cd /tmp
curl -sSL https://github.com/redis/redis/releases/download/7.2.0/redis-7.2.0.tar.gz | tar -xz
cd redis-7.2.0
./src/redis-server --version

# Copy to system
sudo cp ./src/redis-server /usr/local/bin/
sudo cp ./src/redis-cli /usr/local/bin/
```

---

## 📚 Useful Links

- **Redis Official:** https://redis.io
- **Redis Issues:** https://github.com/redis/redis/issues
- **Ubuntu/Debian Repos:** https://launchpad.net/ubuntu/+source/redis-server

---

## 💡 Pro Tips

1. **Always use simple installer first:**
   ```bash
   sudo bash install-redis-simple.sh
   ```

2. **Docker is the safest option:**
   ```bash
   bash install-redis-docker.sh
   ```

3. **Monitor during installation:**
   ```bash
   tail -f /var/log/redis/redis-server.log
   # Or for Docker:
   docker logs -f redis
   ```

4. **Save your config:**
   ```bash
   sudo cp /etc/redis/redis.conf /etc/redis/redis.conf.backup
   ```

---

**Questions?** Check the main REDIS_INSTALLER_README.md for more details.
