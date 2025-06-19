import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient, PutItemCommand, GetItemCommand, UpdateItemCommand, DeleteItemCommand, QueryCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { 
  DynamoDBMemoryItem, 
  MemoryMetadata, 
  SessionContext, 
  AgentProfile 
} from '../types/memory.types';
import { getErrorMessage } from '../utils';

/**
 * DynamoDB storage service for memory metadata, sessions, and agent profiles
 * Handles persistent storage and caching for the memory system
 */
@Injectable()
export class DynamoDBStorageService {
  private readonly logger = new Logger(DynamoDBStorageService.name);
  private readonly dynamoDbClient: DynamoDBClient;
  private readonly memoryTableName: string;
  private readonly sessionTableName: string;
  private readonly agentTableName: string;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    const endpoint = this.configService.get<string>('AWS_ENDPOINT_URL_DYNAMODB');
    
    const clientConfig: any = { region };
    
    // Use local DynamoDB endpoint if configured
    if (endpoint) {
      clientConfig.endpoint = endpoint;
      clientConfig.credentials = {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', 'local'),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY', 'local')
      };
      this.logger.log(`Using local DynamoDB endpoint: ${endpoint}`);
    }
    
    this.dynamoDbClient = new DynamoDBClient(clientConfig);
    
    this.memoryTableName = this.configService.get<string>('MEMORY_TABLE_NAME', 'MemoryMetadata');
    this.sessionTableName = this.configService.get<string>('SESSION_TABLE_NAME', 'SessionManagement');
    this.agentTableName = this.configService.get<string>('AGENT_TABLE_NAME', 'AgentProfiles');
    
    this.logger.log('DynamoDB Storage Service initialized');
  }

  /**
   * Store memory metadata in DynamoDB
   */
  async storeMemoryMetadata(metadata: MemoryMetadata, opensearchId: string, neptuneNodeId?: string): Promise<void> {
    const item: DynamoDBMemoryItem = {
      PK: `MEMORY#${metadata.memory_id}`,
      SK: 'METADATA',
      memory_id: metadata.memory_id,
      type: metadata.type,
      content_type: metadata.content_type,
      agent_id: metadata.agent_id,
      session_id: metadata.session_id,
      project: metadata.project,
      created_at: metadata.created_at.getTime(),
      updated_at: metadata.updated_at.getTime(),
      ttl: metadata.ttl ? Math.floor(metadata.ttl.getTime() / 1000) : undefined,
      opensearch_index: metadata.content_type === 'text' ? 'memory-text' : 'memory-code',
      opensearch_id: opensearchId,
      neptune_node_id: neptuneNodeId,
      access_count: metadata.access_count,
      last_accessed: metadata.last_accessed.getTime(),
      tags: metadata.tags,
      confidence: metadata.confidence,
    };

    try {
      const command = new PutItemCommand({
        TableName: this.memoryTableName,
        Item: marshall(item, { removeUndefinedValues: true }),
      });

      await this.dynamoDbClient.send(command);
      this.logger.debug(`Stored memory metadata: ${metadata.memory_id}`);
    } catch (error) {
      this.logger.error(`Failed to store memory metadata: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Retrieve memory metadata from DynamoDB
   */
  async getMemoryMetadata(memoryId: string): Promise<DynamoDBMemoryItem | null> {
    try {
      const command = new GetItemCommand({
        TableName: this.memoryTableName,
        Key: marshall({
          PK: `MEMORY#${memoryId}`,
          SK: 'METADATA',
        }),
      });

      const response = await this.dynamoDbClient.send(command);
      
      if (!response.Item) {
        return null;
      }

      const item = unmarshall(response.Item) as DynamoDBMemoryItem;
      
      // Update access tracking
      await this.updateAccessTracking(memoryId);
      
      return item;
    } catch (error) {
      this.logger.error(`Failed to get memory metadata: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Update memory metadata
   */
  async updateMemoryMetadata(memoryId: string, updates: Partial<MemoryMetadata>): Promise<void> {
    try {
      const updateExpression: string[] = [];
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, any> = {};

      if (updates.agent_id) {
        updateExpression.push('#agent_id = :agent_id');
        expressionAttributeNames['#agent_id'] = 'agent_id';
        expressionAttributeValues[':agent_id'] = updates.agent_id;
      }

      if (updates.project) {
        updateExpression.push('#project = :project');
        expressionAttributeNames['#project'] = 'project';
        expressionAttributeValues[':project'] = updates.project;
      }

      if (updates.tags) {
        updateExpression.push('#tags = :tags');
        expressionAttributeNames['#tags'] = 'tags';
        expressionAttributeValues[':tags'] = updates.tags;
      }

      if (updates.confidence !== undefined) {
        updateExpression.push('#confidence = :confidence');
        expressionAttributeNames['#confidence'] = 'confidence';
        expressionAttributeValues[':confidence'] = updates.confidence;
      }

      // Always update the updated_at timestamp
      updateExpression.push('#updated_at = :updated_at');
      expressionAttributeNames['#updated_at'] = 'updated_at';
      expressionAttributeValues[':updated_at'] = Date.now();

      if (updateExpression.length === 0) {
        return; // No updates to make
      }

      const command = new UpdateItemCommand({
        TableName: this.memoryTableName,
        Key: marshall({
          PK: `MEMORY#${memoryId}`,
          SK: 'METADATA',
        }),
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: marshall(expressionAttributeValues),
      });

      await this.dynamoDbClient.send(command);
      this.logger.debug(`Updated memory metadata: ${memoryId}`);
    } catch (error) {
      this.logger.error(`Failed to update memory metadata: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Delete memory metadata
   */
  async deleteMemoryMetadata(memoryId: string): Promise<void> {
    try {
      const command = new DeleteItemCommand({
        TableName: this.memoryTableName,
        Key: marshall({
          PK: `MEMORY#${memoryId}`,
          SK: 'METADATA',
        }),
      });

      await this.dynamoDbClient.send(command);
      this.logger.debug(`Deleted memory metadata: ${memoryId}`);
    } catch (error) {
      this.logger.error(`Failed to delete memory metadata: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Get memories for a specific agent
   */
  async getMemoriesByAgent(agentId: string, limit: number = 50): Promise<DynamoDBMemoryItem[]> {
    try {
      // Using GSI on agent_id (assumes GSI exists)
      const command = new QueryCommand({
        TableName: this.memoryTableName,
        IndexName: 'AgentIndex', // GSI on agent_id
        KeyConditionExpression: 'agent_id = :agent_id',
        ExpressionAttributeValues: marshall({
          ':agent_id': agentId,
        }),
        Limit: limit,
        ScanIndexForward: false, // Most recent first
      });

      const response = await this.dynamoDbClient.send(command);
      
      return response.Items?.map(item => unmarshall(item) as DynamoDBMemoryItem) || [];
    } catch (error) {
      this.logger.error(`Failed to get memories by agent: ${getErrorMessage(error)}`);
      return [];
    }
  }

  /**
   * Update access tracking for a memory
   */
  private async updateAccessTracking(memoryId: string): Promise<void> {
    try {
      const command = new UpdateItemCommand({
        TableName: this.memoryTableName,
        Key: marshall({
          PK: `MEMORY#${memoryId}`,
          SK: 'METADATA',
        }),
        UpdateExpression: 'ADD access_count :inc SET last_accessed = :now',
        ExpressionAttributeValues: marshall({
          ':inc': 1,
          ':now': Date.now(),
        }),
      });

      await this.dynamoDbClient.send(command);
    } catch (error) {
      this.logger.warn(`Failed to update access tracking: ${getErrorMessage(error)}`);
      // Don't throw - this is non-critical
    }
  }

  /**
   * Store session context
   */
  async storeSessionContext(context: SessionContext): Promise<void> {
    const item = {
      PK: `SESSION#${context.session_id}`,
      SK: 'INFO',
      session_id: context.session_id,
      agent_id: context.agent_id,
      started_at: context.started_at.getTime(),
      last_activity: context.last_activity.getTime(),
      memory_count: context.memory_count,
      context_window_size: context.context_window_size,
      recent_memory_ids: context.recent_memory_ids,
    };

    try {
      const command = new PutItemCommand({
        TableName: this.sessionTableName,
        Item: marshall(item),
      });

      await this.dynamoDbClient.send(command);
      this.logger.debug(`Stored session context: ${context.session_id}`);
    } catch (error) {
      this.logger.error(`Failed to store session context: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Get session context
   */
  async getSessionContext(sessionId: string): Promise<SessionContext | null> {
    try {
      const command = new GetItemCommand({
        TableName: this.sessionTableName,
        Key: marshall({
          PK: `SESSION#${sessionId}`,
          SK: 'INFO',
        }),
      });

      const response = await this.dynamoDbClient.send(command);
      
      if (!response.Item) {
        return null;
      }

      const item = unmarshall(response.Item);
      
      return {
        session_id: item.session_id,
        agent_id: item.agent_id,
        started_at: new Date(item.started_at),
        last_activity: new Date(item.last_activity),
        memory_count: item.memory_count,
        context_window_size: item.context_window_size,
        recent_memory_ids: item.recent_memory_ids || [],
      };
    } catch (error) {
      this.logger.error(`Failed to get session context: ${getErrorMessage(error)}`);
      return null;
    }
  }

  /**
   * Update session with new memory
   */
  async updateSessionWithMemory(sessionId: string, memoryId: string): Promise<void> {
    try {
      const command = new UpdateItemCommand({
        TableName: this.sessionTableName,
        Key: marshall({
          PK: `SESSION#${sessionId}`,
          SK: 'INFO',
        }),
        UpdateExpression: 'ADD memory_count :inc SET last_activity = :now, recent_memory_ids = list_append(if_not_exists(recent_memory_ids, :empty_list), :memory_list)',
        ExpressionAttributeValues: marshall({
          ':inc': 1,
          ':now': Date.now(),
          ':empty_list': [],
          ':memory_list': [memoryId],
        }),
      });

      await this.dynamoDbClient.send(command);
    } catch (error) {
      this.logger.warn(`Failed to update session with memory: ${getErrorMessage(error)}`);
      // Non-critical operation
    }
  }

  /**
   * Store agent profile
   */
  async storeAgentProfile(profile: AgentProfile): Promise<void> {
    const item = {
      PK: `AGENT#${profile.agent_id}`,
      SK: 'PROFILE',
      agent_id: profile.agent_id,
      preferences: profile.preferences,
      learned_patterns: profile.learned_patterns,
      memory_statistics: profile.memory_statistics,
      updated_at: Date.now(),
    };

    try {
      const command = new PutItemCommand({
        TableName: this.agentTableName,
        Item: marshall(item),
      });

      await this.dynamoDbClient.send(command);
      this.logger.debug(`Stored agent profile: ${profile.agent_id}`);
    } catch (error) {
      this.logger.error(`Failed to store agent profile: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Get agent profile
   */
  async getAgentProfile(agentId: string): Promise<AgentProfile | null> {
    try {
      const command = new GetItemCommand({
        TableName: this.agentTableName,
        Key: marshall({
          PK: `AGENT#${agentId}`,
          SK: 'PROFILE',
        }),
      });

      const response = await this.dynamoDbClient.send(command);
      
      if (!response.Item) {
        return null;
      }

      const item = unmarshall(response.Item);
      
      return {
        agent_id: item.agent_id,
        preferences: item.preferences || {},
        learned_patterns: item.learned_patterns || [],
        memory_statistics: item.memory_statistics || {
          total_memories: 0,
          by_type: {},
          by_content_type: {},
          average_retrieval_time: 0,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get agent profile: ${getErrorMessage(error)}`);
      return null;
    }
  }

  /**
   * Get all memory metadata (for local retrieval)
   */
  async getAllMemoryMetadata(): Promise<any[]> {
    try {
      const command = new ScanCommand({
        TableName: this.memoryTableName,
        FilterExpression: 'SK = :sk',
        ExpressionAttributeValues: marshall({
          ':sk': 'METADATA',
        }),
      });

      const response = await this.dynamoDbClient.send(command);
      
      return response.Items?.map((item: any) => {
        const unmarshalled = unmarshall(item);
        return {
          ...unmarshalled,
          created_at: new Date(unmarshalled.created_at),
          updated_at: new Date(unmarshalled.updated_at),
          last_accessed: new Date(unmarshalled.last_accessed),
        };
      }) || [];
    } catch (error) {
      this.logger.error(`Failed to get all memory metadata: ${getErrorMessage(error)}`);
      return [];
    }
  }

  /**
   * Alias for getAllMemoryMetadata - for compatibility with memory service
   */
  async getAllMemories(): Promise<any[]> {
    return this.getAllMemoryMetadata();
  }

  /**
   * Health check for DynamoDB connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Simple health check - try to describe the table
      const command = new GetItemCommand({
        TableName: this.memoryTableName,
        Key: marshall({
          PK: 'HEALTH_CHECK',
          SK: 'TEST',
        }),
      });

      await this.dynamoDbClient.send(command);
      return true;
    } catch (error) {
      this.logger.error(`DynamoDB health check failed: ${getErrorMessage(error)}`);
      return false;
    }
  }
}