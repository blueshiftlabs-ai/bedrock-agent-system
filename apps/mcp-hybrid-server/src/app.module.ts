import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { McpModule } from '@rekog/mcp-nest';
import { TerminusModule } from '@nestjs/terminus';

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
import { configuration } from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    EventEmitterModule.forRoot(),
    McpModule.forRoot({
      name: 'hybrid-mcp-server',
      version: '1.0.0',
      description: 'Advanced MCP server with NestJS and LangGraph integration',
      transport: {
        type: 'http+sse',
        options: {
          endpoint: '/mcp',
          enableCors: true,
        },
      },
    }),
    TerminusModule,
    ConfigurationModule,
    AwsModule,
    MemoryModule,
    IndexingModule,
    DocumentationModule,
    HealthModule,
    WorkflowModule,
    AgentModule,
    ToolModule,
    IntegrationModule,
  ],
})
export class AppModule {}
