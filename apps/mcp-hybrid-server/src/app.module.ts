import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TerminusModule } from '@nestjs/terminus';
import { ScheduleModule } from '@nestjs/schedule';

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
    
    // Application modules
    ConfigurationModule,
    AwsModule,
    MemoryModule,
    IndexingModule,
    DocumentationModule,
    // HealthModule,
    // WorkflowModule,
    // AgentModule,
    // ToolModule,
    // IntegrationModule,
    // InteractionModule,
    
    // MCP Module (handles both server and client)
    MCPModule.forRoot(),
  ],
})
export class AppModule {
  constructor() {
    // Log successful module initialization
    console.log('🏗️  AppModule initialized with bi-directional MCP support');
  }
}
