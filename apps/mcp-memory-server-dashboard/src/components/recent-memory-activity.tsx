'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useInfiniteMemories } from '@/lib/queries'
import { useIntersectionObserver } from '@/hooks/use-intersection-observer'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TrendingUp, Loader2, ExternalLink, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
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

export function RecentMemoryActivity() {
  const router = useRouter()
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const [displayLimit, setDisplayLimit] = useState(10)
  const maxLimit = 200 // Hard limit for overview page

  // Use infinite query with a smaller page size for overview
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteMemories('', 20)

  // Flatten all pages and limit for display
  const allMemories = data?.pages.flatMap(page => page.memories) || []
  const displayedMemories = allMemories.slice(0, Math.min(displayLimit, maxLimit))
  const canLoadMore = displayedMemories.length < Math.min(allMemories.length, maxLimit)
  const canFetchMore = hasNextPage && allMemories.length < maxLimit

  const handleLoadMore = useCallback(() => {
    // First, try to show more from already loaded memories
    if (canLoadMore && !canFetchMore) {
      setDisplayLimit(prev => Math.min(prev + 20, allMemories.length, maxLimit))
    }
    // Then fetch more if needed and under limit
    else if (canFetchMore && !isFetchingNextPage && !isLoading) {
      fetchNextPage()
    }
  }, [canLoadMore, canFetchMore, isFetchingNextPage, isLoading, fetchNextPage, allMemories.length])

  // Set up intersection observer for automatic loading
  useIntersectionObserver({
    target: loadMoreRef,
    onIntersect: handleLoadMore,
    enabled: (canLoadMore || canFetchMore) && !isFetchingNextPage && !isLoading,
    rootMargin: '100px',
    threshold: 0.1,
  })

  const showLoadMoreButton = canLoadMore || canFetchMore

  if (isLoading) {
    return (
      <Card id="recent-activity-section">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Recent Memory Activity</span>
          </CardTitle>
          <CardDescription>Latest memory operations with content previews</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading memories...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card id="recent-activity-section">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Recent Memory Activity</span>
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({displayedMemories.length}{allMemories.length > displayedMemories.length ? ` of ${Math.min(allMemories.length, maxLimit)}` : ''})
              </span>
            </CardTitle>
            <CardDescription className="mt-2">
              Latest memory operations with content previews.{' '}
              <button 
                onClick={() => router.push('/memories')}
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Visit memories page <ExternalLink className="h-3 w-3" />
              </button>
              {' '}for comprehensive memory management with filtering, sorting, and unlimited browsing.
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Show:</span>
            <Select 
              value={displayLimit.toString()} 
              onValueChange={(value) => {
                const newLimit = Math.min(parseInt(value), maxLimit);
                setDisplayLimit(newLimit);
                // If we need more memories and don't have enough loaded, fetch more
                if (newLimit > allMemories.length && hasNextPage) {
                  fetchNextPage();
                }
              }}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {displayedMemories.length > 0 ? (
            <>
              {displayedMemories.map((memory) => (
                <div 
                  key={memory.id}
                  className="group p-4 border rounded-lg hover:shadow-md transition-all duration-200 cursor-pointer bg-gradient-to-r from-background to-muted/20"
                  onClick={() => router.push(`/memory/${memory.id}`)}
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
                        <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                          {memory.content.split('\n')[0].slice(0, 80)}
                          {memory.content.split('\n')[0].length > 80 ? '...' : ''}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {memory.content.slice(0, 120)}
                          {memory.content.length > 120 ? '...' : ''}
                        </p>
                        <div className="flex items-center space-x-2 mt-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getMemoryTypeColor(memory.type)} text-white`}>
                            {memory.type}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            by {memory.agent_id || 'Anonymous'}
                          </span>
                          {memory.project && (
                            <span className="text-xs text-muted-foreground">
                              • {memory.project}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground text-right flex-shrink-0 ml-4">
                      {memory.created_at && (
                        <>
                          {format(new Date(memory.created_at), 'MMM d')}
                          <br />
                          {format(new Date(memory.created_at), 'HH:mm')}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Load More Section */}
              {showLoadMoreButton && (
                <div 
                  ref={loadMoreRef}
                  className="flex flex-col items-center gap-3 pt-4"
                >
                  <Button 
                    onClick={handleLoadMore}
                    disabled={isFetchingNextPage}
                    variant="outline"
                    size="sm"
                  >
                    {isFetchingNextPage ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading more...
                      </>
                    ) : (
                      <>
                        Load More
                        {allMemories.length >= maxLimit && ' (Max 200)'}
                      </>
                    )}
                  </Button>
                  
                  {allMemories.length >= maxLimit && (
                    <p className="text-xs text-muted-foreground text-center">
                      Showing maximum {maxLimit} memories.{' '}
                      <button 
                        onClick={() => router.push('/memories')}
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Visit memories page <ArrowRight className="h-3 w-3" />
                      </button>
                      {' '}for unlimited browsing.
                    </p>
                  )}
                </div>
              )}
              
              {isFetching && !isFetchingNextPage && (
                <div className="flex justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No recent memory activity</p>
              <button 
                onClick={() => router.push('/memories')}
                className="text-primary hover:underline text-sm mt-2 inline-flex items-center gap-1"
              >
                Browse all memories <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}