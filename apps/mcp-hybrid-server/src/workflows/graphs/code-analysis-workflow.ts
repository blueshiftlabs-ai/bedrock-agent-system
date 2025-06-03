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
    // Define router function to determine next step
    const router = (state: CodeAnalysisState): string => {
      if (state.error) {
        return END;
      }
      
      switch (state.analysisStage) {
        case 'start':
          return 'analyze_code';
        case 'code_analyzed':
          return 'analyze_database_connections';
        case 'db_analyzed':
          return 'update_knowledge_graph';
        case 'knowledge_updated':
          return 'generate_documentation';
        case 'documentation_generated':
          return END;
        default:
          return END;
      }
    };

    // Create the workflow graph
    this.workflow = new StateGraph<CodeAnalysisState>({
      channels: {
        workflowId: { default: () => '' },
        messages: { default: () => [] },
        filePath: { default: () => '' },
        analysisStage: { default: () => 'start' },
        startTime: { default: () => Date.now() },
        lastUpdated: { default: () => Date.now() },
        codeAnalysisResult: { default: () => null },
        databaseAnalysisResult: { default: () => null },
        knowledgeGraphUpdates: { default: () => null },
        documentation: { default: () => null },
        error: { default: () => null },
        toolResults: { default: () => ({}) },
        retryCount: { default: () => 0 },
      }
    });

    // Add nodes with persistence
    this.workflow.addNode('analyze_code', async (state: CodeAnalysisState) => {
      const result = await this.nodes.analyzeCode(state);
      await this.stateService.saveCheckpoint(result.workflowId, 'analyze_code', result);
      return result;
    });

    this.workflow.addNode('analyze_database_connections', async (state: CodeAnalysisState) => {
      const result = await this.nodes.analyzeDatabaseConnections(state);
      await this.stateService.saveCheckpoint(result.workflowId, 'analyze_database_connections', result);
      return result;
    });

    this.workflow.addNode('update_knowledge_graph', async (state: CodeAnalysisState) => {
      const result = await this.nodes.updateKnowledgeGraph(state);
      await this.stateService.saveCheckpoint(result.workflowId, 'update_knowledge_graph', result);
      return result;
    });

    this.workflow.addNode('generate_documentation', async (state: CodeAnalysisState) => {
      const result = await this.nodes.generateDocumentation(state);
      await this.stateService.saveCheckpoint(result.workflowId, 'generate_documentation', result);
      return result;
    });

    // Set the entry point
    this.workflow.setEntryPoint('analyze_code');

    // Add conditional edges
    this.workflow.addConditionalEdges('analyze_code', router);
    this.workflow.addConditionalEdges('analyze_database_connections', router);
    this.workflow.addConditionalEdges('update_knowledge_graph', router);
    this.workflow.addConditionalEdges('generate_documentation', router);

    // Compile the workflow
    this.workflow = this.workflow.compile();
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
      const state = await this.stateService.getWorkflowState(workflowId);
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
