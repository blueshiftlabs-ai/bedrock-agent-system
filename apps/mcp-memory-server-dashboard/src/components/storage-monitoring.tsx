'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, AlertCircle, Database, Search, Network } from 'lucide-react'

interface StorageHealth {
  overall: boolean
  services: {
    dynamodb: boolean
    opensearch: boolean
    neo4j: boolean
  }
}

const StatusIcon = ({ status }: { status: string }) => {
  const iconProps = { className: "h-4 w-4" }
  
  return status === 'connected' || status === 'ok' ? (
    <CheckCircle {...iconProps} className="h-4 w-4 text-green-500" />
  ) : status === 'error' || status === 'disconnected' ? (
    <XCircle {...iconProps} className="h-4 w-4 text-red-500" />
  ) : (
    <AlertCircle {...iconProps} className="h-4 w-4 text-yellow-500" />
  )
}

const StatusBadge = ({ status }: { status: string }) => {
  const variant = status === 'connected' || status === 'ok' ? 'default' :
                 status === 'error' || status === 'disconnected' ? 'destructive' :
                 'secondary'
  
  return <Badge variant={variant as any}>{status}</Badge>
}

export function StorageMonitoring() {
  const [health, setHealth] = useState<StorageHealth | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch('/api/memory/health')
        
        if (response.ok) {
          const healthData = await response.json()
          setHealth(healthData)
        }
      } catch (error) {
        console.error('Failed to fetch health status:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchHealth()
    const interval = setInterval(fetchHealth, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-2 bg-muted rounded w-1/2"></div>
            </CardHeader>
          </Card>
        ))}
      </div>
    )
  }

  if (!health) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Storage Health Unavailable</CardTitle>
          <CardDescription>Unable to fetch storage health information</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const storageComponents = [
    {
      name: 'DynamoDB Storage',
      icon: Database,
      status: health.services.dynamodb ? 'connected' : 'disconnected',
      endpoint: 'localhost:5100',
      description: 'Metadata and session storage',
      type: 'Local',
      adminUrl: 'http://localhost:5101'
    },
    {
      name: 'OpenSearch',
      icon: Search,
      status: health.services.opensearch ? 'connected' : 'disconnected',
      endpoint: 'localhost:5102',
      description: 'Vector embeddings and semantic search',
      adminUrl: 'http://localhost:5102/_dashboards'
    },
    {
      name: 'Neo4j Graph',
      icon: Network,
      status: health.services.neo4j ? 'connected' : 'disconnected',
      endpoint: 'localhost:7474',
      description: 'Knowledge graph and relationships',
      adminUrl: 'http://localhost:7474/browser'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <StatusIcon status={health.overall ? 'ok' : 'error'} />
                <span>Storage System Health</span>
              </CardTitle>
              <CardDescription>
                Overall system status
              </CardDescription>
              <div className="mt-1">
                <StatusBadge status={health.overall ? 'ok' : 'error'} />
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Last updated</p>
              <p className="text-sm font-medium">
                {new Date().toLocaleTimeString()}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Storage Components */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {storageComponents.map((component) => {
          const IconComponent = component.icon
          
          return (
            <Card key={component.name}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <IconComponent className="h-5 w-5" />
                    <span>{component.name}</span>
                  </div>
                  <StatusIcon status={component.status} />
                </CardTitle>
                <CardDescription>{component.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <StatusBadge status={component.status} />
                </div>
                
                <div>
                  <p className="text-sm font-medium">Endpoint</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {component.endpoint}
                  </p>
                </div>

                {component.type && (
                  <div>
                    <p className="text-sm font-medium">Type</p>
                    <p className="text-sm text-muted-foreground">{component.type}</p>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    onClick={() => window.open(component.adminUrl, '_blank')}
                    className="text-sm text-primary hover:underline flex items-center space-x-1"
                  >
                    <span>Open Admin Interface</span>
                    <span>↗</span>
                  </button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* MCP Server Status */}
      <Card>
        <CardHeader>
          <CardTitle>MCP Server Configuration</CardTitle>
          <CardDescription>Model Context Protocol server status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium">Transport</p>
              <p className="text-sm text-muted-foreground">SSE</p>
            </div>
            <div>
              <p className="text-sm font-medium">Endpoints</p>
              <p className="text-sm text-muted-foreground font-mono">/memory/mcp (HTTP)</p>
              <p className="text-sm text-muted-foreground font-mono">/memory/sse (SSE)</p>
            </div>
            <div>
              <p className="text-sm font-medium">Status</p>
              <StatusBadge status={health.overall ? 'active' : 'inactive'} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Storage Performance Metrics (Future Enhancement) */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
          <CardDescription>Storage layer performance indicators</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Performance metrics will be displayed here</p>
            <p className="text-sm">Real-time latency, throughput, and error rates</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}