import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { getErrorMessage } from '@/common/utils/error-utils';
import { ProcessManagerService } from './process-manager.service';
import {
  WebSocketMessage,
  UserSession,
  ClientConfig,
  LogStreamRequest,
  ResourceMonitoringRequest,
} from '../types/interaction.types';
import {
  ProcessEvent,
  ProcessFilter,
  ProcessLog,
} from '../types/process.types';

@WebSocketGateway({
  cors: {
    origin: '*', // Configure this properly for production
  },
  namespace: '/interaction',
})
export class InteractionWebSocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(InteractionWebSocketGateway.name);
  private readonly sessions = new Map<string, UserSession>();
  private readonly processSubscriptions = new Map<string, Set<string>>(); // processId -> socketIds

  constructor(private readonly processManager: ProcessManagerService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket gateway initialized');
  }

  handleConnection(client: Socket, ...args: any[]) {
    const sessionId = client.id;
    const userId = client.handshake.auth?.userId || client.handshake.query?.userId as string;

    const session: UserSession = {
      id: sessionId,
      userId,
      socketId: client.id,
      connectedAt: new Date(),
      lastActivity: new Date(),
      subscribedProcesses: [],
      clientConfig: this.getDefaultClientConfig(),
      permissions: this.getUserPermissions(userId),
    };

    this.sessions.set(sessionId, session);
    this.logger.log(`Client connected: ${sessionId} (user: ${userId || 'anonymous'})`);

    // Send initial client data
    this.sendClientUpdate(client);
  }

  handleDisconnect(client: Socket) {
    const sessionId = client.id;
    const session = this.sessions.get(sessionId);

    if (session) {
      // Unsubscribe from all processes
      session.subscribedProcesses.forEach(processId => {
        this.unsubscribeFromProcess(sessionId, processId);
      });

      this.sessions.delete(sessionId);
      this.logger.log(`Client disconnected: ${sessionId}`);
    }
  }

  @SubscribeMessage('subscribe_process')
  handleSubscribeProcess(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { processId: string }
  ) {
    const session = this.sessions.get(client.id);
    if (!session) {
      throw new WsException('Session not found');
    }

    this.subscribeToProcess(client.id, data.processId);
    session.subscribedProcesses.push(data.processId);
    session.lastActivity = new Date();

    this.logger.debug(`Client ${client.id} subscribed to process ${data.processId}`);
    
    // Send current process state
    const process = this.processManager.getProcess(data.processId);
    if (process) {
      this.sendToClient(client.id, {
        type: 'process_update',
        processId: data.processId,
        data: process,
        timestamp: new Date(),
      });
    }
  }

  @SubscribeMessage('unsubscribe_process')
  handleUnsubscribeProcess(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { processId: string }
  ) {
    const session = this.sessions.get(client.id);
    if (!session) {
      throw new WsException('Session not found');
    }

    this.unsubscribeFromProcess(client.id, data.processId);
    session.subscribedProcesses = session.subscribedProcesses.filter(
      id => id !== data.processId
    );
    session.lastActivity = new Date();

    this.logger.debug(`Client ${client.id} unsubscribed from process ${data.processId}`);
  }

  @SubscribeMessage('get_processes')
  handleGetProcesses(
    @ConnectedSocket() client: Socket,
    @MessageBody() filter?: ProcessFilter
  ) {
    const session = this.sessions.get(client.id);
    if (!session) {
      throw new WsException('Session not found');
    }

    session.lastActivity = new Date();
    const processes = this.processManager.getProcesses(filter);
    
    this.sendToClient(client.id, {
      type: 'process_update',
      data: { processes, filter },
      timestamp: new Date(),
    });
  }

  @SubscribeMessage('get_process_logs')
  handleGetProcessLogs(
    @ConnectedSocket() client: Socket,
    @MessageBody() request: LogStreamRequest
  ) {
    const session = this.sessions.get(client.id);
    if (!session) {
      throw new WsException('Session not found');
    }

    session.lastActivity = new Date();
    const process = this.processManager.getProcess(request.processId);
    
    if (!process) {
      throw new WsException('Process not found');
    }

    let logs = process.logs;

    // Apply filters
    if (request.level) {
      logs = logs.filter(log => log.level === request.level);
    }

    if (request.since) {
      logs = logs.filter(log => log.timestamp >= request.since!);
    }

    if (request.tail) {
      logs = logs.slice(-request.tail);
    }

    this.sendToClient(client.id, {
      type: 'log_stream',
      processId: request.processId,
      data: { logs, request },
      timestamp: new Date(),
    });

    // If follow is enabled, subscribe to log updates
    if (request.follow) {
      this.subscribeToProcess(client.id, request.processId);
      if (!session.subscribedProcesses.includes(request.processId)) {
        session.subscribedProcesses.push(request.processId);
      }
    }
  }

  @SubscribeMessage('start_resource_monitoring')
  handleStartResourceMonitoring(
    @ConnectedSocket() client: Socket,
    @MessageBody() request: ResourceMonitoringRequest
  ) {
    const session = this.sessions.get(client.id);
    if (!session) {
      throw new WsException('Session not found');
    }

    session.lastActivity = new Date();

    if (request.processId) {
      // Monitor specific process
      this.subscribeToProcess(client.id, request.processId);
      if (!session.subscribedProcesses.includes(request.processId)) {
        session.subscribedProcesses.push(request.processId);
      }
    } else {
      // Monitor all processes - subscribe to system-wide updates
      this.sendToClient(client.id, {
        type: 'system_notification',
        data: { message: 'Started monitoring all processes' },
        timestamp: new Date(),
      });
    }
  }

  @SubscribeMessage('update_client_config')
  handleUpdateClientConfig(
    @ConnectedSocket() client: Socket,
    @MessageBody() config: Partial<ClientConfig>
  ) {
    const session = this.sessions.get(client.id);
    if (!session) {
      throw new WsException('Session not found');
    }

    session.clientConfig = { ...session.clientConfig, ...config };
    session.lastActivity = new Date();

    this.logger.debug(`Updated client config for client ${client.id}`);
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    const session = this.sessions.get(client.id);
    if (session) {
      session.lastActivity = new Date();
    }
    client.emit('pong', { timestamp: new Date() });
  }

  // Event listeners for process events

  @OnEvent('process.event')
  handleProcessEvent(event: ProcessEvent) {
    this.broadcastToProcessSubscribers(event.processId, {
      type: 'process_update',
      processId: event.processId,
      data: event,
      timestamp: new Date(),
    });

    // Also send the updated process data
    const process = this.processManager.getProcess(event.processId);
    if (process) {
      this.broadcastToProcessSubscribers(event.processId, {
        type: 'process_update',
        processId: event.processId,
        data: process,
        timestamp: new Date(),
      });
    }
  }

  @OnEvent('agent.interaction')
  handleAgentInteraction(data: any) {
    const { processId, interaction } = data;
    this.broadcastToProcessSubscribers(processId, {
      type: 'agent_interaction',
      processId,
      data: interaction,
      timestamp: new Date(),
    });
  }

  // Private methods

  private subscribeToProcess(sessionId: string, processId: string) {
    if (!this.processSubscriptions.has(processId)) {
      this.processSubscriptions.set(processId, new Set());
    }
    this.processSubscriptions.get(processId)!.add(sessionId);
  }

  private unsubscribeFromProcess(sessionId: string, processId: string) {
    const subscribers = this.processSubscriptions.get(processId);
    if (subscribers) {
      subscribers.delete(sessionId);
      if (subscribers.size === 0) {
        this.processSubscriptions.delete(processId);
      }
    }
  }

  private broadcastToProcessSubscribers(processId: string, message: WebSocketMessage) {
    const subscribers = this.processSubscriptions.get(processId);
    if (subscribers) {
      subscribers.forEach(sessionId => {
        this.sendToClient(sessionId, message);
      });
    }
  }

  private sendToClient(sessionId: string, message: WebSocketMessage) {
    const client = this.server.sockets.sockets.get(sessionId);
    if (client) {
      client.emit('message', message);
    }
  }

  private sendClientUpdate(client: Socket) {
    const stats = this.processManager.getProcessStats();
    const recentProcesses = this.processManager.getProcesses({
      limit: 10,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    });

    this.sendToClient(client.id, {
      type: 'process_update',
      data: {
        stats,
        recentProcesses,
        type: 'client_init',
      },
      timestamp: new Date(),
    });
  }

  private getDefaultClientConfig(): ClientConfig {
    return {
      refreshInterval: 5000,
      maxLogEntries: 100,
      enableRealTimeUpdates: true,
      resourceMonitoringInterval: 5000,
      defaultFilters: {
        status: ['running', 'pending'],
        type: [],
        priority: [],
      },
      displayPreferences: {
        theme: 'auto',
        compactView: false,
        maxDisplayItems: 50,
      },
    };
  }

  private getUserPermissions(userId?: string): string[] {
    // Basic permission system - expand based on your needs
    if (!userId) {
      return ['read'];
    }
    return ['read', 'write', 'admin']; // Default permissions
  }

  // Periodic cleanup of inactive sessions
  public cleanupInactiveSessions() {
    const now = new Date();
    const timeout = 30 * 60 * 1000; // 30 minutes

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now.getTime() - session.lastActivity.getTime() > timeout) {
        this.logger.debug(`Cleaning up inactive session: ${sessionId}`);
        
        // Unsubscribe from all processes
        session.subscribedProcesses.forEach(processId => {
          this.unsubscribeFromProcess(sessionId, processId);
        });

        this.sessions.delete(sessionId);
      }
    }
  }

  // Broadcast system-wide notifications
  public broadcastSystemNotification(message: string, type: 'info' | 'warning' | 'error' = 'info') {
    const notification: WebSocketMessage = {
      type: 'system_notification',
      data: { message, type },
      timestamp: new Date(),
    };

    this.server.emit('message', notification);
  }

  // Get active sessions count
  public getActiveSessionsCount(): number {
    return this.sessions.size;
  }

  // Get process subscription stats
  public getSubscriptionStats(): { [processId: string]: number } {
    const stats: { [processId: string]: number } = {};
    for (const [processId, subscribers] of this.processSubscriptions.entries()) {
      stats[processId] = subscribers.size;
    }
    return stats;
  }
}