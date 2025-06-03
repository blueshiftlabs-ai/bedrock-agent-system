'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useWebSocket } from '@/lib/websocket-provider'
import { WorkflowStep } from '@/types'
import { generateId } from '@/lib/utils'
import { Plus, Trash2, ArrowDown } from 'lucide-react'

interface WorkflowBuilderProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WorkflowBuilder({ open, onOpenChange }: WorkflowBuilderProps) {
  const { emit } = useWebSocket()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    createdBy: 'dashboard-user',
  })
  const [steps, setSteps] = useState<Omit<WorkflowStep, 'id'>[]>([])

  const stepTypes = [
    { value: 'agent', label: 'Agent Action' },
    { value: 'tool', label: 'Tool Execution' },
    { value: 'decision', label: 'Decision Point' },
    { value: 'parallel', label: 'Parallel Execution' },
    { value: 'loop', label: 'Loop' },
  ]

  const agentTypes = [
    'code-analyzer',
    'db-analyzer',
    'documentation-generator',
    'knowledge-builder',
  ]

  const addStep = () => {
    const newStep: Omit<WorkflowStep, 'id'> = {
      name: `Step ${steps.length + 1}`,
      type: 'agent',
      status: 'pending',
      config: {},
      dependencies: [],
    }
    setSteps([...steps, newStep])
  }

  const updateStep = (index: number, updates: Partial<Omit<WorkflowStep, 'id'>>) => {
    setSteps(steps.map((step, i) => i === index ? { ...step, ...updates } : step))
  }

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const workflow = {
      ...formData,
      steps: steps.map(step => ({ ...step, id: generateId() })),
      variables: {},
    }

    emit('create_workflow', workflow)
    
    // Reset form
    setFormData({
      name: '',
      description: '',
      createdBy: 'dashboard-user',
    })
    setSteps([])
    
    onOpenChange(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-6">Create Workflow</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">Workflow Name</label>
                <input
                  type="text"
                  required
                  className="w-full p-2 border rounded-md"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Code Analysis Workflow"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Created By</label>
                <input
                  type="text"
                  required
                  className="w-full p-2 border rounded-md"
                  value={formData.createdBy}
                  onChange={(e) => setFormData({ ...formData, createdBy: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                required
                className="w-full p-2 border rounded-md"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this workflow does..."
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Workflow Steps</h3>
                <Button type="button" onClick={addStep}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Step
                </Button>
              </div>

              {steps.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-muted-foreground">No steps added yet</p>
                    <Button className="mt-2" type="button" onClick={addStep}>
                      Add First Step
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {steps.map((step, index) => (
                    <div key={index}>
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Step {index + 1}</CardTitle>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeStep(index)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <label className="block text-sm font-medium mb-1">Step Name</label>
                              <input
                                type="text"
                                className="w-full p-2 border rounded-md"
                                value={step.name}
                                onChange={(e) => updateStep(index, { name: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Step Type</label>
                              <select
                                className="w-full p-2 border rounded-md"
                                value={step.type}
                                onChange={(e) => updateStep(index, { type: e.target.value as any })}
                              >
                                {stepTypes.map(type => (
                                  <option key={type.value} value={type.value}>
                                    {type.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {step.type === 'agent' && (
                            <div>
                              <label className="block text-sm font-medium mb-1">Agent Type</label>
                              <select
                                className="w-full p-2 border rounded-md"
                                value={step.config.agentType || ''}
                                onChange={(e) => updateStep(index, {
                                  config: { ...step.config, agentType: e.target.value }
                                })}
                              >
                                <option value="">Select agent type</option>
                                {agentTypes.map(type => (
                                  <option key={type} value={type}>
                                    {type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {step.type === 'tool' && (
                            <div>
                              <label className="block text-sm font-medium mb-1">Tool Name</label>
                              <input
                                type="text"
                                className="w-full p-2 border rounded-md"
                                value={step.config.toolName || ''}
                                onChange={(e) => updateStep(index, {
                                  config: { ...step.config, toolName: e.target.value }
                                })}
                                placeholder="Enter tool name"
                              />
                            </div>
                          )}

                          <div>
                            <label className="block text-sm font-medium mb-1">Configuration (JSON)</label>
                            <textarea
                              className="w-full p-2 border rounded-md font-mono text-sm"
                              rows={3}
                              value={JSON.stringify(step.config, null, 2)}
                              onChange={(e) => {
                                try {
                                  const config = JSON.parse(e.target.value)
                                  updateStep(index, { config })
                                } catch {
                                  // Invalid JSON, ignore
                                }
                              }}
                              placeholder='{"key": "value"}'
                            />
                          </div>
                        </CardContent>
                      </Card>
                      
                      {index < steps.length - 1 && (
                        <div className="flex justify-center py-2">
                          <ArrowDown className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1" disabled={steps.length === 0}>
                Create Workflow
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}