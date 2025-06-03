export enum ProcessStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum ProcessType {
  AGENT = 'agent',
  WORKFLOW = 'workflow',
  ANALYSIS = 'analysis',
  INDEXING = 'indexing',
  CUSTOM = 'custom',
}

export enum ProcessPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ProcessMetadata {
  id: string;
  name: string;
  type: ProcessType;
  status: ProcessStatus;
  priority: ProcessPriority;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  updatedAt: Date;
  ownerId?: string;
  parentProcessId?: string;
  childProcessIds: string[];
  tags: string[];
  description?: string;
}

export interface ProcessConfiguration {
  timeout?: number; // in milliseconds
  retryCount?: number;
  retryDelay?: number;
  maxMemory?: number; // in MB
  maxCpu?: number; // in percentage
  autoRestart?: boolean;
  dependencies?: string[]; // process IDs that must complete first
  scheduleExpression?: string; // cron expression for scheduled processes
  environment?: Record<string, any>;
}

export interface ProcessInput {
  data: any;
  metadata?: Record<string, any>;
  files?: ProcessFile[];
}

export interface ProcessOutput {
  data: any;
  metadata?: Record<string, any>;
  files?: ProcessFile[];
  logs?: ProcessLog[];
}

export interface ProcessFile {
  id: string;
  name: string;
  path: string;
  size: number;
  mimeType: string;
  createdAt: Date;
}

export interface ProcessLog {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, any>;
  source: string;
}

export interface ProcessResourceUsage {
  cpu: number; // percentage
  memory: number; // MB
  disk: number; // MB
  network: {
    bytesIn: number;
    bytesOut: number;
  };
  timestamp: Date;
}

export interface ProcessProgress {
  current: number;
  total: number;
  percentage: number;
  message?: string;
  estimatedCompletion?: Date;
}

export interface LongRunningProcess {
  metadata: ProcessMetadata;
  configuration: ProcessConfiguration;
  input: ProcessInput;
  output?: ProcessOutput;
  progress?: ProcessProgress;
  resourceUsage?: ProcessResourceUsage[];
  logs: ProcessLog[];
  error?: ProcessError;
}

export interface ProcessError {
  code: string;
  message: string;
  stack?: string;
  timestamp: Date;
  context?: Record<string, any>;
}

export interface ProcessAction {
  type: 'start' | 'stop' | 'pause' | 'resume' | 'cancel' | 'restart';
  processId: string;
  parameters?: Record<string, any>;
  timestamp: Date;
  userId?: string;
}

export interface ProcessEvent {
  type: 'status_change' | 'progress_update' | 'log_entry' | 'resource_update' | 'error' | 'completion';
  processId: string;
  data: any;
  timestamp: Date;
}

export interface ProcessFilter {
  status?: ProcessStatus[];
  type?: ProcessType[];
  priority?: ProcessPriority[];
  ownerId?: string;
  tags?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface ProcessStats {
  total: number;
  byStatus: Record<ProcessStatus, number>;
  byType: Record<ProcessType, number>;
  byPriority: Record<ProcessPriority, number>;
  averageExecutionTime: number;
  totalResourceUsage: {
    cpu: number;
    memory: number;
    disk: number;
  };
}

export interface ProcessSchedule {
  id: string;
  processTemplate: Omit<LongRunningProcess, 'metadata'>;
  cronExpression: string;
  isActive: boolean;
  nextExecution: Date;
  lastExecution?: Date;
  executionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentInteraction {
  id: string;
  processId: string;
  agentName: string;
  type: 'input_request' | 'decision_point' | 'confirmation' | 'debug_breakpoint';
  message: string;
  options?: string[];
  defaultValue?: any;
  timeout?: number;
  timestamp: Date;
  response?: {
    value: any;
    timestamp: Date;
    userId?: string;
  };
}

export interface WorkflowNode {
  id: string;
  name: string;
  type: string;
  status: ProcessStatus;
  input?: any;
  output?: any;
  error?: ProcessError;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  retryCount: number;
  dependencies: string[];
}

export interface WorkflowState {
  processId: string;
  currentNode?: string;
  nodes: Record<string, WorkflowNode>;
  variables: Record<string, any>;
  conditionalBranches: Record<string, boolean>;
  loopCounters: Record<string, number>;
  pausePoint?: string;
  checkpoints: Array<{
    nodeId: string;
    timestamp: Date;
    state: any;
  }>;
}