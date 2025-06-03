'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useWebSocket } from '@/lib/websocket-provider'
import { Process } from '@/types'
import { formatBytes, formatDuration, getStatusColor } from '@/lib/utils'
import { Activity, RefreshCw, Play, Square, RotateCcw } from 'lucide-react'

export function ProcessMonitoring() {
  const { connected, subscribe, unsubscribe, emit } = useWebSocket()
  const [processes, setProcesses] = useState<Process[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const handleProcessUpdate = (processData: Process) => {
      setProcesses(prev => {
        const index = prev.findIndex(p => p.id === processData.id)
        if (index >= 0) {
          return prev.map((p, i) => i === index ? processData : p)
        }
        return [...prev, processData]
      })
    }

    const handleProcessList = (processList: Process[]) => {
      setProcesses(processList)
      setLoading(false)
    }

    subscribe('process_update', handleProcessUpdate)
    subscribe('process_list', handleProcessList)
    
    // Request initial process list
    if (connected) {
      emit('get_processes', {})
      setLoading(true)
    }

    return () => {
      unsubscribe('process_update', handleProcessUpdate)
      unsubscribe('process_list', handleProcessList)
    }
  }, [connected, subscribe, unsubscribe, emit])

  const handleProcessAction = (processId: string, action: 'start' | 'stop' | 'restart') => {
    emit('process_action', { processId, action })
  }

  const refreshProcesses = () => {
    setLoading(true)
    emit('get_processes', {})
  }

  const runningProcesses = processes.filter(p => p.status === 'running')
  const totalMemory = processes.reduce((sum, p) => sum + p.memoryUsage, 0)
  const averageCpu = processes.length > 0 
    ? processes.reduce((sum, p) => sum + p.cpuUsage, 0) / processes.length 
    : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Process Monitoring</h1>
        <Button onClick={refreshProcesses} disabled={loading || !connected}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Processes</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{processes.length}</div>
            <p className="text-xs text-muted-foreground">
              {runningProcesses.length} running
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Memory</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(totalMemory)}</div>
            <p className="text-xs text-muted-foreground">
              Across all processes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average CPU</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageCpu.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              CPU usage
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Process List</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading processes...</span>
            </div>
          ) : processes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No processes found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">PID</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Memory</th>
                    <th className="text-left p-2">CPU</th>
                    <th className="text-left p-2">Uptime</th>
                    <th className="text-left p-2">Restarts</th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {processes.map((process) => (
                    <tr key={process.id} className="border-b hover:bg-muted/50">
                      <td className="p-2">
                        <div>
                          <div className="font-medium">{process.name}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-xs">
                            {process.commandLine}
                          </div>
                        </div>
                      </td>
                      <td className="p-2 font-mono text-sm">{process.pid}</td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${getStatusColor(process.status)}`}>
                          {process.status}
                        </span>
                      </td>
                      <td className="p-2">{formatBytes(process.memoryUsage)}</td>
                      <td className="p-2">{process.cpuUsage.toFixed(1)}%</td>
                      <td className="p-2">
                        {formatDuration(Date.now() - process.startTime.getTime())}
                      </td>
                      <td className="p-2">{process.restartCount}</td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          {process.status === 'stopped' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleProcessAction(process.id, 'start')}
                            >
                              <Play className="h-3 w-3" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleProcessAction(process.id, 'stop')}
                            >
                              <Square className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleProcessAction(process.id, 'restart')}
                          >
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}