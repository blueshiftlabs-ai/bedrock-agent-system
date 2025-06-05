#!/bin/bash

# Script to test MCP servers with the MCP Inspector
# https://github.com/modelcontextprotocol/inspector

set -e

echo "🔍 MCP Inspector Setup and Testing Script"
echo "========================================="

# Check if MCP Inspector is installed
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js and npm first."
    exit 1
fi

# Function to test a server
test_mcp_server() {
    local name=$1
    local url=$2
    local port=$3
    
    echo ""
    echo "📡 Testing $name at $url"
    echo "-----------------------------------"
    
    # Check if server is running
    if curl -s -o /dev/null -w "%{http_code}" "$url/health" | grep -q "200\|404"; then
        echo "✅ Server is running on port $port"
        
        # Launch MCP Inspector for this server
        echo "🚀 Launching MCP Inspector..."
        echo "   URL: $url/mcp"
        echo ""
        echo "To test this server:"
        echo "1. Run: npx @modelcontextprotocol/inspector $url/mcp"
        echo "2. Or use the hosted version: https://inspector.modelcontextprotocol.com"
        echo "   - Enter server URL: $url/mcp"
        echo "   - Click 'Connect'"
        echo ""
    else
        echo "❌ Server is not running on port $port"
        echo "   Start it with the appropriate command"
    fi
}

# Test all our MCP servers
echo "🧪 Testing MCP Servers..."

# Memory Server
test_mcp_server "Memory Server" "http://localhost:4100" "4100"

# Storage Server (when implemented)
test_mcp_server "Storage Server" "http://localhost:4200" "4200"

# Bedrock Server (when implemented)
test_mcp_server "Bedrock Server" "http://localhost:4300" "4300"

# Hybrid Gateway Server
test_mcp_server "Hybrid Gateway" "http://localhost:4101" "4101"

echo ""
echo "📚 Quick Inspector Commands:"
echo "----------------------------"
echo "# Test Memory Server:"
echo "npx @modelcontextprotocol/inspector http://localhost:4100/mcp"
echo ""
echo "# Test Gateway Server:"
echo "npx @modelcontextprotocol/inspector http://localhost:4101/mcp"
echo ""
echo "# Or open the web inspector:"
echo "open https://inspector.modelcontextprotocol.com"
echo ""
echo "💡 Tips:"
echo "- The inspector will show all available tools"
echo "- You can test tool execution directly"
echo "- Check request/response formats"
echo "- Verify streaming responses"