import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { MCPClientService } from '../../integrations/mcp-client/services/mcp-client.service';
import { MCPLifecycleService } from '../mcp-lifecycle.service';

export interface MCPHealthReport {
  server: {
    enabled: boolean;
    status: 'healthy' | 'unhealthy';
    endpoint?: string;
    uptime?: number;
    error?: string;
  };
  client: {
    enabled: boolean;
    status: 'healthy' | 'degraded' | 'unhealthy';
    connections: Array<{
      id: string;
      name: string;
      status: string;
      responseTime?: number;
      lastPing?: Date;
      error?: string;
    }>;
    summary: {
      total: number;
      connected: number;
      disconnected: number;
      errors: number;
    };
  };
  overall: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    score: number; // 0-100
    issues: string[];
  };
}

@Injectable()
export class MCPHealthService extends HealthIndicator {
  private readonly logger = new Logger(MCPHealthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly mcpClientService: MCPClientService,
    private readonly mcpLifecycleService: MCPLifecycleService,
  ) {
    super();
  }

  async isHealthy(): Promise<HealthIndicatorResult> {
    const report = await this.generateHealthReport();
    const isHealthy = report.overall.status === 'healthy';
    
    const result = this.getStatus('mcp_health', isHealthy, report);

    if (!isHealthy) {
      throw new HealthCheckError('MCP Health check failed', result);
    }

    return result;
  }

  async generateHealthReport(): Promise<MCPHealthReport> {
    const serverEnabled = this.configService.get<boolean>('mcp.server.enabled', true);
    const clientEnabled = this.configService.get<boolean>('mcp.client.enabled', false);
    
    const report: MCPHealthReport = {
      server: await this.checkServerHealth(serverEnabled),
      client: await this.checkClientHealth(clientEnabled),
      overall: {
        status: 'healthy',
        score: 100,
        issues: [],
      },
    };

    // Calculate overall status
    this.calculateOverallHealth(report);

    return report;
  }

