import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Comprehensive error handling and recovery system
 * Provides graceful degradation, fallback mechanisms, and user-friendly error reporting
 */
export class ErrorHandler extends EventEmitter {
  private errorLog: ErrorLogEntry[];
  private recoveryStrategies: Map<string, RecoveryStrategy>;
  private fallbackChain: Map<string, string[]>;
  private systemHealth: SystemHealthStatus;
  private offlineMode: boolean;
  private logFilePath: string;

  constructor(options: ErrorHandlerOptions = {}) {
    super();
    
    this.errorLog = [];
    this.recoveryStrategies = new Map();
    this.fallbackChain = new Map();
    this.systemHealth = {
      overall: HealthStatus.HEALTHY,
      components: new Map(),
      lastCheck: Date.now()
    };
    this.offlineMode = false;
    this.logFilePath = options.logFilePath || path.join(process.cwd(), 'logs', 'errors.log');
    
    this.initializeRecoveryStrategies();
    this.initializeFallbackChains();
    this.startHealthMonitoring();
  }

  /**
   * Handle an error with automatic recovery attempts
   */
  async handleError(error: Error, context: ErrorContext): Promise<ErrorHandlingResult> {
    const errorId = this.generateErrorId();
    const timestamp = Date.now();
    
    // Log the error
    const logEntry: ErrorLogEntry = {
      id: errorId,
      timestamp,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      },
      context,
      severity: this.determineSeverity(error, context),
      resolved: false,
      recoveryAttempts: []
    };
    
    this.errorLog.push(logEntry);
    await this.writeErrorToLog(logEntry);
    
    // Emit error event
    this.emit('error', { errorId, error, context });
    
    // Update system health
    this.updateComponentHealth(context.component, HealthStatus.DEGRADED);
    
    // Attempt recovery
    const recoveryResult = await this.attemptRecovery(logEntry);
    
    // Generate user-friendly error message
    const userMessage = this.generateUserMessage(logEntry, recoveryResult);
    
    const result: ErrorHandlingResult = {
      errorId,
      handled: true,
      recovered: recoveryResult.success,
      userMessage,
      recoveryActions: recoveryResult.actions,
      fallbackAvailable: this.hasFallback(context.operation),
      offlineModeAvailable: this.canWorkOffline(context.operation)
    };
    
    this.emit('errorHandled', result);
    return result;
  }

  /**
   * Attempt automatic recovery for an error
   */
  private async attemptRecovery(logEntry: ErrorLogEntry): Promise<RecoveryResult> {
    const { context, error } = logEntry;
    const strategy = this.recoveryStrategies.get(context.operation);
    
    if (!strategy) {
      return {
        success: false,
        actions: [],
        message: 'No recovery strategy available'
      };
    }
    
    const actions: RecoveryAction[] = [];
    let success = false;
    
    try {
      // Execute recovery steps
      for (const step of strategy.steps) {
        const action: RecoveryAction = {
          type: step.type,
          description: step.description,
          timestamp: Date.now(),
          success: false
        };
        
        try {
          await step.execute(error, context);
          action.success = true;
          actions.push(action);
          
          // Test if recovery was successful
          if (step.validator && await step.validator()) {
            success = true;
            break;
          }
        } catch (stepError) {
          action.success = false;
          action.error = stepError.message;
          actions.push(action);
        }
      }
      
      // Update log entry
      logEntry.recoveryAttempts.push({
        timestamp: Date.now(),
        success,
        actions
      });
      
      if (success) {
        logEntry.resolved = true;
        this.updateComponentHealth(context.component, HealthStatus.HEALTHY);
      }
      
    } catch (recoveryError) {
      actions.push({
        type: 'recovery-failed',
        description: 'Recovery process failed',
        timestamp: Date.now(),
        success: false,
        error: recoveryError.message
      });
    }
    
    return {
      success,
      actions,
      message: success ? 'Recovery successful' : 'Recovery failed'
    };
  }

  /**
   * Get fallback option for a failed operation
   */
  async getFallback(operation: string, originalContext: ErrorContext): Promise<FallbackOption | null> {
    const fallbacks = this.fallbackChain.get(operation);
    
    if (!fallbacks || fallbacks.length === 0) {
      return null;
    }
    
    // Find first available fallback
    for (const fallbackOperation of fallbacks) {
      const isAvailable = await this.checkFallbackAvailability(fallbackOperation, originalContext);
      
      if (isAvailable) {
        return {
          operation: fallbackOperation,
          description: this.getFallbackDescription(operation, fallbackOperation),
          limitations: this.getFallbackLimitations(fallbackOperation),
          estimatedSuccess: this.estimateFallbackSuccess(fallbackOperation)
        };
      }
    }
    
    return null;
  }

  /**
   * Enable offline mode for supported operations
   */
  async enableOfflineMode(): Promise<OfflineModeResult> {
    this.offlineMode = true;
    
    const supportedOperations = [
      'story-editing',
      'character-management',
      'scene-editing',
      'local-analysis',
      'data-backup'
    ];
    
    const unavailableOperations = [
      'cloud-ai-generation',
      'cloud-analysis',
      'online-collaboration',
      'cloud-backup'
    ];
    
    this.emit('offlineModeEnabled', {
      supportedOperations,
      unavailableOperations
    });
    
    return {
      enabled: true,
      supportedOperations,
      unavailableOperations,
      message: 'Offline mode enabled. Some features may be limited.'
    };
  }

  /**
   * Disable offline mode and restore online functionality
   */
  async disableOfflineMode(): Promise<void> {
    this.offlineMode = false;
    
    // Test connectivity
    const isOnline = await this.testConnectivity();
    
    if (isOnline) {
      // Restore component health
      this.updateComponentHealth('network', HealthStatus.HEALTHY);
      this.emit('offlineModeDisabled', { restored: true });
    } else {
      // Keep offline mode if still no connectivity
      this.offlineMode = true;
      this.emit('offlineModeDisabled', { restored: false, reason: 'No connectivity' });
    }
  }

  /**
   * Get current system health status
   */
  getSystemHealth(): SystemHealthStatus {
    return {
      ...this.systemHealth,
      offlineMode: this.offlineMode
    };
  }

  /**
   * Get error statistics and trends
   */
  getErrorStatistics(): ErrorStatistics {
    const now = Date.now();
    const last24Hours = now - 24 * 60 * 60 * 1000;
    const last7Days = now - 7 * 24 * 60 * 60 * 1000;
    
    const recent24h 