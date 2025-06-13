# MCP Memory Server Dashboard Testing Guide

This guide provides comprehensive testing procedures for the MCP Memory Server Dashboard using Playwright MCP tools.

## Prerequisites

1. **Memory Server Running**: Ensure the memory server is running at `http://localhost:4100`
2. **Dashboard Running**: Ensure the dashboard is running at `http://localhost:3101`
3. **Playwright MCP Tools**: Available via Claude Code's MCP integration

## Testing Procedures

### 1. Navigation Testing

Test that all dashboard routes are accessible and render correctly:

```typescript
// Navigate to each page and verify content
await page.goto('http://localhost:3101/overview')
await expect(page.getByText('Total Memories')).toBeVisible()

await page.goto('http://localhost:3101/storage')
await expect(page.getByText('Storage Health')).toBeVisible()

await page.goto('http://localhost:3101/memories')
await expect(page.getByText('Memory Browser')).toBeVisible()

await page.goto('http://localhost:3101/graph')
await expect(page.getByText('Memory Graph')).toBeVisible()

await page.goto('http://localhost:3101/logs')
await expect(page.getByText('System Logs')).toBeVisible()

await page.goto('http://localhost:3101/admin')
await expect(page.getByText('Admin Panel')).toBeVisible()
```

### 2. Overview Page Testing

Verify that the overview page displays correct memory statistics:

```typescript
await page.goto('http://localhost:3101/overview')

// Check key metrics are displayed
await expect(page.getByText('Total Memories')).toBeVisible()
await expect(page.getByText('Graph Concepts')).toBeVisible()
await expect(page.getByText('Active Agents')).toBeVisible()
await expect(page.getByText('Recent Activity')).toBeVisible()

// Verify charts are rendered
await expect(page.locator('[data-testid="responsive-container"]')).toBeVisible()

// Check recent activity shows actual content (not "No content available")
const recentActivity = page.locator('text=Recent Memory Activity').locator('..')
await expect(recentActivity.locator('text=No content available')).not.toBeVisible()

// Verify memory type icons and content previews
await expect(recentActivity.getByText(/Successfully completed|Fixed|Added/)).toBeVisible()
```

### 3. Storage Page Testing

Test storage monitoring and health status:

```typescript
await page.goto('http://localhost:3101/storage')

// Check storage health indicators
await expect(page.getByText('Storage Health')).toBeVisible()
await expect(page.getByText('MCP Server Configuration')).toBeVisible()

// Verify connection status indicators
const storageHealth = page.locator('text=Storage Health').locator('..')
await expect(storageHealth.getByText('OpenSearch')).toBeVisible()
await expect(storageHealth.getByText('DynamoDB')).toBeVisible()
await expect(storageHealth.getByText('Neo4j')).toBeVisible()

// Check MCP endpoint configuration
const mcpConfig = page.locator('text=MCP Server Configuration').locator('..')
await expect(mcpConfig.getByText('/memory/sse')).toBeVisible()
```

### 4. Memory Browser Testing

Test memory search and browsing functionality:

```typescript
await page.goto('http://localhost:3101/memories')

// Test search functionality
const searchInput = page.getByPlaceholder('Search memories...')
await searchInput.fill('dashboard')
await page.getByRole('button', { name: /search/i }).click()

// Wait for results and verify content
await page.waitForTimeout(2000)
const searchResults = page.locator('text=Search Results')
await expect(searchResults).toBeVisible()

// Verify memories display properly
await expect(page.getByText(/dashboard|memory|error|fix/i)).toBeVisible()

// Test memory type badges
await expect(page.locator('.inline-flex').filter({ hasText: /episodic|semantic|procedural/i })).toBeVisible()

// Test Add Memory button exists
await expect(page.getByRole('button', { name: /add memory/i })).toBeVisible()
```

### 5. Graph Visualization Testing

Test the memory graph and connections:

```typescript
await page.goto('http://localhost:3101/graph')

// Check graph visualization is present
await expect(page.getByText('Memory Graph')).toBeVisible()
await expect(page.getByText('Knowledge Connections')).toBeVisible()

// Test graph controls
await expect(page.getByRole('button', { name: /refresh/i })).toBeVisible()

// Verify connection display (should show actual connections, not "No connections")
const graphArea = page.locator('text=Knowledge Connections').locator('..')
await expect(graphArea.getByText('No connections')).not.toBeVisible()
```

