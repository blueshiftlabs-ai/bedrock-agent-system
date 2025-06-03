# Creating Custom Tools

## Overview

This guide explains how to create custom MCP-compliant tools for the MCP Hybrid Server. Tools provide standardized interfaces that AI models can use to perform specific operations.

## Understanding MCP Tools

MCP (Model Context Protocol) tools are:
- Self-describing functions with JSON Schema
- Automatically discoverable by AI models
- Type-safe and validated
- Integrated with the tool registry

## Step 1: Plan Your Tool

Before implementation, define:
- **Purpose**: What specific task will the tool perform?
- **Inputs**: What parameters are required?
- **Outputs**: What data will be returned?
- **Permissions**: Who can use this tool?

## Step 2: Create the Tool Class

### Basic Structure

Create a new file in `src/tools/implementations/your-tool.tool.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { MCPTool, MCPToolDecorator } from '../../common/decorators/mcp-tool.decorator';
import { ToolResult } from '../types';

@Injectable()
@MCPToolDecorator({
  name: 'your_custom_tool',
  description: 'Performs a specific custom operation',
  inputSchema: {
    type: 'object',
    properties: {
      input: {
        type: 'string',
        description: 'The input data to process'
      },
      options: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            enum: ['json', 'text', 'markdown'],
            default: 'json'
          },
          includeMetadata: {
            type: 'boolean',
            default: false
          }
        }
      }
    },
    required: ['input']
  }
})
export class YourCustomTool implements MCPTool {
  async execute(params: any): Promise<ToolResult> {
    const { input, options = {} } = params;
    
    try {
      // Validate input
      this.validateInput(input);
      
      // Perform operation
      const result = await this.processInput(input, options);
      
      // Return structured result
      return {
        success: true,
        data: result,
        metadata: {
          toolName: 'your_custom_tool',
          executionTime: Date.now(),
          format: options.format || 'json'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error.message,
          details: error.stack
        }
      };
    }
  }
  
  private validateInput(input: string): void {
    if (!input || typeof input !== 'string') {
      throw new Error('Input must be a non-empty string');
    }
    
    if (input.length > 10000) {
      throw new Error('Input exceeds maximum length of 10000 characters');
    }
  }
  
  private async processInput(
    input: string,
    options: any
  ): Promise<any> {
    // Your processing logic here
    const processed = input.toUpperCase();
    
    switch (options.format) {
      case 'text':
        return processed;
      case 'markdown':
        return `# Result\n\n${processed}`;
      case 'json':
      default:
        return {
          original: input,
          processed: processed,
          length: input.length,
          timestamp: new Date().toISOString()
        };
    }
  }
}
```

## Step 3: Advanced Tool Features

### Dependency Injection

```typescript
import { FileService } from '../../common/services/file.service';
import { DatabaseService } from '../../database/database.service';

@Injectable()
@MCPToolDecorator({
  name: 'file_analyzer',
  description: 'Analyzes files with database lookups'
})
export class FileAnalyzerTool implements MCPTool {
  constructor(
    private readonly fileService: FileService,
    private readonly databaseService: DatabaseService
  ) {}
  
  async execute(params: any): Promise<ToolResult> {
    const { filePath } = params;
    
    // Use injected services
    const fileContent = await this.fileService.readFile(filePath);
    const metadata = await this.databaseService.getFileMetadata(filePath);
    
    return {
      success: true,
      data: {
        content: fileContent,
        metadata: metadata
      }
    };
  }
}
```

### Streaming Results

```typescript
import { Readable } from 'stream';

