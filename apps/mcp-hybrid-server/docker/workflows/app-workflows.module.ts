import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TerminusModule } from '@nestjs/terminus';

import { ConfigurationModule } from '../config/config.module';
import { AwsModule } from '../aws/aws.module';
import { MemoryModule } from '../memory/memory.module';
import { HealthModule } from '../health/health.module';
import { WorkflowModule } from '../workflows/workflow.module';
import { AgentModule } from '../agents/agent.module';
import { IntegrationModule } from '../integrations/integration.module';
import { configuration } from '../config/configuration';

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
      wildcard: true,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),
    TerminusModule,
    
    // Application modules for Workflows
    ConfigurationModule,
    AwsModule,
    MemoryModule,
    HealthModule,
    WorkflowModule,
    AgentModule, // Workflows need access to agents
    IntegrationModule,
  ],
})
export class AppWorkflowsModule {
  constructor() {
    console.log('⚡ Workflows Module initialized with LangGraph workflows');
  }
}