import { render, screen, waitFor } from '@testing-library/react'
import { vi, beforeEach, afterEach } from 'vitest'
import MemoryCharts from '../memory-charts'

// Mock fetch
global.fetch = vi.fn()

const mockChartData = {
  storage: {
    total_memories: 124,
    by_type: {
      procedural: { count: 44 },
      episodic: { count: 38 },
      semantic: { count: 40 },
      working: { count: 2 }
    },
    by_agent: {
      'claude-code': { count: 114 },
      'claude-opus-4-20250514': { count: 4 },
      'claude-sonnet-4': { count: 3 },
      'test-agent': { count: 2 },
      'another-agent': { count: 1 }
    }
  }
}

describe('MemoryCharts', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          content: [{ text: JSON.stringify(mockChartData) }]
        }
      })
    } as Response)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state initially', () => {
    render(<MemoryCharts />)
    
    expect(screen.getAllByText('Loading charts...')[0]).toBeInTheDocument()
  })

  it('renders charts with proper data', async () => {
    render(<MemoryCharts />)
    
    // Wait for charts to load
    await waitFor(() => {
      expect(screen.getByText('Memory Types Distribution')).toBeInTheDocument()
      expect(screen.getByText('Agent Activity')).toBeInTheDocument()
    })

    // Check that chart data is displayed
    await waitFor(() => {
      expect(screen.getByText('Breakdown of memory types in your system')).toBeInTheDocument()
      expect(screen.getByText('Memory creation by agent')).toBeInTheDocument()
    })
  })

  it('handles fetch error gracefully', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))
    
    render(<MemoryCharts />)
    
    await waitFor(() => {
      expect(screen.getAllByText('No chart data available')[0]).toBeInTheDocument()
    })
  })

  it('handles empty response gracefully', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          content: [{ text: '{}' }]
        }
      })
    } as Response)
    
    render(<MemoryCharts />)
    
    await waitFor(() => {
      expect(screen.getAllByText('No chart data available')[0]).toBeInTheDocument()
    })
  })

  it('makes correct API call', async () => {
    render(<MemoryCharts />)
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/memory/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: expect.any(Number),
          method: 'tools/call',
          params: {
            name: 'get-memory-statistics',
            arguments: {}
          }
        })
      })
    })
  })

  it('has proper accessibility labels', async () => {
    render(<MemoryCharts />)
    
    await waitFor(() => {
      // Check that chart titles are accessible headings
      const memoryTypesTitle = screen.getByText('Memory Types Distribution')
      const agentActivityTitle = screen.getByText('Agent Activity')
      
      expect(memoryTypesTitle).toBeInTheDocument()
      expect(agentActivityTitle).toBeInTheDocument()
      
      // Check descriptions are present
      expect(screen.getByText('Breakdown of memory types in your system')).toBeInTheDocument()
      expect(screen.getByText('Memory creation by agent')).toBeInTheDocument()
    })
  })

  it('displays charts in correct grid layout', async () => {
    render(<MemoryCharts />)
    
    await waitFor(() => {
      const container = screen.getByText('Memory Types Distribution').closest('div[class*="grid"]')
      expect(container).toHaveClass('grid', 'grid-cols-1', 'lg:grid-cols-2', 'gap-6')
    })
  })
})