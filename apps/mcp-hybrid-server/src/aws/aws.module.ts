import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../config/config.module';
import { MCPAwsService } from './mcp-aws.service';

/**
 * AWS module that orchestrates containerized MCP microservices
 * Each AWS service runs in its own container for scalability and isolation
 * Uses MCP protocol for inter-service communication
 */
@Module({
  imports: [ConfigurationModule],
  providers: [
    MCPAwsService,
  ],
  exports: [
    MCPAwsService,
  ],
})
export class AwsModule {}
