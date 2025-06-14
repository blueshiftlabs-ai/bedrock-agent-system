'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { 
  Brain, 
  Database, 
  Network, 
  Activity, 
  RefreshCw,
  Search,
  BarChart3,
  Settings,
  Users
} from 'lucide-react'

export function DashboardNavigation() {
  const pathname = usePathname()
  const [isConnected, setIsConnected] = useState(false)
  const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'loading'>('loading')

  useEffect(() => {
    // Check server status
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/memory/health')
        if (response.ok) {
          setServerStatus('online')
          setIsConnected(true)
        } else {
          setServerStatus('offline')
        }
      } catch (error) {
        setServerStatus('offline')
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 5000) // Check every 5 seconds

    return () => clearInterval(interval)
  }, [])

  const refreshDashboard = () => {
    window.location.reload()
  }

  const navItems = [
    { href: '/overview', label: 'Overview', icon: BarChart3 },
    { href: '/storage', label: 'Storage', icon: Database },
    { href: '/memories', label: 'Memories', icon: Search },
    { href: '/agents', label: 'Agents', icon: Users },
    { href: '/graph', label: 'Graph', icon: Network },
    { href: '/logs', label: 'Logs', icon: Activity },
    { href: '/admin', label: 'Admin', icon: Settings },
  ]

  return (
    <>
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Brain className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">MCP Memory Server Dashboard</h1>
                <p className="text-muted-foreground">
                  Real-time monitoring and management
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div 
                  className={`h-3 w-3 rounded-full ${
                    serverStatus === 'online' 
                      ? 'bg-green-500' 
                      : serverStatus === 'offline' 
                        ? 'bg-red-500' 
                        : 'bg-yellow-500'
                  }`}
                />
                <span className="text-sm font-medium">
                  {serverStatus === 'online' ? 'Connected' : 
                   serverStatus === 'offline' ? 'Disconnected' : 'Connecting...'}
                </span>
              </div>
              
              <Button variant="outline" size="sm" onClick={refreshDashboard}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b bg-background">
        <div className="container mx-auto px-4">
          <div className="flex space-x-8">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center space-x-2 py-4 px-3 border-b-2 transition-colors
                    ${isActive 
                      ? 'border-primary text-primary' 
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50'
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>
    </>
  )
}