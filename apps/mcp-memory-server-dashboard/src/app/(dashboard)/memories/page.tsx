import { MemoryBrowserInfinite } from '@/components/memory-browser-infinite'
import { ErrorBoundary } from '@/components/error-boundary'

export default function MemoriesPage() {
  return (
    <ErrorBoundary>
      <MemoryBrowserInfinite />
    </ErrorBoundary>
  )
}