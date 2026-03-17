import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

// ✅ LOGIC-REACT-002: Error Boundary to catch component errors
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', {
      error: error.toString(),
      errorInfo: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });
    
    // Could send to error tracking service here
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
          <div className="max-w-md bg-white rounded-lg shadow-lg p-6 border-l-4 border-red-600">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle size={24} className="text-red-600" />
              <h1 className="text-xl font-bold text-red-900">Application Error</h1>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              An unexpected error occurred. The application will try to recover.
            </p>
            
            <details className="text-xs bg-slate-50 p-3 rounded border border-slate-200 mb-4 font-mono">
              <summary className="font-bold cursor-pointer hover:text-slate-900 select-none">
                Error Details (click to expand)
              </summary>
              <pre className="mt-2 whitespace-pre-wrap overflow-auto max-h-40 text-red-700">
                {this.state.error?.toString()}
              </pre>
              {this.state.errorInfo && (
                <pre className="mt-2 whitespace-pre-wrap overflow-auto max-h-40 text-slate-700">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </details>
            
            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-semibold transition"
              >
                Refresh Page
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-900 rounded hover:bg-slate-300 font-semibold transition"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
