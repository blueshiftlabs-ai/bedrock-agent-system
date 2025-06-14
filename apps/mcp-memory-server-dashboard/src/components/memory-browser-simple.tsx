'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Brain, Search, Plus, Filter, SortAsc, SortDesc, X, Calendar, Hash, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { AddMemoryDialog } from './add-memory-dialog'

interface Memory {
  id: string
  content: string
  type: string
  project: string
  agent_id?: string
  timestamp?: string
  created_at?: string
  tags?: string[]
}

export function MemoryBrowserSimple() {
  const router = useRouter()
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  
  // Filtering and sorting state
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'created_at' | 'content' | 'type'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showFilters, setShowFilters] = useState(false)
  const [showAddMemory, setShowAddMemory] = useState(false)

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
            arguments: {
              query: query || '',
              limit: 20
            }
          }
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data?.result?.content?.[0]?.text) {
          try {
            const result = JSON.parse(data.result.content[0].text)
            const memoriesData = result?.memories || []
            const normalizedMemories = memoriesData.map((memoryData: any) => {
              // Handle the new nested structure: memory.memory.content vs old memory.content
              const memory = memoryData?.memory || memoryData
              const metadata = memory?.metadata || memory
              const content = memory?.content || memory?.text || 'No content available'
              
              return {
                id: metadata?.memory_id || memoryData?.memory_id || memoryData?.id || `temp-${Date.now()}`,
                content,
                type: metadata?.type || 'unknown',
                project: metadata?.project || 'unknown',
                agent_id: metadata?.agent_id,
                timestamp: metadata?.created_at || metadata?.timestamp,
                created_at: metadata?.created_at || metadata?.timestamp,
                tags: Array.isArray(metadata?.tags) ? metadata.tags : []
              }
            })
            setMemories(normalizedMemories)
          } catch (parseError) {
            console.error('Failed to parse memories:', parseError)
            setMemories([])
          }
        } else {
          setMemories([])
        }
      }
    } catch (error) {
      console.error('Failed to search memories:', error)
      setMemories([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    searchMemories()
  }, [])

  // Filter and sort memories
  const filteredAndSortedMemories = useMemo(() => {
    let filtered = memories.filter(memory => {
      // Text search
      if (query && !memory.content.toLowerCase().includes(query.toLowerCase())) {
        return false
      }
      
      // Type filter
      if (selectedTypes.length > 0 && !selectedTypes.includes(memory.type)) {
        return false
      }
      
      // Agent filter
      if (selectedAgents.length > 0) {
        const agentId = memory.agent_id || 'unknown'
        if (!selectedAgents.includes(agentId)) {
          return false
        }
      }
      
      // Tag filter
      if (selectedTags.length > 0) {
        const memoryTags = memory.tags || []
        if (!selectedTags.some(tag => memoryTags.includes(tag))) {
          return false
        }
      }
      
      return true
    })

    // Sort memories
    filtered.sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (sortBy) {
        case 'created_at':
          aValue = new Date(a.created_at || a.timestamp || 0).getTime()
          bValue = new Date(b.created_at || b.timestamp || 0).getTime()
          break
        case 'content':
          aValue = a.content.toLowerCase()
          bValue = b.content.toLowerCase()
          break
        case 'type':
          aValue = a.type.toLowerCase()
          bValue = b.type.toLowerCase()
          break
        default:
          return 0
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    return filtered
  }, [memories, query, selectedTypes, selectedAgents, selectedTags, sortBy, sortOrder])

  // Get unique values for filter options
  const availableTypes = useMemo(() => 
    [...new Set(memories.map(m => m.type))].sort(), [memories])
  
  const availableAgents = useMemo(() => 
    [...new Set(memories.map(m => m.agent_id || 'unknown'))].sort(), [memories])
  
  const availableTags = useMemo(() => 
    [...new Set(memories.flatMap(m => m.tags || []))].sort(), [memories])

  const handleTagClick = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag])
      setShowFilters(true)
    }
  }

  const clearFilters = () => {
    setSelectedTypes([])
    setSelectedAgents([])
    setSelectedTags([])
    setQuery('')
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Memory Browser
          </CardTitle>
          <CardDescription>
            Search and browse stored memories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search memories..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchMemories()}
                />
              </div>
              <Button onClick={searchMemories} disabled={loading}>
                <Search className="h-4 w-4 mr-2" />
                {loading ? 'Searching...' : 'Search'}
              </Button>
              <Button 
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
                <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </Button>
              <Button 
                variant="outline"
                onClick={() => setShowAddMemory(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Memory
              </Button>
            </div>
            
            {/* Advanced Filters */}
            {showFilters && (
              <div className="border rounded-lg p-4 bg-muted/20 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Type Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Memory Types</Label>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {availableTypes.map((type) => (
                        <div key={type} className="flex items-center space-x-2">
                          <Checkbox
                            id={`type-${type}`}
                            checked={selectedTypes.includes(type)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedTypes([...selectedTypes, type])
                              } else {
                                setSelectedTypes(selectedTypes.filter(t => t !== type))
                              }
                            }}
                          />
                          <Label htmlFor={`type-${type}`} className="text-sm cursor-pointer">
                            {type} ({memories.filter(m => m.type === type).length})
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Agent Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Agents</Label>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {availableAgents.map((agent) => (
                        <div key={agent} className="flex items-center space-x-2">
                          <Checkbox
                            id={`agent-${agent}`}
                            checked={selectedAgents.includes(agent)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedAgents([...selectedAgents, agent])
                              } else {
                                setSelectedAgents(selectedAgents.filter(a => a !== agent))
                              }
                            }}
                          />
                          <Label htmlFor={`agent-${agent}`} className="text-sm cursor-pointer">
                            {agent === 'unknown' ? 'Anonymous' : agent} ({memories.filter(m => (m.agent_id || 'unknown') === agent).length})
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Tag Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Tags</Label>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {availableTags.map((tag) => (
                        <div key={tag} className="flex items-center space-x-2">
                          <Checkbox
                            id={`tag-${tag}`}
                            checked={selectedTags.includes(tag)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedTags([...selectedTags, tag])
                              } else {
                                setSelectedTags(selectedTags.filter(t => t !== tag))
                              }
                            }}
                          />
                          <Label htmlFor={`tag-${tag}`} className="text-sm cursor-pointer">
                            {tag} ({memories.filter(m => m.tags?.includes(tag)).length})
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Sort Options */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Sort By</Label>
                    <div className="space-y-2">
                      <Select value={sortBy} onValueChange={(value: 'created_at' | 'content' | 'type') => setSortBy(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="created_at">Date Created</SelectItem>
                          <SelectItem value="content">Content</SelectItem>
                          <SelectItem value="type">Type</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant={sortOrder === 'desc' ? 'default' : 'outline'}
                          onClick={() => setSortOrder('desc')}
                          className="flex-1"
                        >
                          <SortDesc className="h-3 w-3 mr-1" />
                          Desc
                        </Button>
                        <Button
                          size="sm"
                          variant={sortOrder === 'asc' ? 'default' : 'outline'}
                          onClick={() => setSortOrder('asc')}
                          className="flex-1"
                        >
                          <SortAsc className="h-3 w-3 mr-1" />
                          Asc
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Filter Actions */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="text-sm text-muted-foreground">
                    {filteredAndSortedMemories.length} of {memories.length} memories
                    {(selectedTypes.length > 0 || selectedAgents.length > 0 || selectedTags.length > 0) && ' (filtered)'}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={clearFilters}
                    disabled={selectedTypes.length === 0 && selectedAgents.length === 0 && selectedTags.length === 0 && !query}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear All
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Search Results ({filteredAndSortedMemories.length}
              {filteredAndSortedMemories.length !== memories.length && ` of ${memories.length}`})
            </CardTitle>
            {(selectedTypes.length > 0 || selectedAgents.length > 0 || selectedTags.length > 0) && (
              <div className="flex flex-wrap gap-1">
                {selectedTypes.map(type => (
                  <Badge key={`type-${type}`} variant="secondary" className="text-xs">
                    type: {type}
                    <button
                      onClick={() => setSelectedTypes(selectedTypes.filter(t => t !== type))}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-2 w-2" />
                    </button>
                  </Badge>
                ))}
                {selectedAgents.map(agent => (
                  <Badge key={`agent-${agent}`} variant="secondary" className="text-xs">
                    agent: {agent === 'unknown' ? 'Anonymous' : agent}
                    <button
                      onClick={() => setSelectedAgents(selectedAgents.filter(a => a !== agent))}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-2 w-2" />
                    </button>
                  </Badge>
                ))}
                {selectedTags.map(tag => (
                  <Badge key={`tag-${tag}`} variant="secondary" className="text-xs">
                    tag: {tag}
                    <button
                      onClick={() => setSelectedTags(selectedTags.filter(t => t !== tag))}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-2 w-2" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Searching memories...
            </div>
          ) : filteredAndSortedMemories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {memories.length === 0 
                ? "No memories found. Try adjusting your search criteria." 
                : "No memories match your filters. Try adjusting your criteria."}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAndSortedMemories.map((memory) => (
                <div
                  key={memory.id}
                  className="p-4 border rounded-lg hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/memory/${memory.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary">
                          {memory.type}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {memory.project}
                        </span>
                        {memory.agent_id && (
                          <span className="text-xs text-muted-foreground">
                            by {memory.agent_id === 'unknown' ? 'Anonymous' : memory.agent_id}
                          </span>
                        )}
                      </div>
                      <p className="text-sm mb-2 line-clamp-3">
                        {memory.content}
                      </p>
                      {memory.tags && memory.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {memory.tags.map((tag, index) => (
                            <Badge 
                              key={`${memory.id}-${index}`} 
                              variant="outline" 
                              className="text-xs cursor-pointer hover:bg-primary/10"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleTagClick(tag)
                              }}
                            >
                              <Hash className="h-2 w-2 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground text-right ml-4">
                      {memory.created_at && (
                        <>
                          <Calendar className="h-3 w-3 inline mr-1" />
                          {format(new Date(memory.created_at), 'MMM d, yyyy')}
                          <br />
                          {format(new Date(memory.created_at), 'HH:mm')}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Add Memory Dialog */}
      <AddMemoryDialog
        isOpen={showAddMemory}
        onClose={() => setShowAddMemory(false)}
        onMemoryAdded={() => {
          setShowAddMemory(false)
          searchMemories() // Refresh the list
        }}
      />
    </div>
  )
}