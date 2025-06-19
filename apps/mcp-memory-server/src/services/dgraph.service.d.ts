import { OnModuleDestroy } from '@nestjs/common';
import { MemoryConfigService } from '../config/memory-config.service';
import { ConceptNode, MemoryMetadata } from '../types/memory.types';
export declare class DgraphService implements OnModuleDestroy {
    private readonly configService;
    private readonly logger;
    private dgraphClient;
    private clientStub;
    constructor(configService: MemoryConfigService);
    private initializeConnection;
    private initializeGraphSchema;
    createMemoryNode(memoryMetadata: MemoryMetadata, content: string): Promise<string | null>;
    addConnection(fromMemoryId: string, toMemoryId: string, relationshipType: string, properties?: Record<string, any>): Promise<boolean>;
    getRelatedMemories(memoryId: string, depth?: number): Promise<ConceptNode[]>;
    onModuleDestroy(): Promise<void>;
}
//# sourceMappingURL=dgraph.service.d.ts.map