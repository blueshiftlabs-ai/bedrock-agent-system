import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import neo4j, { Driver, Session } from 'neo4j-driver';
import { MemoryConfigService } from '../config/memory-config.service';
import { 
  GraphConnection, 
  ConceptNode, 
  MemoryMetadata,
  StoredMemory 
} from '../types/memory.types';
import { getErrorMessage } from '../utils';

/**
 * Neo4j graph service for knowledge graph operations
 * Provides sophisticated memory connections and graph traversal
 */
@Injectable()
export class Neo4jGraphService implements OnModuleDestroy {
  private readonly logger = new Logger(Neo4jGraphService.name);
  private driver: Driver;

  constructor(private readonly configService: MemoryConfigService) {
    this.initializeConnection();
  }

  /**
   * Initialize Neo4j connection
   */
  private async initializeConnection(): Promise<void> {
    try {
      const { uri, username, password } = this.configService.neo4jConfig;
      
      // Create Neo4j driver with proper encryption settings
      this.driver = neo4j.driver(
        uri, 
        neo4j.auth.basic(username, password),
        { 
          encrypted: false, // Disable encryption for local development
          trust: 'TRUST_ALL_CERTIFICATES' // Trust self-signed certificates
        }
      );

      // Verify connectivity
      await this.driver.verifyConnectivity();
      
      this.logger.log('Neo4j Graph Service initialized');
      
      // Initialize graph schema
      await this.initializeGraphSchema();
    } catch (error) {
      this.logger.error(`Failed to initialize Neo4j connection: ${getErrorMessage(error)}`);
      // For development, continue without Neo4j
      if (this.configService.isDevelopment) {
        this.logger.warn('Continuing without Neo4j in development mode');
      }
    }
  }

  /**
   * Initialize graph schema and constraints
   */
  private async initializeGraphSchema(): Promise<void> {
    const session = this.driver.session();
    
    try {
      // Create constraints and indexes for better performance
      const queries = [
        // Memory node constraints
        'CREATE CONSTRAINT memory_id_unique IF NOT EXISTS FOR (m:Memory) REQUIRE m.memory_id IS UNIQUE',
        'CREATE INDEX memory_agent_id IF NOT EXISTS FOR (m:Memory) ON (m.agent_id)',
        'CREATE INDEX memory_session_id IF NOT EXISTS FOR (m:Memory) ON (m.session_id)',
        'CREATE INDEX memory_type IF NOT EXISTS FOR (m:Memory) ON (m.type)',
        'CREATE INDEX memory_created_at IF NOT EXISTS FOR (m:Memory) ON (m.created_at)',
        
        // Concept node constraints
        'CREATE CONSTRAINT concept_id_unique IF NOT EXISTS FOR (c:Concept) REQUIRE c.concept_id IS UNIQUE',
        'CREATE INDEX concept_category IF NOT EXISTS FOR (c:Concept) ON (c.category)',
        
        // Tag constraints
        'CREATE INDEX tag_name IF NOT EXISTS FOR (t:Tag) ON (t.name)',
      ];

      for (const query of queries) {
        try {
          await session.run(query);
        } catch (error) {
          // Constraint/index might already exist, which is fine
          if (!getErrorMessage(error).includes('already exists')) {
            this.logger.warn(`Schema query failed: ${getErrorMessage(error)}`);
          }
        }
      }
      
      this.logger.log('Neo4j graph schema initialized');
    } catch (error) {
      this.logger.error(`Failed to initialize Neo4j schema: ${getErrorMessage(error)}`);
    } finally {
      await session.close();
    }
  }

