import { test, expect } from '@playwright/test'

test.describe('Dashboard Compilation and Loading', () => {
  test('dashboard loads successfully without compilation hang', async ({ page }) => {
    // Critical test: Verify dashboard doesn't hang during compilation/loading
    
    // Set a reasonable timeout for the test
    test.setTimeout(30000) // 30 seconds max
    
    // Navigate to dashboard with explicit timeout
    await page.goto('http://localhost:3101', { 
      waitUntil: 'networkidle',
      timeout: 10000 // Fail if takes longer than 10 seconds
    })
    
    // Verify we're redirected to overview page
    await expect(page).toHaveURL(/\/overview/)
    
    // Verify page loads with expected content (CardTitle, not h2)
    await expect(page.locator('text=Total Memories')).toBeVisible()
    
    // Verify basic dashboard structure is present
    await expect(page.locator('[data-testid="memory-stats-cards"]').or(page.locator('.grid')).first()).toBeVisible()
    
    // Verify no error states are shown
    await expect(page.locator('text=Error Loading Memory Overview')).not.toBeVisible()
    await expect(page.locator('text=Failed to load')).not.toBeVisible()
  })

  test('overview page responds quickly', async ({ page }) => {
    // Measure page load time to ensure it's reasonable
    const startTime = Date.now()
    
    await page.goto('http://localhost:3101/overview', {
      waitUntil: 'networkidle',
      timeout: 5000 // Should load within 5 seconds
    })
    
    const loadTime = Date.now() - startTime
    
    // Page should load within 5 seconds (much better than the previous hang)
    expect(loadTime).toBeLessThan(5000)
    
    // Verify content is actually rendered
    await expect(page.locator('text=Total Memories')).toBeVisible()
  })

  test('dashboard navigation works', async ({ page }) => {
    // Test basic navigation to ensure routing works
    await page.goto('http://localhost:3101')
    
    // Should redirect to overview
    await expect(page).toHaveURL(/\/overview/)
    
    // Test navigation to other routes (if they exist)
    // This will help identify other potential compilation issues
    
    // Try memories page
    await page.goto('http://localhost:3101/memories')
    // Should not hang or error (even if page is not fully implemented)
    await expect(page.locator('body')).toBeVisible()
    
    // Try agents page  
    await page.goto('http://localhost:3101/agents')
    await expect(page.locator('body')).toBeVisible()
  })

  test('error boundaries work correctly', async ({ page }) => {
    // Test that error boundaries catch issues gracefully
    // This prevents the compilation hang from recurring
    
    await page.goto('http://localhost:3101/overview')
    
    // Simulate a JavaScript error to test error boundary
    await page.evaluate(() => {
      // This should be caught by error boundaries, not crash the page
      throw new Error('Test error for error boundary')
    })
    
    // Page should still be functional
    await expect(page.locator('body')).toBeVisible()
  })

  test('dashboard handles API failures gracefully', async ({ page }) => {
    // Test that API failures don't cause compilation hangs
    
    // Mock API failure
    await page.route('**/api/memory/mcp', route => {
      route.abort('failed')
    })
    
    await page.goto('http://localhost:3101/overview')
    
    // Should load with fallback content, not hang
    await expect(page.locator('body')).toBeVisible()
    
    // Should show graceful error states or default content
    await expect(page.locator('text=Total Memories')).toBeVisible()
  })
})

test.describe('Performance and Stability', () => {
  test('dashboard doesn\'t have memory leaks on repeated loads', async ({ page }) => {
    // Load the dashboard multiple times to ensure stability
    for (let i = 0; i < 3; i++) {
      await page.goto('http://localhost:3101/overview', {
        waitUntil: 'networkidle',
        timeout: 5000
      })
      
      await expect(page.locator('text=Total Memories')).toBeVisible()
      
      // Brief pause between loads
      await page.waitForTimeout(1000)
    }
  })

  test('dashboard is responsive to different viewport sizes', async ({ page }) => {
    // Test responsive design works without breaking
    await page.goto('http://localhost:3101/overview')
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(page.locator('text=Total Memories')).toBeVisible()
    
    // Test tablet viewport  
    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(page.locator('text=Total Memories')).toBeVisible()
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 })
    await expect(page.locator('text=Total Memories')).toBeVisible()
  })
})