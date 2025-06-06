import { Injectable, Logger } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { MCPClientService } from '../clients/mcp-client.service';
import {
  StoreMemoryParams,
  RetrieveMemoryParams,
  CreateConnectionParams,
  ComprehensiveMemoryResult,
  MemoryStatistics,
  MemoryConnection,
} from '../types/memory.types';
import * as crypto from 'crypto';

@Injectable()
export class MemoryOrchestratorService {
  private readonly logger = new Logger(MemoryOrchestratorService.name);

  constructor(private readonly mcpClient: MCPClientService) {}

  @Tool({
    name: 'store-comprehensive-memory',
    description: 'Store memory across vector search, metadata storage, and graph relationships',
    parameters: z.object({
      content: z.string().describe('Memory content to store'),
      type: z.enum(['episodic', 'semantic', 'procedural', 'working']).describe('Type of memory'),
      content_type: z.enum(['text', 'code']).optional().describe('Content type'),
      agent_id: z.string().optional().describe('ID of the agent storing the memory'),
      session_id: z.string().optional().describe('Session ID for episodic memories'),
      tags: z.array(z.string()).optional().describe('Tags for categorization'),
      metadata: z.record(z.any()).optional().describe('Additional metadata'),
      ttl_hours: z.number().optional().describe('TTL in hours for working memory'),
    }),
  })
  async storeComprehensiveMemory(params: StoreMemoryParams): Promise<ComprehensiveMemoryResult> {
    const memoryId = `mem_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const contentHash = crypto.createHash('sha256').update(params.content).digest('hex');
    const timestamp = new Date().toISOString();
    
    const result: ComprehensiveMemoryResult = {
      memory_id: memoryId,
      success: false,
      errors: [],
    };

    this.logger.log(`Storing comprehensive memory: ${memoryId}`);

    try {
      // 1. Store metadata in PostgreSQL (Database MCP)
      if (this.mcpClient.hasCapability('database', 'document-storage')) {
        try {
          const expiresAt = params.ttl_hours && params.type === 'working' 
            ? new Date(Date.now() + params.ttl_hours * 60 * 60 * 1000).toISOString()
            : null;

          result.metadata_result = await this.mcpClient.callMCPTool(
            'database',
            'store-memory-metadata',
            [
              memoryId,
              params.content,
              contentHash,
              params.type,
              params.content_type || 'text',
              params.agent_id,
              params.session_id,
              JSON.stringify(params.tags || []),
              JSON.stringify(params.metadata || {}),
              expiresAt,
            ]
          );
          
          this.logger.debug(`Stored metadata for memory: ${memoryId}`);
        } catch (error) {
          const errorMsg = `Failed to store metadata: ${error.message}`;
          result.errors.push(errorMsg);
          this.logger.error(errorMsg);
        }
      }

      // 2. Index in OpenSearch for vector similarity (OpenSearch MCP)
      if (this.mcpClient.hasCapability('opensearch', 'document-indexing')) {
        try {
          const indexName = `memory-${params.type}`;
          const document = {
            id: memoryId,
            content: params.content,
            content_hash: contentHash,
            type: params.type,
            content_type: params.content_type || 'text',
            agent_id: params.agent_id,
            session_id: params.session_id,
            tags: params.tags || [],
            metadata: params.metadata || {},
            timestamp,
          };

          result.vector_result = await this.mcpClient.callMCPTool(
            'opensearch',
            'index_document',
            {
              index: indexName,
              id: memoryId,
              document,
            }
          );
          
          this.logger.debug(`Indexed document in OpenSearch: ${memoryId}`);
        } catch (error) {
          const errorMsg = `Failed to index in OpenSearch: ${error.message}`;
          result.errors.push(errorMsg);
          this.logger.error(errorMsg);
        }
      }

      // 3. Create graph node in Neo4j (Graph MCP)
      if (this.mcpClient.hasCapability('graph', 'graph-storage')) {
        try {
          const labels = ['Memory', params.type.charAt(0).toUpperCase() + params.type.slice(1)];
          const properties = {
            id: memoryId,
            content_summary: params.content.substring(0, 200) + (params.content.length > 200 ? '...' : ''),
            content_hash: contentHash,
            type: params.type,
            content_type: params.content_type || 'text',
            agent_id: params.agent_id,
            session_id: params.session_id,
            tags: params.tags || [],
            created_at: timestamp,
          };

          result.graph_result = await this.mcpClient.callMCPTool(
            'graph',
            'create_node',
            {
              labels,
              properties,
            }
          );

          // Create relationships to session and agent if provided
          if (params.session_id) {
            await this.createSessionRelationship(memoryId, params.session_id);
          }

          if (params.agent_id) {
            await this.createAgentRelationship(memoryId, params.agent_id);
          }
          
          this.logger.debug(`Created graph node for memory: ${memoryId}`);
        } catch (error) {
          const errorMsg = `Failed to create graph node: ${error.message}`;
          result.errors.push(errorMsg);
          this.logger.error(errorMsg);
        }
      }

      result.success = result.errors.length === 0;
      
      if (result.success) {
        this.logger.log(`Successfully stored comprehensive memory: ${memoryId}`);
      } else {
        this.logger.warn(`Partially stored memory ${memoryId} with ${result.errors.length} errors`);
      }

      return result;

    } catch (error) {
      this.logger.error(`Failed to store comprehensive memory: ${error.message}`);
      result.errors.push(`Orchestration error: ${error.message}`);
      result.success = false;
      
      // Attempt cleanup of partial data
      await this.cleanupPartialMemory(memoryId);
      
      return result;
    }
  }

  @Tool({
    name: 'retrieve-comprehensive-memories',
    description: 'Search and retrieve memories across all storage systems with relationships',
    parameters: z.object({
      query: z.string().optional().describe('Search query for semantic similarity'),
      memory_ids: z.array(z.string()).optional().describe('Specific memory IDs to retrieve'),
      type: z.enum(['episodic', 'semantic', 'procedural', 'working']).optional().describe('Filter by memory type'),
      agent_id: z.string().optional().describe('Filter by agent ID'),
      session_id: z.string().optional().describe('Filter by session ID'),
      tags: z.array(z.string()).optional().describe('Filter by tags'),
      limit: z.number().default(10).describe('Maximum number of memories to return'),
      threshold: z.number().min(0).max(1).optional().describe('Similarity threshold for vector search'),
      include_relationships: z.boolean().default(false).describe('Include graph relationships'),
      include_graph_context: z.boolean().default(false).describe('Include related graph nodes'),
    }),
  })
  async retrieveComprehensiveMemories(params: RetrieveMemoryParams): Promise<any> {
    this.logger.log('Retrieving comprehensive memories', { query: params.query, filters: { type: params.type, agent_id: params.agent_id } });

    const results: any = {
      memories: [],
      relationships: [],
      graph_context: [],
      metadata: {
        total_found: 0,
        search_method: [],
        servers_used: [],
      },
    };

    try {
      // 1. Vector similarity search (OpenSearch MCP)
      if (params.query && this.mcpClient.hasCapability('opensearch', 'vector-search')) {
        try {
          const searchResults = await this.mcpClient.callMCPTool(
            'opensearch',
            'search_documents',
            {
              index: params.type ? `memory-${params.type}` : 'memory-*',
              query: {
                multi_match: {
                  query: params.query,
                  fields: ['content^2', 'tags', 'metadata'],
                },
              },
              size: params.limit,
              min_score: params.threshold ? params.threshold * 10 : undefined, // Convert to ES score
            }
          );

          if (searchResults?.hits?.hits) {
            results.memories.push(...searchResults.hits.hits.map((hit: any) => ({
              ...hit._source,
              _score: hit._score,
              _search_method: 'vector_similarity',
            })));
            results.metadata.search_method.push('vector_similarity');
            results.metadata.servers_used.push('opensearch');
          }
        } catch (error) {
          this.logger.error(`Vector search failed: ${error.message}`);
        }
      }

      // 2. Metadata-based search (Database MCP)
      if (this.mcpClient.hasCapability('database', 'sql-queries')) {
        try {
          let dbResults = [];

          // Search by specific memory IDs
          if (params.memory_ids?.length) {
            dbResults = await this.mcpClient.callMCPTool(
              'database',
              'retrieve-memory-metadata',
              [params.memory_ids[0]] // Single ID for now, can be extended
            );
            if (dbResults) {
              dbResults = [dbResults]; // Normalize to array
            }
          }
          // Search by agent with filters
          else if (params.agent_id) {
            dbResults = await this.mcpClient.callMCPTool(
              'database',
              'search-memories-by-agent',
              [params.agent_id, params.type, params.session_id, params.limit]
            );
          }
          // Search by tags
          else if (params.tags?.length) {
            dbResults = await this.mcpClient.callMCPTool(
              'database',
              'search-memories-by-tags',
              [JSON.stringify(params.tags), params.limit]
            );
          }
          // Content-based search if query provided
          else if (params.query) {
            dbResults = await this.mcpClient.callMCPTool(
              'database',
              'search-memories-by-content',
              [params.query, params.limit]
            );
          }

          if (dbResults?.length) {
            // Merge with existing results, avoiding duplicates
            const existingIds = new Set(results.memories.map((m: any) => m.id));
            const newMemories = dbResults
              .filter((mem: any) => !existingIds.has(mem.id))
              .map((mem: any) => ({ ...mem, _search_method: 'metadata_filter' }));
            
            results.memories.push(...newMemories);
            results.metadata.search_method.push('metadata_filter');
            results.metadata.servers_used.push('database');
          }
        } catch (error) {
          this.logger.error(`Database search failed: ${error.message}`);
        }
      }

      // 3. Graph relationships (Neo4j MCP)
      if (params.include_relationships && this.mcpClient.hasCapability('graph', 'relationships')) {
        const memoryIds = results.memories.map((m: any) => m.id).filter(Boolean);
        
        if (memoryIds.length > 0) {
          try {
            const relationshipQuery = `
              MATCH (m:Memory)-[r]-(related)
              WHERE m.id IN $memory_ids
              RETURN m, r, related
              LIMIT 100
            `;

            const graphResults = await this.mcpClient.callMCPTool(
              'graph',
              'cypher_query',
              {
                query: relationshipQuery,
                params: { memory_ids: memoryIds },
              }
            );

            if (graphResults?.records) {
              results.relationships = graphResults.records;
              results.metadata.servers_used.push('graph');
            }
          } catch (error) {
            this.logger.error(`Graph relationship search failed: ${error.message}`);
          }
        }
      }

      // 4. Extended graph context
      if (params.include_graph_context && this.mcpClient.hasCapability('graph', 'cypher-queries')) {
        // Implementation for extended graph context would go here
        // This could include finding related concepts, similar memories, etc.
      }

      // Sort results by relevance/timestamp
      results.memories.sort((a: any, b: any) => {
        if (a._score && b._score) return b._score - a._score;
        return new Date(b.created_at || b.timestamp).getTime() - new Date(a.created_at || a.timestamp).getTime();
      });

      results.metadata.total_found = results.memories.length;
      results.metadata.servers_used = [...new Set(results.metadata.servers_used)];

      this.logger.log(`Retrieved ${results.metadata.total_found} memories using ${results.metadata.servers_used.join(', ')}`);

      return results;

    } catch (error) {
      this.logger.error(`Failed to retrieve comprehensive memories: ${error.message}`);
      throw error;
    }
  }

  @Tool({
    name: 'create-memory-connection',
    description: 'Create relationships between memories in the knowledge graph',
    parameters: z.object({
      from_memory_id: z.string().describe('Source memory ID'),
      to_memory_id: z.string().describe('Target memory ID'),
      relationship_type: z.string().describe('Type of relationship (e.g., RELATES_TO, SIMILAR_TO, REFERENCES)'),
      relationship_properties: z.record(z.any()).optional().describe('Additional properties for the relationship'),
      bidirectional: z.boolean().default(false).describe('Create bidirectional relationship'),
    }),
  })
  async createMemoryConnection(params: CreateConnectionParams): Promise<MemoryConnection> {
    this.logger.log(`Creating memory connection: ${params.from_memory_id} -> ${params.to_memory_id}`);

    try {
      // Create connection in PostgreSQL for metadata tracking
      if (this.mcpClient.hasCapability('database', 'sql-queries')) {
        await this.mcpClient.callMCPTool(
          'database',
          'create-memory-connection',
          [
            params.from_memory_id,
            params.to_memory_id,
            params.relationship_type,
            JSON.stringify(params.relationship_properties || {}),
            params.bidirectional || false,
          ]
        );
      }

      // Create relationship in Neo4j graph
      if (this.mcpClient.hasCapability('graph', 'relationships')) {
        const relationshipQuery = `
          MATCH (from:Memory {id: $from_id})
          MATCH (to:Memory {id: $to_id})
          CREATE (from)-[r:${params.relationship_type}]->(to)
          SET r += $properties
          SET r.created_at = datetime()
          ${params.bidirectional ? `CREATE (to)-[r2:${params.relationship_type}]->(from) SET r2 += $properties SET r2.created_at = datetime()` : ''}
          RETURN r
        `;

        await this.mcpClient.callMCPTool(
          'graph',
          'cypher_query',
          {
            query: relationshipQuery,
            params: {
              from_id: params.from_memory_id,
              to_id: params.to_memory_id,
              properties: params.relationship_properties || {},
            },
          }
        );
      }

      const connection: MemoryConnection = {
        id: crypto.randomUUID(),
        from_memory_id: params.from_memory_id,
        to_memory_id: params.to_memory_id,
        relationship_type: params.relationship_type,
        relationship_properties: params.relationship_properties,
        bidirectional: params.bidirectional || false,
        created_at: new Date().toISOString(),
      };

      this.logger.log(`Successfully created memory connection: ${connection.id}`);
      return connection;

    } catch (error) {
      this.logger.error(`Failed to create memory connection: ${error.message}`);
      throw error;
    }
  }

  @Tool({
    name: 'get-memory-statistics',
    description: 'Get comprehensive memory statistics and analytics',
    parameters: z.object({
      agent_id: z.string().optional().describe('Filter statistics by agent ID'),
    }),
  })
  async getMemoryStatistics(params: { agent_id?: string }): Promise<MemoryStatistics> {
    this.logger.log('Getting memory statistics', { agent_id: params.agent_id });

    try {
      if (this.mcpClient.hasCapability('database', 'sql-queries')) {
        const stats = await this.mcpClient.callMCPTool(
          'database',
          'get-memory-statistics',
          [params.agent_id]
        );

        return stats[0] || {
          total_memories: 0,
          episodic_memories: 0,
          semantic_memories: 0,
          procedural_memories: 0,
          working_memories: 0,
          unique_sessions: 0,
          total_content_size: 0,
          earliest_memory: null,
          latest_memory: null,
        };
      }

      throw new Error('Database MCP server not available for statistics');
    } catch (error) {
      this.logger.error(`Failed to get memory statistics: ${error.message}`);
      throw error;
    }
  }

  private async createSessionRelationship(memoryId: string, sessionId: string): Promise<void> {
    try {
      const query = `
        MERGE (s:Session {id: $session_id})
        WITH s
        MATCH (m:Memory {id: $memory_id})
        CREATE (m)-[:BELONGS_TO_SESSION]->(s)
      `;

      await this.mcpClient.callMCPTool('graph', 'cypher_query', {
        query,
        params: { memory_id: memoryId, session_id: sessionId },
      });
    } catch (error) {
      this.logger.warn(`Failed to create session relationship: ${error.message}`);
    }
  }

  private async createAgentRelationship(memoryId: string, agentId: string): Promise<void> {
    try {
      const query = `
        MERGE (a:Agent {id: $agent_id})
        WITH a
        MATCH (m:Memory {id: $memory_id})
        CREATE (m)-[:CREATED_BY]->(a)
      `;

      await this.mcpClient.callMCPTool('graph', 'cypher_query', {
        query,
        params: { memory_id: memoryId, agent_id: agentId },
      });
    } catch (error) {
      this.logger.warn(`Failed to create agent relationship: ${error.message}`);
    }
  }

  private async cleanupPartialMemory(memoryId: string): Promise<void> {
    this.logger.warn(`Cleaning up partial memory: ${memoryId}`);

    const cleanupPromises = [];

    // Cleanup OpenSearch
    if (this.mcpClient.hasCapability('opensearch', 'document-indexing')) {
      cleanupPromises.push(
        this.mcpClient.callMCPTool('opensearch', 'delete_document', {
          index: 'memory-*',
          id: memoryId,
        }).catch(err => this.logger.debug(`OpenSearch cleanup failed: ${err.message}`))
      );
    }

    // Cleanup PostgreSQL
    if (this.mcpClient.hasCapability('database', 'sql-queries')) {
      cleanupPromises.push(
        this.mcpClient.callMCPTool('database', 'delete-memory', [memoryId])
          .catch(err => this.logger.debug(`Database cleanup failed: ${err.message}`))
      );
    }

    // Cleanup Neo4j
    if (this.mcpClient.hasCapability('graph', 'graph-storage')) {
      cleanupPromises.push(
        this.mcpClient.callMCPTool('graph', 'cypher_query', {
          query: 'MATCH (m:Memory {id: $id}) DETACH DELETE m',
          params: { id: memoryId },
        }).catch(err => this.logger.debug(`Graph cleanup failed: ${err.message}`))
      );
    }

    await Promise.allSettled(cleanupPromises);
  }
}