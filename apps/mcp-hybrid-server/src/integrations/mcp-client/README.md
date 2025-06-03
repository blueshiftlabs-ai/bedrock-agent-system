# MCP Client Integration System

A comprehensive MCP (Model Context Protocol) client integration system for the mcp-hybrid-server that allows connecting to external MCP servers, discovering and using their tools, and maintaining bi-directional communication.

## Features

- **Multi-Server Connections**: Connect to multiple external MCP servers simultaneously
- **Tool Discovery**: Automatically discover and register tools from external servers
- **Bi-directional Communication**: Serve your own tools while using external tools
- **Transport Support**: Support for stdio, HTTP, and WebSocket transports
- **Auto-reconnection**: Automatic reconnection with exponential backoff
- **CLI Management**: Command-line interface similar to `claude mcp add`
- **Health Monitoring**: Continuous health checks for connected servers
- **Configuration Management**: Persistent configuration storage

## Architecture

### Core Components

1. **MCPClientService**: Manages connections to external MCP servers
2. **MCPConfigService**: Handles server configuration persistence
3. **ToolDiscoveryService**: Discovers and registers external tools
4. **AutoConnectionService**: Manages automatic connections and reconnections
5. **ExternalToolAdapter**: Adapts external tools to the local tool interface
6. **MCPCliService**: Provides CLI commands for management

### Transport Layer

- **StdioTransport**: Communicates with processes via stdin/stdout
- **HttpTransport**: HTTP-based communication
- **WebSocketTransport**: WebSocket-based communication (extensible)

## Quick Start

### 1. Add an MCP Server

```bash
# Add sequential thinking server
pnpm mcp:dev add sequential-thinking \
  --transport stdio \
  --command npx \
  --args -y @anthropic-ai/mcp-server-sequential-thinking \
  --auto-connect

# Add filesystem server
pnpm mcp:dev add filesystem \
  --transport stdio \
  --command npx \
  --args -y @anthropic-ai/mcp-server-filesystem /path/to/directory

# Add HTTP-based server
pnpm mcp:dev add my-server \
  --transport http \
  --url http://localhost:8080/mcp
```

### 2. Connect to Servers

```bash
# Connect to a specific server
pnpm mcp:dev connect sequential-thinking

# List all servers and their status
pnpm mcp:dev list --verbose

# Show system status
pnpm mcp:dev status
```

### 3. Discover and Use Tools

```bash
# Discover tools from all connected servers
pnpm mcp:dev discover

# List available tools
pnpm mcp:dev tools

# List tools from a specific server
pnpm mcp:dev tools sequential-thinking

# Test a tool
pnpm mcp:dev test sequential_thinking_sequentialThinking \
  --params '{"thought": "Let me think about this problem", "nextThoughtNeeded": true}'
```

## CLI Commands

### Server Management

```bash
# Add server
pnpm mcp:dev add <name> [options]
  -t, --transport <type>     Transport type (stdio, http, websocket)
  -c, --command <command>    Command to run (for stdio)
  -a, --args <args...>       Command arguments (for stdio)
  -u, --url <url>            Server URL (for http/websocket)
  -e, --env <env...>         Environment variables (key=value)
  --no-enabled               Add server in disabled state
  --auto-connect             Enable auto-connect

# Remove server
pnpm mcp:dev remove <name>

# List servers
pnpm mcp:dev list [--verbose]

# Enable/disable server
pnpm mcp:dev enable <name>
pnpm mcp:dev disable <name>

# Set auto-connect
pnpm mcp:dev auto-connect <name>
pnpm mcp:dev no-auto-connect <name>
```

### Connection Management

```bash
# Connect to server
pnpm mcp:dev connect <name>

# Disconnect from server
pnpm mcp:dev disconnect <name>

# Show system status
pnpm mcp:dev status
```

### Tool Management

```bash
# Discover tools
pnpm mcp:dev discover [serverName] [--refresh]

# List tools
pnpm mcp:dev tools [serverName] [--external-only]

# Test tool
pnpm mcp:dev test <toolName> [--params <json>]
```

### Configuration Management

```bash
# Import configuration
pnpm mcp:dev import <file>

# Export configuration
pnpm mcp:dev export <file>

# Create sample configurations
pnpm mcp:dev sample sequential-thinking [--name "Custom Name"]
pnpm mcp:dev sample filesystem [--name "Custom Name"]
pnpm mcp:dev sample brave-search [--name "Custom Name"]
pnpm mcp:dev sample custom [--name "Custom Name"]
```

## Configuration

### Server Configuration Format

