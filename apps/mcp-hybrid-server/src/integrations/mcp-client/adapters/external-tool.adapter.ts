import { Injectable, Logger } from '@nestjs/common';
import { MCPTool, MCPToolParameterSchema } from '../../../tools/registry/tool.registry';
import { MCPToolDefinition, ExternalToolMetadata } from '../types/mcp-protocol.types';
import { MCPClientService } from '../services/mcp-client.service';

export interface ExternalMCPTool extends MCPTool {
  metadata: ExternalToolMetadata;
}

@Injectable()
export class ExternalToolAdapter {
  private readonly logger = new Logger(ExternalToolAdapter.name);

  constructor(private readonly mcpClient: MCPClientService) {}

  /**
   * Converts an external MCP tool definition to a local MCPTool interface
   */
  adaptExternalTool(
    toolDefinition: MCPToolDefinition,
    connectionId: string,
    serverName: string
  ): ExternalMCPTool {
    const adaptedTool: ExternalMCPTool = {
      name: this.generateUniqueName(toolDefinition.name, serverName),
      description: `[External: ${serverName}] ${toolDefinition.description}`,
      category: 'external',
      parameters: this.adaptParameterSchema(toolDefinition.inputSchema),
      execute: this.createExecuteFunction(toolDefinition.name, connectionId),
      timeout: 60000, // 60 second timeout for external tools
      retryable: true,
      cacheable: false, // External tools are not cached by default
      metadata: {
        sourceServer: serverName,
        sourceServerId: connectionId,
        originalName: toolDefinition.name,
        isExternal: true,
        lastUpdated: new Date(),
      },
    };

    return adaptedTool;
  }

  /**
   * Batch adapt multiple tools from a server
   */
  adaptMultipleTools(
    toolDefinitions: MCPToolDefinition[],
    connectionId: string,
    serverName: string
  ): ExternalMCPTool[] {
    return toolDefinitions.map(toolDef => 
      this.adaptExternalTool(toolDef, connectionId, serverName)
    );
  }

  /**
   * Updates an existing external tool with new definition
   */
  updateExternalTool(
    existingTool: ExternalMCPTool,
    newDefinition: MCPToolDefinition
  ): ExternalMCPTool {
    return {
      ...existingTool,
      description: `[External: ${existingTool.metadata.sourceServer}] ${newDefinition.description}`,
      parameters: this.adaptParameterSchema(newDefinition.inputSchema),
      metadata: {
        ...existingTool.metadata,
        lastUpdated: new Date(),
      },
    };
  }

  /**
   * Checks if a tool is an external tool
   */
  isExternalTool(tool: MCPTool): tool is ExternalMCPTool {
    return 'metadata' in tool && (tool as ExternalMCPTool).metadata?.isExternal === true;
  }

  /**
   * Gets the original tool name from an external tool
   */
  getOriginalToolName(tool: ExternalMCPTool): string {
    return tool.metadata.originalName;
  }

  /**
   * Gets the server info for an external tool
   */
  getServerInfo(tool: ExternalMCPTool): { serverId: string; serverName: string } {
    return {
      serverId: tool.metadata.sourceServerId,
      serverName: tool.metadata.sourceServer,
    };
  }

  private generateUniqueName(toolName: string, serverName: string): string {
    // Create a unique name by prefixing with server name
    const sanitizedServerName = serverName.replace(/[^a-zA-Z0-9]/g, '_');
    return `${sanitizedServerName}_${toolName}`;
  }

  private adaptParameterSchema(inputSchema: any): MCPToolParameterSchema {
    // Convert MCP tool input schema to our internal format
    const adaptedSchema: MCPToolParameterSchema = {
      type: inputSchema.type || 'object',
      required: inputSchema.required || [],
      properties: {},
    };

    if (inputSchema.properties) {
      for (const [propName, propDef] of Object.entries(inputSchema.properties as Record<string, any>)) {
        adaptedSchema.properties[propName] = {
          type: propDef.type || 'string',
          description: propDef.description || '',
          required: adaptedSchema.required.includes(propName),
          enum: propDef.enum,
          default: propDef.default,
        };
      }
    }

    return adaptedSchema;
  }

  private createExecuteFunction(
    originalToolName: string,
    connectionId: string
  ): (params: any, context?: any) => Promise<any> {
    return async (params: any, context?: any): Promise<any> => {
      try {
        this.logger.log(`Executing external tool: ${originalToolName} on server: ${connectionId}`);
        
        // Check if connection is still active
        const connection = this.mcpClient.getConnection(connectionId);
        if (!connection || connection.status !== 'connected') {
          throw new Error(`MCP server connection ${connectionId} is not available`);
        }

        // Call the external tool
        const result = await this.mcpClient.callTool(connectionId, originalToolName, params);
        
        this.logger.log(`External tool executed successfully: ${originalToolName}`);
        
        // Wrap result with metadata
        return {
          result,
          executedAt: new Date().toISOString(),
          sourceServer: connection.name,
          originalToolName,
          executionContext: context ? { ...context, external: true } : { external: true },
        };
      } catch (error: any) {
        this.logger.error(`External tool execution failed: ${originalToolName}:`, error);
        throw new Error(`External tool execution failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
  }
}