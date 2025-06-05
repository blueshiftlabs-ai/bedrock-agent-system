import { Module } from '@nestjs/common';
import { McpModule as MCPNestModule } from '@rekog/mcp-nest';
import { MCPToolsService } from './mcp-tools.service';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [
    MemoryModule,
    MCPNestModule.forRoot({
      name: 'mcp-memory-server',
      version: '1.0.0',
      instructions: 'Sophisticated memory server with semantic search and knowledge graphs',
    }),
  ],
  providers: [MCPToolsService],
  exports: [MCPToolsService],
})
export class MCPModule {}