import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useInfiniteMemories } from '../queries'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  })
  
  return ({ children }: { children: React.ReactNode }) => 
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

const createMockResponse = (memories: any[], hasMore: boolean = false) => ({
  result: {
    content: [{
      text: JSON.stringify({
        memories,
        has_more: hasMore,
        total_count: memories.length
      })
    }]
  }
})

describe('Infinite Scroll Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useInfiniteMemories', () => {
    it('should fetch initial page correctly', async () => {
      const mockMemories = [
        {
          memory: {
            content: 'Test memory 1',
            metadata: {
              memory_id: 'mem_001',
              type: 'episodic',
              project: 'test-project',
              created_at: '2025-06-13T15:00:00Z'
            }
          }
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockResponse(mockMemories, true))
      })

      const { result } = renderHook(
        () => useInfiniteMemories('', 20),
        { wrapper: createWrapper() }
      )

      // Wait for initial load
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/memory/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: expect.stringContaining('"name":"retrieve-memories"')
      })

      expect(result.current.data?.pages[0].memories).toHaveLength(1)
      expect(result.current.hasNextPage).toBe(true)
    })

    it('should calculate hasNextPage correctly based on page size', async () => {
      // Test with full page (should have next page)
      const fullPageMemories = Array.from({ length: 20 }, (_, i) => ({
        memory: {
          content: `Memory ${i}`,
          metadata: {
            memory_id: `mem_${i}`,
            type: 'episodic',
            project: 'test'
          }
        }
      }))

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockResponse(fullPageMemories, true))
      })

      const { result } = renderHook(
        () => useInfiniteMemories('', 20),
        { wrapper: createWrapper() }
      )

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      expect(result.current.hasNextPage).toBe(true)

      // Test with partial page (should not have next page)
      const partialPageMemories = Array.from({ length: 10 }, (_, i) => ({
        memory: {
          content: `Memory ${i}`,
          metadata: {
            memory_id: `mem_${i}`,
            type: 'episodic',
            project: 'test'
          }
        }
      }))

      mockFetch.mockClear()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockResponse(partialPageMemories, false))
      })

      const { result: result2 } = renderHook(
        () => useInfiniteMemories('test2', 20),
        { wrapper: createWrapper() }
      )

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      expect(result2.current.hasNextPage).toBe(false)
    })

    it('should respect page size parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockResponse([], false))
      })

      renderHook(
        () => useInfiniteMemories('test', 50),
        { wrapper: createWrapper() }
      )

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      const fetchCall = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body)
      
      expect(requestBody.params.arguments.limit).toBe(50)
    })

    it('should handle fetchNextPage correctly', async () => {
      // First page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockResponse([
          { memory: { content: 'Memory 1', metadata: { memory_id: 'mem_1', type: 'episodic' } } }
        ], true))
      })

      // Second page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockResponse([
          { memory: { content: 'Memory 2', metadata: { memory_id: 'mem_2', type: 'episodic' } } }
        ], false))
      })

      const { result } = renderHook(
        () => useInfiniteMemories('', 20),
        { wrapper: createWrapper() }
      )

      // Wait for initial load
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      expect(result.current.hasNextPage).toBe(true)

      // Fetch next page
      await act(async () => {
        result.current.fetchNextPage()
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result.current.data?.pages).toHaveLength(2)
      expect(result.current.hasNextPage).toBe(false)
    })

    it('should include query parameter in fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockResponse([], false))
      })

      renderHook(
        () => useInfiniteMemories('search query', 20),
        { wrapper: createWrapper() }
      )

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      const fetchCall = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body)
      
      expect(requestBody.params.arguments.query).toBe('search query')
    })

    it('should prevent infinite loops with safety limits', async () => {
      // Mock responses for 15 pages (over the 10 page limit)
      for (let i = 0; i < 15; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createMockResponse([
            { memory: { content: `Page ${i} memory`, metadata: { memory_id: `mem_${i}`, type: 'episodic' } } }
          ], true))
        })
      }

      const { result } = renderHook(
        () => useInfiniteMemories('', 1), // Small page size to trigger more pages
        { wrapper: createWrapper() }
      )

      // Fetch many pages
      await act(async () => {
        for (let i = 0; i < 12; i++) {
          if (result.current.hasNextPage) {
            result.current.fetchNextPage()
            await new Promise(resolve => setTimeout(resolve, 50))
          }
        }
      })

      // Should stop at 10 pages due to safety limit
      expect(result.current.data?.pages.length).toBeLessThanOrEqual(10)
    })

    it('should handle API errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(
        () => useInfiniteMemories('', 20),
        { wrapper: createWrapper() }
      )

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      expect(result.current.error).toBeTruthy()
      expect(result.current.data).toBeUndefined()
    })

    it('should normalize different memory data structures', async () => {
      const mixedMemories = [
        // New nested structure
        {
          memory: {
            content: 'Nested structure memory',
            metadata: {
              memory_id: 'mem_nested',
              type: 'semantic',
              project: 'test'
            }
          }
        },
        // Old flat structure
        {
          memory_id: 'mem_flat',
          content: 'Flat structure memory',
          type: 'procedural',
          project: 'test'
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockResponse(mixedMemories, false))
      })

      const { result } = renderHook(
        () => useInfiniteMemories('', 20),
        { wrapper: createWrapper() }
      )

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      const memories = result.current.data?.pages[0].memories
      expect(memories).toHaveLength(2)
      expect(memories?.[0].content).toBe('Nested structure memory')
      expect(memories?.[1].content).toBe('Flat structure memory')
    })
  })
})