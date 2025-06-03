export interface InteractionRequest {
  id: string;
  processId: string;
  type: 'start_process' | 'control_process' | 'query_status' | 'get_logs' | 'interact_agent';
  payload: any;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
}

export interface InteractionResponse {
  id: string;
  requestId: string;
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: Date;
}

export interface WebSocketMessage {
  type: 'process_update' | 'log_stream' | 'resource_update' | 'agent_interaction' | 'system_notification';
  processId?: string;
  data: any;
  timestamp: Date;
  sessionId?: string;
}

export interface ClientConfig {
  refreshInterval: number;
  maxLogEntries: number;
  enableRealTimeUpdates: boolean;
  resourceMonitoringInterval: number;
  defaultFilters: {
    status: string[];
    type: string[];
    priority: string[];
  };
  displayPreferences: {
    theme: 'light' | 'dark' | 'auto';
    compactView: boolean;
    maxDisplayItems: number;
  };
}

export interface UserSession {
  id: string;
  userId?: string;
  socketId: string;
  connectedAt: Date;
  lastActivity: Date;
  subscribedProcesses: string[];
  clientConfig: ClientConfig;
  permissions: string[];
}

export interface ProcessControlRequest {
  action: 'start' | 'stop' | 'pause' | 'resume' | 'cancel' | 'restart';
  processId: string;
  parameters?: Record<string, any>;
  force?: boolean;
}

export interface ProcessStartRequest {
  name: string;
  type: string;
  priority?: string;
  configuration?: Record<string, any>;
  input: any;
  tags?: string[];
  parentProcessId?: string;
  description?: string;
}

export interface LogStreamRequest {
  processId: string;
  level?: string;
  since?: Date;
  tail?: number;
  follow?: boolean;
}

export interface ResourceMonitoringRequest {
  processId?: string;
  interval?: number;
  duration?: number;
}

export interface AgentDebugSession {
  id: string;
  processId: string;
  agentName: string;
  userId?: string;
  startedAt: Date;
  isActive: boolean;
  breakpoints: Array<{
    id: string;
    location: string;
    condition?: string;
    isEnabled: boolean;
  }>;
  stepMode: 'none' | 'step_over' | 'step_into' | 'step_out';
  currentState: {
    variables: Record<string, any>;
    callStack: string[];
    currentLocation: string;
  };
}

export interface DebugCommand {
  type: 'set_breakpoint' | 'remove_breakpoint' | 'step_over' | 'step_into' | 'step_out' | 'continue' | 'pause' | 'evaluate';
  sessionId: string;
  parameters?: Record<string, any>;
}

export interface ProcessTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  version: string;
  author: string;
  tags: string[];
  configurationSchema: any; // JSON Schema
  inputSchema: any; // JSON Schema
  defaultConfiguration: Record<string, any>;
  examples: Array<{
    name: string;
    description: string;
    input: any;
    configuration: any;
  }>;
  documentation: {
    overview: string;
    parameters: Array<{
      name: string;
      type: string;
      required: boolean;
      description: string;
      default?: any;
    }>;
    examples: string;
    troubleshooting: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface QueueConfiguration {
  id: string;
  name: string;
  maxConcurrent: number;
  priority: number;
  retryPolicy: {
    maxRetries: number;
    backoffStrategy: 'fixed' | 'exponential' | 'linear';
    baseDelay: number;
    maxDelay: number;
  };
  resourceLimits: {
    maxCpu: number;
    maxMemory: number;
    maxDisk: number;
  };
  scheduling: {
    strategy: 'fifo' | 'priority' | 'round_robin' | 'load_balanced';
    affinityRules?: Array<{
      type: 'node' | 'zone' | 'attribute';
      key: string;
      values: string[];
      required: boolean;
    }>;
  };
}