'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X, Save, Plus, Link2, Trash2, Brain, Network, Calendar, Hash, Tag, User, FolderOpen, Edit3, FileText } from 'lucide-react'
import { format } from 'date-fns'

interface Memory {
  memory_id: string
  content: string
  type: string
  project: string
  agent_id?: string
  created_at: string
  updated_at?: string
  tags?: string[]
  topics?: string[]
  sentiment?: string
  language?: string
  access_count?: number
  embeddings?: number[]
}

interface Connection {
  connection_id: string
  from_memory_id: string
  to_memory_id: string
  relationship_type: string
  created_at: string
  properties?: Record<string, any>
}

interface MemoryDetailModalProps {
  memoryId: string
  onClose?: () => void
  isModal?: boolean
}

export function MemoryDetailModal({ memoryId, onClose, isModal = true }: MemoryDetailModalProps) {
  const router = useRouter()
  const [memory, setMemory] = useState<Memory | null>(null)
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [content, setContent] = useState('')
  const [type, setType] = useState('')
  const [project, setProject] = useState('')
  const [agentId, setAgentId] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  
  // Connection form state
  const [showAddConnection, setShowAddConnection] = useState(false)
  const [targetMemoryId, setTargetMemoryId] = useState('')
  const [relationshipType, setRelationshipType] = useState('RELATES_TO')

  useEffect(() => {
    fetchMemoryDetails()
    fetchConnections()
  }, [memoryId])

  const fetchMemoryDetails = async () => {
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
            name: 'retrieve-memories',
            arguments: {
              memory_ids: [memoryId],
              include_related: true,
              limit: 1
            }
          }
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data?.result?.content?.[0]?.text) {
          const result = JSON.parse(data.result.content[0].text)
          if (result.memories?.[0]) {
            const memoryData = result.memories[0]
            const mem = memoryData.memory || memoryData
            const metadata = mem.metadata || mem
            
            const fetchedMemory: Memory = {
              memory_id: memoryId,
              content: mem.content || '',
              type: metadata.type || 'unknown',
              project: metadata.project || 'unknown',
              agent_id: metadata.agent_id,
              created_at: metadata.created_at || '',
              updated_at: metadata.updated_at,
              tags: metadata.tags || [],
              topics: metadata.topics || [],
              sentiment: metadata.sentiment,
              language: metadata.language,
              access_count: metadata.access_count
            }
            
            setMemory(fetchedMemory)
            setContent(fetchedMemory.content)
            setType(fetchedMemory.type)
            setProject(fetchedMemory.project)
            setAgentId(fetchedMemory.agent_id || '')
            setTags(fetchedMemory.tags || [])
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch memory details:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchConnections = async () => {
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
            name: 'connections-by-entity',
            arguments: {
              entity_id: memoryId,
              entity_type: 'memory',
              limit: 50
            }
          }
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data?.result?.content?.[0]?.text) {
          const result = JSON.parse(data.result.content[0].text)
          setConnections(result.connections || [])
        }
      }
    } catch (error) {
      console.error('Failed to fetch connections:', error)
    }
  }

  const handleSave = async () => {
    if (!memory) return
    
    setSaving(true)
    try {
      // Create an updated version of the memory
      const updateContent = `UPDATED: ${content}`
      const updateTags = [...(tags || []), 'memory-update', `original-${memoryId}`]
      
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
            name: 'store-memory',
            arguments: {
              content: updateContent,
              type,
              project,
              agent_id: agentId || undefined,
              tags: updateTags
            }
          }
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data?.result?.content?.[0]?.text) {
          const result = JSON.parse(data.result.content[0].text)
          const newMemoryId = result.memory_id
          
          // Create connection between original and updated memory
          if (newMemoryId) {
            await fetch('/api/memory/mcp', {
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
                    from_memory_id: memoryId,
                    to_memory_id: newMemoryId,
                    relationship_type: 'UPDATED_TO',
                    properties: {
                      update_timestamp: new Date().toISOString(),
                      update_reason: 'Manual edit via dashboard'
                    }
                  }
                }
              })
            })
          }
        }
        
        setEditing(false)
        await fetchMemoryDetails()
        await fetchConnections()
      }
    } catch (error) {
      console.error('Failed to save memory:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleAddConnection = async () => {
    if (!targetMemoryId) return
    
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
              from_memory_id: memoryId,
              to_memory_id: targetMemoryId,
              relationship_type: relationshipType,
              bidirectional: true
            }
          }
        })
      })

      if (response.ok) {
        setShowAddConnection(false)
        setTargetMemoryId('')
        await fetchConnections()
      }
    } catch (error) {
      console.error('Failed to add connection:', error)
    }
  }

  const handleAddTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag])
      setNewTag('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag))
  }

  const handleClose = () => {
    if (isModal && onClose) {
      onClose()
    } else {
      router.back()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-pulse">
          <Brain className="h-12 w-12 text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!memory) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Memory not found</p>
      </div>
    )
  }

  return (
    <div className={isModal ? "fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" : ""}>
      <Card className={isModal ? "w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" : ""} data-testid="memory-detail">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Brain className="h-6 w-6" />
              Memory Details
            </CardTitle>
            <CardDescription>
              {memory.memory_id}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {!editing ? (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setEditing(true)}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Edit
              </Button>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setEditing(false)
                    // Reset form values
                    setContent(memory.content)
                    setType(memory.type)
                    setProject(memory.project)
                    setAgentId(memory.agent_id || '')
                    setTags(memory.tags || [])
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </>
            )}
            {isModal && (
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-6">
          {/* Memory Content */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="content" className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4" />
                Content
              </Label>
              {editing ? (
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[150px]"
                />
              ) : (
                <div className="p-3 rounded-md border bg-muted/50 whitespace-pre-wrap">
                  {memory.content}
                </div>
              )}
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type" className="flex items-center gap-2 mb-2">
                  <Hash className="h-4 w-4" />
                  Type
                </Label>
                {editing ? (
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="episodic">Episodic</SelectItem>
                      <SelectItem value="semantic">Semantic</SelectItem>
                      <SelectItem value="procedural">Procedural</SelectItem>
                      <SelectItem value="working">Working</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="secondary" className="text-sm">
                    {memory.type}
                  </Badge>
                )}
              </div>

              <div>
                <Label htmlFor="project" className="flex items-center gap-2 mb-2">
                  <FolderOpen className="h-4 w-4" />
                  Project
                </Label>
                {editing ? (
                  <Input
                    id="project"
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                  />
                ) : (
                  <p className="text-sm">{memory.project}</p>
                )}
              </div>

              <div>
                <Label htmlFor="agent" className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4" />
                  Agent
                </Label>
                {editing ? (
                  <Input
                    id="agent"
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                    placeholder="Agent ID"
                  />
                ) : (
                  <p className="text-sm">{memory.agent_id || 'Anonymous'}</p>
                )}
              </div>

              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4" />
                  Created
                </Label>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(memory.created_at), 'PPpp')}
                </p>
              </div>
            </div>

            {/* Tags */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Tag className="h-4 w-4" />
                Tags
              </Label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge 
                    key={tag} 
                    variant="outline"
                    className="gap-1"
                  >
                    {tag}
                    {editing && (
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
                {editing && (
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

            {/* Additional Metadata */}
            {(memory.topics?.length || memory.sentiment || memory.language) && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                {memory.topics?.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Topics</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {memory.topics.map((topic, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {memory.sentiment && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Sentiment</Label>
                    <p className="text-sm mt-1">{memory.sentiment}</p>
                  </div>
                )}
                {memory.language && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Language</Label>
                    <p className="text-sm mt-1">{memory.language}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Connections */}
          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Network className="h-5 w-5" />
                Connections ({connections.length})
              </h3>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setShowAddConnection(!showAddConnection)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Connection
              </Button>
            </div>

            {showAddConnection && (
              <Card className="mb-4 p-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="target-memory">Target Memory ID</Label>
                      <Input
                        id="target-memory"
                        value={targetMemoryId}
                        onChange={(e) => setTargetMemoryId(e.target.value)}
                        placeholder="mem_..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="relationship">Relationship Type</Label>
                      <Select value={relationshipType} onValueChange={setRelationshipType}>
                        <SelectTrigger id="relationship">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="RELATES_TO">Relates To</SelectItem>
                          <SelectItem value="SIMILAR_TO">Similar To</SelectItem>
                          <SelectItem value="REFERENCES">References</SelectItem>
                          <SelectItem value="FOLLOWS">Follows</SelectItem>
                          <SelectItem value="IMPLEMENTS">Implements</SelectItem>
                          <SelectItem value="CONTRADICTS">Contradicts</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setShowAddConnection(false)
                        setTargetMemoryId('')
                      }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      size="sm"
                      onClick={handleAddConnection}
                      disabled={!targetMemoryId}
                    >
                      <Link2 className="h-4 w-4 mr-2" />
                      Add Connection
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {connections.length > 0 ? (
              <div className="space-y-2">
                {connections.map((connection) => (
                  <Card key={connection.connection_id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Link2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">
                            {connection.relationship_type}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {connection.from_memory_id === memoryId ? 'To' : 'From'}: {
                              connection.from_memory_id === memoryId 
                                ? connection.to_memory_id 
                                : connection.from_memory_id
                            }
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const targetId = connection.from_memory_id === memoryId 
                            ? connection.to_memory_id 
                            : connection.from_memory_id
                          if (isModal) {
                            window.open(`/memory/${targetId}`, '_blank')
                          } else {
                            router.push(`/memory/${targetId}`)
                          }
                        }}
                      >
                        View
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No connections found. Add connections to link related memories.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}