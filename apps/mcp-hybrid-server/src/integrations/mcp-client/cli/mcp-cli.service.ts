import { Injectable, Logger } from '@nestjs/common';
import { Command } from 'commander';
import { MCPConfigService } from '../services/mcp-config.service';
import { MCPClientService } from '../services/mcp-client.service';
import { ToolDiscoveryService } from '../services/tool-discovery.service';
import { MCPServerConfig } from '../types/mcp-protocol.types';
import { getErrorMessage } from '@/common/utils/error-utils';

@Injectable()
export class MCPCliService {
  private readonly logger = new Logger(MCPCliService.name);
  private program: Command;

  constructor(
    private readonly configService: MCPConfigService,
    private readonly clientService: MCPClientService,
    private readonly discoveryService: ToolDiscoveryService
  ) {
    this.program = new Command();
    this.setupCommands();
  }

  /**
   * Execute CLI command
   */
  async executeCommand(args: string[]): Promise<void> {
    try {
      await this.program.parseAsync(args, { from: 'user' });
    } catch (error) {
      this.logger.error('CLI command failed:', error);
      throw error;
    }
  }

  /**
   * Get the commander program for external use
   */
  getProgram(): Command {
    return this.program;
  }

  private setupCommands(): void {
    this.program
      .name('mcp')
      .description('MCP Server Management CLI')
      .version('1.0.0');

    // Add server command
    this.program
      .command('add <name>')
      .description('Add a new MCP server')
      .option('-t, --transport <type>', 'Transport type (stdio, http, websocket)', 'stdio')
      .option('-c, --command <command>', 'Command to run (for stdio)')
      .option('-a, --args <args...>', 'Command arguments (for stdio)')
      .option('-u, --url <url>', 'Server URL (for http/websocket)')
      .option('-e, --env <env...>', 'Environment variables (key=value)')
      .option('--no-enabled', 'Add server in disabled state')
      .option('--auto-connect', 'Enable auto-connect')
      .action(async (name, options) => {
        await this.addServer(name, options);
      });

    // Remove server command
    this.program
      .command('remove <name>')
      .alias('rm')
      .description('Remove an MCP server')
      .action(async (name) => {
        await this.removeServer(name);
      });

    // List servers command
    this.program
      .command('list')
      .alias('ls')
      .description('List all MCP servers')
      .option('-v, --verbose', 'Show detailed information')
      .action(async (options) => {
        await this.listServers(options.verbose);
      });

    // Connect to server command
    this.program
      .command('connect <name>')
      .description('Connect to an MCP server')
      .action(async (name) => {
        await this.connectServer(name);
      });

    // Disconnect from server command
    this.program
      .command('disconnect <name>')
      .description('Disconnect from an MCP server')
      .action(async (name) => {
        await this.disconnectServer(name);
      });

    // Enable/disable server commands
    this.program
      .command('enable <name>')
      .description('Enable an MCP server')
      .action(async (name) => {
        await this.enableServer(name, true);
      });

    this.program
      .command('disable <name>')
      .description('Disable an MCP server')
      .action(async (name) => {
        await this.enableServer(name, false);
      });

    // Auto-connect commands
    this.program
      .command('auto-connect <name>')
      .description('Enable auto-connect for a server')
      .action(async (name) => {
        await this.setAutoConnect(name, true);
      });

    this.program
      .command('no-auto-connect <name>')
      .description('Disable auto-connect for a server')
      .action(async (name) => {
        await this.setAutoConnect(name, false);
      });

    // Discover tools command
    this.program
      .command('discover [name]')
      .description('Discover tools from MCP servers')
      .option('-r, --refresh', 'Refresh tools from all servers')
      .action(async (name, options) => {
        await this.discoverTools(name, options.refresh);
      });

    // List tools command
    this.program
      .command('tools [serverName]')
      .description('List available tools')
      .option('-e, --external-only', 'Show only external tools')
      .action(async (serverName, options) => {
        await this.listTools(serverName, options.externalOnly);
      });

    // Test tool command
    this.program
      .command('test <toolName>')
      .description('Test a tool execution')
      .option('-p, --params <params>', 'Tool parameters as JSON string')
      .action(async (toolName, options) => {
        await this.testTool(toolName, options.params);
      });

    // Import/export commands
    this.program
      .command('import <file>')
      .description('Import server configurations from file')
      .action(async (file) => {
        await this.importConfig(file);
      });

    this.program
      .command('export <file>')
      .description('Export server configurations to file')
      .action(async (file) => {
        await this.exportConfig(file);
      });

    // Sample configurations
    this.program
      .command('sample <type>')
      .description('Create sample configuration')
      .option('-n, --name <name>', 'Custom name for the server')
      .action(async (type, options) => {
        await this.createSample(type, options.name);
      });

    // Status command
    this.program
      .command('status')
      .description('Show MCP system status')
      .action(async () => {
        await this.showStatus();
      });
  }

