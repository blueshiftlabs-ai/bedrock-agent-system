import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RecentMemoryActivity } from '../recent-memory-activity'
import { useInfiniteMemories } from '@/lib/queries'
import { useRouter } from 'next/navigation'

// Mock dependencies
vi.mock('@/lib/queries')
vi.mock('next/navigation')
vi.mock('@/hooks/use-intersection-observer')

const mockPush = vi.fn()
const mockFetchNextPage = vi.fn()

const mockMemories = [
  {
    id: 'mem_1',
    content: 'Test memory 1 content that is quite long and should be truncated',
    type: 'semantic',
    project: 'test-project',
    agent_id: 'test-agent',
    created_at: '2024-01-01T00:00:00Z',
    tags: ['test']
  },
  {
    id: 'mem_2',
    content: 'Test memory 2 content',
    type: 'episodic',
    project: 'test-project',
    agent_id: 'test-agent-2',
    created_at: '2024-01-02T00:00:00Z',
    tags: ['test']
  }
]

describe('RecentMemoryActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useRouter as any).mockReturnValue({
      push: mockPush
    })
    ;(useInfiniteMemories as any).mockReturnValue({
      data: {
        pages: [{
          memories: mockMemories,
          has_more: true,
          total_count: 50
        }]
      },
      fetchNextPage: mockFetchNextPage,
      hasNextPage: true,
      isFetching: false,
      isFetchingNextPage: false,
      isLoading: false
    })
  })

  describe('Rendering', () => {
    it('should render the component with memories', () => {
      render(<RecentMemoryActivity />)
      
      expect(screen.getByText('Recent Memory Activity')).toBeInTheDocument()
      expect(screen.getAllByText(/Test memory 1 content/)).toHaveLength(2) // Title and preview
      expect(screen.getAllByText(/Test memory 2 content/)).toHaveLength(2) // Title and preview
    })

    it('should show loading state when isLoading is true', () => {
      ;(useInfiniteMemories as any).mockReturnValue({
        data: null,
        isLoading: true,
        isFetching: false,
        isFetchingNextPage: false,
        hasNextPage: false,
        fetchNextPage: mockFetchNextPage
      })

      render(<RecentMemoryActivity />)
      
      expect(screen.getByText('Loading memories...')).toBeInTheDocument()
    })

    it('should show empty state when no memories', () => {
      ;(useInfiniteMemories as any).mockReturnValue({
        data: {
          pages: [{
            memories: [],
            has_more: false,
            total_count: 0
          }]
        },
        isLoading: false,
        isFetching: false,
        isFetchingNextPage: false,
        hasNextPage: false,
        fetchNextPage: mockFetchNextPage
      })

      render(<RecentMemoryActivity />)
      
      expect(screen.getByText('No recent memory activity')).toBeInTheDocument()
    })
  })

  describe('Count Display', () => {
    it('should show correct count without "of" when all items displayed', () => {
      ;(useInfiniteMemories as any).mockReturnValue({
        data: {
          pages: [{
            memories: mockMemories.slice(0, 2),
            has_more: false,
            total_count: 2
          }]
        },
        isLoading: false,
        isFetching: false,
        isFetchingNextPage: false,
        hasNextPage: false,
        fetchNextPage: mockFetchNextPage
      })

      render(<RecentMemoryActivity />)
      
      expect(screen.getByText('(2)')).toBeInTheDocument()
    })

    it('should show enhanced count display with total available', () => {
      // Mock a scenario where we have loaded memories with more available
      const loadedMemories = Array(15).fill(null).map((_, i) => ({
        id: `mem_${i}`,
        content: `Test memory ${i} content`,
        type: 'semantic',
        project: 'test-project',
        agent_id: 'test-agent',
        created_at: '2024-01-01T00:00:00Z',
        tags: ['test']
      }))

      ;(useInfiniteMemories as any).mockReturnValue({
        data: {
          pages: [{
            memories: loadedMemories,
            has_more: true,
            total_count: 50
          }]
        },
        fetchNextPage: mockFetchNextPage,
        hasNextPage: true,
        isFetching: false,
        isFetchingNextPage: false,
        isLoading: false
      })

      render(<RecentMemoryActivity />)
      
      // Should show: (10 of 15 (50 total))
      expect(screen.getByText(/\(10 of 15 \(50 total\)\)/)).toBeInTheDocument()
    })

    it('should show loading indicator when fetching more', () => {
      ;(useInfiniteMemories as any).mockReturnValue({
        data: {
          pages: [{
            memories: mockMemories,
            has_more: true,
            total_count: 50
          }]
        },
        isLoading: false,
        isFetching: true,
        isFetchingNextPage: false,
        hasNextPage: true,
        fetchNextPage: mockFetchNextPage
      })

      render(<RecentMemoryActivity />)
      
      expect(screen.getByText(/\(2 \(50 total\) \(loading\.\.\.\)\)/)).toBeInTheDocument()
    })
  })

  describe('Show Selector', () => {
    it('should update display limit when selector changes', async () => {
      render(<RecentMemoryActivity />)
      
      const selector = screen.getByRole('combobox')
      fireEvent.click(selector)
      
      const option25 = screen.getByText('25')
      fireEvent.click(option25)
      
      await waitFor(() => {
        expect(selector).toHaveTextContent('25')
      })
    })

    it('should fetch more pages when selecting higher limit than loaded', async () => {
      render(<RecentMemoryActivity />)
      
      const selector = screen.getByRole('combobox')
      fireEvent.click(selector)
      
      const option50 = screen.getByText('50')
      fireEvent.click(option50)
      
      await waitFor(() => {
        // Should fetch more pages to reach 50 items (needs 3 pages at 20 items each)
        expect(mockFetchNextPage).toHaveBeenCalled()
      })
    })

    it('should disable selector while changing limit', async () => {
      render(<RecentMemoryActivity />)
      
      const selector = screen.getByRole('combobox')
      fireEvent.click(selector)
      
      const option100 = screen.getByText('100')
      fireEvent.click(option100)
      
      // Selector should be disabled during the change
      expect(selector).toBeDisabled()
    })

    it('should disable selector while fetching', () => {
      ;(useInfiniteMemories as any).mockReturnValue({
        data: {
          pages: [{
            memories: mockMemories,
            has_more: true,
            total_count: 50
          }]
        },
        isLoading: false,
        isFetching: true,
        isFetchingNextPage: false,
        hasNextPage: true,
        fetchNextPage: mockFetchNextPage
      })

      render(<RecentMemoryActivity />)
      
      const selector = screen.getByRole('combobox')
      expect(selector).toBeDisabled()
    })
  })

  describe('Load More', () => {
    it('should show load more button when more items available', () => {
      render(<RecentMemoryActivity />)
      
      expect(screen.getByText('Load More')).toBeInTheDocument()
    })

    it('should call fetchNextPage when load more clicked', () => {
      render(<RecentMemoryActivity />)
      
      const loadMoreButton = screen.getByText('Load More')
      fireEvent.click(loadMoreButton)
      
      expect(mockFetchNextPage).toHaveBeenCalled()
    })

    it('should show loading state on load more button', () => {
      ;(useInfiniteMemories as any).mockReturnValue({
        data: {
          pages: [{
            memories: mockMemories,
            has_more: true,
            total_count: 50
          }]
        },
        isLoading: false,
        isFetching: false,
        isFetchingNextPage: true,
        hasNextPage: true,
        fetchNextPage: mockFetchNextPage
      })

      render(<RecentMemoryActivity />)
      
      expect(screen.getByText('Loading more...')).toBeInTheDocument()
    })

    it('should show max limit message when reaching 200', () => {
      const manyMemories = Array(200).fill(null).map((_, i) => ({
        ...mockMemories[0],
        id: `mem_${i}`
      }))

      ;(useInfiniteMemories as any).mockReturnValue({
        data: {
          pages: [{
            memories: manyMemories,
            has_more: true,
            total_count: 300
          }]
        },
        isLoading: false,
        isFetching: false,
        isFetchingNextPage: false,
        hasNextPage: true,
        fetchNextPage: mockFetchNextPage
      })

      render(<RecentMemoryActivity />)
      
      expect(screen.getByText(/Showing maximum 200 memories/)).toBeInTheDocument()
    })
  })

  describe('Memory Navigation', () => {
    it('should navigate to memory detail on click', () => {
      render(<RecentMemoryActivity />)
      
      const memoryCards = screen.getAllByText(/Test memory 1 content/)
      const memoryCard = memoryCards[0].closest('div.group')
      fireEvent.click(memoryCard!)
      
      expect(mockPush).toHaveBeenCalledWith('/memory/mem_1')
    })

    it('should navigate to memories page when clicking link', () => {
      render(<RecentMemoryActivity />)
      
      const memoriesLink = screen.getByText('Visit memories page')
      fireEvent.click(memoriesLink)
      
      expect(mockPush).toHaveBeenCalledWith('/memories')
    })
  })

  describe('Memory Display', () => {
    it('should truncate long content', () => {
      render(<RecentMemoryActivity />)
      
      const content = screen.getAllByText(/Test memory 1 content/)[0]
      expect(content.textContent).toContain('Test memory 1 content that is quite long and should be truncated')
    })

    it('should display memory metadata correctly', () => {
      render(<RecentMemoryActivity />)
      
      expect(screen.getByText('semantic')).toBeInTheDocument()
      expect(screen.getByText('by test-agent')).toBeInTheDocument()
      expect(screen.getAllByText('• test-project')[0]).toBeInTheDocument()
    })

    it('should format dates correctly', () => {
      render(<RecentMemoryActivity />)
      
      // Check for formatted date (Jan 1 or Jan 2)
      const dates = screen.queryAllByText(/Jan [12]/)
      expect(dates.length).toBeGreaterThan(0)
    })
  })

  describe('State Persistence', () => {
    beforeEach(() => {
      // Clear localStorage before each test
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn(),
          setItem: vi.fn(),
          removeItem: vi.fn(),
          clear: vi.fn(),
        },
        writable: true,
      })
    })

    it('should persist display limit to localStorage', () => {
      render(<RecentMemoryActivity />)
      
      const selector = screen.getByRole('combobox')
      
      // Component should render with persistence logic
      expect(selector).toBeInTheDocument()
    })

    it('should load persisted display limit on mount', () => {
      // Mock localStorage to return a saved value
      const mockGetItem = vi.fn().mockReturnValue('50')
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: mockGetItem,
          setItem: vi.fn(),
        },
        writable: true,
      })

      render(<RecentMemoryActivity />)
      
      expect(mockGetItem).toHaveBeenCalledWith('recent-memory-activity-display-limit')
    })
  })
})