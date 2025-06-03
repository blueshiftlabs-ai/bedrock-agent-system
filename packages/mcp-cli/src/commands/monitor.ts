import { Command } from 'commander';
import { bold, yellow, gray, green } from 'kleur';
import blessed from 'blessed';
import contrib from 'blessed-contrib';
import { APIClient } from '../services/api-client';
import { Formatter } from '../utils/formatting';
import { SpinnerManager } from '../utils/spinner';
import { ConfigManager } from '../utils/config';
import { MonitoringMetrics, HealthStatus } from '../types';

export class MonitorCommand {
  private apiClient: APIClient;
  private config: ConfigManager;

  constructor() {
    this.apiClient = new APIClient();
    this.config = ConfigManager.getInstance();
  }

  register(program: Command): void {
    // System status command
    program
      .command('status')
      .description('Show system status overview')
      .option('-w, --watch', 'Watch for status changes')
      .option('-r, --refresh <seconds>', 'Refresh interval in seconds', '5')
      .option('-d, --detailed', 'Show detailed status information')
      .action(async (options) => {
        await this.status(options);
      });

    // Health check command
    program
      .command('health')
      .description('Perform comprehensive health check')
      .option('-d, --detailed', 'Show detailed health information')
      .option('-c, --continuous', 'Continuous health monitoring')
      .option('--refresh <seconds>', 'Refresh interval for continuous mode', '10')
      .action(async (options) => {
        await this.health(options);
      });

    // System metrics command
    program
      .command('metrics')
      .description('Show system metrics')
      .option('-w, --watch', 'Watch for metric changes')
      .option('-r, --refresh <seconds>', 'Refresh interval in seconds', '3')
      .option('-c, --component <component>', 'Filter by component (server, agents, workflows, tools)')
      .action(async (options) => {
        await this.metrics(options);
      });

    // Alerts command
    program
      .command('alerts')
      .description('Show system alerts')
      .option('-a, --active', 'Show only active alerts')
      .option('-s, --severity <level>', 'Filter by severity (critical, warning, info)')
      .option('-n, --limit <number>', 'Number of alerts to show', '20')
      .action(async (options) => {
        await this.alerts(options);
      });

    // Dashboard command
    program
      .command('dashboard')
      .alias('dash')
      .description('Launch interactive monitoring dashboard')
      .option('-r, --refresh <seconds>', 'Refresh interval in seconds', '2')
      .action(async (options) => {
        await this.dashboard(options);
      });

    // Performance command
    program
      .command('performance')
      .alias('perf')
      .description('Show performance analytics')
      .option('-p, --period <period>', 'Time period (1h, 6h, 24h, 7d)', '1h')
      .option('-c, --component <component>', 'Filter by component')
      .action(async (options) => {
        await this.performance(options);
      });

    // Resource usage command
    program
      .command('resources')
      .description('Show resource usage')
      .option('-w, --watch', 'Watch for resource changes')
      .option('-r, --refresh <seconds>', 'Refresh interval in seconds', '5')
      .option('--cpu', 'Show only CPU usage')
      .option('--memory', 'Show only memory usage')
      .option('--disk', 'Show only disk usage')
      .action(async (options) => {
        await this.resources(options);
      });

    // Connections monitoring
    program
      .command('connections')
      .description('Monitor system connections')
      .option('-w, --watch', 'Watch for connection changes')
      .option('-r, --refresh <seconds>', 'Refresh interval in seconds', '3')
      .option('-t, --type <type>', 'Filter by connection type')
      .action(async (options) => {
        await this.connections(options);
      });

    // Load testing command
    program
      .command('load-test')
      .description('Run load test against the system')
      .option('-d, --duration <seconds>', 'Test duration in seconds', '60')
      .option('-c, --concurrency <number>', 'Number of concurrent requests', '10')
      .option('-r, --rate <number>', 'Requests per second', '5')
      .action(async (options) => {
        await this.loadTest(options);
      });

    // Benchmark command
    program
      .command('benchmark')
      .description('Run system benchmarks')
      .option('-t, --test <test>', 'Specific test to run (agents, tools, workflows)')
      .option('-i, --iterations <number>', 'Number of iterations', '10')
      .action(async (options) => {
        await this.benchmark(options);
      });

    // Export metrics command
    program
      .command('export <file>')
      .description('Export metrics to file')
      .option('-p, --period <period>', 'Time period to export', '24h')
      .option('-f, --format <format>', 'Export format (json, csv)', 'json')
      .action(async (file, options) => {
        await this.exportMetrics(file, options);
      });
  }

