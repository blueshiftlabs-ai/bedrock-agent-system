import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DynamicToolRegistry } from './registry/dynamic-tool.registry';
import {
  ToolMetadata,
  ToolValidationResult,
  ToolExecutionContext,
  ToolInstallationConfig,
  ToolSearchCriteria,
  ToolSearchResult,
  ToolConfiguration,
  ToolEvent,
  HealthCheckResult,
} from './interfaces/tool-management.interface';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class DynamicToolService implements OnModuleInit {
  private readonly logger = new Logger(DynamicToolService.name);
  private readonly toolsDirectory = path.join(process.cwd(), 'dynamic-tools');

  constructor(
    private readonly dynamicToolRegistry: DynamicToolRegistry,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    // Ensure tools directory exists
    try {
      await fs.mkdir(this.toolsDirectory, { recursive: true });
      this.logger.log(`Tools directory initialized: ${this.toolsDirectory}`);
    } catch (error: any) {
      this.logger.error('Failed to initialize tools directory:', error);
    }

    // Set up event listeners
    this.setupEventListeners();

    // Load any existing tools
    await this.loadExistingTools();
  }

  private setupEventListeners(): void {
    this.eventEmitter.on('dynamic-tool.event', (event: ToolEvent) => {
      this.logger.debug(`Tool event: ${event.type} for ${event.toolId}`);
      // Additional event processing can be added here
    });
  }

  private async loadExistingTools(): Promise<void> {
    try {
      const toolFiles = await fs.readdir(this.toolsDirectory);
      const metadataFiles = toolFiles.filter(file => file.endsWith('.metadata.json'));

      for (const metadataFile of metadataFiles) {
        try {
          const metadataPath = path.join(this.toolsDirectory, metadataFile);
          const metadataContent = await fs.readFile(metadataPath, 'utf-8');
          const toolMetadata: ToolMetadata = JSON.parse(metadataContent);

          // Validate and register tool
          await this.dynamicToolRegistry.registerToolWithMetadata(toolMetadata);
          this.logger.log(`Loaded existing tool: ${toolMetadata.id}`);
        } catch (error: any) {
          this.logger.error(`Failed to load tool from ${metadataFile}:`, error);
        }
      }
    } catch (error: any) {
      this.logger.error('Failed to load existing tools:', error);
    }
  }

  // Tool installation and management
  async installTool(config: ToolInstallationConfig): Promise<ToolValidationResult> {
    try {
      this.logger.log(`Installing tool from ${config.source}: ${config.location}`);

      // Download/copy tool based on source
      const toolContent = await this.downloadTool(config);
      
      // Parse tool metadata
      const toolMetadata = await this.parseToolMetadata(toolContent, config);
      
      // Validate tool
      const validationResult = await this.validateTool(toolMetadata);
      if (!validationResult.valid) {
        return validationResult;
      }

      // Check for conflicts
      const existingTool = this.dynamicToolRegistry.getToolMetadata(toolMetadata.id);
      if (existingTool) {
        return {
          valid: false,
          errors: [`Tool with ID ${toolMetadata.id} already exists`],
          warnings: [],
          suggestions: ['Use a different ID or uninstall the existing tool first'],
        };
      }

      // Install tool files
      await this.installToolFiles(toolMetadata, toolContent);

      // Register with registry
      const registrationResult = await this.dynamicToolRegistry.registerToolWithMetadata(toolMetadata);

      // Auto-enable if requested
      if (config.autoEnable && registrationResult.valid) {
        await this.enableTool(toolMetadata.id);
      }

      this.logger.log(`Tool installed successfully: ${toolMetadata.id}`);
      return registrationResult;
    } catch (error: any) {
      this.logger.error('Tool installation failed:', error);
      return {
        valid: false,
        errors: [`Installation failed: ${error.message}`],
        warnings: [],
        suggestions: [],
      };
    }
  }

  private async downloadTool(config: ToolInstallationConfig): Promise<any> {
    switch (config.source) {
      case 'local':
        return await this.loadLocalTool(config.location);
      case 'npm':
        return await this.downloadNpmTool(config.location, config.version);
      case 'git':
        return await this.downloadGitTool(config.location);
      case 'registry':
        return await this.downloadRegistryTool(config.location, config.version);
      default:
        throw new Error(`Unsupported tool source: ${config.source}`);
    }
  }

  private async loadLocalTool(location: string): Promise<any> {
    const toolPath = path.resolve(location);
    const content = await fs.readFile(toolPath, 'utf-8');
    return { content, path: toolPath };
  }

  private async downloadNpmTool(packageName: string, version?: string): Promise<any> {
    // Implementation for NPM package download
    // This would use npm/yarn APIs or commands
    throw new Error('NPM tool installation not implemented yet');
  }

  private async downloadGitTool(repository: string): Promise<any> {
    // Implementation for Git repository cloning
    // This would use git commands or libraries
    throw new Error('Git tool installation not implemented yet');
  }

  private async downloadRegistryTool(toolId: string, version?: string): Promise<any> {
    // Implementation for registry tool download
    // This would connect to a tool registry service
    throw new Error('Registry tool installation not implemented yet');
  }

  private async parseToolMetadata(toolContent: any, config: ToolInstallationConfig): Promise<ToolMetadata> {
    // This is a simplified implementation
    // In practice, you'd parse the tool's metadata from its manifest file
    
    const toolId = crypto.randomUUID();
    const now = new Date();

    return {
      id: toolId,
      name: `dynamic-tool-${toolId}`,
      description: 'Dynamically installed tool',
      category: 'dynamic',
      parameters: {
        type: 'object',
        required: [],
        properties: {},
      },
      execute: async (params: any, context?: any) => {
        // This would be the actual tool execution logic
        return { result: 'Tool executed successfully', params };
      },
      version: { major: 1, minor: 0, patch: 0 },
      author: 'Unknown',
      license: 'Unknown',
      keywords: [],
      dependencies: config.dependencies || [],
      permissions: [],
      lifecycle: {
        status: 'installed',
        enabled: false,
        installPath: path.join(this.toolsDirectory, toolId),
        logLevel: 'info',
      },
      security: {
        checksum: config.checksum || crypto.createHash('sha256').update(JSON.stringify(toolContent)).digest('hex'),
        permissions: [],
        sandboxed: true,
        trustedSource: false,
        signature: config.signature,
      },
      createdAt: now,
      updatedAt: now,
    };
  }

  private async installToolFiles(toolMetadata: ToolMetadata, toolContent: any): Promise<void> {
    const toolDir = toolMetadata.lifecycle.installPath!;
    await fs.mkdir(toolDir, { recursive: true });

    // Save tool content
    const toolFilePath = path.join(toolDir, 'tool.js');
    await fs.writeFile(toolFilePath, toolContent.content || JSON.stringify(toolContent));

    // Save metadata
    const metadataPath = path.join(toolDir, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(toolMetadata, null, 2));

    this.logger.log(`Tool files installed to: ${toolDir}`);
  }

  // Tool management operations
  async enableTool(toolId: string): Promise<boolean> {
    return await this.dynamicToolRegistry.enableTool(toolId);
  }

  async disableTool(toolId: string): Promise<boolean> {
    return await this.dynamicToolRegistry.disableTool(toolId);
  }

  async uninstallTool(toolId: string): Promise<boolean> {
    const toolMetadata = this.dynamicToolRegistry.getToolMetadata(toolId);
    if (!toolMetadata) {
      return false;
    }

    // Remove from registry
    const success = await this.dynamicToolRegistry.uninstallTool(toolId);
    
    if (success && toolMetadata.lifecycle.installPath) {
      // Remove tool files
      try {
        await fs.rm(toolMetadata.lifecycle.installPath, { recursive: true, force: true });
        this.logger.log(`Tool files removed: ${toolMetadata.lifecycle.installPath}`);
      } catch (error: any) {
        this.logger.error(`Failed to remove tool files for ${toolId}:`, error);
      }
    }

    return success;
  }

  async reloadTool(toolId: string): Promise<boolean> {
    const toolMetadata = this.dynamicToolRegistry.getToolMetadata(toolId);
    if (!toolMetadata) {
      return false;
    }

    try {
      // Read updated metadata
      const metadataPath = path.join(toolMetadata.lifecycle.installPath!, 'metadata.json');
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      const updatedMetadata: ToolMetadata = JSON.parse(metadataContent);

      // Unregister old tool
      await this.dynamicToolRegistry.uninstallTool(toolId);

      // Register updated tool
      await this.dynamicToolRegistry.registerToolWithMetadata(updatedMetadata);

      this.logger.log(`Tool reloaded successfully: ${toolId}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to reload tool ${toolId}:`, error);
      return false;
    }
  }

  // Tool execution
  async executeTool(toolId: string, parameters: any, context?: any): Promise<any> {
    const toolMetadata = this.dynamicToolRegistry.getToolMetadata(toolId);
    if (!toolMetadata) {
      throw new Error(`Tool ${toolId} not found`);
    }

    const executionContext: ToolExecutionContext = {
      requestId: crypto.randomUUID(),
      timestamp: new Date(),
      permissions: context?.permissions || [],
      environment: process.env.NODE_ENV as any || 'development',
      userId: context?.userId,
      sessionId: context?.sessionId,
    };

    return await this.dynamicToolRegistry.executeTool(toolMetadata.name, parameters, executionContext);
  }

  // Tool health checking
  async getToolHealth(toolId: string): Promise<HealthCheckResult | null> {
    const toolMetadata = this.dynamicToolRegistry.getToolMetadata(toolId);
    if (!toolMetadata || !toolMetadata.healthCheck) {
      return null;
    }

    try {
      return await toolMetadata.healthCheck.healthCheck();
    } catch (error: any) {
      return {
        status: 'unhealthy',
        details: error.message,
        timestamp: new Date(),
      };
    }
  }

  // Tool search and querying
  searchTools(criteria: ToolSearchCriteria): ToolSearchResult {
    return this.dynamicToolRegistry.searchTools(criteria);
  }

  getToolMetadata(toolId: string): ToolMetadata | undefined {
    return this.dynamicToolRegistry.getToolMetadata(toolId);
  }

  getAllToolMetadata(): ToolMetadata[] {
    return this.dynamicToolRegistry.getAllToolMetadata();
  }

  // Configuration management
  setToolConfiguration(toolId: string, configuration: ToolConfiguration): boolean {
    return this.dynamicToolRegistry.setToolConfiguration(toolId, configuration);
  }

  getToolConfiguration(toolId: string): ToolConfiguration | undefined {
    return this.dynamicToolRegistry.getToolConfiguration(toolId);
  }

  // Event and history management
  getEventHistory(toolId?: string, limit: number = 100): ToolEvent[] {
    return this.dynamicToolRegistry.getEventHistory(toolId, limit);
  }

  // Tool validation
  async validateTool(toolMetadata: ToolMetadata): Promise<ToolValidationResult> {
    // This method can be called directly without registering
    return this.dynamicToolRegistry['validateTool'](toolMetadata);
  }

  // System statistics
  getSystemStats(): any {
    return this.dynamicToolRegistry.getSystemStats();
  }

  getToolCategories(): string[] {
    return this.dynamicToolRegistry.getToolCategories();
  }
}