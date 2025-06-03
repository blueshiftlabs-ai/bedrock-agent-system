# Bi-Directional MCP Communication Setup

This document provides comprehensive guidance for setting up and using the bi-directional MCP (Model Context Protocol) communication system in the Hybrid MCP Server.

## Overview

The Hybrid MCP Server supports three operational modes:

1. **Server Mode**: Acts as an MCP server, exposing tools to external MCP clients
2. **Client Mode**: Acts as an MCP client, connecting to external MCP servers
3. **Hybrid Mode**: Simultaneously acts as both server and client

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Hybrid MCP Server                                   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐                    ┌─────────────────────────┐  │
│  │   MCP Server    │                    │      MCP Client         │  │
│  │                 │                    │                         │  │
│  │ • Tool Registry │                    │ • External Connections │  │
│  │ • HTTP+SSE      │                    │ • STDIO/HTTP Transport  │  │
│  │ • WebSocket     │                    │ • Auto-reconnection    │  │
│  │ • Tool Exposure │                    │ • Health Monitoring     │  │
│  └─────────────────┘                    └─────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                    Lifecycle Management                                │
│                                                                         │
│ • Configuration Validation  • Health Checks  • Graceful Shutdown       │
│ • Connection Management     • Error Handling • Metrics Collection      │
└─────────────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Copy the example environment file
cp .env.example .env

# Edit configuration
nano .env
```

### Key Configuration Options

#### Server Mode Configuration
```bash
MCP_SERVER_ENABLED=true
MCP_SERVER_NAME=hybrid-mcp-server
MCP_SERVER_VERSION=1.0.0
MCP_SERVER_ENDPOINT=/mcp
MCP_SERVER_TRANSPORT_TYPE=http+sse
MCP_SERVER_ENABLE_CORS=true
MCP_SERVER_MAX_CONNECTIONS=100
```

#### Client Mode Configuration
```bash
MCP_CLIENT_ENABLED=true
MCP_CLIENT_CONFIG_PATH=.mcp/servers.json
MCP_CLIENT_AUTO_CONNECT=true
MCP_CLIENT_CONNECTION_RETRIES=3
MCP_CLIENT_HEALTH_CHECK_INTERVAL=60000
```

#### Global MCP Configuration
```bash
MCP_PROTOCOL_VERSION=2024-11-05
MCP_ENABLE_METRICS=true
MCP_ENABLE_LOGGING=true
MCP_LOG_LEVEL=info
```

## Setup Instructions

### 1. Initial Setup

```bash
# Install dependencies
pnpm install

# Initialize MCP configuration
./scripts/mcp-config.sh init

# Create environment file
cp .env.example .env
```

### 2. Configure MCP Servers (Client Mode)

```bash
# Add a filesystem MCP server
./scripts/mcp-config.sh add filesystem "Local Files"

# Add sequential thinking server
./scripts/mcp-config.sh add sequential-thinking

# Add Brave search (requires API key)
./scripts/mcp-config.sh add brave-search

# List configured servers
./scripts/mcp-config.sh list

# Enable a server
./scripts/mcp-config.sh enable filesystem-1234567890

# Test configuration
./scripts/mcp-config.sh validate
```

### 3. Start the Server

#### Option A: Using the Startup Script
```bash
# Server mode only
./scripts/start-mcp-server.sh server development

# Client mode only
./scripts/start-mcp-server.sh client development

# Hybrid mode (both server and client)
./scripts/start-mcp-server.sh hybrid development
```

#### Option B: Using Docker Compose
```bash
# Server mode
docker-compose -f docker-compose.mcp.yml up mcp-server

# Client mode
docker-compose -f docker-compose.mcp.yml --profile client up mcp-client

# Hybrid mode
docker-compose -f docker-compose.mcp.yml --profile hybrid up mcp-hybrid

# With monitoring
docker-compose -f docker-compose.mcp.yml --profile monitoring up
```

#### Option C: Direct npm/pnpm Commands
```bash
# Development mode
pnpm start:dev

