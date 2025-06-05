import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { getErrorMessage } from '../../common/utils/error.utils';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  source: string;
  serverId?: string;
  processId?: string;
  metadata?: Record<string, any>;
}

export interface ServerStatus {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  url: string;
  version?: string;
  lastSeen?: Date;
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
export class EventAggregatorService {
  private readonly logger = new Logger(EventAggregatorService.name);
  private logBuffer: LogEntry[] = [];
  private serverStatuses = new Map<string, ServerStatus>();
  private readonly maxLogBufferSize = 1000;

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Listen for WebSocket requests
    this.eventEmitter.on('websocket.get_recent_logs', this.handleGetRecentLogs.bind(this));
    this.eventEmitter.on('websocket.get_initial_status', this.handleGetInitialStatus.bind(this));
    this.eventEmitter.on('websocket.get_server_status', this.handleGetServerStatus.bind(this));

    // Listen for MCP server events
    this.eventEmitter.on('mcp.server.log', this.handleMCPServerLog.bind(this));
    this.eventEmitter.on('mcp.server.status', this.handleMCPServerStatus.bind(this));
    this.eventEmitter.on('mcp.server.error', this.handleMCPServerError.bind(this));

    // Listen for internal system events
    this.eventEmitter.on('system.log', this.handleSystemLog.bind(this));
    
    this.logger.log('Event listeners established');
  }

  private handleGetRecentLogs(data: { clientId: string; limit: number; filter?: any }) {
    let logs = [...this.logBuffer];
    
    // Apply filters if provided
    if (data.filter) {
      if (data.filter.level && data.filter.level !== 'all') {
        logs = logs.filter(log => log.level === data.filter.level);
      }
      if (data.filter.source && data.filter.source !== 'all') {
        logs = logs.filter(log => log.source === data.filter.source);
      }
      if (data.filter.search) {
        logs = logs.filter(log => 
          log.message.toLowerCase().includes(data.filter.search.toLowerCase())
        );
      }
    }

    // Sort by timestamp and limit
    logs = logs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, data.limit);

