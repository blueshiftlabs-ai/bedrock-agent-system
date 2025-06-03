import { Command } from 'commander';
import { bold, green, red, cyan, yellow } from 'kleur';
import inquirer from 'inquirer';
import * as path from 'path';
import { APIClient } from '../services/api-client';
import { Formatter } from '../utils/formatting';
import { SpinnerManager } from '../utils/spinner';
import { ConfigManager } from '../utils/config';
import { ConfigValue } from '../types';

export class ConfigCommand {
  private apiClient: APIClient;
  private config: ConfigManager;

  constructor() {
    this.apiClient = new APIClient();
    this.config = ConfigManager.getInstance();
  }

  register(program: Command): void {
    // Get configuration value command
    program
      .command('get [key]')
      .description('Get configuration value(s)')
      .option('-s, --server', 'Get server configuration')
      .option('-c, --client', 'Get CLI client configuration')
      .option('--all', 'Get all configuration')
      .option('--sensitive', 'Include sensitive values (masked)')
      .action(async (key, options) => {
        await this.getConfig(key, options);
      });

    // Set configuration value command
    program
      .command('set <key> <value>')
      .description('Set configuration value')
      .option('-s, --server', 'Set server configuration')
      .option('-c, --client', 'Set CLI client configuration')
      .option('-t, --type <type>', 'Value type (string, number, boolean, json)', 'string')
      .action(async (key, value, options) => {
        await this.setConfig(key, value, options);
      });

    // Unset configuration value command
    program
      .command('unset <key>')
      .description('Remove configuration value')
      .option('-s, --server', 'Remove from server configuration')
      .option('-c, --client', 'Remove from CLI client configuration')
      .action(async (key, options) => {
        await this.unsetConfig(key, options);
      });

    // List all configuration keys command
    program
      .command('list')
      .alias('ls')
      .description('List all configuration keys')
      .option('-s, --server', 'List server configuration')
      .option('-c, --client', 'List CLI client configuration')
      .option('-f, --filter <pattern>', 'Filter keys by pattern')
      .option('--sensitive', 'Include sensitive values (masked)')
      .action(async (options) => {
        await this.listConfig(options);
      });

    // Export configuration command
    program
      .command('export <file>')
      .description('Export configuration to file')
      .option('-s, --server', 'Export server configuration')
      .option('-c, --client', 'Export CLI client configuration')
      .option('--format <format>', 'Export format (json, yaml)', 'yaml')
      .option('--include-sensitive', 'Include sensitive values')
      .action(async (file, options) => {
        await this.exportConfig(file, options);
      });

    // Import configuration command
    program
      .command('import <file>')
      .description('Import configuration from file')
      .option('-s, --server', 'Import to server configuration')
      .option('-c, --client', 'Import to CLI client configuration')
      .option('--merge', 'Merge with existing configuration')
      .option('--backup', 'Create backup before import')
      .action(async (file, options) => {
        await this.importConfig(file, options);
      });

    // Reset configuration command
    program
      .command('reset')
      .description('Reset configuration to defaults')
      .option('-s, --server', 'Reset server configuration')
      .option('-c, --client', 'Reset CLI client configuration')
      .option('-f, --force', 'Skip confirmation prompt')
      .action(async (options) => {
        await this.resetConfig(options);
      });

    // Validate configuration command
    program
      .command('validate')
      .description('Validate configuration')
      .option('-s, --server', 'Validate server configuration')
      .option('-c, --client', 'Validate CLI client configuration')
      .action(async (options) => {
        await this.validateConfig(options);
      });

    // Show configuration info command
    program
      .command('info')
      .description('Show configuration information')
      .action(async () => {
        await this.showConfigInfo();
      });

    // Edit configuration interactively
    program
      .command('edit')
      .description('Edit configuration interactively')
      .option('-s, --server', 'Edit server configuration')
      .option('-c, --client', 'Edit CLI client configuration')
      .action(async (options) => {
        await this.editConfig(options);
      });

    // Backup configuration command
    program
      .command('backup <file>')
      .description('Create configuration backup')
      .option('-s, --server', 'Backup server configuration')
      .option('-c, --client', 'Backup CLI client configuration')
      .action(async (file, options) => {
        await this.backupConfig(file, options);
      });

    // Restore configuration command
    program
      .command('restore <file>')
      .description('Restore configuration from backup')
      .option('-s, --server', 'Restore server configuration')
      .option('-c, --client', 'Restore CLI client configuration')
      .option('--verify', 'Verify backup before restore')
      .action(async (file, options) => {
        await this.restoreConfig(file, options);
      });
  }