  private async checkServerHealth(enabled: boolean): Promise<MCPHealthReport['server']> {
    if (!enabled) {
      return {
        enabled: false,
        status: 'healthy', // Not enabled is not unhealthy
      };
    }

    try {
      const lifecycleStatus = this.mcpLifecycleService.getServiceStatus();
      const endpoint = this.configService.get<string>('mcp.server.endpoint', '/mcp');
      
      return {
        enabled: true,
        status: lifecycleStatus.server.running ? 'healthy' : 'unhealthy',
        endpoint,
        uptime: lifecycleStatus.server.uptime,
        error: lifecycleStatus.server.lastError,
      };
    } catch (error: any) {
      this.logger.error('Failed to check server health:', error);
      return {
        enabled: true,
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async checkClientHealth(enabled: boolean): Promise<MCPHealthReport['client']> {
    if (!enabled) {
      return {
        enabled: false,
        status: 'healthy', // Not enabled is not unhealthy
        connections: [],
        summary: { total: 0, connected: 0, disconnected: 0, errors: 0 },
      };
    }

    try {
      const connections = this.mcpClientService.getAllConnections();
      const connectionHealth = await Promise.all(
        connections.map(conn => this.checkConnectionHealth(conn.id))
      );

      const summary = {
        total: connections.length,
        connected: connectionHealth.filter(h => h.status === 'connected').length,
        disconnected: connectionHealth.filter(h => h.status === 'disconnected').length,
        errors: connectionHealth.filter(h => h.status === 'error').length,
      };

      let clientStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (summary.total > 0) {
        if (summary.connected === 0) {
          clientStatus = 'unhealthy';
        } else if (summary.connected < summary.total) {
          clientStatus = 'degraded';
        }
      }

      return {
        enabled: true,
        status: clientStatus,
        connections: connectionHealth,
        summary,
      };
    } catch (error: any) {
      this.logger.error('Failed to check client health:', error);
      return {
        enabled: true,
        status: 'unhealthy',
        connections: [],
        summary: { total: 0, connected: 0, disconnected: 0, errors: 1 },
      };
    }
  }

  private async checkConnectionHealth(connectionId: string): Promise<MCPHealthReport['client']['connections'][0]> {
    const connection = this.mcpClientService.getConnection(connectionId);
    if (!connection) {
      return {
        id: connectionId,
        name: 'Unknown',
        status: 'disconnected',
        error: 'Connection not found',
      };
    }

    try {
      let responseTime: number | undefined;
      let lastPing: Date | undefined;

      // Ping the connection if it's connected
      if (connection.status === 'connected') {
        const startTime = Date.now();
        try {
          // Try a simple operation to check responsiveness
          await this.mcpClientService.listTools(connectionId);
          responseTime = Date.now() - startTime;
          lastPing = new Date();
        } catch (error: any) {
          // Connection exists but not responsive
          return {
            id: connectionId,
            name: connection.name,
            status: 'error',
            error: 'Connection not responsive',
          };
        }
      }

      return {
        id: connectionId,
        name: connection.name,
        status: connection.status,
        responseTime,
        lastPing,
        error: connection.lastError,
      };
    } catch (error: any) {
      return {
        id: connectionId,
        name: connection.name,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private calculateOverallHealth(report: MCPHealthReport): void {
    const issues: string[] = [];
    let score = 100;

    // Check server health
    if (report.server.enabled && report.server.status !== 'healthy') {
      issues.push(`MCP Server is ${report.server.status}${report.server.error ? `: ${report.server.error}` : ''}`);
      score -= 50; // Server issues are critical
    }

    // Check client health
    if (report.client.enabled) {
      if (report.client.status === 'unhealthy') {
        issues.push(`MCP Client is unhealthy: ${report.client.summary.errors} errors, ${report.client.summary.disconnected} disconnected`);
        score -= 30;
      } else if (report.client.status === 'degraded') {
        issues.push(`MCP Client is degraded: ${report.client.summary.connected}/${report.client.summary.total} connections active`);
        score -= 15;
      }

      // Check for slow connections
      const slowConnections = report.client.connections.filter(
        conn => conn.responseTime && conn.responseTime > 5000 // 5 seconds
      );
      if (slowConnections.length > 0) {
        issues.push(`${slowConnections.length} slow MCP connections detected`);
        score -= Math.min(10, slowConnections.length * 2);
      }
    }

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (score >= 90) {
      overallStatus = 'healthy';
    } else if (score >= 70) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'unhealthy';
    }

    report.overall = {
      status: overallStatus,
      score: Math.max(0, score),
      issues,
    };
  }

  async performConnectionTest(connectionId: string): Promise<{
    success: boolean;
    responseTime: number;
    toolsAvailable: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      const tools = await this.mcpClientService.listTools(connectionId);
      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        responseTime,
        toolsAvailable: tools.length,
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      return {
        success: false,
        responseTime,
        toolsAvailable: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getConnectionMetrics(connectionId: string): Promise<{
    id: string;
    name: string;
    status: string;
    uptime: number;
    toolsCount: number;
    promptsCount: number;
    resourcesCount: number;
    lastActivity?: Date;
    errors: string[];
  } | null> {
    const connection = this.mcpClientService.getConnection(connectionId);
    if (!connection) {
      return null;
    }

    try {
      const [tools, prompts, resources] = await Promise.allSettled([
        this.mcpClientService.listTools(connectionId),
        this.mcpClientService.listPrompts(connectionId),
        this.mcpClientService.listResources(connectionId),
      ]);

      return {
        id: connection.id,
        name: connection.name,
        status: connection.status,
        uptime: Date.now() - connection.createdAt.getTime(),
        toolsCount: tools.status === 'fulfilled' ? tools.value.length : 0,
        promptsCount: prompts.status === 'fulfilled' ? prompts.value.length : 0,
        resourcesCount: resources.status === 'fulfilled' ? resources.value.length : 0,
        lastActivity: new Date(), // Could be tracked more precisely
        errors: [
          ...(tools.status === 'rejected' ? [`Tools: ${tools.reason}`] : []),
          ...(prompts.status === 'rejected' ? [`Prompts: ${prompts.reason}`] : []),
          ...(resources.status === 'rejected' ? [`Resources: ${resources.reason}`] : []),
        ],
      };
    } catch (error: any) {
      this.logger.error(`Failed to get metrics for connection ${connectionId}:`, error);
      return {
        id: connection.id,
        name: connection.name,
        status: connection.status,
        uptime: Date.now() - connection.createdAt.getTime(),
        toolsCount: 0,
        promptsCount: 0,
        resourcesCount: 0,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }
}