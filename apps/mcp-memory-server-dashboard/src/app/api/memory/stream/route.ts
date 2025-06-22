import { NextRequest } from 'next/server'

interface MemoryUpdate {
  type: 'memory_created' | 'memory_updated' | 'memory_deleted' | 'stats_updated'
  memory_id?: string
  data?: any
  timestamp: string
}

// Simple in-memory store for active connections
const connections = new Set<ReadableStreamDefaultController>()

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    start(controller) {
      // Add this connection to the set
      connections.add(controller)
      
      // Send initial connection message
      const connectionMessage = {
        type: 'connected',
        timestamp: new Date().toISOString(),
        message: 'Memory stream connected'
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(connectionMessage)}\n\n`))
      
      // Send periodic heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        if (!controller.desiredSize) {
          clearInterval(heartbeatInterval)
          return
        }
        
        const heartbeat = {
          type: 'heartbeat',
          timestamp: new Date().toISOString()
        }
        
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(heartbeat)}\n\n`))
        } catch (error) {
          clearInterval(heartbeatInterval)
          connections.delete(controller)
        }
      }, 30000) // 30 second heartbeat
      
      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval)
        connections.delete(controller)
        try {
          controller.close()
        } catch (error) {
          // Connection already closed
        }
      })
    }
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

// Function to broadcast memory updates to all connected clients
function broadcastMemoryUpdate(update: MemoryUpdate) {
  const encoder = new TextEncoder()
  const data = encoder.encode(`data: ${JSON.stringify(update)}\n\n`)
  
  // Send to all active connections
  for (const controller of connections) {
    try {
      if (controller.desiredSize !== null) {
        controller.enqueue(data)
      } else {
        // Connection is closed, remove it
        connections.delete(controller)
      }
    } catch (error) {
      // Connection error, remove it
      connections.delete(controller)
    }
  }
}

// POST endpoint to manually trigger updates (for testing or external systems)
export async function POST(request: NextRequest) {
  try {
    const update = await request.json() as MemoryUpdate
    update.timestamp = new Date().toISOString()
    
    broadcastMemoryUpdate(update)
    
    return Response.json({ 
      success: true, 
      message: 'Update broadcasted',
      connections: connections.size 
    })
  } catch (error) {
    return Response.json(
      { error: 'Invalid update format' }, 
      { status: 400 }
    )
  }
}