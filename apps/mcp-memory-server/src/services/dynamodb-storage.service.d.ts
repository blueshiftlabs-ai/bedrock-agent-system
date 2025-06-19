import { ConfigService } from '@nestjs/config';
import { DynamoDBMemoryItem, MemoryMetadata, SessionContext, AgentProfile } from '../types/memory.types';
export declare class DynamoDBStorageService {
    private readonly configService;
    private readonly logger;
    private readonly dynamoDbClient;
    private readonly memoryTableName;
    private readonly sessionTableName;
    private readonly agentTableName;
    constructor(configService: ConfigService);
    storeMemoryMetadata(metadata: MemoryMetadata, opensearchId: string, neptuneNodeId?: string): Promise<void>;
    getMemoryMetadata(memoryId: string): Promise<DynamoDBMemoryItem | null>;
    updateMemoryMetadata(memoryId: string, updates: Partial<MemoryMetadata>): Promise<void>;
    deleteMemoryMetadata(memoryId: string): Promise<void>;
    getMemoriesByAgent(agentId: string, limit?: number): Promise<DynamoDBMemoryItem[]>;
    private updateAccessTracking;
    storeSessionContext(context: SessionContext): Promise<void>;
    getSessionContext(sessionId: string): Promise<SessionContext | null>;
    updateSessionWithMemory(sessionId: string, memoryId: string): Promise<void>;
    storeAgentProfile(profile: AgentProfile): Promise<void>;
    getAgentProfile(agentId: string): Promise<AgentProfile | null>;
    getAllMemoryMetadata(): Promise<any[]>;
    getAllMemories(): Promise<any[]>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=dynamodb-storage.service.d.ts.map