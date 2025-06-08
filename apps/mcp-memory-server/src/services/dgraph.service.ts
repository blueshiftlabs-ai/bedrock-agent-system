import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as dgraph from 'dgraph-js';
import * as grpc from '@grpc/grpc-js';
import { MemoryConfigService } from '../config/memory-config.service';
import { 
  GraphConnection, 
  ConceptNode, 
  MemoryMetadata,
  StoredMemory 
} from '../types/memory.types';

/**
 * Dgraph service for knowledge graph operations
 * Alternative to Neptune/Gremlin with better performance and simpler setup
 */
@Injectable()
export class DgraphService implements OnModuleDestroy {
  private readonly logger = new Logger(DgraphService.name);
  private dgraphClient: dgraph.DgraphClient;
  private clientStub: dgraph.DgraphClientStub;

  constructor(private readonly configService: MemoryConfigService) {
    this.initializeConnection();
  }

  /**
   * Initialize Dgraph connection
   */
  private async initializeConnection(): Promise<void> {
    try {
      const { endpoint, port } = this.configService.dgraphConfig;
      
      // Create gRPC client stub
      this.clientStub = new dgraph.DgraphClientStub(
        `${endpoint}:${port}`,
        grpc.credentials.createInsecure()
      );

      // Create Dgraph client
      this.dgraphClient = new dgraph.DgraphClient(this.clientStub);
      
      this.logger.log('Dgraph Service initialized');
      
      // Initialize graph schema
      await this.initializeGraphSchema();
    } catch (error) {
      this.logger.error(`Failed to initialize Dgraph connection: ${error.message}`);
      // For development, continue without Dgraph
      if (this.configService.isDevelopment) {
        this.logger.warn('Continuing without Dgraph in development mode');
      }
    }
  }

  /**
   * Initialize graph schema for memory operations
   */
  private async initializeGraphSchema(): Promise<void> {
    try {
      const schema = `
        type Memory {
          memory_id: string @id
          content: string @index(fulltext)
          type: string @index(exact)
          agent_id: string @index(exact)
          session_id: string @index(exact)
          tags: [string] @index(exact)
          created_at: datetime @index(hour)
          updated_at: datetime
          ~connected_to: [Memory]
          connected_to: [Memory] @reverse
        }

        type Connection {
          relationship_type: string @index(exact)
          properties: string
          created_at: datetime @index(hour)
          from_memory: Memory @reverse
          to_memory: Memory @reverse
        }
      `;

      const op = new dgraph.Operation();
      op.setSchema(schema);
      
      await this.dgraphClient.alter(op);
      this.logger.log('Dgraph schema initialized');
    } catch (error) {
      this.logger.error(`Failed to initialize Dgraph schema: ${error.message}`);
    }
  }

  /**
   * Create memory node in graph
   */
  async createMemoryNode(memoryMetadata: MemoryMetadata, content: string): Promise<string | null> {
    if (!this.dgraphClient) {
      this.logger.warn('Dgraph client not available');
      return null;
    }

    try {
      const txn = this.dgraphClient.newTxn();
      
      try {
        const memoryNode = {
          'dgraph.type': 'Memory',
          memory_id: memoryMetadata.memory_id,
          content: content,
          type: memoryMetadata.type || 'episodic',
          agent_id: memoryMetadata.agent_id || 'unknown',
          session_id: memoryMetadata.session_id || 'default',
          tags: memoryMetadata.tags || [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const mu = new dgraph.Mutation();
        mu.setSetJson(memoryNode);
        
        const response = await txn.mutate(mu);
        await txn.commit();
        
        const nodeId = response.getUidsMap().get('blank-0') || memoryMetadata.memory_id;
        this.logger.debug(`Created memory node in Dgraph: ${nodeId}`);
        
        return nodeId;
      } finally {
        await txn.discard();
      }
    } catch (error) {
      this.logger.error(`Failed to create memory node: ${error.message}`);
      return null;
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
    if (!this.dgraphClient) {
      this.logger.warn('Dgraph client not available');
      return false;
    }

    try {
      const txn = this.dgraphClient.newTxn();
      
      try {
        // First, check if both memories exist
        const query = `
          query findMemories($fromId: string, $toId: string) {
            fromMemory(func: eq(memory_id, $fromId)) {
              uid
              memory_id
            }
            toMemory(func: eq(memory_id, $toId)) {
              uid
              memory_id
            }
          }
        `;

        const vars = {
          $fromId: fromMemoryId,
          $toId: toMemoryId,
        };

        const res = await txn.queryWithVars(query, vars);
        const data = res.getJson();

        if (!data.fromMemory || data.fromMemory.length === 0) {
          this.logger.error(`From memory not found: ${fromMemoryId}`);
          return false;
        }

        if (!data.toMemory || data.toMemory.length === 0) {
          this.logger.error(`To memory not found: ${toMemoryId}`);
          return false;
        }

        const fromUid = data.fromMemory[0].uid;
        const toUid = data.toMemory[0].uid;

        // Create connection
        const connection = {
          uid: fromUid,
          connected_to: {
            uid: toUid,
          },
        };

        const mu = new dgraph.Mutation();
        mu.setSetJson(connection);
        
        await txn.mutate(mu);
        await txn.commit();

        this.logger.debug(`Added connection: ${fromMemoryId} -[${relationshipType}]-> ${toMemoryId}`);
        return true;
      } finally {
        await txn.discard();
      }
    } catch (error) {
      this.logger.error(`Failed to add connection: ${error.message}`);
      return false;
    }
  }

  /**
   * Get related memories through graph connections
   */
  async getRelatedMemories(memoryId: string, depth: number = 1): Promise<ConceptNode[]> {
    if (!this.dgraphClient) {
      return [];
    }

    try {
      const query = `
        query findRelated($memoryId: string) {
          memory(func: eq(memory_id, $memoryId)) {
            memory_id
            content
            type
            connected_to {
              memory_id
              content
              type
              tags
            }
            ~connected_to {
              memory_id
              content
              type
              tags
            }
          }
        }
      `;

      const vars = { $memoryId: memoryId };
      const txn = this.dgraphClient.newTxn({ readOnly: true });
      const res = await txn.queryWithVars(query, vars);
      const data = res.getJson();

      const relatedMemories: ConceptNode[] = [];

      if (data.memory && data.memory.length > 0) {
        const memory = data.memory[0];
        
        // Add outgoing connections
        if (memory.connected_to) {
          memory.connected_to.forEach((connected: any) => {
            relatedMemories.push({
              concept_id: connected.memory_id,
              name: connected.content.substring(0, 100) + '...',
              category: connected.type,
              confidence: 0.8,
              related_memories: [memoryId],
            });
          });
        }

        // Add incoming connections
        if (memory['~connected_to']) {
          memory['~connected_to'].forEach((connected: any) => {
            relatedMemories.push({
              concept_id: connected.memory_id,
              name: connected.content.substring(0, 100) + '...',
              category: connected.type,
              confidence: 0.8,
              related_memories: [memoryId],
            });
          });
        }
      }

      return relatedMemories;
    } catch (error) {
      this.logger.error(`Failed to get related memories: ${error.message}`);
      return [];
    }
  }

  /**
   * Clean up connections
   */
  async onModuleDestroy() {
    try {
      if (this.clientStub) {
        this.clientStub.close();
        this.logger.log('Dgraph connection closed');
      }
    } catch (error) {
      this.logger.error(`Error closing Dgraph connection: ${error.message}`);
    }
  }
}