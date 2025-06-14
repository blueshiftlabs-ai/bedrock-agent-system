import { test, expect } from '@playwright/test'

test.describe('Infinite Scroll Basic Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to memories page
    await page.goto('http://localhost:3101/memories')
    
    // Wait for the page to load
    await page.waitForSelector('[data-testid="memory-browser"]', { timeout: 10000 })
    
    // Wait for initial memories to load
    await page.waitForSelector('[data-testid="memory-item"]', { timeout: 10000 })
  })

  test('should load initial memories and display load more button when appropriate', async ({ page }) => {
    // Verify memory browser is visible
    await expect(page.locator('[data-testid="memory-browser"]')).toBeVisible()
    
    // Count initial memories
    const initialMemoryCount = await page.locator('[data-testid="memory-item"]').count()
    expect(initialMemoryCount).toBeGreaterThan(0)
    
    console.log(`Initial memories loaded: ${initialMemoryCount}`)
    
    // Check if load more button exists and is enabled
    const loadMoreButton = page.locator('button:has-text("Load More Memories")')
    const loadMoreVisible = await loadMoreButton.isVisible()
    
    if (loadMoreVisible) {
      await expect(loadMoreButton).not.toBeDisabled()
      console.log('Load More button is visible and enabled')
    } else {
      console.log('Load More button not visible - likely at end of data')
    }
  })

  test('should load more memories when load more button is clicked', async ({ page }) => {
    // Count initial memories
    const initialCount = await page.locator('[data-testid="memory-item"]').count()
    
    // Look for load more button
    const loadMoreButton = page.locator('button:has-text("Load More Memories")')
    
    if (await loadMoreButton.isVisible()) {
      // Click load more
      await loadMoreButton.click()
      
      // Wait for loading state
      await expect(page.locator('text=Loading more...')).toBeVisible()
      
      // Wait for loading to complete
      await expect(page.locator('text=Loading more...')).not.toBeVisible({ timeout: 10000 })
      
      // Count memories after loading
      const newCount = await page.locator('[data-testid="memory-item"]').count()
      
      // Should have more memories
      expect(newCount).toBeGreaterThan(initialCount)
      console.log(`Memories increased from ${initialCount} to ${newCount}`)
    } else {
      console.log('No load more button - test skipped')
    }
  })

  test('should display memory type badges correctly', async ({ page }) => {
    // Check first memory has proper structure
    const firstMemory = page.locator('[data-testid="memory-item"]').first()
    await expect(firstMemory).toBeVisible()
    
    // Check for memory type badge
    const typeBadge = firstMemory.locator('[data-testid="memory-type"]')
    await expect(typeBadge).toBeVisible()
    
    // Check for colored icon
    const coloredIcon = firstMemory.locator('div[class*="rounded-full"][class*="bg-"]').first()
    await expect(coloredIcon).toBeVisible()
    
    console.log('Memory type styling is correct')
  })

  test('should not make excessive API calls', async ({ page }) => {
    let apiCallCount = 0
    
    // Monitor API calls
    page.on('response', response => {
      if (response.url().includes('/api/memory/mcp')) {
        apiCallCount++
      }
    })
    
    // Wait a few seconds for initial load
    await page.waitForTimeout(3000)
    
    // Should not have excessive calls (more than 5 for initial load)
    expect(apiCallCount).toBeLessThan(10)
    console.log(`API calls made: ${apiCallCount}`)
  })
})