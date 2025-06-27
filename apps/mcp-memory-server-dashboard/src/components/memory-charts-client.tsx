'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart as BarChartIcon, PieChart as PieChartIcon } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { getMemoryTypeHexColor } from '@/lib/memory-utils'

// Colors for charts
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

interface MemoryChartsClientProps {
  initialData: any
}

export function MemoryChartsClient({ initialData }: MemoryChartsClientProps) {
  if (!initialData) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="h-64 flex items-center justify-center">
            <p className="text-muted-foreground">No chart data available</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="h-64 flex items-center justify-center">
            <p className="text-muted-foreground">No chart data available</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Prepare data for bar chart
  const memoryTypeData = initialData.storage?.by_type ? 
    Object.entries(initialData.storage.by_type).map(([type, countObj]) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      originalType: type, // Keep original type for color mapping
      count: (countObj as any)?.count || 0
    })) : []

  // Prepare data for pie chart with percentage calculations
  const agentEntries = initialData.storage?.by_agent ? 
    Object.entries(initialData.storage.by_agent) : []
  
  const totalAgentCount = agentEntries.reduce((sum, [, countObj]) => sum + ((countObj as any)?.count || 0), 0)
  
  const agentDataWithPercent = agentEntries
    .map(([agent, countObj]) => ({
      name: agent || 'Anonymous',
      count: (countObj as any)?.count || 0,
      percentage: totalAgentCount > 0 ? ((countObj as any)?.count || 0) / totalAgentCount * 100 : 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6) // Show top 6 agents
  
  const agentData = agentDataWithPercent.map(item => ({
    name: item.name,
    count: item.count,
    percentage: item.percentage
  }))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card id="memory-types-bar-chart">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChartIcon className="h-5 w-5" />
            <span>Memory Types Distribution</span>
          </CardTitle>
          <CardDescription>Breakdown of memory types in your system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={memoryTypeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count">
                  {memoryTypeData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={getMemoryTypeHexColor(entry.originalType)} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card id="agent-activity-pie-chart">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <PieChartIcon className="h-5 w-5" />
            <span>Agent Activity</span>
          </CardTitle>
          <CardDescription>Memory creation by agent</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Pie Chart */}
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={agentData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ percentage }) => percentage >= 2 ? `${percentage.toFixed(0)}%` : ''}
                    outerRadius={75}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {agentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any, name: any) => [
                      `${value} memories (${((value / totalAgentCount) * 100).toFixed(1)}%)`,
                      name
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Color-coded Legend */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Agents</h4>
              <div className="grid grid-cols-1 gap-1 text-xs">
                {agentData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <div 
                        className="w-3 h-3 rounded-sm flex-shrink-0" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-foreground truncate" title={entry.name}>
                        {entry.name}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-muted-foreground flex-shrink-0">
                      <span>{entry.count}</span>
                      <span>({entry.percentage.toFixed(1)}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}