#!/bin/bash

# Comprehensive setup script for MCP Memory Server development
# Sets up OpenSearch, Gremlin Server, and all dependencies

echo "🧠 Setting up MCP Memory Server development environment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is required but not installed. Please install Docker first."
    exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is required but not installed. Please install pnpm first."
    exit 1
fi

# Create Docker network if it doesn't exist
if ! docker network ls | grep -q "mcp-network"; then
    echo "🌐 Creating Docker network..."
    docker network create mcp-network
fi

echo ""
echo "📦 Setting up services..."

# Setup OpenSearch
echo "🔍 Setting up OpenSearch..."
./scripts/setup-local-opensearch.sh

echo ""

# Setup Gremlin Server (Neptune alternative)
echo "🔗 Setting up Gremlin Server..."
./scripts/setup-local-gremlin.sh

echo ""

# Install dependencies
echo "📦 Installing Node.js dependencies..."
pnpm install

echo ""

# Create local environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "⚙️  Creating local environment file..."
    cp .env.example .env
    echo "✅ Created .env file - please update with your settings"
fi

# Wait for services to be ready
echo ""
echo "⏳ Waiting for all services to be ready..."
sleep 10

# Test connections
echo ""
echo "🧪 Testing service connections..."

# Test OpenSearch
echo -n "OpenSearch: "
if curl -s http://localhost:9200/_cluster/health > /dev/null; then
    echo "✅ Ready"
else
    echo "❌ Not ready"
fi

# Test Gremlin Server
echo -n "Gremlin Server: "
if docker logs mcp-memory-gremlin 2>&1 | grep -q "Gremlin Server configured with"; then
    echo "✅ Ready"
else
    echo "❌ Not ready"
fi

echo ""
echo ""
echo "🎉 MCP Memory Server development environment setup complete!"
echo ""
echo "📋 Summary:"
echo "  - OpenSearch: http://localhost:9200"
echo "  - Gremlin Server: ws://localhost:8182/gremlin"
echo "  - Memory Server will run on: http://localhost:3001"
echo ""
echo "🚀 Quick start commands:"
echo "  - Start memory server: pnpm dev"
echo "  - Run tests: pnpm test"
echo "  - View OpenSearch: curl http://localhost:9200/_cluster/health"
echo "  - View Gremlin logs: docker logs -f mcp-memory-gremlin"
echo ""
echo "🛠️  Development workflow:"
echo "  1. Update .env file with your AWS credentials"
echo "  2. Start the memory server: pnpm dev"
echo "  3. Test MCP endpoints:"
echo "     - GET http://localhost:3001/mcp/info"
echo "     - GET http://localhost:3001/mcp/tools"
echo "     - POST http://localhost:3001/memory/store"
echo ""
echo "📚 Documentation:"
echo "  - Memory Architecture: ../../docs/architecture/SOPHISTICATED_MEMORY_DESIGN.md"
echo "  - MCP Protocol: https://modelcontextprotocol.io"
echo ""
echo "🔧 Troubleshooting:"
echo "  - View all container logs: docker logs -f <container-name>"
echo "  - Stop all containers: docker stop mcp-memory-opensearch mcp-memory-gremlin"
echo "  - Remove containers: docker rm mcp-memory-opensearch mcp-memory-gremlin"
echo "  - Restart setup: ./scripts/setup-dev-environment.sh"
echo ""

# Create a simple test script
cat > scripts/test-memory-server.sh << 'EOF'
#!/bin/bash

# Simple test script for memory server

echo "🧪 Testing MCP Memory Server..."

BASE_URL="http://localhost:3001"

echo ""
echo "1. Testing health endpoint..."
curl -s "$BASE_URL/health" | jq '.' || echo "❌ Health check failed"

echo ""
echo "2. Testing MCP info endpoint..."
curl -s "$BASE_URL/mcp/info" | jq '.' || echo "❌ MCP info failed"

echo ""
echo "3. Testing MCP tools endpoint..."
curl -s "$BASE_URL/mcp/tools" | jq '.' || echo "❌ MCP tools failed"

echo ""
echo "4. Testing memory storage..."
curl -s -X POST "$BASE_URL/memory/store" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "This is a test memory for development",
    "type": "semantic",
    "content_type": "text",
    "agent_id": "test-agent",
    "tags": ["test", "development"]
  }' | jq '.' || echo "❌ Memory storage failed"

echo ""
echo "✅ Memory server tests completed!"
EOF

chmod +x scripts/test-memory-server.sh

echo "📋 Created test script: scripts/test-memory-server.sh"
echo ""
echo "🎯 Next steps:"
echo "  1. Start the memory server: pnpm dev"
echo "  2. Run tests: ./scripts/test-memory-server.sh"
echo ""