# Production mode
pnpm build
pnpm start:prod
```

## Usage Examples

### Server Mode Usage

When running in server mode, the MCP server exposes tools at the `/mcp` endpoint:

```bash
# Check server status
curl http://localhost:3000/api/v1/health

# MCP endpoint (for MCP clients)
# Connect your MCP client to: http://localhost:3000/mcp
```

Example MCP client configuration to connect to this server:
```json
{
  "servers": {
    "hybrid-mcp-server": {
      "command": "curl",
      "args": ["-X", "POST", "http://localhost:3000/mcp"],
      "transport": "http"
    }
  }
}
```

### Client Mode Usage

When running in client mode, the server connects to external MCP servers:

```bash
# Check client connections
curl http://localhost:3000/api/v1/health/mcp

# Get connection details
curl http://localhost:3000/api/v1/health/mcp/connections

# Test specific connection
curl http://localhost:3000/api/v1/health/mcp/test/filesystem-1234567890
```

### Hybrid Mode Usage

In hybrid mode, both server and client functionality are available:

```bash
# Server health (serving tools to external clients)
curl http://localhost:3000/api/v1/health

# Client health (connections to external servers)
curl http://localhost:3000/api/v1/health/mcp/connections

# Overall MCP status
curl http://localhost:3000/api/v1/health/mcp
```

## Health Monitoring

### Health Check Endpoints

- `GET /api/v1/health` - Overall server health
- `GET /api/v1/health/mcp` - Detailed MCP health report
- `GET /api/v1/health/mcp/connections` - MCP connection status
- `GET /api/v1/health/mcp/test/:connectionId` - Test specific connection

### Health Check Response Example

```json
{
  "status": "ok",
  "info": {
    "mcp_lifecycle": {
      "status": "up",
      "server": {
        "enabled": true,
        "running": true,
        "connections": 5,
        "uptime": 3600000
      },
      "client": {
        "enabled": true,
        "connections": [
          {
            "id": "filesystem-1234567890",
            "name": "Filesystem",
            "status": "connected",
            "connectedAt": "2024-01-01T12:00:00.000Z"
          }
        ],
        "totalConnections": 1,
        "activeConnections": 1
      },
      "overall": {
        "status": "healthy",
        "uptime": 3600000,
        "startedAt": "2024-01-01T11:00:00.000Z"
      }
    }
  }
}
```

## Configuration Management

### MCP Server Configuration (Client Mode)

The `.mcp/servers.json` file contains the configuration for external MCP servers:

```json
{
  "version": "1.0.0",
  "servers": [
    {
      "id": "filesystem-1234567890",
      "name": "Filesystem",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-filesystem", "/path/to/directory"],
      "enabled": true,
      "autoConnect": true
    },
    {
      "id": "sequential-thinking-1234567890",
      "name": "Sequential Thinking",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-sequential-thinking"],
      "enabled": false,
      "autoConnect": false
    }
  ],
  "lastUpdated": "2024-01-01T12:00:00.000Z"
}
```

### Configuration Script Commands

```bash
# Initialize configuration
./scripts/mcp-config.sh init

# Add servers
./scripts/mcp-config.sh add filesystem "Local Files"
./scripts/mcp-config.sh add sequential-thinking
./scripts/mcp-config.sh add brave-search "Web Search"
./scripts/mcp-config.sh add custom "My Custom Server"

# Manage servers
./scripts/mcp-config.sh list
./scripts/mcp-config.sh enable <server-id>
./scripts/mcp-config.sh disable <server-id>
./scripts/mcp-config.sh remove <server-id>

# Test and validate
./scripts/mcp-config.sh test <server-id>
./scripts/mcp-config.sh validate
./scripts/mcp-config.sh status