  /**
   * Create memory node in graph
   */
  async createMemoryNode(memoryMetadata: MemoryMetadata, content: string): Promise<string | null> {
    if (!this.driver) {
      this.logger.warn('Neo4j driver not available');
      return null;
    }

    const session = this.driver.session();
    
    try {
      const query = `
        CREATE (m:Memory {
          memory_id: $memory_id,
          content: $content,
          type: $type,
          content_type: $content_type,
          agent_id: $agent_id,
          session_id: $session_id,
          created_at: datetime($created_at),
          updated_at: datetime($updated_at),
          confidence: $confidence,
          access_count: $access_count
        })
        
        WITH m
        UNWIND $tags as tag_name
        MERGE (t:Tag {name: tag_name})
        CREATE (m)-[:HAS_TAG]->(t)
        
        RETURN m.memory_id as memory_id
      `;

      const result = await session.run(query, {
        memory_id: memoryMetadata.memory_id,
        content: content,
        type: memoryMetadata.type,
        content_type: memoryMetadata.content_type,
        agent_id: memoryMetadata.agent_id || 'unknown',
        session_id: memoryMetadata.session_id || 'default',
        created_at: memoryMetadata.created_at.toISOString(),
        updated_at: memoryMetadata.updated_at.toISOString(),
        confidence: memoryMetadata.confidence || 0.8,
        access_count: memoryMetadata.access_count || 0,
        tags: memoryMetadata.tags || [],
      });

      const nodeId = result.records[0]?.get('memory_id');
      this.logger.debug(`Created memory node in Neo4j: ${nodeId}`);
      
      return nodeId;
    } catch (error) {
      this.logger.error(`Failed to create memory node: ${getErrorMessage(error)}`);
      return null;
    } finally {
      await session.close();
    }
  }

