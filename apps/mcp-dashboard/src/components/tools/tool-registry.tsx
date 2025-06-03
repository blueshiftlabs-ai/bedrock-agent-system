'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useWebSocket } from '@/lib/websocket-provider'
import { Tool } from '@/types'
import { getStatusColor, formatDuration } from '@/lib/utils'
import { Wrench, RefreshCw, Play, Square, Settings } from 'lucide-react'

export function ToolRegistry() {
  const { connected, subscribe, unsubscribe, emit } = useWebSocket()
  const [tools, setTools] = useState<Tool[]>([])
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const handleToolUpdate = (tool: Tool) => {
      setTools(prev => {
        const index = prev.findIndex(t => t.id === tool.id)
        if (index >= 0) {
          return prev.map((t, i) => i === index ? tool : t)
        }
        return [...prev, tool]
      })
    }

    const handleToolList = (toolList: Tool[]) => {
      setTools(toolList)
      setLoading(false)
    }

    subscribe('tool_update', handleToolUpdate)
    subscribe('tool_list', handleToolList)
    
    // Request initial tool list
    if (connected) {
      emit('get_tools', {})
      setLoading(true)
    }

    return () => {
      unsubscribe('tool_update', handleToolUpdate)
      unsubscribe('tool_list', handleToolList)
    }
  }, [connected, subscribe, unsubscribe, emit])

  const handleToolAction = (toolId: string, action: 'activate' | 'deactivate' | 'test') => {
    emit('tool_action', { toolId, action })
  }

  const refreshTools = () => {
    setLoading(true)
    emit('get_tools', {})
  }

  const toolsByCategory = tools.reduce((acc, tool) => {
    if (!acc[tool.category]) {
      acc[tool.category] = []
    }
    acc[tool.category].push(tool)
    return acc
  }, {} as Record<string, Tool[]>)

  const activeTools = tools.filter(t => t.status === 'active')
  const totalUsage = tools.reduce((sum, t) => sum + t.usageCount, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Tool Registry</h1>
        <Button onClick={refreshTools} disabled={loading || !connected}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tools</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tools.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeTools.length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(toolsByCategory).length}</div>
            <p className="text-xs text-muted-foreground">
              Tool categories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usage</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsage.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Tool executions
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tool Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading tools...</span>
              </div>
            ) : Object.keys(toolsByCategory).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No tools found
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {Object.entries(toolsByCategory).map(([category, categoryTools]) => (
                  <div key={category}>
                    <h4 className="font-medium mb-2 capitalize">{category}</h4>
                    <div className="space-y-1 ml-4">
                      {categoryTools.map((tool) => (
                        <div
                          key={tool.id}
                          className={`p-2 border rounded-md cursor-pointer transition-colors hover:bg-muted/50 ${
                            selectedTool?.id === tool.id ? 'ring-2 ring-primary' : ''
                          }`}
                          onClick={() => setSelectedTool(tool)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{tool.name}</p>
                              <p className="text-xs text-muted-foreground">{tool.description}</p>
                            </div>
                            <span className={`px-2 py-1 rounded-md text-xs font-medium ${getStatusColor(tool.status)}`}>
                              {tool.status}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                            <span>v{tool.version}</span>
                            <span>{tool.usageCount} uses</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedTool && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{selectedTool.name}</CardTitle>
                <div className="flex gap-1">
                  {selectedTool.status === 'active' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToolAction(selectedTool.id, 'deactivate')}
                    >
                      <Square className="h-3 w-3 mr-1" />
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToolAction(selectedTool.id, 'activate')}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Activate
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToolAction(selectedTool.id, 'test')}
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    Test
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">{selectedTool.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Status:</span>
                    <span className={`ml-2 px-2 py-1 rounded-md text-xs ${getStatusColor(selectedTool.status)}`}>
                      {selectedTool.status}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Version:</span>
                    <span className="ml-2 text-muted-foreground">v{selectedTool.version}</span>
                  </div>
                  <div>
                    <span className="font-medium">Category:</span>
                    <span className="ml-2 text-muted-foreground capitalize">{selectedTool.category}</span>
                  </div>
                  <div>
                    <span className="font-medium">Usage Count:</span>
                    <span className="ml-2 text-muted-foreground">{selectedTool.usageCount.toLocaleString()}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium">Server:</span>
                    <span className="ml-2 text-muted-foreground">{selectedTool.serverId}</span>
                  </div>
                  {selectedTool.lastUsed && (
                    <div className="col-span-2">
                      <span className="font-medium">Last Used:</span>
                      <span className="ml-2 text-muted-foreground">
                        {formatDuration(Date.now() - selectedTool.lastUsed.getTime())} ago
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-medium mb-2">Configuration</h4>
                  <div className="text-sm space-y-1">
                    <div>Timeout: {selectedTool.config.timeout}ms</div>
                    <div>Retry Attempts: {selectedTool.config.retryAttempts}</div>
                    {selectedTool.config.rateLimitPerMinute && (
                      <div>Rate Limit: {selectedTool.config.rateLimitPerMinute}/min</div>
                    )}
                    <div>Dependencies: {selectedTool.config.dependencies.length}</div>
                    <div>Required Permissions: {selectedTool.config.requiredPermissions.length}</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Schema</h4>
                  <div className="space-y-2">
                    <div>
                      <h5 className="text-sm font-medium">Inputs</h5>
                      <div className="text-xs bg-gray-50 p-2 rounded font-mono max-h-32 overflow-y-auto">
                        <pre>{JSON.stringify(selectedTool.schema.inputs, null, 2)}</pre>
                      </div>
                    </div>
                    <div>
                      <h5 className="text-sm font-medium">Outputs</h5>
                      <div className="text-xs bg-gray-50 p-2 rounded font-mono max-h-32 overflow-y-auto">
                        <pre>{JSON.stringify(selectedTool.schema.outputs, null, 2)}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}