# MCP Protocol Specification

## Overview

The Model Context Protocol (MCP) is a standardized protocol for AI models to interact with external tools and systems. This document describes how the MCP Hybrid Server implements and extends the MCP specification.

## Protocol Version

Current implementation: MCP v1.0

## Tool Definition Schema

### Tool Registration

```typescript
interface MCPTool {
  // Tool identifier (must be unique)
  name: string;
  
  // Human-readable description
  description: string;
  
  // JSON Schema for input validation
  inputSchema: JsonSchema;
  
  // Optional metadata
  metadata?: {
    version?: string;
    author?: string;
    category?: string;
    tags?: string[];
  };
}
```

### JSON Schema Format

```json
{
  "type": "object",
  "properties": {
    "filePath": {
      "type": "string",
      "description": "Path to the file to analyze"
    },
    "options": {
      "type": "object",
      "properties": {
        "depth": {
          "type": "number",
          "minimum": 1,
          "maximum": 5
        },
        "includeTests": {
          "type": "boolean",
          "default": false
        }
      }
    }
  },
  "required": ["filePath"]
}
```

## Tool Execution Protocol

### Request Format

```typescript
interface ToolExecutionRequest {
  // Tool name to execute
  tool: string;
  
  // Input parameters (must match schema)
  params: Record<string, any>;
  
  // Optional execution context
  context?: {
    sessionId?: string;
    userId?: string;
    timeout?: number;
    priority?: 'low' | 'normal' | 'high';
  };
}
```

### Response Format

```typescript
interface ToolExecutionResponse {
  // Indicates success or failure
  success: boolean;
  
  // Result data (tool-specific)
  result?: any;
  
  // Error information if failed
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  
  // Execution metadata
  metadata: {
    executionId: string;
    duration: number;
    timestamp: string;
  };
}
```

## Implementation Details

### Tool Discovery Endpoint

**GET /mcp/tools**

Returns all registered tools with their schemas.

```json
{
  "version": "1.0",
  "tools": [
    {
      "name": "analyze_code",
      "description": "Analyzes source code for quality and patterns",
      "inputSchema": {
        "type": "object",
        "properties": {
          "filePath": {
            "type": "string",
            "description": "Path to file"
          }
        },
        "required": ["filePath"]
      }
    }
  ]
}
```

### Tool Execution Endpoint

**POST /mcp/tools/{toolName}/execute**

Executes a specific tool with provided parameters.

Request:
```json
{
  "params": {
    "filePath": "/src/app.ts"
  },
  "context": {
    "sessionId": "session-123",
    "timeout": 30000
  }
}
```

Response:
```json
{
  "success": true,
  "result": {
    "analysis": {
      "complexity": 5,
      "lines": 150,
      "issues": []
    }
  },
  "metadata": {
    "executionId": "exec-456",
    "duration": 1234,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## Creating MCP-Compliant Tools

### Basic Tool Implementation

```typescript
import { MCPTool, MCPToolDecorator } from '@mcp/core';

@MCPToolDecorator({
  name: 'my_custom_tool',
  description: 'Performs custom analysis',
  inputSchema: {
    type: 'object',
    properties: {
      input: { type: 'string' },
      options: {
        type: 'object',
        properties: {
          verbose: { type: 'boolean' }
        }
      }
    },
    required: ['input']
  }
})
export class MyCustomTool implements MCPTool {
  async execute(params: any): Promise<any> {
    const { input, options = {} } = params;
    
    // Tool implementation
    const result = await this.performAnalysis(input, options);
    
    return {
      success: true,
      data: result
    };
  }
  
