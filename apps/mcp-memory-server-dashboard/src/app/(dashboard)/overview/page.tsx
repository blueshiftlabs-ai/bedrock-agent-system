import { MemoryOverview } from '@/components/memory-overview'
import { ErrorBoundary } from '@/components/error-boundary'

export default function OverviewPage() {
  return (
    <ErrorBoundary>
      <MemoryOverview />
    </ErrorBoundary>
  )
}