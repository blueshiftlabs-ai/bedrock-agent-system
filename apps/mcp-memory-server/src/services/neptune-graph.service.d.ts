import { OnModuleDestroy } from '@nestjs/common';
import { MemoryConfigService } from '../config/memory-config.service';
import { GraphConnection, ConceptNode, MemoryMetadata } from '../types/memory.types';
export declare class NeptuneGraphService implements OnModuleDestroy {
    private readonly configService;
    private readonly logger;
    private gremlinConnection;
    private g;
    constructor(configService: MemoryConfigService);
    private initializeConnection;
    private initializeGraphSchema;
    createMemoryNode(memory: MemoryMetadata): Promise<string>;
    createConceptNode(concept: ConceptNode): Promise<string>;
    createAgentNode(agentId: string, agentType?: string): Promise<string>;
    createSessionNode(sessionId: string, agentId: string): Promise<string>;
    addConnection(connection: GraphConnection): Promise<string>;
    findConnections(memoryId: string, relationshipTypes?: string[], maxDepth?: number): Promise<GraphConnection[]>;
    findSimilarMemoriesGraph(memoryId: string, maxResults?: number): Promise<string[]>;
    createObservation(agentId: string, observation: string, relatedMemoryIds?: string[]): Promise<{
        observationId: string;
        connectionsCreated: number;
    }>;
    getMemoryPath(fromMemoryId: string, toMemoryId: string, maxDepth?: number): Promise<GraphConnection[]>;
    deleteMemoryNode(memoryId: string): Promise<void>;
    getGraphStatistics(agentId?: string): Promise<any>;
    healthCheck(): Promise<boolean>;
    private extractEdgeProperties;
    private extractVertexId;
    onModuleDestroy(): Promise<void>;
}
//# sourceMappingURL=neptune-graph.service.d.ts.map