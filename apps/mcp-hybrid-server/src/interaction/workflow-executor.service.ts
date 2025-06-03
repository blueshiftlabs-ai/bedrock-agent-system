import { Injectable, Logger } from '@nestjs/common';
import { ProcessManagerService } from './process-manager.service';
import { WorkflowService } from '../workflows/workflow.service';
import { ProcessError, ProcessProgress, WorkflowState } from '../types/process.types';
import { AgentExecutor } from './agent-executor.service';

export interface WorkflowExecutor {
  execute(): Promise<any>;
  cancel(force?: boolean): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  getProgress(): ProcessProgress | undefined;
  getWorkflowState(): WorkflowState | undefined;
}

@Injectable()
export class WorkflowExecutorService {
  private readonly logger = new Logger(WorkflowExecutorService.name);

  constructor(
    private readonly processManager: ProcessManagerService,
    private readonly workflowService: WorkflowService,
  ) {}

  async execute(processId: string, input: any, configuration: any): Promise<WorkflowExecutor> {
    const process = this.processManager.getProcess(processId);
    if (!process) {
      throw new Error(`Process not found: ${processId}`);
    }

    const workflowType = configuration?.workflowType || input?.workflowType;
    if (!workflowType) {
      throw new Error('Workflow type not specified');
    }

    return new WorkflowExecutorImpl(
      processId,
      workflowType,
      input,
      configuration,
      this.processManager,
      this.workflowService,
      this.logger
    );
  }
}

class WorkflowExecutorImpl implements WorkflowExecutor {
  private isRunning = false;
  private isPaused = false;
  private isCancelled = false;
  private currentProgress?: ProcessProgress;
  private workflowState?: WorkflowState;
  private executionPromise?: Promise<any>;
  private currentNode?: string;

  constructor(
    private readonly processId: string,
    private readonly workflowType: string,
    private readonly input: any,
    private readonly configuration: any,
    private readonly processManager: ProcessManagerService,
    private readonly workflowService: WorkflowService,
    private readonly logger: Logger,
  ) {
    this.initializeWorkflowState();
  }

