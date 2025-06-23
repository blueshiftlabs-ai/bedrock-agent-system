const { chromium } = require('playwright');

async function testPageLoads() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Testing dashboard load...');
    
    // Navigate to overview page
    await page.goto('http://localhost:3101/overview', { 
      waitUntil: 'domcontentloaded',
      timeout: 10000 
    });
    
    console.log('Page loaded, checking for content...');
    
    // Wait for the main content to load
    await page.waitForSelector('h1, h2, .card', { timeout: 5000 });
    
    const title = await page.title();
    const hasContent = await page.locator('.card').count();
    
    console.log(`Page title: ${title}`);
    console.log(`Found ${hasContent} cards on page`);
    
    if (hasContent > 0) {
      console.log('✅ SUCCESS: Dashboard loads and displays content');
    } else {
      console.log('❌ FAILURE: Dashboard loads but no content visible');
    }
    
  } catch (error) {
    console.log('❌ FAILURE: Dashboard failed to load');
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

testPageLoads();