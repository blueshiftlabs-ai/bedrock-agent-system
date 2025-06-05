import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { MCPServerInfo } from './mcp-server-discovery.service';
import { getErrorMessage } from '../../common/utils/error.utils';

export interface HealthCheckResult {
  serverId: string;
  timestamp: Date;
  success: boolean;
  responseTime: number;
  status: 'healthy' | 'degraded' | 'unhealthy';
  metrics?: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    requestsPerSecond: number;
    errorRate: number;
  };
  error?: string;
}

export interface ServerHealthHistory {
  serverId: string;
  checks: HealthCheckResult[];
  averageResponseTime: number;
  uptime: number;
  lastHealthyCheck?: Date;
  consecutiveFailures: number;
}

@Injectable()
export class MCPHealthMonitorService {
  private readonly logger = new Logger(MCPHealthMonitorService.name);
  private healthHistory = new Map<string, ServerHealthHistory>();
  private readonly maxHistorySize = 100;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly httpService: HttpService,
  ) {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Listen for server registration events
    this.eventEmitter.on('mcp.server.registered', this.handleServerRegistered.bind(this));
    this.eventEmitter.on('mcp.server.unregistered', this.handleServerUnregistered.bind(this));
    
    // Listen for health check requests
    this.eventEmitter.on('mcp.health_check', this.handleHealthCheckRequest.bind(this));
    
    this.logger.log('Health monitor event listeners established');
  }

  private handleServerRegistered(serverInfo: MCPServerInfo) {
    this.initializeHealthHistory(serverInfo.id);
    this.logger.log(`Started health monitoring for server: ${serverInfo.name}`);
  }

  private handleServerUnregistered(data: { serverId: string }) {
    this.healthHistory.delete(data.serverId);
    this.logger.log(`Stopped health monitoring for server: ${data.serverId}`);
  }

  private async handleHealthCheckRequest(data: { serverId: string; url: string }) {
    await this.performHealthCheck(data.serverId, data.url);
  }

  private initializeHealthHistory(serverId: string) {
    if (!this.healthHistory.has(serverId)) {
      this.healthHistory.set(serverId, {
        serverId,
        checks: [],
        averageResponseTime: 0,
        uptime: 0,
        consecutiveFailures: 0,
      });
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async performScheduledHealthChecks() {
    // This will be triggered by the discovery service for registered servers
    // We don't perform checks here to avoid duplicate checks
    this.calculateHealthMetrics();
  }

  private calculateHealthMetrics() {
    for (const [serverId, history] of this.healthHistory) {
      if (history.checks.length === 0) continue;

      // Calculate average response time from last 10 checks
      const recentChecks = history.checks.slice(-10);
      const successfulChecks = recentChecks.filter(check => check.success);
      
      if (successfulChecks.length > 0) {
        history.averageResponseTime = successfulChecks.reduce(
          (sum, check) => sum + check.responseTime, 0
        ) / successfulChecks.length;
      }

      // Calculate uptime percentage from last 50 checks
      const uptimeChecks = history.checks.slice(-50);
      const successfulUptimeChecks = uptimeChecks.filter(check => check.success);
      history.uptime = (successfulUptimeChecks.length / uptimeChecks.length) * 100;

      // Count consecutive failures
      let consecutiveFailures = 0;
      for (let i = history.checks.length - 1; i >= 0; i--) {
        if (!history.checks[i].success) {
          consecutiveFailures++;
        } else {
          break;
        }
      }
      history.consecutiveFailures = consecutiveFailures;

      // Update last healthy check
      const lastHealthyCheck = [...history.checks]
        .reverse()
        .find(check => check.success);
      if (lastHealthyCheck) {
        history.lastHealthyCheck = lastHealthyCheck.timestamp;
      }

      // Emit health alerts if needed
      this.checkForHealthAlerts(serverId, history);
    }
  }

  private checkForHealthAlerts(serverId: string, history: ServerHealthHistory) {
    const latestCheck = history.checks[history.checks.length - 1];
    if (!latestCheck) return;

    // Alert on consecutive failures
    if (history.consecutiveFailures >= 3) {
      this.eventEmitter.emit('system.alert', {
        id: `health-alert-${serverId}-${Date.now()}`,
        severity: history.consecutiveFailures >= 5 ? 'critical' : 'warning',
        title: 'Server Health Alert',
        message: `Server ${serverId} has ${history.consecutiveFailures} consecutive health check failures`,
        timestamp: new Date(),
        source: 'health-monitor',
        acknowledged: false,
        resolved: false,
        metadata: {
          serverId,
          consecutiveFailures: history.consecutiveFailures,
          lastError: latestCheck.error,
        },
      });
    }

    // Alert on low uptime
    if (history.uptime < 80 && history.checks.length >= 10) {
      this.eventEmitter.emit('system.alert', {
        id: `uptime-alert-${serverId}-${Date.now()}`,
        severity: history.uptime < 50 ? 'critical' : 'warning',
        title: 'Low Server Uptime',
        message: `Server ${serverId} has ${history.uptime.toFixed(1)}% uptime`,
        timestamp: new Date(),
        source: 'health-monitor',
        acknowledged: false,
        resolved: false,
        metadata: {
          serverId,
          uptime: history.uptime,
          totalChecks: history.checks.length,
        },
      });
    }

    // Alert on high response time
    if (history.averageResponseTime > 5000) {
      this.eventEmitter.emit('system.alert', {
        id: `response-time-alert-${serverId}-${Date.now()}`,
        severity: history.averageResponseTime > 10000 ? 'critical' : 'warning',
        title: 'High Response Time',
        message: `Server ${serverId} has average response time of ${history.averageResponseTime.toFixed(0)}ms`,
        timestamp: new Date(),
        source: 'health-monitor',
        acknowledged: false,
        resolved: false,
        metadata: {
          serverId,
          averageResponseTime: history.averageResponseTime,
        },
      });
    }
  }

  public async performHealthCheck(serverId: string, url: string): Promise<HealthCheckResult> {
    this.initializeHealthHistory(serverId);
    
    const startTime = Date.now();
    const timestamp = new Date();
    
    try {
      const healthUrl = `${url}/health`;
      
      const response = await firstValueFrom(
        this.httpService.get(healthUrl, {
          timeout: 10000,
        })
      );

      const responseTime = Date.now() - startTime;
      const healthData = response.data;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      // Determine health status based on response data
      if (healthData.status === 'degraded' || responseTime > 5000) {
        status = 'degraded';
      } else if (healthData.status === 'unhealthy' || responseTime > 10000) {
        status = 'unhealthy';
      }

      const result: HealthCheckResult = {
        serverId,
        timestamp,
        success: true,
        responseTime,
        status,
        metrics: {
          uptime: healthData.uptime || 0,
          memoryUsage: healthData.memory?.usage || 0,
          cpuUsage: healthData.cpu?.usage || 0,
          requestsPerSecond: healthData.performance?.requestsPerSecond || 0,
          errorRate: healthData.performance?.errorRate || 0,
        },
      };

      this.addHealthCheckResult(serverId, result);
      
      // Emit health check success event
      this.eventEmitter.emit('mcp.server.health_check', result);
      
      return result;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      const result: HealthCheckResult = {
        serverId,
        timestamp,
        success: false,
        responseTime,
        status: 'unhealthy',
        error: getErrorMessage(error),
      };

      this.addHealthCheckResult(serverId, result);
      
      // Emit health check failure event
      this.eventEmitter.emit('mcp.server.health_check_failed', result);
      
      this.logger.warn(`Health check failed for server ${serverId}: ${getErrorMessage(error)}`);
      
      return result;
    }
  }

  private addHealthCheckResult(serverId: string, result: HealthCheckResult) {
    const history = this.healthHistory.get(serverId);
    if (!history) return;

    history.checks.push(result);
    
    // Maintain history size
    if (history.checks.length > this.maxHistorySize) {
      history.checks = history.checks.slice(-this.maxHistorySize);
    }

    this.healthHistory.set(serverId, history);
  }

  // Public methods for accessing health data
  public getServerHealth(serverId: string): ServerHealthHistory | undefined {
    return this.healthHistory.get(serverId);
  }

  public getAllServerHealth(): ServerHealthHistory[] {
    return Array.from(this.healthHistory.values());
  }

  public getHealthSummary() {
    const servers = Array.from(this.healthHistory.values());
    const totalServers = servers.length;
    const healthyServers = servers.filter(server => {
      const latestCheck = server.checks[server.checks.length - 1];
      return latestCheck && latestCheck.success && latestCheck.status === 'healthy';
    }).length;
    
    const degradedServers = servers.filter(server => {
      const latestCheck = server.checks[server.checks.length - 1];
      return latestCheck && latestCheck.success && latestCheck.status === 'degraded';
    }).length;

    const unhealthyServers = totalServers - healthyServers - degradedServers;
    
    const averageUptime = servers.length > 0 
      ? servers.reduce((sum, server) => sum + server.uptime, 0) / servers.length
      : 0;

    return {
      totalServers,
      healthyServers,
      degradedServers,
      unhealthyServers,
      averageUptime,
      timestamp: new Date(),
    };
  }

  public getRecentHealthChecks(serverId: string, limit: number = 20): HealthCheckResult[] {
    const history = this.healthHistory.get(serverId);
    if (!history) return [];

    return history.checks.slice(-limit);
  }

  public isServerHealthy(serverId: string): boolean {
    const history = this.healthHistory.get(serverId);
    if (!history || history.checks.length === 0) return false;

    const latestCheck = history.checks[history.checks.length - 1];
    return latestCheck.success && latestCheck.status === 'healthy';
  }
}