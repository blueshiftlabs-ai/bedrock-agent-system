/**
 * Sophisticated memory types for the MCP Memory Server
 * Supports text, code, and knowledge graph storage
 */

export type MemoryType = 'episodic' | 'semantic' | 'procedural' | 'working';
export type ContentType = 'text' | 'code';

export interface BaseMemoryMetadata {
  memory_id: string;
  type: MemoryType;
  content_type: ContentType;
  agent_id?: string;
  session_id?: string;
  created_at: Date;
  updated_at: Date;
  ttl?: Date; // For working memory
  tags?: string[];
  confidence?: number; // 0-1 confidence in the memory
  access_count: number;
  last_accessed: Date;
}

export interface TextMemoryMetadata extends BaseMemoryMetadata {
  content_type: 'text';
  language?: string;
  topics?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  entities?: string[];
  semantic_chunks?: string[]; // For long content
}

export interface CodeMemoryMetadata extends BaseMemoryMetadata {
  content_type: 'code';
  programming_language?: string;
  functions?: string[];
  imports?: string[];
  patterns?: string[];
  complexity?: 'low' | 'medium' | 'high';
  dependencies?: string[];
  syntax_tree?: any; // AST representation
}

export type MemoryMetadata = TextMemoryMetadata | CodeMemoryMetadata;

export interface StoredMemory {
  metadata: MemoryMetadata;
  content: string;
  embeddings?: number[];
  opensearch_id?: string;
  neptune_node_id?: string;
}

export interface MemoryQuery {
  query: string;
  type?: MemoryType;
  content_type?: ContentType;
  agent_id?: string;
  session_id?: string;
  tags?: string[];
  limit?: number;
  threshold?: number; // Similarity threshold 0-1
  include_related?: boolean; // Include graph-connected memories
}

export interface MemorySearchResult {
  memory: StoredMemory;
  similarity_score: number;
  related_memories?: StoredMemory[];
  graph_connections?: GraphConnection[];
}

export interface GraphConnection {
  from_memory_id: string;
  to_memory_id: string;
  relationship_type: string;
  properties?: Record<string, any>;
  confidence?: number;
}

export interface ConceptNode {
  concept_id: string;
  name: string;
  category?: string;
  confidence: number;
  related_memories: string[];
}

export interface AgentProfile {
  agent_id: string;
  preferences: Record<string, any>;
  learned_patterns: string[];
  memory_statistics: {
    total_memories: number;
    by_type: Record<MemoryType, number>;
    by_content_type: Record<ContentType, number>;
    average_retrieval_time: number;
  };
}

export interface SessionContext {
  session_id: string;
  agent_id: string;
  started_at: Date;
  last_activity: Date;
  memory_count: number;
  context_window_size?: number;
  recent_memory_ids: string[]; // In chronological order
  context_metadata?: Record<string, any>;
  active?: boolean;
}

// MCP Tool Request/Response types
export interface StoreMemoryRequest {
  content: string;
  type?: MemoryType;
  content_type?: ContentType;
  agent_id?: string;
  session_id?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface StoreMemoryResponse {
  memory_id: string;
  opensearch_id?: string;
  neptune_node_id?: string;
  success: boolean;
}

export interface RetrieveMemoriesRequest {
  memory_ids?: string[];
  query?: MemoryQuery;
}

export interface RetrieveMemoriesResponse {
  memories: MemorySearchResult[];
  total_count: number;
  search_time_ms: number;
}

export interface AddConnectionRequest {
  from_memory_id: string;
  to_memory_id: string;
  relationship_type: string;
  properties?: Record<string, any>;
  bidirectional?: boolean;
}

export interface AddConnectionResponse {
  connection_id: string;
  success: boolean;
}

export interface CreateObservationRequest {
  agent_id: string;
  observation: string;
  context?: Record<string, any>;
  related_memory_ids?: string[];
}

export interface CreateObservationResponse {
  observation_id: string;
  memory_id: string;
  connections_created: number;
  success: boolean;
}

export interface ConsolidateMemoriesRequest {
  agent_id?: string;
  similarity_threshold?: number;
  max_consolidations?: number;
}

export interface ConsolidateMemoriesResponse {
  consolidations_performed: number;
  memories_merged: number;
  connections_updated: number;
  success: boolean;
}

// Storage layer interfaces
export interface OpenSearchDocument {
  memory_id: string;
  content: string;
  embeddings: number[];
  content_type: ContentType;
  type: MemoryType;
  agent_id?: string;
  session_id?: string;
  tags?: string[];
  created_at: string;
  
  // Text-specific fields
  language?: string;
  topics?: string[];
  sentiment?: string;
  entities?: string[];
  
  // Code-specific fields
  programming_language?: string;
  functions?: string[];
  imports?: string[];
  patterns?: string[];
  complexity?: string;
}

export interface DynamoDBMemoryItem {
  PK: string; // "MEMORY#${memory_id}"
  SK: string; // "METADATA"
  memory_id: string;
  type: MemoryType;
  content_type: ContentType;
  agent_id?: string;
  session_id?: string;
  created_at: number;
  updated_at: number;
  ttl?: number;
  opensearch_index: string;
  opensearch_id: string;
  neptune_node_id?: string;
  access_count: number;
  last_accessed: number;
  tags?: string[];
  confidence?: number;
}

export interface EmbeddingRequest {
  text: string;
  content_type: ContentType;
  programming_language?: string;
}

export interface EmbeddingResponse {
  embeddings: number[];
  model_used: string;
  token_count: number;
}