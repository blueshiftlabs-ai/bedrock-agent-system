'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Network, Plus, RefreshCw, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import startCase from 'lodash.startcase'
import { MEMORY_TYPE_COLORS } from '@/lib/memory-utils'

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

// Color constants matching overview page charts for consistency
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

// Memory type colors (using shared constants for consistency)
const memoryTypeColors = MEMORY_TYPE_COLORS

// Entity type colors (for graph nodes)
const nodeColors = {
  memory: '#6b7280',     // Gray - will be overridden by memory type
  agent: CHART_COLORS[5],      // Cyan
  session: '#ec4899'     // Pink
}

// Relationship type colors (for edges)
const relationshipColors = {
  RELATES_TO: '#6b7280',         // Gray
  SIMILAR_TO: CHART_COLORS[0],   // Blue  
  REFERENCES: CHART_COLORS[1],   // Green
  FOLLOWS: CHART_COLORS[2],      // Amber
  IMPLEMENTS: CHART_COLORS[4],   // Purple
  CONTRADICTS: CHART_COLORS[3]   // Red
}

export function GraphVisualization() {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
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
  const [availableMemories, setAvailableMemories] = useState<Array<{id: string, content: string, type?: string}>>([])
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [draggedNode, setDraggedNode] = useState<string | null>(null)
  
  // Enhanced filter states
  const [connectionLimit, setConnectionLimit] = useState(20)
  const [selectedRelationshipTypes, setSelectedRelationshipTypes] = useState<string[]>([])
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])
  const [selectedMemoryTypes, setSelectedMemoryTypes] = useState<string[]>([])
  const [layoutType, setLayoutType] = useState<'circular' | 'force' | 'hierarchical'>('force')
  const [showLabels, setShowLabels] = useState(true)
  const [minConnections, setMinConnections] = useState(1)

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
              limit: connectionLimit
            }
          }
        })
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Connections API Response:', data) // Debug logging
        if (data?.result?.content?.[0]?.text) {
          try {
            const result = JSON.parse(data.result.content[0].text)
            console.log('Parsed connections result:', result) // Debug logging
            processGraphData(result?.connections || [])
          } catch (parseError) {
            console.error('Failed to parse connections data:', parseError, data.result.content[0].text)
            processGraphData([])
          }
        } else {
          console.warn('No connections content in response:', data)
          processGraphData([])
        }
      } else {
        console.error('Failed to load connections:', response.status, response.statusText)
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
              // Removed project filter to show all available memories
            }
          }
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.result?.content?.[0]?.text) {
          const result = JSON.parse(data.result.content[0].text)
          // Fix data structure parsing for nested memory format
          setAvailableMemories(result.memories?.map((m: any) => {
            // Handle both old flat format and new nested format
            const memoryId = m.memory?.metadata?.memory_id || m.id || m.memory_id
            const content = m.memory?.content || m.content || m.text || 'No content'
            const memoryType = m.memory?.type || m.type || 'semantic'
            return {
              id: memoryId,
              content: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
              type: memoryType
            }
          }) || [])
        }
      } else {
        console.error('Failed to load memories:', response.status, response.statusText)
        setAvailableMemories([])
      }
    } catch (error) {
      console.error('Failed to load memories:', error)
      setAvailableMemories([])
    }
  }

  // Helper function to create meaningful node labels
  const createNodeLabel = (connection: any, isFrom: boolean) => {
    const prefix = isFrom ? 'from_' : 'to_'
    const memoryType = connection[`${prefix}properties`]?.memory_type || 'semantic'
    const agentId = connection[`${prefix}agent_id`] || ''
    const memoryId = connection[`${prefix}id`]
    const content = connection[`${prefix}label`] || connection[`${prefix}content`] || ''
    
    // Try to extract meaningful content from the label/content
    if (content && content.length > 20) {
      // Get first few meaningful words from content
      const words = content.split(/\s+/).filter(w => w.length > 2).slice(0, 3).join(' ')
      if (words.length > 15) {
        return words.slice(0, 15) + '...'
      }
      return words || `${startCase(memoryType)} Memory`
    }
    
    // If no content, create a meaningful label
    const formattedType = startCase(memoryType)
    
    // If we have an agent ID, use it smartly
    if (agentId && agentId !== 'unknown') {
      const agentName = agentId.includes('claude') ? 'Claude' : 
                        agentId.split('-')[0] || agentId.slice(0, 8)
      return `${formattedType} (${startCase(agentName)})`
    }
    
    // Last resort: use memory ID suffix
    const shortId = memoryId.slice(-6)
    return `${formattedType} #${shortId}`
  }

  const processGraphData = (connections: any[]) => {
    const nodes = new Map<string, GraphNode>()
    const edges: GraphEdge[] = []

    connections.forEach((connection) => {
      // Add source node with enhanced properties and meaningful label
      if (!nodes.has(connection.from_id)) {
        const fromMemory = availableMemories.find(m => m.id === connection.from_id)
        const memoryType = fromMemory?.type || connection.from_properties?.memory_type || 'semantic'
        
        nodes.set(connection.from_id, {
          id: connection.from_id,
          label: createNodeLabel(connection, true),
          type: connection.from_type || 'memory',
          properties: {
            ...connection.from_properties,
            memory_type: memoryType,
            full_content: connection.from_label || 'No content', // Store full content for tooltips
            agent_id: connection.from_agent_id || 'unknown',
            created_at: connection.from_created_at
          }
        })
      }

      // Add target node with enhanced properties and meaningful label
      if (!nodes.has(connection.to_id)) {
        const toMemory = availableMemories.find(m => m.id === connection.to_id)
        const memoryType = toMemory?.type || connection.to_properties?.memory_type || 'semantic'
        
        nodes.set(connection.to_id, {
          id: connection.to_id,
          label: createNodeLabel(connection, false),
          type: connection.to_type || 'memory',
          properties: {
            ...connection.to_properties,
            memory_type: memoryType,
            full_content: connection.to_label || 'No content', // Store full content for tooltips
            agent_id: connection.to_agent_id || 'unknown',
            created_at: connection.to_created_at
          }
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

    // Apply layout based on selected type
    const nodeArray = Array.from(nodes.values())
    
    if (layoutType === 'circular') {
      // Circular layout
      const centerX = 400
      const centerY = 300
      const radius = Math.min(200, Math.max(100, nodeArray.length * 8))
      
      nodeArray.forEach((node, index) => {
        const angle = (index / nodeArray.length) * 2 * Math.PI
        node.x = centerX + Math.cos(angle) * radius
        node.y = centerY + Math.sin(angle) * radius
      })
    } else if (layoutType === 'hierarchical') {
      // Hierarchical layout - group by agent_id
      const agentGroups = new Map<string, GraphNode[]>()
      nodeArray.forEach(node => {
        const agentId = node.properties?.agent_id || 'unknown'
        if (!agentGroups.has(agentId)) {
          agentGroups.set(agentId, [])
        }
        agentGroups.get(agentId)!.push(node)
      })
      
      let yOffset = 50
      agentGroups.forEach((groupNodes, agentId) => {
        groupNodes.forEach((node, index) => {
          node.x = 100 + (index * 150)
          node.y = yOffset
        })
        yOffset += 120
      })
    } else {
      // Force-directed layout (simplified)
      const centerX = 400
      const centerY = 300
      
      // Start with random positions
      nodeArray.forEach((node, index) => {
        const angle = (index / nodeArray.length) * 2 * Math.PI
        const distance = 50 + Math.random() * 300
        node.x = centerX + Math.cos(angle) * distance
        node.y = centerY + Math.sin(angle) * distance
      })
      
      // Simple force simulation (3 iterations)
      for (let iter = 0; iter < 3; iter++) {
        // Repulsion between nodes
        for (let i = 0; i < nodeArray.length; i++) {
          for (let j = i + 1; j < nodeArray.length; j++) {
            const node1 = nodeArray[i]
            const node2 = nodeArray[j]
            const dx = node2.x! - node1.x!
            const dy = node2.y! - node1.y!
            const distance = Math.sqrt(dx * dx + dy * dy)
            
            if (distance < 100 && distance > 0) {
              const force = (100 - distance) / distance * 0.1
              node1.x! -= dx * force
              node1.y! -= dy * force
              node2.x! += dx * force
              node2.y! += dy * force
            }
          }
        }
        
        // Attraction along edges
        edges.forEach(edge => {
          const source = nodeArray.find(n => n.id === edge.source)
          const target = nodeArray.find(n => n.id === edge.target)
          if (source && target) {
            const dx = target.x! - source.x!
            const dy = target.y! - source.y!
            const distance = Math.sqrt(dx * dx + dy * dy)
            
            if (distance > 150) {
              const force = (distance - 150) / distance * 0.05
              source.x! += dx * force
              source.y! += dy * force
              target.x! -= dx * force
              target.y! -= dy * force
            }
          }
        })
      }
    }

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
        const data = await response.json()
        console.log('Add connection response:', data) // Debug logging
        setShowAddConnection(false)
        setNewConnection({
          fromMemoryId: '',
          toMemoryId: '',
          relationshipType: 'RELATES_TO',
          bidirectional: false
        })
        // Refresh available memories and connections
        loadAvailableMemories()
        loadConnections()
      } else {
        console.error('Failed to add connection:', response.status, response.statusText)
        alert(`Failed to add connection: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to add connection:', error)
      alert(`Error adding connection: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Center graph on a specific node
  const centerOnNode = (node: GraphNode) => {
    if (node.x !== undefined && node.y !== undefined) {
      const svgRect = svgRef.current?.getBoundingClientRect()
      if (svgRect) {
        const centerX = svgRect.width / 2
        const centerY = svgRect.height / 2
        
        setPan({
          x: centerX - node.x * zoom,
          y: centerY - node.y * zoom
        })
      }
    }
  }

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node)
    setSelectedEdge(null)
    // DON'T center on single click - user specifically said single clicks shouldn't reposition
    // centerOnNode(node) 
  }

  const handleEntityClick = (nodeId: string) => {
    const node = graphData.nodes.find(n => n.id === nodeId)
    if (node) {
      setSelectedNode(node)
      setSelectedEdge(null)
      centerOnNode(node)
      
      // Scroll entity into view
      const entityElement = document.getElementById(`entity-${nodeId}`)
      if (entityElement) {
        entityElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }

  const handleEdgeClick = (edge: GraphEdge) => {
    setSelectedEdge(edge)
    setSelectedNode(null)
  }

  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.2, 3))
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.1))
  // Auto-center chart based on node positions
  const autoCenterChart = () => {
    if (graphData.nodes.length === 0) return
    
    // Calculate bounds of all nodes
    const positions = graphData.nodes.filter(n => n.x !== undefined && n.y !== undefined)
    if (positions.length === 0) return
    
    const xs = positions.map(n => n.x!)
    const ys = positions.map(n => n.y!)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    
    // Calculate center point
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    
    // Center the view on the calculated center
    const svgRect = svgRef.current?.getBoundingClientRect()
    if (svgRect) {
      const viewCenterX = svgRect.width / 2
      const viewCenterY = svgRect.height / 2
      
      setPan({
        x: viewCenterX - centerX * zoom,
        y: viewCenterY - centerY * zoom
      })
    }
  }

  const handleReset = () => {
    setZoom(1)
    setSelectedNode(null)
    setSelectedEdge(null)
    // Auto-center after resetting zoom
    setTimeout(() => autoCenterChart(), 50)
  }

  // Double-click to center on viewport
  const handleDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (rect) {
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      const clickX = e.clientX - rect.left
      const clickY = e.clientY - rect.top
      
      setPan({
        x: centerX - (clickX - pan.x) / zoom * zoom,
        y: centerY - (clickY - pan.y) / zoom * zoom
      })
    }
  }
  // Handle mouse events for panning and dragging
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target === e.currentTarget || (e.target as SVGElement).tagName === 'svg') {
      setIsDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging && !draggedNode) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    } else if (draggedNode) {
      const rect = svgRef.current?.getBoundingClientRect()
      if (rect) {
        const x = (e.clientX - rect.left - pan.x) / zoom
        const y = (e.clientY - rect.top - pan.y) / zoom
        
        setGraphData(prev => ({
          ...prev,
          nodes: prev.nodes.map(node => 
            node.id === draggedNode 
              ? { ...node, x, y }
              : node
          )
        }))
      }
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setDraggedNode(null)
  }
  
  // Auto-reload when filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      loadConnections()
    }, 500) // Debounce filter changes
    return () => clearTimeout(timer)
  }, [connectionLimit, searchQuery, selectedMemoryTypes, layoutType])

  // Auto-center chart when layout type changes
  useEffect(() => {
    if (graphData.nodes.length > 0) {
      const timer = setTimeout(() => {
        autoCenterChart()
      }, 100) // Small delay to ensure layout calculations are complete
      return () => clearTimeout(timer)
    }
  }, [layoutType, graphData.nodes.length]) // Trigger when layout type or node count changes

  // Handle wheel zoom with proper event prevention
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      
      const rect = container.getBoundingClientRect()
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.max(0.1, Math.min(3, zoom * delta))
      setZoom(newZoom)
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [zoom])

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
          <div className="space-y-4">
            {/* Search and primary controls */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-64">
                <Input
                  placeholder="Search nodes and relationships..."
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
            
            {/* Enhanced filters and controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/20 rounded-lg">
              {/* Connection Limit */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Max Connections</Label>
                <Select value={connectionLimit.toString()} onValueChange={(value) => setConnectionLimit(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Layout Type */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Layout</Label>
                <Select value={layoutType} onValueChange={(value: 'circular' | 'force' | 'hierarchical') => setLayoutType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="force">{startCase('force directed')}</SelectItem>
                    <SelectItem value="circular">{startCase('circular')}</SelectItem>
                    <SelectItem value="hierarchical">{startCase('hierarchical')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Display Options */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Display</Label>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="show-labels"
                    checked={showLabels}
                    onChange={(e) => setShowLabels(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="show-labels" className="text-sm">Show Labels</Label>
                </div>
              </div>
              
              {/* Memory Type Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Memory Type Filter</Label>
                <Select 
                  value={selectedMemoryTypes.length === 0 ? 'all' : selectedMemoryTypes.join(',')}
                  onValueChange={(value) => {
                    if (value === 'all') {
                      setSelectedMemoryTypes([])
                    } else {
                      setSelectedMemoryTypes(value.split(','))
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{startCase('all types')}</SelectItem>
                    {Object.keys(memoryTypeColors).map(type => (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: memoryTypeColors[type as keyof typeof memoryTypeColors] }}
                          />
                          <span>{startCase(type)}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Full-width Graph Visualization */}
      <Card id="graph-visualization-card" className="w-full">
          <CardHeader>
            <CardTitle>Graph View ({graphData.nodes.length} nodes, {graphData.edges.length} edges)</CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              ref={containerRef}
              className="relative bg-slate-50 dark:bg-slate-900 rounded-lg overflow-hidden" 
              style={{ height: '600px' }}
            >
              {/* Zoom level indicator */}
              <div className="absolute top-2 left-2 z-10 bg-white/90 dark:bg-black/90 px-2 py-1 rounded text-xs">
                Zoom: {Math.round(zoom * 100)}%
              </div>
              
              {/* Node count indicator */}
              <div className="absolute top-2 right-2 z-10 bg-white/90 dark:bg-black/90 px-2 py-1 rounded text-xs">
                {graphData.nodes.length} nodes, {graphData.edges.length} edges
              </div>
              
              {/* Instructions */}
              <div className="absolute bottom-2 left-2 z-10 bg-white/90 dark:bg-black/90 px-2 py-1 rounded text-xs">
                Drag to pan • Scroll to zoom • Drag nodes to reposition
              </div>
              
              <svg
                ref={svgRef}
                width="100%"
                height="100%"
                viewBox={`${-pan.x / zoom} ${-pan.y / zoom} ${800 / zoom} ${600 / zoom}`}
                className={isDragging ? "cursor-grabbing" : "cursor-grab"}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onDoubleClick={handleDoubleClick}
              >
                {/* Edges */}
                <g>
                  {graphData.edges
                    .filter(edge => {
                      // Filter by search query
                      if (searchQuery && !(
                        edge.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        graphData.nodes.find(n => n.id === edge.source)?.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        graphData.nodes.find(n => n.id === edge.target)?.label.toLowerCase().includes(searchQuery.toLowerCase())
                      )) return false
                      
                      // Filter by memory types
                      if (selectedMemoryTypes.length > 0) {
                        const sourceNode = graphData.nodes.find(n => n.id === edge.source)
                        const targetNode = graphData.nodes.find(n => n.id === edge.target)
                        const sourceType = sourceNode?.properties?.memory_type || 'semantic'
                        const targetType = targetNode?.properties?.memory_type || 'semantic'
                        if (!selectedMemoryTypes.includes(sourceType) && !selectedMemoryTypes.includes(targetType)) {
                          return false
                        }
                      }
                      
                      return true
                    })
                    .map((edge) => {
                      const sourceNode = graphData.nodes.find(n => n.id === edge.source)
                      const targetNode = graphData.nodes.find(n => n.id === edge.target)
                      
                      if (!sourceNode || !targetNode) return null

                      return (
                        <g key={`edge-${edge.id}`}>
                          <line
                            x1={sourceNode.x}
                            y1={sourceNode.y}
                            x2={targetNode.x}
                            y2={targetNode.y}
                            stroke={selectedEdge?.id === edge.id ? '#ef4444' : (relationshipColors[edge.type as keyof typeof relationshipColors] || '#64748b')}
                            strokeWidth={selectedEdge?.id === edge.id ? 3 : 2}
                            strokeOpacity={0.6}
                            style={{ 
                              stroke: `${selectedEdge?.id === edge.id ? '#ef4444' : (relationshipColors[edge.type as keyof typeof relationshipColors] || '#64748b')} !important`
                            }}
                            className="cursor-pointer transition-all hover:stroke-opacity-100"
                            onClick={() => handleEdgeClick(edge)}
                          />
                          {showLabels && (
                            <text
                              x={(sourceNode.x! + targetNode.x!) / 2}
                              y={(sourceNode.y! + targetNode.y!) / 2}
                              textAnchor="middle"
                              className="text-xs fill-gray-600 dark:fill-gray-400 pointer-events-none"
                              style={{ fontSize: `${12 / zoom}px` }}
                            >
                              {startCase(edge.type.toLowerCase())}
                            </text>
                          )}
                        </g>
                      )
                    })}
                </g>

                {/* Nodes */}
                <g>
                  {graphData.nodes
                    .filter(node => {
                      // Filter by search query
                      if (searchQuery && !(
                        node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        node.type.toLowerCase().includes(searchQuery.toLowerCase())
                      )) return false
                      
                      // Filter by memory types
                      if (selectedMemoryTypes.length > 0 && node.type === 'memory') {
                        const memoryType = node.properties?.memory_type || 'semantic'
                        if (!selectedMemoryTypes.includes(memoryType)) return false
                      }
                      
                      return true
                    })
                    .map((node) => {
                      let nodeColor = '#6b7280' // Default gray
                      
                      if (node.type === 'memory' && node.properties?.memory_type) {
                        const memType = node.properties.memory_type
                        nodeColor = memoryTypeColors[memType as keyof typeof memoryTypeColors] || '#6b7280'
                        console.log(`Node ${node.id}: type=${memType}, color=${nodeColor}`)
                      } else if (node.type !== 'memory') {
                        nodeColor = nodeColors[node.type as keyof typeof nodeColors] || '#6b7280'
                      }
                      
                      // Always log first few nodes
                      if (graphData.nodes.indexOf(node) < 3) {
                        console.log('Node color calculation:', {
                          id: node.id,
                          type: node.type,
                          memory_type: node.properties?.memory_type,
                          calculatedColor: nodeColor,
                          memoryTypeColors
                        })
                      }
                      
                      return (
                        <g key={`node-${node.id}`}>
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={selectedNode?.id === node.id ? 12 : 10}
                            fill="none"
                            stroke={selectedNode?.id === node.id ? '#1f2937' : 'white'}
                            strokeWidth={selectedNode?.id === node.id ? 3 : 2}
                            opacity={1}
                            style={{ 
                              cursor: draggedNode === node.id ? "grabbing" : "grab",
                              fill: nodeColor
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation()
                              setDraggedNode(node.id)
                              handleNodeClick(node)
                            }}
                          />
                        {showLabels && (
                          <text
                            x={node.x}
                            y={node.y! + 20}
                            textAnchor="middle"
                            className="text-xs fill-gray-700 dark:fill-gray-300 pointer-events-none"
                            style={{ fontSize: `${12 / zoom}px` }}
                          >
                            {node.label.length > 15 ? node.label.slice(0, 15) + '...' : node.label}
                          </text>
                        )}
                      </g>
                      )
                    })}
                </g>
              </svg>

              {graphData.nodes.length === 0 && !loading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Network className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-muted-foreground">No connections found.</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Try increasing the connection limit or removing filters.
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-3"
                      onClick={() => {
                        setConnectionLimit(50)
                        setSearchQuery('')
                        loadConnections()
                      }}
                    >
                      Load More Connections
                    </Button>
                  </div>
                </div>
              )}
              
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                  <div className="text-center">
                    <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin" />
                    <p className="text-muted-foreground">Loading connections...</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      {/* Horizontal Legend directly under chart */}
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Memory Types Legend */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Memory Types</Label>
              <div className="flex flex-wrap gap-3">
                {Object.entries(memoryTypeColors).map(([type, color]) => (
                  <div key={type} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm">{startCase(type)}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Entity Types Legend */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Entity Types</Label>
              <div className="flex flex-wrap gap-3">
                {Object.entries(nodeColors).filter(([type]) => type !== 'memory').map(([type, color]) => (
                  <div key={type} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm">{startCase(type)}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Relationship Types Legend */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Relationship Types</Label>
              <div className="flex flex-wrap gap-3">
                {Object.entries(relationshipColors).map(([type, color]) => (
                  <div key={type} className="flex items-center gap-2">
                    <div 
                      className="w-4 h-0.5 rounded"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm">{startCase(type.toLowerCase())}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entity List and Selection Details - Grid Layout Below Graph */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6" style={{ minHeight: '500px' }}>
        {/* Enhanced Entity List */}
        {graphData.nodes.length > 0 && (
          <Card id="entities-list-card" className="flex flex-col">
            <CardHeader>
              <CardTitle>Entities ({graphData.nodes.length})</CardTitle>
              <CardDescription>Click to focus on entity • Double-click to center view</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="space-y-2 flex-1 overflow-y-auto" style={{ maxHeight: '450px' }}>
                {graphData.nodes
                  .sort((a, b) => {
                    // Sort by number of connections (most connected first)
                    const aConnections = graphData.edges.filter(e => e.source === a.id || e.target === a.id).length
                    const bConnections = graphData.edges.filter(e => e.source === b.id || e.target === b.id).length
                    return bConnections - aConnections
                  })
                  .map(node => {
                    const connectionCount = graphData.edges.filter(e => e.source === node.id || e.target === node.id).length
                    return (
                      <div
                        key={`entity-${node.id}`}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                          selectedNode?.id === node.id 
                            ? 'bg-primary/10 border border-primary' 
                            : 'hover:bg-muted'
                        }`}
                        onClick={() => handleEntityClick(node.id)}
                        onDoubleClick={() => {
                          // Center the view on this node
                          if (node.x && node.y) {
                            setPan({ 
                              x: -(node.x * zoom - 400), 
                              y: -(node.y * zoom - 300) 
                            })
                            setZoom(1.5)
                          }
                        }}
                      >
                        <Badge 
                          style={{ 
                            backgroundColor: node.type === 'memory' && node.properties?.memory_type
                              ? memoryTypeColors[node.properties.memory_type as keyof typeof memoryTypeColors]
                              : nodeColors[node.type as keyof typeof nodeColors] || '#6b7280'
                          }}
                          className="text-white text-xs"
                        >
                          {node.type === 'memory' && node.properties?.memory_type 
                            ? startCase(node.properties.memory_type)
                            : startCase(node.type)
                          }
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate" title={node.label}>{node.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {connectionCount} {startCase('connection')}{connectionCount !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Selection Details */}
        <Card id="selection-details-card" className="flex flex-col">
          <CardHeader>
            <CardTitle>Selection Details</CardTitle>
            <CardDescription>
              Click nodes or edges to view detailed information, properties, and relationships
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-4 overflow-y-auto" style={{ maxHeight: '450px' }}>
            {selectedNode && (
              <div>
                <h4 className="font-medium" title={`${startCase('node')}: ${selectedNode.label}`}>
                  {startCase('node')}: {selectedNode.label.length > 50 ? selectedNode.label.slice(0, 50) + '...' : selectedNode.label}
                </h4>
                <div className="space-y-3 mt-2">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={undefined as any}
                      className="text-white border-0"
                      style={{ 
                        backgroundColor: selectedNode.type === 'memory' && selectedNode.properties?.memory_type
                          ? memoryTypeColors[selectedNode.properties.memory_type as keyof typeof memoryTypeColors]
                          : nodeColors[selectedNode.type as keyof typeof nodeColors] || '#6b7280'
                      }}
                    >
                      {selectedNode.type === 'memory' && selectedNode.properties?.memory_type 
                        ? startCase(selectedNode.properties.memory_type)
                        : startCase(selectedNode.type)
                      }
                    </Badge>
                  </div>
                  
                  <div>
                    <Label>ID</Label>
                    <p className="text-sm font-mono break-all" title={selectedNode.id}>{selectedNode.id}</p>
                  </div>
                  
                  {selectedNode.properties?.full_content && (
                    <div>
                      <Label>Content</Label>
                      <p className="text-sm bg-muted p-2 rounded-md mt-1 whitespace-pre-wrap max-h-32 overflow-y-auto" title={selectedNode.properties.full_content}>
                        {selectedNode.properties.full_content}
                      </p>
                    </div>
                  )}
                  
                  {selectedNode.properties?.agent_id && (
                    <div>
                      <Label>Agent</Label>
                      <p className="text-sm" title={selectedNode.properties.agent_id}>{selectedNode.properties.agent_id}</p>
                    </div>
                  )}
                  
                  {selectedNode.properties?.created_at && (
                    <div>
                      <Label>Created</Label>
                      <p className="text-sm">{new Date(selectedNode.properties.created_at).toLocaleString()}</p>
                    </div>
                  )}
                  
                  <div>
                    <Label>Connections</Label>
                    <p className="text-sm">
                      {graphData.edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).length} total
                    </p>
                  </div>
                  
                  {selectedNode.properties && Object.keys(selectedNode.properties).length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium">Raw Properties</summary>
                      <pre 
                        className="text-xs bg-muted p-2 rounded-md mt-1 overflow-auto max-h-40"
                        title={JSON.stringify(selectedNode.properties, null, 2)}
                      >
                        {JSON.stringify(selectedNode.properties, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            )}

            {selectedEdge && (
              <div>
                <h4 className="font-medium" title={`${startCase('relationship')}: ${startCase(selectedEdge.type.toLowerCase())}`}>
                  {startCase('relationship')}: {startCase(selectedEdge.type.toLowerCase())}
                </h4>
                <div className="space-y-2 mt-2">
                  <div>
                    <Label>From</Label>
                    <p className="text-sm" title={graphData.nodes.find(n => n.id === selectedEdge.source)?.label}>
                      {(() => {
                        const label = graphData.nodes.find(n => n.id === selectedEdge.source)?.label || ''
                        return label.length > 40 ? label.slice(0, 40) + '...' : label
                      })()}
                    </p>
                  </div>
                  <div>
                    <Label>To</Label>
                    <p className="text-sm" title={graphData.nodes.find(n => n.id === selectedEdge.target)?.label}>
                      {(() => {
                        const label = graphData.nodes.find(n => n.id === selectedEdge.target)?.label || ''
                        return label.length > 40 ? label.slice(0, 40) + '...' : label
                      })()}
                    </p>
                  </div>
                  {selectedEdge.properties && Object.keys(selectedEdge.properties).length > 0 && (
                    <div>
                      <Label>Properties</Label>
                      <pre 
                        className="text-xs bg-muted p-2 rounded-md mt-1 overflow-auto"
                        title={JSON.stringify(selectedEdge.properties, null, 2)}
                      >
                        {JSON.stringify(selectedEdge.properties, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!selectedNode && !selectedEdge && (
              <div className="text-center py-8 text-muted-foreground">
                <div className="space-y-2">
                  <p>Click on a node or edge to view details</p>
                  <div className="text-xs space-y-1">
                    <p><strong>Node Labels:</strong> {`{memory_type}-{agent}-{date/id}`}</p>
                    <p><strong>Memory Types:</strong> episodic, semantic, procedural, working</p>
                    <p><strong>Node Types:</strong> memory, agent, session</p>
                    <p><strong>Interactions:</strong> Click = select, Double-click = center, Drag = move</p>
                  </div>
                </div>
              </div>
            )}
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
                        {startCase(type.toLowerCase())}
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