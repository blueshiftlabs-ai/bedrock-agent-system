import { Brain, FileText, MessageSquare, Cog } from 'lucide-react'

export function getMemoryTypeIcon(type: string) {
  switch (type) {
    case 'episodic':
      return MessageSquare
    case 'semantic':
      return Brain
    case 'procedural':
      return Cog
    case 'working':
      return FileText
    default:
      return FileText
  }
}

// Unified color system matching graph visualization
export const MEMORY_TYPE_COLORS = {
  episodic: '#3b82f6',   // Blue - events and experiences
  semantic: '#10b981',   // Green - facts and concepts  
  procedural: '#8b5cf6', // Purple - processes and how-to
  working: '#f59e0b'     // Amber - temporary/session data
} as const

export function getMemoryTypeColor(type: string) {
  switch (type) {
    case 'episodic':
      return 'bg-blue-500'
    case 'semantic':
      return 'bg-green-500'
    case 'procedural':
      return 'bg-purple-500'
    case 'working':
      return 'bg-amber-500'
    default:
      return 'bg-gray-500'
  }
}

export function getMemoryTypeHexColor(type: string): string {
  return MEMORY_TYPE_COLORS[type as keyof typeof MEMORY_TYPE_COLORS] || '#6b7280'
}

export function getMemoryTypeColorClass(type: string, variant: 'background' | 'text' | 'border' = 'background') {
  const baseColors = {
    episodic: 'blue',
    semantic: 'green', 
    procedural: 'yellow',
    working: 'purple',
    default: 'gray'
  }
  
  const color = baseColors[type as keyof typeof baseColors] || baseColors.default
  
  switch (variant) {
    case 'background':
      return `bg-${color}-500`
    case 'text':
      return `text-${color}-500`
    case 'border':
      return `border-${color}-500`
    default:
      return `bg-${color}-500`
  }
}

export function getMemoryTypeName(type: string) {
  switch (type) {
    case 'episodic':
      return 'Episodic'
    case 'semantic':
      return 'Semantic'
    case 'procedural':
      return 'Procedural'
    case 'working':
      return 'Working'
    default:
      return 'Unknown'
  }
}