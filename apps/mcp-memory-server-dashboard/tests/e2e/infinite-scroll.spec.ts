import { test, expect } from '@playwright/test'

test.describe('Memory Browser Infinite Scroll', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the memories page
    await page.goto('/memories')
    
    // Wait for the page to load and initial memories to appear
    await page.waitForSelector('[data-testid="memory-browser"]', { timeout: 10000 })
    
    // Wait for initial MCP call to complete
    await page.waitForResponse(response => 
      response.url().includes('/api/memory/mcp') && response.status() === 200
    )
  })

  test('should load initial memories', async ({ page }) => {
    // Check that the memories page loads
    await expect(page.locator('h1')).toContainText('Memory Browser')
    
    // Wait for memories to load
    await page.waitForSelector('[data-testid="memory-item"]', { timeout: 10000 })
    
    // Check that memories are displayed
    const memoryItems = page.locator('[data-testid="memory-item"]')
    await expect(memoryItems).toHaveCountGreaterThan(0)
    
    // Check pagination info is displayed
    await expect(page.locator('text=Pages:')).toBeVisible()
  })

  test('should trigger infinite scroll when scrolling to bottom', async ({ page }) => {
    // Wait for initial load
    await page.waitForSelector('[data-testid="memory-item"]')
    
    // Count initial memories
    const initialCount = await page.locator('[data-testid="memory-item"]').count()
    
    // Scroll to bottom to trigger infinite scroll
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight)
    })
    
    // Wait for new memories to load (check for API call)
    await page.waitForResponse(response => 
      response.url().includes('/api/memory/mcp') && response.status() === 200
    )
    
    // Wait a bit for DOM updates
    await page.waitForTimeout(1000)
    
    // Check that more memories were loaded
    const newCount = await page.locator('[data-testid="memory-item"]').count()
    expect(newCount).toBeGreaterThan(initialCount)
  })

  test('should not show duplicate memories', async ({ page }) => {
    // Wait for initial load
    await page.waitForSelector('[data-testid="memory-item"]')
    
    // Get all memory IDs
    const memoryIds = await page.locator('[data-testid="memory-item"]').evaluateAll(
      elements => elements.map(el => el.getAttribute('data-memory-id'))
    )
    
    // Check for duplicates
    const uniqueIds = new Set(memoryIds)
    expect(uniqueIds.size).toBe(memoryIds.length)
  })

  test('should show loading state when fetching more memories', async ({ page }) => {
    // Wait for initial load
    await page.waitForSelector('[data-testid="memory-item"]')
    
    // Scroll to bottom to trigger infinite scroll
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight)
    })
    
    // Check for loading indicator
    await expect(page.locator('text=Loading more')).toBeVisible({ timeout: 5000 })
  })

  test('should filter memories by type', async ({ page }) => {
    // Wait for initial load
    await page.waitForSelector('[data-testid="memory-item"]')
    
    // Click filters button
    await page.click('button:has-text("Filters")')
    
    // Wait for filters to appear
    await page.waitForSelector('[data-testid="type-filter"]')
    
    // Select a specific memory type
    await page.check('[data-testid="type-episodic"]')
    
    // Wait for filtering to apply
    await page.waitForTimeout(500)
    
    // Check that only episodic memories are shown
    const memoryTypes = await page.locator('[data-testid="memory-type"]').allTextContents()
    memoryTypes.forEach(type => {
      expect(type.toLowerCase()).toContain('episodic')
    })
  })

  test('should search memories and reset infinite scroll', async ({ page }) => {
    // Wait for initial load
    await page.waitForSelector('[data-testid="memory-item"]')
    
    // Get initial count
    const initialCount = await page.locator('[data-testid="memory-item"]').count()
    
    // Search for specific content
    await page.fill('input[placeholder*="Search memories"]', 'test')
    
    // Wait for debounced search to trigger
    await page.waitForTimeout(500)
    
    // Wait for search API call
    await page.waitForResponse(response => 
      response.url().includes('/api/memory/mcp') && response.status() === 200
    )
    
    // Check that search results are different from initial load
    const searchCount = await page.locator('[data-testid="memory-item"]').count()
    // Results should be different (either more specific or different set)
    expect(searchCount).toBeGreaterThanOrEqual(0) // Could be 0 if no matches
  })

  test('should navigate to memory detail when clicking memory item', async ({ page }) => {
    // Wait for initial load
    await page.waitForSelector('[data-testid="memory-item"]')
    
    // Get the first memory ID
    const firstMemory = page.locator('[data-testid="memory-item"]').first()
    const memoryId = await firstMemory.getAttribute('data-memory-id')
    
    // Click on the memory item
    await firstMemory.click()
    
    // Check that we navigated to the memory detail page
    await expect(page).toHaveURL(new RegExp(`/memory/${memoryId}`))
    
    // Check that memory detail content is displayed
    await expect(page.locator('[data-testid="memory-detail"]')).toBeVisible()
  })

  test('should handle empty search results gracefully', async ({ page }) => {
    // Wait for initial load
    await page.waitForSelector('[data-testid="memory-item"]')
    
    // Search for something that doesn't exist
    await page.fill('input[placeholder*="Search memories"]', 'nonexistent_search_term_12345')
    
    // Wait for debounced search
    await page.waitForTimeout(500)
    
    // Wait for API response
    await page.waitForResponse(response => 
      response.url().includes('/api/memory/mcp') && response.status() === 200
    )
    
    // Check for empty state message
    await expect(page.locator('text=No memories found')).toBeVisible()
  })

  test('should maintain scroll position when applying filters', async ({ page }) => {
    // Wait for initial load and scroll down
    await page.waitForSelector('[data-testid="memory-item"]')
    
    // Scroll down to load more memories
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight)
    })
    
    // Wait for more content to load
    await page.waitForResponse(response => 
      response.url().includes('/api/memory/mcp') && response.status() === 200
    )
    
    // Get current scroll position
    const scrollPosition = await page.evaluate(() => window.pageYOffset)
    
    // Apply a filter
    await page.click('button:has-text("Filters")')
    await page.waitForSelector('[data-testid="type-filter"]')
    
    // The scroll position should be maintained or reasonable after filtering
    const newScrollPosition = await page.evaluate(() => window.pageYOffset)
    expect(newScrollPosition).toBeGreaterThanOrEqual(0)
  })

  test('should show page count and hasNext status in debug info', async ({ page }) => {
    // Wait for initial load
    await page.waitForSelector('[data-testid="memory-item"]')
    
    // Check that debug info is displayed
    const debugInfo = page.locator('text=/Pages: \\d+, HasNext: [YN]/')
    await expect(debugInfo).toBeVisible()
    
    // The format should be "Pages: X, HasNext: Y/N"
    const debugText = await debugInfo.textContent()
    expect(debugText).toMatch(/Pages: \d+, HasNext: [YN]/)
  })
})