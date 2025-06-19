import { MemoryConfigService } from '../config/memory-config.service';
import { EmbeddingService } from './embedding.service';
import { DynamoDBStorageService } from './dynamodb-storage.service';
import { OpenSearchStorageService } from './opensearch-storage.service';
import { Neo4jGraphService } from './neo4j-graph.service';
import { MemoryMetadata, MemoryQuery, MemorySearchResult, StoreMemoryRequest, StoreMemoryResponse, RetrieveMemoriesRequest, RetrieveMemoriesResponse, AddConnectionRequest, AddConnectionResponse, CreateObservationRequest, CreateObservationResponse, ConsolidateMemoriesRequest, ConsolidateMemoriesResponse } from '../types/memory.types';
export declare class MemoryService {
    private readonly configService;
    private readonly embeddingService;
    private readonly dynamoDbService;
    private readonly openSearchService;
    private readonly neo4jService;
    private readonly logger;
    constructor(configService: MemoryConfigService, embeddingService: EmbeddingService, dynamoDbService: DynamoDBStorageService, openSearchService: OpenSearchStorageService, neo4jService: Neo4jGraphService);
    storeMemory(request: StoreMemoryRequest): Promise<StoreMemoryResponse>;
    retrieveMemories(request: RetrieveMemoriesRequest): Promise<RetrieveMemoriesResponse>;
    searchMemories(query: MemoryQuery): Promise<MemorySearchResult[]>;
    deleteMemory(memoryId: string): Promise<{
        success: boolean;
    }>;
    updateMemoryMetadata(memoryId: string, updates: Partial<MemoryMetadata>): Promise<void>;
    addConnection(request: AddConnectionRequest): Promise<AddConnectionResponse>;
    getAllMemories(request: any): Promise<{
        results: MemorySearchResult[];
        total_available: number;
    }>;
    createObservation(request: CreateObservationRequest): Promise<CreateObservationResponse>;
    consolidateMemories(request: ConsolidateMemoriesRequest): Promise<ConsolidateMemoriesResponse>;
    getMemoryStatistics(agentId?: string): Promise<any>;
    healthCheck(): Promise<{
        overall: boolean;
        services: {
            dynamodb: boolean;
            opensearch: boolean;
            neo4j: boolean;
        };
    }>;
    private createMemoryMetadata;
    private detectContentType;
    private detectMemoryType;
    private detectProgrammingLanguage;
    private extractFunctions;
    private extractImports;
    private extractCodePatterns;
    private assessCodeComplexity;
    private extractTopics;
    private analyzeSentiment;
    private extractEntities;
    private retrieveMemoriesByIds;
    private enhanceWithGraphRelationships;
    private ensureAgentNodeExists;
    private ensureSessionNodeExists;
    private autoCreateConceptRelationships;
    private extractConcepts;
    private findConsolidationCandidates;
    private consolidateMemoryPair;
    listAgents(project?: string): Promise<{
        agents: any[];
        total_count: number;
    }>;
    listProjects(includeStats?: boolean): Promise<{
        projects: any[];
        total_count: number;
    }>;
    private listProjectsFromLocal;
    retrieveConnections(params: {
        memory_id?: string;
        relationship_type?: string;
        limit?: number;
    }): Promise<{
        connections: any[];
        total_count: number;
    }>;
    connectionsByEntity(params: {
        entity_id: string;
        entity_type: 'memory' | 'agent' | 'session';
        limit?: number;
    }): Promise<{
        entity_id: string;
        entity_type: "memory" | "agent" | "session";
        connections: any[];
        total_count: number;
    }>;
    private findMemoriesByConcept;
    private calculateConceptSimilarity;
    private createCodeSpecificRelationships;
    private findCodeMemoriesByImport;
    private findCodeMemoriesByFunction;
    analyzeMemoryConnections(params: {
        memory_id?: string;
        agent_id?: string;
        project?: string;
        relationship_types?: string[];
        depth?: number;
        include_analytics?: boolean;
    }): Promise<any>;
    private generateConnectionInsights;
}
//# sourceMappingURL=memory.service.d.ts.map