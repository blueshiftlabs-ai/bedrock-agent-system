# MCP Memory Server Dashboard Testing Guide

This guide provides instructions for testing the MCP Memory Server Dashboard using Playwright MCP tools.

## Prerequisites

1. Ensure the MCP Memory Server is running at http://localhost:4100
2. Ensure the Dashboard is running at http://localhost:3101
3. Have Playwright MCP server available in your Claude configuration

## Test Scenarios

### 1. Navigation Testing

Test that all navigation links work correctly:

```
1. Navigate to http://localhost:3101
2. Verify it redirects to /overview
3. Click each navigation tab and verify:
   - Overview (/overview) - Shows memory statistics
   - Storage (/storage) - Shows storage health status
   - Memories (/memories) - Shows memory browser
   - Graph (/graph) - Shows knowledge graph visualization
   - Logs (/logs) - Shows real-time log streaming
   - Admin (/admin) - Shows database admin interfaces
```

### 2. Overview Page Testing

```
1. Navigate to /overview
2. Verify the following components are visible:
   - Total Memories count card
   - Graph Concepts count card
   - Active Agents count card
   - Recent Activity count card
   - Memory Types Distribution chart
   - Agent Contributions pie chart
   - Recent Memory Activity list
```

### 3. Storage Page Testing

```
1. Navigate to /storage
2. Verify Storage System Health card shows:
   - Overall status (ok/error)
   - Last updated timestamp
3. Verify each storage component card shows:
   - DynamoDB Storage status
   - OpenSearch status
   - Neo4j Graph status
   - Endpoint information
   - Admin interface links
4. Verify MCP Server Configuration shows:
   - Transport: SSE
   - Endpoints: /memory/mcp (HTTP) and /memory/sse (SSE)
   - Status: active/inactive
```

### 4. Memories Page Testing

```
1. Navigate to /memories
2. Test search functionality:
   - Enter search query
   - Select memory type filter
   - Verify results update
3. Test Add Memory dialog:
   - Click "Add Memory" button
   - Fill in content, type, project, tags
   - Submit and verify memory appears in list
4. Test memory selection:
   - Click on a memory card
   - Verify details appear on the right
```

### 5. Graph Page Testing

```
1. Navigate to /graph
2. If no connections exist:
   - Verify empty state message
   - Test "Add Connection" button
3. If connections exist:
   - Verify graph visualization
   - Test zoom in/out buttons
   - Test node selection
   - Verify entity list appears
   - Test edge selection
```

### 6. Logs Page Testing

```
1. Navigate to /logs
2. Verify Log Sources section:
   - Check available log sources
   - Toggle source checkboxes
3. Verify Log Stream section:
   - Connection status indicator
   - Search functionality
   - Level filter dropdown
   - Source filter dropdown
   - Play/Pause button
4. Verify logs appear in real-time
5. Test download logs functionality
```

### 7. Admin Page Testing

```
1. Navigate to /admin
2. Verify three admin interface cards:
   - DynamoDB Admin
   - OpenSearch Dashboards
   - Neo4j Browser
3. Test that each "Open" button would open external interfaces
```

## Common Issues to Check

1. **Hydration Errors**: Ensure no console errors about hydration mismatches
2. **Empty Content**: Verify memories display content, not "No content available"
3. **Connection Status**: Verify the dashboard shows "Connected" in the header
4. **Responsive Design**: Test at different viewport sizes
5. **Error Handling**: Test behavior when backend is unavailable

## Playwright Commands Reference

```javascript
// Navigate to a page
await mcp__playwright__browser_navigate({ url: "http://localhost:3101" })

// Take a screenshot
await mcp__playwright__browser_screen_capture()

// Click an element
await mcp__playwright__browser_screen_click({ 
  element: "Storage tab", 
  x: 225, 
  y: 84 
})

// Type text
await mcp__playwright__browser_screen_type({ 
  text: "test memory content" 
})

// Wait for element or time
await mcp__playwright__browser_wait_for({ 
  text: "Connected",
  time: 3 
})
```

## Automated Test Script

You can run all tests sequentially:

```
1. Start at http://localhost:3101
2. For each page in [overview, storage, memories, graph, logs, admin]:
   - Navigate to the page
   - Take a screenshot
   - Verify key elements are present
   - Report any errors
3. Generate a test report with all screenshots
```