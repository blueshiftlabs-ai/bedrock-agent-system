import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, ExternalLink, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
import { getMemoryTypeIcon, getMemoryTypeColor } from '@/lib/memory-utils'
import Link from 'next/link'

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

// Server component that fetches recent memories
async function getRecentMemories(): Promise<Memory[]> {
  const baseUrl = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3101' 
    : process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3101'
  
  try {
    const response = await fetch(`${baseUrl}/api/memory/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'retrieve-memories',
          arguments: {
            limit: 10,
            offset: 0
          }
        }
      }),
      cache: 'no-store', // Always fresh data for recent activity
    })

    if (!response.ok) {
      console.error('Failed to fetch memories:', response.status)
      return []
    }

    const data = await response.json()
    const memories = JSON.parse(data.result?.content?.[0]?.text || '{}')
    return memories.memories || []
  } catch (error) {
    console.error('Error fetching recent memories:', error)
    return []
  }
}

export default async function RecentMemoryActivityAsync() {
  const memories = await getRecentMemories()

  return (
    <Card id="recent-activity-section">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Recent Memory Activity</span>
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({memories.length} recent)
              </span>
            </CardTitle>
            <CardDescription className="mt-2">
              Latest memory operations with content previews.{' '}
              <Link 
                href="/memories"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Visit memories page <ExternalLink className="h-3 w-3" />
              </Link>
              {' '}for comprehensive memory management with filtering, sorting, and unlimited browsing.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {memories.length > 0 ? (
            <div className="h-[500px] overflow-y-auto pr-2 space-y-3">
              {memories.map((memory, index) => (
                <Link key={memory.id} href={`/memory/${memory.id}`}>
                  <div 
                    className="group p-4 border rounded-lg hover:shadow-md hover:border-primary/50 transition-all duration-200 cursor-pointer bg-gradient-to-r from-background to-muted/20 hover:scale-[1.01] transform opacity-0 animate-[fadeInUp_0.4s_ease-out_forwards]"
                    data-testid="memory-activity-item"
                    style={{
                      animationDelay: `${index * 50}ms`,
                    }}
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
                            {memory.content ? memory.content.split('\n')[0].slice(0, 80) : 'No content'}
                            {memory.content && memory.content.split('\n')[0].length > 80 ? '...' : ''}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {memory.content ? memory.content.slice(0, 120) : 'No content available'}
                            {memory.content && memory.content.length > 120 ? '...' : ''}
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
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No recent memory activity</p>
              <Link 
                href="/memories"
                className="text-primary hover:underline text-sm mt-2 inline-flex items-center gap-1"
              >
                Browse all memories <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}