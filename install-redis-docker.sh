#!/bin/bash

# Redis Docker Setup for Pustaka
# Run Redis using Docker container instead of system installation

set -e

echo "================================"
echo "🐳 Redis Docker Setup"
echo "================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    echo "Install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

REDIS_CONTAINER="pustaka-redis"
REDIS_PORT=6379
REDIS_PASSWORD="${REDIS_PASSWORD:-}"  # Optional password

echo "📦 Checking for existing Redis container..."

# Stop & remove existing container if it exists
if docker ps -a --format '{{.Names}}' | grep -q "^${REDIS_CONTAINER}$"; then
    echo "Found existing Redis container, removing..."
    docker stop "${REDIS_CONTAINER}" 2>/dev/null || true
    docker rm "${REDIS_CONTAINER}" 2>/dev/null || true
fi

echo ""
echo "🚀 Starting Redis container..."

# Run Redis with Docker
if [ -z "$REDIS_PASSWORD" ]; then
    docker run -d \
        --name "${REDIS_CONTAINER}" \
        -p "${REDIS_PORT}:6379" \
        -v redis-data:/data \
        --restart unless-stopped \
        redis:7-alpine \
        redis-server --appendonly yes --loglevel notice
else
    docker run -d \
        --name "${REDIS_CONTAINER}" \
        -p "${REDIS_PORT}:6379" \
        -v redis-data:/data \
        --restart unless-stopped \
        redis:7-alpine \
        redis-server --requirepass "${REDIS_PASSWORD}" --appendonly yes --loglevel notice
fi

sleep 2

if docker ps --format '{{.Names}}' | grep -q "^${REDIS_CONTAINER}$"; then
    echo ""
    echo "✅ Redis Docker container started successfully!"
    echo ""
    echo "📊 Container Info:"
    docker ps --filter "name=${REDIS_CONTAINER}" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo "🔗 Connection Details:"
    echo "   • Host: 127.0.0.1"
    echo "   • Port: ${REDIS_PORT}"
    if [ -n "$REDIS_PASSWORD" ]; then
        echo "   • Password: ${REDIS_PASSWORD}"
    fi
    echo ""
    echo "📋 Useful Commands:"
    echo "   • View logs:     docker logs -f ${REDIS_CONTAINER}"
    echo "   • Stop Redis:    docker stop ${REDIS_CONTAINER}"
    echo "   • Start Redis:   docker start ${REDIS_CONTAINER}"
    echo "   • Shell access:  docker exec -it ${REDIS_CONTAINER} sh"
    echo "   • Redis CLI:     docker exec -it ${REDIS_CONTAINER} redis-cli"
    echo "   • Test PING:     docker exec ${REDIS_CONTAINER} redis-cli PING"
    echo ""
    
    # Test connection
    PING=$(docker exec "${REDIS_CONTAINER}" redis-cli PING)
    if [ "$PING" = "PONG" ]; then
        echo "✨ Redis is responding to commands!"
    fi
else
    echo "❌ Failed to start Redis container"
    exit 1
fi
