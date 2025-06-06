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
      // Custom endpoint paths for namespaced MCP endpoints
      mcpEndpoint: 'memory/mcp',
      sseEndpoint: 'memory/sse',
      messagesEndpoint: 'memory/messages',
      // MCP server capabilities - must include all handlers that MCP-Nest registers
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
      instructions: 'MCP Memory Server provides sophisticated memory storage and retrieval capabilities including semantic search, graph connections, and multi-modal memory types.',
      // Support multiple transports for different use cases
      transport: [
        McpTransportType.STREAMABLE_HTTP,  // For HTTP clients and Fargate
        McpTransportType.SSE,              // For Claude Code and browsers
      ],
      streamableHttp: {
        // Enable JSON responses for non-streaming requests (good for testing)
        enableJsonResponse: true,
        // Use stateless mode for better scalability in Fargate
        statelessMode: true,
      },
      sse: {
        // SSE configuration for Claude Code compatibility
        pingEnabled: true,
        pingIntervalMs: 30000,
      },
    }),
  ],
  providers: [MCPToolsService],
  exports: [MCPToolsService],
})
export class MCPModule {}