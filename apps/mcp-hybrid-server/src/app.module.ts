import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TerminusModule } from '@nestjs/terminus';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';

import { ConfigurationModule } from './config/config.module';
import { AwsModule } from './aws/aws.module';
import { MemoryModule } from './memory/memory.module';
import { IndexingModule } from './indexing/indexing.module';
import { DocumentationModule } from './documentation/documentation.module';
import { HealthModule } from './health/health.module';
import { WorkflowModule } from './workflows/workflow.module';
import { AgentModule } from './agents/agent.module';
import { ToolModule } from './tools/tool.module';
import { IntegrationModule } from './integrations/integration.module';
import { InteractionModule } from './interaction/interaction.module';
import { MCPModule } from './mcp/mcp.module';
import { WebSocketModule } from './websocket/websocket.module';
import { MCPRegistryModule } from './mcp-registry/mcp-registry.module';
import { configuration } from './config/configuration';

@Module({
  imports: [
    // Core NestJS modules
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
      expandVariables: true,
    }),
    EventEmitterModule.forRoot({
      // Configure event emitter for MCP events
      wildcard: true,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),
    ScheduleModule.forRoot(),
    TerminusModule,
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    
    // Application modules
    ConfigurationModule,
    // AwsModule, // Temporarily disabled due to missing AWS SDK deps
    // MemoryModule,
    // IndexingModule,
    // DocumentationModule,
    // HealthModule,
    // WorkflowModule,
    // AgentModule,
    // ToolModule,
    // IntegrationModule,
    // InteractionModule,
    
    // MCP Module (handles both server and client)
    // MCPModule.forRoot(), // Temporarily disabled
    
    // New gateway modules
    WebSocketModule,
    MCPRegistryModule,
  ],
})
export class AppModule {
  constructor() {
    // Log successful module initialization
    console.log('🏗️  AppModule initialized with MCP Gateway & WebSocket support');
    console.log('📡  WebSocket server available for dashboard connections');
    console.log('🔍  MCP server discovery and tool registry active');
  }
}
