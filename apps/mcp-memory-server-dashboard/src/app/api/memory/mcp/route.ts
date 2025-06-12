import { NextRequest, NextResponse } from 'next/server'

const MEMORY_SERVER_URL = process.env.MEMORY_SERVER_URL || 'http://localhost:4100'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Forward the request to the memory server
    const response = await fetch(`${MEMORY_SERVER_URL}/memory/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Memory server request failed', status: response.status },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('API route error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // Health check endpoint
    const response = await fetch(`${MEMORY_SERVER_URL}/memory/health`)
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Memory server health check failed', status: response.status },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json(
      { error: 'Memory server unavailable' },
      { status: 503 }
    )
  }
}