# Dynamic Tool Management System

This document describes the enhanced tool management system that supports dynamic addition, removal, and management of tools at runtime.

## Overview

The Dynamic Tool Management System provides:
- **Runtime Tool Management**: Add, remove, enable/disable tools without server restart
- **Hot-reloading**: Automatically reload tools when their files change
- **Health Monitoring**: Built-in health checking and monitoring
- **Authentication & Authorization**: Fine-grained permission system
- **WebSocket Interface**: Real-time status updates and event streaming
- **Tool Versioning**: Complete version management and dependency tracking
- **REST API**: Complete HTTP API for tool management

## Architecture

### Core Components

1. **DynamicToolRegistry**: Enhanced registry with lifecycle management
2. **DynamicToolService**: Service layer for tool operations
3. **ToolController**: REST API endpoints
4. **ToolEventsGateway**: WebSocket interface for real-time updates
5. **Authentication Middleware**: JWT-based authentication
6. **Permission Guards**: Role-based access control

### File Structure

```
src/tools/
├── dto/                          # Data Transfer Objects
│   └── tool-management.dto.ts
├── guards/                       # Authentication guards
│   ├── tool-auth.guard.ts
│   └── tool-permission.guard.ts
├── interfaces/                   # Type definitions
│   └── tool-management.interface.ts
├── middleware/                   # Authentication middleware
│   └── tool-auth.middleware.ts
├── registry/                     # Tool registries
│   ├── dynamic-tool.registry.ts
│   └── tool.registry.ts
├── websocket/                    # WebSocket gateway
│   └── tool-events.gateway.ts
├── dynamic-tool.service.ts       # Enhanced tool service
├── tool.controller.ts            # REST API controller
└── tool.module.ts               # Module configuration
```

## API Reference

### REST API Endpoints

#### Tool Management

```http
GET    /api/v1/tools              # List tools with filtering
GET    /api/v1/tools/:id          # Get tool details
POST   /api/v1/tools/install      # Install new tool
POST   /api/v1/tools/:id/enable   # Enable tool
POST   /api/v1/tools/:id/disable  # Disable tool
DELETE /api/v1/tools/:id          # Uninstall tool
POST   /api/v1/tools/:id/reload   # Hot reload tool
```

#### Tool Execution

```http
POST   /api/v1/tools/:id/execute  # Execute tool with parameters
GET    /api/v1/tools/:id/health   # Get tool health status
```

#### Configuration

```http
GET    /api/v1/tools/:id/configuration    # Get tool configuration
PUT    /api/v1/tools/:id/configuration    # Update tool configuration
```

#### System Operations

```http
GET    /api/v1/tools/categories   # Get all tool categories
GET    /api/v1/tools/stats        # Get system statistics
GET    /api/v1/tools/events       # Get system events
POST   /api/v1/tools/validate     # Validate tool metadata
```

### WebSocket Interface

Connect to `/tools` namespace:

```javascript
const socket = io('/tools', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

#### Available Events

**Subscriptions:**
- `subscribe:tool-events` - Subscribe to tool events
- `subscribe:tool-health` - Subscribe to health updates
- `unsubscribe:tool-events` - Unsubscribe from events

**Incoming Events:**
- `tool:event` - Tool lifecycle events
- `tool:health-update` - Health status changes
- `tool:execution:started` - Tool execution started
- `tool:execution:completed` - Tool execution completed
- `tool:execution:failed` - Tool execution failed
- `system:stats-update` - System statistics update

## Usage Examples

### Installing a Tool

```bash
curl -X POST http://localhost:3000/api/v1/tools/install \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "local",
    "location": "/path/to/tool.js",
    "autoEnable": true
  }'
```

### Tool Metadata Structure

```typescript
interface ToolMetadata {
  id: string;
  name: string;
  description: string;
  category: string;
  version: ToolVersion;
  author: string;
  license: string;
  keywords: string[];
  dependencies: ToolDependency[];
  permissions: ToolPermission[];
  security: ToolSecurity;
  lifecycle: ToolLifecycle;
  // ... other properties
}
```

### Creating a Custom Tool

```typescript
// tool-example.ts
import { ToolMetadata } from './interfaces/tool-management.interface';

