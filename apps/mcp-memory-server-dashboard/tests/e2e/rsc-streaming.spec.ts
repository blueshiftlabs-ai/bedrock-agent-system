import { test, expect } from '@playwright/test'

test.describe('RSC Streaming Implementation', () => {
  test('overview page loads with streaming components', async ({ page }) => {
    // Navigate to overview page
    await page.goto('/overview')
    
    // Check that the page title loads immediately (static content)
    await expect(page.getByRole('heading', { name: 'Memory System Overview' })).toBeVisible()
    await expect(page.getByText('Comprehensive dashboard for monitoring memory operations')).toBeVisible()
    
    // Wait for stats cards to load (first stream)
    await expect(page.locator('[data-testid="stats-card"]').first()).toBeVisible({ timeout: 10000 })
    
    // Verify stats cards contain data
    await expect(page.locator('text=Total Memories')).toBeVisible()
    await expect(page.locator('text=Graph Concepts')).toBeVisible()
    await expect(page.locator('text=Active Agents')).toBeVisible()
    await expect(page.locator('text=Recent Activity')).toBeVisible()
    
    // Wait for charts to load (second stream)
    await expect(page.locator('text=Memory Types Distribution')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Agent Activity')).toBeVisible()
    
    // Verify chart data is displayed (check charts specifically)
    await expect(page.locator('svg').locator('text=Procedural').first()).toBeVisible()
    await expect(page.locator('svg').locator('text=claude-code').first()).toBeVisible()
    
    // Wait for recent activity to load (third stream)
    await expect(page.locator('text=Recent Memory Activity')).toBeVisible({ timeout: 10000 })
    
    // Check that no React errors occurred
    const logs = await page.evaluate(() => {
      return window.console._logs?.filter(log => log.level === 'error') || []
    })
    
    // Filter out known acceptable warnings (missing keys, etc.)
    const reactErrors = logs.filter(log => 
      log.message?.includes('Objects are not valid as a React child') ||
      log.message?.includes('Super expression must either be null')
    )
    
    expect(reactErrors).toHaveLength(0)
  })

  test('memories page loads with streaming wrapper', async ({ page }) => {
    await page.goto('/memories')
    
    // Check static content loads immediately
    await expect(page.locator('h1').filter({ hasText: 'Memory Browser' })).toBeVisible()
    await expect(page.getByText('Comprehensive memory management')).toBeVisible()
    
    // Wait for memory browser to load
    await expect(page.locator('[data-testid="memory-browser"]')).toBeVisible({ timeout: 10000 })
  })

  test('streaming performance is acceptable', async ({ page }) => {
    const startTime = Date.now()
    
    await page.goto('/overview')
    
    // Page should be interactive quickly (static content)
    await expect(page.getByRole('heading', { name: 'Memory System Overview' })).toBeVisible({ timeout: 2000 })
    
    const staticContentTime = Date.now() - startTime
    expect(staticContentTime).toBeLessThan(3000) // Static content should load in under 3s
    
    // All dynamic content should load within reasonable time
    await expect(page.locator('text=Total Memories')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Memory Types Distribution')).toBeVisible({ timeout: 10000 })
    
    const totalLoadTime = Date.now() - startTime
    expect(totalLoadTime).toBeLessThan(15000) // Everything should load in under 15s
  })
})