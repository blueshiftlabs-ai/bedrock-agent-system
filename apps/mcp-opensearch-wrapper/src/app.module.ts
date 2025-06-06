import { Module } from '@nestjs/common';
import { McpModule as MCPNestModule, McpTransportType } from '@rekog/mcp-nest';
import { OpenSearchService } from './opensearch.service';

@Module({
  imports: [
    MCPNestModule.forRoot({
      name: 'opensearch-mcp',
      version: '1.0.0',
      
      capabilities: {
        tools: {
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
  controllers: [],
})
export class AppModule {}