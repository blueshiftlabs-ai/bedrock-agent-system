'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { WebSocketMessage } from '@/types'
import { useServerStore } from '@/store/server-store'

interface WebSocketContextType {
  socket: Socket | null
  connected: boolean
  subscribe: (event: string, callback: (data: any) => void) => void
  unsubscribe: (event: string, callback: (data: any) => void) => void
  emit: (event: string, data: any) => void
}

const WebSocketContext = createContext<WebSocketContextType | null>(null)

export function useWebSocket() {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}

interface WebSocketProviderProps {
  children: React.ReactNode
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const { currentServer } = useServerStore()

  useEffect(() => {
    if (!currentServer?.url) return

    // Create socket connection
    const socketInstance = io(currentServer.url, {
      transports: ['websocket'],
      timeout: 20000,
      autoConnect: true,
    })

    socketInstance.on('connect', () => {
      console.log('WebSocket connected')
      setConnected(true)
    })

    socketInstance.on('disconnect', () => {
      console.log('WebSocket disconnected')
      setConnected(false)
    })

    socketInstance.on('error', (error) => {
      console.error('WebSocket error:', error)
    })

    setSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
      setSocket(null)
      setConnected(false)
    }
  }, [currentServer?.url])

  const subscribe = useCallback((event: string, callback: (data: any) => void) => {
    if (socket) {
      socket.on(event, callback)
    }
  }, [socket])

  const unsubscribe = useCallback((event: string, callback: (data: any) => void) => {
    if (socket) {
      socket.off(event, callback)
    }
  }, [socket])

  const emit = useCallback((event: string, data: any) => {
    if (socket && connected) {
      socket.emit(event, data)
    }
  }, [socket, connected])

  const value: WebSocketContextType = {
    socket,
    connected,
    subscribe,
    unsubscribe,
    emit,
  }

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  )
}