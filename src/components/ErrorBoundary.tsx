import React from 'react'

interface State { hasError: boolean }

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          height: '100dvh', padding: '0 32px', textAlign: 'center', gap: 10,
        }}>
          <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--text-primary)' }}>
            出了点问题
          </div>
          <div style={{ fontSize: 17, color: 'var(--text-secondary)' }}>
            请刷新页面重试
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8,
              background: 'var(--amber-600)', color: '#fff',
              border: 'none', borderRadius: 8,
              padding: '10px 24px', fontSize: 17, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            刷新页面
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
