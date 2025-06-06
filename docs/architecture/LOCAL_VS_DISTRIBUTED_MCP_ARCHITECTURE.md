# Local vs Distributed MCP Architecture Strategy

## Overview

This document defines how the Memory Orchestrator coordinates with different MCP servers in local development versus production deployment, ensuring seamless transitions between environments.

## Core Principle: Environment-Aware Orchestration

The Memory Orchestrator acts as an intelligent proxy that:
1. **Discovers** available MCP servers based on environment
2. **Routes** requests to appropriate servers
3. **Abstracts** the underlying implementation from agents
4. **Maintains** consistent interfaces across environments

## Architecture Layers

### 1. Local Development Architecture

```yaml
Local Development (Port 4100-4105)
├── Memory Orchestrator (4100)
│   ├── Coordinates all memory operations
│   └── Provides unified MCP interface
├── OpenSearch MCP Server (4101)
│   ├── Local OpenSearch container
│   └── Vector similarity search
├── PostgreSQL MCP Server (4102) [GenAI Toolbox]
│   ├── Local PostgreSQL with JSON support
│   └── Metadata and document storage
├── Neo4j MCP Server (4103)
│   ├── Local Neo4j container
│   └── Graph relationships
└── File Storage MCP Server (4104)
    ├── Local filesystem
    └── Large content storage
```

### 2. AWS Production Architecture

```yaml
AWS Fargate Deployment
├── Memory Orchestrator (ECS Service)
│   ├── Same orchestration logic
│   └── Different server endpoints
├── OpenSearch MCP Server (AWS Labs)
│   ├── OpenSearch Serverless
│   └── Managed vector search
├── DynamoDB MCP Server (AWS Labs)
│   ├── DynamoDB tables
│   └── Metadata storage
├── Neptune MCP Server (AWS Labs)
│   ├── Neptune graph database
│   └── Knowledge graph
└── S3 MCP Server (AWS Labs)
    ├── S3 buckets
    └── Large content storage
```

## Memory Orchestrator Design

### Environment Configuration

```typescript
// config/mcp-servers.config.ts
export interface MCPServerConfig {
  name: string;
  endpoint: string;
  transport: 'http' | 'sse' | 'stdio';
  capabilities: string[];
}

export const getMCPServers = (environment: 'local' | 'aws' | 'gcp'): MCPServerConfig[] => {
  switch (environment) {
    case 'local':
      return [
        {
          name: 'opensearch-mcp',
          endpoint: 'http://localhost:4101/mcp',
          transport: 'http',
          capabilities: ['vector-search', 'indexing']
        },
        {
          name: 'postgresql-mcp',
          endpoint: 'http://localhost:4102/mcp',
          transport: 'http',
          capabilities: ['document-storage', 'json-queries']
        },
        {
          name: 'neo4j-mcp',
          endpoint: 'http://localhost:4103/mcp',
          transport: 'http',
          capabilities: ['graph-storage', 'relationships']
        }
      ];
    
    case 'aws':
      return [
        {
          name: 'aws-opensearch-mcp',
          endpoint: process.env.OPENSEARCH_MCP_ENDPOINT,
          transport: 'http',
          capabilities: ['vector-search', 'indexing']
        },
        {
          name: 'aws-dynamodb-mcp',
          endpoint: process.env.DYNAMODB_MCP_ENDPOINT,
          transport: 'http',
          capabilities: ['document-storage', 'nosql']
        },
        {
          name: 'aws-neptune-mcp',
          endpoint: process.env.NEPTUNE_MCP_ENDPOINT,
          transport: 'http',
          capabilities: ['graph-storage', 'gremlin']
        }
      ];
    
    case 'gcp':
      return [
        {
          name: 'vertex-search-mcp',
          endpoint: process.env.VERTEX_MCP_ENDPOINT,
          transport: 'http',
          capabilities: ['vector-search', 'ai-search']
        },
        {
          name: 'cloud-sql-mcp',
          endpoint: process.env.CLOUD_SQL_MCP_ENDPOINT,
          transport: 'http',
          capabilities: ['document-storage', 'postgresql']
        }
      ];
  }
};
```

### Orchestrator Implementation

