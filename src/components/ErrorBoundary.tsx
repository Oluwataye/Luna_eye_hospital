import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';


interface Props {
  children: ReactNode;
  /** Optional custom fallback UI — defaults to the built-in recovery screen */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global React Error Boundary.
 * Catches render-time exceptions anywhere in the component tree,
 * prevents a full white-screen crash, and shows a recovery UI.
 *
 * Wrap your root <App /> with this in main.tsx.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          fontFamily: "'Inter', sans-serif",
          padding: '24px',
          textAlign: 'center',
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '24px',
            padding: '48px 40px',
            maxWidth: '480px',
            width: '100%',
          }}>
            {/* Icon */}
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
              fontSize: '32px',
            }}>
              ⚠️
            </div>

            <h1 style={{
              fontSize: '22px', fontWeight: '800', color: '#f1f5f9',
              margin: '0 0 12px', letterSpacing: '-0.01em',
            }}>
              Something went wrong
            </h1>

            <p style={{
              fontSize: '14px', color: '#94a3b8', lineHeight: 1.6,
              margin: '0 0 8px',
            }}>
              An unexpected error occurred in the application.
              Your data is safe — this is a display error only.
            </p>

            {this.state.error && (
              <p style={{
                fontSize: '11px', color: '#64748b', margin: '0 0 32px',
                background: 'rgba(0,0,0,0.3)', borderRadius: '8px',
                padding: '8px 12px', fontFamily: 'monospace',
                wordBreak: 'break-word',
              }}>
                {this.state.error.message}
              </p>
            )}

            <button
              onClick={this.handleReload}
              style={{
                width: '100%', height: '52px', border: 'none',
                borderRadius: '12px', cursor: 'pointer',
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: '#fff', fontSize: '14px', fontWeight: '800',
                letterSpacing: '0.04em',
                boxShadow: '0 4px 20px rgba(59,130,246,0.4)',
                transition: 'opacity 0.2s',
              }}
              onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseOut={e => (e.currentTarget.style.opacity = '1')}
            >
              RELOAD APPLICATION
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
