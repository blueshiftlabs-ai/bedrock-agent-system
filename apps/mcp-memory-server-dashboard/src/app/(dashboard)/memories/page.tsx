import { MemoryBrowserSimple } from '@/components/memory-browser-simple'
import { ErrorBoundary } from '@/components/error-boundary'

export default function MemoriesPage() {
  return (
    <ErrorBoundary>
      <MemoryBrowserSimple />
    </ErrorBoundary>
  )
}