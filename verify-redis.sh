#!/bin/bash

# Redis Verification Script
# Tests Redis installation and connection

set -e

echo "================================"
echo "🔍 Redis Verification Script"
echo "================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

print_fail() {
    echo -e "${RED}✗${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Test 1: Check if redis-cli is available
echo "Test 1: Checking redis-cli availability..."
if command -v redis-cli &> /dev/null; then
    print_pass "redis-cli found"
    REDIS_CLI_VERSION=$(redis-cli --version)
    print_info "$REDIS_CLI_VERSION"
else
    print_fail "redis-cli not found - is Redis installed?"
    exit 1
fi

echo ""

# Test 2: Test connection
echo "Test 2: Testing Redis connection..."
if redis-cli ping > /dev/null 2>&1; then
    PING=$(redis-cli ping)
    print_pass "Connected to Redis ($PING)"
else
    print_fail "Cannot connect to Redis on 127.0.0.1:6379"
    echo "   Make sure Redis is running: systemctl start redis-server"
    exit 1
fi

echo ""

# Test 3: Get server info
echo "Test 3: Checking Redis server info..."
REDIS_INFO=$(redis-cli INFO server)
REDIS_VERSION=$(echo "$REDIS_INFO" | grep "redis_version:" | cut -d: -f2 | tr -d '\r')
OS=$(echo "$REDIS_INFO" | grep "os:" | cut -d: -f2 | tr -d '\r')
UPTIME=$(echo "$REDIS_INFO" | grep "uptime_in_seconds:" | cut -d: -f2 | tr -d '\r')

print_pass "Redis version: $REDIS_VERSION"
print_info "OS: $OS"
print_info "Uptime: $UPTIME seconds"

echo ""

# Test 4: Check database size
echo "Test 4: Checking database size..."
DBSIZE=$(redis-cli DBSIZE | cut -d: -f2)
print_pass "Database size: $DBSIZE"

echo ""

# Test 5: Test basic operations
echo "Test 5: Testing basic operations..."
TEST_KEY="pustaka_test_key"
TEST_VALUE="test_value_$(date +%s)"

redis-cli SET "$TEST_KEY" "$TEST_VALUE" > /dev/null
VALUE=$(redis-cli GET "$TEST_KEY")

if [ "$VALUE" = "$TEST_VALUE" ]; then
    print_pass "SET/GET operations working"
else
    print_fail "SET/GET operations failed"
    exit 1
fi

# Clean up
redis-cli DEL "$TEST_KEY" > /dev/null

echo ""

# Test 6: Check memory usage
echo "Test 6: Checking memory usage..."
MEMORY_INFO=$(redis-cli INFO memory)
MEMORY_USED=$(echo "$MEMORY_INFO" | grep "used_memory_human:" | cut -d: -f2 | tr -d '\r')
MEMORY_MAX=$(echo "$MEMORY_INFO" | grep "maxmemory_human:" | cut -d: -f2 | tr -d '\r')

print_info "Memory used: $MEMORY_USED"
if [ "$MEMORY_MAX" != "0B" ]; then
    print_info "Memory limit: $MEMORY_MAX"
fi

echo ""

# Test 7: Check persistence
echo "Test 7: Checking persistence..."
PERSISTENCE=$(redis-cli CONFIG GET save)
if echo "$PERSISTENCE" | grep -q "3600"; then
    print_pass "RDB persistence is enabled"
else
    print_warn "RDB persistence may be disabled"
fi

echo ""

# Test 8: Test list operations (used by job queue)
echo "Test 8: Testing list operations (for job queue)..."
LIST_KEY="pustaka_test_list"

redis-cli DEL "$LIST_KEY" > /dev/null
redis-cli LPUSH "$LIST_KEY" "item1" "item2" "item3" > /dev/null
LIST_LEN=$(redis-cli LLEN "$LIST_KEY")

if [ "$LIST_LEN" = "3" ]; then
    print_pass "List operations working (queue ready)"
else
    print_fail "List operations failed"
    exit 1
fi

redis-cli DEL "$LIST_KEY" > /dev/null

echo ""

# Test 9: Test hash operations (used by caching)
echo "Test 9: Testing hash operations (for caching)..."
HASH_KEY="pustaka_test_hash"

redis-cli DEL "$HASH_KEY" > /dev/null
redis-cli HSET "$HASH_KEY" "field1" "value1" "field2" "value2" > /dev/null
HASH_LEN=$(redis-cli HLEN "$HASH_KEY")

if [ "$HASH_LEN" = "2" ]; then
    print_pass "Hash operations working (caching ready)"
else
    print_fail "Hash operations failed"
    exit 1
fi

redis-cli DEL "$HASH_KEY" > /dev/null

echo ""

# Test 10: Check connected clients
echo "Test 10: Checking connected clients..."
CLIENT_INFO=$(redis-cli INFO clients)
CONNECTED_CLIENTS=$(echo "$CLIENT_INFO" | grep "connected_clients:" | cut -d: -f2 | tr -d '\r')
print_info "Connected clients: $CONNECTED_CLIENTS"

echo ""

# Summary
echo "================================"
echo "✅ Redis Verification Complete!"
echo "================================"
echo ""
echo "📊 Summary:"
echo "   • Redis Status: RUNNING ✓"
echo "   • Version: $REDIS_VERSION"
echo "   • Memory: $MEMORY_USED"
echo "   • Database: $DBSIZE items"
echo "   • Uptime: $UPTIME seconds"
echo ""
echo "🚀 Ready for Pustaka Application!"
echo ""

# Connection string for Node.js
echo -e "${BLUE}Node.js Connection String:${NC}"
echo "   const redis = new Redis('redis://127.0.0.1:6379');"
echo ""

# .env configuration
echo -e "${BLUE}.env Configuration:${NC}"
echo "   REDIS_HOST=127.0.0.1"
echo "   REDIS_PORT=6379"
echo "   REDIS_DB=0"
echo ""