  private async addServer(name: string, options: any): Promise<void> {
    try {
      const env: Record<string, string> = {};
      if (options.env) {
        for (const envVar of options.env) {
          const [key, value] = envVar.split('=');
          if (key && value) {
            env[key] = value;
          }
        }
      }

      const config: Omit<MCPServerConfig, 'id'> = {
        name,
        transport: options.transport,
        command: options.command,
        args: options.args,
        url: options.url,
        env: Object.keys(env).length > 0 ? env : undefined,
        enabled: options.enabled !== false,
        autoConnect: options.autoConnect || false,
      };

      const serverConfig = await this.configService.addServer(config);
      console.log(`✅ Added MCP server: ${serverConfig.name} (ID: ${serverConfig.id})`);
    } catch (error) {
      console.error(`❌ Failed to add server: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  private async removeServer(name: string): Promise<void> {
    try {
      const config = this.configService.getServerByName(name);
      if (!config) {
        throw new Error(`Server '${name}' not found`);
      }

      // Disconnect if connected
      const connection = this.clientService.getConnection(config.id);
      if (connection && connection.status === 'connected') {
        await this.clientService.disconnect(config.id);
      }

      await this.configService.removeServer(config.id);
      console.log(`✅ Removed MCP server: ${name}`);
    } catch (error) {
      console.error(`❌ Failed to remove server: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  private async listServers(verbose: boolean = false): Promise<void> {
    try {
      const servers = this.configService.getAllServers();
      
      if (servers.length === 0) {
        console.log('No MCP servers configured.');
        return;
      }

      console.log(`\nMCP Servers (${servers.length}):\n`);

      for (const server of servers) {
        const connection = this.clientService.getConnection(server.id);
        const status = connection ? connection.status : 'not connected';
        const statusIcon = this.getStatusIcon(status);
        
        console.log(`${statusIcon} ${server.name}`);
        
        if (verbose) {
          console.log(`   ID: ${server.id}`);
          console.log(`   Transport: ${server.transport}`);
          console.log(`   Enabled: ${server.enabled ? '✅' : '❌'}`);
          console.log(`   Auto-connect: ${server.autoConnect ? '✅' : '❌'}`);
          console.log(`   Status: ${status}`);
          
          if (server.transport === 'stdio' && server.command) {
            console.log(`   Command: ${server.command} ${(server.args || []).join(' ')}`);
          } else if (server.url) {
            console.log(`   URL: ${server.url}`);
          }
          
          if (connection && connection.serverInfo) {
            console.log(`   Server Version: ${connection.serverInfo.version}`);
          }
          
          console.log();
        }
      }
    } catch (error) {
      console.error(`❌ Failed to list servers: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  private async connectServer(name: string): Promise<void> {
    try {
      const config = this.configService.getServerByName(name);
      if (!config) {
        throw new Error(`Server '${name}' not found`);
      }

      if (!config.enabled) {
        throw new Error(`Server '${name}' is disabled`);
      }

      console.log(`🔄 Connecting to ${name}...`);
      const connection = await this.clientService.connect(config);
      console.log(`✅ Connected to ${name}`);
      
      // Discover tools
      console.log(`🔍 Discovering tools...`);
      const result = await this.discoveryService.discoverToolsFromConnection(connection);
      console.log(`✅ Discovered ${result.tools.length} tools`);
    } catch (error) {
      console.error(`❌ Failed to connect: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  private async disconnectServer(name: string): Promise<void> {
    try {
      const config = this.configService.getServerByName(name);
      if (!config) {
        throw new Error(`Server '${name}' not found`);
      }

      await this.clientService.disconnect(config.id);
      console.log(`✅ Disconnected from ${name}`);
    } catch (error) {
      console.error(`❌ Failed to disconnect: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  private async enableServer(name: string, enabled: boolean): Promise<void> {
    try {
      const config = this.configService.getServerByName(name);
      if (!config) {
        throw new Error(`Server '${name}' not found`);
      }

      await this.configService.toggleServerEnabled(config.id, enabled);
      console.log(`✅ Server ${name} ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error(`❌ Failed to ${enabled ? 'enable' : 'disable'} server: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  private async setAutoConnect(name: string, autoConnect: boolean): Promise<void> {
    try {
      const config = this.configService.getServerByName(name);
      if (!config) {
        throw new Error(`Server '${name}' not found`);
      }

      await this.configService.setAutoConnect(config.id, autoConnect);
      console.log(`✅ Auto-connect ${autoConnect ? 'enabled' : 'disabled'} for ${name}`);
    } catch (error) {
      console.error(`❌ Failed to set auto-connect: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  private async discoverTools(serverName?: string, refresh: boolean = false): Promise<void> {
    try {
      if (serverName) {
        const config = this.configService.getServerByName(serverName);
        if (!config) {
          throw new Error(`Server '${serverName}' not found`);
        }

        console.log(`🔍 Discovering tools from ${serverName}...`);
        const result = refresh 
          ? await this.discoveryService.refreshServerTools(config.id)
          : await this.discoveryService.discoverToolsFromConnection(
              this.clientService.getConnection(config.id)!
            );
        
        console.log(`✅ Discovered ${result.tools.length} tools from ${serverName}`);
      } else {
        console.log('🔍 Discovering tools from all connected servers...');
        const results = await this.discoveryService.discoverAllTools();
        const totalTools = results.reduce((sum, result) => sum + result.tools.length, 0);
        console.log(`✅ Discovered ${totalTools} tools from ${results.length} servers`);
      }
    } catch (error) {
      console.error(`❌ Failed to discover tools: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  private async listTools(serverName?: string, externalOnly: boolean = false): Promise<void> {
    try {
      let tools;
      
      if (serverName) {
        const config = this.configService.getServerByName(serverName);
        if (!config) {
          throw new Error(`Server '${serverName}' not found`);
        }
        tools = this.discoveryService.getExternalToolsByServer(config.id);
      } else if (externalOnly) {
        tools = this.discoveryService.getAllExternalTools();
      } else {
        // Get all tools from registry
        const { MCPToolRegistry } = await import('../../../tools/registry/tool.registry');
        // This would need to be injected properly in a real implementation
        throw new Error('Registry access not implemented in CLI context');
      }

      if (tools.length === 0) {
        console.log('No tools found.');
        return;
      }

      console.log(`\nTools (${tools.length}):\n`);
      
      for (const tool of tools) {
        console.log(`📦 ${tool.name}`);
        console.log(`   Description: ${tool.description}`);
        console.log(`   Category: ${tool.category}`);
        
        if ('metadata' in tool && tool.metadata) {
          console.log(`   Source: ${tool.metadata.sourceServer}`);
          console.log(`   Original Name: ${tool.metadata.originalName}`);
        }
        
        console.log();
      }
    } catch (error) {
      console.error(`❌ Failed to list tools: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  private async testTool(toolName: string, paramsString?: string): Promise<void> {
    try {
      const params = paramsString ? JSON.parse(paramsString) : {};
      
      console.log(`🧪 Testing tool: ${toolName}`);
      console.log(`Parameters: ${JSON.stringify(params, null, 2)}`);
      
      // This would need proper tool registry access
      throw new Error('Tool testing not implemented in CLI context');
    } catch (error) {
      console.error(`❌ Failed to test tool: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  private async importConfig(file: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const configData = await fs.readFile(file, 'utf-8');
      const config = JSON.parse(configData);
      
      await this.configService.importConfigurations(config);
      console.log(`✅ Imported configurations from ${file}`);
    } catch (error) {
      console.error(`❌ Failed to import config: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  private async exportConfig(file: string): Promise<void> {
    try {
      const config = this.configService.exportConfigurations();
      const fs = await import('fs/promises');
      
      await fs.writeFile(file, JSON.stringify(config, null, 2));
      console.log(`✅ Exported configurations to ${file}`);
    } catch (error) {
      console.error(`❌ Failed to export config: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  private async createSample(type: string, customName?: string): Promise<void> {
    try {
      const sampleConfig = this.configService.createSampleConfig(type as any);
      if (customName) {
        sampleConfig.name = customName;
      }
      
      const serverConfig = await this.configService.addServer(sampleConfig as Omit<MCPServerConfig, 'id'>);
      console.log(`✅ Created sample ${type} server: ${serverConfig.name}`);
      console.log(`💡 Remember to review and update the configuration as needed`);
    } catch (error) {
      console.error(`❌ Failed to create sample: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  private async showStatus(): Promise<void> {
    try {
      const servers = this.configService.getAllServers();
      const connections = this.clientService.getAllConnections();
      const externalTools = this.discoveryService.getAllExternalTools();
      
      console.log('\n📊 MCP System Status\n');
      console.log(`Total Servers: ${servers.length}`);
      console.log(`Enabled Servers: ${servers.filter(s => s.enabled).length}`);
      console.log(`Connected Servers: ${connections.filter(c => c.status === 'connected').length}`);
      console.log(`Auto-connect Servers: ${servers.filter(s => s.autoConnect).length}`);
      console.log(`External Tools: ${externalTools.length}`);
      
      const lastDiscovery = this.discoveryService.getLastDiscoveryRun();
      console.log(`Last Discovery: ${lastDiscovery ? lastDiscovery.toLocaleString() : 'Never'}`);
      console.log(`Discovery In Progress: ${this.discoveryService.isDiscoveryInProgress() ? 'Yes' : 'No'}`);
      
      console.log('\n🔗 Connection Status:');
      for (const server of servers) {
        const connection = connections.find(c => c.id === server.id);
        const status = connection ? connection.status : 'not connected';
        const statusIcon = this.getStatusIcon(status);
        console.log(`${statusIcon} ${server.name}: ${status}`);
      }
    } catch (error) {
      console.error(`❌ Failed to show status: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'connected': return '🟢';
      case 'connecting': return '🟡';
      case 'disconnected': return '⚪';
      case 'error': return '🔴';
      default: return '⚫';
    }
  }
}