#!/usr/bin/env node

/**
 * Simple DynamoDB connection test
 */

const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

console.log('Testing DynamoDB connection...');

async function testConnection() {
  const client = new DynamoDBClient({
    endpoint: 'http://localhost:5100',
    region: 'us-east-1',
    credentials: {
      accessKeyId: 'local',
      secretAccessKey: 'local'
    },
    requestTimeout: 5000
  });

  try {
    console.log('Sending ListTables command...');
    const result = await client.send(new ListTablesCommand({}));
    console.log('✅ Success!', result);
  } catch (error) {
    console.log('❌ Error:', error.name, error.message);
    console.log('Full error:', error);
  }
}

testConnection();