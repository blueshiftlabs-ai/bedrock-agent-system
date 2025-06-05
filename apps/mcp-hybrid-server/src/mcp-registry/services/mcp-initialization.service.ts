import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MCPServerDiscoveryService } from './mcp-server-discovery.service';

@Injectable()
export class MCPInitializationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MCPInitializationService.name);

  constructor(
    private readonly discoveryService: MCPServerDiscoveryService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onApplicationBootstrap() {
    this.logger.log('Initializing MCP Gateway services...');
    
    // Register memory server with EventAggregatorService
    setTimeout(() => {
      this.eventEmitter.emit('mcp.server.registered', {
        id: 'memory-server',
        name: 'Memory Server',
        url: 'http://localhost:4100',
        status: 'connecting',
        config: {
          id: 'memory-server',
          name: 'Memory Server',
          url: 'http://localhost:4100',
          protocol: 'http',
          healthCheck: '/health',
          capabilities: ['memory', 'vector-search', 'graph'],
          timeout: 5000,
          retryAttempts: 3,
          healthCheckInterval: 30000,
        },
      });

      this.logger.log('MCP Gateway initialization complete');
      this.logger.log('📡 WebSocket server ready for dashboard connections on port 4101');
      this.logger.log('🔍 Server discovery monitoring: memory-server, storage-server, bedrock-server');
      this.logger.log('🛠️  Tool registry ready for dynamic tool discovery');
    }, 1000);
  }
}