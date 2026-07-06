import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[Kickfolio crash]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#0a0b0e] flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-[#111318] border border-red-500/20 rounded-xl p-6 text-center">
            <div className="text-3xl mb-3">⚠️</div>
            <h2 className="text-white font-bold text-lg mb-2">Something went wrong</h2>
            <p className="text-gray-500 text-sm mb-4">
              Open DevTools (F12 → Console) and send the red error to the developer.
            </p>
            <pre className="text-left text-xs text-red-400 bg-[#0a0b0e] rounded p-3 overflow-auto max-h-40 mb-4">
              {this.state.error.message}
            </pre>
            <button
              onClick={() => { this.setState({ error: null }); window.location.href = '/market' }}
              className="bg-green-500 hover:bg-green-400 text-black font-bold rounded-lg px-4 py-2 text-sm transition-colors"
            >
              Reload market
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
