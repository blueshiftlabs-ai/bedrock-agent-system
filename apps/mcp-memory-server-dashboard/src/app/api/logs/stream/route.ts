import { NextRequest } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { createReadStream, existsSync } from 'fs'
import { join } from 'path'
import { Readable } from 'stream'

const execAsync = promisify(exec)

interface LogSource {
  id: string
  name: string
  type: 'docker' | 'file' | 'process'
  container?: string
  file?: string
  command?: string
}

// Available log sources
const LOG_SOURCES: LogSource[] = [
  { id: 'memory-server', name: 'MCP Memory Server', type: 'docker', container: 'mcp-memory-server' },
  { id: 'opensearch', name: 'OpenSearch', type: 'docker', container: 'mcp-memory-opensearch' },
  { id: 'dynamodb', name: 'DynamoDB Local', type: 'docker', container: 'mcp-memory-dynamodb' },
  { id: 'neo4j', name: 'Neo4j', type: 'docker', container: 'mcp-memory-neo4j' },
  { id: 'gremlin', name: 'Gremlin Server', type: 'docker', container: 'mcp-memory-gremlin' },
]

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const sources = searchParams.get('sources')?.split(',') || []
  const tail = searchParams.get('tail') || '100'
  
  // Create a readable stream for SSE
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      controller.enqueue(encoder.encode('data: {"type":"connected","sources":' + JSON.stringify(sources) + '}\n\n'))
      
      // Function to send log entry
      const sendLog = (source: string, line: string, level: 'info' | 'error' | 'debug' | 'warn' = 'info') => {
        const logEntry = {
          type: 'log',
          source,
          timestamp: new Date().toISOString(),
          level,
          message: line.trim()
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(logEntry)}\n\n`))
      }
      
      // Set up log streams for each selected source
      const logStreams: any[] = []
      
      for (const sourceId of sources) {
        const source = LOG_SOURCES.find(s => s.id === sourceId)
        if (!source) continue
        
        if (source.type === 'docker') {
          // Stream Docker container logs
          try {
            const { stdout: containerCheck } = await execAsync(`docker ps --format "{{.Names}}" | grep "^${source.container}$" || echo "not found"`)
            
            if (containerCheck.trim() !== 'not found' && containerCheck.trim() !== '') {
              // Use docker logs with follow flag for real-time streaming
              const dockerLogsProcess = exec(`docker logs -f --tail ${tail} ${source.container} 2>&1`)
              
              dockerLogsProcess.stdout?.on('data', (data: Buffer) => {
                const lines = data.toString().split('\n').filter(line => line.trim())
                lines.forEach(line => {
                  // Parse log level from Docker logs
                  const level = line.includes('ERROR') ? 'error' : 
                               line.includes('WARN') ? 'warn' :
                               line.includes('DEBUG') ? 'debug' : 'info'
                  sendLog(source.name, line, level)
                })
              })
              
              dockerLogsProcess.stderr?.on('data', (data: Buffer) => {
                sendLog(source.name, data.toString(), 'error')
              })
              
              logStreams.push(dockerLogsProcess)
            } else {
              sendLog(source.name, `Container ${source.container} not found`, 'warn')
            }
          } catch (error) {
            sendLog(source.name, `Error accessing Docker logs: ${error}`, 'error')
          }
        } else if (source.type === 'file') {
          // Stream from log file
          if (source.file && existsSync(source.file)) {
            const tailProcess = exec(`tail -f -n ${tail} ${source.file}`)
            
            tailProcess.stdout?.on('data', (data: Buffer) => {
              const lines = data.toString().split('\n').filter(line => line.trim())
              lines.forEach(line => sendLog(source.name, line))
            })
            
            logStreams.push(tailProcess)
          }
        } else if (source.type === 'process') {
          // For process logs, we'll look for log files or use journalctl if available
          const logFile = `/tmp/mcp-memory-server.log`
          if (existsSync(logFile)) {
            const tailProcess = exec(`tail -f -n ${tail} ${logFile}`)
            
            tailProcess.stdout?.on('data', (data: Buffer) => {
              const lines = data.toString().split('\n').filter(line => line.trim())
              lines.forEach(line => {
                // Parse structured logs if they're JSON
                try {
                  const parsed = JSON.parse(line)
                  sendLog(source.name, parsed.message || line, parsed.level || 'info')
                } catch {
                  sendLog(source.name, line)
                }
              })
            })
            
            logStreams.push(tailProcess)
          } else {
            sendLog(source.name, 'Log file not found. Ensure the server is configured to write logs.', 'warn')
          }
        }
      }
      
      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        logStreams.forEach(process => {
          if (process.kill) process.kill()
        })
        controller.close()
      })
    }
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

// Endpoint to get available log sources
export async function POST(request: NextRequest) {
  const sources = []
  
  // Check which Docker containers are running
  for (const source of LOG_SOURCES) {
    if (source.type === 'docker' && source.container) {
      try {
        const { stdout } = await execAsync(`docker ps --format "{{.Names}}" | grep "^${source.container}$" > /dev/null 2>&1 && echo "running" || echo "stopped"`)
        sources.push({
          ...source,
          status: stdout.trim() === 'running' ? 'running' : 'stopped'
        })
      } catch {
        sources.push({ ...source, status: 'error' })
      }
    } else {
      sources.push({ ...source, status: 'available' })
    }
  }
  
  return Response.json({ sources })
}