import { Module } from '@nestjs/common';
import { McpModule as MCPNestModule, McpTransportType } from '@rekog/mcp-nest';
import { MCPToolsService } from './mcp-tools.service';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [
    MemoryModule,
    MCPNestModule.forRoot({
      name: 'mcp-memory-server',
      version: '1.0.0',
      transport: [McpTransportType.STREAMABLE_HTTP],
      streamableHttp: {
        // Enable JSON responses for non-streaming requests (good for testing)
        enableJsonResponse: true,
        // Use stateless mode for better scalability in Fargate
        statelessMode: true,
      },
    }),
  ],
  providers: [MCPToolsService],
  exports: [MCPToolsService],
})
export class MCPModule {}