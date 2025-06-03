import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MCPConfigService } from './mcp-config.service';
import { MCPClientService } from './mcp-client.service';
import { MCPServerConfig } from '../types/mcp-protocol.types';

@Injectable()
export class AutoConnectionService implements OnModuleInit {
  private readonly logger = new Logger(AutoConnectionService.name);
  private reconnectAttempts: Map<string, number> = new Map();
  private reconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private readonly configService: MCPConfigService,
    private readonly clientService: MCPClientService,
    private readonly eventEmitter: EventEmitter2
  ) {
    // Listen for connection events
    this.eventEmitter.on('mcp.connection.lost', this.handleConnectionLost.bind(this));
    this.eventEmitter.on('mcp.connection.failed', this.handleConnectionFailed.bind(this));
    this.eventEmitter.on('mcp.connection.established', this.handleConnectionEstablished.bind(this));
  }

  async onModuleInit() {
    // Connect to auto-connect servers on startup
    setTimeout(() => {
      this.connectAutoConnectServers();
    }, 5000); // Wait 5 seconds for system to fully initialize
  }

  /**
   * Connect to all auto-connect enabled servers
   */
  async connectAutoConnectServers(): Promise<void> {
    this.logger.log('Connecting to auto-connect servers...');
    
    const autoConnectServers = this.configService.getAutoConnectServers();
    
    if (autoConnectServers.length === 0) {
      this.logger.log('No auto-connect servers configured');
      return;
    }

    this.logger.log(`Found ${autoConnectServers.length} auto-connect servers`);

    const connectionPromises = autoConnectServers.map(async (server) => {
      try {
        await this.connectServerWithRetry(server);
      } catch (error) {
        this.logger.error(`Failed to auto-connect to ${server.name}:`, error);
      }
    });

    await Promise.allSettled(connectionPromises);
  }

  /**
   * Connect to a server with retry logic
   */
  async connectServerWithRetry(config: MCPServerConfig): Promise<void> {
    const maxAttempts = config.reconnectAttempts || 3;
    const currentAttempts = this.reconnectAttempts.get(config.id) || 0;

    if (currentAttempts >= maxAttempts) {
      this.logger.warn(`Max reconnect attempts reached for ${config.name}`);
      return;
    }

    try {
      this.logger.log(`Connecting to ${config.name} (attempt ${currentAttempts + 1}/${maxAttempts})`);
      
      await this.clientService.connect(config);
      
      // Reset reconnect attempts on successful connection
      this.reconnectAttempts.delete(config.id);
      this.clearReconnectTimeout(config.id);
      
      this.logger.log(`Successfully connected to ${config.name}`);
    } catch (error) {
      this.logger.error(`Connection attempt failed for ${config.name}:`, error);
      
      this.reconnectAttempts.set(config.id, currentAttempts + 1);
      
      // Schedule retry if we haven't exceeded max attempts
      if (currentAttempts + 1 < maxAttempts) {
        this.scheduleReconnect(config);
      } else {
        this.logger.error(`All reconnect attempts exhausted for ${config.name}`);
        this.eventEmitter.emit('mcp.connection.exhausted', { 
          serverId: config.id, 
          serverName: config.name 
        });
      }
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(config: MCPServerConfig): void {
    const delay = this.calculateReconnectDelay(config);
    
    this.logger.log(`Scheduling reconnect for ${config.name} in ${delay}ms`);
    
    this.clearReconnectTimeout(config.id);
    
    const timeout = setTimeout(() => {
      this.connectServerWithRetry(config);
    }, delay);
    
    this.reconnectTimeouts.set(config.id, timeout);
  }

  /**
   * Calculate reconnection delay with exponential backoff
   */
  private calculateReconnectDelay(config: MCPServerConfig): number {
    const baseDelay = config.reconnectDelay || 5000; // 5 seconds default
    const currentAttempts = this.reconnectAttempts.get(config.id) || 0;
    
    // Exponential backoff: baseDelay * 2^currentAttempts, max 60 seconds
    const delay = Math.min(baseDelay * Math.pow(2, currentAttempts), 60000);
    
    return delay;
  }

  /**
   * Clear reconnect timeout for a server
   */
  private clearReconnectTimeout(serverId: string): void {
    const timeout = this.reconnectTimeouts.get(serverId);
    if (timeout) {
      clearTimeout(timeout);
      this.reconnectTimeouts.delete(serverId);
    }
  }

  /**
   * Check health of all connected servers (every 5 minutes)
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async healthCheck(): Promise<void> {
    const connectedServers = this.clientService.getConnectedServers();
    
    this.logger.debug(`Running health check for ${connectedServers.length} connected servers`);
    
    for (const connection of connectedServers) {
      try {
        // Simple ping by listing tools (this is a lightweight operation)
        await this.clientService.listTools(connection.id);
        
        // Update last ping time
        connection.lastPingAt = new Date();
        
        this.logger.debug(`Health check passed for ${connection.name}`);
      } catch (error) {
        this.logger.warn(`Health check failed for ${connection.name}:`, error);
        
        // If the connection appears dead, trigger reconnection
        const config = this.configService.getServer(connection.id);
        if (config && config.autoConnect) {
          this.logger.log(`Triggering reconnection for unhealthy server: ${connection.name}`);
          
          try {
            await this.clientService.disconnect(connection.id);
          } catch (disconnectError) {
            this.logger.warn(`Error during disconnect:`, disconnectError);
          }
          
          // Schedule reconnection
          this.scheduleReconnect(config);
        }
      }
    }
  }

  /**
   * Force reconnect to a specific server
   */
  async forceReconnect(serverId: string): Promise<void> {
    const config = this.configService.getServer(serverId);
    if (!config) {
      throw new Error(`Server configuration not found: ${serverId}`);
    }

    this.logger.log(`Force reconnecting to ${config.name}`);
    
    // Clear existing attempts and timeouts
    this.reconnectAttempts.delete(serverId);
    this.clearReconnectTimeout(serverId);
    
    // Disconnect if currently connected
    try {
      await this.clientService.disconnect(serverId);
    } catch (error) {
      this.logger.warn(`Error during disconnect before reconnect:`, error);
    }
    
    // Attempt connection
    await this.connectServerWithRetry(config);
  }

  /**
   * Get reconnection status for all servers
   */
  getReconnectionStatus(): Array<{
    serverId: string;
    serverName: string;
    attempts: number;
    maxAttempts: number;
    nextAttemptIn?: number;
  }> {
    const servers = this.configService.getAllServers();
    
    return servers.map(server => {
      const attempts = this.reconnectAttempts.get(server.id) || 0;
      const maxAttempts = server.reconnectAttempts || 3;
      const timeout = this.reconnectTimeouts.get(server.id);
      
      let nextAttemptIn: number | undefined;
      if (timeout) {
        // Calculate remaining time (this is approximate)
        nextAttemptIn = this.calculateReconnectDelay(server);
      }
      
      return {
        serverId: server.id,
        serverName: server.name,
        attempts,
        maxAttempts,
        nextAttemptIn,
      };
    });
  }

  private async handleConnectionLost(event: { connectionId: string }): Promise<void> {
    const config = this.configService.getServer(event.connectionId);
    if (!config || !config.autoConnect) {
      return;
    }

    this.logger.log(`Connection lost for auto-connect server: ${config.name}, scheduling reconnect`);
    this.scheduleReconnect(config);
  }

  private async handleConnectionFailed(event: { connectionId: string; error: any }): Promise<void> {
    const config = this.configService.getServer(event.connectionId);
    if (!config || !config.autoConnect) {
      return;
    }

    this.logger.log(`Connection failed for auto-connect server: ${config.name}`);
    // connectServerWithRetry already handles failed connections
  }

  private async handleConnectionEstablished(event: { connectionId: string; serverInfo: any }): Promise<void> {
    const config = this.configService.getServer(event.connectionId);
    if (!config) {
      return;
    }

    this.logger.log(`Connection established for ${config.name}`);
    
    // Reset reconnect tracking
    this.reconnectAttempts.delete(event.connectionId);
    this.clearReconnectTimeout(event.connectionId);
  }
}