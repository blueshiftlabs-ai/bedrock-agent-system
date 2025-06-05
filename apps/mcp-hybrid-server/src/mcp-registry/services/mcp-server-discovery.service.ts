import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { getErrorMessage } from '../../common/utils/error.utils';

export interface MCPServerConfig {
  id: string;
  name: string;
  url: string;
  protocol: 'http' | 'https' | 'ws' | 'wss';
  healthCheck: string;
  capabilities: string[];
  authToken?: string;
  timeout: number;
  retryAttempts: number;
  healthCheckInterval: number;
}

export interface MCPServerInfo {
  id: string;
  name: string;
  url: string;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  version?: string;
  lastSeen?: Date;
  config: MCPServerConfig;
  metrics?: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    requestsPerSecond: number;
    errorRate: number;
    responseTime: number;
  };
}

@Injectable()
export class MCPServerDiscoveryService implements OnModuleInit {
  private readonly logger = new Logger(MCPServerDiscoveryService.name);
  private registeredServers = new Map<string, MCPServerInfo>();
  private discoveryAttempts = new Map<string, number>();

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly httpService: HttpService,
  ) {}

  async onModuleInit() {
    await this.loadServerConfigurations();
    await this.initiateServerDiscovery();
  }

  private async loadServerConfigurations() {
    // Load server configurations from environment or config files
    const serverConfigs = this.getServerConfigurations();
    
    for (const config of serverConfigs) {
      const serverInfo: MCPServerInfo = {
        id: config.id,
        name: config.name,
        url: config.url,
        status: 'disconnected',
        config,
      };

      this.registeredServers.set(config.id, serverInfo);
      this.discoveryAttempts.set(config.id, 0);
      
      this.logger.log(`Loaded server configuration: ${config.name} (${config.id})`);
    }
  }

  private getServerConfigurations(): MCPServerConfig[] {
    // Default server configurations
    const defaultServers: MCPServerConfig[] = [
      {
        id: 'memory-server',
        name: 'Memory Server',
        url: 'http://localhost:4100',
        protocol: 'http',
        healthCheck: '/memory/health',
        capabilities: ['memory', 'vector-search', 'graph'],
        timeout: 5000,
        retryAttempts: 3,
        healthCheckInterval: 30000,
      },
      {
        id: 'storage-server',
        name: 'Storage Server',
        url: 'http://localhost:4200',
        protocol: 'http',
        healthCheck: '/health',
        capabilities: ['file-storage', 'backup'],
        timeout: 5000,
        retryAttempts: 3,
        healthCheckInterval: 30000,
      },
      {
        id: 'bedrock-server',
        name: 'Bedrock Server',
        url: 'http://localhost:4300',
        protocol: 'http',
        healthCheck: '/health',
        capabilities: ['ai-models', 'inference'],
        timeout: 5000,
        retryAttempts: 3,
        healthCheckInterval: 30000,
      },
    ];

    // Try to load from environment or configuration
    const envServers = this.configService.get<string>('MCP_SERVERS');
    if (envServers) {
      try {
        const parsedServers = JSON.parse(envServers);
        if (Array.isArray(parsedServers)) {
          return parsedServers.map(server => ({
            ...server,
            timeout: server.timeout || 5000,
            retryAttempts: server.retryAttempts || 3,
            healthCheckInterval: server.healthCheckInterval || 30000,
          }));
        }
      } catch (error) {
        this.logger.error(`Failed to parse MCP_SERVERS environment variable: ${getErrorMessage(error)}`);
      }
    }

    return defaultServers;
  }

  private async initiateServerDiscovery() {
    this.logger.log('Starting MCP server discovery...');
    
    for (const [serverId, serverInfo] of this.registeredServers) {
      await this.discoverServer(serverId);
    }
  }

  private async discoverServer(serverId: string): Promise<boolean> {
    const serverInfo = this.registeredServers.get(serverId);
    if (!serverInfo) {
      this.logger.error(`Server ${serverId} not found in registry`);
      return false;
    }

    const attempts = this.discoveryAttempts.get(serverId) || 0;
    this.discoveryAttempts.set(serverId, attempts + 1);

    try {
      this.logger.debug(`Attempting to discover server: ${serverInfo.name} (${serverInfo.url})`);
      
      // Update status to connecting
      serverInfo.status = 'connecting';
      this.registeredServers.set(serverId, serverInfo);
      this.emitServerStatusUpdate(serverInfo);

      // Perform health check
      const healthResult = await this.performHealthCheck(serverInfo);
      
      if (healthResult.success) {
        serverInfo.status = 'connected';
        serverInfo.version = healthResult.version;
        serverInfo.lastSeen = new Date();
        serverInfo.metrics = healthResult.metrics;
        
        this.discoveryAttempts.set(serverId, 0); // Reset attempts on success
        
        this.logger.log(`Successfully connected to server: ${serverInfo.name}`);
        
        // Emit server registration event for other services
        this.eventEmitter.emit('mcp.server.registered', serverInfo);
        
        // Request tool discovery for this server
        this.eventEmitter.emit('mcp.tools.discover', { serverId, serverInfo });
        
      } else {
        serverInfo.status = 'error';
        this.logger.warn(`Failed to connect to server: ${serverInfo.name} - ${healthResult.error}`);
      }

      this.registeredServers.set(serverId, serverInfo);
      this.emitServerStatusUpdate(serverInfo);
      
      return healthResult.success;
      
    } catch (error) {
      this.logger.error(`Error discovering server ${serverInfo.name}: ${getErrorMessage(error)}`);
      
      serverInfo.status = 'error';
      this.registeredServers.set(serverId, serverInfo);
      this.emitServerStatusUpdate(serverInfo);
      
      return false;
    }
  }

  private async performHealthCheck(serverInfo: MCPServerInfo): Promise<{
    success: boolean;
    version?: string;
    metrics?: any;
    error?: string;
  }> {
    try {
      const healthUrl = `${serverInfo.url}${serverInfo.config.healthCheck}`;
      const startTime = Date.now();
      
      const response = await firstValueFrom(
        this.httpService.get(healthUrl, {
          timeout: serverInfo.config.timeout,
          headers: serverInfo.config.authToken ? {
            'Authorization': `Bearer ${serverInfo.config.authToken}`,
          } : {},
        })
      );

      const responseTime = Date.now() - startTime;
      
      if (response.status === 200) {
        const healthData = response.data;
        
        return {
          success: true,
          version: healthData.version,
          metrics: {
            uptime: healthData.uptime || 0,
            memoryUsage: healthData.memory?.usage || 0,
            cpuUsage: healthData.cpu?.usage || 0,
            requestsPerSecond: healthData.performance?.requestsPerSecond || 0,
            errorRate: healthData.performance?.errorRate || 0,
            responseTime,
          },
        };
      } else {
        return {
          success: false,
          error: `Health check returned status ${response.status}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  private emitServerStatusUpdate(serverInfo: MCPServerInfo) {
    this.eventEmitter.emit('mcp.server.status', {
      id: serverInfo.id,
      name: serverInfo.name,
      status: serverInfo.status,
      url: serverInfo.url,
      version: serverInfo.version,
      lastSeen: serverInfo.lastSeen,
      metrics: serverInfo.metrics,
    });
  }

  // Periodic server discovery and health monitoring
  @Cron(CronExpression.EVERY_30_SECONDS)
  async performPeriodicDiscovery() {
    for (const [serverId, serverInfo] of this.registeredServers) {
      // Skip if server is already connected and was seen recently
      if (serverInfo.status === 'connected' && 
          serverInfo.lastSeen && 
          (Date.now() - serverInfo.lastSeen.getTime()) < serverInfo.config.healthCheckInterval) {
        continue;
      }

      // Limit retry attempts for failed servers
      const attempts = this.discoveryAttempts.get(serverId) || 0;
      if (serverInfo.status === 'error' && attempts >= serverInfo.config.retryAttempts) {
        // Wait longer before retrying failed servers
        if (attempts % 10 === 0) { // Retry every 10 cycles (5 minutes with 30s interval)
          await this.discoverServer(serverId);
        }
        continue;
      }

      await this.discoverServer(serverId);
    }
  }

  // Public methods
  public getRegisteredServers(): MCPServerInfo[] {
    return Array.from(this.registeredServers.values());
  }

  public getServerById(serverId: string): MCPServerInfo | undefined {
    return this.registeredServers.get(serverId);
  }

  public getConnectedServers(): MCPServerInfo[] {
    return Array.from(this.registeredServers.values())
      .filter(server => server.status === 'connected');
  }

  public async registerServer(config: MCPServerConfig): Promise<boolean> {
    const serverInfo: MCPServerInfo = {
      id: config.id,
      name: config.name,
      url: config.url,
      status: 'disconnected',
      config,
    };

    this.registeredServers.set(config.id, serverInfo);
    this.discoveryAttempts.set(config.id, 0);
    
    this.logger.log(`Registered new server: ${config.name} (${config.id})`);
    
    // Attempt immediate discovery
    return await this.discoverServer(config.id);
  }

  public unregisterServer(serverId: string): boolean {
    const serverInfo = this.registeredServers.get(serverId);
    if (!serverInfo) {
      return false;
    }

    this.registeredServers.delete(serverId);
    this.discoveryAttempts.delete(serverId);
    
    // Emit unregistration event
    this.eventEmitter.emit('mcp.server.unregistered', { serverId, serverInfo });
    
    this.logger.log(`Unregistered server: ${serverInfo.name} (${serverId})`);
    return true;
  }

  public async forceHealthCheck(serverId: string): Promise<boolean> {
    return await this.discoverServer(serverId);
  }
}