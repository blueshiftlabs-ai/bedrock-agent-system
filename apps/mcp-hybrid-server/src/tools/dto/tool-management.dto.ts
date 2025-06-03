import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Zod schemas for validation
export const ToolVersionSchema = z.object({
  major: z.number().int().min(0).describe('Major version number'),
  minor: z.number().int().min(0).describe('Minor version number'),
  patch: z.number().int().min(0).describe('Patch version number'),
  prerelease: z.string().optional().describe('Prerelease identifier'),
  build: z.string().optional().describe('Build metadata'),
});

export const ToolDependencySchema = z.object({
  name: z.string().min(1).describe('Dependency name'),
  version: z.string().min(1).describe('Version constraint'),
  type: z.enum(['runtime', 'development', 'peer']).describe('Dependency type'),
  optional: z.boolean().optional().describe('Whether dependency is optional'),
});

export const ToolPermissionSchema = z.object({
  type: z.enum(['read', 'write', 'execute', 'admin']).describe('Permission type'),
  resource: z.string().min(1).describe('Resource identifier'),
  description: z.string().min(1).describe('Permission description'),
});

export const ToolSearchSchema = z.object({
  query: z.string().optional().describe('Search query'),
  category: z.string().optional().describe('Filter by category'),
  status: z.string().optional().describe('Filter by status'),
  author: z.string().optional().describe('Filter by author'),
  keywords: z.array(z.string()).optional().describe('Filter by keywords'),
  enabled: z.boolean().optional().describe('Filter by enabled status'),
  sortBy: z.enum(['name', 'popularity', 'updated', 'created']).optional().describe('Sort by field'),
  sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort order'),
  limit: z.number().int().min(1).max(100).optional().describe('Maximum number of results'),
  offset: z.number().int().min(0).optional().describe('Number of results to skip'),
});

export const ToolInstallSchema = z.object({
  source: z.enum(['npm', 'git', 'local', 'registry']).describe('Tool source'),
  location: z.string().min(1).describe('Source location (URL, path, or package name)'),
  version: z.string().optional().describe('Specific version to install'),
  checksum: z.string().optional().describe('Expected checksum for verification'),
  signature: z.string().optional().describe('Digital signature for verification'),
  dependencies: z.array(ToolDependencySchema).optional().describe('Dependencies required for this tool'),
  autoEnable: z.boolean().optional().describe('Whether to enable tool after installation'),
});

export const ToolConfigurationSchema = z.object({
  configuration: z.record(z.any()).describe('Configuration object with tool-specific settings'),
  schema: z.object({
    type: z.literal('object'),
    properties: z.record(z.any()),
    required: z.array(z.string()).optional(),
  }).optional().describe('Configuration schema for validation'),
});

export const ToolExecutionSchema = z.object({
  parameters: z.record(z.any()).describe('Parameters to pass to the tool'),
  context: z.object({
    userId: z.string().optional(),
    sessionId: z.string().optional(),
    permissions: z.array(z.string()).optional(),
    environment: z.enum(['development', 'staging', 'production']).optional(),
  }).optional().describe('Execution context'),
});

export const ToolValidationSchema = z.object({
  id: z.string().min(1).describe('Tool identifier'),
  name: z.string().min(1).describe('Tool name'),
  description: z.string().min(1).describe('Tool description'),
  category: z.string().min(1).describe('Tool category'),
  version: ToolVersionSchema.describe('Tool version'),
  author: z.string().min(1).describe('Tool author'),
  license: z.string().min(1).describe('Tool license'),
  repository: z.string().optional().describe('Repository URL'),
  homepage: z.string().optional().describe('Homepage URL'),
  keywords: z.array(z.string()).describe('Keywords for discovery'),
  dependencies: z.array(ToolDependencySchema).describe('Tool dependencies'),
  permissions: z.array(ToolPermissionSchema).describe('Required permissions'),
  security: z.object({
    checksum: z.string().min(1),
    permissions: z.array(z.string()),
    sandboxed: z.boolean(),
    trustedSource: z.boolean(),
    signature: z.string().optional(),
  }).describe('Security configuration'),
});

