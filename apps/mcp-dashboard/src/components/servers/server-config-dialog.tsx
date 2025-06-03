'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useServerStore } from '@/store/server-store'
import { MCPServer, MCPServerConfig } from '@/types'

interface ServerConfigDialogProps {
  server: MCPServer
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ServerConfigDialog({ server, open, onOpenChange }: ServerConfigDialogProps) {
  const { updateServer } = useServerStore()
  const [formData, setFormData] = useState({
    name: server.name,
    url: server.url,
    protocol: server.config.protocol,
    authToken: server.config.authToken || '',
    timeout: server.config.timeout,
    retryAttempts: server.config.retryAttempts,
    healthCheckInterval: server.config.healthCheckInterval,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const config: MCPServerConfig = {
      host: new URL(formData.url).hostname,
      port: Number(new URL(formData.url).port) || (formData.protocol === 'https' ? 443 : 80),
      protocol: formData.protocol,
      authToken: formData.authToken || undefined,
      timeout: formData.timeout,
      retryAttempts: formData.retryAttempts,
      healthCheckInterval: formData.healthCheckInterval,
    }

    updateServer(server.id, {
      name: formData.name,
      url: formData.url,
      config,
    })

    onOpenChange(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Configure Server: {server.name}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Server Name</label>
            <input
              type="text"
              required
              className="w-full p-2 border rounded-md"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Server URL</label>
            <input
              type="url"
              required
              className="w-full p-2 border rounded-md"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Protocol</label>
            <select
              className="w-full p-2 border rounded-md"
              value={formData.protocol}
              onChange={(e) => setFormData({ ...formData, protocol: e.target.value as any })}
            >
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
              <option value="ws">WebSocket</option>
              <option value="wss">Secure WebSocket</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Auth Token</label>
            <input
              type="password"
              className="w-full p-2 border rounded-md"
              value={formData.authToken}
              onChange={(e) => setFormData({ ...formData, authToken: e.target.value })}
              placeholder="Bearer token or API key"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium mb-1">Timeout (ms)</label>
              <input
                type="number"
                className="w-full p-2 border rounded-md"
                value={formData.timeout}
                onChange={(e) => setFormData({ ...formData, timeout: Number(e.target.value) })}
                min="1000"
                max="60000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Retry Attempts</label>
              <input
                type="number"
                className="w-full p-2 border rounded-md"
                value={formData.retryAttempts}
                onChange={(e) => setFormData({ ...formData, retryAttempts: Number(e.target.value) })}
                min="0"
                max="10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Health Check Interval (ms)</label>
            <input
              type="number"
              className="w-full p-2 border rounded-md"
              value={formData.healthCheckInterval}
              onChange={(e) => setFormData({ ...formData, healthCheckInterval: Number(e.target.value) })}
              min="5000"
              max="300000"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              Save Changes
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}