@MCPToolDecorator({
  name: 'stream_processor',
  description: 'Processes data with streaming output',
  streaming: true
})
export class StreamProcessorTool implements MCPTool {
  async execute(
    params: any,
    context?: ExecutionContext
  ): Promise<ToolResult> {
    const { data } = params;
    const stream = context?.createStream();
    
    if (!stream) {
      throw new Error('Streaming not supported in this context');
    }
    
    // Process data in chunks
    for (let i = 0; i < data.length; i += 100) {
      const chunk = data.slice(i, i + 100);
      const processed = await this.processChunk(chunk);
      
      stream.write({
        chunkIndex: i / 100,
        data: processed,
        progress: (i / data.length) * 100
      });
      
      // Allow other operations
      await new Promise(resolve => setImmediate(resolve));
    }
    
    stream.end();
    
    return {
      success: true,
      data: {
        message: 'Stream processing complete',
        totalChunks: Math.ceil(data.length / 100)
      }
    };
  }
}
```

### Permissions and Security

```typescript
@MCPToolDecorator({
  name: 'secure_tool',
  description: 'Tool with permission requirements',
  permissions: ['admin', 'write'],
  rateLimit: {
    requests: 10,
    window: 60 // seconds
  }
})
export class SecureTool implements MCPTool {
  async execute(
    params: any,
    context?: ExecutionContext
  ): Promise<ToolResult> {
    // Check permissions
    if (!context?.hasPermission('admin')) {
      return {
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'Admin permission required'
        }
      };
    }
    
    // Perform secure operation
    return this.performSecureOperation(params);
  }
}
```

## Step 4: Complex Input Schemas

### Nested Objects

```typescript
@MCPToolDecorator({
  name: 'complex_processor',
  description: 'Processes complex nested data',
  inputSchema: {
    type: 'object',
    properties: {
      user: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^[a-zA-Z0-9-]+$' },
          name: { type: 'string', minLength: 1, maxLength: 100 },
          email: { type: 'string', format: 'email' },
          preferences: {
            type: 'object',
            properties: {
              theme: { type: 'string', enum: ['light', 'dark'] },
              notifications: { type: 'boolean' }
            }
          }
        },
        required: ['id', 'name', 'email']
      },
      operations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['create', 'update', 'delete'] },
            target: { type: 'string' },
            data: { type: 'object' }
          },
          required: ['type', 'target']
        },
        minItems: 1,
        maxItems: 10
      }
    },
    required: ['user', 'operations']
  }
})
export class ComplexProcessorTool implements MCPTool {
  // Implementation
}
```

### Conditional Schemas

```typescript
@MCPToolDecorator({
  name: 'conditional_tool',
  description: 'Tool with conditional schema validation',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['analyze', 'transform', 'validate']
      }
    },
    required: ['operation'],
    allOf: [
      {
        if: {
          properties: { operation: { const: 'analyze' } }
        },
        then: {
          properties: {
            analysisType: {
              type: 'string',
              enum: ['basic', 'advanced', 'custom']
            },
            depth: {
              type: 'number',
              minimum: 1,
              maximum: 5
            }
          },
          required: ['analysisType']
        }
      },
      {
        if: {
          properties: { operation: { const: 'transform' } }
        },
        then: {
          properties: {
            format: {
              type: 'string',
              enum: ['json', 'xml', 'csv']
            },
            encoding: {
              type: 'string',
              default: 'utf-8'
            }
          },
          required: ['format']
        }
      }
    ]
  }
})
export class ConditionalTool implements MCPTool {
  // Implementation
}
```

## Step 5: Error Handling

### Comprehensive Error Types

```typescript
export enum ToolErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  EXECUTION_ERROR = 'EXECUTION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR'
}

export class ToolError extends Error {
  constructor(
    public code: ToolErrorCode,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ToolError';
  }
}

@Injectable()
export class RobustTool implements MCPTool {
  async execute(params: any): Promise<ToolResult> {
    try {
      // Validation
      this.validateParams(params);
      
      // Execute with timeout
      const result = await this.executeWithTimeout(
        () => this.performOperation(params),
        30000 // 30 seconds
      );
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      if (error instanceof ToolError) {
        return {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details
          }
        };
      }
      
      // Unexpected errors
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: 'An unexpected error occurred',
          details: {
            originalError: error.message,
            stack: error.stack
          }
        }
      };
    }
  }
  
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new ToolError(
          ToolErrorCode.TIMEOUT_ERROR,
          `Operation timed out after ${timeout}ms`
        ));
      }, timeout);
    });
    
    return Promise.race([operation(), timeoutPromise]);
  }
}
```

## Step 6: Testing Your Tool

### Unit Tests

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { YourCustomTool } from './your-custom-tool.tool';

describe('YourCustomTool', () => {
  let tool: YourCustomTool;
  
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [YourCustomTool],
    }).compile();
    
    tool = module.get<YourCustomTool>(YourCustomTool);
  });
  
  describe('execute', () => {
    it('should process valid input successfully', async () => {
      const params = {
        input: 'test data',
        options: { format: 'json' }
      };
      
      const result = await tool.execute(params);
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('processed');
      expect(result.data.processed).toBe('TEST DATA');
    });
    
    it('should handle invalid input', async () => {
      const params = { input: null };
      
      const result = await tool.execute(params);
      
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('EXECUTION_ERROR');
      expect(result.error.message).toContain('non-empty string');
    });
    
    it('should respect format options', async () => {
      const params = {
        input: 'hello',
        options: { format: 'markdown' }
      };
      
      const result = await tool.execute(params);
      
      expect(result.success).toBe(true);
      expect(result.data).toContain('# Result');
      expect(result.data).toContain('HELLO');
    });
  });
});
```

