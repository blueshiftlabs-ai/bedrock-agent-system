import { Command } from 'commander';
import { bold, cyan, gray, yellow } from 'kleur';
import inquirer from 'inquirer';
import { APIClient } from '../services/api-client';
import { Formatter } from '../utils/formatting';
import { SpinnerManager } from '../utils/spinner';
import { ConfigManager } from '../utils/config';
import { AgentInfo } from '../types';

export class AgentCommand {
  private apiClient: APIClient;
  private config: ConfigManager;

  constructor() {
    this.apiClient = new APIClient();
    this.config = ConfigManager.getInstance();
  }

  register(program: Command): void {
    // List agents command
    program
      .command('list')
      .alias('ls')
      .description('List all available agents')
      .option('-s, --status <status>', 'Filter by status (active, inactive, error)')
      .option('-t, --type <type>', 'Filter by agent type')
      .option('-d, --detailed', 'Show detailed information')
      .action(async (options) => {
        await this.listAgents(options);
      });

    // Show agent details command
    program
      .command('show <agentId>')
      .description('Show detailed agent information')
      .action(async (agentId) => {
        await this.showAgent(agentId);
      });

    // Run agent command
    program
      .command('run <agentId>')
      .description('Run an agent with input')
      .option('-i, --input <input>', 'Input data as JSON string')
      .option('-f, --file <file>', 'Input data from file')
      .option('--interactive', 'Interactive input mode')
      .option('-w, --wait', 'Wait for completion')
      .option('-t, --timeout <seconds>', 'Execution timeout in seconds', '300')
      .action(async (agentId, options) => {
        await this.runAgent(agentId, options);
      });

    // Agent status command
    program
      .command('status <agentId>')
      .description('Show agent execution status')
      .option('-w, --watch', 'Watch for status changes')
      .option('--refresh <seconds>', 'Refresh interval in seconds', '3')
      .action(async (agentId, options) => {
        await this.showAgentStatus(agentId, options);
      });

    // Agent history command
    program
      .command('history <agentId>')
      .description('Show agent execution history')
      .option('-n, --limit <number>', 'Number of executions to show', '10')
      .option('-f, --filter <status>', 'Filter by execution status')
      .action(async (agentId, options) => {
        await this.showAgentHistory(agentId, options);
      });

    // Agent capabilities command
    program
      .command('capabilities <agentId>')
      .description('Show agent capabilities and schema')
      .action(async (agentId) => {
        await this.showAgentCapabilities(agentId);
      });

    // Interactive agent runner
    program
      .command('interactive <agentId>')
      .alias('i')
      .description('Interactive agent execution mode')
      .action(async (agentId) => {
        await this.interactiveMode(agentId);
      });

    // Agent performance command
    program
      .command('performance')
      .description('Show agent performance metrics')
      .option('-s, --sort <field>', 'Sort by field (executions, time, errors)', 'executions')
      .option('-r, --reverse', 'Reverse sort order')
      .action(async (options) => {
        await this.showPerformance(options);
      });

    // Test agent command
    program
      .command('test <agentId>')
      .description('Test agent with sample data')
      .option('--sample <type>', 'Use predefined sample data')
      .action(async (agentId, options) => {
        await this.testAgent(agentId, options);
      });
  }