export const WebSocketSubscriptionSchema = z.object({
  toolIds: z.array(z.string()).optional().describe('Tool IDs to subscribe to'),
  categories: z.array(z.string()).optional().describe('Categories to subscribe to'),
  eventTypes: z.array(z.string()).optional().describe('Event types to subscribe to'),
  permissions: z.array(z.string()).optional().describe('Required permissions for events'),
});

export const ToolEventSchema = z.object({
  type: z.enum(['registered', 'unregistered', 'enabled', 'disabled', 'updated', 'executed', 'health-check', 'error']).describe('Event type'),
  toolId: z.string().min(1).describe('Tool identifier'),
  timestamp: z.date().describe('Event timestamp'),
  data: z.any().optional().describe('Event data'),
  userId: z.string().optional().describe('User who triggered the event'),
});

export const ToolResponseSchema = z.object({
  success: z.boolean().describe('Operation success status'),
  message: z.string().min(1).describe('Response message'),
  data: z.any().optional().describe('Response data'),
  error: z.object({
    code: z.string(),
    details: z.string(),
    timestamp: z.date(),
  }).optional().describe('Error details if operation failed'),
});

export const ToolHealthSchema = z.object({
  status: z.enum(['healthy', 'unhealthy', 'degraded']).describe('Health status'),
  details: z.string().optional().describe('Health check details'),
  timestamp: z.date().describe('Health check timestamp'),
  metrics: z.record(z.any()).optional().describe('Health metrics'),
});

export const SystemStatsSchema = z.object({
  totalTools: z.number().int().min(0).describe('Total number of tools'),
  enabledTools: z.number().int().min(0).describe('Number of enabled tools'),
  disabledTools: z.number().int().min(0).describe('Number of disabled tools'),
  categories: z.number().int().min(0).describe('Number of categories'),
  categoryBreakdown: z.array(z.object({
    category: z.string(),
    count: z.number().int().min(0),
  })).describe('Category breakdown'),
  recentEvents: z.array(ToolEventSchema).describe('Recent events'),
  healthChecks: z.number().int().min(0).describe('Number of active health checks'),
  watchers: z.number().int().min(0).describe('Number of file watchers'),
});

// TypeScript types derived from Zod schemas
export type ToolVersionDto = z.infer<typeof ToolVersionSchema>;
export type ToolDependencyDto = z.infer<typeof ToolDependencySchema>;
export type ToolPermissionDto = z.infer<typeof ToolPermissionSchema>;
export type ToolSearchDto = z.infer<typeof ToolSearchSchema>;
export type ToolInstallDto = z.infer<typeof ToolInstallSchema>;
export type ToolConfigurationDto = z.infer<typeof ToolConfigurationSchema>;
export type ToolExecutionDto = z.infer<typeof ToolExecutionSchema>;
export type ToolValidationDto = z.infer<typeof ToolValidationSchema>;
export type WebSocketSubscriptionDto = z.infer<typeof WebSocketSubscriptionSchema>;
export type ToolEventDto = z.infer<typeof ToolEventSchema>;
export type ToolResponseDto = z.infer<typeof ToolResponseSchema>;
export type ToolHealthDto = z.infer<typeof ToolHealthSchema>;
export type SystemStatsDto = z.infer<typeof SystemStatsSchema>;

// Validation functions
export const validateToolVersion = (data: unknown): ToolVersionDto => {
  return ToolVersionSchema.parse(data);
};

export const validateToolDependency = (data: unknown): ToolDependencyDto => {
  return ToolDependencySchema.parse(data);
};

export const validateToolPermission = (data: unknown): ToolPermissionDto => {
  return ToolPermissionSchema.parse(data);
};

export const validateToolSearch = (data: unknown): ToolSearchDto => {
  return ToolSearchSchema.parse(data);
};

export const validateToolInstall = (data: unknown): ToolInstallDto => {
  return ToolInstallSchema.parse(data);
};

export const validateToolConfiguration = (data: unknown): ToolConfigurationDto => {
  return ToolConfigurationSchema.parse(data);
};

export const validateToolExecution = (data: unknown): ToolExecutionDto => {
  return ToolExecutionSchema.parse(data);
};

