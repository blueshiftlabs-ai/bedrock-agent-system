import { MemoryConfigService } from '../config/memory-config.service';
import { DynamoDBStorageService } from './dynamodb-storage.service';
import { LocalStorageService } from './local-storage.service';
export declare class StorageStrategyService {
    private readonly configService;
    private readonly dynamoDbService;
    private readonly localStorageService;
    private readonly logger;
    private currentStrategy;
    private lastHealthCheck;
    private readonly healthCheckInterval;
    constructor(configService: MemoryConfigService, dynamoDbService: DynamoDBStorageService, localStorageService: LocalStorageService);
    private initializeStrategy;
    getStorageService(): DynamoDBStorageService | LocalStorageService;
    getCurrentStrategy(): string;
    refreshStrategy(): Promise<void>;
    private ensureHealthyStrategy;
    executeWithFallback<T>(operation: (service: DynamoDBStorageService | LocalStorageService) => Promise<T>, operationName: string): Promise<T>;
    getStorageHealth(): Promise<{
        current_strategy: string;
        dynamodb_available: boolean;
        local_available: boolean;
        last_health_check: Date;
    }>;
}
//# sourceMappingURL=storage-strategy.service.d.ts.map