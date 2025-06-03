# Tool Registry

## Overview

The Tool Registry is a dynamic registration system that manages all MCP-compliant tools in the application. It provides discovery, validation, and execution capabilities.

## Architecture

```typescript
export class MCPToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  
  register(tool: IMCPTool): void {
    // Registration logic
  }
  
  discover(): ToolDescriptor[] {
    // Discovery logic
  }
  
  execute(name: string, params: any): Promise<ToolResult> {
    // Execution logic
  }
}
```

## Registration Process

### 1. Automatic Registration
Tools decorated with `@MCPTool` are automatically registered on application startup:

```typescript
@MCPTool({
  name: 'my_tool',
  description: 'My custom tool'
})
export class MyTool implements IMCPTool {
  // Implementation
}
```

### 2. Manual Registration
Tools can also be registered programmatically:

```typescript
const registry = app.get(MCPToolRegistry);
registry.register(myToolInstance);
```

### 3. Validation
During registration, the registry:
- Validates tool name uniqueness
- Verifies schema compliance
- Checks required methods
- Validates input/output schemas

## Discovery API

### List All Tools
```typescript
const tools = registry.discover();
// Returns: ToolDescriptor[]
```

### Get Tool by Name
```typescript
const tool = registry.getTool('analyze_code');
// Returns: RegisteredTool | undefined
```

### Search Tools
```typescript
const tools = registry.search({
  category: 'analysis',
  tags: ['code', 'quality']
});
```

## Execution

### Direct Execution
```typescript
const result = await registry.execute('analyze_code', {
  filePath: '/src/app.ts'
});
```

### Validated Execution
```typescript
try {
  const result = await registry.executeValidated('analyze_code', params);
} catch (error: any) {
  if (error instanceof ValidationError) {
    // Handle validation error
  }
}
```

## Tool Lifecycle

1. **Registration**: Tool is added to registry
2. **Initialization**: Tool setup and dependency injection
3. **Ready**: Tool available for execution
4. **Execution**: Tool processes requests
5. **Cleanup**: Tool resources released on shutdown

## Configuration

```yaml
toolRegistry:
  validation:
    strict: true
    schemaValidation: true
  execution:
    timeout: 30000
    retries: 3
  discovery:
    cache: true
    cacheTTL: 300
```

## Events

The registry emits events for monitoring:

```typescript
registry.on('tool:registered', (tool) => {
  console.log(`Tool registered: ${tool.name}`);
});

registry.on('tool:executed', (name, duration) => {
  console.log(`Tool ${name} executed in ${duration}ms`);
});
```

## Error Handling

- `ToolNotFoundError`: Tool doesn't exist
- `ValidationError`: Input validation failed
- `ExecutionError`: Tool execution failed
- `RegistrationError`: Registration failed

## Best Practices

1. **Unique Names**: Ensure tool names are globally unique
2. **Version Management**: Include version in tool metadata
3. **Graceful Degradation**: Handle missing tools gracefully
4. **Monitoring**: Track tool usage and performance
5. **Documentation**: Keep tool descriptions updated