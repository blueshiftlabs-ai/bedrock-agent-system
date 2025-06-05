import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Server } from 'socket.io';
import { getErrorMessage } from '../../common/utils/error.utils';

@Injectable()
export class MessageBrokerService {
  private readonly logger = new Logger(MessageBrokerService.name);
  private server: Server;

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.setupEventListeners();
  }

  setServer(server: Server) {
    this.server = server;
    this.logger.log('Socket.io server instance set');
  }

  private setupEventListeners() {
    // Listen for requests to send messages to specific clients
    this.eventEmitter.on('websocket.send_to_client', this.handleSendToClient.bind(this));
    
    // Listen for requests to broadcast messages to all clients
    this.eventEmitter.on('websocket.broadcast', this.handleBroadcast.bind(this));
    
    // Listen for room-based messaging
    this.eventEmitter.on('websocket.send_to_room', this.handleSendToRoom.bind(this));
    
    this.logger.log('Message broker event listeners established');
  }

  private handleSendToClient(data: { clientId: string; event: string; data: any }) {
    if (!this.server) {
      this.logger.warn('Socket.io server not available for client message');
      return;
    }

    try {
      this.server.to(data.clientId).emit(data.event, data.data);
      this.logger.debug(`Sent ${data.event} to client ${data.clientId}`);
    } catch (error) {
      this.logger.error(`Failed to send message to client ${data.clientId}: ${getErrorMessage(error)}`);
    }
  }

  private handleBroadcast(data: { event: string; data: any; exclude?: string[] }) {
    if (!this.server) {
      this.logger.warn('Socket.io server not available for broadcast');
      return;
    }

    try {
      if (data.exclude && data.exclude.length > 0) {
        // Broadcast to all except excluded clients
        const sockets = this.server.sockets.sockets;
        sockets.forEach((socket, socketId) => {
          if (!data.exclude.includes(socketId)) {
            socket.emit(data.event, data.data);
          }
        });
      } else {
        // Broadcast to all clients
        this.server.emit(data.event, data.data);
      }
      
      this.logger.debug(`Broadcasted ${data.event} to all clients`);
    } catch (error) {
      this.logger.error(`Failed to broadcast message: ${getErrorMessage(error)}`);
    }
  }

  private handleSendToRoom(data: { room: string; event: string; data: any }) {
    if (!this.server) {
      this.logger.warn('Socket.io server not available for room message');
      return;
    }

    try {
      this.server.to(data.room).emit(data.event, data.data);
      this.logger.debug(`Sent ${data.event} to room ${data.room}`);
    } catch (error) {
      this.logger.error(`Failed to send message to room ${data.room}: ${getErrorMessage(error)}`);
    }
  }

  // Public methods for direct usage
  public sendToClient(clientId: string, event: string, data: any) {
    this.eventEmitter.emit('websocket.send_to_client', {
      clientId,
      event,
      data,
    });
  }

  public broadcast(event: string, data: any, exclude?: string[]) {
    this.eventEmitter.emit('websocket.broadcast', {
      event,
      data,
      exclude,
    });
  }

  public sendToRoom(room: string, event: string, data: any) {
    this.eventEmitter.emit('websocket.send_to_room', {
      room,
      event,
      data,
    });
  }

  // Room management methods
  public joinRoom(clientId: string, room: string) {
    if (!this.server) {
      this.logger.warn('Socket.io server not available for room join');
      return;
    }

    const socket = this.server.sockets.sockets.get(clientId);
    if (socket) {
      socket.join(room);
      this.logger.debug(`Client ${clientId} joined room ${room}`);
    } else {
      this.logger.warn(`Socket not found for client ${clientId}`);
    }
  }

  public leaveRoom(clientId: string, room: string) {
    if (!this.server) {
      this.logger.warn('Socket.io server not available for room leave');
      return;
    }

    const socket = this.server.sockets.sockets.get(clientId);
    if (socket) {
      socket.leave(room);
      this.logger.debug(`Client ${clientId} left room ${room}`);
    } else {
      this.logger.warn(`Socket not found for client ${clientId}`);
    }
  }

  // Get connected clients information
  public getConnectedClients(): string[] {
    if (!this.server) {
      return [];
    }

    return Array.from(this.server.sockets.sockets.keys());
  }

  public getClientCount(): number {
    if (!this.server) {
      return 0;
    }

    return this.server.sockets.sockets.size;
  }

  public getRoomClients(room: string): string[] {
    if (!this.server) {
      return [];
    }

    const roomSockets = this.server.sockets.adapter.rooms.get(room);
    return roomSockets ? Array.from(roomSockets) : [];
  }

  // Health and monitoring methods
  public getConnectionStats() {
    if (!this.server) {
      return {
        connected: 0,
        totalConnections: 0,
        rooms: [],
      };
    }

    const rooms = Array.from(this.server.sockets.adapter.rooms.keys())
      .filter(room => !this.server.sockets.sockets.has(room)) // Filter out socket IDs
      .map(room => ({
        name: room,
        clientCount: this.getRoomClients(room).length,
      }));

    return {
      connected: this.server.sockets.sockets.size,
      totalConnections: this.server.engine.clientsCount,
      rooms,
    };
  }
}