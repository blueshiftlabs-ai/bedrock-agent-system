'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Brain, Database, Network, TrendingUp, Wifi, WifiOff } from 'lucide-react'
import { useMemoryStream } from '@/hooks/use-memory-stream'

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

interface MemoryOverviewClientProps {
  stats: MemoryStats
}

export function MemoryOverviewClient({ stats: initialStats }: MemoryOverviewClientProps) {
  const router = useRouter()
  const [stats, setStats] = useState<MemoryStats>(initialStats)
  
  // SSE connection for real-time updates
  const { isConnected, lastUpdate, error: streamError } = useMemoryStream()
  
  // Handle real-time updates functionally
  useEffect(() => {
    if (!lastUpdate) return
    
    const isMemoryChange = ['memory_created', 'memory_updated', 'memory_deleted'].includes(lastUpdate.type)
    const isStatsUpdate = lastUpdate.type === 'stats_updated'
    
    if (isStatsUpdate && lastUpdate.data) {
      setStats(lastUpdate.data)
    } else if (isMemoryChange) {
      // Optimistically update count for immediate feedback
      setStats(prev => ({
        ...prev,
        storage: {
          ...prev.storage,
          total_memories: prev.storage.total_memories + (lastUpdate.type === 'memory_created' ? 1 : 0)
        }
      }))
    }
  }, [lastUpdate])

  const handleNavigation = (path: string) => {
    router.push(path)
  }

  const handleScrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    element?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      {/* Connection Status Indicator */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          Last updated: {new Date(stats.timestamp).toLocaleTimeString()}
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <div className="flex items-center gap-1 text-green-600">
              <Wifi className="h-4 w-4" />
              <span className="text-xs">Live</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-red-600">
              <WifiOff className="h-4 w-4" />
              <span className="text-xs">Disconnected</span>
            </div>
          )}
          {streamError && (
            <span className="text-xs text-red-600">{streamError}</span>
          )}
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card 
          className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800 cursor-pointer transition-all hover:scale-105 hover:shadow-lg"
          onClick={() => handleNavigation('/memories')}
        >
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

        <Card 
          className="relative overflow-hidden bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border-emerald-200 dark:border-emerald-800 cursor-pointer transition-all hover:scale-105 hover:shadow-lg"
          onClick={() => handleNavigation('/graph')}
        >
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

        <Card 
          className="relative overflow-hidden bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800 cursor-pointer transition-all hover:scale-105 hover:shadow-lg"
          onClick={() => handleNavigation('/agents')}
        >
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

        <Card 
          className="relative overflow-hidden bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800 cursor-pointer transition-all hover:scale-105 hover:shadow-lg"
          onClick={() => handleScrollToSection('recent-activity-section')}
        >
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
    </>
  )
}