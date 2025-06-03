import { Command } from 'commander';
import { bold, cyan, gray, yellow, red } from 'kleur';
import inquirer from 'inquirer';
import { APIClient } from '../services/api-client';
import { Formatter } from '../utils/formatting';
import { SpinnerManager } from '../utils/spinner';
import { ConfigManager } from '../utils/config';
import { WorkflowInfo, WorkflowStep } from '../types';

export class WorkflowCommand {
  private apiClient: APIClient;
  private config: ConfigManager;

  constructor() {
    this.apiClient = new APIClient();
    this.config = ConfigManager.getInstance();
  }

  register(program: Command): void {
    // List workflows command
    program
      .command('list')
      .alias('ls')
      .description('List all workflows')
      .option('-s, --status <status>', 'Filter by status (idle, running, completed, failed, paused)')
      .option('-t, --type <type>', 'Filter by workflow type')
      .option('-d, --detailed', 'Show detailed information')
      .action(async (options) => {
        await this.listWorkflows(options);
      });

    // Show workflow details command
    program
      .command('show <workflowId>')
      .description('Show detailed workflow information')
      .action(async (workflowId) => {
        await this.showWorkflow(workflowId);
      });

    // Start workflow command
    program
      .command('start <workflowId>')
      .description('Start a workflow')
      .option('-i, --input <input>', 'Input data as JSON string')
      .option('-f, --file <file>', 'Input data from file')
      .option('--interactive', 'Interactive input mode')
      .option('-w, --wait', 'Wait for completion')
      .option('-t, --timeout <seconds>', 'Execution timeout in seconds', '600')
      .action(async (workflowId, options) => {
        await this.startWorkflow(workflowId, options);
      });

    // Stop workflow command
    program
      .command('stop <workflowId>')
      .description('Stop a running workflow')
      .option('-f, --force', 'Force stop the workflow')
      .action(async (workflowId, options) => {
        await this.stopWorkflow(workflowId, options);
      });

    // Pause workflow command
    program
      .command('pause <workflowId>')
      .description('Pause a running workflow')
      .action(async (workflowId) => {
        await this.pauseWorkflow(workflowId);
      });

    // Resume workflow command
    program
      .command('resume <workflowId>')
      .description('Resume a paused workflow')
      .action(async (workflowId) => {
        await this.resumeWorkflow(workflowId);
      });

    // Workflow status command
    program
      .command('status <workflowId>')
      .description('Show workflow execution status')
      .option('-w, --watch', 'Watch for status changes')
      .option('--refresh <seconds>', 'Refresh interval in seconds', '3')
      .action(async (workflowId, options) => {
        await this.showWorkflowStatus(workflowId, options);
      });

    // Workflow steps command
    program
      .command('steps <workflowId>')
      .description('Show workflow steps and their status')
      .option('-d, --detailed', 'Show detailed step information')
      .action(async (workflowId, options) => {
        await this.showWorkflowSteps(workflowId, options);
      });

    // Workflow history command
    program
      .command('history <workflowId>')
      .description('Show workflow execution history')
      .option('-n, --limit <number>', 'Number of executions to show', '10')
      .option('-f, --filter <status>', 'Filter by execution status')
      .action(async (workflowId, options) => {
        await this.showWorkflowHistory(workflowId, options);
      });

    // Workflow templates command
    program
      .command('templates')
      .description('List available workflow templates')
      .action(async () => {
        await this.listTemplates();
      });

    // Create workflow from template
    program
      .command('create <templateId>')
      .description('Create a new workflow from template')
      .option('-n, --name <name>', 'Workflow name')
      .option('-d, --description <description>', 'Workflow description')
      .option('-c, --config <config>', 'Configuration as JSON string')
      .action(async (templateId, options) => {
        await this.createFromTemplate(templateId, options);
      });

    // Workflow logs command
    program
      .command('logs <workflowId>')
      .description('Show workflow execution logs')
      .option('-f, --follow', 'Follow log output')
      .option('-n, --lines <number>', 'Number of lines to show', '100')
      .option('--step <stepId>', 'Filter by specific step')
      .action(async (workflowId, options) => {
        await this.showWorkflowLogs(workflowId, options);
      });

    // Workflow graph command
    program
      .command('graph <workflowId>')
      .description('Show workflow execution graph')
      .option('--format <format>', 'Output format (ascii, dot, mermaid)', 'ascii')
      .action(async (workflowId, options) => {
        await this.showWorkflowGraph(workflowId, options);
      });
  }

