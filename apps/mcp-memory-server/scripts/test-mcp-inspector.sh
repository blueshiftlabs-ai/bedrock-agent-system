#!/bin/bash

# Script to test MCP Memory Server with the MCP Inspector
# https://github.com/modelcontextprotocol/inspector

set -e

echo "🧠 MCP Memory Server Inspector Testing Script"
echo "============================================="

# Check if MCP Inspector is installed
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js and npm first."
    exit 1
fi

# Memory Server configuration
MEMORY_SERVER_PORT=4100
MEMORY_SERVER_URL="http://localhost:${MEMORY_SERVER_PORT}"

echo ""
echo "📡 Testing Memory Server at ${MEMORY_SERVER_URL}"
echo "-----------------------------------------------"

# Check if Memory Server is running
if curl -s -o /dev/null -w "%{http_code}" "${MEMORY_SERVER_URL}/memory/health" | grep -q "200"; then
    echo "✅ Memory Server is running on port ${MEMORY_SERVER_PORT}"
    
    echo ""
    echo "🔗 Available MCP Endpoints:"
    echo "   HTTP/Stream: ${MEMORY_SERVER_URL}/mcp"
    echo "   SSE:         ${MEMORY_SERVER_URL}/sse"
    echo ""
    
    echo "🚀 MCP Inspector Testing Options:"
    echo ""
    echo "1. Test HTTP/Streamable transport:"
    echo "   npx @modelcontextprotocol/inspector ${MEMORY_SERVER_URL}/mcp"
    echo ""
    echo "2. Test SSE transport:"
    echo "   npx @modelcontextprotocol/inspector ${MEMORY_SERVER_URL}/sse"
    echo ""
    echo "3. Or use the web inspector:"
    echo "   open https://inspector.modelcontextprotocol.com"
    echo "   - Enter HTTP URL: ${MEMORY_SERVER_URL}/mcp"
    echo "   - Enter SSE URL:  ${MEMORY_SERVER_URL}/sse"
    echo "   - Click 'Connect'"
    echo ""
    
    echo "📚 Available MCP Tools:"
    echo "   - store-memory: Store memories with semantic understanding"
    echo "   - retrieve-memories: Retrieve using semantic search"
    echo "   - add-connection: Create knowledge graph connections"
    echo "   - create-observation: Store agent observations"
    echo "   - consolidate-memories: Deduplicate and merge memories"
    echo "   - delete-memory: Remove memories"
    echo "   - get-memory-statistics: Get memory analytics"
    echo ""
    
    echo "💡 Testing Tips:"
    echo "- HTTP transport is best for testing and production deployment"
    echo "- SSE transport is best for Claude Code integration"
    echo "- The inspector will show all available tools with schemas"
    echo "- You can test tool execution directly in the inspector"
    echo "- Check both request/response formats and error handling"
    
else
    echo "❌ Memory Server is not running on port ${MEMORY_SERVER_PORT}"
    echo ""
    echo "To start the Memory Server:"
    echo "   npm run dev:local"
    echo ""
    echo "Or check if it's running on a different port:"
    echo "   ps aux | grep memory-server"
    echo "   lsof -i :${MEMORY_SERVER_PORT}"
fi