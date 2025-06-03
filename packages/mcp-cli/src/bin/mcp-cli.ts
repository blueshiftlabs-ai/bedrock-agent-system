#!/usr/bin/env node

import { Command } from 'commander';
import { yellow, bold, cyan, dim } from 'kleur';
import boxen from 'boxen';
import { ConfigManager } from '../utils/config';
import { Formatter } from '../utils/formatting';
import { SpinnerManager } from '../utils/spinner';

// Import command modules
import { ServerCommand } from '../commands/server';
import { ProcessCommand } from '../commands/process';
import { AgentCommand } from '../commands/agent';
import { WorkflowCommand } from '../commands/workflow';
import { ToolCommand } from '../commands/tool';
import { ConfigCommand } from '../commands/config';
import { MonitorCommand } from '../commands/monitor';
import { LogCommand } from '../commands/log';

const packageInfo = require('../../package.json');

class MCPCli {
  private program: Command;
  private config: ConfigManager;

  constructor() {
    this.config = ConfigManager.getInstance();
    this.program = new Command();
    this.setupGlobalOptions();
    this.setupCommands();
    this.setupErrorHandling();
  }

  private setupGlobalOptions(): void {
    this.program
      .name('mcp-cli')
      .description('Comprehensive CLI tool for managing MCP hybrid server and all its components')
      .version(packageInfo.version)
      .option('-v, --verbose', 'Enable verbose output')
      .option('--no-color', 'Disable colored output')
      .option('--format <format>', 'Output format (table, json, yaml)', 'table')
      .option('--config <path>', 'Custom config file path')
      .option('--url <url>', 'Server URL override')
      .option('--timeout <ms>', 'Request timeout in milliseconds', '30000')
      .hook('preAction', (thisCommand) => {
        this.handleGlobalOptions(thisCommand);
      });
  }

  private handleGlobalOptions(command: Command): void {
    const opts = command.opts();
    
    // Handle no-color option
    if (opts.noColor) {
      process.env.NO_COLOR = '1';
      this.config.set('display.colors', false);
    }
    
    // Handle verbose option
    if (opts.verbose) {
      this.config.set('display.verbose', true);
    }
    
    // Handle format option
    if (opts.format) {
      this.config.set('display.format', opts.format);
    }
    
    // Handle URL override
    if (opts.url) {
      this.config.set('server.url', opts.url);
    }
    
    // Handle timeout override
    if (opts.timeout) {
      this.config.set('server.timeout', parseInt(opts.timeout, 10));
    }
    
    // Apply environment overrides
    this.config.applyEnvironmentOverrides();
    
    // Initialize directories
    this.config.initDirectories();
  }

  private setupCommands(): void {
    // Server management commands
    const serverCmd = this.program
      .command('server')
      .description('Server management commands');
    new ServerCommand().register(serverCmd);

    // Process management commands
    const processCmd = this.program
      .command('process')
      .alias('proc')
      .description('Process management commands');
    new ProcessCommand().register(processCmd);

    // Agent management commands
    const agentCmd = this.program
      .command('agent')
      .alias('agents')
      .description('Agent management commands');
    new AgentCommand().register(agentCmd);

    // Workflow management commands
    const workflowCmd = this.program
      .command('workflow')
      .alias('workflows')
      .description('Workflow management commands');
    new WorkflowCommand().register(workflowCmd);

    // Tool management commands
    const toolCmd = this.program
      .command('tool')
      .alias('tools')
      .description('Tool management commands');
    new ToolCommand().register(toolCmd);

    // Configuration management commands
    const configCmd = this.program
      .command('config')
      .description('Configuration management commands');
    new ConfigCommand().register(configCmd);

    // Monitoring commands
    const monitorCmd = this.program
      .command('monitor')
      .alias('mon')
      .description('System monitoring commands');
    new MonitorCommand().register(monitorCmd);

    // Log management commands
    const logCmd = this.program
      .command('log')
      .alias('logs')
      .description('Log viewing and filtering commands');
    new LogCommand().register(logCmd);

    // Quick status command
    this.program
      .command('status')
      .description('Quick status overview')
      .option('-w, --watch', 'Watch for status changes')
      .option('-r, --refresh <seconds>', 'Auto-refresh interval in seconds', '5')
      .action(async (options) => {
        const monitorCommand = new MonitorCommand();
        await monitorCommand.status({ 
          watch: options.watch, 
          refreshInterval: parseInt(options.refresh) * 1000 
        });
      });

    // Health check command
    this.program
      .command('health')
      .description('Perform health check')
      .option('-d, --detailed', 'Show detailed health information')
      .action(async (options) => {
        const monitorCommand = new MonitorCommand();
        await monitorCommand.health({ detailed: options.detailed });
      });

    // Version command with enhanced info
    this.program
      .command('version')
      .description('Show version information')
      .option('-a, --all', 'Show all version information')
      .action(async (options) => {
        await this.showVersion(options.all);
      });

    // Help command with enhanced formatting
    this.program
      .command('help [command]')
      .description('Display help for command')
      .action((command) => {
        if (command) {
          this.program.help();
        } else {
          this.showHelp();
        }
      });
  }

