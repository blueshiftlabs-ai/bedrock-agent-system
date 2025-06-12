'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { ScrollText, Download, Trash2, Search, Filter, Pause, Play } from 'lucide-react'
import { format } from 'date-fns'

interface LogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  context?: string
  stack?: string
  metadata?: Record<string, any>
}

const logLevelColors = {
  debug: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  warn: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
}

export function ServerLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [contextFilter, setContextFilter] = useState<string>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [maxLogs, setMaxLogs] = useState(1000)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Simulate real-time log streaming
  useEffect(() => {
    if (isPaused) return

    const mockLogStream = () => {
      const contexts = ['MCPToolsService', 'MemoryService', 'EmbeddingService', 'DynamoDBStorage', 'OpenSearchStorage', 'Neo4jGraph']
      const levels: LogEntry['level'][] = ['debug', 'info', 'warn', 'error']
      const messages = [
        'Processing store-memory request',
        'Memory stored successfully with ID: {memoryId}',
        'Embedding generated for content',
        'OpenSearch index updated',
        'Neo4j relationship created',
        'DynamoDB item stored',
        'Failed to connect to OpenSearch',
        'Memory retrieval completed in {duration}ms',
        'Connection pool exhausted',
        'Health check completed',
        'MCP tool called: {toolName}',
        'WebSocket connection established',
        'Cache miss for query: {query}',
        'Rate limit exceeded for agent: {agentId}',
        'Memory consolidation started',
        'Cleanup completed, removed {count} expired memories'
      ]

      const randomLog = (): LogEntry => {
        const level = levels[Math.floor(Math.random() * levels.length)]
        const context = contexts[Math.floor(Math.random() * contexts.length)]
        const message = messages[Math.floor(Math.random() * messages.length)]
        
        return {
          timestamp: new Date().toISOString(),
          level,
          message: message.replace(/\{(\w+)\}/g, () => Math.random().toString(36).substr(2, 8)),
          context,
          metadata: level === 'error' ? { 
            stack: 'Error: Something went wrong\n    at function1 (file1.ts:123)\n    at function2 (file2.ts:456)',
            errorCode: 'ERR_' + Math.floor(Math.random() * 1000)
          } : undefined
        }
      }

      return randomLog()
    }

    const interval = setInterval(() => {
      if (!isPaused) {
        const newLog = mockLogStream()
        setLogs(prev => {
          const updated = [...prev, newLog]
          return updated.slice(-maxLogs) // Keep only the last maxLogs entries
        })
      }
    }, Math.random() * 2000 + 500) // Random interval between 500ms-2.5s

    setIsConnected(true)

    return () => {
      clearInterval(interval)
      setIsConnected(false)
    }
  }, [isPaused, maxLogs])

  // Filter logs based on search and filters
  useEffect(() => {
    let filtered = logs

    if (searchQuery) {
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.context?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (levelFilter !== 'all') {
      filtered = filtered.filter(log => log.level === levelFilter)
    }

    if (contextFilter !== 'all') {
      filtered = filtered.filter(log => log.context === contextFilter)
    }

    setFilteredLogs(filtered)
  }, [logs, searchQuery, levelFilter, contextFilter])

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [filteredLogs, autoScroll])

  const clearLogs = () => {
    setLogs([])
  }

  const downloadLogs = () => {
    const logText = filteredLogs.map(log => 
      `[${log.timestamp}] ${log.level.toUpperCase()} ${log.context || ''}: ${log.message}${
        log.stack ? '\n' + log.stack : ''
      }`
    ).join('\n')
    
    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `memory-server-logs-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getUniqueContexts = () => {
    const contexts = new Set(logs.map(log => log.context).filter(Boolean))
    return Array.from(contexts).sort()
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Server Logs
            <div className="flex items-center gap-2 ml-auto">
              <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-muted-foreground">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </CardTitle>
          <CardDescription>
            Real-time logs from the MCP Memory Server
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-2">
              <Label htmlFor="search-logs">Search Logs</Label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  id="search-logs"
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="level-filter">Level</Label>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="context-filter">Context</Label>
              <Select value={contextFilter} onValueChange={setContextFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contexts</SelectItem>
                  {getUniqueContexts().map(context => (
                    <SelectItem key={context} value={context}>
                      {context}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="max-logs">Max Logs</Label>
              <Select value={maxLogs.toString()} onValueChange={(value) => setMaxLogs(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                  <SelectItem value="1000">1000</SelectItem>
                  <SelectItem value="2000">2000</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPaused(!isPaused)}
              >
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="sm" onClick={downloadLogs}>
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={clearLogs}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="auto-scroll"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
              />
              <Label htmlFor="auto-scroll">Auto-scroll</Label>
            </div>
            <div className="text-sm text-muted-foreground">
              Showing {filteredLogs.length} of {logs.length} logs
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Display */}
      <Card>
        <CardHeader>
          <CardTitle>Log Stream</CardTitle>
        </CardHeader>
        <CardContent>
          <div 
            ref={containerRef}
            className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm overflow-auto"
            style={{ height: '600px' }}
          >
            {filteredLogs.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                {logs.length === 0 ? 'No logs yet...' : 'No logs match your filters'}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredLogs.map((log, index) => (
                  <div key={index} className="group hover:bg-gray-900 p-1 rounded">
                    <div className="flex items-start gap-3">
                      <span className="text-gray-400 shrink-0">
                        {format(new Date(log.timestamp), 'HH:mm:ss.SSS')}
                      </span>
                      <Badge 
                        className={`shrink-0 ${logLevelColors[log.level]} text-xs`}
                        variant="secondary"
                      >
                        {log.level.toUpperCase()}
                      </Badge>
                      {log.context && (
                        <span className="text-blue-400 shrink-0">
                          [{log.context}]
                        </span>
                      )}
                      <span className="flex-1 break-words">
                        {log.message}
                      </span>
                    </div>
                    {log.stack && (
                      <div className="mt-1 ml-20 text-red-400 text-xs whitespace-pre-wrap">
                        {log.stack}
                      </div>
                    )}
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="mt-1 ml-20 text-yellow-400 text-xs">
                        {JSON.stringify(log.metadata, null, 2)}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Log Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(['debug', 'info', 'warn', 'error'] as const).map(level => {
          const count = logs.filter(log => log.level === level).length
          return (
            <Card key={level}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <Badge className={logLevelColors[level]} variant="secondary">
                    {level.toUpperCase()}
                  </Badge>
                  <span className="text-2xl font-bold">{count}</span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}