  async execute(): Promise<any> {
    if (this.isRunning) {
      throw new Error('Workflow executor is already running');
    }

    this.isRunning = true;
    this.isCancelled = false;
    this.isPaused = false;

    try {
      this.logger.log(`Starting workflow execution for process ${this.processId} (type: ${this.workflowType})`);
      this.processManager.addLog(this.processId, 'info', `Workflow execution started: ${this.workflowType}`, 'WorkflowExecutor');

      // Initialize progress
      this.updateProgress(0, 100, 'Initializing workflow...');

      // Execute the workflow based on type
      this.executionPromise = this.executeWorkflow();
      const result = await this.executionPromise;

      this.updateProgress(100, 100, 'Workflow execution completed');
      this.processManager.addLog(this.processId, 'info', 'Workflow execution completed successfully', 'WorkflowExecutor');

      await this.processManager.completeProcess(this.processId, {
        data: result,
        metadata: {
          workflowType: this.workflowType,
          executionTime: Date.now(),
          configuration: this.configuration,
          finalState: this.workflowState,
        },
      });

      return result;

    } catch (error: any) {
      this.logger.error(`Workflow execution failed for process ${this.processId}: ${error.message}`);
      
      if (!this.isCancelled) {
        const processError: ProcessError = {
          code: 'WORKFLOW_EXECUTION_ERROR',
          message: error.message,
          stack: error.stack,
          timestamp: new Date(),
          context: {
            workflowType: this.workflowType,
            currentNode: this.currentNode,
            workflowState: this.workflowState,
            input: this.input,
            configuration: this.configuration,
          },
        };

        await this.processManager.failProcess(this.processId, processError);
      }

      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  async cancel(force = false): Promise<void> {
    this.logger.log(`Cancelling workflow execution for process ${this.processId} (force: ${force})`);
    
    this.isCancelled = true;
    this.isRunning = false;

    // Set current node as cancelled if it exists
    if (this.workflowState?.currentNode) {
      const node = this.workflowState.nodes[this.workflowState.currentNode];
      if (node) {
        node.status = 'cancelled' as any;
        node.completedAt = new Date();
      }
    }

    this.processManager.addLog(this.processId, 'info', 'Workflow execution cancelled', 'WorkflowExecutor');
  }

  async pause(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Cannot pause: workflow executor is not running');
    }

    this.isPaused = true;
    
    // Set pause point in workflow state
    if (this.workflowState) {
      this.workflowState.pausePoint = this.currentNode;
    }

    this.processManager.addLog(this.processId, 'info', 'Workflow execution paused', 'WorkflowExecutor');
    this.logger.log(`Paused workflow execution for process ${this.processId} at node: ${this.currentNode}`);
  }

  async resume(): Promise<void> {
    if (!this.isPaused) {
      throw new Error('Cannot resume: workflow executor is not paused');
    }

    this.isPaused = false;
    
    // Clear pause point
    if (this.workflowState) {
      this.workflowState.pausePoint = undefined;
    }

    this.processManager.addLog(this.processId, 'info', 'Workflow execution resumed', 'WorkflowExecutor');
    this.logger.log(`Resumed workflow execution for process ${this.processId}`);
  }

  getProgress(): ProcessProgress | undefined {
    return this.currentProgress;
  }

  getWorkflowState(): WorkflowState | undefined {
    return this.workflowState;
  }

  private initializeWorkflowState(): void {
    this.workflowState = {
      processId: this.processId,
      nodes: {},
      variables: { ...this.input },
      conditionalBranches: {},
      loopCounters: {},
      checkpoints: [],
    };
  }

  private async executeWorkflow(): Promise<any> {
    switch (this.workflowType.toLowerCase()) {
      case 'code_analysis':
      case 'code-analysis':
        return await this.executeCodeAnalysisWorkflow();
      case 'document_generation':
      case 'document-generation':
        return await this.executeDocumentGenerationWorkflow();
      case 'knowledge_building':
      case 'knowledge-building':
        return await this.executeKnowledgeBuildingWorkflow();
      case 'custom':
        return await this.executeCustomWorkflow();
      default:
        throw new Error(`Unknown workflow type: ${this.workflowType}`);
    }
  }

  private async executeCodeAnalysisWorkflow(): Promise<any> {
    const nodes = [
      { id: 'validate_input', name: 'Validate Input', type: 'validation' },
      { id: 'parse_code', name: 'Parse Code', type: 'analysis' },
      { id: 'analyze_structure', name: 'Analyze Structure', type: 'analysis' },
      { id: 'check_quality', name: 'Check Quality', type: 'analysis' },
      { id: 'generate_report', name: 'Generate Report', type: 'output' },
    ];

    return await this.executeNodeSequence(nodes);
  }

  private async executeDocumentGenerationWorkflow(): Promise<any> {
    const nodes = [
      { id: 'validate_input', name: 'Validate Input', type: 'validation' },
      { id: 'analyze_code', name: 'Analyze Code', type: 'analysis' },
      { id: 'extract_documentation', name: 'Extract Documentation', type: 'extraction' },
      { id: 'generate_docs', name: 'Generate Documentation', type: 'generation' },
      { id: 'format_output', name: 'Format Output', type: 'formatting' },
    ];

    return await this.executeNodeSequence(nodes);
  }

  private async executeKnowledgeBuildingWorkflow(): Promise<any> {
    const nodes = [
      { id: 'validate_sources', name: 'Validate Sources', type: 'validation' },
      { id: 'extract_knowledge', name: 'Extract Knowledge', type: 'extraction' },
      { id: 'build_relationships', name: 'Build Relationships', type: 'analysis' },
      { id: 'create_graph', name: 'Create Knowledge Graph', type: 'generation' },
      { id: 'store_knowledge', name: 'Store Knowledge', type: 'storage' },
    ];

    return await this.executeNodeSequence(nodes);
  }

  private async executeCustomWorkflow(): Promise<any> {
    const customNodes = this.configuration?.nodes || [];
    if (customNodes.length === 0) {
      throw new Error('No nodes defined for custom workflow');
    }

    return await this.executeNodeSequence(customNodes);
  }

  private async executeNodeSequence(nodes: any[]): Promise<any> {
    let result = null;
    const totalNodes = nodes.length;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      this.currentNode = node.id;

      // Check for cancellation
      this.checkCancellation();
      await this.waitIfPaused();

      // Update progress
      const progress = ((i + 0.5) / totalNodes) * 100;
      this.updateProgress(progress, 100, `Executing: ${node.name}`);

      // Initialize node in state
      this.workflowState!.nodes[node.id] = {
        id: node.id,
        name: node.name,
        type: node.type,
        status: 'running' as any,
        startedAt: new Date(),
        retryCount: 0,
        dependencies: node.dependencies || [],
      };

      this.workflowState!.currentNode = node.id;

      try {
        // Execute the node
        const nodeResult = await this.executeNode(node);
        
        // Update node state
        const workflowNode = this.workflowState!.nodes[node.id];
        workflowNode.status = 'completed' as any;
        workflowNode.completedAt = new Date();
        workflowNode.output = nodeResult;
        workflowNode.duration = workflowNode.completedAt.getTime() - workflowNode.startedAt!.getTime();

        // Store result for final output
        if (i === nodes.length - 1) {
          result = nodeResult;
        }

        // Create checkpoint
        this.createCheckpoint(node.id);

        this.processManager.addLog(
          this.processId,
          'info',
          `Completed workflow node: ${node.name}`,
          'WorkflowExecutor'
        );

      } catch (error: any) {
        // Update node state with error
        const workflowNode = this.workflowState!.nodes[node.id];
        workflowNode.status = 'failed' as any;
        workflowNode.completedAt = new Date();
        workflowNode.error = {
          code: 'NODE_EXECUTION_ERROR',
          message: error.message,
          stack: error.stack,
          timestamp: new Date(),
        };

        this.processManager.addLog(
          this.processId,
          'error',
          `Failed workflow node: ${node.name} - ${error.message}`,
          'WorkflowExecutor'
        );

        // Check if we should retry
        if (workflowNode.retryCount < (this.configuration?.maxRetries || 0)) {
          workflowNode.retryCount++;
          workflowNode.status = 'running' as any;
          i--; // Retry the same node
          continue;
        }

        throw error;
      }
    }

    return result;
  }

