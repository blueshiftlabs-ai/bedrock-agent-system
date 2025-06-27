import { NextRequest, NextResponse } from 'next/server'

const MEMORY_SERVER_URL = process.env.MEMORY_SERVER_URL || 'http://localhost:4100'

export async function POST(request: NextRequest) {
  try {
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError)
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }
    
    if (!body) {
      return NextResponse.json(
        { error: 'Request body is required' },
        { status: 400 }
      )
    }
    
    // Forward the request to the memory server with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
    
    let response
    try {
      response = await fetch(`${MEMORY_SERVER_URL}/memory/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Memory server error:', response.status, errorText)
      return NextResponse.json(
        { error: 'Memory server request failed', status: response.status, details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('API route error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
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