export interface MCPServer {
  id: string
  name: string
  url: string
  status: 'connected' | 'disconnected' | 'error' | 'connecting'
  version?: string
  lastSeen?: Date
  config: MCPServerConfig
  metrics?: ServerMetrics
}

export interface MCPServerConfig {
  host: string
  port: number
  protocol: 'http' | 'https' | 'ws' | 'wss'
  authToken?: string
  timeout: number
  retryAttempts: number
  healthCheckInterval: number
}

export interface ServerMetrics {
  uptime: number
  memoryUsage: number
  cpuUsage: number
  requestsPerSecond: number
  errorRate: number
  responseTime: number
}

export interface Process {
  id: string
  name: string
  pid: number
  status: 'running' | 'stopped' | 'error' | 'starting' | 'stopping'
  startTime: Date
  memoryUsage: number
  cpuUsage: number
  commandLine: string
  workingDirectory: string
  restartCount: number
}

export interface LogEntry {
  id: string
  timestamp: Date
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  message: string
  source: string
  serverId?: string
  processId?: string
  metadata?: Record<string, any>
}

export interface Workflow {
  id: string
  name: string
  description: string
  status: 'running' | 'completed' | 'failed' | 'paused' | 'pending'
  createdAt: Date
  updatedAt: Date
  createdBy: string
  serverId: string
  steps: WorkflowStep[]
  currentStep?: number
  variables: Record<string, any>
  metrics?: WorkflowMetrics
}

export interface WorkflowStep {
  id: string
  name: string
  type: 'agent' | 'tool' | 'decision' | 'parallel' | 'loop'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  config: Record<string, any>
  dependencies: string[]
  outputs?: Record<string, any>
  startTime?: Date
  endTime?: Date
  error?: string
}

export interface WorkflowMetrics {
  totalSteps: number
  completedSteps: number
  failedSteps: number
  executionTime: number
  throughput: number
}

export interface Tool {
  id: string
  name: string
  description: string
  category: string
  version: string
  status: 'active' | 'inactive' | 'error'
  serverId: string
  lastUsed?: Date
  usageCount: number
  config: ToolConfig
  schema: ToolSchema
}

export interface ToolConfig {
  timeout: number
  retryAttempts: number
  rateLimitPerMinute?: number
  requiredPermissions: string[]
  dependencies: string[]
}

export interface ToolSchema {
  inputs: Record<string, ToolParameter>
  outputs: Record<string, ToolParameter>
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description: string
  required: boolean
  default?: any
  enum?: any[]
  format?: string
}

export interface Agent {
  id: string
  name: string
  type: 'code-analyzer' | 'db-analyzer' | 'documentation-generator' | 'knowledge-builder'
  status: 'idle' | 'busy' | 'error' | 'offline'
  serverId: string
  currentTask?: string
  capabilities: string[]
  config: AgentConfig
  metrics?: AgentMetrics
}

export interface AgentConfig {
  maxConcurrentTasks: number
  defaultTimeout: number
  memoryLimit: number
  retryPolicy: {
    maxAttempts: number
    backoffMultiplier: number
    initialDelay: number
  }
}

export interface AgentMetrics {
  tasksCompleted: number
  tasksError: number
  averageExecutionTime: number
  uptime: number
  memoryUsage: number
}

export interface SystemStatus {
  overall: 'healthy' | 'degraded' | 'critical'
  servers: number
  activeProcesses: number
  runningWorkflows: number
  activeTools: number
  memoryServerStatus?: MemoryServerStatus
  lastUpdate: Date
  alerts: Alert[]
}

export interface MemoryServerStatus {
  connected: boolean
  memoriesStored: number
  activeAgents: number
  indexHealth: {
    opensearch: boolean
    dynamodb: boolean
    neptune: boolean
  }
  lastMemoryCreated?: Date
  totalMemorySize: number
}

export interface Alert {
  id: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  title: string
  message: string
  timestamp: Date
  source: string
  acknowledged: boolean
  resolved: boolean
}

export interface WebSocketMessage {
  type: 'log' | 'process_update' | 'workflow_update' | 'server_status' | 'system_alert'
  payload: any
  timestamp: Date
  serverId?: string
}

export interface AIQuery {
  id: string
  query: string
  type: 'process_query' | 'log_analysis' | 'workflow_creation' | 'system_optimization'
  timestamp: Date
  response?: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  context?: Record<string, any>
}

export interface ConnectionConfig {
  serverUrl: string
  apiKey?: string
  timeout: number
  reconnectAttempts: number
  reconnectInterval: number
}