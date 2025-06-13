'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Brain, Search, Plus } from 'lucide-react'

interface Memory {
  id: string
  content: string
  type: string
  project: string
  timestamp?: string
  created_at?: string
  tags?: string[]
}

export function MemoryBrowserSimple() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')

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
            <Button variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Memory
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>Search Results ({memories.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Searching memories...
            </div>
          ) : memories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No memories found. Try adjusting your search criteria.
            </div>
          ) : (
            <div className="space-y-4">
              {memories.map((memory) => (
                <div
                  key={memory.id}
                  className="p-4 border rounded-lg hover:border-primary/50 transition-colors"
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
                      </div>
                      <p className="text-sm mb-2 line-clamp-3">
                        {memory.content}
                      </p>
                      {memory.tags && memory.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {memory.tags.map((tag, index) => (
                            <Badge key={`${memory.id}-${index}`} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}