# Import/export
./scripts/mcp-config.sh export backup.json
./scripts/mcp-config.sh import backup.json
```

## Available MCP Servers

### Built-in Server Tools

When running in server mode, the following tools are exposed:

- **Code Analysis**: Analyze code structure, complexity, and patterns
- **Database Analysis**: Analyze database schemas and relationships
- **Document Retrieval**: Search and retrieve documents
- **Knowledge Graph**: Build and query knowledge graphs

### Compatible External Servers

The client can connect to various MCP servers:

1. **@anthropic-ai/mcp-server-filesystem**
   - Provides file system access
   - Read, write, and navigate files and directories

2. **@anthropic-ai/mcp-server-sequential-thinking**
   - Enables step-by-step reasoning
   - Breaks down complex problems

3. **@anthropic-ai/mcp-server-brave-search**
   - Web search capabilities
   - Requires Brave API key

4. **Custom MCP Servers**
   - Any MCP-compatible server
   - Support for STDIO and HTTP transports

## Troubleshooting

### Common Issues

#### 1. Configuration Validation Failures
```bash
# Check configuration syntax
./scripts/mcp-config.sh validate

# Verify environment variables
env | grep MCP_

# Check log output
tail -f logs/mcp-hybrid-server.log
```

#### 2. Connection Issues
```bash
# Test specific connection
./scripts/mcp-config.sh test <server-id>

# Check health status
curl http://localhost:3000/api/v1/health/mcp/connections

# Review connection logs
curl http://localhost:3000/api/v1/health/mcp
```

#### 3. Port Conflicts
```bash
# Check if port is in use
lsof -i :3000

# Change port in environment
export PORT=3001
```

#### 4. Permission Issues
```bash
# Check script permissions
ls -la scripts/

# Make scripts executable
chmod +x scripts/*.sh
```

### Debug Mode

Enable debug logging:

```bash
export LOG_LEVEL=debug
export MCP_ENABLE_LOGGING=true
pnpm start:dev
```

### Log Files

Logs are written to:
- Console output (stdout/stderr)
- `logs/mcp-hybrid-server.log` (if file logging enabled)
- Docker logs: `docker logs mcp-hybrid-server`

## Performance Considerations

### Resource Usage

- **Memory**: ~100-500MB depending on configuration
- **CPU**: Low usage, spikes during tool execution
- **Network**: Dependent on MCP client connections and tool usage

### Optimization

1. **Connection Pooling**: Limit `MCP_SERVER_MAX_CONNECTIONS`
2. **Caching**: Enable `MCP_TOOLS_ENABLE_CACHING`
3. **Timeouts**: Adjust `MCP_CLIENT_REQUEST_TIMEOUT`
4. **Health Checks**: Increase `MCP_CLIENT_HEALTH_CHECK_INTERVAL` for production

### Monitoring

Enable monitoring with Docker Compose:

```bash
docker-compose -f docker-compose.mcp.yml --profile monitoring up
```

Access:
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3003 (admin/admin)

## Security Considerations

### Access Control

1. **CORS Configuration**: Configure `MCP_SERVER_ENABLE_CORS`
2. **Network Access**: Restrict port access using firewalls
3. **Environment Variables**: Secure sensitive configuration
4. **File Permissions**: Protect configuration files

### Best Practices

1. **Use HTTPS**: In production, terminate SSL at load balancer
2. **Validate Inputs**: All tool inputs are validated
3. **Rate Limiting**: Implement at reverse proxy level
4. **Audit Logging**: Enable comprehensive logging
5. **Regular Updates**: Keep dependencies updated

## Development

### Adding New Tools

1. Create tool implementation in `src/tools/implementations/`
2. Register tool in `src/tools/tool.module.ts`
3. Update tool registry in `src/tools/registry/tool.registry.ts`

### Adding MCP Client Support

1. Implement transport in `src/integrations/mcp-client/transports/`
2. Update client service in `src/integrations/mcp-client/services/`
3. Add configuration options

### Testing

```bash
# Unit tests
pnpm test

# Integration tests
pnpm test:e2e

# Test specific functionality
pnpm test:mcp
```

## Support

For issues and questions:

1. Check the logs for error messages
2. Validate configuration using provided scripts
3. Review health check endpoints
4. Consult the MCP protocol documentation
5. File issues in the project repository

## References

- [MCP Protocol Specification](https://spec.modelcontextprotocol.io/)
- [NestJS Documentation](https://nestjs.com/)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [Docker Compose Reference](https://docs.docker.com/compose/)