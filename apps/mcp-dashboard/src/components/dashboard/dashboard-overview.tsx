'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useWebSocket } from '@/lib/websocket-provider'
import { SystemStatus, Alert } from '@/types'
import { formatDuration, getStatusColor } from '@/lib/utils'
import { Activity, Server, Workflow, Wrench, AlertTriangle, CheckCircle, Brain, Database } from 'lucide-react'

export function DashboardOverview() {
  const { connected, subscribe, unsubscribe } = useWebSocket()
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    overall: 'healthy',
    servers: 0,
    activeProcesses: 0,
    runningWorkflows: 0,
    activeTools: 0,
    lastUpdate: new Date(),
    alerts: []
  })

  useEffect(() => {
    const handleSystemUpdate = (status: SystemStatus) => {
      setSystemStatus(status)
    }

    subscribe('system_status', handleSystemUpdate)
    
    return () => {
      unsubscribe('system_status', handleSystemUpdate)
    }
  }, [subscribe, unsubscribe])

  const statusCards = [
    {
      title: 'System Status',
      value: systemStatus.overall,
      icon: <Activity className="h-4 w-4" />,
      color: getStatusColor(systemStatus.overall)
    },
    {
      title: 'MCP Servers',
      value: systemStatus.servers,
      icon: <Server className="h-4 w-4" />,
      color: 'text-blue-600 bg-blue-100'
    },
    {
      title: 'Active Processes',
      value: systemStatus.activeProcesses,
      icon: <Activity className="h-4 w-4" />,
      color: 'text-green-600 bg-green-100'
    },
    {
      title: 'Running Workflows',
      value: systemStatus.runningWorkflows,
      icon: <Workflow className="h-4 w-4" />,
      color: 'text-purple-600 bg-purple-100'
    },
    {
      title: 'Active Tools',
      value: systemStatus.activeTools,
      icon: <Wrench className="h-4 w-4" />,
      color: 'text-orange-600 bg-orange-100'
    },
    {
      title: 'Stored Memories',
      value: systemStatus.memoryServerStatus?.memoriesStored || 0,
      icon: <Brain className="h-4 w-4" />,
      color: `${systemStatus.memoryServerStatus?.connected ? 'text-cyan-600 bg-cyan-100' : 'text-gray-600 bg-gray-100'}`
    }
  ]

  const criticalAlerts = systemStatus.alerts.filter(alert => 
    alert.severity === 'critical' || alert.severity === 'error'
  ).slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          {connected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statusCards.map((card, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <div className={`p-2 rounded-md ${card.color}`}>
                {card.icon}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Recent Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {criticalAlerts.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-500" />
                No critical alerts
              </div>
            ) : (
              <div className="space-y-2">
                {criticalAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-md border-l-4 ${
                      alert.severity === 'critical'
                        ? 'border-red-500 bg-red-50'
                        : 'border-yellow-500 bg-yellow-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{alert.title}</p>
                      <span className="text-xs text-muted-foreground">
                        {formatDuration(Date.now() - alert.timestamp.getTime())} ago
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Overall Status</span>
                <span className={`px-2 py-1 rounded-md text-xs font-medium ${getStatusColor(systemStatus.overall)}`}>
                  {systemStatus.overall}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Last Updated</span>
                <span className="text-sm text-muted-foreground">
                  {systemStatus.lastUpdate.toLocaleTimeString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">WebSocket Connection</span>
                <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                  connected ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'
                }`}>
                  {connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              {systemStatus.memoryServerStatus && (
                <>
                  <div className="border-t pt-3 mt-3">
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Brain className="h-4 w-4" />
                      Memory Server
                    </h4>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Connection</span>
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                      systemStatus.memoryServerStatus.connected ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'
                    }`}>
                      {systemStatus.memoryServerStatus.connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Active Agents</span>
                    <span className="text-sm text-muted-foreground">
                      {systemStatus.memoryServerStatus.activeAgents}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Storage Health</span>
                    <div className="flex gap-1">
                      <div className={`w-2 h-2 rounded-full ${systemStatus.memoryServerStatus.indexHealth.opensearch ? 'bg-green-500' : 'bg-red-500'}`} 
                           title="OpenSearch" />
                      <div className={`w-2 h-2 rounded-full ${systemStatus.memoryServerStatus.indexHealth.dynamodb ? 'bg-green-500' : 'bg-red-500'}`} 
                           title="DynamoDB" />
                      <div className={`w-2 h-2 rounded-full ${systemStatus.memoryServerStatus.indexHealth.neptune ? 'bg-green-500' : 'bg-red-500'}`} 
                           title="Neptune" />
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}