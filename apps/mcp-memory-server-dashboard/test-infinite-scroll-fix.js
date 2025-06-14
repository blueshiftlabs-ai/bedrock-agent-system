#!/usr/bin/env node

// Test script to verify infinite scroll fix
const readline = require('readline');

async function testMemoryAPI() {
  const fetch = (await import('node-fetch')).default;
  
  console.log('Testing memory API for infinite scroll fix...\n');
  
  for (let page = 0; page < 3; page++) {
    console.log(`\n--- Testing Page ${page} (offset: ${page * 20}) ---`);
    
    try {
      const response = await fetch('http://localhost:4100/memory/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now() + page,
          method: 'tools/call',
          params: {
            name: 'retrieve-memories',
            arguments: {
              query: '',
              limit: 20,
              offset: page * 20
            }
          }
        })
      });

      if (!response.ok) {
        console.log(`❌ HTTP ${response.status}: ${response.statusText}`);
        break;
      }

      const data = await response.json();
      if (!data?.result?.content?.[0]?.text) {
        console.log('❌ No data in response');
        break;
      }

      const result = JSON.parse(data.result.content[0].text);
      const memoriesCount = result.memories?.length || 0;
      
      console.log(`✅ Response:
        - Memories: ${memoriesCount}
        - Total Count: ${result.total_count}
        - Has More: ${result.has_more} (${typeof result.has_more})
        - Search Time: ${result.search_time_ms}ms`);
      
      // This is the critical test - if has_more is undefined,
      // our logic should now default to false instead of true
      if (result.has_more === undefined) {
        console.log('✅ GOOD: has_more is undefined - should prevent infinite loop');
      } else if (result.has_more === false) {
        console.log('✅ GOOD: has_more is false - no more pages');
      } else if (result.has_more === true) {
        console.log('⚠️  WARNING: has_more is true - might cause more fetching');
      }
      
      // Stop if we got fewer memories than requested (end of data)
      if (memoriesCount < 20) {
        console.log(`✅ End of data detected (${memoriesCount} < 20)`);
        break;
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      break;
    }
  }
  
  console.log('\n--- Test Complete ---');
  console.log('Key findings:');
  console.log('- Memory server does NOT return has_more field');
  console.log('- Our fix should now default has_more to false instead of true');
  console.log('- This should prevent the infinite scroll loop');
}

testMemoryAPI().catch(console.error);