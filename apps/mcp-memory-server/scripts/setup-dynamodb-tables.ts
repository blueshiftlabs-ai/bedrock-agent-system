#!/usr/bin/env tsx

/**
 * Script to create DynamoDB tables for local development
 * Converts imperative patterns to functional TypeScript
 */

import { DynamoDBClient, CreateTableCommand, ListTablesCommand, CreateTableCommandInput } from '@aws-sdk/client-dynamodb';

interface ConnectionConfig {
  readonly endpoint: string;
  readonly region: string;
  readonly timeout: number;
  readonly maxAttempts: number;
}

interface TableResult {
  readonly name: string;
  readonly success: boolean;
  readonly duration?: number;
  readonly error?: string;
}

const CONNECTION_CONFIG: ConnectionConfig = {
  endpoint: 'http://localhost:5100',
  region: 'us-east-1',
  timeout: 10000,
  maxAttempts: 3
} as const;

const createClient = (config: ConnectionConfig): DynamoDBClient => 
  new DynamoDBClient({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: 'local',
      secretAccessKey: 'local'
    },
    requestTimeout: config.timeout,
    maxAttempts: config.maxAttempts
  });

const testConnection = async (client: DynamoDBClient): Promise<boolean> => {
  console.log('\n🔍 Testing DynamoDB Local connection...');
  
  try {
    const result = await client.send(new ListTablesCommand({}));
    console.log('✅ Connection successful!');
    console.log(`📋 Existing tables: ${result.TableNames?.length ? result.TableNames.join(', ') : 'none'}`);
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Connection failed:', errorMessage);
    console.error('💡 Make sure DynamoDB Local is running on port 5100');
    console.error('   Run: pnpm run memory:local:up');
    return false;
  }
};

const createTableDefinitions = (): readonly CreateTableCommandInput[] => [
  {
    TableName: 'MemoryMetadata',
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'agent_id', AttributeType: 'S' },
      { AttributeName: 'session_id', AttributeType: 'S' },
      { AttributeName: 'type', AttributeType: 'S' }
    ],
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'AgentIndex',
        KeySchema: [
          { AttributeName: 'agent_id', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
      },
      {
        IndexName: 'SessionIndex',
        KeySchema: [
          { AttributeName: 'session_id', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
      },
      {
        IndexName: 'TypeIndex',
        KeySchema: [
          { AttributeName: 'type', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
      }
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    TimeToLiveSpecification: {
      AttributeName: 'ttl',
      Enabled: true
    }
  },
  {
    TableName: 'SessionManagement',
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' }
    ],
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' }
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
  },
  {
    TableName: 'AgentProfiles',
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' }
    ],
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' }
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
  }
] as const;

const createSingleTable = async (client: DynamoDBClient) => 
  (tableConfig: CreateTableCommandInput): Promise<TableResult> => {
    const startTime = Date.now();
    console.log(`\n⏳ Creating table: ${tableConfig.TableName}...`);
    
    try {
      await client.send(new CreateTableCommand(tableConfig));
      const duration = Date.now() - startTime;
      console.log(`✅ Created table: ${tableConfig.TableName} (${duration}ms)`);
      return { 
        name: tableConfig.TableName!, 
        success: true, 
        duration 
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      
      return errorName === 'ResourceInUseException' 
        ? (() => {
            console.log(`⚠️  Table already exists: ${tableConfig.TableName}`);
            return { name: tableConfig.TableName!, success: true };
          })()
        : (() => {
            console.error(`❌ Error creating table ${tableConfig.TableName}:`, errorMessage);
            return { 
              name: tableConfig.TableName!, 
              success: false, 
              error: errorMessage 
            };
          })();
    }
  };

const createAllTables = async (client: DynamoDBClient, tables: readonly CreateTableCommandInput[]): Promise<readonly TableResult[]> => {
  console.log('\n📝 Creating tables...');
  
  const createTable = createSingleTable(client);
  return Promise.all(tables.map(createTable));
};

const logResults = (results: readonly TableResult[]): void => {
  const successCount = results.filter(r => r.success).length;
  const totalDuration = results
    .map(r => r.duration ?? 0)
    .reduce((sum, duration) => sum + duration, 0);
  
  console.log('\n🎉 DynamoDB table setup complete!');
  console.log(`📊 Tables created/verified: ${successCount}/${results.length}`);
  console.log(`⏱️  Total duration: ${totalDuration}ms`);
  console.log('📊 View tables at: http://localhost:5101');
  console.log('🔗 Memory server health: http://localhost:4100/memory/health');
};

const main = async (): Promise<void> => {
  console.log('🚀 Starting DynamoDB table setup...');
  console.log(`📍 Endpoint: ${CONNECTION_CONFIG.endpoint}`);
  console.log(`🌍 Region: ${CONNECTION_CONFIG.region}`);

  const client = createClient(CONNECTION_CONFIG);
  
  try {
    const isConnected = await testConnection(client);
    
    if (!isConnected) {
      console.log('\n❌ Aborting due to connection failure');
      process.exit(1);
    }

    const tables = createTableDefinitions();
    const results = await createAllTables(client, tables);
    
    logResults(results);
    
    const hasErrors = results.some(r => !r.success);
    process.exit(hasErrors ? 1 : 0);
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('\n💥 Script failed:', errorMessage);
    process.exit(1);
  }
};

main();