import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  MCPConnection,
  MCPServerConfig,
  MCPRequest,
  MCPResponse,
  MCPNotification,
  MCPMethod,
  MCPTransport,
  MCPToolDefinition,
  MCPServerInfo,
} from '../types/mcp-protocol.types';
import { StdioTransport } from '../transports/stdio.transport';
import { HttpTransport } from '../transports/http.transport';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MCPClientService implements OnModuleDestroy {
  private readonly logger = new Logger(MCPClientService.name);
  private connections: Map<string, MCPConnection> = new Map();
  private pendingRequests: Map<string, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private requestCounter = 0;

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async onModuleDestroy() {
    await this.disconnectAll();
  }

  async connect(config: MCPServerConfig): Promise<MCPConnection> {
    this.logger.log(`Connecting to MCP server: ${config.name}`);

    if (this.connections.has(config.id)) {
      await this.disconnect(config.id);
    }

    const transport = this.createTransport(config);
    const connection: MCPConnection = {
      id: config.id,
      name: config.name,
      transport,
      status: 'connecting',
      createdAt: new Date(),
    };

    this.connections.set(config.id, connection);

    try {
      // Set up transport event handlers
      transport.onMessage((message) => this.handleMessage(connection.id, message));
      transport.onError((error) => this.handleTransportError(connection.id, error));
      transport.onClose(() => this.handleTransportClose(connection.id));

      // Connect transport if needed
      if ('connect' in transport && typeof transport.connect === 'function') {
        await (transport as any).connect();
      }

      // Initialize MCP session
      const serverInfo = await this.initialize(connection.id);
      connection.serverInfo = serverInfo;
      connection.status = 'connected';

      this.logger.log(`Successfully connected to MCP server: ${config.name}`);
      this.eventEmitter.emit('mcp.connection.established', { connectionId: config.id, serverInfo });

      return connection;
    } catch (error) {
      connection.status = 'error';
      connection.lastError = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to connect to MCP server ${config.name}:`, error);
      this.eventEmitter.emit('mcp.connection.failed', { connectionId: config.id, error });
      throw error;
    }
  }

  async disconnect(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    this.logger.log(`Disconnecting from MCP server: ${connection.name}`);

    try {
      // Send shutdown request if connected
      if (connection.status === 'connected') {
        await this.sendRequest(connectionId, MCPMethod.SHUTDOWN, {});
      }
    } catch (error) {
      this.logger.warn('Error during shutdown:', error);
    }

    try {
      await connection.transport.close();
    } catch (error) {
      this.logger.warn('Error closing transport:', error);
    }

    connection.status = 'disconnected';
    this.connections.delete(connectionId);
    this.eventEmitter.emit('mcp.connection.closed', { connectionId });
  }

  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.connections.keys()).map(id => this.disconnect(id));
    await Promise.all(disconnectPromises);
  }

  getConnection(connectionId: string): MCPConnection | undefined {
    return this.connections.get(connectionId);
  }

  getAllConnections(): MCPConnection[] {
    return Array.from(this.connections.values());
  }

  getConnectedServers(): MCPConnection[] {
    return Array.from(this.connections.values()).filter(conn => conn.status === 'connected');
  }

  async listTools(connectionId: string): Promise<MCPToolDefinition[]> {
    const response = await this.sendRequest(connectionId, MCPMethod.TOOLS_LIST, {});
    return response.tools || [];
  }

  async callTool(connectionId: string, toolName: string, parameters: any): Promise<any> {
    const response = await this.sendRequest(connectionId, MCPMethod.TOOLS_CALL, {
      name: toolName,
      arguments: parameters,
    });
    return response.content || response.result;
  }

  async listPrompts(connectionId: string): Promise<any[]> {
    const response = await this.sendRequest(connectionId, MCPMethod.PROMPTS_LIST, {});
    return response.prompts || [];
  }

  async getPrompt(connectionId: string, promptName: string, arguments?: any): Promise<any> {
    const response = await this.sendRequest(connectionId, MCPMethod.PROMPTS_GET, {
      name: promptName,
      arguments,
    });
    return response;
  }

  async listResources(connectionId: string): Promise<any[]> {
    const response = await this.sendRequest(connectionId, MCPMethod.RESOURCES_LIST, {});
    return response.resources || [];
  }

  async readResource(connectionId: string, uri: string): Promise<any> {
    const response = await this.sendRequest(connectionId, MCPMethod.RESOURCES_READ, { uri });
    return response;
  }

  private async initialize(connectionId: string): Promise<MCPServerInfo> {
    const response = await this.sendRequest(connectionId, MCPMethod.INITIALIZE, {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: true,
        prompts: true,
        resources: true,
      },
      clientInfo: {
        name: 'mcp-hybrid-server',
        version: '1.0.0',
      },
    });

    return response;
  }

  private async sendRequest(connectionId: string, method: string, params: any): Promise<any> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    if (connection.status !== 'connected' && method !== MCPMethod.INITIALIZE) {
      throw new Error(`Connection ${connectionId} is not connected`);
    }

    const requestId = `req_${++this.requestCounter}`;
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: requestId,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${method}`));
      }, 30000); // 30 second timeout

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      connection.transport.send(request).catch(error => {
        this.pendingRequests.delete(requestId);
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private createTransport(config: MCPServerConfig): MCPTransport {
    switch (config.transport) {
      case 'stdio':
        if (!config.command) {
          throw new Error('Command is required for stdio transport');
        }
        return new StdioTransport({
          command: config.command,
          args: config.args,
          env: config.env,
        });
      
      case 'http':
        if (!config.url) {
          throw new Error('URL is required for HTTP transport');
        }
        return new HttpTransport({
          url: config.url,
          headers: config.headers,
        });
      
      default:
        throw new Error(`Unsupported transport: ${config.transport}`);
    }
  }

  private handleMessage(connectionId: string, message: MCPResponse | MCPNotification): void {
    if ('id' in message) {
      // This is a response to a request
      const pending = this.pendingRequests.get(String(message.id));
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(String(message.id));

        if (message.error) {
          pending.reject(new Error(`MCP Error: ${message.error.message}`));
        } else {
          pending.resolve(message.result);
        }
      }
    } else {
      // This is a notification
      this.handleNotification(connectionId, message);
    }
  }

  private handleNotification(connectionId: string, notification: MCPNotification): void {
    this.logger.debug(`Received notification from ${connectionId}: ${notification.method}`);
    this.eventEmitter.emit('mcp.notification', { connectionId, notification });
  }

  private handleTransportError(connectionId: string, error: Error): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.status = 'error';
      connection.lastError = error.message;
      this.logger.error(`Transport error for connection ${connectionId}:`, error);
      this.eventEmitter.emit('mcp.connection.error', { connectionId, error });
    }
  }

  private handleTransportClose(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.status = 'disconnected';
      this.logger.log(`Transport closed for connection ${connectionId}`);
      this.eventEmitter.emit('mcp.connection.lost', { connectionId });
    }
  }
}