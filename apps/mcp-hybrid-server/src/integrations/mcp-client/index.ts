// Main module export
export { MCPClientModule } from './mcp-client.module';

// Services
export { MCPClientService } from './services/mcp-client.service';
export { MCPConfigService } from './services/mcp-config.service';
export { ToolDiscoveryService } from './services/tool-discovery.service';
export { AutoConnectionService } from './services/auto-connection.service';
export { MCPCliService } from './cli/mcp-cli.service';

// Adapters
export { ExternalToolAdapter, ExternalMCPTool } from './adapters/external-tool.adapter';

// Types
export * from './types/mcp-protocol.types';

// Transports
export { StdioTransport, StdioTransportOptions } from './transports/stdio.transport';
export { HttpTransport, HttpTransportOptions } from './transports/http.transport';