import { MCPTool, MCPToolParameterSchema } from '../registry/tool.registry';

export interface ToolVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
}

export interface ToolDependency {
  name: string;
  version: string;
  type: 'runtime' | 'development' | 'peer';
  optional?: boolean;
}

export interface ToolMetadata extends MCPTool {
  id: string;
  version: ToolVersion;
  author: string;
  license: string;
  repository?: string;
  homepage?: string;
  keywords: string[];
  dependencies: ToolDependency[];
  permissions: ToolPermission[];
  healthCheck?: HealthCheckConfig;
  lifecycle: ToolLifecycle;
  security: ToolSecurity;
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
}

export interface ToolPermission {
  type: 'read' | 'write' | 'execute' | 'admin';
  resource: string;
  description: string;
}

export interface HealthCheckConfig {
  enabled: boolean;
  interval: number; // milliseconds
  timeout: number; // milliseconds
  retries: number;
  healthCheck: () => Promise<HealthCheckResult>;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  details?: string;
  timestamp: Date;
  metrics?: Record<string, any>;
}

export interface ToolLifecycle {
  status: ToolStatus;
  enabled: boolean;
  installPath?: string;
  configPath?: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  maxMemory?: number; // bytes
  maxCpuUsage?: number; // percentage
}

export interface ToolSecurity {
  signature?: string;
  checksum: string;
  permissions: string[];
  sandboxed: boolean;
  trustedSource: boolean;
}

export type ToolStatus = 
  | 'installing'
  | 'installed'
  | 'enabled'
  | 'disabled'
  | 'updating'
  | 'uninstalling'
  | 'error'
  | 'deprecated';

export interface ToolValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface ToolExecutionContext {
  userId?: string;
  sessionId?: string;
  requestId: string;
  timestamp: Date;
  permissions: string[];
  environment: 'development' | 'staging' | 'production';
  ratelimit?: {
    remaining: number;
    reset: Date;
  };
}

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
  memoryUsage?: number;
  cpuUsage?: number;
  metadata: {
    toolId: string;
    version: string;
    context: ToolExecutionContext;
  };
}

export interface ToolInstallationConfig {
  source: 'npm' | 'git' | 'local' | 'registry';
  location: string;
  version?: string;
  checksum?: string;
  signature?: string;
  dependencies?: ToolDependency[];
  autoEnable?: boolean;
}

export interface ToolUpdateInfo {
  currentVersion: ToolVersion;
  latestVersion: ToolVersion;
  updateAvailable: boolean;
  changeLog?: string;
  breaking: boolean;
  securityUpdate: boolean;
}

export interface ToolSearchCriteria {
  query?: string;
  category?: string;
  status?: ToolStatus;
  author?: string;
  keywords?: string[];
  minVersion?: ToolVersion;
  maxVersion?: ToolVersion;
  permissions?: string[];
  enabled?: boolean;
  sortBy?: 'name' | 'popularity' | 'updated' | 'created';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ToolSearchResult {
  tools: ToolMetadata[];
  total: number;
  offset: number;
  limit: number;
}

export interface ToolEvent {
  type: 'registered' | 'unregistered' | 'enabled' | 'disabled' | 'updated' | 'executed' | 'health-check' | 'error';
  toolId: string;
  timestamp: Date;
  data?: any;
  userId?: string;
}

export interface ToolConfiguration {
  [key: string]: any;
}

export interface ToolConfigurationSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description: string;
    default?: any;
    required?: boolean;
    validation?: any;
  }>;
  required?: string[];
}