import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useInfiniteMemories, useMemoryStats } from '../queries'

const mockFetch = vi.fn()
global.fetch = mockFetch

const createQueryWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

const mockMemoriesResponse = {
  result: {
    content: [{
      text: JSON.stringify({
        memories: [
          {
            memory: {
              content: 'Test memory content',
              metadata: {
                memory_id: 'mem_123',
                type: 'episodic',
                project: 'test-project',
                agent_id: 'claude-code',
                created_at: '2025-06-12T15:12:23.480Z',
                tags: ['test', 'memory']
              }
            }
          },
          {
            memory: {
              content: 'Another test memory',
              metadata: {
                memory_id: 'mem_456',
                type: 'semantic',
                project: 'another-project',
                agent_id: 'claude-code',
                created_at: '2025-06-12T14:12:23.480Z',
                tags: ['semantic', 'test']
              }
            }
          }
        ],
        has_more: true,
        total_count: 10
      })
    }]
  }
}

const mockStatsResponse = {
  result: {
    content: [{
      text: JSON.stringify({
        storage: {
          total_memories: 100,
          text_memories: 60,
          code_memories: 40,
          by_type: {
            episodic: { count: 50 },
            semantic: { count: 30 },
            procedural: { count: 15 },
            working: { count: 5 }
          },
          by_agent: {
            'claude-code': { count: 80 },
            'unknown': { count: 20 }
          },
          recent_activity: [
            {
              memory_id: 'mem_recent_1',
              type: 'episodic',
              agent_id: 'claude-code',
              created_at: '2025-06-12T15:12:23.480Z'
            }
          ]
        },
        graph: [
          {
            concept_id: 'concept_1',
            name: 'Test Concept',
            category: 'technical',
            confidence: 0.95,
            related_memories: ['mem_123', 'mem_456']
          }
        ],
        timestamp: '2025-06-12T15:12:23.480Z'
      })
    }]
  }
}

describe('queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useInfiniteMemories', () => {
    it('fetches initial page of memories', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockMemoriesResponse)
      })

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useInfiniteMemories(''), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/memory/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: expect.stringContaining('"method":"tools/call"')
      })

      expect(result.current.data?.pages).toHaveLength(1)
      expect(result.current.data?.pages[0].memories).toHaveLength(2)
      expect(result.current.hasNextPage).toBe(true)
    })

    it('fetches next page when fetchNextPage is called', async () => {
      let callCount = 0
      mockFetch.mockImplementation(() => {
        callCount++
        const memories = callCount === 1 
          ? mockMemoriesResponse 
          : {
              result: {
                content: [{
                  text: JSON.stringify({
                    memories: [
                      {
                        memory: {
                          content: 'Third memory',
                          metadata: {
                            memory_id: 'mem_789',
                            type: 'procedural',
                            project: 'test-project',
                            agent_id: 'claude-code',
                            created_at: '2025-06-12T13:12:23.480Z',
                            tags: ['procedural']
                          }
                        }
                      }
                    ],
                    has_more: false,
                    total_count: 3
                  })
                }]
              }
            }
        
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(memories)
        })
      })

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useInfiniteMemories(''), { wrapper })

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data?.pages).toHaveLength(1)
      expect(result.current.hasNextPage).toBe(true)

      // Fetch next page
      result.current.fetchNextPage()

      await waitFor(() => {
        expect(result.current.data?.pages).toHaveLength(2)
      })

      expect(result.current.data?.pages[1].memories).toHaveLength(1)
      expect(result.current.hasNextPage).toBe(false)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('handles search query parameter', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockMemoriesResponse)
      })

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useInfiniteMemories('test search'), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/memory/mcp', 
        expect.objectContaining({
          body: expect.stringContaining('"query":"test search"')
        })
      )
    })

    it('normalizes memory data correctly', async () => {
      const responseWithVariousFormats = {
        result: {
          content: [{
            text: JSON.stringify({
              memories: [
                // New nested format
                {
                  memory: {
                    content: 'Nested format memory',
                    metadata: {
                      memory_id: 'mem_nested',
                      type: 'episodic',
                      project: 'test'
                    }
                  }
                },
                // Old flat format
                {
                  memory_id: 'mem_flat',
                  content: 'Flat format memory',
                  type: 'semantic',
                  project: 'test'
                },
                // Missing data format
                {
                  memory: {
                    // Missing content
                    metadata: {
                      memory_id: 'mem_missing',
                      type: 'procedural'
                    }
                  }
                }
              ],
              has_more: false,
              total_count: 3
            })
          }]
        }
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseWithVariousFormats)
      })

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useInfiniteMemories(''), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      const memories = result.current.data?.pages[0].memories
      expect(memories).toHaveLength(3)

      // Check normalized data
      expect(memories?.[0]).toMatchObject({
        id: 'mem_nested',
        content: 'Nested format memory',
        type: 'episodic',
        project: 'test'
      })

      expect(memories?.[1]).toMatchObject({
        id: 'mem_flat',
        content: 'Flat format memory',
        type: 'semantic',
        project: 'test'
      })

      expect(memories?.[2]).toMatchObject({
        id: 'mem_missing',
        content: 'No content available',
        type: 'procedural',
        project: 'unknown'
      })
    })

    it('handles API errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useInfiniteMemories(''), { wrapper })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toBeInstanceOf(Error)
    })

    it('calculates hasNextPage correctly', async () => {
      // Test with has_more: false
      const noMoreResponse = {
        result: {
          content: [{
            text: JSON.stringify({
              memories: [{ memory: { content: 'test', metadata: { memory_id: 'test' } } }],
              has_more: false,
              total_count: 1
            })
          }]
        }
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(noMoreResponse)
      })

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useInfiniteMemories(''), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.hasNextPage).toBe(false)
    })

    it('uses correct offset calculation for pagination', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockMemoriesResponse)
      })

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useInfiniteMemories(''), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      // Fetch next page
      result.current.fetchNextPage()

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2)
      })

      // Check that second call uses correct offset
      const secondCall = mockFetch.mock.calls[1]
      const secondCallBody = JSON.parse(secondCall[1].body)
      expect(secondCallBody.params.arguments.offset).toBe(20) // pageParam (1) * limit (20)
    })
  })

  describe('useMemoryStats', () => {
    it('fetches memory statistics', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockStatsResponse)
      })

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useMemoryStats(), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/memory/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: expect.stringContaining('"name":"get-memory-statistics"')
      })

      expect(result.current.data?.storage.total_memories).toBe(100)
      expect(result.current.data?.graph).toHaveLength(1)
    })

    it('handles stats API errors', async () => {
      mockFetch.mockRejectedValue(new Error('Stats API error'))

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useMemoryStats(), { wrapper })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toBeInstanceOf(Error)
    })

    it('refetches stats periodically', async () => {
      vi.useFakeTimers()

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockStatsResponse)
      })

      const wrapper = createQueryWrapper()
      renderHook(() => useMemoryStats(), { wrapper })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      // Fast forward 10 seconds (refetch interval)
      vi.advanceTimersByTime(10000)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2)
      })

      vi.useRealTimers()
    })
  })
})