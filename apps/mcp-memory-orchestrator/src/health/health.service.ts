import { Injectable, Logger } from '@nestjs/common';
import { MCPClientService } from '../clients/mcp-client.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly mcpClient: MCPClientService) {}

  async getHealthStatus() {
    const mcpServerHealth = await this.mcpClient.getAllServerHealth();
    const configuredServers = this.mcpClient.getConfiguredServers();
    
    const healthyServers = Object.values(mcpServerHealth).filter(Boolean).length;
    const totalServers = configuredServers.length;
    
    const status = healthyServers === totalServers ? 'healthy' : 
                   healthyServers > 0 ? 'degraded' : 'unhealthy';

    return {
      status,
      timestamp: new Date().toISOString(),
      service: 'memory-orchestrator',
      version: '1.0.0',
      mcp_servers: {
        total: totalServers,
        healthy: healthyServers,
        status: mcpServerHealth,
      },
      capabilities: this.getAvailableCapabilities(),
    };
  }

  async getMCPServerHealth() {
    const serverHealth = await this.mcpClient.getAllServerHealth();
    const configuredServers = this.mcpClient.getConfiguredServers();
    
    const detailed = {};
    
    for (const serverName of configuredServers) {
      const isHealthy = serverHealth[serverName];
      const capabilities = this.mcpClient.getServerCapabilities(serverName);
      
      detailed[serverName] = {
        status: isHealthy ? 'healthy' : 'unhealthy',
        capabilities,
        last_checked: new Date().toISOString(),
      };
    }

    return {
      servers: detailed,
      summary: {
        total_servers: configuredServers.length,
        healthy_servers: Object.values(serverHealth).filter(Boolean).length,
      },
    };
  }

  private getAvailableCapabilities(): string[] {
    const capabilities = new Set<string>();
    const configuredServers = this.mcpClient.getConfiguredServers();
    
    for (const serverName of configuredServers) {
      const serverCapabilities = this.mcpClient.getServerCapabilities(serverName);
      serverCapabilities.forEach(cap => capabilities.add(cap));
    }
    
    return Array.from(capabilities);
  }
}