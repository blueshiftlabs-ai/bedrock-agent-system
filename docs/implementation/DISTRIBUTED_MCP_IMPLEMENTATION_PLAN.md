# Distributed MCP Implementation Plan

## Overview

This document outlines the implementation plan for replacing our monolithic memory server with a distributed architecture using official MCP servers from the ecosystem.

## Selected Official MCP Servers

### 1. OpenSearch MCP Server
**Repository**: `cr7258/elasticsearch-mcp-server` (supports both Elasticsearch and OpenSearch)
- **Purpose**: Vector similarity search and document indexing
- **Tools**: `search_documents`, `analyze_index`, `manage_cluster`
- **Local Setup**: OpenSearch container + MCP server
- **Production**: OpenSearch Serverless + AWS Labs MCP server

### 2. Google GenAI Toolbox MCP Server
**Repository**: `googleapis/genai-toolbox`
- **Purpose**: Database operations (PostgreSQL, MySQL, BigQuery)
- **Tools**: Database queries, document storage, JSON operations
- **Local Setup**: PostgreSQL container + GenAI Toolbox MCP server
- **Production**: Cloud SQL, AlloyDB, or DynamoDB via AWS Labs

### 3. Neo4j MCP Server
**Repository**: `neo4j-contrib/mcp-neo4j` (Official Neo4j contribution)
- **Purpose**: Graph memory and knowledge relationships
- **Tools**: `create_node`, `create_relationship`, `cypher_query`, `get_schema`
- **Local Setup**: Neo4j container + official Neo4j MCP server
- **Production**: Neo4j Aura or Neptune via AWS Labs

## Architecture Design

### Local Development Stack (Ports 4100-4110)

```yaml
services:
  # Databases
  opensearch:
    image: opensearchproject/opensearch:2.11.0
    ports: ["5102:9200"]
    
  postgresql:
    image: postgres:15-alpine
    ports: ["5432:5432"]
    
  neo4j:
    image: neo4j:5-community
    ports: ["7474:7474", "7687:7687"]
    
  # MCP Servers
  opensearch-mcp:
    image: cr7258/elasticsearch-mcp-server:latest
    environment:
      - OPENSEARCH_URL=http://opensearch:9200
      - MCP_SERVER_PORT=4101
    ports: ["4101:4101"]
    
  genai-toolbox-mcp:
    image: googleapis/genai-toolbox:latest
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgresql:5432/memory_db
      - MCP_SERVER_PORT=4102
    ports: ["4102:4102"]
    
  neo4j-mcp:
    image: neo4j-contrib/mcp-neo4j:latest
    environment:
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=password
      - MCP_SERVER_PORT=4103
    ports: ["4103:4103"]
    
  # Memory Orchestrator (Our Custom MCP Server)
  memory-orchestrator:
    build: ./apps/mcp-memory-orchestrator
    environment:
      - ENVIRONMENT=local
      - OPENSEARCH_MCP_ENDPOINT=http://opensearch-mcp:4101/mcp
      - DATABASE_MCP_ENDPOINT=http://genai-toolbox-mcp:4102/mcp
      - GRAPH_MCP_ENDPOINT=http://neo4j-mcp:4103/mcp
    ports: ["4100:4100"]
```

### Memory Orchestrator Implementation

