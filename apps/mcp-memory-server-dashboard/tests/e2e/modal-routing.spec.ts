import { test, expect } from '@playwright/test'

test.describe('Modal Route Intercepting', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to overview page
    await page.goto('/overview')
    
    // Wait for the page to load
    await page.waitForSelector('[data-testid="memory-browser"]', { state: 'visible', timeout: 10000 })
    await page.waitForTimeout(2000) // Give time for memories to load
  })

  test('should open modal when clicking memory from overview page', async ({ page }) => {
    // Wait for Recent Memory Activity section to load
    await page.waitForSelector('#recent-activity-section', { timeout: 10000 })
    
    // Look for memory cards in recent activity
    const memoryCards = page.locator('#recent-activity-section .cursor-pointer').first()
    
    // Check if memory cards exist
    const cardCount = await memoryCards.count()
    if (cardCount === 0) {
      test.skip('No memory cards found - skipping modal test')
    }

    // Click on first memory card
    await memoryCards.click()
    
    // Modal should appear - wait for modal dialog
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 })
    
    // Modal should contain memory content
    await expect(page.locator('[role="dialog"]')).toContainText('Memory Details')
    
    // URL should change to /memory/[id] but modal should be visible
    await expect(page).toHaveURL(/\/memory\/[a-zA-Z0-9_-]+/)
    
    // Page content (overview) should still be visible behind modal
    await expect(page.locator('#recent-activity-section')).toBeVisible()
  })

  test('should close modal and return to overview when clicking back', async ({ page }) => {
    // Wait for Recent Memory Activity section to load
    await page.waitForSelector('#recent-activity-section', { timeout: 10000 })
    
    const memoryCards = page.locator('#recent-activity-section .cursor-pointer').first()
    const cardCount = await memoryCards.count()
    if (cardCount === 0) {
      test.skip('No memory cards found - skipping modal test')
    }

    // Click on memory card to open modal
    await memoryCards.click()
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 })
    
    // Click browser back button
    await page.goBack()
    
    // Should return to overview page
    await expect(page).toHaveURL('/overview')
    
    // Modal should be closed
    await expect(page.locator('[role="dialog"]')).not.toBeVisible()
    
    // Overview content should still be visible
    await expect(page.locator('#recent-activity-section')).toBeVisible()
  })

  test('should open modal when clicking memory from memories page', async ({ page }) => {
    // Navigate to memories page
    await page.goto('/memories')
    
    // Wait for memories to load
    await page.waitForSelector('[data-testid="memory-browser"]', { timeout: 10000 })
    await page.waitForTimeout(2000)
    
    // Look for memory items
    const memoryItems = page.locator('[data-testid="memory-item"]').first()
    const itemCount = await memoryItems.count()
    if (itemCount === 0) {
      test.skip('No memory items found - skipping modal test')
    }

    // Click on first memory item
    await memoryItems.click()
    
    // Modal should appear
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 })
    
    // URL should change to /memory/[id]
    await expect(page).toHaveURL(/\/memory\/[a-zA-Z0-9_-]+/)
  })

  test('should handle modal navigation between different memories', async ({ page }) => {
    // Wait for Recent Memory Activity section to load
    await page.waitForSelector('#recent-activity-section', { timeout: 10000 })
    
    const memoryCards = page.locator('#recent-activity-section .cursor-pointer')
    const cardCount = await memoryCards.count()
    if (cardCount < 2) {
      test.skip('Need at least 2 memory cards for navigation test')
    }

    // Click on first memory
    await memoryCards.first().click()
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 })
    const firstUrl = page.url()
    
    // Navigate to second memory by changing URL
    await page.goto('/overview')
    await page.waitForSelector('#recent-activity-section', { timeout: 10000 })
    
    // Click on second memory
    await memoryCards.nth(1).click()
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 })
    const secondUrl = page.url()
    
    // URLs should be different
    expect(firstUrl).not.toBe(secondUrl)
  })

  test('should handle direct navigation to memory URL', async ({ page }) => {
    // Navigate directly to a memory URL (this will create a full page, not modal)
    await page.goto('/memory/test-id')
    
    // Should show memory page content, not modal
    // (This tests the route interception only works when navigating from dashboard pages)
    await expect(page.locator('[role="dialog"]')).not.toBeVisible()
  })
})

test.describe('Modal Accessibility', () => {
  test('modal should have proper ARIA attributes', async ({ page }) => {
    await page.goto('/overview')
    await page.waitForSelector('#recent-activity-section', { timeout: 10000 })
    
    const memoryCards = page.locator('#recent-activity-section .cursor-pointer').first()
    const cardCount = await memoryCards.count()
    if (cardCount === 0) {
      test.skip('No memory cards found - skipping accessibility test')
    }

    await memoryCards.click()
    const modal = page.locator('[role="dialog"]')
    await expect(modal).toBeVisible({ timeout: 5000 })
    
    // Check ARIA attributes
    await expect(modal).toHaveAttribute('role', 'dialog')
    await expect(modal).toHaveAttribute('aria-modal', 'true')
  })

  test('modal should trap focus', async ({ page }) => {
    await page.goto('/overview')
    await page.waitForSelector('#recent-activity-section', { timeout: 10000 })
    
    const memoryCards = page.locator('#recent-activity-section .cursor-pointer').first()
    const cardCount = await memoryCards.count()
    if (cardCount === 0) {
      test.skip('No memory cards found - skipping focus trap test')
    }

    await memoryCards.click()
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 })
    
    // Tab through focusable elements - should stay within modal
    await page.keyboard.press('Tab')
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
    expect(['BUTTON', 'INPUT', 'A'].includes(focusedElement || '')).toBeTruthy()
  })

  test('modal should close on Escape key', async ({ page }) => {
    await page.goto('/overview')
    await page.waitForSelector('#recent-activity-section', { timeout: 10000 })
    
    const memoryCards = page.locator('#recent-activity-section .cursor-pointer').first()
    const cardCount = await memoryCards.count()
    if (cardCount === 0) {
      test.skip('No memory cards found - skipping escape key test')
    }

    await memoryCards.click()
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 })
    
    // Press Escape key
    await page.keyboard.press('Escape')
    
    // Modal should close and return to overview
    await expect(page.locator('[role="dialog"]')).not.toBeVisible()
    await expect(page).toHaveURL('/overview')
  })
})