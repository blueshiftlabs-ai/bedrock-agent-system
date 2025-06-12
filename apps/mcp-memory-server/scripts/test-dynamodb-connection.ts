#!/usr/bin/env tsx

/**
 * Simple DynamoDB connection test - Functional TypeScript version
 */

import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';

interface ConnectionTestResult {
  readonly success: boolean;
  readonly tableCount?: number;
  readonly tableNames?: readonly string[];
  readonly error?: string;
  readonly duration: number;
}

const createTestClient = (): DynamoDBClient => 
  new DynamoDBClient({
    endpoint: 'http://localhost:5100',
    region: 'us-east-1',
    credentials: {
      accessKeyId: 'local',
      secretAccessKey: 'local'
    },
    requestTimeout: 5000
  });

const performConnectionTest = async (client: DynamoDBClient): Promise<ConnectionTestResult> => {
  const startTime = Date.now();
  console.log('Sending ListTables command...');
  
  try {
    const result = await client.send(new ListTablesCommand({}));
    const duration = Date.now() - startTime;
    const tableNames = result.TableNames ?? [];
    
    return {
      success: true,
      tableCount: tableNames.length,
      tableNames,
      duration
    };
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      success: false,
      error: errorMessage,
      duration
    };
  }
};

const logTestResult = (result: ConnectionTestResult): void => {
  if (result.success) {
    console.log(`✅ Success! (${result.duration}ms)`);
    console.log(`📊 Tables found: ${result.tableCount}`);
    
    if (result.tableNames && result.tableNames.length > 0) {
      console.log(`📋 Table names: ${result.tableNames.join(', ')}`);
    }
  } else {
    console.log(`❌ Error: ${result.error} (${result.duration}ms)`);
    console.log('💡 Make sure DynamoDB Local is running on port 5100');
    console.log('   Run: pnpm run memory:local:up');
  }
};

const main = async (): Promise<void> => {
  console.log('🧪 Testing DynamoDB connection...');
  console.log('📍 Endpoint: http://localhost:5100');
  
  const client = createTestClient();
  const result = await performConnectionTest(client);
  
  logTestResult(result);
  
  process.exit(result.success ? 0 : 1);
};

main();