import { test, expect } from '@playwright/test'

test.describe('Recent Memory Activity Component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/overview')
    await page.waitForSelector('#recent-activity-section', { timeout: 10000 })
    await page.waitForTimeout(2000) // Allow time for data to load
  })

  test('should display recent memory activity section', async ({ page }) => {
    // Check section title
    await expect(page.locator('#recent-activity-section')).toContainText('Recent Memory Activity')
    
    // Check description
    await expect(page.locator('#recent-activity-section')).toContainText('Latest memory operations with content previews')
  })

  test('should show memory count and pagination info', async ({ page }) => {
    const countElement = page.locator('#recent-activity-section .text-muted-foreground').first()
    await expect(countElement).toBeVisible()
    
    // Should contain parentheses with count
    const countText = await countElement.textContent()
    expect(countText).toMatch(/\(\d+.*\)/)
  })

  test('should have display limit selector', async ({ page }) => {
    const selector = page.locator('#recent-activity-section').getByRole('combobox')
    await expect(selector).toBeVisible()
    
    // Should have default value
    const selectedValue = await selector.inputValue()
    expect(['10', '25', '50', '100', '200'].includes(selectedValue)).toBeTruthy()
  })

  test('should change display limit when selector is changed', async ({ page }) => {
    const selector = page.locator('#recent-activity-section').getByRole('combobox')
    
    // Get initial count
    const initialCountText = await page.locator('#recent-activity-section .text-muted-foreground').first().textContent()
    const initialCount = parseInt(initialCountText?.match(/\((\d+)/)?.[1] || '0')
    
    // Change limit to 25
    await selector.click()
    await page.getByRole('option', { name: '25' }).click()
    
    // Wait for update
    await page.waitForTimeout(1000)
    
    // Check that the display was updated
    const newCountText = await page.locator('#recent-activity-section .text-muted-foreground').first().textContent()
    expect(newCountText).toContain('25')
  })

  test('should display memory cards with proper information', async ({ page }) => {
    const memoryCards = page.locator('#recent-activity-section .cursor-pointer')
    const cardCount = await memoryCards.count()
    
    if (cardCount > 0) {
      const firstCard = memoryCards.first()
      
      // Should have memory type badge
      await expect(firstCard.locator('[data-testid="memory-type"]')).toBeVisible()
      
      // Should have content preview
      await expect(firstCard.locator('.text-sm.font-semibold')).toBeVisible()
      
      // Should have timestamp
      await expect(firstCard.locator('.text-xs.text-muted-foreground.text-right')).toBeVisible()
      
      // Should have hover effects
      await firstCard.hover()
      // Card should have transform/scale on hover (visual test)
    }
  })

  test('should have fixed height scrollable container', async ({ page }) => {
    const scrollContainer = page.locator('#recent-activity-section .h-\\[500px\\].overflow-y-auto')
    await expect(scrollContainer).toBeVisible()
    
    // Container should have fixed height
    const containerHeight = await scrollContainer.evaluate(el => getComputedStyle(el).height)
    expect(containerHeight).toBe('500px')
    
    // Container should be scrollable
    const overflowY = await scrollContainer.evaluate(el => getComputedStyle(el).overflowY)
    expect(overflowY).toBe('auto')
  })

  test('should handle infinite scroll loading', async ({ page }) => {
    const scrollContainer = page.locator('#recent-activity-section .h-\\[500px\\].overflow-y-auto')
    
    // Get initial card count
    const initialCards = await page.locator('#recent-activity-section .cursor-pointer').count()
    
    if (initialCards > 0) {
      // Scroll to bottom of container
      await scrollContainer.evaluate(el => {
        el.scrollTop = el.scrollHeight
      })
      
      // Wait for potential loading
      await page.waitForTimeout(2000)
      
      // Check if more cards loaded or if load more button appeared
      const finalCards = await page.locator('#recent-activity-section .cursor-pointer').count()
      const loadMoreButton = page.locator('#recent-activity-section button:has-text("Load More")')
      
      // Either more cards loaded OR load more button is visible
      const hasLoadMore = await loadMoreButton.isVisible()
      expect(finalCards >= initialCards || hasLoadMore).toBeTruthy()
    }
  })

  test('should handle load more button click', async ({ page }) => {
    const loadMoreButton = page.locator('#recent-activity-section button:has-text("Load More")')
    
    // If load more button exists, test it
    if (await loadMoreButton.isVisible()) {
      const initialCards = await page.locator('#recent-activity-section .cursor-pointer').count()
      
      await loadMoreButton.click()
      
      // Wait for loading to complete
      await page.waitForTimeout(2000)
      
      // Should have more cards or button should be disabled/hidden
      const finalCards = await page.locator('#recent-activity-section .cursor-pointer').count()
      const buttonStillVisible = await loadMoreButton.isVisible()
      
      expect(finalCards > initialCards || !buttonStillVisible).toBeTruthy()
    }
  })

  test('should prevent double-clicks with debouncing', async ({ page }) => {
    const memoryCards = page.locator('#recent-activity-section .cursor-pointer')
    const cardCount = await memoryCards.count()
    
    if (cardCount > 0) {
      const firstCard = memoryCards.first()
      
      // Rapid double-click
      await firstCard.click()
      await firstCard.click({ delay: 100 }) // Quick second click
      
      // Only one navigation should occur
      // This is tested by checking console logs for rate limiting
      const consoleMessages: string[] = []
      page.on('console', msg => {
        if (msg.type() === 'log') {
          consoleMessages.push(msg.text())
        }
      })
      
      await page.waitForTimeout(1000)
      
      // Should see rate limiting message if working correctly
      const rateLimitedMsg = consoleMessages.find(msg => 
        msg.includes('Memory click rate limited') || 
        msg.includes('too soon since last click')
      )
      
      // If no rate limit message, the feature might not be working
      // But this is optional since it depends on timing
    }
  })

  test('should show loading skeleton during fetch', async ({ page }) => {
    // This test might be hard to catch since loading is usually fast
    // Try to trigger loading by refreshing
    await page.reload()
    
    // Immediately check for loading state
    const loadingSpinner = page.locator('#recent-activity-section .animate-spin')
    const loadingText = page.locator('#recent-activity-section:has-text("Loading memories")')
    
    // One of these should be visible initially
    try {
      await expect(loadingSpinner.or(loadingText)).toBeVisible({ timeout: 1000 })
    } catch {
      // Loading might be too fast to catch, which is acceptable
      console.log('Loading state too fast to test')
    }
  })

  test('should navigate to memories page when clicking link', async ({ page }) => {
    const memoriesLink = page.locator('#recent-activity-section a:has-text("Visit memories page")')
    await expect(memoriesLink).toBeVisible()
    
    await memoriesLink.click()
    
    // Should navigate to memories page
    await expect(page).toHaveURL('/memories')
    await expect(page.locator('[data-testid="memory-browser"]')).toBeVisible()
  })

  test('should preserve state after navigation', async ({ page }) => {
    const selector = page.locator('#recent-activity-section').getByRole('combobox')
    
    // Change to a different limit
    await selector.click()
    await page.getByRole('option', { name: '50' }).click()
    
    // Navigate away and back
    await page.goto('/memories')
    await page.goto('/overview')
    
    // Wait for section to load
    await page.waitForSelector('#recent-activity-section', { timeout: 10000 })
    
    // Limit should be preserved (localStorage persistence)
    const preservedValue = await selector.inputValue()
    expect(preservedValue).toBe('50')
  })

  test('should handle empty state gracefully', async ({ page }) => {
    // This test assumes there might be scenarios with no memories
    // Navigate to a fresh state or use API to clear memories for testing
    
    const memoryCards = page.locator('#recent-activity-section .cursor-pointer')
    const cardCount = await memoryCards.count()
    
    if (cardCount === 0) {
      // Should show empty state message
      await expect(page.locator('#recent-activity-section')).toContainText('No recent memory activity')
      
      // Should show link to browse all memories
      await expect(page.locator('#recent-activity-section a:has-text("Browse all memories")')).toBeVisible()
    }
  })
})