  private async executeNode(node: any): Promise<any> {
    // Simulate node execution based on type
    switch (node.type) {
      case 'validation':
        return await this.executeValidationNode(node);
      case 'analysis':
        return await this.executeAnalysisNode(node);
      case 'extraction':
        return await this.executeExtractionNode(node);
      case 'generation':
        return await this.executeGenerationNode(node);
      case 'formatting':
        return await this.executeFormattingNode(node);
      case 'storage':
        return await this.executeStorageNode(node);
      case 'output':
        return await this.executeOutputNode(node);
      default:
        return await this.executeGenericNode(node);
    }
  }

  private async executeValidationNode(node: any): Promise<any> {
    // Simulate validation
    await this.simulateWork(500, 1500);
    
    if (!this.workflowState!.variables) {
      throw new Error('No input variables provided');
    }

    return { validated: true, nodeId: node.id };
  }

  private async executeAnalysisNode(node: any): Promise<any> {
    // Simulate analysis work
    await this.simulateWork(1000, 3000);
    
    // Use the actual workflow service if available
    if (node.id === 'analyze_structure' && this.workflowState!.variables.filePath) {
      try {
        return await this.workflowService.executeCodeAnalysis(this.workflowState!.variables.filePath);
      } catch (error: any) {
        this.logger.warn(`Failed to use workflow service, falling back to simulation: ${error.message}`);
      }
    }

    return { 
      analysis: `Analysis result for ${node.name}`,
      metrics: { complexity: Math.random() * 10, quality: Math.random() * 100 },
      nodeId: node.id
    };
  }

