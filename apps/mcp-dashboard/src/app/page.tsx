'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DashboardOverview } from '@/components/dashboard/dashboard-overview'
import { ProcessMonitoring } from '@/components/monitoring/process-monitoring'
import { MCPServerManagement } from '@/components/servers/mcp-server-management'
import { LogsViewer } from '@/components/logs/logs-viewer'
import { WorkflowManagement } from '@/components/workflows/workflow-management'
import { ToolRegistry } from '@/components/tools/tool-registry'
import { AIAssistant } from '@/components/ai/ai-assistant'
import { ServerSettings } from '@/components/settings/server-settings'
import { Activity, Server, ScrollText, Workflow, Wrench, Bot, Settings } from 'lucide-react'

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard')

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="flex h-16 items-center px-4">
          <h1 className="text-xl font-semibold">MCP Dashboard</h1>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Monitoring
          </TabsTrigger>
          <TabsTrigger value="servers" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            Servers
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="workflows" className="flex items-center gap-2">
            <Workflow className="h-4 w-4" />
            Workflows
          </TabsTrigger>
          <TabsTrigger value="tools" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Tools
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            AI Assistant
          </TabsTrigger>
        </TabsList>

        <div className="p-6">
          <TabsContent value="dashboard" className="space-y-4">
            <DashboardOverview />
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-4">
            <ProcessMonitoring />
          </TabsContent>

          <TabsContent value="servers" className="space-y-4">
            <MCPServerManagement />
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <LogsViewer />
          </TabsContent>

          <TabsContent value="workflows" className="space-y-4">
            <WorkflowManagement />
          </TabsContent>

          <TabsContent value="tools" className="space-y-4">
            <ToolRegistry />
          </TabsContent>

          <TabsContent value="ai" className="space-y-4">
            <AIAssistant />
          </TabsContent>
        </div>
      </Tabs>

      <div className="fixed bottom-4 right-4">
        <ServerSettings />
      </div>
    </div>
  )
}