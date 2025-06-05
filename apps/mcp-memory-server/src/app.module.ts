import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MemoryModule } from './memory/memory.module';
import { HealthModule } from './health/health.module';
import { MCPModule } from './mcp/mcp.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    MemoryModule,
    HealthModule,
    MCPModule,
  ],
})
export class AppModule {
  constructor() {
    console.log('🧠 MCP Memory Server initialized');
  }
}