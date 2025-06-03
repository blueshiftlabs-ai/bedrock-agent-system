import { Module } from '@nestjs/common';
import { MCPClientModule } from './mcp-client/mcp-client.module';
import { BedrockMcpClient } from './bedrock/bedrock-mcp.client';

@Module({
  imports: [
    MCPClientModule,
  ],
  providers: [
    BedrockMcpClient,
  ],
  exports: [
    MCPClientModule,
    BedrockMcpClient,
  ],
})
export class IntegrationModule {}