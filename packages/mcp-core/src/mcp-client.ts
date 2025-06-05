import { Injectable, Logger } from '@nestjs/common';
import { MCPClientConfig, MCPTool } from './interfaces';

/**
 * MCP Client for connecting to containerized MCP servers
 */
@Injectable()
export class MCPClient {
  private readonly logger = new Logger(MCPClient.name);

  constructor(private readonly config: MCPClientConfig) {}

  /**
   * Execute a tool on the remote MCP server
   */
  async executeTool(toolName: string, params: any): Promise<any> {
    try {
      this.logger.debug(`Executing tool ${toolName} on ${this.config.serverUrl}`);
      
      const response = await fetch(`${this.config.serverUrl}/mcp/tools/${toolName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      this.logger.debug(`Tool ${toolName} executed successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to execute tool ${toolName}:`, error);
      throw error;
    }
  }

  /**
   * List available tools on the remote server
   */
  async listTools(): Promise<MCPTool[]> {
    try {
      const response = await fetch(`${this.config.serverUrl}/mcp/tools`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.error('Failed to list tools:', error);
      throw error;
    }
  }

  /**
   * Get server information
   */
  async getServerInfo(): Promise<any> {
    try {
      const response = await fetch(`${this.config.serverUrl}/mcp/info`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.error('Failed to get server info:', error);
      throw error;
    }
  }

  /**
   * Health check for the remote server
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.serverUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.config.timeout || 5000),
      });
      
      return response.ok;
    } catch (error) {
      this.logger.warn(`Health check failed for ${this.config.serverUrl}:`, error);
      return false;
    }
  }
}