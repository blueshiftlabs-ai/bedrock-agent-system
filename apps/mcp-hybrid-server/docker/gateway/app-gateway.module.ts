import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';

import { ConfigurationModule } from '../config/config.module';
import { AwsModule } from '../aws/aws.module';
import { HealthModule } from '../health/health.module';
import { MCPModule } from '../mcp/mcp.module';
import { configuration } from '../config/configuration';
import { ServiceProxyController } from './service-proxy.controller';
import { ServiceDiscoveryService } from './service-discovery.service';
import { ServiceProxyService } from './service-proxy.service';

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
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 3,
    }),
    
    // Application modules for Gateway
    ConfigurationModule,
    AwsModule,
    HealthModule,
    
    // MCP Module (gateway serves as MCP server)
    MCPModule.forRoot(),
  ],
  controllers: [ServiceProxyController],
  providers: [
    ServiceDiscoveryService,
    ServiceProxyService,
  ],
})
export class AppGatewayModule {
  constructor() {
    console.log('🏗️  API Gateway Module initialized');
  }
}