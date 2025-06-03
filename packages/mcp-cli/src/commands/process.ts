import { Command } from 'commander';
import { yellow, bold, dim } from 'kleur';
import { APIClient } from '../services/api-client';
import { Formatter } from '../utils/formatting';
import { SpinnerManager } from '../utils/spinner';
import { ConfigManager } from '../utils/config';
import { ProcessInfo } from '../types';

export class ProcessCommand {
  private apiClient: APIClient;
  private config: ConfigManager;

  constructor() {
    this.apiClient = new APIClient();
    this.config = ConfigManager.getInstance();
  }

  register(program: Command): void {
    // List processes command
    program
      .command('list')
      .alias('ls')
      .description('List all processes')
      .option('-f, --filter <pattern>', 'Filter processes by name pattern')
      .option('-s, --sort <field>', 'Sort by field (name, pid, cpu, memory)', 'name')
      .option('-r, --reverse', 'Reverse sort order')
      .option('-w, --watch', 'Watch for process changes')
      .option('--refresh <seconds>', 'Refresh interval in seconds', '2')
      .action(async (options) => {
        await this.listProcesses(options);
      });

    // Show process details command
    program
      .command('show <pid>')
      .description('Show detailed process information')
      .action(async (pid) => {
        await this.showProcess(parseInt(pid, 10));
      });

    // Kill process command
    program
      .command('kill <pid>')
      .description('Kill a process')
      .option('-s, --signal <signal>', 'Signal to send', 'SIGTERM')
      .option('-f, --force', 'Use SIGKILL if SIGTERM fails')
      .option('-w, --wait', 'Wait for process to terminate')
      .option('-t, --timeout <seconds>', 'Wait timeout in seconds', '10')
      .action(async (pid, options) => {
        await this.killProcess(parseInt(pid, 10), options);
      });

    // Monitor processes command
    program
      .command('monitor')
      .alias('mon')
      .description('Monitor system processes')
      .option('-i, --interval <seconds>', 'Update interval in seconds', '2')
      .option('-n, --top <number>', 'Show top N processes', '10')
      .option('-s, --sort <field>', 'Sort by field (cpu, memory, name)', 'cpu')
      .action(async (options) => {
        await this.monitorProcesses(options);
      });

    // Process tree command
    program
      .command('tree [pid]')
      .description('Show process tree')
      .option('-d, --depth <levels>', 'Maximum depth to show', '3')
      .action(async (pid, options) => {
        await this.showProcessTree(pid ? parseInt(pid, 10) : undefined, options);
      });

    // Process search command
    program
      .command('search <pattern>')
      .description('Search for processes by name or command')
      .option('-i, --ignore-case', 'Case-insensitive search')
      .option('-e, --exact', 'Exact match only')
      .action(async (pattern, options) => {
        await this.searchProcesses(pattern, options);
      });

    // Start process command
    program
      .command('start <command>')
      .description('Start a new process')
      .option('-a, --args <args...>', 'Command arguments')
      .option('-e, --env <env...>', 'Environment variables (KEY=value)')
      .option('-w, --working-dir <dir>', 'Working directory')
      .option('-d, --detach', 'Run in background')
      .action(async (command, options) => {
        await this.startProcess(command, options);
      });

    // Resource usage command
    program
      .command('resources')
      .description('Show system resource usage')
      .option('-w, --watch', 'Watch for changes')
      .option('--refresh <seconds>', 'Refresh interval in seconds', '3')
      .action(async (options) => {
        await this.showResources(options);
      });
  }

  private async listProcesses(options: any): Promise<void> {
    const showProcessList = async () => {
      try {
        const response = await this.apiClient.getProcesses();
        
        if (!response.success) {
          throw new Error(response.error || 'Failed to get processes');
        }

        let processes: ProcessInfo[] = response.data.processes || [];

        // Apply filter
        if (options.filter) {
          const pattern = new RegExp(options.filter, 'i');
          processes = processes.filter(p => 
            pattern.test(p.name) || pattern.test(p.command)
          );
        }

        // Sort processes
        const sortField = options.sort;
        processes.sort((a, b) => {
          let aVal: any = a[sortField as keyof ProcessInfo];
          let bVal: any = b[sortField as keyof ProcessInfo];
          
          if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
          }
          
          if (aVal < bVal) return options.reverse ? 1 : -1;
          if (aVal > bVal) return options.reverse ? -1 : 1;
          return 0;
        });

        const tableData = processes.map(process => ({
          PID: process.pid,
          Name: process.name,
          Status: Formatter.formatStatus(process.status) + ' ' + process.status,
          CPU: `${process.cpu.toFixed(1)}%`,
          Memory: Formatter.formatBytes(process.memory),
          Uptime: Formatter.formatUptime(process.uptime),
          Command: process.command.length > 40 ? 
                  process.command.substring(0, 37) + '...' : 
                  process.command
        }));

        console.log(Formatter.formatHeader(`Processes (${processes.length})`));
        console.log();
        
        if (tableData.length === 0) {
          console.log(Formatter.formatInfo('No processes found'));
        } else {
          console.log(Formatter.formatTable(tableData, { 
            format: this.config.get('display.format') 
          }));
        }

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(Formatter.formatError(`Failed to list processes: ${message}`));
      }
    };

