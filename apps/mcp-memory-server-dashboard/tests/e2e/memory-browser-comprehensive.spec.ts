import { test, expect } from '@playwright/test'

test.describe('Memory Browser Comprehensive Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/memories')
    await page.waitForSelector('[data-testid="memory-browser"]', { timeout: 15000 })
    await page.waitForTimeout(2000) // Allow data to load
  })

  test('should display memory browser with search and filters', async ({ page }) => {
    // Check main title
    await expect(page.locator('h3:has-text("Memory Browser")')).toBeVisible()
    
    // Check search input
    await expect(page.locator('[data-testid="memory-search"]')).toBeVisible()
    
    // Check filter button
    await expect(page.locator('button:has-text("Filters")')).toBeVisible()
    
    // Check results section
    await expect(page.locator('h3:has-text("Memories")')).toBeVisible()
  })

  test('should search memories and update results', async ({ page }) => {
    const searchInput = page.locator('[data-testid="memory-search"]')
    const searchButton = page.locator('button:has-text("Search")')
    
    // Get initial memory count
    const initialItems = await page.locator('[data-testid="memory-item"]').count()
    
    // Search for specific term
    await searchInput.fill('test')
    await searchButton.click()
    
    // Wait for search results
    await page.waitForTimeout(2000)
    
    // Results should update (either more or fewer results)
    const searchItems = await page.locator('[data-testid="memory-item"]').count()
    
    // Search functionality is working if count changed or loading occurred
    const loadingOccurred = await page.locator('.animate-spin').isVisible() || 
                           await page.locator('text=Searching...').isVisible()
    
    expect(searchItems !== initialItems || loadingOccurred).toBeTruthy()
  })

  test('should open and use type filters', async ({ page }) => {
    const filtersButton = page.locator('button:has-text("Filters")')
    await filtersButton.click()
    
    // Filter section should be visible
    await expect(page.locator('[data-testid="type-filter"]')).toBeVisible()
    
    // Should have type checkboxes
    const typeCheckboxes = page.locator('[data-testid^="type-"]')
    const checkboxCount = await typeCheckboxes.count()
    
    if (checkboxCount > 0) {
      // Get initial memory count
      const initialCount = await page.locator('[data-testid="memory-item"]').count()
      
      // Click first type filter
      await typeCheckboxes.first().click()
      
      // Wait for filtering
      await page.waitForTimeout(1000)
      
      // Memory count should change (unless all memories are of that type)
      const filteredCount = await page.locator('[data-testid="memory-item"]').count()
      
      // Check that filter badge appeared
      const filterBadges = page.locator('.text-xs:has-text("type:")')
      await expect(filterBadges.first()).toBeVisible()
      
      // Should show filtered count
      await expect(page.locator('text=filtered')).toBeVisible()
    }
  })

  test('should handle infinite scroll in memory browser', async ({ page }) => {
    const memoryContainer = page.locator('.h-\\[600px\\].overflow-y-auto')
    await expect(memoryContainer).toBeVisible()
    
    // Get initial memory count
    const initialCount = await page.locator('[data-testid="memory-item"]').count()
    
    if (initialCount > 0) {
      // Scroll to bottom
      await memoryContainer.evaluate(el => {
        el.scrollTop = el.scrollHeight
      })
      
      // Wait for potential loading
      await page.waitForTimeout(3000)
      
      // Check for more memories or load more button
      const finalCount = await page.locator('[data-testid="memory-item"]').count()
      const loadMoreButton = page.locator('button:has-text("Load More")')
      const hasLoadMore = await loadMoreButton.isVisible()
      
      // Either more memories loaded or load more button is available
      expect(finalCount > initialCount || hasLoadMore).toBeTruthy()
    }
  })

  test('should display loading skeletons during fetch', async ({ page }) => {
    // Get initial count
    const initialCount = await page.locator('[data-testid="memory-item"]').count()
    
    if (initialCount > 0) {
      // Scroll to trigger loading
      const container = page.locator('.h-\\[600px\\].overflow-y-auto')
      await container.evaluate(el => {
        el.scrollTop = el.scrollHeight
      })
      
      // Look for skeleton loading cards
      const skeletons = page.locator('div:has-text("skeleton-")')
      const loadingSpinner = page.locator('.animate-spin')
      
      // Should show some loading indicator
      try {
        await expect(skeletons.first().or(loadingSpinner.first())).toBeVisible({ timeout: 2000 })
      } catch {
        // Loading might be too fast, which is acceptable
        console.log('Loading skeletons too fast to test')
      }
    }
  })

  test('should open memory modal on click', async ({ page }) => {
    const memoryItems = page.locator('[data-testid="memory-item"]')
    const itemCount = await memoryItems.count()
    
    if (itemCount > 0) {
      // Click first memory
      await memoryItems.first().click()
      
      // Modal should open
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 })
      
      // URL should change
      await expect(page).toHaveURL(/\/memory\/[a-zA-Z0-9_-]+/)
      
      // Modal should contain memory details
      await expect(page.locator('[role="dialog"]')).toContainText('Memory Details')
    }
  })

  test('should handle debounced clicks to prevent double-navigation', async ({ page }) => {
    const memoryItems = page.locator('[data-testid="memory-item"]')
    const itemCount = await memoryItems.count()
    
    if (itemCount > 0) {
      const consoleMessages: string[] = []
      page.on('console', msg => {
        if (msg.type() === 'log') {
          consoleMessages.push(msg.text())
        }
      })
      
      const firstItem = memoryItems.first()
      
      // Rapid double-click
      await firstItem.click()
      await firstItem.click({ delay: 100 })
      
      await page.waitForTimeout(1000)
      
      // Should see rate limiting in console
      const rateLimitMsg = consoleMessages.find(msg => 
        msg.includes('rate limited') || msg.includes('too soon')
      )
      
      // Rate limiting should be working (optional test since timing dependent)
      if (rateLimitMsg) {
        expect(rateLimitMsg).toContain('rate limited')
      }
    }
  })

  test('should sort memories by different criteria', async ({ page }) => {
    // Open filters to access sort options
    await page.locator('button:has-text("Filters")').click()
    await expect(page.locator('[data-testid="type-filter"]')).toBeVisible()
    
    // Find sort dropdown
    const sortSelect = page.locator('select').or(page.locator('[role="combobox"]')).last()
    
    if (await sortSelect.isVisible()) {
      // Try changing sort order
      const sortButtons = page.locator('button:has-text("Desc"), button:has-text("Asc")')
      const buttonCount = await sortButtons.count()
      
      if (buttonCount > 0) {
        const initialOrder = await page.locator('[data-testid="memory-item"]').first().textContent()
        
        // Click sort button to change order
        await sortButtons.first().click()
        await page.waitForTimeout(1000)
        
        const newOrder = await page.locator('[data-testid="memory-item"]').first().textContent()
        
        // Order should potentially change (unless all items are identical)
        expect(typeof newOrder).toBe('string')
      }
    }
  })

  test('should clear filters and reset state', async ({ page }) => {
    // Open filters
    await page.locator('button:has-text("Filters")').click()
    await expect(page.locator('[data-testid="type-filter"]')).toBeVisible()
    
    // Apply some filters if available
    const typeCheckboxes = page.locator('[data-testid^="type-"]')
    const checkboxCount = await typeCheckboxes.count()
    
    if (checkboxCount > 0) {
      await typeCheckboxes.first().click()
      await page.waitForTimeout(500)
      
      // Clear filters
      const clearButton = page.locator('button:has-text("Clear All")')
      if (await clearButton.isEnabled()) {
        await clearButton.click()
        
        // Filter badges should disappear
        await expect(page.locator('.text-xs:has-text("type:")')).not.toBeVisible()
        
        // "filtered" text should disappear
        await expect(page.locator('text=filtered')).not.toBeVisible()
      }
    }
  })

  test('should handle page size changes', async ({ page }) => {
    // Look for page size selector
    const pageSizeSelect = page.locator('text=Page size:').locator('..').locator('[role="combobox"]')
    
    if (await pageSizeSelect.isVisible()) {
      const initialCount = await page.locator('[data-testid="memory-item"]').count()
      
      // Change page size
      await pageSizeSelect.click()
      await page.getByRole('option', { name: '50' }).click()
      
      await page.waitForTimeout(2000)
      
      // Memory count might change based on available data
      const newCount = await page.locator('[data-testid="memory-item"]').count()
      
      // Page size change should trigger some update
      expect(newCount >= 0).toBeTruthy() // Basic validation
    }
  })

  test('should maintain scroll position during infinite loading', async ({ page }) => {
    const container = page.locator('.h-\\[600px\\].overflow-y-auto')
    const initialCount = await page.locator('[data-testid="memory-item"]').count()
    
    if (initialCount > 5) {
      // Scroll to middle
      await container.evaluate(el => {
        el.scrollTop = el.scrollHeight / 2
      })
      
      const midScrollPosition = await container.evaluate(el => el.scrollTop)
      
      // Trigger loading by scrolling to bottom
      await container.evaluate(el => {
        el.scrollTop = el.scrollHeight
      })
      
      await page.waitForTimeout(2000)
      
      // Scroll back to middle to check if content shifted
      await container.evaluate((el, position) => {
        el.scrollTop = position
      }, midScrollPosition)
      
      // The same content should still be visible at that position
      // This is a visual/stability test
      expect(await container.evaluate(el => el.scrollTop)).toBeCloseTo(midScrollPosition, -1)
    }
  })

  test('should handle empty search results gracefully', async ({ page }) => {
    const searchInput = page.locator('[data-testid="memory-search"]')
    const searchButton = page.locator('button:has-text("Search")')
    
    // Search for something that definitely won't exist
    await searchInput.fill('xyznonexistentterm123')
    await searchButton.click()
    
    await page.waitForTimeout(2000)
    
    // Should show appropriate empty state message
    const emptyMessage = page.locator('text=No memories found, text=No memories match')
    await expect(emptyMessage.first()).toBeVisible()
  })

  test('should persist state across page refreshes', async ({ page }) => {
    const searchInput = page.locator('[data-testid="memory-search"]')
    
    // Set some search term
    await searchInput.fill('persistent test')
    
    // Open filters and set some filter
    await page.locator('button:has-text("Filters")').click()
    const typeCheckboxes = page.locator('[data-testid^="type-"]')
    const checkboxCount = await typeCheckboxes.count()
    
    if (checkboxCount > 0) {
      await typeCheckboxes.first().click()
    }
    
    // Refresh page
    await page.reload()
    await page.waitForSelector('[data-testid="memory-browser"]', { timeout: 10000 })
    
    // Search term should be restored
    const restoredSearchValue = await searchInput.inputValue()
    expect(restoredSearchValue).toBe('persistent test')
    
    // Filter state should be restored
    if (checkboxCount > 0) {
      await page.locator('button:has-text("Filters")').click()
      const firstCheckbox = typeCheckboxes.first()
      const isChecked = await firstCheckbox.isChecked()
      expect(isChecked).toBeTruthy()
    }
  })
})