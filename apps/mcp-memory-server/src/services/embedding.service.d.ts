import { ConfigService } from '@nestjs/config';
import { EmbeddingRequest, EmbeddingResponse } from '../types/memory.types';
export declare class EmbeddingService {
    private readonly configService;
    private readonly logger;
    private readonly bedrockClient;
    private readonly region;
    private readonly textEmbeddingModel;
    private readonly codeEmbeddingModel;
    private readonly bedrockEnabled;
    private textEmbeddingPipeline;
    private codeEmbeddingPipeline;
    private graphCodeEmbeddingPipeline;
    constructor(configService: ConfigService);
    private initializeLocalEmbeddings;
    generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse>;
    private generateTextEmbedding;
    private generateCodeEmbedding;
    private preprocessTextForEmbedding;
    private preprocessCodeForEmbedding;
    private extractCodeContext;
    private generateLocalTextEmbedding;
    private generateLocalCodeEmbedding;
    private generateHashBasedEmbedding;
    private estimateTokenCount;
    calculateSimilarity(embedding1: number[], embedding2: number[]): number;
    generateBatchEmbeddings(requests: EmbeddingRequest[]): Promise<EmbeddingResponse[]>;
    calculateGraphRelationshipWeight(fromEmbedding: number[], toEmbedding: number[], relationshipType: string): number;
    generateGraphAwareCodeEmbedding(code: string, programmingLanguage?: string, structuralContext?: {
        functions?: string[];
        classes?: string[];
        imports?: string[];
        callGraph?: Record<string, string[]>;
    }): Promise<EmbeddingResponse>;
}
//# sourceMappingURL=embedding.service.d.ts.map