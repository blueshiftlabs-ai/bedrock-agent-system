import { Injectable, Logger } from '@nestjs/common';
import { ProcessManagerService } from './process-manager.service';
import { CodeAnalyzerAgent } from '../agents/code-analyzer/code-analyzer.agent';
import { DatabaseAnalyzerAgent } from '../agents/db-analyzer/db-analyzer.agent';
import { DocumentationGeneratorAgent } from '../agents/documentation-generator/documentation-generator.agent';
import { KnowledgeBuilderAgent } from '../agents/knowledge-builder/knowledge-builder.agent';
import { ProcessError, ProcessProgress } from '../types/process.types';

export interface AgentExecutor {
  execute(): Promise<any>;
  cancel(force?: boolean): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  getProgress(): ProcessProgress | undefined;
}

@Injectable()
export class AgentExecutorService {
  private readonly logger = new Logger(AgentExecutorService.name);

  constructor(
    private readonly processManager: ProcessManagerService,
    private readonly codeAnalyzerAgent: CodeAnalyzerAgent,
    private readonly databaseAnalyzerAgent: DatabaseAnalyzerAgent,
    private readonly documentationGeneratorAgent: DocumentationGeneratorAgent,
    private readonly knowledgeBuilderAgent: KnowledgeBuilderAgent,
  ) {}

  async execute(processId: string, input: any, configuration: any): Promise<AgentExecutor> {
    const process = this.processManager.getProcess(processId);
    if (!process) {
      throw new Error(`Process not found: ${processId}`);
    }

    const agentName = configuration?.agentName || input?.agentName;
    if (!agentName) {
      throw new Error('Agent name not specified');
    }

    const agent = this.getAgent(agentName);
    if (!agent) {
      throw new Error(`Unknown agent: ${agentName}`);
    }

    return new AgentExecutorImpl(
      processId,
      agent,
      input,
      configuration,
      this.processManager,
      this.logger
    );
  }

  private getAgent(agentName: string): any {
    switch (agentName.toLowerCase()) {
      case 'code-analyzer':
      case 'codeanalyzer':
        return this.codeAnalyzerAgent;
      case 'database-analyzer':
      case 'databaseanalyzer':
      case 'db-analyzer':
        return this.databaseAnalyzerAgent;
      case 'documentation-generator':
      case 'documentationgenerator':
      case 'doc-generator':
        return this.documentationGeneratorAgent;
      case 'knowledge-builder':
      case 'knowledgebuilder':
        return this.knowledgeBuilderAgent;
      default:
        return null;
    }
  }
}

class AgentExecutorImpl implements AgentExecutor {
  private isRunning = false;
  private isPaused = false;
  private isCancelled = false;
  private currentProgress?: ProcessProgress;
  private executionPromise?: Promise<any>;

  constructor(
    private readonly processId: string,
    private readonly agent: any,
    private readonly input: any,
    private readonly configuration: any,
    private readonly processManager: ProcessManagerService,
    private readonly logger: Logger,
  ) {}

