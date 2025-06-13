import { AgentManagement } from '@/components/agent-management'
import { ErrorBoundary } from '@/components/error-boundary'

export default function AgentsPage() {
  return (
    <ErrorBoundary>
      <AgentManagement />
    </ErrorBoundary>
  )
}