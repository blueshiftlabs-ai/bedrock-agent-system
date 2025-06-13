import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryBrowserSimple } from '../memory-browser-simple'

const mockFetch = vi.fn()
global.fetch = mockFetch

const mockMemoriesResponse = {
  memories: [
    {
      id: 'mem_123',
      content: 'Test memory content',
      type: 'episodic',
      project: 'test-project',
      timestamp: '2025-06-12T15:12:23.480Z',
      tags: ['test', 'memory']
    },
    {
      id: 'mem_456',
      content: 'Another test memory',
      type: 'semantic',
      project: 'another-project',
      timestamp: '2025-06-12T14:12:23.480Z',
      tags: ['semantic', 'test']
    }
  ]
}

describe('MemoryBrowserSimple', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders search interface', () => {
    render(<MemoryBrowserSimple />)
    
    expect(screen.getByText('Memory Browser')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search memories...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add memory/i })).toBeInTheDocument()
  })

  it('searches memories automatically on mount', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        result: {
          content: [{
            text: JSON.stringify(mockMemoriesResponse)
          }]
        }
      })
    })

    render(<MemoryBrowserSimple />)

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
  })

  it('displays search results correctly', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        result: {
          content: [{
            text: JSON.stringify(mockMemoriesResponse)
          }]
        }
      })
    })

    render(<MemoryBrowserSimple />)

    await waitFor(() => {
      expect(screen.getByText('Search Results (2)')).toBeInTheDocument()
      expect(screen.getByText('Test memory content')).toBeInTheDocument()
      expect(screen.getByText('Another test memory')).toBeInTheDocument()
      expect(screen.getByText('episodic')).toBeInTheDocument()
      expect(screen.getByText('semantic')).toBeInTheDocument()
    })
  })

  it('handles search with query', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        result: {
          content: [{
            text: JSON.stringify(mockMemoriesResponse)
          }]
        }
      })
    })

    render(<MemoryBrowserSimple />)

    const searchInput = screen.getByPlaceholderText('Search memories...')
    fireEvent.change(searchInput, { target: { value: 'test query' } })
    
    const searchButton = screen.getByRole('button', { name: /search/i })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/memory/mcp', 
        expect.objectContaining({
          body: expect.stringContaining('"query":"test query"')
        })
      )
    })
  })

  it('handles Enter key in search input', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        result: {
          content: [{
            text: JSON.stringify(mockMemoriesResponse)
          }]
        }
      })
    })

    render(<MemoryBrowserSimple />)

    const searchInput = screen.getByPlaceholderText('Search memories...')
    fireEvent.change(searchInput, { target: { value: 'test query' } })
    fireEvent.keyDown(searchInput, { key: 'Enter' })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2) // Initial + search
    })
  })

  it('shows loading state during search', async () => {
    mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<MemoryBrowserSimple />)

    const searchButton = screen.getByRole('button', { name: /searching/i })
    expect(searchButton).toBeDisabled()
    expect(screen.getByText('Searching memories...')).toBeInTheDocument()
  })

  it('displays no results message when empty', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        result: {
          content: [{
            text: JSON.stringify({ memories: [] })
          }]
        }
      })
    })

    render(<MemoryBrowserSimple />)

    await waitFor(() => {
      expect(screen.getByText('No memories found. Try adjusting your search criteria.')).toBeInTheDocument()
    })
  })

  it('handles API errors gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('API Error'))

    render(<MemoryBrowserSimple />)

    await waitFor(() => {
      expect(screen.getByText('No memories found. Try adjusting your search criteria.')).toBeInTheDocument()
    })
  })

  it('handles malformed API responses', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        result: {
          content: [{
            text: 'invalid json'
          }]
        }
      })
    })

    render(<MemoryBrowserSimple />)

    await waitFor(() => {
      expect(screen.getByText('No memories found. Try adjusting your search criteria.')).toBeInTheDocument()
    })
  })

  it('normalizes memory data correctly', async () => {
    const malformedMemories = {
      memories: [
        {
          // Missing id, content, etc - should be normalized
          type: 'episodic',
          tags: 'not-an-array'
        }
      ]
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        result: {
          content: [{
            text: JSON.stringify(malformedMemories)
          }]
        }
      })
    })

    render(<MemoryBrowserSimple />)

    await waitFor(() => {
      expect(screen.getByText('No content available')).toBeInTheDocument()
      expect(screen.getByText('episodic')).toBeInTheDocument()
      expect(screen.getByText('unknown')).toBeInTheDocument() // Default project
    })
  })
})