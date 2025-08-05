import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorRecoveryDialog } from './ErrorRecoveryDialog';
import { OfflineModeIndicator } from './OfflineModeIndicator';

/**
 * Error boundary component with recovery mechanisms
 * Catches JavaScript errors and provides user-friendly recovery options
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: ErrorInfo) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  enableRecovery?: boolean;
  showOfflineIndicator?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  recoveryAttempts: number;
  isRecovering: boolean;
  showRecoveryDialog: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private errorHandler: any; // Would be injected from main process

  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      recoveryAttempts: 0,
      isRecovering: false,
      showRecoveryDialog: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      errorInfo,
      errorId: this.generateErrorId()
    });

    // Report error to main process
    this.reportError(error, errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  /**
   * Report error to main process for handling
   */
  private async reportError(error: Error, errorInfo: ErrorInfo): Promise<void> {
    try {
      if (window.electron?.ipcRenderer) {
        const result = await window.electron.ipcRenderer.invoke('handle-error', {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack
          },
          context: {
            operation: 'ui-render',
            component: 'ErrorBoundary',
            metadata: {
              componentStack: errorInfo.componentStack,
              errorBoundary: true
            }
          }
        });

        this.setState({ errorId: result.errorId });
      }
    } catch (reportError) {
      console.error('Failed to report error to main process:', reportError);
    }
  }

  /**
   * Attempt to recover from the error
   */
  private handleRecovery = async (recoveryType: 'retry' | 'reset' | 'fallback'): Promise<void> => {
    this.setState({ isRecovering: true });

    try {
      switch (recoveryType) {
        case 'retry':
          await this.retryOperation();
          break;
        case 'reset':
          await this.resetComponent();
          break;
        case 'fallback':
          await this.useFallback();
          break;
      }

      // If recovery successful, clear error state
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null,
        isRecovering: false,
        showRecoveryDialog: false,
        recoveryAttempts: this.state.recoveryAttempts + 1
      });

    } catch (recoveryError) {
      console.error('Recovery failed:', recoveryError);
      this.setState({
        isRecovering: false,
        recoveryAttempts: this.state.recoveryAttempts + 1
      });
    }
  };

  /**
   * Retry the failed operation
   */
  private async retryOperation(): Promise<void> {
    // Force re-render by clearing error state
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Reset component to initial state
   */
  private async resetComponent(): Promise<void> {
    // Clear any cached data or state
    if (window.electron?.ipcRenderer) {
      await window.electron.ipcRenderer.invoke('clear-component-cache');
    }
  }

  /**
   * Use fallback rendering
   */
  private async useFallback(): Promise<void> {
    // This would switch to a simpler fallback UI
    console.log('Using fallback UI');
  }

  /**
   * Show recovery dialog
   */
  private showRecoveryDialog = (): void => {
    this.setState({ showRecoveryDialog: true });
  };

  /**
   * Hide recovery dialog
   */
  private hideRecoveryDialog = (): void => {
    this.setState({ showRecoveryDialog: false });
  };

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `ui_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get user-friendly error message
   */
  private getUserFriendlyMessage(error: Error): string {
    const errorMessages: Record<string, string> = {
      'ChunkLoadError': 'Failed to load application resources. Please refresh the page.',
      'TypeError': 'An unexpected error occurred. The application will attempt to recover.',
      'ReferenceError': 'A component failed to load properly. Please try refreshing.',
      'NetworkError': 'Network connection issue detected. Some features may be limited.',
      'QuotaExceededError': 'Storage limit reached. Please free up space or contact support.'
    };

    return errorMessages[error.name] || 'An unexpected error occurred. The application will attempt to recover automatically.';
  }

  /**
   * Get recovery suggestions based on error type
   */
  private getRecoverySuggestions(error: Error): string[] {
    const suggestions: Record<string, string[]> = {
      'ChunkLoadError': [
        'Refresh the page to reload resources',
        'Clear browser cache and try again',
        'Check your internet connection'
      ],
      'TypeError': [
        'Try refreshing the page',
        'Close and reopen the application',
        'Contact support if the issue persists'
      ],
      'NetworkError': [
        'Check your internet connection',
        'Try again in a few moments',
        'Switch to offline mode if available'
      ],
      'QuotaExceededError': [
        'Clear application data to free up space',
        'Export your work before continuing',
        'Contact support for assistance'
      ]
    };

    return suggestions[error.name] || [
      'Try refreshing the page',
      'Close and reopen the application',
      'Contact support if the issue continues'
    ];
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.state.errorInfo!);
      }

      const userMessage = this.getUserFriendlyMessage(this.state.error);
      const suggestions = this.getRecoverySuggestions(this.state.error);

      return (
        <div className="error-boundary">
          {this.props.showOfflineIndicator && <OfflineModeIndicator />}
          
          <div className="error-boundary-content">
            <div className="error-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            
            <h2 className="error-title">Something went wrong</h2>
            
            <p className="error-message">{userMessage}</p>
            
            {this.state.errorId && (
              <p className="error-id">Error ID: {this.state.errorId}</p>
            )}
            
            <div className="error-actions">
              <button
                className="btn btn-primary"
                onClick={() => this.handleRecovery('retry')}
                disabled={this.state.isRecovering}
              >
                {this.state.isRecovering ? 'Recovering...' : 'Try Again'}
              </button>
              
              <button
                className="btn btn-secondary"
                onClick={() => this.handleRecovery('reset')}
                disabled={this.state.isRecovering}
              >
                Reset
              </button>
              
              {this.props.enableRecovery && (
                <button
                  className="btn btn-outline"
                  onClick={this.showRecoveryDialog}
                  disabled={this.state.isRecovering}
                >
                  Recovery Options
                </button>
              )}
            </div>
            
            <details className="error-details">
              <summary>Technical Details</summary>
              <div className="error-technical">
                <p><strong>Error:</strong> {this.state.error.name}</p>
                <p><strong>Message:</strong> {this.state.error.message}</p>
                {this.state.error.stack && (
                  <pre className="error-stack">{this.state.error.stack}</pre>
                )}
              </div>
            </details>
            
            <div className="error-suggestions">
              <h3>What you can try:</h3>
              <ul>
                {suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          </div>
          
          {this.state.showRecoveryDialog && (
            <ErrorRecoveryDialog
              error={this.state.error}
              errorId={this.state.errorId}
              onRecover={this.handleRecovery}
              onClose={this.hideRecoveryDialog}
            />
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// CSS styles for the error boundary
export const errorBoundaryStyles = `
.error-boundary {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f8f9fa;
}

.error-boundary-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  max-width: 600px;
  margin: 0 auto;
}

