import { Command } from 'commander';
import { bold, cyan, green, blue, red, gray, yellow } from 'kleur';
import inquirer from 'inquirer';
import { APIClient } from '../services/api-client';
import { Formatter } from '../utils/formatting';
import { SpinnerManager } from '../utils/spinner';
import { ConfigManager } from '../utils/config';
import { ToolInfo } from '../types';

export class ToolCommand {
  private apiClient: APIClient;
  private config: ConfigManager;

  constructor() {
    this.apiClient = new APIClient();
    this.config = ConfigManager.getInstance();
  }

  register(program: Command): void {
    // List tools command
    program
      .command('list')
      .alias('ls')
      .description('List all available tools')
      .option('-s, --source <source>', 'Filter by source (internal, external)')
      .option('-c, --category <category>', 'Filter by category')
      .option('-a, --available', 'Show only available tools')
      .option('-d, --detailed', 'Show detailed information')
      .action(async (options) => {
        await this.listTools(options);
      });

    // Show tool details command
    program
      .command('show <toolId>')
      .description('Show detailed tool information')
      .action(async (toolId) => {
        await this.showTool(toolId);
      });

    // Execute tool command
    program
      .command('execute <toolId>')
      .alias('exec')
      .description('Execute a tool')
      .option('-p, --params <params>', 'Tool parameters as JSON string')
      .option('-f, --file <file>', 'Parameters from file')
      .option('--interactive', 'Interactive parameter input')
      .option('-w, --wait', 'Wait for completion')
      .option('-t, --timeout <seconds>', 'Execution timeout in seconds', '120')
      .action(async (toolId, options) => {
        await this.executeTool(toolId, options);
      });

    // Tool schema command
    program
      .command('schema <toolId>')
      .description('Show tool input/output schema')
      .option('--input', 'Show only input schema')
      .option('--output', 'Show only output schema')
      .action(async (toolId, options) => {
        await this.showToolSchema(toolId, options);
      });

    // Tool usage statistics command
    program
      .command('usage')
      .description('Show tool usage statistics')
      .option('-s, --sort <field>', 'Sort by field (name, count, time)', 'count')
      .option('-r, --reverse', 'Reverse sort order')
      .option('-n, --top <number>', 'Show top N tools', '10')
      .action(async (options) => {
        await this.showUsageStats(options);
      });

    // Search tools command
    program
      .command('search <query>')
      .description('Search tools by name or description')
      .option('-i, --ignore-case', 'Case-insensitive search')
      .option('-e, --exact', 'Exact match only')
      .action(async (query, options) => {
        await this.searchTools(query, options);
      });

    // Test tool command
    program
      .command('test <toolId>')
      .description('Test tool with sample data')
      .option('--sample <type>', 'Use predefined sample data')
      .option('--validate', 'Validate tool configuration only')
      .action(async (toolId, options) => {
        await this.testTool(toolId, options);
      });

    // Tool history command
    program
      .command('history <toolId>')
      .description('Show tool execution history')
      .option('-n, --limit <number>', 'Number of executions to show', '10')
      .option('-f, --filter <status>', 'Filter by execution status')
      .action(async (toolId, options) => {
        await this.showToolHistory(toolId, options);
      });

    // Interactive tool runner
    program
      .command('interactive <toolId>')
      .alias('i')
      .description('Interactive tool execution mode')
      .action(async (toolId) => {
        await this.interactiveMode(toolId);
      });

    // Tool performance command
    program
      .command('performance')
      .description('Show tool performance metrics')
      .option('-s, --sort <field>', 'Sort by field (executions, time, errors)', 'executions')
      .option('-r, --reverse', 'Reverse sort order')
      .action(async (options) => {
        await this.showPerformance(options);
      });

    // Tool categories command
    program
      .command('categories')
      .description('List tool categories')
      .action(async () => {
        await this.listCategories();
      });

    // Install external tool command
    program
      .command('install <serverUrl>')
      .description('Install tools from external MCP server')
      .option('-n, --name <name>', 'Custom name for the server')
      .option('--auto-connect', 'Enable auto-connect')
      .action(async (serverUrl, options) => {
        await this.installExternalTools(serverUrl, options);
      });

    // Uninstall external tools command
    program
      .command('uninstall <serverId>')
      .description('Uninstall tools from external server')
      .action(async (serverId) => {
        await this.uninstallExternalTools(serverId);
      });
  }

