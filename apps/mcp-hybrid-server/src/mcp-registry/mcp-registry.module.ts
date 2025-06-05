import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MCPServerDiscoveryService } from './services/mcp-server-discovery.service';
import { MCPHealthMonitorService } from './services/mcp-health-monitor.service';
import { MCPToolRegistryService } from './services/mcp-tool-registry.service';
import { MCPInitializationService } from './services/mcp-initialization.service';
import { MCPRegistryController } from './mcp-registry.controller';

@Module({
  imports: [HttpModule],
  providers: [
    MCPServerDiscoveryService,
    MCPHealthMonitorService,
    MCPToolRegistryService,
    MCPInitializationService,
  ],
  controllers: [MCPRegistryController],
  exports: [
    MCPServerDiscoveryService,
    MCPHealthMonitorService,
    MCPToolRegistryService,
  ],
})
export class MCPRegistryModule {}