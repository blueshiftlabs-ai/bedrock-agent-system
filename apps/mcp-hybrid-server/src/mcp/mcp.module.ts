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
        
        // Configure MCP Server (conditionally)
        ReKogMcpModule.forRoot({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => {
            const serverEnabled = configService.get<boolean>('mcp.server.enabled', true);
            
            if (!serverEnabled) {
              return null; // Don't configure server if disabled
            }

            return {
              name: configService.get<string>('mcp.server.name', 'hybrid-mcp-server'),
              version: configService.get<string>('mcp.server.version', '1.0.0'),
              description: configService.get<string>('mcp.server.description', 'Advanced MCP server with NestJS and LangGraph integration'),
              transport: {
                type: configService.get<string>('mcp.server.transport.type', 'http+sse'),
                options: {
                  endpoint: configService.get<string>('mcp.server.endpoint', '/mcp'),
                  enableCors: configService.get<boolean>('mcp.server.transport.enableCors', true),
                  maxConnections: configService.get<number>('mcp.server.transport.maxConnections', 100),
                  connectionTimeout: configService.get<number>('mcp.server.transport.connectionTimeout', 30000),
                },
              },
            };
          },
        }),
        
        // Import client module (conditionally based on config)
        MCPClientModule,
        
        // Import tool module for server tools
        ToolModule,
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
        ToolModule,
      ],
    };
  }
}