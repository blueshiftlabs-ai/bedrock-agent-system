import { Suspense } from 'react'
import { MemoryBrowserInfinite } from '@/components/memory-browser-infinite'
import { ErrorBoundary } from '@/components/error-boundary'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

// Note: PPR requires Next.js canary
// export const experimental_ppr = true

// Loading skeleton for memory browser
function MemoryBrowserSkeleton() {
  return (
    <Card>
      <CardHeader className="animate-pulse">
        <div className="h-6 bg-muted rounded w-1/3 mb-2"></div>
        <div className="h-4 bg-muted rounded w-2/3"></div>
      </CardHeader>
      <CardContent>
        <div className="h-[600px] flex items-center justify-center">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading memories...</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function MemoriesPage() {
  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Static page title - prerendered */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Memory Browser</h1>
          <p className="text-muted-foreground">
            Comprehensive memory management with infinite scrolling, filtering, and search capabilities.
          </p>
        </div>

        {/* Memory browser - streams with client-side interactions */}
        <Suspense fallback={<MemoryBrowserSkeleton />}>
          <MemoryBrowserInfinite />
        </Suspense>
      </div>
    </ErrorBoundary>
  )
}