  private async listAgents(options: any): Promise<void> {
    try {
      const response = await this.apiClient.getAgents();
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get agents');
      }

      let agents: AgentInfo[] = response.data.agents || [];

      // Apply filters
      if (options.status) {
        agents = agents.filter(agent => agent.status === options.status);
      }

      if (options.type) {
        agents = agents.filter(agent => agent.type === options.type);
      }

      console.log(Formatter.formatHeader(`Agents (${agents.length})`));
      console.log();

      if (agents.length === 0) {
        console.log(Formatter.formatInfo('No agents found matching criteria'));
        return;
      }

      if (options.detailed) {
        // Detailed view
        agents.forEach((agent, index) => {
          if (index > 0) console.log();
          
          console.log(`${bold(agent.name)} (${agent.id})`);
          console.log(`  Type: ${cyan(agent.type)}`);
          console.log(`  Status: ${Formatter.formatStatus(agent.status)} ${agent.status}`);
          console.log(`  Description: ${gray(agent.description)}`);
          console.log(`  Executions: ${agent.executionCount}`);
          
          if (agent.lastExecution) {
            console.log(`  Last Execution: ${Formatter.formatTimestamp(agent.lastExecution)}`);
          }
          
          if (agent.averageExecutionTime) {
            console.log(`  Avg. Time: ${Formatter.formatDuration(agent.averageExecutionTime)}`);
          }
          
          if (agent.capabilities.length > 0) {
            console.log(`  Capabilities: ${agent.capabilities.join(', ')}`);
          }
        });
      } else {
        // Table view
        const tableData = agents.map(agent => ({
          ID: agent.id,
          Name: agent.name,
          Type: agent.type,
          Status: Formatter.formatStatus(agent.status) + ' ' + agent.status,
          Executions: agent.executionCount,
          'Last Execution': agent.lastExecution ? 
            Formatter.formatTimestamp(agent.lastExecution) : 
            'Never',
          'Avg. Time': agent.averageExecutionTime ? 
            Formatter.formatDuration(agent.averageExecutionTime) : 
            'N/A'
        }));

        console.log(Formatter.formatTable(tableData, { 
          format: this.config.get('display.format') 
        }));
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to list agents: ${message}`));
    }
  }

  private async showAgent(agentId: string): Promise<void> {
    try {
      const response = await this.apiClient.getAgent(agentId);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get agent information');
      }

      const agent: AgentInfo = response.data;

      console.log(Formatter.formatHeader(`Agent: ${agent.name}`));
      console.log();
      
      console.log(`${bold('ID:')} ${agent.id}`);
      console.log(`${bold('Name:')} ${agent.name}`);
      console.log(`${bold('Type:')} ${cyan(agent.type)}`);
      console.log(`${bold('Status:')} ${Formatter.formatStatus(agent.status)} ${agent.status}`);
      console.log(`${bold('Description:')} ${agent.description}`);
      console.log();
      
      console.log(bold('Statistics:'));
      console.log(`  Total Executions: ${agent.executionCount}`);
      
      if (agent.lastExecution) {
        console.log(`  Last Execution: ${Formatter.formatTimestamp(agent.lastExecution)}`);
      }
      
      if (agent.averageExecutionTime) {
        console.log(`  Average Execution Time: ${Formatter.formatDuration(agent.averageExecutionTime)}`);
      }
      
      console.log();
      console.log(bold('Capabilities:'));
      agent.capabilities.forEach(capability => {
        console.log(`  • ${capability}`);
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to get agent information: ${message}`));
    }
  }

  private async runAgent(agentId: string, options: any): Promise<void> {
    const spinnerId = 'agent-execution';
    
    try {
      // Get input data
      let inputData: any = {};
      
      if (options.interactive) {
        inputData = await this.getInteractiveInput(agentId);
      } else if (options.file) {
        const fs = require('fs-extra');
        const fileContent = await fs.readFile(options.file, 'utf-8');
        inputData = JSON.parse(fileContent);
      } else if (options.input) {
        inputData = JSON.parse(options.input);
      } else {
        console.log(Formatter.formatInfo('No input provided, using empty input'));
      }

      SpinnerManager.start(spinnerId, `Running agent ${agentId}...`);

      // Start agent execution
      const response = await this.apiClient.runAgent(agentId, inputData);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to run agent');
      }

      const execution = response.data;

      if (options.wait) {
        SpinnerManager.update(spinnerId, 'Waiting for execution to complete...');
        
        const timeout = parseInt(options.timeout) * 1000;
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
          const statusResponse = await this.apiClient.get(`/agents/${agentId}/executions/${execution.id}`);
          
          if (statusResponse.success) {
            const executionStatus = statusResponse.data;
            
            if (executionStatus.status === 'completed') {
              SpinnerManager.succeed(spinnerId, 'Agent execution completed successfully');
              
              console.log();
              console.log(Formatter.formatHeader('Execution Results'));
              console.log();
              
              if (executionStatus.output) {
                const format = this.config.get<string>('display.format');
                if (format === 'json') {
                  console.log(JSON.stringify(executionStatus.output, null, 2));
                } else {
                  console.log(executionStatus.output);
                }
              }
              
              console.log();
              console.log(`Execution Time: ${Formatter.formatDuration(executionStatus.duration)}`);
              return;
              
            } else if (executionStatus.status === 'failed') {
              throw new Error(executionStatus.error || 'Agent execution failed');
            }
            
            // Update progress if available
            if (executionStatus.progress !== undefined) {
              const progressText = `Running... ${(executionStatus.progress * 100).toFixed(1)}%`;
              SpinnerManager.update(spinnerId, progressText);
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        throw new Error('Agent execution timeout');
        
      } else {
        SpinnerManager.succeed(spinnerId, `Agent execution started (ID: ${execution.id})`);
        console.log(Formatter.formatInfo(`Use 'mcp-cli agent status ${agentId}' to check progress`));
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      SpinnerManager.fail(spinnerId, `Agent execution failed: ${message}`);
    }
  }

  private async getInteractiveInput(agentId: string): Promise<any> {
    try {
      // Get agent capabilities to guide input
      const capResponse = await this.apiClient.get(`/agents/${agentId}/schema`);
      const schema = capResponse.success ? capResponse.data : null;

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
        // Generic input questions
        questions.push({
          name: 'data',
          message: 'Enter input data (JSON format):',
          type: 'input',
          validate: (input: string) => {
            if (!input.trim()) return true;
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

    } catch (error) {
      console.log(Formatter.formatWarning('Could not get agent schema, using basic input'));
      
      const answers = await inquirer.prompt([
        {
          name: 'data',
          message: 'Enter input data (JSON format):',
          type: 'input',
          default: '{}'
        }
      ]);

      return JSON.parse(answers.data);
    }
  }

  private async showAgentStatus(agentId: string, options: any): Promise<void> {
    const showStatusOnce = async () => {
      try {
        const response = await this.apiClient.getAgentStatus(agentId);
        
        if (!response.success) {
          throw new Error(response.error || 'Failed to get agent status');
        }

        const status = response.data;

        console.log(Formatter.formatHeader(`Agent Status: ${agentId}`));
        console.log();
        
        console.log(`Status: ${Formatter.formatStatus(status.status)} ${status.status}`);
        
        if (status.currentExecution) {
          const exec = status.currentExecution;
          console.log();
          console.log(bold('Current Execution:'));
          console.log(`  ID: ${exec.id}`);
          console.log(`  Started: ${Formatter.formatTimestamp(exec.startTime)}`);
          console.log(`  Duration: ${Formatter.formatDuration(Date.now() - new Date(exec.startTime).getTime())}`);
          
          if (exec.progress !== undefined) {
            console.log(`  Progress: ${Formatter.formatProgress(exec.progress * 100, 100)}`);
          }
          
          if (exec.currentStep) {
            console.log(`  Current Step: ${exec.currentStep}`);
          }
        }
        
        if (status.recentExecutions && status.recentExecutions.length > 0) {
          console.log();
          console.log(bold('Recent Executions:'));
          
          status.recentExecutions.slice(0, 5).forEach((exec: any) => {
            const statusIcon = Formatter.formatStatus(
              exec.status === 'completed' ? 'healthy' : 
              exec.status === 'failed' ? 'unhealthy' : 'warning'
            );
            console.log(`  ${statusIcon} ${exec.id} (${exec.status}) - ${Formatter.formatTimestamp(exec.startTime)}`);
          });
        }

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(Formatter.formatError(`Failed to get agent status: ${message}`));
      }
    };

    if (options.watch) {
      const refreshInterval = parseInt(options.refresh) * 1000;
      
      console.log(Formatter.formatInfo(`Watching agent status (refresh every ${options.refresh}s)`));
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

  private async showAgentHistory(agentId: string, options: any): Promise<void> {
    try {
      const params = new URLSearchParams();
      if (options.limit) params.append('limit', options.limit);
      if (options.filter) params.append('status', options.filter);
      
      const response = await this.apiClient.get(`/agents/${agentId}/history?${params.toString()}`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get agent history');
      }

      const executions = response.data.executions || [];

      console.log(Formatter.formatHeader(`Agent History: ${agentId}`));
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
        'Input Size': exec.inputSize ? `${exec.inputSize} chars` : 'N/A',
        'Output Size': exec.outputSize ? `${exec.outputSize} chars` : 'N/A'
      }));

      console.log(Formatter.formatTable(tableData, { 
        format: this.config.get('display.format') 
      }));

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to get agent history: ${message}`));
    }
  }

  private async showAgentCapabilities(agentId: string): Promise<void> {
    try {
      const response = await this.apiClient.get(`/agents/${agentId}/schema`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get agent capabilities');
      }

      const schema = response.data;

      console.log(Formatter.formatHeader(`Agent Capabilities: ${agentId}`));
      console.log();

      const format = this.config.get<string>('display.format');
      
      if (format === 'json') {
        console.log(JSON.stringify(schema, null, 2));
      } else if (format === 'yaml') {
        const yaml = require('yaml');
        console.log(yaml.stringify(schema, { indent: 2 }));
      } else {
        // Structured display
        if (schema.description) {
          console.log(bold('Description:'));
          console.log(schema.description);
          console.log();
        }

        if (schema.input) {
          console.log(bold('Input Schema:'));
          this.displaySchema(schema.input, '  ');
          console.log();
        }

        if (schema.output) {
          console.log(bold('Output Schema:'));
          this.displaySchema(schema.output, '  ');
          console.log();
        }

        if (schema.capabilities) {
          console.log(bold('Capabilities:'));
          schema.capabilities.forEach((cap: string) => {
            console.log(`  • ${cap}`);
          });
        }
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to get agent capabilities: ${message}`));
    }
  }

  private displaySchema(schema: any, indent: string = ''): void {
    if (schema.type) {
      console.log(`${indent}Type: ${cyan(schema.type)}`);
    }
    
    if (schema.description) {
      console.log(`${indent}Description: ${schema.description}`);
    }

    if (schema.properties) {
      console.log(`${indent}Properties:`);
      for (const [key, prop] of Object.entries(schema.properties)) {
        console.log(`${indent}  ${yellow(key)}:`);
        this.displaySchema(prop, indent + '    ');
      }
    }

    if (schema.required) {
      console.log(`${indent}Required: ${schema.required.join(', ')}`);
    }

    if (schema.enum) {
      console.log(`${indent}Allowed values: ${schema.enum.join(', ')}`);
    }

    if (schema.default !== undefined) {
      console.log(`${indent}Default: ${schema.default}`);
    }
  }

  private async interactiveMode(agentId: string): Promise<void> {
    console.log(Formatter.formatHeader(`Interactive Mode: ${agentId}`));
    console.log(Formatter.formatInfo('Type "exit" to quit, "help" for commands'));
    console.log();

    while (true) {
      try {
        const answers = await inquirer.prompt([
          {
            name: 'command',
            message: cyan('mcp-agent>'),
            type: 'input'
          }
        ]);

        const command = answers.command.trim().toLowerCase();

        if (command === 'exit' || command === 'quit') {
          console.log(yellow('Goodbye!'));
          break;
        }

        if (command === 'help') {
          console.log(bold('Available commands:'));
          console.log('  run [input]  - Run agent with input');
          console.log('  status       - Show agent status');
          console.log('  capabilities - Show agent capabilities');
          console.log('  history      - Show execution history');
          console.log('  help         - Show this help');
          console.log('  exit         - Exit interactive mode');
          continue;
        }

        if (command.startsWith('run')) {
          const inputPart = answers.command.substring(3).trim();
          let inputData = {};
          
          if (inputPart) {
            try {
              inputData = JSON.parse(inputPart);
            } catch {
              console.log(Formatter.formatError('Invalid JSON input'));
              continue;
            }
          } else {
            inputData = await this.getInteractiveInput(agentId);
          }

          await this.runAgent(agentId, { input: JSON.stringify(inputData), wait: true });
          continue;
        }

        if (command === 'status') {
          await this.showAgentStatus(agentId, {});
          continue;
        }

        if (command === 'capabilities') {
          await this.showAgentCapabilities(agentId);
          continue;
        }

        if (command === 'history') {
          await this.showAgentHistory(agentId, { limit: 5 });
          continue;
        }

        console.log(Formatter.formatError(`Unknown command: ${command}`));
        console.log(Formatter.formatInfo('Type "help" for available commands'));

      } catch (error) {
        if (error && typeof error === 'object' && 'isTtyError' in error) {
          // User cancelled (Ctrl+C)
          console.log(yellow('\nGoodbye!'));
          break;
        }
        
        const message = error instanceof Error ? error.message : String(error);
        console.log(Formatter.formatError(`Error: ${message}`));
      }
    }
  }

  private async showPerformance(options: any): Promise<void> {
    try {
      const response = await this.apiClient.get('/agents/performance');
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get agent performance');
      }

      const agents = response.data.agents || [];

      // Sort agents
      agents.sort((a: any, b: any) => {
        let aVal = a[options.sort];
        let bVal = b[options.sort];
        
        if (options.sort === 'time') {
          aVal = a.averageExecutionTime || 0;
          bVal = b.averageExecutionTime || 0;
        }
        
        if (options.reverse) {
          return aVal - bVal;
        }
        return bVal - aVal;
      });

      console.log(Formatter.formatHeader('Agent Performance'));
      console.log();

      const tableData = agents.map((agent: any) => ({
        Agent: agent.name,
        Executions: agent.executionCount,
        'Avg. Time': agent.averageExecutionTime ? 
          Formatter.formatDuration(agent.averageExecutionTime) : 'N/A',
        'Success Rate': `${((agent.successCount / agent.executionCount) * 100).toFixed(1)}%`,
        'Error Rate': `${((agent.errorCount / agent.executionCount) * 100).toFixed(1)}%`,
        'Last Used': agent.lastExecution ? 
          Formatter.formatTimestamp(agent.lastExecution) : 'Never'
      }));

      console.log(Formatter.formatTable(tableData, { 
        format: this.config.get('display.format') 
      }));

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to get agent performance: ${message}`));
    }
  }

  private async testAgent(agentId: string, options: any): Promise<void> {
    try {
      let testData = {};

      if (options.sample) {
        // Get predefined sample data
        const sampleResponse = await this.apiClient.get(`/agents/${agentId}/samples/${options.sample}`);
        if (sampleResponse.success) {
          testData = sampleResponse.data;
        } else {
          throw new Error('Sample data not found');
        }
      } else {
        // Use basic test data
        testData = { test: true, timestamp: new Date().toISOString() };
      }

      console.log(Formatter.formatInfo(`Testing agent ${agentId} with sample data`));
      console.log(Formatter.formatCode(JSON.stringify(testData, null, 2)));
      console.log();

      await this.runAgent(agentId, { 
        input: JSON.stringify(testData), 
        wait: true 
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to test agent: ${message}`));
    }
  }
}