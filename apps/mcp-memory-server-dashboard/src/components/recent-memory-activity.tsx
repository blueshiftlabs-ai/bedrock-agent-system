'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useInfiniteMemories } from '@/lib/queries'
import { useIntersectionObserver } from '@/hooks/use-intersection-observer'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TrendingUp, Loader2, ExternalLink, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
import { getMemoryTypeIcon, getMemoryTypeColor } from '@/lib/memory-utils'

// CSS animations for smooth card loading
const fadeInUpAnimation = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  [data-animate="fadeInUp"] {
    animation: fadeInUp 0.4s ease-out forwards;
  }
`

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

// Helper functions for localStorage persistence and intelligent defaulting
const STORAGE_KEY = 'recent-memory-activity-display-limit'
const SELECTOR_OPTIONS = [10, 25, 50, 100, 200]

function loadPersistedLimit(): number {
  if (typeof window === 'undefined') return 10
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = parseInt(saved, 10)
      return SELECTOR_OPTIONS.includes(parsed) ? parsed : 10
    }
  } catch (error) {
    console.warn('Failed to load persisted display limit:', error)
  }
  return 10
}

function persistLimit(limit: number): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, limit.toString())
  } catch (error) {
    console.warn('Failed to persist display limit:', error)
  }
}

function getNextHighestOption(currentCount: number): number {
  // Find the next highest option from selector
  const nextOption = SELECTOR_OPTIONS.find(option => option >= currentCount)
  return nextOption || SELECTOR_OPTIONS[SELECTOR_OPTIONS.length - 1]
}

export function RecentMemoryActivity() {
  const router = useRouter()
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const [displayLimit, setDisplayLimit] = useState(loadPersistedLimit)
  const [isChangingLimit, setIsChangingLimit] = useState(false)
  const [lastClickTime, setLastClickTime] = useState<number>(0)
  const [isNavigating, setIsNavigating] = useState<boolean>(false)
  const maxLimit = 200 // Hard limit for overview page

  // Use infinite query with smaller, card-optimized page size
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteMemories('', 15) // Smaller pages for smoother card loading

  // Flatten all pages and limit for display
  const allMemories = data?.pages.flatMap(page => page.memories) || []
  const displayedMemories = allMemories.slice(0, Math.min(displayLimit, maxLimit))
  const canLoadMore = displayedMemories.length < Math.min(allMemories.length, maxLimit)
  const canFetchMore = hasNextPage && allMemories.length < maxLimit

  // Enhanced count display logic
  const totalAvailable = data?.pages[0]?.total_count || allMemories.length
  const actuallyDisplayed = displayedMemories.length
  const loadedSoFar = allMemories.length
  const isLoadingMore = isFetching && loadedSoFar > 0

  // Intelligent selector defaulting
  useEffect(() => {
    if (!isLoading && allMemories.length > 0) {
      const currentDisplayed = displayedMemories.length
      const loadedCount = allMemories.length
      
      // If we have more loaded than displayed, suggest next highest option
      if (loadedCount > currentDisplayed && loadedCount > displayLimit) {
        const suggested = getNextHighestOption(loadedCount)
        if (suggested > displayLimit && suggested <= maxLimit) {
          // Don't auto-change, but this logic helps with the selector display
        }
      }
    }
  }, [allMemories.length, displayedMemories.length, displayLimit, isLoading])

  // Persist display limit changes
  useEffect(() => {
    persistLimit(displayLimit)
  }, [displayLimit])

  // Debounced click handler to prevent unwanted navigation
  const handleMemoryClick = useCallback((memoryId: string) => {
    const now = Date.now()
    if (now - lastClickTime < 300) {
      console.log('Memory click rate limited: too soon since last click')
      return
    }
    setLastClickTime(now)
    setIsNavigating(true)
    console.log(`Navigating to memory: ${memoryId}`)
    router.push(`/memory/${memoryId}`)
    setTimeout(() => setIsNavigating(false), 1000)
  }, [router, lastClickTime])

  const handleLoadMore = useCallback(() => {
    // First, try to show more from already loaded memories
    if (canLoadMore && !canFetchMore) {
      setDisplayLimit(prev => Math.min(prev + 15, allMemories.length, maxLimit)) // Smaller increments
    }
    // Then fetch more if needed and under limit
    else if (canFetchMore && !isFetchingNextPage && !isLoading) {
      fetchNextPage()
    }
  }, [canLoadMore, canFetchMore, isFetchingNextPage, isLoading, fetchNextPage, allMemories.length])

  // Enhanced intersection observer for smoother card-level loading
  useIntersectionObserver({
    target: loadMoreRef,
    onIntersect: handleLoadMore,
    enabled: (canLoadMore || canFetchMore) && !isFetchingNextPage && !isLoading && !isNavigating,
    rootMargin: '150px', // Increased for earlier loading
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
    <>
      <style jsx>{`${fadeInUpAnimation}`}</style>
      <Card id="recent-activity-section">
        <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Recent Memory Activity</span>
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({actuallyDisplayed}
                {loadedSoFar > actuallyDisplayed && ` of ${loadedSoFar}`}
                {hasNextPage && totalAvailable > loadedSoFar && ` (${totalAvailable} total)`}
                {isLoadingMore && ' (loading...)'}
                )
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
              disabled={isChangingLimit || isFetching}
              onValueChange={async (value) => {
                const newLimit = Math.min(parseInt(value), maxLimit);
                setDisplayLimit(newLimit);
                setIsChangingLimit(true);
                
                // Calculate how many more memories we need
                const currentCount = allMemories.length;
                if (newLimit > currentCount && hasNextPage) {
                  // Calculate pages needed (each page is 20 items)
                  const pagesNeeded = Math.ceil((newLimit - currentCount) / 20);
                  
                  // Fetch multiple pages if needed
                  for (let i = 0; i < pagesNeeded && hasNextPage; i++) {
                    await fetchNextPage();
                  }
                }
                
                setIsChangingLimit(false);
              }}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SELECTOR_OPTIONS.map(option => {
                  const isRecommended = loadedSoFar > displayLimit && 
                                      option === getNextHighestOption(loadedSoFar) && 
                                      option > displayLimit;
                  return (
                    <SelectItem key={option} value={option.toString()}>
                      {option}{isRecommended && " ★"}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {displayedMemories.length > 0 ? (
            <div className="h-[500px] overflow-y-auto pr-2 space-y-3">
              {displayedMemories.map((memory, index) => (
                <div 
                  key={memory.id}
                  className="group p-4 border rounded-lg hover:shadow-md hover:border-primary/50 transition-all duration-200 cursor-pointer bg-gradient-to-r from-background to-muted/20 hover:scale-[1.01] transform"
                  onClick={() => handleMemoryClick(memory.id)}
                  style={{
                    animationDelay: `${index * 50}ms`,
                  }}
                  data-animate="fadeInUp"
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
              
              {/* Loading skeleton cards for smooth infinite scroll */}
              {isFetchingNextPage && (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={`skeleton-${i}`} className="p-4 border rounded-lg bg-muted/30 animate-pulse">
                      <div className="flex items-start space-x-3">
                        <div className="h-8 w-8 rounded-full bg-muted/50 flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-muted/50 rounded w-3/4" />
                          <div className="h-3 bg-muted/50 rounded w-full" />
                          <div className="flex space-x-2">
                            <div className="h-5 bg-muted/50 rounded w-16" />
                            <div className="h-5 bg-muted/50 rounded w-20" />
                          </div>
                        </div>
                        <div className="h-8 w-16 bg-muted/50 rounded flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {isFetching && !isFetchingNextPage && (
                <div className="flex justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              )}
            </div>
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
    </>
  )
}