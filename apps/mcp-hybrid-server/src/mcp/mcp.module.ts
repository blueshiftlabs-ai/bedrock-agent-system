import { Module, DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { McpModule as ReKogMcpModule } from '@rekog/mcp-nest';

// Services
import { MCPLifecycleService } from './mcp-lifecycle.service';
import { MCPHealthService } from './services/mcp-health.service';
import { MCPConfigValidationService } from './services/mcp-config-validation.service';

// Import client module
import { MCPClientModule } from '../integrations/mcp-client/mcp-client.module';

// Import tool module for server functionality
import { ToolModule } from '../tools/tool.module';

@Module({})
export class MCPModule {
  static forRoot(): DynamicModule {
    return {
      module: MCPModule,
      imports: [
        ConfigModule,
        EventEmitterModule,
        ScheduleModule.forRoot(),
        
        // Configure MCP Server with basic options
        // ReKogMcpModule.forRoot({
        //   name: 'hybrid-mcp-server',
        //   version: '1.0.0',
        // }),
        
        // Import client module (conditionally based on config)
        MCPClientModule,
        
        // Import tool module for server tools
        // ToolModule,
      ],
      providers: [
        MCPLifecycleService,
        MCPHealthService,
        MCPConfigValidationService,
      ],
      exports: [
        MCPLifecycleService,
        MCPHealthService,
        MCPConfigValidationService,
        MCPClientModule,
        // ToolModule,
      ],
    };
  }
}