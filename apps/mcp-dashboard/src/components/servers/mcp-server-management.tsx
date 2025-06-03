'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useServerStore } from '@/store/server-store'
import { MCPServer } from '@/types'
import { getStatusColor, formatDuration } from '@/lib/utils'
import { Server, Plus, Settings, Trash2, Power, PowerOff } from 'lucide-react'
import { AddServerDialog } from './add-server-dialog'
import { ServerConfigDialog } from './server-config-dialog'

export function MCPServerManagement() {
  const { servers, currentServer, setCurrentServer, removeServer } = useServerStore()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [configureServer, setConfigureServer] = useState<MCPServer | null>(null)

  const handleSelectServer = (server: MCPServer) => {
    setCurrentServer(server)
  }

  const handleRemoveServer = (serverId: string) => {
    if (confirm('Are you sure you want to remove this server?')) {
      removeServer(serverId)
    }
  }

  const handleServerAction = (server: MCPServer, action: 'connect' | 'disconnect') => {
    // TODO: Implement server connection/disconnection logic
    console.log(`${action} server:`, server.name)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">MCP Server Management</h1>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Server
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {servers.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="text-center py-8">
              <Server className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No MCP servers configured</p>
              <Button className="mt-4" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Server
              </Button>
            </CardContent>
          </Card>
        ) : (
          servers.map((server) => (
            <Card
              key={server.id}
              className={`cursor-pointer transition-colors ${
                currentServer?.id === server.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => handleSelectServer(server)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{server.name}</CardTitle>
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${getStatusColor(server.status)}`}>
                    {server.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{server.url}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {server.version && (
                    <div className="flex justify-between text-sm">
                      <span>Version:</span>
                      <span className="text-muted-foreground">{server.version}</span>
                    </div>
                  )}
                  {server.lastSeen && (
                    <div className="flex justify-between text-sm">
                      <span>Last Seen:</span>
                      <span className="text-muted-foreground">
                        {formatDuration(Date.now() - server.lastSeen.getTime())} ago
                      </span>
                    </div>
                  )}
                  {server.metrics && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Uptime:</span>
                        <span className="text-muted-foreground">
                          {formatDuration(server.metrics.uptime)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Memory:</span>
                        <span className="text-muted-foreground">
                          {server.metrics.memoryUsage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>CPU:</span>
                        <span className="text-muted-foreground">
                          {server.metrics.cpuUsage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  {server.status === 'connected' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleServerAction(server, 'disconnect')
                      }}
                    >
                      <PowerOff className="h-3 w-3 mr-1" />
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleServerAction(server, 'connect')
                      }}
                    >
                      <Power className="h-3 w-3 mr-1" />
                      Connect
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfigureServer(server)
                    }}
                  >
                    <Settings className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveServer(server.id)
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {currentServer && (
        <Card>
          <CardHeader>
            <CardTitle>Current Server: {currentServer.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="font-medium mb-2">Connection Details</h4>
                <div className="space-y-1 text-sm">
                  <div>URL: {currentServer.url}</div>
                  <div>Protocol: {currentServer.config.protocol}</div>
                  <div>Timeout: {currentServer.config.timeout}ms</div>
                  <div>Health Check Interval: {currentServer.config.healthCheckInterval}ms</div>
                </div>
              </div>
              {currentServer.metrics && (
                <div>
                  <h4 className="font-medium mb-2">Performance Metrics</h4>
                  <div className="space-y-1 text-sm">
                    <div>Requests/sec: {currentServer.metrics.requestsPerSecond}</div>
                    <div>Error Rate: {currentServer.metrics.errorRate.toFixed(2)}%</div>
                    <div>Avg Response Time: {currentServer.metrics.responseTime}ms</div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <AddServerDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
      />

      {configureServer && (
        <ServerConfigDialog
          server={configureServer}
          open={!!configureServer}
          onOpenChange={(open) => !open && setConfigureServer(null)}
        />
      )}
    </div>
  )
}