  async status(options: any): Promise<void> {
    const showStatusOnce = async () => {
      try {
        const response = await this.apiClient.getMetrics();
        
        if (!response.success) {
          throw new Error(response.error || 'Failed to get system metrics');
        }

        const metrics: MonitoringMetrics = response.data;

        console.log(Formatter.formatHeader('System Status Overview'));
        console.log();
        
        // Server status
        console.log(bold('🖥️  Server'));
        console.log(`  Uptime: ${Formatter.formatUptime(metrics.server.uptime)}`);
        console.log(`  Memory: ${Formatter.formatBytes(metrics.server.memory.used)} / ${Formatter.formatBytes(metrics.server.memory.total)} (${metrics.server.memory.percentage.toFixed(1)}%)`);
        console.log(`  CPU: ${metrics.server.cpu.usage.toFixed(1)}% (${metrics.server.cpu.cores} cores)`);
        console.log(`  Requests: ${metrics.server.requests.total} total, ${metrics.server.requests.perMinute}/min`);
        console.log(`  Avg Response Time: ${Formatter.formatDuration(metrics.server.requests.averageResponseTime)}`);
        console.log();
        
        // Agents status
        console.log(bold('🤖 Agents'));
        console.log(`  Total: ${metrics.agents.total}`);
        console.log(`  Active: ${metrics.agents.active}`);
        console.log(`  Executions: ${metrics.agents.executionsPerMinute}/min`);
        console.log(`  Avg Execution Time: ${Formatter.formatDuration(metrics.agents.averageExecutionTime)}`);
        console.log();
        
        // Workflows status
        console.log(bold('🔄 Workflows'));
        console.log(`  Total: ${metrics.workflows.total}`);
        console.log(`  Running: ${metrics.workflows.running}`);
        console.log(`  Completed: ${metrics.workflows.completed}`);
        console.log(`  Failed: ${metrics.workflows.failed}`);
        console.log();
        
        // Tools status
        console.log(bold('🔧 Tools'));
        console.log(`  Total: ${metrics.tools.total}`);
        console.log(`  Available: ${metrics.tools.available}`);
        console.log(`  External: ${metrics.tools.external}`);
        console.log(`  Executions: ${metrics.tools.executionsPerMinute}/min`);
        console.log();
        
        // Connections status
        console.log(bold('🔗 Connections'));
        console.log(`  Total: ${metrics.connections.total}`);
        console.log(`  Active: ${metrics.connections.active}`);
        console.log(`  Errors: ${metrics.connections.errors}`);
        console.log(`  Avg Latency: ${Formatter.formatDuration(metrics.connections.averageLatency)}`);

        if (options.detailed) {
          console.log();
          console.log(bold('🏥 Health Status'));
          
          const healthResponse = await this.apiClient.healthCheck();
          if (healthResponse.success) {
            const health: HealthStatus = healthResponse.data;
            const statusIcon = Formatter.formatStatus(health.status);
            console.log(`  Overall: ${statusIcon} ${health.status.toUpperCase()}`);
            console.log(`  Last Check: ${Formatter.formatTimestamp(health.lastCheck)}`);
            
            if (health.checks.length > 0) {
              console.log('  Components:');
              health.checks.forEach(check => {
                const icon = Formatter.formatStatus(check.status === 'pass' ? 'healthy' : check.status === 'fail' ? 'unhealthy' : 'warning');
                console.log(`    ${icon} ${check.name}: ${check.message || check.status}`);
              });
            }
          }
        }

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(Formatter.formatError(`Failed to get system status: ${message}`));
      }
    };

    if (options.watch) {
      const refreshInterval = parseInt(options.refresh) * 1000;
      
      console.log(Formatter.formatInfo(`Watching system status (refresh every ${options.refresh}s)`));
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

  async health(options: any): Promise<void> {
    const performHealthCheck = async () => {
      const spinnerId = 'health-check';
      
      try {
        SpinnerManager.start(spinnerId, 'Performing comprehensive health check...');
        
        const response = await this.apiClient.healthCheck();
        
        if (!response.success) {
          throw new Error(response.error || 'Health check failed');
        }
        
        const health: HealthStatus = response.data;
        
        SpinnerManager.succeed(spinnerId, 'Health check completed');
        
        console.log();
        console.log(Formatter.formatHeader('System Health Report'));
        console.log();
        
        const overallStatus = health.status;
        const statusIcon = Formatter.formatStatus(overallStatus);
        console.log(`Overall Status: ${statusIcon} ${overallStatus.toUpperCase()}`);
        console.log(`Last Check: ${Formatter.formatTimestamp(health.lastCheck)}`);
        console.log();
        
        if (health.checks && health.checks.length > 0) {
          console.log(bold('Component Health:'));
          
          health.checks.forEach(check => {
            const checkStatus = check.status === 'pass' ? 'healthy' : 
                              check.status === 'fail' ? 'unhealthy' : 'warning';
            const icon = Formatter.formatStatus(checkStatus);
            
            console.log(`${icon} ${check.name}`);
            
            if (options.detailed) {
              if (check.message) {
                console.log(`  ${gray(check.message)}`);
              }
              
              if (check.duration) {
                console.log(`  ${gray(`Check duration: ${Formatter.formatDuration(check.duration)}`)}`);
              }
            }
          });
        }
        
        // Health score calculation
        const passCount = health.checks.filter(c => c.status === 'pass').length;
        const totalCount = health.checks.length;
        const healthScore = totalCount > 0 ? (passCount / totalCount) * 100 : 100;
        
        console.log();
        console.log(`Health Score: ${healthScore.toFixed(1)}% (${passCount}/${totalCount} checks passing)`);
        
        if (healthScore < 80) {
          console.log(Formatter.formatWarning('System health is below optimal threshold'));
        } else if (healthScore === 100) {
          console.log(Formatter.formatSuccess('All health checks are passing'));
        }

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        SpinnerManager.fail(spinnerId, `Health check failed: ${message}`);
      }
    };

    if (options.continuous) {
      const refreshInterval = parseInt(options.refresh) * 1000;
      
      console.log(Formatter.formatInfo(`Continuous health monitoring (refresh every ${options.refresh}s)`));
      console.log(Formatter.formatDim('Press Ctrl+C to stop'));
      console.log();
      
      await performHealthCheck();
      
      const interval = setInterval(async () => {
        process.stdout.write('\x1B[2J\x1B[0f');
        console.log(Formatter.formatDim(`Last updated: ${new Date().toLocaleTimeString()}`));
        console.log();
        await performHealthCheck();
      }, refreshInterval);
      
      process.on('SIGINT', () => {
        clearInterval(interval);
        console.log(yellow('\nStopped monitoring'));
        process.exit(0);
      });
      
    } else {
      await performHealthCheck();
    }
  }

  async metrics(options: any): Promise<void> {
    const showMetricsOnce = async () => {
      try {
        const response = await this.apiClient.getMetrics();
        
        if (!response.success) {
          throw new Error(response.error || 'Failed to get metrics');
        }

        const metrics: MonitoringMetrics = response.data;

        console.log(Formatter.formatHeader('System Metrics'));
        console.log();

        if (!options.component || options.component === 'server') {
          console.log(bold('Server Metrics:'));
          console.log(`  Uptime: ${Formatter.formatUptime(metrics.server.uptime)}`);
          console.log(`  Memory Usage: ${Formatter.formatPercentage(metrics.server.memory.used, metrics.server.memory.total)}`);
          console.log(`  CPU Usage: ${metrics.server.cpu.usage.toFixed(1)}%`);
          console.log(`  Requests/min: ${metrics.server.requests.perMinute}`);
          console.log(`  Avg Response Time: ${Formatter.formatDuration(metrics.server.requests.averageResponseTime)}`);
          console.log();
        }

        if (!options.component || options.component === 'agents') {
          console.log(bold('Agent Metrics:'));
          console.log(`  Total Agents: ${metrics.agents.total}`);
          console.log(`  Active Agents: ${metrics.agents.active}`);
          console.log(`  Executions/min: ${metrics.agents.executionsPerMinute}`);
          console.log(`  Avg Execution Time: ${Formatter.formatDuration(metrics.agents.averageExecutionTime)}`);
          console.log();
        }

        if (!options.component || options.component === 'workflows') {
          console.log(bold('Workflow Metrics:'));
          console.log(`  Total: ${metrics.workflows.total}`);
          console.log(`  Running: ${metrics.workflows.running}`);
          console.log(`  Completed: ${metrics.workflows.completed}`);
          console.log(`  Failed: ${metrics.workflows.failed}`);
          
          const successRate = metrics.workflows.total > 0 ? 
            ((metrics.workflows.completed / metrics.workflows.total) * 100).toFixed(1) : '0';
          console.log(`  Success Rate: ${successRate}%`);
          console.log();
        }

        if (!options.component || options.component === 'tools') {
          console.log(bold('Tool Metrics:'));
          console.log(`  Total Tools: ${metrics.tools.total}`);
          console.log(`  Available: ${metrics.tools.available}`);
          console.log(`  External: ${metrics.tools.external}`);
          console.log(`  Executions/min: ${metrics.tools.executionsPerMinute}`);
          console.log();
        }

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(Formatter.formatError(`Failed to get metrics: ${message}`));
      }
    };

    if (options.watch) {
      const refreshInterval = parseInt(options.refresh) * 1000;
      
      console.log(Formatter.formatInfo(`Watching system metrics (refresh every ${options.refresh}s)`));
      console.log(Formatter.formatDim('Press Ctrl+C to stop'));
      console.log();
      
      await showMetricsOnce();
      
      const interval = setInterval(async () => {
        process.stdout.write('\x1B[2J\x1B[0f');
        console.log(Formatter.formatDim(`Last updated: ${new Date().toLocaleTimeString()}`));
        console.log();
        await showMetricsOnce();
      }, refreshInterval);
      
      process.on('SIGINT', () => {
        clearInterval(interval);
        console.log(yellow('\nStopped watching'));
        process.exit(0);
      });
      
    } else {
      await showMetricsOnce();
    }
  }

  async alerts(options: any): Promise<void> {
    try {
      const params = new URLSearchParams();
      if (options.active) params.append('active', 'true');
      if (options.severity) params.append('severity', options.severity);
      if (options.limit) params.append('limit', options.limit);

      const response = await this.apiClient.get(`/alerts?${params.toString()}`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get alerts');
      }

      const alerts = response.data.alerts || [];

      console.log(Formatter.formatHeader(`System Alerts (${alerts.length})`));
      console.log();

      if (alerts.length === 0) {
        console.log(Formatter.formatSuccess('No alerts found'));
        return;
      }

      alerts.forEach((alert: any) => {
        const severityIcon = this.getSeverityIcon(alert.severity);
        const timeAgo = this.getTimeAgo(new Date(alert.timestamp));
        
        console.log(`${severityIcon} ${alert.title}`);
        console.log(`  Severity: ${bold(alert.severity.toUpperCase())}`);
        console.log(`  Component: ${alert.component}`);
        console.log(`  Time: ${timeAgo}`);
        
        if (alert.description) {
          console.log(`  Description: ${gray(alert.description)}`);
        }
        
        if (alert.resolution) {
          console.log(`  Resolution: ${green(alert.resolution)}`);
        }
        
        console.log();
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to get alerts: ${message}`));
    }
  }

  async dashboard(options: any): Promise<void> {
    try {
      console.log(Formatter.formatInfo('Starting monitoring dashboard...'));
      
      // Create blessed screen
      const screen = blessed.screen({
        smartCSR: true,
        title: 'MCP System Dashboard'
      });

      // Create grid
      const grid = new contrib.grid({ rows: 4, cols: 4, screen: screen });

      // System overview
      const systemBox = grid.set(0, 0, 2, 2, blessed.box, {
        label: 'System Overview',
        border: { type: 'line' },
        style: {
          border: { fg: 'cyan' }
        }
      });

      // CPU gauge
      const cpuGauge = grid.set(0, 2, 1, 1, contrib.gauge, {
        label: 'CPU Usage',
        stroke: 'green',
        fill: 'white'
      });

      // Memory gauge  
      const memoryGauge = grid.set(0, 3, 1, 1, contrib.gauge, {
        label: 'Memory Usage',
        stroke: 'blue',
        fill: 'white'
      });

      // Request rate line chart
      const requestChart = grid.set(1, 2, 1, 2, contrib.line, {
        style: {
          line: 'yellow',
          text: 'green',
          baseline: 'black'
        },
        xLabelPadding: 3,
        xPadding: 5,
        label: 'Requests/min'
      });

      // Agent status table
      const agentTable = grid.set(2, 0, 2, 2, contrib.table, {
        keys: true,
        fg: 'white',
        selectedFg: 'white',
        selectedBg: 'blue',
        interactive: false,
        label: 'Agents',
        width: '100%',
        height: '100%',
        border: { type: 'line', fg: 'cyan' },
        columnSpacing: 10,
        columnWidth: [10, 10, 8, 8]
      });

      // Alert log
      const alertLog = grid.set(2, 2, 2, 2, contrib.log, {
        fg: 'green',
        selectedFg: 'green',
        label: 'Alerts'
      });

      // Data storage for charts
      const requestData = {
        title: 'Requests/min',
        x: [] as string[],
        y: [] as number[]
      };

      // Update function
      const updateDashboard = async () => {
        try {
          // Get metrics
          const metricsResponse = await this.apiClient.getMetrics();
          if (metricsResponse.success) {
            const metrics: MonitoringMetrics = metricsResponse.data;
            
            // Update system overview
            systemBox.setContent(
              `Uptime: ${Formatter.formatUptime(metrics.server.uptime)}\n` +
              `Active Agents: ${metrics.agents.active}/${metrics.agents.total}\n` +
              `Running Workflows: ${metrics.workflows.running}\n` +
              `Active Connections: ${metrics.connections.active}`
            );

            // Update gauges
            cpuGauge.setPercent(metrics.server.cpu.usage);
            memoryGauge.setPercent(metrics.server.memory.percentage);

            // Update request chart
            const now = new Date().toLocaleTimeString();
            requestData.x.push(now);
            requestData.y.push(metrics.server.requests.perMinute);
            
            // Keep only last 20 data points
            if (requestData.x.length > 20) {
              requestData.x.shift();
              requestData.y.shift();
            }
            
            requestChart.setData([requestData]);

            // Update agent table
            const agentResponse = await this.apiClient.getAgents();
            if (agentResponse.success) {
              const agents = agentResponse.data.agents || [];
              const agentTableData = agents.slice(0, 10).map((agent: any) => [
                agent.name,
                agent.type,
                agent.status,
                agent.executionCount.toString()
              ]);
              
              agentTable.setData({
                headers: ['Name', 'Type', 'Status', 'Executions'],
                data: agentTableData
              });
            }
          }

          // Get alerts
          const alertResponse = await this.apiClient.getAlerts();
          if (alertResponse.success) {
            const alerts = alertResponse.data.alerts || [];
            alerts.slice(0, 5).forEach((alert: any) => {
              const timestamp = new Date(alert.timestamp).toLocaleTimeString();
              alertLog.log(`[${timestamp}] ${alert.severity.toUpperCase()}: ${alert.title}`);
            });
          }

          screen.render();
          
        } catch (error) {
          alertLog.log(`Error updating dashboard: ${error instanceof Error ? error.message : String(error)}`);
          screen.render();
        }
      };

      // Initial update
      await updateDashboard();

      // Set up refresh interval
      const refreshInterval = parseInt(options.refresh) * 1000;
      const interval = setInterval(updateDashboard, refreshInterval);

      // Handle exit
      screen.key(['escape', 'q', 'C-c'], () => {
        clearInterval(interval);
        screen.destroy();
        process.exit(0);
      });

      // Status line
      const statusLine = blessed.box({
        bottom: 0,
        left: 0,
        width: '100%',
        height: 1,
        content: ' ESC/Q/Ctrl-C: Exit | Refresh: ' + options.refresh + 's',
        style: {
          bg: 'blue',
          fg: 'white'
        }
      });

      screen.append(statusLine);
      screen.render();

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to start dashboard: ${message}`));
    }
  }

  async performance(options: any): Promise<void> {
    try {
      const params = new URLSearchParams();
      params.append('period', options.period);
      if (options.component) params.append('component', options.component);

      const response = await this.apiClient.get(`/performance?${params.toString()}`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get performance data');
      }

      const performance = response.data;

      console.log(Formatter.formatHeader(`Performance Analytics (${options.period})`));
      console.log();

      if (performance.summary) {
        console.log(bold('Summary:'));
        console.log(`  Avg Response Time: ${Formatter.formatDuration(performance.summary.averageResponseTime)}`);
        console.log(`  Total Requests: ${performance.summary.totalRequests.toLocaleString()}`);
        console.log(`  Error Rate: ${performance.summary.errorRate.toFixed(2)}%`);
        console.log(`  Throughput: ${performance.summary.throughput.toFixed(1)} req/s`);
        console.log();
      }

      if (performance.trends) {
        console.log(bold('Trends:'));
        performance.trends.forEach((trend: any) => {
          const direction = trend.direction === 'up' ? '📈' : trend.direction === 'down' ? '📉' : '➡️';
          console.log(`  ${direction} ${trend.metric}: ${trend.change}`);
        });
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to get performance data: ${message}`));
    }
  }

  async resources(options: any): Promise<void> {
    const showResourcesOnce = async () => {
      try {
        const response = await this.apiClient.get('/system/resources');
        
        if (!response.success) {
          throw new Error(response.error || 'Failed to get resource usage');
        }

        const resources = response.data;

        console.log(Formatter.formatHeader('System Resources'));
        console.log();

        if (!options.memory && !options.disk) {
          console.log(bold('💾 CPU:'));
          console.log(`  Usage: ${resources.cpu.usage.toFixed(1)}%`);
          console.log(`  Cores: ${resources.cpu.cores}`);
          console.log(`  Load Average: ${resources.cpu.loadAverage.join(', ')}`);
          console.log();
        }

        if (!options.cpu && !options.disk) {
          console.log(bold('🧠 Memory:'));
          console.log(`  Total: ${Formatter.formatBytes(resources.memory.total)}`);
          console.log(`  Used: ${Formatter.formatBytes(resources.memory.used)} (${Formatter.formatPercentage(resources.memory.used, resources.memory.total)})`);
          console.log(`  Free: ${Formatter.formatBytes(resources.memory.free)}`);
          console.log(`  Available: ${Formatter.formatBytes(resources.memory.available)}`);
          console.log();
        }

        if (!options.cpu && !options.memory && resources.disk) {
          console.log(bold('💿 Disk:'));
          resources.disk.forEach((disk: any) => {
            console.log(`  ${disk.filesystem}:`);
            console.log(`    Total: ${Formatter.formatBytes(disk.total)}`);
            console.log(`    Used: ${Formatter.formatBytes(disk.used)} (${Formatter.formatPercentage(disk.used, disk.total)})`);
            console.log(`    Available: ${Formatter.formatBytes(disk.available)}`);
          });
        }

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(Formatter.formatError(`Failed to get resource usage: ${message}`));
      }
    };

    if (options.watch) {
      const refreshInterval = parseInt(options.refresh) * 1000;
      
      console.log(Formatter.formatInfo(`Watching resource usage (refresh every ${options.refresh}s)`));
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

  async connections(options: any): Promise<void> {
    const showConnectionsOnce = async () => {
      try {
        const params = new URLSearchParams();
        if (options.type) params.append('type', options.type);

        const response = await this.apiClient.get(`/connections?${params.toString()}`);
        
        if (!response.success) {
          throw new Error(response.error || 'Failed to get connections');
        }

        const connections = response.data.connections || [];

        console.log(Formatter.formatHeader(`System Connections (${connections.length})`));
        console.log();

        if (connections.length === 0) {
          console.log(Formatter.formatInfo('No connections found'));
          return;
        }

        const tableData = connections.map((conn: any) => ({
          Name: conn.name,
          Type: conn.type,
          Status: Formatter.formatStatus(conn.status) + ' ' + conn.status,
          URL: conn.url.length > 30 ? conn.url.substring(0, 27) + '...' : conn.url,
          Latency: conn.latency ? `${conn.latency}ms` : 'N/A',
          'Error Count': conn.errorCount || 0
        }));

        console.log(Formatter.formatTable(tableData, { 
          format: this.config.get('display.format') 
        }));

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(Formatter.formatError(`Failed to get connections: ${message}`));
      }
    };

    if (options.watch) {
      const refreshInterval = parseInt(options.refresh) * 1000;
      
      console.log(Formatter.formatInfo(`Watching connections (refresh every ${options.refresh}s)`));
      console.log(Formatter.formatDim('Press Ctrl+C to stop'));
      console.log();
      
      await showConnectionsOnce();
      
      const interval = setInterval(async () => {
        process.stdout.write('\x1B[2J\x1B[0f');
        console.log(Formatter.formatDim(`Last updated: ${new Date().toLocaleTimeString()}`));
        console.log();
        await showConnectionsOnce();
      }, refreshInterval);
      
      process.on('SIGINT', () => {
        clearInterval(interval);
        console.log(yellow('\nStopped watching'));
        process.exit(0);
      });
      
    } else {
      await showConnectionsOnce();
    }
  }

  async loadTest(options: any): Promise<void> {
    const spinnerId = 'load-test';
    
    try {
      console.log(Formatter.formatHeader('Load Test Configuration'));
      console.log(`Duration: ${options.duration}s`);
      console.log(`Concurrency: ${options.concurrency}`);
      console.log(`Rate: ${options.rate} req/s`);
      console.log();

      SpinnerManager.start(spinnerId, 'Starting load test...');

      const testConfig = {
        duration: parseInt(options.duration),
        concurrency: parseInt(options.concurrency),
        rate: parseInt(options.rate)
      };

      const response = await this.apiClient.post('/testing/load', testConfig);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to start load test');
      }

      const testId = response.data.testId;
      SpinnerManager.update(spinnerId, `Load test started (ID: ${testId})`);
      
      // Monitor test progress
      const progressTracker = SpinnerManager.createProgress('load-test-progress', 100);
      
      const startTime = Date.now();
      const testDuration = parseInt(options.duration) * 1000;
      
      const monitorInterval = setInterval(async () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / testDuration) * 100, 100);
        
        progressTracker.update(progress, `Running load test... ${Math.round(progress)}%`);
        
        if (elapsed >= testDuration) {
          clearInterval(monitorInterval);
          
          // Get test results
          const resultResponse = await this.apiClient.get(`/testing/load/${testId}/results`);
          
          if (resultResponse.success) {
            progressTracker.finish('Load test completed');
            SpinnerManager.succeed(spinnerId, 'Load test completed successfully');
            
            const results = resultResponse.data;
            
            console.log();
            console.log(Formatter.formatHeader('Load Test Results'));
            console.log();
            console.log(`Total Requests: ${results.totalRequests}`);
            console.log(`Successful Requests: ${results.successfulRequests}`);
            console.log(`Failed Requests: ${results.failedRequests}`);
            console.log(`Success Rate: ${((results.successfulRequests / results.totalRequests) * 100).toFixed(1)}%`);
            console.log(`Average Response Time: ${Formatter.formatDuration(results.averageResponseTime)}`);
            console.log(`Min Response Time: ${Formatter.formatDuration(results.minResponseTime)}`);
            console.log(`Max Response Time: ${Formatter.formatDuration(results.maxResponseTime)}`);
            console.log(`Requests/second: ${results.requestsPerSecond.toFixed(1)}`);
            
          } else {
            progressTracker.finish('Load test failed to get results');
            SpinnerManager.fail(spinnerId, 'Failed to get test results');
          }
        }
      }, 1000);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      SpinnerManager.fail(spinnerId, `Load test failed: ${message}`);
    }
  }

  async benchmark(options: any): Promise<void> {
    const spinnerId = 'benchmark';
    
    try {
      SpinnerManager.start(spinnerId, 'Running system benchmarks...');

      const benchmarkConfig = {
        test: options.test,
        iterations: parseInt(options.iterations)
      };

      const response = await this.apiClient.post('/testing/benchmark', benchmarkConfig);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to run benchmark');
      }

      const results = response.data;
      
      SpinnerManager.succeed(spinnerId, 'Benchmark completed successfully');
      
      console.log();
      console.log(Formatter.formatHeader('Benchmark Results'));
      console.log();
      
      if (results.tests) {
        results.tests.forEach((test: any) => {
          console.log(bold(`${test.name}:`));
          console.log(`  Iterations: ${test.iterations}`);
          console.log(`  Average Time: ${Formatter.formatDuration(test.averageTime)}`);
          console.log(`  Min Time: ${Formatter.formatDuration(test.minTime)}`);
          console.log(`  Max Time: ${Formatter.formatDuration(test.maxTime)}`);
          console.log(`  Operations/sec: ${test.operationsPerSecond.toFixed(1)}`);
          console.log();
        });
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      SpinnerManager.fail(spinnerId, `Benchmark failed: ${message}`);
    }
  }

  async exportMetrics(file: string, options: any): Promise<void> {
    const spinnerId = 'export-metrics';
    
    try {
      SpinnerManager.start(spinnerId, `Exporting metrics to ${file}...`);

      const params = new URLSearchParams();
      params.append('period', options.period);
      params.append('format', options.format);

      const response = await this.apiClient.get(`/metrics/export?${params.toString()}`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to export metrics');
      }

      const fs = require('fs-extra');
      
      if (options.format === 'csv') {
        await fs.writeFile(file, response.data.csv);
      } else {
        await fs.writeFile(file, JSON.stringify(response.data.json, null, 2));
      }

      SpinnerManager.succeed(spinnerId, `Metrics exported to ${file}`);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      SpinnerManager.fail(spinnerId, `Failed to export metrics: ${message}`);
    }
  }

  private getSeverityIcon(severity: string): string {
    switch (severity.toLowerCase()) {
      case 'critical': return '🔴';
      case 'warning': return '🟡';
      case 'info': return '🔵';
      default: return '⚪';
    }
  }

  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMinutes > 0) return `${diffMinutes}m ago`;
    return `${diffSeconds}s ago`;
  }
}