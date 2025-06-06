import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { McpModule as MCPNestModule, McpTransportType } from '@rekog/mcp-nest';
import { MemoryOrchestratorModule } from './memory-orchestrator/memory-orchestrator.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
    // MCP Server configuration
    MCPNestModule.forRoot({
      name: 'memory-orchestrator',
      version: '1.0.0',
      
      // MCP server capabilities
      capabilities: {
        tools: {
          listChanged: true
        },
        resources: {
          subscribe: true,
          listChanged: true
        },
        prompts: {
          listChanged: true
        }
      },
      
      // Instructions for using this MCP server
      instructions: 'Memory Orchestrator coordinates distributed memory operations across OpenSearch, PostgreSQL, and Neo4j via their respective MCP servers. Provides unified memory storage, retrieval, and relationship management.',
      
      // Support multiple transports
      transport: [
        McpTransportType.STREAMABLE_HTTP,
        McpTransportType.SSE,
      ],
      
      streamableHttp: {
        enableJsonResponse: true,
        statelessMode: true,
      },
      
      sse: {
        pingEnabled: true,
        pingIntervalMs: 30000,
      },
    }),
    
    MemoryOrchestratorModule,
    HealthModule,
  ],
})
export class AppModule {}