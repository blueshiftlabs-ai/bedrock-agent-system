#!/bin/bash

# Start Distributed MCP Architecture with configurable providers

set -e

# Load environment variables
if [ -f .env.distributed ]; then
  export $(cat .env.distributed | grep -v '^#' | xargs)
fi

# Default values
VECTOR_DB_PROVIDER=${VECTOR_DB_PROVIDER:-opensearch}
GRAPH_DB_PROVIDER=${GRAPH_DB_PROVIDER:-neo4j}
STORAGE_PROVIDER=${STORAGE_PROVIDER:-postgresql}

echo "Starting Distributed MCP Architecture with:"
echo "  Vector DB: $VECTOR_DB_PROVIDER"
echo "  Graph DB: $GRAPH_DB_PROVIDER"
echo "  Storage: $STORAGE_PROVIDER"
echo ""

# Build compose command with appropriate files
COMPOSE_CMD="docker-compose -f docker-compose.distributed-base.yml"
COMPOSE_CMD="$COMPOSE_CMD -f docker-compose.vector-${VECTOR_DB_PROVIDER}.yml"
COMPOSE_CMD="$COMPOSE_CMD -f docker-compose.graph-${GRAPH_DB_PROVIDER}.yml"
COMPOSE_CMD="$COMPOSE_CMD -f docker-compose.storage-${STORAGE_PROVIDER}.yml"

# Add project name to avoid conflicts
COMPOSE_CMD="$COMPOSE_CMD -p mcp-distributed"

# Execute command
case "$1" in
  up)
    echo "Starting services..."
    $COMPOSE_CMD up -d --build
    ;;
  down)
    echo "Stopping services..."
    $COMPOSE_CMD down
    ;;
  logs)
    $COMPOSE_CMD logs -f ${@:2}
    ;;
  ps)
    $COMPOSE_CMD ps
    ;;
  restart)
    echo "Restarting services..."
    $COMPOSE_CMD restart ${@:2}
    ;;
  *)
    echo "Usage: $0 {up|down|logs|ps|restart}"
    exit 1
    ;;
esac