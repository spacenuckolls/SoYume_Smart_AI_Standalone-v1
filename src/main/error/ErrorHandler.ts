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
    
    const recent24h = this.errorLog.filter(e => e.timestamp > last24Hours);
    const recent7d = this.errorLog.filter(e => e.timestamp > last7Days);
    
    const byComponent = new Map<string, number>();
    const bySeverity = new Map<ErrorSeverity, number>();
    
    recent24h.forEach(entry => {
      const component = entry.context.component;
      byComponent.set(component, (byComponent.get(component) || 0) + 1);
      bySeverity.set(entry.severity, (bySeverity.get(entry.severity) || 0) + 1);
    });
    
    return {
      totalErrors: this.errorLog.length,
      errors24h: recent24h.length,
      errors7d: recent7d.length,
      resolvedErrors: this.errorLog.filter(e => e.resolved).length,
      errorsByComponent: Object.fromEntries(byComponent),
      errorsBySeverity: Object.fromEntries(bySeverity),
      averageRecoveryTime: this.calculateAverageRecoveryTime(),
      topErrors: this.getTopErrors(10)
    };
  }

  /**
   * Create data backup for recovery purposes
   */
  async createBackup(type: BackupType = BackupType.FULL): Promise<BackupResult> {
    const backupId = this.generateBackupId();
    const timestamp = Date.now();
    
    try {
      const backupData: BackupData = {
        id: backupId,
        timestamp,
        type,
        version: '1.0.0',
        data: {}
      };
      
      // Collect data based on backup type
      switch (type) {
        case BackupType.FULL:
          backupData.data = await this.collectFullBackupData();
          break;
        case BackupType.STORIES_ONLY:
          backupData.data = await this.collectStoriesData();
          break;
        case BackupType.SETTINGS_ONLY:
          backupData.data = await this.collectSettingsData();
          break;
        case BackupType.INCREMENTAL:
          backupData.data = await this.collectIncrementalData();
          break;
      }
      
      // Write backup to file
      const backupPath = await this.writeBackupToFile(backupData);
      
      this.emit('backupCreated', { backupId, type, path: backupPath });
      
      return {
        success: true,
        backupId,
        path: backupPath,
        size: JSON.stringify(backupData).length,
        timestamp
      };
      
    } catch (error) {
      this.emit('backupFailed', { backupId, error: error.message });
      
      return {
        success: false,
        error: error.message,
        timestamp
      };
    }
  }

  /**
   * Restore data from backup
   */
  async restoreFromBackup(backupPath: string): Promise<RestoreResult> {
    try {
      const backupData = await this.readBackupFromFile(backupPath);
      
      // Validate backup data
      if (!this.validateBackupData(backupData)) {
        throw new Error('Invalid backup data format');
      }
      
      // Restore data
      const restoreActions = await this.performRestore(backupData);
      
      this.emit('restoreCompleted', { backupId: backupData.id, actions: restoreActions });
      
      return {
        success: true,
        backupId: backupData.id,
        restoredItems: restoreActions.length,
        actions: restoreActions
      };
      
    } catch (error) {
      this.emit('restoreFailed', { error: error.message });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Initialize recovery strategies for different operations
   */
  private initializeRecoveryStrategies(): void {
    // AI Provider failure recovery
    this.recoveryStrategies.set('ai-generation', {
      steps: [
        {
          type: 'retry',
          description: 'Retry with exponential backoff',
          execute: async (error, context) => {
            await this.delay(1000);
            // Retry logic would be implemented here
          },
          validator: async () => {
            // Test if AI provider is responsive
            return await this.testAIProviderHealth(context.provider);
          }
        },
        {
          type: 'fallback',
          description: 'Switch to fallback AI provider',
          execute: async (error, context) => {
            // Switch to fallback provider
            const fallback = await this.getFallback('ai-generation', context);
            if (fallback) {
              context.provider = fallback.operation;
            }
          }
        },
        {
          type: 'offline',
          description: 'Enable offline mode',
          execute: async (error, context) => {
            await this.enableOfflineMode();
          }
        }
      ]
    });
    
    // Database failure recovery
    this.recoveryStrategies.set('database-operation', {
      steps: [
        {
          type: 'retry',
          description: 'Retry database operation',
          execute: async (error, context) => {
            await this.delay(500);
          }
        },
        {
          type: 'repair',
          description: 'Attempt database repair',
          execute: async (error, context) => {
            // Database repair logic
          }
        },
        {
          type: 'backup-restore',
          description: 'Restore from recent backup',
          execute: async (error, context) => {
            const latestBackup = await this.findLatestBackup();
            if (latestBackup) {
              await this.restoreFromBackup(latestBackup);
            }
          }
        }
      ]
    });
    
    // Network failure recovery
    this.recoveryStrategies.set('network-request', {
      steps: [
        {
          type: 'retry',
          description: 'Retry with different endpoint',
          execute: async (error, context) => {
            await this.delay(2000);
          }
        },
        {
          type: 'cache',
          description: 'Use cached data if available',
          execute: async (error, context) => {
            // Check cache for fallback data
          }
        },
        {
          type: 'offline',
          description: 'Switch to offline mode',
          execute: async (error, context) => {
            await this.enableOfflineMode();
          }
        }
      ]
    });
  }

  /**
   * Initialize fallback chains for operations
   */
  private initializeFallbackChains(): void {
    // AI generation fallback chain
    this.fallbackChain.set('ai-generation', [
      'cowriter-ai',
      'local-ai',
      'cached-response',
      'template-generation'
    ]);
    
    // Analysis fallback chain
    this.fallbackChain.set('story-analysis', [
      'local-analysis',
      'cached-analysis',
      'basic-analysis'
    ]);
    
    // Export fallback chain
    this.fallbackChain.set('story-export', [
      'local-export',
      'basic-export',
      'text-export'
    ]);
  }

  /**
   * Start system health monitoring
   */
  private startHealthMonitoring(): void {
    setInterval(async () => {
      await this.checkSystemHealth();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Check overall system health
   */
  private async checkSystemHealth(): Promise<void> {
    const components = ['database', 'ai-providers', 'network', 'file-system'];
    
    for (const component of components) {
      const health = await this.checkComponentHealth(component);
      this.systemHealth.components.set(component, health);
    }
    
    // Determine overall health
    const healthValues = Array.from(this.systemHealth.components.values());
    const criticalCount = healthValues.filter(h => h === HealthStatus.CRITICAL).length;
    const degradedCount = healthValues.filter(h => h === HealthStatus.DEGRADED).length;
    
    if (criticalCount > 0) {
      this.systemHealth.overall = HealthStatus.CRITICAL;
    } else if (degradedCount > 0) {
      this.systemHealth.overall = HealthStatus.DEGRADED;
    } else {
      this.systemHealth.overall = HealthStatus.HEALTHY;
    }
    
    this.systemHealth.lastCheck = Date.now();
    this.emit('healthCheck', this.systemHealth);
  }

  /**
   * Check health of a specific component
   */
  private async checkComponentHealth(component: string): Promise<HealthStatus> {
    try {
      switch (component) {
        case 'database':
          return await this.testDatabaseHealth();
        case 'ai-providers':
          return await this.testAIProvidersHealth();
        case 'network':
          return await this.testNetworkHealth();
        case 'file-system':
          return await this.testFileSystemHealth();
        default:
          return HealthStatus.UNKNOWN;
      }
    } catch (error) {
      return HealthStatus.CRITICAL;
    }
  }

  /**
   * Test database connectivity and health
   */
  private async testDatabaseHealth(): Promise<HealthStatus> {
    try {
      // Mock database health check
      await this.delay(10);
      return HealthStatus.HEALTHY;
    } catch (error) {
      return HealthStatus.CRITICAL;
    }
  }

  /**
   * Test AI providers health
   */
  private async testAIProvidersHealth(): Promise<HealthStatus> {
    try {
      // Mock AI provider health check
      await this.delay(100);
      return HealthStatus.HEALTHY;
    } catch (error) {
      return HealthStatus.DEGRADED;
    }
  }

  /**
   * Test network connectivity
   */
  private async testNetworkHealth(): Promise<HealthStatus> {
    try {
      // Mock network connectivity test
      const isOnline = await this.testConnectivity();
      return isOnline ? HealthStatus.HEALTHY : HealthStatus.CRITICAL;
    } catch (error) {
      return HealthStatus.CRITICAL;
    }
  }

  /**
   * Test file system access
   */
  private async testFileSystemHealth(): Promise<HealthStatus> {
    try {
      // Test file system access
      await fs.access(process.cwd());
      return HealthStatus.HEALTHY;
    } catch (error) {
      return HealthStatus.CRITICAL;
    }
  }

  /**
   * Helper methods
   */
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private determineSeverity(error: Error, context: ErrorContext): ErrorSeverity {
    // Determine severity based on error type and context
    if (error.name === 'DatabaseError' || context.component === 'database') {
      return ErrorSeverity.CRITICAL;
    }
    if (error.name === 'NetworkError' && context.operation === 'ai-generation') {
      return ErrorSeverity.HIGH;
    }
    if (error.name === 'ValidationError') {
      return ErrorSeverity.MEDIUM;
    }
    return ErrorSeverity.LOW;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async testConnectivity(): Promise<boolean> {
    // Mock connectivity test
    return true;
  }

  private async testAIProviderHealth(provider?: string): Promise<boolean> {
    // Mock AI provider health test
    return true;
  }

  private hasFallback(operation: string): boolean {
    return this.fallbackChain.has(operation);
  }

  private canWorkOffline(operation: string): boolean {
    const offlineOperations = [
      'story-editing',
      'character-management',
      'scene-editing',
      'local-analysis'
    ];
    return offlineOperations.includes(operation);
  }

  private updateComponentHealth(component: string, health: HealthStatus): void {
    this.systemHealth.components.set(component, health);
  }

  private generateUserMessage(logEntry: ErrorLogEntry, recoveryResult: RecoveryResult): string {
    const { error, context, severity } = logEntry;
    
    const baseMessages = {
      [ErrorSeverity.CRITICAL]: 'A critical error occurred that may affect core functionality.',
      [ErrorSeverity.HIGH]: 'An important feature encountered an error.',
      [ErrorSeverity.MEDIUM]: 'A minor issue was detected.',
      [ErrorSeverity.LOW]: 'A small problem occurred but shouldn\'t affect your work.'
    };
    
    let message = baseMessages[severity];
    
    if (recoveryResult.success) {
      message += ' The issue has been automatically resolved.';
    } else {
      message += ' Please try the suggested recovery actions.';
    }
    
    return message;
  }

  private async checkFallbackAvailability(fallback: string, context: ErrorContext): Promise<boolean> {
    // Mock fallback availability check
    return true;
  }

  private getFallbackDescription(original: string, fallback: string): string {
    const descriptions: Record<string, string> = {
      'cowriter-ai': 'Use SoYume Co-writer AI (offline)',
      'local-ai': 'Use local AI model',
      'cached-response': 'Use previously cached response',
      'template-generation': 'Use template-based generation'
    };
    return descriptions[fallback] || `Use ${fallback} as alternative`;
  }

  private getFallbackLimitations(fallback: string): string[] {
    const limitations: Record<string, string[]> = {
      'cowriter-ai': ['Limited to basic creative writing functions'],
      'local-ai': ['May be slower than cloud AI', 'Limited model capabilities'],
      'cached-response': ['May not be current', 'Limited to previous queries'],
      'template-generation': ['Basic functionality only', 'No AI enhancement']
    };
    return limitations[fallback] || [];
  }

  private estimateFallbackSuccess(fallback: string): number {
    const estimates: Record<string, number> = {
      'cowriter-ai': 0.9,
      'local-ai': 0.8,
      'cached-response': 0.7,
      'template-generation': 0.6
    };
    return estimates[fallback] || 0.5;
  }

  private calculateAverageRecoveryTime(): number {
    const resolvedErrors = this.errorLog.filter(e => e.resolved && e.recoveryAttempts.length > 0);
    if (resolvedErrors.length === 0) return 0;
    
    const totalTime = resolvedErrors.reduce((sum, error) => {
      const firstAttempt = error.recoveryAttempts[0];
      const lastAttempt = error.recoveryAttempts[error.recoveryAttempts.length - 1];
      return sum + (lastAttempt.timestamp - firstAttempt.timestamp);
    }, 0);
    
    return totalTime / resolvedErrors.length;
  }

  private getTopErrors(limit: number): TopError[] {
    const errorCounts = new Map<string, number>();
    
    this.errorLog.forEach(entry => {
      const key = `${entry.error.name}:${entry.context.operation}`;
      errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
    });
    
    return Array.from(errorCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([error, count]) => ({ error, count }));
  }

  private async writeErrorToLog(entry: ErrorLogEntry): Promise<void> {
    try {
      const logLine = JSON.stringify(entry) + '\n';
      await fs.appendFile(this.logFilePath, logLine);
    } catch (error) {
      // If we can't write to log file, emit event instead
      this.emit('logWriteError', error);
    }
  }

  private async collectFullBackupData(): Promise<any> {
    return {
      stories: [], // Would collect actual story data
      characters: [],
      settings: {},
      userPreferences: {}
    };
  }

  private async collectStoriesData(): Promise<any> {
    return { stories: [], characters: [] };
  }

  private async collectSettingsData(): Promise<any> {
    return { settings: {}, userPreferences: {} };
  }

  private async collectIncrementalData(): Promise<any> {
    return { changedSince: Date.now() - 24 * 60 * 60 * 1000 };
  }

  private async writeBackupToFile(backupData: BackupData): Promise<string> {
    const backupDir = path.join(process.cwd(), 'backups');
    const filename = `backup_${backupData.id}.json`;
    const filePath = path.join(backupDir, filename);
    
    await fs.mkdir(backupDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(backupData, null, 2));
    
    return filePath;
  }

  private async readBackupFromFile(backupPath: string): Promise<BackupData> {
    const content = await fs.readFile(backupPath, 'utf8');
    return JSON.parse(content);
  }

  private validateBackupData(backupData: BackupData): boolean {
    return backupData.id && backupData.timestamp && backupData.version && backupData.data;
  }

  private async performRestore(backupData: BackupData): Promise<RestoreAction[]> {
    const actions: RestoreAction[] = [];
    
    // Mock restore actions
    actions.push({
      type: 'stories',
      description: 'Restored story data',
      success: true,
      itemsRestored: 0
    });
    
    return actions;
  }

  private async findLatestBackup(): Promise<string | null> {
    // Mock finding latest backup
    return null;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.removeAllListeners();
  }
}

// Types and interfaces
export interface ErrorHandlerOptions {
  logFilePath?: string;
}

export interface ErrorContext {
  operation: string;
  component: string;
  provider?: string;
  userId?: string;
  metadata?: any;
}

export interface ErrorLogEntry {
  id: string;
  timestamp: number;
  error: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  context: ErrorContext;
  severity: ErrorSeverity;
  resolved: boolean;
  recoveryAttempts: RecoveryAttempt[];
}

export interface ErrorHandlingResult {
  errorId: string;
  handled: boolean;
  recovered: boolean;
  userMessage: string;
  recoveryActions: RecoveryAction[];
  fallbackAvailable: boolean;
  offlineModeAvailable: boolean;
}

export interface RecoveryStrategy {
  steps: RecoveryStep[];
}

export interface RecoveryStep {
  type: string;
  description: string;
  execute: (error: Error, context: ErrorContext) => Promise<void>;
  validator?: () => Promise<boolean>;
}

export interface RecoveryResult {
  success: boolean;
  actions: RecoveryAction[];
  message: string;
}

export interface RecoveryAction {
  type: string;
  description: string;
  timestamp: number;
  success: boolean;
  error?: string;
}

export interface RecoveryAttempt {
  timestamp: number;
  success: boolean;
  actions: RecoveryAction[];
}

export interface FallbackOption {
  operation: string;
  description: string;
  limitations: string[];
  estimatedSuccess: number;
}

export interface OfflineModeResult {
  enabled: boolean;
  supportedOperations: string[];
  unavailableOperations: string[];
  message: string;
}

export interface SystemHealthStatus {
  overall: HealthStatus;
  components: Map<string, HealthStatus>;
  lastCheck: number;
  offlineMode?: boolean;
}

export interface ErrorStatistics {
  totalErrors: number;
  errors24h: number;
  errors7d: number;
  resolvedErrors: number;
  errorsByComponent: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  averageRecoveryTime: number;
  topErrors: TopError[];
}

export interface TopError {
  error: string;
  count: number;
}

export interface BackupResult {
  success: boolean;
  backupId?: string;
  path?: string;
  size?: number;
  timestamp: number;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  backupId?: string;
  restoredItems?: number;
  actions?: RestoreAction[];
  error?: string;
}

export interface BackupData {
  id: string;
  timestamp: number;
  type: BackupType;
  version: string;
  data: any;
}

export interface RestoreAction {
  type: string;
  description: string;
  success: boolean;
  itemsRestored: number;
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  CRITICAL = 'critical',
  UNKNOWN = 'unknown'
}

export enum BackupType {
  FULL = 'full',
  INCREMENTAL = 'incremental',
  STORIES_ONLY = 'stories-only',
  SETTINGS_ONLY = 'settings-only'
}