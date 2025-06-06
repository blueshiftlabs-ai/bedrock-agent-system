#!/bin/bash

# Script to launch MCP Inspector for testing the Memory Server
# https://github.com/modelcontextprotocol/inspector

set -e

# Memory Server configuration
MEMORY_SERVER_PORT=4100
MEMORY_SERVER_URL="http://localhost:${MEMORY_SERVER_PORT}"

echo "🧠 MCP Memory Server Inspector Launcher"
echo "======================================="

# Check if Memory Server is running
echo "📡 Checking if Memory Server is running..."
if ! curl -s -o /dev/null -w "%{http_code}" "${MEMORY_SERVER_URL}/memory/health" | grep -q "200"; then
    echo "❌ Memory Server is not running on port ${MEMORY_SERVER_PORT}"
    echo ""
    echo "Please start the Memory Server first:"
    echo "   npm run dev:local"
    echo ""
    exit 1
fi

echo "✅ Memory Server is running on port ${MEMORY_SERVER_PORT}"
echo ""

# Show available endpoints
echo "🔗 Available MCP Endpoints:"
echo "   HTTP/Stream: ${MEMORY_SERVER_URL}/mcp"
echo "   SSE:         ${MEMORY_SERVER_URL}/sse"
echo ""

# Ask user which transport to test
echo "Which transport would you like to test?"
echo "1) HTTP/Streamable (recommended for testing)"
echo "2) SSE (recommended for Claude Code integration)"
echo "3) Exit"
echo ""
read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        echo ""
        echo "🚀 Launching MCP Inspector with HTTP transport..."
        echo "URL: ${MEMORY_SERVER_URL}/mcp"
        echo ""
        npx @modelcontextprotocol/inspector "${MEMORY_SERVER_URL}/mcp"
        ;;
    2)
        echo ""
        echo "🚀 Launching MCP Inspector with SSE transport..."
        echo "URL: ${MEMORY_SERVER_URL}/sse"
        echo ""
        npx @modelcontextprotocol/inspector "${MEMORY_SERVER_URL}/sse"
        ;;
    3)
        echo "👋 Exiting..."
        exit 0
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac