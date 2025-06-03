import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { getErrorMessage } from '@/common/utils/error-utils';

export interface MCPConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  config: {
    server: any;
    client: any;
    global: any;
  };
}

@Injectable()
export class MCPConfigValidationService {
  private readonly logger = new Logger(MCPConfigValidationService.name);

  constructor(private readonly configService: ConfigService) {}

  validateConfiguration(): MCPConfigValidationResult {
    const result: MCPConfigValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      config: {
        server: {},
        client: {},
        global: {},
      },
    };

    try {
      // Extract MCP configuration
      const mcpConfig = this.configService.get('mcp', {});
      
      // Validate server configuration
      this.validateServerConfig(mcpConfig.server || {}, result);
      
      // Validate client configuration
      this.validateClientConfig(mcpConfig.client || {}, result);
      
      // Validate global configuration
      this.validateGlobalConfig(mcpConfig, result);
      
      // Set overall validity
      result.valid = result.errors.length === 0;
      
      if (!result.valid) {
        this.logger.warn(`MCP configuration validation failed with ${result.errors.length} errors`);
        result.errors.forEach(error => this.logger.warn(`❌ ${error}`));
      }
      
      if (result.warnings.length > 0) {
        this.logger.warn(`MCP configuration has ${result.warnings.length} warnings`);
        result.warnings.forEach(warning => this.logger.warn(`⚠️ ${warning}`));
      }
      
    } catch (error: any) {
      result.valid = false;
      result.errors.push(`Configuration validation failed: ${getErrorMessage(error)}`);
    }

