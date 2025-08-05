import { EventEmitter } from 'events';
import * as os from 'os';

/**
 * Offline mode detection and management system
 * Provides appropriate UI feedback and functionality when network is unavailable
 */
export class OfflineModeManager extends EventEmitter {
  private isOffline: boolean;
  private networkCheckInterval: NodeJS.Timeout | null;
  private offlineCapabilities: Map<string, OfflineCapability>;
  private queuedOperations: QueuedOperation[];
  private lastOnlineTime: number;
  private connectivityHistory: ConnectivityEvent[];

  constructor(options: OfflineModeOptions = {}) {
    super();
    
    this.isOffline = false;
    this.networkCheckInterval = null;
    this.offlineCapabilities = new Map();
    this.queuedOperations = [];
    this.lastOnlineTime = Date.now();
    this.connectivityHistory = [];
    
    this.initializeOfflineCapabilities();
    this.startNetworkMonitoring(options.checkInterval || 10000);
    this.setupNetworkEventListeners();
  }

  /**
   * Check if currently in offline mode
   */
  isInOfflineMode(): boolean {
    return this.isOffline;
  }

  /**
   * Get offline capabilities for a specific feature
   */
  getOfflineCapability(feature: string): OfflineCapability | null {
    return this.offlineCapabilities.get(feature) || null;
  }

  /**
   * Get all offline capabilities
   */
  getAllOfflineCapabilities(): Map<string, OfflineCapability> {
    return new Map(this.offlineCapabilities);
  }

  /**
   * Check if a specific operation can work offline
   */
  canWorkOffline(operation: string): boolean {
    const capability = this.offlineCapabilities.get(operation);
    return capability ? capability.available : false;
  }

  /**
   * Queue an operation for when connectivity is restored
   */
  queueOperation(operation: QueuedOperation): string {
    const operationId = this.generateOperationId();
    const queuedOp: QueuedOperation = {
      ...operation,
      id: operationId,
      queuedAt: Date.now(),
      status: OperationStatus.QUEUED
    };
    
    this.queuedOperations.push(queuedOp);
    this.emit('operationQueued', queuedOp);
    
    return operationId;
  }

  /**
   * Get queued operations
   */
  getQueuedOperations(): QueuedOperation[] {
    return [...this.queuedOperations];
  }

  /**
   * Cancel a queued operation
   */
  cancelQueuedOperation(operationId: string): boolean {
    const index = this.queuedOperations.findIndex(op => op.id === operationId);
    if (index === -1) {
      return false;
    }
    
    const operation = this.queuedOperations[index];
    operation.status = OperationStatus.CANCELLED;
    this.queuedOperations.splice(index, 1);
    
    this.emit('operationCancelled', operation);
    return true;
  }

  /**
   * Force offline mode (for testing or user preference)
   */
  forceOfflineMode(reason: string = 'User requested'): void {
    if (!this.isOffline) {
      this.setOfflineMode(true, reason);
    }
  }

  /**
   * Force online mode (attempt to restore connectivity)
   */
  async forceOnlineMode(): Promise<boolean> {
    const isConnected = await this.testConnectivity();
    
    if (isConnected) {
      this.setOfflineMode(false, 'Connectivity restored');
      return true;
    }
    
    return false;
  }

  /**
   * Get offline mode status and information
   */
  getOfflineStatus(): OfflineStatus {
    return {
      isOffline: this.isOffline,
      lastOnlineTime: this.lastOnlineTime,
      offlineDuration: this.isOffline ? Date.now() - this.lastOnlineTime : 0,
      queuedOperationsCount: this.queuedOperations.length,
      availableFeatures: Array.from(this.offlineCapabilities.entries())
        .filter(([, capability]) => capability.available)
        .map(([feature]) => feature),
      unavailableFeatures: Array.from(this.offlineCapabilities.entries())
        .filter(([, capability]) => !capability.available)
        .map(([feature]) => feature)
    };
  }

  /**
   * Get connectivity history
   */
  getConnectivityHistory(): ConnectivityEvent[] {
    return [...this.connectivityHistory];
  }

  /**
   * Get network quality metrics
   */
  async getNetworkQuality(): Promise<NetworkQuality> {
    if (this.isOffline) {
      return {
        status: 'offline',
        latency: -1,
        bandwidth: 0,
        stability: 0,
        lastTest: Date.now()
      };
    }

    try {
      const startTime = Date.now();
      await this.testConnectivity();
      const latency = Date.now() - startTime;
      
      // Simplified network quality assessment
      let status: 'excellent' | 'good' | 'poor' | 'offline';
      if (latency < 100) status = 'excellent';
      else if (latency < 300) status = 'good';
      else status = 'poor';
      
      return {
        status,
        latency,
        bandwidth: this.estimateBandwidth(),
        stability: this.calculateStability(),
        lastTest: Date.now()
      };
    } catch (error) {
      return {
        status: 'offline',
        latency: -1,
        bandwidth: 0,
        stability: 0,
        lastTest: Date.now()
      };
    }
  }

