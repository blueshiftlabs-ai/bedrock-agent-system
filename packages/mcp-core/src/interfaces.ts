/**
 * Core MCP interfaces for the bedrock agent system
 */

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  execute: (params: any) => Promise<any>;
}

export interface MCPServerConfig {
  name: string;
  description: string;
  version: string;
  port?: number;
  host?: string;
}

export interface MCPServiceRegistry {
  registerTool(tool: MCPTool): void;
  getTool(name: string): MCPTool | undefined;
  listTools(): MCPTool[];
}

export interface MCPClientConfig {
  serverUrl: string;
  timeout?: number;
  retries?: number;
}

export interface MemoryMetadata {
  id: string;
  type: 'episodic' | 'semantic' | 'procedural' | 'working';
  agentId?: string;
  sessionId?: string;
  content: string;
  embeddings?: number[];
  tags?: string[];
  relationships?: string[];
  createdAt: Date;
  updatedAt: Date;
  ttl?: Date;
}

export interface MemoryQuery {
  query: string;
  type?: MemoryMetadata['type'];
  agentId?: string;
  sessionId?: string;
  tags?: string[];
  limit?: number;
  threshold?: number;
}

export interface AgentMemoryContext {
  agentId: string;
  sessionId?: string;
  workflowId?: string;
  memories: MemoryMetadata[];
}

export interface WorkflowState {
  workflowId: string;
  agentId: string;
  currentStep: string;
  state: Record<string, any>;
  memories: MemoryMetadata[];
  context: AgentMemoryContext;
}