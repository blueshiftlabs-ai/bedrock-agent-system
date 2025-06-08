import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { MCPClientResponse, MCPServerConfig } from '../types/memory.types';

@Injectable()
export class MCPClientService {
  private readonly logger = new Logger(MCPClientService.name);
  private readonly clients: Map<string, AxiosInstance> = new Map();
  private readonly serverConfigs: Map<string, MCPServerConfig> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.initializeClients();
  }

  private initializeClients() {
    const servers: MCPServerConfig[] = [
      {
        name: 'opensearch',
        endpoint: this.configService.get('OPENSEARCH_MCP_ENDPOINT'),
        capabilities: ['vector-search', 'document-indexing', 'similarity-search'],
        health_endpoint: '/opensearch/health',
        timeout: 30000,
      },
      {
        name: 'database',
        endpoint: this.configService.get('DATABASE_MCP_ENDPOINT'),
        capabilities: ['document-storage', 'sql-queries', 'metadata-management'],
        health_endpoint: '/database/health',
        timeout: 15000,
      },
      {
        name: 'graph',
        endpoint: this.configService.get('GRAPH_MCP_ENDPOINT'),
        capabilities: ['graph-storage', 'relationships', 'cypher-queries'],
        health_endpoint: '/graph/health',
        timeout: 20000,
      },
    ];

    for (const config of servers) {
      if (config.endpoint) {
        this.serverConfigs.set(config.name, config);
        
        const client = axios.create({
          baseURL: config.endpoint,
          timeout: config.timeout || 15000,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        // Add request/response interceptors for logging
        client.interceptors.request.use(
          (request) => {
            this.logger.debug(`MCP Request [${config.name}]: ${request.method?.toUpperCase()} ${request.url}`);
            return request;
          },
          (error) => {
            this.logger.error(`MCP Request Error [${config.name}]:`, error);
            return Promise.reject(error);
          }
        );

        client.interceptors.response.use(
          (response) => {
            this.logger.debug(`MCP Response [${config.name}]: ${response.status}`);
            return response;
          },
          (error) => {
            this.logger.error(`MCP Response Error [${config.name}]:`, error.message);
            return Promise.reject(error);
          }
        );

        this.clients.set(config.name, client);
        this.logger.log(`Initialized MCP client for ${config.name}: ${config.endpoint}`);
      } else {
        this.logger.warn(`No endpoint configured for MCP server: ${config.name}`);
      }
    }
  }

  async callMCPTool<T = any>(
    serverName: string,
    toolName: string,
    parameters: Record<string, any> = {},
    requestId: string | number = Date.now()
  ): Promise<T> {
    const client = this.clients.get(serverName);
    const config = this.serverConfigs.get(serverName);

    if (!client || !config) {
      throw new Error(`MCP server not found or not configured: ${serverName}`);
    }

    try {
      const mcpRequest = {
        jsonrpc: '2.0',
        id: requestId,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: parameters,
        },
      };

      this.logger.debug(`Calling MCP tool [${serverName}]: ${toolName}`, parameters);

      // Use the namespaced MCP endpoint
      const mcpPath = serverName === 'opensearch' ? '/opensearch/mcp' : 
                      serverName === 'database' ? '/database/mcp' : 
                      serverName === 'graph' ? '/graph/mcp' : '/mcp';
      
      const response = await client.post(mcpPath, mcpRequest);
      const mcpResponse: MCPClientResponse<T> = response.data;

      if (mcpResponse.error) {
        throw new Error(`MCP Error [${serverName}]: ${mcpResponse.error.message}`);
      }

      return mcpResponse.result;
    } catch (error) {
      this.logger.error(`Failed to call MCP tool [${serverName}/${toolName}]:`, error.message);
      throw error;
    }
  }

  async listMCPTools(serverName: string): Promise<any[]> {
    const client = this.clients.get(serverName);
    
    if (!client) {
      throw new Error(`MCP server not found: ${serverName}`);
    }

    try {
      const mcpRequest = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/list',
        params: {},
      };

      // Use the namespaced MCP endpoint
      const mcpPath = serverName === 'opensearch' ? '/opensearch/mcp' : 
                      serverName === 'database' ? '/database/mcp' : 
                      serverName === 'graph' ? '/graph/mcp' : '/mcp';
      
      const response = await client.post(mcpPath, mcpRequest);
      const mcpResponse: MCPClientResponse = response.data;

      if (mcpResponse.error) {
        throw new Error(`MCP Error: ${mcpResponse.error.message}`);
      }

      return mcpResponse.result?.tools || [];
    } catch (error) {
      this.logger.error(`Failed to list MCP tools [${serverName}]:`, error.message);
      throw error;
    }
  }

  async checkServerHealth(serverName: string): Promise<boolean> {
    const client = this.clients.get(serverName);
    const config = this.serverConfigs.get(serverName);

    if (!client || !config) {
      return false;
    }

    try {
      const healthEndpoint = config.health_endpoint || '/health';
      const response = await client.get(healthEndpoint, { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      this.logger.warn(`Health check failed for MCP server [${serverName}]:`, error.message);
      return false;
    }
  }

  async getAllServerHealth(): Promise<Record<string, boolean>> {
    const healthStatus: Record<string, boolean> = {};
    
    for (const serverName of this.serverConfigs.keys()) {
      healthStatus[serverName] = await this.checkServerHealth(serverName);
    }
    
    return healthStatus;
  }

  getServerCapabilities(serverName: string): string[] {
    const config = this.serverConfigs.get(serverName);
    return config?.capabilities || [];
  }

  hasCapability(serverName: string, capability: string): boolean {
    const capabilities = this.getServerCapabilities(serverName);
    return capabilities.includes(capability);
  }

  findServersByCapability(capability: string): string[] {
    const servers: string[] = [];
    
    for (const [serverName, config] of this.serverConfigs) {
      if (config.capabilities.includes(capability)) {
        servers.push(serverName);
      }
    }
    
    return servers;
  }

  getConfiguredServers(): string[] {
    return Array.from(this.serverConfigs.keys());
  }
}