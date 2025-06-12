'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { ScrollText, Download, Trash2, Search, Filter, Pause, Play, RefreshCw, Server } from 'lucide-react'
import { format } from 'date-fns'

interface LogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  source: string
  metadata?: Record<string, any>
}

interface LogSource {
  id: string
  name: string
  type: 'docker' | 'file' | 'process'
  status: 'running' | 'stopped' | 'available' | 'error'
}

const logLevelColors = {
  debug: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  warn: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
}

export function ServerLogsReal() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [selectedSources, setSelectedSources] = useState<string[]>(['memory-server'])
  const [availableSources, setAvailableSources] = useState<LogSource[]>([])
  const [autoScroll, setAutoScroll] = useState(true)
  const [maxLogs, setMaxLogs] = useState(1000)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Fetch available log sources
  useEffect(() => {
    const fetchSources = async () => {
      try {
        const response = await fetch('/api/logs/stream', { method: 'POST' })
        if (response.ok) {
          const data = await response.json()
          setAvailableSources(data.sources)
        }
      } catch (error) {
        console.error('Failed to fetch log sources:', error)
      }
    }
    
    fetchSources()
    const interval = setInterval(fetchSources, 10000) // Refresh every 10s
    
    return () => clearInterval(interval)
  }, [])

  // Connect to log stream
  useEffect(() => {
    if (isPaused || selectedSources.length === 0) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
        setIsConnected(false)
      }
      return
    }

    // Create SSE connection
    const params = new URLSearchParams({
      sources: selectedSources.join(','),
      tail: '100'
    })
    
    const eventSource = new EventSource(`/api/logs/stream?${params}`)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      setIsConnected(true)
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.type === 'log') {
          const logEntry: LogEntry = {
            timestamp: data.timestamp,
            level: data.level || 'info',
            message: data.message,
            source: data.source,
            metadata: data.metadata
          }
          
          setLogs(prev => {
            const updated = [...prev, logEntry]
            return updated.slice(-maxLogs)
          })
        }
      } catch (error) {
        console.error('Failed to parse log message:', error)
      }
    }

    eventSource.onerror = () => {
      setIsConnected(false)
      // Auto-reconnect after 5 seconds
      setTimeout(() => {
        if (!isPaused) {
          eventSource.close()
          // Component will re-establish connection via useEffect
        }
      }, 5000)
    }

    return () => {
      eventSource.close()
      eventSourceRef.current = null
      setIsConnected(false)
    }
  }, [isPaused, selectedSources, maxLogs])

  // Filter logs based on search and filters
  useEffect(() => {
    let filtered = logs

    if (searchQuery) {
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.source.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (levelFilter !== 'all') {
      filtered = filtered.filter(log => log.level === levelFilter)
    }

    if (sourceFilter !== 'all') {
      filtered = filtered.filter(log => log.source === sourceFilter)
    }

    setFilteredLogs(filtered)
  }, [logs, searchQuery, levelFilter, sourceFilter])

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
      `[${log.timestamp}] ${log.level.toUpperCase()} [${log.source}]: ${log.message}${
        log.metadata ? '\n' + JSON.stringify(log.metadata, null, 2) : ''
      }`
    ).join('\n')
    
    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `server-logs-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getUniqueSources = () => {
    const sources = new Set(logs.map(log => log.source))
    return Array.from(sources).sort()
  }

  const toggleSource = (sourceId: string) => {
    setSelectedSources(prev => 
      prev.includes(sourceId) 
        ? prev.filter(id => id !== sourceId)
        : [...prev, sourceId]
    )
  }

  return (
    <div className="space-y-6">
      {/* Source Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Log Sources
          </CardTitle>
          <CardDescription>
            Select which log sources to monitor
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {availableSources.map(source => (
              <div key={source.id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={`source-${source.id}`}
                  checked={selectedSources.includes(source.id)}
                  onChange={() => toggleSource(source.id)}
                  className="rounded"
                />
                <Label 
                  htmlFor={`source-${source.id}`}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <span>{source.name}</span>
                  <Badge 
                    variant={source.status === 'running' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {source.status}
                  </Badge>
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Log Stream
            <div className="flex items-center gap-2 ml-auto">
              <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-muted-foreground">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </CardTitle>
          <CardDescription>
            Real-time logs from selected sources
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
              <Label htmlFor="source-filter">Source</Label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {getUniqueSources().map(source => (
                    <SelectItem key={source} value={source}>
                      {source}
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
          <CardTitle>Logs</CardTitle>
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
                      <span className="text-blue-400 shrink-0">
                        [{log.source}]
                      </span>
                      <span className="flex-1 break-words">
                        {log.message}
                      </span>
                    </div>
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