export const validateToolValidation = (data: unknown): ToolValidationDto => {
  return ToolValidationSchema.parse(data);
};

export const validateWebSocketSubscription = (data: unknown): WebSocketSubscriptionDto => {
  return WebSocketSubscriptionSchema.parse(data);
};

export const validateToolEvent = (data: unknown): ToolEventDto => {
  return ToolEventSchema.parse(data);
};

export const validateToolResponse = (data: unknown): ToolResponseDto => {
  return ToolResponseSchema.parse(data);
};

export const validateToolHealth = (data: unknown): ToolHealthDto => {
  return ToolHealthSchema.parse(data);
};

export const validateSystemStats = (data: unknown): SystemStatsDto => {
  return SystemStatsSchema.parse(data);
};

// Legacy class-based DTOs for Swagger compatibility (if needed)
// These can be removed once NestJS fully supports Zod schemas in Swagger

export class ToolVersionDtoClass {
  @ApiProperty({ description: 'Major version number' })
  major: number;

  @ApiProperty({ description: 'Minor version number' })
  minor: number;

  @ApiProperty({ description: 'Patch version number' })
  patch: number;

  @ApiPropertyOptional({ description: 'Prerelease identifier' })
  prerelease?: string;

  @ApiPropertyOptional({ description: 'Build metadata' })
  build?: string;
}

export class ToolDependencyDtoClass {
  @ApiProperty({ description: 'Dependency name' })
  name: string;

  @ApiProperty({ description: 'Version constraint' })
  version: string;

  @ApiProperty({ description: 'Dependency type', enum: ['runtime', 'development', 'peer'] })
  type: 'runtime' | 'development' | 'peer';

  @ApiPropertyOptional({ description: 'Whether dependency is optional' })
  optional?: boolean;
}

export class ToolPermissionDtoClass {
  @ApiProperty({ description: 'Permission type', enum: ['read', 'write', 'execute', 'admin'] })
  type: 'read' | 'write' | 'execute' | 'admin';

  @ApiProperty({ description: 'Resource identifier' })
  resource: string;

  @ApiProperty({ description: 'Permission description' })
  description: string;
}

export class ToolSearchDtoClass {
  @ApiPropertyOptional({ description: 'Search query' })
  query?: string;

  @ApiPropertyOptional({ description: 'Filter by category' })
  category?: string;

  @ApiPropertyOptional({ description: 'Filter by status' })
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by author' })
  author?: string;

  @ApiPropertyOptional({ description: 'Filter by keywords' })
  keywords?: string[];

  @ApiPropertyOptional({ description: 'Filter by enabled status' })
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Sort by field', enum: ['name', 'popularity', 'updated', 'created'] })
  sortBy?: 'name' | 'popularity' | 'updated' | 'created';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'] })
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: 'Maximum number of results', minimum: 1, maximum: 100 })
  limit?: number;

  @ApiPropertyOptional({ description: 'Number of results to skip', minimum: 0 })
  offset?: number;
}

export class ToolInstallDtoClass {
  @ApiProperty({ description: 'Tool source', enum: ['npm', 'git', 'local', 'registry'] })
  source: 'npm' | 'git' | 'local' | 'registry';

  @ApiProperty({ description: 'Source location (URL, path, or package name)' })
  location: string;

  @ApiPropertyOptional({ description: 'Specific version to install' })
  version?: string;

  @ApiPropertyOptional({ description: 'Expected checksum for verification' })
  checksum?: string;

  @ApiPropertyOptional({ description: 'Digital signature for verification' })
  signature?: string;

  @ApiPropertyOptional({ description: 'Dependencies required for this tool' })
  dependencies?: ToolDependencyDto[];

  @ApiPropertyOptional({ description: 'Whether to enable tool after installation' })
  autoEnable?: boolean;
}

export class ToolConfigurationDtoClass {
  @ApiProperty({ description: 'Configuration object with tool-specific settings' })
  configuration: { [key: string]: any };

  @ApiPropertyOptional({ description: 'Configuration schema for validation' })
  schema?: {
    type: 'object';
    properties: { [key: string]: any };
    required?: string[];
  };
}

export class ToolExecutionDtoClass {
  @ApiProperty({ description: 'Parameters to pass to the tool' })
  parameters: { [key: string]: any };

