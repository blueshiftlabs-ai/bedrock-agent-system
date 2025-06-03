// MCP Protocol Types
// Based on the Model Context Protocol specification

export interface MCPServerInfo {
  name: string;
  version: string;
  protocolVersion: string;
  capabilities?: MCPServerCapabilities;
}

export interface MCPServerCapabilities {
  tools?: boolean;
  prompts?: boolean;
  resources?: boolean;
  logging?: boolean;
  sampling?: boolean;
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export interface MCPPromptDefinition {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

export interface MCPResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

export interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

// MCP Method Names
export enum MCPMethod {
  // Lifecycle
  INITIALIZE = 'initialize',
  SHUTDOWN = 'shutdown',

  // Tools
  TOOLS_LIST = 'tools/list',
  TOOLS_CALL = 'tools/call',

  // Prompts
  PROMPTS_LIST = 'prompts/list',
  PROMPTS_GET = 'prompts/get',

  // Resources
  RESOURCES_LIST = 'resources/list',
  RESOURCES_READ = 'resources/read',
  RESOURCES_SUBSCRIBE = 'resources/subscribe',
  RESOURCES_UNSUBSCRIBE = 'resources/unsubscribe',

  // Logging
  LOGGING_SET_LEVEL = 'logging/setLevel',

  // Sampling
  SAMPLING_CREATE_MESSAGE = 'sampling/createMessage',

  // Completion
  COMPLETION_COMPLETE = 'completion/complete',
}

// Transport Types
export interface MCPTransport {
  send(message: MCPRequest | MCPNotification): Promise<void>;
  onMessage(handler: (message: MCPResponse | MCPNotification) => void): void;
  onError(handler: (error: Error) => void): void;
  onClose(handler: () => void): void;
  close(): Promise<void>;
}

export interface MCPConnection {
  id: string;
  name: string;
  serverInfo?: MCPServerInfo;
  transport: MCPTransport;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastError?: string;
  createdAt: Date;
  lastPingAt?: Date;
}

export interface MCPServerConfig {
  id: string;
  name: string;
  transport: 'stdio' | 'http' | 'websocket';
  command?: string; // For stdio transport
  args?: string[]; // For stdio transport
  env?: Record<string, string>; // Environment variables
  url?: string; // For HTTP/WebSocket transport
  headers?: Record<string, string>; // For HTTP transport
  enabled: boolean;
  autoConnect: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

export interface ExternalToolMetadata {
  sourceServer: string;
  sourceServerId: string;
  originalName: string;
  isExternal: true;
  lastUpdated: Date;
}