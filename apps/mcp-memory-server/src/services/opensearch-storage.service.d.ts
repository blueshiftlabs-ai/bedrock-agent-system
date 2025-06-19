import { Client } from '@opensearch-project/opensearch';
import { MemoryConfigService } from '../config/memory-config.service';
import { MemoryQuery, MemorySearchResult, StoredMemory, ContentType } from '../types/memory.types';
export declare class OpenSearchStorageService {
    private readonly configService;
    private readonly logger;
    private readonly opensearchClient;
    private readonly textIndexName;
    private readonly codeIndexName;
    private readonly vectorDimension;
    constructor(configService: MemoryConfigService);
    private initializeIndices;
    private createIndexIfNotExists;
    private getTextIndexMapping;
    private getCodeIndexMapping;
    storeMemory(memory: StoredMemory, embeddings: number[]): Promise<string>;
    searchMemories(query: MemoryQuery, queryEmbeddings: number[]): Promise<MemorySearchResult[]>;
    getMemoryByDocumentId(indexName: string, documentId: string): Promise<StoredMemory | null>;
    updateMemory(memoryId: string, content: string, embeddings: number[], contentType: ContentType): Promise<void>;
    getMemoryContent(memoryId: string, contentType: ContentType): Promise<string | null>;
    deleteMemory(memoryId: string, contentType: ContentType): Promise<void>;
    findSimilarMemories(embeddings: number[], contentType: ContentType, limit?: number, excludeMemoryId?: string): Promise<MemorySearchResult[]>;
    private documentToStoredMemory;
    getMemoryStatistics(agentId?: string): Promise<any>;
    healthCheck(): Promise<boolean>;
    getClient(): Client;
    getTextIndexName(): string;
    getCodeIndexName(): string;
}
//# sourceMappingURL=opensearch-storage.service.d.ts.map