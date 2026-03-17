# ⚡ Redis Installation - Quick Start (After Error)

You got a GPG signature error. Don't worry! Here are your options in order of simplicity:

---

## 🎯 Option 1: Use the Simple Installer ⭐ RECOMMENDED

This is the fastest and most reliable:

```bash
sudo bash install-redis-simple.sh
```

**Why it works:**
- ✅ Bypasses all apt repository issues
- ✅ Automatic build from source
- ✅ 2-5 minutes to completion
- ✅ Works even with broken apt

**Expected output:**
```
✅ Redis installed and running!
Connect: redis-cli
Check:   systemctl status redis-server
```

---

## 🐳 Option 2: Use Docker (Safest)

No compilation, no apt issues:

```bash
bash install-redis-docker.sh
```

**Requires:** Docker installed (`docker --version`)

**Advantages:**
- ✅ No system dependencies
- ✅ Instant start
- ✅ Easy to remove/reinstall
- ✅ Perfect for development

---

## ⚡ Option 3: Use Quick Installer

If simple installer doesn't work:

```bash
sudo bash install-redis-quick.sh
```

**Features:**
- ✅ Automatic retry on errors
- ✅ Better error handling
- ✅ Detects existing installations

---

## 🔧 Option 4: Fix apt First (Advanced)

If you want to use the full installer:

```bash
# Remove problematic repositories
sudo rm /etc/apt/sources.list.d/yarn.list* 2>/dev/null || true

# Fix GPG errors
sudo apt-get update --allow-unauthenticated 2>/dev/null || true

# Now install
sudo bash install-redis.sh
```

---

## ✅ Verify Installation

After any installation method, verify it works:

```bash
redis-cli ping
# Expected: PONG

redis-cli DBSIZE
# Expected: db0:keys=0 (or any number)
```

Or run the full verification:

```bash
bash verify-redis.sh
```

---

## 🚀 What's Next?

Once Redis is running:

1. **Check status:**
   ```bash
   systemctl status redis-server      # For system install
   docker ps | grep redis             # For Docker
   ```

2. **Access Redis:**
   ```bash
   redis-cli
   > PING
   > INFO
   > QUIT
   ```

3. **Configure in Python/Node.js:**
   ```javascript
   // Node.js example
   const Redis = require('ioredis');
   const redis = new Redis('redis://127.0.0.1:6379');
   redis.ping().then(() => console.log('Connected!'));
   ```

4. **Update `.env`:**
   ```
   REDIS_HOST=127.0.0.1
   REDIS_PORT=6379
   ```

---

## 🆘 Troubleshooting

**If nothing works, try:**

```bash
# Simplest possible: use Docker
docker run -d --name redis -p 6379:6379 redis:7-alpine
docker exec redis redis-cli ping
```

**If Docker also fails:**

Check your internet connection and try again:

```bash
# Test download capability
curl -I http://download.redis.io/redis-stable.tar.gz

# If that works, try simple installer again
sudo bash install-redis-simple.sh
```

---

## 📚 Full Documentation

See detailed docs:

- **Detailed Guide:** `REDIS_INSTALLER_README.md`
- **Troubleshooting:** `REDIS_TROUBLESHOOTING.md`

---

## 💡 Remember

**The goal:** Get Redis running at `127.0.0.1:6379`

**How to verify:**
```bash
redis-cli ping    # Should return: PONG
```

**That's it!** Redis is now ready for Pustaka.

---

## 🎯 Recommended Path

1. Try simple installer ← START HERE
2. If fails, try Docker
3. Then try quick installer
4. Last resort: manual fix + full installer

**Most users:** Simple installer works first try ✅

**If stuck:** Use Docker 🐳
