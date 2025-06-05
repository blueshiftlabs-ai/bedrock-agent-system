# MCP Hybrid Server Overhaul Plan

## Executive Summary

Transform the mcp-hybrid-server into a central API gateway that:
- Aggregates information from all MCP servers (memory, storage, bedrock, etc.)
- Provides real-time streaming updates via WebSocket/SSE
- Implements dynamic tool discovery and registration
- Serves as the unified backend for the MCP dashboard
- Enables dogfooding of MCP tools within the system itself

## Current State Analysis

### Dashboard Already Has:
- Complete type system for MCP integration (`types/index.ts`)
- WebSocket provider with Socket.io support
- Tool registry component ready for MCP tools display
- Logs viewer with server source filtering
- Server management with connection status tracking
- Memory server status integration built-in

### Missing Components:
- Central orchestrator to aggregate MCP server data
- WebSocket server implementation in hybrid-server
- MCP server discovery and health monitoring
- Tool registry synchronization from MCP servers
- Real-time streaming of logs, metrics, and tool updates

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Dashboard (Frontend)                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   Servers   │ │    Tools    │ │    Logs     │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────┬───────────────────────────────────────┘
                      │ WebSocket/HTTP
                      ▼
┌─────────────────────────────────────────────────────────────┐
│               MCP Hybrid Server (Gateway)                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              WebSocket Gateway Module                   ││
│  │  • Real-time streaming to dashboard                    ││
│  │  • Event aggregation and broadcasting                  ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │               MCP Registry Module                       ││
│  │  • Server discovery and health monitoring              ││
│  │  • Tool registry aggregation                          ││
│  │  • Dynamic tool loading from MCP servers              ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │                API Gateway Module                       ││
│  │  • REST endpoints for dashboard                        ││
│  │  • MCP protocol proxy                                  ││
│  │  • Authentication and authorization                    ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────┬───────────────────────────────────────┘
                      │ MCP Protocol
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   MCP Servers                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   Memory    │ │   Storage   │ │   Bedrock   │           │
│  │   Server    │ │   Server    │ │   Server    │           │
│  │  (Port 4100)│ │ (Port 4200) │ │ (Port 4300) │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)

#### 1.1 WebSocket Gateway Module
```typescript
// src/websocket/websocket.module.ts
@Module({
  providers: [WebSocketGateway, EventAggregatorService],
  exports: [WebSocketGateway]
})
export class WebSocketModule {}
```

**Key Components:**
- **WebSocketGateway**: Socket.io server for real-time communication
- **EventAggregatorService**: Collects events from all MCP servers
- **MessageBrokerService**: Handles event routing and broadcasting

**Events to Stream:**
- `log_entry`: Real-time logs from all MCP servers
- `server_status`: Health and metrics updates
- `tool_update`: Tool registration/deregistration events
- `workflow_update`: Workflow state changes
- `system_alert`: Error conditions and warnings

#### 1.2 MCP Registry Module
```typescript
// src/mcp-registry/mcp-registry.module.ts
@Module({
  providers: [
    MCPServerDiscoveryService,
    MCPHealthMonitorService, 
    MCPToolRegistryService
  ],
  exports: [MCPServerDiscoveryService, MCPToolRegistryService]
})
export class MCPRegistryModule {}
```

**Key Services:**
- **MCPServerDiscoveryService**: Auto-discovery of MCP servers
- **MCPHealthMonitorService**: Continuous health checking
- **MCPToolRegistryService**: Aggregates tools from all servers

### Phase 2: API Gateway Implementation (Week 2)

#### 2.1 REST API Endpoints
```typescript
// Dashboard integration endpoints
GET    /api/servers                    // List all MCP servers
GET    /api/servers/:id/status         // Server health and metrics
GET    /api/servers/:id/tools          // Tools from specific server
POST   /api/servers/:id/connect        // Connect to server
DELETE /api/servers/:id/disconnect     // Disconnect from server

// Tool management endpoints  
GET    /api/tools                      // All available tools
GET    /api/tools/:id                  // Tool details and schema
POST   /api/tools/:id/execute          // Execute tool
GET    /api/tools/categories           // Tool categories

// Log streaming endpoints
GET    /api/logs                       // Recent logs with filtering
GET    /api/logs/stream               // SSE log stream
GET    /api/logs/sources               // Available log sources

// System status endpoints
GET    /api/status                     // Overall system health
GET    /api/status/memory-server       // Memory server specific status
GET    /api/metrics                    // Aggregated metrics
```