### Integration Tests

```typescript
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../app.module';

describe('Tool Integration', () => {
  let app: INestApplication;
  
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    
    app = moduleRef.createNestApplication();
    await app.init();
  });
  
  afterAll(async () => {
    await app.close();
  });
  
  it('should discover the custom tool', async () => {
    const response = await request(app.getHttpServer())
      .get('/mcp/tools')
      .expect(200);
    
    const tool = response.body.tools.find(
      t => t.name === 'your_custom_tool'
    );
    
    expect(tool).toBeDefined();
    expect(tool.description).toBe('Performs a specific custom operation');
    expect(tool.inputSchema).toBeDefined();
  });
  
  it('should execute the tool via API', async () => {
    const response = await request(app.getHttpServer())
      .post('/mcp/tools/your_custom_tool/execute')
      .send({
        params: {
          input: 'integration test',
          options: { includeMetadata: true }
        }
      })
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(response.body.result.data).toBeDefined();
    expect(response.body.metadata.toolName).toBe('your_custom_tool');
  });
});
```

## Step 7: Documentation

### Tool Documentation Template

```markdown
# Your Custom Tool

## Purpose
Brief description of what the tool does and why it's useful.

## Usage

### Basic Example
```json
{
  "tool": "your_custom_tool",
  "params": {
    "input": "example data",
    "options": {
      "format": "json"
    }
  }
}
```

### Advanced Example
```json
{
  "tool": "your_custom_tool",
  "params": {
    "input": "complex data",
    "options": {
      "format": "markdown",
      "includeMetadata": true
    }
  }
}
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| input | string | Yes | The data to process |
| options.format | string | No | Output format (json, text, markdown) |
| options.includeMetadata | boolean | No | Include processing metadata |

## Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    "processed": "PROCESSED DATA",
    "metadata": {...}
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description"
  }
}
```

## Error Codes
- `VALIDATION_ERROR`: Invalid input parameters
- `EXECUTION_ERROR`: Processing failed
- `TIMEOUT_ERROR`: Operation timed out
```

## Best Practices

1. **Clear Naming**: Use descriptive, action-oriented names
2. **Comprehensive Schemas**: Define all parameters clearly
3. **Error Messages**: Provide helpful, specific error messages
4. **Performance**: Optimize for common use cases
5. **Security**: Validate all inputs and sanitize outputs
6. **Documentation**: Keep documentation up-to-date
7. **Versioning**: Handle backward compatibility

## Deployment

### Registration
Tools are automatically registered when the application starts.

### Configuration
```yaml
tools:
  yourCustomTool:
    enabled: true
    timeout: 30000
    maxConcurrency: 10
    cache:
      enabled: true
      ttl: 3600
```

### Monitoring
Add metrics and logging:

```typescript
import { MetricsService } from '../../common/services/metrics.service';

constructor(
  private readonly metricsService: MetricsService
) {}

async execute(params: any): Promise<ToolResult> {
  const startTime = Date.now();
  
  try {
    const result = await this.performOperation(params);
    
    this.metricsService.recordToolExecution({
      tool: 'your_custom_tool',
      duration: Date.now() - startTime,
      success: true
    });
    
    return result;
  } catch (error) {
    this.metricsService.recordToolExecution({
      tool: 'your_custom_tool',
      duration: Date.now() - startTime,
      success: false,
      error: error.message
    });
    
    throw error;
  }
}
```

## Next Steps

- Review existing tools for patterns
- Test thoroughly with edge cases
- Add comprehensive documentation
- Consider performance optimizations
- Integrate with workflows