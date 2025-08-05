import React, { useState, useEffect } from 'react';

/**
 * Error recovery dialog with specific recovery actions
 * Provides detailed recovery options and system diagnostics
 */
interface ErrorRecoveryDialogProps {
  error: Error;
  errorId: string | null;
  onRecover: (recoveryType: 'retry' | 'reset' | 'fallback') => Promise<void>;
  onClose: () => void;
}

export const ErrorRecoveryDialog: React.FC<ErrorRecoveryDialogProps> = ({
  error,
  errorId,
  onRecover,
  onClose
}) => {
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryType, setRecoveryType] = useState<string | null>(null);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  useEffect(() => {
    loadSystemHealth();
  }, []);

  /**
   * Load system health information
   */
  const loadSystemHealth = async () => {
    try {
      if (window.electron?.ipcRenderer) {
        const health = await window.electron.ipcRenderer.invoke('get-system-health');
        setSystemHealth(health);
      }
    } catch (error) {
      console.error('Failed to load system health:', error);
    }
  };

  /**
   * Run system diagnostics
   */
  const runDiagnostics = async () => {
    try {
      setShowDiagnostics(true);
      if (window.electron?.ipcRenderer) {
        const diagnostics = await window.electron.ipcRenderer.invoke('run-diagnostics');
        setDiagnostics(diagnostics);
      }
    } catch (error) {
      console.error('Failed to run diagnostics:', error);
    }
  };

  /**
   * Handle recovery action
   */
  const handleRecovery = async (type: 'retry' | 'reset' | 'fallback') => {
    setIsRecovering(true);
    setRecoveryType(type);
    
    try {
      await onRecover(type);
      onClose();
    } catch (error) {
      console.error('Recovery failed:', error);
    } finally {
      setIsRecovering(false);
      setRecoveryType(null);
    }
  };

  /**
   * Export error report
   */
  const exportErrorReport = async () => {
    try {
      if (window.electron?.ipcRenderer) {
        const reportPath = await window.electron.ipcRenderer.invoke('export-error-report', {
          errorId,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack
          }
        });
        
        // Show success message or open file location
        alert(`Error report exported to: ${reportPath}`);
      }
    } catch (error) {
      console.error('Failed to export error report:', error);
      alert('Failed to export error report. Please try again.');
    }
  };

  /**
   * Get recovery recommendations based on error type and system health
   */
  const getRecoveryRecommendations = () => {
    const recommendations = [];
    
    // Error-specific recommendations
    switch (error.name) {
      case 'ChunkLoadError':
        recommendations.push({
          type: 'retry',
          title: 'Reload Resources',
          description: 'Attempt to reload the failed application resources',
          confidence: 'high'
        });
        break;
      case 'NetworkError':
        recommendations.push({
          type: 'fallback',
          title: 'Use Offline Mode',
          description: 'Switch to offline mode to continue working',
          confidence: 'medium'
        });
        break;
      default:
        recommendations.push({
          type: 'retry',
          title: 'Retry Operation',
          description: 'Attempt to retry the failed operation',
          confidence: 'medium'
        });
    }
    
    // System health-based recommendations
    if (systemHealth) {
      if (systemHealth.overall === 'critical') {
        recommendations.push({
          type: 'reset',
          title: 'Reset Application',
          description: 'Reset the application to recover from system issues',
          confidence: 'high'
        });
      }
      
      if (systemHealth.components?.memory?.status === 'warning') {
        recommendations.push({
          type: 'reset',
          title: 'Clear Memory',
          description: 'Reset to free up memory and improve performance',
          confidence: 'medium'
        });
      }
    }
    
    return recommendations;
  };

  const recommendations = getRecoveryRecommendations();

  return (
    <div className="error-recovery-overlay">
      <div className="error-recovery-dialog">
        <div className="dialog-header">
          <h2>Error Recovery</h2>
          <button className="close-button" onClick={onClose} aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        
        <div className="dialog-content">
          <div className="error-summary">
            <h3>Error Summary</h3>
            <div className="error-info">
              <p><strong>Type:</strong> {error.name}</p>
              <p><strong>Message:</strong> {error.message}</p>
              {errorId && <p><strong>ID:</strong> {errorId}</p>}
            </div>
          </div>
          
          {systemHealth && (
            <div className="system-status">
              <h3>System Status</h3>
              <div className={`status-indicator status-${systemHealth.overall}`}>
                <span className="status-dot"></span>
                <span className="status-text">
                  {systemHealth.overall === 'healthy' ? 'System Healthy' :
                   systemHealth.overall === 'warning' ? 'System Issues Detected' :
                   'Critical System Issues'}
                </span>
              </div>
              
              {systemHealth.components && (
                <div className="component-status">
                  {Object.entries(systemHealth.components).map(([component, status]: [string, any]) => (
                    <div key={component} className="component-item">
                      <span className={`component-indicator status-${status.status}`}></span>
                      <span className="component-name">{component}</span>
                      <span className="component-message">{status.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          <div className="recovery-options">
            <h3>Recovery Options</h3>
            <div className="recovery-recommendations">
              {recommendations.map((rec, index) => (
                <div key={index} className="recovery-option">
                  <div className="option-header">
                    <h4>{rec.title}</h4>
                    <span className={`confidence confidence-${rec.confidence}`}>
                      {rec.confidence} confidence
                    </span>
                  </div>
                  <p className="option-description">{rec.description}</p>
                  <button
                    className="btn btn-recovery"
                    onClick={() => handleRecovery(rec.type as any)}
                    disabled={isRecovering}
                  >
                    {isRecovering && recoveryType === rec.type ? 'Recovering...' : 'Try This'}
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          <div className="advanced-options">
            <h3>Advanced Options</h3>
            <div className="advanced-actions">
              <button
                className="btn btn-outline"
                onClick={runDiagnostics}
                disabled={isRecovering}
              >
                Run Diagnostics
              </button>
              
              <button
                className="btn btn-outline"
                onClick={exportErrorReport}
                disabled={isRecovering}
              >
                Export Error Report
              </button>
              
              <button
                className="btn btn-outline"
                onClick={() => handleRecovery('reset')}
                disabled={isRecovering}
              >
                Force Reset
              </button>
            </div>
          </div>
          
          {showDiagnostics && diagnostics && (
            <div className="diagnostics-results">
              <h3>Diagnostic Results</h3>
              <div className="diagnostics-summary">
                <p>
                  <strong>Overall Status:</strong> 
                  <span className={`status-${diagnostics.overallStatus}`}>
                    {diagnostics.overallStatus}
                  </span>
                </p>
                <p><strong>Tests Run:</strong> {diagnostics.totalTests}</p>
                <p><strong>Passed:</strong> {diagnostics.passedTests}</p>
                <p><strong>Failed:</strong> {diagnostics.failedTests}</p>
              </div>
              
              {diagnostics.tests && (
                <div className="diagnostic-tests">
                  {diagnostics.tests.map((test: any, index: number) => (
                    <div key={index} className={`test-result ${test.passed ? 'passed' : 'failed'}`}>
                      <div className="test-header">
                        <span className="test-status">
                          {test.passed ? '✓' : '✗'}
                        </span>
                        <span className="test-name">{test.name}</span>
                      </div>
                      <p className="test-message">{test.message}</p>
                      {test.details && (
                        <details className="test-details">
                          <summary>Details</summary>
                          <pre>{JSON.stringify(test.details, null, 2)}</pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {diagnostics.recommendations && diagnostics.recommendations.length > 0 && (
                <div className="diagnostic-recommendations">
                  <h4>Recommendations</h4>
                  <ul>
                    {diagnostics.recommendations.map((rec: string, index: number) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// CSS styles for the error recovery dialog
export const errorRecoveryDialogStyles = `
.error-recovery-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.error-recovery-dialog {
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  max-width: 800px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid #e9ecef;
}

.dialog-header h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: #212529;
}

.close-button {
  background: none;
  border: none;
  padding: 0.5rem;
  cursor: pointer;
  color: #6c757d;
  border-radius: 0.25rem;
  transition: all 0.2s ease;
}

.close-button:hover {
  background: #f8f9fa;
  color: #495057;
}

.dialog-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.dialog-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e9ecef;
  display: flex;
  justify-content: flex-end;
}

.error-summary {
  margin-bottom: 2rem;
}

.error-summary h3 {
  font-size: 1.2rem;
  font-weight: 600;
  color: #495057;
  margin-bottom: 1rem;
}

.error-info {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  padding: 1rem;
}

.error-info p {
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.error-info p:last-child {
  margin-bottom: 0;
}

.system-status {
  margin-bottom: 2rem;
}

.system-status h3 {
  font-size: 1.2rem;
  font-weight: 600;
  color: #495057;
  margin-bottom: 1rem;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.status-healthy .status-dot {
  background: #28a745;
}

.status-warning .status-dot {
  background: #ffc107;
}

.status-critical .status-dot {
  background: #dc3545;
}

.status-text {
  font-weight: 500;
}

.component-status {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.component-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}

.component-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.component-name {
  font-weight: 500;
  min-width: 80px;
}

.component-message {
  color: #6c757d;
  flex: 1;
}

.recovery-options {
  margin-bottom: 2rem;
}

.recovery-options h3 {
  font-size: 1.2rem;
  font-weight: 600;
  color: #495057;
  margin-bottom: 1rem;
}

.recovery-recommendations {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.recovery-option {
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  padding: 1rem;
}

.option-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.option-header h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #495057;
}

.confidence {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-weight: 500;
}

.confidence-high {
  background: #d4edda;
  color: #155724;
}

.confidence-medium {
  background: #fff3cd;
  color: #856404;
}

.confidence-low {
  background: #f8d7da;
  color: #721c24;
}

.option-description {
  color: #6c757d;
  margin-bottom: 1rem;
  font-size: 0.875rem;
}

.btn-recovery {
  background: #007bff;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-recovery:hover:not(:disabled) {
  background: #0056b3;
}

.btn-recovery:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.advanced-options {
  margin-bottom: 2rem;
}

.advanced-options h3 {
  font-size: 1.2rem;
  font-weight: 600;
  color: #495057;
  margin-bottom: 1rem;
}

.advanced-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.diagnostics-results {
  margin-top: 2rem;
  border-top: 1px solid #e9ecef;
  padding-top: 2rem;
}

.diagnostics-results h3 {
  font-size: 1.2rem;
  font-weight: 600;
  color: #495057;
  margin-bottom: 1rem;
}

.diagnostics-summary {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  padding: 1rem;
  margin-bottom: 1rem;
}

.diagnostics-summary p {
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.diagnostics-summary p:last-child {
  margin-bottom: 0;
}

.status-healthy {
  color: #28a745;
  font-weight: 500;
}

.status-warning {
  color: #ffc107;
  font-weight: 500;
}

.status-critical {
  color: #dc3545;
  font-weight: 500;
}

.diagnostic-tests {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.test-result {
  border: 1px solid #dee2e6;
  border-radius: 0.25rem;
  padding: 0.75rem;
}

.test-result.passed {
  border-color: #28a745;
  background: #f8fff9;
}

.test-result.failed {
  border-color: #dc3545;
  background: #fff8f8;
}

.test-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.test-status {
  font-weight: bold;
  font-size: 1rem;
}

.test-result.passed .test-status {
  color: #28a745;
}

.test-result.failed .test-status {
  color: #dc3545;
}

.test-name {
  font-weight: 500;
  color: #495057;
}

.test-message {
  font-size: 0.875rem;
  color: #6c757d;
  margin-bottom: 0.5rem;
}

.test-details {
  font-size: 0.75rem;
}

.test-details pre {
  background: #f8f9fa;
  padding: 0.5rem;
  border-radius: 0.25rem;
  overflow-x: auto;
  margin-top: 0.5rem;
}

.diagnostic-recommendations {
  background: #e7f3ff;
  border: 1px solid #b3d9ff;
  border-radius: 0.375rem;
  padding: 1rem;
}

.diagnostic-recommendations h4 {
  margin-bottom: 0.5rem;
  color: #0056b3;
}

.diagnostic-recommendations ul {
  margin: 0;
  padding-left: 1.5rem;
}

.diagnostic-recommendations li {
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
  color: #495057;
}

@media (max-width: 768px) {
  .error-recovery-overlay {
    padding: 0.5rem;
  }
  
  .dialog-header {
    padding: 1rem;
  }
  
  .dialog-content {
    padding: 1rem;
  }
  
  .dialog-footer {
    padding: 1rem;
  }
  
  .advanced-actions {
    flex-direction: column;
  }
  
  .advanced-actions .btn {
    width: 100%;
  }
}
`;