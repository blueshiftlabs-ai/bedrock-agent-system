import { Injectable, Logger } from '@nestjs/common';
import { Client } from '@opensearch-project/opensearch';
import { MemoryConfigService } from '../config/memory-config.service';
import { 
  OpenSearchDocument, 
  MemoryMetadata, 
  MemoryQuery,
  MemorySearchResult,
  StoredMemory,
  ContentType
} from '../types/memory.types';
import { v4 as uuidv4 } from 'uuid';

/**
 * OpenSearch storage service for vector similarity search
 * Maintains separate indices for text and code content with optimized mappings
 */
@Injectable()
export class OpenSearchStorageService {
  private readonly logger = new Logger(OpenSearchStorageService.name);
  private readonly opensearchClient: Client;
  private readonly textIndexName: string = 'memory-text';
  private readonly codeIndexName: string = 'memory-code';
  private readonly vectorDimension: number = 384; // Local transformer dimension (all-MiniLM-L6-v2)

  constructor(private readonly configService: MemoryConfigService) {
    const { endpoint } = this.configService.openSearchConfig;
    const region = this.configService.awsRegion;
    const isDevelopment = this.configService.isDevelopment;
    
    if (isDevelopment) {
      // Local OpenSearch without authentication
      this.opensearchClient = new Client({
        node: endpoint || 'http://localhost:9200',
      });
    } else {
      // Production with AWS OpenSearch
      this.opensearchClient = new Client({
        node: endpoint,
        // AWS IAM authentication would be configured here
        // For now, we'll skip auth in development
      });
    }
    
    this.logger.log('OpenSearch Storage Service initialized');
    this.initializeIndices();
  }

