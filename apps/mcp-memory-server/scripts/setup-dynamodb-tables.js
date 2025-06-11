#!/usr/bin/env node

/**
 * Script to create DynamoDB tables for local development
 * Run after starting DynamoDB Local
 */

const { DynamoDBClient, CreateTableCommand, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

console.log('🚀 Starting DynamoDB table setup...');
console.log('📍 Endpoint: http://localhost:5100');
console.log('🌍 Region: us-east-1');

const client = new DynamoDBClient({
  endpoint: 'http://localhost:5100',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'local',
    secretAccessKey: 'local'
  },
  requestTimeout: 10000, // 10 second timeout
  maxAttempts: 3
});

// Test connection first
async function testConnection() {
  console.log('\n🔍 Testing DynamoDB Local connection...');
  try {
    const result = await client.send(new ListTablesCommand({}));
    console.log('✅ Connection successful!');
    console.log(`📋 Existing tables: ${result.TableNames?.length ? result.TableNames.join(', ') : 'none'}`);
    return true;
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('💡 Make sure DynamoDB Local is running on port 5100');
    console.error('   Run: pnpm run memory:local:up');
    return false;
  }
}

const tables = [
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
];

async function createTables() {
  console.log('\n📝 Creating tables...');
  
  for (const tableConfig of tables) {
    console.log(`\n⏳ Creating table: ${tableConfig.TableName}...`);
    try {
      const startTime = Date.now();
      await client.send(new CreateTableCommand(tableConfig));
      const duration = Date.now() - startTime;
      console.log(`✅ Created table: ${tableConfig.TableName} (${duration}ms)`);
    } catch (error) {
      if (error.name === 'ResourceInUseException') {
        console.log(`⚠️  Table already exists: ${tableConfig.TableName}`);
      } else {
        console.error(`❌ Error creating table ${tableConfig.TableName}:`, error.message);
        console.error(`   Error code: ${error.name}`);
        console.error(`   Full error:`, error);
      }
    }
  }
}

async function main() {
  try {
    // Test connection first
    const connected = await testConnection();
    if (!connected) {
      console.log('\n❌ Aborting due to connection failure');
      process.exit(1);
    }

    // Create tables
    await createTables();

    console.log('\n🎉 DynamoDB table setup complete!');
    console.log('📊 View tables at: http://localhost:5101');
    console.log('🔗 Memory server health: http://localhost:4100/memory/health');
    
  } catch (error) {
    console.error('\n💥 Script failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

main();