import React, { useState, useEffect } from 'react';

/**
 * Offline mode indicator with appropriate UI feedback
 * Shows current connectivity status and available offline features
 */
interface OfflineModeIndicatorProps {
  className?: string;
  showDetails?: boolean;
  position?: 'top' | 'bottom';
}

export const OfflineModeIndicator: React.FC<OfflineModeIndicatorProps> = ({
  className = '',
  showDetails = false,
  position = 'top'
}) => {
  const [isOffline, setIsOffline] = useState(false);
  const [offlineStatus, setOfflineStatus] = useState<any>(null);
  const [networkQuality, setNetworkQuality] = useState<any>(null);
  const [showOfflineDetails, setShowOfflineDetails] = useState(false);
  const [queuedOperations, setQueuedOperations] = useState<any[]>([]);

  useEffect(() => {
    // Listen for connectivity changes
    const handleOnline = () => {
      setIsOffline(false);
      loadNetworkQuality();
    };

    const handleOffline = () => {
      setIsOffline(true);
      loadOfflineStatus();
    };

    // Initial state
    setIsOffline(!navigator.onLine);
    
    // Browser events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // IPC events from main process
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.on('connectivity-changed', (event, data) => {
        setIsOffline(data.isOffline);
        if (data.isOffline) {
          loadOfflineStatus();
        } else {
          loadNetworkQuality();
        }
      });

      window.electron.ipcRenderer.on('operation-queued', (event, operation) => {
        setQueuedOperations(prev => [...prev, operation]);
      });

      window.electron.ipcRenderer.on('queued-operations-processed', (event, data) => {
        setQueuedOperations([]);
      });
    }

    // Initial load
    if (isOffline) {
      loadOfflineStatus();
    } else {
      loadNetworkQuality();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOffline]);

  /**
   * Load offline status information
   */
  const loadOfflineStatus = async () => {
    try {
      if (window.electron?.ipcRenderer) {
        const status = await window.electron.ipcRenderer.invoke('get-offline-status');
        setOfflineStatus(status);
        
        const operations = await window.electron.ipcRenderer.invoke('get-queued-operations');
        setQueuedOperations(operations);
      }
    } catch (error) {
      console.error('Failed to load offline status:', error);
    }
  };

  /**
   * Load network quality information
   */
  const loadNetworkQuality = async () => {
    try {
      if (window.electron?.ipcRenderer) {
        const quality = await window.electron.ipcRenderer.invoke('get-network-quality');
        setNetworkQuality(quality);
      }
    } catch (error) {
      console.error('Failed to load network quality:', error);
    }
  };

  /**
   * Toggle offline mode manually
   */
  const toggleOfflineMode = async () => {
    try {
      if (window.electron?.ipcRenderer) {
        if (isOffline) {
          await window.electron.ipcRenderer.invoke('force-online-mode');
        } else {
          await window.electron.ipcRenderer.invoke('force-offline-mode');
        }
      }
    } catch (error) {
      console.error('Failed to toggle offline mode:', error);
    }
  };

  /**
   * Retry queued operations
   */
  const retryQueuedOperations = async () => {
    try {
      if (window.electron?.ipcRenderer) {
        await window.electron.ipcRenderer.invoke('retry-queued-operations');
      }
    } catch (error) {
      console.error('Failed to retry queued operations:', error);
    }
  };

  /**
   * Get connectivity status icon
   */
  const getStatusIcon = () => {
    if (isOffline) {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.07 2.93 1 9z"/>
          <path d="M5 13l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.24 9.24 8.76 9.24 5 13z"/>
          <path d="M9 17l2 2c.87-.87 2.13-.87 3 0l2-2C14.24 15.24 9.76 15.24 9 17z"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      );
    }

    if (networkQuality) {
      switch (networkQuality.status) {
        case 'excellent':
          return (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.07 2.93 1 9z"/>
              <path d="M5 13l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.24 9.24 8.76 9.24 5 13z"/>
              <path d="M9 17l2 2c.87-.87 2.13-.87 3 0l2-2C14.24 15.24 9.76 15.24 9 17z"/>
            </svg>
          );
        case 'good':
          return (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M5 13l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.24 9.24 8.76 9.24 5 13z"/>
              <path d="M9 17l2 2c.87-.87 2.13-.87 3 0l2-2C14.24 15.24 9.76 15.24 9 17z"/>
            </svg>
          );
        case 'poor':
          return (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M9 17l2 2c.87-.87 2.13-.87 3 0l2-2C14.24 15.24 9.76 15.24 9 17z"/>
            </svg>
          );
        default:
          return (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          );
      }
    }

    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.07 2.93 1 9z"/>
        <path d="M5 13l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.24 9.24 8.76 9.24 5 13z"/>
        <path d="M9 17l2 2c.87-.87 2.13-.87 3 0l2-2C14.24 15.24 9.76 15.24 9 17z"/>
      </svg>
    );
  };

  /**
   * Get status text
   */
  const getStatusText = () => {
    if (isOffline) {
      return 'Offline Mode';
    }

    if (networkQuality) {
      switch (networkQuality.status) {
        case 'excellent':
          return 'Excellent Connection';
        case 'good':
          return 'Good Connection';
        case 'poor':
          return 'Poor Connection';
        default:
          return 'Connection Issues';
      }
    }

    return 'Online';
  };

  /**
   * Get status color class
   */
  const getStatusColorClass = () => {
    if (isOffline) {
      return 'status-offline';
    }

    if (networkQuality) {
      switch (networkQuality.status) {
        case 'excellent':
          return 'status-excellent';
        case 'good':
          return 'status-good';
        case 'poor':
          return 'status-poor';
        default:
          return 'status-warning';
      }
    }

    return 'status-online';
  };

  /**
   * Format duration
   */
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <div className={`offline-mode-indicator ${className} position-${position}`}>
      <div 
        className={`status-bar ${getStatusColorClass()}`}
        onClick={() => setShowOfflineDetails(!showOfflineDetails)}
      >
        <div className="status-content">
          <div className="status-icon">
            {getStatusIcon()}
          </div>
          <span className="status-text">{getStatusText()}</span>
          {queuedOperations.length > 0 && (
            <span className="queued-count">
              {queuedOperations.length} queued
            </span>
          )}
        </div>
        
        {showDetails && (
          <button 
            className="details-toggle"
            onClick={(e) => {
              e.stopPropagation();
              setShowOfflineDetails(!showOfflineDetails);
            }}
          >
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor"
              style={{ transform: showOfflineDetails ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              <polyline points="6,9 12,15 18,9"/>
            </svg>
          </button>
        )}
      </div>

      {showOfflineDetails && (
        <div className="offline-details">
          {isOffline ? (
            <div className="offline-info">
              <h3>Offline Mode Active</h3>
              
              {offlineStatus && (
                <div className="offline-status">
                  <p>
                    <strong>Duration:</strong> {formatDuration(offlineStatus.offlineDuration)}
                  </p>
                  <p>
                    <strong>Last Online:</strong> {new Date(offlineStatus.lastOnlineTime).toLocaleString()}
                  </p>
                </div>
              )}

              <div className="available-features">
                <h4>Available Features</h4>
                <ul>
                  {offlineStatus?.availableFeatures?.map((feature: string, index: number) => (
                    <li key={index} className="feature-available">
                      <span className="feature-icon">✓</span>
                      {feature.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="unavailable-features">
                <h4>Limited Features</h4>
                <ul>
                  {offlineStatus?.unavailableFeatures?.map((feature: string, index: number) => (
                    <li key={index} className="feature-unavailable">
                      <span className="feature-icon">✗</span>
                      {feature.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </li>
                  ))}
                </ul>
              </div>

              {queuedOperations.length > 0 && (
                <div className="queued-operations">
                  <h4>Queued Operations ({queuedOperations.length})</h4>
                  <div className="operations-list">
                    {queuedOperations.slice(0, 5).map((operation, index) => (
                      <div key={index} className="operation-item">
                        <span className="operation-type">{operation.type}</span>
                        <span className="operation-time">
                          {new Date(operation.queuedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                    {queuedOperations.length > 5 && (
                      <p className="more-operations">
                        +{queuedOperations.length - 5} more operations
                      </p>
                    )}
                  </div>
                  <button 
                    className="btn btn-small"
                    onClick={retryQueuedOperations}
                  >
                    Retry When Online
                  </button>
                </div>
              )}

              <div className="offline-actions">
                <button 
                  className="btn btn-primary"
                  onClick={toggleOfflineMode}
                >
                  Try to Go Online
                </button>
              </div>
            </div>
          ) : (
            <div className="online-info">
              <h3>Connection Status</h3>
              
              {networkQuality && (
                <div className="network-quality">
                  <p>
                    <strong>Quality:</strong> {networkQuality.status}
                  </p>
                  <p>
                    <strong>Latency:</strong> {networkQuality.latency}ms
                  </p>
                  <p>
                    <strong>Stability:</strong> {Math.round(networkQuality.stability * 100)}%
                  </p>
                  <p>
                    <strong>Last Test:</strong> {new Date(networkQuality.lastTest).toLocaleTimeString()}
                  </p>
                </div>
              )}

              <div className="online-actions">
                <button 
                  className="btn btn-outline"
                  onClick={toggleOfflineMode}
                >
                  Work Offline
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// CSS styles for the offline mode indicator
export const offlineModeIndicatorStyles = `
.offline-mode-indicator {
  position: fixed;
  left: 0;
  right: 0;
  z-index: 999;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.offline-mode-indicator.position-top {
  top: 0;
}

.offline-mode-indicator.position-bottom {
  bottom: 0;
}

.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.status-bar:hover {
  opacity: 0.9;
}

.status-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.status-icon {
  display: flex;
  align-items: center;
}

.status-text {
  font-weight: 500;
  font-size: 0.875rem;
}

.queued-count {
  background: rgba(255, 255, 255, 0.2);
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.details-toggle {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
  transition: all 0.2s ease;
}

.details-toggle:hover {
  background: rgba(255, 255, 255, 0.1);
}

.details-toggle svg {
  transition: transform 0.2s ease;
}

/* Status color classes */
.status-offline {
  background: #dc3545;
  color: white;
}

.status-excellent {
  background: #28a745;
  color: white;
}

.status-good {
  background: #17a2b8;
  color: white;
}

.status-poor {
  background: #ffc107;
  color: #212529;
}

.status-warning {
  background: #fd7e14;
  color: white;
}

.status-online {
  background: #6c757d;
  color: white;
}

.offline-details {
  background: white;
  border: 1px solid #dee2e6;
  border-top: none;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  max-height: 400px;
  overflow-y: auto;
}

.offline-info,
.online-info {
  padding: 1.5rem;
}

.offline-info h3,
.online-info h3 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #495057;
}

.offline-status,
.network-quality {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 0.375rem;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.offline-status p,
.network-quality p {
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.offline-status p:last-child,
.network-quality p:last-child {
  margin-bottom: 0;
}

.available-features,
.unavailable-features {
  margin-bottom: 1.5rem;
}

.available-features h4,
.unavailable-features h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #495057;
  margin-bottom: 0.75rem;
}

.available-features ul,
.unavailable-features ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.available-features li,
.unavailable-features li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  font-size: 0.875rem;
}

.feature-available {
  color: #28a745;
}

.feature-unavailable {
  color: #6c757d;
}

.feature-icon {
  font-weight: bold;
  width: 16px;
  text-align: center;
}

.queued-operations {
  margin-bottom: 1.5rem;
}

.queued-operations h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #495057;
  margin-bottom: 0.75rem;
}

.operations-list {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 0.375rem;
  padding: 0.75rem;
  margin-bottom: 1rem;
}

.operation-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid #e9ecef;
  font-size: 0.875rem;
}

.operation-item:last-child {
  border-bottom: none;
}

.operation-type {
  font-weight: 500;
  color: #495057;
}

.operation-time {
  color: #6c757d;
  font-size: 0.75rem;
}

.more-operations {
  text-align: center;
  color: #6c757d;
  font-size: 0.75rem;
  margin: 0.5rem 0 0 0;
}

.offline-actions,
.online-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover {
  background: #0056b3;
}

.btn-outline {
  background: transparent;
  color: #007bff;
  border: 1px solid #007bff;
}

.btn-outline:hover {
  background: #007bff;
  color: white;
}

.btn-small {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
}

@media (max-width: 768px) {
  .status-bar {
    padding: 0.5rem;
  }
  
  .status-content {
    gap: 0.5rem;
  }
  
  .status-text {
    font-size: 0.75rem;
  }
  
  .queued-count {
    font-size: 0.625rem;
    padding: 0.125rem 0.375rem;
  }
  
  .offline-info,
  .online-info {
    padding: 1rem;
  }
  
  .offline-actions,
  .online-actions {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
  }
}

/* Animation for status changes */
@keyframes statusChange {
  0% { opacity: 0.7; }
  50% { opacity: 1; }
  100% { opacity: 0.7; }
}

.status-bar.changing {
  animation: statusChange 1s ease-in-out;
}
`;