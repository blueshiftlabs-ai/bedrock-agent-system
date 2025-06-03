# Base Agent

## Overview

The BaseAgent class serves as the foundation for all specialized agents in the MCP Hybrid Server. It provides common functionality, patterns, and integrations that all agents inherit.

## Class Definition

```typescript
export abstract class BaseAgent {
  protected readonly logger: Logger;
  protected readonly bedrockService: BedrockService;
  
  constructor(
    protected readonly name: string,
    bedrockService: BedrockService
  ) {
    this.logger = new Logger(name);
    this.bedrockService = bedrockService;
  }
  
  abstract async execute(input: any): Promise<any>;
}
```

## Core Features

### 1. Bedrock Integration
- Pre-configured AWS Bedrock service access
- Model invocation utilities
- Response parsing and error handling

### 2. Logging
- Structured logging with context
- Performance metrics
- Error tracking

### 3. Error Handling
- Standardized error responses
- Retry mechanisms
- Graceful degradation

### 4. Context Management
- Session tracking
- Memory persistence
- Context enrichment

## Methods

### `execute(input: any): Promise<any>`
Abstract method that must be implemented by all derived agents.

### `invokeModel(prompt: string, options?: ModelOptions): Promise<ModelResponse>`
Utility method for invoking Bedrock models with standardized options.

### `parseResponse(response: ModelResponse): any`
Parses and validates model responses.

## Extension Example

```typescript
export class MyCustomAgent extends BaseAgent {
  constructor(bedrockService: BedrockService) {
    super('MyCustomAgent', bedrockService);
  }
  
  async execute(input: CustomInput): Promise<CustomOutput> {
    this.logger.log('Processing custom analysis');
    
    const response = await this.invokeModel(
      this.buildPrompt(input),
      { temperature: 0.7 }
    );
    
    return this.parseResponse(response);
  }
  
  private buildPrompt(input: CustomInput): string {
    // Custom prompt building logic
  }
}
```

## Best Practices

1. **Always call super constructor**: Ensure proper initialization
2. **Use provided logger**: Maintain consistent logging
3. **Handle errors gracefully**: Use try-catch blocks and provide meaningful error messages
4. **Validate inputs**: Check input validity before processing
5. **Document behavior**: Clear documentation for execute method

## Configuration

```yaml
agent:
  timeout: 30000
  retries: 3
  model: claude-3-sonnet
```