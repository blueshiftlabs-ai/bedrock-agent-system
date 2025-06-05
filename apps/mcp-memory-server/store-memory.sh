#!/bin/bash

# Store memory via MCP protocol
curl -X POST http://localhost:4100/memory/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "store-memory",
      "arguments": {
        "content": "Dashboard Integration Plan for Bedrock Agent System:\n1. Connect MCP dashboard to monitor memory server at localhost:4100\n2. Implement server dropdown in logs view to filter by specific MCP servers\n3. Display list of available tools from each connected server\n4. Show shared memories across servers with search and filter capabilities\n5. Create comprehensive plan for mcp-hybrid-server to act as API gateway for all microservices",
        "type": "procedural",
        "tags": ["dashboard", "integration", "planning", "bedrock-agent-system"],
        "agent_id": "bedrock-agent-system",
        "content_type": "text"
      }
    }
  }' \
  --no-buffer \
  -N \
  -v