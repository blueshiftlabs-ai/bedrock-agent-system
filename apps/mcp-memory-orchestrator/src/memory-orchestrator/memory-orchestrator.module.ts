import { Module } from '@nestjs/common';
import { MemoryOrchestratorService } from './memory-orchestrator.service';
import { MCPClientService } from '../clients/mcp-client.service';

@Module({
  providers: [MemoryOrchestratorService, MCPClientService],
  exports: [MemoryOrchestratorService, MCPClientService],
})
export class MemoryOrchestratorModule {}