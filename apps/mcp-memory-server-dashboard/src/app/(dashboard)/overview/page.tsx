import { Suspense } from 'react'
import { MemoryStatsSkeleton, MemoryChartsSkeleton, RecentActivitySkeleton } from '@/components/loading-skeletons'
import { ErrorBoundary } from '@/components/error-boundary'
import { MemoryStats } from '@/components/memory-overview-streaming'
import { RecentMemoryActivity } from '@/components/recent-memory-activity'

// Hybrid charts component that gets server data but renders client-side
async function ChartsWithServerData() {
  // Server-side data fetch
  const baseUrl = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3101' 
    : process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3101'
      
  try {
    const response = await fetch(`${baseUrl}/api/memory/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'get-memory-statistics',
          arguments: {}
        }
      }),
      cache: 'force-cache',
      next: { revalidate: 300 }
    })

    const data = await response.json()
    const chartData = JSON.parse(data.result?.content?.[0]?.text || '{}')
    
    // Import client component dynamically with server data
    const { MemoryChartsClient } = await import('@/components/memory-charts-client')
    return <MemoryChartsClient initialData={chartData} />
  } catch (error) {
    console.error('Error fetching chart data:', error)
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          Failed to load charts
        </div>
      </div>
    )
  }
}

export default function OverviewPage() {
  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Static page title - prerendered */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Memory System Overview</h1>
          <p className="text-muted-foreground">
            Comprehensive dashboard for monitoring memory operations, statistics, and system health.
          </p>
        </div>

        {/* Stats section - streams first */}
        <Suspense fallback={<MemoryStatsSkeleton />}>
          <MemoryStats />
        </Suspense>

        {/* Charts section - server data with client rendering */}
        <Suspense fallback={<MemoryChartsSkeleton />}>
          <ChartsWithServerData />
        </Suspense>

        {/* Recent activity - client component with original functionality */}
        <Suspense fallback={<RecentActivitySkeleton />}>
          <RecentMemoryActivity />
        </Suspense>
      </div>
    </ErrorBoundary>
  )
}