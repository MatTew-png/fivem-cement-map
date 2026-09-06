import { StrictMode, Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled Application Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-slate-950 text-slate-100 p-8 flex flex-col items-center justify-center font-sans z-[99999]">
          <div className="max-w-lg w-full bg-slate-900 border border-red-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <span className="text-2xl">⚠️</span>
              <h1 className="text-base font-bold text-white">เกิดข้อผิดพลาดในการแสดงผล</h1>
            </div>
            <p className="text-xs text-red-300 font-mono bg-red-950/40 p-3 rounded-xl border border-red-800/40">
              {this.state.error?.message || 'Unknown Application Error'}
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="px-4 py-2 bg-amber-400 text-slate-950 rounded-xl font-bold text-xs hover:bg-amber-300 transition-colors"
              >
                ล้างข้อมูลแคชและรีโหลด
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-slate-800 text-slate-200 rounded-xl font-medium text-xs hover:bg-slate-700 transition-colors"
              >
                รีโหลดหน้าเว็บ
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
