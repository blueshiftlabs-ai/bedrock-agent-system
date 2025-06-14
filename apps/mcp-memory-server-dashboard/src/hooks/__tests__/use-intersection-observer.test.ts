import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React, { useRef } from 'react'
import { useIntersectionObserver } from '../use-intersection-observer'

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
  constructor(public callback: IntersectionObserverCallback) {}
}

const mockIntersectionObserver = vi.fn()

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: mockIntersectionObserver,
})

describe('useIntersectionObserver', () => {
  let mockObserverInstance: MockIntersectionObserver

  beforeEach(() => {
    vi.clearAllMocks()
    mockObserverInstance = new MockIntersectionObserver(vi.fn())
    mockIntersectionObserver.mockImplementation((callback) => {
      mockObserverInstance.callback = callback
      return mockObserverInstance
    })
  })

  it('creates intersection observer when target is available', () => {
    const mockOnIntersect = vi.fn()
    const { result: targetRef } = renderHook(() => useRef<HTMLDivElement>(null))
    
    // Simulate having a target element
    const mockElement = document.createElement('div')
    targetRef.current.current = mockElement

    renderHook(() =>
      useIntersectionObserver({
        target: targetRef.current,
        onIntersect: mockOnIntersect,
        enabled: true,
      })
    )

    expect(mockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      {
        rootMargin: '0px',
        threshold: 0.1,
      }
    )
    expect(mockObserverInstance.observe).toHaveBeenCalledWith(mockElement)
  })

  it('does not create observer when target is null', () => {
    const mockOnIntersect = vi.fn()
    const { result: targetRef } = renderHook(() => useRef<HTMLDivElement>(null))

    renderHook(() =>
      useIntersectionObserver({
        target: targetRef.current,
        onIntersect: mockOnIntersect,
        enabled: true,
      })
    )

    expect(mockIntersectionObserver).not.toHaveBeenCalled()
  })

  it('does not create observer when disabled', () => {
    const mockOnIntersect = vi.fn()
    const { result: targetRef } = renderHook(() => useRef<HTMLDivElement>(null))
    
    const mockElement = document.createElement('div')
    targetRef.current.current = mockElement

    renderHook(() =>
      useIntersectionObserver({
        target: targetRef.current,
        onIntersect: mockOnIntersect,
        enabled: false,
      })
    )

    expect(mockIntersectionObserver).not.toHaveBeenCalled()
  })

  it('calls onIntersect when element intersects', () => {
    const mockOnIntersect = vi.fn()
    const { result: targetRef } = renderHook(() => useRef<HTMLDivElement>(null))
    
    const mockElement = document.createElement('div')
    targetRef.current.current = mockElement

    renderHook(() =>
      useIntersectionObserver({
        target: targetRef.current,
        onIntersect: mockOnIntersect,
        enabled: true,
      })
    )

    // Simulate intersection
    const mockEntry = {
      isIntersecting: true,
      target: mockElement,
    } as IntersectionObserverEntry

    mockObserverInstance.callback([mockEntry], mockObserverInstance as any)

    expect(mockOnIntersect).toHaveBeenCalledTimes(1)
  })

  it('does not call onIntersect when element is not intersecting', () => {
    const mockOnIntersect = vi.fn()
    const { result: targetRef } = renderHook(() => useRef<HTMLDivElement>(null))
    
    const mockElement = document.createElement('div')
    targetRef.current.current = mockElement

    renderHook(() =>
      useIntersectionObserver({
        target: targetRef.current,
        onIntersect: mockOnIntersect,
        enabled: true,
      })
    )

    // Simulate non-intersection
    const mockEntry = {
      isIntersecting: false,
      target: mockElement,
    } as IntersectionObserverEntry

    mockObserverInstance.callback([mockEntry], mockObserverInstance as any)

    expect(mockOnIntersect).not.toHaveBeenCalled()
  })

  it('unobserves element on cleanup', () => {
    const mockOnIntersect = vi.fn()
    const { result: targetRef } = renderHook(() => useRef<HTMLDivElement>(null))
    
    const mockElement = document.createElement('div')
    targetRef.current.current = mockElement

    const { unmount } = renderHook(() =>
      useIntersectionObserver({
        target: targetRef.current,
        onIntersect: mockOnIntersect,
        enabled: true,
      })
    )

    unmount()

    expect(mockObserverInstance.unobserve).toHaveBeenCalledWith(mockElement)
  })

  it('uses custom rootMargin and threshold', () => {
    const mockOnIntersect = vi.fn()
    const { result: targetRef } = renderHook(() => useRef<HTMLDivElement>(null))
    
    const mockElement = document.createElement('div')
    targetRef.current.current = mockElement

    renderHook(() =>
      useIntersectionObserver({
        target: targetRef.current,
        onIntersect: mockOnIntersect,
        enabled: true,
        rootMargin: '100px',
        threshold: 0.5,
      })
    )

    expect(mockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      {
        rootMargin: '100px',
        threshold: 0.5,
      }
    )
  })

  it('recreates observer when dependencies change', () => {
    const mockOnIntersect = vi.fn()
    const { result: targetRef } = renderHook(() => useRef<HTMLDivElement>(null))
    
    const mockElement = document.createElement('div')
    targetRef.current.current = mockElement

    const { rerender } = renderHook(
      ({ threshold }) =>
        useIntersectionObserver({
          target: targetRef.current,
          onIntersect: mockOnIntersect,
          enabled: true,
          threshold,
        }),
      { initialProps: { threshold: 0.1 } }
    )

    expect(mockIntersectionObserver).toHaveBeenCalledTimes(1)
    expect(mockObserverInstance.observe).toHaveBeenCalledTimes(1)

    // Change threshold
    rerender({ threshold: 0.5 })

    expect(mockIntersectionObserver).toHaveBeenCalledTimes(2)
    expect(mockObserverInstance.unobserve).toHaveBeenCalledTimes(1)
    expect(mockObserverInstance.observe).toHaveBeenCalledTimes(2)
  })

  it('handles multiple intersecting entries', () => {
    const mockOnIntersect = vi.fn()
    const { result: targetRef } = renderHook(() => useRef<HTMLDivElement>(null))
    
    const mockElement = document.createElement('div')
    targetRef.current.current = mockElement

    renderHook(() =>
      useIntersectionObserver({
        target: targetRef.current,
        onIntersect: mockOnIntersect,
        enabled: true,
      })
    )

    // Simulate multiple entries, some intersecting
    const mockEntries = [
      { isIntersecting: true, target: mockElement },
      { isIntersecting: false, target: document.createElement('div') },
      { isIntersecting: true, target: document.createElement('div') },
    ] as IntersectionObserverEntry[]

    mockObserverInstance.callback(mockEntries, mockObserverInstance as any)

    // Should call onIntersect for each intersecting entry
    expect(mockOnIntersect).toHaveBeenCalledTimes(2)
  })
})