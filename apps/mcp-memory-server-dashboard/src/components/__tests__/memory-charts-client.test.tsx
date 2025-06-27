import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryChartsClient } from '../memory-charts-client'
import { getMemoryTypeHexColor } from '@/lib/memory-utils'

// Mock recharts components since they don't render properly in test environment
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children, data }: any) => (
    <div data-testid="bar-chart" data-chart-data={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Bar: ({ children }: any) => <div data-testid="bar">{children}</div>,
  Cell: ({ fill }: any) => <div data-testid="bar-cell" data-fill={fill} />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children }: any) => <div data-testid="pie">{children}</div>,
}))

const mockData = {
  storage: {
    by_type: {
      episodic: { count: 50 },
      semantic: { count: 75 },
      procedural: { count: 30 },
      working: { count: 25 }
    },
    by_agent: {
      'claude-code': { count: 100 },
      'agent-2': { count: 80 }
    }
  }
}

describe('MemoryChartsClient', () => {
  it('renders memory types bar chart with correct colors', () => {
    render(<MemoryChartsClient initialData={mockData} />)
    
    // Check that the bar chart component exists
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    
    // Check that the correct number of Cell components are rendered
    const cells = screen.getAllByTestId('bar-cell')
    expect(cells).toHaveLength(4) // episodic, semantic, procedural, working
    
    // Check that each cell has the correct color based on memory type
    const expectedColors = {
      episodic: '#3b82f6',  // Blue
      semantic: '#10b981',  // Green
      procedural: '#8b5cf6', // Purple
      working: '#f59e0b'    // Amber
    }
    
    // Verify each cell has the correct color
    cells.forEach((cell, index) => {
      const fill = cell.getAttribute('data-fill')
      expect(Object.values(expectedColors)).toContain(fill)
    })
  })

  it('uses correct memory type colors from utility function', () => {
    // Test the color utility function directly
    expect(getMemoryTypeHexColor('episodic')).toBe('#3b82f6')
    expect(getMemoryTypeHexColor('semantic')).toBe('#10b981')
    expect(getMemoryTypeHexColor('procedural')).toBe('#8b5cf6')
    expect(getMemoryTypeHexColor('working')).toBe('#f59e0b')
    expect(getMemoryTypeHexColor('unknown')).toBe('#6b7280') // default
  })

  it('renders cards with correct IDs', () => {
    render(<MemoryChartsClient initialData={mockData} />)
    
    expect(document.getElementById('memory-types-bar-chart')).toBeInTheDocument()
    expect(document.getElementById('agent-activity-pie-chart')).toBeInTheDocument()
  })

  it('handles missing data gracefully', () => {
    render(<MemoryChartsClient initialData={null} />)
    
    expect(screen.getAllByText('No chart data available')).toHaveLength(2)
  })

  it('prepares memory type data with original types preserved', () => {
    render(<MemoryChartsClient initialData={mockData} />)
    
    const barChart = screen.getByTestId('bar-chart')
    const chartData = JSON.parse(barChart.getAttribute('data-chart-data') || '[]')
    
    // Check that data includes both display names and original types
    expect(chartData).toEqual([
      { name: 'Episodic', originalType: 'episodic', count: 50 },
      { name: 'Semantic', originalType: 'semantic', count: 75 },
      { name: 'Procedural', originalType: 'procedural', count: 30 },
      { name: 'Working', originalType: 'working', count: 25 }
    ])
  })
})