  private setupErrorHandling(): void {
    // Handle unknown commands
    this.program.on('command:*', () => {
      console.error(Formatter.formatError(`Unknown command: ${this.program.args.join(' ')}`));
      console.log(Formatter.formatInfo('Run "mcp-cli help" for available commands'));
      process.exit(1);
    });

    // Global error handler
    process.on('uncaughtException', (error) => {
      SpinnerManager.stopAll();
      console.error(Formatter.formatError('Uncaught exception:'));
      console.error(error.stack || error.message);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      SpinnerManager.stopAll();
      console.error(Formatter.formatError('Unhandled promise rejection:'));
      console.error(reason instanceof Error ? reason.stack || reason.message : String(reason));
      process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      SpinnerManager.stopAll();
      console.log(yellow('\n👋 Goodbye!'));
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      SpinnerManager.stopAll();
      process.exit(0);
    });
  }

  private async showVersion(showAll: boolean = false): Promise<void> {
    const versionInfo = {
      'MCP CLI': packageInfo.version,
      'Node.js': process.version,
      'Platform': `${process.platform} ${process.arch}`
    };

    if (showAll) {
      try {
        const configInfo = this.config.getConfigInfo();
        Object.assign(versionInfo, {
          'Config Path': configInfo.configPath,
          'Cache Path': configInfo.cachePath,
          'Logs Path': configInfo.logsPath
        });
      } catch (error) {
        // Config might not be available
      }
    }

    const content = Object.entries(versionInfo)
      .map(([key, value]) => `${bold(key)}: ${cyan(value)}`)
      .join('\n');

    console.log(boxen(content, {
      title: '📦 Version Information',
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan'
    }));
  }

  private showHelp(): void {
    const helpContent = `
${cyan(bold('MCP CLI'))} - Comprehensive management tool for MCP Hybrid Server

${bold('USAGE:')}
  mcp-cli [command] [options]

${bold('COMMANDS:')}
  ${cyan('server')}      Server management (start, stop, status, logs)
  ${cyan('process')}     Process management (list, kill, monitor)
  ${cyan('agent')}       Agent management (list, run, status)
  ${cyan('workflow')}    Workflow management (list, start, stop, status)
  ${cyan('tool')}        Tool management (list, execute, schema)
  ${cyan('config')}      Configuration management (get, set, export, import)
  ${cyan('monitor')}     System monitoring (status, metrics, alerts)
  ${cyan('log')}         Log viewing and filtering
  ${cyan('status')}      Quick status overview
  ${cyan('health')}      Health check
  ${cyan('version')}     Version information
  ${cyan('help')}        Show help

${bold('GLOBAL OPTIONS:')}
  -v, --verbose           Enable verbose output
  --no-color             Disable colored output
  --format <format>      Output format (table, json, yaml)
  --config <path>        Custom config file path
  --url <url>            Server URL override
  --timeout <ms>         Request timeout in milliseconds

${bold('EXAMPLES:')}
  mcp-cli server start                 Start the MCP server
  mcp-cli agent list --format json     List agents in JSON format
  mcp-cli monitor status --watch       Watch system status
  mcp-cli tool execute code-analysis --params '{"file": "src/app.ts"}'
  mcp-cli log tail -f -n 100          Follow last 100 log lines

${bold('ENVIRONMENT VARIABLES:')}
  MCP_CLI_SERVER_URL        Override server URL
  MCP_CLI_VERBOSE          Enable verbose mode
  MCP_CLI_NO_COLOR         Disable colors
  MCP_CLI_FORMAT           Default output format
  MCP_CLI_CONFIG_DIR       Config directory path

For more information about a specific command, run:
  mcp-cli [command] --help
`;

    console.log(boxen(helpContent, {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'blue'
    }));
  }

  public async run(): Promise<void> {
    try {
      await this.program.parseAsync(process.argv);
    } catch (error) {
      SpinnerManager.stopAll();
      
      if (error instanceof Error) {
        console.error(Formatter.formatError(error.message));
        
        if (this.config.get<boolean>('display.verbose')) {
          console.error(dim(error.stack || ''));
        }
      } else {
        console.error(Formatter.formatError(String(error)));
      }
      
      process.exit(1);
    }
  }
}

// Run the CLI
const cli = new MCPCli();
cli.run().catch((error) => {
  console.error(Formatter.formatError('Fatal error:'), error);
  process.exit(1);
});

export { MCPCli };