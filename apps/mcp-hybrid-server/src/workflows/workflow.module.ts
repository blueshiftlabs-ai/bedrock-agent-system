import { Module } from '@nestjs/common';
import { AwsModule } from '@aws/aws.module';
import { AgentModule } from '@agents/agent.module';
import { CodeAnalysisWorkflow } from './graphs/code-analysis-workflow';
import { CodeAnalysisNodes } from './nodes/code-analysis-nodes';
import { WorkflowStateService } from './services/workflow-state.service';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';

@Module({
  imports: [AwsModule, AgentModule],
  providers: [
    CodeAnalysisWorkflow,
    CodeAnalysisNodes,
    WorkflowStateService,
    WorkflowService,
  ],
  controllers: [WorkflowController],
  exports: [CodeAnalysisWorkflow, WorkflowService],
})
export class WorkflowModule {}