### 6. Logs Page Testing

Test real-time log streaming:

```typescript
await page.goto('http://localhost:3101/logs')

// Check logs interface
await expect(page.getByText('System Logs')).toBeVisible()
await expect(page.getByText('Real-time log monitoring')).toBeVisible()

// Verify log sources are displayed
await expect(page.getByText(/Memory Server|OpenSearch|DynamoDB/)).toBeVisible()

// Test log filtering if available
const logContainer = page.locator('.log-container, .logs-content, [data-testid="logs"]')
await expect(logContainer).toBeVisible()
```

### 7. Error Handling Testing

Test error boundaries and graceful degradation:

```typescript
// Test with memory server down (if testing error scenarios)
// This would require stopping the memory server temporarily

// Navigate to each page and verify error boundaries work
const pages = ['/overview', '/storage', '/memories', '/graph', '/logs', '/admin']

for (const pagePath of pages) {
  await page.goto(`http://localhost:3101${pagePath}`)
  
  // Check that pages don't crash completely
  await expect(page.locator('body')).toBeVisible()
  
  // Error boundaries should show helpful messages, not blank pages
  const errorBoundary = page.locator('text=Something went wrong')
  if (await errorBoundary.isVisible()) {
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible()
  }
}
```

### 8. Responsive Design Testing

Test dashboard on different screen sizes:

```typescript
// Test mobile view
await page.setViewportSize({ width: 375, height: 667 })
await page.goto('http://localhost:3101/overview')
await expect(page.getByText('Total Memories')).toBeVisible()

// Test tablet view
await page.setViewportSize({ width: 768, height: 1024 })
await page.goto('http://localhost:3101/overview')
await expect(page.getByText('Total Memories')).toBeVisible()

// Test desktop view
await page.setViewportSize({ width: 1920, height: 1080 })
await page.goto('http://localhost:3101/overview')
await expect(page.getByText('Total Memories')).toBeVisible()
```

### 9. Real-time Updates Testing

Test that the dashboard updates in real time:

```typescript
await page.goto('http://localhost:3101/overview')

// Take initial screenshot
await page.screenshot({ path: 'dashboard-before.png' })

// Store a new memory using the memory server
// (This would typically be done via API call or memory tools)

// Wait for dashboard to update (10-second refresh interval)
await page.waitForTimeout(11000)

// Take screenshot after update
await page.screenshot({ path: 'dashboard-after.png' })

// Verify the statistics have updated
const totalMemories = page.locator('text=Total Memories').locator('..').locator('.text-2xl')
// The count should have increased
```

## Expected Results

### Successful Test Criteria

1. **Navigation**: All pages load without errors
2. **Content**: Memory content displays properly (not "No content available")
3. **Real-time Data**: Statistics update from live memory server
4. **Error Handling**: Error boundaries prevent crashes
5. **Responsive**: Layout adapts to different screen sizes
6. **Functionality**: Search, filtering, and interactions work
7. **Performance**: Pages load within 3 seconds

### Common Issues to Check

1. **Memory Content**: Ensure recent activity shows actual memory content
2. **API Connectivity**: Verify dashboard connects to memory server at port 4100
3. **Chart Rendering**: Recharts components render properly
4. **Type Safety**: No TypeScript errors in browser console
5. **Hydration**: No Next.js hydration mismatches

## Testing with Claude Code

Use these Playwright MCP commands in Claude Code:

```
1. Navigate: Use `mcp__playwright__browser_navigate` to visit pages
2. Screenshot: Use `mcp__playwright__browser_screen_capture` to capture state
3. Interact: Use `mcp__playwright__browser_screen_click` for interactions
4. Wait: Use `mcp__playwright__browser_wait_for` for async operations
5. Verify: Use text content checks to verify functionality
```

## Automation Script

For automated testing, create a script that:

1. Starts memory server and dashboard
2. Seeds test data into memory server
3. Runs full test suite
4. Captures screenshots and logs
5. Reports pass/fail status for each test case

This ensures consistent, repeatable testing of the dashboard functionality.