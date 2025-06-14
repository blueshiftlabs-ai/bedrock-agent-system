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

export function getMemoryTypeColor(type: string) {
  switch (type) {
    case 'episodic':
      return 'bg-blue-500'
    case 'semantic':
      return 'bg-green-500'
    case 'procedural':
      return 'bg-yellow-500'
    case 'working':
      return 'bg-purple-500'
    default:
      return 'bg-gray-500'
  }
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