import { Injectable, Logger } from '@nestjs/common';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { MCPServerConfig } from '../types/mcp-protocol.types';
import { v4 as uuidv4 } from 'uuid';

export interface MCPConfigFile {
  version: string;
  servers: MCPServerConfig[];
  lastUpdated: string;
}

@Injectable()
export class MCPConfigService {
  private readonly logger = new Logger(MCPConfigService.name);
  private readonly configDir = join(process.cwd(), '.mcp');
  private readonly configFile = join(this.configDir, 'servers.json');
  private configs: Map<string, MCPServerConfig> = new Map();

  async onModuleInit() {
    await this.loadConfigurations();
  }

  /**
   * Load MCP server configurations from file
   */
  async loadConfigurations(): Promise<void> {
    try {
      if (!existsSync(this.configFile)) {
        this.logger.log('No MCP configuration file found, starting with empty configuration');
        return;
      }

      const configData = await readFile(this.configFile, 'utf-8');
      const config: MCPConfigFile = JSON.parse(configData);

      this.configs.clear();
      for (const serverConfig of config.servers) {
        this.configs.set(serverConfig.id, serverConfig);
      }

      this.logger.log(`Loaded ${config.servers.length} MCP server configurations`);
    } catch (error: any) {
      this.logger.error('Failed to load MCP configurations:', error);
      throw error;
    }
  }

  /**
   * Save MCP server configurations to file
   */
  async saveConfigurations(): Promise<void> {
    try {
      // Ensure config directory exists
      if (!existsSync(this.configDir)) {
        await mkdir(this.configDir, { recursive: true });
      }

      const config: MCPConfigFile = {
        version: '1.0.0',
        servers: Array.from(this.configs.values()),
        lastUpdated: new Date().toISOString(),
      };

      await writeFile(this.configFile, JSON.stringify(config, null, 2));
      this.logger.log('MCP configurations saved successfully');
    } catch (error: any) {
      this.logger.error('Failed to save MCP configurations:', error);
      throw error;
    }
  }

  /**
   * Add a new MCP server configuration
   */
  async addServer(config: Omit<MCPServerConfig, 'id'>): Promise<MCPServerConfig> {
    const serverConfig: MCPServerConfig = {
      ...config,
      id: uuidv4(),
    };

    // Validate configuration
    this.validateServerConfig(serverConfig);

    // Check for duplicate names
    const existingNames = Array.from(this.configs.values()).map(c => c.name);
    if (existingNames.includes(serverConfig.name)) {
      throw new Error(`Server with name '${serverConfig.name}' already exists`);
    }

    this.configs.set(serverConfig.id, serverConfig);
    await this.saveConfigurations();

    this.logger.log(`Added MCP server configuration: ${serverConfig.name}`);
    return serverConfig;
  }

  /**
   * Update an existing MCP server configuration
   */
  async updateServer(id: string, updates: Partial<MCPServerConfig>): Promise<MCPServerConfig> {
    const existingConfig = this.configs.get(id);
    if (!existingConfig) {
      throw new Error(`Server configuration with ID '${id}' not found`);
    }

    const updatedConfig: MCPServerConfig = {
      ...existingConfig,
      ...updates,
      id, // Ensure ID doesn't change
    };

    // Validate updated configuration
    this.validateServerConfig(updatedConfig);

    // Check for duplicate names (excluding current server)
    const existingNames = Array.from(this.configs.values())
      .filter(c => c.id !== id)
      .map(c => c.name);
    
    if (existingNames.includes(updatedConfig.name)) {
      throw new Error(`Server with name '${updatedConfig.name}' already exists`);
    }

    this.configs.set(id, updatedConfig);
    await this.saveConfigurations();

    this.logger.log(`Updated MCP server configuration: ${updatedConfig.name}`);
    return updatedConfig;
  }

  /**
   * Remove an MCP server configuration
   */
  async removeServer(id: string): Promise<void> {
    const config = this.configs.get(id);
    if (!config) {
      throw new Error(`Server configuration with ID '${id}' not found`);
    }

    this.configs.delete(id);
    await this.saveConfigurations();

    this.logger.log(`Removed MCP server configuration: ${config.name}`);
  }

  /**
   * Get a specific server configuration
   */
  getServer(id: string): MCPServerConfig | undefined {
    return this.configs.get(id);
  }

