'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Brain, Database, Network, TrendingUp, FileText, Code, MessageSquare, Cog } from 'lucide-react'

interface MemoryStats {
  storage: {
    total_memories: number
    text_memories: number
    code_memories: number
    by_type: Record<string, { count: number }>
    by_content_type: Record<string, { count: number }>
    by_agent: Record<string, { count: number }>
    by_project: Record<string, { count: number }>
    recent_activity: Array<{
      memory_id: string
      type: string
      agent_id?: string
      created_at: string
    }>
  }
  graph: Array<{
    concept_id: string
    name: string
    category: string
    confidence: number
    related_memories: string[]
  }>
  timestamp: string
}

interface EnhancedMemoryActivity {
  memory_id: string
  type: string
  agent_id?: string
  created_at: string
  title: string
  content_preview: string
}

export function MemoryOverview() {
  const [stats, setStats] = useState<MemoryStats | null>(null)
  const [enhancedActivities, setEnhancedActivities] = useState<EnhancedMemoryActivity[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMemoryDetails = async (memoryIds: string[]): Promise<EnhancedMemoryActivity[]> => {
    console.log('Fetching memory details for IDs:', memoryIds.slice(0, 10))
    const enhanced: EnhancedMemoryActivity[] = []
    
    for (const id of memoryIds.slice(0, 10)) { // Limit to 10 for performance
      try {
        console.log(`Fetching details for memory: ${id}`)
        const response = await fetch('/api/memory/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/call',
            params: {
              name: 'retrieve-memories',
              arguments: {
                memory_ids: [id],
                limit: 1
              }
            }
          })
        })

        if (response.ok) {
          const data = await response.json()
          console.log(`Response for ${id}:`, data)
          if (data.result?.content?.[0]?.text) {
            const parsedData = JSON.parse(data.result.content[0].text)
            console.log(`Parsed data for ${id}:`, parsedData)
            
            // Handle both direct memory format and wrapped format
            const memories = parsedData.memories || (parsedData.memory_id ? [parsedData] : null)
            
            if (memories && memories.length > 0) {
              const memory = memories[0]
              const activityItem = stats?.storage.recent_activity.find(a => a.memory_id === id)
              
              // Safely handle memory content - check nested structure
              const memoryContent = memory?.value?.content || memory?.content || memory?.text || 'No content available'
              const firstLine = String(memoryContent).split('\n')[0] || String(memoryContent)
              const title = firstLine.slice(0, 60) + (firstLine.length > 60 ? '...' : '')
              const preview = String(memoryContent).slice(0, 120) + (String(memoryContent).length > 120 ? '...' : '')
              
              const enhancedItem = {
                memory_id: id,
                type: memory.type || activityItem?.type || 'unknown',
                agent_id: memory.agent_id || activityItem?.agent_id,
                created_at: memory.created_at || activityItem?.created_at || '',
                title,
                content_preview: preview
              }
              console.log(`Enhanced item for ${id}:`, enhancedItem)
              enhanced.push(enhancedItem)
            } else {
              console.log(`No memories found for ${id}`)
            }
          }
        } else {
          console.error(`Failed to fetch memory ${id}, status:`, response.status)
        }
      } catch (error) {
        console.error(`Failed to fetch memory ${id}:`, error)
      }
    }
    
    console.log('Final enhanced activities:', enhanced)
    return enhanced
  }

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/memory/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
              name: 'get-memory-statistics',
              arguments: {}
            }
          })
        })

        if (response.ok) {
          const data = await response.json()
          if (data.result?.content?.[0]?.text) {
            const statsData = JSON.parse(data.result.content[0].text)
            setStats(statsData)
            
            // Fetch enhanced memory details for recent activities
            if (statsData.storage.recent_activity.length > 0) {
              const memoryIds = statsData.storage.recent_activity.map((a: any) => a.memory_id)
              const enhanced = await fetchMemoryDetails(memoryIds)
              setEnhancedActivities(enhanced)
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch memory statistics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 10000) // Update every 10 seconds

    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-8 bg-muted rounded w-1/2"></div>
            </CardHeader>
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error Loading Statistics</CardTitle>
          <CardDescription>Unable to fetch memory server statistics</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const typeData = Object.entries(stats.storage.by_type).map(([type, data]) => ({
    name: type,
    count: data.count
  }))

  const agentData = Object.entries(stats.storage.by_agent).map(([agent, data]) => ({
    name: agent === 'unknown' ? 'Anonymous' : agent,
    count: data.count
  }))

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

  const getMemoryTypeIcon = (type: string) => {
    switch (type) {
      case 'episodic':
        return <MessageSquare className="h-4 w-4" />
      case 'semantic':
        return <Brain className="h-4 w-4" />
      case 'procedural':
        return <Cog className="h-4 w-4" />
      case 'working':
        return <FileText className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const getMemoryTypeColor = (type: string) => {
    switch (type) {
      case 'episodic':
        return 'bg-blue-500'
      case 'semantic':
        return 'bg-green-500'
      case 'procedural':
        return 'bg-yellow-500'
      case 'working':
        return 'bg-purple-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Memories</CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
              <Brain className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.storage.total_memories}</div>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              {stats.storage.text_memories} text, {stats.storage.code_memories} code
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border-emerald-200 dark:border-emerald-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Graph Concepts</CardTitle>
            <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center">
              <Network className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{stats.graph.length}</div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Connected memory clusters
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300">Active Agents</CardTitle>
            <div className="h-8 w-8 rounded-full bg-amber-500 flex items-center justify-center">
              <Database className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">{Object.keys(stats.storage.by_agent).length}</div>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Unique memory contributors
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">Recent Activity</CardTitle>
            <div className="h-8 w-8 rounded-full bg-purple-500 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{stats.storage.recent_activity.length}</div>
            <p className="text-xs text-purple-600 dark:text-purple-400">
              Last {stats.storage.recent_activity.length} memories
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Memory Types Distribution</CardTitle>
            <CardDescription>Breakdown by memory type</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#0088FE" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agent Contributions</CardTitle>
            <CardDescription>Memory distribution by agent</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={agentData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Recent Memory Activity</span>
          </CardTitle>
          <CardDescription>Latest memory operations with content previews</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {enhancedActivities.length > 0 ? enhancedActivities.map((activity) => (
              <div 
                key={activity.memory_id} 
                className="group p-4 border rounded-lg hover:shadow-md transition-all duration-200 cursor-pointer bg-gradient-to-r from-background to-muted/20"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="flex-shrink-0 mt-1">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${getMemoryTypeColor(activity.type)} text-white`}>
                        {getMemoryTypeIcon(activity.type)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                        {activity.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {activity.content_preview}
                      </p>
                      <div className="flex items-center space-x-2 mt-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getMemoryTypeColor(activity.type)} text-white`}>
                          {activity.type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          by {activity.agent_id || 'Anonymous'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground text-right flex-shrink-0 ml-4">
                    {new Date(activity.created_at).toLocaleDateString()}
                    <br />
                    {new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            )) : stats.storage.recent_activity.map((activity) => (
              <div 
                key={activity.memory_id} 
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className={`h-2 w-2 rounded-full ${getMemoryTypeColor(activity.type)}`} />
                  <div>
                    <p className="text-sm font-medium">{activity.memory_id}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity.type} • {activity.agent_id || 'Anonymous'}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(activity.created_at).toLocaleString()}
                </div>
              </div>
            ))}
            {stats.storage.recent_activity.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No recent memory activity</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}