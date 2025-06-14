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
    description: 'Store a memory with semantic understanding and context. Memory types: episodic (events/conversations), semantic (facts/concepts), procedural (how-to/processes), working (temporary/session). Memories are stored across DynamoDB (metadata), OpenSearch (vector search), and Neo4j (relationships).',
    parameters: z.object({
      content: z.string().describe('Memory content to store'),
      agent_id: z.string().optional().describe('ID of the agent storing the memory'),
      session_id: z.string().optional().describe('Session ID for episodic memories'),
      project: z.string().optional().describe('Project context for memory isolation (defaults to "common")'),
      type: z.enum(['episodic', 'semantic', 'procedural', 'working']).optional().describe('Memory type: episodic (events/conversations), semantic (facts/concepts), procedural (how-to/processes), working (temporary with TTL)'),
      content_type: z.enum(['text', 'code']).optional().describe('Content type: text (natural language) or code (programming)'),
      tags: z.array(z.string()).optional().describe('Tags for categorization and clustering'),
    }),
  })
  async storeMemory(params: {
    content: string;
    agent_id?: string;
    session_id?: string;
    project?: string;
    type?: 'episodic' | 'semantic' | 'procedural' | 'working';
    content_type?: 'text' | 'code';
    tags?: string[];
  }) {
    const result = await this.memoryService.storeMemory(params);
    
    // Claude Code compatible format
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  @Tool({
    name: 'retrieve-memories',
    description: 'Retrieve relevant memories using semantic search across all storage layers. Uses vector similarity search in OpenSearch and can include graph-connected memories from Neo4j. Returns memories ranked by relevance with similarity scores.',
    parameters: z.object({
      query: z.string().optional().describe('Search query for semantic memory retrieval'),
      memory_ids: z.array(z.string()).optional().describe('Specific memory IDs to retrieve directly'),
      agent_id: z.string().optional().describe('Filter by agent ID who created the memories'),
      session_id: z.string().optional().describe('Filter by session ID for episodic context'),
      project: z.string().optional().describe('Filter by project context (use "common" for cross-project memories)'),
      type: z.enum(['episodic', 'semantic', 'procedural', 'working']).optional().describe('Filter by memory type: episodic (events), semantic (facts), procedural (processes), working (temporary)'),
      content_type: z.enum(['text', 'code']).optional().describe('Filter by content type: text or code'),
      limit: z.number().default(10).describe('Maximum number of memories to return (default: 10)'),
      offset: z.number().default(0).describe('Number of memories to skip for pagination (default: 0)'),
      threshold: z.number().min(0).max(1).optional().describe('Similarity threshold (0-1) for semantic search filtering'),
      include_related: z.boolean().default(false).describe('Include graph-connected related memories from Neo4j'),
    }),
  })
  async retrieveMemories(params: {
    query?: string;
    memory_ids?: string[];
    agent_id?: string;
    session_id?: string;
    project?: string;
    type?: 'episodic' | 'semantic' | 'procedural' | 'working';
    content_type?: 'text' | 'code';
    limit?: number;
    offset?: number;
    threshold?: number;
    include_related?: boolean;
  }) {
    let result;
    if (params.memory_ids) {
      result = await this.memoryService.retrieveMemories({ memory_ids: params.memory_ids });
    } else {
      const queryParams = {
        query: params.query, // Don't default to empty string
        agent_id: params.agent_id,
        session_id: params.session_id,
        project: params.project,
        type: params.type,
        content_type: params.content_type,
        limit: params.limit || 10,
        offset: params.offset || 0,
        threshold: params.threshold,
        include_related: params.include_related || false,
      };
      result = await this.memoryService.retrieveMemories({ query: queryParams });
    }
    
    // Claude Code compatible format
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  @Tool({
    name: 'add-connection',
    description: 'Create relationships between memories in the Neo4j knowledge graph. Enables building semantic networks of related concepts, procedures, and events. Common relationships: RELATES_TO (general connection), SIMILAR_TO (semantic similarity), REFERENCES (explicit reference), FOLLOWS (temporal sequence), IMPLEMENTS (procedural implementation), CONTRADICTS (conflicting information).',
    parameters: z.object({
      from_memory_id: z.string().describe('Source memory ID to connect from'),
      to_memory_id: z.string().describe('Target memory ID to connect to'),
      relationship_type: z.string().describe('Type of relationship: RELATES_TO, SIMILAR_TO, REFERENCES, FOLLOWS, IMPLEMENTS, CONTRADICTS, or custom'),
      bidirectional: z.boolean().default(false).describe('Create bidirectional relationship (both directions)'),
      properties: z.record(z.any()).optional().describe('Additional properties for the relationship (e.g., confidence, weight, context)'),
    }),
  })
  async addConnection(params: {
    from_memory_id: string;
    to_memory_id: string;
    relationship_type: string;
    bidirectional?: boolean;
    properties?: Record<string, any>;
  }) {
    const result = await this.memoryService.addConnection(params);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  @Tool({
    name: 'create-observation',
    description: 'Create an observation that synthesizes insights from multiple memories. Observations are higher-level insights that emerge from analyzing patterns across memories. They automatically create semantic memories and link to source memories in the knowledge graph.',
    parameters: z.object({
      agent_id: z.string().describe('ID of the agent making the observation'),
      observation: z.string().describe('The observation content - a synthesis or insight derived from analyzing memories'),
      context: z.record(z.any()).optional().describe('Additional context for the observation (e.g., confidence level, reasoning process)'),
      related_memory_ids: z.array(z.string()).optional().describe('Memory IDs that support or relate to this observation'),
    }),
  })
  async createObservation(params: {
    agent_id: string;
    observation: string;
    context?: Record<string, any>;
    related_memory_ids?: string[];
  }) {
    const result = await this.memoryService.createObservation(params);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
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
    const result = await this.memoryService.consolidateMemories(params);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  @Tool({
    name: 'delete-memory',
    description: 'Delete a memory and all its relationships',
    parameters: z.object({
      memory_id: z.string().describe('ID of the memory to delete'),
    }),
  })
  async deleteMemory(params: { memory_id: string }) {
    const result = await this.memoryService.deleteMemory(params.memory_id);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  @Tool({
    name: 'get-memory-statistics',
    description: 'Get memory statistics and analytics',
    parameters: z.object({
      agent_id: z.string().optional().describe('Filter statistics by agent ID'),
      project: z.string().optional().describe('Filter statistics by project'),
    }),
  })
  async getMemoryStatistics(params: { agent_id?: string; project?: string }) {
    const result = await this.memoryService.getMemoryStatistics(params.agent_id);
    
    // Claude Code compatible format
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  @Tool({
    name: 'list-agents',
    description: 'List all agents that have stored memories, with optional project filtering',
    parameters: z.object({
      project: z.string().optional().describe('Filter agents by project context'),
    }),
  })
  async listAgents(params: { project?: string }) {
    const result = await this.memoryService.listAgents(params.project);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  @Tool({
    name: 'list-projects',
    description: 'List all projects that contain memories, with statistics',
    parameters: z.object({
      include_stats: z.boolean().default(true).describe('Include memory and agent statistics for each project'),
    }),
  })
  async listProjects(params: { include_stats?: boolean }) {
    const result = await this.memoryService.listProjects(params.include_stats !== false);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  @Tool({
    name: 'retrieve-connections',
    description: 'Retrieve graph connections between memories',
    parameters: z.object({
      memory_id: z.string().optional().describe('Get connections for specific memory ID'),
      relationship_type: z.string().optional().describe('Filter by relationship type'),
      limit: z.number().default(50).describe('Maximum number of connections to return'),
    }),
  })
  async retrieveConnections(params: { memory_id?: string; relationship_type?: string; limit?: number }) {
    const result = await this.memoryService.retrieveConnections(params);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  @Tool({
    name: 'connections-by-entity',
    description: 'Get all connections for a specific entity (memory, agent, or session)',
    parameters: z.object({
      entity_id: z.string().describe('Entity ID (memory_id, agent_id, or session_id)'),
      entity_type: z.enum(['memory', 'agent', 'session']).describe('Type of entity'),
      limit: z.number().default(50).describe('Maximum number of connections to return'),
    }),
  })
  async connectionsByEntity(params: { entity_id: string; entity_type: 'memory' | 'agent' | 'session'; limit?: number }) {
    const result = await this.memoryService.connectionsByEntity(params);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
}