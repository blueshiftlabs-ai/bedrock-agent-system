import { test, expect } from '@playwright/test'

test.describe('Performance Optimizations', () => {
  
  test('overview page loads quickly with batched memory requests', async ({ page }) => {
    const startTime = Date.now()
    
    // Track API calls
    const apiCalls: string[] = []
    page.on('request', request => {
      if (request.url().includes('/api/memory/mcp')) {
        apiCalls.push(request.url())
      }
    })
    
    await page.goto('/overview')
    
    // Wait for content to load
    await page.waitForSelector('[data-testid="memory-activity-item"]', {
      state: 'visible',
      timeout: 5000
    })
    
    const loadTime = Date.now() - startTime
    
    // Page should load in under 2 seconds
    expect(loadTime).toBeLessThan(2000)
    
    // Should make minimal API calls (batched, not sequential)
    const memoryDetailCalls = apiCalls.filter(url => url.includes('retrieve-memories'))
    expect(memoryDetailCalls.length).toBeLessThanOrEqual(2) // Stats + batch details
  })
  
  test('memories page has proper scroll container', async ({ page }) => {
    await page.goto('/memories')
    
    // Wait for memories to load
    await page.waitForSelector('[data-testid="memory-item"]', {
      state: 'visible'
    })
    
    // Check for scroll container
    const scrollContainer = await page.locator('.h-\\[600px\\].overflow-y-auto')
    await expect(scrollContainer).toBeVisible()
    
    // Verify container has fixed height
    const boundingBox = await scrollContainer.boundingBox()
    expect(boundingBox?.height).toBe(600)
    
    // Verify scrolling works
    const initialScrollTop = await scrollContainer.evaluate(el => el.scrollTop)
    await scrollContainer.evaluate(el => el.scrollTop = 100)
    const newScrollTop = await scrollContainer.evaluate(el => el.scrollTop)
    expect(newScrollTop).toBe(100)
    expect(newScrollTop).not.toBe(initialScrollTop)
  })
  
  test('infinite scroll loads data efficiently', async ({ page }) => {
    await page.goto('/memories')
    
    // Wait for initial load
    await page.waitForSelector('[data-testid="memory-item"]')
    
    // Count initial memories
    const initialCount = await page.locator('[data-testid="memory-item"]').count()
    expect(initialCount).toBeGreaterThan(0)
    
    // Track API calls during scroll
    let loadMoreCalls = 0
    page.on('request', request => {
      if (request.url().includes('/api/memory/mcp') && request.method() === 'POST') {
        const body = request.postData()
        if (body?.includes('offset')) {
          loadMoreCalls++
        }
      }
    })
    
    // Scroll to bottom
    const scrollContainer = await page.locator('.h-\\[600px\\].overflow-y-auto')
    await scrollContainer.evaluate(el => {
      el.scrollTop = el.scrollHeight
    })
    
    // Wait for load more button or auto-load
    await page.waitForTimeout(1000)
    
    // Should only make one additional API call for next page
    expect(loadMoreCalls).toBeLessThanOrEqual(1)
  })
  
  test('API responses are fast', async ({ page }) => {
    const responseTimes: number[] = []
    
    page.on('response', response => {
      if (response.url().includes('/api/memory/mcp')) {
        const timing = response.timing()
        if (timing) {
          responseTimes.push(timing.responseEnd - timing.requestStart)
        }
      }
    })
    
    await page.goto('/overview')
    await page.waitForSelector('[data-testid="memory-activity-item"]')
    
    // Most API calls should be under 500ms
    const fastResponses = responseTimes.filter(time => time < 500)
    const percentFast = (fastResponses.length / responseTimes.length) * 100
    
    expect(percentFast).toBeGreaterThan(90)
  })
  
  test('no excessive re-renders or API calls', async ({ page }) => {
    await page.goto('/overview')
    await page.waitForSelector('[data-testid="memory-activity-item"]')
    
    // Track API calls
    let apiCallCount = 0
    page.on('request', request => {
      if (request.url().includes('/api/memory/mcp')) {
        apiCallCount++
      }
    })
    
    // Wait 5 seconds to ensure no unnecessary polling
    await page.waitForTimeout(5000)
    
    // Should have minimal API calls (initial load + maybe 1-2 refreshes)
    expect(apiCallCount).toBeLessThan(10)
  })
  
  test('filters and search work without performance degradation', async ({ page }) => {
    await page.goto('/memories')
    await page.waitForSelector('[data-testid="memory-item"]')
    
    // Measure filter performance
    const filterStartTime = Date.now()
    
    // Open filters
    await page.click('button:has-text("Filters")')
    
    // Apply a type filter
    await page.waitForSelector('[data-testid="type-filter"]')
    const firstTypeCheckbox = await page.locator('[data-testid^="type-"]').first()
    await firstTypeCheckbox.click()
    
    // Filters should apply instantly (client-side)
    const filterTime = Date.now() - filterStartTime
    expect(filterTime).toBeLessThan(500)
    
    // Search should also be fast
    const searchStartTime = Date.now()
    await page.fill('[data-testid="memory-search"]', 'test')
    
    // Client-side search should be instant
    const searchTime = Date.now() - searchStartTime
    expect(searchTime).toBeLessThan(200)
  })
})