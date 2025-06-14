import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

interface Memory {
  id: string
  content: string
  type: string
  project: string
  agent_id?: string
  timestamp?: string
  created_at?: string
  tags?: string[]
}

interface MemoryResponse {
  memories: Memory[]
  has_more: boolean
  total_count: number
}

async function fetchMemories({
  pageParam = 0,
  query = '',
  limit = 20,
  offset = 0
}: {
  pageParam?: number
  query?: string
  limit?: number
  offset?: number
}): Promise<MemoryResponse> {
  const response = await fetch('/api/memory/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now() + pageParam, // Make ID unique per page
      method: 'tools/call',
      params: {
        name: 'retrieve-memories',
        arguments: {
          query: query || '',
          limit,
          offset: pageParam * limit
        }
      }
    })
  })

  if (!response.ok) {
    throw new Error('Failed to fetch memories')
  }

  const data = await response.json()
  if (!data?.result?.content?.[0]?.text) {
    return { memories: [], has_more: false, total_count: 0 }
  }

  const result = JSON.parse(data.result.content[0].text)
  const memoriesData = result?.memories || []
  
  console.log('Memory server response:', {
    memories_count: memoriesData.length,
    has_more: result?.has_more,
    total_count: result?.total_count,
    pageParam,
    limit
  })
  
  const normalizedMemories = memoriesData.map((memoryData: any) => {
    // Handle the new nested structure: memory.memory.content vs old memory.content
    const memory = memoryData?.memory || memoryData
    const metadata = memory?.metadata || memory
    const content = memory?.content || memory?.text || 'No content available'
    
    return {
      id: metadata?.memory_id || memoryData?.memory_id || memoryData?.id || `temp-${Date.now()}`,
      content,
      type: metadata?.type || 'unknown',
      project: metadata?.project || 'unknown',
      agent_id: metadata?.agent_id,
      timestamp: metadata?.created_at || metadata?.timestamp,
      created_at: metadata?.created_at || metadata?.timestamp,
      tags: Array.isArray(metadata?.tags) ? metadata.tags : []
    }
  })

  return {
    memories: normalizedMemories,
    has_more: result?.has_more === true, // Use server's has_more flag explicitly 
    total_count: result?.total_count || normalizedMemories.length
  }
}

export function useInfiniteMemories(query: string = '', pageSize: number = 20) {
  return useInfiniteQuery({
    queryKey: ['memories', query, pageSize],
    queryFn: ({ pageParam = 0 }) => fetchMemories({ pageParam, query, limit: pageSize }),
    getNextPageParam: (lastPage, allPages) => {
      // Trust the server's has_more flag since we implemented proper pagination
      const hasMoreFlag = lastPage.has_more === true
      const nextPageNum = allPages.length
      
      console.log('getNextPageParam check:', {
        has_more: lastPage.has_more,
        memories_count: lastPage.memories.length,
        page_num: nextPageNum,
        total_count: lastPage.total_count
      })
      
      // Don't fetch beyond 10 pages as safety limit
      if (nextPageNum >= 10) {
        console.log('Reached maximum page limit (10)')
        return undefined
      }
      
      // If server says there are more, fetch next page
      if (hasMoreFlag && lastPage.memories.length > 0) {
        console.log(`Next page param: ${nextPageNum}`)
        return nextPageNum
      }
      
      console.log(`No more pages. has_more: ${hasMoreFlag}, count: ${lastPage.memories.length}`)
      return undefined
    },
    initialPageParam: 0,
    refetchOnWindowFocus: false,
    retry: 1,
    // Add stale time to prevent rapid refetches
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  })
}

// Simple stats query for overview
export function useMemoryStats() {
  return useQuery({
    queryKey: ['memory-stats'],
    queryFn: async () => {
      const response = await fetch('/api/memory/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'get-memory-statistics',
            arguments: {}
          }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to fetch stats')
      }

      const data = await response.json()
      if (data.result?.content?.[0]?.text) {
        return JSON.parse(data.result.content[0].text)
      }
      
      throw new Error('No stats data')
    },
    refetchInterval: 10000, // Refetch every 10 seconds
  })
}