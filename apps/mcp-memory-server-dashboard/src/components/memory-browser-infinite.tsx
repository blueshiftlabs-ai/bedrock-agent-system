'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useInfiniteMemories } from '@/lib/queries'
import { useIntersectionObserver } from '@/hooks/use-intersection-observer'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Brain, Search, Plus, Filter, SortAsc, SortDesc, X, Calendar, Hash, ChevronDown, Loader2, RotateCcw } from 'lucide-react'
import { format } from 'date-fns'
import { AddMemoryDialog } from './add-memory-dialog'
import { getMemoryTypeIcon, getMemoryTypeColor } from '@/lib/memory-utils'

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

export function MemoryBrowserInfinite() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const loadMoreRef = useRef<HTMLDivElement>(null)
  
  // Load state from localStorage and URL params
  const loadPersistedState = useCallback(() => {
    if (typeof window === 'undefined') return {}
    
    try {
      const saved = localStorage.getItem('memory-browser-state')
      const parsed = saved ? JSON.parse(saved) : {}
      
      // URL params override localStorage
      const urlQuery = searchParams.get('q') || ''
      const urlPageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : undefined
      
      return {
        query: urlQuery || parsed.query || '',
        selectedTypes: parsed.selectedTypes || [],
        selectedAgents: parsed.selectedAgents || [],
        selectedTags: parsed.selectedTags || [],
        sortBy: parsed.sortBy || 'created_at',
        sortOrder: parsed.sortOrder || 'desc',
        showFilters: parsed.showFilters || false,
        pageSize: urlPageSize || parsed.pageSize || 20
      }
    } catch {
      return {}
    }
  }, [searchParams])
  
  const persistedState = loadPersistedState()
  
  // State with persistence
  const [query, setQuery] = useState(persistedState.query || '')
  const [debouncedQuery, setDebouncedQuery] = useState(persistedState.query || '')
  const [selectedTypes, setSelectedTypes] = useState<string[]>(persistedState.selectedTypes || [])
  const [selectedAgents, setSelectedAgents] = useState<string[]>(persistedState.selectedAgents || [])
  const [selectedTags, setSelectedTags] = useState<string[]>(persistedState.selectedTags || [])
  const [sortBy, setSortBy] = useState<'created_at' | 'content' | 'type'>(persistedState.sortBy || 'created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(persistedState.sortOrder || 'desc')
  const [showFilters, setShowFilters] = useState(persistedState.showFilters || false)
  const [pageSize, setPageSize] = useState(persistedState.pageSize || 20)
  
  // Non-persisted state
  const [showAddMemory, setShowAddMemory] = useState(false)
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false)
  const [lastFetchTime, setLastFetchTime] = useState<number>(0)

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  // Use infinite query
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading,
    refetch
  } = useInfiniteMemories(debouncedQuery, pageSize)

  // Track when initial data has loaded
  useEffect(() => {
    if (!isLoading && data?.pages && data.pages.length > 0) {
      setHasInitiallyLoaded(true)
    }
  }, [isLoading, data?.pages])

  // Persist state to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const stateToSave = {
      query,
      selectedTypes,
      selectedAgents,
      selectedTags,
      sortBy,
      sortOrder,
      showFilters,
      pageSize
    }
    
    localStorage.setItem('memory-browser-state', JSON.stringify(stateToSave))
  }, [query, selectedTypes, selectedAgents, selectedTags, sortBy, sortOrder, showFilters, pageSize])

  // Flatten all pages into a single array and deduplicate by ID
  const allMemories = useMemo(() => {
    const memories = data?.pages.flatMap(page => page.memories) || []
    // Deduplicate by memory ID to prevent duplicate key errors
    const seen = new Set()
    return memories.filter(memory => {
      if (seen.has(memory.id)) {
        return false
      }
      seen.add(memory.id)
      return true
    })
  }, [data])

  // Apply client-side filtering and sorting
  const filteredAndSortedMemories = useMemo(() => {
    let filtered = allMemories.filter(memory => {
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
  }, [allMemories, selectedTypes, selectedAgents, selectedTags, sortBy, sortOrder])

  // Get unique values for filter options
  const availableTypes = useMemo(() => 
    [...new Set(allMemories.map(m => m.type))].sort(), [allMemories])
  
  const availableAgents = useMemo(() => 
    [...new Set(allMemories.map(m => m.agent_id || 'unknown'))].sort(), [allMemories])
  
  const availableTags = useMemo(() => 
    [...new Set(allMemories.flatMap(m => m.tags || []))].sort(), [allMemories])

  const handleTagClick = useCallback((tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag])
      setShowFilters(true)
    }
  }, [selectedTags])

  const clearFilters = useCallback(() => {
    setSelectedTypes([])
    setSelectedAgents([])
    setSelectedTags([])
  }, [])

  const resetAll = useCallback(() => {
    setQuery('')
    setDebouncedQuery('')
    setSelectedTypes([])
    setSelectedAgents([])
    setSelectedTags([])
    setSortBy('created_at')
    setSortOrder('desc')
    setShowFilters(false)
    setPageSize(20)
    
    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('memory-browser-state')
    }
    
    // Clear URL params
    const url = new URL(window.location.href)
    url.searchParams.delete('q')
    url.searchParams.delete('pageSize')
    router.replace(url.pathname)
    
    // Refetch data
    refetch()
  }, [router, refetch])

  const handleLoadMore = useCallback(() => {
    const now = Date.now()
    
    // Rate limiting: don't allow calls more than once every 500ms (prevent double-clicks)
    if (now - lastFetchTime < 500) {
      console.log('Rate limited: too soon since last fetch')
      return
    }
    
    console.log('handleLoadMore called', {
      hasNextPage,
      isFetchingNextPage,
      isLoading,
      hasInitiallyLoaded,
      memoriesCount: allMemories.length,
      pagesCount: data?.pages?.length,
      timeSinceLastFetch: now - lastFetchTime
    })
    
    // Simple, clear conditions for loading more
    if (hasNextPage && !isFetchingNextPage && !isLoading) {
      console.log('Fetching next page...')
      setLastFetchTime(now)
      fetchNextPage()
    } else {
      console.log('Cannot fetch more:', {
        hasNextPage,
        isFetchingNextPage,
        isLoading
      })
    }
  }, [hasNextPage, isFetchingNextPage, isLoading, fetchNextPage, lastFetchTime])

  // Set up intersection observer for automatic loading 
  useIntersectionObserver({
    target: loadMoreRef,
    onIntersect: handleLoadMore,
    enabled: hasNextPage && !isFetchingNextPage && !isLoading,
    rootMargin: '100px',
    threshold: 0.1,
  })

  return (
    <div className="space-y-6" data-testid="memory-browser">
      {/* Search & Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Memory Browser
          </CardTitle>
          <CardDescription>
            Search and browse stored memories with infinite scrolling
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
                  data-testid="memory-search"
                />
              </div>
              <Button onClick={() => refetch()} disabled={isFetching}>
                <Search className="h-4 w-4 mr-2" />
                {isFetching ? 'Searching...' : 'Search'}
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
              <Button 
                variant="outline"
                onClick={resetAll}
                title="Reset all filters, search, and settings"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
            
            {/* Advanced Filters */}
            {showFilters && (
              <div className="border rounded-lg p-4 bg-muted/20 space-y-4" data-testid="type-filter">
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
                            data-testid={`type-${type}`}
                          />
                          <Label htmlFor={`type-${type}`} className="text-sm cursor-pointer">
                            {type} ({allMemories.filter(m => m.type === type).length})
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
                            {agent === 'unknown' ? 'Anonymous' : agent} ({allMemories.filter(m => (m.agent_id || 'unknown') === agent).length})
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
                            {tag} ({allMemories.filter(m => m.tags?.includes(tag)).length})
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
                    {filteredAndSortedMemories.length} of {allMemories.length} memories
                    {(selectedTypes.length > 0 || selectedAgents.length > 0 || selectedTags.length > 0) && ' (filtered)'}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={clearFilters}
                    disabled={selectedTypes.length === 0 && selectedAgents.length === 0 && selectedTags.length === 0}
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
            <div className="flex items-center gap-4">
              <CardTitle>
                Memories ({filteredAndSortedMemories.length}
                {filteredAndSortedMemories.length !== allMemories.length && ` of ${allMemories.length} loaded`})
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Page size:</span>
                <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(parseInt(value))}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
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
          <div className="h-[600px] overflow-y-auto pr-2">
            {isLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />
                <p className="text-muted-foreground">Loading memories...</p>
              </div>
            ) : filteredAndSortedMemories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {allMemories.length === 0 
                  ? "No memories found. Try adjusting your search criteria." 
                  : "No memories match your filters. Try adjusting your criteria."}
              </div>
            ) : (
              <>
                <div className="space-y-4">
                {filteredAndSortedMemories.map((memory) => (
                  <div
                    key={memory.id}
                    className="p-4 border rounded-lg hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/memory/${memory.id}`)}
                    data-testid="memory-item"
                    data-memory-id={memory.id}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className="flex-shrink-0 mt-1">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${getMemoryTypeColor(memory.type)} text-white`}>
                            {(() => {
                              const IconComponent = getMemoryTypeIcon(memory.type)
                              return <IconComponent className="h-4 w-4" />
                            })()}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span 
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getMemoryTypeColor(memory.type)} text-white`}
                              data-testid="memory-type"
                            >
                              {memory.type}
                            </span>
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
                      </div>
                      <div className="text-xs text-muted-foreground text-right flex-shrink-0 ml-4">
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
              
              {/* Intersection Observer Target for Auto-Loading */}
              <div 
                ref={loadMoreRef}
                className="flex justify-center mt-6"
              >
                {hasNextPage && (
                  <Button 
                    onClick={handleLoadMore}
                    disabled={isFetchingNextPage}
                    variant="outline"
                    className="min-h-[40px]"
                  >
                    {isFetchingNextPage ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading more...
                      </>
                    ) : (
                      'Load More Memories'
                    )}
                  </Button>
                )}
                
                {isFetching && !isFetchingNextPage && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </div>
            </>
          )}
          </div>
        </CardContent>
      </Card>
      
      {/* Add Memory Dialog */}
      <AddMemoryDialog
        isOpen={showAddMemory}
        onClose={() => setShowAddMemory(false)}
        onMemoryAdded={() => {
          setShowAddMemory(false)
          refetch() // Refresh the list
        }}
      />
    </div>
  )
}