import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MCPClientService } from './mcp-client.service';
import { ExternalToolAdapter, ExternalMCPTool } from '../adapters/external-tool.adapter';
import { MCPToolRegistry } from '../../../tools/registry/tool.registry';
import { MCPConnection, MCPToolDefinition } from '../types/mcp-protocol.types';

export interface ToolDiscoveryResult {
  connectionId: string;
  serverName: string;
  tools: MCPToolDefinition[];
  discoveredAt: Date;
  status: 'success' | 'error';
  error?: string;
}

@Injectable()
export class ToolDiscoveryService {
  private readonly logger = new Logger(ToolDiscoveryService.name);
  private lastDiscoveryRun: Date | null = null;
  private discoveryInProgress = false;

  constructor(
    private readonly mcpClient: MCPClientService,
    private readonly toolAdapter: ExternalToolAdapter,
    private readonly toolRegistry: MCPToolRegistry,
    private readonly eventEmitter: EventEmitter2
  ) {
    // Listen for connection events to trigger discovery
    this.eventEmitter.on('mcp.connection.established', this.handleConnectionEstablished.bind(this));
    this.eventEmitter.on('mcp.connection.lost', this.handleConnectionLost.bind(this));
  }

  /**
   * Discovers tools from all connected MCP servers
   */
  async discoverAllTools(): Promise<ToolDiscoveryResult[]> {
    this.logger.log('Starting tool discovery for all connected servers');
    this.discoveryInProgress = true;

    const connections = this.mcpClient.getConnectedServers();
    const results: ToolDiscoveryResult[] = [];

    for (const connection of connections) {
      const result = await this.discoverToolsFromConnection(connection);
      results.push(result);
    }

    this.lastDiscoveryRun = new Date();
    this.discoveryInProgress = false;

    this.logger.log(`Tool discovery completed. Processed ${results.length} servers`);
    this.eventEmitter.emit('mcp.tools.discovery.completed', { results });

    return results;
  }

  /**
   * Discovers tools from a specific MCP server connection
   */
  async discoverToolsFromConnection(connection: MCPConnection): Promise<ToolDiscoveryResult> {
    const result: ToolDiscoveryResult = {
      connectionId: connection.id,
      serverName: connection.name,
      tools: [],
      discoveredAt: new Date(),
      status: 'error',
    };

    try {
      this.logger.log(`Discovering tools from server: ${connection.name}`);
      
      const tools = await this.mcpClient.listTools(connection.id);
      result.tools = tools;
      result.status = 'success';

      // Register discovered tools
      await this.registerDiscoveredTools(tools, connection);

      this.logger.log(`Discovered ${tools.length} tools from ${connection.name}`);
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to discover tools from ${connection.name}:`, error);
    }

    return result;
  }

  /**
   * Refreshes tools from a specific server
   */
  async refreshServerTools(connectionId: string): Promise<ToolDiscoveryResult> {
    const connection = this.mcpClient.getConnection(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    // First, unregister existing tools from this server
    await this.unregisterServerTools(connectionId);

    // Then discover and register new tools
    return await this.discoverToolsFromConnection(connection);
  }

  /**
   * Gets the last discovery run time
   */
  getLastDiscoveryRun(): Date | null {
    return this.lastDiscoveryRun;
  }

  /**
   * Checks if discovery is currently in progress
   */
  isDiscoveryInProgress(): boolean {
    return this.discoveryInProgress;
  }

  /**
   * Gets external tools by server
   */
  getExternalToolsByServer(connectionId: string): ExternalMCPTool[] {
    const allTools = this.toolRegistry.getAllTools();
    return allTools
      .filter(tool => this.toolAdapter.isExternalTool(tool))
      .filter(tool => (tool as ExternalMCPTool).metadata.sourceServerId === connectionId) as ExternalMCPTool[];
  }

  /**
   * Gets all external tools
   */
  getAllExternalTools(): ExternalMCPTool[] {
    const allTools = this.toolRegistry.getAllTools();
    return allTools
      .filter(tool => this.toolAdapter.isExternalTool(tool)) as ExternalMCPTool[];
  }

  /**
   * Scheduled tool discovery (every hour)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async scheduledDiscovery(): Promise<void> {
    if (this.discoveryInProgress) {
      this.logger.log('Tool discovery already in progress, skipping scheduled run');
      return;
    }

    this.logger.log('Running scheduled tool discovery');
    try {
      await this.discoverAllTools();
    } catch (error) {
      this.logger.error('Scheduled tool discovery failed:', error);
    }
  }

  private async registerDiscoveredTools(
    tools: MCPToolDefinition[],
    connection: MCPConnection
  ): Promise<void> {
    const adaptedTools = this.toolAdapter.adaptMultipleTools(
      tools,
      connection.id,
      connection.name
    );

    for (const adaptedTool of adaptedTools) {
      try {
        this.toolRegistry.registerTool(adaptedTool);
        this.logger.debug(`Registered external tool: ${adaptedTool.name}`);
      } catch (error) {
        this.logger.error(`Failed to register tool ${adaptedTool.name}:`, error);
      }
    }

    this.eventEmitter.emit('mcp.tools.registered', {
      connectionId: connection.id,
      serverName: connection.name,
      toolCount: adaptedTools.length,
    });
  }

  private async unregisterServerTools(connectionId: string): Promise<void> {
    const externalTools = this.getExternalToolsByServer(connectionId);
    
    for (const tool of externalTools) {
      try {
        // We need to add an unregister method to the tool registry
        this.unregisterTool(tool.name);
        this.logger.debug(`Unregistered external tool: ${tool.name}`);
      } catch (error) {
        this.logger.error(`Failed to unregister tool ${tool.name}:`, error);
      }
    }

    this.logger.log(`Unregistered ${externalTools.length} tools from server ${connectionId}`);
  }

  private unregisterTool(toolName: string): void {
    this.toolRegistry.unregisterTool(toolName);
  }

  private async handleConnectionEstablished(event: { connectionId: string; serverInfo: any }): Promise<void> {
    this.logger.log(`Connection established: ${event.connectionId}, starting tool discovery`);
    
    try {
      const connection = this.mcpClient.getConnection(event.connectionId);
      if (connection) {
        await this.discoverToolsFromConnection(connection);
      }
    } catch (error) {
      this.logger.error(`Failed to discover tools after connection established:`, error);
    }
  }

  private async handleConnectionLost(event: { connectionId: string }): Promise<void> {
    this.logger.log(`Connection lost: ${event.connectionId}, unregistering tools`);
    
    try {
      await this.unregisterServerTools(event.connectionId);
    } catch (error) {
      this.logger.error(`Failed to unregister tools after connection lost:`, error);
    }
  }
}