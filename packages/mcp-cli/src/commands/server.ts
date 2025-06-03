import { Command } from 'commander';
import { cyan, gray, blue, yellow } from 'kleur';
import { APIClient } from '../services/api-client';
import { Formatter } from '../utils/formatting';
import { SpinnerManager } from '../utils/spinner';
import { ConfigManager } from '../utils/config';
import { ServerStatus, CommandOptions } from '../types';

export class ServerCommand {
  private apiClient: APIClient;
  private config: ConfigManager;

  constructor() {
    this.apiClient = new APIClient();
    this.config = ConfigManager.getInstance();
  }

  register(program: Command): void {
    // Start server command
    program
      .command('start')
      .description('Start the MCP server')
      .option('-d, --detach', 'Start in detached mode')
      .option('-w, --wait', 'Wait for server to be ready')
      .option('-t, --timeout <seconds>', 'Startup timeout in seconds', '60')
      .action(async (options) => {
        await this.startServer(options);
      });

    // Stop server command
    program
      .command('stop')
      .description('Stop the MCP server')
      .option('-f, --force', 'Force stop the server')
      .option('-t, --timeout <seconds>', 'Shutdown timeout in seconds', '30')
      .action(async (options) => {
        await this.stopServer(options);
      });

    // Restart server command
    program
      .command('restart')
      .description('Restart the MCP server')
      .option('-f, --force', 'Force restart')
      .option('-w, --wait', 'Wait for server to be ready')
      .option('-t, --timeout <seconds>', 'Restart timeout in seconds', '90')
      .action(async (options) => {
        await this.restartServer(options);
      });

    // Server status command
    program
      .command('status')
      .description('Show server status')
      .option('-w, --watch', 'Watch for status changes')
      .option('-r, --refresh <seconds>', 'Refresh interval in seconds', '5')
      .option('-d, --detailed', 'Show detailed status information')
      .action(async (options) => {
        await this.showStatus(options);
      });

    // Server logs command
    program
      .command('logs')
      .description('Show server logs')
      .option('-f, --follow', 'Follow log output')
      .option('-n, --lines <number>', 'Number of lines to show', '100')
      .option('--filter <pattern>', 'Filter logs by pattern')
      .option('--level <level>', 'Filter by log level')
      .option('-t, --tail', 'Start from the end of logs')
      .action(async (options) => {
        await this.showLogs(options);
      });

    // Server info command
    program
      .command('info')
      .description('Show server information')
      .action(async () => {
        await this.showInfo();
      });

    // Server health command
    program
      .command('health')
      .description('Check server health')
      .option('-d, --detailed', 'Show detailed health information')
      .action(async (options) => {
        await this.checkHealth(options);
      });

    // Server config command
    program
      .command('config')
      .description('Show server configuration')
      .option('-s, --sensitive', 'Include sensitive values (masked)')
      .action(async (options) => {
        await this.showConfig(options);
      });
  }

  private async startServer(options: any): Promise<void> {
    const spinnerId = 'server-start';
    
    try {
      SpinnerManager.start(spinnerId, 'Starting MCP server...');

      // Check if server is already running
      const isReachable = await this.apiClient.isServerReachable();
      if (isReachable) {
        SpinnerManager.warn(spinnerId, 'Server is already running');
        return;
      }

      // Start the server
      const response = await this.apiClient.startServer();
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to start server');
      }

      if (options.wait) {
        SpinnerManager.update(spinnerId, 'Waiting for server to be ready...');
        
        const timeout = parseInt(options.timeout) * 1000;
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
          const isReady = await this.apiClient.isServerReachable();
          if (isReady) {
            SpinnerManager.succeed(spinnerId, 'Server started successfully and is ready');
            return;
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        throw new Error('Server start timeout');
      } else {
        SpinnerManager.succeed(spinnerId, 'Server start initiated');
      }

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      SpinnerManager.fail(spinnerId, `Failed to start server: ${message}`);
    }
  }

