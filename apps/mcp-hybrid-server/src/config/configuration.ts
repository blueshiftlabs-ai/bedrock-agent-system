import { ParameterStoreLoader } from './loaders/parameter-store.loader';
import { SecretsManagerLoader } from './loaders/secrets-manager.loader';

export const configuration = async () => {
  // Initialize loaders if running in AWS
  let parameterStoreConfig = {};
  let secretsConfig = {};

  if (process.env.AWS_REGION && process.env.PARAMETER_STORE_PREFIX) {
    try {
      const parameterLoader = new ParameterStoreLoader();
      const secretsLoader = new SecretsManagerLoader();

      // Load parameters and secrets in parallel
      const [parameters, secrets] = await Promise.all([
        parameterLoader.loadParameters(),
        secretsLoader.loadSecrets(),
      ]);

      parameterStoreConfig = parameters;
      secretsConfig = secrets;
    } catch (error) {
      console.warn('Failed to load from Parameter Store/Secrets Manager:', error);
    }
  }

  // Merge configurations with environment variables taking precedence
  const getConfig = (envKey: string, paramKey?: string, defaultValue?: any) => {
    return process.env[envKey] || parameterStoreConfig[paramKey || envKey] || defaultValue;
  };

  const getSecret = (key: string, defaultValue?: any) => {
    return secretsConfig[key] || defaultValue;
  };

  return {
    // Server Configuration
    port: parseInt(getConfig('PORT', 'PORT', '3000'), 10),
    host: getConfig('HOST', 'HOST', '0.0.0.0'),
    nodeEnv: getConfig('NODE_ENV', 'NODE_ENV', 'development'),
    
    // AWS Configuration
    aws: {
      region: getConfig('AWS_REGION', 'AWS_REGION', 'us-east-1'),
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      
      // S3 Configuration
      s3: {
        bucketName: getConfig('AWS_S3_BUCKET', 'S3_DATA_BUCKET_NAME', 'mcp-hybrid-server-data'),
        logsBucketName: getConfig('AWS_LOGS_BUCKET', 'S3_LOGS_BUCKET_NAME'),
        region: getConfig('AWS_S3_REGION', 'AWS_REGION'),
      },
      
      // OpenSearch Configuration
      opensearch: {
        endpoint: getConfig('AWS_OPENSEARCH_ENDPOINT', 'OPENSEARCH_COLLECTION_ENDPOINT'),
        region: getConfig('AWS_OPENSEARCH_REGION', 'AWS_REGION'),
        indexPrefix: getConfig('OPENSEARCH_INDEX_PREFIX', 'OPENSEARCH_INDEX_PREFIX', 'mcp'),
      },
      
      // Neptune Configuration
      neptune: {
        endpoint: getConfig('AWS_NEPTUNE_ENDPOINT', 'NEPTUNE_CLUSTER_ENDPOINT'),
        region: getConfig('AWS_NEPTUNE_REGION', 'AWS_REGION'),
        port: parseInt(getConfig('AWS_NEPTUNE_PORT', 'NEPTUNE_CLUSTER_PORT', '8182'), 10),
      },
      
      // DynamoDB Configuration
      dynamodb: {
        region: getConfig('AWS_DYNAMODB_REGION', 'AWS_REGION'),
        metadataTable: getConfig('DYNAMODB_METADATA_TABLE', 'DYNAMODB_METADATA_TABLE_NAME', 'MCPMetadata'),
        workflowStateTable: getConfig('DYNAMODB_WORKFLOW_STATE_TABLE', 'DYNAMODB_WORKFLOW_STATE_TABLE_NAME', 'MCPWorkflowState'),
      },
      
      // Bedrock Configuration
      bedrock: {
        region: getConfig('AWS_BEDROCK_REGION', 'AWS_REGION'),
        modelId: getConfig('AWS_BEDROCK_MODEL_ID', 'BEDROCK_MODEL_ID', 'anthropic.claude-3-sonnet-20240229-v1:0'),
        embeddingModelId: getConfig('AWS_BEDROCK_EMBEDDING_MODEL_ID', 'BEDROCK_EMBEDDING_MODEL_ID', 'amazon.titan-embed-text-v1'),
        maxTokens: parseInt(getConfig('BEDROCK_MAX_TOKENS', 'BEDROCK_MAX_TOKENS', '4096'), 10),
        temperature: parseFloat(getConfig('BEDROCK_TEMPERATURE', 'BEDROCK_TEMPERATURE', '0.7')),
      },
      
      // API Keys from Secrets Manager
      apiKeys: {
        openai: getSecret('API_KEYS_OPENAI'),
        anthropic: getSecret('API_KEYS_ANTHROPIC'),
        internal: getSecret('API_KEYS_INTERNAL'),
      },
      
      // Database credentials from Secrets Manager
      database: {
        username: getSecret('DATABASE_CREDENTIALS_USERNAME'),
        password: getSecret('DATABASE_CREDENTIALS_PASSWORD'),
      },
    },
    
    // Memory Configuration
    memory: {
      defaultMaxResults: parseInt(getConfig('MEMORY_DEFAULT_MAX_RESULTS', 'MEMORY_DEFAULT_MAX_RESULTS', '10'), 10),
      defaultRecencyWeight: parseFloat(getConfig('MEMORY_DEFAULT_RECENCY_WEIGHT', 'MEMORY_DEFAULT_RECENCY_WEIGHT', '0.3')),
      defaultRelevanceThreshold: parseFloat(getConfig('MEMORY_DEFAULT_RELEVANCE_THRESHOLD', 'MEMORY_DEFAULT_RELEVANCE_THRESHOLD', '0.6')),
      embeddingDimensions: parseInt(getConfig('MEMORY_EMBEDDING_DIMENSIONS', 'MEMORY_EMBEDDING_DIMENSIONS', '1536'), 10),
      maxChunkSize: parseInt(getConfig('MEMORY_MAX_CHUNK_SIZE', 'MEMORY_MAX_CHUNK_SIZE', '8000'), 10),
    },
    
    // Indexing Configuration
    indexing: {
      maxChunkSize: parseInt(getConfig('INDEXING_MAX_CHUNK_SIZE', 'INDEXING_MAX_CHUNK_SIZE', '2000'), 10),
      ignoredDirs: (getConfig('INDEXING_IGNORED_DIRS', 'INDEXING_IGNORED_DIRS', 'node_modules,.git,dist,build,.cache')).split(','),
      ignoredExtensions: (getConfig('INDEXING_IGNORED_EXTENSIONS', 'INDEXING_IGNORED_EXTENSIONS', '.log,.tmp,.cache,.map')).split(','),
      maxFileSize: parseInt(getConfig('INDEXING_MAX_FILE_SIZE', 'INDEXING_MAX_FILE_SIZE', '10485760'), 10), // 10MB
    },
    
    // Workflow Configuration
    workflows: {
      maxExecutionTime: parseInt(getConfig('WORKFLOW_MAX_EXECUTION_TIME', 'WORKFLOW_MAX_EXECUTION_TIME', '3600000'), 10), // 1 hour
      stateCheckpointInterval: parseInt(getConfig('WORKFLOW_CHECKPOINT_INTERVAL', 'WORKFLOW_CHECKPOINT_INTERVAL', '30000'), 10), // 30 seconds
      maxRetries: parseInt(getConfig('WORKFLOW_MAX_RETRIES', 'WORKFLOW_MAX_RETRIES', '3'), 10),
      enablePersistence: getConfig('WORKFLOW_ENABLE_PERSISTENCE', 'WORKFLOW_ENABLE_PERSISTENCE', 'true') === 'true',
    },
    
    // Agent Configuration
    agents: {
      codeAnalyzer: {
        temperature: parseFloat(getConfig('CODE_ANALYZER_TEMPERATURE', 'CODE_ANALYZER_TEMPERATURE', '0.1')),
        maxTokens: parseInt(getConfig('CODE_ANALYZER_MAX_TOKENS', 'CODE_ANALYZER_MAX_TOKENS', '4096'), 10),
      },
      dbAnalyzer: {
        temperature: parseFloat(getConfig('DB_ANALYZER_TEMPERATURE', 'DB_ANALYZER_TEMPERATURE', '0.1')),
        maxTokens: parseInt(getConfig('DB_ANALYZER_MAX_TOKENS', 'DB_ANALYZER_MAX_TOKENS', '4096'), 10),
      },
      knowledgeBuilder: {
        temperature: parseFloat(getConfig('KNOWLEDGE_BUILDER_TEMPERATURE', 'KNOWLEDGE_BUILDER_TEMPERATURE', '0.2')),
        maxTokens: parseInt(getConfig('KNOWLEDGE_BUILDER_MAX_TOKENS', 'KNOWLEDGE_BUILDER_MAX_TOKENS', '4096'), 10),
      },
      documentationGenerator: {
        temperature: parseFloat(getConfig('DOC_GENERATOR_TEMPERATURE', 'DOC_GENERATOR_TEMPERATURE', '0.3')),
        maxTokens: parseInt(getConfig('DOC_GENERATOR_MAX_TOKENS', 'DOC_GENERATOR_MAX_TOKENS', '4096'), 10),
      },
    },
    
    // Tool Configuration
    tools: {
      enableCaching: getConfig('TOOLS_ENABLE_CACHING', 'TOOLS_ENABLE_CACHING', 'true') === 'true',
      cacheTimeout: parseInt(getConfig('TOOLS_CACHE_TIMEOUT', 'TOOLS_CACHE_TIMEOUT', '300000'), 10), // 5 minutes
      maxConcurrentExecutions: parseInt(getConfig('TOOLS_MAX_CONCURRENT', 'TOOLS_MAX_CONCURRENT', '10'), 10),
    },
    
    // Logging Configuration
    logging: {
      level: getConfig('LOG_LEVEL', 'LOG_LEVEL', 'info'),
      enableFileLogging: getConfig('ENABLE_FILE_LOGGING', 'ENABLE_FILE_LOGGING', 'true') === 'true',
      logDirectory: getConfig('LOG_DIRECTORY', 'LOG_DIRECTORY', './logs'),
    },
    
    // MCP Configuration
    mcp: {
      // Server Configuration
      server: {
        name: getConfig('MCP_SERVER_NAME', 'MCP_SERVER_NAME', 'hybrid-mcp-server'),
        version: getConfig('MCP_SERVER_VERSION', 'MCP_SERVER_VERSION', '1.0.0'),
        description: getConfig('MCP_SERVER_DESCRIPTION', 'MCP_SERVER_DESCRIPTION', 'Advanced MCP server with NestJS and LangGraph integration'),
        enabled: getConfig('MCP_SERVER_ENABLED', 'MCP_SERVER_ENABLED', 'true') !== 'false',
        endpoint: getConfig('MCP_SERVER_ENDPOINT', 'MCP_SERVER_ENDPOINT', '/mcp'),
        transport: {
          type: getConfig('MCP_SERVER_TRANSPORT_TYPE', 'MCP_SERVER_TRANSPORT_TYPE', 'http+sse'),
          enableCors: getConfig('MCP_SERVER_ENABLE_CORS', 'MCP_SERVER_ENABLE_CORS', 'true') !== 'false',
          maxConnections: parseInt(getConfig('MCP_SERVER_MAX_CONNECTIONS', 'MCP_SERVER_MAX_CONNECTIONS', '100'), 10),
          connectionTimeout: parseInt(getConfig('MCP_SERVER_CONNECTION_TIMEOUT', 'MCP_SERVER_CONNECTION_TIMEOUT', '30000'), 10), // 30 seconds
        },
        tools: {
          maxExecutionTime: parseInt(getConfig('MCP_MAX_TOOL_EXECUTION_TIME', 'MCP_MAX_TOOL_EXECUTION_TIME', '300000'), 10), // 5 minutes
          enableChaining: getConfig('MCP_ENABLE_TOOL_CHAINING', 'MCP_ENABLE_TOOL_CHAINING', 'true') === 'true',
          enableCaching: getConfig('MCP_TOOLS_ENABLE_CACHING', 'MCP_TOOLS_ENABLE_CACHING', 'true') !== 'false',
          cacheTimeout: parseInt(getConfig('MCP_TOOLS_CACHE_TIMEOUT', 'MCP_TOOLS_CACHE_TIMEOUT', '300000'), 10), // 5 minutes
        },
      },
      
      // Client Configuration
      client: {
        enabled: getConfig('MCP_CLIENT_ENABLED', 'MCP_CLIENT_ENABLED', 'false') === 'true',
        configPath: getConfig('MCP_CLIENT_CONFIG_PATH', 'MCP_CLIENT_CONFIG_PATH', '.mcp/servers.json'),
        autoConnect: getConfig('MCP_CLIENT_AUTO_CONNECT', 'MCP_CLIENT_AUTO_CONNECT', 'false') === 'true',
        connectionRetries: parseInt(getConfig('MCP_CLIENT_CONNECTION_RETRIES', 'MCP_CLIENT_CONNECTION_RETRIES', '3'), 10),
        connectionRetryDelay: parseInt(getConfig('MCP_CLIENT_RETRY_DELAY', 'MCP_CLIENT_RETRY_DELAY', '5000'), 10), // 5 seconds
        healthCheckInterval: parseInt(getConfig('MCP_CLIENT_HEALTH_CHECK_INTERVAL', 'MCP_CLIENT_HEALTH_CHECK_INTERVAL', '60000'), 10), // 1 minute
        requestTimeout: parseInt(getConfig('MCP_CLIENT_REQUEST_TIMEOUT', 'MCP_CLIENT_REQUEST_TIMEOUT', '30000'), 10), // 30 seconds
        discovery: {
          enabled: getConfig('MCP_CLIENT_DISCOVERY_ENABLED', 'MCP_CLIENT_DISCOVERY_ENABLED', 'false') === 'true',
          scanInterval: parseInt(getConfig('MCP_CLIENT_DISCOVERY_SCAN_INTERVAL', 'MCP_CLIENT_DISCOVERY_SCAN_INTERVAL', '300000'), 10), // 5 minutes
          knownServers: (getConfig('MCP_CLIENT_KNOWN_SERVERS', 'MCP_CLIENT_KNOWN_SERVERS', '')).split(',').filter(Boolean),
        },
      },
      
      // Global MCP Configuration
      protocolVersion: getConfig('MCP_PROTOCOL_VERSION', 'MCP_PROTOCOL_VERSION', '2024-11-05'),
      enableMetrics: getConfig('MCP_ENABLE_METRICS', 'MCP_ENABLE_METRICS', 'true') !== 'false',
      enableLogging: getConfig('MCP_ENABLE_LOGGING', 'MCP_ENABLE_LOGGING', 'true') !== 'false',
      logLevel: getConfig('MCP_LOG_LEVEL', 'MCP_LOG_LEVEL', 'info'),
    },
    
    // Parameter Store Configuration
    parameterStore: {
      prefix: getConfig('PARAMETER_STORE_PREFIX', 'PARAMETER_STORE_PREFIX', `/mcp-hybrid/${process.env.STAGE || 'dev'}`),
      cacheEnabled: getConfig('PARAMETER_STORE_CACHE_ENABLED', 'PARAMETER_STORE_CACHE_ENABLED', 'true') === 'true',
      cacheTTL: parseInt(getConfig('PARAMETER_STORE_CACHE_TTL', 'PARAMETER_STORE_CACHE_TTL', '300000'), 10), // 5 minutes
    },
  };
};