.error-icon {
  color: #dc3545;
  margin-bottom: 1rem;
}

.error-title {
  font-size: 2rem;
  font-weight: 600;
  color: #212529;
  margin-bottom: 1rem;
}

.error-message {
  font-size: 1.1rem;
  color: #6c757d;
  margin-bottom: 1rem;
  line-height: 1.5;
}

.error-id {
  font-size: 0.875rem;
  color: #868e96;
  font-family: monospace;
  margin-bottom: 2rem;
}

.error-actions {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  justify-content: center;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.375rem;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 120px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #545b62;
}

.btn-outline {
  background: transparent;
  color: #007bff;
  border: 1px solid #007bff;
}

.btn-outline:hover:not(:disabled) {
  background: #007bff;
  color: white;
}

.error-details {
  width: 100%;
  margin-bottom: 2rem;
  text-align: left;
}

.error-details summary {
  cursor: pointer;
  font-weight: 500;
  color: #495057;
  margin-bottom: 1rem;
}

.error-technical {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  padding: 1rem;
  font-size: 0.875rem;
}

.error-technical p {
  margin-bottom: 0.5rem;
}

.error-stack {
  background: #e9ecef;
  padding: 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.error-suggestions {
  width: 100%;
  text-align: left;
}

.error-suggestions h3 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #495057;
  margin-bottom: 0.5rem;
}

.error-suggestions ul {
  list-style: none;
  padding: 0;
}

.error-suggestions li {
  padding: 0.5rem 0;
  border-bottom: 1px solid #e9ecef;
  position: relative;
  padding-left: 1.5rem;
}

.error-suggestions li:before {
  content: "→";
  position: absolute;
  left: 0;
  color: #007bff;
  font-weight: bold;
}

.error-suggestions li:last-child {
  border-bottom: none;
}

@media (max-width: 768px) {
  .error-boundary-content {
    padding: 1rem;
  }
  
  .error-title {
    font-size: 1.5rem;
  }
  
  .error-actions {
    flex-direction: column;
    width: 100%;
  }
  
  .btn {
    width: 100%;
  }
}
`;

// Global error handler setup
export const setupGlobalErrorHandling = () => {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    // Report to main process
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.invoke('handle-error', {
        error: {
          name: 'UnhandledPromiseRejection',
          message: event.reason?.message || 'Unhandled promise rejection',
          stack: event.reason?.stack
        },
        context: {
          operation: 'promise-rejection',
          component: 'global',
          metadata: {
            type: 'unhandledrejection'
          }
        }
      });
    }
  });

  // Handle global errors
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    
    // Report to main process
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.invoke('handle-error', {
        error: {
          name: event.error?.name || 'GlobalError',
          message: event.error?.message || event.message,
          stack: event.error?.stack
        },
        context: {
          operation: 'global-error',
          component: 'global',
          metadata: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          }
        }
      });
    }
  });
};

// Type declarations for window.electron
declare global {
  interface Window {
    electron?: {
      ipcRenderer: {
        invoke: (channel: string, ...args: any[]) => Promise<any>;
        send: (channel: string, ...args: any[]) => void;
        on: (channel: string, listener: (...args: any[]) => void) => void;
      };
    };
  }
}