# MCP Hybrid Server - Interaction Interface

This module provides a comprehensive interaction interface for managing and monitoring long-running processes in the MCP Hybrid Server. It includes backend services with REST APIs, WebSocket support, and MCP protocol integration for real-time process management.

## Features

### Core Capabilities
- **Process Management**: Create, start, stop, pause, resume, and cancel long-running processes
- **Real-time Monitoring**: WebSocket-based live updates for process status, logs, and resource usage
- **Agent & Workflow Execution**: Support for both AI agent tasks and complex multi-step workflows
- **Resource Monitoring**: Track CPU, memory, and disk usage per process
- **Interactive Debugging**: Debug interface for agent interactions and workflow states
- **Process Scheduling**: Queue management and scheduled execution
- **MCP Compatibility**: Full MCP protocol support for external client integration

### API Interfaces
- **REST API**: Full HTTP API for process management and monitoring
- **WebSocket API**: Real-time updates and bidirectional communication
- **MCP Protocol**: Tool integration for external MCP clients
- **CLI Tools**: Command-line interface for process management

## Architecture

### Backend Components

#### ProcessManagerService
Central service for managing long-running processes:
```typescript
// Create a new process
const processId = await processManager.createProcess(
  'Code Analysis', 
  ProcessType.WORKFLOW, 
  ProcessPriority.HIGH,
  { analysisType: 'advanced' },
  { filePath: '/path/to/code' }
);

// Start the process
await processManager.startProcess(processId, executor);

// Monitor progress
processManager.updateProgress(processId, {
  current: 50,
  total: 100,
  percentage: 50,
  message: 'Analyzing dependencies...'
});
```

#### AgentExecutorService
Executes AI agents with process management:
```typescript
const executor = await agentExecutor.execute(processId, {
  agentName: 'code-analyzer',
  filePath: '/path/to/analyze',
  analysisType: 'security'
}, configuration);
```

#### WorkflowExecutorService
Manages complex multi-step workflows:
```typescript
const executor = await workflowExecutor.execute(processId, {
  workflowType: 'code-analysis',
  nodes: [...],
  configuration: {...}
}, configuration);
```

#### InteractionWebSocketGateway
Provides real-time updates via WebSocket:
```typescript
// Subscribe to process updates
socket.emit('subscribe_process', { processId: 'proc_123' });

// Get real-time logs
socket.emit('get_process_logs', { 
  processId: 'proc_123', 
  follow: true 
});
```

### Integration Interfaces

#### Available Interfaces
- REST API endpoints for process management
- WebSocket gateway for real-time communication
- MCP tools for external client integration
- CLI commands for direct server interaction

## API Reference

### REST Endpoints

#### Process Management
```http
# Get all processes
GET /api/processes
Query Parameters:
  - status: filter by status (running, pending, completed, etc.)
  - type: filter by type (agent, workflow, analysis, etc.)
  - limit: number of results
  - offset: pagination offset

# Get specific process
GET /api/processes/{id}

# Start new process
POST /api/processes
Content-Type: application/json
{
  "name": "Code Analysis",
  "type": "workflow",
  "priority": "high",
  "input": { "filePath": "/path/to/code" },
  "configuration": { "analysisType": "advanced" }
}

# Control process
PUT /api/processes/{id}/control
Content-Type: application/json
{
  "action": "pause|resume|stop|cancel|restart",
  "force": false
}

# Get process logs
GET /api/processes/{id}/logs
Query Parameters:
  - level: filter by log level (debug, info, warn, error)
  - since: ISO timestamp for filtering
  - tail: number of recent logs

# Get process resources
GET /api/processes/{id}/resources
Query Parameters:
  - since: ISO timestamp
  - limit: number of data points

# Get process statistics
GET /api/processes/stats
```

### WebSocket Events

#### Client to Server
```javascript
// Subscribe to process updates
socket.emit('subscribe_process', { processId: 'proc_123' });

// Unsubscribe from process
socket.emit('unsubscribe_process', { processId: 'proc_123' });

// Get processes with filtering
socket.emit('get_processes', { 
  status: ['running', 'pending'],
  limit: 10 
});

// Get process logs
socket.emit('get_process_logs', {
  processId: 'proc_123',
  level: 'info',
  follow: true
});

// Start resource monitoring
socket.emit('start_resource_monitoring', {
  processId: 'proc_123',
  interval: 5000
});
```

#### Server to Client
```javascript
// Process updates
socket.on('message', (data) => {
  if (data.type === 'process_update') {
    // Handle process state changes
  } else if (data.type === 'log_stream') {
    // Handle new log entries
  } else if (data.type === 'resource_update') {
    // Handle resource usage updates
  }
});
```

### MCP Tool Integration

The interaction interface exposes MCP-compatible tools for external clients:

```javascript
// Available MCP tools
const tools = [
  'start_process',
  'control_process', 
  'query_processes',
  'get_process_logs',
  'interact_with_agent'
];

// Example: Start a process via MCP
const result = await mcpClient.callTool('start_process', {
  name: 'Document Generation',
  type: 'agent',
  input: { sourceCode: '...' },
  configuration: { format: 'markdown' }
});
```

## Usage Examples

### Starting an Agent Process

