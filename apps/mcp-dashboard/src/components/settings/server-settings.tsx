'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useServerStore } from '@/store/server-store'
import { Settings, X } from 'lucide-react'

export function ServerSettings() {
  const [isOpen, setIsOpen] = useState(false)
  const { connectionConfig, updateConnectionConfig } = useServerStore()
  const [formData, setFormData] = useState(connectionConfig)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateConnectionConfig(formData)
    setIsOpen(false)
  }

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="rounded-full"
      >
        <Settings className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Connection Settings</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Server URL</label>
              <input
                type="url"
                required
                className="w-full p-2 border rounded-md"
                value={formData.serverUrl}
                onChange={(e) => setFormData({ ...formData, serverUrl: e.target.value })}
                placeholder="http://localhost:3000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">API Key (Optional)</label>
              <input
                type="password"
                className="w-full p-2 border rounded-md"
                value={formData.apiKey || ''}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder="Your API key"
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
                <label className="block text-sm font-medium mb-1">Reconnect Attempts</label>
                <input
                  type="number"
                  className="w-full p-2 border rounded-md"
                  value={formData.reconnectAttempts}
                  onChange={(e) => setFormData({ ...formData, reconnectAttempts: Number(e.target.value) })}
                  min="0"
                  max="10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Reconnect Interval (ms)</label>
              <input
                type="number"
                className="w-full p-2 border rounded-md"
                value={formData.reconnectInterval}
                onChange={(e) => setFormData({ ...formData, reconnectInterval: Number(e.target.value) })}
                min="1000"
                max="30000"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1">
                Save Settings
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}