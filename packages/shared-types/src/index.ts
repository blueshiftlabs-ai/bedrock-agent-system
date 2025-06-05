/**
 * Shared types for the bedrock agent system
 * Common interfaces and types used across all applications and packages
 */

// Agent types
export interface Agent {
  id: string;
  name: string;
  type: 'analyzer' | 'executor' | 'planner' | 'reviewer' | 'custom';
  status: 'active' | 'inactive' | 'busy' | 'error';
  capabilities: string[];
  metadata?: Record<string, any>;
}

export interface AgentContext {
  agent: Agent;
  session_id?: string;
  workflow_id?: string;
  memory_context?: MemoryContext;
}

// Memory types (shared across systems)
export interface MemoryContext {
  recent_memories: string[];
  working_memory: Record<string, any>;
  session_summary?: string;
  preferences?: Record<string, any>;
}

// Workflow types
export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  metadata?: Record<string, any>;
}

export interface WorkflowNode {
  id: string;
  type: 'agent' | 'tool' | 'decision' | 'parallel' | 'sequential';
  name: string;
  config: Record<string, any>;
  position?: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition?: string;
  metadata?: Record<string, any>;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: Date;
  completed_at?: Date;
  current_node?: string;
  context: Record<string, any>;
  results?: Record<string, any>;
  error?: string;
}

// Tool types
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameters;
  required?: string[];
}

export interface ToolParameters {
  type: 'object';
  properties: Record<string, ToolParameter>;
}

export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  default?: any;
}

export interface ToolExecution {
  tool_name: string;
  parameters: Record<string, any>;
  agent_id?: string;
  session_id?: string;
  timestamp: Date;
}

export interface ToolResult {
  success: boolean;
  result?: any;
  error?: string;
  metadata?: Record<string, any>;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: string;
    request_id?: string;
    duration_ms?: number;
  };
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    has_more: boolean;
  };
}

// Session types
export interface Session {
  id: string;
  agent_id: string;
  started_at: Date;
  last_activity: Date;
  status: 'active' | 'inactive' | 'expired';
  context: Record<string, any>;
  memory_ids: string[];
}

// Configuration types
export interface ServiceConfig {
  name: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  port?: number;
  health_check_interval?: number;
}

export interface DatabaseConfig {
  type: 'dynamodb' | 'opensearch' | 'neptune' | 'postgresql';
  endpoint: string;
  region?: string;
  credentials?: {
    access_key?: string;
    secret_key?: string;
  };
}

// Error types
export interface SystemError {
  code: string;
  message: string;
  service: string;
  timestamp: Date;
  context?: Record<string, any>;
  stack_trace?: string;
}

// Monitoring types
export interface HealthStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: Record<string, boolean>;
  dependencies?: Record<string, boolean>;
  metadata?: Record<string, any>;
}

export interface Metrics {
  service: string;
  timestamp: Date;
  metrics: Record<string, number>;
  tags?: Record<string, string>;
}

// Event types
export interface SystemEvent {
  id: string;
  type: string;
  source: string;
  timestamp: Date;
  data: Record<string, any>;
  correlation_id?: string;
}

// MCP specific types
export interface MCPServerInfo {
  name: string;
  version: string;
  description: string;
  capabilities: string[];
  tools: ToolDefinition[];
}

export interface MCPRequest {
  method: string;
  params?: Record<string, any>;
  id?: string;
}

export interface MCPResponse {
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id?: string;
}

// Common utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Export all types as a namespace for easier imports
export namespace BAS {
  export type Agent = Agent;
  export type AgentContext = AgentContext;
  export type MemoryContext = MemoryContext;
  export type WorkflowDefinition = WorkflowDefinition;
  export type WorkflowExecution = WorkflowExecution;
  export type ToolDefinition = ToolDefinition;
  export type ToolResult = ToolResult;
  export type ApiResponse<T> = ApiResponse<T>;
  export type Session = Session;
  export type HealthStatus = HealthStatus;
  export type SystemEvent = SystemEvent;
  export type MCPServerInfo = MCPServerInfo;
}