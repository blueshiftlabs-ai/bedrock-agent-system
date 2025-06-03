import { Injectable, Logger } from '@nestjs/common';
import { CodeAnalysisWorkflow } from './graphs/code-analysis-workflow';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly codeAnalysisWorkflow: CodeAnalysisWorkflow,
  ) {}

  async executeCodeAnalysis(filePath: string): Promise<any> {
    return await this.codeAnalysisWorkflow.execute(filePath);
  }

  async resumeWorkflow(workflowId: string, workflowType: string): Promise<any> {
    switch (workflowType) {
      case 'code_analysis':
        return await this.codeAnalysisWorkflow.resumeWorkflow(workflowId);
      default:
        throw new Error(`Unknown workflow type: ${workflowType}`);
    }
  }
}