  private async listWorkflows(options: any): Promise<void> {
    try {
      const response = await this.apiClient.getWorkflows();
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get workflows');
      }

      let workflows: WorkflowInfo[] = response.data.workflows || [];

      // Apply filters
      if (options.status) {
        workflows = workflows.filter(workflow => workflow.status === options.status);
      }

      if (options.type) {
        workflows = workflows.filter(workflow => workflow.type === options.type);
      }

      console.log(Formatter.formatHeader(`Workflows (${workflows.length})`));
      console.log();

      if (workflows.length === 0) {
        console.log(Formatter.formatInfo('No workflows found matching criteria'));
        return;
      }

      if (options.detailed) {
        // Detailed view
        workflows.forEach((workflow, index) => {
          if (index > 0) console.log();
          
          console.log(`${bold(workflow.name)} (${workflow.id}`);
          console.log(`  Type: ${cyan(workflow.type)}`);
          console.log(`  Status: ${Formatter.formatStatus(workflow.status)} ${workflow.status}`);
          console.log(`  Description: ${gray(workflow.description)}`);
          console.log(`  Steps: ${workflow.steps.length}`);
          
          if (workflow.startTime) {
            console.log(`  Started: ${Formatter.formatTimestamp(workflow.startTime)}`);
          }
          
          if (workflow.duration) {
            console.log(`  Duration: ${Formatter.formatDuration(workflow.duration)}`);
          }
          
          if (workflow.progress !== undefined) {
            console.log(`  Progress: ${Formatter.formatProgress(workflow.progress * 100, 100)}`);
          }
        });
      } else {
        // Table view
        const tableData = workflows.map(workflow => ({
          ID: workflow.id,
          Name: workflow.name,
          Type: workflow.type,
          Status: Formatter.formatStatus(workflow.status) + ' ' + workflow.status,
          Steps: workflow.steps.length,
          Progress: workflow.progress !== undefined ? 
            `${(workflow.progress * 100).toFixed(1)}%` : 'N/A',
          Duration: workflow.duration ? 
            Formatter.formatDuration(workflow.duration) : 'N/A',
          Started: workflow.startTime ? 
            Formatter.formatTimestamp(workflow.startTime) : 'Never'
        }));

        console.log(Formatter.formatTable(tableData, { 
          format: this.config.get('display.format') 
        }));
      }

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to list workflows: ${message}`));
    }
  }

  private async showWorkflow(workflowId: string): Promise<void> {
    try {
      const response = await this.apiClient.getWorkflow(workflowId);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get workflow information');
      }

      const workflow: WorkflowInfo = response.data;

      console.log(Formatter.formatHeader(`Workflow: ${workflow.name}`));
      console.log();
      
      console.log(`${bold('ID:')} ${workflow.id}`);
      console.log(`${bold('Name:')} ${workflow.name}`);
      console.log(`${bold('Type:')} ${cyan(workflow.type)}`);
      console.log(`${bold('Status:')} ${Formatter.formatStatus(workflow.status)} ${workflow.status}`);
      console.log(`${bold('Description:')} ${workflow.description}`);
      console.log();
      
      console.log(bold('Execution Info:'));
      if (workflow.startTime) {
        console.log(`  Started: ${Formatter.formatTimestamp(workflow.startTime)}`);
      }
      if (workflow.endTime) {
        console.log(`  Ended: ${Formatter.formatTimestamp(workflow.endTime)}`);
      }
      if (workflow.duration) {
        console.log(`  Duration: ${Formatter.formatDuration(workflow.duration)}`);
      }
      if (workflow.progress !== undefined) {
        console.log(`  Progress: ${Formatter.formatProgress(workflow.progress * 100, 100)}`);
      }
      
      console.log();
      console.log(bold('Steps:'));
      workflow.steps.forEach((step, index) => {
        const statusIcon = Formatter.formatStatus(
          step.status === 'completed' ? 'healthy' : 
          step.status === 'failed' ? 'unhealthy' : 
          step.status === 'running' ? 'running' : 'warning'
        );
        console.log(`  ${index + 1}. ${statusIcon} ${step.name} (${step.status})`);
        
        if (step.duration) {
          console.log(`     Duration: ${Formatter.formatDuration(step.duration)}`);
        }
      });

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to get workflow information: ${message}`));
    }
  }

  private async startWorkflow(workflowId: string, options: any): Promise<void> {
    const spinnerId = 'workflow-start';
    
    try {
      // Get input data
      let inputData: any = {};
      
      if (options.interactive) {
        inputData = await this.getInteractiveInput(workflowId);
      } else if (options.file) {
        const fs = require('fs-extra');
        const fileContent = await fs.readFile(options.file, 'utf-8');
        inputData = JSON.parse(fileContent);
      } else if (options.input) {
        inputData = JSON.parse(options.input);
      }

      SpinnerManager.start(spinnerId, `Starting workflow ${workflowId}...`);

      // Start workflow
      const response = await this.apiClient.startWorkflow(workflowId, inputData);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to start workflow');
      }

      const execution = response.data;

      if (options.wait) {
        SpinnerManager.update(spinnerId, 'Waiting for workflow to complete...');
        
        const timeout = parseInt(options.timeout) * 1000;
        const startTime = Date.now();
        
        // Create progress tracker
        const progressTracker = SpinnerManager.createProgress('workflow-progress', 100, {
          format: '{bar} {percentage}% | Step: {text}'
        });
        
        while (Date.now() - startTime < timeout) {
          const statusResponse = await this.apiClient.getWorkflowStatus(workflowId);
          
          if (statusResponse.success) {
            const status = statusResponse.data;
            
            if (status.status === 'completed') {
              progressTracker.finish('Workflow completed successfully');
              SpinnerManager.succeed(spinnerId, 'Workflow execution completed');
              
              console.log();
              console.log(Formatter.formatHeader('Execution Summary'));
              console.log();
              console.log(`Total Steps: ${status.steps.length}`);
              console.log(`Completed: ${status.steps.filter((s: any) => s.status === 'completed').length}`);
              console.log(`Failed: ${status.steps.filter((s: any) => s.status === 'failed').length}`);
              console.log(`Duration: ${Formatter.formatDuration(status.duration)}`);
              
              return;
              
            } else if (status.status === 'failed') {
              progressTracker.finish('Workflow failed');
              throw new Error(status.error || 'Workflow execution failed');
            }
            
            // Update progress
            if (status.progress !== undefined) {
              const currentStep = status.steps.find((s: any) => s.status === 'running');
              progressTracker.update(
                status.progress * 100,
                currentStep ? currentStep.name : 'Processing'
              );
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        throw new Error('Workflow execution timeout');
        
      } else {
        SpinnerManager.succeed(spinnerId, `Workflow started (execution ID: ${execution.id})`);
        console.log(Formatter.formatInfo(`Use 'mcp-cli workflow status ${workflowId}' to check progress`));
      }

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      SpinnerManager.fail(spinnerId, `Workflow start failed: ${message}`);
    }
  }

  private async stopWorkflow(workflowId: string, options: any): Promise<void> {
    const spinnerId = 'workflow-stop';
    
    try {
      SpinnerManager.start(spinnerId, `Stopping workflow ${workflowId}...`);

      const response = await this.apiClient.stopWorkflow(workflowId);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to stop workflow');
      }

      SpinnerManager.succeed(spinnerId, 'Workflow stop initiated');

      // Wait for workflow to actually stop
      if (!options.force) {
        SpinnerManager.start('workflow-stopping', 'Waiting for workflow to stop...');
        
        const timeout = 30000; // 30 seconds
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
          const statusResponse = await this.apiClient.getWorkflowStatus(workflowId);
          
          if (statusResponse.success && statusResponse.data.status === 'idle') {
            SpinnerManager.succeed('workflow-stopping', 'Workflow stopped successfully');
            return;
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        SpinnerManager.warn('workflow-stopping', 'Workflow may still be stopping');
      }

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      SpinnerManager.fail(spinnerId, `Failed to stop workflow: ${message}`);
    }
  }

  private async pauseWorkflow(workflowId: string): Promise<void> {
    const spinnerId = 'workflow-pause';
    
    try {
      SpinnerManager.start(spinnerId, `Pausing workflow ${workflowId}...`);

      const response = await this.apiClient.post(`/workflows/${workflowId}/pause`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to pause workflow');
      }

      SpinnerManager.succeed(spinnerId, 'Workflow paused successfully');

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      SpinnerManager.fail(spinnerId, `Failed to pause workflow: ${message}`);
    }
  }

  private async resumeWorkflow(workflowId: string): Promise<void> {
    const spinnerId = 'workflow-resume';
    
    try {
      SpinnerManager.start(spinnerId, `Resuming workflow ${workflowId}...`);

      const response = await this.apiClient.post(`/workflows/${workflowId}/resume`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to resume workflow');
      }

      SpinnerManager.succeed(spinnerId, 'Workflow resumed successfully');

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      SpinnerManager.fail(spinnerId, `Failed to resume workflow: ${message}`);
    }
  }

  private async showWorkflowStatus(workflowId: string, options: any): Promise<void> {
    const showStatusOnce = async () => {
      try {
        const response = await this.apiClient.getWorkflowStatus(workflowId);
        
        if (!response.success) {
          throw new Error(response.error || 'Failed to get workflow status');
        }

        const status = response.data;

        console.log(Formatter.formatHeader(`Workflow Status: ${workflowId}`));
        console.log();
        
        console.log(`Status: ${Formatter.formatStatus(status.status)} ${status.status}`);
        
        if (status.startTime) {
          console.log(`Started: ${Formatter.formatTimestamp(status.startTime)}`);
        }
        
        if (status.duration) {
          console.log(`Duration: ${Formatter.formatDuration(status.duration)}`);
        }
        
        if (status.progress !== undefined) {
          console.log(`Progress: ${Formatter.formatProgress(status.progress * 100, 100)}`);
        }
        
        console.log();
        console.log(bold('Step Status:'));
        
        status.steps.forEach((step: WorkflowStep, index: number) => {
          const statusIcon = Formatter.formatStatus(
            step.status === 'completed' ? 'healthy' : 
            step.status === 'failed' ? 'unhealthy' : 
            step.status === 'running' ? 'running' : 'warning'
          );
          
          console.log(`  ${index + 1}. ${statusIcon} ${step.name} (${step.status})`);
          
          if (step.duration) {
            console.log(`     ${gray(`Duration: ${Formatter.formatDuration(step.duration)}`)}`);
          }
          
          if (step.error) {
            console.log(`     ${red(`Error: ${step.error}`)}`);
          }
        });

      } catch (error: any) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(Formatter.formatError(`Failed to get workflow status: ${message}`));
      }
    };

    if (options.watch) {
      const refreshInterval = parseInt(options.refresh) * 1000;
      
      console.log(Formatter.formatInfo(`Watching workflow status (refresh every ${options.refresh}s)`));
      console.log(Formatter.formatDim('Press Ctrl+C to stop'));
      console.log();
      
      await showStatusOnce();
      
      const interval = setInterval(async () => {
        process.stdout.write('\x1B[2J\x1B[0f');
        console.log(Formatter.formatDim(`Last updated: ${new Date().toLocaleTimeString()}`));
        console.log();
        await showStatusOnce();
      }, refreshInterval);
      
      process.on('SIGINT', () => {
        clearInterval(interval);
        console.log(yellow('\nStopped watching'));
        process.exit(0);
      });
      
    } else {
      await showStatusOnce();
    }
  }

  private async showWorkflowSteps(workflowId: string, options: any): Promise<void> {
    try {
      const response = await this.apiClient.get(`/workflows/${workflowId}/steps`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get workflow steps');
      }

      const steps: WorkflowStep[] = response.data.steps || [];

      console.log(Formatter.formatHeader(`Workflow Steps: ${workflowId}`));
      console.log();

      if (steps.length === 0) {
        console.log(Formatter.formatInfo('No steps found'));
        return;
      }

      if (options.detailed) {
        steps.forEach((step, index) => {
          if (index > 0) console.log();
          
          const statusIcon = Formatter.formatStatus(
            step.status === 'completed' ? 'healthy' : 
            step.status === 'failed' ? 'unhealthy' : 
            step.status === 'running' ? 'running' : 'warning'
          );
          
          console.log(`${bold(`Step ${index + 1}: ${step.name}`)}`);
          console.log(`  ID: ${step.id}`);
          console.log(`  Status: ${statusIcon} ${step.status}`);
          
          if (step.startTime) {
            console.log(`  Started: ${Formatter.formatTimestamp(step.startTime)}`);
          }
          
          if (step.endTime) {
            console.log(`  Ended: ${Formatter.formatTimestamp(step.endTime)}`);
          }
          
          if (step.duration) {
            console.log(`  Duration: ${Formatter.formatDuration(step.duration)}`);
          }
          
          if (step.output) {
            console.log(`  Output: ${JSON.stringify(step.output, null, 2)}`);
          }
          
          if (step.error) {
            console.log(`  Error: ${red(step.error)}`);
          }
        });
      } else {
        const tableData = steps.map((step, index) => ({
          '#': index + 1,
          Name: step.name,
          Status: Formatter.formatStatus(
            step.status === 'completed' ? 'healthy' : 
            step.status === 'failed' ? 'unhealthy' : 
            step.status === 'running' ? 'running' : 'warning'
          ) + ' ' + step.status,
          Duration: step.duration ? Formatter.formatDuration(step.duration) : 'N/A',
          Started: step.startTime ? Formatter.formatTimestamp(step.startTime) : 'N/A'
        }));

        console.log(Formatter.formatTable(tableData, { 
          format: this.config.get('display.format') 
        }));
      }

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to get workflow steps: ${message}`));
    }
  }

  private async showWorkflowHistory(workflowId: string, options: any): Promise<void> {
    try {
      const params = new URLSearchParams();
      if (options.limit) params.append('limit', options.limit);
      if (options.filter) params.append('status', options.filter);
      
      const response = await this.apiClient.get(`/workflows/${workflowId}/history?${params.toString()}`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get workflow history');
      }

      const executions = response.data.executions || [];

      console.log(Formatter.formatHeader(`Workflow History: ${workflowId}`));
      console.log();

      if (executions.length === 0) {
        console.log(Formatter.formatInfo('No execution history found'));
        return;
      }

      const tableData = executions.map((exec: any) => ({
        ID: exec.id.substring(0, 8),
        Status: Formatter.formatStatus(
          exec.status === 'completed' ? 'healthy' : 
          exec.status === 'failed' ? 'unhealthy' : 'warning'
        ) + ' ' + exec.status,
        'Start Time': Formatter.formatTimestamp(exec.startTime),
        Duration: exec.duration ? Formatter.formatDuration(exec.duration) : 'N/A',
        'Steps Completed': `${exec.completedSteps}/${exec.totalSteps}`,
        'Success Rate': exec.totalSteps > 0 ? 
          `${((exec.completedSteps / exec.totalSteps) * 100).toFixed(1)}%` : 'N/A'
      }));

      console.log(Formatter.formatTable(tableData, { 
        format: this.config.get('display.format') 
      }));

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to get workflow history: ${message}`));
    }
  }

  private async listTemplates(): Promise<void> {
    try {
      const response = await this.apiClient.get('/workflows/templates');
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get workflow templates');
      }

      const templates = response.data.templates || [];

      console.log(Formatter.formatHeader(`Workflow Templates (${templates.length})`));
      console.log();

      if (templates.length === 0) {
        console.log(Formatter.formatInfo('No workflow templates found'));
        return;
      }

      const tableData = templates.map((template: any) => ({
        ID: template.id,
        Name: template.name,
        Description: template.description,
        Category: template.category,
        Steps: template.stepCount,
        Version: template.version
      }));

      console.log(Formatter.formatTable(tableData, { 
        format: this.config.get('display.format') 
      }));

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to list workflow templates: ${message}`));
    }
  }

  private async createFromTemplate(templateId: string, options: any): Promise<void> {
    const spinnerId = 'create-workflow';
    
    try {
      SpinnerManager.start(spinnerId, `Creating workflow from template ${templateId}...`);

      const workflowConfig: any = {
        templateId,
        name: options.name,
        description: options.description
      };

      if (options.config) {
        workflowConfig.configuration = JSON.parse(options.config);
      }

      const response = await this.apiClient.post('/workflows/create', workflowConfig);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to create workflow');
      }

      const workflow = response.data;
      SpinnerManager.succeed(spinnerId, `Workflow created: ${workflow.name} (${workflow.id})`);

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      SpinnerManager.fail(spinnerId, `Failed to create workflow: ${message}`);
    }
  }

  private async showWorkflowLogs(workflowId: string, options: any): Promise<void> {
    try {
      const params = new URLSearchParams();
      if (options.lines) params.append('lines', options.lines);
      if (options.step) params.append('step', options.step);
      
      if (options.follow) {
        console.log(Formatter.formatInfo(`Following workflow logs for ${workflowId}`));
        console.log(Formatter.formatDim('Press Ctrl+C to stop'));
        console.log(Formatter.formatDim('──────────────────────────────────────'));
        
        // Connect to WebSocket for real-time logs
        await this.apiClient.connectWebSocket();
        
        // Subscribe to workflow logs
        this.apiClient.sendWebSocketMessage({
          type: 'subscribe',
          channel: `workflow-logs-${workflowId}`
        });
        
        this.apiClient.on('ws-log', (logData) => {
          if (logData.workflowId === workflowId) {
            const timestamp = new Date(logData.timestamp);
            const level = Formatter.formatLogLevel(logData.level);
            const stepInfo = logData.stepId ? `[${logData.stepId}] ` : '';
            
            console.log(`${Formatter.formatTimestamp(timestamp)} ${level} ${stepInfo}${logData.message}`);
          }
        });
        
        process.on('SIGINT', () => {
          this.apiClient.disconnectWebSocket();
          console.log(yellow('\nStopped following logs'));
          process.exit(0);
        });
        
      } else {
        const response = await this.apiClient.get(`/workflows/${workflowId}/logs?${params.toString()}`);
        
        if (!response.success) {
          throw new Error(response.error || 'Failed to get workflow logs');
        }
        
        const logs = response.data.logs || [];
        
        if (logs.length === 0) {
          console.log(Formatter.formatInfo('No logs found'));
          return;
        }
        
        logs.forEach((log: any) => {
          const timestamp = new Date(log.timestamp);
          const level = Formatter.formatLogLevel(log.level);
          const stepInfo = log.stepId ? `[${log.stepId}] ` : '';
          
          console.log(`${Formatter.formatTimestamp(timestamp)} ${level} ${stepInfo}${log.message}`);
        });
      }
      
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to get workflow logs: ${message}`));
    }
  }

  private async showWorkflowGraph(workflowId: string, options: any): Promise<void> {
    try {
      const response = await this.apiClient.get(`/workflows/${workflowId}/graph?format=${options.format}`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get workflow graph');
      }

      const graph = response.data.graph;

      console.log(Formatter.formatHeader(`Workflow Graph: ${workflowId}`));
      console.log();

      if (options.format === 'ascii') {
        console.log(graph);
      } else {
        console.log(Formatter.formatCode(graph));
      }

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to get workflow graph: ${message}`));
    }
  }

  private async getInteractiveInput(workflowId: string): Promise<any> {
    try {
      // Get workflow schema
      const schemaResponse = await this.apiClient.get(`/workflows/${workflowId}/schema`);
      const schema = schemaResponse.success ? schemaResponse.data : null;

      const questions: any[] = [];

      if (schema && schema.input) {
        // Build questions based on schema
        for (const [key, config] of Object.entries(schema.input.properties || {})) {
          const prop = config as any;
          
          const question: any = {
            name: key,
            message: `${key}${prop.description ? ` (${prop.description})` : ''}:`,
            type: 'input'
          };

          if (prop.type === 'boolean') {
            question.type = 'confirm';
          } else if (prop.enum) {
            question.type = 'list';
            question.choices = prop.enum;
          }

          if (prop.default !== undefined) {
            question.default = prop.default;
          }

          questions.push(question);
        }
      } else {
        // Generic input
        questions.push({
          name: 'data',
          message: 'Enter workflow input data (JSON format):',
          type: 'input',
          default: '{}',
          validate: (input: string) => {
            try {
              JSON.parse(input);
              return true;
            } catch {
              return 'Please enter valid JSON';
            }
          }
        });
      }

      const answers = await inquirer.prompt(questions);

      if (answers.data) {
        return JSON.parse(answers.data);
      }

      return answers;

    } catch (error: any) {
      console.log(Formatter.formatWarning('Could not get workflow schema, using basic input'));
      
      const answers = await inquirer.prompt([
        {
          name: 'data',
          message: 'Enter workflow input data (JSON format):',
          type: 'input',
          default: '{}'
        }
      ]);

      return JSON.parse(answers.data);
    }
  }
}