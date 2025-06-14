'use client'

import { useState, useEffect } from 'react'
import { DashboardNavigation } from '@/components/dashboard-navigation'
import { Database } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Check server status
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/memory/health')
        if (response.ok) {
          setIsConnected(true)
        } else {
          setIsConnected(false)
        }
      } catch (error) {
        setIsConnected(false)
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 5000) // Check every 5 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <DashboardNavigation />
      
      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {!isConnected ? (
          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-semibold flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <span>Server Connection</span>
            </h3>
            <p className="text-muted-foreground mt-2 mb-4">
              Unable to connect to MCP Memory Server at localhost:4100
            </p>
            <p className="text-sm text-muted-foreground">
              Please ensure the memory server is running and accessible.
            </p>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  )
}