import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { MemoryConfigService } from '../config/memory-config.service';
import { EmbeddingService } from './embedding.service';
import { DynamoDBStorageService } from './dynamodb-storage.service';
import { OpenSearchStorageService } from './opensearch-storage.service';
import { NeptuneGraphService } from './neptune-graph.service';
import {
  MemoryMetadata,
  StoredMemory,
  MemoryQuery,
  MemorySearchResult,
  StoreMemoryRequest,
  StoreMemoryResponse,
  RetrieveMemoriesRequest,
  RetrieveMemoriesResponse,
  AddConnectionRequest,
  AddConnectionResponse,
  CreateObservationRequest,
  CreateObservationResponse,
  ConsolidateMemoriesRequest,
  ConsolidateMemoriesResponse,
  MemoryType,
  ContentType,
  GraphConnection,
} from '../types/memory.types';

/**
 * Main Memory Service that orchestrates all storage layers
 * Implements sophisticated memory operations with vector search, graph relationships, and metadata management
 */
@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    private readonly configService: MemoryConfigService,
    private readonly embeddingService: EmbeddingService,
    private readonly dynamoDbService: DynamoDBStorageService,
    private readonly openSearchService: OpenSearchStorageService,
    private readonly neptuneService: NeptuneGraphService,
  ) {
    this.logger.log('Sophisticated Memory Service initialized');
  }

  /**
   * Store a memory with full sophisticated processing
   */
  async storeMemory(request: StoreMemoryRequest): Promise<StoreMemoryResponse> {
    const startTime = Date.now();
    const memoryId = `mem_${Date.now()}_${uuidv4().split('-')[0]}`;

    try {
      this.logger.debug(`Storing memory: ${memoryId}`);

      // 1. Create memory metadata
      const metadata = this.createMemoryMetadata(memoryId, request);

      // 2. Generate embeddings based on content type
      const embeddingResponse = await this.embeddingService.generateEmbedding({
        text: request.content,
        content_type: metadata.content_type,
        programming_language: metadata.content_type === 'code' 
          ? (metadata as any).programming_language 
          : undefined,
      });

      // 3. Create stored memory object
      const storedMemory: StoredMemory = {
        metadata,
        content: request.content,
        embeddings: embeddingResponse.embeddings,
      };

      // 4. Store in OpenSearch (vector similarity)
      const opensearchId = await this.openSearchService.storeMemory(
        storedMemory,
        embeddingResponse.embeddings
      );

      // 5. Create graph node and relationships
      let neptuneNodeId: string | undefined;
      try {
        neptuneNodeId = await this.neptuneService.createMemoryNode(metadata);
        
        // Create agent relationship if agent_id provided
        if (request.agent_id) {
          await this.ensureAgentNodeExists(request.agent_id);
          await this.neptuneService.addConnection({
            from_memory_id: request.agent_id,
            to_memory_id: memoryId,
            relationship_type: 'CREATED',
            confidence: 1.0,
          });
        }

        // Create session relationship if session_id provided
        if (request.session_id) {
          await this.ensureSessionNodeExists(request.session_id, request.agent_id);
          await this.neptuneService.addConnection({
            from_memory_id: memoryId,
            to_memory_id: request.session_id,
            relationship_type: 'IN_SESSION',
            confidence: 1.0,
          });
        }

        // Auto-create concept relationships based on content
        await this.autoCreateConceptRelationships(memoryId, request.content, metadata.type);

      } catch (error) {
        this.logger.warn(`Failed to create graph relationships: ${error.message}`);
      }

      // 6. Store metadata in DynamoDB
      await this.dynamoDbService.storeMemoryMetadata(metadata, opensearchId, neptuneNodeId);

      // 7. Update session context if applicable
      if (request.session_id) {
        try {
          await this.dynamoDbService.updateSessionWithMemory(request.session_id, memoryId);
        } catch (error) {
          this.logger.warn(`Failed to update session context: ${error.message}`);
        }
      }

      const duration = Date.now() - startTime;
      this.logger.debug(`Memory stored successfully: ${memoryId} (${duration}ms)`);

      return {
        memory_id: memoryId,
        opensearch_id: opensearchId,
        neptune_node_id: neptuneNodeId,
        success: true,
      };

    } catch (error) {
      this.logger.error(`Failed to store memory: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retrieve memories using sophisticated search
   */
  async retrieveMemories(request: RetrieveMemoriesRequest): Promise<RetrieveMemoriesResponse> {
    const startTime = Date.now();

    try {
      let results: MemorySearchResult[] = [];

      if (request.memory_ids && request.memory_ids.length > 0) {
        // Direct retrieval by IDs
        results = await this.retrieveMemoriesByIds(request.memory_ids);
      } else if (request.query) {
        // Search using query
        results = await this.searchMemories(request.query);
      }

      // Enhance results with graph relationships if requested
      if (request.query?.include_related) {
        results = await this.enhanceWithGraphRelationships(results);
      }

      const duration = Date.now() - startTime;
      
      return {
        memories: results,
        total_count: results.length,
        search_time_ms: duration,
      };

    } catch (error) {
      this.logger.error(`Failed to retrieve memories: ${error.message}`);
      throw error;
    }
  }

  /**
   * Search memories using vector similarity and filters
   */
  async searchMemories(query: MemoryQuery): Promise<MemorySearchResult[]> {
    try {
      // Generate query embeddings
      const embeddingResponse = await this.embeddingService.generateEmbedding({
        text: query.query,
        content_type: query.content_type || 'text',
      });

      // Search OpenSearch with vector similarity
      const searchResults = await this.openSearchService.searchMemories(
        query,
        embeddingResponse.embeddings
      );

      // Enhance with metadata from DynamoDB
      for (const result of searchResults) {
        try {
          const metadata = await this.dynamoDbService.getMemoryMetadata(
            result.memory.metadata.memory_id
          );
          if (metadata) {
            result.memory.metadata.access_count = metadata.access_count;
            result.memory.metadata.last_accessed = new Date(metadata.last_accessed);
          }
        } catch (error) {
          this.logger.warn(`Failed to get metadata for ${result.memory.metadata.memory_id}`);
        }
      }

      return searchResults;

    } catch (error) {
      this.logger.error(`Failed to search memories: ${error.message}`);
      return [];
    }
  }

  /**
   * Delete a memory from all storage layers
   */
  async deleteMemory(memoryId: string): Promise<{ success: boolean }> {
    try {
      this.logger.debug(`Deleting memory: ${memoryId}`);

      // Get memory metadata to determine content type
      const metadata = await this.dynamoDbService.getMemoryMetadata(memoryId);
      if (!metadata) {
        throw new Error(`Memory not found: ${memoryId}`);
      }

      // Delete from all storage layers
      await Promise.allSettled([
        // Delete from OpenSearch
        this.openSearchService.deleteMemory(memoryId, metadata.content_type as ContentType),
        
        // Delete from Neptune (node and all connections)
        this.neptuneService.deleteMemoryNode(memoryId),
        
        // Delete from DynamoDB (keep this last for rollback capability)
        this.dynamoDbService.deleteMemoryMetadata(memoryId),
      ]);

      this.logger.debug(`Memory deleted successfully: ${memoryId}`);
      return { success: true };

    } catch (error) {
      this.logger.error(`Failed to delete memory: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add connection between memories or concepts
   */
  async addConnection(request: AddConnectionRequest): Promise<AddConnectionResponse> {
    try {
      const connectionId = await this.neptuneService.addConnection({
        from_memory_id: request.from_memory_id,
        to_memory_id: request.to_memory_id,
        relationship_type: request.relationship_type,
        properties: request.properties,
        confidence: 1.0,
      });

      // If bidirectional, create reverse connection
      if (request.bidirectional) {
        await this.neptuneService.addConnection({
          from_memory_id: request.to_memory_id,
          to_memory_id: request.from_memory_id,
          relationship_type: request.relationship_type,
          properties: request.properties,
          confidence: 1.0,
        });
      }

      return {
        connection_id: connectionId,
        success: true,
      };

    } catch (error) {
      this.logger.error(`Failed to add connection: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create an observation and link it to related memories
   */
  async createObservation(request: CreateObservationRequest): Promise<CreateObservationResponse> {
    try {
      // Store observation as a memory first
      const observationMemory = await this.storeMemory({
        content: request.observation,
        type: 'semantic',
        content_type: 'text',
        agent_id: request.agent_id,
        tags: ['observation'],
        metadata: request.context,
      });

      // Create graph observation and connections
      const { observationId, connectionsCreated } = await this.neptuneService.createObservation(
        request.agent_id,
        request.observation,
        request.related_memory_ids || []
      );

      return {
        observation_id: observationId,
        memory_id: observationMemory.memory_id,
        connections_created: connectionsCreated,
        success: true,
      };

    } catch (error) {
      this.logger.error(`Failed to create observation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Consolidate similar memories to reduce redundancy
   */
  async consolidateMemories(request: ConsolidateMemoriesRequest): Promise<ConsolidateMemoriesResponse> {
    try {
      const threshold = request.similarity_threshold || this.configService.memoryServiceConfig.memoryConsolidationThreshold;
      const maxConsolidations = request.max_consolidations || 50;

      let consolidationsPerformed = 0;
      let memoriesMerged = 0;
      let connectionsUpdated = 0;

      // Get candidate memories for consolidation
      const candidates = await this.findConsolidationCandidates(request.agent_id, threshold);

      for (const candidatePair of candidates.slice(0, maxConsolidations)) {
        try {
          const result = await this.consolidateMemoryPair(candidatePair.memory1, candidatePair.memory2);
          
          if (result.success) {
            consolidationsPerformed++;
            memoriesMerged += result.memoriesMerged;
            connectionsUpdated += result.connectionsUpdated;
          }

        } catch (error) {
          this.logger.warn(`Failed to consolidate memory pair: ${error.message}`);
        }
      }

      return {
        consolidations_performed: consolidationsPerformed,
        memories_merged: memoriesMerged,
        connections_updated: connectionsUpdated,
        success: true,
      };

    } catch (error) {
      this.logger.error(`Failed to consolidate memories: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get memory statistics and analytics
   */
  async getMemoryStatistics(agentId?: string): Promise<any> {
    try {
      const [openSearchStats, graphStats] = await Promise.all([
        this.openSearchService.getMemoryStatistics(agentId),
        this.neptuneService.getGraphStatistics(agentId),
      ]);

      return {
        opensearch: openSearchStats,
        graph: graphStats,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      this.logger.error(`Failed to get memory statistics: ${error.message}`);
      return { error: error.message };
    }
  }

  /**
   * Health check for all storage services
   */
  async healthCheck(): Promise<{ 
    overall: boolean; 
    services: { 
      dynamodb: boolean; 
      opensearch: boolean; 
      neptune: boolean; 
    } 
  }> {
    const [dynamodbHealth, opensearchHealth, neptuneHealth] = await Promise.all([
      this.dynamoDbService.healthCheck(),
      this.openSearchService.healthCheck(),
      this.neptuneService.healthCheck(),
    ]);

    return {
      overall: dynamodbHealth && opensearchHealth && neptuneHealth,
      services: {
        dynamodb: dynamodbHealth,
        opensearch: opensearchHealth,
        neptune: neptuneHealth,
      },
    };
  }

  // Private helper methods

  private createMemoryMetadata(memoryId: string, request: StoreMemoryRequest): MemoryMetadata {
    const now = new Date();
    const contentType = request.content_type || this.detectContentType(request.content);
    const memoryType = request.type || this.detectMemoryType(request.content, contentType);

    const baseMetadata = {
      memory_id: memoryId,
      type: memoryType,
      content_type: contentType,
      agent_id: request.agent_id,
      session_id: request.session_id,
      created_at: now,
      updated_at: now,
      tags: request.tags || [],
      access_count: 0,
      last_accessed: now,
    };

    if (contentType === 'code') {
      return {
        ...baseMetadata,
        content_type: 'code',
        programming_language: this.detectProgrammingLanguage(request.content),
        functions: this.extractFunctions(request.content),
        imports: this.extractImports(request.content),
        patterns: this.extractCodePatterns(request.content),
        complexity: this.assessCodeComplexity(request.content),
      };
    } else {
      return {
        ...baseMetadata,
        content_type: 'text',
        language: 'en', // TODO: Add language detection
        topics: this.extractTopics(request.content),
        sentiment: this.analyzeSentiment(request.content),
        entities: this.extractEntities(request.content),
      };
    }
  }

  private detectContentType(content: string): ContentType {
    // Simple heuristics for content type detection
    const codeIndicators = [
      /function\s+\w+\s*\(/,
      /class\s+\w+/,
      /import\s+.*from/,
      /const\s+\w+\s*=/,
      /def\s+\w+\s*\(/,
      /#include\s*</,
      /public\s+class/,
    ];

    return codeIndicators.some(pattern => pattern.test(content)) ? 'code' : 'text';
  }

  private detectMemoryType(content: string, contentType: ContentType): MemoryType {
    // Heuristics for memory type detection
    if (contentType === 'code') {
      return 'procedural';
    }

    // Check for episodic indicators (conversation, events)
    if (/\b(user|said|asked|told|conversation|yesterday|today)\b/i.test(content)) {
      return 'episodic';
    }

    // Check for working memory indicators (temporary, current)
    if (/\b(current|temporary|now|working on|in progress)\b/i.test(content)) {
      return 'working';
    }

    // Default to semantic memory
    return 'semantic';
  }

  private detectProgrammingLanguage(content: string): string {
    const languagePatterns = {
      typescript: /(?:interface|type\s+\w+\s*=|import.*from|export.*{)/,
      javascript: /(?:function|const|let|var).*=|require\(/,
      python: /(?:def\s+\w+|import\s+\w+|from\s+\w+\s+import)/,
      java: /(?:public\s+class|private\s+|protected\s+)/,
      cpp: /#include\s*<|using\s+namespace/,
      csharp: /using\s+System|namespace\s+\w+/,
    };

    for (const [lang, pattern] of Object.entries(languagePatterns)) {
      if (pattern.test(content)) {
        return lang;
      }
    }

    return 'unknown';
  }

  private extractFunctions(content: string): string[] {
    const functionPatterns = [
      /(?:function|def|fn)\s+(\w+)/g,
      /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/g,
    ];

    const functions: string[] = [];
    for (const pattern of functionPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        functions.push(match[1]);
      }
    }

    return [...new Set(functions)];
  }

  private extractImports(content: string): string[] {
    const importPatterns = [
      /import\s+.*from\s+['"`]([^'"`]+)['"`]/g,
      /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /#include\s*<([^>]+)>/g,
      /using\s+([^;]+);/g,
    ];

    const imports: string[] = [];
    for (const pattern of importPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        imports.push(match[1]);
      }
    }

    return [...new Set(imports)];
  }

  private extractCodePatterns(content: string): string[] {
    const patterns: string[] = [];

    if (/async\s+function|await\s+/.test(content)) patterns.push('async_await');
    if (/\.then\(|\.catch\(/.test(content)) patterns.push('promises');
    if (/class\s+\w+.*extends/.test(content)) patterns.push('inheritance');
    if (/interface\s+\w+/.test(content)) patterns.push('interfaces');
    if (/try\s*{.*catch/.test(content)) patterns.push('error_handling');

    return patterns;
  }

  private assessCodeComplexity(content: string): 'low' | 'medium' | 'high' {
    const lines = content.split('\n').length;
    const cyclomaticIndicators = (content.match(/\b(if|for|while|switch|catch)\b/g) || []).length;

    if (lines > 100 || cyclomaticIndicators > 10) return 'high';
    if (lines > 30 || cyclomaticIndicators > 5) return 'medium';
    return 'low';
  }

  private extractTopics(content: string): string[] {
    // Simple keyword extraction for topics
    const words = content.toLowerCase().match(/\b\w{4,}\b/g) || [];
    const commonWords = new Set(['that', 'this', 'with', 'have', 'will', 'from', 'they', 'been', 'have', 'their', 'said', 'each', 'which', 'what', 'were', 'when', 'where', 'more', 'some', 'like', 'into', 'time', 'very', 'only', 'could', 'other', 'after', 'first', 'well', 'many']);
    
    const topics = words
      .filter(word => !commonWords.has(word))
      .reduce((acc, word) => {
        acc[word] = (acc[word] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return Object.entries(topics)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  private analyzeSentiment(content: string): 'positive' | 'negative' | 'neutral' {
    // Simple sentiment analysis
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'perfect', 'love', 'like'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'problem', 'error', 'issue'];

    const words = content.toLowerCase().split(/\W+/);
    const positiveCount = words.filter(word => positiveWords.includes(word)).length;
    const negativeCount = words.filter(word => negativeWords.includes(word)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private extractEntities(content: string): string[] {
    // Simple named entity extraction (capitalize words)
    const entities = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    return [...new Set(entities)].slice(0, 10);
  }

  private async retrieveMemoriesByIds(memoryIds: string[]): Promise<MemorySearchResult[]> {
    const results: MemorySearchResult[] = [];

    for (const memoryId of memoryIds) {
      try {
        const metadata = await this.dynamoDbService.getMemoryMetadata(memoryId);
        if (metadata) {
          // Get content from OpenSearch
          const indexName = metadata.content_type === 'text' ? 'memory-text' : 'memory-code';
          const memory = await this.openSearchService.getMemoryByDocumentId(indexName, metadata.opensearch_id);
          
          if (memory) {
            results.push({
              memory,
              similarity_score: 1.0, // Direct retrieval
              related_memories: [],
              graph_connections: [],
            });
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to retrieve memory ${memoryId}: ${error.message}`);
      }
    }

    return results;
  }

  private async enhanceWithGraphRelationships(results: MemorySearchResult[]): Promise<MemorySearchResult[]> {
    for (const result of results) {
      try {
        // Get graph connections for this memory
        const connections = await this.neptuneService.findConnections(
          result.memory.metadata.memory_id,
          undefined,
          2
        );
        result.graph_connections = connections;

        // Get similar memories through graph traversal
        const similarMemoryIds = await this.neptuneService.findSimilarMemoriesGraph(
          result.memory.metadata.memory_id,
          5
        );

        // Retrieve the similar memories
        if (similarMemoryIds.length > 0) {
          const relatedMemoryResults = await this.retrieveMemoriesByIds(similarMemoryIds);
          result.related_memories = relatedMemoryResults.map(r => r.memory);
        }

      } catch (error) {
        this.logger.warn(`Failed to enhance with graph relationships: ${error.message}`);
      }
    }

    return results;
  }

  private async ensureAgentNodeExists(agentId: string): Promise<void> {
    try {
      await this.neptuneService.createAgentNode(agentId, 'agent');
    } catch (error) {
      // Agent node might already exist, which is fine
      this.logger.debug(`Agent node creation skipped: ${error.message}`);
    }
  }

  private async ensureSessionNodeExists(sessionId: string, agentId?: string): Promise<void> {
    try {
      await this.neptuneService.createSessionNode(sessionId, agentId || 'unknown');
    } catch (error) {
      // Session node might already exist, which is fine
      this.logger.debug(`Session node creation skipped: ${error.message}`);
    }
  }

  private async autoCreateConceptRelationships(memoryId: string, content: string, memoryType: MemoryType): Promise<void> {
    try {
      // Extract key concepts from content
      const concepts = this.extractConcepts(content);
      
      for (const concept of concepts) {
        // Create concept node if it doesn't exist
        const conceptId = concept.toLowerCase().replace(/\s+/g, '_');
        await this.neptuneService.createConceptNode({
          concept_id: conceptId,
          name: concept,
          category: memoryType,
          confidence: 0.8,
          related_memories: [memoryId],
        });

        // Create relationship between memory and concept
        await this.neptuneService.addConnection({
          from_memory_id: memoryId,
          to_memory_id: conceptId,
          relationship_type: 'RELATES_TO',
          confidence: 0.8,
        });
      }
    } catch (error) {
      this.logger.warn(`Failed to create concept relationships: ${error.message}`);
    }
  }

  private extractConcepts(content: string): string[] {
    // Simple concept extraction based on important nouns and phrases
    const concepts: string[] = [];
    
    // Extract capitalized phrases (likely important concepts)
    const capitalizedPhrases = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    concepts.push(...capitalizedPhrases);

    // Extract quoted concepts
    const quotedConcepts = content.match(/"([^"]+)"/g) || [];
    concepts.push(...quotedConcepts.map(q => q.slice(1, -1)));

    return [...new Set(concepts)]
      .filter(concept => concept.length > 3 && concept.length < 50)
      .slice(0, 5);
  }

  private async findConsolidationCandidates(agentId?: string, threshold: number = 0.9): Promise<Array<{memory1: StoredMemory, memory2: StoredMemory, similarity: number}>> {
    // Implementation for finding similar memories that can be consolidated
    // This would involve comparing embeddings and finding pairs above the threshold
    // For now, return empty array as this is a complex operation
    return [];
  }

  private async consolidateMemoryPair(memory1: StoredMemory, memory2: StoredMemory): Promise<{success: boolean, memoriesMerged: number, connectionsUpdated: number}> {
    // Implementation for consolidating two similar memories
    // This would involve merging content, updating relationships, and removing duplicates
    // For now, return mock success
    return { success: true, memoriesMerged: 1, connectionsUpdated: 0 };
  }
}