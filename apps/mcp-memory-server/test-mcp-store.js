#!/usr/bin/env node

const http = require('http');

const data = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: {
    name: "store-memory",
    arguments: {
      content: "Dashboard Integration Plan for Bedrock Agent System:\n1. Connect MCP dashboard to monitor memory server at localhost:4100\n2. Implement server dropdown in logs view to filter by specific MCP servers\n3. Display list of available tools from each connected server\n4. Show shared memories across servers with search and filter capabilities\n5. Create comprehensive plan for mcp-hybrid-server to act as API gateway for all microservices",
      type: "procedural",
      tags: ["dashboard", "integration", "planning", "bedrock-agent-system"],
      agent_id: "bedrock-agent-system",
      content_type: "text"
    }
  }
});

const options = {
  hostname: 'localhost',
  port: 4100,
  path: '/memory/mcp',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'Accept': 'application/json, text/event-stream'
  },
  timeout: 10000
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
    console.log(`BODY: ${chunk}`);
  });
  
  res.on('end', () => {
    console.log('No more data in response.');
    if (body) {
      try {
        const result = JSON.parse(body);
        console.log('Result:', JSON.stringify(result, null, 2));
      } catch (e) {
        console.log('Raw response:', body);
      }
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.on('timeout', () => {
  console.error('Request timed out');
  req.destroy();
});

// Write data to request body
req.write(data);
req.end();