  private async performAnalysis(input: string, options: any) {
    // Analysis logic
    return {
      processed: input.toUpperCase(),
      verbose: options.verbose || false
    };
  }
}
```

### Advanced Tool Features

```typescript
@MCPToolDecorator({
  name: 'advanced_tool',
  description: 'Advanced tool with streaming and progress',
  inputSchema: { /* ... */ },
  metadata: {
    version: '2.0.0',
    category: 'analysis',
    tags: ['code', 'quality']
  }
})
export class AdvancedTool implements MCPTool {
  async execute(params: any, context?: ExecutionContext): Promise<any> {
    // Progress reporting
    context?.reportProgress(0, 'Starting analysis');
    
    // Streaming results
    const stream = context?.createStream();
    
    for (let i = 0; i < 100; i += 10) {
      await this.processChunk(i);
      context?.reportProgress(i, `Processing ${i}%`);
      
      if (stream) {
        stream.write({ chunk: i, data: `Result ${i}` });
      }
    }
    
    stream?.end();
    context?.reportProgress(100, 'Complete');
    
    return {
      success: true,
      summary: 'Analysis complete'
    };
  }
}
```

## Error Handling

### Standard Error Codes

| Code | Description |
|------|-------------|
| `TOOL_NOT_FOUND` | Requested tool doesn't exist |
| `VALIDATION_ERROR` | Input doesn't match schema |
| `EXECUTION_ERROR` | Tool execution failed |
| `TIMEOUT_ERROR` | Execution exceeded timeout |
| `PERMISSION_ERROR` | Insufficient permissions |
| `RATE_LIMIT_ERROR` | Rate limit exceeded |

### Error Response Example

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input validation failed",
    "details": {
      "field": "filePath",
      "reason": "Path does not exist",
      "provided": "/invalid/path.ts"
    }
  },
  "metadata": {
    "executionId": "exec-789",
    "duration": 15,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## Security Considerations

### Authentication

All MCP endpoints require authentication:

```http
Authorization: Bearer <token>
```

### Input Validation

1. **Schema Validation**: All inputs validated against JSON Schema
2. **Sanitization**: Inputs sanitized to prevent injection
3. **Type Checking**: Runtime type validation
4. **Size Limits**: Maximum payload size enforced

### Permissions

Tools can require specific permissions:

```typescript
@MCPToolDecorator({
  name: 'sensitive_tool',
  description: 'Requires admin permissions',
  permissions: ['admin', 'write'],
  inputSchema: { /* ... */ }
})
```

## Performance Guidelines

### Tool Optimization

1. **Async Operations**: Use async/await for I/O
2. **Streaming**: Stream large results
3. **Caching**: Cache expensive computations
4. **Timeouts**: Respect execution timeouts

### Resource Limits

```typescript
interface ResourceLimits {
  maxExecutionTime: 300000;  // 5 minutes
  maxMemory: 512;           // MB
  maxConcurrency: 10;       // Parallel executions
  maxPayloadSize: 10;       // MB
}
```

## Versioning Strategy

### Tool Versioning

Tools should include version in metadata:

```typescript
@MCPToolDecorator({
  name: 'versioned_tool',
  description: 'Tool with version',
  metadata: {
    version: '2.1.0',
    deprecates: '1.0.0'
  }
})
```

### Protocol Versioning

Clients should specify protocol version:

```http
X-MCP-Version: 1.0
```

## Extensions

### Custom Metadata

Tools can include custom metadata:

```typescript
metadata: {
  custom: {
    pricing: 'premium',
    sla: '99.9%',
    region: 'us-east-1'
  }
}
```

### Event Hooks

Tools can implement lifecycle hooks:

```typescript
export class HookedTool implements MCPTool {
  async beforeExecute(params: any): Promise<void> {
    // Pre-execution logic
  }
  
  async afterExecute(result: any): Promise<void> {
    // Post-execution logic
  }
  
  async onError(error: Error): Promise<void> {
    // Error handling
  }
}
```

## Client Libraries

### TypeScript/JavaScript

```typescript
import { MCPClient } from '@mcp/client';

const client = new MCPClient({
  baseURL: 'https://api.example.com',
  token: 'your-token'
});

// Discover tools
const tools = await client.discoverTools();

// Execute tool
const result = await client.executeTool('analyze_code', {
  filePath: '/src/app.ts'
});
```

### Python

```python
from mcp_client import MCPClient

client = MCPClient(
    base_url="https://api.example.com",
    token="your-token"
)

# Discover tools
tools = client.discover_tools()

# Execute tool
result = client.execute_tool("analyze_code", {
    "filePath": "/src/app.py"
})
```

## Testing MCP Tools

### Unit Testing

```typescript
describe('MyCustomTool', () => {
  let tool: MyCustomTool;
  
  beforeEach(() => {
    tool = new MyCustomTool();
  });
  
  it('should validate input schema', async () => {
    const invalidInput = { wrongField: 'value' };
    
    await expect(tool.execute(invalidInput))
      .rejects.toThrow('Validation error');
  });
  
  it('should process valid input', async () => {
    const result = await tool.execute({
      input: 'test data'
    });
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });
});
```

### Integration Testing

```typescript
describe('MCP Integration', () => {
  it('should register and execute tool', async () => {
    const response = await request(app)
      .post('/mcp/tools/my_custom_tool/execute')
      .send({ params: { input: 'test' } })
      .expect(200);
      
    expect(response.body.success).toBe(true);
  });
});
```