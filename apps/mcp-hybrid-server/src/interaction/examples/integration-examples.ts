/**
 * Integration Examples for MCP Hybrid Server Interaction Interface
 * 
 * This file demonstrates how to integrate the new interaction interface
 * with existing agents, workflows, and external systems.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ProcessManagerService } from '../process-manager.service';
import { AgentExecutorService } from '../agent-executor.service';
import { WorkflowExecutorService } from '../workflow-executor.service';
import { InteractionMcpService } from '../interaction-mcp.service';
import { ProcessType, ProcessPriority } from '../../types/process.types';

@Injectable()
export class IntegrationExamples {
  private readonly logger = new Logger(IntegrationExamples.name);

  constructor(
    private readonly processManager: ProcessManagerService,
    private readonly agentExecutor: AgentExecutorService,
    private readonly workflowExecutor: WorkflowExecutorService,
    private readonly interactionMcp: InteractionMcpService,
  ) {}

  /**
   * Example 1: Starting a Code Analysis Agent Process
   * This example shows how to programmatically start an agent process
   * and monitor its progress.
   */
  async runCodeAnalysisAgent(filePath: string): Promise<string> {
    this.logger.log('Starting code analysis agent example');

    // Create the process
    const processId = await this.processManager.createProcess(
      'Code Analysis Agent',
      ProcessType.AGENT,
      ProcessPriority.HIGH,
      {
        timeout: 300000, // 5 minutes
        retryCount: 2,
        maxMemory: 512, // 512MB
      },
      {
        data: {
          agentName: 'code-analyzer',
          filePath,
          analysisType: 'comprehensive',
          includeMetrics: true,
        },
      },
      {
        tags: ['code-analysis', 'automated'],
        description: `Analyzing code at ${filePath}`,
      }
    );

    // Create and start the executor
    const executor = await this.agentExecutor.execute(
      processId,
      {
        agentName: 'code-analyzer',
        filePath,
        analysisType: 'comprehensive',
      },
      {
        timeout: 300000,
        includeMetrics: true,
      }
    );

    await this.processManager.startProcess(processId, executor);

    this.logger.log(`Code analysis process started: ${processId}`);
    return processId;
  }

  /**
   * Example 2: Running a Multi-Step Documentation Workflow
   * This example demonstrates a complex workflow with multiple steps
   * including error handling and progress tracking.
   */
  async runDocumentationWorkflow(sourceFiles: string[]): Promise<string> {
    this.logger.log('Starting documentation workflow example');

    const processId = await this.processManager.createProcess(
      'Documentation Generation Workflow',
      ProcessType.WORKFLOW,
      ProcessPriority.MEDIUM,
      {
        timeout: 600000, // 10 minutes
        retryCount: 1,
        maxMemory: 1024, // 1GB
        autoRestart: false,
      },
      {
        data: {
          workflowType: 'document-generation',
          sourceFiles,
          outputFormat: 'markdown',
          includeExamples: true,
        },
      },
      {
        tags: ['documentation', 'workflow', 'automated'],
        description: `Generating documentation for ${sourceFiles.length} source files`,
      }
    );

    // Create workflow executor with custom configuration
    const executor = await this.workflowExecutor.execute(
      processId,
      {
        workflowType: 'document-generation',
        sourceFiles,
        outputFormat: 'markdown',
      },
      {
        maxRetries: 2,
        nodes: [
          { id: 'validate_sources', name: 'Validate Source Files', type: 'validation' },
          { id: 'extract_docs', name: 'Extract Documentation', type: 'extraction' },
          { id: 'generate_markdown', name: 'Generate Markdown', type: 'generation' },
          { id: 'create_index', name: 'Create Index', type: 'generation' },
          { id: 'save_output', name: 'Save Documentation', type: 'output' },
        ],
      }
    );

    await this.processManager.startProcess(processId, executor);

    this.logger.log(`Documentation workflow started: ${processId}`);
    return processId;
  }

  /**
   * Example 3: Monitoring Process with Custom Event Handlers
   * This example shows how to set up custom monitoring and event handling
   * for long-running processes.
   */
  async setupProcessMonitoring(processId: string): Promise<void> {
    const process = this.processManager.getProcess(processId);
    if (!process) {
      throw new Error(`Process not found: ${processId}`);
    }

    this.logger.log(`Setting up monitoring for process: ${processId}`);

    // Custom progress tracking
    const progressInterval = setInterval(() => {
      const currentProcess = this.processManager.getProcess(processId);
      if (currentProcess) {
        this.logger.log(`Process ${processId} progress: ${currentProcess.progress?.percentage || 0}%`);
        
        // Custom logic based on progress
        if (currentProcess.progress?.percentage && currentProcess.progress.percentage > 50) {
          this.logger.log(`Process ${processId} is more than halfway complete`);
        }

        // Stop monitoring if process is complete
        if (['completed', 'failed', 'cancelled'].includes(currentProcess.metadata.status)) {
          clearInterval(progressInterval);
          this.logger.log(`Process ${processId} finished with status: ${currentProcess.metadata.status}`);
        }
      } else {
        clearInterval(progressInterval);
      }
    }, 5000);

    // Monitor resource usage
    const resourceInterval = setInterval(() => {
      const currentProcess = this.processManager.getProcess(processId);
      if (currentProcess?.resourceUsage?.length) {
        const latest = currentProcess.resourceUsage[currentProcess.resourceUsage.length - 1];
        
        // Alert if resource usage is too high
        if (latest.cpu > 90) {
          this.logger.warn(`High CPU usage detected for process ${processId}: ${latest.cpu}%`);
        }
        if (latest.memory > 1000) {
          this.logger.warn(`High memory usage detected for process ${processId}: ${latest.memory}MB`);
        }
      }
    }, 10000);

    // Cleanup when process completes
    setTimeout(() => {
      clearInterval(progressInterval);
      clearInterval(resourceInterval);
    }, 3600000); // 1 hour max
  }

  /**
   * Example 4: Batch Processing with Queue Management
   * This example demonstrates how to process multiple files in batch
   * with proper queue management and resource constraints.
   */
  async runBatchProcessing(files: string[]): Promise<string[]> {
    this.logger.log(`Starting batch processing for ${files.length} files`);

    const processIds: string[] = [];
    const batchSize = 3; // Process 3 files at a time
    
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      // Create processes for each file in the batch
      const batchPromises = batch.map(async (filePath, index) => {
        const processId = await this.processManager.createProcess(
          `Batch Analysis ${i + index + 1}`,
          ProcessType.AGENT,
          ProcessPriority.MEDIUM,
          {
            timeout: 180000, // 3 minutes per file
            retryCount: 1,
            maxMemory: 256, // 256MB per process
          },
          {
            data: {
              agentName: 'code-analyzer',
              filePath,
              analysisType: 'basic',
            },
          },
          {
            tags: ['batch-processing', `batch-${Math.floor(i / batchSize) + 1}`],
            description: `Batch analysis of ${filePath}`,
          }
        );

        const executor = await this.agentExecutor.execute(
          processId,
          {
            agentName: 'code-analyzer',
            filePath,
            analysisType: 'basic',
          },
          { timeout: 180000 }
        );

        await this.processManager.startProcess(processId, executor);
        return processId;
      });

      const batchProcessIds = await Promise.all(batchPromises);
      processIds.push(...batchProcessIds);

      // Wait for current batch to complete before starting next batch
      await this.waitForBatchCompletion(batchProcessIds);
    }

    this.logger.log(`Batch processing completed. Total processes: ${processIds.length}`);
    return processIds;
  }

  /**
   * Example 5: Custom Agent with Interactive Debugging
   * This example shows how to create a custom agent that supports
   * interactive debugging and user input during execution.
   */
  async runInteractiveAgent(query: string): Promise<string> {
    this.logger.log('Starting interactive agent example');

    const processId = await this.processManager.createProcess(
      'Interactive Knowledge Agent',
      ProcessType.AGENT,
      ProcessPriority.HIGH,
      {
        timeout: 1800000, // 30 minutes for interactive session
        retryCount: 0, // No retries for interactive processes
      },
      {
        data: {
          agentName: 'knowledge-builder',
          query,
          interactiveMode: true,
          debugMode: true,
        },
      },
      {
        tags: ['interactive', 'knowledge-building'],
        description: `Interactive knowledge building session for: ${query}`,
      }
    );

    // Set up interactive monitoring
    this.setupInteractiveMonitoring(processId);

    const executor = await this.agentExecutor.execute(
      processId,
      {
        agentName: 'knowledge-builder',
        query,
        interactiveMode: true,
      },
      {
        debugMode: true,
        allowUserInput: true,
      }
    );

    await this.processManager.startProcess(processId, executor);

    this.logger.log(`Interactive agent started: ${processId}`);
    return processId;
  }

  /**
   * Example 6: MCP Client Integration
   * This example demonstrates how external MCP clients can interact
   * with the process management system.
   */
  async demonstrateMcpIntegration(): Promise<void> {
    this.logger.log('Demonstrating MCP client integration');

    // Simulate MCP client requests
    const startRequest = {
      id: 'req_001',
      processId: '',
      type: 'start_process' as const,
      payload: {
        name: 'MCP Controlled Process',
        type: 'agent',
        priority: 'medium',
        input: {
          agentName: 'documentation-generator',
          sourceCode: 'export class Example { }',
        },
        configuration: {
          format: 'markdown',
        },
      },
      timestamp: new Date(),
    };

    // Handle the request through MCP service
    const startResponse = await this.interactionMcp.handleMcpRequest(startRequest);
    this.logger.log('MCP Start Response:', startResponse);

    if (startResponse.success && startResponse.data?.processId) {
      const processId = startResponse.data.processId;

      // Query process status
      const statusRequest = {
        id: 'req_002',
        processId,
        type: 'query_status' as const,
        payload: { processId },
        timestamp: new Date(),
      };

      const statusResponse = await this.interactionMcp.handleMcpRequest(statusRequest);
      this.logger.log('MCP Status Response:', statusResponse);

      // Control the process
      const controlRequest = {
        id: 'req_003',
        processId,
        type: 'control_process' as const,
        payload: {
          action: 'pause',
          processId,
        },
        timestamp: new Date(),
      };

      const controlResponse = await this.interactionMcp.handleMcpRequest(controlRequest);
      this.logger.log('MCP Control Response:', controlResponse);
    }
  }

  /**
   * Example 7: Error Handling and Recovery
   * This example shows best practices for error handling and
   * automatic recovery in long-running processes.
   */
  async demonstrateErrorHandling(): Promise<string> {
    this.logger.log('Demonstrating error handling and recovery');

    const processId = await this.processManager.createProcess(
      'Error Handling Demo',
      ProcessType.WORKFLOW,
      ProcessPriority.LOW,
      {
        timeout: 120000, // 2 minutes
        retryCount: 3,
        retryDelay: 5000, // 5 seconds between retries
        autoRestart: true,
      },
      {
        data: {
          workflowType: 'error-demo',
          simulateFailure: true,
        },
      },
      {
        tags: ['demo', 'error-handling'],
        description: 'Demonstrates error handling and recovery mechanisms',
      }
    );

    try {
      const executor = await this.workflowExecutor.execute(
        processId,
        {
          workflowType: 'error-demo',
          simulateFailure: true,
        },
        {
          maxRetries: 3,
          enableRecovery: true,
        }
      );

      await this.processManager.startProcess(processId, executor);

      // Monitor for failures and recoveries
      const monitorInterval = setInterval(() => {
        const process = this.processManager.getProcess(processId);
        if (process) {
          if (process.error) {
            this.logger.warn(`Process ${processId} encountered error: ${process.error.message}`);
          }
          if (process.metadata.status === 'failed') {
            this.logger.log(`Process ${processId} failed, checking for auto-restart...`);
          }
          if (['completed', 'cancelled'].includes(process.metadata.status)) {
            clearInterval(monitorInterval);
          }
        }
      }, 2000);

    } catch (error) {
      this.logger.error(`Failed to start error handling demo: ${error.message}`);
      await this.processManager.failProcess(processId, {
        code: 'DEMO_SETUP_ERROR',
        message: error.message,
        stack: error.stack,
        timestamp: new Date(),
      });
    }

    return processId;
  }

  // Helper methods

  private async waitForBatchCompletion(processIds: string[]): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const processes = processIds.map(id => this.processManager.getProcess(id));
        const allCompleted = processes.every(process => 
          process && ['completed', 'failed', 'cancelled'].includes(process.metadata.status)
        );

        if (allCompleted) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 2000);
    });
  }

  private setupInteractiveMonitoring(processId: string): void {
    // This would set up WebSocket listeners for interactive debugging
    // In a real implementation, you'd integrate with the WebSocket gateway
    this.logger.log(`Setting up interactive monitoring for process: ${processId}`);
    
    // Simulate interactive checkpoints
    setTimeout(() => {
      this.logger.log(`Interactive checkpoint reached for process: ${processId}`);
      // Here you could emit events for external clients to display user prompts
    }, 10000);
  }

  /**
   * Helper method to demonstrate all examples
   */
  async runAllExamples(): Promise<void> {
    this.logger.log('Running all integration examples...');

    try {
      // Example 1: Code Analysis Agent
      const codeAnalysisId = await this.runCodeAnalysisAgent('/tmp/example.ts');
      await this.setupProcessMonitoring(codeAnalysisId);

      // Example 2: Documentation Workflow
      const docWorkflowId = await this.runDocumentationWorkflow([
        '/tmp/file1.ts',
        '/tmp/file2.ts'
      ]);

      // Example 3: Batch Processing
      const batchIds = await this.runBatchProcessing([
        '/tmp/batch1.ts',
        '/tmp/batch2.ts',
        '/tmp/batch3.ts'
      ]);

      // Example 4: Interactive Agent
      const interactiveId = await this.runInteractiveAgent('What is the architecture of this system?');

      // Example 5: MCP Integration
      await this.demonstrateMcpIntegration();

      // Example 6: Error Handling
      const errorHandlingId = await this.demonstrateErrorHandling();

      this.logger.log('All examples completed successfully');
      
    } catch (error) {
      this.logger.error(`Example execution failed: ${error.message}`, error.stack);
    }
  }
}