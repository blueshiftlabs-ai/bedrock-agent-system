import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  DynamoDBMemoryItem, 
  MemoryMetadata, 
  SessionContext, 
  AgentProfile 
} from '../types/memory.types';

/**
 * Local file-based storage service for development
 * Mimics DynamoDB functionality using JSON files
 */
@Injectable()
export class LocalStorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly dataDir: string;
  private readonly memoryFile: string;
  private readonly sessionFile: string;
  private readonly agentFile: string;

  constructor(private readonly configService: ConfigService) {
    this.dataDir = path.join(process.cwd(), '.local-memory-db');
    this.memoryFile = path.join(this.dataDir, 'memory-metadata.json');
    this.sessionFile = path.join(this.dataDir, 'sessions.json');
    this.agentFile = path.join(this.dataDir, 'agents.json');
    
    this.initializeStorage();
    this.logger.log('Local Storage Service initialized (DynamoDB substitute)');
  }

  private async initializeStorage() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      
      // Initialize files if they don't exist
      const files = [this.memoryFile, this.sessionFile, this.agentFile];
      for (const file of files) {
        try {
          await fs.access(file);
        } catch {
          await fs.writeFile(file, '{}');
        }
      }
    } catch (error) {
      this.logger.error(`Failed to initialize local storage: ${error.message}`);
    }
  }

  private async readData(file: string): Promise<Record<string, any>> {
    try {
      const data = await fs.readFile(file, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  private async writeData(file: string, data: Record<string, any>): Promise<void> {
    await fs.writeFile(file, JSON.stringify(data, null, 2));
  }

  /**
   * Store memory metadata
   */
  async storeMemoryMetadata(metadata: MemoryMetadata, opensearchId: string, neptuneNodeId?: string): Promise<void> {
    this.logger.log(`LocalStorageService: Storing memory metadata for ${metadata.memory_id}`);
    const data = await this.readData(this.memoryFile);
    
    const item: DynamoDBMemoryItem = {
      PK: `MEMORY#${metadata.memory_id}`,
      SK: 'METADATA',
      memory_id: metadata.memory_id,
      type: metadata.type,
      content_type: metadata.content_type,
      agent_id: metadata.agent_id,
      session_id: metadata.session_id,
      created_at: metadata.created_at.getTime(),
      updated_at: metadata.updated_at.getTime(),
      ttl: metadata.ttl ? Math.floor(metadata.ttl.getTime() / 1000) : undefined,
      opensearch_index: metadata.content_type === 'text' ? 'memory-text' : 'memory-code',
      opensearch_id: opensearchId,
      neptune_node_id: neptuneNodeId,
      tags: metadata.tags,
      access_count: metadata.access_count,
      last_accessed: metadata.last_accessed.getTime(),
      confidence: metadata.confidence,
      // Type-specific fields
      ...(metadata.content_type === 'code' && {
        programming_language: (metadata as any).programming_language,
        functions: (metadata as any).functions,
        imports: (metadata as any).imports,
        patterns: (metadata as any).patterns,
        complexity: (metadata as any).complexity,
      }),
      ...(metadata.content_type === 'text' && {
        language: (metadata as any).language,
        topics: (metadata as any).topics,
        sentiment: (metadata as any).sentiment,
        entities: (metadata as any).entities,
      }),
    };

    data[item.PK] = item;
    await this.writeData(this.memoryFile, data);
  }

  /**
   * Get memory metadata
   */
  async getMemoryMetadata(memoryId: string): Promise<DynamoDBMemoryItem | null> {
    const data = await this.readData(this.memoryFile);
    const key = `MEMORY#${memoryId}`;
    return data[key] || null;
  }

  /**
   * Delete memory metadata
   */
  async deleteMemoryMetadata(memoryId: string): Promise<void> {
    const data = await this.readData(this.memoryFile);
    const key = `MEMORY#${memoryId}`;
    delete data[key];
    await this.writeData(this.memoryFile, data);
  }

  /**
   * Update memory access metadata
   */
  async updateMemoryAccess(memoryId: string): Promise<void> {
    const data = await this.readData(this.memoryFile);
    const key = `MEMORY#${memoryId}`;
    
    if (data[key]) {
      data[key].access_count = (data[key].access_count || 0) + 1;
      data[key].last_accessed = Date.now();
      await this.writeData(this.memoryFile, data);
    }
  }

  /**
   * Store session context
   */
  async storeSessionContext(context: SessionContext): Promise<void> {
    const data = await this.readData(this.sessionFile);
    
    const item = {
      PK: `SESSION#${context.session_id}`,
      SK: 'INFO',
      session_id: context.session_id,
      agent_id: context.agent_id,
      started_at: context.started_at.getTime(),
      last_activity: context.last_activity.getTime(),
      memory_count: context.memory_count,
      context_metadata: context.context_metadata,
      recent_memory_ids: context.recent_memory_ids,
      active: context.active,
    };

    data[item.PK] = item;
    await this.writeData(this.sessionFile, data);
  }

  /**
   * Get session context
   */
  async getSessionContext(sessionId: string): Promise<SessionContext | null> {
    const data = await this.readData(this.sessionFile);
    const key = `SESSION#${sessionId}`;
    
    if (!data[key]) return null;
    
    const item = data[key];
    return {
      session_id: item.session_id,
      agent_id: item.agent_id,
      started_at: new Date(item.started_at),
      last_activity: new Date(item.last_activity),
      memory_count: item.memory_count,
      context_metadata: item.context_metadata,
      recent_memory_ids: item.recent_memory_ids,
      active: item.active,
    };
  }

  /**
   * Update session with new memory
   */
  async updateSessionWithMemory(sessionId: string, memoryId: string): Promise<void> {
    const data = await this.readData(this.sessionFile);
    const key = `SESSION#${sessionId}`;
    
    if (data[key]) {
      data[key].memory_count = (data[key].memory_count || 0) + 1;
      data[key].last_activity = Date.now();
      data[key].recent_memory_ids = data[key].recent_memory_ids || [];
      data[key].recent_memory_ids.push(memoryId);
      
      // Keep only last 10 memory IDs
      if (data[key].recent_memory_ids.length > 10) {
        data[key].recent_memory_ids = data[key].recent_memory_ids.slice(-10);
      }
      
      await this.writeData(this.sessionFile, data);
    }
  }

  /**
   * Store agent profile
   */
  async storeAgentProfile(profile: AgentProfile): Promise<void> {
    const data = await this.readData(this.agentFile);
    
    const item = {
      PK: `AGENT#${profile.agent_id}`,
      SK: 'PROFILE',
      agent_id: profile.agent_id,
      preferences: profile.preferences,
      learned_patterns: profile.learned_patterns,
      memory_statistics: profile.memory_statistics,
      updated_at: Date.now(),
    };

    data[item.PK] = item;
    await this.writeData(this.agentFile, data);
  }

  /**
   * Get agent profile
   */
  async getAgentProfile(agentId: string): Promise<AgentProfile | null> {
    const data = await this.readData(this.agentFile);
    const key = `AGENT#${agentId}`;
    
    if (!data[key]) return null;
    
    const item = data[key];
    return {
      agent_id: item.agent_id,
      preferences: item.preferences,
      learned_patterns: item.learned_patterns,
      memory_statistics: item.memory_statistics,
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await fs.access(this.dataDir);
      return true;
    } catch {
      return false;
    }
  }
}