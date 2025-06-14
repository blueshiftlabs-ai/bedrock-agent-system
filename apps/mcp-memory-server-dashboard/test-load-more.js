#!/usr/bin/env node

// Quick test to verify load more logic
async function testLoadMoreLogic() {
  console.log('Testing Load More Button Logic...\n');
  
  // Simulate first page response
  const firstPage = {
    memories: new Array(20).fill().map((_, i) => ({ id: `mem_${i}`, content: `Memory ${i}` })),
    has_more: true,
    total_count: 42
  };
  
  // Simulate second page response  
  const secondPage = {
    memories: new Array(20).fill().map((_, i) => ({ id: `mem_${i + 20}`, content: `Memory ${i + 20}` })),
    has_more: true,
    total_count: 42
  };
  
  // Simulate last page response
  const lastPage = {
    memories: new Array(2).fill().map((_, i) => ({ id: `mem_${i + 40}`, content: `Memory ${i + 40}` })),
    has_more: false,
    total_count: 42
  };
  
  // Test getNextPageParam logic
  function getNextPageParam(lastPage, allPages) {
    const hasMoreFlag = lastPage.has_more === true;
    const nextPageNum = allPages.length;
    
    console.log('getNextPageParam check:', {
      has_more: lastPage.has_more,
      memories_count: lastPage.memories.length,
      page_num: nextPageNum,
      total_count: lastPage.total_count
    });
    
    if (nextPageNum >= 10) {
      console.log('Reached maximum page limit (10)');
      return undefined;
    }
    
    if (hasMoreFlag && lastPage.memories.length > 0) {
      console.log(`Next page param: ${nextPageNum}`);
      return nextPageNum;
    }
    
    console.log(`No more pages. has_more: ${hasMoreFlag}, count: ${lastPage.memories.length}`);
    return undefined;
  }
  
  // Test scenarios
  console.log('--- Test 1: First page (should have next page) ---');
  const nextPage1 = getNextPageParam(firstPage, [firstPage]);
  console.log(`Result: ${nextPage1} (should be 1)\n`);
  
  console.log('--- Test 2: Second page (should have next page) ---');
  const nextPage2 = getNextPageParam(secondPage, [firstPage, secondPage]);
  console.log(`Result: ${nextPage2} (should be 2)\n`);
  
  console.log('--- Test 3: Last page (should NOT have next page) ---');
  const nextPage3 = getNextPageParam(lastPage, [firstPage, secondPage, lastPage]);
  console.log(`Result: ${nextPage3} (should be undefined)\n`);
  
  console.log('✅ Load More Logic Test Complete');
}

testLoadMoreLogic().catch(console.error);