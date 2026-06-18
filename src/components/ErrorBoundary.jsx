import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Always log full details to the console for debugging.
    console.error('[Lyria ErrorBoundary] Page render crash:', error);
    console.error('[Lyria ErrorBoundary] Component stack:', errorInfo?.componentStack);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      const isDev = !!(import.meta && import.meta.env && import.meta.env.DEV);
      const err = this.state.error;
      return (
        <div style={{ padding: 'var(--sp-8)', textAlign: 'center', maxWidth: 820, margin: '0 auto' }}>
          <div style={{ fontSize: 'var(--fs-2xl)', marginBottom: 'var(--sp-4)' }}>⚠️</div>
          <h2 style={{ marginBottom: 'var(--sp-2)' }}>Ocorreu um erro nesta página.</h2>
          <p style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--sp-4)' }}>
            A interface encontrou um valor inesperado (recarga instável).
          </p>

          {isDev && err && (
            <div style={{
              textAlign: 'left',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--sp-4)',
              marginBottom: 'var(--sp-4)',
              fontSize: '12px',
              fontFamily: 'monospace',
              color: 'var(--text-secondary)',
              overflowX: 'auto',
            }}>
              <div style={{ fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>
                {err.name || 'Error'}: {err.message || String(err)}
              </div>
              {this.state.errorInfo?.componentStack && (
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.4 }}>
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
              <div style={{ marginTop: 8, color: 'var(--text-tertiary)' }}>
                (Detalhes visíveis apenas em desenvolvimento)
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => window.location.reload()}>
              Recarregar página
            </button>
            <button className="btn btn-primary" onClick={() => { window.location.href = '/'; }}>
              Voltar ao Início
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
