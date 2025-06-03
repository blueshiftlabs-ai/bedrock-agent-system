import { Command } from 'commander';
import { yellow, gray, dim, bold, blue, bgRed, white, bgYellow, black } from 'kleur';
import { Tail } from 'tail';
import * as fs from 'fs-extra';
import * as path from 'path';
import { APIClient } from '../services/api-client';
import { Formatter } from '../utils/formatting';
import { SpinnerManager } from '../utils/spinner';
import { ConfigManager } from '../utils/config';
import { LogEntry } from '../types';

export class LogCommand {
  private apiClient: APIClient;
  private config: ConfigManager;

  constructor() {
    this.apiClient = new APIClient();
    this.config = ConfigManager.getInstance();
  }

  register(program: Command): void {
    // View logs command
    program
      .command('view')
      .alias('show')
      .description('View system logs')
      .option('-n, --lines <number>', 'Number of lines to show', '100')
      .option('-f, --follow', 'Follow log output (tail -f)')
      .option('-l, --level <level>', 'Filter by log level (error, warn, info, debug, verbose)')
      .option('-c, --component <component>', 'Filter by component')
      .option('-s, --since <time>', 'Show logs since time (e.g., "1h", "30m", "2024-01-01")')
      .option('--until <time>', 'Show logs until time')
      .option('-g, --grep <pattern>', 'Filter by pattern (regex)')
      .option('-i, --ignore-case', 'Case-insensitive pattern matching')
      .option('--json', 'Output logs in JSON format')
      .option('--no-color', 'Disable colored output')
      .action(async (options) => {
        await this.viewLogs(options);
      });

    // Tail logs command
    program
      .command('tail')
      .description('Follow log output in real-time')
      .option('-n, --lines <number>', 'Number of initial lines to show', '50')
      .option('-l, --level <level>', 'Filter by log level')
      .option('-c, --component <component>', 'Filter by component')
      .option('-g, --grep <pattern>', 'Filter by pattern')
      .option('-i, --ignore-case', 'Case-insensitive pattern matching')
      .action(async (options) => {
        await this.tailLogs(options);
      });

    // Search logs command
    program
      .command('search <query>')
      .description('Search through logs')
      .option('-n, --limit <number>', 'Maximum number of results', '1000')
      .option('-l, --level <level>', 'Filter by log level')
      .option('-c, --component <component>', 'Filter by component')
      .option('-s, --since <time>', 'Search logs since time')
      .option('--until <time>', 'Search logs until time')
      .option('-i, --ignore-case', 'Case-insensitive search')
      .option('-r, --regex', 'Use regular expression')
      .option('--context <lines>', 'Show context lines around matches', '0')
      .action(async (query, options) => {
        await this.searchLogs(query, options);
      });

    // Log levels command
    program
      .command('levels')
      .description('Show available log levels and their counts')
      .option('-s, --since <time>', 'Count logs since time')
      .option('--until <time>', 'Count logs until time')
      .action(async (options) => {
        await this.showLogLevels(options);
      });

    // Log components command
    program
      .command('components')
      .description('Show available log components and their counts')
      .option('-s, --since <time>', 'Count logs since time')
      .option('--until <time>', 'Count logs until time')
      .action(async (options) => {
        await this.showLogComponents(options);
      });

    // Log stats command
    program
      .command('stats')
      .description('Show log statistics')
      .option('-p, --period <period>', 'Time period (1h, 6h, 24h, 7d)', '24h')
      .option('-g, --group-by <field>', 'Group by field (level, component, hour)', 'level')
      .action(async (options) => {
        await this.showLogStats(options);
      });

    // Export logs command
    program
      .command('export <file>')
      .description('Export logs to file')
      .option('-f, --format <format>', 'Export format (json, csv, txt)', 'json')
      .option('-l, --level <level>', 'Filter by log level')
      .option('-c, --component <component>', 'Filter by component')
      .option('-s, --since <time>', 'Export logs since time')
      .option('--until <time>', 'Export logs until time')
      .option('-g, --grep <pattern>', 'Filter by pattern')
      .option('--compress', 'Compress output file')
      .action(async (file, options) => {
        await this.exportLogs(file, options);
      });

    // Clear logs command
    program
      .command('clear')
      .description('Clear log files')
      .option('-c, --component <component>', 'Clear logs for specific component')
      .option('-o, --older-than <time>', 'Clear logs older than specified time')
      .option('-f, --force', 'Skip confirmation prompt')
      .option('--dry-run', 'Show what would be cleared without actually clearing')
      .action(async (options) => {
        await this.clearLogs(options);
      });

    // Log rotation command
    program
      .command('rotate')
      .description('Manually trigger log rotation')
      .option('-c, --component <component>', 'Rotate logs for specific component')
      .action(async (options) => {
        await this.rotateLogs(options);
      });

    // Watch logs command (alternative to tail with more features)
    program
      .command('watch')
      .description('Watch logs with advanced filtering and highlighting')
      .option('-l, --level <levels...>', 'Filter by log levels (can specify multiple)')
      .option('-c, --component <components...>', 'Filter by components (can specify multiple)')
      .option('-h, --highlight <patterns...>', 'Highlight patterns')
      .option('-e, --exclude <patterns...>', 'Exclude patterns')
      .option('--alert <pattern>', 'Alert on pattern match')
      .option('--max-lines <number>', 'Maximum lines to keep in buffer', '1000')
      .action(async (options) => {
        await this.watchLogs(options);
      });

    // Analyze logs command
    program
      .command('analyze')
      .description('Analyze log patterns and anomalies')
      .option('-p, --period <period>', 'Analysis period', '24h')
      .option('-t, --type <type>', 'Analysis type (errors, performance, patterns)', 'errors')
      .action(async (options) => {
        await this.analyzeLogs(options);
      });
  }