  private async getConfig(key?: string, options?: any): Promise<void> {
    try {
      if (options?.client || (!options?.server && !key)) {
        // Get CLI client configuration
        if (key) {
          const value = this.config.get(key);
          if (value !== undefined) {
            console.log(Formatter.formatHeader(`CLI Configuration: ${key}`));
            console.log();
            this.displayConfigValue(key, value);
          } else {
            console.log(Formatter.formatError(`Configuration key '${key}' not found`));
          }
        } else {
          const allConfig = this.config.getConfig();
          console.log(Formatter.formatHeader('CLI Configuration'));
          console.log();
          this.displayConfiguration(allConfig, options?.sensitive);
        }
        return;
      }

      // Get server configuration
      const endpoint = key ? `/config/${key}` : '/config';
      const response = await this.apiClient.get(endpoint);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get configuration');
      }

      if (key) {
        console.log(Formatter.formatHeader(`Server Configuration: ${key}`));
        console.log();
        this.displayConfigValue(key, response.data.value, response.data);
      } else {
        console.log(Formatter.formatHeader('Server Configuration'));
        console.log();
        this.displayConfiguration(response.data.config, options?.sensitive);
      }

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to get configuration: ${message}`));
    }
  }

  private async setConfig(key: string, value: string, options?: any): Promise<void> {
    const spinnerId = 'set-config';
    
    try {
      // Convert value based on type
      let convertedValue: any = value;
      
      switch (options?.type) {
        case 'number':
          convertedValue = parseFloat(value);
          if (isNaN(convertedValue)) {
            throw new Error('Invalid number value');
          }
          break;
        case 'boolean':
          convertedValue = value.toLowerCase() === 'true';
          break;
        case 'json':
          convertedValue = JSON.parse(value);
          break;
        // string is default, no conversion needed
      }

      if (options?.client) {
        // Set CLI client configuration
        this.config.set(key, convertedValue);
        console.log(Formatter.formatSuccess(`CLI configuration updated: ${key} = ${this.formatValue(convertedValue)}`));
        return;
      }

      // Set server configuration
      SpinnerManager.start(spinnerId, `Setting server configuration: ${key}...`);

      const response = await this.apiClient.setConfig(key, convertedValue);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to set configuration');
      }

      SpinnerManager.succeed(spinnerId, `Server configuration updated: ${key} = ${this.formatValue(convertedValue)}`);

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      SpinnerManager.fail(spinnerId, `Failed to set configuration: ${message}`);
    }
  }

  private async unsetConfig(key: string, options?: any): Promise<void> {
    const spinnerId = 'unset-config';
    
    try {
      if (options?.client) {
        // Cannot unset client config, suggest reset instead
        console.log(Formatter.formatWarning(`Cannot unset CLI configuration. Use 'config reset --client' to reset to defaults.`));
        return;
      }

      // Unset server configuration
      SpinnerManager.start(spinnerId, `Removing server configuration: ${key}...`);

      const response = await this.apiClient.delete(`/config/${key}`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to remove configuration');
      }

      SpinnerManager.succeed(spinnerId, `Server configuration removed: ${key}`);

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      SpinnerManager.fail(spinnerId, `Failed to remove configuration: ${message}`);
    }
  }

  private async listConfig(options?: any): Promise<void> {
    try {
      let configData: any = {};
      let title = 'Configuration';

      if (options?.client) {
        configData = this.config.getConfig();
        title = 'CLI Configuration';
      } else if (options?.server) {
        const response = await this.apiClient.get('/config');
        if (!response.success) {
          throw new Error(response.error || 'Failed to get server configuration');
        }
        configData = response.data.config;
        title = 'Server Configuration';
      } else {
        // Get both
        const serverResponse = await this.apiClient.get('/config');
        const serverConfig = serverResponse.success ? serverResponse.data.config : {};
        const clientConfig = this.config.getConfig();
        
        console.log(Formatter.formatHeader('Server Configuration'));
        console.log();
        this.displayConfigurationTable(serverConfig, options?.filter, options?.sensitive);
        
        console.log();
        console.log(Formatter.formatHeader('CLI Configuration'));
        console.log();
        this.displayConfigurationTable(clientConfig, options?.filter, options?.sensitive);
        return;
      }

      console.log(Formatter.formatHeader(title));
      console.log();
      this.displayConfigurationTable(configData, options?.filter, options?.sensitive);

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to list configuration: ${message}`));
    }
  }

  private async exportConfig(file: string, options?: any): Promise<void> {
    const spinnerId = 'export-config';
    
    try {
      SpinnerManager.start(spinnerId, `Exporting configuration to ${file}...`);

      let configData: any = {};

      if (options?.client) {
        configData = this.config.getConfig();
      } else if (options?.server) {
        const response = await this.apiClient.exportConfig();
        if (!response.success) {
          throw new Error(response.error || 'Failed to export server configuration');
        }
        configData = response.data;
      } else {
        // Export both
        const serverResponse = await this.apiClient.exportConfig();
        const serverConfig = serverResponse.success ? serverResponse.data : {};
        const clientConfig = this.config.getConfig();
        
        configData = {
          server: serverConfig,
          client: clientConfig
        };
      }

      // Remove sensitive values if not explicitly requested
      if (!options?.includeSensitive) {
        configData = this.maskSensitiveValues(configData);
      }

      // Write to file
      const fs = require('fs-extra');
      let content: string;

      if (options?.format === 'json') {
        content = JSON.stringify(configData, null, 2);
      } else {
        const yaml = require('yaml');
        content = yaml.stringify(configData, { indent: 2 });
      }

      await fs.writeFile(file, content);

      SpinnerManager.succeed(spinnerId, `Configuration exported to ${file}`);

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      SpinnerManager.fail(spinnerId, `Failed to export configuration: ${message}`);
    }
  }

  private async importConfig(file: string, options?: any): Promise<void> {
    const spinnerId = 'import-config';
    
    try {
      // Verify file exists
      const fs = require('fs-extra');
      if (!await fs.pathExists(file)) {
        throw new Error(`Configuration file not found: ${file}`);
      }

      // Create backup if requested
      if (options?.backup) {
        const backupFile = `${file}.backup.${Date.now()}`;
        await this.backupConfig(backupFile, options);
        console.log(Formatter.formatInfo(`Backup created: ${backupFile}`));
      }

      SpinnerManager.start(spinnerId, `Importing configuration from ${file}...`);

      // Read and parse file
      const content = await fs.readFile(file, 'utf-8');
      let configData: any;

      try {
        // Try JSON first
        configData = JSON.parse(content);
      } catch {
        // Try YAML
        const yaml = require('yaml');
        configData = yaml.parse(content);
      }

      if (options?.client) {
        // Import to CLI client
        if (options?.merge) {
          // Merge with existing config
          const currentConfig = this.config.getConfig();
          configData = { ...currentConfig, ...configData };
        }
        
        this.config.import(file);
        SpinnerManager.succeed(spinnerId, 'CLI configuration imported successfully');
        
      } else if (options?.server) {
        // Import to server
        const response = await this.apiClient.importConfig(configData);
        
        if (!response.success) {
          throw new Error(response.error || 'Failed to import server configuration');
        }
        
        SpinnerManager.succeed(spinnerId, 'Server configuration imported successfully');
        
      } else {
        // Import both if available
        if (configData.server) {
          const serverResponse = await this.apiClient.importConfig(configData.server);
          if (!serverResponse.success) {
            throw new Error(`Failed to import server configuration: ${serverResponse.error}`);
          }
        }
        
        if (configData.client) {
          // This would need to be handled differently in a real implementation
          console.log(Formatter.formatWarning('Client configuration import not implemented for combined files'));
        }
        
        SpinnerManager.succeed(spinnerId, 'Configuration imported successfully');
      }

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      SpinnerManager.fail(spinnerId, `Failed to import configuration: ${message}`);
    }
  }

  private async resetConfig(options?: any): Promise<void> {
    try {
      // Confirmation prompt unless forced
      if (!options?.force) {
        const answers = await inquirer.prompt([
          {
            name: 'confirm',
            type: 'confirm',
            message: 'Are you sure you want to reset configuration to defaults?',
            default: false
          }
        ]);

        if (!answers.confirm) {
          console.log(Formatter.formatInfo('Configuration reset cancelled'));
          return;
        }
      }

      const spinnerId = 'reset-config';
      SpinnerManager.start(spinnerId, 'Resetting configuration...');

      if (options?.client) {
        // Reset CLI client configuration
        this.config.reset();
        SpinnerManager.succeed(spinnerId, 'CLI configuration reset to defaults');
        
      } else if (options?.server) {
        // Reset server configuration
        const response = await this.apiClient.post('/config/reset');
        
        if (!response.success) {
          throw new Error(response.error || 'Failed to reset server configuration');
        }
        
        SpinnerManager.succeed(spinnerId, 'Server configuration reset to defaults');
        
      } else {
        // Reset both
        this.config.reset();
        
        const serverResponse = await this.apiClient.post('/config/reset');
        if (!serverResponse.success) {
          console.log(Formatter.formatWarning(`Failed to reset server configuration: ${serverResponse.error}`));
        }
        
        SpinnerManager.succeed(spinnerId, 'All configuration reset to defaults');
      }

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to reset configuration: ${message}`));
    }
  }

  private async validateConfig(options?: any): Promise<void> {
    const spinnerId = 'validate-config';
    
    try {
      SpinnerManager.start(spinnerId, 'Validating configuration...');

      let allValid = true;
      const issues: string[] = [];

      if (options?.client || !options?.server) {
        // Validate CLI client configuration
        try {
          // Basic validation - could be enhanced
          const config = this.config.getConfig();
          
          if (!config.server?.url) {
            issues.push('CLI: Missing server URL');
            allValid = false;
          }
          
          if (config.server?.timeout <= 0) {
            issues.push('CLI: Invalid timeout value');
            allValid = false;
          }
          
        } catch (error: any) {
          issues.push(`CLI: ${error instanceof Error ? error.message : String(error)}`);
          allValid = false;
        }
      }

      if (options?.server || !options?.client) {
        // Validate server configuration
        const response = await this.apiClient.get('/config/validate');
        
        if (!response.success) {
          issues.push(`Server: ${response.error || 'Validation failed'}`);
          allValid = false;
        } else if (response.data.issues && response.data.issues.length > 0) {
          issues.push(...response.data.issues.map((issue: string) => `Server: ${issue}`));
          allValid = false;
        }
      }

      if (allValid) {
        SpinnerManager.succeed(spinnerId, 'Configuration validation passed');
      } else {
        SpinnerManager.fail(spinnerId, 'Configuration validation failed');
        console.log();
        console.log(Formatter.formatHeader('Validation Issues'));
        issues.forEach(issue => {
          console.log(Formatter.formatError(issue));
        });
      }

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      SpinnerManager.fail(spinnerId, `Configuration validation failed: ${message}`);
    }
  }

  private async showConfigInfo(): Promise<void> {
    try {
      const configInfo = this.config.getConfigInfo();
      
      console.log(Formatter.formatHeader('Configuration Information'));
      console.log();
      
      console.log(bold('CLI Configuration:'));
      console.log(`  Config File: ${configInfo.configPath}`);
      console.log(`  Logs Directory: ${configInfo.logsPath}`);
      console.log(`  Cache Directory: ${configInfo.cachePath}`);
      console.log(`  Config Exists: ${configInfo.exists ? green('✓') : red('✗')}`);
      console.log(`  Readable: ${configInfo.readable ? green('✓') : red('✗')}`);
      console.log(`  Writable: ${configInfo.writable ? green('✓') : red('✗')}`);
      
      // Try to get server config info
      try {
        const serverResponse = await this.apiClient.get('/config/info');
        if (serverResponse.success) {
          console.log();
          console.log(bold('Server Configuration:'));
          const serverInfo = serverResponse.data;
          
          Object.entries(serverInfo).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
          });
        }
      } catch {
        console.log();
        console.log(bold('Server Configuration:'));
        console.log(`  ${red('Unable to connect to server')}`);
      }

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to get configuration info: ${message}`));
    }
  }

  private async editConfig(options?: any): Promise<void> {
    try {
      console.log(Formatter.formatHeader('Interactive Configuration Editor'));
      console.log(Formatter.formatInfo('Select configuration to edit'));
      console.log();

      if (!options?.server && !options?.client) {
        const answers = await inquirer.prompt([
          {
            name: 'target',
            type: 'list',
            message: 'Which configuration would you like to edit?',
            choices: [
              { name: 'CLI Client Configuration', value: 'client' },
              { name: 'Server Configuration', value: 'server' },
              { name: 'Both', value: 'both' }
            ]
          }
        ]);

        options = { [answers.target]: true };
      }

      if (options?.client || options?.both) {
        await this.editClientConfig();
      }

      if (options?.server || options?.both) {
        await this.editServerConfig();
      }

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to edit configuration: ${message}`));
    }
  }

  private async editClientConfig(): Promise<void> {
    const config = this.config.getConfig();
    
    const questions = [
      {
        name: 'server.url',
        message: 'Server URL:',
        type: 'input',
        default: config.server.url
      },
      {
        name: 'server.timeout',
        message: 'Request timeout (ms):',
        type: 'number',
        default: config.server.timeout
      },
      {
        name: 'display.colors',
        message: 'Enable colors:',
        type: 'confirm',
        default: config.display.colors
      },
      {
        name: 'display.format',
        message: 'Default output format:',
        type: 'list',
        choices: ['table', 'json', 'yaml'],
        default: config.display.format
      },
      {
        name: 'display.verbose',
        message: 'Enable verbose output:',
        type: 'confirm',
        default: config.display.verbose
      }
    ];

    const answers = await inquirer.prompt(questions);

    // Apply changes
    for (const [key, value] of Object.entries(answers)) {
      this.config.set(key, value);
    }

    console.log(Formatter.formatSuccess('CLI configuration updated'));
  }

  private async editServerConfig(): Promise<void> {
    try {
      // Get current server config
      const response = await this.apiClient.get('/config');
      if (!response.success) {
        throw new Error('Unable to get current server configuration');
      }

      const config = response.data.config;
      
      // This would need to be more sophisticated in a real implementation
      // For now, just show a message
      console.log(Formatter.formatInfo('Server configuration editing not fully implemented'));
      console.log(Formatter.formatInfo('Use "config set" commands to modify server configuration'));

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to edit server configuration: ${message}`));
    }
  }

  private async backupConfig(file: string, options?: any): Promise<void> {
    const spinnerId = 'backup-config';
    
    try {
      SpinnerManager.start(spinnerId, `Creating configuration backup: ${file}...`);

      // Use export functionality
      await this.exportConfig(file, {
        format: 'yaml',
        includeSensitive: true,
        ...options
      });

      SpinnerManager.succeed(spinnerId, `Configuration backup created: ${file}`);

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      SpinnerManager.fail(spinnerId, `Failed to create backup: ${message}`);
    }
  }

  private async restoreConfig(file: string, options?: any): Promise<void> {
    try {
      if (options?.verify) {
        // Verify backup file first
        const spinnerId = 'verify-backup';
        SpinnerManager.start(spinnerId, `Verifying backup file: ${file}...`);
        
        const fs = require('fs-extra');
        if (!await fs.pathExists(file)) {
          throw new Error(`Backup file not found: ${file}`);
        }

        try {
          const content = await fs.readFile(file, 'utf-8');
          // Try to parse as JSON or YAML
          try {
            JSON.parse(content);
          } catch {
            const yaml = require('yaml');
            yaml.parse(content);
          }
          
          SpinnerManager.succeed(spinnerId, 'Backup file verification passed');
        } catch (parseError) {
          throw new Error('Backup file is corrupted or invalid format');
        }
      }

      // Use import functionality
      await this.importConfig(file, {
        backup: true,
        ...options
      });

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(Formatter.formatError(`Failed to restore configuration: ${message}`));
    }
  }

  private displayConfiguration(config: any, showSensitive: boolean = false): void {
    const format = this.config.get<string>('display.format');
    
    if (format === 'json') {
      const displayConfig = showSensitive ? config : this.maskSensitiveValues(config);
      console.log(JSON.stringify(displayConfig, null, 2));
    } else if (format === 'yaml') {
      const yaml = require('yaml');
      const displayConfig = showSensitive ? config : this.maskSensitiveValues(config);
      console.log(yaml.stringify(displayConfig, { indent: 2 }));
    } else {
      this.displayConfigurationTable(config, undefined, showSensitive);
    }
  }

  private displayConfigurationTable(config: any, filter?: string, showSensitive: boolean = false): void {
    const flattenConfig = (obj: any, prefix = ''): any[] => {
      const result: any[] = [];
      
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        // Apply filter if provided
        if (filter && !fullKey.toLowerCase().includes(filter.toLowerCase())) {
          continue;
        }
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          result.push(...flattenConfig(value, fullKey));
        } else {
          let displayValue = String(value);
          
          // Mask sensitive values if not explicitly requested
          if (!showSensitive && this.isSensitiveKey(fullKey)) {
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
    
    if (tableData.length === 0) {
      console.log(Formatter.formatInfo('No configuration found'));
      return;
    }
    
    console.log(Formatter.formatTable(tableData));
  }

  private displayConfigValue(key: string, value: any, metadata?: any): void {
    console.log(`${bold('Key:')} ${key}`);
    console.log(`${bold('Value:')} ${this.formatValue(value)}`);
    console.log(`${bold('Type:')} ${Array.isArray(value) ? 'array' : typeof value}`);
    
    if (metadata) {
      if (metadata.description) {
        console.log(`${bold('Description:')} ${metadata.description}`);
      }
      if (metadata.required !== undefined) {
        console.log(`${bold('Required:')} ${metadata.required ? 'Yes' : 'No'}`);
      }
      if (metadata.sensitive) {
        console.log(`${bold('Sensitive:')} Yes`);
      }
    }
  }

  private formatValue(value: any): string {
    if (typeof value === 'string') {
      return green(`"${value}"`);
    } else if (typeof value === 'number') {
      return cyan(value.toString());
    } else if (typeof value === 'boolean') {
      return value ? green('true') : red('false');
    } else if (Array.isArray(value)) {
      return yellow(`[${value.length} items]`);
    } else if (typeof value === 'object') {
      return yellow(JSON.stringify(value));
    }
    return String(value);
  }

  private isSensitiveKey(key: string): boolean {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /auth/i,
      /credential/i,
      /api[_-]?key/i
    ];
    
    return sensitivePatterns.some(pattern => pattern.test(key));
  }

  private maskSensitiveValues(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const masked = Array.isArray(obj) ? [] : {};

    for (const [key, value] of Object.entries(obj)) {
      if (this.isSensitiveKey(key)) {
        (masked as any)[key] = '***';
      } else if (typeof value === 'object' && value !== null) {
        (masked as any)[key] = this.maskSensitiveValues(value);
      } else {
        (masked as any)[key] = value;
      }
    }

    return masked;
  }
}