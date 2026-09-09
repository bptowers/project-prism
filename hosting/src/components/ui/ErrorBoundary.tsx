import React from 'react';

interface Props {
  /** Human-readable name of the section, shown in the fallback. */
  section: string;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Per-section error boundary. Without one, a single widget throwing on an
 * unexpected payload unmounts the whole React tree and the user sees a blank
 * page (production, 2026-09-09). With one, the rest of the dashboard survives
 * and the failure is named so it can be reported.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(`[ErrorBoundary:${this.props.section}]`, error, info.componentStack);
  }

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div
        role="alert"
        style={{
          margin: '0 0 2rem',
          padding: '1rem 1.25rem',
          border: '1px solid var(--error)',
          borderRadius: 8,
          background: 'var(--error-subtle)',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8rem',
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{this.props.section} could not be displayed</div>
        <div style={{ color: 'var(--text-secondary)' }}>
          This section hit an unexpected data shape in the current report. The rest of the dashboard is unaffected.
          Details: {this.state.error.message}
        </div>
      </div>
    );
  }
}
