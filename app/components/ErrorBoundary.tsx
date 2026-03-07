'use client'

import React from 'react'

interface ErrorBoundaryProps {
    children: React.ReactNode
    fallback?: React.ReactNode
}

interface ErrorBoundaryState {
    hasError: boolean
    error?: Error
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('[ErrorBoundary] Uncaught error:', error, errorInfo)
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100vh',
                    width: '100vw',
                    background: '#fff',
                    fontFamily: 'monospace',
                    gap: '12px',
                    padding: '24px',
                    textAlign: 'center',
                }}>
                    <div style={{ fontSize: '24px' }}>⚠️</div>
                    <h2 style={{ fontSize: '14px', fontWeight: 900, color: '#1e293b', margin: 0 }}>
                        SOMETHING WENT WRONG
                    </h2>
                    <p style={{ fontSize: '11px', color: '#64748b', margin: 0, maxWidth: '300px' }}>
                        The app encountered an unexpected error. Please refresh the page.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: '8px',
                            padding: '8px 20px',
                            fontSize: '11px',
                            fontWeight: 800,
                            background: '#0052FF',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontFamily: 'monospace',
                            letterSpacing: '0.05em',
                        }}
                    >
                        REFRESH
                    </button>
                </div>
            )
        }

        return this.props.children
    }
}
