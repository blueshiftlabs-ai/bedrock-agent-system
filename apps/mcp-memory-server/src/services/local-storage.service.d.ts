import { ConfigService } from '@nestjs/config';
import { DynamoDBMemoryItem, MemoryMetadata, SessionContext, AgentProfile } from '../types/memory.types';
export declare class LocalStorageService {
    private readonly configService;
    private readonly logger;
    private readonly dataDir;
    private readonly memoryFile;
    private readonly sessionFile;
    private readonly agentFile;
    constructor(configService: ConfigService);
    private initializeStorage;
    private readData;
    private writeData;
    storeMemoryMetadata(metadata: MemoryMetadata, opensearchId: string, neptuneNodeId?: string): Promise<void>;
    getMemoryMetadata(memoryId: string): Promise<DynamoDBMemoryItem | null>;
    deleteMemoryMetadata(memoryId: string): Promise<void>;
    updateMemoryAccess(memoryId: string): Promise<void>;
    getAllMemoryMetadata(): Promise<any[]>;
    storeSessionContext(context: SessionContext): Promise<void>;
    getSessionContext(sessionId: string): Promise<SessionContext | null>;
    updateSessionWithMemory(sessionId: string, memoryId: string): Promise<void>;
    storeAgentProfile(profile: AgentProfile): Promise<void>;
    getAgentProfile(agentId: string): Promise<AgentProfile | null>;
    getAllMemories(): Promise<any[]>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=local-storage.service.d.ts.map