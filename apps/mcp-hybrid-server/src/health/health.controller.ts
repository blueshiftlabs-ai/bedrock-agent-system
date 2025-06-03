import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheckService,
  HealthCheck,
  HealthCheckResult,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { MCPLifecycleService } from '../mcp/mcp-lifecycle.service';
import { MCPHealthService } from '../mcp/services/mcp-health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly mcpLifecycle: MCPLifecycleService,
    private readonly mcpHealth: MCPHealthService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get overall health status' })
  @ApiResponse({ status: 200, description: 'Health check results' })
  @HealthCheck()
  check() {
    return this.health.check([
      // System health indicators
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024), // 150MB
      () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024), // 300MB
      () => this.disk.checkStorage('storage', { threshold: 250 * 1024 * 1024 * 1024, path: '/' }), // 250GB
      
      // MCP-specific health indicators
      () => this.mcpLifecycle.isHealthy(),
      () => this.mcpHealth.isHealthy(),
    ]);
  }

  @Get('mcp')
  @ApiOperation({ summary: 'Get detailed MCP health status' })
  @ApiResponse({ status: 200, description: 'Detailed MCP health report' })
  async mcpHealth() {
    return await this.mcpHealth.generateHealthReport();
  }

  @Get('mcp/connections')
  @ApiOperation({ summary: 'Get MCP connection status' })
  @ApiResponse({ status: 200, description: 'MCP connection details' })
  async mcpConnections() {
    const status = this.mcpLifecycle.getServiceStatus();
    const connectionDetails = await Promise.all(
      status.client.connections.map(async (conn) => {
        const metrics = await this.mcpHealth.getConnectionMetrics(conn.id);
        return { ...conn, metrics };
      })
    );

    return {
      server: status.server,
      client: {
        ...status.client,
        connections: connectionDetails,
      },
      overall: status.overall,
    };
  }

  @Get('mcp/test/:connectionId')
  @ApiOperation({ summary: 'Test specific MCP connection' })
  @ApiResponse({ status: 200, description: 'Connection test results' })
  async testConnection(@Controller('connectionId') connectionId: string) {
    return await this.mcpHealth.performConnectionTest(connectionId);
  }
}