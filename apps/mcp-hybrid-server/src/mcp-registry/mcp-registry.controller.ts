import { 
  Controller, 
  Get, 
  Post, 
  Delete,
  Param,
  Body,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { MCPServerDiscoveryService, MCPServerConfig } from './services/mcp-server-discovery.service';
import { MCPHealthMonitorService } from './services/mcp-health-monitor.service';
import { MCPToolRegistryService } from './services/mcp-tool-registry.service';
import { getErrorMessage } from '../common/utils/error.utils';

@Controller('api')
export class MCPRegistryController {
  constructor(
    private readonly discoveryService: MCPServerDiscoveryService,
    private readonly healthService: MCPHealthMonitorService,
    private readonly toolService: MCPToolRegistryService,
  ) {}

  // Server endpoints
  @Get('servers')
  async getServers() {
    const servers = this.discoveryService.getRegisteredServers();
    return {
      success: true,
      data: servers,
      count: servers.length,
    };
  }

  @Get('servers/:id')
  async getServer(@Param('id') serverId: string) {
    const server = this.discoveryService.getServerById(serverId);
    if (!server) {
      throw new HttpException('Server not found', HttpStatus.NOT_FOUND);
    }
    return {
      success: true,
      data: server,
    };
  }

  @Get('servers/:id/status')
  async getServerStatus(@Param('id') serverId: string) {
    const server = this.discoveryService.getServerById(serverId);
    if (!server) {
      throw new HttpException('Server not found', HttpStatus.NOT_FOUND);
    }

    const health = this.healthService.getServerHealth(serverId);
    const isHealthy = this.healthService.isServerHealthy(serverId);

    return {
      success: true,
      data: {
        server,
        health,
        isHealthy,
        lastCheck: health?.checks[health.checks.length - 1],
      },
    };
  }

  @Get('servers/:id/tools')
  async getServerTools(@Param('id') serverId: string) {
    const tools = this.toolService.getToolsByServer(serverId);
    return {
      success: true,
      data: tools,
      count: tools.length,
    };
  }

  @Post('servers/:id/connect')
  async connectToServer(@Param('id') serverId: string) {
    const success = await this.discoveryService.forceHealthCheck(serverId);
    return {
      success,
      message: success ? 'Connected successfully' : 'Connection failed',
    };
  }

  @Delete('servers/:id/disconnect')
  async disconnectFromServer(@Param('id') serverId: string) {
    const success = this.discoveryService.unregisterServer(serverId);
    return {
      success,
      message: success ? 'Disconnected successfully' : 'Server not found',
    };
  }

  @Post('servers/register')
  async registerServer(@Body() config: MCPServerConfig) {
    const success = await this.discoveryService.registerServer(config);
    return {
      success,
      message: success ? 'Server registered successfully' : 'Registration failed',
    };
  }

  // Tool endpoints
  @Get('tools')
  async getTools(
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('server') serverId?: string,
  ) {
    let tools = this.toolService.getAllTools();

    if (category) {
      tools = tools.filter(tool => tool.category === category);
    }
    if (status) {
      tools = tools.filter(tool => tool.status === status);
    }
    if (serverId) {
      tools = tools.filter(tool => tool.serverId === serverId);
    }

    return {
      success: true,
      data: tools,
      count: tools.length,
    };
  }

  @Get('tools/categories')
  async getToolCategories() {
    const categories = this.toolService.getToolCategories();
    return {
      success: true,
      data: categories,
    };
  }

  @Get('tools/stats')
  async getToolStats() {
    const stats = this.toolService.getToolStats();
    return {
      success: true,
      data: stats,
    };
  }

  @Get('tools/:id')
  async getTool(@Param('id') toolId: string) {
    const tool = this.toolService.getToolById(toolId);
    if (!tool) {
      throw new HttpException('Tool not found', HttpStatus.NOT_FOUND);
    }
    return {
      success: true,
      data: tool,
    };
  }

  @Post('tools/:id/execute')
  async executeTool(
    @Param('id') toolId: string,
    @Body() params: any,
  ) {
    try {
      const result = await this.toolService.executeTool(toolId, params);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        getErrorMessage(error) || 'Tool execution failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('tools/:id/history')
  async getToolHistory(@Param('id') toolId: string) {
    const history = this.toolService.getExecutionHistory(toolId);
    return {
      success: true,
      data: history,
      count: history.length,
    };
  }

  // System status endpoints
  @Get('status')
  async getSystemStatus() {
    const servers = this.discoveryService.getRegisteredServers();
    const connectedServers = this.discoveryService.getConnectedServers();
    const healthSummary = this.healthService.getHealthSummary();
    const toolStats = this.toolService.getToolStats();

    // Get memory server specific status
    const memoryServer = servers.find(s => s.id === 'memory-server');
    const memoryServerHealth = memoryServer ? this.healthService.getServerHealth('memory-server') : undefined;

    const memoryServerStatus = memoryServer ? {
      connected: memoryServer.status === 'connected',
      memoriesStored: 0, // TODO: Get from memory server
      activeAgents: 0, // TODO: Get from memory server
      indexHealth: {
        opensearch: true, // TODO: Get actual health
        dynamodb: true,
        neptune: true,
      },
      lastMemoryCreated: undefined, // TODO: Get from memory server
      totalMemorySize: 0, // TODO: Get from memory server
    } : null;

    const overall = healthSummary.healthyServers === healthSummary.totalServers 
      ? 'healthy' 
      : healthSummary.unhealthyServers > 0 
        ? 'critical' 
        : 'degraded';

    return {
      success: true,
      data: {
        overall,
        servers: servers.length,
        activeProcesses: connectedServers.length,
        runningWorkflows: 0, // TODO: Get from workflow service
        activeTools: toolStats.activeTools,
        memoryServerStatus,
        healthSummary,
        toolStats,
        lastUpdate: new Date(),
        alerts: [], // TODO: Get from alert service
      },
    };
  }

  @Get('status/memory-server')
  async getMemoryServerStatus() {
    const memoryServer = this.discoveryService.getServerById('memory-server');
    if (!memoryServer) {
      throw new HttpException('Memory server not found', HttpStatus.NOT_FOUND);
    }

    const health = this.healthService.getServerHealth('memory-server');
    const tools = this.toolService.getToolsByServer('memory-server');

    return {
      success: true,
      data: {
        server: memoryServer,
        health,
        tools: tools.map(t => ({ id: t.id, name: t.name, status: t.status })),
        status: {
          connected: memoryServer.status === 'connected',
          memoriesStored: 0, // TODO: Get from memory server
          activeAgents: 0, // TODO: Get from memory server
          indexHealth: {
            opensearch: true, // TODO: Get actual health
            dynamodb: true,
            neptune: true,
          },
          lastMemoryCreated: undefined, // TODO: Get from memory server
          totalMemorySize: 0, // TODO: Get from memory server
        },
      },
    };
  }

  @Get('metrics')
  async getMetrics() {
    const servers = this.discoveryService.getRegisteredServers();
    const metrics = {
      timestamp: new Date(),
      servers: servers.map(server => ({
        id: server.id,
        name: server.name,
        status: server.status,
        metrics: server.metrics,
      })),
      aggregated: {
        totalMemoryUsage: servers.reduce((sum, s) => sum + (s.metrics?.memoryUsage || 0), 0),
        totalCpuUsage: servers.reduce((sum, s) => sum + (s.metrics?.cpuUsage || 0), 0) / servers.length,
        totalRequestsPerSecond: servers.reduce((sum, s) => sum + (s.metrics?.requestsPerSecond || 0), 0),
        averageResponseTime: servers.reduce((sum, s) => sum + (s.metrics?.responseTime || 0), 0) / servers.length,
      },
    };

    return {
      success: true,
      data: metrics,
    };
  }

  // Log endpoints
  @Get('logs/sources')
  async getLogSources() {
    const servers = this.discoveryService.getRegisteredServers();
    const sources = [
      'all',
      'system',
      'hybrid-server',
      ...servers.map(s => s.id),
    ];

    return {
      success: true,
      data: sources,
    };
  }
}