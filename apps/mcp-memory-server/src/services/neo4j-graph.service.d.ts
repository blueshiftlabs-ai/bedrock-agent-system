import { OnModuleDestroy } from '@nestjs/common';
import { MemoryConfigService } from '../config/memory-config.service';
import { ConceptNode, MemoryMetadata } from '../types/memory.types';
export declare class Neo4jGraphService implements OnModuleDestroy {
    private readonly configService;
    private readonly logger;
    private driver;
    constructor(configService: MemoryConfigService);
    private initializeConnection;
    private initializeGraphSchema;
    createMemoryNode(memoryMetadata: MemoryMetadata, content: string): Promise<string | null>;
    addConnection(fromMemoryId: string, toMemoryId: string, relationshipType: string, properties?: Record<string, any>): Promise<boolean>;
    getRelatedMemories(memoryId: string, depth?: number): Promise<ConceptNode[]>;
    findConceptClusters(agentId?: string): Promise<ConceptNode[]>;
    updateMemoryAccess(memoryId: string): Promise<void>;
    deleteMemory(memoryId: string): Promise<boolean>;
    getConnections(memoryId?: string, relationshipType?: string, limit?: number): Promise<any[]>;
    getEntityConnections(entityId: string, entityType: 'memory' | 'agent' | 'session', limit?: number): Promise<any[]>;
    onModuleDestroy(): Promise<void>;
}
//# sourceMappingURL=neo4j-graph.service.d.ts.map