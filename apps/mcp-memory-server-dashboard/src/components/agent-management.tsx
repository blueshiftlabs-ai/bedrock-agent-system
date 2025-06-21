'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Users, Brain, FileText, Hash, Edit3, Save, X, Plus, Search, BarChart3, Calendar } from 'lucide-react'
import { format } from 'date-fns'

interface Agent {
  agent_id: string
  display_name?: string
  description?: string
  memory_count: number
  projects: string[]
  memory_types: Record<string, number>
  last_activity?: string
  created_at?: string
  tags?: string[]
}

interface AgentMemory {
  memory_id: string
  content: string
  type: string
  created_at: string
  project: string
}

export function AgentManagement() {
  const router = useRouter()
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [agentMemories, setAgentMemories] = useState<AgentMemory[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingAgent, setEditingAgent] = useState<string | null>(null)
  
  // Edit form state
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [newTag, setNewTag] = useState('')
  const [tags, setTags] = useState<string[]>([])

  useEffect(() => {
    fetchAgents()
  }, [])

  useEffect(() => {
    if (selectedAgent) {
      fetchAgentMemories(selectedAgent.agent_id)
    }
  }, [selectedAgent])

  const fetchAgents = async () => {
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
            name: 'get-memory-statistics',
            arguments: {}
          }
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data?.result?.content?.[0]?.text) {
          const stats = JSON.parse(data.result.content[0].text)
          
          // Transform agent statistics into agent list
          const agentList: Agent[] = Object.entries(stats.storage.by_agent).map(([agentId, agentStats]: [string, any]) => {
            // Get agent-specific data from localStorage or a dedicated agent store
            const storedAgentData = getStoredAgentData(agentId)
            
            return {
              agent_id: agentId,
              display_name: storedAgentData?.display_name || (agentId === 'unknown' ? 'Anonymous' : agentId),
              description: storedAgentData?.description,
              memory_count: agentStats.count,
              projects: Object.keys(stats.storage.by_project || {}),
              memory_types: stats.storage.by_type || {},
              last_activity: stats.storage.recent_activity.find((a: any) => a.agent_id === agentId)?.created_at,
              tags: storedAgentData?.tags || []
            }
          })
          
          setAgents(agentList.sort((a, b) => b.memory_count - a.memory_count))
        }
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAgentMemories = async (agentId: string) => {
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
              agent_id: agentId,
              limit: 20
            }
          }
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data?.result?.content?.[0]?.text) {
          const result = JSON.parse(data.result.content[0].text)
          const memories = result.memories || []
          
          const normalizedMemories = memories.map((memoryData: any) => {
            const memory = memoryData?.memory || memoryData
            const metadata = memory?.metadata || memory
            
            return {
              memory_id: metadata?.memory_id || memoryData?.memory_id || '',
              content: memory?.content || '',
              type: metadata?.type || 'unknown',
              created_at: metadata?.created_at || '',
              project: metadata?.project || 'unknown'
            }
          })
          
          setAgentMemories(normalizedMemories)
        }
      }
    } catch (error) {
      console.error('Failed to fetch agent memories:', error)
    }
  }

  const getStoredAgentData = (agentId: string) => {
    // In a real app, this would fetch from a database or API
    // For now, using localStorage
    const stored = localStorage.getItem(`agent_${agentId}`)
    return stored ? JSON.parse(stored) : null
  }

  const saveAgentData = (agentId: string, data: any) => {
    // In a real app, this would save to a database
    localStorage.setItem(`agent_${agentId}`, JSON.stringify(data))
    
    // Also store this as a memory for persistence
    fetch('/api/memory/mcp', {
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
          name: 'store-memory',
          arguments: {
            content: `Agent metadata: ${agentId}\nDisplay Name: ${data.display_name}\nDescription: ${data.description}\nTags: ${data.tags?.join(', ')}`,
            type: 'semantic',
            project: 'agent-metadata',
            agent_id: 'system',
            tags: ['agent-metadata', agentId, ...data.tags]
          }
        }
      })
    })
  }

  const handleSaveAgent = (agent: Agent) => {
    const agentData = {
      display_name: displayName,
      description,
      tags
    }
    
    saveAgentData(agent.agent_id, agentData)
    
    // Update local state
    setAgents(agents.map(a => 
      a.agent_id === agent.agent_id 
        ? { ...a, ...agentData }
        : a
    ))
    
    if (selectedAgent?.agent_id === agent.agent_id) {
      setSelectedAgent({ ...selectedAgent, ...agentData })
    }
    
    setEditingAgent(null)
  }

  const handleEditAgent = (agent: Agent) => {
    setEditingAgent(agent.agent_id)
    setDisplayName(agent.display_name || '')
    setDescription(agent.description || '')
    setTags(agent.tags || [])
  }

  const handleAddTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag])
      setNewTag('')
    }
  }

  const filteredAgents = agents.filter(agent => 
    agent.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.agent_id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-pulse">
          <Users className="h-12 w-12 text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Agent Management
          </CardTitle>
          <CardDescription>
            Manage agents and their associated memories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <Button variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Agent
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent List */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-lg font-semibold">Agents ({filteredAgents.length})</h3>
          <div className="space-y-2">
            {filteredAgents.map((agent) => (
              <Card 
                key={agent.agent_id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedAgent?.agent_id === agent.agent_id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedAgent(agent)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{agent.display_name}</CardTitle>
                      <CardDescription className="text-xs">{agent.agent_id}</CardDescription>
                    </div>
                    <Badge variant="secondary">
                      {agent.memory_count} memories
                    </Badge>
                  </div>
                </CardHeader>
                {agent.description && (
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {agent.description}
                    </p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </div>

        {/* Agent Details */}
        <div className="lg:col-span-2">
          {selectedAgent ? (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">
                      {editingAgent === selectedAgent.agent_id ? (
                        <Input
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Display name"
                          className="text-xl font-bold"
                        />
                      ) : (
                        selectedAgent.display_name
                      )}
                    </CardTitle>
                    <CardDescription>{selectedAgent.agent_id}</CardDescription>
                  </div>
                  <div>
                    {editingAgent === selectedAgent.agent_id ? (
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setEditingAgent(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => handleSaveAgent(selectedAgent)}
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleEditAgent(selectedAgent)}
                      >
                        <Edit3 className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Description */}
                <div>
                  <Label className="text-sm font-medium mb-2">Description</Label>
                  {editingAgent === selectedAgent.agent_id ? (
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add a description for this agent..."
                      className="min-h-[100px]"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {selectedAgent.description || 'No description available'}
                    </p>
                  )}
                </div>

                {/* Tags */}
                {(editingAgent === selectedAgent.agent_id || (selectedAgent.tags && selectedAgent.tags.length > 0)) && (
                  <div>
                    <Label className="text-sm font-medium mb-2">Tags</Label>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="gap-1">
                          {tag}
                          {editingAgent === selectedAgent.agent_id && (
                            <button
                              onClick={() => setTags(tags.filter(t => t !== tag))}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </Badge>
                      ))}
                      {editingAgent === selectedAgent.agent_id && (
                        <div className="flex items-center gap-2">
                          <Input
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                            placeholder="Add tag"
                            className="h-8 w-32"
                          />
                          <Button size="sm" variant="outline" onClick={handleAddTag}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Total Memories</Label>
                    <p className="text-2xl font-bold">{selectedAgent.memory_count}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Projects</Label>
                    <p className="text-2xl font-bold">{selectedAgent.projects.length}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Memory Types</Label>
                    <p className="text-2xl font-bold">{Object.keys(selectedAgent.memory_types).length}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Last Active</Label>
                    <p className="text-sm">
                      {selectedAgent.last_activity 
                        ? format(new Date(selectedAgent.last_activity), 'MMM d')
                        : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Memory Type Distribution */}
                <div>
                  <Label className="text-sm font-medium mb-2">Memory Type Distribution</Label>
                  <div className="space-y-2">
                    {Object.entries(selectedAgent.memory_types).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{type}</Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {typeof count === 'object' && count !== null && 'count' in count 
                            ? (count as any).count 
                            : count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Memories */}
                <div>
                  <Label className="text-sm font-medium mb-2">Recent Memories</Label>
                  <div className="space-y-2">
                    {agentMemories.length > 0 ? (
                      agentMemories.slice(0, 5).map((memory) => (
                        <Card 
                          key={memory.memory_id}
                          className="p-3 cursor-pointer hover:shadow-sm transition-all"
                          onClick={() => router.push(`/memory/${memory.memory_id}`)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm line-clamp-2">{memory.content}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {memory.type}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(memory.created_at), 'MMM d, HH:mm')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No memories found for this agent
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent>
                <p className="text-muted-foreground">Select an agent to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}