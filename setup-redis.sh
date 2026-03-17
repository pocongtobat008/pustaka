#!/bin/bash
# Make all installer scripts executable instantly

chmod +x install-redis.sh 2>/dev/null || true
chmod +x install-redis-quick.sh 2>/dev/null || true
chmod +x install-redis-simple.sh 2>/dev/null || true
chmod +x install-redis-docker.sh 2>/dev/null || true
chmod +x verify-redis.sh 2>/dev/null || true

echo "✅ All Redis installer scripts are now executable"
echo ""
echo "📋 Available installers:"
echo ""
echo "1. 🚀 SIMPLEST (Recommended):"
echo "   sudo bash install-redis-simple.sh"
echo ""
echo "2. ⚡ QUICK (Skip errors):"
echo "   sudo bash install-redis-quick.sh"
echo ""
echo "3. 🐳 DOCKER (Most reliable):"
echo "   bash install-redis-docker.sh"
echo ""
echo "4. 🔧 FULL (Complete):"
echo "   sudo bash install-redis.sh"
echo ""
echo "5. ✅ VERIFY (Test Redis):"
echo "   bash verify-redis.sh"
echo ""
