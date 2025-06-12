'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Network, Plus, RefreshCw, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'

interface GraphNode {
  id: string
  label: string
  type: 'memory' | 'agent' | 'session'
  properties?: Record<string, any>
  x?: number
  y?: number
}

interface GraphEdge {
  id: string
  source: string
  target: string
  type: string
  properties?: Record<string, any>
}

interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

const relationshipTypes = [
  'RELATES_TO',
  'SIMILAR_TO', 
  'REFERENCES',
  'FOLLOWS',
  'IMPLEMENTS',
  'CONTRADICTS'
]

const nodeColors = {
  memory: '#3b82f6',
  agent: '#10b981',
  session: '#f59e0b'
}

export function GraphVisualization() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] })
  const [loading, setLoading] = useState(false)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null)
  const [showAddConnection, setShowAddConnection] = useState(false)
  const [newConnection, setNewConnection] = useState({
    fromMemoryId: '',
    toMemoryId: '',
    relationshipType: 'RELATES_TO',
    bidirectional: false
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [availableMemories, setAvailableMemories] = useState<Array<{id: string, content: string}>>([])

  const loadConnections = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/memory/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: 'retrieve-connections',
            arguments: {
              limit: 100
            }
          }
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data?.result?.content?.[0]?.text) {
          try {
            const result = JSON.parse(data.result.content[0].text)
            processGraphData(result?.connections || [])
          } catch (parseError) {
            console.error('Failed to parse connections data:', parseError)
            processGraphData([])
          }
        } else {
          processGraphData([])
        }
      } else {
        console.error('Failed to load connections:', response.status)
        processGraphData([])
      }
    } catch (error) {
      console.error('Failed to load connections:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableMemories = async () => {
    try {
      const response = await fetch('/api/memory/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: 'retrieve-memories',
            arguments: {
              query: '',
              limit: 50
            }
          }
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.result?.content?.[0]?.text) {
          const result = JSON.parse(data.result.content[0].text)
          setAvailableMemories(result.memories?.map((m: any) => ({
            id: m.id || m.memory_id,
            content: (m.content || m.text || 'No content').slice(0, 50) + ((m.content || m.text || '').length > 50 ? '...' : '')
          })) || [])
        }
      }
    } catch (error) {
      console.error('Failed to load memories:', error)
    }
  }

  const processGraphData = (connections: any[]) => {
    const nodes = new Map<string, GraphNode>()
    const edges: GraphEdge[] = []

    connections.forEach((connection) => {
      // Add source node
      if (!nodes.has(connection.from_id)) {
        nodes.set(connection.from_id, {
          id: connection.from_id,
          label: connection.from_label || connection.from_id.slice(0, 8),
          type: connection.from_type || 'memory',
          properties: connection.from_properties || {}
        })
      }

      // Add target node
      if (!nodes.has(connection.to_id)) {
        nodes.set(connection.to_id, {
          id: connection.to_id,
          label: connection.to_label || connection.to_id.slice(0, 8),
          type: connection.to_type || 'memory',
          properties: connection.to_properties || {}
        })
      }

      // Add edge
      edges.push({
        id: `${connection.from_id}-${connection.to_id}-${connection.relationship_type}`,
        source: connection.from_id,
        target: connection.to_id,
        type: connection.relationship_type,
        properties: connection.properties || {}
      })
    })

    // Position nodes using a simple force layout
    const nodeArray = Array.from(nodes.values())
    const centerX = 400
    const centerY = 300
    const radius = Math.min(200, Math.max(100, nodeArray.length * 10))

    nodeArray.forEach((node, index) => {
      const angle = (index / nodeArray.length) * 2 * Math.PI
      node.x = centerX + Math.cos(angle) * radius
      node.y = centerY + Math.sin(angle) * radius
    })

    setGraphData({ nodes: nodeArray, edges })
  }

  const addConnection = async () => {
    try {
      const response = await fetch('/api/memory/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: 'add-connection',
            arguments: {
              from_memory_id: newConnection.fromMemoryId,
              to_memory_id: newConnection.toMemoryId,
              relationship_type: newConnection.relationshipType,
              bidirectional: newConnection.bidirectional
            }
          }
        })
      })

      if (response.ok) {
        setShowAddConnection(false)
        setNewConnection({
          fromMemoryId: '',
          toMemoryId: '',
          relationshipType: 'RELATES_TO',
          bidirectional: false
        })
        loadConnections() // Refresh the graph
      }
    } catch (error) {
      console.error('Failed to add connection:', error)
    }
  }

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node)
    setSelectedEdge(null)
  }

  const handleEdgeClick = (edge: GraphEdge) => {
    setSelectedEdge(edge)
    setSelectedNode(null)
  }

  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.2, 3))
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.3))
  const handleReset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  useEffect(() => {
    loadConnections()
    loadAvailableMemories()
  }, [])

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Knowledge Graph
          </CardTitle>
          <CardDescription>
            Visualize memory connections and relationships in the knowledge graph
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-64">
              <Input
                placeholder="Search nodes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset}>
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={loadConnections} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button onClick={() => setShowAddConnection(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Connection
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graph Visualization */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Graph View ({graphData.nodes.length} nodes, {graphData.edges.length} edges)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative bg-slate-50 dark:bg-slate-900 rounded-lg overflow-hidden" style={{ height: '500px' }}>
              <svg
                ref={svgRef}
                width="100%"
                height="100%"
                viewBox={`${-pan.x} ${-pan.y} ${800 / zoom} ${500 / zoom}`}
                className="cursor-move"
              >
                {/* Edges */}
                <g>
                  {graphData.edges
                    .filter(edge => 
                      !searchQuery || 
                      edge.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      graphData.nodes.find(n => n.id === edge.source)?.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      graphData.nodes.find(n => n.id === edge.target)?.label.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((edge) => {
                      const sourceNode = graphData.nodes.find(n => n.id === edge.source)
                      const targetNode = graphData.nodes.find(n => n.id === edge.target)
                      
                      if (!sourceNode || !targetNode) return null

                      return (
                        <g key={edge.id}>
                          <line
                            x1={sourceNode.x}
                            y1={sourceNode.y}
                            x2={targetNode.x}
                            y2={targetNode.y}
                            stroke={selectedEdge?.id === edge.id ? '#ef4444' : '#64748b'}
                            strokeWidth={selectedEdge?.id === edge.id ? 3 : 2}
                            className="cursor-pointer"
                            onClick={() => handleEdgeClick(edge)}
                          />
                          <text
                            x={(sourceNode.x! + targetNode.x!) / 2}
                            y={(sourceNode.y! + targetNode.y!) / 2}
                            textAnchor="middle"
                            className="text-xs fill-gray-600 dark:fill-gray-400 pointer-events-none"
                          >
                            {edge.type}
                          </text>
                        </g>
                      )
                    })}
                </g>

                {/* Nodes */}
                <g>
                  {graphData.nodes
                    .filter(node => 
                      !searchQuery || 
                      node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      node.type.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((node) => (
                      <g key={node.id}>
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={selectedNode?.id === node.id ? 12 : 8}
                          fill={nodeColors[node.type] || '#6b7280'}
                          stroke={selectedNode?.id === node.id ? '#1f2937' : 'white'}
                          strokeWidth={selectedNode?.id === node.id ? 3 : 2}
                          className="cursor-pointer"
                          onClick={() => handleNodeClick(node)}
                        />
                        <text
                          x={node.x}
                          y={node.y! + 20}
                          textAnchor="middle"
                          className="text-xs fill-gray-700 dark:fill-gray-300 pointer-events-none"
                        >
                          {node.label}
                        </text>
                      </g>
                    ))}
                </g>
              </svg>

              {graphData.nodes.length === 0 && !loading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Network className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-muted-foreground">No connections found yet.</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Create connections between memories using the "Add Connection" button above.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Entity List */}
        {graphData.nodes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Entities ({graphData.nodes.length})</CardTitle>
              <CardDescription>Click on any entity to see details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {graphData.nodes.map(node => (
                  <div
                    key={node.id}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedNode?.id === node.id 
                        ? 'bg-primary/10 border border-primary' 
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => {
                      setSelectedNode(node)
                      setSelectedEdge(null)
                    }}
                  >
                    <Badge 
                      style={{ backgroundColor: nodeColors[node.type] }}
                      className="text-white"
                    >
                      {node.type}
                    </Badge>
                    <span className="text-sm truncate flex-1">{node.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Selection Details */}
        <Card>
          <CardHeader>
            <CardTitle>Selection Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedNode && (
              <div>
                <h4 className="font-medium">Node: {selectedNode.label}</h4>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center gap-2">
                    <Badge style={{ backgroundColor: nodeColors[selectedNode.type] }}>
                      {selectedNode.type}
                    </Badge>
                  </div>
                  <div>
                    <Label>ID</Label>
                    <p className="text-sm font-mono">{selectedNode.id}</p>
                  </div>
                  {selectedNode.properties && Object.keys(selectedNode.properties).length > 0 && (
                    <div>
                      <Label>Properties</Label>
                      <pre className="text-xs bg-muted p-2 rounded-md mt-1 overflow-auto">
                        {JSON.stringify(selectedNode.properties, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedEdge && (
              <div>
                <h4 className="font-medium">Relationship: {selectedEdge.type}</h4>
                <div className="space-y-2 mt-2">
                  <div>
                    <Label>From</Label>
                    <p className="text-sm">{graphData.nodes.find(n => n.id === selectedEdge.source)?.label}</p>
                  </div>
                  <div>
                    <Label>To</Label>
                    <p className="text-sm">{graphData.nodes.find(n => n.id === selectedEdge.target)?.label}</p>
                  </div>
                  {selectedEdge.properties && Object.keys(selectedEdge.properties).length > 0 && (
                    <div>
                      <Label>Properties</Label>
                      <pre className="text-xs bg-muted p-2 rounded-md mt-1 overflow-auto">
                        {JSON.stringify(selectedEdge.properties, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!selectedNode && !selectedEdge && (
              <div className="text-center py-8 text-muted-foreground">
                Click on a node or edge to view details
              </div>
            )}

            {/* Legend */}
            <div className="border-t pt-4">
              <Label>Node Types</Label>
              <div className="space-y-2 mt-2">
                {Object.entries(nodeColors).map(([type, color]) => (
                  <div key={type} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm capitalize">{type}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Connection Dialog */}
      {showAddConnection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Add Memory Connection</CardTitle>
              <CardDescription>
                Create a relationship between two memories
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="from-memory">From Memory</Label>
                <Select value={newConnection.fromMemoryId} onValueChange={(value) => 
                  setNewConnection({...newConnection, fromMemoryId: value})
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source memory" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMemories.map((memory) => (
                      <SelectItem key={memory.id} value={memory.id}>
                        {memory.content}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="to-memory">To Memory</Label>
                <Select value={newConnection.toMemoryId} onValueChange={(value) => 
                  setNewConnection({...newConnection, toMemoryId: value})
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="Select target memory" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMemories.map((memory) => (
                      <SelectItem key={memory.id} value={memory.id}>
                        {memory.content}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="relationship-type">Relationship Type</Label>
                <Select value={newConnection.relationshipType} onValueChange={(value) => 
                  setNewConnection({...newConnection, relationshipType: value})
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {relationshipTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="bidirectional"
                  checked={newConnection.bidirectional}
                  onChange={(e) => setNewConnection({...newConnection, bidirectional: e.target.checked})}
                />
                <Label htmlFor="bidirectional">Bidirectional relationship</Label>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={addConnection} 
                  disabled={!newConnection.fromMemoryId || !newConnection.toMemoryId}
                >
                  Add Connection
                </Button>
                <Button variant="outline" onClick={() => setShowAddConnection(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}