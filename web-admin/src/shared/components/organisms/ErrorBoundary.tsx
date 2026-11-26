import { Component, type ReactNode } from 'react'
import { Button } from '@/shared/components/atoms/Button'
import { Icon } from '@/shared/components/atoms/Icon'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Error inesperado de renderizado.',
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="max-w-md rounded-2xl bg-surface-container-lowest p-8 text-center shadow-lg">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error-container text-error">
              <Icon name="report_problem" className="text-[24px]" />
            </div>
            <h1 className="font-headline text-3xl font-bold text-on-surface">
              Algo salió mal en la consola
            </h1>
            <p className="mt-2 text-sm text-on-surface-variant">
              {this.state.message}
            </p>
            <Button
              className="mt-6"
              leftIcon="refresh"
              onClick={() => {
                this.setState({ hasError: false, message: '' })
                window.location.assign('/casos')
              }}
            >
              Recargar panel
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
