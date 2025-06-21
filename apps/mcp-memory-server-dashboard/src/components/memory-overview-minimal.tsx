import { Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MemoryOverviewClient } from './memory-overview-client'

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

// Fallback default stats to prevent errors
function getDefaultMemoryStats(): MemoryStats {
  return {
    storage: {
      total_memories: 0,
      text_memories: 0,
      code_memories: 0,
      by_type: {},
      by_content_type: {},
      by_agent: {},
      by_project: {},
      recent_activity: []
    },
    graph: [],
    timestamp: new Date().toISOString()
  }
}

// Minimal RSC Server Component - no external data fetching for now
async function MemoryOverviewContent() {
  // Use default stats for now to test compilation
  const stats = getDefaultMemoryStats()

  return (
    <div className="space-y-6">
      {/* Key Metrics - Server-rendered with client interactions */}
      <MemoryOverviewClient stats={stats} />

      {/* Simple placeholder cards instead of charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Memory Types Distribution</CardTitle>
            <CardDescription>Chart temporarily disabled for debugging</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Memory types chart will be displayed here once compilation issues are resolved.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agent Contributions</CardTitle>
            <CardDescription>Chart temporarily disabled for debugging</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Agent contributions chart will be displayed here once compilation issues are resolved.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Memory activity will load here</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Recent memory activity component temporarily disabled for debugging compilation issues.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// Loading component for Suspense
function MemoryOverviewLoading() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-8 bg-muted rounded w-1/2"></div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Main export with Suspense - RSC Pattern
export function MemoryOverviewMinimal() {
  return (
    <Suspense fallback={<MemoryOverviewLoading />}>
      <MemoryOverviewContent />
    </Suspense>
  )
}