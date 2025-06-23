import { Suspense, lazy } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Brain, Database, Network, TrendingUp } from 'lucide-react'
import { MemoryStatsSkeleton, MemoryChartsSkeleton, RecentActivitySkeleton } from './loading-skeletons'

// Server component that fetches data
export async function MemoryStats() {
  const baseUrl = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3101' 
    : process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3101'
      
  const response = await fetch(`${baseUrl}/api/memory/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'get-memory-statistics',
        arguments: {}
      }
    }),
    cache: 'no-store'
  })

  if (!response.ok) {
    throw new Error('Failed to fetch stats')
  }

  const data = await response.json()
  const stats = JSON.parse(data.result?.content?.[0]?.text || '{}')

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900" data-testid="stats-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">Total Memories</CardTitle>
          <Brain className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.storage?.total_memories || 0}</div>
          <p className="text-xs text-blue-700 dark:text-blue-300">
            {stats.storage?.text_memories || 0} text, {stats.storage?.code_memories || 0} code
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900" data-testid="stats-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-green-900 dark:text-green-100">Graph Concepts</CardTitle>
          <Network className="h-4 w-4 text-green-600 dark:text-green-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-900 dark:text-green-100">{stats.graph?.length || 0}</div>
          <p className="text-xs text-green-700 dark:text-green-300">Connected memory clusters</p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900" data-testid="stats-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-amber-900 dark:text-amber-100">Active Agents</CardTitle>
          <Database className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">{Object.keys(stats.storage?.by_agent || {}).length}</div>
          <p className="text-xs text-amber-700 dark:text-amber-300">Unique memory contributors</p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900" data-testid="stats-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-purple-900 dark:text-purple-100">Recent Activity</CardTitle>
          <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{stats.storage?.recent_activity?.length || 0}</div>
          <p className="text-xs text-purple-700 dark:text-purple-300">Last 10 memories</p>
        </CardContent>
      </Card>
    </div>
  )
}

// Lazy load charts and activity sections
const MemoryCharts = lazy(() => import('./memory-charts'))
const RecentMemoryActivity = lazy(() => import('./recent-memory-activity-async'))

export function MemoryOverviewStreaming() {
  return (
    <div className="space-y-6">
      {/* Stats load immediately with streaming */}
      <Suspense fallback={<MemoryStatsSkeleton />}>
        <MemoryStats />
      </Suspense>

      {/* Charts load progressively */}
      <Suspense fallback={<MemoryChartsSkeleton />}>
        <MemoryCharts />
      </Suspense>

      {/* Recent activity loads last */}
      <Suspense fallback={<RecentActivitySkeleton />}>
        <RecentMemoryActivity />
      </Suspense>
    </div>
  )
}