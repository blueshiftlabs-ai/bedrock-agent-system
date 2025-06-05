# Microservices MCP Architecture

## Overview

The Bedrock Agent System now uses a sophisticated microservices architecture where each AWS service is abstracted into its own containerized MCP server. This approach provides:

- **Service Isolation**: Each AWS service runs in its own container
- **Scalability**: Individual services can be scaled independently  
- **Official Tool Priority**: Prefer AWS Labs official MCP tools over custom implementations
- **Shared Packages**: Reusable components across all services
- **Protocol Standardization**: All inter-service communication via MCP protocol

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Main Application Layer                      │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ MCP Hybrid      │  │ MCP Dashboard   │  │ LangGraph       │  │
│  │ Server (3000)   │  │ (3100)          │  │ Workflows       │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │ MCP Protocol
┌─────────────────────────────────────────────────────────────────┐
│                    Containerized MCP Services                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Memory Server   │  │ Storage Server  │  │ Bedrock Server  │  │
│  │ (3001)          │  │ (3002)          │  │ (3003)          │  │
│  │                 │  │                 │  │                 │  │
│  │ • DynamoDB      │  │ • S3 Operations │  │ • Model Invoke  │  │
│  │ • OpenSearch    │  │ • File Mgmt     │  │ • Embeddings    │  │
│  │ • Knowledge     │  │ • Document      │  │ • Knowledge     │  │
│  │   Graph         │  │   Processing    │  │   Base Query    │  │
│  │ • Mem0.ai-like  │  │                 │  │ • Official AWS  │  │
│  │   Memory        │  │                 │  │   Labs Tools    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                       Shared Packages                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ @packages/      │  │ @packages/      │  │ @packages/      │  │
│  │ mcp-core        │  │ aws-api         │  │ shared-types    │  │
│  │                 │  │                 │  │                 │  │
│  │ • Base MCP      │  │ • AWS SDK       │  │ • Common        │  │
│  │   Server        │  │   Abstractions  │  │   Interfaces    │  │
│  │ • MCP Client    │  │ • Memory APIs   │  │ • Type          │  │
│  │ • Tool Registry │  │ • Storage APIs  │  │   Definitions   │  │
│  │ • Utilities     │  │ • Bedrock APIs  │  │                 │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Microservices Breakdown

### 1. MCP Memory Server (Port 3001)
**Purpose**: Sophisticated memory management with semantic understanding

**Capabilities**:
- Episodic, Semantic, Procedural, and Working memory types
- Vector similarity search via OpenSearch
- Knowledge graph relationships via Neptune
- Memory consolidation and association
- mem0.ai-inspired architecture

**MCP Tools**:
- `store-memory`: Store memories with rich metadata
- `retrieve-memories`: Semantic search and contextual retrieval
- `associate-memories`: Create knowledge graph relationships
- `consolidate-memories`: Merge and optimize memory storage
- `get-memory-graph`: Visualize memory connections

**Technology Stack**:
- NestJS + @packages/mcp-core
- DynamoDB for metadata
- S3 for content storage
- OpenSearch for vector search
- Neptune for knowledge graphs

### 2. MCP Storage Server (Port 3002)
**Purpose**: File operations, document processing, and S3 management

**Capabilities**:
- S3 bucket operations
- Document parsing and processing
- File upload/download with metadata
- Content analysis and indexing

**MCP Tools**:
- `store-file`: Upload files to S3 with metadata
- `get-file`: Download files from S3
- `list-files`: Browse bucket contents
- `process-document`: Extract text and metadata
- `index-content`: Create searchable indexes

**Technology Stack**:
- NestJS + @packages/mcp-core
- AWS S3 SDK
- Document processing libraries
- Content extraction tools

### 3. MCP Bedrock Server (Port 3003)
**Purpose**: AI model interactions and knowledge base operations

**Capabilities**:
- AWS Bedrock model invocation
- Embedding generation
- Knowledge base retrieval (AWS Labs official tools)
- Agent orchestration support

**MCP Tools**:
- `invoke-model`: Call Bedrock LLMs
- `generate-embeddings`: Create vector embeddings
- `query-knowledge-base`: Search Bedrock knowledge bases
- `create-agent`: Instantiate Bedrock agents
- `run-workflow`: Execute agent workflows

**Technology Stack**:
- NestJS + @packages/mcp-core
- AWS Bedrock SDK
- Official AWS Labs MCP tools (when available)
- LangChain integrations

## Shared Packages

### @packages/mcp-core
Common MCP functionality used across all services:

