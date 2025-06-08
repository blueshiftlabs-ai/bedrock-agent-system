import { Module } from '@nestjs/common';
import { McpModule as MCPNestModule, McpTransportType } from '@rekog/mcp-nest';
import { OpenSearchService } from './opensearch.service';
import { HealthController } from './health.controller';

@Module({
  imports: [
    MCPNestModule.forRoot({
      name: 'opensearch-mcp',
      version: '1.0.0',
      
      // Custom endpoint paths for namespaced MCP endpoints
      mcpEndpoint: 'opensearch/mcp',
      sseEndpoint: 'opensearch/sse',
      messagesEndpoint: 'opensearch/messages',
      
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
      
      instructions: 'OpenSearch MCP wrapper provides vector search and document indexing capabilities for AI agents.',
      
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
  ],
  providers: [OpenSearchService],
  controllers: [HealthController],
})
export class AppModule {}