import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { DynamicToolService } from '../dynamic-tool.service';
import { ToolEvent, ToolSearchCriteria } from '../interfaces/tool-management.interface';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    email: string;
    permissions: string[];
    roles: string[];
  };
  subscriptions?: Set<string>;
}

interface SubscriptionFilter {
  toolIds?: string[];
  categories?: string[];
  eventTypes?: string[];
  permissions?: string[];
}

@WebSocketGateway({
  namespace: '/tools',
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
})
export class ToolEventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ToolEventsGateway.name);
  private clientSubscriptions: Map<string, SubscriptionFilter> = new Map();
  private connectedClients: Map<string, AuthenticatedSocket> = new Map();

  constructor(
    private readonly dynamicToolService: DynamicToolService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized for tool events');
  }

  async handleConnection(client: AuthenticatedSocket, ...args: any[]) {
    try {
      // Authenticate the client
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        this.logger.warn(`WebSocket connection rejected - no token provided: ${client.id}`);
        client.emit('error', { message: 'Authentication token required' });
        client.disconnect();
        return;
      }

      const jwtSecret = this.configService.get<string>('JWT_SECRET');
      if (!jwtSecret) {
        this.logger.error('JWT_SECRET not configured');
        client.disconnect();
        return;
      }

      const decoded = jwt.verify(token, jwtSecret) as any;
      client.user = {
        id: decoded.sub,
        email: decoded.email,
        permissions: decoded.permissions || [],
        roles: decoded.roles || [],
      };

      // Check if user has tool event access permission
      const hasEventAccess = client.user.permissions.includes('tool:events') ||
                            client.user.permissions.includes('tool:*') ||
                            client.user.permissions.includes('admin:*');

      if (!hasEventAccess) {
        this.logger.warn(`WebSocket connection rejected - insufficient permissions: ${client.id}`);
        client.emit('error', { message: 'Insufficient permissions for tool events' });
        client.disconnect();
        return;
      }

      client.subscriptions = new Set();
      this.connectedClients.set(client.id, client);
      
      this.logger.log(`WebSocket client connected: ${client.id} (user: ${client.user.email})`);
      
      // Send current system status
      const systemStats = this.dynamicToolService.getSystemStats();
      client.emit('system:status', systemStats);
      
      // Send recent events
      const recentEvents = this.dynamicToolService.getEventHistory(undefined, 10);
      client.emit('events:history', recentEvents);

    } catch (error) {
      this.logger.error(`WebSocket authentication failed for ${client.id}:`, error.message);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.clientSubscriptions.delete(client.id);
    this.connectedClients.delete(client.id);
    this.logger.log(`WebSocket client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe:tool-events')
  handleSubscribeToToolEvents(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() filter: SubscriptionFilter,
  ) {
    if (!client.user) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    // Validate subscription permissions
    if (!this.validateSubscriptionPermissions(client.user.permissions, filter)) {
      client.emit('error', { message: 'Insufficient permissions for requested subscription' });
      return;
    }

    this.clientSubscriptions.set(client.id, filter);
    client.subscriptions?.add('tool-events');
    
    this.logger.log(`Client ${client.id} subscribed to tool events with filter:`, filter);
    client.emit('subscription:confirmed', { type: 'tool-events', filter });
  }

  @SubscribeMessage('unsubscribe:tool-events')
  handleUnsubscribeFromToolEvents(@ConnectedSocket() client: AuthenticatedSocket) {
    this.clientSubscriptions.delete(client.id);
    client.subscriptions?.delete('tool-events');
    
    this.logger.log(`Client ${client.id} unsubscribed from tool events`);
    client.emit('subscription:removed', { type: 'tool-events' });
  }

  @SubscribeMessage('subscribe:tool-health')
  handleSubscribeToToolHealth(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { toolIds?: string[] },
  ) {
    if (!client.user) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    client.subscriptions?.add('tool-health');
    
    // Send current health status for requested tools
    if (data.toolIds) {
      for (const toolId of data.toolIds) {
        this.sendToolHealthStatus(client, toolId);
      }
    }

    this.logger.log(`Client ${client.id} subscribed to health updates`);
    client.emit('subscription:confirmed', { type: 'tool-health', toolIds: data.toolIds });
  }

  @SubscribeMessage('get:tool-list')
  handleGetToolList(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() criteria: ToolSearchCriteria,
  ) {
    if (!client.user) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    const result = this.dynamicToolService.searchTools(criteria);
    client.emit('tool-list', result);
  }

  @SubscribeMessage('get:system-stats')
  handleGetSystemStats(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.user) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    const stats = this.dynamicToolService.getSystemStats();
    client.emit('system:stats', stats);
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    client.emit('pong', { timestamp: new Date().toISOString() });
  }

  // Event listeners for tool events
  @OnEvent('dynamic-tool.event')
  handleToolEvent(event: ToolEvent) {
    this.logger.debug(`Broadcasting tool event: ${event.type} for ${event.toolId}`);
    
    // Broadcast to subscribed clients
    this.connectedClients.forEach((client, clientId) => {
      if (client.subscriptions?.has('tool-events')) {
        const filter = this.clientSubscriptions.get(clientId);
        if (this.shouldSendEventToClient(event, filter, client.user!.permissions)) {
          client.emit('tool:event', event);
        }
      }
    });

    // Update system stats for all connected clients
    const systemStats = this.dynamicToolService.getSystemStats();
    this.server.emit('system:stats-update', systemStats);
  }

  @OnEvent('tool.health-check')
  handleToolHealthCheck(data: { toolId: string; health: any }) {
    this.logger.debug(`Broadcasting health check for tool: ${data.toolId}`);
    
    this.connectedClients.forEach((client) => {
      if (client.subscriptions?.has('tool-health')) {
        client.emit('tool:health-update', {
          toolId: data.toolId,
          health: data.health,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  @OnEvent('tool.execution.started')
  handleToolExecutionStarted(data: { toolName: string; parameters: any }) {
    this.broadcastToolExecution('execution:started', data);
  }

  @OnEvent('tool.execution.completed')
  handleToolExecutionCompleted(data: { toolName: string; executionTime: number; success: boolean }) {
    this.broadcastToolExecution('execution:completed', data);
  }

  @OnEvent('tool.execution.failed')
  handleToolExecutionFailed(data: { toolName: string; error: string; executionTime: number }) {
    this.broadcastToolExecution('execution:failed', data);
  }

  // Private helper methods
  private validateSubscriptionPermissions(userPermissions: string[], filter: SubscriptionFilter): boolean {
    // Basic permission check
    const hasEventAccess = userPermissions.includes('tool:events') ||
                          userPermissions.includes('tool:*') ||
                          userPermissions.includes('admin:*');

    if (!hasEventAccess) {
      return false;
    }

    // Additional permission checks based on filter
    if (filter.permissions) {
      return filter.permissions.every(permission => 
        userPermissions.includes(permission) || 
        userPermissions.includes('admin:*')
      );
    }

    return true;
  }

  private shouldSendEventToClient(event: ToolEvent, filter?: SubscriptionFilter, userPermissions?: string[]): boolean {
    if (!filter) {
      return true; // No filter means send all events
    }

    // Filter by tool IDs
    if (filter.toolIds && filter.toolIds.length > 0) {
      if (!filter.toolIds.includes(event.toolId)) {
        return false;
      }
    }

    // Filter by event types
    if (filter.eventTypes && filter.eventTypes.length > 0) {
      if (!filter.eventTypes.includes(event.type)) {
        return false;
      }
    }

    // Filter by categories (would need to get tool metadata for this)
    if (filter.categories && filter.categories.length > 0) {
      const toolMetadata = this.dynamicToolService.getToolMetadata(event.toolId);
      if (toolMetadata && !filter.categories.includes(toolMetadata.category)) {
        return false;
      }
    }

    return true;
  }

  private async sendToolHealthStatus(client: AuthenticatedSocket, toolId: string): Promise<void> {
    try {
      const health = await this.dynamicToolService.getToolHealth(toolId);
      if (health) {
        client.emit('tool:health-status', {
          toolId,
          health,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      this.logger.error(`Failed to get health status for tool ${toolId}:`, error);
    }
  }

  private broadcastToolExecution(eventType: string, data: any): void {
    this.connectedClients.forEach((client) => {
      if (client.subscriptions?.has('tool-events')) {
        client.emit(`tool:${eventType}`, {
          ...data,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  // Admin methods for broadcasting system-wide notifications
  broadcastSystemNotification(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
    this.server.emit('system:notification', {
      message,
      level,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastMaintenanceMode(enabled: boolean, message?: string): void {
    this.server.emit('system:maintenance', {
      enabled,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  // Get connected clients statistics
  getConnectionStats(): any {
    return {
      totalConnections: this.connectedClients.size,
      subscriptionBreakdown: {
        'tool-events': Array.from(this.connectedClients.values())
          .filter(client => client.subscriptions?.has('tool-events')).length,
        'tool-health': Array.from(this.connectedClients.values())
          .filter(client => client.subscriptions?.has('tool-health')).length,
      },
      userBreakdown: Array.from(this.connectedClients.values())
        .map(client => ({
          id: client.id,
          email: client.user?.email,
          subscriptions: Array.from(client.subscriptions || []),
        })),
    };
  }
}