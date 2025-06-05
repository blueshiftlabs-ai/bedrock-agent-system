# MCP Testing Guide

## Overview

This guide explains how to test MCP servers using various methods including the MCP Inspector, curl commands, and integration with Claude Code.

## Transport Type: STREAMABLE_HTTP

We use `STREAMABLE_HTTP` transport for our MCP servers because:
- **Fargate Compatible**: Works well in containerized environments
- **Stateless Mode**: Better scalability without session management
- **JSON Support**: Allows both streaming and JSON responses

## Testing Methods

### 1. MCP Inspector (Recommended)

The MCP Inspector is the official tool for testing MCP servers.

#### Web Version
1. Open https://inspector.modelcontextprotocol.com
2. Enter server URL: `http://localhost:4100/memory/mcp`
3. Click "Connect"
4. Browse and test available tools

#### CLI Version
```bash
# Install and run locally
npx @modelcontextprotocol/inspector http://localhost:4100/memory/mcp
```

### 2. Curl Testing

Test the MCP endpoint with JSON-RPC:

```bash
# List available tools
curl -X POST http://localhost:4100/memory/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {},
    "id": 1
  }'

# Call a specific tool
curl -X POST http://localhost:4100/memory/mcp \
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
- **MCP Endpoint**: `http://localhost:4100/memory/mcp`
- **Health Check**: `http://localhost:4100/memory/health`
- **REST API**: `http://localhost:4100/memory/*`

### Storage Server (Port 4200)
- **MCP Endpoint**: `http://localhost:4200/storage/mcp`
- **Health Check**: `http://localhost:4200/storage/health`
- **REST API**: `http://localhost:4200/storage/*`

### Bedrock Server (Port 4300)
- **MCP Endpoint**: `http://localhost:4300/bedrock/mcp`
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

1. **Configure Claude Desktop** (when available):
   ```json
   {
     "mcpServers": {
       "memory": {
         "command": "node",
         "args": ["path/to/memory-server"],
         "env": {
           "PORT": "4100"
         }
       }
     }
   }
   ```

2. **Direct HTTP Usage**: Our servers expose HTTP endpoints that can be called directly.

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