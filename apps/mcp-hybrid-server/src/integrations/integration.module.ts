import { Module } from '@nestjs/common';
import { MCPClientModule } from './mcp-client/mcp-client.module';

@Module({
  imports: [
    MCPClientModule,
  ],
  exports: [
    MCPClientModule,
  ],
})
export class IntegrationModule {}