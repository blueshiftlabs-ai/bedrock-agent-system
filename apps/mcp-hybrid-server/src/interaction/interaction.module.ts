import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ProcessManagerService } from './process-manager.service';
import { AgentExecutorService } from './agent-executor.service';
import { WorkflowExecutorService } from './workflow-executor.service';
import { InteractionWebSocketGateway } from './websocket.gateway';
import { ProcessController } from './process.controller';
import { InteractionMcpService } from './interaction-mcp.service';
import { AgentModule } from '../agents/agent.module';
import { WorkflowModule } from '../workflows/workflow.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    AgentModule,
    WorkflowModule,
  ],
  providers: [
    ProcessManagerService,
    AgentExecutorService,
    WorkflowExecutorService,
    InteractionWebSocketGateway,
    InteractionMcpService,
  ],
  controllers: [ProcessController],
  exports: [
    ProcessManagerService,
    AgentExecutorService,
    WorkflowExecutorService,
    InteractionMcpService,
  ],
})
export class InteractionModule {}