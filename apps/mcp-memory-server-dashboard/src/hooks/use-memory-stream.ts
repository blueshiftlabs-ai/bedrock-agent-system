'use client'

import { useEffect, useRef, useState } from 'react'

interface MemoryStreamEvent {
  type: 'connected' | 'memory_created' | 'memory_updated' | 'memory_deleted' | 'stats_updated' | 'heartbeat'
  memory_id?: string
  data?: any
  timestamp: string
  message?: string
}

interface MemoryStreamState {
  isConnected: boolean
  lastUpdate: MemoryStreamEvent | null
  error: string | null
  connectionTime: Date | null
}

export function useMemoryStream() {
  const [state, setState] = useState<MemoryStreamState>({
    isConnected: false,
    lastUpdate: null,
    error: null,
    connectionTime: null
  })
  
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5

  const connect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    try {
      const eventSource = new EventSource('/api/memory/stream')
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        setState(prev => ({
          ...prev,
          isConnected: true,
          error: null,
          connectionTime: new Date()
        }))
        reconnectAttemptsRef.current = 0
      }

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as MemoryStreamEvent
          
          setState(prev => ({
            ...prev,
            lastUpdate: data,
            error: null
          }))
          
          // Don't log heartbeats to reduce noise
          if (data.type !== 'heartbeat') {
            console.log('Memory stream event:', data)
          }
        } catch (error) {
          console.error('Failed to parse SSE message:', error)
        }
      }

      eventSource.onerror = (error) => {
        console.error('Memory stream error:', error)
        
        setState(prev => ({
          ...prev,
          isConnected: false,
          error: 'Connection error'
        }))

        eventSource.close()
        
        // Attempt to reconnect with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000)
          reconnectAttemptsRef.current++
          
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, delay)
        } else {
          setState(prev => ({
            ...prev,
            error: 'Max reconnection attempts reached'
          }))
        }
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to create EventSource: ${error}`
      }))
    }
  }

  const disconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    setState(prev => ({
      ...prev,
      isConnected: false,
      connectionTime: null
    }))
  }

  const forceReconnect = () => {
    reconnectAttemptsRef.current = 0
    connect()
  }

  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [])

  return {
    ...state,
    connect: forceReconnect,
    disconnect
  }
}