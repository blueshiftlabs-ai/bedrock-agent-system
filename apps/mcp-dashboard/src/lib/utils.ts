import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

export function formatDuration(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

export function formatPercentage(value: number, decimals = 1) {
  return `${value.toFixed(decimals)}%`
}

export function getStatusColor(status: string) {
  switch (status.toLowerCase()) {
    case 'running':
    case 'connected':
    case 'healthy':
    case 'active':
    case 'completed':
      return 'text-green-600 bg-green-100'
    case 'warning':
    case 'degraded':
    case 'paused':
      return 'text-yellow-600 bg-yellow-100'
    case 'error':
    case 'failed':
    case 'critical':
    case 'disconnected':
      return 'text-red-600 bg-red-100'
    case 'pending':
    case 'connecting':
    case 'starting':
      return 'text-blue-600 bg-blue-100'
    case 'stopped':
    case 'inactive':
    case 'offline':
      return 'text-gray-600 bg-gray-100'
    default:
      return 'text-gray-600 bg-gray-100'
  }
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func.apply(null, args), delay)
  }
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func.apply(null, args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

export function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export function parseLogLevel(level: string): 'debug' | 'info' | 'warn' | 'error' | 'fatal' {
  const normalizedLevel = level.toLowerCase()
  if (['debug', 'info', 'warn', 'error', 'fatal'].includes(normalizedLevel)) {
    return normalizedLevel as 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  }
  return 'info'
}