```typescript
@Injectable()
export class MemoryOrchestratorService {
  private mcpServers: Map<string, MCPClient> = new Map();
  
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger
  ) {
    this.initializeMCPServers();
  }
  
  private async initializeMCPServers() {
    const environment = this.configService.get('ENVIRONMENT', 'local');
    const servers = getMCPServers(environment);
    
    for (const server of servers) {
      try {
        const client = new MCPClient(server);
        await client.connect();
        this.mcpServers.set(server.name, client);
        this.logger.log(`Connected to ${server.name} at ${server.endpoint}`);
      } catch (error) {
        this.logger.error(`Failed to connect to ${server.name}: ${error.message}`);
      }
    }
  }
  
  @Tool({
    name: 'store-comprehensive-memory',
    description: 'Store memory across all available storage systems'
  })
  async storeComprehensiveMemory(params: StoreMemoryParams) {
    const results = {};
    
    // 1. Vector indexing - available in all environments
    const vectorServer = this.findServerByCapability('vector-search');
    if (vectorServer) {
      results['vector'] = await vectorServer.call('index-document', {
        content: params.content,
        metadata: params.metadata
      });
    }
    
    // 2. Document storage - PostgreSQL locally, DynamoDB in AWS
    const docServer = this.findServerByCapability('document-storage');
    if (docServer) {
      results['document'] = await docServer.call('store-document', {
        document: {
          id: results['vector']?.id,
          ...params
        }
      });
    }
    
    // 3. Graph storage - Neo4j locally, Neptune in AWS
    const graphServer = this.findServerByCapability('graph-storage');
    if (graphServer) {
      results['graph'] = await graphServer.call('create-node', {
        labels: ['Memory', params.type],
        properties: {
          id: results['vector']?.id,
          summary: params.content.substring(0, 200)
        }
      });
    }
    
    return results;
  }
  
  private findServerByCapability(capability: string): MCPClient | null {
    for (const [name, client] of this.mcpServers) {
      const server = getMCPServers(this.configService.get('ENVIRONMENT'))
        .find(s => s.name === name);
      if (server?.capabilities.includes(capability)) {
        return client;
      }
    }
    return null;
  }
}
```

## Deployment Strategies

### Local Development Setup

```bash
# docker-compose.local.yml
version: '3.8'
services:
  opensearch:
    image: opensearchproject/opensearch:2.11.0
    ports: ["9200:9200"]
    
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: memory_store
    ports: ["5432:5432"]
    
  neo4j:
    image: neo4j:5-community
    ports: ["7474:7474", "7687:7687"]
    
  # MCP Servers
  opensearch-mcp:
    image: opensearch-mcp:latest
    environment:
      OPENSEARCH_URL: http://opensearch:9200
    ports: ["4101:4101"]
    
  genai-toolbox-mcp:
    image: genai-toolbox-mcp:latest
    environment:
      DATABASE_URL: postgresql://postgres:5432/memory_store
    ports: ["4102:4102"]
    
  neo4j-mcp:
    image: neo4j-mcp:latest
    environment:
      NEO4J_URI: bolt://neo4j:7687
    ports: ["4103:4103"]
    
  memory-orchestrator:
    build: ./apps/mcp-memory-server
    environment:
      ENVIRONMENT: local
      MCP_SERVERS: opensearch-mcp,genai-toolbox-mcp,neo4j-mcp
    ports: ["4100:4100"]
```

### AWS Production Deployment

```typescript
// CDK Stack
export class MCPOrchestratorStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);
    
    // Memory Orchestrator Service
    const orchestratorTask = new FargateTaskDefinition(this, 'OrchestratorTask');
    
    orchestratorTask.addContainer('orchestrator', {
      image: ContainerImage.fromRegistry('memory-orchestrator:latest'),
      environment: {
        ENVIRONMENT: 'aws',
        OPENSEARCH_MCP_ENDPOINT: opensearchMcp.endpoint,
        DYNAMODB_MCP_ENDPOINT: dynamodbMcp.endpoint,
        NEPTUNE_MCP_ENDPOINT: neptuneMcp.endpoint,
        S3_MCP_ENDPOINT: s3Mcp.endpoint
      },
      portMappings: [{ containerPort: 4100 }]
    });
    
    // AWS Labs MCP Servers (deployed separately)
    // These connect to actual AWS services
  }
}
```

## Key Benefits

### 1. **Environment Abstraction**
- Agents use the same MCP interface regardless of environment
- Orchestrator handles routing to appropriate backends

### 2. **Progressive Migration**
- Start with local containers
- Gradually move to managed services
- No code changes required in agents

### 3. **Cost Optimization**
- Use free local services for development
- Only pay for cloud services in production
- Easy to test expensive operations locally

### 4. **Flexibility**
- Mix and match services (e.g., local Neo4j + AWS OpenSearch)
- Easy to add new storage backends
- Support for multi-cloud deployment

## Testing Strategy

### Local Testing
```bash
# Test orchestrator with all local services
npm test:integration:local

# Test individual MCP server connections
npm test:mcp:opensearch
npm test:mcp:postgresql
npm test:mcp:neo4j
```

### Production Testing
```bash
# Test with AWS services (requires credentials)
ENVIRONMENT=aws npm test:integration:aws

# Smoke tests for production
npm test:smoke:production
```

## Migration Path

### Phase 1: Local Development (Current)
- Implement orchestrator with local MCP servers
- Test memory operations end-to-end
- Validate orchestration patterns

### Phase 2: Hybrid Mode
- Deploy orchestrator to AWS
- Keep using local storage for some operations
- Use AWS services for others

### Phase 3: Full Production
- All MCP servers use AWS managed services
- Orchestrator runs on Fargate
- Full monitoring and observability

This architecture ensures that you can develop and test locally with full fidelity while maintaining a clear path to production deployment without code changes.