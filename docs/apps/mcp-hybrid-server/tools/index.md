# Tools Documentation

## Overview

Tools in the MCP Hybrid Server implement the Model Context Protocol (MCP) specification, providing standardized interfaces for AI models to interact with various systems and perform specific tasks.

## Tool Architecture

### Components

1. **[Tool Implementations](./implementations/)** - Individual tool classes
2. **[Tool Registry](./registry/)** - Dynamic registration and discovery
3. **Tool Service** - Orchestration and execution
4. **Tool Module** - NestJS module configuration

## Available Tools

### [Code Analysis Tool](./implementations/code-analysis-tool.md)
Analyzes source code structure and quality.

### [Database Analysis Tool](./implementations/database-analysis-tool.md)
Examines database schemas and queries.

### [Document Retrieval Tool](./implementations/document-retrieval-tool.md)
Searches and retrieves relevant documentation.

### [Knowledge Graph Tool](./implementations/knowledge-graph-tool.md)
Interacts with the knowledge graph database.

## MCP Protocol Compliance

All tools follow the MCP specification:

```typescript
interface MCPTool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  execute(params: any): Promise<ToolResult>;
}
```

## Tool Registration

Tools self-register using decorators:

```typescript
@MCPTool({
  name: 'analyze_code',
  description: 'Analyzes source code files'
})
export class CodeAnalysisTool implements IMCPTool {
  // Implementation
}
```

## Creating Custom Tools

See [Creating Custom Tools](../../../tutorials/advanced/creating-custom-tools.md) for a detailed guide.

## Best Practices

1. **Clear Naming**: Use descriptive, action-oriented names
2. **Input Validation**: Validate all inputs against schema
3. **Error Handling**: Return structured error responses
4. **Documentation**: Comprehensive descriptions and examples
5. **Testing**: Unit tests for all edge cases

## Tool Discovery

Tools are discoverable via the MCP endpoint:

```bash
GET /mcp/tools
```

Returns a list of all registered tools with their schemas.