  private async executeExtractionNode(node: any): Promise<any> {
    await this.simulateWork(800, 2000);
    return { 
      extracted: `Extracted data from ${node.name}`,
      items: Math.floor(Math.random() * 50) + 10,
      nodeId: node.id
    };
  }

  private async executeGenerationNode(node: any): Promise<any> {
    await this.simulateWork(1500, 4000);
    return { 
      generated: `Generated output from ${node.name}`,
      size: Math.floor(Math.random() * 1000) + 100,
      nodeId: node.id
    };
  }

  private async executeFormattingNode(node: any): Promise<any> {
    await this.simulateWork(300, 800);
    return { 
      formatted: true,
      format: this.configuration?.format || 'default',
      nodeId: node.id
    };
  }

  private async executeStorageNode(node: any): Promise<any> {
    await this.simulateWork(500, 1200);
    return { 
      stored: true,
      location: this.configuration?.outputPath || '/tmp/output',
      nodeId: node.id
    };
  }

  private async executeOutputNode(node: any): Promise<any> {
    await this.simulateWork(200, 500);
    
    // Collect results from all previous nodes
    const allResults = Object.values(this.workflowState!.nodes)
      .filter(n => n.output)
      .map(n => n.output);

    return {
      summary: `Workflow ${this.workflowType} completed successfully`,
      results: allResults,
      nodeId: node.id,
      timestamp: new Date(),
    };
  }

  private async executeGenericNode(node: any): Promise<any> {
    await this.simulateWork(500, 1500);
    return { 
      result: `Generic execution of ${node.name}`,
      nodeId: node.id
    };
  }

  private async simulateWork(minMs: number, maxMs: number): Promise<void> {
    const duration = Math.random() * (maxMs - minMs) + minMs;
    const steps = 10;
    const stepDuration = duration / steps;

    for (let i = 0; i < steps; i++) {
      this.checkCancellation();
      await this.waitIfPaused();
      await new Promise(resolve => setTimeout(resolve, stepDuration));
    }
  }

  private createCheckpoint(nodeId: string): void {
    if (this.workflowState) {
      this.workflowState.checkpoints.push({
        nodeId,
        timestamp: new Date(),
        state: JSON.parse(JSON.stringify(this.workflowState)), // Deep clone
      });

      // Keep only recent checkpoints
      if (this.workflowState.checkpoints.length > 10) {
        this.workflowState.checkpoints = this.workflowState.checkpoints.slice(-5);
      }
    }
  }

  private checkCancellation(): void {
    if (this.isCancelled) {
      throw new Error('Workflow execution was cancelled');
    }
  }

  private async waitIfPaused(): Promise<void> {
    while (this.isPaused && !this.isCancelled) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private updateProgress(current: number, total: number, message: string): void {
    this.currentProgress = {
      current,
      total,
      percentage: Math.round((current / total) * 100),
      message,
      estimatedCompletion: this.estimateCompletion(current, total),
    };

    this.processManager.updateProgress(this.processId, this.currentProgress);
  }

  private estimateCompletion(current: number, total: number): Date | undefined {
    if (current === 0) return undefined;
    
    const process = this.processManager.getProcess(this.processId);
    if (!process?.metadata.startedAt) return undefined;

    const elapsed = Date.now() - process.metadata.startedAt.getTime();
    const rate = current / elapsed;
    const remaining = total - current;
    const estimatedRemainingTime = remaining / rate;

    return new Date(Date.now() + estimatedRemainingTime);
  }
}