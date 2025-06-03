import { Injectable, Logger } from '@nestjs/common';
import { StateGraph, END } from '@langchain/langgraph';
import { CodeAnalysisState } from '../states/analysis-state';
import { CodeAnalysisNodes } from '../nodes/code-analysis-nodes';
import { WorkflowStateService } from '../services/workflow-state.service';
import { getErrorMessage } from '@/common/utils/error-utils';

@Injectable()
export class CodeAnalysisWorkflow {
  private readonly logger = new Logger(CodeAnalysisWorkflow.name);
  private workflow: any;

  constructor(
    private readonly nodes: CodeAnalysisNodes,
    private readonly stateService: WorkflowStateService,
  ) {
    this.initializeWorkflow();
  }

  private initializeWorkflow() {
    // TODO: Fix LangGraph StateGraph configuration
    // For now, create a placeholder workflow to get the server running
    this.logger.warn('StateGraph initialization temporarily disabled - needs LangGraph configuration fix');
    this.workflow = {
      invoke: async (state: CodeAnalysisState) => {
        this.logger.log('Placeholder workflow execution');
        return { ...state, analysisStage: 'completed' };
      }
    };
  }

  async execute(filePath: string, workflowId?: string): Promise<CodeAnalysisState> {
    const id = workflowId || `code_analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const initialState: CodeAnalysisState = {
      workflowId: id,
      filePath,
      analysisStage: 'start',
      startTime: Date.now(),
      lastUpdated: Date.now(),
      messages: [
        {
          role: 'user',
          content: `Please analyze the code file at ${filePath}`,
          timestamp: new Date().toISOString(),
        }
      ],
      retryCount: 0,
    };

    try {
      this.logger.log(`Starting code analysis workflow for: ${filePath}`);
      await this.stateService.saveWorkflowState(id, initialState);
      
      const result = await this.workflow.invoke(initialState);
      
      await this.stateService.saveWorkflowState(id, {
        ...result,
        analysisStage: 'completed',
        lastUpdated: Date.now(),
      });
      
      this.logger.log(`Code analysis workflow completed for: ${filePath}`);
      return result;
    } catch (error: any) {
      this.logger.error(`Error in code analysis workflow: ${error.message}`);
      
      const errorState = {
        ...initialState,
        analysisStage: 'error' as const,
        error: error.message,
        lastUpdated: Date.now(),
      };
      
      await this.stateService.saveWorkflowState(id, errorState);
      throw error;
    }
  }

  async resumeWorkflow(workflowId: string): Promise<CodeAnalysisState> {
    try {
      const state = await this.stateService.getWorkflowState<CodeAnalysisState>(workflowId);
      if (!state) {
        throw new Error(`Workflow state not found for ID: ${workflowId}`);
      }

      this.logger.log(`Resuming workflow from stage: ${state.analysisStage}`);
      return await this.workflow.invoke(state);
    } catch (error: any) {
      this.logger.error(`Error resuming workflow: ${error.message}`);
      throw error;
    }
  }
}
