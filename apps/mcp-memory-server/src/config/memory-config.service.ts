import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Configuration service for memory server
 * Manages all AWS service configurations and environment settings
 * Supports local, development, and production modes
 */
@Injectable()
export class MemoryConfigService {
  private readonly logger = new Logger(MemoryConfigService.name);
  
  constructor(private readonly configService: ConfigService) {
    const mode = this.configService.get<string>('MEMORY_MODE', 'local');
    this.logger.log(`Memory server initialized in ${mode} mode`);
  }

  /**
   * Get memory mode (local, server)
   */
  get memoryMode(): string {
    return this.configService.get<string>('MEMORY_MODE', 'local');
  }

  /**
   * Check if running in local mode
   */
  get isLocalMode(): boolean {
    return this.memoryMode === 'local';
  }

  /**
   * Check if running in server mode
   */
  get isServerMode(): boolean {
    return this.memoryMode === 'server';
  }

  /**
   * Get AWS region
   */
  get awsRegion(): string {
    return this.configService.get<string>('AWS_REGION', 'us-east-1');
  }

  /**
   * Get environment
   */
  get environment(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  /**
   * Check if running in development
   */
  get isDevelopment(): boolean {
    return this.environment === 'development';
  }

  /**
   * Dgraph Configuration
   */
  get dgraphConfig() {
    return {
      endpoint: this.configService.get<string>('DGRAPH_ENDPOINT', 'localhost'),
      port: this.configService.get<number>('DGRAPH_PORT', 9080),
    };
  }

  /**
   * Check if using local storage
   */
  get useLocalStorage(): boolean {
    return this.configService.get<string>('USE_LOCAL_STORAGE', 'true') === 'true';
  }

  /**
   * Check if Bedrock is enabled
   */
  get bedrockEnabled(): boolean {
    return this.configService.get<string>('BEDROCK_ENABLED', 'false') === 'true';
  }

  /**
   * Check if transformer embeddings are enabled
   */
  get transformerEmbeddingsEnabled(): boolean {
    return this.configService.get<string>('ENABLE_TRANSFORMER_EMBEDDINGS', 'true') === 'true';
  }

  /**
   * DynamoDB Configuration
   */
  get dynamoDbConfig() {
    return {
      memoryTableName: this.configService.get<string>('MEMORY_TABLE_NAME', 'MemoryMetadata'),
      sessionTableName: this.configService.get<string>('SESSION_TABLE_NAME', 'SessionManagement'),
      agentTableName: this.configService.get<string>('AGENT_TABLE_NAME', 'AgentProfiles'),
    };
  }

  /**
   * OpenSearch Configuration
   */
  get openSearchConfig() {
    return {
      endpoint: this.configService.get<string>('OPENSEARCH_ENDPOINT', 'http://localhost:5102'),
      textIndexName: 'memory-text',
      codeIndexName: 'memory-code',
      vectorDimension: 384, // Local transformer dimension (all-MiniLM-L6-v2)
    };
  }

  /**
   * Neptune Configuration
   */
  get neptuneConfig() {
    return {
      endpoint: this.configService.get<string>('NEPTUNE_ENDPOINT', 'ws://localhost:8182/gremlin'),
      port: this.configService.get<number>('NEPTUNE_PORT', 8182),
    };
  }

  /**
   * Neo4j Configuration
   */
  get neo4jConfig() {
    return {
      uri: this.configService.get<string>('NEO4J_URI', 'bolt://localhost:7687'),
      username: this.configService.get<string>('NEO4J_USERNAME', 'neo4j'),
      password: this.configService.get<string>('NEO4J_PASSWORD', 'password'),
    };
  }

  /**
   * Bedrock Configuration
   */
  get bedrockConfig() {
    return {
      textEmbeddingModel: this.configService.get<string>('TEXT_EMBEDDING_MODEL', 'amazon.titan-embed-text-v1'),
      codeEmbeddingModel: this.configService.get<string>('CODE_EMBEDDING_MODEL', 'amazon.titan-embed-text-v1'),
      region: this.awsRegion,
    };
  }

  /**
   * Memory Service Configuration
   */
  get memoryServiceConfig() {
    return {
      defaultSimilarityThreshold: 0.7,
      maxMemoriesPerQuery: 50,
      memoryConsolidationThreshold: 0.9,
      contextWindowSize: 10,
      ttlWorkingMemorySeconds: 3600, // 1 hour
    };
  }

  /**
   * Get all configuration as object
   */
  getAllConfig() {
    return {
      environment: this.environment,
      awsRegion: this.awsRegion,
      dynamoDb: this.dynamoDbConfig,
      openSearch: this.openSearchConfig,
      neptune: this.neptuneConfig,
      neo4j: this.neo4jConfig,
      bedrock: this.bedrockConfig,
      memoryService: this.memoryServiceConfig,
    };
  }
}