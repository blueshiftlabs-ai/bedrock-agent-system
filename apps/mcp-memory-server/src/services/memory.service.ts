import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { MemoryConfigService } from '../config/memory-config.service';
import { EmbeddingService } from './embedding.service';
import { DynamoDBStorageService } from './dynamodb-storage.service';
import { OpenSearchStorageService } from './opensearch-storage.service';
import { Neo4jGraphService } from './neo4j-graph.service';
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
import { getErrorMessage } from '../utils';

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
    private readonly neo4jService: Neo4jGraphService,
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
      const metadata = await this.createMemoryMetadata(memoryId, request);

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

      // 4. Store in OpenSearch (vector similarity) - enabled in all modes for development
      let opensearchId: string | undefined;
      try {
        opensearchId = await this.openSearchService.storeMemory(
          storedMemory,
          embeddingResponse.embeddings
        );
        this.logger.debug('OpenSearch storage successful');
      } catch (error) {
        this.logger.warn(`OpenSearch storage failed: ${getErrorMessage(error)}`);
      }

      // 5. Create graph node and relationships
      let neo4jNodeId: string | undefined;
      try {
        neo4jNodeId = await this.neo4jService.createMemoryNode(metadata, request.content);
        
        // Create agent relationship if agent_id provided
        if (request.agent_id) {
          await this.ensureAgentNodeExists(request.agent_id);
          await this.neo4jService.addConnection(
            request.agent_id,
            memoryId,
            'CREATED',
            { confidence: 1.0 }
          );
        }

        // Create session relationship if session_id provided
        if (request.session_id) {
          await this.ensureSessionNodeExists(request.session_id, request.agent_id);
          await this.neo4jService.addConnection(
            memoryId,
            request.session_id,
            'IN_SESSION',
            { confidence: 1.0 }
          );
        }

        // Auto-create concept relationships based on content
        await this.autoCreateConceptRelationships(memoryId, request.content, metadata.type);

      } catch (error) {
        this.logger.warn(`Failed to create graph relationships: ${getErrorMessage(error)}`);
      }

      // 6. Store metadata in DynamoDB
      await this.dynamoDbService.storeMemoryMetadata(metadata, opensearchId, neo4jNodeId);

      // 7. Update session context if applicable
      if (request.session_id) {
        try {
          await this.dynamoDbService.updateSessionWithMemory(request.session_id, memoryId);
        } catch (error) {
          this.logger.warn(`Failed to update session context: ${getErrorMessage(error)}`);
        }
      }

      const duration = Date.now() - startTime;
      this.logger.debug(`Memory stored successfully: ${memoryId} (${duration}ms)`);

      return {
        memory_id: memoryId,
        opensearch_id: opensearchId,
        neo4j_node_id: neo4jNodeId,
        success: true,
      };

    } catch (error) {
      this.logger.error(`Failed to store memory: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Retrieve memories using sophisticated search with functional patterns
   */
  async retrieveMemories(request: RetrieveMemoriesRequest): Promise<RetrieveMemoriesResponse> {
    const startTime = Date.now();

    const retrievalStrategies = [
      {
        predicate: () => Boolean(request.memory_ids?.length),
        action: () => this.retrieveMemoriesByIds(request.memory_ids!)
      },
      {
        predicate: () => Boolean(request.query?.query),
        action: () => this.searchMemories(request.query!)
      },
      {
        predicate: () => true,
        action: async () => {
          const result = await this.getAllMemories(request.query || {});
          return { memories: result.results, total_available: result.total_available };
        }
      }
    ];

    const executeStrategy = () => {
      const strategy = retrievalStrategies.find(s => s.predicate());
      return strategy?.action() || Promise.resolve({ memories: [], total_available: 0 });
    };

    const enhanceWithRelationships = (data: any) => {
      if (data.memories) {
        return request.query?.include_related 
          ? this.enhanceWithGraphRelationships(data.memories).then(enhanced => ({ ...data, memories: enhanced }))
          : Promise.resolve(data);
      }
      // For backward compatibility with search results
      return request.query?.include_related 
        ? this.enhanceWithGraphRelationships(data).then(enhanced => ({ memories: enhanced, total_available: enhanced.length }))
        : Promise.resolve({ memories: data, total_available: data.length });
    };

    try {
      const data = await executeStrategy().then(enhanceWithRelationships);
      const duration = Date.now() - startTime;
      
      // Calculate has_more for pagination
      const offset = request.query?.offset || 0;
      const limit = request.query?.limit || 10;
      const has_more = (offset + limit) < (data.total_available || data.memories.length);
      
      return {
        memories: data.memories,
        total_count: data.total_available || data.memories.length,
        has_more,
        search_time_ms: duration,
      };

    } catch (error) {
      this.logger.error(`Failed to retrieve memories: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Search memories using vector similarity and filters with functional patterns
   */
  async searchMemories(query: MemoryQuery): Promise<MemorySearchResult[]> {
    const enhanceWithMetadata = async (result: MemorySearchResult): Promise<MemorySearchResult> => {
      try {
        const metadata = await this.dynamoDbService.getMemoryMetadata(
          result.memory.metadata.memory_id
        );
        
        return metadata ? {
          ...result,
          memory: {
            ...result.memory,
            metadata: {
              ...result.memory.metadata,
              access_count: metadata.access_count,
              last_accessed: new Date(metadata.last_accessed)
            }
          }
        } : result;
      } catch (error) {
        this.logger.warn(`Failed to get metadata for ${result.memory.metadata.memory_id}`);
        return result;
      }
    };

    try {
      const embeddingResponse = await this.embeddingService.generateEmbedding({
        text: query.query,
        content_type: query.content_type || 'text',
      });

      const searchResults = await this.openSearchService.searchMemories(
        query,
        embeddingResponse.embeddings
      );

      return Promise.all(searchResults.map(enhanceWithMetadata));

    } catch (error) {
      this.logger.error(`Failed to search memories: ${getErrorMessage(error)}`);
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
        
        // Delete from Neo4j (node and all connections)
        this.neo4jService.deleteMemory(memoryId),
        
        // Delete from DynamoDB (keep this last for rollback capability)
        this.dynamoDbService.deleteMemoryMetadata(memoryId),
      ]);

      this.logger.debug(`Memory deleted successfully: ${memoryId}`);
      return { success: true };

    } catch (error) {
      this.logger.error(`Failed to delete memory: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Update memory metadata (agent_id, project, tags, etc.)
   */
  async updateMemoryMetadata(memoryId: string, updates: Partial<MemoryMetadata>): Promise<void> {
    try {
      this.logger.debug(`Updating memory metadata: ${memoryId}`);

      // Update in DynamoDB
      await this.dynamoDbService.updateMemoryMetadata(memoryId, updates);

      this.logger.debug(`Memory metadata updated successfully: ${memoryId}`);

    } catch (error) {
      this.logger.error(`Failed to update memory metadata: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Add connection between memories or concepts
   */
  async addConnection(request: AddConnectionRequest): Promise<AddConnectionResponse> {
    try {
      const connectionSuccess = await this.neo4jService.addConnection(
        request.from_memory_id,
        request.to_memory_id,
        request.relationship_type,
        { ...request.properties, confidence: 1.0 }
      );

      // If bidirectional, create reverse connection
      if (request.bidirectional) {
        await this.neo4jService.addConnection(
          request.to_memory_id,
          request.from_memory_id,
          request.relationship_type,
          { ...request.properties, confidence: 1.0 }
        );
      }

      return {
        connection_id: connectionSuccess ? 'neo4j_connection' : 'failed',
        success: connectionSuccess,
      };

    } catch (error) {
      this.logger.error(`Failed to add connection: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Get all memories with optional filtering and pagination using functional patterns
   */
  async getAllMemories(request: any): Promise<{ results: MemorySearchResult[], total_available: number }> {
    const safeGetContent = async (metadata: any): Promise<string> => {
      try {
        const content = await this.openSearchService.getMemoryContent(metadata.memory_id, metadata.content_type as any);
        return content || '';
      } catch (error) {
        this.logger.warn(`Failed to get content for ${metadata.memory_id}: ${getErrorMessage(error)}`);
        return `[Content not available - ${getErrorMessage(error)}]`;
      }
    };

    const createMemoryResult = async (metadata: any): Promise<MemorySearchResult | null> => {
      try {
        const content = await safeGetContent(metadata);
        return {
          memory: { metadata, content },
          similarity_score: 1.0,
          related_memories: [],
          graph_connections: []
        };
      } catch (error) {
        this.logger.warn(`Failed to process memory ${metadata.memory_id}: ${getErrorMessage(error)}`);
        return null;
      }
    };

    const filterPredicates = [
      (m: any) => !request.agent_id || m.agent_id === request.agent_id,
      (m: any) => !request.session_id || m.session_id === request.session_id,
      (m: any) => !request.project || m.project === request.project,
      (m: any) => !request.type || m.type === request.type,
      (m: any) => !request.content_type || m.content_type === request.content_type
    ];

    const applyAllFilters = (memories: any[]) => 
      filterPredicates.reduce((filtered, predicate) => filtered.filter(predicate), memories);

    try {
      const allMetadata = await this.dynamoDbService.getAllMemoryMetadata();
      const filteredMetadata = applyAllFilters(allMetadata);
      
      // Apply pagination
      const offset = request.offset || 0;
      const limit = request.limit || 10;
      const paginatedMetadata = filteredMetadata.slice(offset, offset + limit);
      
      const results = await Promise.all(paginatedMetadata.map(createMemoryResult));
      return {
        results: results.filter(Boolean) as MemorySearchResult[],
        total_available: filteredMetadata.length
      };
      
    } catch (error) {
      this.logger.error(`Failed to get all memories: ${getErrorMessage(error)}`);
      return { results: [], total_available: 0 };
    }
  }

  /**
   * Create an observation and link it to related memories using functional patterns
   */
  async createObservation(request: CreateObservationRequest): Promise<CreateObservationResponse> {
    const createConnection = async (relatedMemoryId: string) => {
      try {
        return await this.neo4jService.addConnection(
          request.observation, // Will be updated with actual memory_id
          relatedMemoryId,
          'OBSERVES',
          { confidence: 0.8 }
        );
      } catch (error) {
        this.logger.warn(`Failed to create connection to ${relatedMemoryId}: ${getErrorMessage(error)}`);
        return false;
      }
    };

    try {
      const observationMemory = await this.storeMemory({
        content: request.observation,
        type: 'semantic',
        content_type: 'text',
        agent_id: request.agent_id,
        tags: ['observation'],
        metadata: request.context,
      });

      const relatedMemoryIds = request.related_memory_ids || [];
      const connectionResults = await Promise.all(
        relatedMemoryIds.map(async (memoryId) => 
          this.neo4jService.addConnection(
            observationMemory.memory_id,
            memoryId,
            'OBSERVES',
            { confidence: 0.8 }
          ).catch((error) => {
            this.logger.warn(`Failed to create connection to ${memoryId}: ${getErrorMessage(error)}`);
            return false;
          })
        )
      );

      const connectionsCreated = connectionResults.filter(Boolean).length;

      return {
        observation_id: observationMemory.memory_id,
        memory_id: observationMemory.memory_id,
        connections_created: connectionsCreated,
        success: true,
      };

    } catch (error) {
      this.logger.error(`Failed to create observation: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Consolidate similar memories to reduce redundancy using functional patterns
   */
  async consolidateMemories(request: ConsolidateMemoriesRequest): Promise<ConsolidateMemoriesResponse> {
    const consolidatePair = async (candidatePair: any) => {
      try {
        const result = await this.consolidateMemoryPair(candidatePair.memory1, candidatePair.memory2);
        return result.success ? result : { success: false, memoriesMerged: 0, connectionsUpdated: 0 };
      } catch (error) {
        this.logger.warn(`Failed to consolidate memory pair: ${getErrorMessage(error)}`);
        return { success: false, memoriesMerged: 0, connectionsUpdated: 0 };
      }
    };

    const aggregateResults = (results: any[]) => 
      results.reduce(
        (acc, result) => ({
          consolidationsPerformed: acc.consolidationsPerformed + (result.success ? 1 : 0),
          memoriesMerged: acc.memoriesMerged + result.memoriesMerged,
          connectionsUpdated: acc.connectionsUpdated + result.connectionsUpdated
        }),
        { consolidationsPerformed: 0, memoriesMerged: 0, connectionsUpdated: 0 }
      );

    try {
      const threshold = request.similarity_threshold || this.configService.memoryServiceConfig.memoryConsolidationThreshold;
      const maxConsolidations = request.max_consolidations || 50;

      const candidates = await this.findConsolidationCandidates(request.agent_id, threshold);
      const limitedCandidates = candidates.slice(0, maxConsolidations);
      
      const results = await Promise.all(limitedCandidates.map(consolidatePair));
      const aggregatedResults = aggregateResults(results);

      return {
        consolidations_performed: aggregatedResults.consolidationsPerformed,
        memories_merged: aggregatedResults.memoriesMerged,
        connections_updated: aggregatedResults.connectionsUpdated,
        success: true,
      };

    } catch (error) {
      this.logger.error(`Failed to consolidate memories: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Get memory statistics and analytics using functional patterns
   */
  async getMemoryStatistics(agentId?: string): Promise<any> {
    const calculateLocalStats = async () => {
      const allMemories = await this.dynamoDbService.getAllMemoryMetadata();
      const filteredMemories = agentId 
        ? allMemories.filter(m => m.agent_id === agentId)
        : allMemories;

      const aggregateByField = (field: string) => {
        const counts = filteredMemories
          .map(memory => memory[field] || 'unknown')
          .reduce((acc, value) => ({ ...acc, [value]: (acc[value] || 0) + 1 }), {} as Record<string, number>);
        
        return Object.fromEntries(
          Object.entries(counts).map(([key, count]) => [key, { count }])
        );
      };

      const getRecentActivity = () => 
        filteredMemories
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 10)
          .map(({ memory_id, type, agent_id, created_at }) => ({ memory_id, type, agent_id, created_at }));

      const contentTypeCounts = {
        text: filteredMemories.filter(m => m.content_type === 'text').length,
        code: filteredMemories.filter(m => m.content_type === 'code').length
      };

      return {
        total_memories: filteredMemories.length,
        text_memories: contentTypeCounts.text,
        code_memories: contentTypeCounts.code,
        by_type: aggregateByField('type'),
        by_content_type: aggregateByField('content_type'),
        by_agent: aggregateByField('agent_id'),
        by_project: aggregateByField('project'),
        recent_activity: getRecentActivity()
      };
    };

    const getGraphStats = () => 
      this.neo4jService.findConceptClusters 
        ? this.neo4jService.findConceptClusters(agentId) 
        : Promise.resolve([]);

    try {
      const [localStats, graphStats] = await Promise.all([
        calculateLocalStats(),
        getGraphStats()
      ]);

      return {
        storage: localStats,
        graph: graphStats,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      this.logger.error(`Failed to get memory statistics: ${getErrorMessage(error)}`);
      return { error: getErrorMessage(error) };
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
      neo4j: boolean; 
    } 
  }> {
    const [dynamodbHealth, opensearchHealth, neo4jHealth] = await Promise.all([
      this.dynamoDbService.healthCheck(),
      this.openSearchService.healthCheck(),
      Promise.resolve(true), // Neo4j health check can be added later
    ]);

    return {
      overall: dynamodbHealth && opensearchHealth && neo4jHealth,
      services: {
        dynamodb: dynamodbHealth,
        opensearch: opensearchHealth,
        neo4j: neo4jHealth,
      },
    };
  }

  // Private helper methods

  private async createMemoryMetadata(memoryId: string, request: StoreMemoryRequest): Promise<MemoryMetadata> {
    const now = new Date();
    const contentType = request.content_type || this.detectContentType(request.content);
    const memoryType = request.type || this.detectMemoryType(request.content, contentType);

    // Priority: ENV vars > explicit params > validation error
    const agentId = process.env.MEMORY_AGENT_ID || request.agent_id;
    const project = process.env.MEMORY_PROJECT_NAME || request.project;

    // Validation: agent_id and project are required
    if (!agentId) {
      throw new Error(
        'Agent ID is required. Please provide agent_id parameter or set MEMORY_AGENT_ID environment variable.'
      );
    }

    if (!project) {
      throw new Error(
        'Project name is required. Please provide project parameter or set MEMORY_PROJECT_NAME environment variable. ' +
        'Agent can detect project from git: `git remote get-url origin | basename $(cat -) .git`'
      );
    }

    this.logger.debug(`Using context: agent=${agentId}, project=${project}`);

    const baseMetadata = {
      memory_id: memoryId,
      type: memoryType,
      content_type: contentType,
      agent_id: agentId,
      session_id: request.session_id,
      project: project,
      created_at: now,
      updated_at: now,
      tags: request.tags || [],
      access_count: 0,
      last_accessed: now,
    };

    const contentTypeSpecificMetadata = {
      code: () => ({
        ...baseMetadata,
        content_type: 'code' as const,
        programming_language: this.detectProgrammingLanguage(request.content),
        functions: this.extractFunctions(request.content),
        imports: this.extractImports(request.content),
        patterns: this.extractCodePatterns(request.content),
        complexity: this.assessCodeComplexity(request.content),
      }),
      text: () => ({
        ...baseMetadata,
        content_type: 'text' as const,
        language: 'en',
        topics: this.extractTopics(request.content),
        sentiment: this.analyzeSentiment(request.content),
        entities: this.extractEntities(request.content),
      })
    };

    return contentTypeSpecificMetadata[contentType]();
  }

  private detectContentType(content: string): ContentType {
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
    const memoryTypeDetectors = [
      { type: 'procedural' as const, predicate: () => contentType === 'code' },
      { type: 'episodic' as const, predicate: () => /\b(user|said|asked|told|conversation|yesterday|today)\b/i.test(content) },
      { type: 'working' as const, predicate: () => /\b(current|temporary|now|working on|in progress)\b/i.test(content) },
      { type: 'semantic' as const, predicate: () => true } // Default fallback
    ];

    const detectedType = memoryTypeDetectors.find(detector => detector.predicate());
    return detectedType?.type || 'semantic';
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

    const detectedLanguage = Object.entries(languagePatterns)
      .find(([_, pattern]) => pattern.test(content));

    return detectedLanguage?.[0] || 'unknown';
  }

  private extractFunctions(content: string): string[] {
    const functionPatterns = [
      /(?:function|def|fn)\s+(\w+)/g,
      /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/g,
    ];

    const extractMatches = (pattern: RegExp) => {
      const matches: string[] = [];
      let match;
      while ((match = pattern.exec(content)) !== null) {
        matches.push(match[1]);
      }
      return matches;
    };

    const allMatches = functionPatterns.flatMap(extractMatches);
    return Array.from(new Set(allMatches));
  }

  private extractImports(content: string): string[] {
    const importPatterns = [
      /import\s+.*from\s+['"`]([^'"`]+)['"`]/g,
      /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /#include\s*<([^>]+)>/g,
      /using\s+([^;]+);/g,
    ];

    const extractMatches = (pattern: RegExp) => {
      const matches: string[] = [];
      let match;
      while ((match = pattern.exec(content)) !== null) {
        matches.push(match[1]);
      }
      return matches;
    };

    const allMatches = importPatterns.flatMap(extractMatches);
    return Array.from(new Set(allMatches));
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
    const words = content.toLowerCase().match(/\b\w{4,}\b/g) || [];
    const commonWords = new Set(['that', 'this', 'with', 'have', 'will', 'from', 'they', 'been', 'have', 'their', 'said', 'each', 'which', 'what', 'were', 'when', 'where', 'more', 'some', 'like', 'into', 'time', 'very', 'only', 'could', 'other', 'after', 'first', 'well', 'many']);
    
    const wordCounts = words
      .filter(word => !commonWords.has(word))
      .reduce((acc, word) => ({ ...acc, [word]: (acc[word] || 0) + 1 }), {} as Record<string, number>);

    return Object.entries(wordCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  private analyzeSentiment(content: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'perfect', 'love', 'like'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'problem', 'error', 'issue'];

    const words = content.toLowerCase().split(/\W+/);
    const [positiveCount, negativeCount] = [
      words.filter(word => positiveWords.includes(word)).length,
      words.filter(word => negativeWords.includes(word)).length
    ];

    return positiveCount > negativeCount ? 'positive' 
         : negativeCount > positiveCount ? 'negative' 
         : 'neutral';
  }

  private extractEntities(content: string): string[] {
    // Simple named entity extraction (capitalize words)
    const entities = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    return Array.from(new Set(entities)).slice(0, 10);
  }

  private async retrieveMemoriesByIds(memoryIds: string[]): Promise<MemorySearchResult[]> {
    const retrieveMemory = async (memoryId: string): Promise<MemorySearchResult | null> => {
      try {
        const metadata = await this.dynamoDbService.getMemoryMetadata(memoryId);
        
        if (!metadata) return null;

        const indexName = metadata.content_type === 'text' ? 'memory-text' : 'memory-code';
        const memory = await this.openSearchService.getMemoryByDocumentId(indexName, metadata.opensearch_id);
        
        return memory ? {
          memory,
          similarity_score: 1.0,
          related_memories: [],
          graph_connections: [],
        } : null;
      } catch (error) {
        this.logger.warn(`Failed to retrieve memory ${memoryId}: ${getErrorMessage(error)}`);
        return null;
      }
    };

    const results = await Promise.all(memoryIds.map(retrieveMemory));
    return results.filter(Boolean) as MemorySearchResult[];
  }

  private async enhanceWithGraphRelationships(results: MemorySearchResult[]): Promise<MemorySearchResult[]> {
    const enhanceResult = async (result: MemorySearchResult): Promise<MemorySearchResult> => {
      try {
        const relatedMemories = await this.neo4jService.getRelatedMemories(
          result.memory.metadata.memory_id,
          2
        );

        if (relatedMemories.length === 0) return result;

        const graphConnections = relatedMemories.map(related => ({
          from_memory_id: result.memory.metadata.memory_id,
          to_memory_id: related.concept_id,
          relationship_type: 'CONNECTS',
          confidence: related.confidence,
        } as GraphConnection));

        const relatedMemoryIds = relatedMemories.map(r => r.concept_id);
        const relatedMemoryResults = await this.retrieveMemoriesByIds(relatedMemoryIds);
        const relatedMemoryContents = relatedMemoryResults.map(r => r.memory);

        return {
          ...result,
          graph_connections: graphConnections,
          related_memories: relatedMemoryContents
        };
      } catch (error) {
        this.logger.warn(`Failed to enhance with graph relationships: ${getErrorMessage(error)}`);
        return result;
      }
    };

    return Promise.all(results.map(enhanceResult));
  }

  private async ensureAgentNodeExists(agentId: string): Promise<void> {
    try {
      // Create a simple memory node to represent the agent
      // Neo4j will handle it as part of the memory graph
      this.logger.debug(`Agent node management handled by Neo4j: ${agentId}`);
    } catch (error) {
      this.logger.debug(`Agent node creation skipped: ${getErrorMessage(error)}`);
    }
  }

  private async ensureSessionNodeExists(sessionId: string, agentId?: string): Promise<void> {
    try {
      // Session management is simplified in Neo4j
      // We'll track sessions through memory relationships
      this.logger.debug(`Session node management handled by Neo4j: ${sessionId}`);
    } catch (error) {
      this.logger.debug(`Session node creation skipped: ${getErrorMessage(error)}`);
    }
  }

  private async autoCreateConceptRelationships(memoryId: string, content: string, memoryType: MemoryType): Promise<void> {
    try {
      // Extract key concepts from content
      const concepts = this.extractConcepts(content);
      
      // Enhanced concept relationship creation for Issue #5
      for (const concept of concepts) {
        try {
          // Find related memories with similar concepts
          const relatedMemories = await this.findMemoriesByConcept(concept);
          
          for (const relatedMemory of relatedMemories) {
            if (relatedMemory.metadata.memory_id !== memoryId) {
              // Create semantic relationship based on shared concepts
              await this.neo4jService.addConnection(
                memoryId,
                relatedMemory.metadata.memory_id,
                'SHARES_CONCEPT',
                { 
                  concept: concept,
                  confidence: this.calculateConceptSimilarity(content, relatedMemory.content || ''),
                  created_at: new Date().toISOString()
                }
              );
            }
          }
          
          this.logger.debug(`Created concept relationships for "${concept}"`);
        } catch (error) {
          this.logger.warn(`Failed to create concept relationship for "${concept}": ${getErrorMessage(error)}`);
        }
      }

      // Code-specific relationship detection for code memories
      if (memoryType === 'procedural' && content.includes('function') || content.includes('import')) {
        await this.createCodeSpecificRelationships(memoryId, content);
      }
    } catch (error) {
      this.logger.warn(`Failed to create concept relationships: ${getErrorMessage(error)}`);
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

    return Array.from(new Set(concepts))
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

  /**
   * List all agents that have stored memories using functional patterns
   */
  async listAgents(project?: string): Promise<{ agents: any[], total_count: number }> {
    const createFilterClauses = () => project ? [{ term: { project } }] : [];
    
    const createSearchQuery = (indexName: string) => ({
      index: indexName,
      body: {
        size: 0,
        query: { bool: { filter: createFilterClauses() } },
        aggs: {
          agents: {
            terms: { field: 'agent_id', size: 1000 },
            aggs: {
              projects: { terms: { field: 'project', size: 100 } },
              memory_count: { value_count: { field: 'memory_id' } },
              last_activity: { max: { field: 'created_at' } }
            }
          }
        }
      },
    });

    const processAgentBucket = (agentMap: Map<string, any>) => (bucket: any) => {
      const agentId = bucket.key;
      if (!agentId || agentId === 'undefined') return;
      
      const existingAgent = agentMap.get(agentId) || {
        agent_id: agentId,
        name: agentId,
        description: `Agent ${agentId}`,
        projects: new Set(),
        memory_count: 0,
        last_activity: null,
        status: 'inactive'
      };

      const updatedAgent = {
        ...existingAgent,
        memory_count: existingAgent.memory_count + bucket.memory_count.value,
        last_activity: bucket.last_activity.value 
          ? (() => {
              const activityDate = new Date(bucket.last_activity.value);
              return !existingAgent.last_activity || activityDate > existingAgent.last_activity 
                ? activityDate 
                : existingAgent.last_activity;
            })()
          : existingAgent.last_activity
      };

      // Add projects from bucket
      if (bucket.projects?.buckets) {
        bucket.projects.buckets.forEach((projectBucket: any) => 
          updatedAgent.projects.add(projectBucket.key)
        );
      }

      agentMap.set(agentId, updatedAgent);
    };

    const processSearchResults = (agentMap: Map<string, any>) => (results: PromiseSettledResult<any>[]) => {
      const fulfilliedResults = results.filter(
        (result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled'
      );
      
      fulfilliedResults.forEach(result => {
        const buckets = result.value.body.aggregations?.agents?.buckets || [];
        buckets.forEach(processAgentBucket(agentMap));
      });
    };

    const formatAgent = (agent: any) => ({
      ...agent,
      projects: Array.from(agent.projects),
      status: agent.last_activity && 
              (new Date().getTime() - agent.last_activity.getTime()) < 24 * 60 * 60 * 1000 
              ? 'active' : 'inactive'
    });

    try {
      const [textResult, codeResult] = await Promise.allSettled([
        this.openSearchService.getClient().search(createSearchQuery(this.openSearchService.getTextIndexName())),
        this.openSearchService.getClient().search(createSearchQuery(this.openSearchService.getCodeIndexName()))
      ]);

      const agentMap = new Map();
      processSearchResults(agentMap)([textResult, codeResult]);
      
      const agents = Array.from(agentMap.values()).map(formatAgent);

      return { agents, total_count: agents.length };
    } catch (error) {
      this.logger.error(`Failed to list agents: ${getErrorMessage(error)}`);
      return { agents: [], total_count: 0 };
    }
  }

  /**
   * List all projects that contain memories
   */
  async listProjects(includeStats: boolean = true): Promise<{ projects: any[], total_count: number }> {
    try {
      // In local mode, use DynamoDB to get projects
      if (this.configService.isLocalMode) {
        return await this.listProjectsFromLocal(includeStats);
      }

      const [textResult, codeResult] = await Promise.allSettled([
        this.openSearchService.getClient().search({
          index: this.openSearchService.getTextIndexName(),
          body: {
            size: 0,
            aggs: {
              projects: {
                terms: { field: 'project', size: 1000 },
                aggs: {
                  memory_count: {
                    value_count: { field: 'memory_id' }
                  },
                  agents: {
                    cardinality: { field: 'agent_id' }
                  },
                  first_memory: {
                    min: { field: 'created_at' }
                  },
                  last_activity: {
                    max: { field: 'created_at' }
                  }
                }
              }
            }
          },
        }),
        this.openSearchService.getClient().search({
          index: this.openSearchService.getCodeIndexName(),
          body: {
            size: 0,
            aggs: {
              projects: {
                terms: { field: 'project', size: 1000 },
                aggs: {
                  memory_count: {
                    value_count: { field: 'memory_id' }
                  },
                  agents: {
                    cardinality: { field: 'agent_id' }
                  },
                  first_memory: {
                    min: { field: 'created_at' }
                  },
                  last_activity: {
                    max: { field: 'created_at' }
                  }
                }
              }
            }
          },
        }),
      ]);

      const projectMap = new Map();

      // Process text index results
      if (textResult.status === 'fulfilled' && textResult.value.body.aggregations?.projects?.buckets) {
        for (const bucket of textResult.value.body.aggregations.projects.buckets) {
          const projectId = bucket.key || 'common';
          
          const project = projectMap.get(projectId) || {
            project_id: projectId,
            name: projectId === 'common' ? 'Common/Shared' : projectId,
            description: projectId === 'common' ? 'Shared memories across all projects' : `Project: ${projectId}`,
            memory_count: 0,
            agent_count: 0,
            created_at: null,
            last_activity: null
          };

          project.memory_count += bucket.memory_count.value;
          project.agent_count = Math.max(project.agent_count, bucket.agents.value);
          
          if (bucket.first_memory.value) {
            const createdDate = new Date(bucket.first_memory.value);
            if (!project.created_at || createdDate < project.created_at) {
              project.created_at = createdDate;
            }
          }
          
          if (bucket.last_activity.value) {
            const activityDate = new Date(bucket.last_activity.value);
            if (!project.last_activity || activityDate > project.last_activity) {
              project.last_activity = activityDate;
            }
          }

          projectMap.set(projectId, project);
        }
      }

      // Process code index results
      if (codeResult.status === 'fulfilled' && codeResult.value.body.aggregations?.projects?.buckets) {
        for (const bucket of codeResult.value.body.aggregations.projects.buckets) {
          const projectId = bucket.key || 'common';
          
          const project = projectMap.get(projectId) || {
            project_id: projectId,
            name: projectId === 'common' ? 'Common/Shared' : projectId,
            description: projectId === 'common' ? 'Shared memories across all projects' : `Project: ${projectId}`,
            memory_count: 0,
            agent_count: 0,
            created_at: null,
            last_activity: null
          };

          project.memory_count += bucket.memory_count.value;
          project.agent_count = Math.max(project.agent_count, bucket.agents.value);
          
          if (bucket.first_memory.value) {
            const createdDate = new Date(bucket.first_memory.value);
            if (!project.created_at || createdDate < project.created_at) {
              project.created_at = createdDate;
            }
          }
          
          if (bucket.last_activity.value) {
            const activityDate = new Date(bucket.last_activity.value);
            if (!project.last_activity || activityDate > project.last_activity) {
              project.last_activity = activityDate;
            }
          }

          projectMap.set(projectId, project);
        }
      }

      const projects = Array.from(projectMap.values());

      return {
        projects,
        total_count: projects.length,
      };
    } catch (error) {
      this.logger.error(`Failed to list projects: ${getErrorMessage(error)}`);
      return { projects: [], total_count: 0 };
    }
  }

  /**
   * List projects from local storage using functional patterns
   */
  private async listProjectsFromLocal(includeStats: boolean = true): Promise<{ projects: any[], total_count: number }> {
    const processMemory = (projectMap: Map<string, any>) => (memory: any) => {
      const project = memory.project || 'common';
      
      const existingProject = projectMap.get(project) || {
        project,
        memory_count: 0,
        agent_count: new Set(),
        first_memory: memory.created_at,
        last_activity: memory.created_at,
      };

      const updatedProject = {
        ...existingProject,
        memory_count: existingProject.memory_count + 1,
        first_memory: memory.created_at < existingProject.first_memory 
          ? memory.created_at 
          : existingProject.first_memory,
        last_activity: memory.created_at > existingProject.last_activity 
          ? memory.created_at 
          : existingProject.last_activity
      };

      if (memory.agent_id) {
        updatedProject.agent_count.add(memory.agent_id);
      }

      projectMap.set(project, updatedProject);
    };

    const formatProject = (project: any) => ({
      ...project,
      agent_count: project.agent_count.size,
      first_memory: new Date(project.first_memory),
      last_activity: new Date(project.last_activity),
    });

    try {
      const localStorageService = this.dynamoDbService as any;
      if (!localStorageService.getAllMemories) {
        this.logger.warn('getAllMemories method not available, returning empty projects list');
        return { projects: [], total_count: 0 };
      }

      const allMemories = await localStorageService.getAllMemories();
      const projectMap = new Map<string, any>();
      
      allMemories.forEach(processMemory(projectMap));
      
      const projects = Array.from(projectMap.values()).map(formatProject);

      return { projects, total_count: projects.length };
    } catch (error) {
      this.logger.error(`Failed to list projects from local storage: ${getErrorMessage(error)}`);
      return { projects: [], total_count: 0 };
    }
  }

  /**
   * Retrieve graph connections between memories
   */
  async retrieveConnections(params: { memory_id?: string; relationship_type?: string; limit?: number }) {
    try {
      // This would use Neo4j service to get connections
      const connections = await this.neo4jService.getConnections(params.memory_id, params.relationship_type, params.limit || 50);
      return {
        connections,
        total_count: connections.length
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve connections: ${getErrorMessage(error)}`);
      return { connections: [], total_count: 0 };
    }
  }

  /**
   * Get all connections for a specific entity
   */
  async connectionsByEntity(params: { entity_id: string; entity_type: 'memory' | 'agent' | 'session'; limit?: number }) {
    try {
      // This would use Neo4j service to get entity connections
      const connections = await this.neo4jService.getEntityConnections(params.entity_id, params.entity_type, params.limit || 50);
      return {
        entity_id: params.entity_id,
        entity_type: params.entity_type,
        connections,
        total_count: connections.length
      };
    } catch (error) {
      this.logger.error(`Failed to get connections by entity: ${getErrorMessage(error)}`);
      return { entity_id: params.entity_id, entity_type: params.entity_type, connections: [], total_count: 0 };
    }
  }

  // Enhanced memory connection methods for Issue #5

  /**
   * Find memories that contain similar concepts
   */
  private async findMemoriesByConcept(concept: string, limit: number = 10): Promise<StoredMemory[]> {
    try {
      // Search for memories containing the concept in content or tags
      const searchResults = await this.retrieveMemories({
        query: {
          query: concept,
          limit,
          threshold: 0.7
        }
      });
      
      return searchResults.memories?.map(result => result.memory) || [];
    } catch (error) {
      this.logger.warn(`Failed to find memories by concept "${concept}": ${getErrorMessage(error)}`);
      return [];
    }
  }

  /**
   * Calculate semantic similarity between two pieces of content
   */
  private calculateConceptSimilarity(content1: string, content2: string): number {
    // Simple similarity calculation based on shared concepts
    const concepts1 = new Set(this.extractConcepts(content1));
    const concepts2 = new Set(this.extractConcepts(content2));
    
    const intersection = new Set(Array.from(concepts1).filter(x => concepts2.has(x)));
    const union = new Set([...Array.from(concepts1), ...Array.from(concepts2)]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Create code-specific relationships for code memories
   */
  private async createCodeSpecificRelationships(memoryId: string, content: string): Promise<void> {
    try {
      // Extract code-specific patterns
      const imports = this.extractImports(content);
      const functions = this.extractFunctions(content);
      const patterns = this.extractCodePatterns(content);

      // Find related code memories based on imports
      for (const importName of imports) {
        const relatedCodeMemories = await this.findCodeMemoriesByImport(importName);
        
        for (const relatedMemory of relatedCodeMemories) {
          if (relatedMemory.metadata.memory_id !== memoryId) {
            await this.neo4jService.addConnection(
              memoryId,
              relatedMemory.metadata.memory_id,
              'IMPORTS_FROM',
              { 
                import_name: importName,
                confidence: 0.9,
                created_at: new Date().toISOString()
              }
            );
          }
        }
      }

      // Find related memories based on similar functions
      for (const functionName of functions) {
        const relatedCodeMemories = await this.findCodeMemoriesByFunction(functionName);
        
        for (const relatedMemory of relatedCodeMemories) {
          if (relatedMemory.metadata.memory_id !== memoryId) {
            await this.neo4jService.addConnection(
              memoryId,
              relatedMemory.metadata.memory_id,
              'IMPLEMENTS_SIMILAR',
              { 
                function_name: functionName,
                confidence: 0.8,
                created_at: new Date().toISOString()
              }
            );
          }
        }
      }

      this.logger.debug(`Created code-specific relationships for memory ${memoryId}`);
    } catch (error) {
      this.logger.warn(`Failed to create code-specific relationships: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Find code memories that import a specific module/package
   */
  private async findCodeMemoriesByImport(importName: string): Promise<StoredMemory[]> {
    try {
      const searchResults = await this.retrieveMemories({
        query: {
          query: `import ${importName}`,
          content_type: 'code',
          limit: 5,
          threshold: 0.8
        }
      });
      
      return searchResults.memories?.map(result => result.memory) || [];
    } catch (error) {
      this.logger.warn(`Failed to find code memories by import "${importName}": ${getErrorMessage(error)}`);
      return [];
    }
  }

  /**
   * Find code memories that define or use similar functions
   */
  private async findCodeMemoriesByFunction(functionName: string): Promise<StoredMemory[]> {
    try {
      const searchResults = await this.retrieveMemories({
        query: {
          query: functionName,
          content_type: 'code',
          limit: 5,
          threshold: 0.7
        }
      });
      
      return searchResults.memories?.map(result => result.memory) || [];
    } catch (error) {
      this.logger.warn(`Failed to find code memories by function "${functionName}": ${getErrorMessage(error)}`);
      return [];
    }
  }

  /**
   * Analyze memory connections and provide comprehensive insights (Issue #5)
   */
  async analyzeMemoryConnections(params: {
    memory_id?: string;
    agent_id?: string;
    project?: string;
    relationship_types?: string[];
    depth?: number;
    include_analytics?: boolean;
  }): Promise<any> {
    try {
      const depth = params.depth || 2;
      const includeAnalytics = params.include_analytics !== false;
      
      let baseQuery: any = {};
      if (params.memory_id) {
        baseQuery.memory_ids = [params.memory_id];
      } else {
        if (params.agent_id) baseQuery.agent_id = params.agent_id;
        if (params.project) baseQuery.project = params.project;
        baseQuery.limit = 50; // Get a reasonable set of memories to analyze
      }

      // Get base memories to analyze
      const baseMemories = await this.retrieveMemories(baseQuery);
      const memoryIds = baseMemories.memories?.map(m => m.memory.metadata.memory_id) || [];

      if (memoryIds.length === 0) {
        return {
          analysis_type: 'memory_connections',
          scope: params,
          memories_analyzed: 0,
          connection_summary: {},
          insights: ['No memories found for the specified criteria']
        };
      }

      // Get all connections for these memories
      const connections = [];
      const relationshipTypeCounts: Record<string, number> = {};
      const conceptClusters: Record<string, string[]> = {};
      const codePatterns: Record<string, string[]> = {};

      for (const memoryId of memoryIds) {
        try {
          const memoryConnections = await this.retrieveConnections({ memory_id: memoryId, limit: 100 });
          connections.push(...(memoryConnections.connections || []));

          // Analyze relationship types
          if (memoryConnections.connections) {
            for (const conn of memoryConnections.connections) {
              const relType = conn.relationship_type || 'UNKNOWN';
              relationshipTypeCounts[relType] = (relationshipTypeCounts[relType] || 0) + 1;

              // Analyze concept clusters
              if (relType === 'SHARES_CONCEPT' && conn.properties?.concept) {
                const concept = conn.properties.concept;
                if (!conceptClusters[concept]) conceptClusters[concept] = [];
                conceptClusters[concept].push(memoryId);
                if (conceptClusters[concept].indexOf(conn.to_memory_id) === -1) {
                  conceptClusters[concept].push(conn.to_memory_id);
                }
              }

              // Analyze code patterns
              if ((relType === 'IMPORTS_FROM' || relType === 'IMPLEMENTS_SIMILAR') && conn.properties) {
                const pattern = conn.properties.import_name || conn.properties.function_name || 'unknown';
                if (!codePatterns[pattern]) codePatterns[pattern] = [];
                codePatterns[pattern].push(memoryId);
                if (codePatterns[pattern].indexOf(conn.to_memory_id) === -1) {
                  codePatterns[pattern].push(conn.to_memory_id);
                }
              }
            }
          }
        } catch (error) {
          this.logger.warn(`Failed to get connections for memory ${memoryId}: ${getErrorMessage(error)}`);
        }
      }

      const analysis = {
        analysis_type: 'memory_connections',
        scope: params,
        memories_analyzed: memoryIds.length,
        connections_found: connections.length,
        connection_summary: {
          total_connections: connections.length,
          relationship_type_distribution: relationshipTypeCounts,
          most_common_relationships: Object.entries(relationshipTypeCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([type, count]) => ({ type, count }))
        },
        concept_analysis: {
          total_concepts: Object.keys(conceptClusters).length,
          largest_concept_clusters: Object.entries(conceptClusters)
            .sort(([,a], [,b]) => b.length - a.length)
            .slice(0, 10)
            .map(([concept, memories]) => ({ 
              concept, 
              memory_count: memories.length,
              memory_ids: memories.slice(0, 5) // Show first 5 for brevity
            }))
        },
        code_analysis: {
          total_patterns: Object.keys(codePatterns).length,
          most_connected_patterns: Object.entries(codePatterns)
            .sort(([,a], [,b]) => b.length - a.length)
            .slice(0, 10)
            .map(([pattern, memories]) => ({ 
              pattern, 
              memory_count: memories.length,
              memory_ids: memories.slice(0, 5)
            }))
        },
        insights: this.generateConnectionInsights(relationshipTypeCounts, conceptClusters, codePatterns, memoryIds.length)
      };

      if (includeAnalytics) {
        analysis['advanced_analytics'] = {
          connection_density: connections.length / (memoryIds.length * (memoryIds.length - 1)),
          average_connections_per_memory: connections.length / memoryIds.length,
          isolated_memories: memoryIds.length - new Set(connections.flatMap(c => [c.from_memory_id, c.to_memory_id])).size,
          strongest_connections: connections
            .filter(c => c.properties?.confidence)
            .sort((a, b) => (b.properties?.confidence || 0) - (a.properties?.confidence || 0))
            .slice(0, 5)
            .map(c => ({
              from: c.from_memory_id,
              to: c.to_memory_id,
              type: c.relationship_type,
              confidence: c.properties?.confidence
            }))
        };
      }

      return analysis;
    } catch (error) {
      this.logger.error(`Failed to analyze memory connections: ${getErrorMessage(error)}`);
      return {
        analysis_type: 'memory_connections',
        scope: params,
        error: getErrorMessage(error),
        insights: ['Analysis failed due to an error']
      };
    }
  }

  /**
   * Generate insights from connection analysis
   */
  private generateConnectionInsights(
    relationshipTypes: Record<string, number>,
    conceptClusters: Record<string, string[]>,
    codePatterns: Record<string, string[]>,
    totalMemories: number
  ): string[] {
    const insights: string[] = [];

    // Relationship type insights
    const totalConnections = Object.values(relationshipTypes).reduce((sum, count) => sum + count, 0);
    if (totalConnections === 0) {
      insights.push('No connections found - memories are isolated');
    } else {
      insights.push(`Found ${totalConnections} connections across ${Object.keys(relationshipTypes).length} relationship types`);
      
      const mostCommon = Object.entries(relationshipTypes).sort(([,a], [,b]) => b - a)[0];
      if (mostCommon) {
        insights.push(`Most common relationship type: ${mostCommon[0]} (${mostCommon[1]} connections)`);
      }
    }

    // Concept clustering insights
    const conceptCount = Object.keys(conceptClusters).length;
    if (conceptCount > 0) {
      insights.push(`Identified ${conceptCount} shared concepts creating knowledge clusters`);
      
      const largestCluster = Object.entries(conceptClusters).sort(([,a], [,b]) => b.length - a.length)[0];
      if (largestCluster && largestCluster[1].length > 2) {
        insights.push(`Largest concept cluster: "${largestCluster[0]}" connects ${largestCluster[1].length} memories`);
      }
    }

    // Code pattern insights
    const codePatternCount = Object.keys(codePatterns).length;
    if (codePatternCount > 0) {
      insights.push(`Found ${codePatternCount} code patterns with shared implementations or imports`);
      
      const mostConnectedPattern = Object.entries(codePatterns).sort(([,a], [,b]) => b.length - a.length)[0];
      if (mostConnectedPattern && mostConnectedPattern[1].length > 2) {
        insights.push(`Most connected code pattern: "${mostConnectedPattern[0]}" links ${mostConnectedPattern[1].length} memories`);
      }
    }

    // Connection density insights
    const density = totalConnections / (totalMemories * (totalMemories - 1));
    if (density > 0.1) {
      insights.push('High connection density - memories are well-interconnected');
    } else if (density > 0.05) {
      insights.push('Moderate connection density - some clustering present');
    } else {
      insights.push('Low connection density - opportunities for better linking');
    }

    return insights;
  }
}