```json
{
  "id": "uuid-here",
  "name": "Sequential Thinking",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@anthropic-ai/mcp-server-sequential-thinking"],
  "env": {
    "CUSTOM_VAR": "value"
  },
  "enabled": true,
  "autoConnect": true,
  "reconnectAttempts": 3,
  "reconnectDelay": 5000
}
```

### Configuration File Location

Configurations are stored in `.mcp/servers.json` relative to your project root.

### Environment Variables

```bash
# For servers that require API keys or configuration
BRAVE_API_KEY=your-api-key-here
OPENAI_API_KEY=your-openai-key
```

## Programmatic Usage

### Using in Your NestJS Application

```typescript
import { MCPClientService, ToolDiscoveryService } from './integrations/mcp-client';

@Injectable()
export class MyService {
  constructor(
    private readonly mcpClient: MCPClientService,
    private readonly toolDiscovery: ToolDiscoveryService
  ) {}

  async useExternalTool() {
    // Get all external tools
    const externalTools = this.toolDiscovery.getAllExternalTools();
    
    // Use a specific tool
    const result = await this.mcpClient.callTool(
      'server-id',
      'toolName',
      { param1: 'value1' }
    );
    
    return result;
  }
}
```

### Listening for Events

```typescript
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class MyEventHandler {
  @OnEvent('mcp.connection.established')
  handleConnectionEstablished(event: { connectionId: string; serverInfo: any }) {
    console.log(`Connected to MCP server: ${event.connectionId}`);
  }

  @OnEvent('mcp.tools.registered')
  handleToolsRegistered(event: { connectionId: string; toolCount: number }) {
    console.log(`Registered ${event.toolCount} tools from ${event.connectionId}`);
  }

  @OnEvent('mcp.connection.lost')
  handleConnectionLost(event: { connectionId: string }) {
    console.log(`Lost connection to: ${event.connectionId}`);
  }
}
```

## Common MCP Servers

### Sequential Thinking Server

```bash
pnpm mcp:dev add sequential-thinking \
  --transport stdio \
  --command npx \
  --args -y @anthropic-ai/mcp-server-sequential-thinking \
  --auto-connect
```

### Filesystem Server

```bash
pnpm mcp:dev add filesystem \
  --transport stdio \
  --command npx \
  --args -y @anthropic-ai/mcp-server-filesystem /path/to/directory \
  --auto-connect
```

### Brave Search Server

```bash
pnpm mcp:dev add brave-search \
  --transport stdio \
  --command npx \
  --args -y @anthropic-ai/mcp-server-brave-search \
  --env BRAVE_API_KEY=your-api-key-here
```

### SQLite Server

```bash
pnpm mcp:dev add sqlite \
  --transport stdio \
  --command npx \
  --args -y @anthropic-ai/mcp-server-sqlite /path/to/database.db
```

### Git Server

```bash
pnpm mcp:dev add git \
  --transport stdio \
  --command npx \
  --args -y @anthropic-ai/mcp-server-git /path/to/repository
```

## Error Handling

The system includes comprehensive error handling:

- **Connection errors**: Automatic reconnection with exponential backoff
- **Tool execution errors**: Proper error propagation and logging
- **Configuration errors**: Validation and helpful error messages
- **Transport errors**: Graceful handling of transport failures

## Monitoring and Logging

- Health checks every 5 minutes for connected servers
- Detailed logging for all operations
- Event emission for monitoring connection status
- Execution metrics for tool performance

## Security Considerations

- Validate all external tool inputs
- Sandbox external tool execution
- Limit resource usage for external tools
- Audit log for external tool usage
- Secure transport configuration

## Troubleshooting

### Connection Issues

1. Check server configuration
2. Verify command/URL accessibility
3. Check environment variables
4. Review logs for error details

### Tool Discovery Issues

1. Ensure server is connected
2. Check server capabilities
3. Refresh tool discovery
4. Verify tool permissions

### Performance Issues

1. Monitor tool execution metrics
2. Check network connectivity
3. Adjust timeout settings
4. Consider tool caching

## Development

### Running Tests

```bash
pnpm test
pnpm test:e2e
```

### Development Mode

```bash
# Start in development mode with hot reload
pnpm start:dev

# Use development CLI
pnpm mcp:dev <command>
```

### Building

```bash
pnpm build

# Production CLI usage
pnpm mcp <command>
```

## Contributing

1. Follow the existing code patterns
2. Add tests for new functionality
3. Update documentation
4. Follow the MCP protocol specification

## License

MIT License - see LICENSE file for details.