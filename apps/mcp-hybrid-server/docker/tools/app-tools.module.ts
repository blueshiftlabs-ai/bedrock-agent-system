import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TerminusModule } from '@nestjs/terminus';

import { ConfigurationModule } from '../config/config.module';
import { AwsModule } from '../aws/aws.module';
import { HealthModule } from '../health/health.module';
import { ToolModule } from '../tools/tool.module';
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
    
    // Application modules for Tools
    ConfigurationModule,
    AwsModule,
    HealthModule,
    ToolModule,
  ],
})
export class AppToolsModule {
  constructor() {
    console.log('🔧 Tools Module initialized with MCP tools');
  }
}