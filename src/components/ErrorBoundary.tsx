import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Undo, Home } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an exception:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleAutoRecovery = () => {
    // Clean potential corrupted states in storage
    try {
      localStorage.removeItem('premium_panel_expanded'); 
      // Do not clear everything so we keep profile, but we clear temporary ui properties
    } catch (e) {
      console.warn("Could not clean localStorage for recovery:", e);
    }
    
    // Reset component state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    
    // Redirect cleanly or refresh the state
    window.location.hash = '';
    window.location.reload();
  };

  private handleSimpleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#09070f] text-white p-6 md:p-12 relative overflow-hidden font-sans">
          {/* Subtle cosmic background gradient effects */}
          <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[60%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-[-10%] right-[-20%] w-[60%] h-[60%] bg-indigo-950/25 rounded-full blur-[120px] pointer-events-none" />

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-full max-w-lg bg-white/[0.03] border border-white/5 backdrop-blur-xl rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative z-10 text-center flex flex-col items-center"
            id="error-boundary-panel"
          >
            {/* Warning Icon Badge */}
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-3xl flex items-center justify-center text-amber-500 mb-6 shadow-md animate-pulse">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h1 className="text-2xl font-bold font-display tracking-tight text-white mb-3">
              App Encountered a Hiccup
            </h1>
            <p className="text-zinc-400 text-sm leading-relaxed mb-6 max-w-sm">
              We've caught an unexpected exception and secured the session. You can try recovering active views or refreshing safely.
            </p>

            {this.state.error && (
              <div className="w-full bg-black/40 rounded-2xl p-4 text-left border border-white/5 font-mono text-[11px] text-zinc-500 max-h-36 overflow-y-auto mb-8 select-all scrollbar-thin">
                <span className="text-red-400 font-bold">Error:</span> {this.state.error.toString()}
                {this.state.errorInfo && (
                  <div className="mt-2 text-[10px] text-zinc-600 opacity-80 whitespace-pre-wrap leading-normal">
                    {this.state.errorInfo.componentStack}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              {/* Recover View Container */}
              <button
                type="button"
                onClick={this.handleSimpleReset}
                className="w-full py-4.5 px-6 rounded-2xl bg-purple-accent/20 border border-purple-accent/30 text-purple-200 text-xs font-bold font-display uppercase tracking-widest hover:bg-purple-accent/30 transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                id="btn-auto-recover"
              >
                <Undo className="w-4 h-4" />
                Recover Interface
              </button>

              {/* Refresh / Reload Container */}
              <button
                type="button"
                onClick={this.handleAutoRecovery}
                className="w-full py-4.5 px-6 rounded-2xl bg-purple-accent text-white text-xs font-bold font-display uppercase tracking-widest hover:brightness-110 shadow-lg shadow-purple-600/15 transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                id="btn-full-reset"
              >
                <RefreshCw className="w-4 h-4" />
                Fresh Reset
              </button>
            </div>

            <button
              type="button"
              onClick={this.handleReload}
              className="mt-6 text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-4 transition-colors font-semibold"
            >
              Force reload page instead
            </button>
          </motion.div>

          <footer className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center pointer-events-none opacity-30 select-none z-0">
             <p className="text-[10px] uppercase font-bold tracking-[0.25em] text-zinc-600">
               Zenvix One Self-Healing Shield
             </p>
          </footer>
        </div>
      );
    }

    return this.props.children;
  }
}
