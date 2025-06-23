'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart as BarChartIcon, PieChart as PieChartIcon } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

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
      count: (countObj as any)?.count || 0
    })) : []

  // Prepare data for pie chart
  const agentData = initialData.storage?.by_agent ? 
    Object.entries(initialData.storage.by_agent)
      .slice(0, 5)
      .map(([agent, countObj]) => ({
        name: agent || 'Anonymous',
        count: (countObj as any)?.count || 0
      })) : []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
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
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <PieChartIcon className="h-5 w-5" />
            <span>Agent Activity</span>
          </CardTitle>
          <CardDescription>Memory creation by agent</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={agentData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {agentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}