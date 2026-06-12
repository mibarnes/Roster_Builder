import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** Top-level error boundary — keeps a render failure from blanking the whole app. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('Roster portal render error:', error, info.componentStack)
  }

  handleReset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div
        role="alert"
        className="flex min-h-full flex-col items-center justify-center gap-4 bg-card-bg p-8 text-center"
      >
        <h1 className="text-2xl font-black text-portal-orange">Something went wrong</h1>
        <p className="max-w-md text-sm text-white/70">
          The roster view hit an unexpected error. Try reloading; if it persists the team data may be
          incomplete.
        </p>
        <pre className="max-w-lg overflow-auto rounded bg-black/50 p-3 text-left text-[11px] text-white/50">
          {error.message}
        </pre>
        <button
          type="button"
          onClick={this.handleReset}
          className="rounded-md bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20"
        >
          Try again
        </button>
      </div>
    )
  }
}
