import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { MCPClientService } from '../integrations/mcp-client/services/mcp-client.service';
import { MCPConfigService } from '../integrations/mcp-client/services/mcp-config.service';
import { Interval } from '@nestjs/schedule';

export interface MCPServiceStatus {
  server: {
    enabled: boolean;
    running: boolean;
    connections: number;
    uptime: number;
    lastError?: string;
  };
  client: {
    enabled: boolean;
    connections: Array<{
      id: string;
      name: string;
      status: string;
      connectedAt?: Date;
      lastError?: string;
    }>;
    totalConnections: number;
    activeConnections: number;
    lastError?: string;
  };
  overall: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    startedAt: Date;
  };
}

@Injectable()
export class MCPLifecycleService extends HealthIndicator implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MCPLifecycleService.name);
  private startedAt: Date;
  private serverEnabled: boolean;
  private clientEnabled: boolean;
  private isShuttingDown = false;
  private serverStartTime?: Date;
  private status: MCPServiceStatus;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly mcpClientService: MCPClientService,
    private readonly mcpConfigService: MCPConfigService,
  ) {
    super();
    this.startedAt = new Date();
    this.serverEnabled = this.configService.get<boolean>('mcp.server.enabled', true);
    this.clientEnabled = this.configService.get<boolean>('mcp.client.enabled', false);
    
    this.initializeStatus();
    this.setupEventHandlers();
  }

  async onModuleInit() {
    this.logger.log('🔄 Initializing MCP Lifecycle Service...');
    
    try {
      // Start MCP client if enabled
      if (this.clientEnabled) {
        await this.startMCPClient();
      } else {
        this.logger.log('📵 MCP Client is disabled');
      }

      // MCP Server is handled by the @rekog/mcp-nest module
      if (this.serverEnabled) {
        this.serverStartTime = new Date();
        this.status.server.running = true;
        this.logger.log('✅ MCP Server is enabled');
      } else {
        this.logger.log('📵 MCP Server is disabled');
      }

      this.updateOverallStatus();
      this.eventEmitter.emit('mcp.lifecycle.initialized', { status: this.status });
      
      this.logger.log(`🚀 MCP Lifecycle Service initialized successfully`);
      this.logServiceStatus();
    } catch (error: any) {
      this.logger.error('❌ Failed to initialize MCP Lifecycle Service:', error);
      this.status.overall.status = 'unhealthy';
      throw error;
    }
  }

  async onModuleDestroy() {
    this.logger.log('🔄 Shutting down MCP Lifecycle Service...');
    this.isShuttingDown = true;

    try {
      // Disconnect all MCP client connections
      if (this.clientEnabled) {
        await this.stopMCPClient();
      }

      this.eventEmitter.emit('mcp.lifecycle.destroyed');
      this.logger.log('✅ MCP Lifecycle Service shut down successfully');
    } catch (error: any) {
      this.logger.error('❌ Error during MCP Lifecycle Service shutdown:', error);
    }
  }

  async startMCPClient(): Promise<void> {
    this.logger.log('🔄 Starting MCP Client...');
    
    try {
      // Load configurations first
      await this.mcpConfigService.onModuleInit();
      
      // Get auto-connect servers if enabled
      const autoConnect = this.configService.get<boolean>('mcp.client.autoConnect', false);
      if (autoConnect) {
        const autoConnectServers = this.mcpConfigService.getAutoConnectServers();
        this.logger.log(`🔗 Auto-connecting to ${autoConnectServers.length} servers...`);
        
        for (const serverConfig of autoConnectServers) {
          try {
            await this.mcpClientService.connect(serverConfig);
            this.logger.log(`✅ Connected to MCP server: ${serverConfig.name}`);
          } catch (error: any) {
            this.logger.error(`❌ Failed to connect to MCP server ${serverConfig.name}:`, error);
          }
        }
      }

      this.updateClientStatus();
      this.logger.log('✅ MCP Client started successfully');
    } catch (error: any) {
      this.status.client.lastError = error instanceof Error ? error.message : String(error);
      this.logger.error('❌ Failed to start MCP Client:', error);
      throw error;
    }
  }

  async stopMCPClient(): Promise<void> {
    this.logger.log('🔄 Stopping MCP Client...');
    
    try {
      await this.mcpClientService.disconnectAll();
      this.updateClientStatus();
      this.logger.log('✅ MCP Client stopped successfully');
    } catch (error: any) {
      this.logger.error('❌ Error stopping MCP Client:', error);
      throw error;
    }
  }

  async restartMCPClient(): Promise<void> {
    this.logger.log('🔄 Restarting MCP Client...');
    
    await this.stopMCPClient();
    await this.startMCPClient();
    
    this.logger.log('✅ MCP Client restarted successfully');
  }

  @Interval(60000) // Run every minute
  async performHealthCheck(): Promise<void> {
    if (this.isShuttingDown) return;

    try {
      // Update client status
      this.updateClientStatus();
      
      // Update server status (if we can get metrics from the MCP server)
      this.updateServerStatus();
      
      // Update overall status
      this.updateOverallStatus();
      
      // Emit health check event
      this.eventEmitter.emit('mcp.lifecycle.health_check', { status: this.status });
      
    } catch (error: any) {
      this.logger.warn('⚠️ Health check failed:', error);
    }
  }

  async isHealthy(): Promise<HealthIndicatorResult> {
    const isHealthy = this.status.overall.status === 'healthy';
    
    const result = this.getStatus('mcp_lifecycle', isHealthy, {
      server: this.status.server,
      client: this.status.client,
      overall: this.status.overall,
    });

    if (!isHealthy) {
      throw new HealthCheckError('MCP Lifecycle check failed', result);
    }

    return result;
  }

  getServiceStatus(): MCPServiceStatus {
    return { ...this.status };
  }

  async connectToServer(serverId: string): Promise<void> {
    const serverConfig = this.mcpConfigService.getServer(serverId);
    if (!serverConfig) {
      throw new Error(`Server configuration not found: ${serverId}`);
    }

    await this.mcpClientService.connect(serverConfig);
    this.updateClientStatus();
    
    this.logger.log(`✅ Connected to MCP server: ${serverConfig.name}`);
    this.eventEmitter.emit('mcp.client.server_connected', { serverId, serverName: serverConfig.name });
  }

  async disconnectFromServer(serverId: string): Promise<void> {
    const connection = this.mcpClientService.getConnection(serverId);
    if (!connection) {
      throw new Error(`Connection not found: ${serverId}`);
    }

    await this.mcpClientService.disconnect(serverId);
    this.updateClientStatus();
    
    this.logger.log(`✅ Disconnected from MCP server: ${connection.name}`);
    this.eventEmitter.emit('mcp.client.server_disconnected', { serverId, serverName: connection.name });
  }

  private initializeStatus(): void {
    this.status = {
      server: {
        enabled: this.serverEnabled,
        running: false,
        connections: 0,
        uptime: 0,
      },
      client: {
        enabled: this.clientEnabled,
        connections: [],
        totalConnections: 0,
        activeConnections: 0,
      },
      overall: {
        status: 'healthy',
        uptime: 0,
        startedAt: this.startedAt,
      },
    };
  }

  private setupEventHandlers(): void {
    // Listen for MCP client events
    this.eventEmitter.on('mcp.connection.established', (data) => {
      this.logger.log(`🔗 MCP client connected: ${data.connectionId}`);
      this.updateClientStatus();
    });

    this.eventEmitter.on('mcp.connection.failed', (data) => {
      this.logger.error(`❌ MCP client connection failed: ${data.connectionId}`, data.error);
      this.updateClientStatus();
    });

    this.eventEmitter.on('mcp.connection.lost', (data) => {
      this.logger.warn(`⚠️ MCP client connection lost: ${data.connectionId}`);
      this.updateClientStatus();
    });

    this.eventEmitter.on('mcp.connection.error', (data) => {
      this.logger.error(`❌ MCP client connection error: ${data.connectionId}`, data.error);
      this.updateClientStatus();
    });
  }

  private updateServerStatus(): void {
    this.status.server.uptime = this.serverStartTime 
      ? Date.now() - this.serverStartTime.getTime() 
      : 0;
    
    // Note: We don't have direct access to MCP server connection metrics
    // This would need to be integrated with the @rekog/mcp-nest module
    // For now, we assume the server is running if it's enabled
  }

  private updateClientStatus(): void {
    if (!this.clientEnabled) {
      return;
    }

    const connections = this.mcpClientService.getAllConnections();
    
    this.status.client.connections = connections.map(conn => ({
      id: conn.id,
      name: conn.name,
      status: conn.status,
      connectedAt: conn.createdAt,
      lastError: conn.lastError,
    }));
    
    this.status.client.totalConnections = connections.length;
    this.status.client.activeConnections = connections.filter(conn => conn.status === 'connected').length;
  }

  private updateOverallStatus(): void {
    this.status.overall.uptime = Date.now() - this.startedAt.getTime();
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    // Check server status
    if (this.serverEnabled && !this.status.server.running) {
      overallStatus = 'unhealthy';
    }
    
    // Check client status
    if (this.clientEnabled) {
      const activeConnections = this.status.client.activeConnections;
      const totalConnections = this.status.client.totalConnections;
      
      if (totalConnections > 0 && activeConnections === 0) {
        overallStatus = 'unhealthy';
      } else if (totalConnections > 0 && activeConnections < totalConnections) {
        overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
      }
    }
    
    this.status.overall.status = overallStatus;
  }

  private logServiceStatus(): void {
    this.logger.log(`📊 MCP Service Status:`);
    this.logger.log(`   Server: ${this.status.server.enabled ? 'Enabled' : 'Disabled'} ${this.status.server.running ? '(Running)' : ''}`);
    this.logger.log(`   Client: ${this.status.client.enabled ? 'Enabled' : 'Disabled'} (${this.status.client.activeConnections}/${this.status.client.totalConnections} connections active)`);
    this.logger.log(`   Overall: ${this.status.overall.status.toUpperCase()}`);
  }
}