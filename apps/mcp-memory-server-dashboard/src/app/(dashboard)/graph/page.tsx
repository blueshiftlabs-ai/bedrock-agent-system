import { GraphVisualization } from '@/components/graph-visualization'
import { ErrorBoundary } from '@/components/error-boundary'

export default function GraphPage() {
  return (
    <ErrorBoundary>
      <GraphVisualization />
    </ErrorBoundary>
  )
}