'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Search, Plus, Trash2, Brain, Clock, Lightbulb, Settings } from 'lucide-react'
import { format } from 'date-fns'

interface Memory {
  id: string
  content: string
  type: 'episodic' | 'semantic' | 'procedural' | 'working'
  project: string
  agent_id?: string
  session_id?: string
  tags: string[]
  timestamp?: string
  created_at?: string
  embedding_vector?: number[]
  metadata?: Record<string, any>
}

interface SearchFilters {
  query: string
  type?: string
  project?: string
  agent_id?: string
  limit: number
  threshold: number
}

const memoryTypeIcons = {
  episodic: Clock,
  semantic: Brain,
  procedural: Settings,
  working: Lightbulb
}

const memoryTypeColors = {
  episodic: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  semantic: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  procedural: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  working: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
}

export function MemoryBrowser() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(false)
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    query: '',
    limit: 20,
    threshold: 0.0
  })
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newMemory, setNewMemory] = useState({
    content: '',
    type: 'episodic' as const,
    project: 'bedrock-agent-system',
    tags: [] as string[],
    tagInput: ''
  })

  const searchMemories = async () => {
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
            arguments: searchFilters
          }
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data?.result?.content?.[0]?.text) {
          const result = JSON.parse(data.result.content[0].text)
          const memoriesData = result?.memories || []
          // Ensure each memory has required fields with defaults
          const normalizedMemories = memoriesData.map((memory: any) => ({
            id: memory?.id || memory?.memory_id || 'unknown',
            content: memory?.content || memory?.text || 'No content available',
            type: memory?.type || 'unknown',
            project: memory?.project || 'unknown',
            timestamp: memory?.timestamp || memory?.created_at,
            created_at: memory?.created_at || memory?.timestamp,
            tags: Array.isArray(memory?.tags) ? memory.tags : [],
            agent_id: memory?.agent_id,
            session_id: memory?.session_id,
            metadata: memory?.metadata || {}
          }))
          setMemories(normalizedMemories)
        } else {
          setMemories([])
        }
      } else {
        console.error('Search request failed:', response.status)
        setMemories([])
      }
    } catch (error) {
      console.error('Failed to search memories:', error)
      setMemories([])
    } finally {
      setLoading(false)
    }
  }

  const addMemory = async () => {
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
            name: 'store-memory',
            arguments: {
              content: newMemory.content,
              type: newMemory.type,
              project: newMemory.project,
              tags: newMemory.tags,
              agent_id: 'dashboard-user'
            }
          }
        })
      })

      if (response.ok) {
        setShowAddDialog(false)
        setNewMemory({
          content: '',
          type: 'episodic',
          project: 'bedrock-agent-system',
          tags: [],
          tagInput: ''
        })
        searchMemories() // Refresh the list
      }
    } catch (error) {
      console.error('Failed to add memory:', error)
    }
  }

  const deleteMemory = async (memoryId: string) => {
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
            name: 'delete-memory',
            arguments: { memory_id: memoryId }
          }
        })
      })

      if (response.ok) {
        setMemories(memories.filter(m => m.id !== memoryId))
        if (selectedMemory?.id === memoryId) {
          setSelectedMemory(null)
        }
      }
    } catch (error) {
      console.error('Failed to delete memory:', error)
    }
  }

  const addTag = () => {
    if (newMemory.tagInput.trim() && !newMemory.tags.includes(newMemory.tagInput.trim())) {
      setNewMemory({
        ...newMemory,
        tags: [...newMemory.tags, newMemory.tagInput.trim()],
        tagInput: ''
      })
    }
  }

  const removeTag = (tag: string) => {
    setNewMemory({
      ...newMemory,
      tags: newMemory.tags.filter(t => t !== tag)
    })
  }

  useEffect(() => {
    searchMemories()
  }, [])

  return (
    <div className="space-y-6">
      {/* Search Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Memory Search
          </CardTitle>
          <CardDescription>
            Search and browse memories using semantic similarity or filters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="search-query">Search Query</Label>
              <Input
                id="search-query"
                placeholder="Enter search terms..."
                value={searchFilters.query}
                onChange={(e) => setSearchFilters({...searchFilters, query: e.target.value})}
                onKeyDown={(e) => e.key === 'Enter' && searchMemories()}
              />
            </div>
            <div>
              <Label htmlFor="memory-type">Memory Type</Label>
              <Select value={searchFilters.type || 'all'} onValueChange={(value) => 
                setSearchFilters({...searchFilters, type: value === 'all' ? undefined : value})
              }>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="episodic">Episodic</SelectItem>
                  <SelectItem value="semantic">Semantic</SelectItem>
                  <SelectItem value="procedural">Procedural</SelectItem>
                  <SelectItem value="working">Working</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="project">Project</Label>
              <Input
                id="project"
                placeholder="Project name"
                value={searchFilters.project || ''}
                onChange={(e) => setSearchFilters({...searchFilters, project: e.target.value || undefined})}
              />
            </div>
            <div>
              <Label htmlFor="limit">Limit</Label>
              <Input
                id="limit"
                type="number"
                min="1"
                max="100"
                value={searchFilters.limit}
                onChange={(e) => setSearchFilters({...searchFilters, limit: parseInt(e.target.value) || 20})}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={searchMemories} disabled={loading}>
              {loading ? 'Searching...' : 'Search Memories'}
            </Button>
            <Button variant="outline" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Memory
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Memory List */}
        <Card>
          <CardHeader>
            <CardTitle>Search Results ({memories.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {memories.map((memory) => {
                const IconComponent = memoryTypeIcons[memory.type]
                return (
                  <div
                    key={memory.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedMemory?.id === memory.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedMemory(memory)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <IconComponent className="h-4 w-4" />
                        <Badge className={memoryTypeColors[memory.type]}>
                          {memory.type}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteMemory(memory.id)
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-sm mt-2 line-clamp-2">{memory?.content || 'No content available'}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span>{memory?.project || 'Unknown'}</span>
                      <span>•</span>
                      <span>{format(new Date(memory?.timestamp || memory?.created_at || Date.now()), 'MMM d, HH:mm')}</span>
                    </div>
                    {memory?.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {memory.tags.map((tag, index) => (
                          <Badge key={`${memory.id}-tag-${index}-${tag}`} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              {memories.length === 0 && !loading && (
                <div className="text-center py-8 text-muted-foreground">
                  No memories found. Try adjusting your search criteria.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Memory Detail */}
        <Card>
          <CardHeader>
            <CardTitle>Memory Details</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedMemory ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {(() => {
                    const IconComponent = memoryTypeIcons[selectedMemory?.type] || Brain
                    return <IconComponent className="h-5 w-5" />
                  })()}
                  <Badge className={memoryTypeColors[selectedMemory?.type] || ''}>
                    {selectedMemory?.type || 'unknown'}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(selectedMemory?.timestamp || selectedMemory?.created_at || Date.now()), 'PPpp')}
                  </span>
                </div>
                
                <div>
                  <Label>Content</Label>
                  <div className="mt-1 p-3 bg-muted rounded-md">
                    <p className="text-sm whitespace-pre-wrap">{selectedMemory?.content || 'No content available'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Project</Label>
                    <p className="text-sm">{selectedMemory?.project || 'Unknown'}</p>
                  </div>
                  {selectedMemory?.agent_id && (
                    <div>
                      <Label>Agent ID</Label>
                      <p className="text-sm">{selectedMemory.agent_id}</p>
                    </div>
                  )}
                  {selectedMemory?.session_id && (
                    <div>
                      <Label>Session ID</Label>
                      <p className="text-sm">{selectedMemory.session_id}</p>
                    </div>
                  )}
                  <div>
                    <Label>Memory ID</Label>
                    <p className="text-sm font-mono">{selectedMemory?.id || 'Unknown'}</p>
                  </div>
                </div>

                {selectedMemory?.tags?.length > 0 && (
                  <div>
                    <Label>Tags</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedMemory.tags.map((tag, index) => (
                        <Badge key={`${selectedMemory.id}-detail-tag-${index}-${tag}`} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedMemory?.metadata && Object.keys(selectedMemory.metadata).length > 0 && (
                  <div>
                    <Label>Metadata</Label>
                    <pre className="text-xs bg-muted p-2 rounded-md mt-1 overflow-auto">
                      {JSON.stringify(selectedMemory.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Select a memory from the list to view details
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Memory Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Add New Memory</CardTitle>
              <CardDescription>
                Store a new memory in the system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="memory-content">Content</Label>
                <Textarea
                  id="memory-content"
                  placeholder="Enter memory content..."
                  value={newMemory.content}
                  onChange={(e) => setNewMemory({...newMemory, content: e.target.value})}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="memory-type-select">Type</Label>
                  <Select value={newMemory.type} onValueChange={(value: any) => 
                    setNewMemory({...newMemory, type: value})
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="episodic">Episodic</SelectItem>
                      <SelectItem value="semantic">Semantic</SelectItem>
                      <SelectItem value="procedural">Procedural</SelectItem>
                      <SelectItem value="working">Working</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="memory-project">Project</Label>
                  <Input
                    id="memory-project"
                    value={newMemory.project}
                    onChange={(e) => setNewMemory({...newMemory, project: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="memory-tags">Tags</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="memory-tags"
                    placeholder="Add a tag..."
                    value={newMemory.tagInput}
                    onChange={(e) => setNewMemory({...newMemory, tagInput: e.target.value})}
                    onKeyDown={(e) => e.key === 'Enter' && addTag()}
                  />
                  <Button variant="outline" onClick={addTag}>
                    Add
                  </Button>
                </div>
                {newMemory.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {newMemory.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                        {tag} ×
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={addMemory} disabled={!newMemory.content.trim()}>
                  Add Memory
                </Button>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
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