    if (options.watch) {
      const refreshInterval = parseInt(options.refresh) * 1000;
      
      console.log(Formatter.formatInfo(`Watching processes (refresh every ${options.refresh}s)`));
      console.log(Formatter.formatDim('Press Ctrl+C to stop'));
      console.log();
      
      await showProcessList();
      
      const interval = setInterval(async () => {
        process.stdout.write('\x1B[2J\x1B[0f');
        console.log(Formatter.formatDim(`Last updated: ${new Date().toLocaleTimeString()}`));
        console.log();
        await showProcessList();
      }, refreshInterval);
      
      process.on('SIGINT', () => {
        clearInterval(interval);
        console.log(yellow('\nStopped watching'));
        process.exit(0);
      });
      
    } else {
      await showProcessList();
    }
  }

  private async showProcess(pid: number): Promise<void> {
    try {
      const response = await this.apiClient.getProcess(pid);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get process information');
      }

      const process: ProcessInfo = response.data;

      console.log(Formatter.formatHeader(`Process ${pid} Details`));
      console.log();
      
      console.log(`${bold('PID:')} ${process.pid}`);
      console.log(`${bold('Name:')} ${process.name}`);
      console.log(`${bold('Status:')} ${Formatter.formatStatus(process.status)} ${process.status}`);
      console.log(`${bold('CPU Usage:')} ${process.cpu.toFixed(2)}%`);
      console.log(`${bold('Memory:')} ${Formatter.formatBytes(process.memory)}`);
      console.log(`${bold('Uptime:')} ${Formatter.formatUptime(process.uptime)}`);
      console.log(`${bold('Command:')} ${process.command}`);
      
      if (process.arguments.length > 0) {
        console.log(`${bold('Arguments:')}`);
        process.arguments.forEach((arg, index) => {
          console.log(`  ${index}: ${arg}`);
        });
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to get process information: ${message}`));
    }
  }

  private async killProcess(pid: number, options: any): Promise<void> {
    const spinnerId = 'kill-process';
    
    try {
      SpinnerManager.start(spinnerId, `Killing process ${pid}...`);

      const response = await this.apiClient.killProcess(pid, options.signal);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to kill process');
      }

      if (options.wait) {
        SpinnerManager.update(spinnerId, 'Waiting for process to terminate...');
        
        const timeout = parseInt(options.timeout) * 1000;
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
          try {
            const processResponse = await this.apiClient.getProcess(pid);
            if (!processResponse.success) {
              // Process no longer exists
              SpinnerManager.succeed(spinnerId, `Process ${pid} terminated`);
              return;
            }
          } catch {
            // Process no longer exists
            SpinnerManager.succeed(spinnerId, `Process ${pid} terminated`);
            return;
          }
          
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        if (options.force && options.signal !== 'SIGKILL') {
          SpinnerManager.update(spinnerId, 'Force killing process...');
          
          const forceResponse = await this.apiClient.killProcess(pid, 'SIGKILL');
          if (forceResponse.success) {
            SpinnerManager.succeed(spinnerId, `Process ${pid} force killed`);
          } else {
            throw new Error('Failed to force kill process');
          }
        } else {
          SpinnerManager.warn(spinnerId, `Process ${pid} may still be running`);
        }
      } else {
        SpinnerManager.succeed(spinnerId, `Kill signal sent to process ${pid}`);
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      SpinnerManager.fail(spinnerId, `Failed to kill process: ${message}`);
    }
  }

  private async monitorProcesses(options: any): Promise<void> {
    console.log(Formatter.formatInfo(`Monitoring top ${options.top} processes`));
    console.log(Formatter.formatDim('Press Ctrl+C to stop'));
    console.log();

    const interval = setInterval(async () => {
      try {
        const response = await this.apiClient.getProcesses();
        
        if (!response.success) {
          return;
        }

        let processes: ProcessInfo[] = response.data.processes || [];

        // Sort by the specified field
        processes.sort((a, b) => {
          const aVal = a[options.sort as keyof ProcessInfo] as number;
          const bVal = b[options.sort as keyof ProcessInfo] as number;
          return bVal - aVal; // Descending order
        });

        // Take top N
        processes = processes.slice(0, parseInt(options.top));

        // Clear screen and redraw
        process.stdout.write('\x1B[2J\x1B[0f');
        
        console.log(bold(`Top ${options.top} Processes by ${options.sort.toUpperCase()}`));
        console.log(dim(`Updated: ${new Date().toLocaleTimeString()}`));
        console.log();

        const tableData = processes.map((process, index) => ({
          '#': index + 1,
          PID: process.pid,
          Name: process.name,
          CPU: `${process.cpu.toFixed(1)}%`,
          Memory: Formatter.formatBytes(process.memory),
          Status: process.status
        }));

        console.log(Formatter.formatTable(tableData));

      } catch (error) {
        // Silent error handling in monitor mode
      }
    }, parseInt(options.interval) * 1000);

    process.on('SIGINT', () => {
      clearInterval(interval);
      console.log(yellow('\nMonitoring stopped'));
      process.exit(0);
    });
  }

  private async showProcessTree(rootPid?: number, options?: any): Promise<void> {
    try {
      const endpoint = rootPid ? `/processes/${rootPid}/tree` : '/processes/tree';
      const response = await this.apiClient.get(endpoint, {
        params: { depth: options?.depth }
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get process tree');
      }

      const tree = response.data.tree;

      console.log(Formatter.formatHeader('Process Tree'));
      console.log();

      this.renderProcessTree(tree, '', true);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to get process tree: ${message}`));
    }
  }

  private renderProcessTree(node: any, prefix: string = '', isLast: boolean = true): void {
    const connector = isLast ? '└── ' : '├── ';
    const status = Formatter.formatStatus(node.status);
    
    console.log(`${prefix}${connector}${status} ${node.name} (${node.pid})`);
    
    if (node.children && node.children.length > 0) {
      const childPrefix = prefix + (isLast ? '    ' : '│   ');
      
      node.children.forEach((child: any, index: number) => {
        const isLastChild = index === node.children.length - 1;
        this.renderProcessTree(child, childPrefix, isLastChild);
      });
    }
  }

  private async searchProcesses(pattern: string, options: any): Promise<void> {
    try {
      const response = await this.apiClient.getProcesses();
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get processes');
      }

      let processes: ProcessInfo[] = response.data.processes || [];

      // Create search regex
      const flags = options.ignoreCase ? 'i' : '';
      const searchPattern = options.exact ? `^${pattern}$` : pattern;
      const regex = new RegExp(searchPattern, flags);

      // Filter processes
      const matchedProcesses = processes.filter(p => 
        regex.test(p.name) || regex.test(p.command)
      );

      console.log(Formatter.formatHeader(`Search Results for "${pattern}"`));
      console.log();

      if (matchedProcesses.length === 0) {
        console.log(Formatter.formatInfo('No matching processes found'));
        return;
      }

      const tableData = matchedProcesses.map(process => ({
        PID: process.pid,
        Name: process.name,
        Status: Formatter.formatStatus(process.status) + ' ' + process.status,
        CPU: `${process.cpu.toFixed(1)}%`,
        Memory: Formatter.formatBytes(process.memory),
        Command: process.command.length > 50 ? 
                process.command.substring(0, 47) + '...' : 
                process.command
      }));

      console.log(Formatter.formatTable(tableData, { 
        format: this.config.get('display.format') 
      }));

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to search processes: ${message}`));
    }
  }

  private async startProcess(command: string, options: any): Promise<void> {
    const spinnerId = 'start-process';
    
    try {
      SpinnerManager.start(spinnerId, `Starting process: ${command}`);

      const processConfig = {
        command,
        arguments: options.args || [],
        environment: this.parseEnvironmentVariables(options.env || []),
        workingDirectory: options.workingDir,
        detached: options.detach
      };

      const response = await this.apiClient.post('/processes/start', processConfig);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to start process');
      }

      const process = response.data;
      SpinnerManager.succeed(spinnerId, `Process started with PID ${process.pid}`);

      if (!options.detach) {
        console.log(Formatter.formatInfo('Process is running in foreground'));
        console.log(Formatter.formatDim('Press Ctrl+C to stop'));
        
        // Monitor the process
        const monitorInterval = setInterval(async () => {
          try {
            const statusResponse = await this.apiClient.getProcess(process.pid);
            if (!statusResponse.success) {
              clearInterval(monitorInterval);
              console.log(Formatter.formatInfo('Process has terminated'));
              process.exit(0);
            }
          } catch {
            clearInterval(monitorInterval);
            console.log(Formatter.formatInfo('Process has terminated'));
            process.exit(0);
          }
        }, 1000);

        process.on('SIGINT', async () => {
          clearInterval(monitorInterval);
          console.log(yellow('\nTerminating process...'));
          
          try {
            await this.apiClient.killProcess(process.pid, 'SIGTERM');
            console.log(Formatter.formatSuccess('Process terminated'));
          } catch (error) {
            console.log(Formatter.formatError('Failed to terminate process'));
          }
          
          process.exit(0);
        });
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      SpinnerManager.fail(spinnerId, `Failed to start process: ${message}`);
    }
  }

  private async showResources(options: any): Promise<void> {
    const showResourcesOnce = async () => {
      try {
        const response = await this.apiClient.get('/system/resources');
        
        if (!response.success) {
          throw new Error(response.error || 'Failed to get system resources');
        }

        const resources = response.data;

        console.log(Formatter.formatHeader('System Resources'));
        console.log();

        // CPU Information
        console.log(bold('CPU:'));
        console.log(`  Usage: ${resources.cpu.usage.toFixed(1)}%`);
        console.log(`  Cores: ${resources.cpu.cores}`);
        console.log(`  Load Average: ${resources.cpu.loadAverage.join(', ')}`);
        console.log();

        // Memory Information
        console.log(bold('Memory:'));
        console.log(`  Total: ${Formatter.formatBytes(resources.memory.total)}`);
        console.log(`  Used: ${Formatter.formatBytes(resources.memory.used)} (${Formatter.formatPercentage(resources.memory.used, resources.memory.total)})`);
        console.log(`  Free: ${Formatter.formatBytes(resources.memory.free)}`);
        console.log(`  Available: ${Formatter.formatBytes(resources.memory.available)}`);
        console.log();

        // Disk Information
        if (resources.disk) {
          console.log(bold('Disk:'));
          resources.disk.forEach((disk: any) => {
            console.log(`  ${disk.filesystem}:`);
            console.log(`    Total: ${Formatter.formatBytes(disk.total)}`);
            console.log(`    Used: ${Formatter.formatBytes(disk.used)} (${Formatter.formatPercentage(disk.used, disk.total)})`);
            console.log(`    Available: ${Formatter.formatBytes(disk.available)}`);
          });
          console.log();
        }

        // Network Information
        if (resources.network) {
          console.log(bold('Network:'));
          console.log(`  Bytes In: ${Formatter.formatBytes(resources.network.bytesIn)}`);
          console.log(`  Bytes Out: ${Formatter.formatBytes(resources.network.bytesOut)}`);
          console.log(`  Packets In: ${resources.network.packetsIn.toLocaleString()}`);
          console.log(`  Packets Out: ${resources.network.packetsOut.toLocaleString()}`);
        }

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(Formatter.formatError(`Failed to get system resources: ${message}`));
      }
    };

    if (options.watch) {
      const refreshInterval = parseInt(options.refresh) * 1000;
      
      console.log(Formatter.formatInfo(`Watching system resources (refresh every ${options.refresh}s)`));
      console.log(Formatter.formatDim('Press Ctrl+C to stop'));
      console.log();
      
      await showResourcesOnce();
      
      const interval = setInterval(async () => {
        process.stdout.write('\x1B[2J\x1B[0f');
        console.log(Formatter.formatDim(`Last updated: ${new Date().toLocaleTimeString()}`));
        console.log();
        await showResourcesOnce();
      }, refreshInterval);
      
      process.on('SIGINT', () => {
        clearInterval(interval);
        console.log(yellow('\nStopped watching'));
        process.exit(0);
      });
      
    } else {
      await showResourcesOnce();
    }
  }

  private parseEnvironmentVariables(envVars: string[]): Record<string, string> {
    const env: Record<string, string> = {};
    
    for (const envVar of envVars) {
      const [key, ...valueParts] = envVar.split('=');
      if (key && valueParts.length > 0) {
        env[key] = valueParts.join('=');
      }
    }
    
    return env;
  }
}