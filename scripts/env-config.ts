/**
 * Environment configuration mapping
 * Defines which parameters and secrets each app/package needs
 */

export interface PackageConfig {
  parameters: string[];
  secrets?: string[];
  required?: string[];
  fallback: Record<string, string>;
}

export interface AppConfig {
  parameters: string[];
  secrets: string[];
  required: string[];
  fallback: Record<string, string>;
}

export const config: {
  parameterPrefix: string;
  secretPrefix: string;
  environments: string[];
  apps: Record<string, AppConfig>;
  packages: Record<string, PackageConfig>;
  infrastructure: Record<string, AppConfig>;
} = {
  // AWS Parameter Store prefix (e.g., /bedrock-agent-system)
  parameterPrefix: '/bedrock-agent-system',
  
  // AWS Secrets Manager prefix (e.g., bedrock-agent-system)
  secretPrefix: 'bedrock-agent-system',
  
  // Available environments
  environments: ['local', 'dev', 'staging', 'prod'],
  
  // Application configurations
  apps: {
    'mcp-hybrid-server': {
      parameters: [
        // AWS Configuration
        'AWS_REGION',
        'AWS_ACCOUNT_ID',
        
        // Application Configuration
        'PORT',
        'HOST',
        'API_PREFIX',
        'CORS_ORIGINS',
        
        // Database Configuration
        'DYNAMODB_TABLE_PREFIX',
        'DYNAMODB_REGION',
        
        // S3 Configuration
        'S3_BUCKET_NAME',
        'S3_REGION',
        
        // OpenSearch Configuration
        'OPENSEARCH_ENDPOINT',
        'OPENSEARCH_REGION',
        
        // Neptune Configuration
        'NEPTUNE_ENDPOINT',
        'NEPTUNE_PORT',
        'NEPTUNE_REGION',
        
        // Bedrock Configuration
        'BEDROCK_REGION',
        'BEDROCK_MODEL_ID',
        'BEDROCK_MAX_TOKENS',
        'BEDROCK_TEMPERATURE',
        
        // Logging Configuration
        'LOG_LEVEL',
        'LOG_FORMAT',
        
        // Feature Flags
        'ENABLE_MEMORY_MODULE',
        'ENABLE_INDEXING_MODULE',
        'ENABLE_KNOWLEDGE_GRAPH',
        
        // Performance Configuration
        'MAX_CONCURRENT_WORKFLOWS',
        'WORKFLOW_TIMEOUT_MS',
        'AGENT_TIMEOUT_MS',
      ],
      secrets: [
        'API_KEY',
        'JWT_SECRET',
        'ENCRYPTION_KEY',
        'OPENSEARCH_USERNAME',
        'OPENSEARCH_PASSWORD',
      ],
      required: [
        'AWS_REGION',
        'DYNAMODB_TABLE_PREFIX',
        'S3_BUCKET_NAME',
        'BEDROCK_REGION',
        'BEDROCK_MODEL_ID',
        'API_KEY',
        'JWT_SECRET',
      ],
      fallback: {
        // AWS Configuration
        AWS_REGION: 'us-east-1',
        AWS_ACCOUNT_ID: '123456789012',
        
        // Application Configuration
        PORT: '3000',
        HOST: '0.0.0.0',
        API_PREFIX: 'api',
        CORS_ORIGINS: '*',
        
        // Database Configuration
        DYNAMODB_TABLE_PREFIX: 'bedrock-agent-local',
        DYNAMODB_REGION: 'us-east-1',
        
        // S3 Configuration
        S3_BUCKET_NAME: 'bedrock-agent-local-bucket',
        S3_REGION: 'us-east-1',
        
        // OpenSearch Configuration
        OPENSEARCH_ENDPOINT: 'https://localhost:9200',
        OPENSEARCH_REGION: 'us-east-1',
        
        // Neptune Configuration
        NEPTUNE_ENDPOINT: 'localhost',
        NEPTUNE_PORT: '8182',
        NEPTUNE_REGION: 'us-east-1',
        
        // Bedrock Configuration
        BEDROCK_REGION: 'us-east-1',
        BEDROCK_MODEL_ID: 'anthropic.claude-v2',
        BEDROCK_MAX_TOKENS: '4096',
        BEDROCK_TEMPERATURE: '0.7',
        
        // Logging Configuration
        LOG_LEVEL: 'info',
        LOG_FORMAT: 'json',
        
        // Feature Flags
        ENABLE_MEMORY_MODULE: 'true',
        ENABLE_INDEXING_MODULE: 'true',
        ENABLE_KNOWLEDGE_GRAPH: 'true',
        
        // Performance Configuration
        MAX_CONCURRENT_WORKFLOWS: '10',
        WORKFLOW_TIMEOUT_MS: '300000',
        AGENT_TIMEOUT_MS: '60000',
        
        // Secrets (dummy values)
        API_KEY: 'dummy-api-key-local-development',
        JWT_SECRET: 'dummy-jwt-secret-local-development',
        ENCRYPTION_KEY: 'dummy-encryption-key-local-dev',
        OPENSEARCH_USERNAME: 'admin',
        OPENSEARCH_PASSWORD: 'admin',
      },
    },
    
    'mcp-dashboard': {
      parameters: [
        'NEXT_PUBLIC_API_URL',
        'NEXT_PUBLIC_WS_URL',
        'NEXT_PUBLIC_AUTH_ENABLED',
        'NEXT_PUBLIC_ANALYTICS_ID',
        'API_TIMEOUT',
        'REFRESH_INTERVAL',
      ],
      secrets: [
        'NEXTAUTH_SECRET',
        'NEXTAUTH_URL',
      ],
      required: [
        'NEXT_PUBLIC_API_URL',
      ],
      fallback: {
        NEXT_PUBLIC_API_URL: 'http://localhost:3000/api',
        NEXT_PUBLIC_WS_URL: 'ws://localhost:3000',
        NEXT_PUBLIC_AUTH_ENABLED: 'false',
        NEXT_PUBLIC_ANALYTICS_ID: 'dummy-analytics-id',
        API_TIMEOUT: '30000',
        REFRESH_INTERVAL: '5000',
        // Secrets (dummy values)
        NEXTAUTH_SECRET: 'dummy-nextauth-secret-local-dev',
        NEXTAUTH_URL: 'http://localhost:3001',
      },
    },
  },
  
  // Package configurations
  packages: {
    'mcp-cli': {
      parameters: [
        'MCP_SERVER_URL',
        'MCP_API_PREFIX',
        'CLI_CONFIG_PATH',
        'CLI_LOG_LEVEL',
        'DEFAULT_TIMEOUT',
      ],
      secrets: [
        'CLI_API_KEY',
      ],
      required: [
        'MCP_SERVER_URL',
      ],
      fallback: {
        MCP_SERVER_URL: 'http://localhost:3000',
        MCP_API_PREFIX: 'api',
        CLI_CONFIG_PATH: '~/.mcp/config.json',
        CLI_LOG_LEVEL: 'info',
        DEFAULT_TIMEOUT: '30000',
        // Secrets (dummy values)
        CLI_API_KEY: 'dummy-cli-api-key-local-dev',
      },
    },
    
    'shared-utils': {
      parameters: [
        'UTILS_LOG_LEVEL',
        'UTILS_DEBUG_MODE',
      ],
      fallback: {
        UTILS_LOG_LEVEL: 'info',
        UTILS_DEBUG_MODE: 'false',
      },
    },
  },
  
  // Infrastructure configuration (for CDK)
  infrastructure: {
    'mcp-hybrid-stack': {
      parameters: [
        'CDK_DEFAULT_ACCOUNT',
        'CDK_DEFAULT_REGION',
        'STACK_NAME_PREFIX',
        'VPC_ID',
        'SUBNET_IDS',
        'SECURITY_GROUP_IDS',
        'ECS_CLUSTER_NAME',
        'ALB_CERTIFICATE_ARN',
        'ROUTE53_ZONE_ID',
        'DOMAIN_NAME',
      ],
      secrets: [
        'GITHUB_TOKEN',
        'DOCKER_REGISTRY_CREDENTIALS',
      ],
      required: [
        'CDK_DEFAULT_ACCOUNT',
        'CDK_DEFAULT_REGION',
        'STACK_NAME_PREFIX',
      ],
      fallback: {
        CDK_DEFAULT_ACCOUNT: '123456789012',
        CDK_DEFAULT_REGION: 'us-east-1',
        STACK_NAME_PREFIX: 'bedrock-agent-system',
        VPC_ID: 'vpc-dummy12345',
        SUBNET_IDS: 'subnet-dummy1,subnet-dummy2',
        SECURITY_GROUP_IDS: 'sg-dummy12345',
        ECS_CLUSTER_NAME: 'bedrock-agent-cluster',
        ALB_CERTIFICATE_ARN: 'arn:aws:acm:us-east-1:123456789012:certificate/dummy',
        ROUTE53_ZONE_ID: 'Z1234567890ABC',
        DOMAIN_NAME: 'bedrock-agent.local',
        // Secrets (dummy values)
        GITHUB_TOKEN: 'dummy-github-token',
        DOCKER_REGISTRY_CREDENTIALS: '{"username":"dummy","password":"dummy"}',
      },
    },
  },
};