  /**
   * Get server configuration by name
   */
  getServerByName(name: string): MCPServerConfig | undefined {
    return Array.from(this.configs.values()).find(config => config.name === name);
  }

  /**
   * Get all server configurations
   */
  getAllServers(): MCPServerConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Get enabled server configurations
   */
  getEnabledServers(): MCPServerConfig[] {
    return Array.from(this.configs.values()).filter(config => config.enabled);
  }

  /**
   * Get auto-connect server configurations
   */
  getAutoConnectServers(): MCPServerConfig[] {
    return Array.from(this.configs.values()).filter(config => config.enabled && config.autoConnect);
  }

  /**
   * Enable/disable a server
   */
  async toggleServerEnabled(id: string, enabled: boolean): Promise<MCPServerConfig> {
    return await this.updateServer(id, { enabled });
  }

  /**
   * Set auto-connect for a server
   */
  async setAutoConnect(id: string, autoConnect: boolean): Promise<MCPServerConfig> {
    return await this.updateServer(id, { autoConnect });
  }

  /**
   * Import configurations from a file or object
   */
  async importConfigurations(configs: MCPServerConfig[] | MCPConfigFile): Promise<void> {
    const servers = Array.isArray(configs) ? configs : configs.servers;
    
    for (const config of servers) {
      // Generate new ID if not present or if it conflicts
      if (!config.id || this.configs.has(config.id)) {
        config.id = uuidv4();
      }

      // Validate configuration
      this.validateServerConfig(config);

      // Check for duplicate names and adjust if necessary
      let name = config.name;
      let counter = 1;
      while (Array.from(this.configs.values()).some(c => c.name === name)) {
        name = `${config.name}_${counter}`;
        counter++;
      }
      config.name = name;

      this.configs.set(config.id, config);
    }

    await this.saveConfigurations();
    this.logger.log(`Imported ${servers.length} MCP server configurations`);
  }

  /**
   * Export configurations
   */
  exportConfigurations(): MCPConfigFile {
    return {
      version: '1.0.0',
      servers: Array.from(this.configs.values()),
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Create a sample configuration for common MCP servers
   */
  createSampleConfig(type: 'sequential-thinking' | 'filesystem' | 'brave-search' | 'custom'): Partial<MCPServerConfig> {
    switch (type) {
      case 'sequential-thinking':
        return {
          name: 'Sequential Thinking',
          transport: 'stdio',
          command: 'npx',
          args: ['-y', '@anthropic-ai/mcp-server-sequential-thinking'],
          enabled: true,
          autoConnect: false,
        };

      case 'filesystem':
        return {
          name: 'Filesystem',
          transport: 'stdio',
          command: 'npx',
          args: ['-y', '@anthropic-ai/mcp-server-filesystem', process.cwd()],
          enabled: true,
          autoConnect: false,
        };

      case 'brave-search':
        return {
          name: 'Brave Search',
          transport: 'stdio',
          command: 'npx',
          args: ['-y', '@anthropic-ai/mcp-server-brave-search'],
          env: {
            BRAVE_API_KEY: 'your-api-key-here',
          },
          enabled: false,
          autoConnect: false,
        };

      case 'custom':
        return {
          name: 'Custom MCP Server',
          transport: 'stdio',
          command: 'node',
          args: ['path/to/your/mcp-server.js'],
          enabled: false,
          autoConnect: false,
        };

      default:
        throw new Error(`Unknown sample type: ${type}`);
    }
  }

  private validateServerConfig(config: MCPServerConfig): void {
    if (!config.name || config.name.trim() === '') {
      throw new Error('Server name is required');
    }

    if (!config.transport) {
      throw new Error('Transport type is required');
    }

    switch (config.transport) {
      case 'stdio':
        if (!config.command || config.command.trim() === '') {
          throw new Error('Command is required for stdio transport');
        }
        break;

      case 'http':
      case 'websocket':
        if (!config.url || config.url.trim() === '') {
          throw new Error('URL is required for HTTP/WebSocket transport');
        }
        break;

      default:
        throw new Error(`Unsupported transport type: ${config.transport}`);
    }

    if (typeof config.enabled !== 'boolean') {
      throw new Error('Enabled must be a boolean value');
    }

    if (typeof config.autoConnect !== 'boolean') {
      throw new Error('AutoConnect must be a boolean value');
    }
  }
}