  private async viewLogs(options: any): Promise<void> {
    try {
      const params = new URLSearchParams();
      if (options.lines) params.append('lines', options.lines);
      if (options.level) params.append('level', options.level);
      if (options.component) params.append('component', options.component);
      if (options.since) params.append('since', options.since);
      if (options.until) params.append('until', options.until);
      if (options.grep) params.append('grep', options.grep);
      if (options.ignoreCase) params.append('ignoreCase', 'true');

      if (options.follow) {
        await this.followLogs(options);
        return;
      }

      const response = await this.apiClient.get(`/logs?${params.toString()}`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get logs');
      }

      const logs: LogEntry[] = response.data.logs || [];

      console.log(Formatter.formatHeader(`Logs (${logs.length} entries)`));
      console.log();

      if (logs.length === 0) {
        console.log(Formatter.formatInfo('No logs found matching criteria'));
        return;
      }

      logs.forEach(log => {
        this.displayLogEntry(log, options);
      });

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to view logs: ${message}`));
    }
  }

  private async followLogs(options: any): Promise<void> {
    try {
      console.log(Formatter.formatInfo('Following logs (press Ctrl+C to stop)'));
      if (options.level) console.log(Formatter.formatDim(`Level filter: ${options.level}`));
      if (options.component) console.log(Formatter.formatDim(`Component filter: ${options.component}`));
      if (options.grep) console.log(Formatter.formatDim(`Pattern filter: ${options.grep}`));
      console.log(Formatter.formatDim('──────────────────────────────────────'));

      // Connect to WebSocket for real-time logs
      await this.apiClient.connectWebSocket();

      // Subscribe to logs
      this.apiClient.sendWebSocketMessage({
        type: 'subscribe',
        channel: 'logs',
        filters: {
          level: options.level,
          component: options.component,
          pattern: options.grep,
          ignoreCase: options.ignoreCase
        }
      });

      this.apiClient.on('ws-log', (logData) => {
        const logEntry: LogEntry = {
          timestamp: new Date(logData.timestamp),
          level: logData.level,
          message: logData.message,
          context: logData.context,
          component: logData.component,
          metadata: logData.metadata
        };

        this.displayLogEntry(logEntry, options);
      });

      // Keep the process alive
      process.on('SIGINT', () => {
        this.apiClient.disconnectWebSocket();
        console.log(yellow('\nStopped following logs'));
        process.exit(0);
      });

      // Prevent process from exiting
      setInterval(() => {}, 1000);

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to follow logs: ${message}`));
    }
  }

  private async tailLogs(options: any): Promise<void> {
    try {
      // Similar to viewLogs but with follow enabled
      const followOptions = {
        ...options,
        follow: true
      };

      await this.followLogs(followOptions);

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to tail logs: ${message}`));
    }
  }

  private async searchLogs(query: string, options: any): Promise<void> {
    const spinnerId = 'search-logs';

    try {
      SpinnerManager.start(spinnerId, `Searching logs for: ${query}...`);

      const params = new URLSearchParams();
      params.append('query', query);
      if (options.limit) params.append('limit', options.limit);
      if (options.level) params.append('level', options.level);
      if (options.component) params.append('component', options.component);
      if (options.since) params.append('since', options.since);
      if (options.until) params.append('until', options.until);
      if (options.ignoreCase) params.append('ignoreCase', 'true');
      if (options.regex) params.append('regex', 'true');
      if (options.context) params.append('context', options.context);

      const response = await this.apiClient.get(`/logs/search?${params.toString()}`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to search logs');
      }

      const results = response.data;
      const matches = results.matches || [];

      SpinnerManager.succeed(spinnerId, `Found ${matches.length} matches`);

      console.log();
      console.log(Formatter.formatHeader(`Search Results for "${query}"`));
      console.log();

      if (matches.length === 0) {
        console.log(Formatter.formatInfo('No matches found'));
        return;
      }

      matches.forEach((match: any, index: number) => {
        if (index > 0) console.log(gray('---'));
        
        // Show context lines if requested
        if (match.before && match.before.length > 0) {
          match.before.forEach((line: any) => {
            console.log(dim(this.formatLogLine(line)));
          });
        }

        // Highlight the matching line
        const highlightedLine = this.highlightMatch(match.line, query, options.ignoreCase);
        console.log(highlightedLine);

        if (match.after && match.after.length > 0) {
          match.after.forEach((line: any) => {
            console.log(dim(this.formatLogLine(line)));
          });
        }
      });

      if (results.totalMatches > matches.length) {
        console.log();
        console.log(Formatter.formatInfo(
          `Showing ${matches.length} of ${results.totalMatches} matches. ` +
          `Use --limit to see more results.`
        ));
      }

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      SpinnerManager.fail(spinnerId, `Search failed: ${message}`);
    }
  }

  private async showLogLevels(options: any): Promise<void> {
    try {
      const params = new URLSearchParams();
      if (options.since) params.append('since', options.since);
      if (options.until) params.append('until', options.until);

      const response = await this.apiClient.get(`/logs/levels?${params.toString()}`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get log levels');
      }

      const levels = response.data.levels || [];

      console.log(Formatter.formatHeader('Log Levels'));
      console.log();

      const tableData = levels.map((level: any) => ({
        Level: Formatter.formatLogLevel(level.level),
        Count: level.count.toLocaleString(),
        Percentage: `${level.percentage.toFixed(1)}%`,
        'Last Seen': level.lastSeen ? 
          Formatter.formatTimestamp(new Date(level.lastSeen)) : 'Never'
      }));

      console.log(Formatter.formatTable(tableData, { 
        format: this.config.get('display.format') 
      }));

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to get log levels: ${message}`));
    }
  }

  private async showLogComponents(options: any): Promise<void> {
    try {
      const params = new URLSearchParams();
      if (options.since) params.append('since', options.since);
      if (options.until) params.append('until', options.until);

      const response = await this.apiClient.get(`/logs/components?${params.toString()}`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get log components');
      }

      const components = response.data.components || [];

      console.log(Formatter.formatHeader('Log Components'));
      console.log();

      const tableData = components.map((component: any) => ({
        Component: component.name,
        Count: component.count.toLocaleString(),
        Percentage: `${component.percentage.toFixed(1)}%`,
        'Error Rate': `${component.errorRate.toFixed(1)}%`,
        'Last Activity': component.lastActivity ? 
          Formatter.formatTimestamp(new Date(component.lastActivity)) : 'Never'
      }));

      console.log(Formatter.formatTable(tableData, { 
        format: this.config.get('display.format') 
      }));

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to get log components: ${message}`));
    }
  }

  private async showLogStats(options: any): Promise<void> {
    try {
      const params = new URLSearchParams();
      params.append('period', options.period);
      params.append('groupBy', options.groupBy);

      const response = await this.apiClient.get(`/logs/stats?${params.toString()}`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get log statistics');
      }

      const stats = response.data;

      console.log(Formatter.formatHeader(`Log Statistics (${options.period})`));
      console.log();

      if (stats.summary) {
        console.log(bold('Summary:'));
        console.log(`  Total Logs: ${stats.summary.totalLogs.toLocaleString()}`);
        console.log(`  Error Rate: ${stats.summary.errorRate.toFixed(1)}%`);
        console.log(`  Most Active Component: ${stats.summary.mostActiveComponent}`);
        console.log(`  Logs per Hour: ${stats.summary.logsPerHour.toFixed(1)}`);
        console.log();
      }

      if (stats.groups && stats.groups.length > 0) {
        console.log(bold(`Grouped by ${options.groupBy}:`));
        
        const tableData = stats.groups.map((group: any) => ({
          [options.groupBy.charAt(0).toUpperCase() + options.groupBy.slice(1)]: group.name,
          Count: group.count.toLocaleString(),
          Percentage: `${group.percentage.toFixed(1)}%`
        }));

        console.log(Formatter.formatTable(tableData, { 
          format: this.config.get('display.format') 
        }));
      }

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to get log statistics: ${message}`));
    }
  }

  private async exportLogs(file: string, options: any): Promise<void> {
    const spinnerId = 'export-logs';

    try {
      SpinnerManager.start(spinnerId, `Exporting logs to ${file}...`);

      const params = new URLSearchParams();
      params.append('format', options.format);
      if (options.level) params.append('level', options.level);
      if (options.component) params.append('component', options.component);
      if (options.since) params.append('since', options.since);
      if (options.until) params.append('until', options.until);
      if (options.grep) params.append('grep', options.grep);

      const response = await this.apiClient.get(`/logs/export?${params.toString()}`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to export logs');
      }

      let content = response.data.content;

      // Write to file
      await fs.writeFile(file, content);

      // Compress if requested
      if (options.compress) {
        const zlib = require('zlib');
        const compressedContent = zlib.gzipSync(content);
        const compressedFile = `${file}.gz`;
        await fs.writeFile(compressedFile, compressedContent);
        await fs.remove(file); // Remove uncompressed file
        SpinnerManager.succeed(spinnerId, `Logs exported and compressed to ${compressedFile}`);
      } else {
        SpinnerManager.succeed(spinnerId, `Logs exported to ${file}`);
      }

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      SpinnerManager.fail(spinnerId, `Failed to export logs: ${message}`);
    }
  }

  private async clearLogs(options: any): Promise<void> {
    try {
      if (!options.force && !options.dryRun) {
        const inquirer = require('inquirer');
        const answers = await inquirer.prompt([
          {
            name: 'confirm',
            type: 'confirm',
            message: 'Are you sure you want to clear logs? This action cannot be undone.',
            default: false
          }
        ]);

        if (!answers.confirm) {
          console.log(Formatter.formatInfo('Log clearing cancelled'));
          return;
        }
      }

      const spinnerId = 'clear-logs';
      SpinnerManager.start(spinnerId, 'Clearing logs...');

      const clearConfig: any = {
        dryRun: options.dryRun
      };

      if (options.component) clearConfig.component = options.component;
      if (options.olderThan) clearConfig.olderThan = options.olderThan;

      const response = await this.apiClient.post('/logs/clear', clearConfig);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to clear logs');
      }

      const result = response.data;

      if (options.dryRun) {
        SpinnerManager.succeed(spinnerId, `Would clear ${result.filesCount} files (${Formatter.formatBytes(result.totalSize)})`);
      } else {
        SpinnerManager.succeed(spinnerId, `Cleared ${result.filesCount} files (${Formatter.formatBytes(result.totalSize)})`);
      }

      if (result.files && result.files.length > 0) {
        console.log();
        console.log(bold('Affected files:'));
        result.files.forEach((file: string) => {
          console.log(`  ${file}`);
        });
      }

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to clear logs: ${message}`));
    }
  }

  private async rotateLogs(options: any): Promise<void> {
    const spinnerId = 'rotate-logs';

    try {
      SpinnerManager.start(spinnerId, 'Rotating logs...');

      const rotateConfig: any = {};
      if (options.component) rotateConfig.component = options.component;

      const response = await this.apiClient.post('/logs/rotate', rotateConfig);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to rotate logs');
      }

      const result = response.data;
      SpinnerManager.succeed(spinnerId, `Rotated ${result.filesCount} log files`);

      if (result.files && result.files.length > 0) {
        console.log();
        console.log(bold('Rotated files:'));
        result.files.forEach((file: any) => {
          console.log(`  ${file.original} → ${file.rotated}`);
        });
      }

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      SpinnerManager.fail(spinnerId, `Failed to rotate logs: ${message}`);
    }
  }

  private async watchLogs(options: any): Promise<void> {
    try {
      console.log(Formatter.formatHeader('Advanced Log Watcher'));
      console.log(Formatter.formatInfo('Press Ctrl+C to stop'));
      
      if (options.level && options.level.length > 0) {
        console.log(Formatter.formatDim(`Level filters: ${options.level.join(', ')}`));
      }
      if (options.component && options.component.length > 0) {
        console.log(Formatter.formatDim(`Component filters: ${options.component.join(', ')}`));
      }
      if (options.highlight && options.highlight.length > 0) {
        console.log(Formatter.formatDim(`Highlight patterns: ${options.highlight.join(', ')}`));
      }
      if (options.exclude && options.exclude.length > 0) {
        console.log(Formatter.formatDim(`Exclude patterns: ${options.exclude.join(', ')}`));
      }
      
      console.log(Formatter.formatDim('──────────────────────────────────────'));

      // Connect to WebSocket for real-time logs
      await this.apiClient.connectWebSocket();

      // Subscribe to logs with advanced filters
      this.apiClient.sendWebSocketMessage({
        type: 'subscribe',
        channel: 'logs',
        filters: {
          levels: options.level,
          components: options.component,
          highlight: options.highlight,
          exclude: options.exclude
        }
      });

      let lineBuffer: LogEntry[] = [];
      const maxLines = parseInt(options.maxLines) || 1000;

      this.apiClient.on('ws-log', (logData) => {
        const logEntry: LogEntry = {
          timestamp: new Date(logData.timestamp),
          level: logData.level,
          message: logData.message,
          context: logData.context,
          component: logData.component,
          metadata: logData.metadata
        };

        // Apply exclude filters
        if (options.exclude && options.exclude.length > 0) {
          const shouldExclude = options.exclude.some((pattern: string) => {
            const regex = new RegExp(pattern, 'i');
            return regex.test(logEntry.message);
          });
          if (shouldExclude) return;
        }

        // Add to buffer
        lineBuffer.push(logEntry);
        if (lineBuffer.length > maxLines) {
          lineBuffer.shift();
        }

        // Display log with highlighting
        this.displayLogEntryWithHighlighting(logEntry, options);

        // Check for alerts
        if (options.alert) {
          const alertRegex = new RegExp(options.alert, 'i');
          if (alertRegex.test(logEntry.message)) {
            console.log(bgRed(white(bold(' ALERT '))) + ' Pattern matched: ' + options.alert);
          }
        }
      });

      // Keep the process alive
      process.on('SIGINT', () => {
        this.apiClient.disconnectWebSocket();
        console.log(yellow('\nStopped watching logs'));
        console.log(Formatter.formatInfo(`Buffered ${lineBuffer.length} log entries`));
        process.exit(0);
      });

      // Prevent process from exiting
      setInterval(() => {}, 1000);

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to watch logs: ${message}`));
    }
  }

  private async analyzeLogs(options: any): Promise<void> {
    const spinnerId = 'analyze-logs';

    try {
      SpinnerManager.start(spinnerId, `Analyzing logs (${options.type} analysis)...`);

      const params = new URLSearchParams();
      params.append('period', options.period);
      params.append('type', options.type);

      const response = await this.apiClient.get(`/logs/analyze?${params.toString()}`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to analyze logs');
      }

      const analysis = response.data;
      SpinnerManager.succeed(spinnerId, 'Log analysis completed');

      console.log();
      console.log(Formatter.formatHeader(`Log Analysis: ${options.type.toUpperCase()}`));
      console.log();

      if (analysis.summary) {
        console.log(bold('Summary:'));
        Object.entries(analysis.summary).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
        console.log();
      }

      if (analysis.patterns && analysis.patterns.length > 0) {
        console.log(bold('Top Patterns:'));
        analysis.patterns.forEach((pattern: any, index: number) => {
          console.log(`  ${index + 1}. ${pattern.pattern} (${pattern.count} occurrences)`);
        });
        console.log();
      }

      if (analysis.recommendations && analysis.recommendations.length > 0) {
        console.log(bold('Recommendations:'));
        analysis.recommendations.forEach((rec: string) => {
          console.log(`  • ${rec}`);
        });
      }

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      SpinnerManager.fail(spinnerId, `Log analysis failed: ${message}`);
    }
  }

  private displayLogEntry(log: LogEntry, options: any): void {
    if (options.json) {
      console.log(JSON.stringify(log, null, 2));
      return;
    }

    const timestamp = Formatter.formatTimestamp(log.timestamp);
    const level = Formatter.formatLogLevel(log.level);
    const component = log.component ? blue(`[${log.component}]`) : '';
    const context = log.context ? gray(`(${log.context})`) : '';
    
    if (options.noColor) {
      console.log(`${log.timestamp.toISOString()} ${log.level.toUpperCase()} ${log.component || ''} ${log.message}`);
    } else {
      console.log(`${timestamp} ${level} ${component} ${context} ${log.message}`);
    }

    if (log.metadata && Object.keys(log.metadata).length > 0) {
      console.log(dim(`  Metadata: ${JSON.stringify(log.metadata)}`));
    }
  }

  private displayLogEntryWithHighlighting(log: LogEntry, options: any): void {
    const timestamp = Formatter.formatTimestamp(log.timestamp);
    const level = Formatter.formatLogLevel(log.level);
    const component = log.component ? blue(`[${log.component}]`) : '';
    const context = log.context ? gray(`(${log.context})`) : '';
    
    let message = log.message;

    // Apply highlighting
    if (options.highlight && options.highlight.length > 0) {
      options.highlight.forEach((pattern: string) => {
        const regex = new RegExp(`(${pattern})`, 'gi');
        message = message.replace(regex, bgYellow(black('$1')));
      });
    }

    console.log(`${timestamp} ${level} ${component} ${context} ${message}`);
  }

  private formatLogLine(logEntry: any): string {
    const timestamp = Formatter.formatTimestamp(new Date(logEntry.timestamp));
    const level = Formatter.formatLogLevel(logEntry.level);
    const component = logEntry.component ? blue(`[${logEntry.component}]`) : '';
    
    return `${timestamp} ${level} ${component} ${logEntry.message}`;
  }

  private highlightMatch(line: any, query: string, ignoreCase: boolean = false): string {
    const formattedLine = this.formatLogLine(line);
    const flags = ignoreCase ? 'gi' : 'g';
    const regex = new RegExp(`(${query})`, flags);
    
    return formattedLine.replace(regex, bgYellow(black('$1')));
  }
}