  /**
   * Add connection between memories
   */
  async addConnection(
    fromMemoryId: string,
    toMemoryId: string,
    relationshipType: string,
    properties: Record<string, any> = {}
  ): Promise<boolean> {
    if (!this.driver) {
      this.logger.warn('Neo4j driver not available');
      return false;
    }

    const session = this.driver.session();
    
    try {
      const query = `
        MATCH (from:Memory {memory_id: $from_memory_id})
        MATCH (to:Memory {memory_id: $to_memory_id})
        
        CREATE (from)-[r:CONNECTS {
          type: $relationship_type,
          properties: $properties,
          created_at: datetime(),
          confidence: $confidence
        }]->(to)
        
        RETURN r
      `;

      const result = await session.run(query, {
        from_memory_id: fromMemoryId,
        to_memory_id: toMemoryId,
        relationship_type: relationshipType,
        properties: JSON.stringify(properties),
        confidence: properties.confidence || 0.8,
      });

      if (result.records.length > 0) {
        this.logger.debug(`Added connection: ${fromMemoryId} -[${relationshipType}]-> ${toMemoryId}`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Failed to add connection: ${getErrorMessage(error)}`);
      return false;
    } finally {
      await session.close();
    }
  }

  /**
   * Get related memories through graph connections
   */
  async getRelatedMemories(memoryId: string, depth: number = 1): Promise<ConceptNode[]> {
    if (!this.driver) {
      return [];
    }

    const session = this.driver.session();
    
    try {
      // Ensure depth is an integer for Neo4j
      const safeDepth = Math.floor(Number(depth));
      const query = `
        MATCH path = (start:Memory {memory_id: $memory_id})-[r:CONNECTS*1..${safeDepth}]-(related:Memory)
        
        WITH related, r, length(path) as distance
        ORDER BY distance, r[0].confidence DESC
        
        RETURN DISTINCT 
          related.memory_id as memory_id,
          related.content as content,
          related.type as memory_type,
          related.agent_id as agent_id,
          distance,
          collect(DISTINCT r[0].type) as relationship_types
        LIMIT 20
      `;

      const result = await session.run(query, { memory_id: memoryId });
      
      const relatedMemories: ConceptNode[] = result.records.map(record => ({
        concept_id: record.get('memory_id'),
        name: record.get('content').substring(0, 100) + '...',
        category: record.get('memory_type'),
        confidence: Math.max(0.1, 1.0 - (record.get('distance') * 0.2)), // Decrease confidence with distance
        related_memories: [memoryId],
      }));

      return relatedMemories;
    } catch (error) {
      this.logger.error(`Failed to get related memories: ${getErrorMessage(error)}`);
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * Find conceptual clusters and patterns
   */
  async findConceptClusters(agentId?: string): Promise<ConceptNode[]> {
    if (!this.driver) {
      return [];
    }

    const session = this.driver.session();
    
    try {
      const query = `
        MATCH (m:Memory)
        ${agentId ? 'WHERE m.agent_id = $agent_id' : ''}
        
        WITH m
        MATCH (m)-[:HAS_TAG]->(t:Tag)
        
        WITH t, count(m) as memory_count, collect(m.memory_id) as related_memories
        WHERE memory_count >= 2
        ORDER BY memory_count DESC
        
        RETURN 
          t.name as concept_name,
          memory_count,
          related_memories[..10] as sample_memories
        LIMIT 10
      `;

      const result = await session.run(query, { agent_id: agentId });
      
      const concepts: ConceptNode[] = result.records.map(record => ({
        concept_id: `concept_${record.get('concept_name')}`,
        name: record.get('concept_name'),
        category: 'tag_cluster',
        confidence: Math.min(1.0, Number(record.get('memory_count')) * 0.1),
        related_memories: record.get('sample_memories'),
      }));

      return concepts;
    } catch (error) {
      this.logger.error(`Failed to find concept clusters: ${getErrorMessage(error)}`);
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * Update memory access tracking
   */
  async updateMemoryAccess(memoryId: string): Promise<void> {
    if (!this.driver) {
      return;
    }

    const session = this.driver.session();
    
    try {
      const query = `
        MATCH (m:Memory {memory_id: $memory_id})
        SET 
          m.access_count = m.access_count + 1,
          m.last_accessed = datetime()
        RETURN m.access_count as new_count
      `;

      await session.run(query, { memory_id: memoryId });
    } catch (error) {
      this.logger.error(`Failed to update memory access: ${getErrorMessage(error)}`);
    } finally {
      await session.close();
    }
  }

  /**
   * Delete memory node and all its relationships
   */
  async deleteMemory(memoryId: string): Promise<boolean> {
    if (!this.driver) {
      this.logger.warn('Neo4j driver not available');
      return false;
    }

    const session = this.driver.session();
    
    try {
      const query = `
        MATCH (m:Memory {memory_id: $memory_id})
        DETACH DELETE m
        RETURN count(m) as deleted_count
      `;

      const result = await session.run(query, { memory_id: memoryId });
      
      const deletedCount = result.records[0]?.get('deleted_count');
      this.logger.debug(`Deleted memory node: ${memoryId} (${deletedCount} nodes)`);
      
      return deletedCount > 0;
    } catch (error) {
      this.logger.error(`Failed to delete memory: ${getErrorMessage(error)}`);
      return false;
    } finally {
      await session.close();
    }
  }

  /**
   * Get connections between memories
   */
  async getConnections(memoryId?: string, relationshipType?: string, limit: number = 50): Promise<any[]> {
    if (!this.driver) {
      return [];
    }

    const session = this.driver.session();
    
    try {
      let query = `
        MATCH (a:Memory)-[r]->(b:Memory)
        WHERE 1=1
      `;
      // Ensure limit is an integer for Neo4j
      const params: any = { limit: parseInt(String(limit), 10) || 50 };

      if (memoryId) {
        query += ` AND (a.memory_id = $memory_id OR b.memory_id = $memory_id)`;
        params.memory_id = memoryId;
      }

      if (relationshipType) {
        query += ` AND r.type = $relationship_type`;
        params.relationship_type = relationshipType;
      }

      query += `
        RETURN 
          a.memory_id as from_memory_id,
          b.memory_id as to_memory_id,
          r.type as relationship_type,
          r.confidence as confidence,
          r.properties as properties,
          a.content as from_content,
          b.content as to_content,
          a.type as from_type,
          b.type as to_type,
          a.agent_id as from_agent_id,
          b.agent_id as to_agent_id,
          a.created_at as from_created_at,
          b.created_at as to_created_at
        ORDER BY r.created_at DESC
        LIMIT toInteger($limit)
      `;

      const result = await session.run(query, params);
      
      return result.records.map(record => ({
        from_id: record.get('from_memory_id'),
        to_id: record.get('to_memory_id'),
        from_memory_id: record.get('from_memory_id'),
        to_memory_id: record.get('to_memory_id'),
        relationship_type: record.get('relationship_type'),
        confidence: record.get('confidence'),
        properties: record.get('properties'),
        // Enhanced data for graph visualization
        from_label: record.get('from_content')?.slice(0, 50) + '...' || record.get('from_memory_id').slice(0, 8),
        to_label: record.get('to_content')?.slice(0, 50) + '...' || record.get('to_memory_id').slice(0, 8),
        from_type: record.get('from_type') || 'memory',
        to_type: record.get('to_type') || 'memory',
        from_properties: {
          agent_id: record.get('from_agent_id'),
          created_at: record.get('from_created_at')
        },
        to_properties: {
          agent_id: record.get('to_agent_id'),
          created_at: record.get('to_created_at')
        }
      }));
    } catch (error) {
      this.logger.error(`Failed to get connections: ${getErrorMessage(error)}`);
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * Get all connections for a specific entity
   */
  async getEntityConnections(entityId: string, entityType: 'memory' | 'agent' | 'session', limit: number = 50): Promise<any[]> {
    if (!this.driver) {
      return [];
    }

    const session = this.driver.session();
    
    try {
      let query = '';
      // Ensure limit is an integer for Neo4j
      const params: any = { entity_id: entityId, limit: Math.floor(Number(limit)) };

      switch (entityType) {
        case 'memory':
          query = `
            MATCH (m:Memory {memory_id: $entity_id})-[r]-(connected)
            RETURN 
              m.memory_id as entity_id,
              connected.memory_id as connected_id,
              type(r) as relationship_type,
              r.confidence as confidence,
              properties(r) as properties,
              labels(connected)[0] as connected_type
            LIMIT toInteger($limit)
          `;
          break;
        case 'agent':
          query = `
            MATCH (a:Agent {agent_id: $entity_id})-[r]-(connected)
            RETURN 
              a.agent_id as entity_id,
              connected.memory_id as connected_id,
              type(r) as relationship_type,
              r.confidence as confidence,
              properties(r) as properties,
              labels(connected)[0] as connected_type
            LIMIT toInteger($limit)
          `;
          break;
        case 'session':
          query = `
            MATCH (s:Session {session_id: $entity_id})-[r]-(connected)
            RETURN 
              s.session_id as entity_id,
              connected.memory_id as connected_id,
              type(r) as relationship_type,
              r.confidence as confidence,
              properties(r) as properties,
              labels(connected)[0] as connected_type
            LIMIT toInteger($limit)
          `;
          break;
      }

      const result = await session.run(query, params);
      
      return result.records.map(record => ({
        entity_id: record.get('entity_id'),
        connected_id: record.get('connected_id'),
        relationship_type: record.get('relationship_type'),
        confidence: record.get('confidence'),
        properties: record.get('properties'),
        connected_type: record.get('connected_type')
      }));
    } catch (error) {
      this.logger.error(`Failed to get entity connections: ${getErrorMessage(error)}`);
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * Clean up connections
   */
  async onModuleDestroy() {
    try {
      if (this.driver) {
        await this.driver.close();
        this.logger.log('Neo4j connection closed');
      }
    } catch (error) {
      this.logger.error(`Error closing Neo4j connection: ${getErrorMessage(error)}`);
    }
  }
}