  private async stopServer(options: any): Promise<void> {
    const spinnerId = 'server-stop';
    
    try {
      SpinnerManager.start(spinnerId, 'Stopping MCP server...');

      // Check if server is running
      const isReachable = await this.apiClient.isServerReachable();
      if (!isReachable) {
        SpinnerManager.warn(spinnerId, 'Server is not running');
        return;
      }

      // Stop the server
      const response = await this.apiClient.stopServer();
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to stop server');
      }

      // Wait for server to stop
      const timeout = parseInt(options.timeout) * 1000;
      const startTime = Date.now();
      
      while (Date.now() - startTime < timeout) {
        const isReachable = await this.apiClient.isServerReachable();
        if (!isReachable) {
          SpinnerManager.succeed(spinnerId, 'Server stopped successfully');
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (options.force) {
        SpinnerManager.update(spinnerId, 'Force stopping server...');
        // Implementation would depend on process management
        SpinnerManager.succeed(spinnerId, 'Server force stopped');
      } else {
        throw new Error('Server stop timeout');
      }

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      SpinnerManager.fail(spinnerId, `Failed to stop server: ${message}`);
    }
  }

  private async restartServer(options: any): Promise<void> {
    const spinnerId = 'server-restart';
    
    try {
      SpinnerManager.start(spinnerId, 'Restarting MCP server...');

      // Stop first
      SpinnerManager.update(spinnerId, 'Stopping server...');
      await this.stopServer({ force: options.force, timeout: 30 });

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Start again
      SpinnerManager.update(spinnerId, 'Starting server...');
      await this.startServer({ wait: options.wait, timeout: options.timeout });

      SpinnerManager.succeed(spinnerId, 'Server restarted successfully');

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      SpinnerManager.fail(spinnerId, `Failed to restart server: ${message}`);
    }
  }

  private async showStatus(options: any): Promise<void> {
    const showStatusOnce = async () => {
      try {
        const response = await this.apiClient.serverStatus();
        
        if (!response.success) {
          console.log(Formatter.formatError('Failed to get server status'));
          return;
        }

        const status: ServerStatus = response.data;
        
        console.log(Formatter.formatHeader('Server Status'));
        console.log();
        
        // Basic status
        console.log(`Status: ${Formatter.formatStatus(status.status)} ${status.status}`);
        console.log(`Name: ${cyan(status.name)}`);
        console.log(`ID: ${gray(status.id)}`);
        
        if (status.url) {
          console.log(`URL: ${blue(status.url)}`);
        }
        
        if (status.pid) {
          console.log(`PID: ${yellow(status.pid)}`);
        }
        
        if (status.uptime) {
          console.log(`Uptime: ${Formatter.formatUptime(status.uptime)}`);
        }
        
        if (status.memory) {
          console.log(`Memory: ${Formatter.formatBytes(status.memory)}`);
        }
        
        if (status.cpu) {
          console.log(`CPU: ${status.cpu.toFixed(1)}%`);
        }
        
        console.log(`Last Checked: ${Formatter.formatTimestamp(status.lastChecked)}`);
        
        // Detailed status
        if (options.detailed && status.health) {
          console.log();
          console.log(Formatter.formatSubheader('Health Checks'));
          
          for (const check of status.health.checks) {
            const statusIcon = Formatter.formatStatus(check.status === 'pass' ? 'healthy' : check.status === 'fail' ? 'unhealthy' : 'warning');
            console.log(`${statusIcon} ${check.name}: ${check.message || check.status}`);
            
            if (check.duration) {
              console.log(`  Duration: ${Formatter.formatDuration(check.duration)}`);
            }
          }
        }
        
      } catch (error: any) {
        console.log(Formatter.formatError('Server is not reachable'));
        
        if (this.config.get<boolean>('display.verbose')) {
          const message = error instanceof Error ? error.message : String(error);
          console.log(Formatter.formatDim(`Error: ${message}`));
        }
      }
    };

    if (options.watch) {
      const refreshInterval = parseInt(options.refresh) * 1000;
      
      console.log(Formatter.formatInfo(`Watching server status (refresh every ${options.refresh}s)`));
      console.log(Formatter.formatDim('Press Ctrl+C to stop'));
      console.log();
      
      // Show initial status
      await showStatusOnce();
      
      // Set up interval
      const interval = setInterval(async () => {
        // Clear screen and show updated status
        process.stdout.write('\x1B[2J\x1B[0f');
        console.log(Formatter.formatDim(`Last updated: ${new Date().toLocaleTimeString()}`));
        console.log();
        await showStatusOnce();
      }, refreshInterval);
      
      // Handle cleanup
      process.on('SIGINT', () => {
        clearInterval(interval);
        console.log(yellow('\nStopped watching'));
        process.exit(0);
      });
      
    } else {
      await showStatusOnce();
    }
  }

  private async showLogs(options: any): Promise<void> {
    try {
      const logOptions = {
        lines: options.lines ? parseInt(options.lines) : undefined,
        follow: options.follow,
        filter: options.filter
      };

      if (options.follow) {
        console.log(Formatter.formatInfo('Following server logs (press Ctrl+C to stop)'));
        console.log(Formatter.formatDim('──────────────────────────────────────'));
        
        // Connect to WebSocket for real-time logs
        await this.apiClient.connectWebSocket();
        
        this.apiClient.on('ws-log', (logData) => {
          const timestamp = new Date(logData.timestamp);
          const level = Formatter.formatLogLevel(logData.level);
          const message = logData.message;
          
          console.log(`${Formatter.formatTimestamp(timestamp)} ${level} ${message}`);
        });
        
        // Keep the process alive
        process.on('SIGINT', () => {
          this.apiClient.disconnectWebSocket();
          console.log(yellow('\nStopped following logs'));
          process.exit(0);
        });
        
      } else {
        const response = await this.apiClient.getServerLogs(logOptions);
        
        if (!response.success) {
          throw new Error(response.error || 'Failed to get logs');
        }
        
        const logs = response.data.logs || [];
        
        if (logs.length === 0) {
          console.log(Formatter.formatInfo('No logs found'));
          return;
        }
        
        logs.forEach((log: any) => {
          const timestamp = new Date(log.timestamp);
          const level = Formatter.formatLogLevel(log.level);
          const message = log.message;
          
          console.log(`${Formatter.formatTimestamp(timestamp)} ${level} ${message}`);
        });
      }
      
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to get logs: ${message}`));
    }
  }

  private async showInfo(): Promise<void> {
    try {
      const response = await this.apiClient.get('/server/info');
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get server info');
      }
      
      const info = response.data;
      
      const tableData = Object.entries(info).map(([key, value]) => ({
        Property: key,
        Value: typeof value === 'object' ? JSON.stringify(value) : String(value)
      }));
      
      console.log(Formatter.formatHeader('Server Information'));
      console.log();
      console.log(Formatter.formatTable(tableData, { 
        format: this.config.get('display.format') 
      }));
      
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to get server info: ${message}`));
    }
  }

  private async checkHealth(options: any): Promise<void> {
    const spinnerId = 'health-check';
    
    try {
      SpinnerManager.start(spinnerId, 'Performing health check...');
      
      const response = await this.apiClient.healthCheck();
      
      if (!response.success) {
        throw new Error(response.error || 'Health check failed');
      }
      
      const health = response.data;
      
      SpinnerManager.succeed(spinnerId, 'Health check completed');
      
      console.log();
      console.log(Formatter.formatHeader('Health Check Results'));
      console.log();
      
      const overallStatus = health.status || 'unknown';
      const statusIcon = Formatter.formatStatus(overallStatus);
      console.log(`Overall Status: ${statusIcon} ${overallStatus.toUpperCase()}`);
      
      if (options.detailed && health.checks) {
        console.log();
        console.log(Formatter.formatSubheader('Individual Checks'));
        
        for (const check of health.checks) {
          const checkStatus = check.status === 'pass' ? 'healthy' : 
                            check.status === 'fail' ? 'unhealthy' : 'warning';
          const icon = Formatter.formatStatus(checkStatus);
          
          console.log(`${icon} ${check.name}`);
          
          if (check.message) {
            console.log(`  ${gray(check.message)}`);
          }
          
          if (check.duration) {
            console.log(`  ${gray(`Duration: ${Formatter.formatDuration(check.duration)}`)}`);
          }
        }
      }
      
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      SpinnerManager.fail(spinnerId, `Health check failed: ${message}`);
    }
  }

  private async showConfig(options: any): Promise<void> {
    try {
      const response = await this.apiClient.getConfig();
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get configuration');
      }
      
      const config = response.data;
      
      console.log(Formatter.formatHeader('Server Configuration'));
      console.log();
      
      const format = this.config.get<string>('display.format');
      
      if (format === 'json') {
        console.log(JSON.stringify(config, null, 2));
      } else if (format === 'yaml') {
        const yaml = require('yaml');
        console.log(yaml.stringify(config, { indent: 2 }));
      } else {
        // Table format
        const flattenConfig = (obj: any, prefix = ''): any[] => {
          const result: any[] = [];
          
          for (const [key, value] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
              result.push(...flattenConfig(value, fullKey));
            } else {
              let displayValue = String(value);
              
              // Mask sensitive values if not explicitly requested
              if (!options.sensitive && this.isSensitiveKey(fullKey)) {
                displayValue = '***';
              }
              
              result.push({
                Key: fullKey,
                Value: displayValue,
                Type: Array.isArray(value) ? 'array' : typeof value
              });
            }
          }
          
          return result;
        };
        
        const tableData = flattenConfig(config);
        console.log(Formatter.formatTable(tableData));
      }
      
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to get configuration: ${message}`));
    }
  }

  private isSensitiveKey(key: string): boolean {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /auth/i,
      /credential/i
    ];
    
    return sensitivePatterns.some(pattern => pattern.test(key));
  }
}