  /**
   * Initialize OpenSearch indices with optimized mappings
   */
  private async initializeIndices(): Promise<void> {
    try {
      // Create text index if it doesn't exist
      await this.createIndexIfNotExists(this.textIndexName, this.getTextIndexMapping());
      
      // Create code index if it doesn't exist
      await this.createIndexIfNotExists(this.codeIndexName, this.getCodeIndexMapping());
      
      this.logger.log('OpenSearch indices initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize indices: ${error.message}`);
    }
  }

  /**
   * Create index if it doesn't exist
   */
  private async createIndexIfNotExists(indexName: string, mapping: any): Promise<void> {
    try {
      const { body: exists } = await this.opensearchClient.indices.exists({
        index: indexName,
      });

      if (!exists) {
        await this.opensearchClient.indices.create({
          index: indexName,
          body: mapping,
        });
        this.logger.log(`Created index: ${indexName}`);
      }
    } catch (error) {
      this.logger.error(`Failed to create index ${indexName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get optimized mapping for text content
   */
  private getTextIndexMapping(): any {
    return {
      settings: {
        index: {
          number_of_shards: 2,
          number_of_replicas: 1,
          'knn': true,
          'knn.algo_param.ef_search': 100,
        },
        analysis: {
          analyzer: {
            text_analyzer: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'stop', 'snowball'],
            },
          },
        },
      },
      mappings: {
        properties: {
          memory_id: { type: 'keyword' },
          content: { 
            type: 'text',
            analyzer: 'text_analyzer',
            fields: {
              keyword: { type: 'keyword', ignore_above: 256 }
            }
          },
          embeddings: {
            type: 'knn_vector',
            dimension: this.vectorDimension,
            method: {
              name: 'hnsw',
              space_type: 'cosinesimil',
              engine: 'lucene',
              parameters: {
                ef_construction: 128,
                m: 24,
              },
            },
          },
          content_type: { type: 'keyword' },
          type: { type: 'keyword' },
          agent_id: { type: 'keyword' },
          session_id: { type: 'keyword' },
          project: { type: 'keyword' },
          tags: { type: 'keyword' },
          created_at: { type: 'date' },
          language: { type: 'keyword' },
          topics: { type: 'keyword' },
          sentiment: { type: 'keyword' },
          entities: { type: 'keyword' },
        },
      },
    };
  }

  /**
   * Get optimized mapping for code content
   */
  private getCodeIndexMapping(): any {
    return {
      settings: {
        index: {
          number_of_shards: 2,
          number_of_replicas: 1,
          'knn': true,
          'knn.algo_param.ef_search': 100,
        },
        analysis: {
          analyzer: {
            code_analyzer: {
              type: 'custom',
              tokenizer: 'whitespace',
              filter: ['lowercase'],
            },
          },
        },
      },
      mappings: {
        properties: {
          memory_id: { type: 'keyword' },
          content: { 
            type: 'text',
            analyzer: 'code_analyzer',
            fields: {
              raw: { type: 'keyword', ignore_above: 10000 }
            }
          },
          embeddings: {
            type: 'knn_vector',
            dimension: this.vectorDimension,
            method: {
              name: 'hnsw',
              space_type: 'cosinesimil',
              engine: 'lucene',
              parameters: {
                ef_construction: 128,
                m: 24,
              },
            },
          },
          content_type: { type: 'keyword' },
          type: { type: 'keyword' },
          agent_id: { type: 'keyword' },
          session_id: { type: 'keyword' },
          project: { type: 'keyword' },
          tags: { type: 'keyword' },
          created_at: { type: 'date' },
          programming_language: { type: 'keyword' },
          functions: { type: 'keyword' },
          imports: { type: 'keyword' },
          patterns: { type: 'keyword' },
          complexity: { type: 'keyword' },
        },
      },
    };
  }

  /**
   * Store memory in OpenSearch with vector embeddings
   */
  async storeMemory(
    memory: StoredMemory,
    embeddings: number[]
  ): Promise<string> {
    const indexName = memory.metadata.content_type === 'text' ? this.textIndexName : this.codeIndexName;
    const documentId = uuidv4();

    const document: OpenSearchDocument = {
      memory_id: memory.metadata.memory_id,
      content: memory.content,
      embeddings: embeddings,
      content_type: memory.metadata.content_type,
      type: memory.metadata.type,
      agent_id: memory.metadata.agent_id,
      session_id: memory.metadata.session_id,
      project: memory.metadata.project,
      tags: memory.metadata.tags,
      created_at: memory.metadata.created_at.toISOString(),
    };

    // Add content-specific fields
    if (memory.metadata.content_type === 'text') {
      const textMetadata = memory.metadata as any;
      document.language = textMetadata.language;
      document.topics = textMetadata.topics;
      document.sentiment = textMetadata.sentiment;
      document.entities = textMetadata.entities;
    } else if (memory.metadata.content_type === 'code') {
      const codeMetadata = memory.metadata as any;
      document.programming_language = codeMetadata.programming_language;
      document.functions = codeMetadata.functions;
      document.imports = codeMetadata.imports;
      document.patterns = codeMetadata.patterns;
      document.complexity = codeMetadata.complexity;
    }

    try {
      await this.opensearchClient.index({
        index: indexName,
        id: documentId,
        body: document,
        refresh: true, // Make it immediately searchable
      });

      this.logger.debug(`Stored memory in OpenSearch: ${memory.metadata.memory_id} -> ${documentId}`);
      return documentId;
    } catch (error) {
      this.logger.error(`Failed to store memory in OpenSearch: ${error.message}`);
      throw error;
    }
  }

  /**
   * Search memories using vector similarity and filters
   */
  async searchMemories(
    query: MemoryQuery,
    queryEmbeddings: number[]
  ): Promise<MemorySearchResult[]> {
    const mustClauses: any[] = [];
    const filterClauses: any[] = [];

    // Add type filter
    if (query.type) {
      filterClauses.push({ term: { type: query.type } });
    }

    // Add content type filter
    if (query.content_type) {
      filterClauses.push({ term: { content_type: query.content_type } });
    }

    // Add agent filter
    if (query.agent_id) {
      filterClauses.push({ term: { agent_id: query.agent_id } });
    }

    // Add session filter
    if (query.session_id) {
      filterClauses.push({ term: { session_id: query.session_id } });
    }

    // Add project filter
    if (query.project) {
      filterClauses.push({ term: { project: query.project } });
    }

    // Add tag filters
    if (query.tags && query.tags.length > 0) {
      filterClauses.push({ terms: { tags: query.tags } });
    }

    // Build the search query
    const searchBody: any = {
      size: query.limit || 10,
      query: {
        bool: {
          must: [
            {
              knn: {
                embeddings: {
                  vector: queryEmbeddings,
                  k: query.limit || 10,
                },
              },
            },
          ],
          filter: filterClauses,
        },
      },
      _source: true,
    };

    // Add text search if query text is provided
    if (query.query && query.query.trim()) {
      mustClauses.push({
        match: {
          content: {
            query: query.query,
            boost: 0.3, // Give some weight to text matching
          },
        },
      });
    }

    try {
      // Search both indices if no content type specified
      const indices = query.content_type 
        ? [query.content_type === 'text' ? this.textIndexName : this.codeIndexName]
        : [this.textIndexName, this.codeIndexName];

      const results: MemorySearchResult[] = [];

      for (const index of indices) {
        const { body } = await this.opensearchClient.search({
          index,
          body: searchBody,
        });

        const hits = body.hits.hits;
        
        for (const hit of hits) {
          const document = hit._source as OpenSearchDocument;
          const score = hit._score;

          // Apply similarity threshold
          if (query.threshold && score < query.threshold) {
            continue;
          }

          // Convert OpenSearch document back to StoredMemory
          const memory = await this.documentToStoredMemory(document, hit._id);
          
          results.push({
            memory,
            similarity_score: score,
            related_memories: [], // Will be populated by graph service
            graph_connections: [], // Will be populated by graph service
          });
        }
      }

      // Sort by similarity score
      results.sort((a, b) => b.similarity_score - a.similarity_score);

      // Limit results
      return results.slice(0, query.limit || 10);
    } catch (error) {
      this.logger.error(`Failed to search memories: ${error.message}`);
      return [];
    }
  }

  /**
   * Get memory by OpenSearch document ID
   */
  async getMemoryByDocumentId(indexName: string, documentId: string): Promise<StoredMemory | null> {
    try {
      const { body } = await this.opensearchClient.get({
        index: indexName,
        id: documentId,
      });

      if (!body.found) {
        return null;
      }

      const document = body._source as OpenSearchDocument;
      return this.documentToStoredMemory(document, documentId);
    } catch (error) {
      this.logger.error(`Failed to get memory by document ID: ${error.message}`);
      return null;
    }
  }

  /**
   * Update memory content and embeddings
   */
  async updateMemory(
    memoryId: string,
    content: string,
    embeddings: number[],
    contentType: ContentType
  ): Promise<void> {
    const indexName = contentType === 'text' ? this.textIndexName : this.codeIndexName;

    try {
      // First, find the document by memory_id
      const { body: searchResult } = await this.opensearchClient.search({
        index: indexName,
        body: {
          query: {
            term: { memory_id: memoryId },
          },
        },
      });

      if (searchResult.hits.total.value === 0) {
        throw new Error(`Memory not found: ${memoryId}`);
      }

      const documentId = searchResult.hits.hits[0]._id;

      // Update the document
      await this.opensearchClient.update({
        index: indexName,
        id: documentId,
        body: {
          doc: {
            content,
            embeddings,
            updated_at: new Date().toISOString(),
          },
        },
        refresh: true,
      });

      this.logger.debug(`Updated memory in OpenSearch: ${memoryId}`);
    } catch (error) {
      this.logger.error(`Failed to update memory: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete memory from OpenSearch
   */
  async deleteMemory(memoryId: string, contentType: ContentType): Promise<void> {
    const indexName = contentType === 'text' ? this.textIndexName : this.codeIndexName;

    try {
      // Find and delete by memory_id
      const { body: searchResult } = await this.opensearchClient.search({
        index: indexName,
        body: {
          query: {
            term: { memory_id: memoryId },
          },
        },
      });

      if (searchResult.hits.total.value > 0) {
        const documentId = searchResult.hits.hits[0]._id;
        
        await this.opensearchClient.delete({
          index: indexName,
          id: documentId,
          refresh: true,
        });

        this.logger.debug(`Deleted memory from OpenSearch: ${memoryId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete memory: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find similar memories using pure vector similarity
   */
  async findSimilarMemories(
    embeddings: number[],
    contentType: ContentType,
    limit: number = 5,
    excludeMemoryId?: string
  ): Promise<MemorySearchResult[]> {
    const indexName = contentType === 'text' ? this.textIndexName : this.codeIndexName;

    const searchBody: any = {
      size: limit + 1, // Get one extra in case we need to exclude
      query: {
        knn: {
          embeddings: {
            vector: embeddings,
            k: limit + 1,
          },
        },
      },
      _source: true,
    };

    try {
      const { body } = await this.opensearchClient.search({
        index: indexName,
        body: searchBody,
      });

      const results: MemorySearchResult[] = [];
      
      for (const hit of body.hits.hits) {
        const document = hit._source as OpenSearchDocument;
        
        // Skip if it's the same memory
        if (excludeMemoryId && document.memory_id === excludeMemoryId) {
          continue;
        }

        const memory = await this.documentToStoredMemory(document, hit._id);
        
        results.push({
          memory,
          similarity_score: hit._score,
          related_memories: [],
          graph_connections: [],
        });
      }

      return results.slice(0, limit);
    } catch (error) {
      this.logger.error(`Failed to find similar memories: ${error.message}`);
      return [];
    }
  }

  /**
   * Convert OpenSearch document to StoredMemory
   */
  private async documentToStoredMemory(
    document: OpenSearchDocument,
    opensearchId: string
  ): Promise<StoredMemory> {
    const baseMetadata = {
      memory_id: document.memory_id,
      type: document.type,
      content_type: document.content_type,
      agent_id: document.agent_id,
      session_id: document.session_id,
      created_at: new Date(document.created_at),
      updated_at: new Date(document.created_at), // Will be updated from DynamoDB
      tags: document.tags,
      access_count: 0, // Will be updated from DynamoDB
      last_accessed: new Date(document.created_at), // Will be updated from DynamoDB
    };

    let metadata: MemoryMetadata;

    if (document.content_type === 'text') {
      metadata = {
        ...baseMetadata,
        content_type: 'text',
        language: document.language,
        topics: document.topics,
        sentiment: document.sentiment as any,
        entities: document.entities,
      };
    } else {
      metadata = {
        ...baseMetadata,
        content_type: 'code',
        programming_language: document.programming_language,
        functions: document.functions,
        imports: document.imports,
        patterns: document.patterns,
        complexity: document.complexity as any,
      };
    }

    return {
      metadata,
      content: document.content,
      embeddings: document.embeddings,
      opensearch_id: opensearchId,
    };
  }

  /**
   * Get memory statistics
   */
  async getMemoryStatistics(agentId?: string): Promise<any> {
    try {
      const mustClauses = agentId ? [{ term: { agent_id: agentId } }] : [];

      // Basic aggregations that should work with keyword fields
      const safeAggregations = {
        by_type: {
          terms: { 
            field: 'type',
            size: 10
          },
        },
        by_content_type: {
          terms: { 
            field: 'content_type',
            size: 10
          },
        },
        recent_memories: {
          date_histogram: {
            field: 'created_at',
            calendar_interval: 'day',
            min_doc_count: 1
          },
        },
      };

      // Try to get basic counts first
      const [textResult, codeResult] = await Promise.allSettled([
        this.opensearchClient.search({
          index: this.textIndexName,
          body: {
            size: 0,
            query: {
              bool: { must: mustClauses },
            },
            aggs: safeAggregations,
          },
        }),
        this.opensearchClient.search({
          index: this.codeIndexName,
          body: {
            size: 0,
            query: {
              bool: { must: mustClauses },
            },
            aggs: {
              ...safeAggregations,
              by_language: {
                terms: { 
                  field: 'programming_language',
                  size: 20
                },
              },
            },
          },
        }),
      ]);

      const stats: any = {
        total_memories: 0,
        text_memories: 0,
        code_memories: 0,
        aggregations: {
          by_type: { buckets: [] },
          by_content_type: { buckets: [] },
          by_language: { buckets: [] },
          recent_memories: { buckets: [] }
        },
        errors: []
      };

      if (textResult.status === 'fulfilled') {
        const textStats = textResult.value.body;
        stats.text_memories = textStats.hits.total.value;
        stats.total_memories += textStats.hits.total.value;
        
        if (textStats.aggregations) {
          stats.aggregations.by_type.buckets.push(...(textStats.aggregations.by_type?.buckets || []));
          stats.aggregations.by_content_type.buckets.push(...(textStats.aggregations.by_content_type?.buckets || []));
          stats.aggregations.recent_memories.buckets.push(...(textStats.aggregations.recent_memories?.buckets || []));
        }
      } else {
        stats.errors.push(`Text index error: ${textResult.reason?.message || 'Unknown error'}`);
      }

      if (codeResult.status === 'fulfilled') {
        const codeStats = codeResult.value.body;
        stats.code_memories = codeStats.hits.total.value;
        stats.total_memories += codeStats.hits.total.value;
        
        if (codeStats.aggregations) {
          stats.aggregations.by_type.buckets.push(...(codeStats.aggregations.by_type?.buckets || []));
          stats.aggregations.by_content_type.buckets.push(...(codeStats.aggregations.by_content_type?.buckets || []));
          stats.aggregations.by_language.buckets.push(...(codeStats.aggregations.by_language?.buckets || []));
          stats.aggregations.recent_memories.buckets.push(...(codeStats.aggregations.recent_memories?.buckets || []));
        }
      } else {
        stats.errors.push(`Code index error: ${codeResult.reason?.message || 'Unknown error'}`);
      }

      return stats;
    } catch (error) {
      this.logger.error(`Failed to get memory statistics: ${error.message}`);
      return {
        total_memories: 0,
        text_memories: 0,
        code_memories: 0,
        error: error.message,
        aggregations: {
          by_type: { buckets: [] },
          by_content_type: { buckets: [] },
          by_language: { buckets: [] },
          recent_memories: { buckets: [] }
        }
      };
    }
  }

  /**
   * Health check for OpenSearch connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      const { body } = await this.opensearchClient.cluster.health();
      return body.status === 'green' || body.status === 'yellow';
    } catch (error) {
      this.logger.error(`OpenSearch health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get the OpenSearch client for direct queries
   */
  getClient() {
    return this.opensearchClient;
  }

  /**
   * Get the text index name
   */
  getTextIndexName(): string {
    return this.textIndexName;
  }

  /**
   * Get the code index name
   */
  getCodeIndexName(): string {
    return this.codeIndexName;
  }
}