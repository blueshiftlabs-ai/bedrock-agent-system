# MCP Testing Guide

## Overview

This guide explains how to test MCP servers using various methods including the MCP Inspector, curl commands, and integration with Claude Code.

## Transport Types: Multi-Transport Support

We support multiple MCP transports for different use cases:

### STREAMABLE_HTTP (`/memory/mcp`)
- **Use Case**: HTTP clients, testing, Fargate deployment
- **Features**: Stateless mode, JSON responses, streaming support
- **Best For**: Production deployments, web clients, curl testing

### SSE (`/memory/sse`) 
- **Use Case**: Claude Code, browsers, real-time applications
- **Features**: Server-Sent Events, ping/keepalive, event streaming
- **Best For**: Claude Code integration, web dashboards

### STDIO
- **Use Case**: CLI tools, local development, process-based connections
- **Features**: Standard input/output communication
- **Best For**: Local CLI tools, development scripts

## Testing Methods

### 1. MCP Inspector (Recommended)

The MCP Inspector is the official tool for testing MCP servers.

#### Web Version
1. Open https://inspector.modelcontextprotocol.com
2. Choose transport and enter URL:
   - **HTTP**: `http://localhost:4100/mcp`
   - **SSE**: `http://localhost:4100/sse`
3. Click "Connect"
4. Browse and test available tools

#### CLI Version
```bash
# Test HTTP transport
npx @modelcontextprotocol/inspector http://localhost:4100/mcp

# Test SSE transport
npx @modelcontextprotocol/inspector http://localhost:4100/sse
```

### 2. Curl Testing

#### HTTP/Streamable Transport
Test the HTTP MCP endpoint with JSON-RPC:

```bash
# List available tools
curl -X POST http://localhost:4100/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {},
    "id": 1
  }'

# Call a specific tool
curl -X POST http://localhost:4100/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "store-memory",
      "arguments": {
        "content": "Test memory content",
        "type": "episodic",
        "tags": ["test"]
      }
    },
    "id": 2
  }'
```

#### SSE Transport
Test the SSE endpoint:

```bash
# Connect to SSE stream
curl -N -H "Accept: text/event-stream" \
  http://localhost:4100/sse

# Send JSON-RPC via POST (in another terminal)
curl -X POST http://localhost:4100/sse \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {},
    "id": 1
  }'
```

### 3. Test Script

Use our automated test script:

```bash
./scripts/test-mcp-inspector.sh
```

This script:
- Checks if servers are running
- Provides commands to launch MCP Inspector
- Shows health check status

## MCP Endpoints

### Memory Server (Port 4100)
- **MCP HTTP**: `http://localhost:4100/mcp`
- **MCP SSE**: `http://localhost:4100/sse`
- **Health Check**: `http://localhost:4100/memory/health`
- **REST API**: `http://localhost:4100/memory/*`

### Storage Server (Port 4200)
- **MCP HTTP**: `http://localhost:4200/storage/mcp`
- **MCP SSE**: `http://localhost:4200/storage/sse`
- **Health Check**: `http://localhost:4200/storage/health`
- **REST API**: `http://localhost:4200/storage/*`

### Bedrock Server (Port 4300)
- **MCP HTTP**: `http://localhost:4300/bedrock/mcp`
- **MCP SSE**: `http://localhost:4300/bedrock/sse`
- **Health Check**: `http://localhost:4300/bedrock/health`
- **REST API**: `http://localhost:4300/bedrock/*`

### Available Tools
1. **store-memory**: Store memories with semantic understanding
2. **retrieve-memories**: Retrieve using semantic search
3. **add-connection**: Create knowledge graph connections
4. **create-observation**: Store agent observations
5. **consolidate-memories**: Deduplicate and merge memories
6. **delete-memory**: Remove memories
7. **get-memory-statistics**: Get memory analytics

## Integration with Claude Code

To use these MCP servers with Claude Code:

### 1. SSE Transport (Recommended for Claude Code)
Use the SSE endpoint for real-time integration:
- **Memory Server SSE**: `http://localhost:4100/sse`
- **Features**: Event streaming, automatic reconnection, keepalive pings

### 2. STDIO Transport (For Process-Based)
Configure for process-based connection:
```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": ["dist/main.js"],
      "cwd": "/path/to/mcp-memory-server",
      "env": {
        "NODE_ENV": "development",
        "USE_LOCAL_STORAGE": "true"
      }
    }
  }
}
```

### 3. HTTP Transport (For Testing)
Direct HTTP calls for testing and debugging:
- **Memory Server HTTP**: `http://localhost:4100/mcp`

## Troubleshooting

### Server Not Responding
1. Check if server is running: `ps aux | grep memory-server`
2. Check logs for errors
3. Verify port is not in use: `lsof -i :4100`

### Invalid Transport Error
- Ensure using `McpTransportType.STREAMABLE_HTTP`
- Check MCP-Nest version is up to date
- Verify configuration matches documentation

### Tool Not Found
- Ensure tools are properly decorated with `@Tool()`
- Check tool name matches exactly
- Verify tool service is provided in module

## Dashboard Integration

The MCP Dashboard will include built-in inspector functionality:
- Tool browser with live testing
- Request/response viewer
- Server health monitoring
- Performance metrics