```typescript
// Base server class
export class BaseMCPServer {
  registerTool(tool: MCPTool): void
  executeTool(name: string, params: any): Promise<any>
  getServerInfo(): object
}

// MCP client for inter-service communication
export class MCPClient {
  executeTool(toolName: string, params: any): Promise<any>
  listTools(): Promise<MCPTool[]>
  healthCheck(): Promise<boolean>
}

// Common interfaces
export interface MCPTool {
  name: string
  description: string
  inputSchema: Record<string, any>
  execute: (params: any) => Promise<any>
}
```

### @packages/aws-api
AWS-specific utilities and type definitions:

```typescript
export interface MemoryMetadata {
  id: string
  type: 'episodic' | 'semantic' | 'procedural' | 'working'
  agentId?: string
  content: string
  embeddings?: number[]
  relationships?: string[]
}

export interface BedrockConfig {
  region: string
  defaultModel?: string
  defaultEmbeddingModel?: string
}
```

### @packages/shared-types
Common type definitions used across the entire system.

## Deployment Strategy

### Development Environment
```bash
# Start individual services for development
pnpm memory-server:dev    # Port 3001
pnpm storage-server:dev   # Port 3002  
pnpm bedrock-server:dev   # Port 3003
pnpm app:dev              # Port 3000 (main orchestrator)
```

### Production Environment
```bash
# Build and deploy all microservices
pnpm microservices:build
pnpm microservices:up

# Or deploy to AWS with containers
./deployment/deploy-microservices.sh prod
```

### Container Orchestration
- **Local Development**: Docker Compose
- **Production**: AWS Fargate with ECS
- **Service Discovery**: Built-in container networking
- **Load Balancing**: Application Load Balancer per service
- **Health Checks**: Native container health checks

## Communication Flow

### 1. Agent Request Flow
```
Agent Request → Main Server → MCP Client → MCP Service → AWS API → Response
```

### 2. Memory Storage Example
```typescript
// Main server uses MCP client to store memory
const memoryId = await mcpAwsService.storeMemory(
  "User prefers TypeScript over JavaScript",
  {
    type: 'semantic',
    agentId: 'code-analyzer',
    tags: ['preferences', 'languages']
  }
)

// This translates to MCP call:
// POST http://mcp-memory-server:3001/mcp/tools/store-memory
```

### 3. Multi-Service Workflow
```typescript
// LangGraph workflow using multiple MCP services
const workflow = new StateGraph({
  analyze: async (state) => {
    // Use Bedrock for analysis
    const analysis = await bedrockClient.executeTool('invoke-model', {...})
    
    // Store results in memory
    await memoryClient.executeTool('store-memory', {...})
    
    // Save artifacts to storage
    await storageClient.executeTool('store-file', {...})
  }
})
```

## Migration Strategy

### Phase 1: ✅ Foundation (Completed)
- Created shared packages structure
- Built MCP Memory Server skeleton
- Established Docker containers
- Updated main server to use MCP clients

### Phase 2: Service Implementation (Current)
- Complete MCP Memory Server with DynamoDB + OpenSearch
- Build MCP Storage Server with S3 operations
- Create MCP Bedrock Server with official AWS tools
- Test inter-service communication

### Phase 3: Official Tool Integration
- Replace custom implementations with AWS Labs tools
- Bedrock Knowledge Base retrieval integration
- DynamoDB MCP server from AWS Labs
- S3 MCP server from AWS Labs (when available)

### Phase 4: Production Deployment
- Deploy to AWS Fargate
- Configure service mesh
- Implement monitoring and observability
- Load testing and optimization

## Benefits of This Architecture

### 1. **Scalability**
- Scale memory operations independently of storage
- Add more instances of high-demand services
- Resource allocation per service needs

### 2. **Maintainability**
- Clear separation of concerns
- Easier to update individual services
- Shared packages reduce code duplication

### 3. **Official Tool Priority**
- Prefer AWS Labs official MCP tools
- Fallback to custom implementations
- Easy migration path when official tools become available

### 4. **Development Experience**
- Individual services can be developed/tested independently
- Shared types prevent interface mismatches
- MCP protocol standardizes all communication

### 5. **Production Readiness**
- Each service has health checks
- Container-native deployment
- Service isolation prevents cascading failures

## Next Steps

1. **Complete Memory Server Implementation**
   - Add DynamoDB integration
   - Implement OpenSearch vector search
   - Create knowledge graph operations

2. **Build Storage Server**
   - S3 operations with metadata
   - Document processing pipeline
   - Content indexing capabilities

3. **Integrate Official AWS Tools**
   - AWS Labs Bedrock tools
   - AWS Labs DynamoDB tools
   - AWS Labs Knowledge Base tools

4. **Production Deployment**
   - Deploy to AWS Fargate
   - Configure monitoring
   - Performance optimization

This architecture positions us perfectly for the sophisticated multi-agent system outlined in the roadmap, with each AWS service properly abstracted and scalable.