  async execute(): Promise<any> {
    if (this.isRunning) {
      throw new Error('Agent executor is already running');
    }

    this.isRunning = true;
    this.isCancelled = false;
    this.isPaused = false;

    try {
      this.logger.log(`Starting agent execution for process ${this.processId}`);
      this.processManager.addLog(this.processId, 'info', 'Agent execution started', 'AgentExecutor');

      // Initialize progress
      this.updateProgress(0, 100, 'Initializing agent...');

      // Prepare agent input
      const agentInput = this.prepareAgentInput();
      this.updateProgress(10, 100, 'Prepared agent input');

      // Check for cancellation before starting
      this.checkCancellation();

      // Execute the agent
      this.executionPromise = this.executeAgent(agentInput);
      const result = await this.executionPromise;

      this.updateProgress(100, 100, 'Agent execution completed');
      this.processManager.addLog(this.processId, 'info', 'Agent execution completed successfully', 'AgentExecutor');

      await this.processManager.completeProcess(this.processId, {
        data: result,
        metadata: {
          agentName: this.agent.name,
          executionTime: Date.now(),
          configuration: this.configuration,
        },
      });

      return result;

    } catch (error) {
      this.logger.error(`Agent execution failed for process ${this.processId}: ${error.message}`);
      
      if (!this.isCancelled) {
        const processError: ProcessError = {
          code: 'AGENT_EXECUTION_ERROR',
          message: error.message,
          stack: error.stack,
          timestamp: new Date(),
          context: {
            agentName: this.agent.name,
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
    this.logger.log(`Cancelling agent execution for process ${this.processId} (force: ${force})`);
    
    this.isCancelled = true;
    this.isRunning = false;

    if (this.executionPromise && force) {
      // For forceful cancellation, we would need to implement interruption
      // This depends on how the agent is implemented
      this.processManager.addLog(this.processId, 'warn', 'Force cancellation requested', 'AgentExecutor');
    }

    this.processManager.addLog(this.processId, 'info', 'Agent execution cancelled', 'AgentExecutor');
  }

  async pause(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Cannot pause: agent executor is not running');
    }

    this.isPaused = true;
    this.processManager.addLog(this.processId, 'info', 'Agent execution paused', 'AgentExecutor');
    this.logger.log(`Paused agent execution for process ${this.processId}`);
  }

  async resume(): Promise<void> {
    if (!this.isPaused) {
      throw new Error('Cannot resume: agent executor is not paused');
    }

    this.isPaused = false;
    this.processManager.addLog(this.processId, 'info', 'Agent execution resumed', 'AgentExecutor');
    this.logger.log(`Resumed agent execution for process ${this.processId}`);
  }

  getProgress(): ProcessProgress | undefined {
    return this.currentProgress;
  }

  private prepareAgentInput(): any {
    // Transform the input based on the agent type and configuration
    const baseInput = {
      ...this.input,
      processId: this.processId,
      configuration: this.configuration,
    };

    // Add agent-specific input preparation here
    switch (this.agent.name?.toLowerCase()) {
      case 'codeanalyzer':
        return {
          ...baseInput,
          filePath: this.input.filePath,
          analysisType: this.configuration?.analysisType || 'basic',
          includeDependencies: this.configuration?.includeDependencies || false,
        };
      
      case 'documentationgenerator':
        return {
          ...baseInput,
          sourceCode: this.input.sourceCode,
          format: this.configuration?.format || 'markdown',
          includeExamples: this.configuration?.includeExamples !== false,
        };
      
      case 'databaseanalyzer':
        return {
          ...baseInput,
          connectionString: this.input.connectionString,
          analysisDepth: this.configuration?.analysisDepth || 'schema',
        };
      
      case 'knowledgebuilder':
        return {
          ...baseInput,
          sources: this.input.sources,
          buildType: this.configuration?.buildType || 'incremental',
        };
      
      default:
        return baseInput;
    }
  }

  private async executeAgent(agentInput: any): Promise<any> {
    const steps = this.getExecutionSteps();
    let currentStep = 0;

    for (const step of steps) {
      this.checkCancellation();
      await this.waitIfPaused();

      this.updateProgress(
        (currentStep / steps.length) * 90 + 10, // 10-100% range
        100,
        `Executing: ${step.name}`
      );

      try {
        await step.execute(agentInput);
        currentStep++;
        
        this.processManager.addLog(
          this.processId,
          'info',
          `Completed step: ${step.name}`,
          'AgentExecutor'
        );
      } catch (error) {
        this.processManager.addLog(
          this.processId,
          'error',
          `Failed step: ${step.name} - ${error.message}`,
          'AgentExecutor'
        );
        throw error;
      }
    }

    // Final agent execution
    this.updateProgress(90, 100, 'Executing agent logic...');
    const result = await this.agent.execute(agentInput.prompt || agentInput, agentInput);
    
    return result;
  }

  private getExecutionSteps(): Array<{ name: string; execute: (input: any) => Promise<void> }> {
    return [
      {
        name: 'Validate Input',
        execute: async (input) => {
          if (!input) {
            throw new Error('No input provided');
          }
          // Add specific validation based on agent type
        },
      },
      {
        name: 'Prepare Context',
        execute: async (input) => {
          // Prepare any necessary context for the agent
          await new Promise(resolve => setTimeout(resolve, 100)); // Simulate work
        },
      },
      {
        name: 'Initialize Agent',
        execute: async (input) => {
          // Initialize agent with specific configuration
          await new Promise(resolve => setTimeout(resolve, 100)); // Simulate work
        },
      },
    ];
  }

  private checkCancellation(): void {
    if (this.isCancelled) {
      throw new Error('Agent execution was cancelled');
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
    
    // Simple estimation based on current progress
    const process = this.processManager.getProcess(this.processId);
    if (!process?.metadata.startedAt) return undefined;

    const elapsed = Date.now() - process.metadata.startedAt.getTime();
    const rate = current / elapsed;
    const remaining = total - current;
    const estimatedRemainingTime = remaining / rate;

    return new Date(Date.now() + estimatedRemainingTime);
  }
}