'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useChat } from 'ai/react'
import { Bot, Send, Loader, Trash2 } from 'lucide-react'

export function AIAssistant() {
  const [mode, setMode] = useState<'chat' | 'analysis' | 'workflow'>('chat')
  
  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages } = useChat({
    api: '/api/ai/chat',
    initialMessages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Hello! I\'m your MCP Dashboard AI Assistant. I can help you with:\n\n• Analyzing system performance and logs\n• Creating and optimizing workflows\n• Understanding process metrics\n• Troubleshooting issues\n• Natural language queries about your system\n\nHow can I assist you today?'
      }
    ]
  })

  const modes = [
    { id: 'chat', label: 'General Chat', description: 'Ask questions about your system' },
    { id: 'analysis', label: 'Log Analysis', description: 'AI-powered log analysis' },
    { id: 'workflow', label: 'Workflow Creation', description: 'AI-assisted workflow building' },
  ]

  const exampleQueries = {
    chat: [
      'What processes are consuming the most memory?',
      'Show me the overall system health',
      'How many workflows are currently running?',
    ],
    analysis: [
      'Analyze recent error logs for patterns',
      'Find performance bottlenecks in the logs',
      'Summarize the last hour of system activity',
    ],
    workflow: [
      'Create a workflow for code analysis',
      'Build a database migration workflow',
      'Design a monitoring workflow for errors',
    ]
  }

  const clearChat = () => {
    setMessages([])
  }

  const handleExampleQuery = (query: string) => {
    handleInputChange({ target: { value: query } } as any)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">AI Assistant</h1>
        <Button variant="outline" onClick={clearChat}>
          <Trash2 className="h-4 w-4 mr-2" />
          Clear Chat
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assistant Modes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {modes.map((modeOption) => (
                  <button
                    key={modeOption.id}
                    className={`w-full text-left p-3 rounded-md border transition-colors ${
                      mode === modeOption.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => setMode(modeOption.id as any)}
                  >
                    <div className="font-medium text-sm">{modeOption.label}</div>
                    <div className="text-xs opacity-80">{modeOption.description}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Example Queries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {exampleQueries[mode].map((query, index) => (
                  <button
                    key={index}
                    className="w-full text-left p-2 text-sm rounded border hover:bg-muted transition-colors"
                    onClick={() => handleExampleQuery(query)}
                  >
                    {query}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                AI Assistant - {modes.find(m => m.id === mode)?.label}
              </CardTitle>
            </CardHeader>
            
            <CardContent className="flex-1 p-0 flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="text-sm whitespace-pre-wrap">
                        {message.content}
                      </div>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted p-3 rounded-lg">
                      <Loader className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t p-4">
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <input
                    value={input}
                    onChange={handleInputChange}
                    placeholder={`Ask about ${modes.find(m => m.id === mode)?.label.toLowerCase()}...`}
                    className="flex-1 p-2 border rounded-md"
                    disabled={isLoading}
                  />
                  <Button type="submit" disabled={isLoading || !input.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}