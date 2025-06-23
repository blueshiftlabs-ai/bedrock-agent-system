import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function MemoryStatsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
          </CardHeader>
          <CardContent className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
            <div className="h-3 bg-muted rounded w-full"></div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function MemoryChartsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {[...Array(2)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="animate-pulse">
            <div className="h-5 bg-muted rounded w-1/2 mb-2"></div>
            <div className="h-3 bg-muted rounded w-3/4"></div>
          </CardHeader>
          <CardContent className="animate-pulse">
            <div className="h-64 bg-muted rounded"></div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function RecentActivitySkeleton() {
  return (
    <Card>
      <CardHeader className="animate-pulse">
        <div className="h-5 bg-muted rounded w-1/3 mb-2"></div>
        <div className="h-3 bg-muted rounded w-2/3"></div>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] overflow-hidden">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start space-x-3 animate-pulse">
                <div className="h-10 w-10 bg-muted rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-full mb-1"></div>
                  <div className="h-3 bg-muted rounded w-5/6"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}