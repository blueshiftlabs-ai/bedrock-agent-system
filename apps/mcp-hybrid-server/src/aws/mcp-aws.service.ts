import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MCPClient } from '@packages/mcp-core';
import { MemoryMetadata, MemoryQuery } from '@packages/mcp-core';

/**
 * AWS service that orchestrates MCP microservices instead of direct AWS calls
 * This is the new architecture - containerized MCP servers for each AWS service
 */
@Injectable()
export class MCPAwsService {
  private readonly logger = new Logger(MCPAwsService.name);
  private readonly memoryClient: MCPClient;
  private readonly storageClient: MCPClient;
  private readonly bedrockClient: MCPClient;

  constructor(private readonly configService: ConfigService) {
    // Initialize MCP clients to containerized services
    this.memoryClient = new MCPClient({
      serverUrl: this.configService.get<string>('MCP_MEMORY_SERVER_URL', 'http://localhost:3001'),
    });

    this.storageClient = new MCPClient({
      serverUrl: this.configService.get<string>('MCP_STORAGE_SERVER_URL', 'http://localhost:3002'),
    });

    this.bedrockClient = new MCPClient({
      serverUrl: this.configService.get<string>('MCP_BEDROCK_SERVER_URL', 'http://localhost:3003'),
    });

    this.logger.log('MCP AWS Service initialized with containerized MCP servers');
  }

  /**
   * Memory Operations via MCP Memory Server
   */
  async storeMemory(content: string, metadata: Partial<MemoryMetadata>): Promise<string> {
    try {
      const result = await this.memoryClient.executeTool('store-memory', {
        content,
        ...metadata,
      });
      return result.memoryId || result;
    } catch (error) {
      this.logger.error('Failed to store memory via MCP:', error);
      throw error;
    }
  }

  async retrieveMemories(query: MemoryQuery): Promise<MemoryMetadata[]> {
    try {
      return await this.memoryClient.executeTool('retrieve-memories', query);
    } catch (error) {
      this.logger.error('Failed to retrieve memories via MCP:', error);
      throw error;
    }
  }

  async associateMemories(memoryIds: string[], relationship: string): Promise<void> {
    try {
      await this.memoryClient.executeTool('associate-memories', {
        memoryIds,
        relationship,
      });
    } catch (error) {
      this.logger.error('Failed to associate memories via MCP:', error);
      throw error;
    }
  }

  /**
   * Storage Operations via MCP Storage Server
   */
  async storeFile(bucket: string, key: string, data: string | Buffer, contentType?: string): Promise<string> {
    try {
      const result = await this.storageClient.executeTool('store-file', {
        bucket,
        key,
        data: Buffer.isBuffer(data) ? data.toString('base64') : data,
        contentType,
      });
      return result.url || result;
    } catch (error) {
      this.logger.error('Failed to store file via MCP:', error);
      throw error;
    }
  }

  async getFile(bucket: string, key: string): Promise<Buffer | null> {
    try {
      const result = await this.storageClient.executeTool('get-file', {
        bucket,
        key,
      });
      
      if (!result || !result.data) return null;
      
      // Convert base64 back to buffer
      return Buffer.from(result.data, 'base64');
    } catch (error) {
      this.logger.error('Failed to get file via MCP:', error);
      return null;
    }
  }

  /**
   * Bedrock Operations via MCP Bedrock Server
   */
  async invokeModel(modelId: string, prompt: string, options?: any): Promise<string> {
    try {
      const result = await this.bedrockClient.executeTool('invoke-model', {
        modelId,
        prompt,
        ...options,
      });
      return result.content || result;
    } catch (error) {
      this.logger.error('Failed to invoke Bedrock model via MCP:', error);
      throw error;
    }
  }

  async generateEmbeddings(text: string, modelId?: string): Promise<number[]> {
    try {
      const result = await this.bedrockClient.executeTool('generate-embeddings', {
        text,
        modelId,
      });
      return result.embeddings || result;
    } catch (error) {
      this.logger.error('Failed to generate embeddings via MCP:', error);
      throw error;
    }
  }

  async queryKnowledgeBase(knowledgeBaseId: string, query: string): Promise<any> {
    try {
      return await this.bedrockClient.executeTool('query-knowledge-base', {
        knowledgeBaseId,
        query,
      });
    } catch (error) {
      this.logger.error('Failed to query knowledge base via MCP:', error);
      throw error;
    }
  }

  /**
   * Health checks for all MCP services
   */
  async healthCheck(): Promise<{ memory: boolean; storage: boolean; bedrock: boolean }> {
    const [memory, storage, bedrock] = await Promise.all([
      this.memoryClient.healthCheck(),
      this.storageClient.healthCheck(),
      this.bedrockClient.healthCheck(),
    ]);

    return { memory, storage, bedrock };
  }

  /**
   * Get information about available tools from all MCP services
   */
  async getMCPToolsInfo(): Promise<any> {
    try {
      const [memoryInfo, storageInfo, bedrockInfo] = await Promise.all([
        this.memoryClient.getServerInfo(),
        this.storageClient.getServerInfo(),
        this.bedrockClient.getServerInfo(),
      ]);

      return {
        memory: memoryInfo,
        storage: storageInfo,
        bedrock: bedrockInfo,
      };
    } catch (error) {
      this.logger.error('Failed to get MCP tools info:', error);
      return {};
    }
  }
}