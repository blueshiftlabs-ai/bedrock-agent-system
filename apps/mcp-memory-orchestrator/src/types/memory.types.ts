export interface MemoryMetadata {
  id: string;
  content: string;
  content_hash?: string;
  type: 'episodic' | 'semantic' | 'procedural' | 'working';
  content_type?: 'text' | 'code';
  agent_id?: string;
  session_id?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  expires_at?: string;
}

export interface StoreMemoryParams {
  content: string;
  type: 'episodic' | 'semantic' | 'procedural' | 'working';
  content_type?: 'text' | 'code';
  agent_id?: string;
  session_id?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  ttl_hours?: number; // For working memory
}

export interface RetrieveMemoryParams {
  query?: string;
  memory_ids?: string[];
  type?: 'episodic' | 'semantic' | 'procedural' | 'working';
  agent_id?: string;
  session_id?: string;
  tags?: string[];
  limit?: number;
  threshold?: number;
  include_relationships?: boolean;
  include_graph_context?: boolean;
}

export interface MemoryConnection {
  id: string;
  from_memory_id: string;
  to_memory_id: string;
  relationship_type: string;
  relationship_properties?: Record<string, any>;
  bidirectional: boolean;
  created_at: string;
}

export interface CreateConnectionParams {
  from_memory_id: string;
  to_memory_id: string;
  relationship_type: string;
  relationship_properties?: Record<string, any>;
  bidirectional?: boolean;
}

export interface MemoryStatistics {
  total_memories: number;
  episodic_memories: number;
  semantic_memories: number;
  procedural_memories: number;
  working_memories: number;
  unique_sessions: number;
  total_content_size: number;
  earliest_memory: string;
  latest_memory: string;
}

export interface MCPServerConfig {
  name: string;
  endpoint: string;
  capabilities: string[];
  health_endpoint?: string;
  timeout?: number;
}

export interface MCPClientResponse<T = any> {
  jsonrpc: string;
  id: string | number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface ComprehensiveMemoryResult {
  memory_id: string;
  success: boolean;
  vector_result?: any;
  metadata_result?: any;
  graph_result?: any;
  connections?: MemoryConnection[];
  errors?: string[];
}