  private async listTools(options: any): Promise<void> {
    try {
      const response = await this.apiClient.getTools();
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get tools');
      }

      let tools: ToolInfo[] = response.data.tools || [];

      // Apply filters
      if (options.source) {
        tools = tools.filter(tool => tool.source === options.source);
      }

      if (options.category) {
        tools = tools.filter(tool => tool.category === options.category);
      }

      if (options.available) {
        tools = tools.filter(tool => tool.available);
      }

      console.log(Formatter.formatHeader(`Tools (${tools.length})`));
      console.log();

      if (tools.length === 0) {
        console.log(Formatter.formatInfo('No tools found matching criteria'));
        return;
      }

      if (options.detailed) {
        // Detailed view
        tools.forEach((tool, index) => {
          if (index > 0) console.log();
          
          console.log(`${bold(tool.name)} (${tool.id})`);
          console.log(`  Category: ${cyan(tool.category)}`);
          console.log(`  Source: ${tool.source === 'internal' ? green('internal') : blue('external')}`);
          console.log(`  Available: ${tool.available ? green('✓') : red('✗')}`);
          console.log(`  Description: ${gray(tool.description)}`);
          
          if (tool.serverId) {
            console.log(`  Server: ${tool.serverId}`);
          }
          
          console.log(`  Usage Count: ${tool.usage.count}`);
          
          if (tool.usage.lastUsed) {
            console.log(`  Last Used: ${Formatter.formatTimestamp(tool.usage.lastUsed)}`);
          }
          
          if (tool.usage.averageExecutionTime) {
            console.log(`  Avg. Time: ${Formatter.formatDuration(tool.usage.averageExecutionTime)}`);
          }
        });
      } else {
        // Table view
        const tableData = tools.map(tool => ({
          ID: tool.id,
          Name: tool.name,
          Category: tool.category,
          Source: tool.source === 'internal' ? 
            green('internal') : 
            blue('external'),
          Available: tool.available ? green('✓') : red('✗'),
          Usage: tool.usage.count,
          'Last Used': tool.usage.lastUsed ? 
            Formatter.formatTimestamp(tool.usage.lastUsed) : 
            'Never',
          'Avg. Time': tool.usage.averageExecutionTime ? 
            Formatter.formatDuration(tool.usage.averageExecutionTime) : 
            'N/A'
        }));

        console.log(Formatter.formatTable(tableData, { 
          format: this.config.get('display.format') 
        }));
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to list tools: ${message}`));
    }
  }

  private async showTool(toolId: string): Promise<void> {
    try {
      const response = await this.apiClient.getTool(toolId);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get tool information');
      }

      const tool: ToolInfo = response.data;

      console.log(Formatter.formatHeader(`Tool: ${tool.name}`));
      console.log();
      
      console.log(`${bold('ID:')} ${tool.id}`);
      console.log(`${bold('Name:')} ${tool.name}`);
      console.log(`${bold('Category:')} ${cyan(tool.category)}`);
      console.log(`${bold('Source:')} ${tool.source === 'internal' ? green('internal') : blue('external')}`);
      console.log(`${bold('Available:')} ${tool.available ? green('✓ Yes') : red('✗ No')}`);
      console.log(`${bold('Description:')} ${tool.description}`);
      
      if (tool.serverId) {
        console.log(`${bold('Server ID:')} ${tool.serverId}`);
      }
      
      console.log();
      console.log(bold('Usage Statistics:'));
      console.log(`  Total Executions: ${tool.usage.count}`);
      
      if (tool.usage.lastUsed) {
        console.log(`  Last Used: ${Formatter.formatTimestamp(tool.usage.lastUsed)}`);
      }
      
      if (tool.usage.averageExecutionTime) {
        console.log(`  Average Execution Time: ${Formatter.formatDuration(tool.usage.averageExecutionTime)}`);
      }

      // Show schema preview
      try {
        const schemaResponse = await this.apiClient.getToolSchema(toolId);
        if (schemaResponse.success) {
          console.log();
          console.log(bold('Schema Preview:'));
          
          const schema = schemaResponse.data;
          if (schema.input) {
            console.log(`  Input: ${this.getSchemaPreview(schema.input)}`);
          }
          if (schema.output) {
            console.log(`  Output: ${this.getSchemaPreview(schema.output)}`);
          }
        }
      } catch {
        // Schema might not be available
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to get tool information: ${message}`));
    }
  }

  private async executeTool(toolId: string, options: any): Promise<void> {
    const spinnerId = 'tool-execution';
    
    try {
      // Get parameters
      let params: any = {};
      
      if (options.interactive) {
        params = await this.getInteractiveParams(toolId);
      } else if (options.file) {
        const fs = require('fs-extra');
        const fileContent = await fs.readFile(options.file, 'utf-8');
        params = JSON.parse(fileContent);
      } else if (options.params) {
        params = JSON.parse(options.params);
      } else {
        console.log(Formatter.formatInfo('No parameters provided, using empty parameters'));
      }

      SpinnerManager.start(spinnerId, `Executing tool ${toolId}...`);

      // Execute tool
      const response = await this.apiClient.executeTool(toolId, params);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to execute tool');
      }

      const execution = response.data;

      if (options.wait && execution.async) {
        SpinnerManager.update(spinnerId, 'Waiting for tool execution to complete...');
        
        const timeout = parseInt(options.timeout) * 1000;
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
          const statusResponse = await this.apiClient.get(`/tools/${toolId}/executions/${execution.id}`);
          
          if (statusResponse.success) {
            const executionStatus = statusResponse.data;
            
            if (executionStatus.status === 'completed') {
              SpinnerManager.succeed(spinnerId, 'Tool execution completed successfully');
              
              console.log();
              console.log(Formatter.formatHeader('Execution Results'));
              console.log();
              
              this.displayResult(executionStatus.result);
              
              console.log();
              console.log(`Execution Time: ${Formatter.formatDuration(executionStatus.duration)}`);
              return;
              
            } else if (executionStatus.status === 'failed') {
              throw new Error(executionStatus.error || 'Tool execution failed');
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        throw new Error('Tool execution timeout');
        
      } else {
        SpinnerManager.succeed(spinnerId, 'Tool executed successfully');
        
        console.log();
        console.log(Formatter.formatHeader('Execution Results'));
        console.log();
        
        this.displayResult(execution.result);
        
        if (execution.duration) {
          console.log();
          console.log(`Execution Time: ${Formatter.formatDuration(execution.duration)}`);
        }
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      SpinnerManager.fail(spinnerId, `Tool execution failed: ${message}`);
    }
  }

  private async showToolSchema(toolId: string, options: any): Promise<void> {
    try {
      const response = await this.apiClient.getToolSchema(toolId);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get tool schema');
      }

      const schema = response.data;

      console.log(Formatter.formatHeader(`Tool Schema: ${toolId}`));
      console.log();

      const format = this.config.get<string>('display.format');
      
      if (format === 'json') {
        console.log(JSON.stringify(schema, null, 2));
      } else if (format === 'yaml') {
        const yaml = require('yaml');
        console.log(yaml.stringify(schema, { indent: 2 }));
      } else {
        if (!options.output && schema.input) {
          console.log(bold('Input Schema:'));
          this.displaySchemaStructured(schema.input, '  ');
          console.log();
        }

        if (!options.input && schema.output) {
          console.log(bold('Output Schema:'));
          this.displaySchemaStructured(schema.output, '  ');
        }
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to get tool schema: ${message}`));
    }
  }

  private async showUsageStats(options: any): Promise<void> {
    try {
      const response = await this.apiClient.get('/tools/usage');
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get tool usage statistics');
      }

      let tools = response.data.tools || [];

      // Sort tools
      tools.sort((a: any, b: any) => {
        let aVal = a[options.sort];
        let bVal = b[options.sort];
        
        if (options.sort === 'time') {
          aVal = a.averageExecutionTime || 0;
          bVal = b.averageExecutionTime || 0;
        } else if (options.sort === 'count') {
          aVal = a.usageCount || 0;
          bVal = b.usageCount || 0;
        }
        
        if (options.reverse) {
          return aVal - bVal;
        }
        return bVal - aVal;
      });

      // Take top N
      tools = tools.slice(0, parseInt(options.top));

      console.log(Formatter.formatHeader(`Top ${options.top} Tools by ${options.sort.toUpperCase()}`));
      console.log();

      const tableData = tools.map((tool: any, index: number) => ({
        '#': index + 1,
        Name: tool.name,
        Category: tool.category,
        'Usage Count': tool.usageCount || 0,
        'Avg. Time': tool.averageExecutionTime ? 
          Formatter.formatDuration(tool.averageExecutionTime) : 'N/A',
        'Success Rate': tool.usageCount > 0 ? 
          `${((tool.successCount / tool.usageCount) * 100).toFixed(1)}%` : 'N/A',
        'Last Used': tool.lastUsed ? 
          Formatter.formatTimestamp(tool.lastUsed) : 'Never'
      }));

      console.log(Formatter.formatTable(tableData, { 
        format: this.config.get('display.format') 
      }));

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to get tool usage statistics: ${message}`));
    }
  }

  private async searchTools(query: string, options: any): Promise<void> {
    try {
      const response = await this.apiClient.getTools();
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get tools');
      }

      let tools: ToolInfo[] = response.data.tools || [];

      // Create search regex
      const flags = options.ignoreCase ? 'i' : '';
      const searchPattern = options.exact ? `^${query}$` : query;
      const regex = new RegExp(searchPattern, flags);

      // Filter tools
      const matchedTools = tools.filter(tool => 
        regex.test(tool.name) || regex.test(tool.description) || regex.test(tool.category)
      );

      console.log(Formatter.formatHeader(`Search Results for "${query}"`));
      console.log();

      if (matchedTools.length === 0) {
        console.log(Formatter.formatInfo('No matching tools found'));
        return;
      }

      const tableData = matchedTools.map(tool => ({
        ID: tool.id,
        Name: tool.name,
        Category: tool.category,
        Source: tool.source === 'internal' ? 
          green('internal') : 
          blue('external'),
        Available: tool.available ? green('✓') : red('✗'),
        Description: tool.description.length > 50 ? 
          tool.description.substring(0, 47) + '...' : 
          tool.description
      }));

      console.log(Formatter.formatTable(tableData, { 
        format: this.config.get('display.format') 
      }));

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to search tools: ${message}`));
    }
  }

  private async testTool(toolId: string, options: any): Promise<void> {
    try {
      if (options.validate) {
        // Just validate tool configuration
        const spinnerId = 'tool-validation';
        SpinnerManager.start(spinnerId, `Validating tool ${toolId}...`);
        
        const response = await this.apiClient.get(`/tools/${toolId}/validate`);
        
        if (!response.success) {
          throw new Error(response.error || 'Tool validation failed');
        }
        
        const validation = response.data;
        
        if (validation.valid) {
          SpinnerManager.succeed(spinnerId, 'Tool validation passed');
        } else {
          SpinnerManager.fail(spinnerId, `Tool validation failed: ${validation.errors.join(', ')}`);
        }
        
        return;
      }

      let testData = {};

      if (options.sample) {
        // Get predefined sample data
        const sampleResponse = await this.apiClient.get(`/tools/${toolId}/samples/${options.sample}`);
        if (sampleResponse.success) {
          testData = sampleResponse.data;
        } else {
          throw new Error('Sample data not found');
        }
      } else {
        // Use basic test data
        testData = { test: true, timestamp: new Date().toISOString() };
      }

      console.log(Formatter.formatInfo(`Testing tool ${toolId} with sample data`));
      console.log(Formatter.formatCode(JSON.stringify(testData, null, 2)));
      console.log();

      await this.executeTool(toolId, { 
        params: JSON.stringify(testData), 
        wait: true 
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to test tool: ${message}`));
    }
  }

  private async showToolHistory(toolId: string, options: any): Promise<void> {
    try {
      const params = new URLSearchParams();
      if (options.limit) params.append('limit', options.limit);
      if (options.filter) params.append('status', options.filter);
      
      const response = await this.apiClient.get(`/tools/${toolId}/history?${params.toString()}`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get tool history');
      }

      const executions = response.data.executions || [];

      console.log(Formatter.formatHeader(`Tool History: ${toolId}`));
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
        'Params Size': exec.paramsSize ? `${exec.paramsSize} chars` : 'N/A',
        'Result Size': exec.resultSize ? `${exec.resultSize} chars` : 'N/A'
      }));

      console.log(Formatter.formatTable(tableData, { 
        format: this.config.get('display.format') 
      }));

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to get tool history: ${message}`));
    }
  }

  private async interactiveMode(toolId: string): Promise<void> {
    console.log(Formatter.formatHeader(`Interactive Mode: ${toolId}`));
    console.log(Formatter.formatInfo('Type "exit" to quit, "help" for commands'));
    console.log();

    while (true) {
      try {
        const answers = await inquirer.prompt([
          {
            name: 'command',
            message: cyan('tool>'),
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
          console.log('  exec [params]  - Execute tool with parameters');
          console.log('  schema         - Show tool schema');
          console.log('  history        - Show execution history');
          console.log('  test           - Test with sample data');
          console.log('  help           - Show this help');
          console.log('  exit           - Exit interactive mode');
          continue;
        }

        if (command.startsWith('exec')) {
          const paramsPart = answers.command.substring(4).trim();
          let params = {};
          
          if (paramsPart) {
            try {
              params = JSON.parse(paramsPart);
            } catch {
              console.log(Formatter.formatError('Invalid JSON parameters'));
              continue;
            }
          } else {
            params = await this.getInteractiveParams(toolId);
          }

          await this.executeTool(toolId, { params: JSON.stringify(params), wait: true });
          continue;
        }

        if (command === 'schema') {
          await this.showToolSchema(toolId, {});
          continue;
        }

        if (command === 'history') {
          await this.showToolHistory(toolId, { limit: 5 });
          continue;
        }

        if (command === 'test') {
          await this.testTool(toolId, {});
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
      const response = await this.apiClient.get('/tools/performance');
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get tool performance');
      }

      const tools = response.data.tools || [];

      // Sort tools
      tools.sort((a: any, b: any) => {
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

      console.log(Formatter.formatHeader('Tool Performance'));
      console.log();

      const tableData = tools.map((tool: any) => ({
        Tool: tool.name,
        Category: tool.category,
        Executions: tool.executionCount,
        'Avg. Time': tool.averageExecutionTime ? 
          Formatter.formatDuration(tool.averageExecutionTime) : 'N/A',
        'Success Rate': `${((tool.successCount / tool.executionCount) * 100).toFixed(1)}%`,
        'Error Rate': `${((tool.errorCount / tool.executionCount) * 100).toFixed(1)}%`,
        'Last Used': tool.lastExecution ? 
          Formatter.formatTimestamp(tool.lastExecution) : 'Never'
      }));

      console.log(Formatter.formatTable(tableData, { 
        format: this.config.get('display.format') 
      }));

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to get tool performance: ${message}`));
    }
  }

  private async listCategories(): Promise<void> {
    try {
      const response = await this.apiClient.get('/tools/categories');
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get tool categories');
      }

      const categories = response.data.categories || [];

      console.log(Formatter.formatHeader(`Tool Categories (${categories.length})`));
      console.log();

      const tableData = categories.map((category: any) => ({
        Name: category.name,
        Description: category.description,
        'Tool Count': category.toolCount,
        'Usage Count': category.usageCount
      }));

      console.log(Formatter.formatTable(tableData, { 
        format: this.config.get('display.format') 
      }));

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to list tool categories: ${message}`));
    }
  }

  private async installExternalTools(serverUrl: string, options: any): Promise<void> {
    const spinnerId = 'install-tools';
    
    try {
      SpinnerManager.start(spinnerId, `Installing tools from ${serverUrl}...`);

      const installConfig = {
        url: serverUrl,
        name: options.name,
        autoConnect: options.autoConnect
      };

      const response = await this.apiClient.post('/tools/install', installConfig);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to install external tools');
      }

      const installation = response.data;
      SpinnerManager.succeed(spinnerId, `Installed ${installation.toolCount} tools from ${installation.serverName}`);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      SpinnerManager.fail(spinnerId, `Failed to install external tools: ${message}`);
    }
  }

  private async uninstallExternalTools(serverId: string): Promise<void> {
    const spinnerId = 'uninstall-tools';
    
    try {
      SpinnerManager.start(spinnerId, `Uninstalling tools from server ${serverId}...`);

      const response = await this.apiClient.delete(`/tools/external/${serverId}`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to uninstall external tools');
      }

      const uninstallation = response.data;
      SpinnerManager.succeed(spinnerId, `Uninstalled ${uninstallation.toolCount} tools from ${uninstallation.serverName}`);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      SpinnerManager.fail(spinnerId, `Failed to uninstall external tools: ${message}`);
    }
  }

  private async getInteractiveParams(toolId: string): Promise<any> {
    try {
      // Get tool schema
      const schemaResponse = await this.apiClient.getToolSchema(toolId);
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
          message: 'Enter tool parameters (JSON format):',
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

    } catch (error) {
      console.log(Formatter.formatWarning('Could not get tool schema, using basic input'));
      
      const answers = await inquirer.prompt([
        {
          name: 'data',
          message: 'Enter tool parameters (JSON format):',
          type: 'input',
          default: '{}'
        }
      ]);

      return JSON.parse(answers.data);
    }
  }

  private displayResult(result: any): void {
    const format = this.config.get<string>('display.format');
    
    if (format === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else if (format === 'yaml') {
      const yaml = require('yaml');
      console.log(yaml.stringify(result, { indent: 2 }));
    } else {
      if (typeof result === 'string') {
        console.log(result);
      } else if (typeof result === 'object') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(String(result));
      }
    }
  }

  private getSchemaPreview(schema: any): string {
    if (schema.type) {
      return schema.type;
    }
    if (schema.properties) {
      const keys = Object.keys(schema.properties);
      return `object with ${keys.length} properties (${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''})`;
    }
    return 'unknown';
  }

  private displaySchemaStructured(schema: any, indent: string = ''): void {
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
        this.displaySchemaStructured(prop, indent + '    ');
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
}