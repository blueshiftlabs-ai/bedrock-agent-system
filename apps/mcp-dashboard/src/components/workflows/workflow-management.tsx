'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useWebSocket } from '@/lib/websocket-provider'
import { Workflow, WorkflowStep } from '@/types'
import { formatDuration, getStatusColor } from '@/lib/utils'
import { Workflow as WorkflowIcon, Plus, Play, Pause, Square, RefreshCw } from 'lucide-react'
import { WorkflowBuilder } from './workflow-builder'

export function WorkflowManagement() {
  const { connected, subscribe, unsubscribe, emit } = useWebSocket()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null)
  const [showBuilder, setShowBuilder] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const handleWorkflowUpdate = (workflow: Workflow) => {
      setWorkflows(prev => {
        const index = prev.findIndex(w => w.id === workflow.id)
        if (index >= 0) {
          return prev.map((w, i) => i === index ? workflow : w)
        }
        return [...prev, workflow]
      })
    }

    const handleWorkflowList = (workflowList: Workflow[]) => {
      setWorkflows(workflowList)
      setLoading(false)
    }

    subscribe('workflow_update', handleWorkflowUpdate)
    subscribe('workflow_list', handleWorkflowList)
    
    // Request initial workflow list
    if (connected) {
      emit('get_workflows', {})
      setLoading(true)
    }

    return () => {
      unsubscribe('workflow_update', handleWorkflowUpdate)
      unsubscribe('workflow_list', handleWorkflowList)
    }
  }, [connected, subscribe, unsubscribe, emit])

  const handleWorkflowAction = (workflowId: string, action: 'start' | 'pause' | 'stop' | 'restart') => {
    emit('workflow_action', { workflowId, action })
  }

  const refreshWorkflows = () => {
    setLoading(true)
    emit('get_workflows', {})
  }

  const runningWorkflows = workflows.filter(w => w.status === 'running')
  const completedWorkflows = workflows.filter(w => w.status === 'completed')
  const failedWorkflows = workflows.filter(w => w.status === 'failed')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Workflow Management</h1>
        <div className="flex gap-2">
          <Button onClick={() => setShowBuilder(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Workflow
          </Button>
          <Button variant="outline" onClick={refreshWorkflows} disabled={loading || !connected}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Workflows</CardTitle>
            <WorkflowIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workflows.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <Play className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{runningWorkflows.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <RefreshCw className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{completedWorkflows.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <Square className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failedWorkflows.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Workflows</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading workflows...</span>
              </div>
            ) : workflows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No workflows found
                <div className="mt-2">
                  <Button onClick={() => setShowBuilder(true)}>
                    Create your first workflow
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {workflows.map((workflow) => (
                  <div
                    key={workflow.id}
                    className={`p-3 border rounded-md cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedWorkflow?.id === workflow.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => setSelectedWorkflow(workflow)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{workflow.name}</p>
                        <p className="text-sm text-muted-foreground">{workflow.description}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${getStatusColor(workflow.status)}`}>
                        {workflow.status}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                      <span>{workflow.steps.length} steps</span>
                      <span>
                        {workflow.status === 'running' && workflow.currentStep !== undefined
                          ? `Step ${workflow.currentStep + 1}/${workflow.steps.length}`
                          : `Updated ${formatDuration(Date.now() - workflow.updatedAt.getTime())} ago`
                        }
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedWorkflow && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{selectedWorkflow.name}</CardTitle>
                <div className="flex gap-1">
                  {selectedWorkflow.status === 'running' ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleWorkflowAction(selectedWorkflow.id, 'pause')}
                      >
                        <Pause className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleWorkflowAction(selectedWorkflow.id, 'stop')}
                      >
                        <Square className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleWorkflowAction(selectedWorkflow.id, 'start')}
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleWorkflowAction(selectedWorkflow.id, 'restart')}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">{selectedWorkflow.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Status:</span>
                    <span className={`ml-2 px-2 py-1 rounded-md text-xs ${getStatusColor(selectedWorkflow.status)}`}>
                      {selectedWorkflow.status}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Created:</span>
                    <span className="ml-2 text-muted-foreground">
                      {selectedWorkflow.createdAt.toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Server:</span>
                    <span className="ml-2 text-muted-foreground">{selectedWorkflow.serverId}</span>
                  </div>
                  <div>
                    <span className="font-medium">Created By:</span>
                    <span className="ml-2 text-muted-foreground">{selectedWorkflow.createdBy}</span>
                  </div>
                </div>

                {selectedWorkflow.metrics && (
                  <div>
                    <h4 className="font-medium mb-2">Metrics</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Completed: {selectedWorkflow.metrics.completedSteps}/{selectedWorkflow.metrics.totalSteps}</div>
                      <div>Failed: {selectedWorkflow.metrics.failedSteps}</div>
                      <div>Execution Time: {formatDuration(selectedWorkflow.metrics.executionTime)}</div>
                      <div>Throughput: {selectedWorkflow.metrics.throughput.toFixed(2)}/s</div>
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="font-medium mb-2">Steps</h4>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {selectedWorkflow.steps.map((step, index) => (
                      <div
                        key={step.id}
                        className={`p-2 rounded border text-sm ${
                          index === selectedWorkflow.currentStep ? 'bg-blue-50 border-blue-200' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{step.name}</span>
                          <span className={`px-1 py-0.5 rounded text-xs ${getStatusColor(step.status)}`}>
                            {step.status}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {step.type} • {step.dependencies.length} dependencies
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {showBuilder && (
        <WorkflowBuilder
          open={showBuilder}
          onOpenChange={setShowBuilder}
        />
      )}
    </div>
  )
}