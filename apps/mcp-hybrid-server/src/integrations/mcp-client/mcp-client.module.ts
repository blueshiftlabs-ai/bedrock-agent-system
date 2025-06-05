import { Module, OnModuleInit } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ToolModule } from '../../tools/tool.module';

// Services
import { MCPClientService } from './services/mcp-client.service';
import { MCPConfigService } from './services/mcp-config.service';
import { ToolDiscoveryService } from './services/tool-discovery.service';
import { AutoConnectionService } from './services/auto-connection.service';
import { MCPCliService } from './cli/mcp-cli.service';

// Adapters
import { ExternalToolAdapter } from './adapters/external-tool.adapter';

@Module({
  imports: [
    EventEmitterModule,
    ScheduleModule.forRoot(),
    ToolModule,
  ],
  providers: [
    MCPClientService,
    MCPConfigService,
    ToolDiscoveryService,
    AutoConnectionService,
    ExternalToolAdapter,
    MCPCliService,
  ],
  exports: [
    MCPClientService,
    MCPConfigService,
    ToolDiscoveryService,
    AutoConnectionService,
    ExternalToolAdapter,
    MCPCliService,
  ],
})
export class MCPClientModule implements OnModuleInit {
  constructor(
    private readonly autoConnectionService: AutoConnectionService,
    private readonly configService: MCPConfigService
  ) {}

  async onModuleInit() {
    // Initialize configuration service first
    await this.configService.onModuleInit();
    
    // Auto-connection service will handle connecting to auto-connect servers
    // This happens automatically through its OnModuleInit
  }
}