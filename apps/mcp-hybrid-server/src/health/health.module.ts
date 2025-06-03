import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { MCPModule } from '../mcp/mcp.module';

@Module({
  imports: [
    TerminusModule,
    HttpModule,
    MCPModule,
  ],
  controllers: [HealthController],
})
export class HealthModule {}