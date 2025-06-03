export const configuration = () => ({
  // Server Configuration
  port: parseInt(process.env.PORT, 10) || 3000,
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // AWS Configuration
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    
    // S3 Configuration
    s3: {
      bucketName: process.env.AWS_S3_BUCKET || 'mcp-hybrid-server-data',
      region: process.env.AWS_S3_REGION || process.env.AWS_REGION,
    },
    
    // OpenSearch Configuration
    opensearch: {
      endpoint: process.env.AWS_OPENSEARCH_ENDPOINT,
      region: process.env.AWS_OPENSEARCH_REGION || process.env.AWS_REGION,
      indexPrefix: process.env.OPENSEARCH_INDEX_PREFIX || 'mcp',
    },
    
    // Neptune Configuration
    neptune: {
      endpoint: process.env.AWS_NEPTUNE_ENDPOINT,
      region: process.env.AWS_NEPTUNE_REGION || process.env.AWS_REGION,
      port: parseInt(process.env.AWS_NEPTUNE_PORT, 10) || 8182,
    },
    
    // DynamoDB Configuration
    dynamodb: {
      region: process.env.AWS_DYNAMODB_REGION || process.env.AWS_REGION,
      metadataTable: process.env.DYNAMODB_METADATA_TABLE || 'MCPMetadata',
      workflowStateTable: process.env.DYNAMODB_WORKFLOW_STATE_TABLE || 'MCPWorkflowState',
    },
    
    // Bedrock Configuration
    bedrock: {
      region: process.env.AWS_BEDROCK_REGION || process.env.AWS_REGION,
      modelId: process.env.AWS_BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0',
      embeddingModelId: process.env.AWS_BEDROCK_EMBEDDING_MODEL_ID || 'amazon.titan-embed-text-v1',
      maxTokens: parseInt(process.env.BEDROCK_MAX_TOKENS, 10) || 4096,
      temperature: parseFloat(process.env.BEDROCK_TEMPERATURE) || 0.7,
    },
  },
  
  // Memory Configuration
  memory: {
    defaultMaxResults: parseInt(process.env.MEMORY_DEFAULT_MAX_RESULTS, 10) || 10,
    defaultRecencyWeight: parseFloat(process.env.MEMORY_DEFAULT_RECENCY_WEIGHT) || 0.3,
    defaultRelevanceThreshold: parseFloat(process.env.MEMORY_DEFAULT_RELEVANCE_THRESHOLD) || 0.6,
    embeddingDimensions: parseInt(process.env.MEMORY_EMBEDDING_DIMENSIONS, 10) || 1536,
    maxChunkSize: parseInt(process.env.MEMORY_MAX_CHUNK_SIZE, 10) || 8000,
  },
  
  // Indexing Configuration
  indexing: {
    maxChunkSize: parseInt(process.env.INDEXING_MAX_CHUNK_SIZE, 10) || 2000,
    ignoredDirs: (process.env.INDEXING_IGNORED_DIRS || 'node_modules,.git,dist,build,.cache').split(','),
    ignoredExtensions: (process.env.INDEXING_IGNORED_EXTENSIONS || '.log,.tmp,.cache,.map').split(','),
    maxFileSize: parseInt(process.env.INDEXING_MAX_FILE_SIZE, 10) || 10485760, // 10MB
  },
  
  // Workflow Configuration
  workflows: {
    maxExecutionTime: parseInt(process.env.WORKFLOW_MAX_EXECUTION_TIME, 10) || 3600000, // 1 hour
    stateCheckpointInterval: parseInt(process.env.WORKFLOW_CHECKPOINT_INTERVAL, 10) || 30000, // 30 seconds
    maxRetries: parseInt(process.env.WORKFLOW_MAX_RETRIES, 10) || 3,
    enablePersistence: process.env.WORKFLOW_ENABLE_PERSISTENCE === 'true',
  },
  
  // Agent Configuration
  agents: {
    codeAnalyzer: {
      temperature: parseFloat(process.env.CODE_ANALYZER_TEMPERATURE) || 0.1,
      maxTokens: parseInt(process.env.CODE_ANALYZER_MAX_TOKENS, 10) || 4096,
    },
    dbAnalyzer: {
      temperature: parseFloat(process.env.DB_ANALYZER_TEMPERATURE) || 0.1,
      maxTokens: parseInt(process.env.DB_ANALYZER_MAX_TOKENS, 10) || 4096,
    },
    knowledgeBuilder: {
      temperature: parseFloat(process.env.KNOWLEDGE_BUILDER_TEMPERATURE) || 0.2,
      maxTokens: parseInt(process.env.KNOWLEDGE_BUILDER_MAX_TOKENS, 10) || 4096,
    },
    documentationGenerator: {
      temperature: parseFloat(process.env.DOC_GENERATOR_TEMPERATURE) || 0.3,
      maxTokens: parseInt(process.env.DOC_GENERATOR_MAX_TOKENS, 10) || 4096,
    },
  },
  
  // Tool Configuration
  tools: {
    enableCaching: process.env.TOOLS_ENABLE_CACHING === 'true',
    cacheTimeout: parseInt(process.env.TOOLS_CACHE_TIMEOUT, 10) || 300000, // 5 minutes
    maxConcurrentExecutions: parseInt(process.env.TOOLS_MAX_CONCURRENT, 10) || 10,
  },
  
  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableFileLogging: process.env.ENABLE_FILE_LOGGING === 'true',
    logDirectory: process.env.LOG_DIRECTORY || './logs',
  },
  
  // MCP Configuration
  mcp: {
    serverName: process.env.MCP_SERVER_NAME || 'hybrid-mcp-server',
    serverVersion: process.env.MCP_SERVER_VERSION || '1.0.0',
    maxToolExecutionTime: parseInt(process.env.MCP_MAX_TOOL_EXECUTION_TIME, 10) || 300000, // 5 minutes
    enableToolChaining: process.env.MCP_ENABLE_TOOL_CHAINING === 'true',
  },
});
