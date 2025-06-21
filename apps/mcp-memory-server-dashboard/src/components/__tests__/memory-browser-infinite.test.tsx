import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { MemoryBrowserInfinite } from '../memory-browser-infinite'

// Mock next/navigation
const mockPush = vi.fn()
const mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}))

// Mock intersection observer
class MockIntersectionObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
})

Object.defineProperty(global, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
})

const mockFetch = vi.fn()
global.fetch = mockFetch

const createMockMemoriesResponse = (memories: any[], hasMore = false) => ({
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

const mockMemoriesPage1 = [
  {
    memory: {
      content: 'First page memory 1',
      metadata: {
        memory_id: 'mem_001',
        type: 'episodic',
        project: 'test-project',
        agent_id: 'claude-code',
        created_at: '2025-06-12T15:12:23.480Z',
        tags: ['page1', 'test']
      }
    }
  },
  {
    memory: {
      content: 'First page memory 2',
      metadata: {
        memory_id: 'mem_002',
        type: 'semantic',
        project: 'test-project',
        agent_id: 'claude-code',
        created_at: '2025-06-12T14:12:23.480Z',
        tags: ['page1', 'test']
      }
    }
  }
]

const mockMemoriesPage2 = [
  {
    memory: {
      content: 'Second page memory 1',
      metadata: {
        memory_id: 'mem_003',
        type: 'procedural',
        project: 'test-project',
        agent_id: 'claude-code',
        created_at: '2025-06-12T13:12:23.480Z',
        tags: ['page2', 'test']
      }
    }
  },
  {
    memory: {
      content: 'Second page memory 2',
      metadata: {
        memory_id: 'mem_004',
        type: 'working',
        project: 'test-project',
        agent_id: 'claude-code',
        created_at: '2025-06-12T12:12:23.480Z',
        tags: ['page2', 'test']
      }
    }
  }
]

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  })
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('MemoryBrowserInfinite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(createMockMemoriesResponse(mockMemoriesPage1, true))
    })
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('renders the memory browser interface', async () => {
    render(
      <TestWrapper>
        <MemoryBrowserInfinite />
      </TestWrapper>
    )
    
    expect(screen.getByTestId('memory-browser')).toBeInTheDocument()
    expect(screen.getByText('Memory Browser')).toBeInTheDocument()
    expect(screen.getByText('Search and browse stored memories with infinite scrolling')).toBeInTheDocument()
    expect(screen.getByTestId('memory-search')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add memory/i })).toBeInTheDocument()
  })

  it('loads initial memories on mount', async () => {
    render(
      <TestWrapper>
        <MemoryBrowserInfinite />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/memory/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: expect.stringContaining('retrieve-memories')
      })
    })

    await waitFor(() => {
      expect(screen.getByText('First page memory 1')).toBeInTheDocument()
      expect(screen.getByText('First page memory 2')).toBeInTheDocument()
    })
  })

  it('displays debug pagination info', async () => {
    render(
      <TestWrapper>
        <MemoryBrowserInfinite />
      </TestWrapper>
    )

    // Wait for initial data to load first
    await waitFor(() => {
      expect(screen.getByText('First page memory 1')).toBeInTheDocument()
    }, { timeout: 10000 })

    // Then check for debug info
    await waitFor(() => {
      expect(screen.getByText(/Pages: 1, HasNext: Y/)).toBeInTheDocument()
    })
  })

  it('deduplicates memories with same IDs', async () => {
    const duplicateMemories = [
      ...mockMemoriesPage1,
      ...mockMemoriesPage1 // Duplicate the same memories
    ]

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(createMockMemoriesResponse(duplicateMemories, false))
    })

    render(
      <TestWrapper>
        <MemoryBrowserInfinite />
      </TestWrapper>
    )

    await waitFor(() => {
      const memoryItems = screen.getAllByTestId('memory-item')
      expect(memoryItems).toHaveLength(2) // Should be deduplicated to 2 unique items
    })
  })

  it('triggers infinite scroll fetch when more pages available', async () => {
    let callCount = 0
    mockFetch.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(createMockMemoriesResponse(mockMemoriesPage1, true))
        })
      } else {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(createMockMemoriesResponse(mockMemoriesPage2, false))
        })
      }
    })

    render(
      <TestWrapper>
        <MemoryBrowserInfinite />
      </TestWrapper>
    )

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('First page memory 1')).toBeInTheDocument()
    })

    // Trigger load more by clicking the button
    const loadMoreButton = screen.getByRole('button', { name: /load more memories/i })
    fireEvent.click(loadMoreButton)

    await waitFor(() => {
      expect(screen.getByText('Second page memory 1')).toBeInTheDocument()
      expect(screen.getByText('Second page memory 2')).toBeInTheDocument()
    })

    // Should have called fetch twice
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('shows loading state when fetching more memories', async () => {
    let resolveFirstCall: Function
    const firstCallPromise = new Promise(resolve => {
      resolveFirstCall = resolve
    })

    let callCount = 0
    mockFetch.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return firstCallPromise.then(() => ({
          ok: true,
          json: () => Promise.resolve(createMockMemoriesResponse(mockMemoriesPage1, true))
        }))
      } else {
        return new Promise(() => {}) // Never resolves to show loading state
      }
    })

    render(
      <TestWrapper>
        <MemoryBrowserInfinite />
      </TestWrapper>
    )

    // Resolve first call
    act(() => {
      resolveFirstCall!()
    })

    await waitFor(() => {
      expect(screen.getByText('First page memory 1')).toBeInTheDocument()
    })

    // Trigger second fetch
    const loadMoreButton = screen.getByRole('button', { name: /load more memories/i })
    fireEvent.click(loadMoreButton)

    await waitFor(() => {
      expect(screen.getByText('Loading more...')).toBeInTheDocument()
    })
  })

  it('handles search with debouncing', async () => {
    vi.useFakeTimers()

    render(
      <TestWrapper>
        <MemoryBrowserInfinite />
      </TestWrapper>
    )

    const searchInput = screen.getByTestId('memory-search')
    
    // Type in search input
    fireEvent.change(searchInput, { target: { value: 'test query' } })

    // Should not trigger immediate search
    expect(mockFetch).toHaveBeenCalledTimes(1) // Only initial call

    // Fast forward past debounce time
    act(() => {
      vi.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2) // Initial + debounced search
    })

    vi.useRealTimers()
  })

  it('shows and hides filter panel', async () => {
    render(
      <TestWrapper>
        <MemoryBrowserInfinite />
      </TestWrapper>
    )

    // Initially filters should be hidden
    expect(screen.queryByTestId('type-filter')).not.toBeInTheDocument()

    // Click filters button
    const filtersButton = screen.getByRole('button', { name: /filters/i })
    fireEvent.click(filtersButton)

    // Filters should now be visible
    expect(screen.getByTestId('type-filter')).toBeInTheDocument()
    expect(screen.getByText('Memory Types')).toBeInTheDocument()
    expect(screen.getByText('Agents')).toBeInTheDocument()
    expect(screen.getByText('Tags')).toBeInTheDocument()
    expect(screen.getByText('Sort By')).toBeInTheDocument()
  })

  it('filters memories by type', async () => {
    render(
      <TestWrapper>
        <MemoryBrowserInfinite />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('First page memory 1')).toBeInTheDocument()
      expect(screen.getByText('First page memory 2')).toBeInTheDocument()
    })

    // Open filters
    fireEvent.click(screen.getByRole('button', { name: /filters/i }))

    // Filter by episodic type only
    const episodicCheckbox = screen.getByTestId('type-episodic')
    fireEvent.click(episodicCheckbox)

    await waitFor(() => {
      // Should only show episodic memories
      expect(screen.getByText('First page memory 1')).toBeInTheDocument()
      expect(screen.queryByText('First page memory 2')).not.toBeInTheDocument()
    })
  })

  it('navigates to memory detail on click', async () => {
    render(
      <TestWrapper>
        <MemoryBrowserInfinite />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('First page memory 1')).toBeInTheDocument()
    })

    const memoryItem = screen.getByTestId('memory-item')
    fireEvent.click(memoryItem)

    expect(mockPush).toHaveBeenCalledWith('/memory/mem_001')
  })

  it('shows empty state when no memories found', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(createMockMemoriesResponse([], false))
    })

    render(
      <TestWrapper>
        <MemoryBrowserInfinite />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('No memories found. Try adjusting your search criteria.')).toBeInTheDocument()
    })
  })

  it('handles API errors gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    render(
      <TestWrapper>
        <MemoryBrowserInfinite />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Loading memories...')).toBeInTheDocument()
    })
  })

  it('sorts memories correctly', async () => {
    render(
      <TestWrapper>
        <MemoryBrowserInfinite />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('First page memory 1')).toBeInTheDocument()
    })

    // Open filters
    fireEvent.click(screen.getByRole('button', { name: /filters/i }))

    // Change sort to content
    const sortSelect = screen.getByDisplayValue('Date Created')
    fireEvent.click(sortSelect)
    fireEvent.click(screen.getByText('Content'))

    // Memories should be sorted alphabetically by content
    const memoryItems = screen.getAllByTestId('memory-item')
    const firstMemoryContent = memoryItems[0].textContent
    expect(firstMemoryContent).toContain('First page memory 1') // Should be first alphabetically
  })

  it('clears all filters when clear button clicked', async () => {
    render(
      <TestWrapper>
        <MemoryBrowserInfinite />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('First page memory 1')).toBeInTheDocument()
    })

    // Open filters and apply some
    fireEvent.click(screen.getByRole('button', { name: /filters/i }))
    fireEvent.click(screen.getByTestId('type-episodic'))

    // Should show filter is applied
    await waitFor(() => {
      expect(screen.getByText(/1 of 2 memories \(filtered\)/)).toBeInTheDocument()
    })

    // Clear filters
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }))

    // Should show all memories again
    await waitFor(() => {
      expect(screen.getByText('First page memory 1')).toBeInTheDocument()
      expect(screen.getByText('First page memory 2')).toBeInTheDocument()
    })
  })

  it('shows correct memory count with filters', async () => {
    render(
      <TestWrapper>
        <MemoryBrowserInfinite />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Memories (2)')).toBeInTheDocument()
    })

    // Apply filter
    fireEvent.click(screen.getByRole('button', { name: /filters/i }))
    fireEvent.click(screen.getByTestId('type-episodic'))

    await waitFor(() => {
      expect(screen.getByText('Memories (1')).toBeInTheDocument()
      expect(screen.getByText('1 of 2 memories (filtered)')).toBeInTheDocument()
    })
  })

  it('handles tag clicking for filtering', async () => {
    render(
      <TestWrapper>
        <MemoryBrowserInfinite />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('First page memory 1')).toBeInTheDocument()
    })

    // Click on a tag
    const tagBadge = screen.getByText('page1')
    fireEvent.click(tagBadge)

    // Should open filters and apply tag filter
    await waitFor(() => {
      expect(screen.getByTestId('type-filter')).toBeInTheDocument()
    })
  })
})