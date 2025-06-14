'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { X, Save, Plus, Hash } from 'lucide-react'

interface AddMemoryDialogProps {
  isOpen: boolean
  onClose: () => void
  onMemoryAdded?: () => void
}

export function AddMemoryDialog({ isOpen, onClose, onMemoryAdded }: AddMemoryDialogProps) {
  const [content, setContent] = useState('')
  const [type, setType] = useState<string>('episodic')
  const [project, setProject] = useState('bedrock-agent-system')
  const [agentId, setAgentId] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [saving, setSaving] = useState(false)

  const memoryTypes = [
    { value: 'episodic', label: 'Episodic (Events & Conversations)' },
    { value: 'semantic', label: 'Semantic (Facts & Concepts)' },
    { value: 'procedural', label: 'Procedural (How-to & Processes)' },
    { value: 'working', label: 'Working (Temporary)' }
  ]

  const handleAddTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag])
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const handleSave = async () => {
    if (!content.trim()) return

    setSaving(true)
    try {
      const response = await fetch('/api/memory/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: 'store-memory',
            arguments: {
              content: content.trim(),
              type,
              project,
              agent_id: agentId || undefined,
              tags: tags.length > 0 ? tags : undefined
            }
          }
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.result) {
          // Reset form
          setContent('')
          setType('episodic')
          setProject('bedrock-agent-system')
          setAgentId('')
          setTags([])
          setNewTag('')
          
          onMemoryAdded?.()
          onClose()
        } else {
          console.error('Failed to store memory:', data.error)
        }
      }
    } catch (error) {
      console.error('Failed to store memory:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    // Reset form
    setContent('')
    setType('episodic')
    setProject('bedrock-agent-system')
    setAgentId('')
    setTags([])
    setNewTag('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Add New Memory</CardTitle>
              <CardDescription>
                Store a new memory in the system with metadata and tags
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content">Content *</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter the memory content..."
              className="min-h-[120px]"
              required
            />
          </div>

          {/* Memory Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Memory Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {memoryTypes.map((memType) => (
                  <SelectItem key={memType.value} value={memType.value}>
                    {memType.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Project */}
          <div className="space-y-2">
            <Label htmlFor="project">Project</Label>
            <Input
              id="project"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              placeholder="Project context"
            />
          </div>

          {/* Agent ID */}
          <div className="space-y-2">
            <Label htmlFor="agentId">Agent ID (Optional)</Label>
            <Input
              id="agentId"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              placeholder="Leave empty for automatic agent detection"
            />
            <p className="text-xs text-muted-foreground">
              When using MCP tools, agents should automatically identify themselves
            </p>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  <Hash className="h-3 w-3" />
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="Add a tag..."
                className="flex-1"
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleAddTag}
                disabled={!newTag || tags.includes(newTag)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button 
              onClick={handleSave} 
              disabled={!content.trim() || saving}
              className="flex-1"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Memory'}
            </Button>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}