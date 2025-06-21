import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MemoryService } from '../services/memory.service';
import { EmbeddingService } from '../services/embedding.service';
import { DynamoDBStorageService } from '../services/dynamodb-storage.service';
import { LocalStorageService } from '../services/local-storage.service';
import { OpenSearchStorageService } from '../services/opensearch-storage.service';
import { NeptuneGraphService } from '../services/neptune-graph.service';
import { Neo4jGraphService } from '../services/neo4j-graph.service';
import { MemoryConfigService } from '../config/memory-config.service';
import { MemoryController } from './memory.controller';

@Module({
  providers: [
    MemoryConfigService,
    EmbeddingService,
    // Conditionally provide DynamoDB or Local storage based on environment
    {
      provide: DynamoDBStorageService,
      useFactory: (configService: ConfigService) => {
        const useLocalStorage = configService.get<string>('NODE_ENV') === 'development' && 
                               configService.get<string>('USE_LOCAL_STORAGE') !== 'false';
        
        if (useLocalStorage) {
          return new LocalStorageService(configService);
        }
        return new DynamoDBStorageService(configService);
      },
      inject: [ConfigService],
    },
    OpenSearchStorageService,
    NeptuneGraphService,
    Neo4jGraphService,
    MemoryService,
  ],
  controllers: [MemoryController],
  exports: [MemoryService],
})
export class MemoryModule {}