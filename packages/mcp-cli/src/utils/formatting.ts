import { red, green, yellow, gray, cyan, magenta, blue, bold, underline, dim, bgBlack } from 'kleur';
import { table } from 'table';
import yaml from 'yaml';

export class Formatter {
  static formatStatus(status: string): string {
    const statusColors = {
      running: green('●'),
      stopped: red('●'),
      starting: yellow('●'),
      stopping: yellow('●'),
      error: red('✗'),
      unknown: gray('?'),
      healthy: green('✓'),
      unhealthy: red('✗'),
      warning: yellow('⚠'),
      connected: green('●'),
      disconnected: red('●'),
      connecting: yellow('●'),
      active: green('●'),
      inactive: gray('●'),
      idle: blue('●'),
      completed: green('✓'),
      failed: red('✗'),
      paused: yellow('⏸'),
      pending: gray('⏳'),
      skipped: gray('⏭')
    };
    
    return statusColors[status as keyof typeof statusColors] || gray('?');
  }

  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  static formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  }

  static formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  }

  static formatPercentage(value: number, total: number): string {
    if (total === 0) return '0%';
    const percentage = (value / total) * 100;
    const color = percentage > 80 ? red : percentage > 60 ? yellow : green;
    return color(`${percentage.toFixed(1)}%`);
  }

  static formatTimestamp(date: Date): string {
    return gray(date.toLocaleString());
  }

  static formatTable(data: any[], options: { format?: 'table' | 'json' | 'yaml' } = {}): string {
    if (!data || data.length === 0) {
      return gray('No data available');
    }

    switch (options.format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'yaml':
        return yaml.stringify(data);
      case 'table':
      default:
        const headers = Object.keys(data[0]);
        const rows = data.map(item => headers.map(header => String(item[header] || '')));
        
        return table([headers, ...rows], {
          border: {
            topBody: '─',
            topJoin: '┬',
            topLeft: '┌',
            topRight: '┐',
            bottomBody: '─',
            bottomJoin: '┴',
            bottomLeft: '└',
            bottomRight: '┘',
            bodyLeft: '│',
            bodyRight: '│',
            bodyJoin: '│',
            joinBody: '─',
            joinLeft: '├',
            joinRight: '┤',
            joinJoin: '┼'
          }
        });
    }
  }

  static formatProgress(current: number, total: number, width: number = 20): string {
    const percentage = total > 0 ? current / total : 0;
    const filled = Math.round(width * percentage);
    const empty = width - filled;
    
    const bar = green('█'.repeat(filled)) + gray('░'.repeat(empty));
    const percent = bold(`${(percentage * 100).toFixed(1)}%`);
    
    return `${bar} ${percent} (${current}/${total})`;
  }

  static formatError(error: string | Error): string {
    const message = error instanceof Error ? error.message : error;
    return red(`✗ ${message}`);
  }

  static formatSuccess(message: string): string {
    return green(`✓ ${message}`);
  }

  static formatWarning(message: string): string {
    return yellow(`⚠ ${message}`);
  }

  static formatInfo(message: string): string {
    return blue(`ℹ ${message}`);
  }

  static formatHeader(title: string): string {
    return bold(underline(title));
  }

  static formatSubheader(title: string): string {
    return bold(title);
  }

  static formatCode(code: string): string {
    return gray(bgBlack(` ${code} `));
  }

  static formatHighlight(text: string): string {
    return cyan(bold(text));
  }

  static formatDim(text: string): string {
    return dim(text);
  }

  static createBox(content: string, title?: string): string {
    const lines = content.split('\n');
    const maxLength = Math.max(...lines.map(line => line.length));
    const width = Math.max(maxLength + 4, title ? title.length + 4 : 0);
    
    let box = '┌' + '─'.repeat(width - 2) + '┐\n';
    
    if (title) {
      const padding = Math.floor((width - title.length - 2) / 2);
      box += '│' + ' '.repeat(padding) + title + ' '.repeat(width - title.length - padding - 2) + '│\n';
      box += '├' + '─'.repeat(width - 2) + '┤\n';
    }
    
    lines.forEach(line => {
      box += '│ ' + line.padEnd(width - 3) + '│\n';
    });
    
    box += '└' + '─'.repeat(width - 2) + '┘';
    
    return box;
  }

  static formatLogLevel(level: string): string {
    const colors = {
      error: red(bold('ERROR')),
      warn: yellow(bold('WARN ')),
      info: blue(bold('INFO ')),
      debug: gray(bold('DEBUG')),
      verbose: gray('VERBOSE')
    };
    
    return colors[level as keyof typeof colors] || gray(level.toUpperCase());
  }

  static stripColors(text: string): string {
    // Remove ANSI color codes
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }
}