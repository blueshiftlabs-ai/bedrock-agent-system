import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TerminusModule } from '@nestjs/terminus';

import { ConfigurationModule } from '../config/config.module';
import { AwsModule } from '../aws/aws.module';
import { HealthModule } from '../health/health.module';
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
    
    // Application modules for Agents
    ConfigurationModule,
    AwsModule,
    HealthModule,
    AgentModule,
    IntegrationModule,
  ],
})
export class AppAgentsModule {
  constructor() {
    console.log('🤖 Agents Module initialized with AI agents');
  }
}