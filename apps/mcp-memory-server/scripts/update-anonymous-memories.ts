#!/usr/bin/env ts-node

/**
 * Script to update anonymous memories with proper agent_id and project attribution
 * All anonymous memories in this system were created by Claude Code
 */

import * as fs from 'fs';
import * as path from 'path';

interface Memory {
  memory_id: string;
  agent_id: string | null;
  project: string | null;
  content: string;
  type: string;
  created_at: string;
}

interface UpdateResult {
  memory_id: string;
  agent_id: string;
  project: string;
  reason: string;
}

// API configuration
const API_URL = 'http://localhost:4100/memory/mcp';
const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json, text/event-stream'
};

// Function to call MCP tools
async function callMcpTool(method: string, params: any): Promise<any> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: method,
        arguments: params
      }
    })
  });
  
  const result = await response.json();
  if (result.error) {
    throw new Error(`MCP Error: ${result.error.message}`);
  }
  
  return JSON.parse(result.result.content[0].text);
}

// Analyze content to determine project
function analyzeProject(memory: Memory): string {
  const content = memory.content.toLowerCase();
  
  // Common project content (general concepts, no specific project references)
  const commonIndicators = [
    'general memory management',
    'basic concept',
    'common knowledge',
    'general principle',
    'abstract concept'
  ];
  
  // Check for common content
  if (commonIndicators.some(indicator => content.includes(indicator))) {
    return 'common';
  }
  
  // Specific project indicators
  if (
    content.includes('dashboard') ||
    content.includes('next.js') ||
    content.includes('infinite scroll') ||
    content.includes('memory browser') ||
    content.includes('react') ||
    content.includes('tailwind') ||
    content.includes('storage view') ||
    content.includes('graph view') ||
    content.includes('agent view') ||
    content.includes('mcp memory server') ||
    content.includes('opensearch') ||
    content.includes('dynamodb') ||
    content.includes('neo4j') ||
    content.includes('bedrock') ||
    content.includes('aws') ||
    content.includes('deployment') ||
    content.includes('monorepo')
  ) {
    return 'bedrock-agent-system';
  }
  
  // Default to bedrock-agent-system since all work has been on this project
  return 'bedrock-agent-system';
}

// Main function
async function updateAnonymousMemories() {
  console.log('🔍 Retrieving all memories...');
  
  try {
    // Get all memories
    const response = await callMcpTool('retrieve-memories', { limit: 1000 });
    const memories = response.memories;
    
    console.log(`📊 Total memories found: ${memories.length}`);
    
    // Filter anonymous memories
    const anonymousMemories = memories.filter((m: any) => 
      !m.memory.metadata.agent_id || !m.memory.metadata.project
    );
    
    console.log(`🔎 Anonymous memories found: ${anonymousMemories.length}`);
    
    if (anonymousMemories.length === 0) {
      console.log('✅ No anonymous memories found!');
      return;
    }
    
    // Update results
    const updates: UpdateResult[] = [];
    const errors: any[] = [];
    
    console.log('\n📝 Analyzing and updating memories...\n');
    
    for (const memoryData of anonymousMemories) {
      const memory = memoryData.memory;
      const metadata = memory.metadata;
      
      // Prepare memory info
      const memoryInfo: Memory = {
        memory_id: metadata.memory_id,
        agent_id: metadata.agent_id,
        project: metadata.project,
        content: memory.content,
        type: metadata.type,
        created_at: metadata.created_at
      };
      
      // Determine project
      const project = analyzeProject(memoryInfo);
      
      // All anonymous entries are from Claude Code
      const agent_id = 'claude-code';
      
      console.log(`Memory: ${memoryInfo.memory_id}`);
      console.log(`  Type: ${memoryInfo.type}`);
      console.log(`  Content: ${memoryInfo.content.substring(0, 100)}...`);
      console.log(`  ➜ Assigning: agent_id="${agent_id}", project="${project}"`);
      
      // For now, just log what we would update
      // In a real implementation, we would call an update API
      updates.push({
        memory_id: memoryInfo.memory_id,
        agent_id: agent_id,
        project: project,
        reason: `Content analysis: ${project === 'common' ? 'General concept' : 'Project-specific content'}`
      });
      
      console.log('');
    }
    
    // Summary
    console.log('\n📊 UPDATE SUMMARY:');
    console.log(`Total memories analyzed: ${anonymousMemories.length}`);
    console.log(`Updates prepared: ${updates.length}`);
    console.log(`Errors: ${errors.length}`);
    
    // Project distribution
    const projectCounts = updates.reduce((acc, update) => {
      acc[update.project] = (acc[update.project] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('\n📈 Project Distribution:');
    Object.entries(projectCounts).forEach(([project, count]) => {
      console.log(`  ${project}: ${count} memories`);
    });
    
    // Save results
    const resultsPath = path.join(__dirname, 'update-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      total_analyzed: anonymousMemories.length,
      updates: updates,
      errors: errors,
      project_distribution: projectCounts
    }, null, 2));
    
    console.log(`\n💾 Results saved to: ${resultsPath}`);
    console.log('\n⚠️  NOTE: This is a dry run. Actual updates not implemented yet.');
    console.log('To implement updates, we need to add an update-memory-metadata MCP tool.');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
updateAnonymousMemories().catch(console.error);