  /**
   * Initialize offline capabilities for different features
   */
  private initializeOfflineCapabilities(): void {
    // Story editing - fully available offline
    this.offlineCapabilities.set('story-editing', {
      available: true,
      limitations: [],
      description: 'Full story editing capabilities available offline',
      fallbackBehavior: 'Continue with local storage'
    });

    // Character management - fully available offline
    this.offlineCapabilities.set('character-management', {
      available: true,
      limitations: [],
      description: 'Character creation and editing available offline',
      fallbackBehavior: 'Continue with local storage'
    });

    // Scene editing - fully available offline
    this.offlineCapabilities.set('scene-editing', {
      available: true,
      limitations: [],
      description: 'Scene creation and editing available offline',
      fallbackBehavior: 'Continue with local storage'
    });

    // Local AI analysis - available if local models are installed
    this.offlineCapabilities.set('local-analysis', {
      available: true,
      limitations: ['Limited to installed local models', 'May be slower than cloud AI'],
      description: 'Story analysis using local AI models',
      fallbackBehavior: 'Use local AI models or cached results'
    });

    // Data export - available offline
    this.offlineCapabilities.set('data-export', {
      available: true,
      limitations: ['Cannot upload to cloud services'],
      description: 'Export stories to local files',
      fallbackBehavior: 'Save to local file system'
    });

    // Cloud AI generation - not available offline
    this.offlineCapabilities.set('cloud-ai-generation', {
      available: false,
      limitations: ['Requires internet connection'],
      description: 'AI text generation using cloud providers',
      fallbackBehavior: 'Queue for later or use local AI if available'
    });

    // Online collaboration - not available offline
    this.offlineCapabilities.set('collaboration', {
      available: false,
      limitations: ['Requires internet connection'],
      description: 'Real-time collaboration features',
      fallbackBehavior: 'Work locally and sync when online'
    });

    // Cloud backup - not available offline
    this.offlineCapabilities.set('cloud-backup', {
      available: false,
      limitations: ['Requires internet connection'],
      description: 'Backup to cloud storage',
      fallbackBehavior: 'Create local backup and sync when online'
    });

    // Plugin marketplace - not available offline
    this.offlineCapabilities.set('plugin-marketplace', {
      available: false,
      limitations: ['Requires internet connection'],
      description: 'Browse and install plugins',
      fallbackBehavior: 'Use already installed plugins'
    });
  }

  /**
   * Start network connectivity monitoring
   */
  private startNetworkMonitoring(interval: number): void {
    this.networkCheckInterval = setInterval(async () => {
      await this.checkConnectivity();
    }, interval);
    
    // Initial check
    this.checkConnectivity();
  }

