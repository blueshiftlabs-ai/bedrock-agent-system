import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { MemoryService } from '../services/memory.service';

/**
 * MCP Tools Service - provides memory operations via MCP protocol
 */
@Injectable()
export class MCPToolsService {
  constructor(private readonly memoryService: MemoryService) {}

  @Tool({
    name: 'store-memory',
    description: 'Store a memory with semantic understanding and context',
    parameters: z.object({
      content: z.string().describe('Memory content to store'),
      agent_id: z.string().optional().describe('ID of the agent storing the memory'),
      session_id: z.string().optional().describe('Session ID for episodic memories'),
      type: z.enum(['episodic', 'semantic', 'procedural', 'working']).optional().describe('Memory type'),
      content_type: z.enum(['text', 'code']).optional().describe('Content type'),
      tags: z.array(z.string()).optional().describe('Tags for categorization'),
    }),
  })
  async storeMemory(params: {
    content: string;
    agent_id?: string;
    session_id?: string;
    type?: 'episodic' | 'semantic' | 'procedural' | 'working';
    content_type?: 'text' | 'code';
    tags?: string[];
  }) {
    return await this.memoryService.storeMemory(params);
  }

  @Tool({
    name: 'retrieve-memories',
    description: 'Retrieve relevant memories using semantic search',
    parameters: z.object({
      query: z.string().optional().describe('Search query for memory retrieval'),
      memory_ids: z.array(z.string()).optional().describe('Specific memory IDs to retrieve'),
      agent_id: z.string().optional().describe('Filter by agent ID'),
      session_id: z.string().optional().describe('Filter by session ID'),
      type: z.enum(['episodic', 'semantic', 'procedural', 'working']).optional().describe('Filter by memory type'),
      content_type: z.enum(['text', 'code']).optional().describe('Filter by content type'),
      limit: z.number().default(10).describe('Maximum number of memories to return'),
      threshold: z.number().min(0).max(1).optional().describe('Similarity threshold (0-1)'),
      include_related: z.boolean().default(false).describe('Include graph-connected related memories'),
    }),
  })
  async retrieveMemories(params: {
    query?: string;
    memory_ids?: string[];
    agent_id?: string;
    session_id?: string;
    type?: 'episodic' | 'semantic' | 'procedural' | 'working';
    content_type?: 'text' | 'code';
    limit?: number;
    threshold?: number;
    include_related?: boolean;
  }) {
    if (params.memory_ids) {
      return await this.memoryService.retrieveMemories({ memory_ids: params.memory_ids });
    } else {
      const queryParams = {
        query: params.query || '',
        filters: {
          agent_id: params.agent_id,
          session_id: params.session_id,
          type: params.type,
          content_type: params.content_type,
        },
        limit: params.limit || 10,
        threshold: params.threshold,
        include_related: params.include_related || false,
      };
      return await this.memoryService.retrieveMemories({ query: queryParams });
    }
  }

  @Tool({
    name: 'add-connection',
    description: 'Create relationships between memories in the knowledge graph',
    parameters: z.object({
      from_memory_id: z.string().describe('Source memory ID'),
      to_memory_id: z.string().describe('Target memory ID'),
      relationship_type: z.string().describe('Type of relationship (e.g., RELATES_TO, SIMILAR_TO, REFERENCES)'),
      bidirectional: z.boolean().default(false).describe('Create bidirectional relationship'),
      properties: z.record(z.any()).optional().describe('Additional properties for the relationship'),
    }),
  })
  async addConnection(params: {
    from_memory_id: string;
    to_memory_id: string;
    relationship_type: string;
    bidirectional?: boolean;
    properties?: Record<string, any>;
  }) {
    return await this.memoryService.addConnection(params);
  }

  @Tool({
    name: 'create-observation',
    description: 'Create an observation and link it to related memories',
    parameters: z.object({
      agent_id: z.string().describe('ID of the agent making the observation'),
      observation: z.string().describe('The observation content'),
      context: z.record(z.any()).optional().describe('Additional context for the observation'),
      related_memory_ids: z.array(z.string()).optional().describe('Memory IDs related to this observation'),
    }),
  })
  async createObservation(params: {
    agent_id: string;
    observation: string;
    context?: Record<string, any>;
    related_memory_ids?: string[];
  }) {
    return await this.memoryService.createObservation(params);
  }

  @Tool({
    name: 'consolidate-memories',
    description: 'Consolidate and merge related memories to reduce redundancy',
    parameters: z.object({
      agent_id: z.string().optional().describe('Agent ID to consolidate memories for'),
      similarity_threshold: z.number().min(0).max(1).default(0.9).describe('Similarity threshold for consolidation'),
      max_consolidations: z.number().default(50).describe('Maximum number of consolidations to perform'),
    }),
  })
  async consolidateMemories(params: {
    agent_id?: string;
    similarity_threshold?: number;
    max_consolidations?: number;
  }) {
    return await this.memoryService.consolidateMemories(params);
  }

  @Tool({
    name: 'delete-memory',
    description: 'Delete a memory and all its relationships',
    parameters: z.object({
      memory_id: z.string().describe('ID of the memory to delete'),
    }),
  })
  async deleteMemory(params: { memory_id: string }) {
    return await this.memoryService.deleteMemory(params.memory_id);
  }

  @Tool({
    name: 'get-memory-statistics',
    description: 'Get memory statistics and analytics',
    parameters: z.object({
      agent_id: z.string().optional().describe('Filter statistics by agent ID'),
    }),
  })
  async getMemoryStatistics(params: { agent_id?: string }) {
    return await this.memoryService.getMemoryStatistics(params.agent_id);
  }
}