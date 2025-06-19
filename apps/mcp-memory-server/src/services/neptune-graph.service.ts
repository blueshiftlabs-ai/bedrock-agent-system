import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
const gremlin = require('gremlin');
import { MemoryConfigService } from '../config/memory-config.service';
import { 
  GraphConnection, 
  ConceptNode, 
  MemoryMetadata,
  StoredMemory 
} from '../types/memory.types';
import { getErrorMessage } from '../utils';

const driver = gremlin.driver;
const process = gremlin.process;
const { statics } = process;
const __ = statics;

/**
 * Neptune graph service for knowledge graph operations
 * Manages relationships, concepts, and graph traversal for sophisticated memory
 */
@Injectable()
export class NeptuneGraphService implements OnModuleDestroy {
  private readonly logger = new Logger(NeptuneGraphService.name);
  private gremlinConnection: any; // Gremlin connection
  private g: any; // Gremlin graph traversal source

  constructor(private readonly configService: MemoryConfigService) {
    this.initializeConnection();
  }

  /**
   * Initialize Gremlin connection to Neptune
   */
  private async initializeConnection(): Promise<void> {
    try {
      const { endpoint } = this.configService.neptuneConfig;
      
      // Create connection to Neptune (or local Gremlin server for development)
      this.gremlinConnection = new driver.DriverRemoteConnection(endpoint, {
        mimeType: 'application/vnd.gremlin-v3.0+json',
        pingEnabled: false,
      });

      // Create graph traversal source
      this.g = process.traversal().withRemote(this.gremlinConnection);
      
      this.logger.log('Neptune Graph Service initialized');
      
      // Initialize graph schema
      await this.initializeGraphSchema();
    } catch (error) {
      this.logger.error(`Failed to initialize Neptune connection: ${getErrorMessage(error)}`);
      // For development, continue without Neptune
      if (this.configService.isDevelopment) {
        this.logger.warn('Continuing without Neptune in development mode');
      } else {
        throw error;
      }
    }
  }

