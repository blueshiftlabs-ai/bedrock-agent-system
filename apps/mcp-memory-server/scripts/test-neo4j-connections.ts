#!/usr/bin/env node

/**
 * Script to test and debug Neo4j connection storage and retrieval
 */

import { Injectable, Logger } from '@nestjs/common';
import neo4j from 'neo4j-driver';

async function testNeo4jConnections() {
  const logger = new Logger('Neo4jTest');
  
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

    // Check what's actually stored
    logger.log('\n🔍 Checking stored memories...');
    const memoriesResult = await session.run('MATCH (m:Memory) RETURN count(m) as count');
    const memoryCount = memoriesResult.records[0]?.get('count').low || 0;
    logger.log(`Found ${memoryCount} memory nodes`);

    // Check what relationships exist
    logger.log('\n🔍 Checking stored relationships...');
    const relationshipsResult = await session.run(`
      MATCH (a)-[r]->(b) 
      RETURN type(r) as rel_type, count(r) as count, r.type as custom_type
      LIMIT 10
    `);
    
    for (const record of relationshipsResult.records) {
      const relType = record.get('rel_type');
      const count = record.get('count').low || 0;
      const customType = record.get('custom_type');
      logger.log(`  ${relType}: ${count} relationships${customType ? ` (custom: ${customType})` : ''}`);
    }

    // Check specific connection structure
    logger.log('\n🔍 Checking connection details...');
    const connectionsResult = await session.run(`
      MATCH (a:Memory)-[r:CONNECTS]->(b:Memory) 
      RETURN 
        a.memory_id as from_id,
        b.memory_id as to_id,
        r.type as relationship_type,
        r.properties as properties
      LIMIT 5
    `);

    for (const record of connectionsResult.records) {
      const fromId = record.get('from_id');
      const toId = record.get('to_id');
      const relType = record.get('relationship_type');
      const props = record.get('properties');
      logger.log(`  ${fromId} -[${relType}]-> ${toId} (props: ${props})`);
    }

    // Test retrieval query (current implementation)
    logger.log('\n🔍 Testing current retrieval query...');
    const currentQueryResult = await session.run(`
      MATCH (a)-[r]->(b)
      WHERE 1=1
      RETURN 
        a.memory_id as from_memory_id,
        b.memory_id as to_memory_id,
        type(r) as relationship_type,
        r.confidence as confidence,
        properties(r) as properties
      LIMIT 10
    `);

    logger.log(`Current query returned ${currentQueryResult.records.length} records`);
    for (const record of currentQueryResult.records) {
      const fromId = record.get('from_memory_id');
      const toId = record.get('to_memory_id');
      const relType = record.get('relationship_type');
      logger.log(`  ${fromId} -[${relType}]-> ${toId}`);
    }

    // Test improved retrieval query
    logger.log('\n🔍 Testing improved retrieval query...');
    const improvedQueryResult = await session.run(`
      MATCH (a:Memory)-[r:CONNECTS]->(b:Memory)
      RETURN 
        a.memory_id as from_memory_id,
        b.memory_id as to_memory_id,
        r.type as relationship_type,
        r.confidence as confidence,
        r.properties as properties,
        a.content as from_content,
        b.content as to_content
      LIMIT 10
    `);

    logger.log(`Improved query returned ${improvedQueryResult.records.length} records`);
    for (const record of improvedQueryResult.records) {
      const fromId = record.get('from_memory_id');
      const toId = record.get('to_memory_id');
      const relType = record.get('relationship_type');
      const fromContent = record.get('from_content')?.slice(0, 50) + '...';
      const toContent = record.get('to_content')?.slice(0, 50) + '...';
      logger.log(`  ${fromId} -[${relType}]-> ${toId}`);
      logger.log(`    From: ${fromContent}`);
      logger.log(`    To: ${toContent}`);
    }

    await session.close();
    await driver.close();
    
    logger.log('\n✅ Neo4j test completed');
    
  } catch (error) {
    logger.error(`❌ Neo4j test failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run the test
testNeo4jConnections().catch(console.error);