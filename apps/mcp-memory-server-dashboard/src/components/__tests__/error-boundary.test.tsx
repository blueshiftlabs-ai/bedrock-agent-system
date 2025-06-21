import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ErrorBoundary } from '../error-boundary'
import React from 'react'

// Component that throws an error for testing
const ThrowError = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message')
  }
  return <div>No error</div>
}

describe('ErrorBoundary', () => {
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

  afterEach(() => {
    consoleSpy.mockClear()
  })

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText('No error')).toBeInTheDocument()
  })

  it('renders error UI when there is an error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('An error occurred while rendering this component')).toBeInTheDocument()
    expect(screen.getByText('Test error message')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('renders custom fallback when provided', () => {
    const customFallback = <div>Custom error fallback</div>

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom error fallback')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('logs error to console', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(consoleSpy).toHaveBeenCalledWith(
      'Error caught by boundary:',
      expect.any(Error),
      expect.any(Object)
    )
  })

  it('resets error state when Try Again is clicked', () => {
    const TestComponent = () => {
      const [shouldThrow, setShouldThrow] = React.useState(true)
      
      return (
        <ErrorBoundary>
          <div>
            <button onClick={() => setShouldThrow(false)}>Fix Error</button>
            <ThrowError shouldThrow={shouldThrow} />
          </div>
        </ErrorBoundary>
      )
    }

    render(<TestComponent />)

    // Initially shows error
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    // Click Try Again
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    // Should still show error since component still throws
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('recovers when error is fixed and Try Again is clicked', () => {
    class TestErrorBoundary extends React.Component<
      { children: React.ReactNode },
      { hasError: boolean; errorCount: number }
    > {
      constructor(props: { children: React.ReactNode }) {
        super(props)
        this.state = { hasError: false, errorCount: 0 }
      }

      static getDerivedStateFromError() {
        return { hasError: true }
      }

      componentDidCatch() {
        this.setState(prev => ({ errorCount: prev.errorCount + 1 }))
      }

      render() {
        if (this.state.hasError) {
          return (
            <div>
              <div>Error occurred</div>
              <button onClick={() => this.setState({ hasError: false })}>
                Try Again
              </button>
            </div>
          )
        }

        return (
          <div>
            <ThrowError shouldThrow={this.state.errorCount === 0} />
          </div>
        )
      }
    }

    render(<TestErrorBoundary>test</TestErrorBoundary>)

    // Initially shows error
    expect(screen.getByText('Error occurred')).toBeInTheDocument()

    // Click Try Again - should recover since error count > 0 now
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    expect(screen.getByText('No error')).toBeInTheDocument()
  })
})