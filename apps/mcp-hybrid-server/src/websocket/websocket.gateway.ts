import {
  WebSocketGateway as WSGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MessageBrokerService } from './services/message-broker.service';
import { getErrorMessage } from '../common/utils/error.utils';

export interface WebSocketMessage {
  type: 'log' | 'process_update' | 'workflow_update' | 'server_status' | 'system_alert' | 'tool_update' | 'memory_update';
  payload: any;
  timestamp: Date;
  serverId?: string;
}

@Injectable()
@WSGateway({
  cors: {
    origin: process.env.DASHBOARD_URL || 'http://localhost:3001',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket'],
})
export class WebSocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebSocketGateway.name);
  private connectedClients = new Set<string>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly messageBroker: MessageBrokerService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
    this.messageBroker.setServer(server);
    
    // Subscribe to internal events and broadcast to connected clients
    this.setupEventSubscriptions();
  }

  handleConnection(client: Socket) {
    this.connectedClients.add(client.id);
    this.logger.log(`Client connected: ${client.id} (Total: ${this.connectedClients.size})`);
    
    // Send initial system status to new client
    this.sendInitialData(client);
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id} (Total: ${this.connectedClients.size})`);
  }

  @SubscribeMessage('get_recent_logs')
  async handleGetRecentLogs(
    @MessageBody() data: { limit?: number; filter?: any },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // Emit event to request recent logs from log aggregation service
      this.eventEmitter.emit('websocket.get_recent_logs', {
        clientId: client.id,
        limit: data.limit || 100,
        filter: data.filter,
      });
    } catch (error) {
      this.logger.error(`Error getting recent logs: ${getErrorMessage(error)}`);
      client.emit('error', { message: 'Failed to get recent logs' });
    }
  }

  @SubscribeMessage('get_tools')
  async handleGetTools(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // Emit event to request tools from tool registry service
      this.eventEmitter.emit('websocket.get_tools', {
        clientId: client.id,
        ...data,
      });
    } catch (error) {
      this.logger.error(`Error getting tools: ${getErrorMessage(error)}`);
      client.emit('error', { message: 'Failed to get tools' });
    }
  }

  @SubscribeMessage('tool_action')
  async handleToolAction(
    @MessageBody() data: { toolId: string; action: 'activate' | 'deactivate' | 'test' },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // Emit event to execute tool action
      this.eventEmitter.emit('websocket.tool_action', {
        clientId: client.id,
        ...data,
      });
    } catch (error) {
      this.logger.error(`Error executing tool action: ${getErrorMessage(error)}`);
      client.emit('error', { message: 'Failed to execute tool action' });
    }
  }

  @SubscribeMessage('get_server_status')
  async handleGetServerStatus(
    @MessageBody() data: { serverId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // Emit event to request server status
      this.eventEmitter.emit('websocket.get_server_status', {
        clientId: client.id,
        serverId: data.serverId,
      });
    } catch (error) {
      this.logger.error(`Error getting server status: ${getErrorMessage(error)}`);
      client.emit('error', { message: 'Failed to get server status' });
    }
  }

  // Public method to broadcast events to all connected clients
  broadcast(event: string, data: any) {
    this.server.emit(event, data);
    this.logger.debug(`Broadcasted ${event} to ${this.connectedClients.size} clients`);
  }

  // Public method to send events to specific client
  sendToClient(clientId: string, event: string, data: any) {
    this.server.to(clientId).emit(event, data);
    this.logger.debug(`Sent ${event} to client ${clientId}`);
  }

  private setupEventSubscriptions() {
    // Subscribe to log entries from all services
    this.eventEmitter.on('log.entry', (logData) => {
      const message: WebSocketMessage = {
        type: 'log',
        payload: logData,
        timestamp: new Date(),
        serverId: logData.serverId,
      };
      this.broadcast('log_entry', logData);
    });

    // Subscribe to server status updates
    this.eventEmitter.on('server.status.update', (statusData) => {
      const message: WebSocketMessage = {
        type: 'server_status',
        payload: statusData,
        timestamp: new Date(),
        serverId: statusData.serverId,
      };
      this.broadcast('server_status', statusData);
    });

    // Subscribe to tool updates
    this.eventEmitter.on('tool.update', (toolData) => {
      const message: WebSocketMessage = {
        type: 'tool_update',
        payload: toolData,
        timestamp: new Date(),
        serverId: toolData.serverId,
      };
      this.broadcast('tool_update', toolData);
    });

    // Subscribe to workflow updates
    this.eventEmitter.on('workflow.update', (workflowData) => {
      const message: WebSocketMessage = {
        type: 'workflow_update',
        payload: workflowData,
        timestamp: new Date(),
        serverId: workflowData.serverId,
      };
      this.broadcast('workflow_update', workflowData);
    });

    // Subscribe to system alerts
    this.eventEmitter.on('system.alert', (alertData) => {
      const message: WebSocketMessage = {
        type: 'system_alert',
        payload: alertData,
        timestamp: new Date(),
      };
      this.broadcast('system_alert', alertData);
    });

    // Subscribe to memory updates
    this.eventEmitter.on('memory.update', (memoryData) => {
      const message: WebSocketMessage = {
        type: 'memory_update',
        payload: memoryData,
        timestamp: new Date(),
        serverId: 'memory-server',
      };
      this.broadcast('memory_update', memoryData);
    });

    this.logger.log('Event subscriptions established for WebSocket broadcasting');
  }

  private async sendInitialData(client: Socket) {
    try {
      // Request initial system status
      this.eventEmitter.emit('websocket.get_initial_status', {
        clientId: client.id,
      });
    } catch (error) {
      this.logger.error(`Error sending initial data to client ${client.id}: ${getErrorMessage(error)}`);
    }
  }
}