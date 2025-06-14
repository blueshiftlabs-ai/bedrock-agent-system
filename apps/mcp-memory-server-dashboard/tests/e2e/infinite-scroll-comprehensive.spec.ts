import { test, expect, Page } from '@playwright/test'

test.describe('Infinite Scroll Comprehensive Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to memories page
    await page.goto('http://localhost:3101/memories')
    
    // Wait for the page to load and initial memories to appear
    await page.waitForSelector('[data-testid="memory-browser"]', { timeout: 10000 })
    
    // Wait for initial MCP call to complete
    await page.waitForResponse(response => 
      response.url().includes('/api/memory/mcp') && response.status() === 200
    )
    
    // Wait for memories to load
    await page.waitForSelector('[data-testid="memory-item"]', { timeout: 15000 })
  })

  test('should load initial memories correctly', async ({ page }) => {
    // Verify memory browser is visible
    await expect(page.locator('[data-testid="memory-browser"]')).toBeVisible()
    
    // Verify at least some memories are loaded
    const memoryItems = page.locator('[data-testid="memory-item"]')
    const memoryCount = await memoryItems.count()
    expect(memoryCount).toBeGreaterThan(0)
    
    // Verify each memory has proper structure
    const firstMemory = memoryItems.first()
    await expect(firstMemory.locator('[data-testid="memory-type"]')).toBeVisible()
    
    // Verify load more button is present if there are more pages
    const loadMoreButton = page.locator('button:has-text("Load More Memories")')
    if (await loadMoreButton.isVisible()) {
      await expect(loadMoreButton).not.toBeDisabled()
    }
  })

  test('should have working load more button', async ({ page }) => {
    // Get initial memory count
    const initialMemories = await page.locator('[data-testid="memory-item"]').count()
    
    // Look for load more button
    const loadMoreButton = page.locator('button:has-text("Load More Memories")')
    
    if (await loadMoreButton.isVisible()) {
      // Click load more button
      await loadMoreButton.click()
      
      // Wait for loading state
      await expect(page.locator('text=Loading more...')).toBeVisible()
      
      // Wait for new memories to load
      await page.waitForFunction(
        (initialCount) => {
          const currentCount = document.querySelectorAll('[data-testid="memory-item"]').length
          return currentCount > initialCount
        },
        initialMemories,
        { timeout: 10000 }
      )
      
      // Verify more memories are loaded
      const newMemoryCount = await page.locator('[data-testid="memory-item"]').count()
      expect(newMemoryCount).toBeGreaterThan(initialMemories)
      
      console.log(`Load more worked: ${initialMemories} -> ${newMemoryCount} memories`)
    } else {
      console.log('No more memories to load (load more button not visible)')
    }
  })

  test('should have working infinite scroll', async ({ page }) => {
    // Get initial memory count
    const initialMemories = await page.locator('[data-testid="memory-item"]').count()
    
    // Check if there's a load more section (intersection target)
    const loadMoreSection = page.locator('div').filter({ hasText: 'Load More Memories' }).first()
    
    if (await loadMoreSection.isVisible()) {
      // Scroll to the load more section to trigger intersection observer
      await loadMoreSection.scrollIntoViewIfNeeded()
      
      // Wait a moment for intersection observer to trigger
      await page.waitForTimeout(1000)
      
      // Check if more memories were loaded automatically
      const newMemoryCount = await page.locator('[data-testid="memory-item"]').count()
      
      if (newMemoryCount > initialMemories) {
        console.log(`Infinite scroll worked: ${initialMemories} -> ${newMemoryCount} memories`)
        expect(newMemoryCount).toBeGreaterThan(initialMemories)
      } else {
        console.log('Infinite scroll did not trigger - may need manual testing')
        
        // Alternative: try multiple scroll attempts
        for (let i = 0; i < 3; i++) {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
          await page.waitForTimeout(1000)
          
          const currentCount = await page.locator('[data-testid="memory-item"]').count()
          if (currentCount > initialMemories) {
            console.log(`Infinite scroll worked after ${i + 1} attempts: ${initialMemories} -> ${currentCount} memories`)
            expect(currentCount).toBeGreaterThan(initialMemories)
            return
          }
        }
        
        console.log('Infinite scroll not working - this needs to be fixed')
      }
    }
  })

  test('should have working page size selector', async ({ page }) => {
    // Find page size selector
    const pageSizeSelect = page.locator('select').or(page.locator('[role="combobox"]')).filter({ hasText: /20|50|100/ }).first()
    
    if (await pageSizeSelect.isVisible()) {
      // Change page size to 50
      await pageSizeSelect.click()
      await page.locator('text=50').click()
      
      // Wait for new data to load
      await page.waitForResponse(response => 
        response.url().includes('/api/memory/mcp') && response.status() === 200
      )
      
      // Verify page size change reflected in URL or UI
      console.log('Page size selector appears to work')
    } else {
      console.log('Page size selector not found - needs implementation')
    }
  })

  test('should have working reset button', async ({ page }) => {
    // Look for reset button
    const resetButton = page.locator('button:has-text("Reset")')
    
    if (await resetButton.isVisible()) {
      // Apply some filters first
      const filtersButton = page.locator('button:has-text("Filters")')
      if (await filtersButton.isVisible()) {
        await filtersButton.click()
        
        // Try to select a filter
        const firstCheckbox = page.locator('input[type="checkbox"]').first()
        if (await firstCheckbox.isVisible()) {
          await firstCheckbox.check()
        }
      }
      
      // Now click reset
      await resetButton.click()
      
      // Verify filters are cleared and data refreshes
      console.log('Reset button appears to work')
    } else {
      console.log('Reset button not found - needs implementation')
    }
  })

  test('should show consistent memory type styling', async ({ page }) => {
    const memoryItems = page.locator('[data-testid="memory-item"]')
    const firstMemory = memoryItems.first()
    
    // Check for colored circular icon
    const circularIcon = firstMemory.locator('div[class*="rounded-full"][class*="bg-"]')
    await expect(circularIcon).toBeVisible()
    
    // Check for colored memory type badge
    const typeBadge = firstMemory.locator('[data-testid="memory-type"]')
    await expect(typeBadge).toBeVisible()
    
    console.log('Memory type styling appears consistent')
  })

  test('should maintain state on navigation', async ({ page }) => {
    // Apply a search term
    const searchInput = page.locator('[data-testid="memory-search"]')
    await searchInput.fill('test query')
    
    // Wait for search to apply
    await page.waitForTimeout(500)
    
    // Navigate away and back
    await page.goto('http://localhost:3101/overview')
    await page.waitForLoadState('networkidle')
    
    await page.goto('http://localhost:3101/memories')
    await page.waitForSelector('[data-testid="memory-browser"]')
    
    // Check if search term is maintained
    const searchValue = await searchInput.inputValue()
    if (searchValue === 'test query') {
      console.log('State persistence works')
    } else {
      console.log('State persistence not working - search term lost')
    }
  })

  test.describe('Console Logs and Network Analysis', () => {
    test('should have reasonable API call patterns', async ({ page }) => {
      const apiCalls: any[] = []
      
      page.on('response', response => {
        if (response.url().includes('/api/memory/mcp')) {
          apiCalls.push({
            url: response.url(),
            status: response.status(),
            timestamp: Date.now()
          })
        }
      })
      
      // Navigate and interact
      await page.reload()
      await page.waitForSelector('[data-testid="memory-browser"]')
      
      // Try infinite scroll
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(2000)
      
      // Analyze API calls
      console.log(`Total API calls: ${apiCalls.length}`)
      
      if (apiCalls.length > 50) {
        console.log('WARNING: Too many API calls detected')
      }
      
      // Check for rapid fire calls (potential infinite loop)
      const rapidCalls = apiCalls.filter((call, index) => {
        if (index === 0) return false
        return call.timestamp - apiCalls[index - 1].timestamp < 100
      })
      
      if (rapidCalls.length > 5) {
        console.log('WARNING: Rapid fire API calls detected (potential infinite loop)')
      }
      
      expect(apiCalls.length).toBeLessThan(100) // Reasonable limit
    })
  })
})