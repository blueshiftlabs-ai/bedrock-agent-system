import { Injectable, Logger } from '@nestjs/common';
import { MemoryConfigService } from '../config/memory-config.service';
import { DynamoDBStorageService } from './dynamodb-storage.service';
import { LocalStorageService } from './local-storage.service';
import { getErrorMessage } from '../utils';

/**
 * Storage Strategy Service - Implements fallback storage logic
 * Determines which storage backend to use based on availability and configuration
 */
@Injectable()
export class StorageStrategyService {
  private readonly logger = new Logger(StorageStrategyService.name);
  private currentStrategy: 'dynamodb' | 'local' = 'local';
  private lastHealthCheck = 0;
  private readonly healthCheckInterval = 30000; // 30 seconds

  constructor(
    private readonly configService: MemoryConfigService,
    private readonly dynamoDbService: DynamoDBStorageService,
    private readonly localStorageService: LocalStorageService,
  ) {
    this.initializeStrategy();
  }

  /**
   * Initialize storage strategy based on configuration and availability
   */
  private async initializeStrategy() {
    const strategies = [
      {
        name: 'dynamodb' as const,
        priority: 1,
        condition: () => !this.configService.useLocalStorage,
        healthCheck: () => this.dynamoDbService.healthCheck(),
      },
      {
        name: 'local' as const,
        priority: 2,
        condition: () => true, // Always available as fallback
        healthCheck: () => Promise.resolve(true),
      },
    ];

    for (const strategy of strategies.sort((a, b) => a.priority - b.priority)) {
      if (strategy.condition()) {
        try {
          const isHealthy = await strategy.healthCheck();
          if (isHealthy) {
            this.currentStrategy = strategy.name;
            this.logger.log(`Storage strategy initialized: ${strategy.name}`);
            return;
          }
        } catch (error) {
          this.logger.warn(`Storage strategy ${strategy.name} failed health check: ${getErrorMessage(error)}`);
        }
      }
    }

    // Fallback to local if all else fails
    this.currentStrategy = 'local';
    this.logger.warn('All storage strategies failed, falling back to local storage');
  }

  /**
   * Get the current storage service
   */
  getStorageService(): DynamoDBStorageService | LocalStorageService {
    return this.currentStrategy === 'dynamodb' 
      ? this.dynamoDbService 
      : this.localStorageService;
  }

  /**
   * Get current strategy name
   */
  getCurrentStrategy(): string {
    return this.currentStrategy;
  }

  /**
   * Force a strategy refresh (useful for testing or manual fallback)
   */
  async refreshStrategy(): Promise<void> {
    this.lastHealthCheck = 0; // Force immediate refresh
    await this.ensureHealthyStrategy();
  }

  /**
   * Ensure current strategy is healthy, switch if needed
   */
  private async ensureHealthyStrategy(): Promise<void> {
    const now = Date.now();
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return; // Too soon for another check
    }

    this.lastHealthCheck = now;

    const currentService = this.getStorageService();
    const isCurrentHealthy = this.currentStrategy === 'dynamodb' 
      ? await this.dynamoDbService.healthCheck() 
      : true; // Local storage is always healthy

    if (!isCurrentHealthy) {
      this.logger.warn(`Current storage strategy ${this.currentStrategy} is unhealthy, switching to fallback`);
      
      // Switch to alternative
      if (this.currentStrategy === 'dynamodb') {
        this.currentStrategy = 'local';
        this.logger.log('Switched to local storage fallback');
      } else {
        // Try to recover DynamoDB if local was being used
        try {
          const dynamoHealthy = await this.dynamoDbService.healthCheck();
          if (dynamoHealthy && !this.configService.useLocalStorage) {
            this.currentStrategy = 'dynamodb';
            this.logger.log('Recovered DynamoDB connection, switched back from local storage');
          }
        } catch (error) {
          this.logger.debug('DynamoDB still unavailable, continuing with local storage');
        }
      }
    }
  }

  /**
   * Execute operation with automatic fallback
   */
  async executeWithFallback<T>(
    operation: (service: DynamoDBStorageService | LocalStorageService) => Promise<T>,
    operationName: string
  ): Promise<T> {
    await this.ensureHealthyStrategy();
    
    try {
      const service = this.getStorageService();
      return await operation(service);
    } catch (error) {
      this.logger.error(`Operation ${operationName} failed with ${this.currentStrategy}: ${getErrorMessage(error)}`);
      
      // Try fallback strategy if current operation failed
      if (this.currentStrategy === 'dynamodb') {
        this.logger.warn(`Attempting ${operationName} with local storage fallback`);
        this.currentStrategy = 'local';
        try {
          const fallbackService = this.getStorageService();
          const result = await operation(fallbackService);
          this.logger.log(`Operation ${operationName} succeeded with local storage fallback`);
          return result;
        } catch (fallbackError) {
          this.logger.error(`Fallback operation ${operationName} also failed: ${getErrorMessage(fallbackError)}`);
          throw fallbackError;
        }
      } else {
        // Already using local storage, re-throw error
        throw error;
      }
    }
  }

  /**
   * Get storage health status
   */
  async getStorageHealth(): Promise<{
    current_strategy: string;
    dynamodb_available: boolean;
    local_available: boolean;
    last_health_check: Date;
  }> {
    const dynamodbHealthy = await this.dynamoDbService.healthCheck().catch(() => false);
    
    return {
      current_strategy: this.currentStrategy,
      dynamodb_available: dynamodbHealthy,
      local_available: true, // Always available
      last_health_check: new Date(this.lastHealthCheck),
    };
  }
}