    // Send logs to specific client
    this.eventEmitter.emit('websocket.send_to_client', {
      clientId: data.clientId,
      event: 'recent_logs',
      data: logs.reverse(), // Reverse to show chronological order
    });
  }

  private handleGetInitialStatus(data: { clientId: string }) {
    const systemStatus = {
      overall: this.calculateOverallHealth(),
      servers: this.serverStatuses.size,
      activeProcesses: Array.from(this.serverStatuses.values()).filter(s => s.status === 'connected').length,
      runningWorkflows: 0, // TODO: Get from workflow service
      activeTools: 0, // TODO: Get from tool registry
      memoryServerStatus: this.getMemoryServerStatus(),
      lastUpdate: new Date(),
      alerts: this.getActiveAlerts(),
    };

    this.eventEmitter.emit('websocket.send_to_client', {
      clientId: data.clientId,
      event: 'initial_status',
      data: systemStatus,
    });
  }

  private handleGetServerStatus(data: { clientId: string; serverId?: string }) {
    if (data.serverId) {
      const serverStatus = this.serverStatuses.get(data.serverId);
      this.eventEmitter.emit('websocket.send_to_client', {
        clientId: data.clientId,
        event: 'server_status',
        data: serverStatus || null,
      });
    } else {
      const allStatuses = Array.from(this.serverStatuses.values());
      this.eventEmitter.emit('websocket.send_to_client', {
        clientId: data.clientId,
        event: 'servers_status',
        data: allStatuses,
      });
    }
  }

  private handleMCPServerLog(logData: any) {
    const logEntry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level: logData.level || 'info',
      message: logData.message,
      source: logData.source || 'mcp-server',
      serverId: logData.serverId,
      metadata: logData.metadata,
    };

    this.addLogEntry(logEntry);
  }

  private handleMCPServerStatus(statusData: any) {
    const serverStatus: ServerStatus = {
      id: statusData.id,
      name: statusData.name,
      status: statusData.status,
      url: statusData.url,
      version: statusData.version,
      lastSeen: new Date(),
      metrics: statusData.metrics,
    };

    this.serverStatuses.set(statusData.id, serverStatus);
    
    // Broadcast status update
    this.eventEmitter.emit('server.status.update', serverStatus);
  }

  private handleMCPServerError(errorData: any) {
    const logEntry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level: 'error',
      message: `MCP Server Error: ${errorData.message}`,
      source: errorData.source || 'mcp-server',
      serverId: errorData.serverId,
      metadata: { error: errorData.error },
    };

    this.addLogEntry(logEntry);

    // Update server status to error if it's a server-specific error
    if (errorData.serverId && this.serverStatuses.has(errorData.serverId)) {
      const serverStatus = this.serverStatuses.get(errorData.serverId);
      serverStatus.status = 'error';
      this.serverStatuses.set(errorData.serverId, serverStatus);
      
      // Broadcast status update
      this.eventEmitter.emit('server.status.update', serverStatus);
    }

    // Emit system alert for critical errors
    if (errorData.level === 'critical' || errorData.level === 'fatal') {
      this.eventEmitter.emit('system.alert', {
        id: `alert-${Date.now()}`,
        severity: 'error',
        title: 'MCP Server Error',
        message: errorData.message,
        timestamp: new Date(),
        source: errorData.source || 'mcp-server',
        acknowledged: false,
        resolved: false,
      });
    }
  }

  private handleSystemLog(logData: any) {
    const logEntry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level: logData.level || 'info',
      message: logData.message,
      source: logData.source || 'system',
      metadata: logData.metadata,
    };

    this.addLogEntry(logEntry);
  }

  private addLogEntry(logEntry: LogEntry) {
    this.logBuffer.push(logEntry);
    
    // Maintain buffer size
    if (this.logBuffer.length > this.maxLogBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxLogBufferSize);
    }

    // Emit log entry for real-time broadcasting
    this.eventEmitter.emit('log.entry', logEntry);
  }

  private calculateOverallHealth(): 'healthy' | 'degraded' | 'critical' {
    const servers = Array.from(this.serverStatuses.values());
    const connectedServers = servers.filter(s => s.status === 'connected');
    const errorServers = servers.filter(s => s.status === 'error');

    if (servers.length === 0) return 'critical';
    if (errorServers.length > 0) return 'degraded';
    if (connectedServers.length === servers.length) return 'healthy';
    
    return 'degraded';
  }

  private getMemoryServerStatus() {
    const memoryServer = this.serverStatuses.get('memory-server');
    if (!memoryServer) {
      return {
        connected: false,
        memoriesStored: 0,
        activeAgents: 0,
        indexHealth: {
          opensearch: false,
          dynamodb: false,
          neptune: false,
        },
        totalMemorySize: 0,
      };
    }

    return {
      connected: memoryServer.status === 'connected',
      memoriesStored: 0, // TODO: Get from memory server
      activeAgents: 0, // TODO: Get from memory server
      indexHealth: {
        opensearch: true, // TODO: Get actual health status
        dynamodb: true,
        neptune: true,
      },
      lastMemoryCreated: undefined, // TODO: Get from memory server
      totalMemorySize: 0, // TODO: Get from memory server
    };
  }

  private getActiveAlerts() {
    // TODO: Implement alert storage and retrieval
    return [];
  }

  // Periodic health check for all registered servers
  @Cron(CronExpression.EVERY_30_SECONDS)
  async performHealthChecks() {
    for (const [serverId, serverStatus] of this.serverStatuses) {
      try {
        // TODO: Implement actual health check to server
        // For now, we'll emit a health check request event
        this.eventEmitter.emit('mcp.health_check', {
          serverId,
          url: serverStatus.url,
        });
      } catch (error) {
        this.logger.error(`Health check failed for server ${serverId}: ${getErrorMessage(error)}`);
        
        // Update server status to error
        serverStatus.status = 'error';
        this.serverStatuses.set(serverId, serverStatus);
        
        // Broadcast status update
        this.eventEmitter.emit('server.status.update', serverStatus);
      }
    }
  }

  // Public methods for other services to use
  public registerServer(serverInfo: Omit<ServerStatus, 'lastSeen'>) {
    const serverStatus: ServerStatus = {
      ...serverInfo,
      lastSeen: new Date(),
    };
    
    this.serverStatuses.set(serverInfo.id, serverStatus);
    this.eventEmitter.emit('server.status.update', serverStatus);
    
    this.logger.log(`Registered MCP server: ${serverInfo.name} (${serverInfo.id})`);
  }

  public logEvent(level: LogEntry['level'], message: string, source: string, metadata?: any) {
    this.handleSystemLog({
      level,
      message,
      source,
      metadata,
    });
  }
}