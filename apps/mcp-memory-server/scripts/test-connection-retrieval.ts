#!/usr/bin/env node

/**
 * Script to test the exact Neo4j query that should be used by the service
 */

import { Logger } from '@nestjs/common';
import neo4j from 'neo4j-driver';

async function testConnectionRetrieval() {
  const logger = new Logger('ConnectionRetrievalTest');
  
  try {
    // Create driver (using same config as service)
    const driver = neo4j.driver(
      'bolt://localhost:7687',
      neo4j.auth.basic('neo4j', 'password'),
      { 
        encrypted: false,
        trust: 'TRUST_ALL_CERTIFICATES'
      }
    );

    await driver.verifyConnectivity();
    logger.log('✅ Connected to Neo4j');

    const session = driver.session();

    // Test the exact query that the service should be using
    logger.log('\n🔍 Testing service query...');
    const query = `
      MATCH (a:Memory)-[r:CONNECTS]->(b:Memory)
      WHERE 1=1
      RETURN 
        a.memory_id as from_memory_id,
        b.memory_id as to_memory_id,
        r.type as relationship_type,
        r.confidence as confidence,
        r.properties as properties,
        a.content as from_content,
        b.content as to_content,
        a.type as from_type,
        b.type as to_type,
        a.agent_id as from_agent_id,
        b.agent_id as to_agent_id,
        a.created_at as from_created_at,
        b.created_at as to_created_at
      ORDER BY r.created_at DESC
      LIMIT 10
    `;

    const result = await session.run(query);
    
    logger.log(`Query returned ${result.records.length} records`);
    
    if (result.records.length > 0) {
      logger.log('\n📊 Found connections:');
      for (const record of result.records) {
        const fromId = record.get('from_memory_id');
        const toId = record.get('to_memory_id');
        const relType = record.get('relationship_type');
        const fromContent = record.get('from_content')?.slice(0, 50) + '...';
        const toContent = record.get('to_content')?.slice(0, 50) + '...';
        logger.log(`  ${fromId} -[${relType}]-> ${toId}`);
        logger.log(`    From: ${fromContent}`);
        logger.log(`    To: ${toContent}`);
      }
    } else {
      logger.warn('❌ No connections found with service query');
      
      // Try alternative query to understand the data structure
      logger.log('\n🔍 Testing alternative query to understand data...');
      const altQuery = `
        MATCH (a)-[r]->(b)
        WHERE type(r) = 'CONNECTS'
        RETURN 
          a.memory_id as from_id,
          b.memory_id as to_id,
          type(r) as rel_type,
          r.type as custom_type,
          r.properties as props
        LIMIT 5
      `;
      
      const altResult = await session.run(altQuery);
      logger.log(`Alternative query returned ${altResult.records.length} records`);
      
      for (const record of altResult.records) {
        const fromId = record.get('from_id');
        const toId = record.get('to_id');
        const relType = record.get('rel_type');
        const customType = record.get('custom_type');
        const props = record.get('props');
        logger.log(`  ${fromId} -[${relType}(${customType})]-> ${toId} (props: ${props})`);
      }
    }

    await session.close();
    await driver.close();
    
    logger.log('\n✅ Connection retrieval test completed');
    
  } catch (error) {
    logger.error(`❌ Test failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run the test
testConnectionRetrieval().catch(console.error);