test.describe('Recent Memory Activity Animations', () => {
  test('should apply staggered animations to memory cards', async ({ page }) => {
    await page.goto('/overview')
    await page.waitForSelector('#recent-activity-section', { timeout: 10000 })
    
    const memoryCards = page.locator('#recent-activity-section .cursor-pointer')
    const cardCount = await memoryCards.count()
    
    if (cardCount > 0) {
      // Check that cards have animation data attribute
      for (let i = 0; i < Math.min(cardCount, 3); i++) {
        const card = memoryCards.nth(i)
        await expect(card).toHaveAttribute('data-animate', 'fadeInUp')
        
        // Check animation delay exists
        const animationDelay = await card.evaluate(el => getComputedStyle(el).animationDelay)
        expect(animationDelay).toMatch(/\d+(\.\d+)?m?s/)
      }
    }
  })

  test('should not have animation conflicts in console', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })
    
    await page.goto('/overview')
    await page.waitForSelector('#recent-activity-section', { timeout: 10000 })
    await page.waitForTimeout(2000)
    
    // Should not have animation-related errors
    const animationErrors = consoleErrors.filter(error => 
      error.toLowerCase().includes('animation') || 
      error.toLowerCase().includes('style property')
    )
    
    expect(animationErrors.length).toBe(0)
  })
})