```typescript
// apps/mcp-memory-orchestrator/src/memory-orchestrator.service.ts
@Injectable()
export class MemoryOrchestratorService {
  private mcpClients: Map<string, MCPClient> = new Map();
  
  constructor(private readonly configService: ConfigService) {
    this.initializeMCPClients();
  }
  
  private async initializeMCPClients() {
    const endpoints = {
      opensearch: this.configService.get('OPENSEARCH_MCP_ENDPOINT'),
      database: this.configService.get('DATABASE_MCP_ENDPOINT'),
      graph: this.configService.get('GRAPH_MCP_ENDPOINT')
    };
    
    for (const [name, endpoint] of Object.entries(endpoints)) {
      if (endpoint) {
        const client = new MCPClient(endpoint);
        await client.connect();
        this.mcpClients.set(name, client);
      }
    }
  }
  
  @Tool({
    name: 'store-comprehensive-memory',
    description: 'Store memory across vector, document, and graph storage systems'
  })
  async storeComprehensiveMemory(params: {
    content: string;
    type: 'episodic' | 'semantic' | 'procedural' | 'working';
    agent_id?: string;
    session_id?: string;
    tags?: string[];
  }) {
    const memoryId = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const results: any = { memory_id: memoryId };
    
    try {
      // 1. Vector search indexing (OpenSearch MCP)
      const opensearchClient = this.mcpClients.get('opensearch');
      if (opensearchClient) {
        results.vector = await opensearchClient.call('search_documents', {
          action: 'index',
          index: `memory-${params.type}`,
          document: {
            id: memoryId,
            content: params.content,
            type: params.type,
            agent_id: params.agent_id,
            session_id: params.session_id,
            tags: params.tags,
            timestamp: new Date().toISOString()
          }
        });
      }
      
      // 2. Metadata storage (Database MCP)
      const dbClient = this.mcpClients.get('database');
      if (dbClient) {
        results.metadata = await dbClient.call('execute_query', {
          query: `
            INSERT INTO memory_metadata (id, content, type, agent_id, session_id, tags, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
          `,
          params: [
            memoryId,
            params.content,
            params.type,
            params.agent_id,
            params.session_id,
            JSON.stringify(params.tags),
            new Date().toISOString()
          ]
        });
      }
      
      // 3. Graph node creation (Neo4j MCP)
      const graphClient = this.mcpClients.get('graph');
      if (graphClient) {
        results.graph = await graphClient.call('create_node', {
          labels: ['Memory', params.type],
          properties: {
            id: memoryId,
            content_summary: params.content.substring(0, 200),
            type: params.type,
            agent_id: params.agent_id,
            created_at: new Date().toISOString()
          }
        });
        
        // Create relationships to session and agent if provided
        if (params.session_id) {
          await graphClient.call('create_relationship', {
            from_node: results.graph.node_id,
            to_node_query: `MATCH (s:Session {id: $session_id}) RETURN s`,
            to_node_params: { session_id: params.session_id },
            relationship_type: 'BELONGS_TO_SESSION'
          });
        }
      }
      
      return results;
      
    } catch (error) {
      // Implement compensating transactions for partial failures
      await this.rollbackPartialMemory(memoryId, results);
      throw error;
    }
  }
  
  @Tool({
    name: 'retrieve-comprehensive-memories',
    description: 'Search memories across all storage systems'
  })
  async retrieveComprehensiveMemories(params: {
    query?: string;
    memory_ids?: string[];
    type?: string;
    agent_id?: string;
    session_id?: string;
    limit?: number;
    include_relationships?: boolean;
  }) {
    const results: any = {};
    
    // 1. Vector similarity search (OpenSearch MCP)
    const opensearchClient = this.mcpClients.get('opensearch');
    if (opensearchClient && params.query) {
      results.vector_matches = await opensearchClient.call('search_documents', {
        action: 'search',
        index: `memory-*`,
        query: {
          multi_match: {
            query: params.query,
            fields: ['content', 'tags']
          }
        },
        size: params.limit || 10
      });
    }
    
    // 2. Metadata filtering (Database MCP)
    const dbClient = this.mcpClients.get('database');
    if (dbClient) {
      let whereConditions = [];
      let queryParams = [];
      let paramIndex = 1;
      
      if (params.memory_ids?.length) {
        whereConditions.push(`id = ANY($${paramIndex})`);
        queryParams.push(params.memory_ids);
        paramIndex++;
      }
      
      if (params.type) {
        whereConditions.push(`type = $${paramIndex}`);
        queryParams.push(params.type);
        paramIndex++;
      }
      
      if (params.agent_id) {
        whereConditions.push(`agent_id = $${paramIndex}`);
        queryParams.push(params.agent_id);
        paramIndex++;
      }
      
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      
      results.metadata_matches = await dbClient.call('execute_query', {
        query: `
          SELECT * FROM memory_metadata 
          ${whereClause}
          ORDER BY created_at DESC
          LIMIT ${params.limit || 10}
        `,
        params: queryParams
      });
    }
    
    // 3. Graph relationships (Neo4j MCP)
    const graphClient = this.mcpClients.get('graph');
    if (graphClient && params.include_relationships) {
      const memoryIds = [
        ...(results.vector_matches?.hits?.map(h => h._id) || []),
        ...(results.metadata_matches?.rows?.map(r => r.id) || [])
      ];
      
      if (memoryIds.length > 0) {
        results.graph_relationships = await graphClient.call('cypher_query', {
          query: `
            MATCH (m:Memory)-[r]-(related)
            WHERE m.id IN $memory_ids
            RETURN m, r, related
            LIMIT 50
          `,
          params: { memory_ids: memoryIds }
        });
      }
    }
    
    return results;
  }
  
  private async rollbackPartialMemory(memoryId: string, results: any) {
    // Compensating transactions for partial failures
    const promises = [];
    
    if (results.vector) {
      const opensearchClient = this.mcpClients.get('opensearch');
      promises.push(
        opensearchClient?.call('search_documents', {
          action: 'delete',
          index: `memory-*`,
          id: memoryId
        })
      );
    }
    
    if (results.metadata) {
      const dbClient = this.mcpClients.get('database');
      promises.push(
        dbClient?.call('execute_query', {
          query: 'DELETE FROM memory_metadata WHERE id = $1',
          params: [memoryId]
        })
      );
    }
    
    if (results.graph) {
      const graphClient = this.mcpClients.get('graph');
      promises.push(
        graphClient?.call('cypher_query', {
          query: 'MATCH (m:Memory {id: $id}) DETACH DELETE m',
          params: { id: memoryId }
        })
      );
    }
    
    await Promise.allSettled(promises);
  }
}
```

## Implementation Steps

### Phase 1: Local Environment Setup (Week 1)
1. **Create docker-compose.yml** with all required services
2. **Set up OpenSearch MCP server** using `cr7258/elasticsearch-mcp-server`
3. **Set up GenAI Toolbox MCP server** with PostgreSQL
4. **Set up Neo4j MCP server** using official `neo4j-contrib/mcp-neo4j`
5. **Test individual MCP servers** with MCP Inspector

### Phase 2: Memory Orchestrator Development (Week 2)
1. **Create new NestJS app**: `apps/mcp-memory-orchestrator`
2. **Implement MCP client connections** to all three servers
3. **Implement orchestrated memory operations**
4. **Add error handling and compensating transactions**
5. **Test memory storage and retrieval end-to-end**

### Phase 3: Integration and Testing (Week 3)
1. **Integrate with existing hybrid server**
2. **Update dashboard to monitor distributed MCP servers**
3. **Performance testing and optimization**
4. **Documentation and deployment guides**

### Phase 4: Production Readiness (Week 4)
1. **AWS deployment configuration**
2. **Switch to AWS Labs MCP servers for production**
3. **Monitoring and observability**
4. **Multi-cloud deployment documentation**

## Benefits of This Approach

1. **Proven Components**: Using official, tested MCP servers
2. **Separation of Concerns**: Each server handles its domain expertise
3. **Scalability**: Independent scaling of each service
4. **Flexibility**: Easy to swap implementations (Neo4j ↔ Neptune)
5. **Community Support**: Benefit from ecosystem improvements
6. **Development Speed**: Faster than building custom implementations

## Configuration Management

### Environment Variables
```bash
# Local Development
ENVIRONMENT=local
OPENSEARCH_MCP_ENDPOINT=http://localhost:4101/mcp
DATABASE_MCP_ENDPOINT=http://localhost:4102/mcp
GRAPH_MCP_ENDPOINT=http://localhost:4103/mcp

# AWS Production
ENVIRONMENT=aws
OPENSEARCH_MCP_ENDPOINT=https://opensearch-mcp.aws.com/mcp
DATABASE_MCP_ENDPOINT=https://dynamodb-mcp.aws.com/mcp
GRAPH_MCP_ENDPOINT=https://neptune-mcp.aws.com/mcp
```

This implementation plan provides a clear path to building a robust, distributed memory system using the growing MCP ecosystem while maintaining the flexibility to deploy across different cloud providers.