  @ApiPropertyOptional({ description: 'Execution context' })
  context?: {
    userId?: string;
    sessionId?: string;
    permissions?: string[];
    environment?: 'development' | 'staging' | 'production';
  };
}

export class ToolValidationDtoClass {
  @ApiProperty({ description: 'Tool identifier' })
  id: string;

  @ApiProperty({ description: 'Tool name' })
  name: string;

  @ApiProperty({ description: 'Tool description' })
  description: string;

  @ApiProperty({ description: 'Tool category' })
  category: string;

  @ApiProperty({ description: 'Tool version' })
  version: ToolVersionDto;

  @ApiProperty({ description: 'Tool author' })
  author: string;

  @ApiProperty({ description: 'Tool license' })
  license: string;

  @ApiPropertyOptional({ description: 'Repository URL' })
  repository?: string;

  @ApiPropertyOptional({ description: 'Homepage URL' })
  homepage?: string;

  @ApiProperty({ description: 'Keywords for discovery' })
  keywords: string[];

  @ApiProperty({ description: 'Tool dependencies' })
  dependencies: ToolDependencyDto[];

  @ApiProperty({ description: 'Required permissions' })
  permissions: ToolPermissionDto[];

  @ApiProperty({ description: 'Security configuration' })
  security: {
    checksum: string;
    permissions: string[];
    sandboxed: boolean;
    trustedSource: boolean;
    signature?: string;
  };
}

export class WebSocketSubscriptionDtoClass {
  @ApiPropertyOptional({ description: 'Tool IDs to subscribe to' })
  toolIds?: string[];

  @ApiPropertyOptional({ description: 'Categories to subscribe to' })
  categories?: string[];

  @ApiPropertyOptional({ description: 'Event types to subscribe to' })
  eventTypes?: string[];

  @ApiPropertyOptional({ description: 'Required permissions for events' })
  permissions?: string[];
}

export class ToolEventDtoClass {
  @ApiProperty({ description: 'Event type' })
  type: 'registered' | 'unregistered' | 'enabled' | 'disabled' | 'updated' | 'executed' | 'health-check' | 'error';

  @ApiProperty({ description: 'Tool identifier' })
  toolId: string;

  @ApiProperty({ description: 'Event timestamp' })
  timestamp: Date;

  @ApiPropertyOptional({ description: 'Event data' })
  data?: any;

  @ApiPropertyOptional({ description: 'User who triggered the event' })
  userId?: string;
}

export class ToolResponseDtoClass {
  @ApiProperty({ description: 'Operation success status' })
  success: boolean;

  @ApiProperty({ description: 'Response message' })
  message: string;

  @ApiPropertyOptional({ description: 'Response data' })
  data?: any;

  @ApiPropertyOptional({ description: 'Error details if operation failed' })
  error?: {
    code: string;
    details: string;
    timestamp: Date;
  };
}

export class ToolHealthDtoClass {
  @ApiProperty({ description: 'Health status', enum: ['healthy', 'unhealthy', 'degraded'] })
  status: 'healthy' | 'unhealthy' | 'degraded';

  @ApiPropertyOptional({ description: 'Health check details' })
  details?: string;

  @ApiProperty({ description: 'Health check timestamp' })
  timestamp: Date;

  @ApiPropertyOptional({ description: 'Health metrics' })
  metrics?: { [key: string]: any };
}

export class SystemStatsDtoClass {
  @ApiProperty({ description: 'Total number of tools' })
  totalTools: number;

  @ApiProperty({ description: 'Number of enabled tools' })
  enabledTools: number;

  @ApiProperty({ description: 'Number of disabled tools' })
  disabledTools: number;

  @ApiProperty({ description: 'Number of categories' })
  categories: number;

  @ApiProperty({ description: 'Category breakdown' })
  categoryBreakdown: Array<{
    category: string;
    count: number;
  }>;

  @ApiProperty({ description: 'Recent events' })
  recentEvents: ToolEventDto[];

  @ApiProperty({ description: 'Number of active health checks' })
  healthChecks: number;

  @ApiProperty({ description: 'Number of file watchers' })
  watchers: number;
}