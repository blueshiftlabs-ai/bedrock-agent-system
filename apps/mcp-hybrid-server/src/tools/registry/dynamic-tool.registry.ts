import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MCPToolRegistry, MCPTool } from './tool.registry';
import {
  ToolMetadata,
  ToolValidationResult,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolInstallationConfig,
  ToolUpdateInfo,
  ToolSearchCriteria,
  ToolSearchResult,
  ToolEvent,
  ToolConfiguration,
  ToolConfigurationSchema,
  HealthCheckResult,
  ToolStatus,
  ToolVersion,
} from '../interfaces/tool-management.interface';
import * as crypto from 'crypto';
import { getErrorMessage } from '@/common/utils/error-utils';
import * as semver from 'semver';

@Injectable()
export class DynamicToolRegistry implements OnModuleDestroy {
  private readonly logger = new Logger(DynamicToolRegistry.name);
  private toolMetadata: Map<string, ToolMetadata> = new Map();
  private toolConfigurations: Map<string, ToolConfiguration> = new Map();
  private toolHealthChecks: Map<string, NodeJS.Timeout> = new Map();
  private toolWatchers: Map<string, any> = new Map(); // File watchers for hot reload
  private eventHistory: ToolEvent[] = [];
  private readonly maxEventHistory = 1000;