export const exampleToolMetadata: ToolMetadata = {
  id: 'example-tool-123',
  name: 'example-tool',
  description: 'An example dynamic tool',
  category: 'utility',
  version: { major: 1, minor: 0, patch: 0 },
  author: 'Tool Developer',
  license: 'MIT',
  keywords: ['example', 'utility'],
  dependencies: [],
  permissions: [
    {
      type: 'read',
      resource: 'files',
      description: 'Read file system'
    }
  ],
  parameters: {
    type: 'object',
    required: ['input'],
    properties: {
      input: {
        type: 'string',
        description: 'Input parameter'
      }
    }
  },
  execute: async (params: any, context?: any) => {
    return {
      result: `Processed: ${params.input}`,
      timestamp: new Date().toISOString()
    };
  },
  security: {
    checksum: 'sha256-hash',
    permissions: ['tool:execute'],
    sandboxed: true,
    trustedSource: false
  },
  lifecycle: {
    status: 'installed',
    enabled: false,
    logLevel: 'info'
  },
  createdAt: new Date(),
  updatedAt: new Date()
};
```

### WebSocket Client Example

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/tools', {
  auth: {
    token: 'your-jwt-token'
  }
});

// Subscribe to tool events
socket.emit('subscribe:tool-events', {
  categories: ['analysis'],
  eventTypes: ['executed', 'error']
});

// Listen for tool events
socket.on('tool:event', (event) => {
  console.log('Tool event:', event);
});

// Listen for health updates
socket.on('tool:health-update', (health) => {
  console.log('Health update:', health);
});
```

## Security

### Authentication

The system uses JWT-based authentication. Include the token in the Authorization header:

```
Authorization: Bearer your-jwt-token
```

### Permissions

The permission system supports hierarchical permissions:

- `tool:read` - View tools
- `tool:execute` - Execute tools
- `tool:manage` - Enable/disable tools
- `tool:install` - Install new tools
- `tool:uninstall` - Remove tools
- `tool:configure` - Modify tool configuration
- `tool:*` - All tool permissions
- `admin:*` - All permissions

### Tool Security

Each tool must provide security metadata:

```typescript
security: {
  checksum: 'sha256-hash-of-tool-content',
  permissions: ['required', 'permissions'],
  sandboxed: true,  // Run in sandbox
  trustedSource: false,  // From trusted source
  signature: 'optional-digital-signature'
}
```

## Configuration

### Environment Variables

```bash
# JWT Secret for authentication
JWT_SECRET=your-secret-key

# WebSocket allowed origins
ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.com

# Tool storage directory
TOOLS_DIRECTORY=/path/to/tools

# Health check intervals
HEALTH_CHECK_INTERVAL=30000  # 30 seconds
```

### Tool Configuration

Each tool can have its own configuration:

```typescript
// Set tool configuration
await toolService.setToolConfiguration('tool-id', {
  maxExecutionTime: 30000,
  retryCount: 3,
  logLevel: 'debug'
});
```

## Monitoring and Health Checks

### Built-in Health Checks

Tools can implement health checks:

```typescript
healthCheck: {
  enabled: true,
  interval: 30000,  // 30 seconds
  timeout: 5000,    // 5 seconds
  retries: 3,
  healthCheck: async () => {
    // Custom health check logic
    return {
      status: 'healthy',
      details: 'All systems operational',
      timestamp: new Date(),
      metrics: {
        memoryUsage: process.memoryUsage().heapUsed,
        uptime: process.uptime()
      }
    };
  }
}
```

### System Statistics

Get comprehensive system statistics:

```bash
curl -H "Authorization: Bearer token" \
  http://localhost:3000/api/v1/tools/stats
```

Response:
```json
{
  "totalTools": 15,
  "enabledTools": 12,
  "disabledTools": 3,
  "categories": 5,
  "categoryBreakdown": [
    {"category": "analysis", "count": 5},
    {"category": "utility", "count": 3}
  ],
  "recentEvents": [...],
  "healthChecks": 8,
  "watchers": 12
}
```

## Hot Reloading

Tools support hot reloading when their files change:

1. **File Watching**: Automatically detect file changes
2. **Graceful Reload**: Unregister old version, load new version
3. **State Preservation**: Maintain tool state during reload
4. **Event Notification**: Broadcast reload events to clients

```bash
# Trigger manual reload
curl -X POST http://localhost:3000/api/v1/tools/tool-id/reload \
  -H "Authorization: Bearer token"
```

## Error Handling

The system provides comprehensive error handling:

- **Validation Errors**: Tool metadata validation
- **Permission Errors**: Insufficient permissions
- **Execution Errors**: Tool execution failures
- **Network Errors**: WebSocket connection issues
- **Security Errors**: Authentication/authorization failures

All errors include:
- Error code
- Descriptive message
- Timestamp
- Request context
- Suggested remediation

## Performance Considerations

- **Connection Pooling**: WebSocket connections are pooled
- **Event Batching**: Events are batched for efficiency
- **Caching**: Tool metadata is cached
- **Rate Limiting**: Built-in rate limiting per user
- **Resource Monitoring**: Memory and CPU usage tracking

## Development

### Running in Development

```bash
# Install dependencies
pnpm install

# Start in development mode
pnpm start:dev

# Run with debugging
pnpm start:debug
```

### Testing

```bash
# Run unit tests
pnpm test

# Run e2e tests
pnpm test:e2e

# Test tool endpoints
./scripts/test-tools.sh
```

### Building

```bash
# Build for production
pnpm build

# Build Docker image
pnpm docker:build
```

This completes the dynamic tool management system implementation with production-ready features for scalable microservice transformation and analysis.