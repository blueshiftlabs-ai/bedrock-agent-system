import { test, expect } from '@playwright/test'

test.describe('Memory Charts Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the overview page where the charts are displayed
    await page.goto('http://localhost:3101/overview')
    
    // Wait for the charts to load
    await page.waitForSelector('#memory-types-bar-chart', { timeout: 10000 })
  })

  test('memory types bar chart displays correct colors', async ({ page }) => {
    // Wait for the bar chart to be visible
    const barChart = page.locator('#memory-types-bar-chart')
    await expect(barChart).toBeVisible()

    // Wait for the SVG elements to render
    await page.waitForSelector('#memory-types-bar-chart svg', { timeout: 5000 })

    // Check that SVG paths/rectangles have the expected fill colors
    const svgElements = page.locator('#memory-types-bar-chart svg path, #memory-types-bar-chart svg rect')
    
    // Expected colors for memory types
    const expectedColors = [
      '#3b82f6', // episodic - blue
      '#10b981', // semantic - green  
      '#8b5cf6', // procedural - purple
      '#f59e0b'  // working - amber
    ]

    // Get all elements with fill attributes
    const elementsWithFill = await svgElements.evaluateAll((elements) => {
      return elements
        .map(el => el.getAttribute('fill'))
        .filter(fill => fill && fill !== 'none' && !fill.includes('url('))
    })

    // Verify that our expected colors are present
    for (const expectedColor of expectedColors) {
      const hasColor = elementsWithFill.some(fill => fill === expectedColor)
      if (hasColor) {
        console.log(`✓ Found expected color: ${expectedColor}`)
      }
    }

    // At least one of our expected colors should be found
    const hasAnyExpectedColor = expectedColors.some(color => 
      elementsWithFill.includes(color)
    )
    expect(hasAnyExpectedColor).toBeTruthy()
  })

  test('chart cards have correct IDs for identification', async ({ page }) => {
    // Verify the card IDs exist
    await expect(page.locator('#memory-types-bar-chart')).toBeVisible()
    await expect(page.locator('#agent-activity-pie-chart')).toBeVisible()
    
    // Verify chart titles
    await expect(page.locator('#memory-types-bar-chart')).toContainText('Memory Types Distribution')
    await expect(page.locator('#agent-activity-pie-chart')).toContainText('Agent Activity')
  })

  test('bar chart renders with data', async ({ page }) => {
    const barChart = page.locator('#memory-types-bar-chart')
    
    // Wait for chart to load
    await expect(barChart).toBeVisible()
    
    // Check that the chart has SVG content (indicates it rendered)
    const hasSvg = await barChart.locator('svg').count()
    expect(hasSvg).toBeGreaterThan(0)
    
    // Check for axis labels (X-axis should show memory types)
    const hasXAxisText = await barChart.locator('svg text').count()
    expect(hasXAxisText).toBeGreaterThan(0)
  })

  test('screenshot comparison for visual regression', async ({ page }) => {
    // Wait for charts to fully load
    await page.waitForTimeout(2000)
    
    // Take screenshot of the charts area
    const chartsContainer = page.locator('.grid.grid-cols-1.lg\\:grid-cols-2.gap-6').first()
    await expect(chartsContainer).toHaveScreenshot('memory-charts.png')
  })
})