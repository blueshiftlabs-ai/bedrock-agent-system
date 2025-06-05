#!/bin/bash

# Setup script for local OpenSearch development
# This creates a local OpenSearch instance for memory server development

echo "🔍 Setting up local OpenSearch for memory server development..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is required but not installed. Please install Docker first."
    exit 1
fi

# Configuration
OPENSEARCH_VERSION="2.11.0"
CONTAINER_NAME="mcp-memory-opensearch"
OPENSEARCH_PORT=9200
OPENSEARCH_DASHBOARD_PORT=5601

# Stop and remove existing container if it exists
if [ "$(docker ps -aq -f name=$CONTAINER_NAME)" ]; then
    echo "🛑 Stopping existing OpenSearch container..."
    docker stop $CONTAINER_NAME
    docker rm $CONTAINER_NAME
fi

# Create Docker network if it doesn't exist
if ! docker network ls | grep -q "mcp-network"; then
    echo "🌐 Creating Docker network..."
    docker network create mcp-network
fi

# Start OpenSearch container
echo "🚀 Starting OpenSearch container..."
docker run -d \
  --name $CONTAINER_NAME \
  --network mcp-network \
  -p $OPENSEARCH_PORT:9200 \
  -p 9600:9600 \
  -e "discovery.type=single-node" \
  -e "plugins.security.disabled=true" \
  -e "OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m" \
  opensearchproject/opensearch:$OPENSEARCH_VERSION

# Wait for OpenSearch to be ready
echo "⏳ Waiting for OpenSearch to be ready..."
sleep 10

# Check if OpenSearch is running
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:$OPENSEARCH_PORT/_cluster/health > /dev/null; then
        echo "✅ OpenSearch is ready!"
        break
    fi
    attempt=$((attempt + 1))
    echo "⏳ Waiting for OpenSearch to start... (attempt $attempt/$max_attempts)"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "❌ OpenSearch failed to start. Check Docker logs:"
    echo "docker logs $CONTAINER_NAME"
    exit 1
fi

# Display cluster health
echo ""
echo "🏥 OpenSearch Cluster Health:"
curl -s http://localhost:$OPENSEARCH_PORT/_cluster/health | jq '.'

# Create initial indices
echo ""
echo "📊 Creating memory indices..."

# Create text memory index
curl -X PUT "http://localhost:$OPENSEARCH_PORT/memory-text" \
  -H 'Content-Type: application/json' \
  -d '{
    "settings": {
      "index": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
        "knn": true
      }
    }
  }'

# Create code memory index
curl -X PUT "http://localhost:$OPENSEARCH_PORT/memory-code" \
  -H 'Content-Type: application/json' \
  -d '{
    "settings": {
      "index": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
        "knn": true
      }
    }
  }'

echo ""
echo ""
echo "✅ OpenSearch setup complete!"
echo ""
echo "📝 Connection details:"
echo "  - OpenSearch URL: http://localhost:$OPENSEARCH_PORT"
echo "  - Container name: $CONTAINER_NAME"
echo ""
echo "🛠️  Useful commands:"
echo "  - View logs: docker logs -f $CONTAINER_NAME"
echo "  - Stop OpenSearch: docker stop $CONTAINER_NAME"
echo "  - Start OpenSearch: docker start $CONTAINER_NAME"
echo "  - Remove OpenSearch: docker rm $CONTAINER_NAME"
echo ""
echo "🔍 Test the connection:"
echo "  curl http://localhost:$OPENSEARCH_PORT/_cluster/health"
echo ""