  /**
   * Setup network event listeners
   */
  private setupNetworkEventListeners(): void {
    // Listen for system network events if available
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.handleNetworkEvent('online');
      });
      
      window.addEventListener('offline', () => {
        this.handleNetworkEvent('offline');
      });
    }
  }

  /**
   * Handle network events from the system
   */
  private handleNetworkEvent(eventType: 'online' | 'offline'): void {
    const wasOffline = this.isOffline;
    const isNowOffline = eventType === 'offline';
    
    if (wasOffline !== isNowOffline) {
      this.setOfflineMode(isNowOffline, `System ${eventType} event`);
    }
  }

  /**
   * Check network connectivity
   */
  private async checkConnectivity(): Promise<void> {
    try {
      const isConnected = await this.testConnectivity();
      const wasOffline = this.isOffline;
      
      if (wasOffline && isConnected) {
        // Coming back online
        this.setOfflineMode(false, 'Connectivity restored');
        await this.processQueuedOperations();
      } else if (!wasOffline && !isConnected) {
        // Going offline
        this.setOfflineMode(true, 'Connectivity lost');
      }
    } catch (error) {
      if (!this.isOffline) {
        this.setOfflineMode(true, 'Connectivity check failed');
      }
    }
  }

  /**
   * Test network connectivity
   */
  private async testConnectivity(): Promise<boolean> {
    try {
      // Test multiple endpoints for reliability
      const testEndpoints = [
        'https://www.google.com',
        'https://www.cloudflare.com',
        'https://httpbin.org/status/200'
      ];
      
      const promises = testEndpoints.map(endpoint => 
        fetch(endpoint, { 
          method: 'HEAD', 
          mode: 'no-cors',
          cache: 'no-cache',
          signal: AbortSignal.timeout(5000)
        })
      );
      
      // If any endpoint responds, consider connected
      await Promise.any(promises);
      return true;
    } catch (error) {
      // All endpoints failed
      return false;
    }
  }

  /**
   * Set offline mode state
   */
  private setOfflineMode(offline: boolean, reason: string): void {
    const previousState = this.isOffline;
    this.isOffline = offline;
    
    if (!offline) {
      this.lastOnlineTime = Date.now();
    }
    
    // Record connectivity event
    const event: ConnectivityEvent = {
      timestamp: Date.now(),
      type: offline ? 'offline' : 'online',
      reason,
      duration: previousState !== offline ? Date.now() - this.lastOnlineTime : 0
    };
    
    this.connectivityHistory.push(event);
    
    // Keep only last 100 events
    if (this.connectivityHistory.length > 100) {
      this.connectivityHistory.shift();
    }
    
    // Emit appropriate events
    if (offline && !previousState) {
      this.emit('wentOffline', { reason, timestamp: Date.now() });
    } else if (!offline && previousState) {
      this.emit('wentOnline', { reason, timestamp: Date.now() });
    }
    
    this.emit('connectivityChanged', { 
      isOffline: offline, 
      reason, 
      timestamp: Date.now() 
    });
  }

  /**
   * Process queued operations when connectivity is restored
   */
  private async processQueuedOperations(): Promise<void> {
    if (this.queuedOperations.length === 0) {
      return;
    }
    
    this.emit('processingQueuedOperations', { 
      count: this.queuedOperations.length 
    });
    
    const operations = [...this.queuedOperations];
    this.queuedOperations = [];
    
    for (const operation of operations) {
      try {
        operation.status = OperationStatus.PROCESSING;
        this.emit('processingQueuedOperation', operation);
        
        // Execute the queued operation
        await this.executeQueuedOperation(operation);
        
        operation.status = OperationStatus.COMPLETED;
        operation.completedAt = Date.now();
        
        this.emit('queuedOperationCompleted', operation);
      } catch (error) {
        operation.status = OperationStatus.FAILED;
        operation.error = error.message;
        operation.completedAt = Date.now();
        
        this.emit('queuedOperationFailed', operation);
        
        // Re-queue if it's a retryable operation
        if (operation.retryCount < (operation.maxRetries || 3)) {
          operation.retryCount++;
          operation.status = OperationStatus.QUEUED;
          this.queuedOperations.push(operation);
        }
      }
    }
    
    this.emit('queuedOperationsProcessed', { 
      processed: operations.length,
      remaining: this.queuedOperations.length 
    });
  }

  /**
   * Execute a queued operation
   */
  private async executeQueuedOperation(operation: QueuedOperation): Promise<void> {
    // This would integrate with the actual operation execution system
    // For now, we'll simulate the execution
    
    switch (operation.type) {
      case 'cloud-backup':
        await this.simulateCloudBackup(operation.data);
        break;
      case 'ai-generation':
        await this.simulateAIGeneration(operation.data);
        break;
      case 'collaboration-sync':
        await this.simulateCollaborationSync(operation.data);
        break;
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  /**
   * Simulate cloud backup operation
   */
  private async simulateCloudBackup(data: any): Promise<void> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // In real implementation, this would perform actual backup
    console.log('Executing queued cloud backup:', data);
  }

  /**
   * Simulate AI generation operation
   */
  private async simulateAIGeneration(data: any): Promise<void> {
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // In real implementation, this would call AI provider
    console.log('Executing queued AI generation:', data);
  }

  /**
   * Simulate collaboration sync operation
   */
  private async simulateCollaborationSync(data: any): Promise<void> {
    // Simulate sync delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // In real implementation, this would sync with collaboration server
    console.log('Executing queued collaboration sync:', data);
  }

  /**
   * Estimate network bandwidth (simplified)
   */
  private estimateBandwidth(): number {
    // This would perform actual bandwidth testing
    // For now, return a mock value
    return 10; // Mbps
  }

  /**
   * Calculate network stability based on connectivity history
   */
  private calculateStability(): number {
    if (this.connectivityHistory.length < 2) {
      return 1.0; // Assume stable if no history
    }
    
    const recentEvents = this.connectivityHistory.slice(-10);
    const disconnections = recentEvents.filter(e => e.type === 'offline').length;
    
    // Stability decreases with more disconnections
    return Math.max(0, 1 - (disconnections * 0.1));
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Stop network monitoring
   */
  private stopNetworkMonitoring(): void {
    if (this.networkCheckInterval) {
      clearInterval(this.networkCheckInterval);
      this.networkCheckInterval = null;
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopNetworkMonitoring();
    this.removeAllListeners();
  }
}

// Types and interfaces
export interface OfflineModeOptions {
  checkInterval?: number;
}

export interface OfflineCapability {
  available: boolean;
  limitations: string[];
  description: string;
  fallbackBehavior: string;
}

export interface QueuedOperation {
  id?: string;
  type: string;
  data: any;
  priority: 'low' | 'normal' | 'high';
  queuedAt?: number;
  completedAt?: number;
  status?: OperationStatus;
  retryCount?: number;
  maxRetries?: number;
  error?: string;
}

export interface OfflineStatus {
  isOffline: boolean;
  lastOnlineTime: number;
  offlineDuration: number;
  queuedOperationsCount: number;
  availableFeatures: string[];
  unavailableFeatures: string[];
}

export interface ConnectivityEvent {
  timestamp: number;
  type: 'online' | 'offline';
  reason: string;
  duration: number;
}

export interface NetworkQuality {
  status: 'excellent' | 'good' | 'poor' | 'offline';
  latency: number;
  bandwidth: number;
  stability: number;
  lastTest: number;
}

export enum OperationStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}