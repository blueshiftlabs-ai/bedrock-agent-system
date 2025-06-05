import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { MCPServerInfo } from './mcp-server-discovery.service';
import { getErrorMessage } from '../../common/utils/error.utils';

export interface MCPTool {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  status: 'active' | 'inactive' | 'error';
  serverId: string;
  lastUsed?: Date;
  usageCount: number;
  config: {
    timeout: number;
    retryAttempts: number;
    rateLimitPerMinute?: number;
    requiredPermissions: string[];
    dependencies: string[];
  };
  schema: {
    inputs: Record<string, ToolParameter>;
    outputs: Record<string, ToolParameter>;
  };
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: any;
  enum?: any[];
  format?: string;
}

export interface ToolExecutionResult {
  toolId: string;
  serverId: string;
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
  timestamp: Date;
}

@Injectable()
export class MCPToolRegistryService {
  private readonly logger = new Logger(MCPToolRegistryService.name);
  private registeredTools = new Map<string, MCPTool>();
  private toolsByServer = new Map<string, Set<string>>();
  private executionHistory = new Map<string, ToolExecutionResult[]>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly httpService: HttpService,
  ) {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Listen for tool discovery requests
    this.eventEmitter.on('mcp.tools.discover', this.handleToolDiscovery.bind(this));
    
    // Listen for server unregistration
    this.eventEmitter.on('mcp.server.unregistered', this.handleServerUnregistered.bind(this));
    
    // Listen for WebSocket tool requests
    this.eventEmitter.on('websocket.get_tools', this.handleGetTools.bind(this));
    this.eventEmitter.on('websocket.tool_action', this.handleToolAction.bind(this));
    
    this.logger.log('Tool registry event listeners established');
  }

  private async handleToolDiscovery(data: { serverId: string; serverInfo: MCPServerInfo }) {
    try {
      await this.discoverToolsFromServer(data.serverId, data.serverInfo);
    } catch (error) {
      this.logger.error(`Failed to discover tools from server ${data.serverId}: ${getErrorMessage(error)}`);
    }
  }

  private handleServerUnregistered(data: { serverId: string }) {
    this.removeServerTools(data.serverId);
  }

  private handleGetTools(data: { clientId: string }) {
    const tools = Array.from(this.registeredTools.values());
    
    this.eventEmitter.emit('websocket.send_to_client', {
      clientId: data.clientId,
      event: 'tool_list',
      data: tools,
    });
  }

  private async handleToolAction(data: { 
    clientId: string; 
    toolId: string; 
    action: 'activate' | 'deactivate' | 'test' 
  }) {
    try {
      const result = await this.executeToolAction(data.toolId, data.action);
      
      this.eventEmitter.emit('websocket.send_to_client', {
        clientId: data.clientId,
        event: 'tool_action_result',
        data: { toolId: data.toolId, action: data.action, result },
      });
    } catch (error) {
      this.eventEmitter.emit('websocket.send_to_client', {
        clientId: data.clientId,
        event: 'tool_action_error',
        data: { toolId: data.toolId, action: data.action, error: getErrorMessage(error) },
      });
    }
  }

  private async discoverToolsFromServer(serverId: string, serverInfo: MCPServerInfo) {
    try {
      this.logger.log(`Discovering tools from server: ${serverInfo.name}`);
      
      // Make request to server's tools endpoint
      const toolsUrl = `${serverInfo.url}/tools`;
      const response = await firstValueFrom(
        this.httpService.get(toolsUrl, {
          timeout: 10000,
          headers: serverInfo.config.authToken ? {
            'Authorization': `Bearer ${serverInfo.config.authToken}`,
          } : {},
        })
      );

      if (response.status === 200 && response.data) {
        const tools = response.data.tools || response.data;
        
        if (Array.isArray(tools)) {
          await this.registerToolsFromServer(serverId, tools);
          this.logger.log(`Discovered ${tools.length} tools from server: ${serverInfo.name}`);
        } else {
          this.logger.warn(`Invalid tools response from server ${serverInfo.name}`);
        }
      }
    } catch (error) {
      // Try alternative MCP protocol endpoint
      try {
        await this.discoverToolsViaMCPProtocol(serverId, serverInfo);
      } catch (mcpError) {
        this.logger.error(`Failed to discover tools from server ${serverInfo.name}: ${getErrorMessage(error)}`);
        
        // Emit log event
        this.eventEmitter.emit('mcp.server.log', {
          level: 'error',
          message: `Tool discovery failed: ${getErrorMessage(error)}`,
          source: 'tool-registry',
          serverId,
        });
      }
    }
  }

  private async discoverToolsViaMCPProtocol(serverId: string, serverInfo: MCPServerInfo) {
    // Try MCP protocol endpoint
    const mcpUrl = `${serverInfo.url}/mcp`;
    const mcpRequest = {
      jsonrpc: '2.0',
      id: `tools-discovery-${Date.now()}`,
      method: 'tools/list',
      params: {},
    };

    const response = await firstValueFrom(
      this.httpService.post(mcpUrl, mcpRequest, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          ...(serverInfo.config.authToken ? {
            'Authorization': `Bearer ${serverInfo.config.authToken}`,
          } : {}),
        },
      })
    );

    if (response.status === 200 && response.data?.result?.tools) {
      await this.registerToolsFromServer(serverId, response.data.result.tools);
      this.logger.log(`Discovered tools via MCP protocol from server: ${serverInfo.name}`);
    }
  }

  private async registerToolsFromServer(serverId: string, toolsData: any[]) {
    const serverTools = new Set<string>();

    for (const toolData of toolsData) {
      try {
        const tool = this.mapToolData(serverId, toolData);
        
        this.registeredTools.set(tool.id, tool);
        serverTools.add(tool.id);
        
        // Emit tool registration event
        this.eventEmitter.emit('tool.update', tool);
        
        this.logger.debug(`Registered tool: ${tool.name} from server ${serverId}`);
      } catch (error) {
        this.logger.error(`Failed to register tool from server ${serverId}: ${getErrorMessage(error)}`);
      }
    }

    // Update server tools mapping
    this.toolsByServer.set(serverId, serverTools);
  }

  private mapToolData(serverId: string, toolData: any): MCPTool {
    const toolId = `${serverId}-${toolData.name || toolData.id}`;
    
    return {
      id: toolId,
      name: toolData.name || toolData.id,
      description: toolData.description || 'No description available',
      category: toolData.category || 'general',
      version: toolData.version || '1.0.0',
      status: 'active',
      serverId,
      usageCount: 0,
      config: {
        timeout: toolData.timeout || 30000,
        retryAttempts: toolData.retryAttempts || 1,
        rateLimitPerMinute: toolData.rateLimitPerMinute,
        requiredPermissions: toolData.requiredPermissions || [],
        dependencies: toolData.dependencies || [],
      },
      schema: {
        inputs: this.mapToolSchema(toolData.inputSchema || toolData.schema?.inputs || {}),
        outputs: this.mapToolSchema(toolData.outputSchema || toolData.schema?.outputs || {}),
      },
    };
  }

  private mapToolSchema(schemaData: any): Record<string, ToolParameter> {
    const schema: Record<string, ToolParameter> = {};
    
    if (schemaData.properties) {
      for (const [name, prop] of Object.entries(schemaData.properties as any)) {
        schema[name] = {
          type: (prop as any).type || 'string',
          description: (prop as any).description || '',
          required: schemaData.required?.includes(name) || false,
          default: (prop as any).default,
          enum: (prop as any).enum,
          format: (prop as any).format,
        };
      }
    }
    
    return schema;
  }

  private removeServerTools(serverId: string) {
    const serverTools = this.toolsByServer.get(serverId);
    if (!serverTools) return;

    for (const toolId of serverTools) {
      this.registeredTools.delete(toolId);
      this.executionHistory.delete(toolId);
      
      // Emit tool removal event
      this.eventEmitter.emit('tool.removed', { toolId, serverId });
    }

    this.toolsByServer.delete(serverId);
    this.logger.log(`Removed ${serverTools.size} tools from server: ${serverId}`);
  }

  private async executeToolAction(toolId: string, action: 'activate' | 'deactivate' | 'test'): Promise<any> {
    const tool = this.registeredTools.get(toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} not found`);
    }

    switch (action) {
      case 'activate':
        return await this.activateTool(tool);
      case 'deactivate':
        return await this.deactivateTool(tool);
      case 'test':
        return await this.testTool(tool);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private async activateTool(tool: MCPTool): Promise<any> {
    tool.status = 'active';
    this.registeredTools.set(tool.id, tool);
    
    // Emit tool update
    this.eventEmitter.emit('tool.update', tool);
    
    return { success: true, message: `Tool ${tool.name} activated` };
  }

  private async deactivateTool(tool: MCPTool): Promise<any> {
    tool.status = 'inactive';
    this.registeredTools.set(tool.id, tool);
    
    // Emit tool update
    this.eventEmitter.emit('tool.update', tool);
    
    return { success: true, message: `Tool ${tool.name} deactivated` };
  }

  private async testTool(tool: MCPTool): Promise<any> {
    try {
      // Execute a test call to the tool
      const result = await this.executeTool(tool.id, {});
      return { success: true, message: 'Tool test successful', result };
    } catch (error) {
      return { success: false, message: `Tool test failed: ${getErrorMessage(error)}` };
    }
  }

  // Public methods
  public async executeTool(toolId: string, params: any): Promise<ToolExecutionResult> {
    const tool = this.registeredTools.get(toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} not found`);
    }

    if (tool.status !== 'active') {
      throw new Error(`Tool ${toolId} is not active`);
    }

    const startTime = Date.now();
    const timestamp = new Date();

    try {
      // Make request to the server's tool execution endpoint
      const serverInfo = await this.getServerInfo(tool.serverId);
      if (!serverInfo) {
        throw new Error(`Server ${tool.serverId} not found`);
      }

      const executionUrl = `${serverInfo.url}/tools/${tool.name}/execute`;
      const response = await firstValueFrom(
        this.httpService.post(executionUrl, { params }, {
          timeout: tool.config.timeout,
          headers: serverInfo.config.authToken ? {
            'Authorization': `Bearer ${serverInfo.config.authToken}`,
          } : {},
        })
      );

      const executionTime = Date.now() - startTime;
      
      const result: ToolExecutionResult = {
        toolId,
        serverId: tool.serverId,
        success: true,
        result: response.data,
        executionTime,
        timestamp,
      };

      // Update tool usage
      tool.usageCount++;
      tool.lastUsed = timestamp;
      this.registeredTools.set(toolId, tool);

      // Store execution history
      this.addExecutionHistory(toolId, result);

      // Emit tool execution event
      this.eventEmitter.emit('tool.executed', result);

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      const result: ToolExecutionResult = {
        toolId,
        serverId: tool.serverId,
        success: false,
        error: getErrorMessage(error),
        executionTime,
        timestamp,
      };

      // Store execution history
      this.addExecutionHistory(toolId, result);

      // Emit tool execution error event
      this.eventEmitter.emit('tool.execution_failed', result);

      throw error;
    }
  }

  private async getServerInfo(serverId: string): Promise<MCPServerInfo | null> {
    // This would typically come from the discovery service
    // For now, we'll emit a request and wait for response
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 1000);
      
      this.eventEmitter.once(`server.info.${serverId}`, (serverInfo) => {
        clearTimeout(timeout);
        resolve(serverInfo);
      });
      
      this.eventEmitter.emit('server.info.request', { serverId });
    });
  }

  private addExecutionHistory(toolId: string, result: ToolExecutionResult) {
    if (!this.executionHistory.has(toolId)) {
      this.executionHistory.set(toolId, []);
    }

    const history = this.executionHistory.get(toolId);
    history.push(result);

    // Keep only last 50 executions
    if (history.length > 50) {
      this.executionHistory.set(toolId, history.slice(-50));
    }
  }

  // Public getter methods
  public getAllTools(): MCPTool[] {
    return Array.from(this.registeredTools.values());
  }

  public getToolById(toolId: string): MCPTool | undefined {
    return this.registeredTools.get(toolId);
  }

  public getToolsByServer(serverId: string): MCPTool[] {
    const serverTools = this.toolsByServer.get(serverId);
    if (!serverTools) return [];

    return Array.from(serverTools)
      .map(toolId => this.registeredTools.get(toolId))
      .filter(tool => tool !== undefined);
  }

  public getToolsByCategory(category: string): MCPTool[] {
    return Array.from(this.registeredTools.values())
      .filter(tool => tool.category === category);
  }

  public getActiveTools(): MCPTool[] {
    return Array.from(this.registeredTools.values())
      .filter(tool => tool.status === 'active');
  }

  public getToolCategories(): string[] {
    const categories = new Set<string>();
    for (const tool of this.registeredTools.values()) {
      categories.add(tool.category);
    }
    return Array.from(categories);
  }

  public getExecutionHistory(toolId: string): ToolExecutionResult[] {
    return this.executionHistory.get(toolId) || [];
  }

  public getToolStats() {
    const tools = Array.from(this.registeredTools.values());
    const totalTools = tools.length;
    const activeTools = tools.filter(t => t.status === 'active').length;
    const totalExecutions = tools.reduce((sum, t) => sum + t.usageCount, 0);
    const categories = this.getToolCategories().length;

    return {
      totalTools,
      activeTools,
      totalExecutions,
      categories,
      serversWithTools: this.toolsByServer.size,
    };
  }
}