  /**
   * Initialize graph schema and indices
   */
  private async initializeGraphSchema(): Promise<void> {
    try {
      // Create property keys and indices if they don't exist
      // Note: In Neptune, schema is managed differently than in other graph DBs
      this.logger.log('Graph schema initialized');
    } catch (error) {
      this.logger.warn(`Failed to initialize graph schema: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Create a memory node in the graph
   */
  async createMemoryNode(memory: MemoryMetadata): Promise<string> {
    if (!this.g) {
      this.logger.warn('Neptune not available, skipping node creation');
      return `mock_node_${memory.memory_id}`;
    }

    try {
      const nodeId = `memory_${memory.memory_id}`;
      
      await this.g.addV('Memory')
        .property('memory_id', memory.memory_id)
        .property('type', memory.type)
        .property('content_type', memory.content_type)
        .property('agent_id', memory.agent_id || '')
        .property('session_id', memory.session_id || '')
        .property('created_at', memory.created_at.getTime())
        .property('tags', JSON.stringify(memory.tags || []))
        .property('confidence', memory.confidence || 0.0)
        .property('node_id', nodeId)
        .next();

      this.logger.debug(`Created memory node: ${nodeId}`);
      return nodeId;
    } catch (error) {
      this.logger.error(`Failed to create memory node: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Create a concept node
   */
  async createConceptNode(concept: ConceptNode): Promise<string> {
    if (!this.g) {
      this.logger.warn('Neptune not available, skipping concept creation');
      return `mock_concept_${concept.concept_id}`;
    }

    try {
      const nodeId = `concept_${concept.concept_id}`;
      
      await this.g.addV('Concept')
        .property('concept_id', concept.concept_id)
        .property('name', concept.name)
        .property('category', concept.category || '')
        .property('confidence', concept.confidence)
        .property('node_id', nodeId)
        .next();

      this.logger.debug(`Created concept node: ${nodeId}`);
      return nodeId;
    } catch (error) {
      this.logger.error(`Failed to create concept node: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Create an agent node
   */
  async createAgentNode(agentId: string, agentType?: string): Promise<string> {
    if (!this.g) {
      this.logger.warn('Neptune not available, skipping agent node creation');
      return `mock_agent_${agentId}`;
    }

    try {
      const nodeId = `agent_${agentId}`;
      
      // Check if agent node already exists
      const existing = await this.g.V()
        .has('Agent', 'agent_id', agentId)
        .next();

      if (existing.value) {
        return existing.value.get('node_id');
      }

      await this.g.addV('Agent')
        .property('agent_id', agentId)
        .property('agent_type', agentType || 'unknown')
        .property('node_id', nodeId)
        .property('created_at', Date.now())
        .next();

      this.logger.debug(`Created agent node: ${nodeId}`);
      return nodeId;
    } catch (error) {
      this.logger.error(`Failed to create agent node: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Create a session node
   */
  async createSessionNode(sessionId: string, agentId: string): Promise<string> {
    if (!this.g) {
      this.logger.warn('Neptune not available, skipping session node creation');
      return `mock_session_${sessionId}`;
    }

    try {
      const nodeId = `session_${sessionId}`;
      
      // Check if session node already exists
      const existing = await this.g.V()
        .has('Session', 'session_id', sessionId)
        .next();

      if (existing.value) {
        return existing.value.get('node_id');
      }

      await this.g.addV('Session')
        .property('session_id', sessionId)
        .property('agent_id', agentId)
        .property('node_id', nodeId)
        .property('started_at', Date.now())
        .next();

      this.logger.debug(`Created session node: ${nodeId}`);
      return nodeId;
    } catch (error) {
      this.logger.error(`Failed to create session node: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Add a connection between two entities
   */
  async addConnection(connection: GraphConnection): Promise<string> {
    if (!this.g) {
      this.logger.warn('Neptune not available, skipping connection creation');
      return `mock_edge_${Date.now()}`;
    }

    try {
      // Find source vertex
      const fromVertex = await this.g.V()
        .or(
          __.has('memory_id', connection.from_memory_id),
          __.has('concept_id', connection.from_memory_id),
          __.has('agent_id', connection.from_memory_id),
          __.has('session_id', connection.from_memory_id)
        )
        .next();

      // Find target vertex
      const toVertex = await this.g.V()
        .or(
          __.has('memory_id', connection.to_memory_id),
          __.has('concept_id', connection.to_memory_id),
          __.has('agent_id', connection.to_memory_id),
          __.has('session_id', connection.to_memory_id)
        )
        .next();

      if (!fromVertex.value || !toVertex.value) {
        throw new Error('One or both vertices not found');
      }

      // Create edge with properties
      const edge = await this.g.V(fromVertex.value.id)
        .addE(connection.relationship_type)
        .to(this.g.V(toVertex.value.id))
        .property('confidence', connection.confidence || 1.0)
        .property('created_at', Date.now())
        .next();

      // Add custom properties if provided
      if (connection.properties) {
        for (const [key, value] of Object.entries(connection.properties)) {
          await this.g.E(edge.value.id)
            .property(key, typeof value === 'object' ? JSON.stringify(value) : value)
            .next();
        }
      }

      const edgeId = edge.value.id.toString();
      this.logger.debug(`Created connection: ${connection.from_memory_id} -[${connection.relationship_type}]-> ${connection.to_memory_id}`);
      return edgeId;
    } catch (error) {
      this.logger.error(`Failed to add connection: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Find connections for a memory
   */
  async findConnections(
    memoryId: string, 
    relationshipTypes?: string[], 
    maxDepth: number = 2
  ): Promise<GraphConnection[]> {
    if (!this.g) {
      this.logger.warn('Neptune not available, returning empty connections');
      return [];
    }

    try {
      let query = this.g.V()
        .has('memory_id', memoryId);

      // Traverse outgoing edges
      if (relationshipTypes && relationshipTypes.length > 0) {
        query = query.outE(...relationshipTypes);
      } else {
        query = query.outE();
      }

      const edges = await query
        .project('edge', 'from', 'to')
        .by()
        .by(__.outV().values('memory_id', 'concept_id', 'agent_id', 'session_id'))
        .by(__.inV().values('memory_id', 'concept_id', 'agent_id', 'session_id'))
        .limit(50)
        .toList();

      const connections: GraphConnection[] = [];
      
      for (const result of edges) {
        const edge = result.get('edge');
        const fromId = result.get('from')[0] || memoryId;
        const toId = result.get('to')[0];

        if (toId) {
          connections.push({
            from_memory_id: fromId,
            to_memory_id: toId,
            relationship_type: edge.label,
            confidence: edge.get('confidence') || 1.0,
            properties: this.extractEdgeProperties(edge),
          });
        }
      }

      return connections;
    } catch (error) {
      this.logger.error(`Failed to find connections: ${getErrorMessage(error)}`);
      return [];
    }
  }

  /**
   * Find similar memories through graph traversal
   */
  async findSimilarMemoriesGraph(
    memoryId: string,
    maxResults: number = 10
  ): Promise<string[]> {
    if (!this.g) {
      this.logger.warn('Neptune not available, returning empty similar memories');
      return [];
    }

    try {
      // Find memories connected through similar concepts or patterns
      const similarMemories = await this.g.V()
        .has('memory_id', memoryId)
        .out('RELATES_TO', 'SIMILAR_TO', 'REFERENCES')
        .in('RELATES_TO', 'SIMILAR_TO', 'REFERENCES')
        .has('memory_id')
        .where(__.not(__.has('memory_id', memoryId))) // Exclude self
        .values('memory_id')
        .dedup()
        .limit(maxResults)
        .toList();

      return similarMemories;
    } catch (error) {
      this.logger.error(`Failed to find similar memories: ${getErrorMessage(error)}`);
      return [];
    }
  }

  /**
   * Create observation node and connections
   */
  async createObservation(
    agentId: string,
    observation: string,
    relatedMemoryIds: string[] = []
  ): Promise<{ observationId: string; connectionsCreated: number }> {
    if (!this.g) {
      this.logger.warn('Neptune not available, mocking observation creation');
      return {
        observationId: `mock_obs_${Date.now()}`,
        connectionsCreated: relatedMemoryIds.length,
      };
    }

    try {
      const observationId = `obs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const nodeId = `observation_${observationId}`;

      // Create observation node
      await this.g.addV('Observation')
        .property('observation_id', observationId)
        .property('agent_id', agentId)
        .property('content', observation)
        .property('node_id', nodeId)
        .property('created_at', Date.now())
        .next();

      // Create connections to related memories
      let connectionsCreated = 0;
      for (const memoryId of relatedMemoryIds) {
        try {
          await this.addConnection({
            from_memory_id: observationId,
            to_memory_id: memoryId,
            relationship_type: 'OBSERVES',
            confidence: 0.8,
          });
          connectionsCreated++;
        } catch (error) {
          this.logger.warn(`Failed to connect observation to memory ${memoryId}: ${getErrorMessage(error)}`);
        }
      }

      // Connect to agent
      try {
        await this.addConnection({
          from_memory_id: agentId,
          to_memory_id: observationId,
          relationship_type: 'MADE_OBSERVATION',
          confidence: 1.0,
        });
      } catch (error) {
        this.logger.warn(`Failed to connect observation to agent: ${getErrorMessage(error)}`);
      }

      this.logger.debug(`Created observation: ${observationId} with ${connectionsCreated} connections`);
      return { observationId, connectionsCreated };
    } catch (error) {
      this.logger.error(`Failed to create observation: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Get memory path between two memories
   */
  async getMemoryPath(
    fromMemoryId: string,
    toMemoryId: string,
    maxDepth: number = 4
  ): Promise<GraphConnection[]> {
    if (!this.g) {
      this.logger.warn('Neptune not available, returning empty path');
      return [];
    }

    try {
      const path = await this.g.V()
        .has('memory_id', fromMemoryId)
        .repeat(__.bothE().otherV())
        .until(__.has('memory_id', toMemoryId))
        .limit(1)
        .path()
        .next();

      if (!path.value) {
        return [];
      }

      // Convert path to connections
      const connections: GraphConnection[] = [];
      const pathObjects = path.value.objects;
      
      for (let i = 1; i < pathObjects.length; i += 2) {
        const edge = pathObjects[i];
        const fromVertex = pathObjects[i - 1];
        const toVertex = pathObjects[i + 1];

        connections.push({
          from_memory_id: this.extractVertexId(fromVertex),
          to_memory_id: this.extractVertexId(toVertex),
          relationship_type: edge.label,
          confidence: edge.get('confidence') || 1.0,
        });
      }

      return connections;
    } catch (error) {
      this.logger.error(`Failed to get memory path: ${getErrorMessage(error)}`);
      return [];
    }
  }

  /**
   * Delete memory node and its connections
   */
  async deleteMemoryNode(memoryId: string): Promise<void> {
    if (!this.g) {
      this.logger.warn('Neptune not available, skipping node deletion');
      return;
    }

    try {
      // Delete all edges connected to this memory
      await this.g.V()
        .has('memory_id', memoryId)
        .bothE()
        .drop()
        .iterate();

      // Delete the vertex itself
      await this.g.V()
        .has('memory_id', memoryId)
        .drop()
        .iterate();

      this.logger.debug(`Deleted memory node and connections: ${memoryId}`);
    } catch (error) {
      this.logger.error(`Failed to delete memory node: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Get graph statistics
   */
  async getGraphStatistics(agentId?: string): Promise<any> {
    if (!this.g) {
      return { message: 'Neptune not available' };
    }

    try {
      const stats: any = {};

      // Total counts
      stats.total_vertices = await this.g.V().count().next().then(r => r.value);
      stats.total_edges = await this.g.E().count().next().then(r => r.value);

      // Counts by label
      stats.memories = await this.g.V().hasLabel('Memory').count().next().then(r => r.value);
      stats.concepts = await this.g.V().hasLabel('Concept').count().next().then(r => r.value);
      stats.agents = await this.g.V().hasLabel('Agent').count().next().then(r => r.value);
      stats.sessions = await this.g.V().hasLabel('Session').count().next().then(r => r.value);
      stats.observations = await this.g.V().hasLabel('Observation').count().next().then(r => r.value);

      // Agent-specific stats
      if (agentId) {
        stats.agent_memories = await this.g.V()
          .hasLabel('Memory')
          .has('agent_id', agentId)
          .count()
          .next()
          .then(r => r.value);

        stats.agent_connections = await this.g.V()
          .has('agent_id', agentId)
          .bothE()
          .count()
          .next()
          .then(r => r.value);
      }

      return stats;
    } catch (error) {
      this.logger.error(`Failed to get graph statistics: ${getErrorMessage(error)}`);
      return { error: getErrorMessage(error) };
    }
  }

  /**
   * Health check for Neptune connection
   */
  async healthCheck(): Promise<boolean> {
    if (!this.g) {
      return false;
    }

    try {
      await this.g.V().limit(1).next();
      return true;
    } catch (error) {
      this.logger.error(`Neptune health check failed: ${getErrorMessage(error)}`);
      return false;
    }
  }

  /**
   * Extract edge properties from Gremlin edge
   */
  private extractEdgeProperties(edge: any): Record<string, any> {
    const properties: Record<string, any> = {};
    
    try {
      const keys = edge.keys();
      for (const key of keys) {
        if (key !== 'confidence' && key !== 'created_at') {
          properties[key] = edge.get(key);
        }
      }
    } catch (error) {
      // Ignore property extraction errors
    }
    
    return properties;
  }

  /**
   * Extract vertex ID from Gremlin vertex
   */
  private extractVertexId(vertex: any): string {
    try {
      return vertex.get('memory_id') || 
             vertex.get('concept_id') || 
             vertex.get('agent_id') || 
             vertex.get('session_id') || 
             vertex.id.toString();
    } catch (error) {
      return vertex.id?.toString() || 'unknown';
    }
  }

  /**
   * Cleanup connections on service destruction
   */
  async onModuleDestroy(): Promise<void> {
    if (this.gremlinConnection) {
      try {
        await this.gremlinConnection.close();
        this.logger.log('Neptune connection closed');
      } catch (error) {
        this.logger.error(`Error closing Neptune connection: ${getErrorMessage(error)}`);
      }
    }
  }
}