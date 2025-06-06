import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { MemoryOrchestratorModule } from '../memory-orchestrator/memory-orchestrator.module';

@Module({
  imports: [MemoryOrchestratorModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}