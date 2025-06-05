/**
 * AWS-specific interfaces for the bedrock agent system
 */

export interface AWSConfig {
  region: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
}

export interface S3Config extends AWSConfig {
  defaultBucket?: string;
}

export interface DynamoDBConfig extends AWSConfig {
  defaultTablePrefix?: string;
}

export interface BedrockConfig extends AWSConfig {
  defaultModel?: string;
  defaultEmbeddingModel?: string;
}

export interface OpenSearchConfig extends AWSConfig {
  endpoint: string;
  defaultIndex?: string;
}

export interface MemoryStoreConfig {
  s3: S3Config;
  dynamodb: DynamoDBConfig;
  opensearch?: OpenSearchConfig;
}

export interface EmbeddingRequest {
  text: string;
  model?: string;
}

export interface EmbeddingResponse {
  embeddings: number[];
  model: string;
  usage: {
    inputTokens: number;
  };
}

export interface ChatRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResponse {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}