#### Via REST API
```bash
curl -X POST http://localhost:3000/api/processes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Code Quality Analysis",
    "type": "agent",
    "priority": "high",
    "input": {
      "agentName": "code-analyzer",
      "filePath": "/workspace/src",
      "language": "typescript"
    },
    "configuration": {
      "analysisType": "quality",
      "includeDependencies": true
    }
  }'
```

#### Via JavaScript (Client)
```javascript
const response = await fetch('/api/processes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Documentation Generation',
    type: 'agent',
    input: {
      agentName: 'documentation-generator',
      sourceCode: 'class Example {...}',
      outputPath: '/docs/api.md'
    },
    configuration: {
      format: 'markdown',
      includeExamples: true
    }
  })
});

const { processId } = await response.json();
```

### Starting a Workflow Process

```javascript
const workflowProcess = {
  name: 'Full Code Analysis Pipeline',
  type: 'workflow',
  priority: 'medium',
  input: {
    workflowType: 'code-analysis',
    filePath: '/project/src',
    outputFormat: 'json'
  },
  configuration: {
    maxRetries: 3,
    timeout: 300000,
    nodes: [
      { id: 'validate', name: 'Validate Input' },
      { id: 'parse', name: 'Parse Code' },
      { id: 'analyze', name: 'Run Analysis' },
      { id: 'report', name: 'Generate Report' }
    ]
  }
};

const response = await fetch('/api/processes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(workflowProcess)
});
```

### Real-time Monitoring

```javascript
// Connect to WebSocket
const socket = io('/interaction');

// Subscribe to process updates
socket.emit('subscribe_process', { processId: 'proc_123' });

// Handle real-time updates
socket.on('message', (message) => {
  switch (message.type) {
    case 'process_update':
      console.log('Process status:', message.data.metadata.status);
      break;
    case 'log_stream':
      console.log('New logs:', message.data.logs);
      break;
    case 'resource_update':
      console.log('Resource usage:', message.data);
      break;
  }
});
```

### Process Control

```javascript
// Pause a running process
await fetch(`/api/processes/${processId}/control`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'pause' })
});

// Resume the process
await fetch(`/api/processes/${processId}/control`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'resume' })
});

// Force stop a process
await fetch(`/api/processes/${processId}/control`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    action: 'stop', 
    force: true 
  })
});
```

## Configuration

### Environment Variables
```bash
# WebSocket configuration
WEBSOCKET_PORT=3000
WEBSOCKET_CORS_ORIGIN=*

# Process management
MAX_CONCURRENT_PROCESSES=10
DEFAULT_PROCESS_TIMEOUT=300000
RESOURCE_MONITORING_INTERVAL=5000

# API settings
API_RATE_LIMIT_ENABLED=true
API_RATE_LIMIT_WINDOW=60000
```

### API Configuration
The API supports runtime configuration:
```javascript
const apiConfig = {
  maxConcurrentProcesses: 10,
  defaultTimeout: 300000,
  enableRealTimeUpdates: true,
  resourceMonitoringInterval: 5000,
  defaultFilters: {
    status: ['running', 'pending'],
    type: [],
    priority: []
  },
  rateLimiting: {
    enabled: true,
    windowMs: 60000,
    maxRequests: 100
  }
};
```

## Integration with Existing Systems

### Agent Integration
The interaction interface automatically integrates with existing agents:

```typescript
// In your agent implementation
export class CustomAgent extends BaseAgent {
  async processRequest(prompt: string, options?: any): Promise<any> {
    // The process manager will automatically track this execution
    const result = await this.performAnalysis(prompt);
    return result;
  }
}
```

### Workflow Integration
Workflows are automatically managed:

```typescript
// In your workflow service
export class CustomWorkflowService {
  async executeWorkflow(input: any): Promise<any> {
    // The workflow executor handles progress tracking and state management
    return await this.runWorkflowSteps(input);
  }
}
```

## Security Considerations

1. **Authentication**: Implement proper user authentication before production use
2. **Authorization**: Add role-based access control for process management
3. **Input Validation**: All process inputs are validated against schemas
4. **Rate Limiting**: Implement rate limiting for API endpoints
5. **WebSocket Security**: Configure proper CORS and authentication for WebSocket connections

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check if the server is running on the correct port
   - Verify CORS configuration
   - Ensure firewall allows WebSocket connections

2. **Process Not Starting**
   - Check process input validation
   - Verify agent/workflow configuration
   - Review server logs for detailed error messages

3. **API Not Responding**
   - Check if all controllers are properly registered
   - Verify route configuration
   - Review server logs for HTTP errors

### Debug Mode
Enable debug mode for verbose logging:
```bash
DEBUG=interaction:* npm run start:dev
```

## Performance Monitoring

The system includes built-in performance monitoring:
- Process execution times
- Resource usage tracking
- Queue depth monitoring
- WebSocket connection metrics

Access performance data via:
```http
GET /api/processes/stats
```

## Future Enhancements

Planned features for future releases:
- [ ] Advanced scheduling with cron expressions
- [ ] Process templates and workflows marketplace
- [ ] Advanced debugging with breakpoints
- [ ] Distributed execution across multiple nodes
- [ ] Integration with external monitoring systems
- [ ] Advanced analytics and reporting
- [ ] GraphQL API support
- [ ] SSO integration
- [ ] Process audit logging
- [ ] Export/import of process definitions