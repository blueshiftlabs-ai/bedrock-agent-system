export interface ServerStatus {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'error' | 'unknown';
  pid?: number;
  port?: number;
  url?: string;
  uptime?: number;
  memory?: number;
  cpu?: number;
  lastChecked: Date;
  health?: HealthStatus;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'warning' | 'unknown';
  checks: HealthCheck[];
  lastCheck: Date;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration?: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  status: 'running' | 'stopped' | 'zombie' | 'sleeping';
  cpu: number;
  memory: number;
  uptime: number;
  command: string;
  arguments: string[];
}

export interface AgentInfo {
  id: string;
  name: string;
  type: 'code-analyzer' | 'db-analyzer' | 'knowledge-builder' | 'documentation-generator';
  status: 'active' | 'inactive' | 'error';
  description: string;
  capabilities: string[];
  lastExecution?: Date;
  executionCount: number;
  averageExecutionTime?: number;
}

export interface WorkflowInfo {
  id: string;
  name: string;
  type: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'paused';
  description: string;
  steps: WorkflowStep[];
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  progress?: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  output?: any;
  error?: string;
}

export interface ToolInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  schema: any;
  source: 'internal' | 'external';
  serverId?: string;
  available: boolean;
  usage: {
    count: number;
    lastUsed?: Date;
    averageExecutionTime?: number;
  };
}

export interface ConnectionInfo {
  id: string;
  name: string;
  type: 'mcp-server' | 'database' | 'api' | 'websocket';
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  url: string;
  protocol?: string;
  lastConnected?: Date;
  connectionCount: number;
  errorCount: number;
  latency?: number;
}

export interface LogEntry {
  timestamp: Date;
  level: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
  message: string;
  context?: string;
  component?: string;
  metadata?: any;
}

export interface ConfigValue {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  required: boolean;
  sensitive: boolean;
}

export interface MonitoringMetrics {
  server: {
    uptime: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
      cores: number;
    };
    requests: {
      total: number;
      perMinute: number;
      averageResponseTime: number;
    };
  };
  agents: {
    total: number;
    active: number;
    executionsPerMinute: number;
    averageExecutionTime: number;
  };
  workflows: {
    total: number;
    running: number;
    completed: number;
    failed: number;
  };
  tools: {
    total: number;
    available: number;
    external: number;
    executionsPerMinute: number;
  };
  connections: {
    total: number;
    active: number;
    errors: number;
    averageLatency: number;
  };
}

export interface CLIConfig {
  server: {
    url: string;
    timeout: number;
    retries: number;
  };
  display: {
    colors: boolean;
    animations: boolean;
    verbose: boolean;
    format: 'table' | 'json' | 'yaml';
  };
  monitoring: {
    refreshInterval: number;
    maxLogLines: number;
    alertThresholds: {
      cpu: number;
      memory: number;
      errorRate: number;
    };
  };
  paths: {
    config: string;
    logs: string;
    cache: string;
  };
}

export interface CommandOptions {
  verbose?: boolean;
  format?: 'table' | 'json' | 'yaml';
  output?: string;
  filter?: string;
  watch?: boolean;
  follow?: boolean;
  tail?: number;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
  requestId?: string;
}

export interface WebSocketMessage {
  type: 'status' | 'log' | 'metric' | 'alert' | 'progress';
  data: any;
  timestamp: Date;
}