#### 2.2 MCP Protocol Proxy
```typescript
// src/mcp-proxy/mcp-proxy.service.ts
@Injectable()
export class MCPProxyService {
  async executeToolOnServer(serverId: string, toolName: string, params: any) {
    // Route tool execution to appropriate MCP server
    // Return results to dashboard
  }
  
  async getServerCapabilities(serverId: string) {
    // Query server for available tools and capabilities
  }
}
```

### Phase 3: Advanced Features (Week 3)

#### 3.1 Dynamic Tool Discovery
```typescript
// src/mcp-registry/services/tool-discovery.service.ts
@Injectable()
export class ToolDiscoveryService {
  @Cron('*/30 * * * * *') // Every 30 seconds
  async discoverTools() {
    for (const server of this.knownServers) {
      const tools = await this.mcpClient.listTools(server);
      await this.syncToolRegistry(server.id, tools);
    }
  }
}
```

#### 3.2 Real-time Metric Aggregation
```typescript
// src/metrics/metrics-aggregator.service.ts
@Injectable()
export class MetricsAggregatorService {
  async getSystemStatus(): Promise<SystemStatus> {
    const servers = await this.getServerStatuses();
    const memoryStatus = await this.getMemoryServerStatus();
    const tools = await this.getActiveTools();
    
    return {
      overall: this.calculateOverallHealth(servers),
      servers: servers.length,
      activeTools: tools.filter(t => t.status === 'active').length,
      memoryServerStatus,
      // ... other aggregated metrics
    };
  }
}
```

#### 3.3 Dogfooding Implementation
```typescript
// src/dogfooding/dogfooding.module.ts
@Module({
  imports: [MCPClientModule],
  providers: [MemoryToolsService, DocumentationService],
})
export class DogfoodingModule {}

// Example: Using memory server tools within hybrid server
@Injectable()
export class MemoryToolsService {
  async storeAnalysisResult(analysis: any) {
    return await this.mcpClient.executeTool('memory-server', 'store_memory', {
      content: analysis,
      metadata: { source: 'code-analysis', timestamp: new Date() }
    });
  }
}
```

## Configuration Strategy

### Server Registry Configuration
```yaml
# config/mcp-servers.yml
servers:
  - id: memory-server
    name: "Memory Server"
    url: "http://localhost:4100"
    protocol: "http"
    healthCheck: "/health"
    capabilities: ["memory", "vector-search", "graph"]
    
  - id: storage-server  
    name: "Storage Server"
    url: "http://localhost:4200"
    protocol: "http"
    healthCheck: "/health"
    capabilities: ["file-storage", "backup"]
    
  - id: bedrock-server
    name: "Bedrock Server" 
    url: "http://localhost:4300"
    protocol: "http"
    healthCheck: "/health"
    capabilities: ["ai-models", "inference"]
```

### WebSocket Event Configuration
```typescript
// config/websocket-events.config.ts
export const WEBSOCKET_EVENTS = {
  LOG_ENTRY: 'log_entry',
  SERVER_STATUS: 'server_status', 
  TOOL_UPDATE: 'tool_update',
  WORKFLOW_UPDATE: 'workflow_update',
  SYSTEM_ALERT: 'system_alert',
  MEMORY_UPDATE: 'memory_update'
} as const;
```

## Dashboard Integration Points

### 1. Server Management Tab
- **Current**: Shows mock servers, needs real MCP server data
- **Enhancement**: Connect to `/api/servers` endpoint
- **Real-time**: Subscribe to `server_status` WebSocket events

### 2. Tools Tab  
- **Current**: Ready for tool display with categories and usage stats
- **Enhancement**: Connect to `/api/tools` endpoint
- **Real-time**: Subscribe to `tool_update` WebSocket events

### 3. Logs Tab
- **Current**: Has source filtering dropdown ready
- **Enhancement**: Connect to `/api/logs/stream` SSE endpoint
- **Real-time**: Display logs from all MCP servers in unified view

### 4. Dashboard Overview
- **Current**: Already has MemoryServerStatus integration
- **Enhancement**: Connect to `/api/status` and `/api/metrics` endpoints
- **Real-time**: Subscribe to `system_alert` WebSocket events

