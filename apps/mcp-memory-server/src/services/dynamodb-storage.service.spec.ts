import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DynamoDBStorageService } from './dynamodb-storage.service';
import { MemoryMetadata, MemoryType, ContentType } from '../types/memory.types';

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/util-dynamodb');

describe('DynamoDBStorageService', () => {
  let service: DynamoDBStorageService;
  let configService: ConfigService;

  const mockPutItemCommand = jest.fn();
  const mockGetItemCommand = jest.fn();
  const mockScanCommand = jest.fn();
  const mockSend = jest.fn();
  const mockMarshall = jest.fn();
  const mockUnmarshall = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock the AWS SDK
    const { DynamoDBClient, PutItemCommand, GetItemCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
    const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');

    DynamoDBClient.mockImplementation(() => ({
      send: mockSend,
    }));

    PutItemCommand.mockImplementation(mockPutItemCommand);
    GetItemCommand.mockImplementation(mockGetItemCommand);
    ScanCommand.mockImplementation(mockScanCommand);
    marshall.mockImplementation(mockMarshall);
    unmarshall.mockImplementation(mockUnmarshall);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DynamoDBStorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config = {
                AWS_REGION: 'us-east-1',
                AWS_ENDPOINT_URL_DYNAMODB: 'http://localhost:8000',
                AWS_ACCESS_KEY_ID: 'local',
                AWS_SECRET_ACCESS_KEY: 'local',
                MEMORY_TABLE_NAME: 'MemoryMetadata',
                SESSION_TABLE_NAME: 'SessionManagement',
                AGENT_TABLE_NAME: 'AgentProfiles',
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<DynamoDBStorageService>(DynamoDBStorageService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('storeMemoryMetadata', () => {
    it('should store memory metadata with project field', async () => {
      const mockMetadata: MemoryMetadata = {
        memory_id: 'mem_test_123',
        type: 'semantic' as MemoryType,
        content_type: 'text' as ContentType,
        agent_id: 'test-agent',
        session_id: 'test-session',
        project: 'bedrock-agent-system',
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z'),
        tags: ['test'],
        access_count: 0,
        last_accessed: new Date('2024-01-01T00:00:00Z'),
      };

      const opensearchId = 'opensearch_123';
      mockMarshall.mockReturnValue({ marshalled: 'data' });
      mockSend.mockResolvedValue({});

      await service.storeMemoryMetadata(mockMetadata, opensearchId);

      expect(mockPutItemCommand).toHaveBeenCalledWith({
        TableName: 'MemoryMetadata',
        Item: { marshalled: 'data' },
      });

      expect(mockMarshall).toHaveBeenCalledWith(
        expect.objectContaining({
          PK: 'MEMORY#mem_test_123',
          SK: 'METADATA',
          memory_id: 'mem_test_123',
          type: 'semantic',
          content_type: 'text',
          agent_id: 'test-agent',
          session_id: 'test-session',
          project: 'bedrock-agent-system', // This should be included
          created_at: 1704067200000,
          updated_at: 1704067200000,
          opensearch_index: 'memory-text',
          opensearch_id: 'opensearch_123',
          access_count: 0,
          last_accessed: 1704067200000,
          tags: ['test'],
        }),
        { removeUndefinedValues: true }
      );

      expect(mockSend).toHaveBeenCalled();
    });

    it('should handle missing project field gracefully', async () => {
      const mockMetadata: MemoryMetadata = {
        memory_id: 'mem_test_456',
        type: 'episodic' as MemoryType,
        content_type: 'code' as ContentType,
        agent_id: 'test-agent',
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z'),
        tags: [],
        access_count: 0,
        last_accessed: new Date('2024-01-01T00:00:00Z'),
        // project field is undefined
      };

      const opensearchId = 'opensearch_456';
      mockMarshall.mockReturnValue({ marshalled: 'data' });
      mockSend.mockResolvedValue({});

      await service.storeMemoryMetadata(mockMetadata, opensearchId);

      expect(mockMarshall).toHaveBeenCalledWith(
        expect.objectContaining({
          project: undefined, // Should handle undefined gracefully
        }),
        { removeUndefinedValues: true }
      );
    });
  });

  describe('getAllMemories', () => {
    it('should retrieve all memories with project field', async () => {
      const mockItems = [
        {
          PK: 'MEMORY#mem_1',
          SK: 'METADATA',
          memory_id: 'mem_1',
          project: 'bedrock-agent-system',
          agent_id: 'test-agent',
          created_at: 1704067200000,
          updated_at: 1704067200000,
          last_accessed: 1704067200000,
        },
        {
          PK: 'MEMORY#mem_2',
          SK: 'METADATA',
          memory_id: 'mem_2',
          project: 'another-project',
          agent_id: 'test-agent-2',
          created_at: 1704067200000,
          updated_at: 1704067200000,
          last_accessed: 1704067200000,
        }
      ];

      mockSend.mockResolvedValue({ Items: mockItems });
      mockUnmarshall.mockImplementation((item) => item);
      mockMarshall.mockReturnValue({ marshalled: 'data' });

      const result = await service.getAllMemories();

      expect(mockScanCommand).toHaveBeenCalledWith({
        TableName: 'MemoryMetadata',
        FilterExpression: 'SK = :sk',
        ExpressionAttributeValues: { marshalled: 'data' },
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(expect.objectContaining({
        memory_id: 'mem_1',
        project: 'bedrock-agent-system',
        agent_id: 'test-agent',
      }));
      expect(result[1]).toEqual(expect.objectContaining({
        memory_id: 'mem_2',
        project: 'another-project',
        agent_id: 'test-agent-2',
      }));
    });

    it('should handle empty result gracefully', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      const result = await service.getAllMemories();

      expect(result).toEqual([]);
    });

    it('should handle DynamoDB errors gracefully', async () => {
      mockSend.mockRejectedValue(new Error('DynamoDB connection failed'));

      const result = await service.getAllMemories();

      expect(result).toEqual([]);
    });
  });
});