  constructor(
    private readonly mcpRegistry: MCPToolRegistry,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Delegate methods to MCPToolRegistry
  registerTool(tool: MCPTool): void {
    return this.mcpRegistry.registerTool(tool);
  }

  unregisterTool(name: string): boolean {
    return this.mcpRegistry.unregisterTool(name);
  }

  getTool(name: string): MCPTool | undefined {
    return this.mcpRegistry.getTool(name);
  }

  getToolCategories(): string[] {
    return this.mcpRegistry.getToolCategories();
  }

  listTools(): MCPTool[] {
    return this.mcpRegistry.getAllTools();
  }

  async executeTool(name: string, params: any, context?: any): Promise<any> {
    return this.mcpRegistry.executeTool(name, params, context);
  }

  onModuleDestroy() {
    // Clean up health check intervals
    this.toolHealthChecks.forEach((interval, toolId) => {
      clearInterval(interval);
      this.logger.log(`Cleared health check for tool: ${toolId}`);
    });

    // Clean up file watchers
    this.toolWatchers.forEach((watcher, toolId) => {
      if (watcher && typeof watcher.close === 'function') {
        watcher.close();
        this.logger.log(`Closed file watcher for tool: ${toolId}`);
      }
    });
  }

  // Enhanced tool registration with metadata
  async registerToolWithMetadata(toolMetadata: ToolMetadata): Promise<ToolValidationResult> {
    const validationResult = this.validateTool(toolMetadata);
    
    if (!validationResult.valid) {
      this.logger.error(`Tool validation failed for ${toolMetadata.id}:`, validationResult.errors);
      return validationResult;
    }

    // Check dependencies
    const dependencyCheck = await this.checkDependencies(toolMetadata);
    if (!dependencyCheck.valid) {
      return dependencyCheck;
    }

    // Store metadata
    this.toolMetadata.set(toolMetadata.id, {
      ...toolMetadata,
      updatedAt: new Date(),
      createdAt: toolMetadata.createdAt || new Date(),
    });

    // Register the actual tool
    const mcpTool: MCPTool = {
      name: toolMetadata.name,
      description: toolMetadata.description,
      category: toolMetadata.category,
      parameters: toolMetadata.parameters,
      execute: this.createExecuteWrapper(toolMetadata),
      timeout: toolMetadata.timeout,
      retryable: toolMetadata.retryable,
      cacheable: toolMetadata.cacheable,
    };

    this.registerTool(mcpTool);

    // Set up health checking if configured
    if (toolMetadata.healthCheck?.enabled) {
      this.setupHealthCheck(toolMetadata);
    }

    // Set up hot reload monitoring if tool has a file path
    if (toolMetadata.lifecycle.installPath) {
      this.setupHotReload(toolMetadata);
    }

    // Emit registration event
    this.emitToolEvent('registered', toolMetadata.id, { version: toolMetadata.version });

    this.logger.log(`Tool registered with metadata: ${toolMetadata.id} v${this.versionToString(toolMetadata.version)}`);
    
    return validationResult;
  }

  // Tool validation
  private validateTool(toolMetadata: ToolMetadata): ToolValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Required fields validation
    if (!toolMetadata.id) errors.push('Tool ID is required');
    if (!toolMetadata.name) errors.push('Tool name is required');
    if (!toolMetadata.version) errors.push('Tool version is required');
    if (!toolMetadata.author) errors.push('Tool author is required');
    if (!toolMetadata.license) errors.push('Tool license is required');
    if (!toolMetadata.security.checksum) errors.push('Tool checksum is required for security');

    // Version validation
    if (toolMetadata.version && !this.isValidVersion(toolMetadata.version)) {
      errors.push('Invalid version format');
    }

    // Name validation (no spaces, special characters)
    if (toolMetadata.name && !/^[a-zA-Z0-9_-]+$/.test(toolMetadata.name)) {
      errors.push('Tool name can only contain letters, numbers, hyphens, and underscores');
    }

    // Check for existing tool with same name but different version
    const existingTool = Array.from(this.toolMetadata.values())
      .find(t => t.name === toolMetadata.name && t.id !== toolMetadata.id);
    
    if (existingTool) {
      warnings.push(`Another tool with name '${toolMetadata.name}' already exists (${existingTool.id})`);
    }

    // Security validation
    if (!toolMetadata.security.trustedSource) {
      warnings.push('Tool is from an untrusted source');
    }

    if (!toolMetadata.security.sandboxed) {
      warnings.push('Tool is not sandboxed - this may pose security risks');
    }

    // Performance suggestions
    if (toolMetadata.timeout && toolMetadata.timeout > 60000) {
      suggestions.push('Consider reducing timeout for better user experience');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  // Dependency checking
  private async checkDependencies(toolMetadata: ToolMetadata): Promise<ToolValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const dependency of toolMetadata.dependencies) {
      const dependentTool = Array.from(this.toolMetadata.values())
        .find(t => t.name === dependency.name);

      if (!dependentTool && !dependency.optional) {
        errors.push(`Required dependency '${dependency.name}' is not available`);
      } else if (dependentTool) {
        const isCompatible = this.isVersionCompatible(
          dependentTool.version,
          dependency.version
        );
        
        if (!isCompatible) {
          errors.push(
            `Dependency '${dependency.name}' version ${this.versionToString(dependentTool.version)} ` +
            `is not compatible with required version ${dependency.version}`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions: [],
    };
  }

  // Enhanced execution wrapper with context and monitoring
  private createExecuteWrapper(toolMetadata: ToolMetadata) {
    return async (params: any, context?: any): Promise<any> => {
      const executionContext: ToolExecutionContext = {
        requestId: crypto.randomUUID(),
        timestamp: new Date(),
        permissions: context?.permissions || [],
        environment: process.env.NODE_ENV as any || 'development',
        userId: context?.userId,
        sessionId: context?.sessionId,
        ratelimit: context?.ratelimit,
      };

      const startTime = Date.now();
      const startMemory = process.memoryUsage().heapUsed;

      try {
        // Check if tool is enabled
        if (!toolMetadata.lifecycle.enabled) {
          throw new Error(`Tool ${toolMetadata.id} is disabled`);
        }

        // Check permissions
        this.checkPermissions(toolMetadata, executionContext);

        // Execute the tool
        const result = await toolMetadata.execute(params, context);
        
        const executionTime = Date.now() - startTime;
        const memoryUsage = process.memoryUsage().heapUsed - startMemory;

        // Update last used timestamp
        toolMetadata.lastUsed = new Date();
        this.toolMetadata.set(toolMetadata.id, toolMetadata);

        // Emit execution event
        this.emitToolEvent('executed', toolMetadata.id, {
          executionTime,
          memoryUsage,
          success: true,
        });

        const executionResult: ToolExecutionResult = {
          success: true,
          data: result,
          executionTime,
          memoryUsage,
          metadata: {
            toolId: toolMetadata.id,
            version: this.versionToString(toolMetadata.version),
            context: executionContext,
          },
        };

        return executionResult.data;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        const memoryUsage = process.memoryUsage().heapUsed - startMemory;

        this.emitToolEvent('error', toolMetadata.id, {
          error: getErrorMessage(error),
          executionTime,
          memoryUsage,
        });

        throw error;
      }
    };
  }

  // Permission checking
  private checkPermissions(toolMetadata: ToolMetadata, context: ToolExecutionContext): void {
    const requiredPermissions = toolMetadata.permissions.map(p => p.type);
    const userPermissions = context.permissions;

    const missingPermissions = requiredPermissions.filter(
      perm => !userPermissions.includes(perm)
    );

    if (missingPermissions.length > 0) {
      throw new Error(
        `Insufficient permissions. Required: ${missingPermissions.join(', ')}`
      );
    }
  }

  // Health checking
  private setupHealthCheck(toolMetadata: ToolMetadata): void {
    if (!toolMetadata.healthCheck) return;

    const { interval, healthCheck } = toolMetadata.healthCheck;
    
    const checkHealth = async () => {
      try {
        const result = await Promise.race([
          healthCheck(),
          new Promise<HealthCheckResult>((_, reject) =>
            setTimeout(() => reject(new Error('Health check timeout')), 
              toolMetadata.healthCheck!.timeout)
          )
        ]);

        this.emitToolEvent('health-check', toolMetadata.id, result);
        
        if (result.status === 'unhealthy') {
          this.logger.warn(`Tool ${toolMetadata.id} health check failed:`, result.details);
        }
      } catch (error) {
        this.logger.error(`Health check failed for tool ${toolMetadata.id}:`, getErrorMessage(error));
        this.emitToolEvent('health-check', toolMetadata.id, {
          status: 'unhealthy',
          details: getErrorMessage(error),
          timestamp: new Date(),
        });
      }
    };

    // Run initial health check
    checkHealth();

    // Set up periodic health checks
    const intervalId = setInterval(checkHealth, interval);
    this.toolHealthChecks.set(toolMetadata.id, intervalId);
  }

  // Hot reload setup
  private setupHotReload(toolMetadata: ToolMetadata): void {
    // Implementation would depend on the specific requirements
    // This is a placeholder for file watching logic
    if (!toolMetadata.lifecycle.installPath) return;

    try {
      const fs = require('fs');
      const watcher = fs.watch(toolMetadata.lifecycle.installPath, (eventType: string, filename: string) => {
        if (eventType === 'change') {
          this.logger.log(`Tool file changed: ${toolMetadata.id}, reloading...`);
          this.hotReloadTool(toolMetadata.id);
        }
      });

      this.toolWatchers.set(toolMetadata.id, watcher);
    } catch (error) {
      this.logger.error(`Failed to setup hot reload for tool ${toolMetadata.id}:`, getErrorMessage(error));
    }
  }

  // Hot reload implementation
  private async hotReloadTool(toolId: string): Promise<boolean> {
    try {
      const toolMetadata = this.toolMetadata.get(toolId);
      if (!toolMetadata) return false;

      // Unregister current tool
      this.unregisterTool(toolMetadata.name);
      
      // Clear health check
      const healthCheckInterval = this.toolHealthChecks.get(toolId);
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        this.toolHealthChecks.delete(toolId);
      }

      // Re-register tool (this would need to reload the actual tool code)
      // This is a simplified version - in practice, you'd need to handle module reloading
      await this.registerToolWithMetadata(toolMetadata);

      this.logger.log(`Successfully hot-reloaded tool: ${toolId}`);
      return true;
    } catch (error) {
      this.logger.error(`Hot reload failed for tool ${toolId}:`, getErrorMessage(error));
      return false;
    }
  }

  // Tool management methods
  async enableTool(toolId: string): Promise<boolean> {
    const toolMetadata = this.toolMetadata.get(toolId);
    if (!toolMetadata) return false;

    toolMetadata.lifecycle.enabled = true;
    toolMetadata.lifecycle.status = 'enabled';
    toolMetadata.updatedAt = new Date();
    
    this.toolMetadata.set(toolId, toolMetadata);
    this.emitToolEvent('enabled', toolId);
    
    return true;
  }

  async disableTool(toolId: string): Promise<boolean> {
    const toolMetadata = this.toolMetadata.get(toolId);
    if (!toolMetadata) return false;

    toolMetadata.lifecycle.enabled = false;
    toolMetadata.lifecycle.status = 'disabled';
    toolMetadata.updatedAt = new Date();
    
    this.toolMetadata.set(toolId, toolMetadata);
    this.emitToolEvent('disabled', toolId);
    
    return true;
  }

  async uninstallTool(toolId: string): Promise<boolean> {
    const toolMetadata = this.toolMetadata.get(toolId);
    if (!toolMetadata) return false;

    // Unregister from MCP registry
    this.unregisterTool(toolMetadata.name);
    
    // Clean up health check
    const healthCheckInterval = this.toolHealthChecks.get(toolId);
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      this.toolHealthChecks.delete(toolId);
    }

    // Clean up file watcher
    const watcher = this.toolWatchers.get(toolId);
    if (watcher) {
      watcher.close();
      this.toolWatchers.delete(toolId);
    }

    // Remove metadata and configuration
    this.toolMetadata.delete(toolId);
    this.toolConfigurations.delete(toolId);

    this.emitToolEvent('unregistered', toolId);
    
    return true;
  }

  // Search and query methods
  searchTools(criteria: ToolSearchCriteria): ToolSearchResult {
    let tools = Array.from(this.toolMetadata.values());

    // Apply filters
    if (criteria.query) {
      const query = criteria.query.toLowerCase();
      tools = tools.filter(tool => 
        tool.name.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query) ||
        tool.keywords.some(k => k.toLowerCase().includes(query))
      );
    }

    if (criteria.category) {
      tools = tools.filter(tool => tool.category === criteria.category);
    }

    if (criteria.status) {
      tools = tools.filter(tool => tool.lifecycle.status === criteria.status);
    }

    if (criteria.author) {
      tools = tools.filter(tool => tool.author === criteria.author);
    }

    if (criteria.enabled !== undefined) {
      tools = tools.filter(tool => tool.lifecycle.enabled === criteria.enabled);
    }

    if (criteria.keywords && criteria.keywords.length > 0) {
      tools = tools.filter(tool => 
        criteria.keywords!.some(keyword => 
          tool.keywords.includes(keyword)
        )
      );
    }

    // Apply sorting
    if (criteria.sortBy) {
      tools.sort((a, b) => {
        let aValue: any, bValue: any;
        
        switch (criteria.sortBy) {
          case 'name':
            aValue = a.name;
            bValue = b.name;
            break;
          case 'updated':
            aValue = a.updatedAt;
            bValue = b.updatedAt;
            break;
          case 'created':
            aValue = a.createdAt;
            bValue = b.createdAt;
            break;
          default:
            aValue = a.name;
            bValue = b.name;
        }

        const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        return criteria.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    // Apply pagination
    const total = tools.length;
    const offset = criteria.offset || 0;
    const limit = criteria.limit || 50;
    tools = tools.slice(offset, offset + limit);

    return {
      tools,
      total,
      offset,
      limit,
    };
  }

  // Get tool metadata
  getToolMetadata(toolId: string): ToolMetadata | undefined {
    return this.toolMetadata.get(toolId);
  }

  getAllToolMetadata(): ToolMetadata[] {
    return Array.from(this.toolMetadata.values());
  }

  // Configuration management
  setToolConfiguration(toolId: string, configuration: ToolConfiguration): boolean {
    const toolMetadata = this.toolMetadata.get(toolId);
    if (!toolMetadata) return false;

    this.toolConfigurations.set(toolId, configuration);
    return true;
  }

  getToolConfiguration(toolId: string): ToolConfiguration | undefined {
    return this.toolConfigurations.get(toolId);
  }

  // Event management
  private emitToolEvent(type: ToolEvent['type'], toolId: string, data?: any, userId?: string): void {
    const event: ToolEvent = {
      type,
      toolId,
      timestamp: new Date(),
      data,
      userId,
    };

    this.eventHistory.push(event);
    
    // Maintain event history size
    if (this.eventHistory.length > this.maxEventHistory) {
      this.eventHistory.shift();
    }

    // Emit to event system
    this.eventEmitter.emit('dynamic-tool.event', event);
  }

  getEventHistory(toolId?: string, limit: number = 100): ToolEvent[] {
    let events = this.eventHistory;
    
    if (toolId) {
      events = events.filter(e => e.toolId === toolId);
    }
    
    return events.slice(-limit);
  }

  // Version management
  private isValidVersion(version: ToolVersion): boolean {
    return typeof version.major === 'number' &&
           typeof version.minor === 'number' &&
           typeof version.patch === 'number' &&
           version.major >= 0 &&
           version.minor >= 0 &&
           version.patch >= 0;
  }

  private versionToString(version: ToolVersion): string {
    let versionStr = `${version.major}.${version.minor}.${version.patch}`;
    if (version.prerelease) {
      versionStr += `-${version.prerelease}`;
    }
    if (version.build) {
      versionStr += `+${version.build}`;
    }
    return versionStr;
  }

  private isVersionCompatible(installedVersion: ToolVersion, requiredVersion: string): boolean {
    const installedVersionStr = this.versionToString(installedVersion);
    return semver.satisfies(installedVersionStr, requiredVersion);
  }

  // Get system statistics
  getSystemStats(): any {
    const tools = Array.from(this.toolMetadata.values());
    const enabledTools = tools.filter(t => t.lifecycle.enabled);
    const categories = [...new Set(tools.map(t => t.category))];
    
    return {
      totalTools: tools.length,
      enabledTools: enabledTools.length,
      disabledTools: tools.length - enabledTools.length,
      categories: categories.length,
      categoryBreakdown: categories.map(category => ({
        category,
        count: tools.filter(t => t.category === category).length,
      })),
      recentEvents: this.eventHistory.slice(-10),
      healthChecks: this.toolHealthChecks.size,
      watchers: this.toolWatchers.size,
    };
  }
}