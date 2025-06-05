import { Injectable, Logger } from '@nestjs/common';
import { MCPTool, MCPServerConfig, MCPServiceRegistry } from './interfaces';

/**
 * Base MCP Server implementation that can be extended by specific AWS service servers
 */
@Injectable()
export abstract class BaseMCPServer implements MCPServiceRegistry {
  protected readonly logger = new Logger(this.constructor.name);
  protected readonly tools = new Map<string, MCPTool>();

  constructor(protected readonly config: MCPServerConfig) {
    this.logger.log(`Initializing MCP Server: ${config.name} v${config.version}`);
  }

  /**
   * Register a tool with the MCP server
   */
  registerTool(tool: MCPTool): void {
    this.tools.set(tool.name, tool);
    this.logger.log(`Registered tool: ${tool.name}`);
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): MCPTool | undefined {
    return this.tools.get(name);
  }

  /**
   * List all available tools
   */
  listTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Execute a tool by name with parameters
   */
  async executeTool(name: string, params: any): Promise<any> {
    const tool = this.getTool(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    try {
      this.logger.debug(`Executing tool: ${name} with params:`, params);
      const result = await tool.execute(params);
      this.logger.debug(`Tool ${name} executed successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Tool ${name} execution failed:`, error);
      throw error;
    }
  }

  /**
   * Get server info for MCP protocol
   */
  getServerInfo() {
    return {
      name: this.config.name,
      description: this.config.description,
      version: this.config.version,
      tools: this.listTools().map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }))
    };
  }

  /**
   * Initialize the server - to be implemented by subclasses
   */
  abstract initialize(): Promise<void>;

  /**
   * Cleanup resources when server shuts down
   */
  async cleanup(): Promise<void> {
    this.logger.log(`Cleaning up MCP Server: ${this.config.name}`);
    this.tools.clear();
  }
}