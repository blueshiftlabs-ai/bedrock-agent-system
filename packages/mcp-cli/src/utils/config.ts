import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import yaml from 'yaml';
import { CLIConfig } from '../types';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: CLIConfig;
  private configPath: string;

  private constructor() {
    this.configPath = this.getConfigPath();
    this.config = this.loadConfig();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private getConfigPath(): string {
    const configDir = process.env.MCP_CLI_CONFIG_DIR || 
                     path.join(os.homedir(), '.mcp-cli');
    
    fs.ensureDirSync(configDir);
    return path.join(configDir, 'config.yaml');
  }

  private getDefaultConfig(): CLIConfig {
    return {
      server: {
        url: 'http://localhost:3000',
        timeout: 30000,
        retries: 3
      },
      display: {
        colors: true,
        animations: true,
        verbose: false,
        format: 'table'
      },
      monitoring: {
        refreshInterval: 5000,
        maxLogLines: 1000,
        alertThresholds: {
          cpu: 80,
          memory: 85,
          errorRate: 5
        }
      },
      paths: {
        config: this.configPath,
        logs: path.join(path.dirname(this.configPath), 'logs'),
        cache: path.join(path.dirname(this.configPath), 'cache')
      }
    };
  }

  private loadConfig(): CLIConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        const loaded = yaml.parse(content);
        return { ...this.getDefaultConfig(), ...loaded };
      }
    } catch (error) {
      console.warn(`Warning: Could not load config from ${this.configPath}, using defaults`);
    }
    
    return this.getDefaultConfig();
  }

  saveConfig(): void {
    try {
      fs.ensureDirSync(path.dirname(this.configPath));
      const content = yaml.stringify(this.config, { indent: 2 });
      fs.writeFileSync(this.configPath, content);
    } catch (error) {
      throw new Error(`Failed to save config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getConfig(): CLIConfig {
    return { ...this.config };
  }

  get<T>(key: string): T {
    return this.getNestedValue(this.config, key);
  }

  set(key: string, value: any): void {
    this.setNestedValue(this.config, key, value);
    this.saveConfig();
  }

  reset(): void {
    this.config = this.getDefaultConfig();
    this.saveConfig();
  }

  export(filePath: string): void {
    const content = yaml.stringify(this.config, { indent: 2 });
    fs.writeFileSync(filePath, content);
  }

  import(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Config file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const imported = yaml.parse(content);
    
    // Validate imported config
    this.validateConfig(imported);
    
    this.config = { ...this.getDefaultConfig(), ...imported };
    this.saveConfig();
  }

  private validateConfig(config: any): void {
    const required = [
      'server.url',
      'display.format',
      'monitoring.refreshInterval'
    ];

    for (const key of required) {
      const value = this.getNestedValue(config, key);
      if (value === undefined || value === null) {
        throw new Error(`Missing required config key: ${key}`);
      }
    }

    // Validate types
    if (typeof config.server?.url !== 'string') {
      throw new Error('server.url must be a string');
    }

    if (typeof config.server?.timeout !== 'number' || config.server.timeout <= 0) {
      throw new Error('server.timeout must be a positive number');
    }

    if (!['table', 'json', 'yaml'].includes(config.display?.format)) {
      throw new Error('display.format must be one of: table, json, yaml');
    }
  }

  private getNestedValue(obj: any, key: string): any {
    return key.split('.').reduce((current, prop) => {
      return current && current[prop] !== undefined ? current[prop] : undefined;
    }, obj);
  }

  private setNestedValue(obj: any, key: string, value: any): void {
    const keys = key.split('.');
    const lastKey = keys.pop()!;
    
    const target = keys.reduce((current, prop) => {
      if (!current[prop] || typeof current[prop] !== 'object') {
        current[prop] = {};
      }
      return current[prop];
    }, obj);
    
    target[lastKey] = value;
  }

  // Environment variable overrides
  applyEnvironmentOverrides(): void {
    const envMappings = {
      'MCP_CLI_SERVER_URL': 'server.url',
      'MCP_CLI_SERVER_TIMEOUT': 'server.timeout',
      'MCP_CLI_VERBOSE': 'display.verbose',
      'MCP_CLI_FORMAT': 'display.format',
      'MCP_CLI_NO_COLOR': 'display.colors',
      'MCP_CLI_REFRESH_INTERVAL': 'monitoring.refreshInterval'
    };

    for (const [envVar, configKey] of Object.entries(envMappings)) {
      const envValue = process.env[envVar];
      if (envValue !== undefined) {
        let value: any = envValue;
        
        // Type conversions
        if (configKey.includes('timeout') || configKey.includes('refreshInterval')) {
          value = parseInt(envValue, 10);
        } else if (configKey.includes('verbose') || configKey.includes('colors')) {
          value = envValue.toLowerCase() === 'true';
        } else if (configKey === 'display.colors' && envVar === 'MCP_CLI_NO_COLOR') {
          value = !envValue; // NO_COLOR reverses the logic
        }
        
        this.set(configKey, value);
      }
    }
  }

  // Config file locations
  getConfigInfo(): {
    configPath: string;
    logsPath: string;
    cachePath: string;
    exists: boolean;
    readable: boolean;
    writable: boolean;
  } {
    return {
      configPath: this.configPath,
      logsPath: this.config.paths.logs,
      cachePath: this.config.paths.cache,
      exists: fs.existsSync(this.configPath),
      readable: fs.existsSync(this.configPath) && this.checkFileAccess(this.configPath, fs.constants.R_OK),
      writable: this.checkFileAccess(path.dirname(this.configPath), fs.constants.W_OK)
    };
  }

  // Initialize config directories
  initDirectories(): void {
    fs.ensureDirSync(this.config.paths.logs);
    fs.ensureDirSync(this.config.paths.cache);
  }

  // Helper method to check file access
  private checkFileAccess(filePath: string, mode: number): boolean {
    try {
      fs.accessSync(filePath, mode);
      return true;
    } catch {
      return false;
    }
  }
}