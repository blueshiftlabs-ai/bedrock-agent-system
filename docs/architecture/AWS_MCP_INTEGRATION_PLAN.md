# AWS MCP Tools Integration Plan

## Overview
Instead of building AWS integrations from scratch, leverage the comprehensive set of AWS MCP tools available at https://github.com/awslabs/mcp

## Available AWS MCP Tools to Integrate

### 1. Core AWS Services
```bash
# Essential services for our multi-agent system
npm install @aws-mcp/s3              # Document storage
npm install @aws-mcp/bedrock         # AI model access
npm install @aws-mcp/dynamodb        # Metadata storage
npm install @aws-mcp/opensearch      # Vector search
npm install @aws-mcp/lambda          # Serverless functions
npm install @aws-mcp/sqs             # Message queuing
npm install @aws-mcp/sns             # Notifications
```

### 2. Integration Strategy

#### Current Custom AWS Services (to replace)
```
❌ src/aws/aws.service.ts        → ✅ @aws-mcp/core
❌ src/aws/s3.service.ts         → ✅ @aws-mcp/s3  
❌ src/aws/bedrock.service.ts    → ✅ @aws-mcp/bedrock
❌ src/aws/dynamodb.service.ts   → ✅ @aws-mcp/dynamodb
❌ src/aws/opensearch.service.ts → ✅ @aws-mcp/opensearch
❌ src/aws/neptune.service.ts    → ✅ @aws-mcp/rds (for Neptune)
```

#### Migration Plan
1. **Phase 1**: Install AWS MCP packages
2. **Phase 2**: Replace custom services with MCP tools
3. **Phase 3**: Remove circular dependencies
4. **Phase 4**: Add sophisticated memory layer on top

### 3. Tool Configuration
```typescript
// Example: S3 Memory Storage Tool
{
  name: "memory-store",
  description: "Store agent memories in S3 with metadata",
  mcp: "@aws-mcp/s3",
  config: {
    bucket: "agent-memories",
    prefix: "memories/",
    encryption: "AES256"
  }
}

// Example: Vector Search Tool  
{
  name: "memory-search",
  description: "Search memories using vector similarity",
  mcp: "@aws-mcp/opensearch", 
  config: {
    endpoint: process.env.OPENSEARCH_ENDPOINT,
    index: "agent-memories"
  }
}
```

## Tool Registry Architecture

### Unified Tool Interface
```typescript
interface UnifiedTool {
  id: string
  name: string
  description: string
  source: 'custom' | 'aws-mcp' | 'external'
  mcp?: string  // MCP package name
  execute: (params: any) => Promise<any>
}
```

### Tool Discovery & Registration
```typescript
class EnhancedToolRegistry {
  // Auto-discover and register AWS MCP tools
  async discoverAwsMcpTools(): Promise<void>
  
  // Register custom tools for specialized functionality
  async registerCustomTool(tool: CustomTool): Promise<void>
  
  // Unified tool execution
  async executeTool(toolId: string, params: any): Promise<any>
}
```

## Memory-Specific MCP Tools

### Custom Memory Tools (to build)
```typescript
// Memory storage with semantic understanding
{
  name: "store-episodic-memory",
  description: "Store conversational memories with context",
  execute: async (content, agentId, sessionId, metadata) => {
    // 1. Generate embeddings using Bedrock
    // 2. Store in S3 with rich metadata  
    // 3. Index in OpenSearch for retrieval
    // 4. Create knowledge graph relationships
  }
}

// Intelligent memory retrieval
{
  name: "retrieve-relevant-memories", 
  description: "Find memories relevant to current context",
  execute: async (query, agentId, contextFilters) => {
    // 1. Generate query embeddings
    // 2. Vector search in OpenSearch
    // 3. Apply contextual filtering
    // 4. Rank by relevance and recency
  }
}
```

## Deployment Considerations

### MCP Server Deployment Options

#### Option 1: Local Development
- Run MCP servers locally during development
- Direct Bedrock agent connections (if supported)

#### Option 2: AWS Fargate Deployment
```yaml
# docker-compose.mcp-production.yml
services:
  memory-mcp-server:
    image: mcp-hybrid-server:latest
    deploy:
      platform: linux/arm64
      resources:
        memory: 2G
        cpus: 1.0
    environment:
      - MCP_MODE=memory-server
      - AWS_REGION=us-east-1
    ports:
      - "3000:3000"
```

#### Option 3: Lambda Function Integration
```typescript
// For event-driven memory operations
export const memoryHandler = async (event: MCPEvent) => {
  const registry = new EnhancedToolRegistry()
  return await registry.executeTool(event.toolId, event.params)
}
```

## Implementation Priorities

### High Priority (Immediate)
1. Install and configure core AWS MCP tools
2. Replace circular dependency issues
3. Create unified tool registry
4. Basic memory store/retrieve functionality

### Medium Priority (Next Sprint)  
1. Advanced memory search and filtering
2. Knowledge graph integration
3. Multi-agent memory contexts
4. LangGraph workflow integration

### Lower Priority (Future)
1. Advanced memory consolidation
2. Cross-system MCP server sharing
3. Memory analytics and insights
4. Automated memory curation

## Success Metrics
- ✅ Server starts without dependency issues
- ✅ Basic AWS operations work via MCP tools
- ✅ Memories can be stored and retrieved
- ✅ Agents can access shared memory contexts
- ✅ LangGraph workflows leverage memory effectively