    return result;
  }

  private validateServerConfig(serverConfig: any, result: MCPConfigValidationResult): void {
    const schema = z.object({
      name: z.string().min(1).max(100).default('hybrid-mcp-server'),
      version: z.string().regex(/^\d+\.\d+\.\d+$/).default('1.0.0'),
      description: z.string().min(1).max(500).default('Advanced MCP server with NestJS and LangGraph integration'),
      enabled: z.boolean().default(true),
      endpoint: z.string().regex(/^\/[a-zA-Z0-9\-._~!$&'()*+,;=:@\/]*$/).default('/mcp'),
      transport: z.object({
        type: z.enum(['http+sse', 'websocket', 'stdio']).default('http+sse'),
        enableCors: z.boolean().default(true),
        maxConnections: z.number().int().min(1).max(10000).default(100),
        connectionTimeout: z.number().int().min(1000).max(300000).default(30000), // 1s to 5min
      }).default({}),
      tools: z.object({
        maxExecutionTime: z.number().int().min(1000).max(1800000).default(300000), // 1s to 30min
        enableChaining: z.boolean().default(false),
        enableCaching: z.boolean().default(true),
        cacheTimeout: z.number().int().min(60000).max(3600000).default(300000), // 1min to 1hour
      }).default({}),
    });

    try {
      const value = schema.parse(serverConfig);
      result.config.server = value;
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        error.errors.forEach(zodError => {
          const path = zodError.path.join('.');
          result.errors.push(`Server config: ${zodError.message}${path ? ` at ${path}` : ''}`);
        });
      } else {
        result.errors.push(`Server config: ${getErrorMessage(error)}`);
      }
      return;
    }

    // Additional validation logic
    const value = result.config.server;
    if (value.enabled && value.transport.type === 'stdio') {
      result.warnings.push('Server config: STDIO transport is not recommended for server mode');
    }

    if (value.transport.maxConnections > 1000) {
      result.warnings.push('Server config: High maxConnections value may impact performance');
    }

    if (value.tools.maxExecutionTime > 600000) { // 10 minutes
      result.warnings.push('Server config: Long tool execution time may cause timeouts');
    }
  }

  private validateClientConfig(clientConfig: any, result: MCPConfigValidationResult): void {
    const schema = z.object({
      enabled: z.boolean().default(false),
      configPath: z.string().min(1).default('.mcp/servers.json'),
      autoConnect: z.boolean().default(false),
      connectionRetries: z.number().int().min(0).max(10).default(3),
      connectionRetryDelay: z.number().int().min(1000).max(60000).default(5000), // 1s to 1min
      healthCheckInterval: z.number().int().min(10000).max(600000).default(60000), // 10s to 10min
      requestTimeout: z.number().int().min(1000).max(300000).default(30000), // 1s to 5min
      discovery: z.object({
        enabled: z.boolean().default(false),
        scanInterval: z.number().int().min(60000).max(3600000).default(300000), // 1min to 1hour
        knownServers: z.array(z.string()).default([]),
      }).default({}),
    });

    try {
      const value = schema.parse(clientConfig);
      result.config.client = value;
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        error.errors.forEach(zodError => {
          const path = zodError.path.join('.');
          result.errors.push(`Client config: ${zodError.message}${path ? ` at ${path}` : ''}`);
        });
      } else {
        result.errors.push(`Client config: ${getErrorMessage(error)}`);
      }
      return;
    }

    // Additional validation logic
    const value = result.config.client;
    if (value.enabled && value.autoConnect && value.discovery.enabled) {
      result.warnings.push('Client config: Both autoConnect and discovery are enabled, which may create conflicts');
    }

    if (value.healthCheckInterval < 30000) {
      result.warnings.push('Client config: Very frequent health checks may impact performance');
    }

    if (value.connectionRetries > 5) {
      result.warnings.push('Client config: High retry count may delay startup');
    }

    // Validate config path accessibility
    if (value.enabled && !this.isValidPath(value.configPath)) {
      result.warnings.push(`Client config: Config path may not be accessible: ${value.configPath}`);
    }
  }

  private validateGlobalConfig(mcpConfig: any, result: MCPConfigValidationResult): void {
    const schema = z.object({
      protocolVersion: z.literal('2024-11-05').default('2024-11-05'),
      enableMetrics: z.boolean().default(true),
      enableLogging: z.boolean().default(true),
      logLevel: z.enum(['error', 'warn', 'info', 'debug', 'verbose']).default('info'),
    });

    const globalConfig = {
      protocolVersion: mcpConfig.protocolVersion,
      enableMetrics: mcpConfig.enableMetrics,
      enableLogging: mcpConfig.enableLogging,
      logLevel: mcpConfig.logLevel,
    };

    try {
      const value = schema.parse(globalConfig);
      result.config.global = value;
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        error.errors.forEach(zodError => {
          const path = zodError.path.join('.');
          result.errors.push(`Global config: ${zodError.message}${path ? ` at ${path}` : ''}`);
        });
      } else {
        result.errors.push(`Global config: ${getErrorMessage(error)}`);
      }
      return;
    }

    // Additional validation logic
    const serverEnabled = mcpConfig.server?.enabled !== false;
    const clientEnabled = mcpConfig.client?.enabled === true;

    if (!serverEnabled && !clientEnabled) {
      result.errors.push('Global config: Both MCP server and client are disabled');
    }

    if (serverEnabled && clientEnabled) {
      result.warnings.push('Global config: Both MCP server and client are enabled, ensure proper resource allocation');
    }
  }

  private isValidPath(path: string): boolean {
    try {
      // Basic path validation
      return path.length > 0 && !path.includes('..') && path.trim() === path;
    } catch {
      return false;
    }
  }

  validateEnvironmentVariables(): { valid: boolean; missing: string[]; invalid: string[] } {
    const requiredEnvVars: Record<string, (value: string) => boolean> = {
      // Add required environment variables and their validators
    };

    const optionalEnvVars: Record<string, (value: string) => boolean> = {
      MCP_SERVER_ENABLED: (value) => ['true', 'false'].includes(value.toLowerCase()),
      MCP_CLIENT_ENABLED: (value) => ['true', 'false'].includes(value.toLowerCase()),
      MCP_SERVER_NAME: (value) => value.length > 0 && value.length <= 100,
      MCP_SERVER_VERSION: (value) => /^\d+\.\d+\.\d+$/.test(value),
      MCP_SERVER_TRANSPORT_TYPE: (value) => ['http+sse', 'websocket', 'stdio'].includes(value),
      MCP_SERVER_MAX_CONNECTIONS: (value) => !isNaN(parseInt(value)) && parseInt(value) > 0,
      MCP_CLIENT_AUTO_CONNECT: (value) => ['true', 'false'].includes(value.toLowerCase()),
      MCP_CLIENT_CONNECTION_RETRIES: (value) => !isNaN(parseInt(value)) && parseInt(value) >= 0,
      MCP_PROTOCOL_VERSION: (value) => value === '2024-11-05',
      MCP_LOG_LEVEL: (value) => ['error', 'warn', 'info', 'debug', 'verbose'].includes(value),
    };

    const missing: string[] = [];
    const invalid: string[] = [];

    // Check required variables
    for (const [envVar, validator] of Object.entries(requiredEnvVars)) {
      const value = process.env[envVar];
      if (!value) {
        missing.push(envVar);
      } else if (!validator(value)) {
        invalid.push(`${envVar}=${value}`);
      }
    }

    // Check optional variables if they exist
    for (const [envVar, validator] of Object.entries(optionalEnvVars)) {
      const value = process.env[envVar];
      if (value && !validator(value)) {
        invalid.push(`${envVar}=${value}`);
      }
    }

    return {
      valid: missing.length === 0 && invalid.length === 0,
      missing,
      invalid,
    };
  }

  getConfigSummary(): {
    server: { enabled: boolean; endpoint?: string; toolsCount?: number };
    client: { enabled: boolean; autoConnect?: boolean; configPath?: string };
    features: string[];
    warnings: string[];
  } {
    const serverConfig = this.configService.get('mcp.server', {});
    const clientConfig = this.configService.get('mcp.client', {});
    const globalConfig = this.configService.get('mcp', {});

    const features: string[] = [];
    const warnings: string[] = [];

    if (serverConfig.enabled !== false) {
      features.push('MCP Server');
      if (serverConfig.tools?.enableChaining) features.push('Tool Chaining');
      if (serverConfig.tools?.enableCaching) features.push('Tool Caching');
    }

    if (clientConfig.enabled) {
      features.push('MCP Client');
      if (clientConfig.autoConnect) features.push('Auto-Connect');
      if (clientConfig.discovery?.enabled) features.push('Discovery');
    }

    if (globalConfig.enableMetrics) features.push('Metrics');
    if (globalConfig.enableLogging) features.push('Logging');

    // Add warnings for common configuration issues
    if (serverConfig.enabled !== false && clientConfig.enabled) {
      warnings.push('Both server and client enabled - monitor resource usage');
    }

    if (clientConfig.enabled && !clientConfig.autoConnect && !clientConfig.discovery?.enabled) {
      warnings.push('Client enabled but no auto-connection or discovery configured');
    }

    return {
      server: {
        enabled: serverConfig.enabled !== false,
        endpoint: serverConfig.endpoint,
      },
      client: {
        enabled: !!clientConfig.enabled,
        autoConnect: !!clientConfig.autoConnect,
        configPath: clientConfig.configPath,
      },
      features,
      warnings,
    };
  }
}