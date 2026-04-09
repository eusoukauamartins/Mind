import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Page Render Crash:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 'var(--sp-8)', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-2xl)', marginBottom: 'var(--sp-4)' }}>⚠️</div>
          <h2 style={{ marginBottom: 'var(--sp-2)' }}>Ocorreu um erro nesta página.</h2>
          <p style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--sp-4)' }}>A interface encontrou um valor inesperado (recarga instável).</p>
          <button className="btn btn-primary" onClick={() => window.location.href = '/'}>
            Voltar ao Início
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
