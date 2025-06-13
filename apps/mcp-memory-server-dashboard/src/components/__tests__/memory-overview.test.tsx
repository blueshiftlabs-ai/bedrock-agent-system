import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryOverview } from '../memory-overview'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock recharts components since they have rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
}))

const mockMemoryStats = {
  storage: {
    total_memories: 25,
    text_memories: 24,
    code_memories: 1,
    by_type: {
      episodic: { count: 10 },
      procedural: { count: 7 },
      semantic: { count: 8 }
    },
    by_content_type: {
      text: { count: 24 },
      code: { count: 1 }
    },
    by_agent: {
      unknown: { count: 13 },
      'claude-code': { count: 12 }
    },
    by_project: {
      unknown: { count: 25 }
    },
    recent_activity: [
      {
        memory_id: 'mem_1749741143480_d1c986b8',
        type: 'procedural',
        created_at: '2025-06-12T15:12:23.480Z'
      },
      {
        memory_id: 'mem_1749739668741_54eca69e',
        type: 'episodic',
        created_at: '2025-06-12T14:47:48.741Z'
      }
    ]
  },
  graph: [
    {
      concept_id: 'concept_dashboard',
      name: 'dashboard',
      category: 'tag_cluster',
      confidence: 0.7,
      related_memories: ['mem_1749677347342_288ceab1']
    }
  ],
  timestamp: '2025-06-13T15:19:42.881Z'
}

const mockMemoryDetails = {
  memories: [
    {
      memory: {
        metadata: {
          memory_id: 'mem_1749741143480_d1c986b8',
          type: 'procedural',
          content_type: 'text',
          created_at: '2025-06-12T15:12:23.480Z',
          tags: ['memory-dashboard', 'error-handling']
        },
        content: 'Successfully completed all memory dashboard fixes and improvements:\n\n1. Fixed /memories page error with comprehensive error handling'
      }
    }
  ]
}

describe('MemoryOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves
    
    render(<MemoryOverview />)
    
    expect(screen.getAllByRole('generic')[0]).toHaveClass('animate-pulse')
  })

  it('renders memory statistics correctly', async () => {
    // Mock the statistics API call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        result: {
          content: [{
            text: JSON.stringify(mockMemoryStats)
          }]
        }
      })
    })

    // Mock the memory details API calls
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        result: {
          content: [{
            text: JSON.stringify(mockMemoryDetails)
          }]
        }
      })
    })

    render(<MemoryOverview />)

    await waitFor(() => {
      expect(screen.getByText('25')).toBeInTheDocument() // Total memories
      expect(screen.getByText('1')).toBeInTheDocument() // Graph concepts (length of array)
      expect(screen.getByText('2')).toBeInTheDocument() // Active agents
      expect(screen.getByText('2')).toBeInTheDocument() // Recent activity count
    })
  })

  it('renders memory activity with content previews', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        result: {
          content: [{
            text: JSON.stringify(mockMemoryStats)
          }]
        }
      })
    })

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        result: {
          content: [{
            text: JSON.stringify(mockMemoryDetails)
          }]
        }
      })
    })

    render(<MemoryOverview />)

    await waitFor(() => {
      expect(screen.getByText('Successfully completed all memory dashboard fixes and improv...')).toBeInTheDocument()
      expect(screen.getByText('procedural')).toBeInTheDocument()
    })
  })

  it('handles API errors gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('API Error'))

    render(<MemoryOverview />)

    await waitFor(() => {
      expect(screen.getByText('Error Loading Statistics')).toBeInTheDocument()
      expect(screen.getByText('Unable to fetch memory server statistics')).toBeInTheDocument()
    })
  })

  it('renders fallback activity when enhanced details fail', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        result: {
          content: [{
            text: JSON.stringify(mockMemoryStats)
          }]
        }
      })
    })

    // Mock memory details to fail
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500
    })

    render(<MemoryOverview />)

    await waitFor(() => {
      expect(screen.getByText('mem_1749741143480_d1c986b8')).toBeInTheDocument()
      expect(screen.getByText('procedural • Anonymous')).toBeInTheDocument()
    })
  })

  it('handles empty recent activity', async () => {
    const emptyStats = {
      ...mockMemoryStats,
      storage: {
        ...mockMemoryStats.storage,
        recent_activity: []
      }
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        result: {
          content: [{
            text: JSON.stringify(emptyStats)
          }]
        }
      })
    })

    render(<MemoryOverview />)

    await waitFor(() => {
      expect(screen.getByText('No recent memory activity')).toBeInTheDocument()
    })
  })
})