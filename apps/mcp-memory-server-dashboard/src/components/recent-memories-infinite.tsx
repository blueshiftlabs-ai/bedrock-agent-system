'use client'

import { useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useInfiniteMemories } from '@/lib/queries'
import { useIntersectionObserver } from '@/hooks/use-intersection-observer'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Brain, Calendar, Hash, TrendingUp, Loader2 } from 'lucide-react'
import { format } from 'date-fns'

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

export function RecentMemoriesInfinite() {
  const router = useRouter()
  const loadMoreRef = useRef<HTMLDivElement>(null)
  
  // Use infinite query for all memories (no search filter)
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteMemories('')

  // Flatten all pages into a single array
  const allMemories = data?.pages.flatMap(page => page.memories) || []

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Set up intersection observer for automatic loading
  useIntersectionObserver({
    target: loadMoreRef,
    onIntersect: handleLoadMore,
    enabled: hasNextPage && !isFetchingNextPage,
    rootMargin: '100px',
  })

  const getMemoryTypeColor = (type: string) => {
    switch (type) {
      case 'episodic':
        return 'bg-blue-500'
      case 'semantic':
        return 'bg-green-500'
      case 'procedural':
        return 'bg-yellow-500'
      case 'working':
        return 'bg-purple-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Recent Memories
        </CardTitle>
        <CardDescription>
          Latest memory activity with infinite scrolling
        </CardDescription>
      </CardHeader>
      <CardContent className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground">Loading memories...</p>
          </div>
        ) : allMemories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No memories found</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {allMemories.map((memory) => (
                <div
                  key={memory.id}
                  className="p-3 border rounded-lg hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/memory/${memory.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`h-2 w-2 rounded-full ${getMemoryTypeColor(memory.type)}`} />
                        <Badge variant="secondary" className="text-xs">
                          {memory.type}
                        </Badge>
                        {memory.agent_id && (
                          <span className="text-xs text-muted-foreground">
                            by {memory.agent_id === 'unknown' ? 'Anonymous' : memory.agent_id}
                          </span>
                        )}
                      </div>
                      <p className="text-sm mb-1 line-clamp-2">
                        {memory.content}
                      </p>
                      {memory.tags && memory.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {memory.tags.slice(0, 3).map((tag, index) => (
                            <Badge 
                              key={`${memory.id}-${index}`} 
                              variant="outline" 
                              className="text-xs"
                            >
                              <Hash className="h-2 w-2 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                          {memory.tags.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{memory.tags.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground text-right ml-3">
                      {memory.created_at && (
                        <>
                          <Calendar className="h-3 w-3 inline mr-1" />
                          {format(new Date(memory.created_at), 'MMM d')}
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
              className="flex justify-center mt-4"
            >
              {hasNextPage && isFetchingNextPage && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading more memories...
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}