## Data Flow Examples

### Tool Execution Flow
```
Dashboard → Hybrid Server → Memory Server → Response → Dashboard
    ↓             ↓              ↓            ↓         ↓
Click Tool   Route to MCP   Execute Tool   Return     Display
Button       Server Proxy   via MCP        Result     Result
```

### Real-time Log Streaming
```
Memory Server → Hybrid Server → Dashboard
     ↓               ↓             ↓
Generate Log    Aggregate &     Display in
Entry          Broadcast       Log Viewer
```

### Health Monitoring Flow
```
Hybrid Server → All MCP Servers → Aggregate Status → Dashboard
     ↓               ↓                    ↓              ↓
Health Check    Return Health         Calculate        Update UI
Scheduler       Metrics              Overall Status    Indicators
```

## Security Considerations

### Authentication & Authorization
- JWT-based authentication for dashboard access
- API key authentication for MCP server communication
- Role-based access control for tool execution
- Rate limiting on tool execution endpoints

### Data Protection
- Secure WebSocket connections (WSS)
- Input validation for all tool parameters
- Audit logging for tool executions
- Encrypted storage of sensitive configuration

## Performance Optimizations

### Caching Strategy
- Tool metadata cached for 5 minutes
- Server health status cached for 30 seconds
- Tool execution results cached based on parameters
- Redis for distributed caching across instances

### WebSocket Optimization  
- Event filtering based on client subscriptions
- Batch updates for high-frequency events
- Connection pooling for MCP server communication
- Graceful degradation when servers unavailable

## Testing Strategy

### Unit Tests
- Mock MCP server responses
- Test tool discovery and registration
- Validate WebSocket event handling
- Test API endpoint responses

### Integration Tests  
- End-to-end tool execution flow
- WebSocket event propagation
- Health monitoring accuracy
- Dashboard real-time updates

### Load Testing
- Multiple concurrent tool executions
- High-frequency log streaming
- WebSocket connection limits
- Server discovery under load

## Deployment Strategy

### Development Environment
```bash
# Start all MCP servers
pnpm run start:memory-server    # Port 4100
pnpm run start:storage-server   # Port 4200  
pnpm run start:bedrock-server   # Port 4300

# Start hybrid server with gateway features
pnpm run dev:hybrid-server      # Port 3000

# Start dashboard
pnpm run dev:dashboard          # Port 3001
```

### Production Environment
- Docker containers for each MCP server
- Load balancer for hybrid server instances
- Redis for session storage and caching
- Monitoring with Prometheus/Grafana
- Centralized logging with ELK stack

## Success Metrics

### Functional Metrics
- [ ] All MCP servers discoverable in dashboard
- [ ] Real-time tool list updates from all servers
- [ ] Unified log streaming from all sources
- [ ] Tool execution success rate > 99%
- [ ] WebSocket connection stability > 99.5%

### Performance Metrics
- [ ] Tool discovery latency < 100ms
- [ ] WebSocket event delivery < 50ms
- [ ] API response times < 200ms
- [ ] System health check cycle < 10s
- [ ] Memory usage stable over 24h

### User Experience Metrics
- [ ] Dashboard loads completely in < 2s
- [ ] Real-time updates appear within 1s
- [ ] Tool execution feedback immediate
- [ ] Error states clearly communicated
- [ ] Server connection status accurate

## Timeline

| Week | Phase | Deliverables |
|------|-------|-------------|
| 1 | Core Infrastructure | WebSocket Gateway, MCP Registry, Basic API |
| 2 | API Gateway | REST endpoints, MCP proxy, Tool execution |
| 3 | Advanced Features | Tool discovery, Metrics aggregation, Dogfooding |
| 4 | Integration & Testing | Dashboard integration, E2E testing, Documentation |

## Next Steps

1. **Immediate (Today)**: Begin implementing WebSocket Gateway Module
2. **This Week**: Complete Phase 1 core infrastructure  
3. **Next Week**: Implement API endpoints and MCP proxy
4. **Week 3**: Add advanced features and dogfooding capabilities
5. **Week 4**: Full dashboard integration and testing

This plan transforms the mcp-hybrid-server into a comprehensive API gateway that enables the dashboard to monitor, control, and interact with all MCP servers in real-time, while also enabling the system to use its own MCP tools for enhanced functionality.